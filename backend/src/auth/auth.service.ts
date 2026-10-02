import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import {DEFAULT_JWT_EXPIRES_IN_SECONDS, ENV_KEYS} from '../config/constants';
import { StaffUserRepository } from '../database/repositories/staff-user.repository';
import type { LoginRequestDto } from './dto/login-request.dto';
import {WorkerJwtPayload} from "./types/worker-jwt-payload";

@Injectable()
export class AuthService {
    constructor(
        private readonly staffUserRepository: StaffUserRepository,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    async login(input: LoginRequestDto) {
        const username = input?.username?.trim();
        const password = input?.password;

        if (
            !username ||
            typeof password !== 'string' ||
            password.length === 0
        ) {
            throw new UnauthorizedException(
                'Invalid username or password',
            );
        }

        const user =
            await this.staffUserRepository.findByUsername(
                username,
            );

        if (!user) {
            throw new UnauthorizedException(
                'Invalid username or password',
            );
        }

        const passwordMatches = await compare(
            password,
            user.password_hash,
        );

        if (!passwordMatches) {
            throw new UnauthorizedException(
                'Invalid username or password',
            );
        }

        if (!user.is_active || user.role !== 'WORKER') {
            throw new UnauthorizedException(
                'Invalid username or password',
            );
        }

        const payload: WorkerJwtPayload = {
            sub: user.worker_id,
            username: user.username,
            role: 'WORKER',
        };

        const accessToken =
            await this.jwtService.signAsync(payload);

        const expiresInSeconds =
            this.configService.get<number>(
                ENV_KEYS.JWT_EXPIRES_IN_SECONDS,
            ) ?? DEFAULT_JWT_EXPIRES_IN_SECONDS;

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: expiresInSeconds,
            worker: {
                worker_id: user.worker_id,
                full_name: user.full_name,
                username: user.username,
                role: 'WORKER' as const,
            },
        };
    }
}