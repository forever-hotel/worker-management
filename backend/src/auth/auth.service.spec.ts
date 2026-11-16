import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

const session = {
  sub: '66666666-6666-4666-8666-666666666666',
  username: 'staff',
  role: 'WORKER',
  roles: ['RECEPTIONIST', 'WORKER'],
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  passwordChangeRequired: false,
};
describe('Gateway-owned staff authentication', () => {
  const auth = new AuthService(
    new ConfigService({ AUTH_SERVICE_URL: 'http://gateway' }),
  );
  afterEach(() => jest.restoreAllMocks());
  it('delegates login without reading passwords or signing local JWTs', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ ...session, accessToken: 'gateway-token' }),
      );
    expect(
      await auth.login({
        username: 'staff@example.com',
        password: 'private-password',
      }),
    ).toMatchObject({ accessToken: 'gateway-token' });
    expect(fetcher).toHaveBeenCalledWith(
      'http://gateway/wkms/auth/login',
      expect.objectContaining({ method: 'POST', redirect: 'error' }),
    );
  });
  it.each(['WORKER', 'ROOT'])(
    'allows the gateway-authorized %s session',
    async (role) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(Response.json({ ...session, role }));
      expect((await auth.session('token')).role).toBe(role);
    },
  );
  it('revalidates each request so a revoked session cannot remain cached', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json(session))
      .mockResolvedValueOnce(Response.json({}, { status: 401 }));
    await auth.session('token');
    await expect(auth.session('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it('blocks features until the initial password changes', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ ...session, passwordChangeRequired: true }),
      );
    await expect(auth.session('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('fails closed on gateway outage', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(auth.session('token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
