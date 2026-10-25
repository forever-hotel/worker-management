# WKMS Coverage and CI Notes

Evidence snapshot: **2026-10-25**. PR #53, SHA `db7d682c96420eee9c209397fe71c59ab6a92e24`.

| Test scope | Passing suites | Passed tests | Skipped tests | Failed |
| --- | ---: | ---: | ---: | ---: |
| Backend Jest full regression | 36 | **322** | **33** | **0** |
| Frontend Jest full regression | 20 | **123** | 0 | **0** |
| Backend gateway focused (included in backend count) | 1 | **17** | 0 | **0** |

## Targeted backend realtime Jest coverage

| Selection | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| `src/realtime/wkms-realtime.gateway.ts` | 95.00% | 90.00% | 90.00% | 94.91% |
| `src/realtime/**/*.ts` | 91.93% | **90.00%** | 90.00% | **93.33%** |

`realtime.module.ts` is 0% instrumented in the targeted gateway-only run. These are **not** coverage values for the whole backend or all changed DDP-79 code.

## Reproducible local commands

PowerShell backend:

```powershell
$env:NODE_OPTIONS = "--experimental-vm-modules"
npx jest --runInBand
npx jest src/realtime/wkms-realtime.gateway.spec.ts --coverage --collectCoverageFrom="src/realtime/**/*.ts" --coverageReporters=text --runInBand
npm run lint
npm run test:typecheck
npm run build
npm audit --omit=dev --audit-level=high
```

Frontend: `npm test -- --runInBand`; `npx tsc --noEmit`; `npm run lint`; `npm run build`; `npm audit --omit=dev --audit-level=high`.

## GitHub Actions / Review

- PR: https://github.com/forever-hotel/worker-management/pull/53
- SHA: `db7d682c96420eee9c209397fe71c59ab6a92e24`
- WKMS CI run: https://github.com/forever-hotel/worker-management/actions/runs/40173763618
- Observed workflow status: **completed / success**.
- PR #53 was subsequently approved and merged into develop; Issue #45 is closed.

## Pending evaluation

- Measure complete DDP-79 changed-code coverage at >=80% lines and branches (currently **unverified**).
- Run live task mutation, event delivery, browser refresh, reconnect and token-expiry scenarios.
- Perform controlled staging load tests; archive p50/p95, throughput, and fanout latency.
