"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
    TaskFilters,
    type TaskFilter,
} from "@/components/task-filters";
import { TaskCard } from "@/components/task-card";
import { mockTasks } from "@/data/mock-tasks";

export default function QueuePage() {
    const [activeFilter, setActiveFilter] = useState<TaskFilter>("ALL");

    const filteredTasks = mockTasks.filter((task) => {
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
        <AppShell title="Task Queue" activeTab="queue" queueCount={mockTasks.length} myTasksCount={2}>
            <div className="mx-auto w-full max-w-7xl">

                {/* Filters */}
                <TaskFilters
                    activeFilter={activeFilter}
                    onChange={setActiveFilter}
                />

                {/* Tasks */}
                <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                    {filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => (
                            <TaskCard key={task.id} task={task} />
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

                {/* Active task limit */}
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs text-slate-500 sm:text-sm">
                    Active limit:{" "}
                    <span className="font-medium text-slate-600">
                        3 tasks max
                      </span>
                    {" "}· You have 2 active
                </div>
            </div>
        </AppShell>
    );
}