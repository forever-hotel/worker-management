import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FrontDeskServiceGuard } from './front-desk-service.guard';

const VALID_TOKEN = 'wkms-fds-test-service-token-2026-minimum-32-chars';

function createContext(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization,
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

function createGuard(configuredToken?: string): FrontDeskServiceGuard {
  const configService = {
    get: (key: string) =>
      key === 'FDS_WKMS_SERVICE_TOKEN' ? configuredToken : undefined,
  } as unknown as ConfigService;

  return new FrontDeskServiceGuard(configService);
}

describe('FrontDeskServiceGuard', () => {
  it('accepts the configured service credential', () => {
    const guard = createGuard(VALID_TOKEN);

    expect(guard.canActivate(createContext(`Bearer ${VALID_TOKEN}`))).toBe(
      true,
    );
  });

  it('rejects missing authentication', () => {
    const guard = createGuard(VALID_TOKEN);

    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an incorrect credential', () => {
    const guard = createGuard(VALID_TOKEN);

    expect(() =>
      guard.canActivate(
        createContext('Bearer incorrect-service-token-of-sufficient-length'),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects ordinary worker-style tokens', () => {
    const guard = createGuard(VALID_TOKEN);

    expect(() =>
      guard.canActivate(createContext('Bearer worker.jwt.token')),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a missing server configuration', () => {
    const guard = createGuard();

    expect(() =>
      guard.canActivate(createContext(`Bearer ${VALID_TOKEN}`)),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an insecurely short server credential', () => {
    const guard = createGuard('short-secret');

    expect(() =>
      guard.canActivate(createContext('Bearer short-secret')),
    ).toThrow(UnauthorizedException);
  });

  it('rejects credentials without Bearer scheme', () => {
    const guard = createGuard(VALID_TOKEN);

    expect(() => guard.canActivate(createContext(VALID_TOKEN))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects excessively long credentials', () => {
    const guard = createGuard(VALID_TOKEN);

    expect(() =>
      guard.canActivate(createContext(`Bearer ${'x'.repeat(4097)}`)),
    ).toThrow(UnauthorizedException);
  });
});
