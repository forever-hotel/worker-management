import type { PoolClient } from 'pg';
import type { DatabaseService } from '../database.service';
import { TaskRepository } from './task.repository';

const TASK_ID = '11111111-1111-4111-8111-111111111111';
const WORKER_ID = '22222222-2222-4222-8222-222222222222';
const COMPLETED_AT = '2026-10-27T08:00:00.000Z';

type TaskState = 'IN_PROGRESS' | 'COMPLETED';

function createContext(
  initialStatus: TaskState = 'IN_PROGRESS',
  failOn?: 'AUDIT' | 'OUTBOX',
) {
  const queries: Array<{
    sql: string;
    params: unknown[];
  }> = [];

  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });

      if (sql.includes('FROM wkms_tasks') && sql.includes('FOR UPDATE')) {
        return {
          rowCount: 1,
          rows: [
            {
              task_id: TASK_ID,
              status: initialStatus,
              assigned_worker_id: WORKER_ID,
            },
          ],
        };
      }

      if (sql.includes('UPDATE wkms_tasks')) {
        return {
          rowCount: 1,
          rows: [
            {
              task_id: TASK_ID,
              status: 'COMPLETED',
              assigned_worker_id: WORKER_ID,
              category: 'ROOM_CLEANING',
              room_number: 'DEMO101',
              priority: 'HIGH',
              completed_at: COMPLETED_AT,
            },
          ],
        };
      }

      if (sql.includes('INSERT INTO audit_logs')) {
        if (failOn === 'AUDIT') {
          throw new Error('AUDIT_INSERT_FAILED');
        }
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes('INSERT INTO wkms_event_outbox')) {
        if (failOn === 'OUTBOX') {
          throw new Error('OUTBOX_INSERT_FAILED');
        }
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
  } as unknown as PoolClient;

  const database = {
    withTransaction: async <T>(
      operation: (connection: PoolClient) => Promise<T>,
    ): Promise<T> => {
      await client.query('BEGIN');

      try {
        const result = await operation(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    },
  } as unknown as DatabaseService;

  return {
    repository: new TaskRepository(database),
    queries,
  };
}

describe('DDP-197 durable task completion', () => {
  it('persists the audit and outbox event before commit', async () => {
    const { repository, queries } = createContext();

    const result = await repository.completeTask(TASK_ID, WORKER_ID);

    expect(result.status).toBe('COMPLETED');

    const statements = queries.map((q) => q.sql);

    const updateIndex = statements.findIndex((sql) =>
      sql.includes('UPDATE wkms_tasks'),
    );

    const auditIndex = statements.findIndex((sql) =>
      sql.includes('INSERT INTO audit_logs'),
    );

    const outboxIndex = statements.findIndex((sql) =>
      sql.includes('INSERT INTO wkms_event_outbox'),
    );

    const commitIndex = statements.indexOf('COMMIT');

    expect(updateIndex).toBeGreaterThan(-1);
    expect(auditIndex).toBeGreaterThan(updateIndex);
    expect(outboxIndex).toBeGreaterThan(auditIndex);
    expect(commitIndex).toBeGreaterThan(outboxIndex);

    const outbox = queries[outboxIndex];

    expect(outbox.params).toEqual([
      `completion:${TASK_ID}`,
      TASK_ID,
      'task.completed',
      'wkms.task.completed.v1',
      1,
      COMPLETED_AT,
      'worker-management',
      WORKER_ID,
      'ROOM_CLEANING',
      'DEMO101',
      'HIGH',
    ]);

    expect(outbox.sql).toContain('jsonb_build_object');

    // No credentials or guest personal information in event data.
    expect(JSON.stringify(outbox.params)).not.toMatch(
      /password|secret|guestName|email|phone/i,
    );
  });

  it('rolls back when audit insertion fails', async () => {
    const { repository, queries } = createContext('IN_PROGRESS', 'AUDIT');

    await expect(repository.completeTask(TASK_ID, WORKER_ID)).rejects.toThrow(
      'AUDIT_INSERT_FAILED',
    );

    const statements = queries.map((q) => q.sql);

    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');

    expect(
      statements.some((sql) => sql.includes('INSERT INTO wkms_event_outbox')),
    ).toBe(false);
  });

  it('rolls back when outbox insertion fails', async () => {
    const { repository, queries } = createContext('IN_PROGRESS', 'OUTBOX');

    await expect(repository.completeTask(TASK_ID, WORKER_ID)).rejects.toThrow(
      'OUTBOX_INSERT_FAILED',
    );

    const statements = queries.map((q) => q.sql);

    expect(statements.some((sql) => sql.includes('UPDATE wkms_tasks'))).toBe(
      true,
    );

    expect(
      statements.some((sql) => sql.includes('INSERT INTO audit_logs')),
    ).toBe(true);

    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
  });

  it('does not create a second event for an already completed task', async () => {
    const { repository, queries } = createContext('COMPLETED');

    await expect(repository.completeTask(TASK_ID, WORKER_ID)).rejects.toThrow(
      'INVALID_TASK_STATUS',
    );

    const statements = queries.map((q) => q.sql);

    expect(statements.some((sql) => sql.includes('UPDATE wkms_tasks'))).toBe(
      false,
    );

    expect(
      statements.some((sql) => sql.includes('INSERT INTO audit_logs')),
    ).toBe(false);

    expect(
      statements.some((sql) => sql.includes('INSERT INTO wkms_event_outbox')),
    ).toBe(false);

    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
  });
});
