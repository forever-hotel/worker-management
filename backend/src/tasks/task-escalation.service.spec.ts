import { jest } from '@jest/globals';

import { TaskRepository } from '../database/repositories/task.repository';
import { WkmsRealtimeGateway } from '../realtime/wkms-realtime.gateway';
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
  const emitTaskEscalated = jest.fn<(taskId: string) => void>();

  let service: TaskEscalationService;

  beforeEach(() => {
    escalateOverdueTasks.mockReset();
    escalateOverdueTasks.mockResolvedValue([]);
    emitTaskEscalated.mockClear();

    service = new TaskEscalationService(
      {
        escalateOverdueTasks,
      } as unknown as TaskRepository,
      {
        emitTaskEscalated,
      } as unknown as WkmsRealtimeGateway,
    );
  });

  it('broadcasts after successful database escalation', async () => {
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
    expect(emitTaskEscalated).toHaveBeenCalledTimes(1);
    expect(emitTaskEscalated).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('does not broadcast when no tasks are overdue', async () => {
    await service.processOverdueTasks();

    expect(escalateOverdueTasks).toHaveBeenCalledTimes(1);
    expect(emitTaskEscalated).not.toHaveBeenCalled();
  });

  it('does not broadcast when database escalation fails', async () => {
    escalateOverdueTasks.mockRejectedValue(new Error('Database unavailable'));

    await expect(service.processOverdueTasks()).rejects.toThrow(
      'Database unavailable',
    );

    expect(emitTaskEscalated).not.toHaveBeenCalled();
  });

  it('remains safe across repeated scheduler runs', async () => {
    await service.processOverdueTasks();
    await service.processOverdueTasks();

    expect(escalateOverdueTasks).toHaveBeenCalledTimes(2);
    expect(emitTaskEscalated).not.toHaveBeenCalled();
  });

  it('broadcasts once per successfully escalated task', async () => {
    escalateOverdueTasks.mockResolvedValue([
      {
        task_id: 'task-1',
        category: 'ROOM_CLEANING',
        room_number: '205',
        priority: 'HIGH',
        updated_at: '2026-10-09T10:15:00.000Z',
      },
      {
        task_id: 'task-2',
        category: 'ROOM_CLEANING',
        room_number: '206',
        priority: 'HIGH',
        updated_at: '2026-10-09T10:15:00.000Z',
      },
    ]);

    await service.processOverdueTasks();

    expect(emitTaskEscalated).toHaveBeenCalledTimes(2);
    expect(emitTaskEscalated).toHaveBeenNthCalledWith(1, 'task-1');
    expect(emitTaskEscalated).toHaveBeenNthCalledWith(2, 'task-2');
  });
});
