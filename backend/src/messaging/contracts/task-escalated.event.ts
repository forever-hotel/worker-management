import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
} from '../messaging.constants';

export type TaskEscalationCategory =
  | 'ROOM_CLEANING'
  | 'EXTRA_TOWELS'
  | 'WATER_BOTTLES'
  | 'MAINTENANCE'
  | 'LAUNDRY'
  | 'FOOD_DELIVERY'
  | 'OTHER';

export type TaskEscalationPriority = 'HIGH' | 'NORMAL';

export interface TaskEscalatedEventData {
  taskId: string;
  taskCategory: TaskEscalationCategory;
  roomNumber: string;
  priority: TaskEscalationPriority;
  escalatedAt: string;
}

export interface TaskEscalatedEvent {
  eventId: string;

  eventType: typeof MESSAGE_EVENT_TYPES.taskEscalated;

  eventVersion: typeof MESSAGE_EVENT_VERSIONS.taskEscalated;

  occurredAt: string;

  source: typeof MESSAGE_SOURCES.workerManagement;

  data: TaskEscalatedEventData;
}
