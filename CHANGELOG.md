# Changelog

## [Unreleased]

- DDP-200: Add configurable active-task limits, shared worker/FDS assignment enforcement, and capacity-aware claiming UX.
- DDP-201: Add final WKMS verification evidence and audit logging structures to the isolated PostgreSQL test fixtures. Record completed tests and outstanding manual integration checks.

### Added
- DDP-211: Add FDS eligible-worker lookup using the WKMS task-capacity policy; manual assignment retains transactional revalidation.
- DDP-78: Consume KMS order-ready events to create food-delivery tasks.
- DDP-78: Consume FDS checkout-completed events to create high-priority cleaning tasks.
- DDP-78: Add RabbitMQ retry, dead-letter, reconnection, and idempotency handling.
- DDP-78: Add local PostgreSQL and RabbitMQ integration tests.
- DDP-194: Add the WKMS PWA manifest and 192x192/512x512 application icons.
- DDP-194: Enable desktop installation and standalone launch with the existing hotel color palette.
- DDP-194: Add automated PWA manifest tests and preserve existing frontend behavior.
- DDP-197: Added durable task completion events using the PostgreSQL transactional outbox and RabbitMQ.
- DDP-197: Added completion event contract documentation, idempotency tests, and transaction rollback tests.
- DDP-198: Add authenticated Front Desk manual task assignment API with worker validation, active-task limits, transactional audit, and realtime notification.
- DDP-198: Add service authentication, assignment, rollback, and HTTP authorization tests.

### Documentation
- Document inbound event contracts; the KMS contract remains proposed pending approval.

### Security
- Apply targeted development dependency security overrides.
