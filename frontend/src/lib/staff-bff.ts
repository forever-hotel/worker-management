import { NextRequest, NextResponse } from "next/server";

const system = "wkms";
const cookie = "wms_session";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const gateway = () =>
  (process.env.API_GATEWAY_INTERNAL_URL ?? "http://localhost:8080").replace(
    /\/$/,
    "",
  );
function writable(request: NextRequest) {
  const origin = process.env.APP_ORIGIN ?? request.nextUrl.origin;
  return (
    request.headers.get("origin") === origin &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
function options(request: NextRequest, expiresAt = 0) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: (process.env.APP_ORIGIN ?? request.nextUrl.origin).startsWith(
      "https:",
    ),
    path: "/",
    maxAge: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
  };
}
export async function auth(request: NextRequest, action: string) {
  const allowed = [
    "login",
    "session",
    "logout",
    "change-password",
    "request-password-reset",
    "reset-password",
  ];
  if (
    !allowed.includes(action) ||
    (action === "session"
      ? request.method !== "GET"
      : request.method !== "POST")
  )
    return json({ message: "Not found" }, 404);
  if (
    request.method !== "GET" &&
    (!writable(request) ||
      !request.headers.get("content-type")?.startsWith("application/json"))
  )
    return json({ message: "Forbidden" }, 403);
  const token = request.cookies.get(cookie)?.value;
  if (["session", "logout", "change-password"].includes(action) && !token)
    return json({ message: "Please sign in" }, 401);
  try {
    const raw = request.method === "GET" ? undefined : await request.text();
    if (raw && raw.length > 8192)
      return json({ message: "Request too large" }, 413);
    const response = await fetch(gateway() + "/" + system + "/auth/" + action, {
      method: request.method,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(raw === undefined ? {} : { body: raw }),
    });
    const body = await response.json();
    if (!response.ok) {
      const result = json(
        {
          message:
            typeof body.message === "string"
              ? body.message
              : "Unable to complete request",
          code: body.code,
        },
        response.status,
      );
      if (response.status === 401 && ["session", "logout"].includes(action))
        result.cookies.set(cookie, "", options(request));
      return result;
    }
    if (["login", "session", "change-password"].includes(action)) {
      if (
        !body ||
        typeof body.sub !== "string" ||
        typeof body.username !== "string" ||
        !Array.isArray(body.roles) ||
        !Number.isSafeInteger(body.expiresAt) ||
        body.expiresAt * 1000 <= Date.now() ||
        typeof body.passwordChangeRequired !== "boolean" ||
        (action !== "session" && typeof body.accessToken !== "string")
      )
        return json({ message: "Invalid staff session" }, 503);
      const result = json({
        sub: body.sub,
        username: body.username,
        role: body.role,
        roles: body.roles,
        expiresAt: body.expiresAt,
        passwordChangeRequired: body.passwordChangeRequired,
      });
      if (action !== "session")
        result.cookies.set(
          cookie,
          body.accessToken,
          options(request, body.expiresAt),
        );
      return result;
    }
    const result = json(body);
    if (action === "logout") result.cookies.set(cookie, "", options(request));
    return result;
  } catch {
    return json(
      { message: "Staff authentication is unavailable. Please retry." },
      503,
    );
  }
}
export async function proxy(request: NextRequest, path: string[]) {
  if (
    !path.length ||
    path.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        /[\\/\x00-\x1f?#%]/.test(segment),
    ) ||
    path[0] === "auth"
  )
    return json({ message: "Not found" }, 404);
  const token = request.cookies.get(cookie)?.value;
  if (!token) return json({ message: "Please sign in" }, 401);
  if (!["GET", "HEAD"].includes(request.method) && !writable(request))
    return json({ message: "Forbidden" }, 403);
  try {
    const headers = new Headers({ Authorization: "Bearer " + token });
    for (const key of [
      "content-type",
      "accept",
      "idempotency-key",
      "if-match",
      "if-none-match",
    ]) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    const raw = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer();
    if (raw && raw.byteLength > 10 * 1024 * 1024)
      return json({ message: "Request too large" }, 413);
    const response = await fetch(
      gateway() +
        "/wms/" +
        path.map(encodeURIComponent).join("/") +
        request.nextUrl.search,
      {
        method: request.method,
        headers,
        body: raw,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      },
    );
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return json({ message: "Service unavailable. Please retry." }, 503);
  }
}
