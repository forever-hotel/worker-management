import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';

type GetQueueMock = () => Promise<unknown[]>;

type ClaimTaskMock = (
    taskId: string,
    workerId: string,
) => Promise<unknown>;

describe('TaskController', () => {
  it('should return the task queue', async () => {
    const getQueue = jest
        .fn<GetQueueMock>()
        .mockResolvedValue([]);

    const mockTaskService = {
      getQueue,
    } as unknown as TaskService;

    const controller = new TaskController(mockTaskService);

    const result = await controller.getQueue();

    expect(getQueue).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should claim a task using the authenticated worker identity', async () => {
    const claimedTask = {
      task_id: 'task-1',
      status: 'ASSIGNED',
      assigned_worker_id: 'worker-1',
    };

    const claimTask = jest
        .fn<ClaimTaskMock>()
        .mockResolvedValue(claimedTask);

    const mockTaskService = {
      claimTask,
    } as unknown as TaskService;

    const controller = new TaskController(mockTaskService);

    const request = {
      user: {
        worker_id: 'worker-1',
      },
    } as Parameters<TaskController['claimTask']>[1];

    const result = await controller.claimTask(
        'task-1',
        request,
    );

    expect(claimTask).toHaveBeenCalledWith(
        'task-1',
        'worker-1',
    );

    expect(result).toEqual(claimedTask);
  });

  it('should reject a claim without an authenticated worker identity', async () => {
    const claimTask = jest.fn<ClaimTaskMock>();

    const mockTaskService = {
      claimTask,
    } as unknown as TaskService;

    const controller = new TaskController(mockTaskService);

    const request = {} as Parameters<
        TaskController['claimTask']
    >[1];

    await expect(
        controller.claimTask('task-1', request),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(claimTask).not.toHaveBeenCalled();
  });
});