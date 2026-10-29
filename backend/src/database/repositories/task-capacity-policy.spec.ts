import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../database.service';
import { TaskRepository } from './task.repository';

const WORKER_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '11111111-1111-4111-8111-111111111111';

type Result = { rows: Array<Record<string, unknown>>; rowCount: number };
const rows = (values: Array<Record<string, unknown>> = []): Result => ({
  rows: values,
  rowCount: values.length,
});

type Query = (sql: string, params?: unknown[]) => Promise<Result>;

function setup(options: { activeCount: number; limit: number }) {
  const statements: string[] = [];
  const query = jest.fn<Query>(async (sql, _params) => {
    statements.push(sql);
    if (sql.includes('FROM staff_users')) {
      return rows([{ worker_id: WORKER_ID }]);
    }
    if (sql.includes('COUNT(*)') && sql.includes('FROM wkms_tasks')) {
      return rows([{
        count: options.activeCount,
        active_task_count: options.activeCount,
        max_active_tasks: options.limit,
      }]);
    }
    if (sql.includes('FROM wkms_tasks') && sql.includes('FOR UPDATE')) {
      return rows([{
        task_id: TASK_ID,
        status: 'UNASSIGNED',
        assigned_worker_id: null,
      }]);
    }
    if (sql.includes('UPDATE wkms_tasks')) {
      return rows([{ task_id: TASK_ID, status: 'ASSIGNED', assigned_worker_id: WORKER_ID }]);
    }
    return rows();
  });

  const client = { query } as unknown as PoolClient;
  const db = {
    query,
    withTransaction: async <T>(callback: (c: PoolClient) => Promise<T>) => callback(client),
  } as unknown as DatabaseService;

  return { repository: new TaskRepository(db), query, statements };
}

describe('DDP-200 configurable task capacity', () => {
  it('returns the current authoritative capacity and remaining slots', async () => {
    const context = setup({ activeCount: 2, limit: 4 });
    await expect(context.repository.getTaskCapacity(WORKER_ID)).resolves.toEqual({
      activeTaskCount: 2,
      maxActiveTasks: 4,
      remainingCapacity: 2,
    });
    expect(context.statements[0]).toContain('wkms_task_policy');
    expect(context.query).toHaveBeenCalledWith(expect.stringContaining('assigned_worker_id = $1'), [WORKER_ID]);
  });

  it('never reports a negative remaining capacity when a limit is reduced', async () => {
    const context = setup({ activeCount: 3, limit: 2 });
    await expect(context.repository.getTaskCapacity(WORKER_ID)).resolves.toMatchObject({
      remainingCapacity: 0,
      maxActiveTasks: 2,
    });
  });

  it('rejects worker claims at a configured limit of two', async () => {
    const context = setup({ activeCount: 2, limit: 2 });
    await expect(context.repository.claimTask(TASK_ID, WORKER_ID))
      .rejects.toThrow('ACTIVE_TASK_LIMIT_REACHED');
    expect(context.statements.some((s) => s.includes('UPDATE wkms_tasks'))).toBe(false);
    expect(context.statements.some((s) => s.includes('wkms_task_policy'))).toBe(true);
  });

  it('permits a worker claim below a configured limit of four', async () => {
    const context = setup({ activeCount: 3, limit: 4 });
    await expect(context.repository.claimTask(TASK_ID, WORKER_ID))
      .resolves.toMatchObject({ status: 'ASSIGNED' });
    expect(context.statements.some((s) => s.includes('INSERT INTO audit_logs'))).toBe(true);
  });

  it('rejects Front Desk manual assignment at the same configured limit', async () => {
    const context = setup({ activeCount: 2, limit: 2 });
    await expect(context.repository.manuallyAssignTask(TASK_ID, WORKER_ID))
      .rejects.toThrow('ACTIVE_TASK_LIMIT_REACHED');
    expect(context.statements.some((s) => s.includes('UPDATE wkms_tasks'))).toBe(false);
    expect(context.statements.some((s) => s.includes('wkms_task_policy'))).toBe(true);
  });

  it('permits Front Desk assignment when capacity is available', async () => {
    const context = setup({ activeCount: 1, limit: 2 });
    await expect(context.repository.manuallyAssignTask(TASK_ID, WORKER_ID))
      .resolves.toMatchObject({ status: 'ASSIGNED' });
    expect(context.statements.some((s) => s.includes('INSERT INTO audit_logs'))).toBe(true);
  });
});
