
-- DDP-78: Disposable local PostgreSQL checkout-task test fixture
-- Target: wkms_ddp78_test only (Docker port 55433)
-- NOT the production/shared Forever Hotel schema.

BEGIN;

CREATE TYPE booking_status AS ENUM (
  'PENDING', 'CONFIRMED', 'CHECKED_IN',
  'CHECKED_OUT', 'CANCELLED'
);

CREATE TYPE room_status AS ENUM (
  'VACANT', 'OCCUPIED',
  'REQUIRES_CLEANING', 'UNDER_MAINTENANCE'
);

CREATE TYPE task_category AS ENUM (
  'ROOM_CLEANING', 'EXTRA_TOWELS',
  'WATER_BOTTLES', 'MAINTENANCE',
  'LAUNDRY', 'FOOD_DELIVERY', 'OTHER'
);

CREATE TYPE task_priority AS ENUM ('HIGH', 'NORMAL');

CREATE TYPE task_status AS ENUM (
  'UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS',
  'COMPLETED', 'ESCALATED'
);

CREATE TYPE task_source AS ENUM (
  'GUEST_APP', 'FRONT_DESK',
  'CHECKOUT_TRIGGER', 'KMS'
);

CREATE TABLE rooms (
                       room_number VARCHAR(10) PRIMARY KEY,
                       status room_status NOT NULL DEFAULT 'VACANT'
);

CREATE TABLE bookings (
                          booking_id UUID PRIMARY KEY,
                          room_number VARCHAR(10)
                              REFERENCES rooms(room_number) ON DELETE RESTRICT,
                          status booking_status NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE wkms_tasks (
                            task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                            room_number VARCHAR(10) NOT NULL
                                REFERENCES rooms(room_number) ON DELETE RESTRICT,

                            category task_category NOT NULL,
                            description TEXT,

                            priority task_priority NOT NULL DEFAULT 'NORMAL',
                            status task_status NOT NULL DEFAULT 'UNASSIGNED',

                            assigned_worker_id UUID,

                            booking_id UUID
                                REFERENCES bookings(booking_id) ON DELETE RESTRICT,

                            service_request_id UUID UNIQUE,
                            food_order_id UUID UNIQUE,

                            submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            completed_at TIMESTAMPTZ,

                            source task_source NOT NULL,

                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                            CONSTRAINT chk_task_completion CHECK (
                                (status = 'COMPLETED' AND completed_at IS NOT NULL)
                                    OR
                                (status <> 'COMPLETED' AND completed_at IS NULL)
                                ),

                            CONSTRAINT chk_task_source_reference CHECK (
                                (
                                    source IN ('GUEST_APP', 'FRONT_DESK')
                                        AND service_request_id IS NOT NULL
                                        AND food_order_id IS NULL
                                    )
                                    OR
                                (
                                    source = 'KMS'
                                        AND category = 'FOOD_DELIVERY'
                                        AND food_order_id IS NOT NULL
                                        AND service_request_id IS NULL
                                    )
                                    OR
                                (
                                    source = 'CHECKOUT_TRIGGER'
                                        AND booking_id IS NOT NULL
                                        AND service_request_id IS NULL
                                        AND food_order_id IS NULL
                                    )
                                )
);

CREATE TABLE audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,
    event_category TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    staff_user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;