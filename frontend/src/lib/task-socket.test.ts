import { io } from "socket.io-client";

import { getAuthSession } from "@/lib/auth-session";
import { connectTaskSocket, TASK_SOCKET_EVENTS } from "./task-socket";

jest.mock("socket.io-client", () => ({
  io: jest.fn(),
}));

jest.mock("@/lib/auth-session", () => ({
  getAuthSession: jest.fn(),
}));

const mockedIo = jest.mocked(io);
const mockedGetAuthSession = jest.mocked(getAuthSession);

describe("connectTaskSocket", () => {
  const originalUrl = process.env.NEXT_PUBLIC_WKMS_SOCKET_URL;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_WKMS_SOCKET_URL = "http://127.0.0.1:3000/";

    mockedGetAuthSession.mockReturnValue({
      worker: { worker_id: "worker" },
      expiresAt: Date.now() + 3600000,
    } as never);
  });

  afterAll(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_WKMS_SOCKET_URL;
    } else {
      process.env.NEXT_PUBLIC_WKMS_SOCKET_URL = originalUrl;
    }
  });

  it("does not connect without an access token", () => {
    mockedGetAuthSession.mockReturnValue(null);

    expect(connectTaskSocket()).toBeNull();

    expect(mockedIo).not.toHaveBeenCalled();
  });

  it("does not connect without a configured socket URL", () => {
    delete process.env.NEXT_PUBLIC_WKMS_SOCKET_URL;

    expect(connectTaskSocket()).toBeNull();

    expect(mockedIo).not.toHaveBeenCalled();
  });

  it("configures an authenticated Socket.IO connection", () => {
    const socket = {
      connect: jest.fn(),
    };

    mockedIo.mockReturnValue(socket as unknown as ReturnType<typeof io>);

    expect(connectTaskSocket()).toBe(socket);

    expect(mockedIo).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/wkms",
      expect.objectContaining({
        withCredentials: true,
        autoConnect: false,
        reconnection: true,
        transports: ["websocket"],
      }),
    );

    // TaskDataProvider connects only after registering listeners.
    expect(socket.connect).not.toHaveBeenCalled();
  });

  it("registers only the expected realtime event names", () => {
    expect(TASK_SOCKET_EVENTS).toEqual([
      "task.created",
      "task.claimed",
      "task.escalated",
    ]);
  });
});
