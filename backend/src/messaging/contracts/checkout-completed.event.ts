import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
} from '../messaging.constants';

export interface CheckoutCompletedEventData {
  bookingReference: string;
  roomNumber: string;
  taskCategory: 'ROOM_CLEANING';
  priority: 'HIGH';
  sourceType: 'CHECKOUT_TRIGGER';
}

export interface CheckoutCompletedEvent {
  eventId: string;
  eventType: typeof MESSAGE_EVENT_TYPES.checkoutCompleted;
  eventVersion: typeof MESSAGE_EVENT_VERSIONS.checkoutCompleted;
  occurredAt: string;
  source: typeof MESSAGE_SOURCES.frontDesk;
  data: CheckoutCompletedEventData;
}
