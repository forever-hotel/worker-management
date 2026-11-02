import { ApiError } from "@/lib/api-client";
import type { LoginRequest, LoginResponse } from "../types/auth";

export async function staffRequest(action: string, body?: unknown) {
  const response = await fetch("/api/auth/" + action, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      data,
      data.message ?? "Unable to authenticate",
    );
  return data;
}
export async function loginWorker(
  credentials: LoginRequest,
): Promise<LoginResponse> {
  const session = await staffRequest("login", credentials);
  return sessionResponse(session);
}
export function sessionResponse(session: {
  sub: string;
  username: string;
  role: "WORKER" | "ROOT";
  expiresAt: number;
  passwordChangeRequired: boolean;
}): LoginResponse {
  return {
    access_token: "",
    token_type: "Bearer",
    expires_in: Math.max(0, session.expiresAt - Date.now() / 1000),
    worker: {
      worker_id: session.sub,
      full_name: session.username,
      username: session.username,
      role: session.role,
    },
    passwordChangeRequired: session.passwordChangeRequired,
  };
}
