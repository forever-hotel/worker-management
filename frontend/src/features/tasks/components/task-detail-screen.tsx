"use client";

import { Alert, Button, Spin } from "antd";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  claimTask,
  completeTask,
  getTaskDetail,
  startTask,
} from "../api/tasks.api";

import { taskCategoryImages } from "../constants/task-images.constants";

import { mapTaskApiRecord } from "../mappers/task.mapper";

import type { Task } from "../types/task";

import { ApiError } from "@/lib/api-client";

type TaskDetailScreenProps = {
  taskId: string;
  from?: string;
};

const ESCALATION_THRESHOLD_MINUTES = 15;

const categoryLabels: Record<Task["category"], string> = {
  ROOM_CLEANING: "Room Cleaning",
  EXTRA_TOWELS: "Extra Towels",
  WATER_BOTTLES: "Water Bottles",
  MAINTENANCE: "Maintenance",
  LAUNDRY: "Laundry",
  FOOD_DELIVERY: "Food Delivery",
  OTHER: "Other",
};

const statusLabels: Record<Task["status"], string> = {
  UNASSIGNED: "Unassigned",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ESCALATED: "Escalated",
};

export function TaskDetailScreen({ taskId, from }: TaskDetailScreenProps) {
  const router = useRouter();

  const originHref =
    from === "queue"
      ? "/tasks"
      : from === "my-tasks"
        ? "/my-tasks"
        : from === "shift"
          ? "/shift"
          : null;

  const [task, setTask] = useState<Task | null>(null);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    const response = await getTaskDetail(taskId);

    setTask(mapTaskApiRecord(response));

    setError(null);
  }, [taskId]);

  const handleError = useCallback(
    (requestError: unknown) => {
      if (requestError instanceof ApiError) {
        if (requestError.status === 401) {
          router.replace("/login");

          return;
        }

        if (requestError.status === 403) {
          setError("You do not have access to this task.");

          return;
        }

        if (requestError.status === 404) {
          setError("Task not found.");

          return;
        }
      }

      setError("Unable to load this task.");
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    void getTaskDetail(taskId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setTask(mapTaskApiRecord(response));

        setError(null);
      })
      .catch((requestError: unknown) => {
        if (cancelled) {
          return;
        }

        handleError(requestError);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [handleError, taskId]);

  const runAction = async (action: () => Promise<unknown>) => {
    setActionLoading(true);

    setError(null);

    try {
      await action();

      await loadTask();
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-wkms-page">
        <Spin description="Loading task..." />
      </main>
    );
  }

  if (!task) {
    return (
      <main className="min-h-dvh bg-wkms-page px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <Alert
            type="error"
            showIcon
            title={error ?? "Task is unavailable."}
          />

          <Link
            href={originHref ?? "/tasks"}
            className="mt-4 inline-block text-sm font-medium text-wkms-navy"
          >
            ← Back to Task Queue
          </Link>
        </div>
      </main>
    );
  }

  const imageSrc = taskCategoryImages[task.category];

  const isAvailable =
    task.status === "UNASSIGNED" || task.status === "ESCALATED";

  const backHref = originHref ?? (isAvailable ? "/tasks" : "/my-tasks");

  const progressPercent = Math.min(
    100,
    Math.round((task.elapsedMinutes / ESCALATION_THRESHOLD_MINUTES) * 100),
  );

  return (
    <main className="min-h-dvh bg-wkms-page">
      <header className="flex min-h-14 items-center justify-between gap-3 bg-wkms-navy px-4 text-white sm:px-6 md:px-8">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>

          <h1 className="text-base font-semibold sm:text-lg">Task Detail</h1>
        </div>

        <span className="text-xs font-medium text-white/70 sm:text-sm">
          {task.id}
        </span>
      </header>

      <div className="mx-auto mt-2 w-full max-w-3xl px-3 py-3 sm:px-5 sm:py-5 md:px-6">
        {error && (
          <Alert type="error" showIcon title={error} className="mb-3" />
        )}

        <section className="relative h-40 overflow-hidden rounded-xl bg-slate-200/60 sm:h-40 md:h-52 lg:h-60">
          <Image
            src={imageSrc}
            alt={`${categoryLabels[task.category]} for Room ${task.roomNumber}`}
            fill
            priority
            className="object-contain"
          />

          <div className="absolute inset-0 bg-black/10" />

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2 sm:p-3">
            <span className="rounded-md bg-wkms-navy px-2.5 py-1 text-[11px] font-semibold text-white sm:text-xs">
              Room {task.roomNumber}
            </span>

            <span className="rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-wkms-navy sm:text-xs">
              {statusLabels[task.status]}
            </span>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="px-3 sm:px-4">
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-xs text-slate-500 sm:text-sm">Task ID</span>

              <span className="text-xs font-medium text-slate-800 sm:text-sm">
                {task.id}
              </span>
            </div>

            <div className="border-b border-slate-100" />
          </div>

          <div className="px-3 sm:px-4">
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-xs text-slate-500 sm:text-sm">
                Category
              </span>

              <span className="text-xs font-semibold text-slate-800 sm:text-sm">
                {categoryLabels[task.category]}
              </span>
            </div>

            <div className="border-b border-slate-100" />
          </div>

          <div className="px-3 sm:px-4">
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-xs text-slate-500 sm:text-sm">
                Priority
              </span>

              <span className="text-xs font-medium text-slate-800 sm:text-sm">
                {task.priority === "HIGH" ? "High" : "Normal"}
              </span>
            </div>

            <div className="border-b border-slate-100" />
          </div>

          <div className="px-3 sm:px-4">
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-xs text-slate-500 sm:text-sm">
                Submitted
              </span>

              <span className="text-right text-xs font-medium text-slate-800 sm:text-sm">
                {task.submittedAt}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
            Task Description
          </p>

          <p className="mt-2 text-sm leading-5 text-slate-700 sm:text-base sm:leading-6">
            {task.description}
          </p>
        </section>

        <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
            Time since submitted
          </p>

          <p className="mt-2 text-sm text-slate-700">
            {task.elapsedMinutes} minutes
          </p>

          {isAvailable && (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-wkms-gold"
                  style={{
                    width: `${progressPercent}%`,
                  }}
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Unclaimed-task escalation threshold:{" "}
                {ESCALATION_THRESHOLD_MINUTES} minutes
              </p>
            </>
          )}

          {task.status === "ESCALATED" && (
            <p className="mt-2 text-xs font-medium text-red-600">
              ⚠ This task has been escalated
            </p>
          )}
        </section>

        <section className="mt-3 pb-4 sm:mt-4">
          {isAvailable && (
            <Button
              type="primary"
              block
              size="large"
              loading={actionLoading}
              onClick={() => {
                void runAction(() => claimTask(task.id));
              }}
            >
              Claim Task
            </Button>
          )}

          {task.status === "ASSIGNED" && (
            <Button
              type="primary"
              block
              size="large"
              loading={actionLoading}
              onClick={() => {
                void runAction(() => startTask(task.id));
              }}
            >
              Start Task
            </Button>
          )}

          {task.status === "IN_PROGRESS" && (
            <Button
              type="primary"
              block
              size="large"
              loading={actionLoading}
              onClick={() => {
                void runAction(() => completeTask(task.id));
              }}
            >
              Mark Complete
            </Button>
          )}

          {task.status === "COMPLETED" && (
            <div className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-semibold text-wkms-green">
              ✓ Task Completed
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
