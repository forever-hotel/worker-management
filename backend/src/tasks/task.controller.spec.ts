import { jest } from '@jest/globals';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';

describe('TaskController', () => {
  it('should return the task queue', async () => {
    const mockTaskService = {
      getQueue: jest.fn().mockResolvedValue([]),
    } as unknown as TaskService;

    const controller = new TaskController(mockTaskService);

    const result = await controller.getQueue();

    expect(mockTaskService.getQueue).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
