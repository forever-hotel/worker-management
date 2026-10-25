
import { jest } from '@jest/globals';
import type { JwtService } from '@nestjs/jwt';
import type { Namespace, Socket } from 'socket.io';

import type { StaffUserRepository } from '../database/repositories/staff-user.repository';
import type { WorkerJwtPayload } from '../auth/types/worker-jwt-payload';
import { WkmsRealtimeGateway } from './wkms-realtime.gateway';

type Next = (error?: Error) => void;
type Middleware = (socket: Socket, next: Next) => void;

const validPayload: WorkerJwtPayload & { exp: number } = {
  sub: 'worker-1',
  username: 'worker1',
  role: 'WORKER',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

function setup() {
  let middleware: Middleware | undefined;

  const verifyAsync =
    jest.fn<(token: string) => Promise<WorkerJwtPayload>>();

  const findSummaryById = jest.fn<
    (workerId: string) => Promise<{
      worker_id: string;
      full_name: string;
      vocation: string;
    } | null>
  >();

  verifyAsync.mockResolvedValue(validPayload);

  findSummaryById.mockResolvedValue({
    worker_id: 'worker-1',
    full_name: 'Test Worker',
    vocation: 'Cleaner',
  });

  const jwtService = {
    verifyAsync,
  } as unknown as JwtService;

  const staffUsers = {
    findSummaryById,
  } as unknown as StaffUserRepository;

  const gateway = new WkmsRealtimeGateway(jwtService, staffUsers);

  const use = jest.fn<(handler: Middleware) => void>(
    (handler) => {
      middleware = handler;
    },
  );

  gateway.afterInit({ use } as unknown as Namespace);

  async function authenticate(token: unknown): Promise<Error | undefined> {
    if (!middleware) {
      throw new Error('Socket middleware was not registered');
    }

    const socket = {
      handshake: {
        auth: token === undefined ? {} : { token },
      },
      data: {},
    } as unknown as Socket;

    return new Promise<Error | undefined>((resolve) => {
      middleware!(socket, (error) => resolve(error));
    });
  }

  return {
    gateway,
    authenticate,
    verifyAsync,
    findSummaryById,
    use,
  };
}

describe('WkmsRealtimeGateway authentication', () => {
  it('registers authentication middleware', () => {
    const { use } = setup();

    expect(use).toHaveBeenCalledTimes(1);
  });

  it('accepts a valid token for an active worker', async () => {
    const { authenticate, verifyAsync, findSummaryById } = setup();

    await expect(authenticate('valid-token')).resolves.toBeUndefined();

    expect(verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(findSummaryById).toHaveBeenCalledWith('worker-1');
  });

  it('rejects missing or empty tokens', async () => {
    const { authenticate, verifyAsync } = setup();

    await expect(authenticate(undefined)).resolves.toBeInstanceOf(Error);
    await expect(authenticate('')).resolves.toBeInstanceOf(Error);
    await expect(authenticate('   ')).resolves.toBeInstanceOf(Error);

    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects expired or invalid JWTs', async () => {
    const { authenticate, verifyAsync, findSummaryById } = setup();

    verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(authenticate('expired-token')).resolves.toBeInstanceOf(Error);

    expect(findSummaryById).not.toHaveBeenCalled();
  });

  it('rejects non-worker roles', async () => {
    const { authenticate, verifyAsync, findSummaryById } = setup();

    verifyAsync.mockResolvedValue({
      ...validPayload,
      role: 'MANAGER',
    });

    await expect(authenticate('manager-token')).resolves.toBeInstanceOf(Error);

    expect(findSummaryById).not.toHaveBeenCalled();
  });

  it('rejects incomplete worker JWT payloads', async () => {
    const { authenticate, verifyAsync, findSummaryById } = setup();

    verifyAsync.mockResolvedValue({
      sub: '',
      username: 'worker1',
      role: 'WORKER',
    });

    await expect(authenticate('incomplete-token')).resolves.toBeInstanceOf(
      Error,
    );

    expect(findSummaryById).not.toHaveBeenCalled();
  });

  it('rejects inactive or unavailable workers', async () => {
    const { authenticate, findSummaryById } = setup();

    findSummaryById.mockResolvedValue(null);

    await expect(authenticate('valid-token')).resolves.toBeInstanceOf(Error);

    expect(findSummaryById).toHaveBeenCalledWith('worker-1');
  });

  it('rejects database errors without allowing the connection', async () => {
    const { authenticate, findSummaryById } = setup();

    findSummaryById.mockRejectedValue(new Error('Database unavailable'));

    await expect(authenticate('valid-token')).resolves.toBeInstanceOf(Error);
  });
});

describe('WkmsRealtimeGateway broadcasting', () => {
  it.each([
    ['task.created', 'emitTaskCreated'],
    ['task.claimed', 'emitTaskClaimed'],
    ['task.escalated', 'emitTaskEscalated'],
  ] as const)(
    'broadcasts %s with a minimal payload',
    (eventName, methodName) => {
      const { gateway } = setup();

      const emit = jest.fn<(event: string, payload: unknown) => void>();

      gateway.server = {
        emit,
      } as unknown as Namespace;

      gateway[methodName]('task-123');

      expect(emit).toHaveBeenCalledTimes(1);

      expect(emit).toHaveBeenCalledWith(eventName, {
        taskId: 'task-123',
        occurredAt: expect.any(String),
      });

      const payload = emit.mock.calls[0][1];

      expect(Object.keys(payload as object).sort()).toEqual([
        'occurredAt',
        'taskId',
      ]);
    },
  );

  it('does not throw when the Socket.IO server is unavailable', () => {
    const { gateway } = setup();

    expect(() => gateway.emitTaskCreated('task-123')).not.toThrow();
    expect(() => gateway.emitTaskClaimed('task-123')).not.toThrow();
    expect(() => gateway.emitTaskEscalated('task-123')).not.toThrow();
  });

  it('does not propagate a Socket.IO broadcast failure', () => {
    const { gateway } = setup();

    const emit = jest.fn<(event: string, payload: unknown) => void>(() => {
      throw new Error('Socket.IO unavailable');
    });

    gateway.server = {
      emit,
    } as unknown as Namespace;

    expect(() => gateway.emitTaskCreated('task-123')).not.toThrow();
    expect(() => gateway.emitTaskClaimed('task-123')).not.toThrow();
    expect(() => gateway.emitTaskEscalated('task-123')).not.toThrow();

    expect(emit).toHaveBeenCalledTimes(3);
  });
});


describe('WkmsRealtimeGateway token expiration', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects a JWT without an expiration claim', async () => {
    const { authenticate, verifyAsync } = setup();

    verifyAsync.mockResolvedValue({
      sub: 'worker-1',
      username: 'worker1',
      role: 'WORKER',
    });

    await expect(authenticate('no-expiration-token')).resolves.toBeInstanceOf(
      Error,
    );
  });

  it('disconnects clients without expiration data', () => {
    const { gateway } = setup();
    const disconnect = jest.fn();

    const client = {
      data: {},
      disconnect,
    } as unknown as Socket;

    gateway.handleConnection(client);

    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects clients whose token already expired', () => {
    const { gateway } = setup();
    const disconnect = jest.fn();

    const client = {
      data: {
        workerId: 'worker-1',
        tokenExpiresAt: Date.now() - 1000,
      },
      disconnect,
    } as unknown as Socket;

    gateway.handleConnection(client);

    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects an active client when its token expires', () => {
    jest.useFakeTimers();

    const now = Date.now();
    jest.setSystemTime(now);

    const { gateway } = setup();

    const disconnect = jest.fn();
    const once = jest.fn();

    const client = {
      data: {
        workerId: 'worker-1',
        tokenExpiresAt: now + 5000,
      },
      disconnect,
      once,
    } as unknown as Socket;

    gateway.handleConnection(client);

    expect(disconnect).not.toHaveBeenCalled();

    jest.advanceTimersByTime(4999);

    expect(disconnect).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledWith(true);

    expect(once).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });
});
