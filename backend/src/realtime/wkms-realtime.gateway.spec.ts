import { jest } from '@jest/globals';
import { AuthService } from '../auth/auth.service';
import { WkmsRealtimeGateway } from './wkms-realtime.gateway';
import type { Namespace } from 'socket.io';
describe('WMS socket gateway auth', () => {
  it('authenticates HttpOnly-cookie connections through the same central session service', async () => {
    const session = jest.fn<() => Promise<unknown>>().mockResolvedValue({
      sub: 'worker',
      role: 'WORKER',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    const gateway = new WkmsRealtimeGateway({
      session,
    } as unknown as AuthService);
    let middleware:
      | ((socket: unknown, next: (error?: Error) => void) => Promise<void>)
      | undefined;
    gateway.afterInit({
      use: (callback: typeof middleware) => {
        middleware = callback;
      },
    } as unknown as Namespace);
    const socket = {
      handshake: {
        auth: {},
        headers: {
          cookie: 'wms_session=central-token',
          origin: 'http://localhost:3002',
        },
      },
      data: {},
    };
    const next = jest.fn();
    await middleware!(socket, next);
    expect(session).toHaveBeenCalledWith('central-token');
    expect(next).toHaveBeenCalledWith();
  });
  it('rejects central deactivation or revocation', async () => {
    const gateway = new WkmsRealtimeGateway({
      session: jest
        .fn<() => Promise<unknown>>()
        .mockRejectedValue(new Error('revoked')),
    } as unknown as AuthService);
    let middleware:
      | ((socket: unknown, next: (error?: Error) => void) => Promise<void>)
      | undefined;
    gateway.afterInit({
      use: (callback: typeof middleware) => {
        middleware = callback;
      },
    } as unknown as Namespace);
    const next = jest.fn();
    await middleware!(
      { handshake: { auth: { token: 'revoked' }, headers: {} }, data: {} },
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
