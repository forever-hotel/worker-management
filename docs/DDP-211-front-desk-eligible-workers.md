# DDP-211 — Front Desk eligible-worker discovery

## Purpose

Front Desk currently has a secured `POST /wkms/tasks/:taskId/manual-assign` endpoint, but needs the worker IDs to present a meaningful selection list. This change adds a read-only discovery endpoint behind the same **Front Desk service guard**.

## API contract

`GET /wkms/tasks/:taskId/eligible-workers`

**Authorization:** `Authorization: Bearer <FDS_WKMS_SERVICE_TOKEN>` (sent only from the Front Desk **backend**; do not expose to browser code).

**200 response:**

```json
{
  "taskId": "11111111-1111-4111-8111-111111111111",
  "workers": [
    {
      "workerId": "22222222-2222-4222-8222-222222222222",
      "fullName": "Sample Worker",
      "vocation": "Housekeeping",
      "activeTaskCount": 1,
      "maxActiveTasks": 3,
      "remainingCapacity": 2
    }
  ]
}
```

**Responses:** `400` invalid task UUID, `401` unauthorized service request, `404` task not found, `409` task not assignable, `200` with `workers: []` when nobody currently has spare capacity.

Eligibility here means that the worker is marked active (`staff_users.is_active = TRUE`), has role `WORKER`, and has **fewer active tasks than the DDP-200 policy**. It does **not** prove the worker is on shift, online, present at the hotel, or suitably skilled for a task category. Attendance/shift/skill matching requires additional authoritative data and approved rules. Show "Eligible by task capacity", not "Online".

Active tasks are `ASSIGNED` and `IN_PROGRESS`. Results sort by least workload, then name, then ID. No passwords, usernames, tokens, email addresses, or sensitive auth fields are returned.

## Front Desk integration

1. Receptionist selects an unassigned/escalated task.
2. FDS **backend** calls WKMS GET using the shared service credential. FDS frontend calls its own authorized FDS backend endpoint, **not** WKMS using the service credential.
3. Front Desk displays the eligible workers and their capacity. Empty list means no one currently qualifies by the WKMS capacity rule.
4. Receptionist chooses `workerId` and confirms.
5. FDS backend calls existing `POST /wkms/tasks/:taskId/manual-assign` with `{ "workerId": "..." }` and its service credential.
6. A `409 Conflict` is expected if a worker claimed the task, filled their capacity, or another receptionist assigned it after the GET. Refresh the eligible-workers list and let the receptionist choose again.

## Technical and security notes

- Reuses `FrontDeskServiceGuard` for both GET and POST; credentials are never placed in URLs.
- No schema changes; reads `public.staff_users`, `public.wkms_tasks`, and `public.wkms_task_policy`.
- Reuses DDP-200 effective task limit, defaulting to 3 if the singleton policy row is absent. The policy migration must exist in all target environments.
- GET is a best-effort snapshot. **POST remains authoritative** and revalidates worker, task, capacity, and transaction locks. Never reserve capacity from GET alone.
- Returns only active workers with a positive remaining capacity.
- FDS and WKMS deployments must have matching `FDS_WKMS_SERVICE_TOKEN` environment configuration. Do not commit tokens to the repository.
- Client-side Front Desk dropdown and optional task-skill matching are **outside this WKMS change**.

## Verification

```powershell
cd backend
$env:NODE_OPTIONS = '--experimental-vm-modules'
npx.cmd jest --runInBand
Remove-Item Env:\NODE_OPTIONS
npm.cmd run test:typecheck
npm.cmd run lint
npm.cmd run build
```

A local authenticated HTTP smoke test should verify GET and the existing manual-assign POST through the configured route. Do not report live FDS integration as complete until verified by both teams.
