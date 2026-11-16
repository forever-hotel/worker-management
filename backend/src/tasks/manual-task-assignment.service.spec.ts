import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TaskRepository } from '../database/repositories/task.repository';
import { WkmsRealtimeGateway } from '../realtime/wkms-realtime.gateway';
import { TaskService } from './task.service';

const TASK_ID = '11111111-1111-4111-8111-111111111111';
const WORKER_ID = '22222222-2222-4222-8222-222222222222';

type AssignmentMock = (taskId: string, workerId: string) => Promise<unknown>;

type NotifyMock = (taskId: string) => void;

function setup() {
  const manuallyAssignTask = jest.fn<AssignmentMock>();
  const emitTaskClaimed = jest.fn<NotifyMock>();

  const repository = {
    manuallyAssignTask,
  } as unknown as TaskRepository;

  const gateway = {
    emitTaskClaimed,
  } as unknown as WkmsRealtimeGateway;

  const service = new TaskService(repository, gateway);

  return {
    service,
    manuallyAssignTask,
    emitTaskClaimed,
  };
}

describe('Manual task assignment service', () => {
  it('assigns successfully and notifies after persistence', async () => {
    const context = setup();

    const assignedTask = {
      task_id: TASK_ID,
      status: 'ASSIGNED',
      assigned_worker_id: WORKER_ID,
    };

    context.manuallyAssignTask.mockResolvedValue(assignedTask);

    const result = await context.service.manuallyAssignTask(TASK_ID, WORKER_ID);

    expect(result).toEqual(assignedTask);

    expect(context.manuallyAssignTask).toHaveBeenCalledWith(TASK_ID, WORKER_ID);

    expect(context.emitTaskClaimed).toHaveBeenCalledWith(TASK_ID);

    expect(context.manuallyAssignTask.mock.invocationCallOrder[0]).toBeLessThan(
      context.emitTaskClaimed.mock.invocationCallOrder[0],
    );
  });

  it('returns 404 for an unknown or inactive worker', async () => {
    const context = setup();

    context.manuallyAssignTask.mockRejectedValue(
      new Error('WORKER_NOT_FOUND_OR_INACTIVE'),
    );

    await expect(
      context.service.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(context.emitTaskClaimed).not.toHaveBeenCalled();
  });

  it('returns 404 when the task does not exist', async () => {
    const context = setup();

    context.manuallyAssignTask.mockRejectedValue(new Error('TASK_NOT_FOUND'));

    await expect(
      context.service.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(context.emitTaskClaimed).not.toHaveBeenCalled();
  });

  it('returns 409 when the worker reaches the task limit', async () => {
    const context = setup();

    context.manuallyAssignTask.mockRejectedValue(
      new Error('ACTIVE_TASK_LIMIT_REACHED'),
    );

    await expect(
      context.service.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(context.emitTaskClaimed).not.toHaveBeenCalled();
  });

  it('returns 409 for an unavailable task', async () => {
    const context = setup();

    context.manuallyAssignTask.mockRejectedValue(
      new Error('TASK_NOT_AVAILABLE'),
    );

    await expect(
      context.service.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(context.emitTaskClaimed).not.toHaveBeenCalled();
  });

  it('does not notify when database persistence fails', async () => {
    const context = setup();

    context.manuallyAssignTask.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      context.service.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toThrow('Database unavailable');

    expect(context.emitTaskClaimed).not.toHaveBeenCalled();
  });

  it('propagates unexpected errors without notifying', async () => {
    const context = setup();

    context.manuallyAssignTask.mockRejectedValue(
      new Error('Unexpected assignment error'),
    );

    await expect(
      context.service.manuallyAssignTask(TASK_ID, WORKER_ID),
    ).rejects.toThrow('Unexpected assignment error');

    expect(context.emitTaskClaimed).not.toHaveBeenCalled();
  });

  it('does not notify before the database promise resolves', async () => {
    const context = setup();

    let finishAssignment!: (value: unknown) => void;

    const pendingAssignment = new Promise<unknown>((resolve) => {
      finishAssignment = resolve;
    });

    context.manuallyAssignTask.mockReturnValue(pendingAssignment);

    const operation = context.service.manuallyAssignTask(TASK_ID, WORKER_ID);

    expect(context.emitTaskClaimed).not.toHaveBeenCalled();

    finishAssignment({
      task_id: TASK_ID,
      status: 'ASSIGNED',
      assigned_worker_id: WORKER_ID,
    });

    await operation;

    expect(context.emitTaskClaimed).toHaveBeenCalledTimes(1);
    expect(context.emitTaskClaimed).toHaveBeenCalledWith(TASK_ID);
  });
});
