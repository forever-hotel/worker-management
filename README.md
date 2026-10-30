# Forever Hotel - Worker Management System (WKMS)

The Worker Management System (WKMS) is a mobile-first Progressive Web Application
for housekeeping and maintenance workers of Forever City Hotel.

WKMS is one subsystem of the Forever Hotel Management System. It allows workers
to view available tasks, claim tasks, manage active tasks, complete assigned tasks,
and view shift-related information.

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript

### Backend

- NestJS
- TypeScript

WKMS integrates PostgreSQL persistence, JWT-based worker
authentication, RabbitMQ event messaging, Socket.IO realtime
updates, and an installable Progressive Web Application (PWA)
with offline support.

Final verification results, known limitations, and outstanding
cross-subsystem dependencies are documented in
docs/DDP-201-final-verification.md.

## Repository Structure

```text
worker-management/
├── frontend/       # Next.js frontend application
├── backend/        # NestJS backend application
├── docs/           # Integration and verification documentation
├── CHANGELOG.md
├── .gitignore
└── README.md
```
