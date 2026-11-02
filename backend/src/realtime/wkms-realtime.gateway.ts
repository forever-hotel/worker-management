import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';

type WorkerSocketData = {
  workerId?: string;
  tokenExpiresAt?: number;
};

@WebSocketGateway({
  namespace: '/wkms',
  cors: {
    origin: (process.env.WMS_ALLOWED_ORIGINS ?? 'http://localhost:3002').split(
      ',',
    ),
    credentials: true,
    methods: ['GET', 'POST'],
  },
})
@Injectable()
export class WkmsRealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(WkmsRealtimeGateway.name);

  @WebSocketServer()
  server!: Namespace;

  constructor(private readonly auth: AuthService) {}

  afterInit(server: Namespace): void {
    server.use(async (socket: Socket, next) => {
      try {
        const origin = socket.handshake.headers.origin;
        const trusted = (
          process.env.WMS_ALLOWED_ORIGINS ?? 'http://localhost:3002'
        )
          .split(',')
          .map((value) => value.trim());
        if (
          (origin && !trusted.includes(origin)) ||
          (!origin && !socket.handshake.auth?.token)
        )
          throw new Error('Unapproved socket origin');
        const token =
          typeof socket.handshake.auth?.token === 'string'
            ? socket.handshake.auth.token
            : socket.handshake.headers.cookie
                ?.split(';')
                .map((value) => value.trim())
                .find((value) => value.startsWith('wms_session='))
                ?.slice(12);
        if (!token) throw new Error('Authentication required');
        const session = await this.auth.session(token);
        const payload = { sub: session.sub };
        const expiresAt = session.expiresAt;
        socket.data.staffToken = token;
        const socketData = socket.data as WorkerSocketData;

        socketData.workerId = payload.sub;
        socketData.tokenExpiresAt = expiresAt * 1000;

        next();
      } catch {
        next(new Error('Authentication failed'));
      }
    });

    this.logger.log('WKMS Socket.IO authentication initialized');
  }

  handleConnection(client: Socket): void {
    const socketData = client.data as WorkerSocketData;
    const expiresAt = socketData.tokenExpiresAt;

    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
      client.disconnect(true);
      return;
    }

    const remainingMs = expiresAt - Date.now();

    if (remainingMs <= 0) {
      client.disconnect(true);
      return;
    }

    // Node.js timers cannot safely represent arbitrarily long delays.
    // Recheck expiry when the maximum supported delay is reached.
    const MAX_TIMER_DELAY_MS = 2_147_483_647;

    const checkExpiration = () => {
      const remaining = expiresAt - Date.now();

      if (remaining <= 0) {
        client.disconnect(true);
        return;
      }

      expirationTimer = setTimeout(
        checkExpiration,
        Math.min(remaining, MAX_TIMER_DELAY_MS),
      );
      expirationTimer.unref?.();
    };

    let expirationTimer = setTimeout(
      checkExpiration,
      Math.min(remainingMs, MAX_TIMER_DELAY_MS),
    );

    expirationTimer.unref?.();

    const revalidate = setInterval(() => {
      void this.auth
        .session(client.data.staffToken)
        .catch(() => client.disconnect(true));
    }, 5000);
    revalidate.unref();
    client.once('disconnect', () => {
      clearInterval(revalidate);
      clearTimeout(expirationTimer);
    });
  }

  private emitTaskEvent(
    eventName: 'task.created' | 'task.claimed' | 'task.escalated',
    taskId: string,
  ): void {
    try {
      if (!this.server) {
        this.logger.warn(`Realtime server unavailable for ${eventName}`);
        return;
      }

      this.server.emit(eventName, {
        taskId,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // A realtime delivery failure must not undo a
      // successfully committed database operation.
      this.logger.warn(`Realtime broadcast failed for ${eventName}`);
    }
  }

  emitTaskCreated(taskId: string): void {
    this.emitTaskEvent('task.created', taskId);
  }

  emitTaskClaimed(taskId: string): void {
    this.emitTaskEvent('task.claimed', taskId);
  }

  emitTaskEscalated(taskId: string): void {
    this.emitTaskEvent('task.escalated', taskId);
  }
}
