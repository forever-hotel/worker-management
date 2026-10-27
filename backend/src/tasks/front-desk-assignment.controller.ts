import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FrontDeskServiceGuard } from '../auth/guards/front-desk-service.guard';
import { TaskService } from './task.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('wkms/tasks')
@UseGuards(FrontDeskServiceGuard)
export class FrontDeskAssignmentController {
  constructor(private readonly taskService: TaskService) {}

  @Post(':taskId/manual-assign')
  async manuallyAssignTask(
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    if (typeof taskId !== 'string' || !UUID_PATTERN.test(taskId)) {
      throw new BadRequestException('Invalid taskId');
    }

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('A valid assignment request is required');
    }

    const workerId = (body as Record<string, unknown>).workerId;

    if (typeof workerId !== 'string' || !UUID_PATTERN.test(workerId)) {
      throw new BadRequestException('A valid workerId is required');
    }

    return this.taskService.manuallyAssignTask(taskId, workerId);
  }
}
