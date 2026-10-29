# DDP-200 — Configurable task limits and claiming UX

This patch is based on `develop` after PR #65 was merged (commit `502cbae74545f0913da2d180715baf3636e3deb9`).

## What changes

- One WKMS-owned PostgreSQL policy row, seeded to **3 active tasks**, configurable to **1–20**.
- Existing worker claim and Front Desk manual assignment both read the same policy **inside their worker-locked transaction**. No bypass through frontend values.
- Adds JWT-worker-only `GET /wkms/tasks/capacity`, returning `activeTaskCount`, `maxActiveTasks`, `remainingCapacity`.
- Frontend fetches the effective policy; disables Claim when full, disconnected, busy or policy is unknown, displays the limit, and refreshes after claims and task changes.
- Claim errors from unavailable tasks (403/404/409) refresh both task collections. Other errors are not falsely reported as success.
- Adds backend/controller/frontend regression cases while preserving existing offline/receipt paths.

## One-time migration (development database first)

Paste `backend/sql/migrations/20261029_01_wkms_task_capacity_policy.sql` into Neon SQL Editor on the **WKMS development branch**, not production.

Read-only verification:

```sql
SELECT singleton, max_active_tasks FROM public.wkms_task_policy;
```

Expected one row, `TRUE / 3`. Do **not** change the value until integration tests have confirmed the default.

The WKMS **policy is authoritative**. A future Manager Dashboard integration can update it through an approved, authenticated manager backend; there is deliberately no unauthenticated policy mutation route. If the manager-self-service API is required immediately, it needs the agreed MAD authorization contract; this patch does not invent one.

For a development-only test of configurable values, use a **test DB branch** and a controlled transaction:

```sql
BEGIN;
UPDATE public.wkms_task_policy
SET max_active_tasks = 2, updated_at = NOW()
WHERE singleton = TRUE;
SELECT max_active_tasks FROM public.wkms_task_policy;
ROLLBACK;
```

The SELECT inside this transaction proves the policy is writable without leaving a changed value. To verify actual assignment enforcement against 2, run the integration scenario in an isolated test database, not against live operational tasks.

## Apply

Run at repository root on `feature/200-wkms-claim-limits`:

```powershell
node .\ddp200-patch\apply_ddp200.cjs
```

Node.js is already installed in the WKMS development environment. No Python installation is required.

The script refuses to run on the wrong branch and validates all source anchors **before writing any file**. It edits only intended WKMS files and adds the new migration, tests and documentation. It does not push to GitHub.

## Local verification

```powershell
cd backend
$env:NODE_OPTIONS = "--experimental-vm-modules"
npx.cmd jest --runInBand
Remove-Item Env:\NODE_OPTIONS
npm.cmd run test:typecheck
npm.cmd run lint
npm.cmd run build
cd ..\frontend
npm.cmd run test:coverage
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

Note: existing PG integration suites need their usual test DB environment and are skipped in the standard Jest run. Run concurrency/integration suites in isolated PostgreSQL before closing issue 200.

## Git and PR

After tests pass, stage and review the intended changes (include the new SQL migration and tests). Add a CHANGELOG line such as `- DDP-200: Configurable active task limits, shared claiming rules and capacity-aware WKMS task queue.`.

```
git diff --check
git status --short
git add backend frontend CHANGELOG.md
git diff --cached --check
git commit -m "feat(wkms): configure task limits and claiming UX (DDP-200)"
git push -u origin feature/200-wkms-claim-limits
```

PR base: `develop`. Title: `[DDP-200] feat(tasks): configurable active-task limits and claiming UX`.

## Outstanding cross-system dependencies

- Manager Dashboard **configuration UI and authorized mutation contract** (not implemented in this WKMS issue).
- Front Desk **eligible-workers discovery API** for manual assignment (separate WKMS task; DDP-198 POST assignment already exists). It should reuse this policy's current capacity rules.
