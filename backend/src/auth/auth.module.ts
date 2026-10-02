import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    JwtModule,
    JwtModuleOptions,
} from '@nestjs/jwt';
import {DEFAULT_JWT_EXPIRES_IN_SECONDS, ENV_KEYS} from '../config/constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {JwtAuthGuard} from "./guards/jwt-auth.guard";
import {WorkerRoleGuard} from "./guards/worker-role.guard";

@Module({
    imports: [
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (
                configService: ConfigService,
            ): JwtModuleOptions => {
                const secret =
                    configService.get<string>(
                        ENV_KEYS.JWT_SECRET,
                    );

                const expiresIn =
                    configService.get<number>(
                        ENV_KEYS.JWT_EXPIRES_IN_SECONDS,
                    ) ?? DEFAULT_JWT_EXPIRES_IN_SECONDS;

                if (!secret) {
                    throw new Error(
                        'JWT_SECRET is not configured',
                    );
                }

                return {
                    secret,
                    signOptions: {
                        expiresIn,
                    },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtAuthGuard,
        WorkerRoleGuard,
    ],
    exports: [
        AuthService,
        JwtModule,
        JwtAuthGuard,
        WorkerRoleGuard,
    ],
})
export class AuthModule {}