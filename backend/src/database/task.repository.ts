import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class TaskRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const result = await this.databaseService.query(
      `SELECT *
       FROM wkms_tasks
       WHERE status = $1
       ORDER BY submitted_at ASC`,
      ['UNASSIGNED'],
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
      [workerId, 'ASSIGNED', 'IN_PROGRESS'],
    );

    const activeTaskCount = Number(activeTasksResult.rows[0].count);

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

    if (taskResult.rows[0].status !== 'UNASSIGNED') {
      throw new Error('TASK_NOT_AVAILABLE');
    }

    const updateResult = await client.query(
      `UPDATE wkms_tasks
       SET status = $1,
           assigned_worker_id = $2,
           updated_at = NOW()
       WHERE task_id = $3
       RETURNING *`,
      ['ASSIGNED', workerId, taskId],
    );

    return updateResult.rows[0];
  });
}
}
