
-- DDP-199: Idempotency receipts for offline task synchronization.
-- WKMS-owned table. Does not modify existing task records.
--
-- Each accepted START or COMPLETE operation will store its
-- receipt in the same transaction as the task transition.
-- A retry with the same request ID must return the stored
-- response, not repeat the transition or its side effects.

BEGIN;

CREATE TABLE IF NOT EXISTS wkms_task_action_receipts (
                                                         request_id UUID PRIMARY KEY,

                                                         worker_id UUID NOT NULL,
                                                         task_id UUID NOT NULL,

                                                         action VARCHAR(16) NOT NULL
    CHECK (action IN ('START', 'COMPLETE')),

    response_body JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT wkms_task_action_receipt_response_object
    CHECK (
              response_body IS NULL
              OR jsonb_typeof(response_body) = 'object'
    )
    );

CREATE INDEX IF NOT EXISTS idx_wkms_task_action_receipts_worker
    ON wkms_task_action_receipts (worker_id, created_at DESC);

COMMIT;
