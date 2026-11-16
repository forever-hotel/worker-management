import { io, type Socket } from "socket.io-client";

import { getAuthSession } from "@/lib/auth-session";

export const TASK_SOCKET_EVENTS = [
  "task.created",
  "task.claimed",
  "task.escalated",
  "task.updated",
  "task.completed",
] as const;

export function connectTaskSocket(): Socket | null {
  const session = getAuthSession();

  const baseUrl = process.env.NEXT_PUBLIC_WKMS_SOCKET_URL?.trim();

  if (!session || !baseUrl) {
    return null;
  }

  const socket = io(baseUrl.replace(/\/+$/, ""), {
    path: "/realtime/socket.io",
    auth: (callback) => {
      void fetch("/api/auth/socket-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const body = await response.json();
          if (typeof body.ticket !== "string") throw new Error();
          callback({ ticket: body.ticket });
        })
        .catch(() => callback({ ticket: "" }));
    },
    withCredentials: false,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket"],
  });

  return socket;
}
