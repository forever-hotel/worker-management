import type { PoolClient } from 'pg';

export type IdempotentTaskAction = 'START' | 'COMPLETE';

export type TaskActionReceiptInput = {
  requestId: string;
  workerId: string;
  taskId: string;
  action: IdempotentTaskAction;
};

export type TaskActionReceiptResult<T> = {
  result: T;
  replayed: boolean;
};

type StoredReceipt = {
  worker_id: string;
  task_id: string;
  action: string;
  response_body: unknown;
};

/**
 * Execute a task transition with a durable idempotency receipt.
 *
 * IMPORTANT:
 * The caller must run this function inside an active
 * PostgreSQL transaction using DatabaseService.withTransaction().
 *
 * The task transition, audit records, outbox records and
 * receipt must all use the supplied transaction client.
 *
 * Never call a task method that opens another transaction
 * from inside the performAction callback.
 */
export async function executeWithTaskActionReceipt<
  T extends Record<string, unknown>,
>(
  client: PoolClient,
  input: TaskActionReceiptInput,
  performAction: () => Promise<T>,
): Promise<TaskActionReceiptResult<T>> {
  const { requestId, workerId, taskId, action } = input;

  // The unique request_id prevents two transactions from
  // independently accepting the same operation.
  const inserted = await client.query(
    `INSERT INTO wkms_task_action_receipts (
       request_id,
       worker_id,
       task_id,
       action,
       response_body
     )
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, NULL)
     ON CONFLICT (request_id) DO NOTHING
     RETURNING request_id`,
    [requestId, workerId, taskId, action],
  );

  if (inserted.rowCount === 0) {
    // PostgreSQL resolves the unique-key conflict against
    // the other transaction before this query continues.
    const existingResult = await client.query(
      `SELECT
         worker_id::text AS worker_id,
         task_id::text AS task_id,
         action,
         response_body
       FROM wkms_task_action_receipts
       WHERE request_id = $1::uuid
       FOR UPDATE`,
      [requestId],
    );

    const existing = existingResult.rows[0] as StoredReceipt | undefined;

    if (!existing) {
      throw new Error('TASK_ACTION_RECEIPT_NOT_FOUND');
    }

    // A request ID belongs to exactly one worker,
    // one task and one type of operation.
    if (
      existing.worker_id !== workerId ||
      existing.task_id !== taskId ||
      existing.action !== action
    ) {
      throw new Error('TASK_ACTION_IDEMPOTENCY_CONFLICT');
    }

    const storedResponse = existing.response_body;

    if (
      !storedResponse ||
      typeof storedResponse !== 'object' ||
      Array.isArray(storedResponse)
    ) {
      throw new Error('TASK_ACTION_RECEIPT_INCOMPLETE');
    }

    // Never repeat the task transition on a replay.
    return {
      result: storedResponse as T,
      replayed: true,
    };
  }

  // This request ID is new.
  // The supplied callback must use the same transaction.
  const result = await performAction();

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('INVALID_TASK_ACTION_RESULT');
  }

  const saved = await client.query(
    `UPDATE wkms_task_action_receipts
     SET response_body = $2::jsonb
     WHERE request_id = $1::uuid
       AND response_body IS NULL
     RETURNING request_id`,
    [requestId, JSON.stringify(result)],
  );

  if (saved.rowCount !== 1) {
    throw new Error('TASK_ACTION_RECEIPT_SAVE_FAILED');
  }

  return {
    result,
    replayed: false,
  };
}
