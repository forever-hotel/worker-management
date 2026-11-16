import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
} from '../messaging.constants';

export type TaskCompletedCategory =
  | 'ROOM_CLEANING'
  | 'EXTRA_TOWELS'
  | 'WATER_BOTTLES'
  | 'MAINTENANCE'
  | 'LAUNDRY'
  | 'FOOD_DELIVERY'
  | 'OTHER';

export type TaskCompletedPriority = 'HIGH' | 'NORMAL';

export interface TaskCompletedEventData {
  taskId: string;
  workerId: string;
  taskCategory: TaskCompletedCategory;
  roomNumber: string;
  priority: TaskCompletedPriority;
  completedAt: string;
}

export interface TaskCompletedEvent {
  eventId: string;
  eventType: typeof MESSAGE_EVENT_TYPES.taskCompleted;
  eventVersion: typeof MESSAGE_EVENT_VERSIONS.taskCompleted;
  occurredAt: string;
  source: typeof MESSAGE_SOURCES.workerManagement;
  data: TaskCompletedEventData;
}
