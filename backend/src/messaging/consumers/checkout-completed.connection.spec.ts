import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import type {
  Channel,
  ChannelModel,
  ConfirmChannel,
  ConsumeMessage,
} from 'amqplib';

import type { CheckoutCompletedHandler } from '../handlers/checkout-completed.handler';

const mockConnect = jest.fn<(...args: unknown[]) => Promise<ChannelModel>>();

jest.unstable_mockModule('amqplib', () => ({
  connect: mockConnect,
}));

let CheckoutCompletedConsumer: typeof import('./checkout-completed.consumer').CheckoutCompletedConsumer;

function createMockBroker() {
  const connectionEvents = new EventEmitter();
  const consumerEvents = new EventEmitter();
  const publisherEvents = new EventEmitter();

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
    .mockResolvedValue({ consumerTag: 'ddp78-consumer' });

  const consumerClose = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  const publisherClose = jest
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

  const retryChannel = Object.assign(publisherEvents, {
    close: publisherClose,
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
    publisherEvents,
    assertExchange,
    assertQueue,
    bindQueue,
    prefetch,
    consume,
    createChannel,
    createConfirmChannel,
    consumerClose,
    publisherClose,
    connectionClose,
  };
}

describe('CheckoutCompletedConsumer connection lifecycle', () => {
  beforeAll(async () => {
    const module = await import('./checkout-completed.consumer');
    CheckoutCompletedConsumer = module.CheckoutCompletedConsumer;
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
    } as unknown as CheckoutCompletedHandler;

    return new CheckoutCompletedConsumer(
      {
        enabled,
        url,
        exchange: 'forever.events',
      },
      handler,
    );
  }

  it('connects, declares topology and subscribes', async () => {
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

    expect(broker.prefetch).toHaveBeenCalledWith(1);

    expect(broker.consume).toHaveBeenCalledWith(
      'wkms.checkout-completed.v1',
      expect.any(Function),
      { noAck: false },
    );

    await consumer.onApplicationShutdown();

    expect(broker.consumerClose).toHaveBeenCalledTimes(1);
    expect(broker.publisherClose).toHaveBeenCalledTimes(1);
    expect(broker.connectionClose).toHaveBeenCalledTimes(1);
  });

  it('does not connect when messaging is disabled', async () => {
    const consumer = createConsumer(false, null);

    await consumer.onModuleInit();
    await consumer.reconnectIfNeeded();

    expect(mockConnect).not.toHaveBeenCalled();

    await consumer.onApplicationShutdown();
  });

  it('allows startup without RabbitMQ and reconnects later', async () => {
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

  it('does not establish duplicate connections', async () => {
    const broker = createMockBroker();
    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();
    await consumer.reconnectIfNeeded();
    await consumer.onModuleInit();

    expect(mockConnect).toHaveBeenCalledTimes(1);

    await consumer.onApplicationShutdown();
  });

  it('reconnects after the broker closes its connection', async () => {
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

  it('closes the connection when the consumer channel closes', async () => {
    const broker = createMockBroker();
    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();

    broker.consumerEvents.emit('close');

    await Promise.resolve();

    expect(broker.connectionClose).toHaveBeenCalledTimes(1);

    await consumer.onApplicationShutdown();
  });

  it('recovers when queue declaration fails during initialization', async () => {
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

  it('handles failures while closing RabbitMQ resources', async () => {
    const broker = createMockBroker();
    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();

    broker.consumerClose.mockRejectedValueOnce(
      new Error('Consumer close failed'),
    );

    broker.publisherClose.mockRejectedValueOnce(
      new Error('Publisher close failed'),
    );

    broker.connectionClose.mockRejectedValueOnce(
      new Error('Connection close failed'),
    );

    await expect(consumer.onApplicationShutdown()).resolves.toBeUndefined();
  });

  it('rejects connection setup when the URL is missing', async () => {
    const consumer = createConsumer(true, null);

    await expect(consumer.onModuleInit()).resolves.toBeUndefined();

    expect(mockConnect).not.toHaveBeenCalled();

    await consumer.onApplicationShutdown();
  });

  it('does not subscribe if shutdown begins during connection setup', async () => {
    const broker = createMockBroker();

    let signalPrefetchEntered!: () => void;
    let releasePrefetch!: () => void;

    const prefetchEntered = new Promise<void>((resolve) => {
      signalPrefetchEntered = resolve;
    });

    const prefetchGate = new Promise<void>((resolve) => {
      releasePrefetch = resolve;
    });

    broker.prefetch.mockImplementationOnce(async () => {
      signalPrefetchEntered();
      await prefetchGate;
    });

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    // Begin connection initialization.
    const startup = consumer.onModuleInit();

    // Wait until setup reaches the prefetch stage.
    await prefetchEntered;

    // Begin shutdown before the subscription is created.
    const shutdown = consumer.onApplicationShutdown();

    // Allow the pending setup to finish.
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

    // Simulate RabbitMQ connection and channel errors.
    broker.connection.emit('error', new Error('Simulated connection error'));

    broker.consumerEvents.emit(
      'error',
      new Error('Simulated consumer channel error'),
    );

    broker.publisherEvents.emit(
      'error',
      new Error('Simulated retry publisher channel error'),
    );

    // Error notifications should not create duplicate subscriptions.
    expect(broker.consume).toHaveBeenCalledTimes(1);

    await consumer.onApplicationShutdown();
  });

  it('ignores null deliveries and handles interrupted checkout messages', async () => {
    const broker = createMockBroker();

    mockConnect.mockResolvedValueOnce(broker.connection);

    const consumer = createConsumer();

    await consumer.onModuleInit();

    const processMessageSpy = jest
      .spyOn(consumer, 'processMessage')
      .mockRejectedValueOnce(
        new Error('Simulated interrupted checkout processing'),
      );

    // Retrieve the callback registered with RabbitMQ.
    const onMessage = broker.consume.mock.calls[0]?.[1] as
      ((message: ConsumeMessage | null) => void) | undefined;

    if (!onMessage) {
      throw new Error('Checkout consumer callback was not registered');
    }

    // RabbitMQ sends null when a consumer is cancelled.
    onMessage(null);

    expect(processMessageSpy).not.toHaveBeenCalled();

    // Simulate a message whose processing is interrupted.
    const message = {
      content: Buffer.from('{}'),
      properties: {
        headers: {},
      },
    } as ConsumeMessage;

    onMessage(message);

    expect(processMessageSpy).toHaveBeenCalledTimes(1);

    expect(processMessageSpy).toHaveBeenCalledWith(
      message,
      expect.anything(),
      expect.anything(),
      broker.connection,
    );

    // Allow the asynchronous rejection handler to execute.
    await Promise.resolve();
    await Promise.resolve();

    processMessageSpy.mockRestore();

    await consumer.onApplicationShutdown();
  });

  it('preserves the original checkout event when a retry is returned as unroutable', async () => {
    const handler = {
      handle: jest
        .fn<(payload: unknown) => Promise<unknown>>()
        .mockRejectedValue(new Error('Temporary database failure')),
    } as unknown as CheckoutCompletedHandler;

    const consumer = new CheckoutCompletedConsumer(
      {
        enabled: true,
        url: 'amqp://127.0.0.1:5672',
        exchange: 'forever.events',
      },
      handler,
    );

    const message = {
      content: Buffer.from(JSON.stringify({ test: true })),
      properties: {
        messageId: 'checkout-return-test',
        headers: {},
      },
    } as ConsumeMessage;

    const ack = jest.fn();
    const nack = jest.fn();

    const consumerChannel = {
      ack,
      nack,
    } as unknown as Channel;

    const retryEvents = new EventEmitter();

    const publish = jest
      .fn<(...args: unknown[]) => boolean>()
      .mockImplementation((...args) => {
        const properties = args[3] as {
          messageId: string;
        };

        // RabbitMQ returns this message because it cannot be routed.
        retryEvents.emit('return', {
          properties: {
            messageId: properties.messageId,
          },
        });

        return true;
      });

    const retryChannel = Object.assign(retryEvents, {
      publish,
      waitForConfirms: jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined),
    }) as unknown as ConfirmChannel;

    const close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const connection = {
      close,
    } as unknown as ChannelModel;

    await consumer.processMessage(
      message,
      consumerChannel,
      retryChannel,
      connection,
    );

    // WKMS attempted to publish a retry.
    expect(publish).toHaveBeenCalledTimes(1);

    // The original event must not be acknowledged or discarded.
    expect(ack).not.toHaveBeenCalled();
    expect(nack).not.toHaveBeenCalled();

    // Closing the connection allows RabbitMQ to redeliver it.
    expect(close).toHaveBeenCalledTimes(1);

    // The temporary return-event listener must be removed.
    expect(retryEvents.listenerCount('return')).toBe(0);
  });
});
