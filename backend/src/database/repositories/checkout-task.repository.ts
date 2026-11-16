import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { appendTaskAudit } from './task-audit.repository';

export type CheckoutTaskCreationResult = {
  status: 'CREATED' | 'EXISTS';
  taskId: string;
};

type ExistingCheckoutTaskRow = {
  task_id: string;
  room_number: string;
};

type BookingRow = {
  booking_id: string;
};

type CreatedTaskRow = {
  task_id: string;
};

@Injectable()
export class CheckoutTaskRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createCheckoutCleaningTask(
    bookingId: string,
    roomNumber: string,
  ): Promise<CheckoutTaskCreationResult> {
    const canonicalBookingId = bookingId.toLowerCase();

    return this.databaseService.withTransaction(async (client) => {
      // Serialize checkout-task creation for the same booking.
      // Locks are released on COMMIT or ROLLBACK.
      await client.query(
        `SELECT pg_advisory_xact_lock(
           hashtext($1::text),
           hashtext($2::text)
         )`,
        ['wkms.checkout-cleaning.v1', canonicalBookingId],
      );

      // Redelivered events must not create duplicate tasks or audits.
      const existing = await client.query<ExistingCheckoutTaskRow>(
        `SELECT task_id, room_number
         FROM wkms_tasks
         WHERE source = 'CHECKOUT_TRIGGER'
           AND booking_id = $1::uuid
         ORDER BY created_at ASC, task_id ASC
           LIMIT 1`,
        [canonicalBookingId],
      );

      const previousTask = existing.rows[0];

      if (previousTask) {
        if (previousTask.room_number !== roomNumber) {
          throw new Error('CHECKOUT_TASK_ROOM_CONFLICT');
        }

        return {
          status: 'EXISTS',
          taskId: previousTask.task_id,
        };
      }

      // Verify the authoritative Front Desk booking state.
      const booking = await client.query<BookingRow>(
        `SELECT booking_id
         FROM bookings
         WHERE booking_id = $1::uuid
           AND room_number = $2
           AND status = 'CHECKED_OUT'`,
        [canonicalBookingId, roomNumber],
      );

      if (booking.rows.length !== 1) {
        throw new Error('CHECKOUT_BOOKING_NOT_CONFIRMED');
      }

      const inserted = await client.query<CreatedTaskRow>(
        `INSERT INTO wkms_tasks (
          room_number,
          category,
          priority,
          status,
          source,
          booking_id
        )
         VALUES (
                  $1,
                  'ROOM_CLEANING',
                  'HIGH',
                  'UNASSIGNED',
                  'CHECKOUT_TRIGGER',
                  $2::uuid
                )
           RETURNING task_id`,
        [roomNumber, canonicalBookingId],
      );

      const createdTask = inserted.rows[0];

      if (!createdTask) {
        throw new Error('CHECKOUT_TASK_INSERT_FAILED');
      }

      // The task and its audit must commit together.
      await appendTaskAudit(client, {
        taskId: createdTask.task_id,
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
        taskId: createdTask.task_id,
      };
    });
  }
}
