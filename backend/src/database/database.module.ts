import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TaskRepository } from './task.repository';
import { ServiceRequestRepository } from './service-request.repository';

@Global()
@Module({
  providers: [
    DatabaseService,
    TaskRepository,
    ServiceRequestRepository,
  ],
  exports: [
    DatabaseService,
    TaskRepository,
    ServiceRequestRepository,
  ],
})
export class DatabaseModule {}
