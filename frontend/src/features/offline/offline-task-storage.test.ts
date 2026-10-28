import type { TaskApiRecord } from "@/features/tasks/types/task-api";

import {
    clearOfflineTasks,
    loadOfflineTasks,
    saveOfflineTasks,
} from "./offline-task-storage";

const WORKER_A = "11111111-1111-4111-8111-111111111111";
const WORKER_B = "22222222-2222-4222-8222-222222222222";

const STORAGE_KEY = "wkms.offline.my-tasks.v1";

const assignedTask: TaskApiRecord = {
    task_id: "33333333-3333-4333-8333-333333333333",
    room_number: "DEMO101",
    category: "ROOM_CLEANING",
    description: "Guest requested cleaning",
    priority: "NORMAL",
    status: "ASSIGNED",
    assigned_worker_id: WORKER_A,
    booking_id: "private-booking",
    service_request_id: "private-request",
    food_order_id: "private-food-order",
    submitted_at: "2026-10-27T08:00:00.000Z",
    completed_at: null,
    source: "FRONT_DESK",
    created_at: "2026-10-27T08:00:00.000Z",
    updated_at: "2026-10-27T08:00:00.000Z",
};

describe("DDP-199 offline My Tasks storage", () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        window.sessionStorage.clear();
        jest.restoreAllMocks();
    });

    it("saves and loads the authenticated worker's tasks", () => {
        saveOfflineTasks(WORKER_A, [assignedTask]);

        const result = loadOfflineTasks(WORKER_A);

        expect(result).toHaveLength(1);
        expect(result?.[0].task_id).toBe(assignedTask.task_id);
        expect(result?.[0].status).toBe("ASSIGNED");
    });

    it("does not expose one worker's tasks to another worker", () => {
        saveOfflineTasks(WORKER_A, [assignedTask]);

        expect(loadOfflineTasks(WORKER_B)).toBeNull();

        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("removes sensitive fields from cached tasks", () => {
        saveOfflineTasks(WORKER_A, [assignedTask]);

        const raw = window.sessionStorage.getItem(STORAGE_KEY);

        expect(raw).not.toBeNull();
        expect(raw).not.toContain("Guest requested cleaning");
        expect(raw).not.toContain("private-booking");
        expect(raw).not.toContain("private-request");
        expect(raw).not.toContain("private-food-order");

        const result = loadOfflineTasks(WORKER_A);

        expect(result?.[0].description).toBe("");
        expect(result?.[0].booking_id).toBeNull();
        expect(result?.[0].service_request_id).toBeNull();
        expect(result?.[0].food_order_id).toBeNull();
    });

    it("does not cache another worker's tasks", () => {
        const otherWorkerTask = {
            ...assignedTask,
            task_id: "44444444-4444-4444-8444-444444444444",
            assigned_worker_id: WORKER_B,
        };

        saveOfflineTasks(WORKER_A, [
            assignedTask,
            otherWorkerTask,
        ]);

        const result = loadOfflineTasks(WORKER_A);

        expect(result).toHaveLength(1);
        expect(result?.[0].task_id).toBe(assignedTask.task_id);
    });

    it("only caches active tasks", () => {
        saveOfflineTasks(WORKER_A, [
            assignedTask,
            {
                ...assignedTask,
                task_id: "55555555-5555-4555-8555-555555555555",
                status: "COMPLETED",
            },
            {
                ...assignedTask,
                task_id: "66666666-6666-4666-8666-666666666666",
                status: "IN_PROGRESS",
            },
        ]);

        const result = loadOfflineTasks(WORKER_A);

        expect(result).toHaveLength(2);
        expect(result?.map((task) => task.status)).toEqual([
            "ASSIGNED",
            "IN_PROGRESS",
        ]);
    });

    it("expires offline snapshots older than eight hours", () => {
        jest.spyOn(Date, "now").mockReturnValue(
            new Date("2026-10-27T08:00:00.000Z").getTime(),
        );

        saveOfflineTasks(WORKER_A, [assignedTask]);

        jest.spyOn(Date, "now").mockReturnValue(
            new Date("2026-10-27T17:00:00.000Z").getTime(),
        );

        expect(loadOfflineTasks(WORKER_A)).toBeNull();
        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("rejects malformed stored JSON", () => {
        window.sessionStorage.setItem(
            STORAGE_KEY,
            "{invalid-json",
        );

        expect(loadOfflineTasks(WORKER_A)).toBeNull();
        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("rejects a corrupted task snapshot", () => {
        window.sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                workerId: WORKER_A,
                savedAt: Date.now(),
                tasks: [
                    {
                        task_id: "invalid-task",
                        assigned_worker_id: WORKER_B,
                        status: "ASSIGNED",
                    },
                ],
            }),
        );

        expect(loadOfflineTasks(WORKER_A)).toBeNull();
    });

    it("clears cached task data on explicit cleanup", () => {
        saveOfflineTasks(WORKER_A, [assignedTask]);

        clearOfflineTasks();

        expect(loadOfflineTasks(WORKER_A)).toBeNull();
        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("does not cache data without a worker identity", () => {
        saveOfflineTasks("", [assignedTask]);

        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(loadOfflineTasks("")).toBeNull();
    });
});
