import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TaskRepository } from '../database/repositories/task.repository';

const ESCALATION_CHECK_INTERVAL_MS = 60_000;

@Injectable()
export class TaskEscalationService {
    constructor(
        private readonly taskRepository: TaskRepository,
    ) {}

    @Interval(ESCALATION_CHECK_INTERVAL_MS)
    async processOverdueTasks(): Promise<void> {
        await this.taskRepository.escalateOverdueTasks();
    }
}