import type { TaskApiRecord } from "@/features/tasks/types/task-api";

import {
    loadPendingTaskUpdates,
    markTaskUpdateForReview,
    type PendingTaskUpdate,
} from "./offline-task-queue";

export type ReconciliationResult = {
    updates: PendingTaskUpdate[];
    pendingCount: number;
    reviewCount: number;
};

export function reconcilePendingTaskUpdates(
    workerId: string,
    serverTasks: TaskApiRecord[],
): ReconciliationResult {
    const updates = loadPendingTaskUpdates(workerId);

    if (updates.length === 0) {
        return {
            updates: [],
            pendingCount: 0,
            reviewCount: 0,
        };
    }

    const tasksById = new Map(
        serverTasks.map((task) => [task.task_id, task]),
    );

    for (const update of updates) {
        if (update.state === "NEEDS_REVIEW") {
            continue;
        }

        const serverTask = tasksById.get(update.taskId);

        const stillEligible =
            serverTask !== undefined &&
            serverTask.assigned_worker_id === workerId &&
            serverTask.status === update.expectedStatus;

        if (!stillEligible) {
            markTaskUpdateForReview(
                workerId,
                update.id,
            );
        }
    }

    const reconciledUpdates =
        loadPendingTaskUpdates(workerId);

    return {
        updates: reconciledUpdates,

        pendingCount: reconciledUpdates.filter(
            (update) => update.state === "PENDING",
        ).length,

        reviewCount: reconciledUpdates.filter(
            (update) => update.state === "NEEDS_REVIEW",
        ).length,
    };
}
