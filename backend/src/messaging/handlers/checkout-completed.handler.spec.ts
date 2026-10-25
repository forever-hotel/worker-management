import { jest } from '@jest/globals';
import type { CheckoutTaskRepository } from '../../database/repositories/checkout-task.repository';
import { MessageContractValidationError } from '../contracts/checkout-completed.validator';
import { CheckoutCompletedHandler } from './checkout-completed.handler';

const BOOKING_ID = '47f608e3-94d7-4e25-96ad-b32acb45d6e1';
const TASK_ID = '9e2cc9c6-8933-4de5-b40d-dc9cd12950c6';

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

function createContext() {
  const createCheckoutCleaningTask =
    jest.fn<CheckoutTaskRepository['createCheckoutCleaningTask']>();

  const repository = {
    createCheckoutCleaningTask,
  } as unknown as CheckoutTaskRepository;

  // DDP79_REALTIME_MOCK
  const emitTaskCreated = jest.fn<(taskId: string) => void>();
  const realtimeGateway = {
    emitTaskCreated,
  } as unknown as ConstructorParameters<typeof CheckoutCompletedHandler>[1];
  return {
    handler: new CheckoutCompletedHandler(
      repository,
      realtimeGateway,
    ),
    emitTaskCreated,
    createCheckoutCleaningTask,
  };
}

describe('CheckoutCompletedHandler', () => {
  it('creates a cleaning task from a valid FDS event', async () => {
    const { handler, createCheckoutCleaningTask, emitTaskCreated } =
      createContext();

    createCheckoutCleaningTask.mockResolvedValue({
      status: 'CREATED',
      taskId: TASK_ID,
    });

    const result = await handler.handle(validEvent());

    expect(result).toEqual({
      status: 'CREATED',
      taskId: TASK_ID,
    });

    expect(createCheckoutCleaningTask).toHaveBeenCalledWith(
      BOOKING_ID,
      'DEMO101',
    );

    expect(createCheckoutCleaningTask).toHaveBeenCalledTimes(1);
    expect(emitTaskCreated).toHaveBeenCalledTimes(1);
    expect(emitTaskCreated).toHaveBeenCalledWith(TASK_ID);
  });

  it('treats an existing cleaning task as successfully processed', async () => {
    const { handler, createCheckoutCleaningTask, emitTaskCreated } =
      createContext();

    createCheckoutCleaningTask.mockResolvedValue({
      status: 'EXISTS',
      taskId: TASK_ID,
    });

    await expect(handler.handle(validEvent())).resolves.toEqual({
      status: 'EXISTS',
      taskId: TASK_ID,
    });

    expect(createCheckoutCleaningTask).toHaveBeenCalledTimes(1);
    expect(emitTaskCreated).not.toHaveBeenCalled();
  });

  it('rejects malformed messages before database access', async () => {
    const { handler, createCheckoutCleaningTask } = createContext();

    await expect(
      handler.handle({ eventType: 'checkout.completed' }),
    ).rejects.toThrow(MessageContractValidationError);

    expect(createCheckoutCleaningTask).not.toHaveBeenCalled();
  });

  it('rejects unsupported event versions', async () => {
    const { handler, createCheckoutCleaningTask } = createContext();

    await expect(
      handler.handle({
        ...validEvent(),
        eventVersion: 2,
      }),
    ).rejects.toThrow(MessageContractValidationError);

    expect(createCheckoutCleaningTask).not.toHaveBeenCalled();
  });

  it('rejects mismatched event identifiers', async () => {
    const { handler, createCheckoutCleaningTask } = createContext();

    await expect(
      handler.handle({
        ...validEvent(),
        eventId: 'checkout:another-booking',
      }),
    ).rejects.toThrow(MessageContractValidationError);

    expect(createCheckoutCleaningTask).not.toHaveBeenCalled();
  });

  it('propagates database failures for RabbitMQ retry handling', async () => {
    const { handler, createCheckoutCleaningTask, emitTaskCreated } =
      createContext();

    createCheckoutCleaningTask.mockRejectedValue(
      new Error('Simulated PostgreSQL failure'),
    );

    await expect(handler.handle(validEvent())).rejects.toThrow(
      'Simulated PostgreSQL failure',
    );

    expect(createCheckoutCleaningTask).toHaveBeenCalledTimes(1);
    expect(emitTaskCreated).not.toHaveBeenCalled();
  });
});
