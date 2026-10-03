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

type FindMyActiveTasksMock = (
    workerId: string,
) => Promise<unknown[]>;

type FindByIdMock = (
    taskId: string,
) => Promise<
    Record<string, unknown> | null
>;

type TaskActionMock = (
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

  const findMyActiveTasks =
      jest.fn<FindMyActiveTasksMock>();

  const findById =
      jest.fn<FindByIdMock>();

  const claimTask =
      jest.fn<TaskActionMock>();

  const startTask =
      jest.fn<TaskActionMock>();

  const completeTask =
      jest.fn<TaskActionMock>();

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
                findMyActiveTasks,
                findById,
                claimTask,
                startTask,
                completeTask,
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
    findMyActiveTasks.mockReset();
    findById.mockReset();
    claimTask.mockReset();
    startTask.mockReset();
    completeTask.mockReset();

    findAll.mockResolvedValue([]);

    findMyActiveTasks.mockImplementation(
        async (workerId: string) => [
          {
            task_id: 'task-1',
            status: 'ASSIGNED',
            assigned_worker_id:
            workerId,
          },
        ],
    );

    findById.mockImplementation(
        async (taskId: string) => {
          if (taskId === 'missing-task') {
            return null;
          }

          if (taskId === 'other-worker-task') {
            return {
              task_id: taskId,
              room_number: 'DEMO101',
              category: 'ROOM_CLEANING',
              status: 'ASSIGNED',
              assigned_worker_id:
                  'worker-2',
            };
          }

          if (taskId === 'available-task') {
            return {
              task_id: taskId,
              room_number: 'DEMO101',
              category: 'ROOM_CLEANING',
              status: 'UNASSIGNED',
              assigned_worker_id: null,
            };
          }

          if (taskId === 'owned-task') {
            return {
              task_id: taskId,
              room_number: 'DEMO101',
              category: 'ROOM_CLEANING',
              status: 'ASSIGNED',
              assigned_worker_id:
                  'trusted-worker-1',
            };
          }

          return {
            task_id: taskId,
            room_number: 'DEMO101',
            category: 'ROOM_CLEANING',
            status: 'UNASSIGNED',
            assigned_worker_id: null,
          };
        },
    );

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
            assigned_worker_id:
            workerId,
          };
        },
    );

    startTask.mockImplementation(
        async (
            taskId: string,
            workerId: string,
        ) => {
          if (taskId === 'missing-task') {
            throw new Error(
                'TASK_NOT_FOUND',
            );
          }

          if (taskId === 'other-worker-task') {
            throw new Error(
                'TASK_NOT_OWNED',
            );
          }

          if (taskId === 'invalid-start-task') {
            throw new Error(
                'INVALID_TASK_STATUS',
            );
          }

          return {
            task_id: taskId,
            status: 'IN_PROGRESS',
            assigned_worker_id:
            workerId,
          };
        },
    );

    completeTask.mockImplementation(
        async (
            taskId: string,
            workerId: string,
        ) => {
          if (taskId === 'missing-task') {
            throw new Error(
                'TASK_NOT_FOUND',
            );
          }

          if (taskId === 'other-worker-task') {
            throw new Error(
                'TASK_NOT_OWNED',
            );
          }

          if (
              taskId === 'invalid-complete-task'
          ) {
            throw new Error(
                'INVALID_TASK_STATUS',
            );
          }

          return {
            task_id: taskId,
            status: 'COMPLETED',
            assigned_worker_id:
            workerId,
            completed_at:
                '2026-10-02T12:00:00.000Z',
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

  it('should return My Tasks for the authenticated worker', async () => {
    const token =
        createWorkerToken(
            'trusted-worker-1',
        );

    await request(app.getHttpServer())
        .get('/wkms/tasks/my-tasks')
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(200)
        .expect([
          {
            task_id: 'task-1',
            status: 'ASSIGNED',
            assigned_worker_id:
                'trusted-worker-1',
          },
        ]);

    expect(
        findMyActiveTasks,
    ).toHaveBeenCalledWith(
        'trusted-worker-1',
    );
  });

  it('should reject My Tasks without authentication', async () => {
    await request(app.getHttpServer())
        .get('/wkms/tasks/my-tasks')
        .expect(401);

    expect(
        findMyActiveTasks,
    ).not.toHaveBeenCalled();
  });


  it('should return an available task detail for an authenticated worker', async () => {
    const token =
        createWorkerToken(
            'trusted-worker-1',
        );

    await request(app.getHttpServer())
        .get(
            '/wkms/tasks/available-task',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(200)
        .expect({
          task_id: 'available-task',
          room_number: 'DEMO101',
          category: 'ROOM_CLEANING',
          status: 'UNASSIGNED',
          assigned_worker_id: null,
        });

    expect(findById)
        .toHaveBeenCalledWith(
            'available-task',
        );
  });

  it('should return an owned task detail for the authenticated worker', async () => {
    const token =
        createWorkerToken(
            'trusted-worker-1',
        );

    await request(app.getHttpServer())
        .get(
            '/wkms/tasks/owned-task',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(200)
        .expect({
          task_id: 'owned-task',
          room_number: 'DEMO101',
          category: 'ROOM_CLEANING',
          status: 'ASSIGNED',
          assigned_worker_id:
              'trusted-worker-1',
        });

    expect(findById)
        .toHaveBeenCalledWith(
            'owned-task',
        );
  });

  it('should reject task detail assigned to another worker', async () => {
    const token =
        createWorkerToken(
            'trusted-worker-1',
        );

    await request(app.getHttpServer())
        .get(
            '/wkms/tasks/other-worker-task',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(403);
  });

  it('should return 404 when task detail does not exist', async () => {
    const token =
        createWorkerToken();

    await request(app.getHttpServer())
        .get(
            '/wkms/tasks/missing-task',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(404);
  });

  it('should reject task detail without authentication', async () => {
    await request(app.getHttpServer())
        .get(
            '/wkms/tasks/available-task',
        )
        .expect(401);

    expect(findById)
        .not.toHaveBeenCalled();
  });

  it('should reject task detail for a non-worker role', async () => {
    const token =
        createManagerToken();

    await request(app.getHttpServer())
        .get(
            '/wkms/tasks/available-task',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(403);

    expect(findById)
        .not.toHaveBeenCalled();
  });

    it('should return escalated tasks in the available queue', async () => {
        const token =
            createWorkerToken();

        findAll.mockResolvedValueOnce([
            {
                task_id: 'task-1',
                status: 'UNASSIGNED',
                assigned_worker_id: null,
            },
            {
                task_id: 'task-2',
                status: 'ESCALATED',
                assigned_worker_id: null,
            },
        ]);

        await request(app.getHttpServer())
            .get('/wkms/tasks/queue')
            .set(
                'Authorization',
                `Bearer ${token}`,
            )
            .expect(200)
            .expect([
                {
                    task_id: 'task-1',
                    status: 'UNASSIGNED',
                    assigned_worker_id: null,
                },
                {
                    task_id: 'task-2',
                    status: 'ESCALATED',
                    assigned_worker_id: null,
                },
            ]);

        expect(findAll)
            .toHaveBeenCalledTimes(1);
    });

    it('should allow an authenticated worker to claim an escalated task', async () => {
        const token =
            createWorkerToken(
                'trusted-worker-1',
            );

        await request(app.getHttpServer())
            .post(
                '/wkms/tasks/escalated-task/claim',
            )
            .set(
                'Authorization',
                `Bearer ${token}`,
            )
            .expect(201)
            .expect({
                task_id:
                    'escalated-task',
                status:
                    'ASSIGNED',
                assigned_worker_id:
                    'trusted-worker-1',
            });

        expect(claimTask)
            .toHaveBeenCalledWith(
                'escalated-task',
                'trusted-worker-1',
            );
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

  it('should return 401 when claim authentication is missing', async () => {
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

  it('should start a task using the authenticated worker identity', async () => {
    const token =
        createWorkerToken(
            'trusted-worker-1',
        );

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/task-1/start',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(201)
        .expect({
          task_id: 'task-1',
          status: 'IN_PROGRESS',
          assigned_worker_id:
              'trusted-worker-1',
        });

    expect(startTask)
        .toHaveBeenCalledWith(
            'task-1',
            'trusted-worker-1',
        );
  });

  it('should reject starting another workers task', async () => {
    const token =
        createWorkerToken();

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/other-worker-task/start',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(403);
  });

  it('should return 409 when starting from an invalid status', async () => {
    const token =
        createWorkerToken();

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/invalid-start-task/start',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(409);
  });

  it('should return 404 when starting a missing task', async () => {
    const token =
        createWorkerToken();

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/missing-task/start',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(404);
  });

  it('should reject starting without authentication', async () => {
    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/task-1/start',
        )
        .expect(401);

    expect(startTask)
        .not.toHaveBeenCalled();
  });

  it('should complete a task using the authenticated worker identity', async () => {
    const token =
        createWorkerToken(
            'trusted-worker-1',
        );

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/task-1/complete',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(201)
        .expect({
          task_id: 'task-1',
          status: 'COMPLETED',
          assigned_worker_id:
              'trusted-worker-1',
          completed_at:
              '2026-10-02T12:00:00.000Z',
        });

    expect(completeTask)
        .toHaveBeenCalledWith(
            'task-1',
            'trusted-worker-1',
        );
  });

  it('should reject completing another workers task', async () => {
    const token =
        createWorkerToken();

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/other-worker-task/complete',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(403);
  });

  it('should return 409 when completing from an invalid status', async () => {
    const token =
        createWorkerToken();

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/invalid-complete-task/complete',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(409);
  });

  it('should return 404 when completing a missing task', async () => {
    const token =
        createWorkerToken();

    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/missing-task/complete',
        )
        .set(
            'Authorization',
            `Bearer ${token}`,
        )
        .expect(404);
  });

  it('should reject completing without authentication', async () => {
    await request(app.getHttpServer())
        .post(
            '/wkms/tasks/task-1/complete',
        )
        .expect(401);

    expect(completeTask)
        .not.toHaveBeenCalled();
  });
});