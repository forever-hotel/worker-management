# DDP-218 — WKMS Dockerization and Integration Handoff

## Overview

The Worker Management System includes Docker images for its NestJS
backend and Next.js frontend. Docker Compose coordinates these services.

PostgreSQL, RabbitMQ and the API Gateway are managed separately.

## Local Ports

| Component | Port |
|---|---|
| WKMS Backend | 3000 |
| WKMS Frontend | 3001 |
| API Gateway | 8080 |
| RabbitMQ | 5672 |

The host ports must be available. When multiple hotel services run
on one computer, coordinate host port mappings with the other teams.

## Requirements

- Docker Desktop with Linux containers
- Docker Compose
- Access to an appropriate development PostgreSQL database
- RabbitMQ for messaging integration
- Shared API Gateway for browser REST requests

## Backend Configuration

Create backend/.env.docker.local using backend/.env.example as a guide.

Configure:

- DATABASE_URL
- JWT_SECRET
- JWT_EXPIRES_IN_SECONDS
- RABBITMQ_ENABLED
- RABBITMQ_URL
- RABBITMQ_EXCHANGE

Do not commit credentials.

Inside Docker, localhost refers to the current container.
Use a resolvable container name for services on the same Docker
network, or host.docker.internal for a service exposed on the
Docker host.

The external database and RabbitMQ broker must be available
before enabling the backend.

## Frontend Configuration

Frontend browser URLs are provided during Docker image builds:

- NEXT_PUBLIC_API_GATEWAY_URL
- NEXT_PUBLIC_WKMS_SOCKET_URL

The local defaults are:

- http://localhost:8080
- http://localhost:3000

Rebuild the frontend image when these public URLs change.
Runtime environment changes alone do not replace values already
embedded in the Next.js browser bundle.

## Build Images

From the repository root:

    docker compose build frontend
    docker compose --profile integration build backend

## Start Frontend

    docker compose up -d frontend

The frontend is available at:

    http://localhost:3001/login

## Start Backend

First verify the private environment configuration and database target.

    docker compose --profile integration up -d backend

The integration profile prevents the backend from starting
automatically during a frontend-only Compose startup.

## Health Checks

Backend:

    http://localhost:3000/health/live
    http://localhost:3000/health/ready

Frontend:

    http://localhost:3001/login
    http://localhost:3001/sw.js

## API Gateway

The frontend sends REST requests through the API Gateway.

For a gateway running on the Windows host, configure its WKMS
upstream to:

    http://localhost:3000

For a gateway running on the same Docker network as the WKMS
backend, use the backend service hostname and port:

    http://backend:3000

The gateway must allow the frontend browser origin:

    http://localhost:3001

The gateway and WKMS backend must apply their agreed authentication
contracts in the integration environment.

## RabbitMQ

The WKMS backend consumes checkout-completed and order-ready events
and publishes relevant worker task events.

Use the agreed exchange:

    forever.events

Use an isolated RabbitMQ broker for functional testing.
Do not publish synthetic test events to a shared broker.

## Verification Results

- Backend image build: Passed
- Frontend image build: Passed
- Frontend Compose startup and health check: Passed
- Backend Compose startup and health check: Passed
- Isolated PostgreSQL readiness: Passed
- RabbitMQ connection and authentication: Passed
- RabbitMQ publisher startup: Passed
- Order-ready consumer subscription: Passed
- Checkout-completed consumer subscription: Passed
- API Gateway liveness: HTTP 200
- API Gateway readiness: HTTP 200
- Protected WKMS route without JWT: HTTP 401, expected

## Remaining Integration Validation

- Full authenticated login through the real shared API Gateway
- End-to-end FDS and KMS event delivery
- Worker task lifecycle using controlled integration data
- Containerized browser and Socket.IO functional verification
- Final CI Docker image-build checks

## Security

- Never commit .env files or real credentials.
- Rotate credentials that have been exposed.
- Do not embed secrets in Docker image build arguments.
- Use isolated databases and message brokers for testing.
- Never disable central staff authentication in production.
- Verify infrastructure configuration before enabling consumers.

## Scope

Dockerization changes are confined to the WKMS repository.
Existing business logic and database schemas remain unchanged.