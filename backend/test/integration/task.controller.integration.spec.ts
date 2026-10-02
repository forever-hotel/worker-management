import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { WorkerRoleGuard } from '../../src/auth/guards/worker-role.guard';
import { TaskRepository } from '../../src/database/repositories/task.repository';
import { TaskController } from '../../src/tasks/task.controller';
import { TaskService } from '../../src/tasks/task.service';

type FindAllMock = () => Promise<unknown[]>;

type ClaimTaskMock = (
    taskId: string,
    workerId: string,
) => Promise<unknown>;

const TEST_JWT_SECRET =
    'test-jwt-secret-at-least-32-characters-long';

describe('TaskController integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const findAll =
      jest.fn<FindAllMock>();

  const claimTask =
      jest.fn<ClaimTaskMock>();

  beforeAll(async () => {
    const moduleRef =
        await Test.createTestingModule({
          imports: [
            JwtModule.register({
              secret: TEST_JWT_SECRET,
              signOptions: {
                expiresIn: 28_800,
              },
            }),
          ],
          controllers: [
            TaskController,
          ],
          providers: [
            TaskService,
            JwtAuthGuard,
            WorkerRoleGuard,
            {
              provide: TaskRepository,
              useValue: {
                findAll,
                claimTask,
              },
            },
          ],
        }).compile();

    app =
        moduleRef.createNestApplication();

    jwtService =
        moduleRef.get(JwtService);

    await app.init();
  });

  beforeEach(() => {
    findAll.mockReset();
    claimTask.mockReset();

    findAll.mockResolvedValue([]);

    claimTask.mockImplementation(
        async (
            taskId: string,
            workerId: string,
        ) => {
          if (taskId === 'limit-task') {
            throw new Error(
                'ACTIVE_TASK_LIMIT_REACHED',
            );
          }

          return {
            task_id: taskId,
            status: 'ASSIGNED',
            assigned_worker_id: workerId,
          };
        },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  function createWorkerToken(
      workerId = 'worker-1',
  ): string {
    return jwtService.sign({
      sub: workerId,
      username: 'worker_001',
      role: 'WORKER',
    });
  }

  function createManagerToken(): string {
    return jwtService.sign({
      sub: 'manager-1',
      username: 'manager_001',
      role: 'MANAGER',
    });
  }

  it('should return the queue for an authenticated worker', async () => {
    const token =
        createWorkerToken();

    await request(app.getHttpServer())
        .get('/wkms/tasks/queue')
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(200)
        .expect([]);

    expect(findAll)
        .toHaveBeenCalledTimes(1);
  });

  it('should reject the queue when authentication is missing', async () => {
    await request(app.getHttpServer())
        .get('/wkms/tasks/queue')
        .expect(401);

    expect(findAll)
        .not.toHaveBeenCalled();
  });

  it('should reject a non-worker role', async () => {
    const token =
        createManagerToken();

    await request(app.getHttpServer())
        .get('/wkms/tasks/queue')
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(403);

    expect(findAll)
        .not.toHaveBeenCalled();
  });

  it('should claim using the trusted JWT worker identity', async () => {
    const token =
        createWorkerToken(
            'trusted-worker-1',
        );

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/task-1/claim',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .set(
            'x-test-worker-id',
            'attacker-worker',
        )
        .expect(201)
        .expect({
          task_id: 'task-1',
          status: 'ASSIGNED',
          assigned_worker_id:
              'trusted-worker-1',
        });

    expect(claimTask)
        .toHaveBeenCalledWith(
            'task-1',
            'trusted-worker-1',
        );
  });

  it('should return 401 when authentication is missing', async () => {
    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/task-1/claim',
        )
        .expect(401);

    expect(claimTask)
        .not.toHaveBeenCalled();
  });

  it('should return 409 when the active task limit is reached', async () => {
    const token =
        createWorkerToken();

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/limit-task/claim',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(409);

    expect(claimTask)
        .toHaveBeenCalledWith(
            'limit-task',
            'worker-1',
        );
  });
});