import { jest } from '@jest/globals';
import { DatabaseService } from './database.service';
import { TaskRepository } from './task.repository';

describe('TaskRepository', () => {
  it('should return only unassigned tasks ordered by submission time', async () => {
    const mockDatabaseService = {
      query: jest.fn().mockResolvedValue({
        rows: [],
      }),
    } as unknown as DatabaseService;

    const repository = new TaskRepository(mockDatabaseService);

    const result = await repository.findAll();

    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE status = $1'),
      ['UNASSIGNED'],
    );

    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY submitted_at ASC'),
      ['UNASSIGNED'],
    );

    expect(result).toEqual([]);
  });

  it('should claim an unassigned task for an active worker', async () => {
    const mockClient = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ worker_id: 'worker-1' }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ count: 0 }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ task_id: 'task-1', status: 'UNASSIGNED' }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              task_id: 'task-1',
              status: 'ASSIGNED',
              assigned_worker_id: 'worker-1',
            },
          ],
        }),
    };

    const mockDatabaseService = {
      withTransaction: jest.fn(async (callback) =>
        callback(mockClient),
      ),
    } as unknown as DatabaseService;

    const repository = new TaskRepository(mockDatabaseService);

    const result = await repository.claimTask(
      'task-1',
      'worker-1',
    );

    expect(result).toEqual({
      task_id: 'task-1',
      status: 'ASSIGNED',
      assigned_worker_id: 'worker-1',
    });

    expect(mockClient.query).toHaveBeenCalledTimes(4);
  });

  it('should reject a claim when worker already has three active tasks', async () => {
    const mockClient = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ worker_id: 'worker-1' }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ count: 3 }],
        }),
    };

    const mockDatabaseService = {
      withTransaction: jest.fn(async (callback) =>
        callback(mockClient),
      ),
    } as unknown as DatabaseService;

    const repository = new TaskRepository(mockDatabaseService);

    await expect(
      repository.claimTask('task-1', 'worker-1'),
    ).rejects.toThrow('ACTIVE_TASK_LIMIT_REACHED');

    expect(mockClient.query).toHaveBeenCalledTimes(2);
  });

  it('should reject a claim when task is not unassigned', async () => {
    const mockClient = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ worker_id: 'worker-1' }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ count: 1 }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ task_id: 'task-1', status: 'ASSIGNED' }],
        }),
    };

    const mockDatabaseService = {
      withTransaction: jest.fn(async (callback) =>
        callback(mockClient),
      ),
    } as unknown as DatabaseService;

    const repository = new TaskRepository(mockDatabaseService);

    await expect(
      repository.claimTask('task-1', 'worker-1'),
    ).rejects.toThrow('TASK_NOT_AVAILABLE');

    expect(mockClient.query).toHaveBeenCalledTimes(3);
  });
});
