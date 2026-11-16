import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { connect } from 'amqplib';
import type { ChannelModel, ConfirmChannel, GetMessage } from 'amqplib';

import { DatabaseService } from '../../src/database/database.service';
import { CheckoutTaskRepository } from '../../src/database/repositories/checkout-task.repository';
import { CheckoutCompletedConsumer } from '../../src/messaging/consumers/checkout-completed.consumer';
import {
  CHECKOUT_CONSUMER_TOPOLOGY as TOPOLOGY,
  CHECKOUT_RETRY_HEADER,
} from '../../src/messaging/consumers/checkout-consumer.topology';
import { CheckoutCompletedHandler } from '../../src/messaging/handlers/checkout-completed.handler';

const localDescribe =
  process.env.RUN_WKMS_DDP78_RABBIT_INTEGRATION === '1'
    ? describe
    : describe.skip;

localDescribe('DDP-78 real RabbitMQ checkout integration', () => {
  let database: DatabaseService;
  let consumer: CheckoutCompletedConsumer;
  let publisherConnection: ChannelModel;
  let publisher: ConfirmChannel;

  let bookingId: string;
  let roomNumber: string;

  const processedOutcomes: string[] = [];

  function validateLocalTarget(
    value: string | undefined,
    kind: 'database' | 'rabbitmq',
  ): string {
    if (!value) {
      throw new Error(`Missing DDP-78 ${kind} test URL`);
    }

    const url = new URL(value);

    if (kind === 'database') {
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        url.hostname !== '127.0.0.1' ||
        url.port !== '55433' ||
        url.pathname !== '/wkms_ddp78_test'
      ) {
        throw new Error('Unsafe DDP-78 PostgreSQL test target');
      }
    } else if (
      url.protocol !== 'amqp:' ||
      url.hostname !== '127.0.0.1' ||
      url.port !== '5672' ||
      url.pathname !== '/wkms_ddp78_test'
    ) {
      throw new Error('Unsafe DDP-78 RabbitMQ test target');
    }

    return value;
  }

  function event() {
    return {
      eventId: `checkout:${bookingId}`,
      eventType: 'checkout.completed',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'front-desk',
      data: {
        bookingReference: bookingId,
        roomNumber,
        taskCategory: 'ROOM_CLEANING',
        priority: 'HIGH',
        sourceType: 'CHECKOUT_TRIGGER',
      },
    };
  }

  async function publish(
    payload: unknown,
    headers: Record<string, unknown> = {},
  ): Promise<void> {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');

    publisher.publish(
      'forever.events',
      TOPOLOGY.routingKeys.checkoutCompleted,
      body,
      {
        persistent: true,
        mandatory: true,
        contentType: 'application/json',
        messageId: `checkout:${bookingId}`,
        headers,
      },
    );

    await publisher.waitForConfirms();
  }

  async function waitForMessage(queueName: string): Promise<GetMessage> {
    const deadline = Date.now() + 8_000;

    while (Date.now() < deadline) {
      const message = await publisher.get(queueName, {
        noAck: false,
      });

      if (message) {
        return message;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(`Timed out waiting for ${queueName}`);
  }

  async function waitForProcessedCount(
    expected: number,
    timeoutMs = 8_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (processedOutcomes.length >= expected) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error('Timed out waiting for checkout processing');
  }

  async function taskCount(): Promise<number> {
    const result = await database.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM wkms_tasks
       WHERE booking_id = $1`,
      [bookingId],
    );

    return result.rows[0]?.total ?? 0;
  }

  beforeAll(async () => {
    const databaseUrl = validateLocalTarget(
      process.env.WKMS_DDP78_TEST_DATABASE_URL,
      'database',
    );

    const rabbitUrl = validateLocalTarget(
      process.env.WKMS_DDP78_TEST_RABBITMQ_URL,
      'rabbitmq',
    );

    database = new DatabaseService({
      get: (key: string) => (key === 'DATABASE_URL' ? databaseUrl : undefined),
    } as unknown as ConfigService);

    await database.onModuleInit();

    const identity = await database.query<{
      database_name: string;
    }>('SELECT current_database() AS database_name');

    if (identity.rows[0]?.database_name !== 'wkms_ddp78_test') {
      throw new Error('Unexpected PostgreSQL database');
    }

    const repository = new CheckoutTaskRepository(database);
    const handler = new CheckoutCompletedHandler(
      repository,
      {
        emitTaskCreated: () => undefined,
      } as unknown as ConstructorParameters<typeof CheckoutCompletedHandler>[1],
    );

    const originalHandle = handler.handle.bind(handler);

    jest
      .spyOn(handler, 'handle')
      .mockImplementation(async (payload: unknown) => {
        const result = await originalHandle(payload);
        processedOutcomes.push(result.status);
        return result;
      });

    consumer = new CheckoutCompletedConsumer(
      {
        enabled: true,
        url: rabbitUrl,
        exchange: 'forever.events',
      },
      handler,
    );

    await consumer.onModuleInit();

    publisherConnection = await connect(rabbitUrl);
    publisher = await publisherConnection.createConfirmChannel();

    // Fail the test if the consumer did not declare its queues.
    await publisher.checkQueue(TOPOLOGY.queues.main);
    await publisher.checkQueue(TOPOLOGY.queues.retry);
    await publisher.checkQueue(TOPOLOGY.queues.deadLetter);
  });

  beforeEach(async () => {
    processedOutcomes.length = 0;

    await publisher.purgeQueue(TOPOLOGY.queues.main);
    await publisher.purgeQueue(TOPOLOGY.queues.retry);
    await publisher.purgeQueue(TOPOLOGY.queues.deadLetter);

    bookingId = randomUUID();
    roomNumber =
      'D78' + randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

    await database.query(
      `INSERT INTO rooms (room_number, status)
       VALUES ($1, 'REQUIRES_CLEANING')`,
      [roomNumber],
    );

    await database.query(
      `INSERT INTO bookings (booking_id, room_number, status)
       VALUES ($1, $2, 'CHECKED_OUT')`,
      [bookingId, roomNumber],
    );
  });

  afterEach(async () => {
    await database.query('DELETE FROM wkms_tasks WHERE booking_id = $1', [
      bookingId,
    ]);

    await database.query('DELETE FROM bookings WHERE booking_id = $1', [
      bookingId,
    ]);

    await database.query('DELETE FROM rooms WHERE room_number = $1', [
      roomNumber,
    ]);

    await publisher.purgeQueue(TOPOLOGY.queues.main);
    await publisher.purgeQueue(TOPOLOGY.queues.retry);
    await publisher.purgeQueue(TOPOLOGY.queues.deadLetter);
  });

  afterAll(async () => {
    await consumer?.onApplicationShutdown();
    await publisher?.close();
    await publisherConnection?.close();
    await database?.onModuleDestroy();
  });

  it('creates one task from a real FDS checkout message', async () => {
    await publish(event());

    await waitForProcessedCount(1);

    expect(processedOutcomes).toEqual(['CREATED']);
    expect(await taskCount()).toBe(1);

    const result = await database.query(
      `SELECT *
       FROM wkms_tasks
       WHERE booking_id = $1`,
      [bookingId],
    );

    expect(result.rows[0]).toMatchObject({
      category: 'ROOM_CLEANING',
      source: 'CHECKOUT_TRIGGER',
      priority: 'HIGH',
      status: 'UNASSIGNED',
      room_number: roomNumber,
    });
  });

  it('does not create duplicate tasks for repeated messages', async () => {
    const payload = event();

    await publish(payload);
    await waitForProcessedCount(1);

    await publish(payload);
    await waitForProcessedCount(2);

    expect(processedOutcomes).toEqual(['CREATED', 'EXISTS']);
    expect(await taskCount()).toBe(1);
  });

  it('routes malformed events to the dead-letter queue', async () => {
    await publish({
      eventId: `checkout:${bookingId}`,
      eventType: 'checkout.completed',
      eventVersion: 999,
      source: 'front-desk',
      occurredAt: new Date().toISOString(),
      data: {},
    });

    const message = await waitForMessage(TOPOLOGY.queues.deadLetter);

    expect(message.properties.messageId).toBe(`checkout:${bookingId}`);

    publisher.ack(message);

    expect(await taskCount()).toBe(0);
  });

  it('routes temporary database failures to the retry queue', async () => {
    await database.query(
      `UPDATE bookings
       SET status = 'CHECKED_IN'
       WHERE booking_id = $1`,
      [bookingId],
    );

    await publish(event());

    const message = await waitForMessage(TOPOLOGY.queues.retry);

    expect(message.properties.headers?.[CHECKOUT_RETRY_HEADER]).toBe(1);

    expect(message.properties.messageId).toBe(`checkout:${bookingId}`);

    publisher.ack(message);

    expect(await taskCount()).toBe(0);
  });

  it('dead-letters events that exhausted their retries', async () => {
    await database.query(
      `UPDATE bookings
       SET status = 'CHECKED_IN'
       WHERE booking_id = $1`,
      [bookingId],
    );

    await publish(event(), {
      [CHECKOUT_RETRY_HEADER]: TOPOLOGY.maxRetries,
    });

    const message = await waitForMessage(TOPOLOGY.queues.deadLetter);

    expect(message.properties.messageId).toBe(`checkout:${bookingId}`);

    publisher.ack(message);

    expect(await taskCount()).toBe(0);
  });

  it('reprocesses a delayed retry after checkout becomes confirmed', async () => {
    // Simulate temporary unavailability of confirmed checkout state.
    await database.query(
      `UPDATE bookings
       SET status = 'CHECKED_IN'
       WHERE booking_id = $1`,
      [bookingId],
    );

    await publish(event());

    // Wait until RabbitMQ contains the failed message.
    let retryQueued = false;
    const deadline = Date.now() + 8_000;

    while (Date.now() < deadline) {
      const queue = await publisher.checkQueue(TOPOLOGY.queues.retry);

      if (queue.messageCount > 0) {
        retryQueued = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(retryQueued).toBe(true);
    expect(await taskCount()).toBe(0);

    // The checkout state becomes available before the retry expires.
    await database.query(
      `UPDATE bookings
       SET status = 'CHECKED_OUT'
       WHERE booking_id = $1`,
      [bookingId],
    );

    // The retry queue has a 60-second TTL.
    await waitForProcessedCount(1, 75_000);

    expect(processedOutcomes).toEqual(['CREATED']);
    expect(await taskCount()).toBe(1);
  }, 90_000);

  it('reconnects and processes a checkout event queued during disconnection', async () => {
    // Access the connection only from this integration test.
    // No production API or service code is changed.
    const state = consumer as unknown as {
      connection: ChannelModel | null;
    };

    const originalConnection = state.connection;

    expect(originalConnection).not.toBeNull();

    // Simulate the consumer losing its RabbitMQ connection.
    await originalConnection!.close();

    // Wait for the connection-close event to clear its state.
    const deadline = Date.now() + 5_000;

    while (state.connection !== null && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(state.connection).toBeNull();

    // FDS publishes while WKMS is disconnected.
    await publish(event());

    // The durable queue should retain the checkout message.
    const queued = await publisher.checkQueue(TOPOLOGY.queues.main);

    expect(queued.messageCount).toBe(1);

    // Simulate the scheduled reconnect attempt.
    await consumer.reconnectIfNeeded();

    await waitForProcessedCount(1);

    expect(processedOutcomes).toEqual(['CREATED']);

    expect(await taskCount()).toBe(1);

    expect(state.connection).not.toBeNull();
  }, 15_000);
});
