import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../database.service';
import { TaskRepository } from './task.repository';
import type { IdempotentTaskAction } from './task-action-idempotency';

const TEST_DATABASE_URL =
  'postgresql://wkms_test:wkms_local_test_only@127.0.0.1:55435/wkms_ddp199_test';

const WORKER_ID = '22222222-2222-4222-8222-222222222222';

const postgresDescribe =
  process.env.RUN_WKMS_DDP199_INTEGRATION === '1' ? describe : describe.skip;

postgresDescribe('DDP-199 real PostgreSQL idempotency', () => {
  let database: DatabaseService;
  let repository: TaskRepository;
  let taskId: string;

  beforeAll(async () => {
    const target = new URL(TEST_DATABASE_URL);

    if (
      target.hostname !== '127.0.0.1' ||
      target.port !== '55435' ||
      target.pathname !== '/wkms_ddp199_test'
    ) {
      throw new Error('Unsafe DDP-199 database target');
    }

    database = new DatabaseService({
      get: (key: string) =>
        key === 'DATABASE_URL' ? TEST_DATABASE_URL : undefined,
    } as unknown as ConfigService);

    await database.onModuleInit();

    const identity = await database.query<{
      database_name: string;
    }>('SELECT current_database() AS database_name');

    if (identity.rows[0]?.database_name !== 'wkms_ddp199_test') {
      throw new Error('Unexpected database identity');
    }

    repository = new TaskRepository(database);
  });

  beforeEach(async () => {
    taskId = randomUUID();

    await database.query(
      `INSERT INTO wkms_tasks (
         task_id, room_number, category, priority,
         status, assigned_worker_id, source
       )
       VALUES (
         $1, 'D199', 'ROOM_CLEANING', 'HIGH',
         'ASSIGNED', $2, 'FRONT_DESK'
       )`,
      [taskId, WORKER_ID],
    );
  });

  afterEach(async () => {
    await database.query('DELETE FROM wkms_event_outbox WHERE task_id = $1', [
      taskId,
    ]);

    await database.query(
      `DELETE FROM audit_logs
       WHERE entity_type = 'WKMS_TASK'
         AND entity_id = $1`,
      [taskId],
    );

    await database.query(
      'DELETE FROM wkms_task_action_receipts WHERE task_id = $1',
      [taskId],
    );

    await database.query('DELETE FROM wkms_tasks WHERE task_id = $1', [taskId]);
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
  });

  function execute(
    action: IdempotentTaskAction,
    requestId = randomUUID(),
    usingRepository = repository,
  ) {
    return usingRepository.executeIdempotentTaskAction({
      requestId,
      taskId,
      workerId: WORKER_ID,
      action,
    });
  }

  async function countRows(
    table: 'audit_logs' | 'wkms_event_outbox' | 'wkms_task_action_receipts',
  ): Promise<number> {
    const column = table === 'audit_logs' ? 'entity_id' : 'task_id';

    const result = await database.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM ${table}
       WHERE ${column} = $1`,
      [taskId],
    );

    return result.rows[0].count;
  }

  async function setInProgress() {
    await database.query(
      `UPDATE wkms_tasks
       SET status = 'IN_PROGRESS'
       WHERE task_id = $1`,
      [taskId],
    );
  }

  it('executes START once and safely replays its receipt', async () => {
    const requestId = randomUUID();

    const first = await execute('START', requestId);
    const second = await execute('START', requestId);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(first.result.status).toBe('IN_PROGRESS');
    expect(second.result.status).toBe('IN_PROGRESS');

    expect(await countRows('audit_logs')).toBe(1);
    expect(await countRows('wkms_task_action_receipts')).toBe(1);
    expect(await countRows('wkms_event_outbox')).toBe(0);
  });

  it('allows only one execution for concurrent identical requests', async () => {
    const requestId = randomUUID();

    const results = await Promise.all(
      Array.from({ length: 6 }, () => execute('START', requestId)),
    );

    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(results.filter((r) => r.replayed)).toHaveLength(5);

    expect(await countRows('audit_logs')).toBe(1);
    expect(await countRows('wkms_task_action_receipts')).toBe(1);
  });

  it('rejects a request ID reused for another worker or action', async () => {
    const requestId = randomUUID();

    await execute('START', requestId);

    await expect(execute('COMPLETE', requestId)).rejects.toThrow(
      'TASK_ACTION_IDEMPOTENCY_CONFLICT',
    );

    await expect(
      repository.executeIdempotentTaskAction({
        requestId,
        taskId,
        workerId: randomUUID(),
        action: 'START',
      }),
    ).rejects.toThrow('TASK_ACTION_IDEMPOTENCY_CONFLICT');

    expect(await countRows('audit_logs')).toBe(1);
  });

  it('completes a task once without duplicating its outbox event', async () => {
    await setInProgress();

    const requestId = randomUUID();

    const first = await execute('COMPLETE', requestId);
    const second = await execute('COMPLETE', requestId);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(first.result.status).toBe('COMPLETED');
    expect(second.result.status).toBe('COMPLETED');

    expect(await countRows('audit_logs')).toBe(1);
    expect(await countRows('wkms_event_outbox')).toBe(1);
    expect(await countRows('wkms_task_action_receipts')).toBe(1);
  });

  it('rejects a second distinct completion request', async () => {
    await setInProgress();

    await execute('COMPLETE');

    await expect(execute('COMPLETE')).rejects.toThrow('INVALID_TASK_STATUS');

    expect(await countRows('audit_logs')).toBe(1);
    expect(await countRows('wkms_event_outbox')).toBe(1);
    expect(await countRows('wkms_task_action_receipts')).toBe(1);
  });

  it.each([
    ['receipt save', 'UPDATE wkms_task_action_receipts'],
    ['outbox insert', 'INSERT INTO wkms_event_outbox'],
  ])('rolls back COMPLETE when %s fails', async (_name, failingStatement) => {
    await setInProgress();

    const failingDatabase = {
      withTransaction: <T>(
        callback: (client: PoolClient) => Promise<T>,
      ): Promise<T> =>
        database.withTransaction((client) => {
          const wrapped = new Proxy(client, {
            get(target, property) {
              if (property === 'query') {
                return async (sql: string, params?: unknown[]) => {
                  if (sql.includes(failingStatement)) {
                    throw new Error('SIMULATED_DATABASE_FAILURE');
                  }

                  return target.query(sql, params);
                };
              }

              return Reflect.get(target, property, target);
            },
          });

          return callback(wrapped);
        }),
    } as unknown as DatabaseService;

    const failingRepository = new TaskRepository(failingDatabase);

    await expect(
      execute('COMPLETE', randomUUID(), failingRepository),
    ).rejects.toThrow('SIMULATED_DATABASE_FAILURE');

    const task = await database.query<{ status: string }>(
      'SELECT status FROM wkms_tasks WHERE task_id = $1',
      [taskId],
    );

    expect(task.rows[0].status).toBe('IN_PROGRESS');
    expect(await countRows('audit_logs')).toBe(0);
    expect(await countRows('wkms_event_outbox')).toBe(0);
    expect(await countRows('wkms_task_action_receipts')).toBe(0);
  });
});
