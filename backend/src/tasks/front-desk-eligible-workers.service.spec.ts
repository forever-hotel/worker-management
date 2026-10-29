import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { TaskRepository } from '../database/repositories/task.repository';
import type { WkmsRealtimeGateway } from '../realtime/wkms-realtime.gateway';
import { TaskService } from './task.service';

const TASK_ID = '11111111-1111-4111-8111-111111111111';
type FindById = (id: string) => Promise<unknown>;
type ListWorkers = () => Promise<unknown>;

function setup(status: string | null = 'UNASSIGNED', assigned_worker_id: string | null = null) {
  const findById = jest.fn<FindById>().mockResolvedValue(status ? {
    task_id: TASK_ID, status, assigned_worker_id,
  } : null);
  const findEligibleWorkers = jest.fn<ListWorkers>().mockResolvedValue([{
    workerId: '22222222-2222-4222-8222-222222222222',
    activeTaskCount: 1, maxActiveTasks: 3, remainingCapacity: 2,
  }]);
  const service = new TaskService({ findById, findEligibleWorkers } as unknown as TaskRepository,
    {} as WkmsRealtimeGateway);
  return { service, findById, findEligibleWorkers };
}

describe('DDP-211 eligible workers service', () => {
  it.each(['UNASSIGNED', 'ESCALATED'])('lists candidates for %s task', async status => {
    const { service, findEligibleWorkers } = setup(status);
    const result = await service.getEligibleWorkers(TASK_ID);
    expect(result).toMatchObject({ taskId: TASK_ID, workers: [{ remainingCapacity: 2 }] });
    expect(findEligibleWorkers).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when task is missing', async () => {
    const { service, findEligibleWorkers } = setup(null);
    await expect(service.getEligibleWorkers(TASK_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(findEligibleWorkers).not.toHaveBeenCalled();
  });

  it.each(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'])('returns 409 for %s task', async status => {
    const { service, findEligibleWorkers } = setup(status);
    await expect(service.getEligibleWorkers(TASK_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(findEligibleWorkers).not.toHaveBeenCalled();
  });

  it('does not list candidates when an available-status task already has an owner', async () => {
    const { service, findEligibleWorkers } = setup('ESCALATED', '22222222-2222-4222-8222-222222222222');
    await expect(service.getEligibleWorkers(TASK_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(findEligibleWorkers).not.toHaveBeenCalled();
  });
});
