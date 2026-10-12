import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../../src/database/database.service';
import { CheckoutTaskRepository } from '../../src/database/repositories/checkout-task.repository';

const localDescribe =
  process.env.RUN_WKMS_DDP78_INTEGRATION === '1' ? describe : describe.skip;

// Deliberately fixed to the disposable local DDP-78 database.
// Never obtain this URL from DATABASE_URL or the application's .env.
const TEST_DATABASE_URL =
  'postgresql://wkms_test:wkms_local_test_only@127.0.0.1:55433/wkms_ddp78_test';

describe('Checkout task PostgreSQL integration', () => {
  localDescribe('isolated Docker database', () => {
    let database: DatabaseService;
    let repository: CheckoutTaskRepository;
    let bookingId: string;
    let roomNumber: string;

    beforeAll(async () => {
      database = new DatabaseService({
        get: (key: string) =>
          key === 'DATABASE_URL' ? TEST_DATABASE_URL : undefined,
      } as unknown as ConfigService);

      await database.onModuleInit();

      const result = await database.query<{ database_name: string }>(
        'SELECT current_database() AS database_name',
      );

      if (result.rows[0]?.database_name !== 'wkms_ddp78_test') {
        throw new Error('Unsafe integration test database');
      }

      repository = new CheckoutTaskRepository(database);
    });

    beforeEach(async () => {
      bookingId = randomUUID();
      roomNumber =
        'D78' + randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

      await database.query(
        `INSERT INTO rooms (room_number, status)
         VALUES ($1, 'REQUIRES_CLEANING')`,
        [roomNumber],
      );

      await database.query(
        `INSERT INTO bookings (booking_id, room_number, status)
         VALUES ($1, $2, 'CHECKED_OUT')`,
        [bookingId, roomNumber],
      );
    });

    afterEach(async () => {
      await database.query('DELETE FROM wkms_tasks WHERE booking_id = $1', [
        bookingId,
      ]);

      await database.query('DELETE FROM bookings WHERE booking_id = $1', [
        bookingId,
      ]);

      await database.query('DELETE FROM rooms WHERE room_number = $1', [
        roomNumber,
      ]);
    });

    afterAll(async () => {
      await database?.onModuleDestroy();
    });

    async function taskCount(): Promise<number> {
      const result = await database.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM wkms_tasks
         WHERE booking_id = $1`,
        [bookingId],
      );

      return result.rows[0].total;
    }

    it('creates a valid checkout cleaning task', async () => {
      const outcome = await repository.createCheckoutCleaningTask(
        bookingId,
        roomNumber,
      );

      expect(outcome.status).toBe('CREATED');

      const result = await database.query(
        `SELECT *
         FROM wkms_tasks
         WHERE task_id = $1`,
        [outcome.taskId],
      );

      expect(result.rows[0]).toMatchObject({
        room_number: roomNumber,
        category: 'ROOM_CLEANING',
        priority: 'HIGH',
        status: 'UNASSIGNED',
        source: 'CHECKOUT_TRIGGER',
        booking_id: bookingId,
        assigned_worker_id: null,
      });

      expect(await taskCount()).toBe(1);
    });

    it('does not create another task for a duplicate event', async () => {
      const first = await repository.createCheckoutCleaningTask(
        bookingId,
        roomNumber,
      );

      const second = await repository.createCheckoutCleaningTask(
        bookingId,
        roomNumber,
      );

      expect(first.status).toBe('CREATED');
      expect(second.status).toBe('EXISTS');
      expect(second.taskId).toBe(first.taskId);
      expect(await taskCount()).toBe(1);
    });

    it('prevents duplicates from eight concurrent deliveries', async () => {
      const attempts = await Promise.all(
        Array.from({ length: 8 }, () =>
          repository.createCheckoutCleaningTask(bookingId, roomNumber),
        ),
      );

      expect(attempts.filter((item) => item.status === 'CREATED')).toHaveLength(
        1,
      );

      expect(attempts.filter((item) => item.status === 'EXISTS')).toHaveLength(
        7,
      );

      expect(new Set(attempts.map((item) => item.taskId)).size).toBe(1);

      expect(await taskCount()).toBe(1);
    });

    it('rejects an event when checkout is not confirmed', async () => {
      await database.query(
        `UPDATE bookings
         SET status = 'CHECKED_IN'
         WHERE booking_id = $1`,
        [bookingId],
      );

      await expect(
        repository.createCheckoutCleaningTask(bookingId, roomNumber),
      ).rejects.toThrow('CHECKOUT_BOOKING_NOT_CONFIRMED');

      expect(await taskCount()).toBe(0);
    });

    it('rejects a conflicting room on duplicate delivery', async () => {
      await repository.createCheckoutCleaningTask(bookingId, roomNumber);

      await expect(
        repository.createCheckoutCleaningTask(bookingId, 'WRONG101'),
      ).rejects.toThrow('CHECKOUT_TASK_ROOM_CONFLICT');

      expect(await taskCount()).toBe(1);
    });

    it('does not recreate a task after it has been completed', async () => {
      const first = await repository.createCheckoutCleaningTask(
        bookingId,
        roomNumber,
      );

      await database.query(
        `UPDATE wkms_tasks
     SET status = 'COMPLETED',
         completed_at = NOW()
     WHERE task_id = $1`,
        [first.taskId],
      );

      const duplicate = await repository.createCheckoutCleaningTask(
        bookingId,
        roomNumber,
      );

      expect(duplicate).toEqual({
        status: 'EXISTS',
        taskId: first.taskId,
      });

      expect(await taskCount()).toBe(1);
    });

    it('rolls back when PostgreSQL fails after task insertion', async () => {
      // Deliberately fail AFTER INSERT so that we can prove
      // the surrounding transaction rolls back.
      await database.query(`
    CREATE OR REPLACE FUNCTION wkms_ddp78_test_fail_insert()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'DDP78_SIMULATED_INSERT_FAILURE';
      RETURN NEW;
    END;
    $$
  `);

      try {
        await database.query(`
      CREATE TRIGGER wkms_ddp78_test_reject_insert
      AFTER INSERT ON wkms_tasks
      FOR EACH ROW
      EXECUTE FUNCTION wkms_ddp78_test_fail_insert()
    `);

        await expect(
          repository.createCheckoutCleaningTask(bookingId, roomNumber),
        ).rejects.toThrow('DDP78_SIMULATED_INSERT_FAILURE');

        // The failed transaction must not leave a task behind.
        expect(await taskCount()).toBe(0);

        // The PostgreSQL connection must still be usable.
        const check = await database.query<{ ok: number }>('SELECT 1 AS ok');

        expect(check.rows[0].ok).toBe(1);
      } finally {
        // Always remove the temporary failure injection.
        await database.query(`
      DROP TRIGGER IF EXISTS
        wkms_ddp78_test_reject_insert
      ON wkms_tasks
    `);

        await database.query(`
      DROP FUNCTION IF EXISTS
        wkms_ddp78_test_fail_insert()
    `);
      }
    });
  });
});
