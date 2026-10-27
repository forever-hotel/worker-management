

\# DDP-198 — Front Desk Manual Task Assignment Contract



\## Purpose



Allow the authorized Forever Hotel Front Desk backend to assign an available WKMS task to an active worker.



WKMS remains the authority for task ownership, status transitions, and active-task limits.



\## HTTP Endpoint



Method: POST



Path: /wkms/tasks/:taskId/manual-assign



Authentication: Bearer service token



Header: Authorization: Bearer <FDS\_WKMS\_SERVICE\_TOKEN>



Content-Type: application/json



\## Request Body



```json

{

&#x20; "workerId": "22222222-2222-4222-8222-222222222222"

}

```



The taskId path parameter and workerId must be valid UUIDs.



\## Successful Response



HTTP 201 Created



The endpoint returns the updated WKMS task record, including:



\- task\_id

\- status: ASSIGNED

\- assigned\_worker\_id



\## Error Responses



\- 400: Invalid task or worker identifier

\- 401: Missing, invalid, or unavailable service authentication

\- 404: Task not found or worker unknown/inactive

\- 409: Task unavailable or worker active-task limit reached

\- 500: Unexpected database or server failure



\## Assignment Rules



\- Only UNASSIGNED or ESCALATED tasks without an assigned worker are eligible.

\- The target user must have the WORKER role and be active.

\- Each worker may have a maximum of three active tasks.

\- Worker selection, task assignment, and audit insertion run within a PostgreSQL transaction.

\- Worker and task row locks protect assignment operations that follow the WKMS locking protocol.

\- Existing worker-initiated claiming remains supported.



\## Realtime Notification



After successful database persistence, WKMS emits the existing Socket.IO task.claimed event, containing the task identifier and event timestamp.



Connected WKMS clients can refresh their task queue or assigned-task lists.



\## Security Responsibilities



The Front Desk backend must authenticate the receptionist and verify that the receptionist is authorized to assign tasks.



Only a trusted backend may possess FDS\_WKMS\_SERVICE\_TOKEN. Never expose this credential in browser code, API responses, logs, or GitHub.



WKMS checks the service credential independently before processing the request.



Use HTTPS outside local development and coordinate secret rotation between the two backends.



The current service credential authenticates the calling service, not an individual receptionist. Audit entries therefore identify the service-originated action as SYSTEM. Person-level receptionist attribution requires a separately approved trusted identity contract.



\## Configuration



WKMS backend environment variable:



FDS\_WKMS\_SERVICE\_TOKEN



The credential must contain at least 32 characters. When absent, the manual assignment endpoint rejects requests.



The Front Desk backend must be configured with the matching credential through secure environment or secret management.




## Integration Verification

The WKMS manual assignment interface is implemented.

Verification completed:

- Authentication guard: 8 tests passed.
- Assignment controller: 8 tests passed.
- HTTP authorization: 5 tests passed.
- Assignment repository: 10 tests passed.
- Assignment service and realtime behavior: 8 tests passed.
- Real PostgreSQL integration: 3 tests passed.
- PostgreSQL concurrency: two manual assignments and manual assignment versus worker claim verified.
- Database rollback on audit failure: verified.
- Focused coverage: 98.14% lines, 91.20% branches, measured before the final configuration tests.

The PostgreSQL tests used a disposable PostgreSQL 16 database, `wkms_ddp198_test`, on localhost port 55434.

Remaining integration dependencies:

- Front Desk team approval of the API and service authentication contract.
- Secure service credential configuration in both deployed backends.
- End-to-end FDS-to-WKMS request verification.
- Actual Socket.IO delivery verification with connected worker clients.
- Person-level receptionist audit attribution, if required by the agreed integration contract.
