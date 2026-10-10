import { jest } from '@jest/globals';
import type { ChannelModel, ConfirmChannel } from 'amqplib';

import { RabbitMqService } from './rabbitmq.service';

function createConnectedService() {
  const service = new RabbitMqService({
    enabled: true,
    url: 'amqp://guest:guest@127.0.0.1:5672',
    exchange: 'forever.events',
  });

  const publish = jest
    .fn<(...args: unknown[]) => boolean>()
    .mockReturnValue(true);

  const waitForConfirms = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  const close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

  type ReturnedMessage = {
    properties: {
      messageId?: string;
    };
  };

  const on =
    jest.fn<
      (event: string, handler: (message: ReturnedMessage) => void) => void
    >();

  const off =
    jest.fn<
      (event: string, handler: (message: ReturnedMessage) => void) => void
    >();

  const channelClose = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  const channel = {
    publish,
    waitForConfirms,
    on,
    off,
    close: channelClose,
  } as unknown as ConfirmChannel;

  const connection = {
    close,
  } as unknown as ChannelModel;

  Object.assign(service, {
    channel,
    connection,
  });

  return {
    service,
    publish,
    waitForConfirms,
    close,
    channelClose,
    on,
    off,
    channel,
    connection,
  };
}

describe('RabbitMqService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects publishing when RabbitMQ is disabled', async () => {
    const service = new RabbitMqService({
      enabled: false,
      url: null,
      exchange: 'forever.events',
    });

    expect(service.isEnabled()).toBe(false);

    await expect(service.publishJson('test.route', {})).rejects.toThrow(
      'RabbitMQ publishing is disabled',
    );
  });

  it('publishes persistent JSON and waits for confirmation', async () => {
    const context = createConnectedService();

    const payload = {
      eventId: 'escalation:test-101',
      eventType: 'task.escalated',
    };

    await context.service.publishJson(
      'wkms.task.escalated.v1',
      payload,
      payload.eventId,
    );

    expect(context.publish).toHaveBeenCalledWith(
      'forever.events',
      'wkms.task.escalated.v1',
      expect.any(Buffer),
      expect.objectContaining({
        mandatory: true,
        persistent: true,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        messageId: payload.eventId,
      }),
    );

    expect(context.waitForConfirms).toHaveBeenCalledTimes(1);
    expect(context.close).not.toHaveBeenCalled();
  });

  it('rejects when RabbitMQ does not confirm publication', async () => {
    const context = createConnectedService();

    context.waitForConfirms.mockRejectedValueOnce(
      new Error('Broker rejected publication'),
    );

    await expect(context.service.publishJson('test.route', {})).rejects.toThrow(
      'Broker rejected publication',
    );

    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('times out after 15 seconds without confirmation', async () => {
    jest.useFakeTimers();

    const context = createConnectedService();

    context.waitForConfirms.mockImplementation(
      () => new Promise<void>(() => {}),
    );

    const assertion = expect(
      context.service.publishJson('test.route', {}),
    ).rejects.toThrow('RabbitMQ publisher confirmation timed out');

    await jest.advanceTimersByTimeAsync(15_000);

    await assertion;

    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('discards the connection when publishing throws', async () => {
    const context = createConnectedService();

    context.publish.mockImplementationOnce(() => {
      throw new Error('Publisher channel closed');
    });

    await expect(context.service.publishJson('test.route', {})).rejects.toThrow(
      'Publisher channel closed',
    );

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.waitForConfirms).not.toHaveBeenCalled();
  });

  it('continues startup when RabbitMQ is unavailable', async () => {
    const service = new RabbitMqService({
      enabled: true,
      url: 'amqp://guest:guest@127.0.0.1:5672',
      exchange: 'forever.events',
    });

    const ensureConnected = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('Simulated connection failure'));

    Object.assign(service, { ensureConnected });

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(ensureConnected).toHaveBeenCalledTimes(1);
  });

  it('attempts connection during startup when enabled', async () => {
    const service = new RabbitMqService({
      enabled: true,
      url: 'amqp://guest:guest@127.0.0.1:5672',
      exchange: 'forever.events',
    });

    const ensureConnected = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);

    Object.assign(service, { ensureConnected });

    await service.onModuleInit();

    expect(ensureConnected).toHaveBeenCalledTimes(1);
  });

  it('rejects an unroutable message even when RabbitMQ confirms it', async () => {
    const context = createConnectedService();
    const eventId = 'escalation:test-unroutable';

    context.waitForConfirms.mockImplementationOnce(async () => {
      const listener = context.on.mock.calls.find(
        ([event]) => event === 'return',
      )?.[1];

      expect(listener).toBeDefined();

      listener?.({
        properties: {
          messageId: eventId,
        },
      });
    });

    await expect(
      context.service.publishJson(
        'wkms.task.escalated.v1',
        { eventId },
        eventId,
      ),
    ).rejects.toThrow('RabbitMQ message was returned as unroutable');

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.off).toHaveBeenCalledWith('return', expect.any(Function));
  });

  it('ignores returned messages belonging to a different publication', async () => {
    const context = createConnectedService();
    const eventId = 'escalation:test-correct-event';

    context.waitForConfirms.mockImplementationOnce(async () => {
      const listener = context.on.mock.calls.find(
        ([event]) => event === 'return',
      )?.[1];

      expect(listener).toBeDefined();

      listener?.({
        properties: {
          messageId: 'escalation:another-event',
        },
      });
    });

    await expect(
      context.service.publishJson(
        'wkms.task.escalated.v1',
        { eventId },
        eventId,
      ),
    ).resolves.toBeUndefined();

    expect(context.close).not.toHaveBeenCalled();
    expect(context.off).toHaveBeenCalledTimes(1);
  });

  it('rejects publishing when the RabbitMQ URL is missing', async () => {
    const service = new RabbitMqService({
      enabled: true,
      url: null,
      exchange: 'forever.events',
    });

    await expect(
      service.publishJson('wkms.task.escalated.v1', {}),
    ).rejects.toThrow('RabbitMQ connection URL is missing');
  });

  it('closes the publisher channel and connection on shutdown', async () => {
    const context = createConnectedService();

    await context.service.onApplicationShutdown();

    expect(context.channelClose).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing RabbitMQ connection', async () => {
    const context = createConnectedService();

    const connectAndInitialize = jest.fn<() => Promise<void>>();

    Object.assign(context.service, {
      connectAndInitialize,
    });

    await context.service.publishJson('test.route', { id: 1 });
    await context.service.publishJson('test.route', { id: 2 });

    expect(connectAndInitialize).not.toHaveBeenCalled();
    expect(context.publish).toHaveBeenCalledTimes(2);
  });

  it('shares one connection attempt between concurrent publications', async () => {
    const context = createConnectedService();

    let finishConnection!: () => void;

    const connectionGate = new Promise<void>((resolve) => {
      finishConnection = resolve;
    });

    const connectAndInitialize = jest
      .fn<() => Promise<void>>()
      .mockImplementation(async () => {
        await connectionGate;

        Object.assign(context.service, {
          channel: context.channel,
          connection: context.connection,
        });
      });

    Object.assign(context.service, {
      channel: null,
      connection: null,
      connectAndInitialize,
    });

    const first = context.service.publishJson('test.route', {
      id: 1,
    });

    const second = context.service.publishJson('test.route', {
      id: 2,
    });

    expect(connectAndInitialize).toHaveBeenCalledTimes(1);

    finishConnection();

    await Promise.all([first, second]);

    expect(context.publish).toHaveBeenCalledTimes(2);
  });

  it('rejects publication when the channel is unavailable', async () => {
    const service = new RabbitMqService({
      enabled: true,
      url: 'amqp://guest:guest@127.0.0.1:5672',
      exchange: 'forever.events',
    });

    const ensureConnected = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);

    Object.assign(service, { ensureConnected });

    await expect(service.publishJson('test.route', {})).rejects.toThrow(
      'RabbitMQ publisher channel unavailable',
    );
  });

  it('handles shutdown failures without crashing the application', async () => {
    const context = createConnectedService();

    context.channelClose.mockRejectedValueOnce(
      new Error('Channel shutdown failed'),
    );

    context.close.mockRejectedValueOnce(
      new Error('Connection shutdown failed'),
    );

    await expect(
      context.service.onApplicationShutdown(),
    ).resolves.toBeUndefined();

    expect(context.channelClose).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);

    // Repeated shutdown should not attempt to close resources again.
    await context.service.onApplicationShutdown();

    expect(context.channelClose).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
