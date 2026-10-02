import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { DatabaseService } from '../database/database.service';
import { HealthService } from './health.service';

type QueryMock = (
    text: string,
    params?: unknown[],
) => Promise<{ rows: unknown[] }>;

describe('HealthService', () => {
    it('should return liveness without checking the database', () => {
        const query = jest.fn<QueryMock>();

        const databaseService = {
            query,
        } as unknown as DatabaseService;

        const service = new HealthService(databaseService);

        expect(service.getLiveness()).toEqual({
            status: 'ok',
            service: 'wkms',
        });

        expect(query).not.toHaveBeenCalled();
    });

    it('should return ready when the database is available', async () => {
        const query = jest
            .fn<QueryMock>()
            .mockResolvedValue({
                rows: [{ result: 1 }],
            });

        const databaseService = {
            query,
        } as unknown as DatabaseService;

        const service = new HealthService(databaseService);

        await expect(
            service.getReadiness(),
        ).resolves.toEqual({
            status: 'ready',
            service: 'wkms',
            database: 'up',
        });

        expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return service unavailable when the database is unavailable', async () => {
        const query = jest
            .fn<QueryMock>()
            .mockRejectedValue(
                new Error('Database unavailable'),
            );

        const databaseService = {
            query,
        } as unknown as DatabaseService;

        const service = new HealthService(databaseService);

        await expect(
            service.getReadiness(),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });
});