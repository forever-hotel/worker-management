import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import type {
  Channel,
  ChannelModel,
  ConfirmChannel,
  ConsumeMessage,
} from 'amqplib';

import type { OrderReadyHandler } from '../handlers/order-ready.handler';
import { OrderReadyEventValidationError } from '../contracts/order-ready.validator';
import { OrderReadyConsumer } from './order-ready.consumer';
import {
  ORDER_READY_CONSUMER_TOPOLOGY as TOPOLOGY,
  ORDER_READY_RETRY_HEADER,
} from './order-ready.consumer.topology';

const FOOD_ORDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TASK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeEvent() {
  return {
    eventId: `order-ready:${FOOD_ORDER_ID}`,
    eventType: 'order.ready',
    eventVersion: 1,
    occurredAt: '2026-10-11T12:00:00.000Z',
    source: 'kitchen-management',
    data: { foodOrderId: FOOD_ORDER_ID, roomNumber: 'R101' },
  };
}

function makeMessage(
  payload: unknown = makeEvent(),
  headers: Record<string, unknown> = {},
  messageId: string | undefined = `order-ready:${FOOD_ORDER_ID}`,
): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(payload), 'utf8'),
    properties: { headers, messageId },
  } as unknown as ConsumeMessage;
}

type HandlingResult = {
  status: 'CREATED' | 'EXISTS';
  taskId: string;
};

function setup() {
  const handle = jest.fn<(payload: unknown) => Promise<HandlingResult>>();
  const handler = { handle } as unknown as OrderReadyHandler;

  const consumer = new OrderReadyConsumer(
    { enabled: true, url: 'amqp://127.0.0.1:5672', exchange: 'forever.events' },
    handler,
  );

  const ack = jest.fn<(message: ConsumeMessage) => void>();
  const nack =
    jest.fn<
      (message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean) => void
    >();
  const consumerChannel = { ack, nack } as unknown as Channel;

  const publish = jest
    .fn<(...args: unknown[]) => boolean>()
    .mockReturnValue(true);
  const waitForConfirms = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);
  const retryChannel = Object.assign(new EventEmitter(), {
    publish,
    waitForConfirms,
  }) as unknown as ConfirmChannel;

  const close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const connection = { close } as unknown as ChannelModel;

  return {
    consumer,
    handle,
    ack,
    nack,
    publish,
    waitForConfirms,
    retryChannel,
    consumerChannel,
    connection,
    close,
  };
}

describe('OrderReadyConsumer message processing', () => {
  it('ACKs only after successfully creating a food-delivery task', async () => {
    const test = setup();
    const message = makeMessage();
    test.handle.mockResolvedValue({ status: 'CREATED', taskId: TASK_ID });

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.handle).toHaveBeenCalledWith(makeEvent());
    expect(test.ack).toHaveBeenCalledWith(message);
    expect(test.ack).toHaveBeenCalledTimes(1);
    expect(test.nack).not.toHaveBeenCalled();
    expect(test.publish).not.toHaveBeenCalled();
  });

  it('ACKs a confirmed duplicate without creating another task', async () => {
    const test = setup();
    const message = makeMessage();
    test.handle.mockResolvedValue({ status: 'EXISTS', taskId: TASK_ID });

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.ack).toHaveBeenCalledWith(message);
    expect(test.publish).not.toHaveBeenCalled();
  });

  it('dead-letters malformed JSON without calling the handler', async () => {
    const test = setup();
    const message = {
      ...makeMessage(),
      content: Buffer.from('{invalid JSON'),
    } as ConsumeMessage;

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.handle).not.toHaveBeenCalled();
    expect(test.nack).toHaveBeenCalledWith(message, false, false);
    expect(test.ack).not.toHaveBeenCalled();
  });

  it('dead-letters rejected event contracts', async () => {
    const test = setup();
    const message = makeMessage();
    test.handle.mockRejectedValue(
      new OrderReadyEventValidationError('Unexpected event field'),
    );

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.nack).toHaveBeenCalledWith(message, false, false);
    expect(test.publish).not.toHaveBeenCalled();
    expect(test.ack).not.toHaveBeenCalled();
  });

  it('dead-letters a permanent food-delivery room conflict', async () => {
    const test = setup();
    const message = makeMessage();
    test.handle.mockRejectedValue(
      new Error('FOOD_DELIVERY_TASK_ROOM_CONFLICT'),
    );

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.nack).toHaveBeenCalledWith(message, false, false);
    expect(test.publish).not.toHaveBeenCalled();
    expect(test.ack).not.toHaveBeenCalled();
  });

  it('publishes a persistent retry and ACKs after broker confirmation', async () => {
    const test = setup();
    const message = makeMessage();
    test.handle.mockRejectedValue(new Error('FOOD_ORDER_NOT_CONFIRMED_READY'));

    let confirm!: () => void;
    const pendingConfirmation = new Promise<void>((resolve) => {
      confirm = resolve;
    });
    test.waitForConfirms.mockReturnValueOnce(pendingConfirmation);

    const processing = test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    // The original message must not be ACKed before confirm-channel success.
    await Promise.resolve();
    await Promise.resolve();
    expect(test.ack).not.toHaveBeenCalled();

    confirm();
    await processing;

    expect(test.publish).toHaveBeenCalledWith(
      'forever.events',
      TOPOLOGY.routingKeys.retry,
      message.content,
      expect.objectContaining({
        persistent: true,
        mandatory: true,
        messageId: `order-ready:${FOOD_ORDER_ID}`,
        headers: expect.objectContaining({
          [ORDER_READY_RETRY_HEADER]: 1,
        }),
      }),
    );
    expect(test.waitForConfirms).toHaveBeenCalledTimes(1);
    expect(test.ack).toHaveBeenCalledWith(message);
    expect(test.nack).not.toHaveBeenCalled();
  });

  it('increments an existing retry count', async () => {
    const test = setup();
    const message = makeMessage(makeEvent(), {
      [ORDER_READY_RETRY_HEADER]: 2,
    });
    test.handle.mockRejectedValue(new Error('Temporary database error'));

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.publish).toHaveBeenCalledWith(
      'forever.events',
      TOPOLOGY.routingKeys.retry,
      message.content,
      expect.objectContaining({
        headers: expect.objectContaining({
          [ORDER_READY_RETRY_HEADER]: 3,
        }),
      }),
    );
    expect(test.ack).toHaveBeenCalledWith(message);
  });

  it('dead-letters failures that have exhausted their retry limit', async () => {
    const test = setup();
    const message = makeMessage(makeEvent(), {
      [ORDER_READY_RETRY_HEADER]: TOPOLOGY.maxRetries,
    });
    test.handle.mockRejectedValue(new Error('Temporary database error'));

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.nack).toHaveBeenCalledWith(message, false, false);
    expect(test.publish).not.toHaveBeenCalled();
    expect(test.ack).not.toHaveBeenCalled();
  });

  it('treats an invalid retry-count header as zero', async () => {
    const test = setup();
    const message = makeMessage(makeEvent(), {
      [ORDER_READY_RETRY_HEADER]: -5,
    });
    test.handle.mockRejectedValue(new Error('Temporary database error'));

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.publish).toHaveBeenCalledWith(
      'forever.events',
      TOPOLOGY.routingKeys.retry,
      message.content,
      expect.objectContaining({
        headers: expect.objectContaining({
          [ORDER_READY_RETRY_HEADER]: 1,
        }),
      }),
    );
    expect(test.ack).toHaveBeenCalledTimes(1);
  });

  it('closes the connection without ACK when retry publication fails', async () => {
    const test = setup();
    const message = makeMessage();
    test.handle.mockRejectedValue(new Error('Temporary database error'));
    test.publish.mockImplementationOnce(() => {
      throw new Error('Publisher unavailable');
    });

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.close).toHaveBeenCalledTimes(1);
    expect(test.ack).not.toHaveBeenCalled();
    expect(test.nack).not.toHaveBeenCalled();
  });

  it('closes the connection without ACK if publisher confirms fail', async () => {
    const test = setup();
    const message = makeMessage();
    test.handle.mockRejectedValue(new Error('Temporary database error'));
    test.waitForConfirms.mockRejectedValueOnce(
      new Error('Publisher confirmation failed'),
    );

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.close).toHaveBeenCalledTimes(1);
    expect(test.ack).not.toHaveBeenCalled();
    expect(test.nack).not.toHaveBeenCalled();
  });

  it('closes the connection when a mandatory retry is returned unroutable', async () => {
    const test = setup();
    const message = makeMessage();
    test.handle.mockRejectedValue(new Error('Temporary database error'));

    test.publish.mockImplementationOnce((...args: unknown[]) => {
      const options = args[3] as { messageId: string };
      test.retryChannel.emit('return', {
        properties: { messageId: options.messageId },
      });
      return true;
    });

    await test.consumer.processMessage(
      message,
      test.consumerChannel,
      test.retryChannel,
      test.connection,
    );

    expect(test.close).toHaveBeenCalledTimes(1);
    expect(test.ack).not.toHaveBeenCalled();
    expect(test.nack).not.toHaveBeenCalled();
  });
});
