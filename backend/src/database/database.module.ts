import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TaskRepository } from './repositories/task.repository';
import { ServiceRequestRepository } from './repositories/service-request.repository';

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
