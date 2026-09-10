import { jest } from '@jest/globals';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TaskRepository } from '../database/task.repository';
import { TaskService } from './task.service';

describe('TaskService', () => {
  it('should return the task queue from the repository', async () => {
    const mockTaskRepository = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as TaskRepository;

    const service = new TaskService(mockTaskRepository);

    const result = await service.getQueue();

    expect(mockTaskRepository.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should claim a task successfully', async () => {
    const claimedTask = {
      task_id: 'task-1',
      status: 'ASSIGNED',
      assigned_worker_id: 'worker-1',
    };

    const mockTaskRepository = {
      claimTask: jest.fn().mockResolvedValue(claimedTask),
    } as unknown as TaskRepository;

    const service = new TaskService(mockTaskRepository);

    const result = await service.claimTask(
      'task-1',
      'worker-1',
    );

    expect(mockTaskRepository.claimTask).toHaveBeenCalledWith(
      'task-1',
      'worker-1',
    );
    expect(result).toEqual(claimedTask);
  });

  it('should return conflict when active task limit is reached', async () => {
    const mockTaskRepository = {
      claimTask: jest
        .fn()
        .mockRejectedValue(
          new Error('ACTIVE_TASK_LIMIT_REACHED'),
        ),
    } as unknown as TaskRepository;

    const service = new TaskService(mockTaskRepository);

    await expect(
      service.claimTask('task-1', 'worker-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should return not found when task does not exist', async () => {
    const mockTaskRepository = {
      claimTask: jest
        .fn()
        .mockRejectedValue(new Error('TASK_NOT_FOUND')),
    } as unknown as TaskRepository;

    const service = new TaskService(mockTaskRepository);

    await expect(
      service.claimTask('task-1', 'worker-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should return conflict when task is no longer available', async () => {
  const mockTaskRepository = {
    claimTask: jest
      .fn()
      .mockRejectedValue(new Error('TASK_NOT_AVAILABLE')),
  } as unknown as TaskRepository;

  const service = new TaskService(mockTaskRepository);

  await expect(
    service.claimTask('task-1', 'worker-1'),
  ).rejects.toBeInstanceOf(ConflictException);
});

it('should return not found when worker is missing or inactive', async () => {
  const mockTaskRepository = {
    claimTask: jest
      .fn()
      .mockRejectedValue(
        new Error('WORKER_NOT_FOUND_OR_INACTIVE'),
      ),
  } as unknown as TaskRepository;

  const service = new TaskService(mockTaskRepository);

  await expect(
    service.claimTask('task-1', 'worker-1'),
  ).rejects.toBeInstanceOf(NotFoundException);
});

});
