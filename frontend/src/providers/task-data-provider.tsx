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

  const requestInFlightRef = useRef<Promise<void> | null>(null);

  const refreshQueue = useCallback(async () => {
    const result = await getTaskQueue();

    if (mountedRef.current) {
      setQueue(result);
      setError(null);
    }
  }, []);

  const refreshMyTasks = useCallback(async () => {
    const result = await getMyTasks();

    if (mountedRef.current) {
      setMyTasks(result);
      setError(null);
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
      } catch (requestError) {
        if (!mountedRef.current) {
          return;
        }

        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace("/login");

          return;
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

      refreshAll,
      refreshQueue,
      refreshMyTasks,
    }),
    [queue, myTasks, loading, error, refreshAll, refreshQueue, refreshMyTasks],
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
