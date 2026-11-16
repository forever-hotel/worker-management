import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CheckoutTaskRepository } from './repositories/checkout-task.repository';
import { FoodDeliveryTaskRepository } from './repositories/food-delivery-task.repository';
import { ServiceRequestRepository } from './repositories/service-request.repository';
import { StaffUserRepository } from './repositories/staff-user.repository';
import { TaskRepository } from './repositories/task.repository';

@Global()
@Module({
  providers: [
    DatabaseService,
    TaskRepository,
    ServiceRequestRepository,
    StaffUserRepository,
    CheckoutTaskRepository,
    FoodDeliveryTaskRepository,
  ],
  exports: [
    DatabaseService,
    TaskRepository,
    ServiceRequestRepository,
    StaffUserRepository,
    CheckoutTaskRepository,
    FoodDeliveryTaskRepository,
  ],
})
export class DatabaseModule {}
