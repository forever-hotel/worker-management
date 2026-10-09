
"use client";

import { Alert, Button, Spin } from "antd";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getShiftSummary } from "@/features/shifts/api/shift.api";
import type { ShiftCompletedTask } from "@/features/shifts/types/shift-summary";
import { completeTask, startTask } from "@/features/tasks/api/tasks.api";
import { taskCategoryImages } from "@/features/tasks/constants/task-images.constants";
import { mapTaskApiRecord } from "@/features/tasks/mappers/task.mapper";
import { ApiError } from "@/lib/api-client";
import { useTaskData } from "@/providers/task-data-provider";

import type { MyTask } from "../types/my-task";
import { MyTaskCard } from "./my-task-card";

const MAX_ACTIVE_TASKS = 3;

const categoryLabels: Record<ShiftCompletedTask["category"], string> = {
  ROOM_CLEANING: "Room Cleaning",
  EXTRA_TOWELS: "Extra Towels",
  WATER_BOTTLES: "Water Bottles",
  MAINTENANCE: "Maintenance",
  LAUNDRY: "Laundry",
  FOOD_DELIVERY: "Food Delivery",
  OTHER: "Other",
};

export function MyTasksScreen() {
  const router = useRouter();

  const {
    myTasks,
    loading,
    error: providerError,
    refreshMyTasks,
  } = useTaskData();

  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Completed tasks are loaded from the authenticated Shift Summary API.
  const [completedTasks, setCompletedTasks] = useState<ShiftCompletedTask[]>(
      [],
  );
  const [completedLoading, setCompletedLoading] = useState(true);
  const [completedError, setCompletedError] = useState<string | null>(null);
  const [completedRefreshKey, setCompletedRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void getShiftSummary()
        .then((summary) => {
          if (cancelled) return;

          setCompletedTasks(summary.completed_tasks);
          setCompletedError(null);
        })
        .catch((requestError: unknown) => {
          if (cancelled) return;

          if (
              requestError instanceof ApiError &&
              requestError.status === 401
          ) {
            router.replace("/login");
            return;
          }

          setCompletedError("Unable to load completed tasks.");
        })
        .finally(() => {
          if (!cancelled) {
            setCompletedLoading(false);
          }
        });

    return () => {
      cancelled = true;
    };
  }, [router, completedRefreshKey]);

  const activeTasks = useMemo<MyTask[]>(
      () => myTasks.map(mapTaskApiRecord),
      [myTasks],
  );

  const error = localError ?? providerError;

  const redirectIfUnauthorized = (requestError: unknown): boolean => {
    if (requestError instanceof ApiError && requestError.status === 401) {
      router.replace("/login");
      return true;
    }

    return false;
  };

  // --------------------------------------------------
  // Start Task
  // --------------------------------------------------

  const handleStart = async (taskId: string) => {
    setActionTaskId(taskId);
    setLocalError(null);

    try {
      await startTask(taskId);

      /*
       * Start changes ASSIGNED -> IN_PROGRESS.
       * Only active tasks need refreshing.
       */
      await refreshMyTasks();
    } catch (requestError) {
      if (redirectIfUnauthorized(requestError)) {
        return;
      }

      if (
          requestError instanceof ApiError &&
          (requestError.status === 403 ||
              requestError.status === 404 ||
              requestError.status === 409)
      ) {
        const message = requestError.message;

        await refreshMyTasks().catch(() => undefined);

        setLocalError(message);
        return;
      }

      setLocalError("Unable to start this task.");
    } finally {
      setActionTaskId(null);
    }
  };

  // --------------------------------------------------
  // Complete Task
  // --------------------------------------------------

  const handleComplete = async (taskId: string) => {
    setActionTaskId(taskId);
    setLocalError(null);

    try {
      await completeTask(taskId);

      /*
       * Complete changes IN_PROGRESS -> COMPLETED.
       * Refresh active tasks and completed history.
       */
      await refreshMyTasks();

      setCompletedRefreshKey((current) => current + 1);
    } catch (requestError) {
      if (redirectIfUnauthorized(requestError)) {
        return;
      }

      if (
          requestError instanceof ApiError &&
          (requestError.status === 403 ||
              requestError.status === 404 ||
              requestError.status === 409)
      ) {
        const message = requestError.message;

        await refreshMyTasks().catch(() => undefined);

        setLocalError(message);
        return;
      }

      setLocalError("Unable to complete this task.");
    } finally {
      setActionTaskId(null);
    }
  };

  // --------------------------------------------------
  // Retry Active Tasks
  // --------------------------------------------------

  const handleRetry = async () => {
    setLocalError(null);

    try {
      await refreshMyTasks();
    } catch (requestError) {
      if (redirectIfUnauthorized(requestError)) {
        return;
      }

      setLocalError("Unable to load your tasks.");
    }
  };

  return (
      <AppShell title="My Tasks" activeTab="my-tasks">
        <div className="mx-auto w-full max-w-7xl">
          {/* ==========================================
            ACTIVE TASKS
        ========================================== */}

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold tracking-[0.1em] text-slate-500 sm:text-sm">
                ACTIVE — {activeTasks.length} OF {MAX_ACTIVE_TASKS} SLOTS USED
              </h2>
            </div>

            {error && (
                <Alert
                    type="error"
                    showIcon
                    title={error}
                    className="mb-3"
                />
            )}

            {loading ? (
                <div className="flex min-h-48 items-center justify-center">
                  <Spin description="Loading your tasks..." />
                </div>
            ) : activeTasks.length > 0 ? (
                <div className="space-y-2.5 sm:space-y-3">
                  {activeTasks.map((task) => (
                      <MyTaskCard
                          key={task.id}
                          task={task}
                          onStart={handleStart}
                          onComplete={handleComplete}
                          actionLoading={actionTaskId === task.id}
                      />
                  ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center sm:py-10">
                  <p className="text-sm font-medium text-wkms-navy">
                    No active tasks
                  </p>

                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Claim a task from the Queue to start working.
                  </p>
                </div>
            )}
          </section>

          {/* Active task retry */}

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

          {/* ==========================================
            COMPLETED TASKS
        ========================================== */}

          <section className="mt-6 border-t border-slate-200 pt-5 sm:mt-8">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-slate-500 sm:text-sm">
              COMPLETED TODAY
            </h2>

            {/* Loading completed history */}

            {completedLoading && (
                <div className="mt-3 flex justify-center py-6">
                  <Spin description="Loading completed tasks..." />
                </div>
            )}

            {/* Completed history error */}

            {completedError && (
                <Alert
                    type="error"
                    showIcon
                    title={completedError}
                    className="mt-3"
                    action={
                      <Button
                          size="small"
                          onClick={() => {
                            setCompletedLoading(true);
                            setCompletedError(null);
                            setCompletedRefreshKey((current) => current + 1);
                          }}
                      >
                        Retry
                      </Button>
                    }
                />
            )}

            {/* No completed tasks */}

            {!completedLoading &&
                !completedError &&
                completedTasks.length === 0 && (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                      <p className="text-sm font-medium text-wkms-navy">
                        No completed tasks today
                      </p>
                    </div>
                )}

            {/* ==========================================
              COMPLETED TASK CARDS
              Same UI as Shift Dashboard
          ========================================== */}

            {!completedLoading &&
                !completedError &&
                completedTasks.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      {completedTasks.map((task, index) => (
                          <Link
                              key={task.task_id}
                              href={`/tasks/${task.task_id}?from=my-tasks`}
                              aria-label={`View completed task for Room ${task.room_number}`}
                              className={[
                                "flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3",
                                "transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wkms-navy",
                                index !== completedTasks.length - 1
                                    ? "border-b border-slate-100"
                                    : "",
                              ].join(" ")}
                          >
                            {/* Category image */}

                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-11 sm:w-11">
                              <Image
                                  src={taskCategoryImages[task.category]}
                                  alt={categoryLabels[task.category]}
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                              />
                            </div>

                            {/* Task information */}

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">
                                {task.task_id} · {categoryLabels[task.category]}
                              </p>

                              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                                Room {task.room_number}
                              </p>
                            </div>

                            {/* Turnaround badge */}

                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 sm:text-xs">
                      {Math.round(task.turnaround_seconds / 60)} min
                      turnaround
                    </span>
                          </Link>
                      ))}
                    </div>
                )}
          </section>
        </div>
      </AppShell>
  );
}
