import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../database.service';
import { TaskRepository } from './task.repository';

it.each([true, false])(
  'completes the task only if the linked kitchen order can be delivered (%s)',
  async (ready) => {
    const query =
      jest.fn<
        (
          ...args: unknown[]
        ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>
      >();
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          task_id: 'task',
          status: 'IN_PROGRESS',
          assigned_worker_id: 'worker',
        },
      ],
    });
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          task_id: 'task',
          status: 'COMPLETED',
          category: 'FOOD_DELIVERY',
          food_order_id: 'order',
          room_number: '103',
        },
      ],
    });
    query.mockResolvedValueOnce({
      rowCount: ready ? 1 : 0,
      rows: ready ? [{ order_id: 'order' }] : [],
    });
    query.mockResolvedValue({ rowCount: 1, rows: [] });
    const client = { query } as unknown as PoolClient;
    const repository = new TaskRepository({} as DatabaseService);
    const result = repository.completeTaskInTransaction(
      client,
      'task',
      'worker',
    );
    if (ready)
      await expect(result).resolves.toMatchObject({ status: 'COMPLETED' });
    else
      await expect(result).rejects.toThrow('FOOD_ORDER_NOT_READY_FOR_DELIVERY');
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('UPDATE public.kms_food_orders'),
      ['order', '103'],
    );
    expect(query).toHaveBeenCalledTimes(ready ? 5 : 3);
  },
);
