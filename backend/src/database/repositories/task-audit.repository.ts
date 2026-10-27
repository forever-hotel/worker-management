import type { PoolClient } from 'pg';

export type TaskAuditAction =
  | 'TASK_CREATED'
  | 'TASK_CLAIMED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_ESCALATED'
  | 'TASK_MANUALLY_ASSIGNED';

type TaskAuditInput = {
  taskId: string;
  action: TaskAuditAction;
  actor: { type: 'STAFF'; workerId: string } | { type: 'SYSTEM' };
  previousStatus: string | null;
  newStatus: string;
  previousWorkerId?: string | null;
  newWorkerId?: string | null;
};

export async function appendTaskAudit(
  client: Pick<PoolClient, 'query'>,
  input: TaskAuditInput,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (
       event_category,
       actor_type,
       staff_user_id,
       action,
       entity_type,
       entity_id,
       details
     )
     VALUES (
       'TASK_SERVICE',
       $1,
       $2,
       $3,
       'WKMS_TASK',
       $4,
       $5::jsonb
     )`,
    [
      input.actor.type,
      input.actor.type === 'STAFF' ? input.actor.workerId : null,
      input.action,
      input.taskId,
      JSON.stringify({
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        previousWorkerId: input.previousWorkerId ?? null,
        newWorkerId: input.newWorkerId ?? null,
      }),
    ],
  );
}
