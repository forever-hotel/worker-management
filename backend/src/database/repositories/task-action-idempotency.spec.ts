import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';

import {
  executeWithTaskActionReceipt,
  type TaskActionReceiptInput,
} from './task-action-idempotency';

type MockQueryResult = {
  rowCount: number;
  rows: Array<Record<string, unknown>>;
};

type MockQuery = (sql: string, params?: unknown[]) => Promise<MockQueryResult>;

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const WORKER_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';

const input: TaskActionReceiptInput = {
  requestId: REQUEST_ID,
  workerId: WORKER_ID,
  taskId: TASK_ID,
  action: 'START',
};

const startedTask = {
  task_id: TASK_ID,
  assigned_worker_id: WORKER_ID,
  status: 'IN_PROGRESS',
};

function createClient() {
  const query = jest.fn<MockQuery>();

  return {
    query,
    client: {
      query,
    } as unknown as PoolClient,
  };
}

function createAction() {
  return jest
    .fn<() => Promise<Record<string, unknown>>>()
    .mockResolvedValue(startedTask);
}

describe('DDP-199 task action idempotency', () => {
  it('executes a new action and stores its receipt', async () => {
    const { query, client } = createClient();

    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ request_id: REQUEST_ID }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ request_id: REQUEST_ID }],
      });

    const performAction = createAction();

    const result = await executeWithTaskActionReceipt(
      client,
      input,
      performAction,
    );

    expect(result).toEqual({
      result: startedTask,
      replayed: false,
    });

    expect(performAction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);

    expect(query.mock.calls[0][0]).toContain(
      'INSERT INTO wkms_task_action_receipts',
    );

    expect(query.mock.calls[1][0]).toContain(
      'UPDATE wkms_task_action_receipts',
    );

    expect(query.mock.calls[1][1]).toEqual([
      REQUEST_ID,
      JSON.stringify(startedTask),
    ]);
  });

  it('returns a stored result without executing the action again', async () => {
    const { query, client } = createClient();

    query
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            worker_id: WORKER_ID,
            task_id: TASK_ID,
            action: 'START',
            response_body: startedTask,
          },
        ],
      });

    const performAction = createAction();

    const result = await executeWithTaskActionReceipt(
      client,
      input,
      performAction,
    );

    expect(result).toEqual({
      result: startedTask,
      replayed: true,
    });

    expect(performAction).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(2);

    expect(query.mock.calls[1][0]).toContain('FOR UPDATE');
  });

  it.each([
    [
      'different worker',
      {
        worker_id: '44444444-4444-4444-8444-444444444444',
        task_id: TASK_ID,
        action: 'START',
      },
    ],
    [
      'different task',
      {
        worker_id: WORKER_ID,
        task_id: '55555555-5555-4555-8555-555555555555',
        action: 'START',
      },
    ],
    [
      'different action',
      {
        worker_id: WORKER_ID,
        task_id: TASK_ID,
        action: 'COMPLETE',
      },
    ],
  ])(
    'rejects reuse of a request ID for a %s',
    async (_description, existingReceipt) => {
      const { query, client } = createClient();

      query
        .mockResolvedValueOnce({
          rowCount: 0,
          rows: [],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              ...existingReceipt,
              response_body: startedTask,
            },
          ],
        });

      const performAction = createAction();

      await expect(
        executeWithTaskActionReceipt(client, input, performAction),
      ).rejects.toThrow('TASK_ACTION_IDEMPOTENCY_CONFLICT');

      expect(performAction).not.toHaveBeenCalled();
    },
  );

  it('rejects an incomplete existing receipt', async () => {
    const { query, client } = createClient();

    query
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            worker_id: WORKER_ID,
            task_id: TASK_ID,
            action: 'START',
            response_body: null,
          },
        ],
      });

    const performAction = createAction();

    await expect(
      executeWithTaskActionReceipt(client, input, performAction),
    ).rejects.toThrow('TASK_ACTION_RECEIPT_INCOMPLETE');

    expect(performAction).not.toHaveBeenCalled();
  });

  it('does not save a successful receipt when the action fails', async () => {
    const { query, client } = createClient();

    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ request_id: REQUEST_ID }],
    });

    const performAction = jest
      .fn<() => Promise<Record<string, unknown>>>()
      .mockRejectedValue(new Error('INVALID_TASK_STATUS'));

    await expect(
      executeWithTaskActionReceipt(client, input, performAction),
    ).rejects.toThrow('INVALID_TASK_STATUS');

    expect(performAction).toHaveBeenCalledTimes(1);

    // The helper must not store a successful receipt.
    // The surrounding transaction is responsible
    // for rolling back the initial INSERT.
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('fails when the receipt cannot be saved', async () => {
    const { query, client } = createClient();

    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ request_id: REQUEST_ID }],
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

    const performAction = createAction();

    await expect(
      executeWithTaskActionReceipt(client, input, performAction),
    ).rejects.toThrow('TASK_ACTION_RECEIPT_SAVE_FAILED');

    expect(performAction).toHaveBeenCalledTimes(1);
  });
});
