import {
  OrderReadyEventValidationError,
  validateOrderReadyEvent,
} from './order-ready.validator';

const FOOD_ORDER_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeEvent() {
  return {
    eventId: `order-ready:${FOOD_ORDER_ID}`,
    eventType: 'order.ready',
    eventVersion: 1,
    occurredAt: '2026-10-11T12:00:00.000Z',
    source: 'kitchen-management',
    data: {
      foodOrderId: FOOD_ORDER_ID,
      roomNumber: 'R101',
    },
  };
}

describe('KMS order-ready event validator', () => {
  it('accepts a valid order-ready event', () => {
    const payload = makeEvent();

    expect(validateOrderReadyEvent(payload)).toEqual(payload);
  });

  it('rejects a null payload', () => {
    expect(() => validateOrderReadyEvent(null)).toThrow(
      OrderReadyEventValidationError,
    );
  });

  it('rejects an array payload', () => {
    expect(() => validateOrderReadyEvent([])).toThrow(
      OrderReadyEventValidationError,
    );
  });

  it('rejects a missing envelope field', () => {
    const { source: _source, ...invalid } = makeEvent();

    expect(() => validateOrderReadyEvent(invalid)).toThrow(
      OrderReadyEventValidationError,
    );
  });

  it('rejects unexpected envelope fields', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        unexpected: true,
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects an incorrect event type', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        eventType: 'checkout.completed',
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects unsupported event versions', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        eventVersion: 2,
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects an incorrect source', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        source: 'front-desk',
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects malformed timestamps', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        occurredAt: 'not-a-date',
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects impossible calendar dates', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        occurredAt: '2026-02-30T12:00:00.000Z',
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects missing event data', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        data: null,
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects malformed food-order identifiers', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        data: {
          foodOrderId: 'invalid-uuid',
          roomNumber: 'R101',
        },
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects mismatched event IDs', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        eventId: 'order-ready:another-order',
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects empty room numbers', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        data: {
          foodOrderId: FOOD_ORDER_ID,
          roomNumber: '',
        },
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects oversized room numbers', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        data: {
          foodOrderId: FOOD_ORDER_ID,
          roomNumber: 'ROOM123456789',
        },
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects surrounding whitespace in room numbers', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        data: {
          foodOrderId: FOOD_ORDER_ID,
          roomNumber: ' R101 ',
        },
      }),
    ).toThrow(OrderReadyEventValidationError);
  });

  it('rejects unexpected data fields', () => {
    expect(() =>
      validateOrderReadyEvent({
        ...makeEvent(),
        data: {
          foodOrderId: FOOD_ORDER_ID,
          roomNumber: 'R101',
          guestName: 'Not Required',
        },
      }),
    ).toThrow(OrderReadyEventValidationError);
  });
});
