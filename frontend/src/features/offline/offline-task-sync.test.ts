import {
    getMyTasks, getOfflineTaskActionReceipt,
    submitOfflineTaskAction,
} from "@/features/tasks/api/tasks.api";
import { ApiError } from "@/lib/api-client";
import { getAuthSession } from "@/lib/auth-session";
import {
    loadPendingTaskUpdates,
    type PendingTaskUpdate,
} from "./offline-task-queue";
import { synchronizePendingTaskUpdate } from "./offline-task-sync";

jest.mock("@/features/tasks/api/tasks.api", () => ({
    getMyTasks: jest.fn(),
    getOfflineTaskActionReceipt: jest.fn(),
    submitOfflineTaskAction: jest.fn(),
}));

jest.mock("@/lib/auth-session", () => ({
    getAuthSession: jest.fn(),
}));

jest.mock("./offline-task-queue", () => ({
    loadPendingTaskUpdates: jest.fn(),
}));

const WORKER_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "77777777-7777-4777-8777-777777777777";

const mockedGetMyTasks = jest.mocked(getMyTasks);
const mockedSubmit = jest.mocked(submitOfflineTaskAction);
const mockedGetSession = jest.mocked(getAuthSession);
const mockedLoadPending = jest.mocked(loadPendingTaskUpdates);
const mockedGetReceipt = jest.mocked(
    getOfflineTaskActionReceipt,
);

type TaskList = Awaited<ReturnType<typeof getMyTasks>>;
type SyncResponse = Awaited<
    ReturnType<typeof submitOfflineTaskAction>
>;

const update: PendingTaskUpdate = {
    id: REQUEST_ID,
    workerId: WORKER_ID,
    taskId: TASK_ID,
    action: "START",
    expectedStatus: "ASSIGNED",
    createdAt: Date.now(),
    state: "PENDING",
};

const serverTasks = [
    {
        task_id: TASK_ID,
        assigned_worker_id: WORKER_ID,
        status: "ASSIGNED",
    },
] as unknown as TaskList;

const confirmedResponse = {
    task: {
        task_id: TASK_ID,
        assigned_worker_id: WORKER_ID,
        status: "IN_PROGRESS",
    },
    replayed: false,
} as SyncResponse;

describe("DDP-199 offline task synchronization", () => {
    let activeSession: ReturnType<typeof getAuthSession>;

    const originalOnline = Object.getOwnPropertyDescriptor(
        window.navigator,
        "onLine",
    );

    beforeEach(() => {
        jest.resetAllMocks();
        mockedGetReceipt.mockRejectedValue(
            new ApiError(404, null, "Receipt not found"),
        );

        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            value: true,
        });

        activeSession = {
            accessToken: "unit-test-token",
            tokenType: "Bearer",
            expiresAt: Date.now() + 60_000,
            worker: {
                worker_id: WORKER_ID,
                username: "worker_test",
                full_name: "Test Worker",
                role: "WORKER",
            },
        } as NonNullable<ReturnType<typeof getAuthSession>>;

        mockedGetSession.mockImplementation(() => activeSession);

        mockedLoadPending.mockImplementation((workerId) =>
            workerId === WORKER_ID ? [update] : [],
        );

        mockedGetMyTasks.mockResolvedValue(serverTasks);
        mockedSubmit.mockResolvedValue(confirmedResponse);
    });

    afterAll(() => {
        if (originalOnline) {
            Object.defineProperty(
                window.navigator,
                "onLine",
                originalOnline,
            );
        } else {
            Reflect.deleteProperty(window.navigator, "onLine");
        }
    });

    it("confirms an eligible START using the original request ID", async () => {
        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("CONFIRMED");

        expect(mockedGetMyTasks).toHaveBeenCalledTimes(1);

        expect(mockedSubmit).toHaveBeenCalledWith({
            taskId: TASK_ID,
            requestId: REQUEST_ID,
            action: "START",
        });
    });

    it("accepts a confirmed idempotent replay", async () => {
        mockedSubmit.mockResolvedValue({
            ...confirmedResponse,
            replayed: true,
        });

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("CONFIRMED");
        expect(mockedSubmit).toHaveBeenCalledTimes(1);
    });

    it("does not submit while offline", async () => {
        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            value: false,
        });

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("RETRY_LATER");
        expect(mockedGetMyTasks).not.toHaveBeenCalled();
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("does not submit without authentication", async () => {
        activeSession = null;

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("AUTH_REQUIRED");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("rejects an action belonging to another worker", async () => {
        const otherWorkerUpdate = {
            ...update,
            workerId: "44444444-4444-4444-8444-444444444444",
        };

        const result =
            await synchronizePendingTaskUpdate(otherWorkerUpdate);

        expect(result).toBe("AUTH_REQUIRED");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("does not submit an action already marked for review", async () => {
        const reviewUpdate: PendingTaskUpdate = {
            ...update,
            state: "NEEDS_REVIEW",
        };

        const result =
            await synchronizePendingTaskUpdate(reviewUpdate);

        expect(result).toBe("NEEDS_REVIEW");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("does not submit a request removed from local storage", async () => {
        mockedLoadPending.mockReturnValue([]);

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("NEEDS_REVIEW");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it.each([
        [
            "missing task",
            [],
        ],
        [
            "reassigned task",
            [{
                task_id: TASK_ID,
                assigned_worker_id:
                    "44444444-4444-4444-8444-444444444444",
                status: "ASSIGNED",
            }],
        ],
        [
            "changed task status",
            [{
                task_id: TASK_ID,
                assigned_worker_id: WORKER_ID,
                status: "IN_PROGRESS",
            }],
        ],
    ])(
        "flags %s for review without submitting",
        async (_description, tasks) => {
            mockedGetMyTasks.mockResolvedValue(tasks as TaskList);

            const result = await synchronizePendingTaskUpdate(update);

            expect(result).toBe("NEEDS_REVIEW");
            expect(mockedSubmit).not.toHaveBeenCalled();
        },
    );

    it("does not submit after authentication changes during refresh", async () => {
        mockedGetMyTasks.mockImplementation(async () => {
            activeSession = {
                ...activeSession!,
                accessToken: "different-session-token",
            };

            return serverTasks;
        });

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("AUTH_REQUIRED");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("retries later when the fresh server refresh fails", async () => {
        mockedGetMyTasks.mockRejectedValue(
            new Error("Network unavailable"),
        );

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("RETRY_LATER");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("requires authentication when the server returns 401", async () => {
        mockedGetMyTasks.mockRejectedValue(
            new ApiError(401, null, "Unauthorized"),
        );

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("AUTH_REQUIRED");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it.each([403, 404, 409])(
        "flags HTTP %s submission failures for review",
        async (status) => {
            mockedSubmit.mockRejectedValue(
                new ApiError(status, null, "Task conflict"),
            );

            const result = await synchronizePendingTaskUpdate(update);

            expect(result).toBe("NEEDS_REVIEW");
            expect(mockedSubmit).toHaveBeenCalledTimes(1);
        },
    );

    it("reports an uncertain outcome if the server response is lost", async () => {
        mockedSubmit.mockRejectedValue(
            new TypeError("Failed to fetch"),
        );

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("UNCERTAIN");

        // The coordinator does not remove or recreate the request.
        expect(mockedSubmit).toHaveBeenCalledWith({
            taskId: TASK_ID,
            requestId: REQUEST_ID,
            action: "START",
        });
    });

    it("rejects a malformed successful response", async () => {
        mockedSubmit.mockResolvedValue({
            task: {
                task_id: TASK_ID,
                assigned_worker_id: WORKER_ID,
                status: "ASSIGNED",
            },
            replayed: false,
        } as SyncResponse);

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("UNCERTAIN");
    });

    it("prevents parallel submission of the same pending action", async () => {
        let resolveRefresh!: (tasks: TaskList) => void;

        mockedGetMyTasks.mockImplementationOnce(
            () =>
                new Promise<TaskList>((resolve) => {
                    resolveRefresh = resolve;
                }),
        );

        const firstRequest = synchronizePendingTaskUpdate(update);
        const secondResult =
            await synchronizePendingTaskUpdate(update);

        expect(secondResult).toBe("BUSY");
        expect(mockedGetMyTasks).toHaveBeenCalledTimes(1);

        resolveRefresh(serverTasks);

        expect(await firstRequest).toBe("CONFIRMED");
        expect(mockedSubmit).toHaveBeenCalledTimes(1);
    });


    it("recovers a committed operation without submitting it again", async () => {
        mockedGetReceipt.mockResolvedValue({
            action: "START",
            task: confirmedResponse.task,
        });

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("CONFIRMED");
        expect(mockedGetReceipt).toHaveBeenCalledWith(
            TASK_ID,
            REQUEST_ID,
        );
        expect(mockedGetMyTasks).not.toHaveBeenCalled();
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("allows read-only receipt recovery for NEEDS_REVIEW", async () => {
        const reviewUpdate: PendingTaskUpdate = {
            ...update,
            state: "NEEDS_REVIEW",
        };

        mockedLoadPending.mockReturnValue([reviewUpdate]);

        mockedGetReceipt.mockResolvedValue({
            action: "START",
            task: confirmedResponse.task,
        });

        const result =
            await synchronizePendingTaskUpdate(reviewUpdate);

        expect(result).toBe("CONFIRMED");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("does not submit NEEDS_REVIEW when no receipt exists", async () => {
        const reviewUpdate: PendingTaskUpdate = {
            ...update,
            state: "NEEDS_REVIEW",
        };

        mockedLoadPending.mockReturnValue([reviewUpdate]);

        const result =
            await synchronizePendingTaskUpdate(reviewUpdate);

        expect(result).toBe("NEEDS_REVIEW");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("does not submit when receipt lookup fails due to a network error", async () => {
        mockedGetReceipt.mockRejectedValue(
            new TypeError("Failed to fetch"),
        );

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("RETRY_LATER");
        expect(mockedGetMyTasks).not.toHaveBeenCalled();
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("does not submit when an existing receipt has a different action", async () => {
        mockedGetReceipt.mockResolvedValue({
            action: "COMPLETE",
            task: confirmedResponse.task,
        });

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("UNCERTAIN");
        expect(mockedGetMyTasks).not.toHaveBeenCalled();
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

    it("does not submit when authentication changes during receipt lookup", async () => {
        mockedGetReceipt.mockImplementation(async () => {
            activeSession = {
                ...activeSession!,
                accessToken: "different-session-token",
            };

            return {
                action: "START",
                task: confirmedResponse.task,
            };
        });

        const result = await synchronizePendingTaskUpdate(update);

        expect(result).toBe("AUTH_REQUIRED");
        expect(mockedSubmit).not.toHaveBeenCalled();
    });

});
