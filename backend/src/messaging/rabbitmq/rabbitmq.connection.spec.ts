import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import type { ChannelModel, ConfirmChannel } from 'amqplib';

const mockConnect = jest.fn<(...args: unknown[]) => Promise<ChannelModel>>();

jest.unstable_mockModule('amqplib', () => ({
  connect: mockConnect,
}));

const { RabbitMqService } = await import('./rabbitmq.service');

function createMockBroker() {
  const channelEvents = new EventEmitter();
  const connectionEvents = new EventEmitter();

  const assertExchange = jest
    .fn<(...args: unknown[]) => Promise<void>>()
    .mockResolvedValue(undefined);

  const publish = jest
    .fn<(...args: unknown[]) => boolean>()
    .mockReturnValue(true);

  const waitForConfirms = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  const channelClose = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  const channel = Object.assign(channelEvents, {
    assertExchange,
    publish,
    waitForConfirms,
    close: channelClose,
  }) as unknown as ConfirmChannel;

  const createConfirmChannel = jest
    .fn<() => Promise<ConfirmChannel>>()
    .mockResolvedValue(channel);

  const connectionClose = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  const connection = Object.assign(connectionEvents, {
    createConfirmChannel,
    close: connectionClose,
  }) as unknown as ChannelModel;

  return {
    connection,
    assertExchange,
    createConfirmChannel,
    connectionClose,
    publish,
  };
}

describe('RabbitMqService connection initialization', () => {
  beforeEach(() => {
    mockConnect.mockReset();
  });

  function createService() {
    return new RabbitMqService({
      enabled: true,
      url: 'amqp://127.0.0.1:5672',
      exchange: 'forever.events',
    });
  }

  it('establishes a confirm channel and durable topic exchange', async () => {
    const broker = createMockBroker();

    mockConnect.mockResolvedValueOnce(broker.connection);

    const service = createService();

    await service.onModuleInit();

    expect(mockConnect).toHaveBeenCalledWith('amqp://127.0.0.1:5672', {
      timeout: 10_000,
    });

    expect(broker.createConfirmChannel).toHaveBeenCalledTimes(1);

    expect(broker.assertExchange).toHaveBeenCalledWith(
      'forever.events',
      'topic',
      { durable: true },
    );

    await service.publishJson(
      'wkms.task.escalated.v1',
      { eventId: 'test-connection' },
      'test-connection',
    );

    expect(broker.publish).toHaveBeenCalledTimes(1);

    await service.onApplicationShutdown();

    expect(broker.connectionClose).toHaveBeenCalledTimes(1);
  });

  it('closes a failed connection and recovers on the next publish', async () => {
    const failedBroker = createMockBroker();
    const healthyBroker = createMockBroker();

    failedBroker.assertExchange.mockRejectedValueOnce(
      new Error('Exchange setup failed'),
    );

    mockConnect
      .mockResolvedValueOnce(failedBroker.connection)
      .mockResolvedValueOnce(healthyBroker.connection);

    const service = createService();

    // Startup must remain available so outbox retries can recover.
    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(failedBroker.connectionClose).toHaveBeenCalledTimes(1);

    // Publishing retries the connection initialization.
    await expect(
      service.publishJson(
        'wkms.task.escalated.v1',
        { eventId: 'test-recovery' },
        'test-recovery',
      ),
    ).resolves.toBeUndefined();

    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(healthyBroker.assertExchange).toHaveBeenCalledTimes(1);
    expect(healthyBroker.publish).toHaveBeenCalledTimes(1);

    await service.onApplicationShutdown();
  });

  it('does not connect when RabbitMQ messaging is disabled', async () => {
    const service = new RabbitMqService({
      enabled: false,
      url: null,
      exchange: 'forever.events',
    });

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(mockConnect).not.toHaveBeenCalled();
  });
});
