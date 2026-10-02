import {
    createParamDecorator,
    ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedWorker } from '../types/authenticated-worker';

type AuthenticatedRequest = Request & {
    user?: AuthenticatedWorker;
};

export const CurrentWorker =
    createParamDecorator(
        (
            _data: unknown,
            context: ExecutionContext,
        ): AuthenticatedWorker | undefined => {
            const request =
                context.switchToHttp().getRequest<AuthenticatedRequest>();

            return request.user;
        },
    );