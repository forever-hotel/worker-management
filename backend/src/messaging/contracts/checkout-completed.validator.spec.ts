import {
  MessageContractValidationError,
  validateCheckoutCompletedEvent,
} from './checkout-completed.validator';

const BOOKING_ID = '47f608e3-94d7-4e25-96ad-b32acb45d6e1';

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

describe('checkout.completed contract validation', () => {
  it('accepts the real FDS v1 event structure', () => {
    const event = validEvent();

    expect(validateCheckoutCompletedEvent(event)).toEqual(event);
  });

  it('accepts a JSON-deserialized event', () => {
    const parsed: unknown = JSON.parse(JSON.stringify(validEvent()));

    expect(validateCheckoutCompletedEvent(parsed).data.bookingReference).toBe(
      BOOKING_ID,
    );
  });

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'checkout.completed'],
    ['empty object', {}],
  ])('rejects an invalid envelope: %s', (_name, payload) => {
    expect(() => validateCheckoutCompletedEvent(payload)).toThrow(
      MessageContractValidationError,
    );
  });

  it.each([
    ['wrong event type', { eventType: 'task.escalated' }],
    ['unsupported version', { eventVersion: 2 }],
    ['invalid source', { source: 'kitchen-management' }],
    ['missing event ID', { eventId: '' }],
    ['whitespace event ID', { eventId: '   ' }],
    ['invalid timestamp', { occurredAt: 'not-a-date' }],
  ])('rejects %s', (_name, changes) => {
    expect(() =>
      validateCheckoutCompletedEvent({
        ...validEvent(),
        ...changes,
      }),
    ).toThrow(MessageContractValidationError);
  });

  it('rejects unknown envelope fields', () => {
    expect(() =>
      validateCheckoutCompletedEvent({
        ...validEvent(),
        password: 'unexpected',
      }),
    ).toThrow(MessageContractValidationError);
  });

  it.each([
    ['invalid booking UUID', { bookingReference: 'booking-123' }],
    ['missing booking UUID', { bookingReference: undefined }],
    ['empty room', { roomNumber: '' }],
    ['long room number', { roomNumber: 'ROOM-NUMBER-TOO-LONG' }],
    ['wrong category', { taskCategory: 'FOOD_DELIVERY' }],
    ['wrong priority', { priority: 'NORMAL' }],
    ['wrong source type', { sourceType: 'KMS' }],
  ])('rejects %s', (_name, changes) => {
    expect(() =>
      validateCheckoutCompletedEvent({
        ...validEvent(),
        data: {
          ...validEvent().data,
          ...changes,
        },
      }),
    ).toThrow(MessageContractValidationError);
  });

  it('rejects unknown data fields', () => {
    expect(() =>
      validateCheckoutCompletedEvent({
        ...validEvent(),
        data: {
          ...validEvent().data,
          guestPassword: 'unexpected',
        },
      }),
    ).toThrow(MessageContractValidationError);
  });

  it('rejects missing event data', () => {
    expect(() =>
      validateCheckoutCompletedEvent({
        ...validEvent(),
        data: null,
      }),
    ).toThrow(MessageContractValidationError);
  });

  it('rejects an event ID belonging to another booking', () => {
    const event = validEvent();

    event.eventId = 'checkout:8de7a8d3-2b36-49de-a0d9-26cb94421578';

    expect(() => validateCheckoutCompletedEvent(event)).toThrow(
      MessageContractValidationError,
    );
  });

  it('rejects a non-deterministic checkout event ID', () => {
    const event = validEvent();

    event.eventId = 'random-event-id';

    expect(() => validateCheckoutCompletedEvent(event)).toThrow(
      'eventId does not match bookingReference',
    );
  });
});
