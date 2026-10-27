import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database.service';
import { TaskRepository } from './task.repository';

const TASK_ID = '33333333-3333-4333-8333-333333333333';
const WORKER_A = '11111111-1111-4111-8111-111111111111';
const WORKER_B = '22222222-2222-4222-8222-222222222222';

const databaseUrl = process.env.WKMS_DDP198_DATABASE_URL;

const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres('DDP-198 real PostgreSQL concurrency', () => {
  let database: DatabaseService;
  let repository: TaskRepository;

  beforeAll(async () => {
    const parsed = new URL(databaseUrl!);

    // Never execute these tests against Neon or an unexpected DB.
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.port !== '55434' ||
      parsed.pathname !== '/wkms_ddp198_test'
    ) {
      throw new Error('Unsafe DDP-198 database target');
    }

    const config = {
      get: (key: string) => (key === 'DATABASE_URL' ? databaseUrl : undefined),
    } as unknown as ConfigService;

    database = new DatabaseService(config);
    await database.onModuleInit();

    const identity = await database.query<{
      database_name: string;
    }>('SELECT current_database() AS database_name');

    if (identity.rows[0]?.database_name !== 'wkms_ddp198_test') {
      throw new Error('Unexpected database identity');
    }

    repository = new TaskRepository(database);
  });

  beforeEach(async () => {
    // Reset only the known disposable fixture task.
    await database.query(
      `UPDATE wkms_tasks
       SET status = 'UNASSIGNED',
           assigned_worker_id = NULL,
           updated_at = NOW()
       WHERE task_id = $1`,
      [TASK_ID],
    );

    await database.query(
      `DELETE FROM audit_logs
       WHERE entity_type = 'WKMS_TASK'
         AND entity_id = $1`,
      [TASK_ID],
    );
  });

  afterAll(async () => {
    if (database) {
      await database.onModuleDestroy();
    }
  });

  async function verifySingleOwner() {
    const result = await database.query<{
      status: string;
      assigned_worker_id: string | null;
    }>(
      `SELECT status, assigned_worker_id
       FROM wkms_tasks
       WHERE task_id = $1`,
      [TASK_ID],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe('ASSIGNED');
    expect([WORKER_A, WORKER_B]).toContain(result.rows[0].assigned_worker_id);

    const audits = await database.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM audit_logs
       WHERE entity_type = 'WKMS_TASK'
         AND entity_id = $1`,
      [TASK_ID],
    );

    expect(audits.rows[0].count).toBe(1);
  }

  it('prevents two concurrent manual assignments', async () => {
    const results = await Promise.allSettled([
      repository.manuallyAssignTask(TASK_ID, WORKER_A),
      repository.manuallyAssignTask(TASK_ID, WORKER_B),
    ]);

    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );

    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(
      1,
    );

    await verifySingleOwner();
  });

  it('prevents a manual assignment versus worker claim race', async () => {
    const results = await Promise.allSettled([
      repository.manuallyAssignTask(TASK_ID, WORKER_A),
      repository.claimTask(TASK_ID, WORKER_B),
    ]);

    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );

    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(
      1,
    );

    await verifySingleOwner();
  });

  it('rolls back when the audit table rejects the insert', async () => {
    // Force a transaction-local audit error without modifying
    // the table schema or its normal behavior.
    const client = {
      withTransaction: async <T>(
        callback: (transactionClient: import('pg').PoolClient) => Promise<T>,
      ): Promise<T> =>
        database.withTransaction(async (transactionClient) => {
          const wrapped = new Proxy(transactionClient, {
            get(target, property, receiver) {
              if (property === 'query') {
                return async (sql: string, params?: unknown[]) => {
                  if (sql.includes('INSERT INTO audit_logs')) {
                    throw new Error('Simulated audit failure');
                  }

                  return target.query(sql, params);
                };
              }

              return Reflect.get(target, property, receiver);
            },
          });

          return callback(wrapped);
        }),
    } as unknown as DatabaseService;

    const failingRepository = new TaskRepository(client);

    await expect(
      failingRepository.manuallyAssignTask(TASK_ID, WORKER_A),
    ).rejects.toThrow('Simulated audit failure');

    const state = await database.query<{
      status: string;
      assigned_worker_id: string | null;
    }>(
      `SELECT status, assigned_worker_id
       FROM wkms_tasks
       WHERE task_id = $1`,
      [TASK_ID],
    );

    expect(state.rows[0]).toMatchObject({
      status: 'UNASSIGNED',
      assigned_worker_id: null,
    });
  });
});
