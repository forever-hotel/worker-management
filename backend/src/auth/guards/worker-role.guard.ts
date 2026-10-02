import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedWorker } from '../types/authenticated-worker';

type AuthenticatedRequest = Request & {
    user?: AuthenticatedWorker;
};

@Injectable()
export class WorkerRoleGuard implements CanActivate {
    canActivate(
        context: ExecutionContext,
    ): boolean {
        const request =
            context.switchToHttp().getRequest<AuthenticatedRequest>();

        if (request.user?.role !== 'WORKER') {
            throw new ForbiddenException(
                'Worker role is required',
            );
        }

        return true;
    }
}