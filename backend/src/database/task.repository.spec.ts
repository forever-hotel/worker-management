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
});
