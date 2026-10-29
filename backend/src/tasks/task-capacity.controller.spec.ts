import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { TaskController } from './task.controller';
import type { TaskService } from './task.service';
import type { AuthenticatedWorker } from '../auth/types/authenticated-worker';

const worker: AuthenticatedWorker = {
  worker_id: '22222222-2222-4222-8222-222222222222',
  username: 'worker_001',
  role: 'WORKER',
};

describe('DDP-200 worker capacity HTTP contract', () => {
  it('returns capacity derived only from JWT worker identity', async () => {
    const getTaskCapacity = jest.fn<(_workerId: string) => Promise<unknown>>()
      .mockResolvedValue({ activeTaskCount: 1, maxActiveTasks: 2, remainingCapacity: 1 });
    const controller = new TaskController({ getTaskCapacity } as unknown as TaskService);
    await expect(controller.getCapacity(worker)).resolves.toMatchObject({
      activeTaskCount: 1,
      maxActiveTasks: 2,
      remainingCapacity: 1,
    });
    expect(getTaskCapacity).toHaveBeenCalledWith(worker.worker_id);
  });

  it('rejects requests without authenticated worker identity', async () => {
    const getTaskCapacity = jest.fn<(_workerId: string) => Promise<unknown>>();
    const controller = new TaskController({ getTaskCapacity } as unknown as TaskService);
    await expect(controller.getCapacity(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getTaskCapacity).not.toHaveBeenCalled();
  });
});
