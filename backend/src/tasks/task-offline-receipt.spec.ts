import { jest } from '@jest/globals';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import type { DatabaseService } from '../database/database.service';
import { TaskRepository } from '../database/repositories/task.repository';
import type { AuthenticatedWorker } from '../auth/types/authenticated-worker';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

const REQUEST_ID = '77777777-7777-4777-8777-777777777777';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const WORKER_ID = '22222222-2222-4222-8222-222222222222';

const worker: AuthenticatedWorker = {
  worker_id: WORKER_ID,
  username: 'test_worker',
  role: 'WORKER',
};

const storedTask = {
  task_id: TASK_ID,
  assigned_worker_id: WORKER_ID,
  status: 'COMPLETED',
};

type StoredReceipt = {
  action: 'START' | 'COMPLETE';
  response_body: unknown;
};

type FindReceiptMock = (input: {
  requestId: string;
  taskId: string;
  workerId: string;
}) => Promise<StoredReceipt | null>;

function setup() {
  const findTaskActionReceipt = jest.fn<FindReceiptMock>();

  const repository = {
    findTaskActionReceipt,
  } as unknown as TaskRepository;

  const service = new TaskService(
    repository,
    {} as ConstructorParameters<typeof TaskService>[1],
  );

  const controller = new TaskController(service);

  return {
    findTaskActionReceipt,
    service,
    controller,
  };
}

describe('DDP-199 offline receipt lookup', () => {
  it('queries the receipt using all three identity fields', async () => {
    const query =
      jest.fn<
        (sql: string, params?: unknown[]) => Promise<{ rows: StoredReceipt[] }>
      >();

    query.mockResolvedValue({
      rows: [
        {
          action: 'COMPLETE',
          response_body: storedTask,
        },
      ],
    });

    const repository = new TaskRepository({
      query,
    } as unknown as DatabaseService);

    const receipt = await repository.findTaskActionReceipt({
      requestId: REQUEST_ID,
      taskId: TASK_ID,
      workerId: WORKER_ID,
    });

    expect(receipt).toMatchObject({
      action: 'COMPLETE',
      response_body: storedTask,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('worker_id = $3::uuid'),
      [REQUEST_ID, TASK_ID, WORKER_ID],
    );
  });

  it('returns the stored result to its original worker', async () => {
    const context = setup();

    context.findTaskActionReceipt.mockResolvedValue({
      action: 'COMPLETE',
      response_body: storedTask,
    });

    const result = await context.controller.getOfflineTaskActionReceipt(
      TASK_ID,
      REQUEST_ID,
      worker,
    );

    expect(context.findTaskActionReceipt).toHaveBeenCalledWith({
      taskId: TASK_ID,
      requestId: REQUEST_ID,
      workerId: WORKER_ID,
    });

    expect(result).toEqual({
      action: 'COMPLETE',
      task: storedTask,
    });
  });

  it('returns 404 when no matching worker receipt exists', async () => {
    const context = setup();

    context.findTaskActionReceipt.mockResolvedValue(null);

    await expect(
      context.service.getOfflineTaskActionReceipt(
        TASK_ID,
        REQUEST_ID,
        WORKER_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an incomplete stored receipt', async () => {
    const context = setup();

    context.findTaskActionReceipt.mockResolvedValue({
      action: 'START',
      response_body: null,
    });

    await expect(
      context.service.getOfflineTaskActionReceipt(
        TASK_ID,
        REQUEST_ID,
        WORKER_ID,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an unauthenticated receipt lookup', async () => {
    const context = setup();

    await expect(
      context.controller.getOfflineTaskActionReceipt(
        TASK_ID,
        REQUEST_ID,
        undefined,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(context.findTaskActionReceipt).not.toHaveBeenCalled();
  });
});
