import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { StaffUserRepository } from '../database/repositories/staff-user.repository';
import { TaskRepository } from '../database/repositories/task.repository';
import { ShiftService } from './shift.service';


type WorkerSummary = {
    worker_id: string;
    full_name: string;
    vocation: string;
};

type CompletedTaskSummary = {
    task_id: string;
    room_number: string;
    category: string;
    priority: string;
    submitted_at: Date | string;
    completed_at: Date | string;
};

type FindSummaryByIdMock = (
    workerId: string,
) => Promise<
    WorkerSummary | null
>;

type CountActiveTasksMock = (
    workerId: string,
) => Promise<number>;

type CountAvailableEscalatedTasksMock =
    () => Promise<number>;

type FindCompletedTasksForWindowMock = (
    workerId: string,
    startAt: Date,
    endAt: Date,
) => Promise<
    CompletedTaskSummary[]
>;

describe('ShiftService', () => {
    beforeEach(() => {
        jest.useFakeTimers();

        jest.setSystemTime(
            new Date(
                '2026-10-03T10:00:00.000Z',
            ),
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should return the authenticated worker summary', async () => {
        const findSummaryById =
            jest.fn<
                (
                    workerId: string,
                ) => Promise<{
                    worker_id: string;
                    full_name: string;
                    vocation: string;
                } | null>
            >()
                .mockResolvedValue({
                    worker_id:
                        'worker-1',
                    full_name:
                        'Test Worker',
                    vocation:
                        'Housekeeping',
                });

        const countActiveTasks =
            jest.fn<
                (
                    workerId: string,
                ) => Promise<number>
            >()
                .mockResolvedValue(2);

        const countAvailableEscalatedTasks =
            jest.fn<
                () => Promise<number>
            >()
                .mockResolvedValue(1);

        const findCompletedTasksForWindow =
            jest.fn<
                (
                    workerId: string,
                    startAt: Date,
                    endAt: Date,
                ) => Promise<Array<{
                    task_id: string;
                    room_number: string;
                    category: string;
                    priority: string;
                    submitted_at:
                        Date | string;
                    completed_at:
                        Date | string;
                }>>
            >()
                .mockResolvedValue([
                    {
                        task_id: 'task-1',
                        room_number: '101',
                        category:
                            'ROOM_CLEANING',
                        priority: 'NORMAL',
                        submitted_at:
                            '2026-10-03T08:00:00.000Z',
                        completed_at:
                            '2026-10-03T08:30:00.000Z',
                    },
                    {
                        task_id: 'task-2',
                        room_number: '102',
                        category:
                            'EXTRA_TOWELS',
                        priority: 'HIGH',
                        submitted_at:
                            '2026-10-03T09:00:00.000Z',
                        completed_at:
                            '2026-10-03T10:00:00.000Z',
                    },
                ]);

        const service =
            new ShiftService(
                {
                    findSummaryById,
                } as unknown as StaffUserRepository,
                {
                    countActiveTasks,
                    countAvailableEscalatedTasks,
                    findCompletedTasksForWindow,
                } as unknown as TaskRepository,
            );

        const result =
            await service.getSummary(
                'worker-1',
            );

        expect(
            findSummaryById,
        ).toHaveBeenCalledWith(
            'worker-1',
        );

        expect(
            countActiveTasks,
        ).toHaveBeenCalledWith(
            'worker-1',
        );

        expect(
            findCompletedTasksForWindow,
        ).toHaveBeenCalledWith(
            'worker-1',
            new Date(
                '2026-10-03T00:00:00.000Z',
            ),
            new Date(
                '2026-10-04T00:00:00.000Z',
            ),
        );

        expect(result).toEqual({
            operational_day: {
                timezone: 'UTC',
                start_at:
                    '2026-10-03T00:00:00.000Z',
                end_at:
                    '2026-10-04T00:00:00.000Z',
            },

            worker: {
                worker_id:
                    'worker-1',
                full_name:
                    'Test Worker',
                vocation:
                    'Housekeeping',
            },

            active_task_count: 2,

            completed_task_count: 2,

            available_escalated_task_count: 1,

            average_task_turnaround_seconds:
                2700,

            completed_tasks: [
                {
                    task_id:
                        'task-1',
                    room_number:
                        '101',
                    category:
                        'ROOM_CLEANING',
                    priority:
                        'NORMAL',
                    submitted_at:
                        '2026-10-03T08:00:00.000Z',
                    completed_at:
                        '2026-10-03T08:30:00.000Z',
                    turnaround_seconds:
                        1800,
                },
                {
                    task_id:
                        'task-2',
                    room_number:
                        '102',
                    category:
                        'EXTRA_TOWELS',
                    priority:
                        'HIGH',
                    submitted_at:
                        '2026-10-03T09:00:00.000Z',
                    completed_at:
                        '2026-10-03T10:00:00.000Z',
                    turnaround_seconds:
                        3600,
                },
            ],
        });

        expect(result.worker)
            .not.toHaveProperty(
            'password_hash',
        );
    });

    it('should return an empty summary when the worker has no tasks', async () => {
        const findSummaryById =
            jest
                .fn<FindSummaryByIdMock>()
                .mockResolvedValue({
                    worker_id:
                        'worker-1',
                    full_name:
                        'Test Worker',
                    vocation:
                        'Housekeeping',
                });

        const countActiveTasks =
            jest
                .fn<CountActiveTasksMock>()
                .mockResolvedValue(0);

        const countAvailableEscalatedTasks =
            jest
                .fn<CountAvailableEscalatedTasksMock>()
                .mockResolvedValue(0);

        const findCompletedTasksForWindow =
            jest
                .fn<FindCompletedTasksForWindowMock>()
                .mockResolvedValue([]);

        const service =
            new ShiftService(
                {
                    findSummaryById,
                } as unknown as StaffUserRepository,
                {
                    countActiveTasks,
                    countAvailableEscalatedTasks,
                    findCompletedTasksForWindow,
                } as unknown as TaskRepository,
            );

        const result =
            await service.getSummary(
                'worker-1',
            );

        expect(
            result.active_task_count,
        ).toBe(0);

        expect(
            result.completed_task_count,
        ).toBe(0);

        expect(
            result.available_escalated_task_count,
        ).toBe(0);

        expect(
            result.average_task_turnaround_seconds,
        ).toBeNull();

        expect(
            result.completed_tasks,
        ).toEqual([]);
    });

    it('should reject a missing or inactive worker', async () => {
        const findSummaryById =
            jest
                .fn<FindSummaryByIdMock>()
                .mockResolvedValue(null);

        const countActiveTasks =
            jest
                .fn<CountActiveTasksMock>()
                .mockResolvedValue(0);

        const countAvailableEscalatedTasks =
            jest
                .fn<CountAvailableEscalatedTasksMock>()
                .mockResolvedValue(0);

        const findCompletedTasksForWindow =
            jest
                .fn<FindCompletedTasksForWindowMock>()
                .mockResolvedValue([]);

        const service =
            new ShiftService(
                {
                    findSummaryById,
                } as unknown as StaffUserRepository,
                {
                    countActiveTasks,
                    countAvailableEscalatedTasks,
                    findCompletedTasksForWindow,
                } as unknown as TaskRepository,
            );

        await expect(
            service.getSummary(
                'missing-worker',
            ),
        ).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });
});