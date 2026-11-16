import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FrontDeskServiceGuard } from '../auth/guards/front-desk-service.guard';
import { FrontDeskAssignmentController } from './front-desk-assignment.controller';
import type { TaskService } from './task.service';

const TASK_ID = '11111111-1111-4111-8111-111111111111';

describe('DDP-211 Front Desk eligible-workers controller', () => {
  it('keeps the service-only guard on the controller', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, FrontDeskAssignmentController) as unknown[];
    expect(guards).toContain(FrontDeskServiceGuard);
  });

  it('forwards an authorized valid task ID to the service', async () => {
    const getEligibleWorkers = jest.fn<(taskId: string) => Promise<unknown>>()
      .mockResolvedValue({ taskId: TASK_ID, workers: [] });
    const controller = new FrontDeskAssignmentController({ getEligibleWorkers } as unknown as TaskService);
    await expect(controller.getEligibleWorkers(TASK_ID)).resolves.toEqual({
      taskId: TASK_ID, workers: [],
    });
    expect(getEligibleWorkers).toHaveBeenCalledWith(TASK_ID);
  });

  it('rejects invalid task identifiers before data access', async () => {
    const getEligibleWorkers = jest.fn<(taskId: string) => Promise<unknown>>();
    const controller = new FrontDeskAssignmentController({ getEligibleWorkers } as unknown as TaskService);
    await expect(controller.getEligibleWorkers('not-a-uuid')).rejects.toBeInstanceOf(BadRequestException);
    expect(getEligibleWorkers).not.toHaveBeenCalled();
  });
});
