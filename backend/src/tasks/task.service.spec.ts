import { jest } from '@jest/globals';
import {
  ConflictException, ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TaskRepository } from '../database/repositories/task.repository';
import { TaskService } from './task.service';

type FindAllMock = () => Promise<unknown[]>;

type ClaimTaskMock = (
    taskId: string,
    workerId: string,
) => Promise<unknown>;

type FindMyActiveTasksMock = (
    workerId: string,
) => Promise<unknown[]>;

type StartTaskMock = (
    taskId: string,
    workerId: string,
) => Promise<unknown>;

type CompleteTaskMock = (
    taskId: string,
    workerId: string,
) => Promise<unknown>;

type FindByIdMock = (
    taskId: string,
) => Promise<
    Record<string, unknown> | null
>;

describe('TaskService', () => {
  it('should return the task queue from the repository', async () => {
    const findAll = jest
        .fn<FindAllMock>()
        .mockResolvedValue([]);

    const mockTaskRepository = {
      findAll,
    } as unknown as TaskRepository;

    const service = new TaskService(mockTaskRepository);

    const result = await service.getQueue();

    expect(findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should claim a task successfully', async () => {
    const claimedTask = {
      task_id: 'task-1',
      status: 'ASSIGNED',
      assigned_worker_id: 'worker-1',
    };

    const claimTask = jest
        .fn<ClaimTaskMock>()
        .mockResolvedValue(claimedTask);

    const mockTaskRepository = {
      claimTask,
    } as unknown as TaskRepository;

    const service = new TaskService(mockTaskRepository);

    const result = await service.claimTask(
        'task-1',
        'worker-1',
    );

    expect(claimTask).toHaveBeenCalledWith(
        'task-1',
        'worker-1',
    );

    expect(result).toEqual(claimedTask);
  });

  it('should return conflict when active task limit is reached', async () => {
    const claimTask = jest
        .fn<ClaimTaskMock>()
        .mockRejectedValue(
            new Error('ACTIVE_TASK_LIMIT_REACHED'),
        );

    const service = new TaskService({
      claimTask,
    } as unknown as TaskRepository);

    await expect(
        service.claimTask('task-1', 'worker-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should return not found when task does not exist', async () => {
    const claimTask = jest
        .fn<ClaimTaskMock>()
        .mockRejectedValue(new Error('TASK_NOT_FOUND'));

    const service = new TaskService({
      claimTask,
    } as unknown as TaskRepository);

    await expect(
        service.claimTask('task-1', 'worker-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should return conflict when task is no longer available', async () => {
    const claimTask = jest
        .fn<ClaimTaskMock>()
        .mockRejectedValue(new Error('TASK_NOT_AVAILABLE'));

    const service = new TaskService({
      claimTask,
    } as unknown as TaskRepository);

    await expect(
        service.claimTask('task-1', 'worker-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should return not found when worker is missing or inactive', async () => {
    const claimTask = jest
        .fn<ClaimTaskMock>()
        .mockRejectedValue(
            new Error('WORKER_NOT_FOUND_OR_INACTIVE'),
        );

    const service = new TaskService({
      claimTask,
    } as unknown as TaskRepository);

    await expect(
        service.claimTask('task-1', 'worker-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should rethrow an unexpected Error', async () => {
    const unexpectedError = new Error('DATABASE_FAILURE');

    const claimTask = jest
        .fn<ClaimTaskMock>()
        .mockRejectedValue(unexpectedError);

    const service = new TaskService({
      claimTask,
    } as unknown as TaskRepository);

    await expect(
        service.claimTask('task-1', 'worker-1'),
    ).rejects.toBe(unexpectedError);
  });

  it('should rethrow a non-Error rejection unchanged', async () => {
    const unexpectedValue = 'UNKNOWN_FAILURE';

    const claimTask = jest
        .fn<ClaimTaskMock>()
        .mockRejectedValue(unexpectedValue);

    const service = new TaskService({
      claimTask,
    } as unknown as TaskRepository);

    await expect(
        service.claimTask('task-1', 'worker-1'),
    ).rejects.toBe(unexpectedValue);
  });

  it('should return active tasks for the authenticated worker', async () => {
    const tasks = [
      {
        task_id: 'task-1',
        status: 'ASSIGNED',
        assigned_worker_id:
            'worker-1',
      },
    ];

    const findMyActiveTasks = jest
        .fn<FindMyActiveTasksMock>()
        .mockResolvedValue(tasks);

    const service = new TaskService({
      findMyActiveTasks,
    } as unknown as TaskRepository);

    const result =
        await service.getMyTasks(
            'worker-1',
        );

    expect(
        findMyActiveTasks,
    ).toHaveBeenCalledWith(
        'worker-1',
    );

    expect(result).toEqual(tasks);
  });

  it('should start an assigned task successfully', async () => {
    const startedTask = {
      task_id: 'task-1',
      status: 'IN_PROGRESS',
      assigned_worker_id:
          'worker-1',
    };

    const startTask = jest
        .fn<StartTaskMock>()
        .mockResolvedValue(
            startedTask,
        );

    const service = new TaskService({
      startTask,
    } as unknown as TaskRepository);

    const result =
        await service.startTask(
            'task-1',
            'worker-1',
        );

    expect(startTask).toHaveBeenCalledWith(
        'task-1',
        'worker-1',
    );

    expect(result).toEqual(
        startedTask,
    );
  });

  it('should complete an in-progress task successfully', async () => {
    const completedTask = {
      task_id: 'task-1',
      status: 'COMPLETED',
      assigned_worker_id:
          'worker-1',
      completed_at:
          '2026-10-02T12:00:00.000Z',
    };

    const completeTask = jest
        .fn<CompleteTaskMock>()
        .mockResolvedValue(
            completedTask,
        );

    const service = new TaskService({
      completeTask,
    } as unknown as TaskRepository);

    const result =
        await service.completeTask(
            'task-1',
            'worker-1',
        );

    expect(
        completeTask,
    ).toHaveBeenCalledWith(
        'task-1',
        'worker-1',
    );

    expect(result).toEqual(
        completedTask,
    );
  });

  it('should return not found when starting a missing task', async () => {
    const startTask = jest
        .fn<StartTaskMock>()
        .mockRejectedValue(
            new Error(
                'TASK_NOT_FOUND',
            ),
        );

    const service = new TaskService({
      startTask,
    } as unknown as TaskRepository);

    await expect(
        service.startTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        NotFoundException,
    );
  });

  it('should return forbidden when starting another worker task', async () => {
    const startTask = jest
        .fn<StartTaskMock>()
        .mockRejectedValue(
            new Error(
                'TASK_NOT_OWNED',
            ),
        );

    const service = new TaskService({
      startTask,
    } as unknown as TaskRepository);

    await expect(
        service.startTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        ForbiddenException,
    );
  });

  it('should return conflict when starting from an invalid status', async () => {
    const startTask = jest
        .fn<StartTaskMock>()
        .mockRejectedValue(
            new Error(
                'INVALID_TASK_STATUS',
            ),
        );

    const service = new TaskService({
      startTask,
    } as unknown as TaskRepository);

    await expect(
        service.startTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        ConflictException,
    );
  });

  it('should return not found when completing a missing task', async () => {
    const completeTask = jest
        .fn<CompleteTaskMock>()
        .mockRejectedValue(
            new Error(
                'TASK_NOT_FOUND',
            ),
        );

    const service = new TaskService({
      completeTask,
    } as unknown as TaskRepository);

    await expect(
        service.completeTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        NotFoundException,
    );
  });

  it('should return forbidden when completing another worker task', async () => {
    const completeTask = jest
        .fn<CompleteTaskMock>()
        .mockRejectedValue(
            new Error(
                'TASK_NOT_OWNED',
            ),
        );

    const service = new TaskService({
      completeTask,
    } as unknown as TaskRepository);

    await expect(
        service.completeTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        ForbiddenException,
    );
  });

  it('should return conflict when completing from an invalid status', async () => {
    const completeTask = jest
        .fn<CompleteTaskMock>()
        .mockRejectedValue(
            new Error(
                'INVALID_TASK_STATUS',
            ),
        );

    const service = new TaskService({
      completeTask,
    } as unknown as TaskRepository);

    await expect(
        service.completeTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        ConflictException,
    );
  });

  it('should rethrow an unexpected lifecycle error', async () => {
    const error =
        new Error('DATABASE_FAILURE');

    const startTask = jest
        .fn<StartTaskMock>()
        .mockRejectedValue(error);

    const service = new TaskService({
      startTask,
    } as unknown as TaskRepository);

    await expect(
        service.startTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBe(error);
  });

  it('should rethrow a non-Error lifecycle rejection', async () => {
    const startTask = jest
        .fn<StartTaskMock>()
        .mockRejectedValue(
            'UNKNOWN_FAILURE',
        );

    const service = new TaskService({
      startTask,
    } as unknown as TaskRepository);

    await expect(
        service.startTask(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBe(
        'UNKNOWN_FAILURE',
    );
  });

  it('should return an unassigned task detail', async () => {
    const task = {
      task_id: 'task-1',
      status: 'UNASSIGNED',
      assigned_worker_id: null,
    };

    const findById = jest
        .fn<FindByIdMock>()
        .mockResolvedValue(task);

    const service = new TaskService({
      findById,
    } as unknown as TaskRepository);

    const result =
        await service.getTaskDetail(
            'task-1',
            'worker-1',
        );

    expect(findById).toHaveBeenCalledWith(
        'task-1',
    );

    expect(result).toEqual(task);
  });

  it('should return an escalated unassigned task detail', async () => {
    const task = {
      task_id: 'task-1',
      status: 'ESCALATED',
      assigned_worker_id: null,
    };

    const findById = jest
        .fn<FindByIdMock>()
        .mockResolvedValue(task);

    const service = new TaskService({
      findById,
    } as unknown as TaskRepository);

    const result =
        await service.getTaskDetail(
            'task-1',
            'worker-1',
        );

    expect(result).toEqual(task);
  });

  it('should return an assigned task owned by the worker', async () => {
    const task = {
      task_id: 'task-1',
      status: 'ASSIGNED',
      assigned_worker_id:
          'worker-1',
    };

    const findById = jest
        .fn<FindByIdMock>()
        .mockResolvedValue(task);

    const service = new TaskService({
      findById,
    } as unknown as TaskRepository);

    const result =
        await service.getTaskDetail(
            'task-1',
            'worker-1',
        );

    expect(result).toEqual(task);
  });

  it('should return an in-progress task owned by the worker', async () => {
    const task = {
      task_id: 'task-1',
      status: 'IN_PROGRESS',
      assigned_worker_id:
          'worker-1',
    };

    const findById = jest
        .fn<FindByIdMock>()
        .mockResolvedValue(task);

    const service = new TaskService({
      findById,
    } as unknown as TaskRepository);

    const result =
        await service.getTaskDetail(
            'task-1',
            'worker-1',
        );

    expect(result).toEqual(task);
  });

  it('should return a completed task owned by the worker', async () => {
    const task = {
      task_id: 'task-1',
      status: 'COMPLETED',
      assigned_worker_id:
          'worker-1',
      completed_at:
          '2026-10-03T01:00:00.000Z',
    };

    const findById = jest
        .fn<FindByIdMock>()
        .mockResolvedValue(task);

    const service = new TaskService({
      findById,
    } as unknown as TaskRepository);

    const result =
        await service.getTaskDetail(
            'task-1',
            'worker-1',
        );

    expect(result).toEqual(task);
  });

  it('should return not found when task detail does not exist', async () => {
    const findById = jest
        .fn<FindByIdMock>()
        .mockResolvedValue(null);

    const service = new TaskService({
      findById,
    } as unknown as TaskRepository);

    await expect(
        service.getTaskDetail(
            'missing-task',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        NotFoundException,
    );
  });

  it('should reject task detail assigned to another worker', async () => {
    const findById = jest
        .fn<FindByIdMock>()
        .mockResolvedValue({
          task_id: 'task-1',
          status: 'ASSIGNED',
          assigned_worker_id:
              'worker-2',
        });

    const service = new TaskService({
      findById,
    } as unknown as TaskRepository);

    await expect(
        service.getTaskDetail(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        ForbiddenException,
    );
  });

  it('should reject an invalid unowned task state', async () => {
    const findById = jest
        .fn<FindByIdMock>()
        .mockResolvedValue({
          task_id: 'task-1',
          status: 'COMPLETED',
          assigned_worker_id: null,
        });

    const service = new TaskService({
      findById,
    } as unknown as TaskRepository);

    await expect(
        service.getTaskDetail(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        ForbiddenException,
    );
  });

  it('should reject an unexpected owned task state', async () => {
    const findById = jest
        .fn<FindByIdMock>()
        .mockResolvedValue({
          task_id: 'task-1',
          status: 'ESCALATED',
          assigned_worker_id:
              'worker-1',
        });

    const service = new TaskService({
      findById,
    } as unknown as TaskRepository);

    await expect(
        service.getTaskDetail(
            'task-1',
            'worker-1',
        ),
    ).rejects.toBeInstanceOf(
        ForbiddenException,
    );
  });

});