import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import type { ChannelModel, ConfirmChannel, GetMessage } from 'amqplib';

import { DatabaseService } from '../../src/database/database.service';
import { FoodDeliveryTaskRepository } from '../../src/database/repositories/food-delivery-task.repository';
import { OrderReadyConsumer } from '../../src/messaging/consumers/order-ready.consumer';
import {
  ORDER_READY_CONSUMER_TOPOLOGY as TOPOLOGY,
  ORDER_READY_RETRY_HEADER,
} from '../../src/messaging/consumers/order-ready.consumer.topology';
import { OrderReadyHandler } from '../../src/messaging/handlers/order-ready.handler';

const localDescribe =
  process.env.RUN_WKMS_DDP78_KMS_RABBIT_INTEGRATION === '1'
    ? describe
    : describe.skip;

localDescribe('DDP-78 real KMS RabbitMQ integration', () => {
  let database: DatabaseService;
  let consumer: OrderReadyConsumer;
  let publisherConnection: ChannelModel;
  let publisher: ConfirmChannel;

  let bookingId: string;
  let foodOrderId: string;
  let roomNumber: string;

  const processedOutcomes: string[] = [];

  function safeUrl(
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
        url.pathname !== '/wkms_ddp78_test' ||
        url.username !== 'wkms_test'
      ) {
        throw new Error('Unsafe PostgreSQL test target');
      }
    } else if (
      url.protocol !== 'amqp:' ||
      url.hostname !== '127.0.0.1' ||
      url.port !== '5672' ||
      url.pathname !== '/wkms_ddp78_test'
    ) {
      throw new Error('Unsafe RabbitMQ test target');
    }

    return value;
  }

  function event() {
    return {
      eventId: `order-ready:${foodOrderId}`,
      eventType: 'order.ready',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'kitchen-management',
      data: {
        foodOrderId,
        roomNumber,
      },
    };
  }

  async function publish(
    payload: unknown,
    headers: Record<string, unknown> = {},
  ): Promise<void> {
    publisher.publish(
      'forever.events',
      TOPOLOGY.routingKeys.orderReady,
      Buffer.from(JSON.stringify(payload), 'utf8'),
      {
        persistent: true,
        mandatory: true,
        contentType: 'application/json',
        messageId: `order-ready:${foodOrderId}`,
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

    throw new Error('Timed out waiting for KMS event processing');
  }

  async function findTasks() {
    const result = await database.query<{
      task_id: string;
      category: string;
      priority: string;
      status: string;
      source: string;
      room_number: string;
      food_order_id: string;
    }>(
      `SELECT
         task_id,
         category,
         priority,
         status,
         source,
         room_number,
         food_order_id
       FROM wkms_tasks
       WHERE food_order_id = $1::uuid`,
      [foodOrderId],
    );

    return result.rows;
  }

  beforeAll(async () => {
    const databaseUrl = safeUrl(
      process.env.WKMS_DDP78_TEST_DATABASE_URL,
      'database',
    );

    const rabbitUrl = safeUrl(
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

    const repository = new FoodDeliveryTaskRepository(database);
    const handler = new OrderReadyHandler(
      repository,
      {
        emitTaskCreated: () => undefined,
      } as unknown as ConstructorParameters<typeof OrderReadyHandler>[1],
    );

    const originalHandle = handler.handle.bind(handler);

    // Track successfully handled events.
    handler.handle = async (payload: unknown) => {
      const result = await originalHandle(payload);
      processedOutcomes.push(result.status);
      return result;
    };

    consumer = new OrderReadyConsumer(
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
    foodOrderId = randomUUID();

    roomNumber =
      'K78' + randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

    await database.query(
      `INSERT INTO rooms (room_number, status)
       VALUES ($1, 'OCCUPIED')`,
      [roomNumber],
    );

    await database.query(
      `INSERT INTO bookings (booking_id, room_number, status)
       VALUES ($1, $2, 'CHECKED_IN')`,
      [bookingId, roomNumber],
    );

    await database.query(
      `INSERT INTO kms_food_orders (
         order_id,
         booking_id,
         room_number,
         meal_period,
         status,
         total_amount
       )
       VALUES ($1, $2, $3, 'LUNCH', 'READY', 2500)`,
      [foodOrderId, bookingId, roomNumber],
    );
  });

  afterEach(async () => {
    await database.query(
      `DELETE FROM wkms_tasks
       WHERE food_order_id = $1::uuid`,
      [foodOrderId],
    );

    await database.query(
      `DELETE FROM kms_food_orders
       WHERE order_id = $1::uuid`,
      [foodOrderId],
    );

    await database.query(
      `DELETE FROM bookings
       WHERE booking_id = $1::uuid`,
      [bookingId],
    );

    await database.query(
      `DELETE FROM rooms
       WHERE room_number = $1`,
      [roomNumber],
    );

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

  it('creates a food-delivery task from a real KMS event', async () => {
    await publish(event());

    await waitForProcessedCount(1);

    expect(processedOutcomes).toEqual(['CREATED']);

    const tasks = await findTasks();

    expect(tasks).toHaveLength(1);

    expect(tasks[0]).toMatchObject({
      category: 'FOOD_DELIVERY',
      priority: 'NORMAL',
      status: 'UNASSIGNED',
      source: 'KMS',
      room_number: roomNumber,
      food_order_id: foodOrderId,
    });
  });

  it('does not create duplicate tasks', async () => {
    const payload = event();

    await publish(payload);
    await waitForProcessedCount(1);

    await publish(payload);
    await waitForProcessedCount(2);

    expect(processedOutcomes).toEqual(['CREATED', 'EXISTS']);
    expect(await findTasks()).toHaveLength(1);
  });

  it('routes malformed events to the dead-letter queue', async () => {
    await publish({
      ...event(),
      eventVersion: 999,
    });

    const message = await waitForMessage(TOPOLOGY.queues.deadLetter);

    expect(message.properties.messageId).toBe(`order-ready:${foodOrderId}`);

    publisher.ack(message);

    expect(await findTasks()).toHaveLength(0);
  });

  it('routes non-READY orders to the retry queue', async () => {
    await database.query(
      `UPDATE kms_food_orders
       SET status = 'IN_PREPARATION'
       WHERE order_id = $1::uuid`,
      [foodOrderId],
    );

    await publish(event());

    const message = await waitForMessage(TOPOLOGY.queues.retry);

    expect(message.properties.headers?.[ORDER_READY_RETRY_HEADER]).toBe(1);

    publisher.ack(message);

    expect(await findTasks()).toHaveLength(0);
  });

  it('dead-letters events after retry exhaustion', async () => {
    await database.query(
      `UPDATE kms_food_orders
       SET status = 'IN_PREPARATION'
       WHERE order_id = $1::uuid`,
      [foodOrderId],
    );

    await publish(event(), {
      [ORDER_READY_RETRY_HEADER]: TOPOLOGY.maxRetries,
    });

    const message = await waitForMessage(TOPOLOGY.queues.deadLetter);

    expect(message.properties.messageId).toBe(`order-ready:${foodOrderId}`);

    publisher.ack(message);

    expect(await findTasks()).toHaveLength(0);
  });

  it('reprocesses a delayed KMS event when the order becomes READY', async () => {
    // Initially, the kitchen has not finished preparing the order.
    await database.query(
      `UPDATE kms_food_orders
       SET status = 'IN_PREPARATION'
       WHERE order_id = $1::uuid`,
      [foodOrderId],
    );

    await publish(event());

    // Wait until the initial failure reaches the retry queue.
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
    expect(await findTasks()).toHaveLength(0);

    // KMS finishes preparing the food order.
    await database.query(
      `UPDATE kms_food_orders
       SET status = 'READY'
       WHERE order_id = $1::uuid`,
      [foodOrderId],
    );

    // The retry queue has a real 60-second expiry.
    await waitForProcessedCount(1, 75_000);

    expect(processedOutcomes).toEqual(['CREATED']);

    const tasks = await findTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      category: 'FOOD_DELIVERY',
      source: 'KMS',
      status: 'UNASSIGNED',
      room_number: roomNumber,
      food_order_id: foodOrderId,
    });
  }, 90_000);

  it('processes a queued KMS event after RabbitMQ consumer reconnects', async () => {
    // Access the connection only for this integration test.
    // The production consumer implementation remains unchanged.
    const activeConnection = (
      consumer as unknown as {
        connection: ChannelModel | null;
      }
    ).connection;

    if (!activeConnection) {
      throw new Error('KMS consumer was not connected');
    }

    // Simulate losing the WKMS consumer connection.
    // RabbitMQ itself and the independent publisher stay running.
    await activeConnection.close();

    // KMS publishes an event while WKMS is disconnected.
    await publish(event());

    // No task should exist because WKMS has not reconnected.
    expect(await findTasks()).toHaveLength(0);

    // The durable queue must preserve the event.
    const queued = await publisher.checkQueue(TOPOLOGY.queues.main);

    expect(queued.messageCount).toBe(1);

    // Simulate the reconnect scheduler's next execution.
    await consumer.reconnectIfNeeded();

    // The pending event should be consumed automatically.
    await waitForProcessedCount(1);

    expect(processedOutcomes).toEqual(['CREATED']);

    const tasks = await findTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      category: 'FOOD_DELIVERY',
      priority: 'NORMAL',
      status: 'UNASSIGNED',
      source: 'KMS',
      room_number: roomNumber,
      food_order_id: foodOrderId,
    });
  }, 20_000);
});
