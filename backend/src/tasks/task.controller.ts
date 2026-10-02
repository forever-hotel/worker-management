import {
  Controller,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentWorker } from '../auth/decorators/current-worker.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkerRoleGuard } from '../auth/guards/worker-role.guard';
import type { AuthenticatedWorker } from '../auth/types/authenticated-worker';
import { TaskService } from './task.service';

@Controller('wkms/tasks')
@UseGuards(
    JwtAuthGuard,
    WorkerRoleGuard,
)
export class TaskController {
  constructor(
      private readonly taskService: TaskService,
  ) {}

  @Get('queue')
  async getQueue() {
    return this.taskService.getQueue();
  }

  @Post(':taskId/claim')
  async claimTask(
      @Param('taskId') taskId: string,
      @CurrentWorker()
      worker: AuthenticatedWorker | undefined,
  ) {
    if (!worker) {
      throw new UnauthorizedException(
          'Authenticated worker identity is required',
      );
    }

    return this.taskService.claimTask(
        taskId,
        worker.worker_id,
    );
  }
}