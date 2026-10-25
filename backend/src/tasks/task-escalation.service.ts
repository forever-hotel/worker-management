import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TaskRepository } from '../database/repositories/task.repository';
import { WkmsRealtimeGateway } from '../realtime/wkms-realtime.gateway';

@Injectable()
export class TaskEscalationService {
  private readonly logger = new Logger(TaskEscalationService.name);

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly realtimeGateway: WkmsRealtimeGateway,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processOverdueTasks(): Promise<void> {
    const newlyEscalatedTasks =
      await this.taskRepository.escalateOverdueTasks();

    if (newlyEscalatedTasks.length === 0) {
      return;
    }

    this.logger.log(
      `Escalated ${newlyEscalatedTasks.length} task(s) and saved their outbox events`,
    );

    for (const task of newlyEscalatedTasks) {
      this.realtimeGateway.emitTaskEscalated(task.task_id);
    }
  }
}
