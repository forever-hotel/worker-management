import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { appendTaskAudit } from './task-audit.repository';

type FoodDeliveryTaskResult = {
  status: 'CREATED' | 'EXISTS';
  taskId: string;
};

type ExistingTask = {
  task_id: string;
  room_number: string;
};

@Injectable()
export class FoodDeliveryTaskRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createFoodDeliveryTask(
    foodOrderId: string,
    roomNumber: string,
  ): Promise<FoodDeliveryTaskResult> {
    const canonicalOrderId = foodOrderId.toLowerCase();

    return this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<ExistingTask>(
        `SELECT task_id, room_number
         FROM wkms_tasks
         WHERE food_order_id = $1::uuid`,
        [canonicalOrderId],
      );

      if (existing.rows[0]) {
        if (existing.rows[0].room_number !== roomNumber) {
          throw new Error('FOOD_DELIVERY_TASK_ROOM_CONFLICT');
        }

        return {
          status: 'EXISTS',
          taskId: existing.rows[0].task_id,
        };
      }

      // Verify the authoritative Kitchen Management order state.
      const order = await client.query<{ order_id: string }>(
        `SELECT order_id
         FROM kms_food_orders
         WHERE order_id = $1::uuid
           AND room_number = $2
           AND status = 'READY'`,
        [canonicalOrderId, roomNumber],
      );

      if (order.rows.length !== 1) {
        throw new Error('FOOD_ORDER_NOT_CONFIRMED_READY');
      }

      const inserted = await client.query<{ task_id: string }>(
        `INSERT INTO wkms_tasks (
          room_number,
          category,
          priority,
          status,
          source,
          food_order_id
        )
         VALUES (
                  $1,
                  'FOOD_DELIVERY',
                  'NORMAL',
                  'UNASSIGNED',
                  'KMS',
                  $2::uuid
                )
           ON CONFLICT (food_order_id) DO NOTHING
         RETURNING task_id`,
        [roomNumber, canonicalOrderId],
      );

      if (inserted.rows[0]) {
        const createdTaskId = inserted.rows[0].task_id;

        // Audit only genuinely new tasks, inside this transaction.
        await appendTaskAudit(client, {
          taskId: createdTaskId,
          action: 'TASK_CREATED',
          actor: {
            type: 'SYSTEM',
          },
          previousStatus: null,
          newStatus: 'UNASSIGNED',
          previousWorkerId: null,
          newWorkerId: null,
        });

        return {
          status: 'CREATED',
          taskId: createdTaskId,
        };
      }

      // Another consumer may have inserted the task concurrently.
      const concurrent = await client.query<ExistingTask>(
        `SELECT task_id, room_number
         FROM wkms_tasks
         WHERE food_order_id = $1::uuid`,
        [canonicalOrderId],
      );

      if (!concurrent.rows[0]) {
        throw new Error('FOOD_DELIVERY_TASK_INSERT_FAILED');
      }

      if (concurrent.rows[0].room_number !== roomNumber) {
        throw new Error('FOOD_DELIVERY_TASK_ROOM_CONFLICT');
      }

      // Existing tasks must not create repeated creation audits.
      return {
        status: 'EXISTS',
        taskId: concurrent.rows[0].task_id,
      };
    });
  }
}
