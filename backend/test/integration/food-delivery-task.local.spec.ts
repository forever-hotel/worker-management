import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../../src/database/database.service';
import { FoodDeliveryTaskRepository } from '../../src/database/repositories/food-delivery-task.repository';
import { TaskRepository } from '../../src/database/repositories/task.repository';
import { TaskService } from '../../src/tasks/task.service';

const localDescribe =
  process.env.RUN_WKMS_DDP78_FOOD_INTEGRATION === '1'
    ? describe
    : describe.skip;

localDescribe('DDP-78 KMS food-delivery PostgreSQL integration', () => {
  let database: DatabaseService;
  let repository: FoodDeliveryTaskRepository;

  let bookingId: string;
  let foodOrderId: string;
  let roomNumber: string;

  function getSafeDatabaseUrl(): string {
    const value = process.env.WKMS_DDP78_TEST_DATABASE_URL;

    if (!value) {
      throw new Error('Missing WKMS_DDP78_TEST_DATABASE_URL');
    }

    const url = new URL(value);

    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hostname !== '127.0.0.1' ||
      url.port !== '55433' ||
      url.pathname !== '/wkms_ddp78_test' ||
      url.username !== 'wkms_test'
    ) {
      throw new Error('Unsafe DDP-78 PostgreSQL test target');
    }

    return value;
  }

  async function findTasks() {
    const result = await database.query<{
      task_id: string;
      room_number: string;
      category: string;
      priority: string;
      status: string;
      source: string;
      food_order_id: string;
      booking_id: string | null;
      service_request_id: string | null;
    }>(
      `SELECT
           task_id,
           room_number,
           category,
           priority,
           status,
           source,
           food_order_id,
           booking_id,
           service_request_id
         FROM wkms_tasks
         WHERE food_order_id = $1::uuid`,
      [foodOrderId],
    );

    return result.rows;
  }

  beforeAll(async () => {
    const databaseUrl = getSafeDatabaseUrl();

    database = new DatabaseService({
      get: (key: string) => (key === 'DATABASE_URL' ? databaseUrl : undefined),
    } as unknown as ConfigService);

    await database.onModuleInit();

    const identity = await database.query<{
      database_name: string;
    }>('SELECT current_database() AS database_name');

    if (identity.rows[0]?.database_name !== 'wkms_ddp78_test') {
      throw new Error('Unexpected PostgreSQL database');
    }

    repository = new FoodDeliveryTaskRepository(database);
  });

  beforeEach(async () => {
    bookingId = randomUUID();
    foodOrderId = randomUUID();

    roomNumber =
      'K78' + randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

    await database.query(
      `INSERT INTO rooms (room_number, status)
         VALUES ($1, 'OCCUPIED')`,
      [roomNumber],
    );

    await database.query(
      `INSERT INTO bookings (
          booking_id,
          room_number,
          status
        )
         VALUES ($1, $2, 'CHECKED_IN')`,
      [bookingId, roomNumber],
    );

    await database.query(
      `INSERT INTO kms_food_orders (
          order_id,
          booking_id,
          room_number,
          meal_period,
          status,
          total_amount
        )
         VALUES ($1, $2, $3, 'LUNCH', 'READY', 2500)`,
      [foodOrderId, bookingId, roomNumber],
    );
  });

  afterEach(async () => {
    await database.query(
      `DELETE FROM wkms_tasks
         WHERE food_order_id = $1::uuid`,
      [foodOrderId],
    );

    await database.query(
      `DELETE FROM kms_food_orders
         WHERE order_id = $1::uuid`,
      [foodOrderId],
    );

    await database.query(
      `DELETE FROM bookings
         WHERE booking_id = $1::uuid`,
      [bookingId],
    );

    await database.query(
      `DELETE FROM rooms
         WHERE room_number = $1`,
      [roomNumber],
    );
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
  });

  // TEST 1: Correct task creation
  it('creates a correct food-delivery task for a READY order', async () => {
    const result = await repository.createFoodDeliveryTask(
      foodOrderId,
      roomNumber,
    );

    expect(result.status).toBe('CREATED');
    expect(result.taskId).toBeTruthy();

    const tasks = await findTasks();

    expect(tasks).toHaveLength(1);

    expect(tasks[0]).toMatchObject({
      task_id: result.taskId,
      room_number: roomNumber,
      category: 'FOOD_DELIVERY',
      priority: 'NORMAL',
      status: 'UNASSIGNED',
      source: 'KMS',
      food_order_id: foodOrderId,
      booking_id: null,
      service_request_id: null,
    });
  });

  // TEST 2: Duplicate prevention
  it('does not recreate a task for the same order', async () => {
    const first = await repository.createFoodDeliveryTask(
      foodOrderId,
      roomNumber,
    );

    const second = await repository.createFoodDeliveryTask(
      foodOrderId,
      roomNumber,
    );

    expect(first.status).toBe('CREATED');

    expect(second).toEqual({
      status: 'EXISTS',
      taskId: first.taskId,
    });

    expect(await findTasks()).toHaveLength(1);
  });

  // TEST 3: Concurrent duplicate prevention
  it('creates only one task under eight concurrent attempts', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        repository.createFoodDeliveryTask(foodOrderId, roomNumber),
      ),
    );

    expect(
      attempts.filter((result) => result.status === 'CREATED'),
    ).toHaveLength(1);

    expect(
      attempts.filter((result) => result.status === 'EXISTS'),
    ).toHaveLength(7);

    expect(new Set(attempts.map((result) => result.taskId)).size).toBe(1);

    expect(await findTasks()).toHaveLength(1);
  }, 15_000);

  // TEST 4: Invalid order status
  it('rejects a food order that is not READY', async () => {
    await database.query(
      `UPDATE kms_food_orders
         SET status = 'IN_PREPARATION'
         WHERE order_id = $1::uuid`,
      [foodOrderId],
    );

    await expect(
      repository.createFoodDeliveryTask(foodOrderId, roomNumber),
    ).rejects.toThrow('FOOD_ORDER_NOT_CONFIRMED_READY');

    expect(await findTasks()).toHaveLength(0);
  });

  // TEST 5: Room mismatch protection
  it('rejects a mismatch between event room and order room', async () => {
    await expect(
      repository.createFoodDeliveryTask(foodOrderId, 'WRONG101'),
    ).rejects.toThrow('FOOD_ORDER_NOT_CONFIRMED_READY');

    expect(await findTasks()).toHaveLength(0);
  });

  // TEST 6: Completed task idempotency
  it('does not recreate an already completed delivery task', async () => {
    const first = await repository.createFoodDeliveryTask(
      foodOrderId,
      roomNumber,
    );

    await database.query(
      `UPDATE wkms_tasks
         SET status = 'COMPLETED',
             completed_at = NOW()
         WHERE food_order_id = $1::uuid`,
      [foodOrderId],
    );

    const second = await repository.createFoodDeliveryTask(
      foodOrderId,
      roomNumber,
    );

    expect(second).toEqual({
      status: 'EXISTS',
      taskId: first.taskId,
    });

    const tasks = await findTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe('COMPLETED');
  });

  // TEST 7: Foreign-key integrity
  it('enforces the food-order foreign key', async () => {
    await expect(
      database.query(
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
                    )`,
        [roomNumber, randomUUID()],
      ),
    ).rejects.toMatchObject({
      code: '23503',
    });

    expect(await findTasks()).toHaveLength(0);
  });

  // TEST 8: Worker queue visibility
  it('makes a new food-delivery task visible in the worker queue', async () => {
    const result = await repository.createFoodDeliveryTask(
      foodOrderId,
      roomNumber,
    );

    const taskService = new TaskService(
      new TaskRepository(database),
      { emitTaskClaimed: () => undefined } as unknown as ConstructorParameters<typeof TaskService>[1],
    );

    const availableTasks = await taskService.getQueue();

    expect(availableTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          task_id: result.taskId,
          category: 'FOOD_DELIVERY',
          source: 'KMS',
          status: 'UNASSIGNED',
          room_number: roomNumber,
          food_order_id: foodOrderId,
        }),
      ]),
    );

    // Complete the task to verify that it leaves the available queue.
    await database.query(
      `UPDATE wkms_tasks
         SET status = 'COMPLETED',
             completed_at = NOW()
         WHERE task_id = $1::uuid`,
      [result.taskId],
    );

    const updatedQueue = await taskService.getQueue();

    // Let TypeScript infer PostgreSQL's QueryResultRow type.
    const stillAvailable = updatedQueue.some(
      (task) => task['task_id'] === result.taskId,
    );

    expect(stillAvailable).toBe(false);
  });

  // TEST 9: Transaction rollback
  it('rolls back task creation when a database trigger fails', async () => {
    try {
      await database.query(`
        CREATE FUNCTION ddp78_fail_food_delivery_insert()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RAISE EXCEPTION 'DDP78_TEST_ROLLBACK';
        END;
        $$
      `);

      await database.query(`
        CREATE TRIGGER ddp78_food_delivery_rollback
        AFTER INSERT ON wkms_tasks
        FOR EACH ROW
        WHEN (NEW.source = 'KMS')
        EXECUTE FUNCTION ddp78_fail_food_delivery_insert()
      `);

      await expect(
        repository.createFoodDeliveryTask(foodOrderId, roomNumber),
      ).rejects.toThrow('DDP78_TEST_ROLLBACK');

      // PostgreSQL must roll back the failed INSERT.
      expect(await findTasks()).toHaveLength(0);
    } finally {
      // Remove all disposable test-only database objects.
      await database.query(`
        DROP TRIGGER IF EXISTS ddp78_food_delivery_rollback
        ON wkms_tasks
      `);

      await database.query(`
        DROP FUNCTION IF EXISTS ddp78_fail_food_delivery_insert()
      `);
    }
  });
});
