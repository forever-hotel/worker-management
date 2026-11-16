import { jest } from '@jest/globals';
import type { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

type LoginMock = (
    input: {
        username: string;
        password: string;
    },
) => Promise<unknown>;

describe('AuthController', () => {
    it('should pass login credentials to AuthService', async () => {
        const loginResult = {
            access_token: 'token',
            token_type: 'Bearer',
            expires_in: 28800,
            worker: {
                worker_id: 'worker-1',
                full_name: 'Test Worker',
                username: 'worker_001',
                role: 'WORKER',
            },
        };

        const login = jest
            .fn<LoginMock>()
            .mockResolvedValue(loginResult);

        const authService = {
            login,
        } as unknown as AuthService;

        const controller =
            new AuthController(authService);

        const input = {
            username: 'worker_001',
            password: 'password',
        };

        const result =
            await controller.login(input);

        expect(login).toHaveBeenCalledWith(input);
        expect(result).toEqual(loginResult);
    });
});