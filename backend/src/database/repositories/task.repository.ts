import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import {
  TaskEscalationCategory,
  TaskEscalationPriority,
} from '../../messaging/contracts/task-escalated.event';
import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
  RABBITMQ_TOPOLOGY,
} from '../../messaging/messaging.constants';
import { appendTaskAudit } from './task-audit.repository';
import { PoolClient } from 'pg';

// DDP-200: shared capacity policy source for worker claims and FDS assignments.
const CAPACITY_POLICY_SQL = `
  COALESCE(
    (SELECT max_active_tasks FROM wkms_task_policy WHERE singleton = TRUE FOR SHARE),
    3
  )::int AS max_active_tasks`;

import {
  executeWithTaskActionReceipt,
  TaskActionReceiptInput,
} from './task-action-idempotency';

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
      ['UNASSIGNED', 'ESCALATED'],
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
      [workerId, 'ASSIGNED', 'IN_PROGRESS'],
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
    const result = await this.databaseService.query<{
      task_id: string;
      category: TaskEscalationCategory;
      room_number: string;
      priority: TaskEscalationPriority;
      updated_at: Date | string;
    }>(
      `WITH newly_escalated AS (
      UPDATE wkms_tasks
      SET status = $1,
          updated_at = NOW()
      WHERE status = $2
        AND submitted_at <= NOW() - INTERVAL '15 minutes'
        RETURNING *
        ),
        stored_events AS (
      INSERT INTO wkms_event_outbox (
        event_id,
        task_id,
        event_type,
        routing_key,
        payload
      )
      SELECT
        'escalation:' || task_id::text,
        task_id,
        'task.escalated',
        'wkms.task.escalated.v1',
        jsonb_build_object(
        'eventId', 'escalation:' || task_id::text,
        'eventType', 'task.escalated',
        'eventVersion', 1,
        'occurredAt',
        to_char(
        updated_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'source', 'worker-management',
        'data', jsonb_build_object(
        'taskId', task_id::text,
        'taskCategory', category::text,
        'roomNumber', room_number,
        'priority', priority::text,
        'escalatedAt',
        to_char(
        updated_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
        )
        )
      FROM newly_escalated
        RETURNING task_id
        ),
        audited_events AS (
      INSERT INTO audit_logs (
        event_category,
        actor_type,
        action,
        entity_type,
        entity_id,
        details
      )
      SELECT
        'TASK_SERVICE',
        'SYSTEM',
        'TASK_ESCALATED',
        'WKMS_TASK',
        e.task_id::text,
        jsonb_build_object(
        'previousStatus', 'UNASSIGNED',
        'newStatus', 'ESCALATED',
        'previousWorkerId', NULL,
        'newWorkerId', NULL
        )
      FROM newly_escalated AS e
        JOIN stored_events AS s
      ON s.task_id = e.task_id
        RETURNING entity_id
        )
      SELECT e.*
      FROM newly_escalated AS e
             JOIN stored_events AS s
                  ON s.task_id = e.task_id
             JOIN audited_events AS a
                  ON a.entity_id = e.task_id::text`,
      ['ESCALATED', 'UNASSIGNED'],
    );

    return result.rows;
  }

  async countActiveTasks(workerId: string): Promise<number> {
    const result = await this.databaseService.query<{
      count: number;
    }>(
      `SELECT COUNT(*)::int AS count
       FROM wkms_tasks
       WHERE assigned_worker_id = $1
         AND status IN ($2, $3)`,
      [workerId, 'ASSIGNED', 'IN_PROGRESS'],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  /** Authoritative active capacity for an authenticated worker (DDP-200). */
  async getTaskCapacity(workerId: string) {
    const result = await this.databaseService.query<{
      active_task_count: number;
      max_active_tasks: number;
    }>(
      `SELECT COUNT(*)::int AS active_task_count,
              COALESCE((SELECT max_active_tasks
                        FROM wkms_task_policy WHERE singleton = TRUE), 3)::int AS max_active_tasks
       FROM wkms_tasks
       WHERE assigned_worker_id = $1
         AND status IN ('ASSIGNED', 'IN_PROGRESS')`,
      [workerId],
    );
    const activeTaskCount = Number(result.rows[0]?.active_task_count ?? 0);
    const maxActiveTasks = Number(result.rows[0]?.max_active_tasks ?? 3);
    return {
      activeTaskCount,
      maxActiveTasks,
      remainingCapacity: Math.max(0, maxActiveTasks - activeTaskCount),
    };
  }

  /**
   * List active WKMS workers with spare task capacity. This is not
   * an attendance, shift-presence, or vocation-compatibility claim.
   */
  async findEligibleWorkers() {
    type WorkerRow = {
      worker_id: string;
      full_name: string;
      vocation: string | null;
      active_task_count: number;
      max_active_tasks: number;
    };
    const result = await this.databaseService.query<WorkerRow>(
      `WITH policy AS (
         SELECT COALESCE((SELECT max_active_tasks
                          FROM public.wkms_task_policy
                          WHERE singleton = TRUE), 3)::int AS max_active_tasks
       ), workload AS (
         SELECT assigned_worker_id, COUNT(*)::int AS active_task_count
         FROM public.wkms_tasks
         WHERE assigned_worker_id IS NOT NULL
           AND status IN ('ASSIGNED', 'IN_PROGRESS')
         GROUP BY assigned_worker_id
       )
       SELECT s.worker_id, s.full_name, s.vocation,
              COALESCE(w.active_task_count, 0)::int AS active_task_count,
              p.max_active_tasks
       FROM public.staff_users s
       CROSS JOIN policy p
       LEFT JOIN workload w ON w.assigned_worker_id = s.worker_id
       WHERE s.role = 'WORKER'
         AND s.is_active = TRUE
         AND COALESCE(w.active_task_count, 0) < p.max_active_tasks
       ORDER BY COALESCE(w.active_task_count, 0) ASC,
                s.full_name ASC, s.worker_id ASC`,
    );
    return result.rows.map((worker) => {
      const activeTaskCount = Number(worker.active_task_count);
      const maxActiveTasks = Number(worker.max_active_tasks);
      return {
        workerId: worker.worker_id,
        fullName: worker.full_name,
        vocation: worker.vocation,
        activeTaskCount,
        maxActiveTasks,
        remainingCapacity: Math.max(0, maxActiveTasks - activeTaskCount),
      };
    });
  }

  async countAvailableEscalatedTasks(): Promise<number> {
    const result = await this.databaseService.query<{
      count: number;
    }>(
      `SELECT COUNT(*)::int AS count
       FROM wkms_tasks
       WHERE status = $1
         AND assigned_worker_id IS NULL`,
      ['ESCALATED'],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async findCompletedTasksForWindow(
    workerId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<CompletedTaskSummaryRecord[]> {
    const result = await this.databaseService.query<CompletedTaskSummaryRecord>(
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
      [workerId, 'COMPLETED', startAt, endAt],
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
        `SELECT COUNT(*)::int AS count,
         ${CAPACITY_POLICY_SQL}
         FROM wkms_tasks
         WHERE assigned_worker_id = $1
           AND status IN ($2, $3)`,
        [workerId, 'ASSIGNED', 'IN_PROGRESS'],
      );

      const activeTaskCount = Number(activeTasksResult.rows[0].count);

      if (activeTaskCount >= Number(activeTasksResult.rows[0]?.max_active_tasks ?? 3)) {
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

      const taskStatus = taskResult.rows[0].status;

      if (taskStatus !== 'UNASSIGNED' && taskStatus !== 'ESCALATED') {
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

      await appendTaskAudit(client, {
        taskId,
        action: 'TASK_CLAIMED',
        actor: {
          type: 'STAFF',
          workerId,
        },
        previousStatus: taskStatus,
        newStatus: 'ASSIGNED',
        previousWorkerId: null,
        newWorkerId: workerId,
      });

      return updateResult.rows[0];
    });
  }

  async manuallyAssignTask(taskId: string, workerId: string) {
    return this.databaseService.withTransaction(async (client) => {
      // Lock the worker first, matching the existing claimTask lock order.
      // This serializes concurrent assignments to the same worker.
      const workerResult = await client.query(
        `SELECT worker_id
         FROM staff_users
         WHERE worker_id = $1
           AND role = 'WORKER'
           AND is_active = TRUE
         FOR UPDATE`,
        [workerId],
      );

      if (workerResult.rowCount === 0) {
        throw new Error('WORKER_NOT_FOUND_OR_INACTIVE');
      }

      // The row lock above protects this active-task count against
      // other assignments using the same worker-locking protocol.
      const activeTasksResult = await client.query(
        `SELECT COUNT(*)::int AS count,
         ${CAPACITY_POLICY_SQL}
         FROM wkms_tasks
         WHERE assigned_worker_id = $1
           AND status IN ('ASSIGNED', 'IN_PROGRESS')`,
        [workerId],
      );

      const activeCount = Number(activeTasksResult.rows[0]?.count ?? 0);

      if (activeCount >= Number(activeTasksResult.rows[0]?.max_active_tasks ?? 3)) {
        throw new Error('ACTIVE_TASK_LIMIT_REACHED');
      }

      // Lock the task to prevent a concurrent worker claim or
      // another manual assignment from changing its ownership.
      const taskResult = await client.query(
        `SELECT task_id, status, assigned_worker_id
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
        (task.status !== 'UNASSIGNED' && task.status !== 'ESCALATED') ||
        task.assigned_worker_id !== null
      ) {
        throw new Error('TASK_NOT_AVAILABLE');
      }

      const updateResult = await client.query(
        `UPDATE wkms_tasks
         SET status = 'ASSIGNED',
             assigned_worker_id = $1,
             updated_at = NOW()
         WHERE task_id = $2
           AND status IN ('UNASSIGNED', 'ESCALATED')
           AND assigned_worker_id IS NULL
         RETURNING *`,
        [workerId, taskId],
      );

      const assignedTask = updateResult.rows[0];

      if (!assignedTask) {
        throw new Error('TASK_NOT_AVAILABLE');
      }

      // The trusted FDS backend initiates this action.
      // SYSTEM records a service-originated assignment,
      // not a claim that the target worker performed it.
      await appendTaskAudit(client, {
        taskId,
        action: 'TASK_MANUALLY_ASSIGNED',
        actor: { type: 'SYSTEM' },
        previousStatus: task.status,
        newStatus: 'ASSIGNED',
        previousWorkerId: null,
        newWorkerId: workerId,
      });

      // Transaction commits only when assignment and audit succeed.
      return assignedTask;
    });
  }

  async startTask(taskId: string, workerId: string) {
    return this.databaseService.withTransaction((client) =>
      this.startTaskInTransaction(client, taskId, workerId),
    );
  }

  /**
   * Performs START using the caller's existing transaction.
   *
   * The normal startTask() method still opens its own transaction.
   * DDP-199 will use this method to execute a task transition and
   * its idempotency receipt atomically.
   *
   * Do not call this method outside an active transaction.
   */
  async startTaskInTransaction(
    client: PoolClient,
    taskId: string,
    workerId: string,
  ) {
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

    if (task.assigned_worker_id !== workerId) {
      throw new Error('TASK_NOT_OWNED');
    }

    if (task.status !== 'ASSIGNED') {
      throw new Error('INVALID_TASK_STATUS');
    }

    const updateResult = await client.query(
      `UPDATE wkms_tasks
       SET status = $1,
           updated_at = NOW()
       WHERE task_id = $2
       RETURNING *`,
      ['IN_PROGRESS', taskId],
    );

    await appendTaskAudit(client, {
      taskId,
      action: 'TASK_STARTED',
      actor: {
        type: 'STAFF',
        workerId,
      },
      previousStatus: task.status,
      newStatus: 'IN_PROGRESS',
      previousWorkerId: workerId,
      newWorkerId: workerId,
    });

    return updateResult.rows[0];
  }

  async completeTask(taskId: string, workerId: string) {
    return this.databaseService.withTransaction((client) =>
      this.completeTaskInTransaction(client, taskId, workerId),
    );
  }

  /**
   * Completes a task using the caller's PostgreSQL transaction.
   * The task update, audit entry and completion outbox event
   * must all commit or roll back together.
   */
  async completeTaskInTransaction(
    client: PoolClient,
    taskId: string,
    workerId: string,
  ) {
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

    if (task.assigned_worker_id !== workerId) {
      throw new Error('TASK_NOT_OWNED');
    }

    if (task.status !== 'IN_PROGRESS') {
      throw new Error('INVALID_TASK_STATUS');
    }

    // All three operations below share the same transaction:
    // 1. Complete the task.
    // 2. Save the audit record.
    // 3. Save the durable completion event.
    const updateResult = await client.query(
      `UPDATE wkms_tasks
         SET status = $1,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE task_id = $2
         RETURNING *`,
      ['COMPLETED', taskId],
    );

    const completedTask = updateResult.rows[0];

    if (!completedTask) {
      throw new Error('TASK_COMPLETION_UPDATE_FAILED');
    }

    await appendTaskAudit(client, {
      taskId,
      action: 'TASK_COMPLETED',
      actor: {
        type: 'STAFF',
        workerId,
      },
      previousStatus: task.status,
      newStatus: 'COMPLETED',
      previousWorkerId: workerId,
      newWorkerId: workerId,
    });

    const eventId = `completion:${taskId}`;

    // Persist the event before committing the transaction.
    // A stable event ID supports consumer-side deduplication.
    await client.query(
      `INSERT INTO wkms_event_outbox (
           event_id,
           task_id,
           event_type,
           routing_key,
           payload
         )
         VALUES (
           $1,
           $2::uuid,
           $3::text,
           $4,
           jsonb_build_object(
             'eventId', $1::text,
             'eventType', $3::text,
             'eventVersion', $5::integer,
             'occurredAt',
             to_char(
               $6::timestamptz AT TIME ZONE 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
             ),
             'source', $7::text,
             'data', jsonb_build_object(
               'taskId', $2::text,
               'workerId', $8::text,
               'taskCategory', $9::text,
               'roomNumber', $10::text,
               'priority', $11::text,
               'completedAt',
               to_char(
                 $6::timestamptz AT TIME ZONE 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
               )
             )
           )
         )`,
      [
        eventId,
        taskId,
        MESSAGE_EVENT_TYPES.taskCompleted,
        RABBITMQ_TOPOLOGY.routingKeys.taskCompleted,
        MESSAGE_EVENT_VERSIONS.taskCompleted,
        completedTask.completed_at,
        MESSAGE_SOURCES.workerManagement,
        workerId,
        completedTask.category,
        completedTask.room_number,
        completedTask.priority,
      ],
    );

    // The dispatcher publishes this persisted event after COMMIT.
    // If auditing or outbox insertion fails, completion rolls back.
    return completedTask;
  }

  /**
   * Execute START or COMPLETE with a durable idempotency receipt.
   *
   * Both the receipt and lifecycle operations use the same
   * PostgreSQL transaction.
   *
   * Returning replayed=true means the original operation
   * was already committed and its stored result is returned.
   */
  async executeIdempotentTaskAction(input: TaskActionReceiptInput) {
    return this.databaseService.withTransaction((client) =>
      executeWithTaskActionReceipt(client, input, async () => {
        if (input.action === 'START') {
          return this.startTaskInTransaction(
            client,
            input.taskId,
            input.workerId,
          );
        }

        return this.completeTaskInTransaction(
          client,
          input.taskId,
          input.workerId,
        );
      }),
    );
  }


  /**
   * Look up a committed offline action receipt.
   *
   * A receipt is visible only to its original authenticated
   * worker and for its original task.
   *
   * This is read-only and never retries a task mutation.
   */
  async findTaskActionReceipt(input: {
    requestId: string;
    taskId: string;
    workerId: string;
  }) {
    const result = await this.databaseService.query<{
      action: 'START' | 'COMPLETE';
      response_body: unknown;
    }>(
        `SELECT action, response_body
       FROM wkms_task_action_receipts
       WHERE request_id = $1::uuid
         AND task_id = $2::uuid
         AND worker_id = $3::uuid`,
        [
          input.requestId,
          input.taskId,
          input.workerId,
        ],
    );

    return result.rows[0] ?? null;
  }

}
