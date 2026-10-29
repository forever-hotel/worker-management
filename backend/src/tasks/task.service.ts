import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskRepository } from '../database/repositories/task.repository';
import { WkmsRealtimeGateway } from '../realtime/wkms-realtime.gateway';
import { TaskActionReceiptInput } from '../database/repositories/task-action-idempotency';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly realtimeGateway: WkmsRealtimeGateway,
  ) {}

  async getQueue() {
    return this.taskRepository.findAll();
  }

  async getTaskCapacity(workerId: string) {
    return this.taskRepository.getTaskCapacity(workerId);
  }

  async getMyTasks(workerId: string) {
    return this.taskRepository.findMyActiveTasks(workerId);
  }

  async getTaskDetail(taskId: string, workerId: string) {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const isAvailableTask =
      task.assigned_worker_id == null &&
      (task.status === 'UNASSIGNED' || task.status === 'ESCALATED');

    const isOwnedTask =
      task.assigned_worker_id === workerId &&
      (task.status === 'ASSIGNED' ||
        task.status === 'IN_PROGRESS' ||
        task.status === 'COMPLETED');

    if (!isAvailableTask && !isOwnedTask) {
      throw new ForbiddenException(
        'Task is not available to the authenticated worker',
      );
    }

    return task;
  }

  async claimTask(taskId: string, workerId: string) {
    try {
      const claimedTask = await this.taskRepository.claimTask(taskId, workerId);

      // PostgreSQL transaction has committed successfully.
      this.realtimeGateway.emitTaskClaimed(taskId);

      return claimedTask;
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      switch (error.message) {
        case 'WORKER_NOT_FOUND_OR_INACTIVE':
          throw new NotFoundException('Worker not found or inactive');

        case 'TASK_NOT_FOUND':
          throw new NotFoundException('Task not found');

        case 'ACTIVE_TASK_LIMIT_REACHED':
          throw new ConflictException(
            'Worker has reached the configured active-task limit',
          );

        case 'TASK_NOT_AVAILABLE':
          throw new ConflictException('Task is no longer available');

        default:
          throw error;
      }
    }
  }


  async manuallyAssignTask(taskId: string, workerId: string) {
    try {
      const assignedTask =
        await this.taskRepository.manuallyAssignTask(
          taskId,
          workerId,
        );

      // Broadcast only after the transaction has committed.
      // Reuse the existing task.claimed refresh event.
      this.realtimeGateway.emitTaskClaimed(taskId);

      return assignedTask;
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      switch (error.message) {
        case 'WORKER_NOT_FOUND_OR_INACTIVE':
          throw new NotFoundException(
            'Worker not found or inactive',
          );

        case 'TASK_NOT_FOUND':
          throw new NotFoundException('Task not found');

        case 'ACTIVE_TASK_LIMIT_REACHED':
          throw new ConflictException(
            'Worker has reached the configured active-task limit',
          );

        case 'TASK_NOT_AVAILABLE':
          throw new ConflictException(
            'Task is no longer available for assignment',
          );

        default:
          throw error;
      }
    }
  }

  async startTask(taskId: string, workerId: string) {
    try {
      return await this.taskRepository.startTask(taskId, workerId);
    } catch (error) {
      this.handleLifecycleError(error);
    }
  }

  async completeTask(taskId: string, workerId: string) {
    try {
      return await this.taskRepository.completeTask(taskId, workerId);
    } catch (error) {
      this.handleLifecycleError(error);
    }
  }


  /**
   * Retrieve the original result of a committed offline action.
   * Only the authenticated worker can retrieve their receipt.
   */
  async getOfflineTaskActionReceipt(
      taskId: string,
      requestId: string,
      workerId: string,
  ) {
    const receipt =
        await this.taskRepository.findTaskActionReceipt({
          taskId,
          requestId,
          workerId,
        });

    if (!receipt) {
      throw new NotFoundException(
          'Offline action receipt not found',
      );
    }

    if (
        !receipt.response_body ||
        typeof receipt.response_body !== 'object' ||
        Array.isArray(receipt.response_body)
    ) {
      throw new ConflictException(
          'Offline action receipt is incomplete',
      );
    }

    return {
      action: receipt.action,
      task: receipt.response_body,
    };
  }

  /**
   * Submit a queued offline action using an idempotency receipt.
   *
   * Validation happens before any database mutation.
   * The repository performs the transition and receipt write
   * atomically in PostgreSQL.
   */
  async submitOfflineTaskAction(
    input: Omit<TaskActionReceiptInput, 'action'> & {
      action: unknown;
    },
  ) {
    if (input.action !== 'START' && input.action !== 'COMPLETE') {
      throw new BadRequestException(
        'Offline action must be START or COMPLETE',
      );
    }

    try {
      const { result, replayed } =
        await this.taskRepository.executeIdempotentTaskAction({
          requestId: input.requestId,
          taskId: input.taskId,
          workerId: input.workerId,
          action: input.action,
        });

      return {
        task: result,
        replayed,
      };
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'TASK_ACTION_IDEMPOTENCY_CONFLICT':
            throw new ConflictException(
              'Request ID has already been used for another task action',
            );

          case 'TASK_ACTION_RECEIPT_INCOMPLETE':
            throw new ConflictException(
              'The previous request could not be confirmed',
            );
        }
      }

      // Preserve the existing 404, 403 and 409 mappings
      // for lifecycle failures.
      this.handleLifecycleError(error);
    }
  }

  private handleLifecycleError(error: unknown): never {
    if (!(error instanceof Error)) {
      throw error;
    }

    switch (error.message) {
      case 'TASK_NOT_FOUND':
        throw new NotFoundException('Task not found');

      case 'TASK_NOT_OWNED':
        throw new ForbiddenException(
          'Task is not assigned to the authenticated worker',
        );

      case 'INVALID_TASK_STATUS':
        throw new ConflictException(
          'Task cannot be transitioned from its current status',
        );

      default:
        throw error;
    }
  }
}