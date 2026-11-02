import { io, type Socket } from "socket.io-client";

import { getAuthSession } from "@/lib/auth-session";

export const TASK_SOCKET_EVENTS = [
  "task.created",
  "task.claimed",
  "task.escalated",
] as const;

export function connectTaskSocket(): Socket | null {
  const session = getAuthSession();

  const baseUrl = process.env.NEXT_PUBLIC_WKMS_SOCKET_URL?.trim();

  if (!session || !baseUrl) {
    return null;
  }

  const socket = io(`${baseUrl.replace(/\/+$/, "")}/wkms`, {
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket"],
  });

  return socket;
}
