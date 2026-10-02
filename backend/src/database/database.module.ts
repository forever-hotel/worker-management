import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
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
  ],
  exports: [
    DatabaseService,
    TaskRepository,
    ServiceRequestRepository,
    StaffUserRepository,
  ],
})
export class DatabaseModule {}