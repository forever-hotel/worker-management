import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskRepository } from '../database/task.repository';

@Injectable()
export class TaskService {
  constructor(private readonly taskRepository: TaskRepository) {}

  async getQueue() {
    return this.taskRepository.findAll();
  }

  async claimTask(taskId: string, workerId: string) {
    try {
      return await this.taskRepository.claimTask(taskId, workerId);
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
            'Worker already has the maximum of three active tasks',
          );

        case 'TASK_NOT_AVAILABLE':
          throw new ConflictException('Task is no longer available');

        default:
          throw error;
      }
    }
  }
}
