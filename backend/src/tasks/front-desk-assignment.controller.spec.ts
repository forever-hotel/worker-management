import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FrontDeskServiceGuard } from '../auth/guards/front-desk-service.guard';
import { FrontDeskAssignmentController } from './front-desk-assignment.controller';
import { TaskService } from './task.service';

const TASK_ID = '11111111-1111-4111-8111-111111111111';
const WORKER_ID = '22222222-2222-4222-8222-222222222222';

type AssignMock = (taskId: string, workerId: string) => Promise<unknown>;

function setup() {
  const manuallyAssignTask = jest.fn<AssignMock>();

  manuallyAssignTask.mockResolvedValue({
    task_id: TASK_ID,
    assigned_worker_id: WORKER_ID,
    status: 'ASSIGNED',
  });

  const service = {
    manuallyAssignTask,
  } as unknown as TaskService;

  const controller = new FrontDeskAssignmentController(service);

  return {
    controller,
    manuallyAssignTask,
  };
}

describe('FrontDeskAssignmentController', () => {
  it('requires the Front Desk service guard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      FrontDeskAssignmentController,
    ) as unknown[];

    expect(guards).toContain(FrontDeskServiceGuard);
  });

  it('assigns a task with valid UUID values', async () => {
    const { controller, manuallyAssignTask } = setup();

    const result = await controller.manuallyAssignTask(TASK_ID, {
      workerId: WORKER_ID,
    });

    expect(manuallyAssignTask).toHaveBeenCalledWith(TASK_ID, WORKER_ID);

    expect(result).toMatchObject({
      task_id: TASK_ID,
      assigned_worker_id: WORKER_ID,
      status: 'ASSIGNED',
    });
  });

  it('rejects an invalid task UUID', async () => {
    const { controller, manuallyAssignTask } = setup();

    await expect(
      controller.manuallyAssignTask('invalid-task', { workerId: WORKER_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });

  it('rejects a missing worker ID', async () => {
    const { controller, manuallyAssignTask } = setup();

    await expect(
      controller.manuallyAssignTask(TASK_ID, {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });

  it('rejects an invalid worker UUID', async () => {
    const { controller, manuallyAssignTask } = setup();

    await expect(
      controller.manuallyAssignTask(TASK_ID, { workerId: 'not-a-uuid' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });

  it('rejects a missing request body', async () => {
    const { controller, manuallyAssignTask } = setup();

    await expect(
      controller.manuallyAssignTask(TASK_ID, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });

  it('rejects an array request body', async () => {
    const { controller, manuallyAssignTask } = setup();

    await expect(
      controller.manuallyAssignTask(TASK_ID, [WORKER_ID]),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });

  it('does not accept worker identity solely from another field', async () => {
    const { controller, manuallyAssignTask } = setup();

    await expect(
      controller.manuallyAssignTask(TASK_ID, { assigned_worker_id: WORKER_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manuallyAssignTask).not.toHaveBeenCalled();
  });
});
