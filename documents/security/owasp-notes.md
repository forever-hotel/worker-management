# WKMS OWASP Top 10 - Updated Evidence Notes

Updated: **2026-10-25**. PR #53 commit `db7d682c96420eee9c209397fe71c59ab6a92e24`. No penetration test / production security certification.

| Control | Status | Evidence and remaining gap |
| --- | --- | --- |
| A01 Broken Access Control | PARTIAL | JWT worker-role/active-account validation and task ownership regression. Route-wide authorization matrix pending. |
| A02 Cryptographic Failures | PARTIAL | Signed short-lived JWT accepted; invalid JWT rejected. Production TLS and key-rotation policy not verified. |
| A03 Injection | PARTIAL | Parameterized repository queries previously reviewed; comprehensive injection/fuzz tests not recorded. |
| A04 Insecure Design | PARTIAL | Persistence-before-broadcast, idempotency and failure tests. No signed threat model. |
| A05 Security Misconfiguration | PARTIAL | Local socket auth/CORS; deployed WSS origin checks, TLS and secrets policy require review. |
| A06 Vulnerable Components | PARTIAL | Backend/frontend npm production audits report 0; other build/deploy supply-chain exposure not fully assessed. |
| A07 Authentication Failures | PARTIAL | Live valid demo_worker and invalid JWT handshakes tested; password login and session revocation end-to-end not checked in this snapshot. |
| A08 Integrity Failures | PARTIAL | Lockfiles, test evidence and GitHub Actions success at PR SHA; signing/provenance not verified. |
| A09 Logging and Monitoring | PARTIAL | Failure-handling logs and suppression of sensitive event payloads tested; alerting and log retention not verified. |
| A10 SSRF | NOT VERIFIED | No dedicated outbound destination allowlist/SSRF test evidenced. |

## Security and CI evidence

- JWT: live valid active `demo_worker` connection and invalid token rejection independently observed.
- Local Socket.IO gateway test suite: **17 passed**.
- WKMS backend full regression: **322 passed, 33 skipped**.
- WKMS frontend full regression: **123 passed**.
- Both apps: `npm audit --omit=dev --audit-level=high` => **0 vulnerabilities** after updating Multer to 2.5.0 and aligning `@nestjs/common` to 12.2.0.
- GitHub Actions WKMS CI on PR #53 head `db7d682c96420eee9c209397fe71c59ab6a92e24` completed with **success**: https://github.com/forever-hotel/worker-management/actions/runs/40173763618

**Open:** Auth contract for the team's deployed gateway, WSS and origin hardening, complete changed-code coverage, JWT revocation strategy, penetration testing, live task-event fanout.

Do not label this OWASP compliance certification or a production penetration test.
