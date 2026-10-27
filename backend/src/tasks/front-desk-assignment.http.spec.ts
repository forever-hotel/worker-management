import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { FrontDeskServiceGuard } from '../auth/guards/front-desk-service.guard';
import { FrontDeskAssignmentController } from './front-desk-assignment.controller';
import { TaskService } from './task.service';

const TOKEN = 'fds-wkms-test-token-with-at-least-32-characters';

const TASK_ID = '11111111-1111-4111-8111-111111111111';

const WORKER_ID = '22222222-2222-4222-8222-222222222222';

type AssignMock = (taskId: string, workerId: string) => Promise<unknown>;

describe('Front Desk manual assignment HTTP security', () => {
  let app: INestApplication;
  let manuallyAssignTask: jest.Mock<AssignMock>;

  beforeAll(async () => {
    manuallyAssignTask = jest.fn<AssignMock>();

    manuallyAssignTask.mockResolvedValue({
      task_id: TASK_ID,
      assigned_worker_id: WORKER_ID,
      status: 'ASSIGNED',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [FrontDeskAssignmentController],
      providers: [
        FrontDeskServiceGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'FDS_WKMS_SERVICE_TOKEN' ? TOKEN : undefined,
          },
        },
        {
          provide: TaskService,
          useValue: { manuallyAssignTask },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    manuallyAssignTask.mockClear();
  });

  const endpoint = `/wkms/tasks/${TASK_ID}/manual-assign`;

  it('rejects missing authentication with 401', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ workerId: WORKER_ID })
      .expect(401);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });

  it('rejects a worker JWT with 401', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', 'Bearer worker.jwt.token')
      .send({ workerId: WORKER_ID })
      .expect(401);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });

  it('rejects an incorrect service credential with 401', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', 'Bearer wrong-token-with-at-least-32-characters')
      .send({ workerId: WORKER_ID })
      .expect(401);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });

  it('accepts an authorized assignment with 201', async () => {
    const response = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ workerId: WORKER_ID })
      .expect(201);

    expect(response.body).toMatchObject({
      task_id: TASK_ID,
      assigned_worker_id: WORKER_ID,
      status: 'ASSIGNED',
    });

    expect(manuallyAssignTask).toHaveBeenCalledWith(TASK_ID, WORKER_ID);
  });

  it('rejects invalid input even with valid credentials', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ workerId: 'invalid-worker' })
      .expect(400);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });
});
