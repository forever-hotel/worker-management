import { jest } from '@jest/globals';
import type { DatabaseService } from '../database.service';
import {
    StaffUserRepository,
    type StaffUserAuthRecord, StaffUserSummaryRecord,
} from './staff-user.repository';

type QueryMock = (
    text: string,
    params?: unknown[],
) => Promise<{
    rows: StaffUserAuthRecord[];
}>;

describe('StaffUserRepository', () => {
    it('should find a staff user by username', async () => {
        const worker: StaffUserAuthRecord = {
            worker_id: 'worker-1',
            full_name: 'Test Worker',
            username: 'worker_001',
            password_hash: 'hashed-password',
            role: 'WORKER',
            is_active: true,
        };

        const query = jest
            .fn<QueryMock>()
            .mockResolvedValue({
                rows: [worker],
            });

        const databaseService = {
            query,
        } as unknown as DatabaseService;

        const repository =
            new StaffUserRepository(
                databaseService,
            );

        const result =
            await repository.findByUsername(
                'worker_001',
            );

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining(
                'FROM staff_users',
            ),
            ['worker_001'],
        );

        expect(result).toEqual(worker);
    });

    it('should return null when the username does not exist', async () => {
        const query = jest
            .fn<QueryMock>()
            .mockResolvedValue({
                rows: [],
            });

        const databaseService = {
            query,
        } as unknown as DatabaseService;

        const repository =
            new StaffUserRepository(
                databaseService,
            );

        const result =
            await repository.findByUsername(
                'missing-worker',
            );

        expect(result).toBeNull();
    });

    it('should return a safe worker summary by id', async () => {
        const worker: StaffUserSummaryRecord = {
            worker_id: 'worker-1',
            full_name: 'Test Worker',
            vocation: 'Housekeeping',
        };

        const query = jest
            .fn<
                (
                    text: string,
                    params?: unknown[],
                ) => Promise<{
                    rows: StaffUserSummaryRecord[];
                }>
            >()
            .mockResolvedValue({
                rows: [worker],
            });

        const repository =
            new StaffUserRepository({
                query,
            } as unknown as DatabaseService);

        const result =
            await repository.findSummaryById(
                'worker-1',
            );

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining(
                'WHERE worker_id = $1',
            ),
            [
                'worker-1',
                'WORKER',
            ],
        );

        expect(result).toEqual(worker);

        expect(result).not.toHaveProperty(
            'password_hash',
        );
    });

    it('should return null when worker summary does not exist', async () => {
        const query = jest
            .fn<
                (
                    text: string,
                    params?: unknown[],
                ) => Promise<{
                    rows: StaffUserSummaryRecord[];
                }>
            >()
            .mockResolvedValue({
                rows: [],
            });

        const repository =
            new StaffUserRepository({
                query,
            } as unknown as DatabaseService);

        const result =
            await repository.findSummaryById(
                'missing-worker',
            );

        expect(result).toBeNull();
    });
});