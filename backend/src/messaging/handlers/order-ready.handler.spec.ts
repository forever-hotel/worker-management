import { jest } from '@jest/globals';

import type { FoodDeliveryTaskRepository } from '../../database/repositories/food-delivery-task.repository';
import { OrderReadyEventValidationError } from '../contracts/order-ready.validator';
import { OrderReadyHandler } from './order-ready.handler';

const FOOD_ORDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TASK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type TaskResult = {
  status: 'CREATED' | 'EXISTS';
  taskId: string;
};

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

function setup() {
  const createFoodDeliveryTask =
    jest.fn<(foodOrderId: string, roomNumber: string) => Promise<TaskResult>>();

  const repository = {
    createFoodDeliveryTask,
  } as unknown as FoodDeliveryTaskRepository;

  return {
    handler: new OrderReadyHandler(repository),
    createFoodDeliveryTask,
  };
}

describe('OrderReadyHandler', () => {
  it('creates a food-delivery task for a valid KMS event', async () => {
    const { handler, createFoodDeliveryTask } = setup();

    createFoodDeliveryTask.mockResolvedValue({
      status: 'CREATED',
      taskId: TASK_ID,
    });

    const result = await handler.handle(makeEvent());

    expect(result).toEqual({
      status: 'CREATED',
      taskId: TASK_ID,
    });

    expect(createFoodDeliveryTask).toHaveBeenCalledTimes(1);

    expect(createFoodDeliveryTask).toHaveBeenCalledWith(FOOD_ORDER_ID, 'R101');
  });

  it('returns EXISTS when the task was already created', async () => {
    const { handler, createFoodDeliveryTask } = setup();

    createFoodDeliveryTask.mockResolvedValue({
      status: 'EXISTS',
      taskId: TASK_ID,
    });

    const result = await handler.handle(makeEvent());

    expect(result).toEqual({
      status: 'EXISTS',
      taskId: TASK_ID,
    });

    expect(createFoodDeliveryTask).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed events before accessing the database', async () => {
    const { handler, createFoodDeliveryTask } = setup();

    await expect(
      handler.handle({
        eventType: 'order.ready',
      }),
    ).rejects.toThrow(OrderReadyEventValidationError);

    expect(createFoodDeliveryTask).not.toHaveBeenCalled();
  });

  it('rejects mismatched event identifiers', async () => {
    const { handler, createFoodDeliveryTask } = setup();

    await expect(
      handler.handle({
        ...makeEvent(),
        eventId: 'order-ready:wrong-order',
      }),
    ).rejects.toThrow(OrderReadyEventValidationError);

    expect(createFoodDeliveryTask).not.toHaveBeenCalled();
  });

  it('propagates temporary database failures for RabbitMQ retry', async () => {
    const { handler, createFoodDeliveryTask } = setup();

    createFoodDeliveryTask.mockRejectedValue(
      new Error('FOOD_ORDER_NOT_CONFIRMED_READY'),
    );

    await expect(handler.handle(makeEvent())).rejects.toThrow(
      'FOOD_ORDER_NOT_CONFIRMED_READY',
    );

    expect(createFoodDeliveryTask).toHaveBeenCalledTimes(1);
  });

  it('propagates conflicting room errors instead of acknowledging success', async () => {
    const { handler, createFoodDeliveryTask } = setup();

    createFoodDeliveryTask.mockRejectedValue(
      new Error('FOOD_DELIVERY_TASK_ROOM_CONFLICT'),
    );

    await expect(handler.handle(makeEvent())).rejects.toThrow(
      'FOOD_DELIVERY_TASK_ROOM_CONFLICT',
    );

    expect(createFoodDeliveryTask).toHaveBeenCalledTimes(1);
  });
});
