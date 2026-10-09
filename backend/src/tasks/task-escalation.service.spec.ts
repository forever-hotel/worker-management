import { jest } from '@jest/globals';

import { TaskRepository } from '../database/repositories/task.repository';
import { TaskEscalationService } from './task-escalation.service';

type EscalateMock = () => Promise<
  Array<{
    task_id: string;
    category: 'ROOM_CLEANING';
    room_number: string;
    priority: 'HIGH';
    updated_at: string;
  }>
>;

describe('TaskEscalationService', () => {
  const escalateOverdueTasks = jest.fn<EscalateMock>();

  let service: TaskEscalationService;

  beforeEach(() => {
    escalateOverdueTasks.mockReset();
    escalateOverdueTasks.mockResolvedValue([]);

    service = new TaskEscalationService({
      escalateOverdueTasks,
    } as unknown as TaskRepository);
  });

  it('runs the database escalation and outbox operation', async () => {
    escalateOverdueTasks.mockResolvedValue([
      {
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        category: 'ROOM_CLEANING',
        room_number: '205',
        priority: 'HIGH',
        updated_at: '2026-10-09T10:15:00.000Z',
      },
    ]);

    await service.processOverdueTasks();

    expect(escalateOverdueTasks).toHaveBeenCalledTimes(1);
  });

  it('handles a run with no overdue tasks', async () => {
    await service.processOverdueTasks();

    expect(escalateOverdueTasks).toHaveBeenCalledTimes(1);
  });

  it('propagates database failures', async () => {
    escalateOverdueTasks.mockRejectedValue(new Error('Database unavailable'));

    await expect(service.processOverdueTasks()).rejects.toThrow(
      'Database unavailable',
    );
  });

  it('remains safe across repeated scheduler runs', async () => {
    await service.processOverdueTasks();
    await service.processOverdueTasks();

    expect(escalateOverdueTasks).toHaveBeenCalledTimes(2);
  });
});
