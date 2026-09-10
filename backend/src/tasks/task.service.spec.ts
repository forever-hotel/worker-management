import { jest } from '@jest/globals';
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
});
