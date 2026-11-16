import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LoginRequestDto } from './dto/login-request.dto';

export interface StaffSession {
  sub: string;
  username: string;
  role: string;
  roles: string[];
  expiresAt: number;
  passwordChangeRequired: boolean;
}

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  private async call(path: string, token?: string, body?: unknown) {
    try {
      const origin = this.config.getOrThrow<string>('AUTH_SERVICE_URL');
      const response = await fetch(origin + '/wkms/auth/' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      });
      const data = await response.json();
      if (response.status === 401) throw new UnauthorizedException();
      if (response.status === 403) throw new ForbiddenException(data);
      if (!response.ok) throw new ServiceUnavailableException();
      return data;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      )
        throw error;
      throw new ServiceUnavailableException(
        'Staff authentication is unavailable',
      );
    }
  }

  login(input: LoginRequestDto) {
    return this.call('login', undefined, input);
  }

  async session(token: string): Promise<StaffSession> {
    const session = (await this.call('session', token)) as StaffSession;
    if (
      !session ||
      typeof session.sub !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        session.sub,
      ) ||
      typeof session.username !== 'string' ||
      !Array.isArray(session.roles) ||
      !['WORKER', 'ROOT'].includes(session.role) ||
      !Number.isSafeInteger(session.expiresAt) ||
      session.expiresAt * 1000 <= Date.now()
    )
      throw new UnauthorizedException();
    if (session.passwordChangeRequired !== false)
      throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED' });
    return session;
  }
}
