

\# WKMS Task Completed Event Contract — DDP-197



\## Purpose



Notify the Manager Dashboard when a WKMS worker successfully completes a task.



Status: Proposed v1 contract. Manager Dashboard team approval is required before final integration.



\## RabbitMQ Configuration



\- Exchange: forever.events

\- Exchange type: topic

\- Routing key: wkms.task.completed.v1

\- Event type: task.completed

\- Event version: 1

\- Source: worker-management



\## Event Payload



```json

{

&#x20; "eventId": "completion:11111111-1111-4111-8111-111111111111",

&#x20; "eventType": "task.completed",

&#x20; "eventVersion": 1,

&#x20; "occurredAt": "2026-10-27T08:00:00.000Z",

&#x20; "source": "worker-management",

&#x20; "data": {

&#x20;   "taskId": "11111111-1111-4111-8111-111111111111",

&#x20;   "workerId": "22222222-2222-4222-8222-222222222222",

&#x20;   "taskCategory": "ROOM\_CLEANING",

&#x20;   "roomNumber": "DEMO101",

&#x20;   "priority": "HIGH",

&#x20;   "completedAt": "2026-10-27T08:00:00.000Z"

&#x20; }

}

```



\## Reliability and Idempotency



Task completion, audit insertion, and outbox insertion occur within one PostgreSQL transaction.



The outbox dispatcher publishes committed events using persistent RabbitMQ messages and publisher confirmations.



The event ID is stable: completion:<taskId>.



Consumers must deduplicate events using eventId because broker redelivery is possible.



Repeated completion requests are rejected when a task is already COMPLETED.



\## Security



Completion events exclude passwords, authentication tokens, payment details, and guest contact information.



\## Manager Dashboard Integration



The Manager Dashboard team must confirm:



\- Exchange and routing key

\- Event schema and version

\- Required analytics fields

\- Consumer-side event deduplication



\## Verification



\- Backend regression: 329 tests passed, 0 failed, 33 skipped

\- Backend build: passed

\- TypeScript type-check: passed

\- Lint: passed

\- Dependency security audit: 0 vulnerabilities

\- Mocked rollback and duplicate-completion tests: passed



\## Outstanding Integration Verification



Real PostgreSQL completion/outbox transaction verification and end-to-end RabbitMQ delivery to Manager Dashboard remain pending.



