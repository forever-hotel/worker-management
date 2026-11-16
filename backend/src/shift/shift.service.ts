import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { StaffUserRepository } from '../database/repositories/staff-user.repository';
import {
    CompletedTaskSummaryRecord,
    TaskRepository,
} from '../database/repositories/task.repository';

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY =
    24 * 60 * 60 * 1000;

@Injectable()
export class ShiftService {
    constructor(
        private readonly staffUserRepository:
        StaffUserRepository,
        private readonly taskRepository:
        TaskRepository,
    ) {}

    async getSummary(
        workerId: string,
    ) {
        const {
            startAt,
            endAt,
        } = this.getOperationalDayWindow();

        const [
            worker,
            activeTaskCount,
            availableEscalatedTaskCount,
            completedTasks,
        ] = await Promise.all([
            this.staffUserRepository
                .findSummaryById(workerId),

            this.taskRepository
                .countActiveTasks(workerId),

            this.taskRepository
                .countAvailableEscalatedTasks(),

            this.taskRepository
                .findCompletedTasksForWindow(
                    workerId,
                    startAt,
                    endAt,
                ),
        ]);

        if (!worker) {
            throw new NotFoundException(
                'Worker not found or inactive',
            );
        }

        const completedTaskHistory =
            completedTasks.map(
                (task) =>
                    this.mapCompletedTask(task),
            );

        const totalTurnaroundSeconds =
            completedTaskHistory.reduce(
                (
                    total,
                    task,
                ) =>
                    total +
                    task.turnaround_seconds,
                0,
            );

        const averageTaskTurnaroundSeconds =
            completedTaskHistory.length > 0
                ? Math.round(
                    totalTurnaroundSeconds /
                    completedTaskHistory.length,
                )
                : null;

        return {
            operational_day: {
                timezone: 'UTC',
                start_at:
                    startAt.toISOString(),
                end_at:
                    endAt.toISOString(),
            },

            worker: {
                worker_id:
                worker.worker_id,
                full_name:
                worker.full_name,
                vocation:
                worker.vocation,
            },

            active_task_count:
            activeTaskCount,

            completed_task_count:
            completedTaskHistory.length,

            available_escalated_task_count:
            availableEscalatedTaskCount,

            average_task_turnaround_seconds:
            averageTaskTurnaroundSeconds,

            completed_tasks:
            completedTaskHistory,
        };
    }

    private getOperationalDayWindow() {
        const now = new Date();

        const startAt =
            new Date(
                Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate(),
                ),
            );

        const endAt =
            new Date(
                startAt.getTime() +
                MILLISECONDS_PER_DAY,
            );

        return {
            startAt,
            endAt,
        };
    }

    private mapCompletedTask(
        task: CompletedTaskSummaryRecord,
    ) {
        const submittedAt =
            new Date(task.submitted_at);

        const completedAt =
            new Date(task.completed_at);

        const turnaroundSeconds =
            Math.round(
                (
                    completedAt.getTime() -
                    submittedAt.getTime()
                ) /
                MILLISECONDS_PER_SECOND,
            );

        return {
            task_id:
            task.task_id,

            room_number:
            task.room_number,

            category:
            task.category,

            priority:
            task.priority,

            submitted_at:
                submittedAt.toISOString(),

            completed_at:
                completedAt.toISOString(),

            turnaround_seconds:
            turnaroundSeconds,
        };
    }
}