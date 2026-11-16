import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const SERVICE_TOKEN_ENV = 'FDS_WKMS_SERVICE_TOKEN';

@Injectable()
export class FrontDeskServiceGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const configuredToken = this.configService.get<string>(SERVICE_TOKEN_ENV);

    // Fail closed if the integration credential is missing.
    if (typeof configuredToken !== 'string' || configuredToken.length < 32) {
      throw new UnauthorizedException(
        'Front Desk service authentication unavailable',
      );
    }

    const authorization = request.headers.authorization;

    if (
      typeof authorization !== 'string' ||
      !authorization.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException('Invalid service authentication');
    }

    const suppliedToken = authorization.slice(7);

    if (suppliedToken.length < 32 || suppliedToken.length > 4096) {
      throw new UnauthorizedException('Invalid service authentication');
    }

    // Hash both values to compare fixed-length byte arrays.
    // Do not log or return the service credential.
    const suppliedHash = createHash('sha256').update(suppliedToken).digest();

    const configuredHash = createHash('sha256')
      .update(configuredToken)
      .digest();

    if (!timingSafeEqual(suppliedHash, configuredHash)) {
      throw new UnauthorizedException('Invalid service authentication');
    }

    return true;
  }
}
