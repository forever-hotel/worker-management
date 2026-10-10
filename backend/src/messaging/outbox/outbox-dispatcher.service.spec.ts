import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../database/database.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { OutboxDispatcherService } from './outbox-dispatcher.service';

type QueryMock = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: unknown[] }>;

type PublishMock = (
  routingKey: string,
  payload: unknown,
  messageId?: string,
) => Promise<void>;

const event = {
  event_id: 'escalation:task-101',
  routing_key: 'wkms.task.escalated.v1',
  payload: {
    eventId: 'escalation:task-101',
    eventType: 'task.escalated',
  },
};

function setup() {
  const query = jest.fn<QueryMock>();

  query.mockResolvedValue({ rows: [] });

  const client = {
    query,
  } as unknown as PoolClient;

  const withTransaction =
    jest.fn<
      (operation: (client: PoolClient) => Promise<unknown>) => Promise<unknown>
    >();

  withTransaction.mockImplementation(async (operation) => operation(client));

  const isEnabled = jest.fn<() => boolean>().mockReturnValue(true);

  const publishJson = jest.fn<PublishMock>().mockResolvedValue(undefined);

  const databaseService = {
    withTransaction,
  } as unknown as DatabaseService;

  const rabbitMqService = {
    isEnabled,
    publishJson,
  } as unknown as RabbitMqService;

  const dispatcher = new OutboxDispatcherService(
    databaseService,
    rabbitMqService,
  );

  return {
    dispatcher,
    query,
    withTransaction,
    isEnabled,
    publishJson,
  };
}

describe('OutboxDispatcherService', () => {
  it('does nothing when RabbitMQ is disabled', async () => {
    const context = setup();

    context.isEnabled.mockReturnValue(false);

    await context.dispatcher.dispatchPendingEvents();

    expect(context.withTransaction).not.toHaveBeenCalled();
    expect(context.publishJson).not.toHaveBeenCalled();
  });

  it('does not publish when the outbox is empty', async () => {
    const context = setup();

    await context.dispatcher.dispatchPendingEvents();

    expect(context.query).toHaveBeenCalledTimes(1);
    expect(context.publishJson).not.toHaveBeenCalled();
  });

  it('publishes a pending event and marks it published', async () => {
    const context = setup();

    context.query.mockResolvedValueOnce({
      rows: [event],
    });

    await context.dispatcher.dispatchPendingEvents();

    expect(context.publishJson).toHaveBeenCalledWith(
      event.routing_key,
      event.payload,
      event.event_id,
    );

    expect(context.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'PUBLISHED'"),
      [event.event_id],
    );
  });

  it('keeps failed messages pending', async () => {
    const context = setup();

    context.query.mockResolvedValueOnce({
      rows: [event],
    });

    context.publishJson.mockRejectedValueOnce(
      new Error('RabbitMQ unavailable'),
    );

    await context.dispatcher.dispatchPendingEvents();

    expect(context.query).toHaveBeenCalledWith(
      expect.stringContaining("last_error = 'RabbitMQ publication failed'"),
      [event.event_id],
    );

    expect(context.query).not.toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'PUBLISHED'"),
      expect.anything(),
    );
  });

  it('can retry a previously failed event', async () => {
    const context = setup();

    context.query.mockResolvedValueOnce({
      rows: [event],
    });

    context.publishJson.mockRejectedValueOnce(
      new Error('Temporary connection failure'),
    );

    await context.dispatcher.dispatchPendingEvents();

    // Simulate the database returning the event again
    // after the retry delay has elapsed.
    context.query.mockResolvedValueOnce({
      rows: [event],
    });

    await context.dispatcher.dispatchPendingEvents();

    expect(context.publishJson).toHaveBeenCalledTimes(2);

    expect(context.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'PUBLISHED'"),
      [event.event_id],
    );
  });

  it('prevents overlapping runs in one instance', async () => {
    const context = setup();

    context.query.mockResolvedValueOnce({
      rows: [event],
    });

    let releasePublish!: () => void;

    const waiting = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });

    context.publishJson.mockImplementation(async () => waiting);

    const firstRun = context.dispatcher.dispatchPendingEvents();

    const secondRun = context.dispatcher.dispatchPendingEvents();

    await secondRun;

    expect(context.withTransaction).toHaveBeenCalledTimes(1);

    releasePublish();
    await firstRun;

    expect(context.publishJson).toHaveBeenCalledTimes(1);
  });
});
