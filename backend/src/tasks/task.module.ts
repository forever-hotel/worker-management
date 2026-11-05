import { Module } from '@nestjs/common';
import { FrontDeskTaskService } from './front-desk-task.service';
import { FrontDeskTaskController } from './front-desk-task.controller';
import { ServiceRequestConsumer } from '../messaging/consumers/service-request.consumer';
import { AuthModule } from '../auth/auth.module';
import { FrontDeskServiceGuard } from '../auth/guards/front-desk-service.guard';
import { MessagingModule } from '../messaging/messaging.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { FrontDeskAssignmentController } from './front-desk-assignment.controller';
import { TaskController } from './task.controller';
import { TaskEscalationService } from './task-escalation.service';
import { TaskService } from './task.service';

@Module({
  imports: [AuthModule, MessagingModule, RealtimeModule],
  controllers: [
    TaskController,
    FrontDeskAssignmentController,
    FrontDeskTaskController,
  ],
  providers: [
    FrontDeskTaskService,
    ServiceRequestConsumer,
    TaskService,
    TaskEscalationService,
    FrontDeskServiceGuard,
  ],
})
export class TaskModule {}
