import { Injectable } from '@nestjs/common';

import { FoodDeliveryTaskRepository } from '../../database/repositories/food-delivery-task.repository';
import { validateOrderReadyEvent } from '../contracts/order-ready.validator';
import { WkmsRealtimeGateway } from '../../realtime/wkms-realtime.gateway';

export type OrderReadyHandlingResult = {
  status: 'CREATED' | 'EXISTS';
  taskId: string;
};

@Injectable()
export class OrderReadyHandler {
  constructor(
    private readonly foodDeliveryTaskRepository: FoodDeliveryTaskRepository,
    private readonly realtimeGateway: WkmsRealtimeGateway,
  ) {}

  async handle(payload: unknown): Promise<OrderReadyHandlingResult> {
    // Validate the external message before using its data.
    const event = validateOrderReadyEvent(payload);

    // The repository verifies the order and creates the task
    // transactionally, or returns the existing task.
    const result =
      await this.foodDeliveryTaskRepository.createFoodDeliveryTask(
        event.data.foodOrderId,
        event.data.roomNumber,
      );

    if (result.status === 'CREATED') {
      this.realtimeGateway.emitTaskCreated(result.taskId);
    }

    return result;
  }
}
