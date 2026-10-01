import { jest } from '@jest/globals';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TaskRepository } from '../database/repositories/task.repository';
import { TaskService } from './task.service';

type FindAllMock = () => Promise<unknown[]>;

type ClaimTaskMock = (
    taskId: string,
    workerId: string,
) => Promise<unknown>;

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
});