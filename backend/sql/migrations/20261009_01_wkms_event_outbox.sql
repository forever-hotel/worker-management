-- DDP-77: WKMS transactional outbox
-- Adds only a new WKMS-owned table.
-- Does not alter existing tables.

BEGIN;

CREATE TABLE IF NOT EXISTS wkms_event_outbox (
                                                 event_id TEXT PRIMARY KEY,
                                                 task_id UUID NOT NULL,

                                                 event_type VARCHAR(100) NOT NULL,
    routing_key VARCHAR(150) NOT NULL,
    payload JSONB NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PUBLISHED')),

    attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),

    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
    );

CREATE INDEX IF NOT EXISTS idx_wkms_outbox_pending
    ON wkms_event_outbox (created_at)
    WHERE status = 'PENDING';

COMMIT;