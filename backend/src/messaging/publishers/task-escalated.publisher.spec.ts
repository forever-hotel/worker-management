import { jest } from '@jest/globals';

import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
  RABBITMQ_TOPOLOGY,
} from '../messaging.constants';

import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

import {
  NewlyEscalatedTask,
  TaskEscalatedPublisher,
} from './task-escalated.publisher';

type PublishJsonMock = (
  routingKey: string,
  payload: unknown,
  messageId?: string,
) => Promise<void>;

describe('TaskEscalatedPublisher', () => {
  const task: NewlyEscalatedTask = {
    task_id: '550e8400-e29b-41d4-a716-446655440000',
    category: 'ROOM_CLEANING',
    room_number: '205',
    priority: 'HIGH',
    updated_at: '2026-10-09T10:15:00.000Z',
  };

  const publishJson = jest.fn<PublishJsonMock>();

  const publisher = new TaskEscalatedPublisher({
    publishJson,
  } as unknown as RabbitMqService);

  beforeEach(() => {
    publishJson.mockReset();
    publishJson.mockResolvedValue(undefined);
  });

  it('publishes the Front Desk event contract', async () => {
    await publisher.publishTaskEscalated(task);

    expect(publishJson).toHaveBeenCalledTimes(1);

    expect(publishJson).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.routingKeys.taskEscalated,
      {
        eventId: `escalation:${task.task_id}`,
        eventType: MESSAGE_EVENT_TYPES.taskEscalated,
        eventVersion: MESSAGE_EVENT_VERSIONS.taskEscalated,
        occurredAt: task.updated_at,
        source: MESSAGE_SOURCES.workerManagement,
        data: {
          taskId: task.task_id,
          taskCategory: 'ROOM_CLEANING',
          roomNumber: '205',
          priority: 'HIGH',
          escalatedAt: task.updated_at,
        },
      },
      `escalation:${task.task_id}`,
    );
  });

  it('uses the same event ID for the same task', async () => {
    await publisher.publishTaskEscalated(task);
    await publisher.publishTaskEscalated(task);

    const firstMessageId = publishJson.mock.calls[0][2];

    const secondMessageId = publishJson.mock.calls[1][2];

    expect(firstMessageId).toBe(secondMessageId);
  });

  it('propagates RabbitMQ publication failures', async () => {
    publishJson.mockRejectedValue(new Error('RabbitMQ unavailable'));

    await expect(publisher.publishTaskEscalated(task)).rejects.toThrow(
      'RabbitMQ unavailable',
    );
  });
});
