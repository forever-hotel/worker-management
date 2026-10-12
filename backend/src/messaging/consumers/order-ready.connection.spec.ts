import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import type {
  Channel,
  ChannelModel,
  ConfirmChannel,
  ConsumeMessage,
} from 'amqplib';

import type { OrderReadyHandler } from '../handlers/order-ready.handler';
import { ORDER_READY_CONSUMER_TOPOLOGY as TOPOLOGY } from './order-ready.consumer.topology';

const mockConnect = jest.fn<(...args: unknown[]) => Promise<ChannelModel>>();

jest.unstable_mockModule('amqplib', () => ({
  connect: mockConnect,
}));

let OrderReadyConsumer: typeof import('./order-ready.consumer').OrderReadyConsumer;

function createMockBroker() {
  const connectionEvents = new EventEmitter();
  const consumerEvents = new EventEmitter();
  const retryEvents = new EventEmitter();

  const assertExchange = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined);

  const assertQueue = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ queue: 'test-queue' });

  const bindQueue = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined);

  const prefetch = jest
    .fn<(count: number) => Promise<void>>()
    .mockResolvedValue(undefined);

  const consume = jest
    .fn<(...args: unknown[]) => Promise<{ consumerTag: string }>>()
    .mockResolvedValue({ consumerTag: 'kms-test-consumer' });

  const consumerClose = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  const retryClose = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  const connectionClose = jest
    .fn<() => Promise<void>>()
    .mockImplementation(async () => {
      connectionEvents.emit('close');
    });

  const consumerChannel = Object.assign(consumerEvents, {
    assertExchange,
    assertQueue,
    bindQueue,
    prefetch,
    consume,
    close: consumerClose,
  }) as unknown as Channel;

  const retryChannel = Object.assign(retryEvents, {
    close: retryClose,
  }) as unknown as ConfirmChannel;

  const createChannel = jest
    .fn<() => Promise<Channel>>()
    .mockResolvedValue(consumerChannel);

  const createConfirmChannel = jest
    .fn<() => Promise<ConfirmChannel>>()
    .mockResolvedValue(retryChannel);

  const connection = Object.assign(connectionEvents, {
    createChannel,
    createConfirmChannel,
    close: connectionClose,
  }) as unknown as ChannelModel;

  return {
    connection,
    consumerEvents,
    retryEvents,
    assertExchange,
    assertQueue,
    bindQueue,
    prefetch,
    consume,
    createChannel,
    createConfirmChannel,
    consumerClose,
    retryClose,
    connectionClose,
  };
}

describe('OrderReadyConsumer connection lifecycle', () => {
  beforeAll(async () => {
    const module = await import('./order-ready.consumer');
    OrderReadyConsumer = module.OrderReadyConsumer;
  });

  beforeEach(() => {
    mockConnect.mockReset();
  });

  function createConsumer(
    enabled = true,
    url: string | null = 'amqp://127.0.0.1:5672',
  ) {
    const handler = {
      handle: jest.fn(),
    } as unknown as OrderReadyHandler;

    return new OrderReadyConsumer(
      {
        enabled,
        url,
        exchange: 'forever.events',
      },
      handler,
    );
  }

  it('connects and declares durable KMS queues', async () => {
    const broker = createMockBroker();

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();

    expect(mockConnect).toHaveBeenCalledWith('amqp://127.0.0.1:5672', {
      timeout: 10_000,
    });

    expect(broker.createChannel).toHaveBeenCalledTimes(1);
    expect(broker.createConfirmChannel).toHaveBeenCalledTimes(1);

    expect(broker.assertExchange).toHaveBeenCalledWith(
      'forever.events',
      'topic',
      { durable: true },
    );

    expect(broker.assertQueue).toHaveBeenCalledWith(
      TOPOLOGY.queues.main,
      expect.objectContaining({
        durable: true,
        arguments: expect.objectContaining({
          'x-dead-letter-routing-key': TOPOLOGY.routingKeys.deadLetter,
        }),
      }),
    );

    expect(broker.assertQueue).toHaveBeenCalledWith(
      TOPOLOGY.queues.retry,
      expect.objectContaining({
        durable: true,
        arguments: expect.objectContaining({
          'x-message-ttl': 60_000,
        }),
      }),
    );

    expect(broker.prefetch).toHaveBeenCalledWith(1);

    expect(broker.consume).toHaveBeenCalledWith(
      TOPOLOGY.queues.main,
      expect.any(Function),
      { noAck: false },
    );

    await consumer.onApplicationShutdown();

    expect(broker.consumerClose).toHaveBeenCalledTimes(1);
    expect(broker.retryClose).toHaveBeenCalledTimes(1);
    expect(broker.connectionClose).toHaveBeenCalledTimes(1);
  });

  it('does not connect when RabbitMQ is disabled', async () => {
    const consumer = createConsumer(false, null);

    await consumer.onModuleInit();
    await consumer.reconnectIfNeeded();

    expect(mockConnect).not.toHaveBeenCalled();

    await consumer.onApplicationShutdown();
  });

  it('recovers when RabbitMQ is unavailable at startup', async () => {
    const broker = createMockBroker();

    mockConnect
      .mockRejectedValueOnce(new Error('Broker unavailable'))
      .mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await expect(consumer.onModuleInit()).resolves.toBeUndefined();

    await consumer.reconnectIfNeeded();

    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(broker.consume).toHaveBeenCalledTimes(1);

    await consumer.onApplicationShutdown();
  });

  it('avoids creating duplicate connections', async () => {
    const broker = createMockBroker();

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();
    await consumer.reconnectIfNeeded();
    await consumer.onModuleInit();

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(broker.consume).toHaveBeenCalledTimes(1);

    await consumer.onApplicationShutdown();
  });

  it('reconnects after a RabbitMQ connection closes', async () => {
    const first = createMockBroker();
    const second = createMockBroker();

    mockConnect
      .mockResolvedValueOnce(first.connection)
      .mockResolvedValueOnce(second.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();

    first.connection.emit('close');

    await consumer.reconnectIfNeeded();

    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(second.consume).toHaveBeenCalledTimes(1);

    await consumer.onApplicationShutdown();
  });

  it('closes its connection when the consumer channel closes', async () => {
    const broker = createMockBroker();

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();

    broker.consumerEvents.emit('close');

    await Promise.resolve();

    expect(broker.connectionClose).toHaveBeenCalledTimes(1);

    await consumer.onApplicationShutdown();
  });

  it('recovers when queue declaration initially fails', async () => {
    const failed = createMockBroker();
    const healthy = createMockBroker();

    failed.assertQueue.mockRejectedValueOnce(
      new Error('Queue declaration failed'),
    );

    mockConnect
      .mockResolvedValueOnce(failed.connection)
      .mockResolvedValueOnce(healthy.connection);

    const consumer = createConsumer();

    await expect(consumer.onModuleInit()).resolves.toBeUndefined();

    expect(failed.connectionClose).toHaveBeenCalledTimes(1);

    await consumer.reconnectIfNeeded();

    expect(healthy.consume).toHaveBeenCalledTimes(1);

    await consumer.onApplicationShutdown();
  });

  it('does not reconnect after application shutdown', async () => {
    const broker = createMockBroker();

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();
    await consumer.onApplicationShutdown();

    await consumer.reconnectIfNeeded();

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('handles errors while closing RabbitMQ resources', async () => {
    const broker = createMockBroker();

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();

    broker.consumerClose.mockRejectedValueOnce(
      new Error('Consumer close failed'),
    );

    broker.retryClose.mockRejectedValueOnce(
      new Error('Retry channel close failed'),
    );

    broker.connectionClose.mockRejectedValueOnce(
      new Error('Connection close failed'),
    );

    await expect(consumer.onApplicationShutdown()).resolves.toBeUndefined();
  });

  it('handles a missing RabbitMQ URL without crashing startup', async () => {
    const consumer = createConsumer(true, null);

    await expect(consumer.onModuleInit()).resolves.toBeUndefined();

    expect(mockConnect).not.toHaveBeenCalled();

    await consumer.onApplicationShutdown();
  });

  it('does not subscribe if shutdown begins during connection setup', async () => {
    const broker = createMockBroker();

    let signalPrefetch!: () => void;
    let releasePrefetch!: () => void;

    const prefetchEntered = new Promise<void>((resolve) => {
      signalPrefetch = resolve;
    });

    const prefetchGate = new Promise<void>((resolve) => {
      releasePrefetch = resolve;
    });

    broker.prefetch.mockImplementationOnce(async () => {
      signalPrefetch();
      await prefetchGate;
    });

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    const startup = consumer.onModuleInit();

    await prefetchEntered;

    const shutdown = consumer.onApplicationShutdown();

    releasePrefetch();

    await Promise.all([startup, shutdown]);

    expect(broker.consume).not.toHaveBeenCalled();
    expect(broker.connectionClose).toHaveBeenCalledTimes(1);
  });

  it('handles RabbitMQ connection and channel error events safely', async () => {
    const broker = createMockBroker();

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();

    // Exercise the connection and channel error callbacks.
    broker.connection.emit('error', new Error('Simulated connection error'));

    broker.consumerEvents.emit(
      'error',
      new Error('Simulated consumer channel error'),
    );

    broker.retryEvents.emit(
      'error',
      new Error('Simulated retry channel error'),
    );

    // Error notifications alone should not create a second subscription.
    expect(broker.consume).toHaveBeenCalledTimes(1);

    await consumer.onApplicationShutdown();
  });

  it('ignores null deliveries and handles interrupted message processing', async () => {
    const broker = createMockBroker();

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();

    const processMessageSpy = jest
      .spyOn(consumer, 'processMessage')
      .mockRejectedValueOnce(
        new Error('Simulated interrupted message processing'),
      );

    const onMessage = broker.consume.mock.calls[0]?.[1] as
      ((message: ConsumeMessage | null) => void) | undefined;

    if (!onMessage) {
      throw new Error('RabbitMQ consumer callback was not registered');
    }

    // RabbitMQ can send null when cancelling a consumer.
    onMessage(null);

    expect(processMessageSpy).not.toHaveBeenCalled();

    const message = {
      content: Buffer.from('{}'),
      properties: { headers: {} },
    } as ConsumeMessage;

    // Simulate a delivery whose processing promise rejects.
    onMessage(message);

    expect(processMessageSpy).toHaveBeenCalledTimes(1);

    expect(processMessageSpy).toHaveBeenCalledWith(
      message,
      expect.anything(),
      expect.anything(),
      broker.connection,
    );

    // Allow the consumer's rejection handler to execute.
    await Promise.resolve();
    await Promise.resolve();

    processMessageSpy.mockRestore();

    await consumer.onApplicationShutdown();
  });
});
