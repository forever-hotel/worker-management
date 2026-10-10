import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskEscalationService } from './task-escalation.service';

@Module({
  imports: [AuthModule, MessagingModule],
  controllers: [TaskController],
  providers: [TaskService, TaskEscalationService],
})
export class TaskModule {}
