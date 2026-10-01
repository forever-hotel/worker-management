import { jest } from '@jest/globals';
import type { DatabaseService } from '../database.service';
import { ServiceRequestRepository } from './service-request.repository';

describe('ServiceRequestRepository', () => {
  it('should return rows from wkms_service_requests', async () => {
    const queryMock = jest
        .fn<
            (
                text: string,
                params?: unknown[],
            ) => Promise<{ rows: unknown[] }>
        >()
        .mockResolvedValue({
          rows: [],
        });

    const mockDatabaseService = {
      query: queryMock,
    } as unknown as DatabaseService;

    const repository = new ServiceRequestRepository(
        mockDatabaseService,
    );

    const result = await repository.findAll();

    expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('FROM wkms_service_requests'),
    );

    expect(result).toEqual([]);
  });
});