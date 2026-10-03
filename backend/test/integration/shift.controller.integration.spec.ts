import type {
    INestApplication,
} from '@nestjs/common';
import {
    JwtModule,
    JwtService,
} from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { WorkerRoleGuard } from '../../src/auth/guards/worker-role.guard';
import { ShiftController } from '../../src/shift/shift.controller';
import { ShiftService } from '../../src/shift/shift.service';

const TEST_JWT_SECRET =
    'test-jwt-secret-at-least-32-characters-long';

describe(
    'ShiftController integration',
    () => {
        let app:
            INestApplication;

        let jwtService:
            JwtService;

        const getSummary =
            jest.fn<
                (
                    workerId: string,
                ) => Promise<unknown>
            >();

        beforeAll(async () => {
            const moduleRef =
                await Test
                    .createTestingModule({
                        imports: [
                            JwtModule.register({
                                secret:
                                TEST_JWT_SECRET,
                                signOptions: {
                                    expiresIn:
                                        28_800,
                                },
                            }),
                        ],

                        controllers: [
                            ShiftController,
                        ],

                        providers: [
                            JwtAuthGuard,
                            WorkerRoleGuard,
                            {
                                provide:
                                ShiftService,
                                useValue: {
                                    getSummary,
                                },
                            },
                        ],
                    })
                    .compile();

            app =
                moduleRef
                    .createNestApplication();

            jwtService =
                moduleRef.get(
                    JwtService,
                );

            await app.init();
        });

        beforeEach(() => {
            getSummary.mockReset();

            getSummary
                .mockImplementation(
                    async (
                        workerId:
                        string,
                    ) => ({
                        operational_day: {
                            timezone:
                                'UTC',
                            start_at:
                                '2026-10-03T00:00:00.000Z',
                            end_at:
                                '2026-10-04T00:00:00.000Z',
                        },

                        worker: {
                            worker_id:
                            workerId,
                            full_name:
                                'Test Worker',
                            vocation:
                                'Housekeeping',
                        },

                        active_task_count:
                            1,

                        completed_task_count:
                            0,

                        available_escalated_task_count:
                            2,

                        average_task_turnaround_seconds:
                            null,

                        completed_tasks:
                            [],
                    }),
                );
        });

        afterAll(async () => {
            await app.close();
        });

        function createWorkerToken(
            workerId =
            'trusted-worker-1',
        ): string {
            return jwtService.sign({
                sub: workerId,
                username:
                    'worker_001',
                role:
                    'WORKER',
            });
        }

        function createManagerToken():
            string {
            return jwtService.sign({
                sub:
                    'manager-1',
                username:
                    'manager_001',
                role:
                    'MANAGER',
            });
        }

        it('should return the summary for the authenticated worker', async () => {
            const token =
                createWorkerToken();

            const response =
                await request(
                    app.getHttpServer(),
                )
                    .get(
                        '/wkms/shift/summary',
                    )
                    .set(
                        'Authorization',
                        `Bearer ${token}`,
                    )
                    .expect(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    worker:
                        expect.objectContaining({
                            worker_id:
                                'trusted-worker-1',
                        }),

                    active_task_count:
                        1,

                    available_escalated_task_count:
                        2,
                }),
            );

            expect(
                getSummary,
            ).toHaveBeenCalledWith(
                'trusted-worker-1',
            );
        });

        it('should return 401 without authentication', async () => {
            await request(
                app.getHttpServer(),
            )
                .get(
                    '/wkms/shift/summary',
                )
                .expect(401);

            expect(
                getSummary,
            ).not.toHaveBeenCalled();
        });

        it('should reject a non-worker role', async () => {
            const token =
                createManagerToken();

            await request(
                app.getHttpServer(),
            )
                .get(
                    '/wkms/shift/summary',
                )
                .set(
                    'Authorization',
                    `Bearer ${token}`,
                )
                .expect(403);

            expect(
                getSummary,
            ).not.toHaveBeenCalled();
        });
    },
);