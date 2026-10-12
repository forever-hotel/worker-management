import type { OrderReadyEvent } from './order-ready.event';
import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
} from '../messaging.constants';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const ENVELOPE_KEYS = [
  'eventId',
  'eventType',
  'eventVersion',
  'occurredAt',
  'source',
  'data',
] as const;

const DATA_KEYS = ['foodOrderId', 'roomNumber'] as const;

export class OrderReadyEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderReadyEventValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  location: string,
): void {
  const actualKeys = Object.keys(value);

  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => !expectedKeys.includes(key))
  ) {
    throw new OrderReadyEventValidationError(`Invalid ${location} fields`);
  }
}

function isValidUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_UTC_PATTERN.test(value)) {
    return false;
  }

  const milliseconds = Date.parse(value);

  return (
    !Number.isNaN(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

export function validateOrderReadyEvent(payload: unknown): OrderReadyEvent {
  if (!isRecord(payload)) {
    throw new OrderReadyEventValidationError(
      'Order-ready event must be an object',
    );
  }

  assertExactKeys(payload, ENVELOPE_KEYS, 'order-ready envelope');

  if (payload.eventType !== MESSAGE_EVENT_TYPES.orderReady) {
    throw new OrderReadyEventValidationError('Invalid order-ready event type');
  }

  if (payload.eventVersion !== MESSAGE_EVENT_VERSIONS.orderReady) {
    throw new OrderReadyEventValidationError(
      'Unsupported order-ready event version',
    );
  }

  if (payload.source !== MESSAGE_SOURCES.kitchenManagement) {
    throw new OrderReadyEventValidationError(
      'Invalid order-ready event source',
    );
  }

  if (!isValidUtcTimestamp(payload.occurredAt)) {
    throw new OrderReadyEventValidationError(
      'Invalid order-ready occurrence timestamp',
    );
  }

  if (!isRecord(payload.data)) {
    throw new OrderReadyEventValidationError(
      'Order-ready event data must be an object',
    );
  }

  const data = payload.data;

  assertExactKeys(data, DATA_KEYS, 'order-ready data');

  if (
    typeof data.foodOrderId !== 'string' ||
    !UUID_V4_PATTERN.test(data.foodOrderId)
  ) {
    throw new OrderReadyEventValidationError('Invalid food order identifier');
  }

  if (
    typeof data.roomNumber !== 'string' ||
    data.roomNumber.length === 0 ||
    data.roomNumber.length > 10 ||
    data.roomNumber.trim() !== data.roomNumber
  ) {
    throw new OrderReadyEventValidationError(
      'Invalid food-delivery room number',
    );
  }

  const expectedEventId = `order-ready:${data.foodOrderId}`;

  if (payload.eventId !== expectedEventId) {
    throw new OrderReadyEventValidationError(
      'Order-ready event ID does not match the food order',
    );
  }

  return {
    eventId: expectedEventId,
    eventType: MESSAGE_EVENT_TYPES.orderReady,
    eventVersion: MESSAGE_EVENT_VERSIONS.orderReady,
    occurredAt: payload.occurredAt,
    source: MESSAGE_SOURCES.kitchenManagement,
    data: {
      foodOrderId: data.foodOrderId,
      roomNumber: data.roomNumber,
    },
  };
}
