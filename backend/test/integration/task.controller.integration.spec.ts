import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import { jest } from '@jest/globals';
import request from 'supertest';
import { TaskService } from '../../src/tasks/task.service';
import { TaskRepository } from '../../src/database/repositories/task.repository';
import { TaskController } from '../../src/tasks/task.controller';

type AuthenticatedRequest = Request & {
  user?: {
    worker_id: string;
  };
};

type FindAllMock = () => Promise<unknown[]>;

type ClaimTaskMock = (
    taskId: string,
    workerId: string,
) => Promise<unknown>;

describe('TaskController integration', () => {
  let app: INestApplication;

  const findAll = jest
      .fn<FindAllMock>()
      .mockResolvedValue([]);

  const claimTask = jest.fn<ClaimTaskMock>();

  beforeAll(async () => {
    claimTask.mockImplementation(
        async (taskId: string, workerId: string) => {
          if (taskId === 'limit-task') {
            throw new Error('ACTIVE_TASK_LIMIT_REACHED');
          }

          return {
            task_id: taskId,
            status: 'ASSIGNED',
            assigned_worker_id: workerId,
          };
        },
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        TaskService,
        {
          provide: TaskRepository,
          useValue: {
            findAll,
            claimTask,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    app.use(
        (
            req: AuthenticatedRequest,
            _res: Response,
            next: NextFunction,
        ) => {
          const workerId = req.header('x-test-worker-id');

          if (workerId) {
            req.user = {
              worker_id: workerId,
            };
          }

          next();
        },
    );

    await app.init();
  });

  beforeEach(() => {
    findAll.mockClear();
    claimTask.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with an empty task queue', async () => {
    await request(app.getHttpServer())
        .get('/tasks/queue')
        .expect(200)
        .expect([]);

    expect(findAll).toHaveBeenCalledTimes(1);
  });

  it('should claim a task for an authenticated worker', async () => {
    await request(app.getHttpServer())
        .post('/tasks/task-1/claim')
        .set('x-test-worker-id', 'worker-1')
        .expect(201)
        .expect({
          task_id: 'task-1',
          status: 'ASSIGNED',
          assigned_worker_id: 'worker-1',
        });

    expect(claimTask).toHaveBeenCalledWith(
        'task-1',
        'worker-1',
    );
  });

  it('should return 401 when worker identity is missing', async () => {
    await request(app.getHttpServer())
        .post('/tasks/task-1/claim')
        .expect(401);

    expect(claimTask).not.toHaveBeenCalled();
  });

  it('should return 409 when the active task limit is reached', async () => {
    await request(app.getHttpServer())
        .post('/tasks/limit-task/claim')
        .set('x-test-worker-id', 'worker-1')
        .expect(409);

    expect(claimTask).toHaveBeenCalledWith(
        'limit-task',
        'worker-1',
    );
  });
});