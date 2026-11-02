import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/auth/auth.service';
export const centralSessionStub = {
  provide: AuthService,
  inject: [JwtService],
  useFactory: (jwt: JwtService) => ({
    session: async (token: string) => {
      try {
        const payload = await jwt.verifyAsync(token);
        if (
          typeof payload.sub !== 'string' ||
          typeof payload.username !== 'string' ||
          typeof payload.role !== 'string'
        )
          throw new Error();
        return {
          ...payload,
          username: payload.username,
          roles: [payload.role],
          expiresAt: payload.exp,
          passwordChangeRequired: false,
        };
      } catch {
        throw new UnauthorizedException();
      }
    },
  }),
};
