import { jest } from '@jest/globals';
import { DatabaseService } from './database.service';
import { TaskRepository } from './task.repository';

describe('TaskRepository', () => {
  it('should return rows from wkms_tasks', async () => {
    const mockDatabaseService = {
      query: jest.fn().mockResolvedValue({
        rows: [],
      }),
    } as unknown as DatabaseService;

    const repository = new TaskRepository(mockDatabaseService);

    const result = await repository.findAll();

    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM wkms_tasks'),
    );
    expect(result).toEqual([]);
  });
});
