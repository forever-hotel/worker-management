import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TaskRepository } from '../database/repositories/task.repository';

@Injectable()
export class TaskEscalationService {
  private readonly logger = new Logger(TaskEscalationService.name);

  constructor(private readonly taskRepository: TaskRepository) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processOverdueTasks(): Promise<void> {
    const newlyEscalatedTasks =
      await this.taskRepository.escalateOverdueTasks();

    if (newlyEscalatedTasks.length > 0) {
      this.logger.log(
        `Escalated ${newlyEscalatedTasks.length} task(s) and saved their outbox events`,
      );
    }
  }
}
