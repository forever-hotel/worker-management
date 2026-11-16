import type { PoolClient } from 'pg';
import { DatabaseService } from '../database.service';
import { TaskRepository } from './task.repository';
import { CheckoutTaskRepository } from './checkout-task.repository';

type MockResult = {
  rowCount: number;
  rows: Record<string, unknown>[];
};

function result(rows: Record<string, unknown>[] = []): MockResult {
  return {
    rowCount: rows.length,
    rows,
  };
}

function createTransactionalContext(
  handler: (sql: string) => Promise<MockResult>,
) {
  const statements: string[] = [];

  const client = {
    query: async (sql: string): Promise<MockResult> => {
      statements.push(sql);
      return handler(sql);
    },
  } as unknown as PoolClient;

  const database = {
    withTransaction: async <T>(
      operation: (client: PoolClient) => Promise<T>,
    ): Promise<T> => {
      await client.query('BEGIN');

      try {
        const value = await operation(client);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    },
  } as unknown as DatabaseService;

  return { database, statements };
}

describe('DDP-196 task audit atomicity', () => {
  it('rolls back a task claim when audit insertion fails', async () => {
    const { database, statements } = createTransactionalContext(async (sql) => {
      if (sql.includes('INSERT INTO audit_logs')) {
        throw new Error('AUDIT_INSERT_FAILED');
      }

      if (sql.includes('FROM staff_users')) {
        return result([{ worker_id: 'worker-1' }]);
      }

      if (sql.includes('COUNT(*)')) {
        return result([{ count: 0 }]);
      }

      if (sql.includes('FROM wkms_tasks') && sql.includes('FOR UPDATE')) {
        return result([
          {
            task_id: 'task-1',
            status: 'UNASSIGNED',
          },
        ]);
      }

      if (sql.includes('UPDATE wkms_tasks')) {
        return result([
          {
            task_id: 'task-1',
            status: 'ASSIGNED',
            assigned_worker_id: 'worker-1',
          },
        ]);
      }

      return result();
    });

    const repository = new TaskRepository(database);

    await expect(repository.claimTask('task-1', 'worker-1')).rejects.toThrow(
      'AUDIT_INSERT_FAILED',
    );

    expect(statements.some((sql) => sql.includes('UPDATE wkms_tasks'))).toBe(
      true,
    );

    expect(
      statements.some((sql) => sql.includes('INSERT INTO audit_logs')),
    ).toBe(true);

    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
  });

  it('rolls back checkout-task creation when audit insertion fails', async () => {
    const { database, statements } = createTransactionalContext(async (sql) => {
      if (sql.includes('INSERT INTO audit_logs')) {
        throw new Error('AUDIT_INSERT_FAILED');
      }

      if (sql.includes('FROM bookings')) {
        return result([
          {
            booking_id: '11111111-1111-4111-8111-111111111111',
          },
        ]);
      }

      if (sql.includes('INSERT INTO wkms_tasks')) {
        return result([
          {
            task_id: '22222222-2222-4222-8222-222222222222',
          },
        ]);
      }

      return result();
    });

    const repository = new CheckoutTaskRepository(database);

    await expect(
      repository.createCheckoutCleaningTask(
        '11111111-1111-4111-8111-111111111111',
        'DEMO101',
      ),
    ).rejects.toThrow('AUDIT_INSERT_FAILED');

    expect(
      statements.some((sql) => sql.includes('INSERT INTO wkms_tasks')),
    ).toBe(true);

    expect(
      statements.some((sql) => sql.includes('INSERT INTO audit_logs')),
    ).toBe(true);

    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
  });

  it('does not create another audit for a duplicate checkout event', async () => {
    const existingTaskId = '22222222-2222-4222-8222-222222222222';

    const { database, statements } = createTransactionalContext(async (sql) => {
      if (
        sql.includes('FROM wkms_tasks') &&
        sql.includes("source = 'CHECKOUT_TRIGGER'")
      ) {
        return result([
          {
            task_id: existingTaskId,
            room_number: 'DEMO101',
          },
        ]);
      }

      return result();
    });

    const repository = new CheckoutTaskRepository(database);

    const outcome = await repository.createCheckoutCleaningTask(
      '11111111-1111-4111-8111-111111111111',
      'DEMO101',
    );

    expect(outcome).toEqual({
      status: 'EXISTS',
      taskId: existingTaskId,
    });

    expect(
      statements.some((sql) => sql.includes('INSERT INTO audit_logs')),
    ).toBe(false);

    expect(
      statements.some((sql) => sql.includes('INSERT INTO wkms_tasks')),
    ).toBe(false);

    expect(statements).toContain('COMMIT');
    expect(statements).not.toContain('ROLLBACK');
  });
});
