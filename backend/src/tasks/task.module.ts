import { Module } from '@nestjs/common';
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
  controllers: [TaskController, FrontDeskAssignmentController],
  providers: [TaskService, TaskEscalationService, FrontDeskServiceGuard],
})
export class TaskModule {}
