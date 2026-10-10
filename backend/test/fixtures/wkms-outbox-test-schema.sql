-- DDP-77 isolated PostgreSQL test fixture
-- Test-only subset of the WKMS schema.
-- Do not use as the canonical production schema.

BEGIN;

CREATE TYPE task_category AS ENUM (
    'ROOM_CLEANING',
    'EXTRA_TOWELS',
    'WATER_BOTTLES',
    'MAINTENANCE',
    'LAUNDRY',
    'FOOD_DELIVERY',
    'OTHER'
);

CREATE TYPE task_priority AS ENUM (
    'HIGH',
    'NORMAL'
);

CREATE TYPE task_status AS ENUM (
    'UNASSIGNED',
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
    'ESCALATED'
);

CREATE TYPE task_source AS ENUM (
    'GUEST_APP',
    'FRONT_DESK',
    'CHECKOUT_TRIGGER',
    'KMS'
);

CREATE TABLE wkms_tasks (
                            task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            room_number VARCHAR(10) NOT NULL,
                            category task_category NOT NULL,
                            description TEXT,
                            priority task_priority NOT NULL DEFAULT 'NORMAL',
                            status task_status NOT NULL DEFAULT 'UNASSIGNED',
                            assigned_worker_id UUID,
                            submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            completed_at TIMESTAMPTZ,
                            source task_source NOT NULL,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;