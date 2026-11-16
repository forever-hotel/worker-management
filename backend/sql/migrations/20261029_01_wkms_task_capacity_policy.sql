-- DDP-200: WKMS-owned, shared maximum active tasks policy.
-- Additive migration. Run on the intended development database first.
-- Managers' configuration UI / authorized cross-service mutation is separate.
BEGIN;

CREATE TABLE IF NOT EXISTS public.wkms_task_policy (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
  max_active_tasks INTEGER NOT NULL DEFAULT 3
    CHECK (max_active_tasks BETWEEN 1 AND 20),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.wkms_task_policy (singleton, max_active_tasks)
VALUES (TRUE, 3)
ON CONFLICT (singleton) DO NOTHING;

COMMIT;
