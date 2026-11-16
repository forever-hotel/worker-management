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

## Docker Deployment

WKMS supports Docker-based deployment for its NestJS backend and Next.js frontend.

### Service Ports

| Service | Local Port |
|---|---|
| WKMS Backend | 3000 |
| WKMS Frontend | 3001 |
| API Gateway | 8080 |

### Build Images

    docker compose build frontend
    docker compose --profile integration build backend

### Start Frontend

    docker compose up -d frontend

Frontend URL: http://localhost:3001/login

### Start Backend

Create backend/.env.docker.local with the required PostgreSQL, JWT and RabbitMQ settings.

    docker compose --profile integration up -d backend

### Health Checks

- Backend: http://localhost:3000/health/live
- Backend readiness: http://localhost:3000/health/ready
- Frontend: http://localhost:3001/login

The frontend uses API Gateway port 8080 and Socket.IO backend port 3000.

Public frontend URLs are configured during the Docker image build.

### Integration Documentation

See docs/DDP-218-dockerization.md for detailed setup, networking, security and verification instructions.

Never commit real database credentials, JWT secrets or RabbitMQ passwords.
