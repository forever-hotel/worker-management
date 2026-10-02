import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedWorker } from '../types/authenticated-worker';
import type { WorkerJwtPayload } from '../types/worker-jwt-payload';

type AuthenticatedRequest = Request & {
    user?: AuthenticatedWorker;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
    ) {}

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const request =
            context.switchToHttp().getRequest<AuthenticatedRequest>();

        const authorization =
            request.headers.authorization;

        if (!authorization) {
            throw new UnauthorizedException(
                'Authentication is required',
            );
        }

        const [scheme, token] =
            authorization.split(' ');

        if (
            scheme !== 'Bearer' ||
            !token
        ) {
            throw new UnauthorizedException(
                'Authentication is required',
            );
        }

        try {
            const payload =
                await this.jwtService.verifyAsync<WorkerJwtPayload>(
                    token,
                );

            if (
                typeof payload.sub !== 'string' ||
                typeof payload.username !== 'string' ||
                typeof payload.role !== 'string'
            ) {
                throw new UnauthorizedException(
                    'Invalid authentication token',
                );
            }

            request.user = {
                worker_id: payload.sub,
                username: payload.username,
                role: payload.role,
            };

            return true;
        } catch {
            throw new UnauthorizedException(
                'Invalid or expired authentication token',
            );
        }
    }
}