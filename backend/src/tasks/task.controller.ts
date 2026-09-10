import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TaskService } from './task.service';

interface AuthenticatedRequest extends Request {
  user?: {
    worker_id: string;
  };
}

@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('queue')
  async getQueue() {
    return this.taskService.getQueue();
  }

  @Post(':taskId/claim')
  async claimTask(
    @Param('taskId') taskId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const workerId = request.user?.worker_id;

    if (!workerId) {
      throw new UnauthorizedException(
        'Authenticated worker identity is required',
      );
    }

    return this.taskService.claimTask(taskId, workerId);
  }
}
