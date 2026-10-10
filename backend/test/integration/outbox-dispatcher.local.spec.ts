import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';

import { DatabaseService } from '../../src/database/database.service';
import { OutboxDispatcherService } from '../../src/messaging/outbox/outbox-dispatcher.service';
import { RabbitMqService } from '../../src/messaging/rabbitmq/rabbitmq.service';

const localTest =
  process.env.RUN_WKMS_DOCKER_INTEGRATION === '1' ? it : it.skip;

describe('Real Docker outbox integration', () => {
  localTest('publishes a pending event and updates PostgreSQL', async () => {
    const databaseUrl = process.env.WKMS_DOCKER_TEST_DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        'WKMS_DOCKER_TEST_DATABASE_URL is required for local Docker tests',
      );
    }

    const target = new URL(databaseUrl);

    if (
      target.hostname !== '127.0.0.1' ||
      target.port !== '55432' ||
      target.pathname !== '/wkms_outbox_test'
    ) {
      throw new Error(
        'Docker integration tests must use the isolated local test database',
      );
    }

    const rabbitUrl = 'amqp://guest:guest@127.0.0.1:5672';

    const database = new DatabaseService({
      get: (key: string) => (key === 'DATABASE_URL' ? databaseUrl : undefined),
    } as unknown as ConfigService);

    const rabbit = new RabbitMqService({
      enabled: true,
      url: rabbitUrl,
      exchange: 'forever.events',
    });

    const taskId = randomUUID();
    const eventId = `escalation:${taskId}`;
    const timestamp = new Date().toISOString();

    const payload = {
      eventId,
      eventType: 'task.escalated',
      eventVersion: 1,
      occurredAt: timestamp,
      source: 'worker-management',
      data: {
        taskId,
        taskCategory: 'ROOM_CLEANING',
        roomNumber: '205',
        priority: 'HIGH',
        escalatedAt: timestamp,
      },
    };

    let connection: ChannelModel | undefined;
    let channel: Channel | undefined;

    try {
      await database.onModuleInit();

      await database.query(
        `INSERT INTO wkms_tasks (
           task_id, room_number, category,
           priority, status, source, submitted_at
         )
         VALUES ($1, '205', 'ROOM_CLEANING',
                 'HIGH', 'ESCALATED', 'FRONT_DESK',
                 NOW() - INTERVAL '20 minutes')`,
        [taskId],
      );

      await database.query(
        `INSERT INTO wkms_event_outbox (
           event_id, task_id, event_type,
           routing_key, payload
         )
         VALUES (
           $1, $2, 'task.escalated',
           'wkms.task.escalated.v1', $3::jsonb
         )`,
        [eventId, taskId, JSON.stringify(payload)],
      );

      // Subscribe before publishing so the test message
      // has a queue to reach.
      connection = await connect(rabbitUrl);
      channel = await connection.createChannel();

      await channel.assertExchange('forever.events', 'topic', {
        durable: true,
      });

      const { queue } = await channel.assertQueue('', {
        exclusive: true,
        autoDelete: true,
      });

      await channel.bindQueue(
        queue,
        'forever.events',
        'wkms.task.escalated.v1',
      );

      await rabbit.onModuleInit();

      const dispatcher = new OutboxDispatcherService(database, rabbit);

      await dispatcher.dispatchPendingEvents();

      const result = await database.query<{
        status: string;
        attempt_count: number;
      }>(
        `SELECT status, attempt_count
         FROM wkms_event_outbox
         WHERE event_id = $1`,
        [eventId],
      );

      expect(result.rows[0]).toMatchObject({
        status: 'PUBLISHED',
        attempt_count: 1,
      });

      let receivedOurEvent = false;

      for (let i = 0; i < 10; i++) {
        const message = await channel.get(queue, {
          noAck: true,
        });

        if (!message) break;

        if (message.properties.messageId === eventId) {
          expect(JSON.parse(message.content.toString())).toMatchObject(payload);

          receivedOurEvent = true;
          break;
        }
      }

      expect(receivedOurEvent).toBe(true);
    } finally {
      await channel?.close();
      await connection?.close();
      await rabbit.onApplicationShutdown();

      // Remove only this test's disposable records.
      await database.query(
        'DELETE FROM wkms_event_outbox WHERE event_id = $1',
        [eventId],
      );

      await database.query('DELETE FROM wkms_tasks WHERE task_id = $1', [
        taskId,
      ]);

      await database.onModuleDestroy();
    }
  });
});
