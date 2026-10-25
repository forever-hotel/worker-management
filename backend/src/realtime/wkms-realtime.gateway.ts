import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { StaffUserRepository } from '../database/repositories/staff-user.repository';
import type { WorkerJwtPayload } from '../auth/types/worker-jwt-payload';

type WorkerSocketData = {
  workerId?: string;
  tokenExpiresAt?: number;
};

@WebSocketGateway({
  namespace: '/wkms',
  cors: {
    origin: ['http://localhost:3001'],
    methods: ['GET', 'POST'],
  },
})
@Injectable()
export class WkmsRealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(WkmsRealtimeGateway.name);

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly staffUsers: StaffUserRepository,
  ) {}

  afterInit(server: Namespace): void {
    server.use(async (socket: Socket, next) => {
      try {
        const token: unknown = socket.handshake.auth?.token;

        if (typeof token !== 'string' || !token.trim()) {
          next(new Error('Authentication required'));
          return;
        }

        const payload =
          await this.jwtService.verifyAsync<WorkerJwtPayload>(token);

        if (
          typeof payload.sub !== 'string' ||
          !payload.sub.trim() ||
          typeof payload.username !== 'string' ||
          !payload.username.trim() ||
          payload.role !== 'WORKER'
        ) {
          next(new Error('Invalid worker token'));
          return;
        }

        const worker = await this.staffUsers.findSummaryById(payload.sub);

        if (!worker) {
          next(new Error('Worker is inactive or unavailable'));
          return;
        }

        const expiresAt = (
          payload as WorkerJwtPayload & {
            exp?: unknown;
          }
        ).exp;

        if (
          typeof expiresAt !== 'number' ||
          !Number.isSafeInteger(expiresAt) ||
          expiresAt * 1000 <= Date.now()
        ) {
          next(new Error('Invalid token expiration'));
          return;
        }

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

    client.once('disconnect', () => {
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
