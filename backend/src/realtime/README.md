# WMS real-time relay

Browser sockets are hosted by the separate shared WebSocket service. Connect
through the API Gateway using `/realtime/socket.io`, a one-use ticket and the
`wkms` subsystem registry entry. The frontend BFF keeps JWTs and relay keys private.

`WkmsRealtimeGateway` is now an injectable RabbitMQ publisher adapter, not a socket
server. It publishes safe invalidations for task creation, claims, escalation,
progress and completion on `hotel.realtime`. The frontend refetches authorized REST
snapshots and resynchronizes after reconnects or missed events.

See the workspace `documents/WEBSOCKET_SERVICE.md` for configuration and permissions.
