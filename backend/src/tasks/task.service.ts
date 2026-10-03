import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskRepository } from '../database/repositories/task.repository';

@Injectable()
export class TaskService {
  constructor(
      private readonly taskRepository: TaskRepository,
  ) {}

  async getQueue() {
    return this.taskRepository.findAll();
  }

  async getMyTasks(workerId: string) {
    return this.taskRepository.findMyActiveTasks(
        workerId,
    );
  }

  async getTaskDetail(
      taskId: string,
      workerId: string,
  ) {
    const task =
        await this.taskRepository.findById(
            taskId,
        );

    if (!task) {
      throw new NotFoundException(
          'Task not found',
      );
    }

    const isAvailableTask =
        task.assigned_worker_id == null &&
        (
            task.status === 'UNASSIGNED' ||
            task.status === 'ESCALATED'
        );

    const isOwnedTask =
        task.assigned_worker_id === workerId &&
        (
            task.status === 'ASSIGNED' ||
            task.status === 'IN_PROGRESS' ||
            task.status === 'COMPLETED'
        );

    if (
        !isAvailableTask &&
        !isOwnedTask
    ) {
      throw new ForbiddenException(
          'Task is not available to the authenticated worker',
      );
    }

    return task;
  }

  async claimTask(
      taskId: string,
      workerId: string,
  ) {
    try {
      return await this.taskRepository.claimTask(
          taskId,
          workerId,
      );
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
          throw new NotFoundException(
              'Task not found',
          );

        case 'ACTIVE_TASK_LIMIT_REACHED':
          throw new ConflictException(
              'Worker already has the maximum of three active tasks',
          );

        case 'TASK_NOT_AVAILABLE':
          throw new ConflictException(
              'Task is no longer available',
          );

        default:
          throw error;
      }
    }
  }

  async startTask(
      taskId: string,
      workerId: string,
  ) {
    try {
      return await this.taskRepository.startTask(
          taskId,
          workerId,
      );
    } catch (error) {
      this.handleLifecycleError(error);
    }
  }

  async completeTask(
      taskId: string,
      workerId: string,
  ) {
    try {
      return await this.taskRepository.completeTask(
          taskId,
          workerId,
      );
    } catch (error) {
      this.handleLifecycleError(error);
    }
  }

  private handleLifecycleError(
      error: unknown,
  ): never {
    if (!(error instanceof Error)) {
      throw error;
    }

    switch (error.message) {
      case 'TASK_NOT_FOUND':
        throw new NotFoundException(
            'Task not found',
        );

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