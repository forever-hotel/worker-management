/** @jest-environment node */
import { jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { auth, proxy } from "./staff-bff";
const identity = {
  sub: "66666666-6666-4666-8666-666666666666",
  username: "staff",
  role: "WORKER",
  roles: ["WORKER"],
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  passwordChangeRequired: true,
};
describe("HttpOnly staff BFF", () => {
  afterEach(() => jest.restoreAllMocks());
  it("rejects cross-site credential submissions", async () => {
    const fetcher = jest.spyOn(globalThis, "fetch");
    const response = await auth(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          origin: "https://attacker.invalid",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      "login",
    );
    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps the signed token out of browser JSON and sets an HttpOnly cookie", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ ...identity, accessToken: "private-signed-token" }),
      );
    const response = await auth(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "staff",
          password: "private-password",
        }),
      }),
      "login",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("accessToken");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("does not proxy protected requests without a session", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/backend/tasks"),
      ["tasks"],
    );
    expect(response.status).toBe(401);
  });
  it("prevents backend path traversal", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/backend/tasks"),
      ["..", "auth"],
    );
    expect(response.status).toBe(404);
  });
});

describe("shared WebSocket ticket handoff", () => {
  const originalUrl = process.env.SHARED_WEBSOCKET_URL;
  const originalKey = process.env.WEBSOCKET_RELAY_KEY;
  beforeEach(() => {
    process.env.SHARED_WEBSOCKET_URL = "http://shared-socket.test:8081";
    process.env.WEBSOCKET_RELAY_KEY =
      "private-relay-key-with-at-least-32-characters";
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalUrl === undefined) delete process.env.SHARED_WEBSOCKET_URL;
    else process.env.SHARED_WEBSOCKET_URL = originalUrl;
    if (originalKey === undefined) delete process.env.WEBSOCKET_RELAY_KEY;
    else process.env.WEBSOCKET_RELAY_KEY = originalKey;
  });
  function request() {
    return new NextRequest("http://localhost/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        cookie: "wms_session=private-jwt",
      },
      body: "{}",
    });
  }
  it("returns a short-lived ticket without exposing JWT or relay credentials", async () => {
    const fetcher = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ ...identity, passwordChangeRequired: false }),
      )
      .mockResolvedValueOnce(
        Response.json({ ticket: "a".repeat(43), expiresIn: 30 }),
      );
    const result = await auth(request(), "socket-ticket");
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      ticket: "a".repeat(43),
      expiresIn: 30,
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      new URL("http://shared-socket.test:8081/internal/tickets/wkms"),
      expect.objectContaining({
        headers: {
          Authorization: "Bearer private-jwt",
          "x-relay-key": process.env.WEBSOCKET_RELAY_KEY,
        },
      }),
    );
  });
  it("blocks first-login sessions and does not request a ticket", async () => {
    const fetcher = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(identity));
    expect((await auth(request(), "socket-ticket")).status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not issue a ticket when session verification is unavailable", async () => {
    const fetcher = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({}, { status: 503 }));
    expect((await auth(request(), "socket-ticket")).status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
