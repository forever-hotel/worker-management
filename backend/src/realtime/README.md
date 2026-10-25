\# WKMS Realtime Event Contract



\*\*Issue:\*\* DDP-79 / #45

\*\*Transport:\*\* Socket.IO over WebSocket

\*\*Namespace:\*\* `/wkms`

\*\*Authentication:\*\* JWT for active users with the `WORKER` role



\## 1. Connection



The WKMS client connects to the backend Socket.IO namespace `/wkms`.



The client supplies its JWT through the Socket.IO authentication object:



```typescript

io(`${WKMS\_SOCKET\_URL}/wkms`, {

&#x20; auth: { token: accessToken },

&#x20; transports: \["websocket"],

});

```



The backend validates the JWT signature, expiration, role, required claims, and active worker status against the database.



Connections without valid worker authentication are rejected. Client-supplied worker identifiers cannot replace the verified JWT identity.



\## 2. Server-to-Client Events



| Event | Trigger |

|---|---|

| `task.created` | A new task is successfully persisted |

| `task.claimed` | A worker successfully claims a task |

| `task.escalated` | A task is successfully transitioned to `ESCALATED` |



All three events use the following payload:



```json

{

&#x20; "taskId": "task-identifier",

&#x20; "occurredAt": "2026-10-25T12:00:00.000Z"

}

```



`taskId` identifies the affected task.



`occurredAt` is the server-generated event timestamp in ISO 8601 format. It is not necessarily the database transaction timestamp.



The payload excludes worker passwords, password hashes, tokens, credentials, and guest personal information.



\## 3. Persistence and Delivery



\- Events are emitted after the corresponding application/database operation succeeds.

\- Failed claims do not produce successful `task.claimed` notifications.

\- Duplicate incoming RabbitMQ messages that do not create a new task do not produce duplicate successful `task.created` notifications.

\- Socket.IO broadcast failures are logged without reversing already-persisted database operations.

\- Events are transient notifications, not a durable event history.



\## 4. Frontend Behavior



When the worker frontend receives `task.created`, `task.claimed`, or `task.escalated`, it refreshes its REST-backed task data.



On successful Socket.IO reconnection, the frontend refreshes task data to recover changes that may have occurred while disconnected.



REST endpoints remain authoritative for the task queue, worker assignments, task details, task lifecycle operations, and shift summary.



\## 5. Configuration and Integration



For local development:



\- WKMS backend: `http://127.0.0.1:3000`

\- WKMS frontend: `http://localhost:3001`

\- Socket.IO namespace: `/wkms`



The frontend's `NEXT\_PUBLIC\_WKMS\_SOCKET\_URL` selects the backend origin.



Production should use a secured `wss://` endpoint and the infrastructure-approved routing configuration.



\*\*Integration dependency:\*\* The shared REST API Gateway's WebSocket forwarding support must be confirmed before deploying Socket.IO through the API Gateway. The WKMS realtime implementation can be tested directly against its backend independently of this decision.



\## 6. Verification



The DDP-79 checks include:



\- Active WORKER authentication acceptance.

\- Missing, invalid, expired, or unauthorized JWT rejection.

\- Task creation, claim, and escalation broadcasts.

\- Minimal event payload validation.

\- Broadcast failure handling.

\- Token-expiration disconnection.

\- Frontend event-driven REST refresh.

\- Regression tests, coverage, lint, typecheck, build, and dependency security audit.



\*\*Verified local results as of October 25, 2026:\*\*



\- Backend regression: 322 passed, 33 skipped.

\- Frontend regression: 123 passed.

\- Socket.IO gateway unit tests: 17 passed.

\- Backend realtime line coverage: 93.33%.

\- Backend realtime branch coverage: 90%.

\- Live authenticated `demo\_worker` Socket.IO connection: passed.

\- Live invalid-JWT rejection: passed.

\- Backend and frontend production dependency audits: zero reported vulnerabilities.



These local results do not independently establish deployed end-to-end performance or GitHub CI success.
