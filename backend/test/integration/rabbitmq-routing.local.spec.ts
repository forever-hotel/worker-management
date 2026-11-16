import { randomUUID } from 'node:crypto';
import { connect } from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';

import { RabbitMqService } from '../../src/messaging/rabbitmq/rabbitmq.service';

const localTest =
  process.env.RUN_WKMS_DOCKER_INTEGRATION === '1' ? it : it.skip;

describe('RabbitMQ mandatory routing integration', () => {
  localTest(
    'rejects unroutable events and confirms routable events',
    async () => {
      const url = 'amqp://guest:guest@127.0.0.1:5672';

      // Use a unique test exchange to avoid affecting
      // the real forever.events exchange.
      const exchange = `wkms.routing.test.${randomUUID()}`;
      const routingKey = 'wkms.task.escalated.v1';

      const rabbit = new RabbitMqService({
        enabled: true,
        url,
        exchange,
      });

      let connection: ChannelModel | undefined;
      let channel: Channel | undefined;

      try {
        connection = await connect(url);
        channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'topic', {
          durable: true,
        });

        await rabbit.onModuleInit();

        // CASE 1: No queue is bound.
        const missingEventId = `test:${randomUUID()}`;

        await expect(
          rabbit.publishJson(
            routingKey,
            { eventId: missingEventId },
            missingEventId,
          ),
        ).rejects.toThrow('RabbitMQ message was returned as unroutable');

        // CASE 2: Create and bind a temporary test queue.
        const { queue } = await channel.assertQueue('', {
          exclusive: true,
          autoDelete: true,
        });

        await channel.bindQueue(queue, exchange, routingKey);

        const deliveredEventId = `test:${randomUUID()}`;

        await expect(
          rabbit.publishJson(
            routingKey,
            { eventId: deliveredEventId },
            deliveredEventId,
          ),
        ).resolves.toBeUndefined();

        const received = await channel.get(queue, {
          noAck: true,
        });

        expect(received).not.toBe(false);

        if (!received) {
          throw new Error('Expected RabbitMQ message');
        }

        expect(received.properties.messageId).toBe(deliveredEventId);

        expect(JSON.parse(received.content.toString())).toEqual({
          eventId: deliveredEventId,
        });
      } finally {
        await rabbit.onApplicationShutdown();

        if (channel) {
          await channel.deleteExchange(exchange).catch(() => undefined);

          await channel.close().catch(() => undefined);
        }

        await connection?.close().catch(() => undefined);
      }
    },
    30_000,
  );
});
