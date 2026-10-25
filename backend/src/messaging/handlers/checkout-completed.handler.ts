import { Injectable } from '@nestjs/common';
import {
  CheckoutTaskRepository,
  type CheckoutTaskCreationResult,
} from '../../database/repositories/checkout-task.repository';
import { validateCheckoutCompletedEvent } from '../contracts/checkout-completed.validator';
import { WkmsRealtimeGateway } from '../../realtime/wkms-realtime.gateway';

@Injectable()
export class CheckoutCompletedHandler {
  constructor(
    private readonly checkoutTaskRepository: CheckoutTaskRepository,
    private readonly realtimeGateway: WkmsRealtimeGateway,
  ) {}

  async handle(payload: unknown): Promise<CheckoutTaskCreationResult> {
    // Never trust unvalidated RabbitMQ JSON.
    const event = validateCheckoutCompletedEvent(payload);

    // bookingReference is the bookings.booking_id UUID.
    // The repository verifies checkout state and prevents duplicates.
    const result =
      await this.checkoutTaskRepository.createCheckoutCleaningTask(
        event.data.bookingReference,
        event.data.roomNumber,
      );

    if (result.status === 'CREATED') {
      this.realtimeGateway.emitTaskCreated(result.taskId);
    }

    return result;
  }
}
