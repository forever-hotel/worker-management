import { jest } from '@jest/globals';
import { DatabaseService } from './database.service';
import { ServiceRequestRepository } from './service-request.repository';

describe('ServiceRequestRepository', () => {
  it('should return rows from wkms_service_requests', async () => {
    const mockDatabaseService = {
      query: jest.fn().mockResolvedValue({
        rows: [],
      }),
    } as unknown as DatabaseService;

    const repository = new ServiceRequestRepository(mockDatabaseService);

    const result = await repository.findAll();

    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM wkms_service_requests'),
    );
    expect(result).toEqual([]);
  });
});
