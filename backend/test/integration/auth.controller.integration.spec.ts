import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    JwtModule,
    JwtService,
} from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { ENV_KEYS } from '../../src/config/constants';
import {
    StaffUserAuthRecord,
    StaffUserRepository,
} from '../../src/database/repositories/staff-user.repository';

const TEST_JWT_SECRET =
    'integration-test-secret-at-least-32-characters-long';

type FindByUsernameMock = (
    username: string,
) => Promise<StaffUserAuthRecord | null>;

describe('AuthController integration', () => {
    let app: INestApplication;
    let jwtService: JwtService;

    const findByUsername =
        jest.fn<FindByUsernameMock>();

    beforeAll(async () => {
        const moduleRef =
            await Test.createTestingModule({
                imports: [
                    JwtModule.register({
                        secret: TEST_JWT_SECRET,
                        signOptions: {
                            expiresIn: 28_800,
                        },
                    }),
                ],
                controllers: [
                    AuthController,
                ],
                providers: [
                    AuthService,
                    {
                        provide: StaffUserRepository,
                        useValue: {
                            findByUsername,
                        },
                    },
                    {
                        provide: ConfigService,
                        useValue: {
                            get: <T>(
                                key: string,
                            ): T | undefined => {
                                if (
                                    key ===
                                    ENV_KEYS.JWT_EXPIRES_IN_SECONDS
                                ) {
                                    return 28_800 as T;
                                }

                                return undefined;
                            },
                        },
                    },
                ],
            }).compile();

        app =
            moduleRef.createNestApplication();

        jwtService =
            moduleRef.get(JwtService);

        await app.init();
    });

    beforeEach(() => {
        findByUsername.mockReset();
    });

    afterAll(async () => {
        await app.close();
    });

    async function createWorker(
        overrides: Partial<StaffUserAuthRecord> = {},
    ): Promise<StaffUserAuthRecord> {
        return {
            worker_id: 'worker-1',
            full_name: 'Test Worker',
            username: 'worker_001',
            password_hash: await hash(
                'correct-password',
                4,
            ),
            role: 'WORKER',
            is_active: true,
            ...overrides,
        };
    }

    it('should login an active WORKER and return a valid JWT', async () => {
        const worker =
            await createWorker();

        findByUsername.mockResolvedValue(
            worker,
        );

        const response =
            await request(app.getHttpServer())
                .post('/wkms/auth/login')
                .send({
                    username: 'worker_001',
                    password: 'correct-password',
                })
                .expect(200);

        expect(response.body).toMatchObject({
            token_type: 'Bearer',
            expires_in: 28_800,
            worker: {
                worker_id: 'worker-1',
                full_name: 'Test Worker',
                username: 'worker_001',
                role: 'WORKER',
            },
        });

        expect(
            response.body.access_token,
        ).toEqual(expect.any(String));

        expect(
            response.body.worker,
        ).not.toHaveProperty(
            'password_hash',
        );

        const payload =
            await jwtService.verifyAsync<{
                sub: string;
                username: string;
                role: string;
            }>(
                response.body.access_token,
            );

        expect(payload.sub)
            .toBe('worker-1');

        expect(payload.username)
            .toBe('worker_001');

        expect(payload.role)
            .toBe('WORKER');
    });

    it('should reject an incorrect password', async () => {
        const worker =
            await createWorker();

        findByUsername.mockResolvedValue(
            worker,
        );

        await request(app.getHttpServer())
            .post('/wkms/auth/login')
            .send({
                username: 'worker_001',
                password: 'wrong-password',
            })
            .expect(401);
    });

    it('should reject an inactive worker', async () => {
        const worker =
            await createWorker({
                is_active: false,
            });

        findByUsername.mockResolvedValue(
            worker,
        );

        await request(app.getHttpServer())
            .post('/wkms/auth/login')
            .send({
                username: 'worker_001',
                password: 'correct-password',
            })
            .expect(401);
    });

    it('should reject a non-WORKER account', async () => {
        const worker =
            await createWorker({
                role: 'MANAGER',
            });

        findByUsername.mockResolvedValue(
            worker,
        );

        await request(app.getHttpServer())
            .post('/wkms/auth/login')
            .send({
                username: 'worker_001',
                password: 'correct-password',
            })
            .expect(401);
    });

    it('should reject missing credentials', async () => {
        await request(app.getHttpServer())
            .post('/wkms/auth/login')
            .send({})
            .expect(401);

        expect(findByUsername)
            .not.toHaveBeenCalled();
    });
});