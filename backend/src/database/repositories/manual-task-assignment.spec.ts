import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../database.service';
import { TaskRepository } from './task.repository';

const TASK_ID = '11111111-1111-4111-8111-111111111111';
const WORKER_ID = '22222222-2222-4222-8222-222222222222';

type QueryResult = {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
};

type QueryMock = (sql: string, params?: unknown[]) => Promise<QueryResult>;

const result = (rows: Array<Record<string, unknown>> = []): QueryResult => ({
  rows,
  rowCount: rows.length,
});

function setup(
  options: {
    workerActive?: boolean;
    activeCount?: number;
    taskStatus?: string;
    taskExists?: boolean;
    assignedWorkerId?: string | null;
    auditFails?: boolean;
  } = {},
) {
  const statements: string[] = [];

  const query = jest.fn<QueryMock>();

  query.mockImplementation(async (sql, params) => {
    statements.push(sql.trim());

    if (sql.includes('FROM staff_users')) {
      return options.workerActive === false
        ? result()
        : result([{ worker_id: WORKER_ID }]);
    }

    if (sql.includes('COUNT(*)') && sql.includes('FROM wkms_tasks')) {
      return result([{ count: options.activeCount ?? 0 }]);
    }

    if (sql.includes('FROM wkms_tasks') && sql.includes('FOR UPDATE')) {
      if (options.taskExists === false) {
        return result();
      }

      return result([
        {
          task_id: TASK_ID,
          status: options.taskStatus ?? 'UNASSIGNED',
          assigned_worker_id: options.assignedWorkerId ?? null,
        },
      ]);
    }

    if (sql.includes('UPDATE wkms_tasks')) {
      return result([
        {
          task_id: TASK_ID,
          status: 'ASSIGNED',
          assigned_worker_id: WORKER_ID,
        },
      ]);
    }

    if (sql.includes('INSERT INTO audit_logs')) {
      if (options.auditFails) {
        throw new Error('Audit insertion failed');
      }

      expect(params).toContain('TASK_MANUALLY_ASSIGNED');

      return result();
    }

    return result();
  });

  const client = {
    query,
  } as unknown as PoolClient;

  const withTransaction = async <T>(
    operation: (transactionClient: PoolClient) => Promise<T>,
  ): Promise<T> => {
    statements.push('BEGIN');

    try {
      const value = await operation(client);
      statements.push('COMMIT');
      return value;
    } catch (error) {
      statements.push('ROLLBACK');
      throw error;
    }
  };

  const databaseService = {
    withTransaction,
  } as unknown as DatabaseService;

  return {
    repository: new TaskRepository(databaseService),
    query,
    statements,
  };
}

describe('Manual task assignment repository', () => {
  it('assigns an available task and audits before commit', async () => {
    const context = setup();

    const assigned = await context.repository.manuallyAssignTask(
      TASK_ID,
      WORKER_ID,
    );

    expect(assigned).toMatchObject({
      task_id: TASK_ID,
      status: 'ASSIGNED',
      assigned_worker_id: WORKER_ID,
    });

    const sql = context.statements.join('\n');

    expect(sql).toContain('FROM staff_users');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('UPDATE wkms_tasks');
    expect(sql).toContain('INSERT INTO audit_logs');

    const auditIndex = context.statements.findIndex((statement) =>
      statement.includes('INSERT INTO audit_logs'),
    );

    expect(auditIndex).toBeGreaterThan(-1);
    expect(auditIndex).toBeLessThan(context.statements.indexOf('COMMIT'));
  });

  it('rejects an inactive or unknown worker', async () => {
    const context = setup({
      workerActive: false,
    });

    await expect(
      context.repository.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toThrow('WORKER_NOT_FOUND_OR_INACTIVE');

    expect(context.statements).toContain('ROLLBACK');
    expect(
      context.statements.some((sql) => sql.includes('UPDATE wkms_tasks')),
    ).toBe(false);
  });

  it('enforces the three-active-task limit', async () => {
    const context = setup({
      activeCount: 3,
    });

    await expect(
      context.repository.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toThrow('ACTIVE_TASK_LIMIT_REACHED');

    expect(context.statements).toContain('ROLLBACK');
    expect(context.statements).not.toContain('COMMIT');
  });

  it('rejects a missing task', async () => {
    const context = setup({
      taskExists: false,
    });

    await expect(
      context.repository.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toThrow('TASK_NOT_FOUND');

    expect(context.statements).toContain('ROLLBACK');
  });

  it.each(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'])(
    'rejects a task in %s status',
    async (taskStatus) => {
      const context = setup({ taskStatus });

      await expect(
        context.repository.manuallyAssignTask(TASK_ID, WORKER_ID),
      ).rejects.toThrow('TASK_NOT_AVAILABLE');

      expect(context.statements).toContain('ROLLBACK');
      expect(
        context.statements.some((sql) => sql.includes('UPDATE wkms_tasks')),
      ).toBe(false);
    },
  );

  it('rejects an already-owned available task', async () => {
    const context = setup({
      assignedWorkerId: '33333333-3333-4333-8333-333333333333',
    });

    await expect(
      context.repository.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toThrow('TASK_NOT_AVAILABLE');

    expect(context.statements).toContain('ROLLBACK');
  });

  it('rolls back when the audit insertion fails', async () => {
    const context = setup({
      auditFails: true,
    });

    await expect(
      context.repository.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toThrow('Audit insertion failed');

    expect(context.statements).toContain('ROLLBACK');
    expect(context.statements).not.toContain('COMMIT');
  });

  it('allows assignment of an available escalated task', async () => {
    const context = setup({
      taskStatus: 'ESCALATED',
    });

    const assigned = await context.repository.manuallyAssignTask(
      TASK_ID,
      WORKER_ID,
    );

    expect(assigned).toMatchObject({
      status: 'ASSIGNED',
      assigned_worker_id: WORKER_ID,
    });

    expect(context.statements).toContain('COMMIT');
  });
});
