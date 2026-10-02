import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { ENV_KEYS } from '../config/constants';
import type {
    StaffUserAuthRecord,
    StaffUserRepository,
} from '../database/repositories/staff-user.repository';
import { AuthService } from './auth.service';

type FindByUsernameMock = (
    username: string,
) => Promise<StaffUserAuthRecord | null>;

type SignAsyncMock = (
    payload: Record<string, unknown>,
) => Promise<string>;

function createWorker(
    overrides: Partial<StaffUserAuthRecord> = {},
): StaffUserAuthRecord {
    return {
        worker_id: 'worker-1',
        full_name: 'Test Worker',
        username: 'worker_001',
        password_hash: '',
        role: 'WORKER',
        is_active: true,
        ...overrides,
    };
}

function createAuthService(
    findByUsername: FindByUsernameMock,
    signAsync: SignAsyncMock,
    expiresInSeconds: number | undefined = 28_800,
) {
    const staffUserRepository = {
        findByUsername,
    } as unknown as StaffUserRepository;

    const jwtService = {
        signAsync,
    } as unknown as JwtService;

    const configService = {
        get: <T>(key: string): T | undefined => {
            if (
                key === ENV_KEYS.JWT_EXPIRES_IN_SECONDS
            ) {
                return expiresInSeconds as T | undefined;
            }

            return undefined;
        },
    } as unknown as ConfigService;

    return new AuthService(
        staffUserRepository,
        jwtService,
        configService,
    );
}

describe('AuthService', () => {
    it('should authenticate an active WORKER and issue a token', async () => {
        const passwordHash = await hash(
            'correct-password',
            4,
        );

        const worker = createWorker({
            password_hash: passwordHash,
        });

        const findByUsername = jest
            .fn<FindByUsernameMock>()
            .mockResolvedValue(worker);

        const signAsync = jest
            .fn<SignAsyncMock>()
            .mockResolvedValue('signed-token');

        const service = createAuthService(
            findByUsername,
            signAsync,
            7200,
        );

        const result = await service.login({
            username: ' worker_001 ',
            password: 'correct-password',
        });

        expect(findByUsername).toHaveBeenCalledWith(
            'worker_001',
        );

        expect(signAsync).toHaveBeenCalledWith({
            sub: 'worker-1',
            username: 'worker_001',
            role: 'WORKER',
        });

        expect(result).toEqual({
            access_token: 'signed-token',
            token_type: 'Bearer',
            expires_in: 7200,
            worker: {
                worker_id: 'worker-1',
                full_name: 'Test Worker',
                username: 'worker_001',
                role: 'WORKER',
            },
        });

        expect(result.worker).not.toHaveProperty(
            'password_hash',
        );
    });

    it('should reject a blank username', async () => {
        const findByUsername =
            jest.fn<FindByUsernameMock>();

        const signAsync =
            jest.fn<SignAsyncMock>();

        const service = createAuthService(
            findByUsername,
            signAsync,
        );

        await expect(
            service.login({
                username: '   ',
                password: 'password',
            }),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        expect(findByUsername)
            .not.toHaveBeenCalled();
    });

    it('should reject an empty password', async () => {
        const findByUsername =
            jest.fn<FindByUsernameMock>();

        const signAsync =
            jest.fn<SignAsyncMock>();

        const service = createAuthService(
            findByUsername,
            signAsync,
        );

        await expect(
            service.login({
                username: 'worker_001',
                password: '',
            }),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        expect(findByUsername)
            .not.toHaveBeenCalled();
    });

    it('should reject a missing worker account', async () => {
        const findByUsername = jest
            .fn<FindByUsernameMock>()
            .mockResolvedValue(null);

        const signAsync =
            jest.fn<SignAsyncMock>();

        const service = createAuthService(
            findByUsername,
            signAsync,
        );

        await expect(
            service.login({
                username: 'unknown',
                password: 'password',
            }),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        expect(signAsync).not.toHaveBeenCalled();
    });

    it('should reject an incorrect password', async () => {
        const passwordHash = await hash(
            'correct-password',
            4,
        );

        const worker = createWorker({
            password_hash: passwordHash,
        });

        const findByUsername = jest
            .fn<FindByUsernameMock>()
            .mockResolvedValue(worker);

        const signAsync =
            jest.fn<SignAsyncMock>();

        const service = createAuthService(
            findByUsername,
            signAsync,
        );

        await expect(
            service.login({
                username: 'worker_001',
                password: 'wrong-password',
            }),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        expect(signAsync).not.toHaveBeenCalled();
    });

    it('should reject an inactive worker', async () => {
        const passwordHash = await hash(
            'correct-password',
            4,
        );

        const worker = createWorker({
            password_hash: passwordHash,
            is_active: false,
        });

        const findByUsername = jest
            .fn<FindByUsernameMock>()
            .mockResolvedValue(worker);

        const signAsync =
            jest.fn<SignAsyncMock>();

        const service = createAuthService(
            findByUsername,
            signAsync,
        );

        await expect(
            service.login({
                username: 'worker_001',
                password: 'correct-password',
            }),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        expect(signAsync).not.toHaveBeenCalled();
    });

    it('should reject a non-WORKER role', async () => {
        const passwordHash = await hash(
            'correct-password',
            4,
        );

        const worker = createWorker({
            password_hash: passwordHash,
            role: 'MANAGER',
        });

        const findByUsername = jest
            .fn<FindByUsernameMock>()
            .mockResolvedValue(worker);

        const signAsync =
            jest.fn<SignAsyncMock>();

        const service = createAuthService(
            findByUsername,
            signAsync,
        );

        await expect(
            service.login({
                username: 'worker_001',
                password: 'correct-password',
            }),
        ).rejects.toBeInstanceOf(
            UnauthorizedException,
        );

        expect(signAsync).not.toHaveBeenCalled();
    });

    it('should use the default token lifetime when configuration is absent', async () => {
        const passwordHash = await hash(
            'correct-password',
            4,
        );

        const worker = createWorker({
            password_hash: passwordHash,
        });

        const findByUsername = jest
            .fn<FindByUsernameMock>()
            .mockResolvedValue(worker);

        const signAsync = jest
            .fn<SignAsyncMock>()
            .mockResolvedValue('signed-token');

        const service = createAuthService(
            findByUsername,
            signAsync,
            undefined,
        );

        const result = await service.login({
            username: 'worker_001',
            password: 'correct-password',
        });

        expect(result.expires_in).toBe(28800);
    });
});