import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { mockTaskDetails } from "@/data/mock-task-details";
import { taskCategoryImages } from "@/lib/task-images";
import { Button } from "antd";

type TaskDetailPageProps = {
    params: Promise<{
        taskId: string;
    }>;
};

const categoryLabels = {
    ROOM_CLEANING: "Room Cleaning",
    EXTRA_TOWELS: "Extra Towels",
    WATER_BOTTLES: "Water Bottles",
    MAINTENANCE: "Maintenance",
    LAUNDRY: "Laundry",
    FOOD_DELIVERY: "Food Delivery",
    OTHER: "Other",
} as const;

const statusLabels = {
    UNASSIGNED: "Unassigned",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    ESCALATED: "Escalated",
} as const;

const statusStyles = {
    UNASSIGNED: "bg-slate-100 text-slate-700",
    ASSIGNED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-amber-100 text-amber-800",
    COMPLETED: "bg-green-100 text-green-700",
    ESCALATED: "bg-red-100 text-red-700",
} as const;

export default async function TaskDetailPage({
                                                 params,
                                             }: TaskDetailPageProps) {
    const { taskId } = await params;

    const task = mockTaskDetails[taskId];

    if (!task) {
        notFound();
    }

    const imageSrc = taskCategoryImages[task.category];

    const progressPercent = Math.min(
        100,
        Math.round(
            (task.elapsedMinutes / task.escalationThresholdMinutes) * 100,
        ),
    );

    const remainingMinutes =
        task.escalationThresholdMinutes - task.elapsedMinutes;

    const isCompleted = task.status === "COMPLETED";
    const isEscalated = task.status === "ESCALATED";

    const isNearEscalation =
        !isCompleted &&
        !isEscalated &&
        remainingMinutes > 0 &&
        remainingMinutes <= 3;

    return (
        <main className="min-h-dvh bg-wkms-page">
            {/* Header */}
            <header className="flex min-h-14 items-center justify-between gap-3 bg-wkms-navy px-4 text-white sm:px-6 md:px-8">
                <div className="flex items-center gap-3">
                    <Link
                        href="/my-tasks"
                        aria-label="Back to My Tasks"
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20"
                    >
                        <ArrowLeft size={18} aria-hidden="true" />
                    </Link>

                    <h1 className="text-base font-semibold sm:text-lg">
                        Task Detail
                    </h1>
                </div>

                <span className="text-xs font-medium text-white/70 sm:text-sm">
                  {task.id}
                </span>
            </header>

            <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-5 sm:py-5 md:px-6 mt-2">
                {/* Hero */}
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
                          Room {task.roomNumber} · Floor {task.floor}
                        </span>

                        <span
                            className={[
                                "rounded-md px-2.5 py-1 text-[11px] font-medium sm:text-xs",
                                statusStyles[task.status],
                            ].join(" ")}
                        >
                          {task.status === "COMPLETED"
                              ? `✓ ${statusLabels[task.status]}`
                              : task.status === "ESCALATED"
                                  ? `⚠ ${statusLabels[task.status]}`
                                  : `● ${statusLabels[task.status]}`}
                        </span>
                    </div>
                </section>

                {/* Task information */}
                <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {/* Request ID */}
                    <div className="px-3 sm:px-4">
                        <div className="flex items-center justify-between gap-4 py-2.5 sm:py-3">
                          <span className="text-xs text-slate-500 sm:text-sm">
                            Request ID
                          </span>

                            <span className="text-xs font-medium text-slate-800 sm:text-sm">
                                {task.id}
                            </span>
                        </div>

                        <div className="border-b border-slate-100" />
                    </div>

                    {/* Category */}
                    <div className="px-3 sm:px-4">
                        <div className="flex items-center justify-between gap-4 py-2.5 sm:py-3">
                          <span className="text-xs text-slate-500 sm:text-sm">
                            Category
                          </span>

                            <span className="text-right text-xs font-semibold text-slate-800 sm:text-sm">
                                {categoryLabels[task.category]}
                            </span>
                        </div>

                        <div className="border-b border-slate-100" />
                    </div>

                    {/* Priority */}
                    <div className="px-3 sm:px-4">
                        <div className="flex items-center justify-between gap-4 py-2.5 sm:py-3">
                          <span className="text-xs text-slate-500 sm:text-sm">
                            Priority
                          </span>

                            <span className="text-xs font-medium text-slate-800 sm:text-sm">
                                {task.priority === "HIGH" ? "High" : "Normal"}
                            </span>
                        </div>

                        <div className="border-b border-slate-100" />
                    </div>

                    {/* Submitted */}
                    <div className="px-3 sm:px-4">
                        <div className="flex items-center justify-between gap-4 py-2.5 sm:py-3">
                          <span className="text-xs text-slate-500 sm:text-sm">
                            Submitted
                          </span>

                            <span className="text-right text-xs font-medium text-slate-800 sm:text-sm">
                                {task.submittedAt} · {task.elapsedMinutes} min ago
                            </span>
                        </div>

                        <div className="border-b border-slate-100" />
                    </div>

                    {/* Claimed */}
                    {task.claimedAtLabel && (
                        <div className="px-3 sm:px-4">
                            <div className="flex items-center justify-between gap-4 py-2.5 sm:py-3">
                                <span className="text-xs text-slate-500 sm:text-sm">
                                  Claimed at
                                </span>

                                <span className="text-xs font-medium text-slate-800 sm:text-sm">
                                  {task.claimedAtLabel}
                                </span>
                            </div>
                        </div>
                    )}
                </section>

                {/* Guest description */}
                <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                        Guest Description
                    </p>

                    <div className="mt-2 rounded-lg border-l-4 border-wkms-gold bg-slate-50 px-3 py-3 sm:px-4">
                        <p className="text-sm leading-5 text-slate-700 sm:text-base sm:leading-6">
                            {task.guestDescription}
                        </p>
                    </div>
                </section>

                {/* Elapsed time */}
                <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                            Elapsed Time
                        </p>

                        <span
                            className={[
                                "text-xs font-semibold sm:text-sm",
                                isCompleted
                                    ? "text-wkms-green"
                                    : isEscalated
                                        ? "text-red-600"
                                        : "text-amber-700",
                            ].join(" ")}
                        >
                          {progressPercent}%
                        </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                        {task.elapsedMinutes} min / {task.escalationThresholdMinutes} min threshold
                    </p>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                            className={[
                                "h-full rounded-full transition-all",
                                isCompleted
                                    ? "bg-wkms-green"
                                    : isEscalated
                                        ? "bg-red-500"
                                        : "bg-wkms-gold",
                            ].join(" ")}
                            style={{
                                width: `${progressPercent}%`,
                            }}
                        />
                    </div>

                    {isNearEscalation && (
                        <p className="mt-2 text-xs font-medium text-amber-700 sm:text-sm">
                            ⚠ Task escalates in ~{remainingMinutes} min if incomplete
                        </p>
                    )}

                    {isEscalated && (
                        <p className="mt-2 text-xs font-medium text-red-600 sm:text-sm">
                            ⚠ This task has been escalated
                        </p>
                    )}

                    {isCompleted && (
                        <p className="mt-2 text-xs font-medium text-wkms-green sm:text-sm">
                            ✓ Task completed
                        </p>
                    )}
                </section>

                {/* Task actions */}
                <section className="mt-3 pb-4 sm:mt-4">
                    {(task.status === "UNASSIGNED" ||
                        task.status === "ESCALATED") && (
                        <Button
                            type="primary"
                            block
                            size="large"
                            className="font-semibold"
                            style={{ boxShadow: "none" }}
                        >
                            Claim Task
                        </Button>
                    )}

                    {task.status === "ASSIGNED" && (
                        <Button
                            type="primary"
                            block
                            size="large"
                            className="font-semibold"
                            style={{ boxShadow: "none" }}
                        >
                            Start Task
                        </Button>
                    )}

                    {task.status === "IN_PROGRESS" && (
                        <Button
                            type="primary"
                            block
                            size="large"
                            className="font-semibold"
                            style={{
                                backgroundColor: "#1A6B3C",
                                borderColor: "#1A6B3C",
                                boxShadow: "none",
                            }}
                        >
                            ✓ Mark as Complete
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