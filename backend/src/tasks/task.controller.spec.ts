import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedWorker } from '../auth/types/authenticated-worker';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

type GetQueueMock = () => Promise<unknown[]>;

type GetMyTasksMock = (
    workerId: string,
) => Promise<unknown[]>;

type TaskActionMock = (
    taskId: string,
    workerId: string,
) => Promise<unknown>;

const worker: AuthenticatedWorker = {
  worker_id: 'worker-1',
  username: 'worker_001',
  role: 'WORKER',
};

describe('TaskController', () => {
  it('should return the task queue', async () => {
    const getQueue = jest
        .fn<GetQueueMock>()
        .mockResolvedValue([]);

    const mockTaskService = {
      getQueue,
    } as unknown as TaskService;

    const controller =
        new TaskController(mockTaskService);

    const result =
        await controller.getQueue();

    expect(getQueue).toHaveBeenCalled();

    expect(result).toEqual([]);
  });

  it('should return My Tasks using the authenticated worker identity', async () => {
    const tasks = [
      {
        task_id: 'task-1',
        status: 'ASSIGNED',
        assigned_worker_id: 'worker-1',
      },
    ];

    const getMyTasks = jest
        .fn<GetMyTasksMock>()
        .mockResolvedValue(tasks);

    const controller =
        new TaskController({
          getMyTasks,
        } as unknown as TaskService);

    const result =
        await controller.getMyTasks(
            worker,
        );

    expect(
        getMyTasks,
    ).toHaveBeenCalledWith(
        'worker-1',
    );

    expect(result).toEqual(tasks);
  });

  it('should claim a task using the authenticated worker identity', async () => {
    const claimedTask = {
      task_id: 'task-1',
      status: 'ASSIGNED',
      assigned_worker_id: 'worker-1',
    };

    const claimTask = jest
        .fn<TaskActionMock>()
        .mockResolvedValue(claimedTask);

    const controller =
        new TaskController({
          claimTask,
        } as unknown as TaskService);

    const result =
        await controller.claimTask(
            'task-1',
            worker,
        );

    expect(claimTask).toHaveBeenCalledWith(
        'task-1',
        'worker-1',
    );

    expect(result).toEqual(claimedTask);
  });

  it('should start a task using the authenticated worker identity', async () => {
    const startedTask = {
      task_id: 'task-1',
      status: 'IN_PROGRESS',
      assigned_worker_id: 'worker-1',
    };

    const startTask = jest
        .fn<TaskActionMock>()
        .mockResolvedValue(startedTask);

    const controller =
        new TaskController({
          startTask,
        } as unknown as TaskService);

    const result =
        await controller.startTask(
            'task-1',
            worker,
        );

    expect(startTask).toHaveBeenCalledWith(
        'task-1',
        'worker-1',
    );

    expect(result).toEqual(startedTask);
  });

  it('should complete a task using the authenticated worker identity', async () => {
    const completedTask = {
      task_id: 'task-1',
      status: 'COMPLETED',
      assigned_worker_id: 'worker-1',
      completed_at:
          '2026-10-02T12:00:00.000Z',
    };

    const completeTask = jest
        .fn<TaskActionMock>()
        .mockResolvedValue(completedTask);

    const controller =
        new TaskController({
          completeTask,
        } as unknown as TaskService);

    const result =
        await controller.completeTask(
            'task-1',
            worker,
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

  it('should reject My Tasks without an authenticated worker identity', async () => {
    const getMyTasks =
        jest.fn<GetMyTasksMock>();

    const controller =
        new TaskController({
          getMyTasks,
        } as unknown as TaskService);

    await expect(
        controller.getMyTasks(
            undefined,
        ),
    ).rejects.toBeInstanceOf(
        UnauthorizedException,
    );

    expect(getMyTasks)
        .not.toHaveBeenCalled();
  });

  it('should reject a claim without an authenticated worker identity', async () => {
    const claimTask =
        jest.fn<TaskActionMock>();

    const controller =
        new TaskController({
          claimTask,
        } as unknown as TaskService);

    await expect(
        controller.claimTask(
            'task-1',
            undefined,
        ),
    ).rejects.toBeInstanceOf(
        UnauthorizedException,
    );

    expect(claimTask)
        .not.toHaveBeenCalled();
  });

  it('should reject starting a task without an authenticated worker identity', async () => {
    const startTask =
        jest.fn<TaskActionMock>();

    const controller =
        new TaskController({
          startTask,
        } as unknown as TaskService);

    await expect(
        controller.startTask(
            'task-1',
            undefined,
        ),
    ).rejects.toBeInstanceOf(
        UnauthorizedException,
    );

    expect(startTask)
        .not.toHaveBeenCalled();
  });

  it('should reject completing a task without an authenticated worker identity', async () => {
    const completeTask =
        jest.fn<TaskActionMock>();

    const controller =
        new TaskController({
          completeTask,
        } as unknown as TaskService);

    await expect(
        controller.completeTask(
            'task-1',
            undefined,
        ),
    ).rejects.toBeInstanceOf(
        UnauthorizedException,
    );

    expect(completeTask)
        .not.toHaveBeenCalled();
  });
});