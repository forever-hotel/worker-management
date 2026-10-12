# Changelog

## [Unreleased]

### Added
- DDP-78: Consume KMS order-ready events to create food-delivery tasks.
- DDP-78: Consume FDS checkout-completed events to create high-priority cleaning tasks.
- DDP-78: Add RabbitMQ retry, dead-letter, reconnection, and idempotency handling.
- DDP-78: Add local PostgreSQL and RabbitMQ integration tests.

### Documentation
- Document inbound event contracts; the KMS contract remains proposed pending approval.

### Security
- Apply targeted development dependency security overrides.
