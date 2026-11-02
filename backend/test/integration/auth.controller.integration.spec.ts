import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
describe('WMS gateway-auth HTTP integration', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ AUTH_SERVICE_URL: 'http://gateway' }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => app.close());
  it('preserves the central first-password-change response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        accessToken: 'gateway-token',
        passwordChangeRequired: true,
        roles: ['WORKER'],
      }),
    );
    const response = await request(app.getHttpServer())
      .post('/wkms/auth/login')
      .send({ username: 'worker', password: 'initial-password' })
      .expect(200);
    expect(response.body.passwordChangeRequired).toBe(true);
  });
  it('rejects central credential failure without local fallback', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({}, { status: 401 }));
    await request(app.getHttpServer())
      .post('/wkms/auth/login')
      .send({ username: 'worker', password: 'wrong' })
      .expect(401);
  });
});
