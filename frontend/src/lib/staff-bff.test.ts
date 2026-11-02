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
