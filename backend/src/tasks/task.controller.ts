import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
@UseGuards(JwtAuthGuard, WorkerRoleGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('queue')
  async getQueue() {
    return this.taskService.getQueue();
  }

  @Get('my-tasks')
  async getMyTasks(
    @CurrentWorker()
    worker: AuthenticatedWorker | undefined,
  ) {
    const authenticatedWorker = this.requireWorker(worker);

    return this.taskService.getMyTasks(authenticatedWorker.worker_id);
  }

  @Get(':taskId')
  async getTaskDetail(
    @Param('taskId') taskId: string,
    @CurrentWorker()
    worker: AuthenticatedWorker | undefined,
  ) {
    const authenticatedWorker = this.requireWorker(worker);

    return this.taskService.getTaskDetail(
      taskId,
      authenticatedWorker.worker_id,
    );
  }

  @Post(':taskId/claim')
  async claimTask(
    @Param('taskId') taskId: string,
    @CurrentWorker()
    worker: AuthenticatedWorker | undefined,
  ) {
    const authenticatedWorker = this.requireWorker(worker);

    return this.taskService.claimTask(taskId, authenticatedWorker.worker_id);
  }

  @Post(':taskId/start')
  async startTask(
    @Param('taskId') taskId: string,
    @CurrentWorker()
    worker: AuthenticatedWorker | undefined,
  ) {
    const authenticatedWorker = this.requireWorker(worker);

    return this.taskService.startTask(taskId, authenticatedWorker.worker_id);
  }

  @Post(':taskId/complete')
  async completeTask(
    @Param('taskId') taskId: string,
    @CurrentWorker()
    worker: AuthenticatedWorker | undefined,
  ) {
    const authenticatedWorker = this.requireWorker(worker);

    return this.taskService.completeTask(taskId, authenticatedWorker.worker_id);
  }

  /**
   * Check whether a previous offline submission committed.
   *
   * The worker identity is obtained exclusively from the JWT.
   * This endpoint does not mutate task state.
   */
  @Get(':taskId/offline-action/:requestId')
  async getOfflineTaskActionReceipt(
    @Param('taskId', new ParseUUIDPipe())
    taskId: string,

    @Param('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,

    @CurrentWorker()
    worker: AuthenticatedWorker | undefined,
  ) {
    const authenticatedWorker = this.requireWorker(worker);

    return this.taskService.getOfflineTaskActionReceipt(
      taskId,
      requestId,
      authenticatedWorker.worker_id,
    );
  }

  /**
   * Submit a previously queued offline START or COMPLETE.
   *
   * Worker identity always comes from the authenticated JWT,
   * never from the submitted request body.
   */
  @Post(':taskId/offline-action')
  async submitOfflineTaskAction(
    @Param('taskId', new ParseUUIDPipe())
    taskId: string,

    @Body('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,

    @Body('action')
    action: unknown,

    @CurrentWorker()
    worker: AuthenticatedWorker | undefined,
  ) {
    const authenticatedWorker = this.requireWorker(worker);

    return this.taskService.submitOfflineTaskAction({
      requestId,
      taskId,
      workerId: authenticatedWorker.worker_id,
      action,
    });
  }

  private requireWorker(
    worker: AuthenticatedWorker | undefined,
  ): AuthenticatedWorker {
    if (!worker) {
      throw new UnauthorizedException(
        'Authenticated worker identity is required',
      );
    }

    return worker;
  }
}