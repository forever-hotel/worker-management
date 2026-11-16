
-- DDP-78: Disposable KMS food-delivery integration test extension.
-- Apply AFTER wkms-ddp78-checkout-schema.sql.
-- Local test database ONLY: wkms_ddp78_test.
-- Not a production migration.

BEGIN;

-- Prevent accidental application to any other database.
DO $$
BEGIN
  IF current_database() <> 'wkms_ddp78_test' THEN
    RAISE EXCEPTION
      'Unsafe database: this fixture requires wkms_ddp78_test';
END IF;
END
$$;

CREATE TYPE food_order_meal_period AS ENUM (
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'TEA_TIME'
);

CREATE TYPE food_order_status AS ENUM (
  'PLACED',
  'IN_PREPARATION',
  'READY',
  'DELIVERED',
  'CANCELLED'
);

-- Minimal KMS table projection needed for integration tests.
-- Uses the approved identifiers, relationships, enums and
-- key status/timestamp constraints.
CREATE TABLE kms_food_orders (
                                 order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                                 booking_id UUID NOT NULL
                                     REFERENCES bookings(booking_id) ON DELETE RESTRICT,

                                 room_number VARCHAR(10) NOT NULL
                                     REFERENCES rooms(room_number) ON DELETE RESTRICT,

                                 meal_period food_order_meal_period NOT NULL,

                                 status food_order_status NOT NULL DEFAULT 'PLACED',

                                 total_amount INTEGER NOT NULL
                                     CHECK (total_amount >= 0),

                                 placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                 preparation_started_at TIMESTAMPTZ,
                                 ready_at TIMESTAMPTZ,
                                 delivered_at TIMESTAMPTZ,
                                 cancelled_at TIMESTAMPTZ,

                                 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                 CONSTRAINT chk_order_timestamp_sequence CHECK (
                                     (ready_at IS NULL OR preparation_started_at IS NOT NULL)
                                         AND
                                     (delivered_at IS NULL OR ready_at IS NOT NULL)
                                     ),

                                 CONSTRAINT chk_cancel_before_preparation CHECK (
                                     cancelled_at IS NULL
                                         OR preparation_started_at IS NULL
                                     )
);

-- The original checkout fixture has food_order_id UNIQUE,
-- but does not yet have the foreign key.
ALTER TABLE wkms_tasks
    ADD CONSTRAINT fk_wkms_tasks_food_order_id
        FOREIGN KEY (food_order_id)
            REFERENCES kms_food_orders(order_id)
            ON DELETE RESTRICT;

COMMIT;
