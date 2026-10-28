export type OfflineTaskAction = "START" | "COMPLETE";

export type PendingTaskUpdate = {
    id: string;
    workerId: string;
    taskId: string;
    action: OfflineTaskAction;
    expectedStatus: "ASSIGNED" | "IN_PROGRESS";
    createdAt: number;
    state: "PENDING" | "NEEDS_REVIEW";
};

const STORAGE_KEY = "wkms.offline.pending-updates.v1";
const MAX_UPDATES = 20;
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function getStorage(): Storage | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

export function clearPendingTaskUpdates(): void {
    try {
        getStorage()?.removeItem(STORAGE_KEY);
    } catch {
        // Storage access may be restricted.
    }
}

function isValidUpdate(
    value: unknown,
    workerId: string,
): value is PendingTaskUpdate {
    if (!value || typeof value !== "object") {
        return false;
    }

    const update = value as Partial<PendingTaskUpdate>;

    return (
        typeof update.id === "string" &&
        update.id.length > 0 &&
        update.workerId === workerId &&
        typeof update.taskId === "string" &&
        update.taskId.length > 0 &&
        (update.action === "START" ||
            update.action === "COMPLETE") &&
        update.expectedStatus ===
        (update.action === "START"
            ? "ASSIGNED"
            : "IN_PROGRESS") &&
        (update.state === "PENDING" ||
            update.state === "NEEDS_REVIEW") &&
        typeof update.createdAt === "number" &&
        Number.isFinite(update.createdAt) &&
        update.createdAt <= Date.now() &&
        Date.now() - update.createdAt <= MAX_AGE_MS
    );
}

export function loadPendingTaskUpdates(
    workerId: string,
): PendingTaskUpdate[] {
    const storage = getStorage();

    if (!storage || !workerId.trim()) {
        return [];
    }

    try {
        const raw = storage.getItem(STORAGE_KEY);

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (
            !Array.isArray(parsed) ||
            parsed.length > MAX_UPDATES ||
            !parsed.every((item) => isValidUpdate(item, workerId))
        ) {
            clearPendingTaskUpdates();
            return [];
        }

        return parsed;
    } catch {
        clearPendingTaskUpdates();
        return [];
    }
}

export function queueTaskUpdate(
    workerId: string,
    taskId: string,
    action: OfflineTaskAction,
): PendingTaskUpdate | null {
    const storage = getStorage();

    if (
        !storage ||
        !workerId.trim() ||
        !taskId.trim()
    ) {
        return null;
    }

    const updates = loadPendingTaskUpdates(workerId);

    // Avoid conflicting or duplicate pending actions for
    // the same task until the server is consulted.
    if (
        updates.length >= MAX_UPDATES ||
        updates.some((item) => item.taskId === taskId)
    ) {
        return null;
    }

    if (typeof crypto === "undefined" ||
        typeof crypto.randomUUID !== "function") {
        return null;
    }

    const update: PendingTaskUpdate = {
        id: crypto.randomUUID(),
        workerId,
        taskId,
        action,
        expectedStatus:
            action === "START" ? "ASSIGNED" : "IN_PROGRESS",
        createdAt: Date.now(),
        state: "PENDING",
    };

    try {
        storage.setItem(
            STORAGE_KEY,
            JSON.stringify([...updates, update]),
        );

        return update;
    } catch {
        return null;
    }
}

export function markTaskUpdateForReview(
    workerId: string,
    updateId: string,
): boolean {
    const storage = getStorage();

    if (!storage) {
        return false;
    }

    const updates = loadPendingTaskUpdates(workerId);
    const target = updates.find(
        (update) => update.id === updateId,
    );

    if (!target) {
        return false;
    }

    try {
        storage.setItem(
            STORAGE_KEY,
            JSON.stringify(
                updates.map((update) =>
                    update.id === updateId
                        ? { ...update, state: "NEEDS_REVIEW" }
                        : update,
                ),
            ),
        );

        return true;
    } catch {
        return false;
    }
}

export function removePendingTaskUpdate(
    workerId: string,
    updateId: string,
): boolean {
    const storage = getStorage();

    if (!storage) {
        return false;
    }

    const updates = loadPendingTaskUpdates(workerId);

    if (!updates.some((update) => update.id === updateId)) {
        return false;
    }

    try {
        storage.setItem(
            STORAGE_KEY,
            JSON.stringify(
                updates.filter((update) => update.id !== updateId),
            ),
        );

        return true;
    } catch {
        return false;
    }
}
