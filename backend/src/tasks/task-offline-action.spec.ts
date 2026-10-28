import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import type { TaskActionReceiptInput } from '../database/repositories/task-action-idempotency';
import type { TaskRepository } from '../database/repositories/task.repository';
import type { AuthenticatedWorker } from '../auth/types/authenticated-worker';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

const requestId = '77777777-7777-4777-8777-777777777777';
const workerId = '22222222-2222-4222-8222-222222222222';
const taskId = '33333333-3333-4333-8333-333333333333';

const worker: AuthenticatedWorker = {
  worker_id: workerId,
  username: 'test_worker',
  role: 'WORKER',
};

const completedTask = {
  task_id: taskId,
  assigned_worker_id: workerId,
  status: 'COMPLETED',
};

type ReceiptResult = {
  result: Record<string, unknown>;
  replayed: boolean;
};

type ExecuteMock = (input: TaskActionReceiptInput) => Promise<ReceiptResult>;

function createSetup() {
  const executeIdempotentTaskAction = jest.fn<ExecuteMock>();

  const repository = {
    executeIdempotentTaskAction,
  } as unknown as TaskRepository;

  const service = new TaskService(
    repository,
    {} as ConstructorParameters<typeof TaskService>[1],
  );

  const controller = new TaskController(service);

  return {
    executeIdempotentTaskAction,
    service,
    controller,
  };
}

describe('DDP-199 offline task action API', () => {
  it('submits a COMPLETE using authenticated identity', async () => {
    const setup = createSetup();

    setup.executeIdempotentTaskAction.mockResolvedValue({
      result: completedTask,
      replayed: false,
    });

    const response = await setup.controller.submitOfflineTaskAction(
      taskId,
      requestId,
      'COMPLETE',
      worker,
    );

    expect(setup.executeIdempotentTaskAction).toHaveBeenCalledWith({
      taskId,
      requestId,
      workerId,
      action: 'COMPLETE',
    });

    expect(response).toEqual({
      task: completedTask,
      replayed: false,
    });
  });

  it('returns a stored response for an idempotent replay', async () => {
    const setup = createSetup();

    setup.executeIdempotentTaskAction.mockResolvedValue({
      result: completedTask,
      replayed: true,
    });

    const response = await setup.controller.submitOfflineTaskAction(
      taskId,
      requestId,
      'COMPLETE',
      worker,
    );

    expect(response.replayed).toBe(true);
    expect(response.task).toEqual(completedTask);
  });

  it('rejects an invalid action before accessing the repository', async () => {
    const setup = createSetup();

    await expect(
      setup.service.submitOfflineTaskAction({
        taskId,
        requestId,
        workerId,
        action: 'DELETE',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(setup.executeIdempotentTaskAction).not.toHaveBeenCalled();
  });

  it('rejects reuse of a request ID for another action', async () => {
    const setup = createSetup();

    setup.executeIdempotentTaskAction.mockRejectedValue(
      new Error('TASK_ACTION_IDEMPOTENCY_CONFLICT'),
    );

    await expect(
      setup.service.submitOfflineTaskAction({
        taskId,
        requestId,
        workerId,
        action: 'START',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('preserves task ownership enforcement', async () => {
    const setup = createSetup();

    setup.executeIdempotentTaskAction.mockRejectedValue(
      new Error('TASK_NOT_OWNED'),
    );

    await expect(
      setup.service.submitOfflineTaskAction({
        taskId,
        requestId,
        workerId,
        action: 'COMPLETE',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unauthenticated submission', async () => {
    const setup = createSetup();

    await expect(
      setup.controller.submitOfflineTaskAction(
        taskId,
        requestId,
        'START',
        undefined,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(setup.executeIdempotentTaskAction).not.toHaveBeenCalled();
  });
});
