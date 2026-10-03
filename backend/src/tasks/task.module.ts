import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import {TaskEscalationService} from "./task-escalation.service";

@Module({
  imports: [AuthModule],
  controllers: [TaskController],
  providers: [
      TaskService,
      TaskEscalationService,
  ],
})
export class TaskModule {}