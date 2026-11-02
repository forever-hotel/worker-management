import { jest } from '@jest/globals';
import { StaffUserRepository } from './staff-user.repository';
import { DatabaseService } from '../database.service';
it('reads active operational identity without retrieving password hashes', async () => {
  const query = jest
    .fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>()
    .mockResolvedValue({
      rows: [
        { worker_id: 'worker', full_name: 'Staff', vocation: 'Housekeeping' },
      ],
    });
  const repository = new StaffUserRepository({
    query,
  } as unknown as DatabaseService);
  expect(await repository.findSummaryById('worker')).toMatchObject({
    worker_id: 'worker',
  });
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining("roles && ARRAY[$2,'ROOT']"),
    ['worker', 'WORKER'],
  );
  expect(query.mock.calls[0][0]).not.toContain('password_hash');
});
