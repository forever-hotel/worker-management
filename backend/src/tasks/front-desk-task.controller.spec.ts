import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FrontDeskServiceGuard } from '../auth/guards/front-desk-service.guard';
import { FrontDeskTaskController } from './front-desk-task.controller';
import { FrontDeskTaskService } from './front-desk-task.service';

describe('Front Desk internal HTTP contract', () => {
  let app: INestApplication;
  const token = 'integration-test-private-token-32-characters';
  const service = {
    create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    availableWorkers: jest.fn<() => Promise<unknown>>(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FrontDeskTaskController],
      providers: [
        FrontDeskServiceGuard,
        { provide: ConfigService, useValue: { get: () => token } },
        { provide: FrontDeskTaskService, useValue: service },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());
  it('rejects requests without service credentials before task creation', async () => {
    await request(app.getHttpServer())
      .post('/wkms/internal/tasks')
      .send({ requestId: 'ignored' })
      .expect(401);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('accepts the service credential and forwards only the source identity', async () => {
    service.create.mockResolvedValue({ taskId: 'task-1' });
    const id = '00000000-0000-4000-8000-000000000001';
    await request(app.getHttpServer())
      .post('/wkms/internal/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ requestId: id, roomNumber: 'spoofed' })
      .expect(201, { taskId: 'task-1' });
    expect(service.create).toHaveBeenCalledWith(id);
  });
  it('protects available workers with the same private credential', async () => {
    await request(app.getHttpServer())
      .get('/wkms/internal/workers/available')
      .expect(401);
    service.availableWorkers.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/wkms/internal/workers/available')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);
  });
});
