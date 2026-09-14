import { AppShell } from "@/components/app-shell";
import {mockCompletedShiftTasks, mockConnectivity, mockShiftSummary} from "@/data/mock-shift-dashboard";
import {taskCategoryImages} from "@/lib/task-images";
import Image from "next/image";

export default function ShiftPage() {
    return (
        <AppShell
            title="Shift Dashboard"
            activeTab="shift"
            queueCount={4}
            myTasksCount={2}
        >
            <div className="mx-auto w-full max-w-7xl">
                {/* Worker summary */}
                <section className="rounded-xl bg-wkms-navy px-3 py-3 text-white shadow-sm sm:px-4 sm:py-3.5">
                    <div className="flex items-center gap-3">
                        {/* Worker avatar */}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-wkms-gold bg-white/10 text-sm font-semibold sm:h-12 sm:w-12">
                            W
                        </div>

                        {/* Worker info */}
                        <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-semibold sm:text-base">
                                {mockShiftSummary.workerName}
                            </h2>

                            <p className="mt-0.5 text-[11px] text-white/60 sm:text-xs">
                                Shift started {mockShiftSummary.shiftStartedAt}
                                {" · "}
                                {mockShiftSummary.shiftDuration}
                            </p>
                        </div>

                        {/* Rating */}
                        <div className="shrink-0 text-right">
                            <p className="text-xl font-bold leading-none text-wkms-gold sm:text-2xl">
                                {mockShiftSummary.rating}
                            </p>

                            <p className="mt-1 text-[10px] text-white/60 sm:text-xs">
                                Rating
                            </p>
                        </div>
                    </div>
                </section>

                {/* Today's summary */}
                <section className="mt-4 sm:mt-5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                        Today&apos;s Summary
                    </p>

                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                            <p className="text-2xl font-semibold leading-none text-wkms-navy sm:text-3xl">
                                {mockShiftSummary.tasksCompleted}
                            </p>

                            <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                                Tasks completed
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                            <p className="text-2xl font-semibold leading-none text-wkms-gold sm:text-3xl">
                                {mockShiftSummary.averageCompletionMinutes}m
                            </p>

                            <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                                Avg. completion
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                            <p className="text-2xl font-semibold leading-none text-wkms-navy sm:text-3xl">
                                {mockShiftSummary.activeTasks}
                            </p>

                            <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                                Active now
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                            <p className="text-2xl font-semibold leading-none text-wkms-green sm:text-3xl">
                                {mockShiftSummary.escalations}
                            </p>

                            <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                                Escalations
                            </p>
                        </div>
                    </div>
                </section>

                {/* Completed task history */}
                <section className="mt-5 sm:mt-6">
                    <div className="mb-2 border-t border-slate-200 pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                            Completed Task History
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        {mockCompletedShiftTasks.map((task, index) => {
                            const categoryLabels = {
                                ROOM_CLEANING: "Room Cleaning",
                                EXTRA_TOWELS: "Extra Towels",
                                WATER_BOTTLES: "Water Bottles",
                                MAINTENANCE: "Maintenance",
                                LAUNDRY: "Laundry Pickup",
                                FOOD_DELIVERY: "Food Delivery",
                                OTHER: "Other",
                            } as const;

                            return (
                                <div
                                    key={task.id}
                                    className={[
                                        "flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3",
                                        index !== mockCompletedShiftTasks.length - 1
                                            ? "border-b border-slate-100"
                                            : "",
                                    ].join(" ")}
                                >
                                    {/* Task image */}
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
                                            {task.id} · {categoryLabels[task.category]}
                                        </p>

                                        <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                                            Room {task.roomNumber}
                                        </p>
                                    </div>

                                    {/* Duration */}
                                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 sm:text-xs">
                                        {task.durationMinutes} min
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Connectivity */}
                <section className="mt-5 pb-4 sm:mt-6">
                    <div className="mb-2 border-t border-slate-200 pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                            Connectivity
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        {/* Network */}
                        <div className="px-3 sm:px-4">
                            <div className="flex items-center justify-between gap-4 py-2.5 sm:py-3">
                                <span className="text-xs text-slate-500 sm:text-sm">
                                  Network
                                </span>

                                <span
                                    className={[
                                        "text-right text-xs font-medium sm:text-sm",
                                        mockConnectivity.online
                                            ? "text-wkms-green"
                                            : "text-red-600",
                                    ].join(" ")}
                                >
                                  {mockConnectivity.online ? "● Online" : "● Offline"}
                                                            {" — "}
                                                            {mockConnectivity.networkLabel}
                                </span>
                            </div>

                            <div className="border-b border-slate-100" />
                        </div>

                        {/* Offline cache */}
                        <div className="px-3 sm:px-4">
                            <div className="flex items-center justify-between gap-4 py-2.5 sm:py-3">
                                <span className="text-xs text-slate-500 sm:text-sm">
                                  Offline cache
                                </span>

                                <span className="text-right text-xs font-medium text-slate-800 sm:text-sm">
                                  {mockConnectivity.cacheLabel}
                                </span>
                            </div>

                            <div className="border-b border-slate-100" />
                        </div>

                        {/* Last sync */}
                        <div className="px-3 sm:px-4">
                            <div className="flex items-center justify-between gap-4 py-2.5 sm:py-3">
                                <span className="text-xs text-slate-500 sm:text-sm">
                                  Last sync
                                </span>

                                <span className="text-xs font-semibold text-slate-800 sm:text-sm">
                                  {mockConnectivity.lastSync}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </AppShell>
    );
}