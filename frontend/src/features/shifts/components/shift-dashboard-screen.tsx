"use client";

import { Alert, Spin } from "antd";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";

import { taskCategoryImages } from "@/features/tasks/constants/task-images.constants";

import { ApiError } from "@/lib/api-client";

import { getShiftSummary } from "../api/shift.api";

import type { ShiftSummary } from "../types/shift-summary";

const categoryLabels = {
  ROOM_CLEANING: "Room Cleaning",
  EXTRA_TOWELS: "Extra Towels",
  WATER_BOTTLES: "Water Bottles",
  MAINTENANCE: "Maintenance",
  LAUNDRY: "Laundry",
  FOOD_DELIVERY: "Food Delivery",
  OTHER: "Other",
} as const;

export function ShiftDashboardScreen() {
  const router = useRouter();

  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getShiftSummary()
      .then((shiftSummary) => {
        if (cancelled) {
          return;
        }

        setSummary(shiftSummary);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (cancelled) {
          return;
        }

        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace("/login");
          return;
        }

        setError("Unable to load shift summary.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <AppShell title="Shift Dashboard" activeTab="shift">
      <div className="mx-auto w-full max-w-7xl">
        {loading && (
          <div className="flex min-h-48 items-center justify-center">
            <Spin description="Loading summary..." />
          </div>
        )}

        {error && <Alert type="error" showIcon title={error} />}

        {summary && (
          <>
            <section className="rounded-xl bg-wkms-navy px-3 py-3 text-white shadow-sm sm:px-4 sm:py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-wkms-gold bg-white/10 text-sm font-semibold sm:h-12 sm:w-12">
                  {summary.worker.full_name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold sm:text-base">
                    {summary.worker.full_name}
                  </h2>

                  <p className="mt-0.5 text-[11px] text-white/60 sm:text-xs">
                    {summary.worker.vocation ?? "Hotel Worker"}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-white/60">Operational day</p>

                  <p className="mt-1 text-xs font-medium text-wkms-gold">
                    {summary.operational_day.timezone}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-4 sm:mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                Today&apos;s Summary
              </p>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <p className="text-2xl font-semibold text-wkms-navy sm:text-3xl">
                    {summary.completed_task_count}
                  </p>

                  <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                    Tasks completed
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <p className="text-2xl font-semibold text-wkms-gold sm:text-3xl">
                    {summary.average_task_turnaround_seconds === null
                      ? "—"
                      : `${Math.round(
                          summary.average_task_turnaround_seconds / 60,
                        )}m`}
                  </p>

                  <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                    Avg. turnaround
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <p className="text-2xl font-semibold text-wkms-navy sm:text-3xl">
                    {summary.active_task_count}
                  </p>

                  <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                    Active now
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <p className="text-2xl font-semibold text-wkms-green sm:text-3xl">
                    {summary.available_escalated_task_count}
                  </p>

                  <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                    Available escalated
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-5 pb-4 sm:mt-6">
              <div className="mb-2 border-t border-slate-200 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                  Completed Task History
                </p>
              </div>

              {summary.completed_tasks.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {summary.completed_tasks.map((task, index) => (
                    <Link
                      key={task.task_id}
                      href={`/tasks/${task.task_id}?from=shift`}
                      aria-label={`View details for ${categoryLabels[task.category]} task in Room ${task.room_number}`}
                      className={[
                        "flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3",
                        "transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wkms-navy",

                        index !== summary.completed_tasks.length - 1
                          ? "border-b border-slate-100"
                          : "",
                      ].join(" ")}
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-11 sm:w-11">
                        <Image
                          src={taskCategoryImages[task.category]}
                          alt={categoryLabels[task.category]}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">
                          {task.task_id} · {categoryLabels[task.category]}
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                          Room {task.room_number}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 sm:text-xs">
                        {Math.round(task.turnaround_seconds / 60)} min
                        turnaround
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                  <p className="text-sm font-medium text-wkms-navy">
                    No completed tasks today
                  </p>
                </div>
              )}

              <p className="mt-3 text-xs text-slate-500">
                Turnaround is calculated from submitted time to completion time.
              </p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
