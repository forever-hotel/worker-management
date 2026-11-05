import { jest } from '@jest/globals';
import { FrontDeskTaskService } from './front-desk-task.service';
import { DatabaseService } from '../database/database.service';
import { TaskRepository } from '../database/repositories/task.repository';
import { WkmsRealtimeGateway } from '../realtime/wkms-realtime.gateway';
const requestId = '11111111-1111-4111-8111-111111111111';
function setup(existing = false) {
  const task = {
    task_id: 'task-1',
    room_number: '101',
    category: 'EXTRA_TOWELS',
    status: 'UNASSIGNED',
    priority: 'NORMAL',
    created_at: '2026-11-03T00:00:00Z',
  };
  const query = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ rows: [] });
  query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: existing ? [task] : [] });
  if (!existing)
    query
      .mockResolvedValueOnce({
        rows: [
          {
            room_number: '101',
            category: 'EXTRA_TOWELS',
            description: 'Towels',
            booking_id: 'booking',
            booking_status: 'CHECKED_IN',
            status: 'SUBMITTED',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [task] });
  const emitTaskCreated = jest.fn();
  const database = {
    withTransaction: jest.fn(
      async (fn: (client: unknown) => Promise<unknown>) => fn({ query }),
    ),
  };
  const service = new FrontDeskTaskService(
    database as unknown as DatabaseService,
    {} as TaskRepository,
    { emitTaskCreated } as unknown as WkmsRealtimeGateway,
  );
  return { service, query, emitTaskCreated };
}
describe('FDS-to-WMS source ownership and idempotency', () => {
  it('creates from the committed source record and audits before emitting', async () => {
    const f = setup();
    expect(await f.service.create(requestId)).toMatchObject({
      taskId: 'task-1',
      roomNumber: '101',
    });
    expect(f.query.mock.calls[2][0]).toContain("r.source IN ('FRONT_DESK','GUEST_APP')");
    expect(f.query.mock.calls[4][0]).toContain('INSERT INTO audit_logs');
    expect(f.emitTaskCreated).toHaveBeenCalledWith('task-1');
  });
  it('returns the same task on HTTP retries or RabbitMQ redelivery without a second insert', async () => {
    const f = setup(true);
    expect(await f.service.create(requestId)).toMatchObject({
      taskId: 'task-1',
    });
    expect(f.query).toHaveBeenCalledTimes(2);
    expect(f.emitTaskCreated).not.toHaveBeenCalled();
  });
  it('rejects invalid source IDs before database access', async () => {
    const f = setup();
    await expect(f.service.create('invalid')).rejects.toMatchObject({
      status: 400,
    });
    expect(f.query).not.toHaveBeenCalled();
  });
});
