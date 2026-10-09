import { Injectable } from '@nestjs/common';

import {
  TaskEscalatedEvent,
  TaskEscalationCategory,
  TaskEscalationPriority,
} from '../contracts/task-escalated.event';

import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
  RABBITMQ_TOPOLOGY,
} from '../messaging.constants';

import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

export interface NewlyEscalatedTask {
  task_id: string;
  category: TaskEscalationCategory;
  room_number: string;
  priority: TaskEscalationPriority;
  updated_at: Date | string;
}

@Injectable()
export class TaskEscalatedPublisher {
  constructor(private readonly rabbitMqService: RabbitMqService) {}

  async publishTaskEscalated(task: NewlyEscalatedTask): Promise<void> {
    const escalatedAt = new Date(task.updated_at).toISOString();

    const event: TaskEscalatedEvent = {
      eventId: `escalation:${task.task_id}`,
      eventType: MESSAGE_EVENT_TYPES.taskEscalated,
      eventVersion: MESSAGE_EVENT_VERSIONS.taskEscalated,
      occurredAt: escalatedAt,
      source: MESSAGE_SOURCES.workerManagement,

      data: {
        taskId: task.task_id,
        taskCategory: task.category,
        roomNumber: task.room_number,
        priority: task.priority,
        escalatedAt,
      },
    };

    await this.rabbitMqService.publishJson(
      RABBITMQ_TOPOLOGY.routingKeys.taskEscalated,
      event,
      event.eventId,
    );
  }
}
