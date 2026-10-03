import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

export type CompletedTaskSummaryRecord = {
    task_id: string;
    room_number: string;
    category: string;
    priority: string;
    submitted_at: Date | string;
    completed_at: Date | string;
};

@Injectable()
export class TaskRepository {
  constructor(private readonly databaseService: DatabaseService) {}

    async findAll() {
        const result = await this.databaseService.query(
            `SELECT *
             FROM wkms_tasks
             WHERE status IN ($1, $2)
             ORDER BY submitted_at ASC`,
            [
                'UNASSIGNED',
                'ESCALATED',
            ],
        );

        return result.rows;
    }

  async findMyActiveTasks(workerId: string) {
    const result = await this.databaseService.query(
        `SELECT *
       FROM wkms_tasks
       WHERE assigned_worker_id = $1
         AND status IN ($2, $3)
       ORDER BY submitted_at ASC`,
        [
          workerId,
          'ASSIGNED',
          'IN_PROGRESS',
        ],
    );

    return result.rows;
  }

    async findById(taskId: string) {
        const result = await this.databaseService.query(
            `SELECT *
     FROM wkms_tasks
     WHERE task_id = $1`,
            [taskId],
        );

        return result.rows[0] ?? null;
    }

    async escalateOverdueTasks() {
        const result = await this.databaseService.query(
            `UPDATE wkms_tasks
       SET status = $1,
           updated_at = NOW()
       WHERE status = $2
         AND submitted_at <= NOW() - INTERVAL '15 minutes'
       RETURNING *`,
            [
                'ESCALATED',
                'UNASSIGNED',
            ],
        );

        return result.rows;
    }

    async countActiveTasks(
        workerId: string,
    ): Promise<number> {
        const result =
            await this.databaseService.query<{
                count: number;
            }>(
                `SELECT COUNT(*)::int AS count
           FROM wkms_tasks
           WHERE assigned_worker_id = $1
             AND status IN ($2, $3)`,
                [
                    workerId,
                    'ASSIGNED',
                    'IN_PROGRESS',
                ],
            );

        return Number(
            result.rows[0]?.count ?? 0,
        );
    }

    async countAvailableEscalatedTasks():
        Promise<number> {
        const result =
            await this.databaseService.query<{
                count: number;
            }>(
                `SELECT COUNT(*)::int AS count
           FROM wkms_tasks
           WHERE status = $1
             AND assigned_worker_id IS NULL`,
                [
                    'ESCALATED',
                ],
            );

        return Number(
            result.rows[0]?.count ?? 0,
        );
    }

    async findCompletedTasksForWindow(
        workerId: string,
        startAt: Date,
        endAt: Date,
    ): Promise<
        CompletedTaskSummaryRecord[]
    > {
        const result =
            await this.databaseService
                .query<CompletedTaskSummaryRecord>(
                    `SELECT
                   task_id,
                   room_number,
                   category,
                   priority,
                   submitted_at,
                   completed_at
               FROM wkms_tasks
               WHERE assigned_worker_id = $1
                 AND status = $2
                 AND completed_at >= $3
                 AND completed_at < $4
               ORDER BY completed_at DESC`,
                    [
                        workerId,
                        'COMPLETED',
                        startAt,
                        endAt,
                    ],
                );

        return result.rows;
    }

  async claimTask(taskId: string, workerId: string) {
    return this.databaseService.withTransaction(async (client) => {
      const workerResult = await client.query(
          `SELECT worker_id
         FROM staff_users
         WHERE worker_id = $1
           AND role = $2
           AND is_active = TRUE
         FOR UPDATE`,
          [workerId, 'WORKER'],
      );

      if (workerResult.rowCount === 0) {
        throw new Error('WORKER_NOT_FOUND_OR_INACTIVE');
      }

      const activeTasksResult = await client.query(
          `SELECT COUNT(*)::int AS count
         FROM wkms_tasks
         WHERE assigned_worker_id = $1
           AND status IN ($2, $3)`,
          [
            workerId,
            'ASSIGNED',
            'IN_PROGRESS',
          ],
      );

      const activeTaskCount = Number(
          activeTasksResult.rows[0].count,
      );

      if (activeTaskCount >= 3) {
        throw new Error('ACTIVE_TASK_LIMIT_REACHED');
      }

      const taskResult = await client.query(
          `SELECT task_id, status
         FROM wkms_tasks
         WHERE task_id = $1
         FOR UPDATE`,
          [taskId],
      );

      if (taskResult.rowCount === 0) {
        throw new Error('TASK_NOT_FOUND');
      }

        const taskStatus =
            taskResult.rows[0].status;

        if (
            taskStatus !== 'UNASSIGNED' &&
            taskStatus !== 'ESCALATED'
        ) {
            throw new Error('TASK_NOT_AVAILABLE');
        }

      const updateResult = await client.query(
          `UPDATE wkms_tasks
         SET status = $1,
             assigned_worker_id = $2,
             updated_at = NOW()
         WHERE task_id = $3
         RETURNING *`,
          [
            'ASSIGNED',
            workerId,
            taskId,
          ],
      );

      return updateResult.rows[0];
    });
  }

  async startTask(
      taskId: string,
      workerId: string,
  ) {
    return this.databaseService.withTransaction(
        async (client) => {
          const taskResult = await client.query(
              `SELECT
             task_id,
             status,
             assigned_worker_id
           FROM wkms_tasks
           WHERE task_id = $1
           FOR UPDATE`,
              [taskId],
          );

          if (taskResult.rowCount === 0) {
            throw new Error('TASK_NOT_FOUND');
          }

          const task = taskResult.rows[0];

          if (
              task.assigned_worker_id !== workerId
          ) {
            throw new Error('TASK_NOT_OWNED');
          }

          if (task.status !== 'ASSIGNED') {
            throw new Error('INVALID_TASK_STATUS');
          }

          const updateResult =
              await client.query(
                  `UPDATE wkms_tasks
             SET status = $1,
                 updated_at = NOW()
             WHERE task_id = $2
             RETURNING *`,
                  [
                    'IN_PROGRESS',
                    taskId,
                  ],
              );

          return updateResult.rows[0];
        },
    );
  }

  async completeTask(
      taskId: string,
      workerId: string,
  ) {
    return this.databaseService.withTransaction(
        async (client) => {
          const taskResult = await client.query(
              `SELECT
             task_id,
             status,
             assigned_worker_id
           FROM wkms_tasks
           WHERE task_id = $1
           FOR UPDATE`,
              [taskId],
          );

          if (taskResult.rowCount === 0) {
            throw new Error('TASK_NOT_FOUND');
          }

          const task = taskResult.rows[0];

          if (
              task.assigned_worker_id !== workerId
          ) {
            throw new Error('TASK_NOT_OWNED');
          }

          if (task.status !== 'IN_PROGRESS') {
            throw new Error('INVALID_TASK_STATUS');
          }

          const updateResult =
              await client.query(
                  `UPDATE wkms_tasks
             SET status = $1,
                 completed_at = NOW(),
                 updated_at = NOW()
             WHERE task_id = $2
             RETURNING *`,
                  [
                    'COMPLETED',
                    taskId,
                  ],
              );

          return updateResult.rows[0];
        },
    );
  }
}