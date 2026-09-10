import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../database/task.repository';

@Injectable()
export class TaskService {
  constructor(private readonly taskRepository: TaskRepository) {}

  async getQueue() {
    return this.taskRepository.findAll();
  }
}
