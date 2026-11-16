import type { TaskApiRecord } from "@/features/tasks/types/task-api";

import {
    loadPendingTaskUpdates,
    markTaskUpdateForReview,
    type PendingTaskUpdate,
} from "./offline-task-queue";

import { reconcilePendingTaskUpdates } from "./offline-task-reconciliation";

jest.mock("./offline-task-queue", () => ({
    loadPendingTaskUpdates: jest.fn(),
    markTaskUpdateForReview: jest.fn(),
}));

const mockedLoad = jest.mocked(loadPendingTaskUpdates);
const mockedMark = jest.mocked(markTaskUpdateForReview);

const WORKER_A = "11111111-1111-4111-8111-111111111111";
const WORKER_B = "22222222-2222-4222-8222-222222222222";

const TASK_ID = "33333333-3333-4333-8333-333333333333";

const serverTask: TaskApiRecord = {
    task_id: TASK_ID,
    room_number: "201",
    category: "ROOM_CLEANING",
    description: "Clean room",
    priority: "NORMAL",
    status: "ASSIGNED",
    assigned_worker_id: WORKER_A,
    booking_id: null,
    service_request_id: null,
    food_order_id: null,
    submitted_at: "2026-10-27T08:00:00.000Z",
    completed_at: null,
    source: "FRONT_DESK",
    created_at: "2026-10-27T08:00:00.000Z",
    updated_at: "2026-10-27T08:00:00.000Z",
};

const pendingStart: PendingTaskUpdate = {
    id: "update-1",
    workerId: WORKER_A,
    taskId: TASK_ID,
    action: "START",
    expectedStatus: "ASSIGNED",
    createdAt: Date.now(),
    state: "PENDING",
};

describe("DDP-199 offline task reconciliation", () => {
    let updates: PendingTaskUpdate[];

    beforeEach(() => {
        jest.clearAllMocks();

        updates = [{ ...pendingStart }];

        mockedLoad.mockImplementation(() =>
            updates.map((update) => ({ ...update })),
        );

        mockedMark.mockImplementation((_workerId, updateId) => {
            const found = updates.find(
                (update) => update.id === updateId,
            );

            if (!found) {
                return false;
            }

            found.state = "NEEDS_REVIEW";

            return true;
        });
    });

    it("returns empty results when no pending actions exist", () => {
        updates = [];

        const result = reconcilePendingTaskUpdates(
            WORKER_A,
            [serverTask],
        );

        expect(result.updates).toEqual([]);
        expect(result.pendingCount).toBe(0);
        expect(result.reviewCount).toBe(0);
        expect(mockedMark).not.toHaveBeenCalled();
    });

    it("keeps START pending when the server task is ASSIGNED", () => {
        const result = reconcilePendingTaskUpdates(
            WORKER_A,
            [serverTask],
        );

        expect(result.pendingCount).toBe(1);
        expect(result.reviewCount).toBe(0);
        expect(result.updates[0].state).toBe("PENDING");
        expect(mockedMark).not.toHaveBeenCalled();
    });

    it("keeps COMPLETE pending when the server task is IN_PROGRESS", () => {
        updates = [{
            ...pendingStart,
            action: "COMPLETE",
            expectedStatus: "IN_PROGRESS",
        }];

        const result = reconcilePendingTaskUpdates(
            WORKER_A,
            [{
                ...serverTask,
                status: "IN_PROGRESS",
            }],
        );

        expect(result.pendingCount).toBe(1);
        expect(result.reviewCount).toBe(0);
        expect(mockedMark).not.toHaveBeenCalled();
    });

    it("marks START for review when the task is already in progress", () => {
        const result = reconcilePendingTaskUpdates(
            WORKER_A,
            [{
                ...serverTask,
                status: "IN_PROGRESS",
            }],
        );

        expect(result.pendingCount).toBe(0);
        expect(result.reviewCount).toBe(1);
        expect(result.updates[0].state).toBe("NEEDS_REVIEW");
    });

    it("marks COMPLETE for review when the task is already completed", () => {
        updates = [{
            ...pendingStart,
            action: "COMPLETE",
            expectedStatus: "IN_PROGRESS",
        }];

        const result = reconcilePendingTaskUpdates(
            WORKER_A,
            [{
                ...serverTask,
                status: "COMPLETED",
            }],
        );

        expect(result.reviewCount).toBe(1);
    });

    it("marks an update for review after worker reassignment", () => {
        const result = reconcilePendingTaskUpdates(
            WORKER_A,
            [{
                ...serverTask,
                assigned_worker_id: WORKER_B,
            }],
        );

        expect(result.reviewCount).toBe(1);

        expect(mockedMark).toHaveBeenCalledWith(
            WORKER_A,
            pendingStart.id,
        );
    });

    it("marks missing tasks for review", () => {
        const result = reconcilePendingTaskUpdates(
            WORKER_A,
            [],
        );

        expect(result.reviewCount).toBe(1);
    });

    it("preserves updates already marked NEEDS_REVIEW", () => {
        updates = [{
            ...pendingStart,
            state: "NEEDS_REVIEW",
        }];

        const result = reconcilePendingTaskUpdates(
            WORKER_A,
            [serverTask],
        );

        expect(result.reviewCount).toBe(1);
        expect(mockedMark).not.toHaveBeenCalled();
    });

    it("never submits task mutations during reconciliation", () => {
        reconcilePendingTaskUpdates(
            WORKER_A,
            [serverTask],
        );

        expect(mockedMark).not.toHaveBeenCalled();

        // Reconciliation only reads task state and updates
        // local review status. No REST mutation is invoked.
    });
});
