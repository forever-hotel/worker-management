import type { AuthSession, LoginResponse } from "@/features/auth/types/auth";
import { clearOfflineTasks } from "@/features/offline/offline-task-storage";
import { clearPendingTaskUpdates } from "@/features/offline/offline-task-queue";

const AUTH_SESSION_KEY = "wkms.auth.session";

function hasBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

export function saveAuthSession(response: LoginResponse): AuthSession {
  const session: AuthSession = {
    accessToken: "", // JWT lives only in the HttpOnly cookie.
    tokenType: response.token_type,
    expiresAt: Date.now() + response.expires_in * 1000,
    worker: response.worker,
  };
  // A new login must not retain another worker's offline data.
  let previousId: string | undefined;
  try {
    previousId = hasBrowserStorage()
      ? JSON.parse(window.sessionStorage.getItem(AUTH_SESSION_KEY) ?? "null")
          ?.worker?.worker_id
      : undefined;
  } catch {
    /* Discard malformed browser metadata. */
  }
  if (previousId !== response.worker.worker_id) {
    clearOfflineTasks();
    clearPendingTaskUpdates();
  }
  if (hasBrowserStorage()) {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  }

  return session;
}

export function clearAuthSession(): void {
  // Covers explicit logout, expired sessions and rejected JWTs.
  clearOfflineTasks();
  clearPendingTaskUpdates();

  if (!hasBrowserStorage()) {
    return;
  }

  window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  queueMicrotask(() => window.dispatchEvent(new Event("wms:unauthenticated")));
}

export function getAuthSession(): AuthSession | null {
  if (!hasBrowserStorage()) {
    return null;
  }

  const stored = window.sessionStorage.getItem(AUTH_SESSION_KEY);

  if (!stored) {
    return null;
  }

  try {
    const session = JSON.parse(stored) as AuthSession;

    if (
      !session.worker ||
      typeof session.worker.worker_id !== "string" ||
      typeof session.worker.username !== "string" ||
      !["WORKER", "ROOT"].includes(session.worker.role) ||
      !session.expiresAt
    ) {
      clearAuthSession();
      return null;
    }

    if (Date.now() >= session.expiresAt) {
      clearAuthSession();
      return null;
    }

    return session;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getAccessToken(): string | null {
  return null; // Native sockets authenticate with the HttpOnly cookie.
}
