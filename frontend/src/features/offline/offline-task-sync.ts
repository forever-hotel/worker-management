import {
    getMyTasks,
    getOfflineTaskActionReceipt,
    submitOfflineTaskAction,
} from "@/features/tasks/api/tasks.api";
import { ApiError } from "@/lib/api-client";
import { getAuthSession } from "@/lib/auth-session";

import {
    loadPendingTaskUpdates,
    type PendingTaskUpdate,
} from "./offline-task-queue";

export type OfflineSyncOutcome =
    | "CONFIRMED"
    | "NEEDS_REVIEW"
    | "RETRY_LATER"
    | "UNCERTAIN"
    | "AUTH_REQUIRED"
    | "BUSY";

type SessionIdentity = {
    workerId: string;
    accessToken: string;
    expiresAt: number;
};

const inFlight = new Set<string>();

function getSessionIdentity(): SessionIdentity | null {
    const session = getAuthSession();

    if (!session) return null;

    return {
        workerId: session.worker.worker_id,
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
    };
}

function isSameSession(original: SessionIdentity): boolean {
    const current = getSessionIdentity();

    return (
        current !== null &&
        current.workerId === original.workerId &&
        current.accessToken === original.accessToken &&
        current.expiresAt === original.expiresAt
    );
}

/**
 * Verify the original queued operation still exists.
 * The state may change from PENDING to NEEDS_REVIEW
 * during reconciliation; its immutable identity must not.
 */
function getStoredUpdate(
    update: PendingTaskUpdate,
): PendingTaskUpdate | null {
    const current = loadPendingTaskUpdates(
        update.workerId,
    ).find((item) => item.id === update.id);

    if (
        !current ||
        current.workerId !== update.workerId ||
        current.taskId !== update.taskId ||
        current.action !== update.action ||
        current.expectedStatus !== update.expectedStatus ||
        current.createdAt !== update.createdAt
    ) {
        return null;
    }

    return current;
}

/**
 * Check a response against the exact queued operation.
 */
function isConfirmedTask(
    update: PendingTaskUpdate,
    task: {
        task_id: string;
        assigned_worker_id: string | null;
        status: string;
    },
): boolean {
    const expectedStatus =
        update.action === "START"
            ? "IN_PROGRESS"
            : "COMPLETED";

    return (
        task.task_id === update.taskId &&
        task.assigned_worker_id === update.workerId &&
        task.status === expectedStatus
    );
}

/**
 * Synchronize one explicitly selected offline operation.
 *
 * A receipt lookup is always attempted before a mutation.
 * NEEDS_REVIEW actions may be checked read-only but never
 * submitted as new mutations.
 *
 * This coordinator does not modify the local queue.
 * The caller may remove an entry only after CONFIRMED.
 */
export async function synchronizePendingTaskUpdate(
    update: PendingTaskUpdate,
): Promise<OfflineSyncOutcome> {
    const session = getSessionIdentity();

    if (!session || session.workerId !== update.workerId) {
        return "AUTH_REQUIRED";
    }

    if (!getStoredUpdate(update)) {
        return "NEEDS_REVIEW";
    }

    if (
        typeof navigator !== "undefined" &&
        !navigator.onLine
    ) {
        return "RETRY_LATER";
    }

    if (inFlight.has(update.id)) {
        return "BUSY";
    }

    inFlight.add(update.id);

    try {
        // Phase 1: Check whether this operation already
        // committed during a previous attempt.
        let receiptFound = false;

        try {
            const receipt = await getOfflineTaskActionReceipt(
                update.taskId,
                update.id,
            );

            if (!isSameSession(session)) {
                return "AUTH_REQUIRED";
            }

            if (!getStoredUpdate(update)) {
                return "NEEDS_REVIEW";
            }

            receiptFound = true;

            if (
                receipt.action !== update.action ||
                !isConfirmedTask(update, receipt.task)
            ) {
                // A mismatched receipt must never lead to POST.
                return "UNCERTAIN";
            }

            return "CONFIRMED";
        } catch (error) {
            if (error instanceof ApiError) {
                if (error.status === 401) {
                    return "AUTH_REQUIRED";
                }

                if (error.status === 403 || error.status === 409) {
                    return "NEEDS_REVIEW";
                }

                if (error.status !== 404) {
                    return "RETRY_LATER";
                }
            } else {
                return "RETRY_LATER";
            }
        }

        // Only an explicit 404 means no matching receipt
        // was found. Never interpret a network failure
        // as proof that the request did not commit.
        if (receiptFound) {
            return "UNCERTAIN";
        }

        if (!isSameSession(session)) {
            return "AUTH_REQUIRED";
        }

        const stored = getStoredUpdate(update);

        // Review-state actions are read-only.
        if (
            !stored ||
            stored.state !== "PENDING" ||
            update.state !== "PENDING"
        ) {
            return "NEEDS_REVIEW";
        }

        // Phase 2: Fetch current server state.
        let serverTasks: Awaited<ReturnType<typeof getMyTasks>>;

        try {
            serverTasks = await getMyTasks();
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                return "AUTH_REQUIRED";
            }

            return "RETRY_LATER";
        }

        if (!isSameSession(session)) {
            return "AUTH_REQUIRED";
        }

        const current = getStoredUpdate(update);

        if (!current || current.state !== "PENDING") {
            return "NEEDS_REVIEW";
        }

        const task = serverTasks.find(
            (item) => item.task_id === update.taskId,
        );

        if (
            !task ||
            task.assigned_worker_id !== update.workerId ||
            task.status !== update.expectedStatus
        ) {
            return "NEEDS_REVIEW";
        }

        // Phase 3: Submit exactly the original request ID.
        // No automatic retries are performed here.
        try {
            const response = await submitOfflineTaskAction({
                taskId: update.taskId,
                requestId: update.id,
                action: update.action,
            });

            if (!isSameSession(session)) {
                return "AUTH_REQUIRED";
            }

            if (!getStoredUpdate(update)) {
                return "NEEDS_REVIEW";
            }

            if (
                !isConfirmedTask(update, response.task) ||
                typeof response.replayed !== "boolean"
            ) {
                return "UNCERTAIN";
            }

            return "CONFIRMED";
        } catch (error) {
            if (error instanceof ApiError) {
                if (error.status === 401) {
                    return "AUTH_REQUIRED";
                }

                if (
                    error.status === 403 ||
                    error.status === 404 ||
                    error.status === 409
                ) {
                    return "NEEDS_REVIEW";
                }
            }

            // The server might have committed before the
            // response was lost. Preserve the original ID.
            return "UNCERTAIN";
        }
    } finally {
        inFlight.delete(update.id);
    }
}
