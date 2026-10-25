import { io, type Socket } from "socket.io-client";

import { getAccessToken } from "@/lib/auth-session";

export const TASK_SOCKET_EVENTS = [
  "task.created",
  "task.claimed",
  "task.escalated",
] as const;

export function connectTaskSocket(): Socket | null {
  const token = getAccessToken();

  const baseUrl =
    process.env.NEXT_PUBLIC_WKMS_SOCKET_URL?.trim();

  if (!token || !baseUrl) {
    return null;
  }

  const socket = io(`${baseUrl.replace(/\/+$/, "")}/wkms`, {
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket"],
  });

  return socket;
}
