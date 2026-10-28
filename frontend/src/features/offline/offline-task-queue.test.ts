import {
    clearPendingTaskUpdates,
    loadPendingTaskUpdates,
    markTaskUpdateForReview,
    queueTaskUpdate,
    removePendingTaskUpdate,
} from "./offline-task-queue";

const WORKER_A = "11111111-1111-4111-8111-111111111111";
const WORKER_B = "22222222-2222-4222-8222-222222222222";

const TASK_A = "33333333-3333-4333-8333-333333333333";
const TASK_B = "44444444-4444-4444-8444-444444444444";

const STORAGE_KEY = "wkms.offline.pending-updates.v1";

describe("DDP-199 offline task update queue", () => {
    let originalRandomUUID: PropertyDescriptor | undefined;
    let sequence: number;

    beforeEach(() => {
        sessionStorage.clear();
        jest.restoreAllMocks();

        sequence = 0;

        originalRandomUUID = Object.getOwnPropertyDescriptor(
            globalThis.crypto,
            "randomUUID",
        );

        Object.defineProperty(globalThis.crypto, "randomUUID", {
            configurable: true,
            value: jest.fn(() => {
                sequence += 1;

                return `00000000-0000-4000-8000-${String(
                    sequence,
                ).padStart(12, "0")}`;
            }),
        });
    });

    afterEach(() => {
        sessionStorage.clear();
        jest.restoreAllMocks();

        if (originalRandomUUID) {
            Object.defineProperty(
                globalThis.crypto,
                "randomUUID",
                originalRandomUUID,
            );
        } else {
            Reflect.deleteProperty(globalThis.crypto, "randomUUID");
        }
    });

    it("queues a START action without reporting completion", () => {
        const update = queueTaskUpdate(
            WORKER_A,
            TASK_A,
            "START",
        );

        expect(update).not.toBeNull();
        expect(update?.expectedStatus).toBe("ASSIGNED");
        expect(update?.state).toBe("PENDING");

        expect(loadPendingTaskUpdates(WORKER_A)).toHaveLength(1);
    });

    it("queues a COMPLETE action with the correct expected status", () => {
        const update = queueTaskUpdate(
            WORKER_A,
            TASK_A,
            "COMPLETE",
        );

        expect(update?.expectedStatus).toBe("IN_PROGRESS");
        expect(update?.state).toBe("PENDING");
    });

    it("prevents duplicate actions for the same task", () => {
        expect(
            queueTaskUpdate(WORKER_A, TASK_A, "START"),
        ).not.toBeNull();

        expect(
            queueTaskUpdate(WORKER_A, TASK_A, "START"),
        ).toBeNull();

        expect(loadPendingTaskUpdates(WORKER_A)).toHaveLength(1);
    });

    it("prevents conflicting actions for the same task", () => {
        expect(
            queueTaskUpdate(WORKER_A, TASK_A, "START"),
        ).not.toBeNull();

        expect(
            queueTaskUpdate(WORKER_A, TASK_A, "COMPLETE"),
        ).toBeNull();

        expect(loadPendingTaskUpdates(WORKER_A)).toHaveLength(1);
    });

    it("keeps worker-specific updates isolated", () => {
        queueTaskUpdate(WORKER_A, TASK_A, "START");

        expect(loadPendingTaskUpdates(WORKER_B)).toEqual([]);

        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("allows separate tasks to be queued", () => {
        queueTaskUpdate(WORKER_A, TASK_A, "START");
        queueTaskUpdate(WORKER_A, TASK_B, "COMPLETE");

        const updates = loadPendingTaskUpdates(WORKER_A);

        expect(updates).toHaveLength(2);

        expect(updates.map((item) => item.taskId)).toEqual([
            TASK_A,
            TASK_B,
        ]);
    });

    it("marks a conflicting update for manual review", () => {
        const update = queueTaskUpdate(
            WORKER_A,
            TASK_A,
            "START",
        );

        expect(update).not.toBeNull();

        expect(
            markTaskUpdateForReview(WORKER_A, update!.id),
        ).toBe(true);

        expect(
            loadPendingTaskUpdates(WORKER_A)[0].state,
        ).toBe("NEEDS_REVIEW");
    });

    it("removes only the selected update", () => {
        const first = queueTaskUpdate(
            WORKER_A,
            TASK_A,
            "START",
        );

        const second = queueTaskUpdate(
            WORKER_A,
            TASK_B,
            "COMPLETE",
        );

        expect(first).not.toBeNull();
        expect(second).not.toBeNull();

        expect(
            removePendingTaskUpdate(WORKER_A, first!.id),
        ).toBe(true);

        const remaining = loadPendingTaskUpdates(WORKER_A);

        expect(remaining).toHaveLength(1);
        expect(remaining[0].taskId).toBe(TASK_B);
    });

    it("expires pending updates after eight hours", () => {
        const originalNow = Date.now();

        jest.spyOn(Date, "now").mockReturnValue(originalNow);

        queueTaskUpdate(WORKER_A, TASK_A, "START");

        jest.spyOn(Date, "now").mockReturnValue(
            originalNow + 9 * 60 * 60 * 1000,
        );

        expect(loadPendingTaskUpdates(WORKER_A)).toEqual([]);

        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("rejects malformed stored updates", () => {
        sessionStorage.setItem(STORAGE_KEY, "{invalid-json");

        expect(loadPendingTaskUpdates(WORKER_A)).toEqual([]);

        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("rejects an update belonging to another worker", () => {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([
                {
                    id: "test-update",
                    workerId: WORKER_B,
                    taskId: TASK_A,
                    action: "START",
                    expectedStatus: "ASSIGNED",
                    createdAt: Date.now(),
                    state: "PENDING",
                },
            ]),
        );

        expect(loadPendingTaskUpdates(WORKER_A)).toEqual([]);

        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("clears pending updates explicitly", () => {
        queueTaskUpdate(WORKER_A, TASK_A, "START");

        clearPendingTaskUpdates();

        expect(loadPendingTaskUpdates(WORKER_A)).toEqual([]);

        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});
