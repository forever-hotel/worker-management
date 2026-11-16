import { jest } from '@jest/globals';
import type {
  Channel,
  ChannelModel,
  ConfirmChannel,
  ConsumeMessage,
} from 'amqplib';

import { MessageContractValidationError } from '../contracts/checkout-completed.validator';
import type { CheckoutCompletedHandler } from '../handlers/checkout-completed.handler';
import { CheckoutCompletedConsumer } from './checkout-completed.consumer';
import {
  CHECKOUT_CONSUMER_TOPOLOGY as TOPOLOGY,
  CHECKOUT_RETRY_HEADER,
} from './checkout-consumer.topology';

const BOOKING_ID = '47f608e3-94d7-4e25-96ad-b32acb45d6e1';
const TASK_ID = '9e2cc9c6-8933-4de5-b40d-dc9cd12950c6';

function validEvent() {
  return {
    eventId: `checkout:${BOOKING_ID}`,
    eventType: 'checkout.completed',
    eventVersion: 1,
    occurredAt: '2026-10-10T00:30:00.000Z',
    source: 'front-desk',
    data: {
      bookingReference: BOOKING_ID,
      roomNumber: 'DEMO101',
      taskCategory: 'ROOM_CLEANING',
      priority: 'HIGH',
      sourceType: 'CHECKOUT_TRIGGER',
    },
  };
}

function makeMessage(
  payload: unknown = validEvent(),
  retryCount?: number,
): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    properties: {
      messageId: `checkout:${BOOKING_ID}`,
      headers:
        retryCount === undefined ? {} : { [CHECKOUT_RETRY_HEADER]: retryCount },
    },
  } as unknown as ConsumeMessage;
}

function createContext() {
  const handle = jest
    .fn<CheckoutCompletedHandler['handle']>()
    .mockResolvedValue({
      status: 'CREATED',
      taskId: TASK_ID,
    });

  const service = new CheckoutCompletedConsumer(
    {
      enabled: true,
      url: 'amqp://127.0.0.1:5672',
      exchange: 'forever.events',
    },
    { handle } as unknown as CheckoutCompletedHandler,
  );

  const ack = jest.fn<(message: ConsumeMessage) => void>();

  const nack =
    jest.fn<
      (message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean) => void
    >();

  const consumerChannel = {
    ack,
    nack,
  } as unknown as Channel;

  const publish = jest
    .fn<(...args: unknown[]) => boolean>()
    .mockReturnValue(true);

  const waitForConfirms = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);

  const on = jest.fn<(...args: unknown[]) => void>();
  const off = jest.fn<(...args: unknown[]) => void>();

  const retryChannel = {
    publish,
    waitForConfirms,
    on,
    off,
  } as unknown as ConfirmChannel;

  const close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

  const connection = { close } as unknown as ChannelModel;

  async function process(message: ConsumeMessage) {
    await service.processMessage(
      message,
      consumerChannel,
      retryChannel,
      connection,
    );
  }

  return {
    service,
    handle,
    ack,
    nack,
    publish,
    waitForConfirms,
    on,
    off,
    close,
    process,
  };
}

describe('CheckoutCompletedConsumer', () => {
  it('ACKs only after successful task creation', async () => {
    const context = createContext();
    const message = makeMessage();

    await context.process(message);

    expect(context.handle).toHaveBeenCalledTimes(1);
    expect(context.ack).toHaveBeenCalledWith(message);
    expect(context.nack).not.toHaveBeenCalled();
    expect(context.publish).not.toHaveBeenCalled();
  });

  it('ACKs duplicate events without creating a retry', async () => {
    const context = createContext();

    context.handle.mockResolvedValue({
      status: 'EXISTS',
      taskId: TASK_ID,
    });

    const message = makeMessage();
    await context.process(message);

    expect(context.ack).toHaveBeenCalledWith(message);
    expect(context.publish).not.toHaveBeenCalled();
  });

  it('dead-letters invalid contracts without retry', async () => {
    const context = createContext();

    context.handle.mockRejectedValue(
      new MessageContractValidationError('invalid eventVersion'),
    );

    const message = makeMessage();
    await context.process(message);

    expect(context.nack).toHaveBeenCalledWith(message, false, false);

    expect(context.ack).not.toHaveBeenCalled();
    expect(context.publish).not.toHaveBeenCalled();
  });

  it('dead-letters malformed JSON', async () => {
    const context = createContext();

    const message = makeMessage();
    message.content = Buffer.from('{invalid json');

    await context.process(message);

    expect(context.handle).not.toHaveBeenCalled();
    expect(context.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('dead-letters conflicting checkout room information', async () => {
    const context = createContext();

    context.handle.mockRejectedValue(new Error('CHECKOUT_TASK_ROOM_CONFLICT'));

    const message = makeMessage();
    await context.process(message);

    expect(context.nack).toHaveBeenCalledWith(message, false, false);

    expect(context.publish).not.toHaveBeenCalled();
  });

  it('confirms retry publication before ACK on database failure', async () => {
    const context = createContext();

    context.handle.mockRejectedValue(new Error('Temporary PostgreSQL failure'));

    const message = makeMessage();
    await context.process(message);

    expect(context.publish).toHaveBeenCalledWith(
      'forever.events',
      TOPOLOGY.routingKeys.retry,
      message.content,
      expect.objectContaining({
        persistent: true,
        mandatory: true,
        headers: expect.objectContaining({
          [CHECKOUT_RETRY_HEADER]: 1,
        }),
      }),
    );

    expect(context.waitForConfirms).toHaveBeenCalledTimes(1);
    expect(context.ack).toHaveBeenCalledWith(message);
    expect(context.nack).not.toHaveBeenCalled();
  });

  it('increments the persisted retry counter', async () => {
    const context = createContext();

    context.handle.mockRejectedValue(new Error('Temporary failure'));

    await context.process(makeMessage(validEvent(), 2));

    expect(context.publish).toHaveBeenCalledWith(
      'forever.events',
      TOPOLOGY.routingKeys.retry,
      expect.any(Buffer),
      expect.objectContaining({
        headers: expect.objectContaining({
          [CHECKOUT_RETRY_HEADER]: 3,
        }),
      }),
    );

    expect(context.ack).toHaveBeenCalledTimes(1);
  });

  it('dead-letters messages after the maximum retries', async () => {
    const context = createContext();

    context.handle.mockRejectedValue(new Error('Persistent failure'));

    const message = makeMessage(validEvent(), TOPOLOGY.maxRetries);

    await context.process(message);

    expect(context.nack).toHaveBeenCalledWith(message, false, false);

    expect(context.publish).not.toHaveBeenCalled();
    expect(context.ack).not.toHaveBeenCalled();
  });

  it('does not ACK when retry publication fails', async () => {
    const context = createContext();

    context.handle.mockRejectedValue(new Error('Database failure'));
    context.waitForConfirms.mockRejectedValue(
      new Error('Broker confirmation failed'),
    );

    await context.process(makeMessage());

    expect(context.ack).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('declares durable checkout, retry and dead-letter queues', async () => {
    const context = createContext();

    const assertExchange = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue(undefined);

    const assertQueue = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue(undefined);

    const bindQueue = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue(undefined);

    const channel = {
      assertExchange,
      assertQueue,
      bindQueue,
    } as unknown as Channel;

    await context.service.assertTopology(channel);

    expect(assertExchange).toHaveBeenCalledWith('forever.events', 'topic', {
      durable: true,
    });

    expect(assertQueue).toHaveBeenCalledWith(
      TOPOLOGY.queues.main,
      expect.objectContaining({ durable: true }),
    );

    expect(assertQueue).toHaveBeenCalledWith(
      TOPOLOGY.queues.retry,
      expect.objectContaining({
        durable: true,
        arguments: expect.objectContaining({
          'x-message-ttl': TOPOLOGY.retryDelayMs,
        }),
      }),
    );

    expect(assertQueue).toHaveBeenCalledWith(TOPOLOGY.queues.deadLetter, {
      durable: true,
    });

    expect(bindQueue).toHaveBeenCalledWith(
      TOPOLOGY.queues.main,
      'forever.events',
      TOPOLOGY.routingKeys.checkoutCompleted,
    );

    expect(bindQueue).toHaveBeenCalledWith(
      TOPOLOGY.queues.retry,
      'forever.events',
      TOPOLOGY.routingKeys.retry,
    );

    expect(bindQueue).toHaveBeenCalledWith(
      TOPOLOGY.queues.deadLetter,
      'forever.events',
      TOPOLOGY.routingKeys.deadLetter,
    );
  });
});
