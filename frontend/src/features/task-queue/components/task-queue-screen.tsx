"use client";

import { Alert, Button, Spin } from "antd";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";

import { claimTask } from "@/features/tasks/api/tasks.api";

import { TaskCard } from "@/features/tasks/components/task-card";

import { mapTaskApiRecord } from "@/features/tasks/mappers/task.mapper";

import type { Task } from "@/features/tasks/types/task";

import { ApiError } from "@/lib/api-client";

import { useTaskData } from "@/providers/task-data-provider";

import { TaskFilter, TaskFilters } from "./task-filters";

export function TaskQueueScreen() {
  const router = useRouter();

  const {
    queue,
    myTasksCount,
    loading,
    error: providerError,
    refreshAll,
  } = useTaskData();

  const [activeFilter, setActiveFilter] = useState<TaskFilter>("ALL");

  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);

  const [localError, setLocalError] = useState<string | null>(null);

  const tasks = useMemo<Task[]>(() => queue.map(mapTaskApiRecord), [queue]);

  const error = localError ?? providerError;

  const redirectIfUnauthorized = (requestError: unknown): boolean => {
    if (requestError instanceof ApiError && requestError.status === 401) {
      router.replace("/login");

      return true;
    }

    return false;
  };

  const handleClaim = async (task: Task) => {
    setClaimingTaskId(task.id);

    setLocalError(null);

    try {
      await claimTask(task.id);

      /*
       * Claim changes both collections:
       *
       * queue:
       * task disappears for other workers
       *
       * myTasks:
       * claimed task now belongs to this worker
       */
      await refreshAll();
    } catch (requestError) {
      if (redirectIfUnauthorized(requestError)) {
        return;
      }

      if (requestError instanceof ApiError && requestError.status === 409) {
        /*
         * Another worker claimed it first.
         * Reconcile shared state with the server.
         */
        await refreshAll().catch(() => undefined);

        setLocalError(requestError.message || "Task is no longer available.");

        return;
      }

      setLocalError("Unable to claim this task.");
    } finally {
      setClaimingTaskId(null);
    }
  };

  const handleRetry = async () => {
    setLocalError(null);

    try {
      await refreshAll();
    } catch (requestError) {
      if (redirectIfUnauthorized(requestError)) {
        return;
      }

      setLocalError("Unable to load the task queue.");
    }
  };

  const filteredTasks = tasks.filter((task) => {
    switch (activeFilter) {
      case "CLEANING":
        return task.category === "ROOM_CLEANING";

      case "MAINTENANCE":
        return task.category === "MAINTENANCE";

      case "DELIVERY":
        return task.category === "FOOD_DELIVERY";

      default:
        return true;
    }
  });

  return (
    <AppShell title="Task Queue" activeTab="queue">
      <div className="mx-auto w-full max-w-7xl">
        <TaskFilters activeFilter={activeFilter} onChange={setActiveFilter} />

        {error && (
          <Alert type="error" showIcon title={error} className="mt-3" />
        )}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Spin description="Loading tasks..." />
          </div>
        ) : (
          <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClaim={handleClaim}
                  claimLoading={claimingTaskId === task.id}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center sm:py-14">
                <p className="text-sm font-medium text-wkms-navy">
                  No tasks available
                </p>

                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  There are currently no tasks in this category.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs text-slate-500 sm:text-sm">
          Active limit:{" "}
          <span className="font-medium text-slate-600">3 tasks max</span>
          {" · "}
          You have {myTasksCount} active
        </div>

        {error && (
          <div className="mt-3 text-center">
            <Button
              size="small"
              onClick={() => {
                void handleRetry();
              }}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
