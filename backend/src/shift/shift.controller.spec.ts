import { jest } from '@jest/globals';
import {
    UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedWorker } from '../auth/types/authenticated-worker';
import { ShiftController } from './shift.controller';
import { ShiftService } from './shift.service';

describe('ShiftController', () => {
    it('should use the authenticated JWT worker identity', async () => {
        const getSummary =
            jest.fn<
                (
                    workerId: string,
                ) => Promise<unknown>
            >()
                .mockResolvedValue({
                    active_task_count: 0,
                });

        const controller =
            new ShiftController({
                getSummary,
            } as unknown as ShiftService);

        const worker:
            AuthenticatedWorker = {
            worker_id:
                'trusted-worker-1',
            username:
                'worker_001',
            role:
                'WORKER',
        };

        await controller.getSummary(
            worker,
        );

        expect(
            getSummary,
        ).toHaveBeenCalledWith(
            'trusted-worker-1',
        );
    });

    it('should reject a missing authenticated worker identity', async () => {
        const getSummary =
            jest.fn<
                (
                    workerId: string,
                ) => Promise<unknown>
            >();

        const controller =
            new ShiftController({
                getSummary,
            } as unknown as ShiftService);

        await expect(
            controller.getSummary(
                undefined,
            ),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        expect(
            getSummary,
        ).not.toHaveBeenCalled();
    });
});