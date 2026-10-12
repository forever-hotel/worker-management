import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
} from '../messaging.constants';
import type { CheckoutCompletedEvent } from './checkout-completed.event';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const ENVELOPE_KEYS = [
  'eventId',
  'eventType',
  'eventVersion',
  'occurredAt',
  'source',
  'data',
];

const DATA_KEYS = [
  'bookingReference',
  'roomNumber',
  'taskCategory',
  'priority',
  'sourceType',
];

export class MessageContractValidationError extends Error {
  constructor(reason: string) {
    super(`Invalid checkout.completed event: ${reason}`);
    this.name = 'MessageContractValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isTrimmedNonEmpty(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.trim() === value
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_TIMESTAMP.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export function validateCheckoutCompletedEvent(
  value: unknown,
): CheckoutCompletedEvent {
  if (!isRecord(value) || !hasExactKeys(value, ENVELOPE_KEYS)) {
    throw new MessageContractValidationError('invalid event envelope');
  }

  if (!isTrimmedNonEmpty(value.eventId)) {
    throw new MessageContractValidationError('invalid eventId');
  }

  if (value.eventType !== MESSAGE_EVENT_TYPES.checkoutCompleted) {
    throw new MessageContractValidationError('unsupported eventType');
  }

  if (value.eventVersion !== MESSAGE_EVENT_VERSIONS.checkoutCompleted) {
    throw new MessageContractValidationError('unsupported eventVersion');
  }

  if (value.source !== MESSAGE_SOURCES.frontDesk) {
    throw new MessageContractValidationError('invalid source');
  }

  if (!isIsoTimestamp(value.occurredAt)) {
    throw new MessageContractValidationError('invalid occurredAt');
  }

  const data = value.data;

  if (!isRecord(data) || !hasExactKeys(data, DATA_KEYS)) {
    throw new MessageContractValidationError('invalid event data');
  }

  if (
    typeof data.bookingReference !== 'string' ||
    !UUID_V4.test(data.bookingReference)
  ) {
    throw new MessageContractValidationError('invalid bookingReference');
  }

  if (!isTrimmedNonEmpty(data.roomNumber) || data.roomNumber.length > 10) {
    throw new MessageContractValidationError('invalid roomNumber');
  }

  if (data.taskCategory !== 'ROOM_CLEANING') {
    throw new MessageContractValidationError('invalid taskCategory');
  }

  if (data.priority !== 'HIGH') {
    throw new MessageContractValidationError('invalid priority');
  }

  if (data.sourceType !== 'CHECKOUT_TRIGGER') {
    throw new MessageContractValidationError('invalid sourceType');
  }

  if (value.eventId !== `checkout:${data.bookingReference}`) {
    throw new MessageContractValidationError(
      'eventId does not match bookingReference',
    );
  }

  return value as unknown as CheckoutCompletedEvent;
}
