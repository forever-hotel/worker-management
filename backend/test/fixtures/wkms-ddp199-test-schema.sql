
-- DDP-199: Disposable PostgreSQL integration-test schema.
-- Local test database only. Never apply to Neon or production.

BEGIN;

CREATE TABLE wkms_tasks (
                            task_id UUID PRIMARY KEY,
                            room_number VARCHAR(10) NOT NULL,
                            category VARCHAR(50) NOT NULL,
                            description TEXT,
                            priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
                            status VARCHAR(20) NOT NULL
                                CHECK (status IN (
                                                  'UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS',
                                                  'COMPLETED', 'ESCALATED'
                                    )),
                            assigned_worker_id UUID,
                            submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            completed_at TIMESTAMPTZ,
                            source VARCHAR(30) NOT NULL,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
