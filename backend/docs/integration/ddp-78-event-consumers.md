# DDP-78 — WKMS Inbound RabbitMQ Event Contracts

## 1. Document Information

**Project:** Forever Hotel Management System
**Subsystem:** Worker Management System (WKMS)
**Issue:** DDP-78 — GitHub Issue #44
**Integration:** Kitchen Management System (KMS) and Front Desk System (FDS)
**Communication:** RabbitMQ
**Status:** WKMS consumers implemented and locally tested; final cross-team integration pending.

## 2. Purpose

The Worker Management System receives operational events from other hotel subsystems and automatically creates worker tasks.

Two event integrations are implemented:

- **KMS → WKMS:** When a food order is ready, create a food-delivery task.
- **FDS → WKMS:** When checkout is completed, create a high-priority room-cleaning task.

WKMS owns the generated tasks. KMS continues to own food orders, while FDS continues to own bookings and checkout processing.

These integrations use RabbitMQ asynchronous messaging rather than requiring each subsystem to directly create tasks in another subsystem's database.

## 3. Shared Messaging Architecture

**RabbitMQ exchange:** `forever.events`
**Exchange type:** `topic`
**Exchange durability:** Durable

The two consumers use separate durable queues for normal event processing, delayed retries, and dead-letter handling.

Messages are acknowledged only after successful database processing or confirmation that the relevant task already exists.

Invalid events and permanent business conflicts are rejected and routed to dead-letter queues.

## 4. KMS Order-Ready Event Contract

**Contract reference:** KMS-INT-05
**Contract status:** PROPOSED — awaiting KMS team approval
**Producer:** Kitchen Management System
**Consumer:** Worker Management System

**Routing key:** `kms.order.ready.v1`
**Event type:** `order.ready`
**Event version:** `1`
**Source:** `kitchen-management`

### Proposed Event Payload

```json
{
  "eventId": "order-ready:550e8400-e29b-41d4-a716-446655440000",
  "eventType": "order.ready",
  "eventVersion": 1,
  "occurredAt": "2026-10-12T12:00:00.000Z",
  "source": "kitchen-management",
  "data": {
    "foodOrderId": "550e8400-e29b-41d4-a716-446655440000",
    "roomNumber": "R101"
  }
}
```

### Processing Rules

KMS must publish the event after successfully persisting the food order's READY state.

The WKMS consumer validates the event, confirms the referenced food order is READY, verifies the room number, and creates the food-delivery task.

The task uses these values:

| Field | Value |
|---|---|
| category | FOOD_DELIVERY |
| source | KMS |
| priority | NORMAL |
| status | UNASSIGNED |
| food_order_id | data.foodOrderId |
| room_number | data.roomNumber |

If the same order-ready event is delivered multiple times, WKMS must not create duplicate tasks. The existing unique `food_order_id` relationship is used for idempotency.

**Important:** The KMS team must approve this payload, routing key, event identity and version before implementing the corresponding publisher.

## 5. FDS Checkout-Completed Event Contract

**Contract reference:** FDS-INT-06
**Contract status:** Matched against the existing FDS publisher implementation
**Producer:** Front Desk System
**Consumer:** Worker Management System

**Routing key:** `fds.checkout.completed.v1`
**Event type:** `checkout.completed`
**Event version:** `1`
**Source:** `front-desk`

### Source-Defined Event Payload

```json
{
  "eventId": "checkout:550e8400-e29b-41d4-a716-446655440000",
  "eventType": "checkout.completed",
  "eventVersion": 1,
  "occurredAt": "2026-10-12T12:00:00.000Z",
  "source": "front-desk",
  "data": {
    "bookingReference": "550e8400-e29b-41d4-a716-446655440000",
    "roomNumber": "R101",
    "taskCategory": "ROOM_CLEANING",
    "priority": "HIGH",
    "sourceType": "CHECKOUT_TRIGGER"
  }
}
```

### Processing Rules

The FDS backend publishes this event after the checkout database transaction is committed.

WKMS validates the event, checks the completed booking and room, and transactionally creates a cleaning task.

The task uses these values:

| Field | Value |
|---|---|
| category | ROOM_CLEANING |
| source | CHECKOUT_TRIGGER |
| priority | HIGH |
| status | UNASSIGNED |
| booking_id | data.bookingReference |
| room_number | data.roomNumber |

Repeated delivery of the same completed-checkout event must not create duplicate room-cleaning tasks.

## 6. RabbitMQ Queue Configuration

KMS queues:

- Main: `wkms.order-ready.v1`
- Retry: `wkms.order-ready.retry.v1`
- Dead-letter: `wkms.order-ready.dlq.v1`

FDS queues:

- Main: `wkms.checkout-completed.v1`
- Retry: `wkms.checkout-completed.retry.v1`
- Dead-letter: `wkms.checkout-completed.dlq.v1`

Detailed queue definitions are maintained in:

- `src/messaging/consumers/order-ready.consumer.topology.ts`
- `src/messaging/consumers/checkout-consumer.topology.ts`

## 7. Retry, Acknowledgement and Failure Handling

The consumer follows these rules:

1. Validate the incoming RabbitMQ payload.
2. Create or identify the existing worker task.
3. Acknowledge the original message only after successful processing.
4. Reject invalid payloads and permanent room conflicts to the dead-letter queue.
5. Send temporary processing failures to a persistent retry queue.
6. Retry after approximately 60 seconds.
7. Allow up to three retries.
8. Confirm retry publication before acknowledging the original message.
9. If retry publication fails, close the consumer connection so the unacknowledged message can be redelivered.
10. Reconnect automatically after RabbitMQ connection failures.

A durable queue must be declared and bound before messages are published to guarantee that it can retain them. Events sent before the queue exists may be lost.

Dead-lettered messages require operational investigation and a deliberate recovery or replay decision.

## 8. Database Ownership and Security

WKMS creates and manages its own task records in `wkms_tasks`.

It does not update KMS food-order state or FDS booking state.

The current shared-database implementation performs read-only verification against existing food-order and booking records. Future database isolation will require agreed cross-service read contracts.

RabbitMQ credentials and connection settings must be provided using environment variables. Secrets must not be committed to GitHub.

No guest personal information is required in these two event payloads.

No shared database schema migration is introduced by DDP-78. The additional local SQL fixtures are used only for isolated integration testing.

## 9. Testing and Verification

The following behavior was verified using Jest, PostgreSQL and RabbitMQ:

- Valid KMS event creates a food-delivery task.
- Valid FDS event creates a high-priority room-cleaning task.
- Duplicate events do not create duplicate tasks.
- Created food-delivery tasks appear in the worker queue.
- Malformed events are rejected.
- Permanent processing failures are dead-lettered.
- Temporary failures enter retry queues.
- Retry publication requires broker confirmation.
- A real 60-second delayed retry was successfully tested.
- Consumer disconnection and reconnection were tested.
- Database transactions and repository integration were tested.
- Existing WKMS functionality passed regression testing.

**Normal regression result:** 301 tests passed, with 33 intentionally skipped opt-in infrastructure tests.

**Coverage evidence:**

| Metric | Coverage |
|---|---:|
| Statements | 93.26% |
| Branches | 88.37% |
| Functions | 89.26% |
| Lines | 94.82% |

Both event consumers individually exceed 80% across these four coverage metrics.

## 10. Security Audit

The dependency security review confirmed:

- No reported production dependency vulnerabilities.
- No remaining high or critical findings in the full audit.
- Remaining moderate findings in development dependencies associated with the Jest tooling.
- Targeted security overrides for `undici` and `tmp`.
- Successful regression testing after the security updates.

The full dependency audit is not completely vulnerability-free. Remaining findings should be tracked and reassessed when compatible fixes become available.

## 11. Remaining Integration Work

Before declaring complete cross-subsystem integration:

1. Obtain approval of the proposed KMS event contract from the KMS team.
2. Implement and verify the actual KMS order-ready publisher.
3. Test an actual KMS READY transition through RabbitMQ into WKMS.
4. Coordinate publication of the final contract in the shared documents repository.
5. Confirm that broker queues are provisioned before producers begin publishing.
6. Review recovery of FDS checkout events if producer-side RabbitMQ publication fails after checkout commits.
7. Complete GitHub CI, peer review, and the DDP-78 pull request to `develop`.

## 12. Conclusion

DDP-78 implements RabbitMQ event consumption for KMS order-ready and FDS checkout-completed events within WKMS.

The WKMS-side event validation, task creation, idempotency, retry handling, dead-letter handling, reconnection and local integration tests have been completed.

The implementation is ready for final contract approval, GitHub review and cross-subsystem verification before production deployment.
