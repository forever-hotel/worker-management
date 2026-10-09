import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';

import { DatabaseService } from '../../src/database/database.service';
import { TaskRepository } from '../../src/database/repositories/task.repository';
import { OutboxDispatcherService } from '../../src/messaging/outbox/outbox-dispatcher.service';
import { RabbitMqService } from '../../src/messaging/rabbitmq/rabbitmq.service';

const localTest =
  process.env.RUN_WKMS_DOCKER_INTEGRATION === '1' ? it : it.skip;

describe('Docker outbox failure and recovery', () => {
  localTest(
    'retains and retries an event after RabbitMQ recovers',
    async () => {
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
        get: (key: string) =>
          key === 'DATABASE_URL' ? databaseUrl : undefined,
      } as unknown as ConfigService);

      const unavailableRabbit = new RabbitMqService({
        enabled: true,
        url: 'amqp://guest:guest@127.0.0.1:5679',
        exchange: 'forever.events',
      });

      const workingRabbit = new RabbitMqService({
        enabled: true,
        url: rabbitUrl,
        exchange: 'forever.events',
      });

      const taskId = randomUUID();
      const eventId = `escalation:${taskId}`;

      let connection: ChannelModel | undefined;
      let channel: Channel | undefined;

      try {
        await database.onModuleInit();

        // 1. Create an overdue test task.
        await database.query(
          `INSERT INTO wkms_tasks (
          task_id, room_number, category,
          priority, status, source, submitted_at
        )
        VALUES (
          $1, '205', 'ROOM_CLEANING',
          'HIGH', 'UNASSIGNED', 'FRONT_DESK',
          NOW() - INTERVAL '20 minutes'
        )`,
          [taskId],
        );

        // 2. Execute the real repository escalation operation.
        const taskRepository = new TaskRepository(database);
        const escalatedTasks = await taskRepository.escalateOverdueTasks();

        expect(escalatedTasks.some((task) => task.task_id === taskId)).toBe(
          true,
        );

        // 3. Simulate RabbitMQ being unavailable.
        await unavailableRabbit.onModuleInit();

        const offlineDispatcher = new OutboxDispatcherService(
          database,
          unavailableRabbit,
        );

        await offlineDispatcher.dispatchPendingEvents();

        const failedResult = await database.query<{
          status: string;
          attempt_count: number;
          last_error: string | null;
        }>(
          `SELECT status, attempt_count, last_error
         FROM wkms_event_outbox
         WHERE event_id = $1`,
          [eventId],
        );

        expect(failedResult.rows[0]).toMatchObject({
          status: 'PENDING',
          attempt_count: 1,
        });

        expect(failedResult.rows[0].last_error).not.toBeNull();

        // 4. Simulate the retry delay having elapsed.
        await database.query(
          `UPDATE wkms_event_outbox
         SET last_attempt_at =
           NOW() - INTERVAL '61 seconds'
         WHERE event_id = $1`,
          [eventId],
        );

        // 5. Create a receiving queue before recovery.
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

        // 6. Retry using the working RabbitMQ connection.
        await workingRabbit.onModuleInit();

        const recoveryDispatcher = new OutboxDispatcherService(
          database,
          workingRabbit,
        );

        await recoveryDispatcher.dispatchPendingEvents();

        // 7. Verify PostgreSQL marks the event published.
        const recoveredResult = await database.query<{
          status: string;
          attempt_count: number;
        }>(
          `SELECT status, attempt_count
         FROM wkms_event_outbox
         WHERE event_id = $1`,
          [eventId],
        );

        expect(recoveredResult.rows[0]).toMatchObject({
          status: 'PUBLISHED',
          attempt_count: 2,
        });

        // 8. Verify the task itself remains escalated.
        const taskResult = await database.query<{
          status: string;
        }>('SELECT status FROM wkms_tasks WHERE task_id = $1', [taskId]);

        expect(taskResult.rows[0].status).toBe('ESCALATED');

        // 9. Verify RabbitMQ received our specific event.
        let received = false;

        for (let i = 0; i < 20; i++) {
          const message = await channel.get(queue, {
            noAck: true,
          });

          if (!message) break;

          if (message.properties.messageId === eventId) {
            const payload = JSON.parse(message.content.toString()) as {
              eventId: string;
            };

            expect(payload.eventId).toBe(eventId);
            received = true;
            break;
          }
        }

        expect(received).toBe(true);
      } finally {
        await channel?.close().catch(() => undefined);
        await connection?.close().catch(() => undefined);

        await unavailableRabbit.onApplicationShutdown();
        await workingRabbit.onApplicationShutdown();

        // Clean up this test's records only.
        await database.query(
          'DELETE FROM wkms_event_outbox WHERE event_id = $1',
          [eventId],
        );

        await database.query('DELETE FROM wkms_tasks WHERE task_id = $1', [
          taskId,
        ]);

        await database.onModuleDestroy();
      }
    },
  );
});
