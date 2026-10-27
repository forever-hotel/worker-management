import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../database.service';
import { CheckoutTaskRepository } from './checkout-task.repository';

const BOOKING_ID = '47f608e3-94d7-4e25-96ad-b32acb45d6e1';
const TASK_ID = '9e2cc9c6-8933-4de5-b40d-dc9cd12950c6';

type MockResult = {
  rowCount: number;
  rows: Record<string, unknown>[];
};

function result(rows: Record<string, unknown>[] = []): MockResult {
  return { rowCount: rows.length, rows };
}

function createContext() {
  const query =
    jest.fn<(sql: string, params?: unknown[]) => Promise<MockResult>>();

  const client = { query } as unknown as PoolClient;

  const withTransaction = async <T>(
    callback: (transactionClient: PoolClient) => Promise<T>,
  ): Promise<T> => callback(client);

  const database = {
    withTransaction,
  } as unknown as DatabaseService;

  return {
    query,
    repository: new CheckoutTaskRepository(database),
  };
}

describe('CheckoutTaskRepository', () => {
  it('creates a high-priority checkout cleaning task', async () => {
    const { query, repository } = createContext();

    query
      .mockResolvedValueOnce(result([{}])) // advisory lock
      .mockResolvedValueOnce(result()) // no existing task
      .mockResolvedValueOnce(result([{ booking_id: BOOKING_ID }]))
      .mockResolvedValueOnce(result([{ task_id: TASK_ID }]));

    const created = await repository.createCheckoutCleaningTask(
      BOOKING_ID,
      'DEMO101',
    );

    expect(created).toEqual({
      status: 'CREATED',
      taskId: TASK_ID,
    });

    expect(query).toHaveBeenCalledTimes(5);

    expect(query.mock.calls[4][0]).toContain(
      'INSERT INTO audit_logs',
    );

    expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');

    expect(query.mock.calls[1][0]).toContain("source = 'CHECKOUT_TRIGGER'");

    expect(query.mock.calls[2][0]).toContain("status = 'CHECKED_OUT'");

    expect(query.mock.calls[3][0]).toContain("'ROOM_CLEANING'");

    expect(query.mock.calls[3][0]).toContain("'HIGH'");
    expect(query.mock.calls[3][0]).toContain("'UNASSIGNED'");
    expect(query.mock.calls[3][0]).toContain("'CHECKOUT_TRIGGER'");

    expect(query.mock.calls[3][1]).toEqual(['DEMO101', BOOKING_ID]);
  });

  it('returns the existing task for a duplicate event', async () => {
    const { query, repository } = createContext();

    query
      .mockResolvedValueOnce(result([{}]))
      .mockResolvedValueOnce(
        result([{ task_id: TASK_ID, room_number: 'DEMO101' }]),
      );

    const outcome = await repository.createCheckoutCleaningTask(
      BOOKING_ID,
      'DEMO101',
    );

    expect(outcome).toEqual({
      status: 'EXISTS',
      taskId: TASK_ID,
    });

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rejects a mismatched room on a duplicate event', async () => {
    const { query, repository } = createContext();

    query
      .mockResolvedValueOnce(result([{}]))
      .mockResolvedValueOnce(
        result([{ task_id: TASK_ID, room_number: 'DEMO101' }]),
      );

    await expect(
      repository.createCheckoutCleaningTask(BOOKING_ID, 'DEMO102'),
    ).rejects.toThrow('CHECKOUT_TASK_ROOM_CONFLICT');

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rejects an unconfirmed checkout', async () => {
    const { query, repository } = createContext();

    query
      .mockResolvedValueOnce(result([{}]))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());

    await expect(
      repository.createCheckoutCleaningTask(BOOKING_ID, 'DEMO101'),
    ).rejects.toThrow('CHECKOUT_BOOKING_NOT_CONFIRMED');

    expect(query).toHaveBeenCalledTimes(3);
  });

  it('propagates an insertion failure', async () => {
    const { query, repository } = createContext();

    query
      .mockResolvedValueOnce(result([{}]))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ booking_id: BOOKING_ID }]))
      .mockRejectedValueOnce(new Error('Database insert failed'));

    await expect(
      repository.createCheckoutCleaningTask(BOOKING_ID, 'DEMO101'),
    ).rejects.toThrow('Database insert failed');
  });

  it('rejects an insert without a returned task ID', async () => {
    const { query, repository } = createContext();

    query
      .mockResolvedValueOnce(result([{}]))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ booking_id: BOOKING_ID }]))
      .mockResolvedValueOnce(result());

    await expect(
      repository.createCheckoutCleaningTask(BOOKING_ID, 'DEMO101'),
    ).rejects.toThrow('CHECKOUT_TASK_INSERT_FAILED');
  });

  it('normalizes booking UUID case for the advisory lock', async () => {
    const { query, repository } = createContext();

    query
      .mockResolvedValueOnce(result([{}]))
      .mockResolvedValueOnce(
        result([{ task_id: TASK_ID, room_number: 'DEMO101' }]),
      );

    await repository.createCheckoutCleaningTask(
      BOOKING_ID.toUpperCase(),
      'DEMO101',
    );

    expect(query.mock.calls[0][1]).toEqual([
      'wkms.checkout-cleaning.v1',
      BOOKING_ID,
    ]);
  });
});
