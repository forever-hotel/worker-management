import { jest } from '@jest/globals';
import type { DatabaseService } from '../database.service';
import { TaskRepository } from './task.repository';

type QueryMock = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

describe('DDP-211 eligible-workers repository', () => {
  it('returns only the explicit public worker fields and calculates remaining capacity', async () => {
    const query = jest.fn<QueryMock>().mockResolvedValue({
      rows: [
        { worker_id: 'worker-1', full_name: 'A Worker', vocation: 'HOUSEKEEPING', active_task_count: 1, max_active_tasks: 3, password_hash: 'never-expose' },
        { worker_id: 'worker-2', full_name: 'B Worker', vocation: 'MAINTENANCE', active_task_count: 0, max_active_tasks: 2, password_hash: 'never-expose' },
      ],
    });
    const repository = new TaskRepository({ query } as unknown as DatabaseService);
    await expect(repository.findEligibleWorkers()).resolves.toEqual([
      { workerId: 'worker-1', fullName: 'A Worker', vocation: 'HOUSEKEEPING', activeTaskCount: 1, maxActiveTasks: 3, remainingCapacity: 2 },
      { workerId: 'worker-2', fullName: 'B Worker', vocation: 'MAINTENANCE', activeTaskCount: 0, maxActiveTasks: 2, remainingCapacity: 2 },
    ]);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("s.role = 'WORKER'");
    expect(sql).toContain('s.is_active = TRUE');
    expect(sql).toContain("status IN ('ASSIGNED', 'IN_PROGRESS')");
    expect(sql).toContain('max_active_tasks');
    expect(sql).toContain('active_task_count, 0) < p.max_active_tasks');
    expect(sql).not.toContain('password_hash');
  });

  it('returns an empty list when no worker is eligible', async () => {
    const query = jest.fn<QueryMock>().mockResolvedValue({ rows: [] });
    const repository = new TaskRepository({ query } as unknown as DatabaseService);
    await expect(repository.findEligibleWorkers()).resolves.toEqual([]);
  });
});
