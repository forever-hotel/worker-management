import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../database.service';
import { TaskRepository } from './task.repository';

type MockQueryResult = {
  rowCount: number;
  rows: Array<Record<string, unknown>>;
};

type MockQuery = (
    ...args: unknown[]
) => Promise<MockQueryResult>;

function createMockClient() {
  const query = jest.fn<MockQuery>();

  const client = {
    query,
  } as unknown as PoolClient;

  return {
    query,
    client,
  };
}

function createDatabaseService(
    client: PoolClient,
): DatabaseService {
  const withTransaction = async <T>(
      callback: (transactionClient: PoolClient) => Promise<T>,
  ): Promise<T> => callback(client);

  return {
    withTransaction,
  } as unknown as DatabaseService;
}

describe('TaskRepository', () => {
  it('should return only unassigned tasks ordered by submission time', async () => {
    const queryMock = jest
        .fn<
            (
                text: string,
                params?: unknown[],
            ) => Promise<{ rows: unknown[] }>
        >()
        .mockResolvedValue({
          rows: [],
        });

    const mockDatabaseService = {
      query: queryMock,
    } as unknown as DatabaseService;

    const repository = new TaskRepository(mockDatabaseService);

    const result = await repository.findAll();

    expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['UNASSIGNED'],
    );

    expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY submitted_at ASC'),
        ['UNASSIGNED'],
    );

    expect(result).toEqual([]);
  });

  it('should claim an unassigned task for an active worker', async () => {
    const { query, client } = createMockClient();

    query
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
          rows: [
            {
              task_id: 'task-1',
              status: 'UNASSIGNED',
            },
          ],
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
        });

    const repository = new TaskRepository(
        createDatabaseService(client),
    );

    const result = await repository.claimTask(
        'task-1',
        'worker-1',
    );

    expect(result).toEqual({
      task_id: 'task-1',
      status: 'ASSIGNED',
      assigned_worker_id: 'worker-1',
    });

    expect(query).toHaveBeenCalledTimes(4);
  });

  it('should reject a claim when worker already has three active tasks', async () => {
    const { query, client } = createMockClient();

    query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ worker_id: 'worker-1' }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ count: 3 }],
        });

    const repository = new TaskRepository(
        createDatabaseService(client),
    );

    await expect(
        repository.claimTask('task-1', 'worker-1'),
    ).rejects.toThrow('ACTIVE_TASK_LIMIT_REACHED');

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('should reject a claim when task is not unassigned', async () => {
    const { query, client } = createMockClient();

    query
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
          rows: [
            {
              task_id: 'task-1',
              status: 'ASSIGNED',
            },
          ],
        });

    const repository = new TaskRepository(
        createDatabaseService(client),
    );

    await expect(
        repository.claimTask('task-1', 'worker-1'),
    ).rejects.toThrow('TASK_NOT_AVAILABLE');

    expect(query).toHaveBeenCalledTimes(3);
  });

  it('should reject a claim when worker is missing or inactive', async () => {
    const { query, client } = createMockClient();

    query.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    const repository = new TaskRepository(
        createDatabaseService(client),
    );

    await expect(
        repository.claimTask('task-1', 'worker-1'),
    ).rejects.toThrow('WORKER_NOT_FOUND_OR_INACTIVE');

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('should reject a claim when the task does not exist', async () => {
    const { query, client } = createMockClient();

    query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ worker_id: 'worker-1' }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ count: 0 }],
        })
        .mockResolvedValueOnce({
          rowCount: 0,
          rows: [],
        });

    const repository = new TaskRepository(
        createDatabaseService(client),
    );

    await expect(
        repository.claimTask('missing-task', 'worker-1'),
    ).rejects.toThrow('TASK_NOT_FOUND');

    expect(query).toHaveBeenCalledTimes(3);
  });

  it('should return only active tasks assigned to the worker', async () => {
    const tasks = [
      {
        task_id: 'task-1',
        status: 'ASSIGNED',
        assigned_worker_id: 'worker-1',
      },
      {
        task_id: 'task-2',
        status: 'IN_PROGRESS',
        assigned_worker_id: 'worker-1',
      },
    ];

    const queryMock = jest
        .fn<
            (
                text: string,
                params?: unknown[],
            ) => Promise<{ rows: unknown[] }>
        >()
        .mockResolvedValue({
          rows: tasks,
        });

    const mockDatabaseService = {
      query: queryMock,
    } as unknown as DatabaseService;

    const repository =
        new TaskRepository(
            mockDatabaseService,
        );

    const result =
        await repository.findMyActiveTasks(
            'worker-1',
        );

    expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining(
            'assigned_worker_id = $1',
        ),
        [
          'worker-1',
          'ASSIGNED',
          'IN_PROGRESS',
        ],
    );

    expect(result).toEqual(tasks);
  });

  it('should start an assigned task owned by the worker', async () => {
    const { query, client } =
        createMockClient();

    query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              task_id: 'task-1',
              status: 'ASSIGNED',
              assigned_worker_id:
                  'worker-1',
            },
          ],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              task_id: 'task-1',
              status: 'IN_PROGRESS',
              assigned_worker_id:
                  'worker-1',
            },
          ],
        });

    const repository =
        new TaskRepository(
            createDatabaseService(client),
        );

    const result =
        await repository.startTask(
            'task-1',
            'worker-1',
        );

    expect(result).toMatchObject({
      task_id: 'task-1',
      status: 'IN_PROGRESS',
      assigned_worker_id:
          'worker-1',
    });

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('should reject starting a task owned by another worker', async () => {
    const { query, client } =
        createMockClient();

    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          task_id: 'task-1',
          status: 'ASSIGNED',
          assigned_worker_id:
              'worker-2',
        },
      ],
    });

    const repository =
        new TaskRepository(
            createDatabaseService(client),
        );

    await expect(
        repository.startTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toThrow(
        'TASK_NOT_OWNED',
    );

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('should reject starting a task that is not ASSIGNED', async () => {
    const { query, client } =
        createMockClient();

    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          task_id: 'task-1',
          status: 'IN_PROGRESS',
          assigned_worker_id:
              'worker-1',
        },
      ],
    });

    const repository =
        new TaskRepository(
            createDatabaseService(client),
        );

    await expect(
        repository.startTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toThrow(
        'INVALID_TASK_STATUS',
    );
  });

  it('should complete an IN_PROGRESS task owned by the worker', async () => {
    const { query, client } =
        createMockClient();

    query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              task_id: 'task-1',
              status: 'IN_PROGRESS',
              assigned_worker_id:
                  'worker-1',
            },
          ],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              task_id: 'task-1',
              status: 'COMPLETED',
              assigned_worker_id:
                  'worker-1',
              completed_at:
                  '2026-10-02T12:00:00.000Z',
            },
          ],
        });

    const repository =
        new TaskRepository(
            createDatabaseService(client),
        );

    const result =
        await repository.completeTask(
            'task-1',
            'worker-1',
        );

    expect(result).toMatchObject({
      task_id: 'task-1',
      status: 'COMPLETED',
      assigned_worker_id:
          'worker-1',
    });

    expect(result).toHaveProperty(
        'completed_at',
    );

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('should reject completing a task owned by another worker', async () => {
    const { query, client } =
        createMockClient();

    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          task_id: 'task-1',
          status: 'IN_PROGRESS',
          assigned_worker_id:
              'worker-2',
        },
      ],
    });

    const repository =
        new TaskRepository(
            createDatabaseService(client),
        );

    await expect(
        repository.completeTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toThrow(
        'TASK_NOT_OWNED',
    );
  });

  it('should reject completing a task that is not IN_PROGRESS', async () => {
    const { query, client } =
        createMockClient();

    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          task_id: 'task-1',
          status: 'ASSIGNED',
          assigned_worker_id:
              'worker-1',
        },
      ],
    });

    const repository =
        new TaskRepository(
            createDatabaseService(client),
        );

    await expect(
        repository.completeTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toThrow(
        'INVALID_TASK_STATUS',
    );
  });

  it('should reject starting a task that does not exist', async () => {
    const { query, client } =
        createMockClient();

    query.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    const repository =
        new TaskRepository(
            createDatabaseService(client),
        );

    await expect(
        repository.startTask(
            'missing-task',
            'worker-1',
        ),
    ).rejects.toThrow(
        'TASK_NOT_FOUND',
    );
  });

  it('should reject completing a task that does not exist', async () => {
    const { query, client } =
        createMockClient();

    query.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    const repository =
        new TaskRepository(
            createDatabaseService(client),
        );

    await expect(
        repository.completeTask(
            'missing-task',
            'worker-1',
        ),
    ).rejects.toThrow(
        'TASK_NOT_FOUND',
    );
  });

});