import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';

import type { DatabaseService } from '../database.service';
import { FoodDeliveryTaskRepository } from './food-delivery-task.repository';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TASK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ROOM_NUMBER = 'R101';

type MockQueryResult = {
  rows: Array<Record<string, unknown>>;
};

type MockQuery = (sql: string, params?: unknown[]) => Promise<MockQueryResult>;

function setup() {
  const query = jest.fn<MockQuery>();

  const client = {
    query,
  } as unknown as PoolClient;

  const databaseService = {
    withTransaction: async <T>(
      callback: (transactionClient: PoolClient) => Promise<T>,
    ): Promise<T> => callback(client),
  } as unknown as DatabaseService;

  return {
    query,
    repository: new FoodDeliveryTaskRepository(databaseService),
  };
}

describe('FoodDeliveryTaskRepository', () => {
  it('creates an unassigned food-delivery task for a READY order', async () => {
    const { query, repository } = setup();

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ order_id: ORDER_ID }],
      })
      .mockResolvedValueOnce({
        rows: [{ task_id: TASK_ID }],
      });

    const result = await repository.createFoodDeliveryTask(
      ORDER_ID,
      ROOM_NUMBER,
    );

    expect(result).toEqual({
      status: 'CREATED',
      taskId: TASK_ID,
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("status = 'READY'"),
      [ORDER_ID, ROOM_NUMBER],
    );

    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('ON CONFLICT (food_order_id) DO NOTHING'),
      [ROOM_NUMBER, ORDER_ID],
    );

    const insertSql = query.mock.calls[2]?.[0] ?? '';

    expect(insertSql).toContain("'FOOD_DELIVERY'");
    expect(insertSql).toContain("'NORMAL'");
    expect(insertSql).toContain("'UNASSIGNED'");
    expect(insertSql).toContain("'KMS'");

    expect(query).toHaveBeenCalledTimes(4);

    expect(query.mock.calls[3][0]).toContain(
      'INSERT INTO audit_logs',
    );
  });

  it('does not recreate an existing food-delivery task', async () => {
    const { query, repository } = setup();

    query.mockResolvedValueOnce({
      rows: [
        {
          task_id: TASK_ID,
          room_number: ROOM_NUMBER,
        },
      ],
    });

    const result = await repository.createFoodDeliveryTask(
      ORDER_ID,
      ROOM_NUMBER,
    );

    expect(result).toEqual({
      status: 'EXISTS',
      taskId: TASK_ID,
    });

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects an existing task with a conflicting room', async () => {
    const { query, repository } = setup();

    query.mockResolvedValueOnce({
      rows: [
        {
          task_id: TASK_ID,
          room_number: 'R999',
        },
      ],
    });

    await expect(
      repository.createFoodDeliveryTask(ORDER_ID, ROOM_NUMBER),
    ).rejects.toThrow('FOOD_DELIVERY_TASK_ROOM_CONFLICT');

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects an order that is not confirmed READY', async () => {
    const { query, repository } = setup();

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      repository.createFoodDeliveryTask(ORDER_ID, ROOM_NUMBER),
    ).rejects.toThrow('FOOD_ORDER_NOT_CONFIRMED_READY');

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('returns the existing task after a concurrent insert conflict', async () => {
    const { query, repository } = setup();

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ order_id: ORDER_ID }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            task_id: TASK_ID,
            room_number: ROOM_NUMBER,
          },
        ],
      });

    const result = await repository.createFoodDeliveryTask(
      ORDER_ID,
      ROOM_NUMBER,
    );

    expect(result).toEqual({
      status: 'EXISTS',
      taskId: TASK_ID,
    });

    expect(query).toHaveBeenCalledTimes(4);
  });

  it('rejects a concurrent insert with a conflicting room', async () => {
    const { query, repository } = setup();

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ order_id: ORDER_ID }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            task_id: TASK_ID,
            room_number: 'R999',
          },
        ],
      });

    await expect(
      repository.createFoodDeliveryTask(ORDER_ID, ROOM_NUMBER),
    ).rejects.toThrow('FOOD_DELIVERY_TASK_ROOM_CONFLICT');
  });

  it('rejects a missing task after an unsuccessful insert', async () => {
    const { query, repository } = setup();

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ order_id: ORDER_ID }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      repository.createFoodDeliveryTask(ORDER_ID, ROOM_NUMBER),
    ).rejects.toThrow('FOOD_DELIVERY_TASK_INSERT_FAILED');
  });

  it('normalizes uppercase order UUIDs', async () => {
    const { query, repository } = setup();

    query.mockResolvedValueOnce({
      rows: [
        {
          task_id: TASK_ID,
          room_number: ROOM_NUMBER,
        },
      ],
    });

    const result = await repository.createFoodDeliveryTask(
      ORDER_ID.toUpperCase(),
      ROOM_NUMBER,
    );

    expect(result.status).toBe('EXISTS');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE food_order_id = $1::uuid'),
      [ORDER_ID],
    );
  });

  it('propagates database failures instead of treating them as success', async () => {
    const { query, repository } = setup();

    query.mockRejectedValueOnce(new Error('Database temporarily unavailable'));

    await expect(
      repository.createFoodDeliveryTask(ORDER_ID, ROOM_NUMBER),
    ).rejects.toThrow('Database temporarily unavailable');

    expect(query).toHaveBeenCalledTimes(1);
  });
});
