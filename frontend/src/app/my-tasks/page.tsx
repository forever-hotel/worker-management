"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MyTaskCard } from "@/components/my-task-card";
import { CompletedTaskCard } from "@/components/completed-task-card";
import {
    mockActiveTasks,
    mockCompletedTasks,
} from "@/data/mock-my-tasks";
import { mockTasks } from "@/data/mock-tasks";
import type { MyTask } from "@/types/my-task";

const MAX_ACTIVE_TASKS = 3;

export default function MyTasksPage() {
    const [activeTasks, setActiveTasks] =
        useState<MyTask[]>(mockActiveTasks);

    const [completedTasks, setCompletedTasks] =
        useState<MyTask[]>(mockCompletedTasks);

    const handleStart = (taskId: string) => {
        setActiveTasks((currentTasks) =>
            currentTasks.map((task) =>
                task.id === taskId
                    ? {
                        ...task,
                        status: "IN_PROGRESS",
                    }
                    : task,
            ),
        );
    };

    const handleComplete = (taskId: string) => {
        const completedTask = activeTasks.find(
            (task) => task.id === taskId,
        );

        if (!completedTask) {
            return;
        }

        const updatedCompletedTask: MyTask = {
            ...completedTask,
            status: "COMPLETED",
            completedAtLabel: "Just now",
            completionMinutes: completedTask.elapsedMinutes,
        };

        setActiveTasks((currentTasks) =>
            currentTasks.filter((task) => task.id !== taskId),
        );

        setCompletedTasks((currentTasks) => [
            updatedCompletedTask,
            ...currentTasks,
        ]);
    };

    return (
        <AppShell
            title="My Tasks"
            activeTab="my-tasks"
            queueCount={mockTasks.length}
            myTasksCount={activeTasks.length}
        >
            <div className="mx-auto w-full max-w-7xl">
                {/* Active section */}
                <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="text-xs font-semibold tracking-[0.1em] text-slate-500 sm:text-sm">
                            ACTIVE — {activeTasks.length} OF {MAX_ACTIVE_TASKS} SLOTS USED
                        </h2>
                    </div>

                    {activeTasks.length > 0 ? (
                        <div className="space-y-2.5 sm:space-y-3">
                            {activeTasks.map((task) => (
                                <MyTaskCard
                                    key={task.id}
                                    task={task}
                                    onStart={handleStart}
                                    onComplete={handleComplete}
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

                {/* Completed section */}
                <section className="mt-6 sm:mt-8">
                    <div className="mb-3 border-t border-slate-200 pt-5">
                        <h2 className="text-xs font-semibold tracking-[0.1em] text-slate-500 sm:text-sm">
                            COMPLETED THIS SHIFT
                        </h2>
                    </div>

                    <div className="space-y-2.5 sm:space-y-3">
                        {completedTasks.map((task) => (
                            <CompletedTaskCard
                                key={task.id}
                                task={task}
                            />
                        ))}
                    </div>
                </section>
            </div>
        </AppShell>
    );
}