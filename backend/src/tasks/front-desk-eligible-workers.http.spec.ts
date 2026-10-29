import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FrontDeskServiceGuard } from '../auth/guards/front-desk-service.guard';
import { FrontDeskAssignmentController } from './front-desk-assignment.controller';
import { TaskService } from './task.service';

const TOKEN = 'fds-wkms-test-token-with-at-least-32-characters';
const TASK_ID = '11111111-1111-4111-8111-111111111111';
const endpoint = `/wkms/tasks/${TASK_ID}/eligible-workers`;
type ListMock = (taskId: string) => Promise<unknown>;

describe('DDP-211 Front Desk eligible-workers HTTP authentication', () => {
  let app: INestApplication;
  const getEligibleWorkers = jest.fn<ListMock>();
  beforeAll(async () => {
    getEligibleWorkers.mockResolvedValue({ taskId: TASK_ID, workers: [] });
    const moduleRef = await Test.createTestingModule({
      controllers: [FrontDeskAssignmentController],
      providers: [
        FrontDeskServiceGuard,
        { provide: ConfigService, useValue: { get: (key: string) => key === 'FDS_WKMS_SERVICE_TOKEN' ? TOKEN : undefined } },
        { provide: TaskService, useValue: { getEligibleWorkers } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { getEligibleWorkers.mockClear(); });

  it('denies unauthenticated requests', async () => {
    await request(app.getHttpServer()).get(endpoint).expect(401);
    expect(getEligibleWorkers).not.toHaveBeenCalled();
  });
  it('denies worker JWT tokens', async () => {
    await request(app.getHttpServer()).get(endpoint)
      .set('Authorization', 'Bearer worker.jwt.token').expect(401);
    expect(getEligibleWorkers).not.toHaveBeenCalled();
  });
  it('denies incorrect service tokens', async () => {
    await request(app.getHttpServer()).get(endpoint)
      .set('Authorization', 'Bearer wrong-service-token-with-at-least-32-characters').expect(401);
    expect(getEligibleWorkers).not.toHaveBeenCalled();
  });
  it('returns the authorized candidate list', async () => {
    const response = await request(app.getHttpServer()).get(endpoint)
      .set('Authorization', `Bearer ${TOKEN}`).expect(200);
    expect(response.body).toEqual({ taskId: TASK_ID, workers: [] });
    expect(getEligibleWorkers).toHaveBeenCalledWith(TASK_ID);
  });
  it('rejects malformed task IDs even with a valid token', async () => {
    await request(app.getHttpServer()).get('/wkms/tasks/not-a-uuid/eligible-workers')
      .set('Authorization', `Bearer ${TOKEN}`).expect(400);
    expect(getEligibleWorkers).not.toHaveBeenCalled();
  });
});
