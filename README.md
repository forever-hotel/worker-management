# Forever Hotel — Worker Management System (WKMS)

The **Worker Management System (WKMS)** is the mobile-first worker operations subsystem of the Forever Hotel Management System. It enables authorized hotel workers to manage housekeeping, food-delivery, maintenance and guest service tasks.

**Latest source-code release:** [v1.0.0](https://github.com/forever-hotel/worker-management/releases/tag/v1.0.0)
**Main branch:** stable release code · **develop branch:** ongoing development

## Main Features

- **Worker access:** Staff sign-in, role-based access and protected worker pages.
- **Task management:** Task Queue, My Tasks, task details, claiming, starting and completing tasks.
- **Shift information:** Worker shift dashboard and task capacity/claim limits.
- **Automatic escalation:** Escalation of overdue/unclaimed tasks according to the configured policy.
- **Cross-subsystem integration:** RabbitMQ consumers for Kitchen order-ready delivery tasks, Front Desk checkout cleaning tasks and service requests; support for Front Desk manual task assignment.
- **Task accountability:** Persistent task lifecycle and audit records, completion events and idempotent handling where implemented.
- **Mobile and offline support:** Responsive, installable Progressive Web Application (PWA) and offline-safe task synchronization.
- **Updates:** Authenticated task notifications and refresh mechanisms; availability of live updates depends on the running messaging/realtime services.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL (including approved Neon development environments) |
| Authentication | Shared API Gateway, JWT and role-based checks |
| Messaging | RabbitMQ |
| Realtime | Socket.IO / shared realtime integration |
| Quality and deployment | Jest, GitHub Actions, Docker |

## Repository Structure

```text
worker-management/
├── frontend/               Next.js worker application
├── backend/                NestJS API and persistence
├── .github/workflows/      Automated checks and image publication
├── compose.yaml            Local Docker Compose definition
└── README.md               Project overview and local setup
```

## Local Development (Native)

Use **Node.js 24.x**, npm, and an approved development PostgreSQL database. The shared API Gateway normally runs at `http://localhost:8080`; RabbitMQ is needed for cross-service task events. The shared realtime service is needed for the corresponding live notifications.

Create private environment files from `backend/.env.example` and `frontend/.env.example`, and configure them for the services actually running on your machine. **Do not commit `.env`, `.env.local`, database credentials or service tokens.**

### 1. Start the backend

```powershell
cd backend
npm ci
npm run start:dev
```

The backend's native development port is **4002**, as specified in `backend/.env.example`. Check:

```text
http://localhost:4002/health/ready
```

### 2. Start the frontend

In another terminal, from the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

The frontend's native development URL is **http://localhost:3002** (defined in `frontend/package.json`). Visit `http://localhost:3002/login`.

### 3. Verify shared integrations

Ensure the API Gateway routes WKMS API requests to the running backend and that the backend points to the intended *development* database. Task events require a reachable, correctly configured RabbitMQ broker. A successful health check does not by itself verify all cross-subsystem flows.

**Never run destructive migrations or database resets against the shared development/production database without team approval.**

## Docker Images and Compose

The repository contains frontend/backend Dockerfiles and a `compose.yaml` for local integration. The CI pipeline builds both Docker images.

**Current Compose caveat:** `compose.yaml` maps the frontend at `3001:3001`, while the current frontend Dockerfile runs the application on container port `3002`. The Compose port mapping should be reconciled and tested before relying on that configuration as a working local startup guide. This does not describe the separately managed deployed environment.

## CI, Release and Evidence

- [WKMS GitHub Actions](https://github.com/forever-hotel/worker-management/actions) — frontend/backend lint, tests, builds, dependency audits and Docker image checks.
- [WKMS v1.0.0 source-code release](https://github.com/forever-hotel/worker-management/releases/tag/v1.0.0) — release from `main`.
- [Shared API Gateway](https://github.com/forever-hotel/api-gateway) — routing and central staff authentication.
- [Central system tests](https://github.com/forever-hotel/tests) — cross-subsystem checks and staging smoke tests.
- [Project documentation](https://github.com/forever-hotel/documents) — shared integration and QA documentation.

A passing CI run demonstrates that its configured checks passed. It does **not** by itself establish complete production or six-subsystem acceptance.

## Security

Keep credentials and personal data out of Git history, logs and documentation. Use approved development/test accounts for verification, keep role checks enabled, and record actual integration test results rather than assuming all external services are available.
