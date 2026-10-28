"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { getMyTasks, getTaskQueue } from "@/features/tasks/api/tasks.api";

import type { TaskApiRecord } from "@/features/tasks/types/task-api";

import { ApiError } from "@/lib/api-client";
import {connectTaskSocket, TASK_SOCKET_EVENTS} from "@/lib/task-socket";
import {loadOfflineTasks, saveOfflineTasks} from "@/features/offline/offline-task-storage";
import {getAuthSession} from "@/lib/auth-session";
import {reconcilePendingTaskUpdates} from "@/features/offline/offline-task-reconciliation";

type TaskDataContextValue = {
  queue: TaskApiRecord[];
  myTasks: TaskApiRecord[];
  queueCount: number;
  myTasksCount: number;
  loading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  refreshQueue: () => Promise<void>;
  refreshMyTasks: () => Promise<void>;
  offline: boolean;
};

const TaskDataContext = createContext<TaskDataContextValue | null>(null);

type TaskDataProviderProps = {
  children: ReactNode;
};

export function TaskDataProvider({ children }: TaskDataProviderProps) {
  const router = useRouter();

  const [queue, setQueue] = useState<TaskApiRecord[]>([]);

  const [myTasks, setMyTasks] = useState<TaskApiRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const initialLoadStartedRef = useRef(false);

  const [offline, setOffline] = useState(false);

  const requestInFlightRef = useRef<Promise<void> | null>(null);

  const refreshQueue = useCallback(async () => {
    const result = await getTaskQueue();

    if (mountedRef.current) {
      setQueue(result);
      setError(null);
    }
  }, []);

  const refreshMyTasks = useCallback(async () => {
    const session = getAuthSession();

    try {
      const result = await getMyTasks();

      if (mountedRef.current) {
        setMyTasks(result);
        setError(null);
        setOffline(false);

        if (session && getAuthSession()?.worker.worker_id === session.worker.worker_id) {
          const workerId = session.worker.worker_id;

          saveOfflineTasks(workerId, result);

          reconcilePendingTaskUpdates(workerId, result);
          window.dispatchEvent(
              new Event("wkms:pending-updates-changed"),
          );
        }
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        throw requestError;
      }

      if (session && mountedRef.current) {
        const cached = loadOfflineTasks(session.worker.worker_id);

        if (cached) {
          setMyTasks(cached);
          setOffline(true);
          setError(null);
          return;
        }
      }

      throw requestError;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (requestInFlightRef.current) {
      return requestInFlightRef.current;
    }

    const request = (async () => {
      try {
        setError(null);

        const [queueResult, myTasksResult] = await Promise.all([
          getTaskQueue(),
          getMyTasks(),
        ]);

        if (!mountedRef.current) {
          return;
        }

        setQueue(queueResult);
        setMyTasks(myTasksResult);
        setOffline(false);

        const session = getAuthSession();

        if (session) {
          const workerId = session.worker.worker_id;

          saveOfflineTasks(workerId, myTasksResult);

          reconcilePendingTaskUpdates(workerId, myTasksResult);
          window.dispatchEvent(
              new Event("wkms:pending-updates-changed"),
          );
        }
      } catch (requestError) {
        if (!mountedRef.current) {
          return;
        }

        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace("/login");

          return;
        }
        const session = getAuthSession();

        if (session) {
          const cached = loadOfflineTasks(session.worker.worker_id);

          if (cached) {
            setMyTasks(cached);
            setQueue([]);
            setOffline(true);
            setError(null);
            return;
          }
        }

        setError("Unable to refresh task data.");

        throw requestError;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }

        requestInFlightRef.current = null;
      }
    })();

    requestInFlightRef.current = request;

    return request;
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;

    if (!initialLoadStartedRef.current) {
      initialLoadStartedRef.current = true;

      void refreshAll().catch(() => undefined);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [refreshAll]);

  /*
   * DDP-80 fallback refresh:
   * when the worker returns to the WKMS browser tab,
   * refresh the shared data once.
   *
   * DDP-79 will later add Socket.IO realtime updates.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshAll().catch(() => undefined);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshAll]);

  useEffect(() => {
    const handleOnline = () => {
      void refreshAll().catch(() => undefined);
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [refreshAll]);

  // DDP-79: Realtime updates from the WKMS backend.
  useEffect(() => {
    const socket = connectTaskSocket();

    if (!socket) {
      return;
    }

    const refreshTasks = () => {
      void refreshAll().catch(() => undefined);
    };

    const handleAuthError = (error: Error) => {
      if (/auth|token|worker|unauthorized|expired|invalid/i.test(error.message)) {
        socket.disconnect();
        router.replace("/login");
      }
    };

    // Re-fetch after reconnecting to recover missed events.
    socket.on("connect", refreshTasks);

    for (const eventName of TASK_SOCKET_EVENTS) {
      socket.on(eventName, refreshTasks);
    }

    socket.on("connect_error", handleAuthError);

    socket.connect();

    return () => {
      socket.off("connect", refreshTasks);

      for (const eventName of TASK_SOCKET_EVENTS) {
        socket.off(eventName, refreshTasks);
      }

      socket.off("connect_error", handleAuthError);
      socket.disconnect();
    };
  }, [refreshAll, router]);

  const value = useMemo<TaskDataContextValue>(
    () => ({
      queue,
      myTasks,

      queueCount: queue.length,

      myTasksCount: myTasks.filter(
        (task) => task.status === "ASSIGNED" || task.status === "IN_PROGRESS",
      ).length,

      loading,
      error,
      offline,
      refreshAll,
      refreshQueue,
      refreshMyTasks,
    }),
    [queue, myTasks, loading, error, offline, refreshAll, refreshQueue, refreshMyTasks],
  );

  return (
    <TaskDataContext.Provider value={value}>
      {children}
    </TaskDataContext.Provider>
  );
}

export function useTaskData() {
  const context = useContext(TaskDataContext);

  if (!context) {
    throw new Error("useTaskData must be used inside TaskDataProvider");
  }

  return context;
}
