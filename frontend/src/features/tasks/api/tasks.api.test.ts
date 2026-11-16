import {
    apiRequest,
} from "@/lib/api-client";

import {
    claimTask,
    completeTask,
    getMyTasks, getOfflineTaskActionReceipt,
    getTaskDetail,
    getTaskQueue,
    startTask, submitOfflineTaskAction,
} from "./tasks.api";

jest.mock(
    "@/lib/api-client",
    () => ({
        apiRequest:
            jest.fn(),
    }),
);

const mockedApiRequest =
    jest.mocked(
        apiRequest,
    );

describe("tasks API", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockedApiRequest
            .mockResolvedValue(
                [] as never,
            );
    });

    it("requests the task queue", async () => {
        await getTaskQueue();

        expect(
            mockedApiRequest,
        ).toHaveBeenCalledWith(
            "/wkms/tasks/queue",
        );
    });

    it("requests the authenticated worker tasks", async () => {
        await getMyTasks();

        expect(
            mockedApiRequest,
        ).toHaveBeenCalledWith(
            "/wkms/tasks/my-tasks",
        );
    });

    it("requests task detail", async () => {
        await getTaskDetail(
            "task-1",
        );

        expect(
            mockedApiRequest,
        ).toHaveBeenCalledWith(
            "/wkms/tasks/task-1",
        );
    });

    it("claims a task", async () => {
        await claimTask(
            "task-1",
        );

        expect(
            mockedApiRequest,
        ).toHaveBeenCalledWith(
            "/wkms/tasks/task-1/claim",
            {
                method:
                    "POST",
            },
        );
    });

    it("starts a task", async () => {
        await startTask(
            "task-1",
        );

        expect(
            mockedApiRequest,
        ).toHaveBeenCalledWith(
            "/wkms/tasks/task-1/start",
            {
                method:
                    "POST",
            },
        );
    });

    it("completes a task", async () => {
        await completeTask(
            "task-1",
        );

        expect(
            mockedApiRequest,
        ).toHaveBeenCalledWith(
            "/wkms/tasks/task-1/complete",
            {
                method:
                    "POST",
            },
        );
    });


    it("submits an offline START with its original request ID", async () => {
        await submitOfflineTaskAction({
            taskId: "task-1",
            requestId: "77777777-7777-4777-8777-777777777777",
            action: "START",
        });

        expect(mockedApiRequest).toHaveBeenCalledWith(
            "/wkms/tasks/task-1/offline-action",
            {
                method: "POST",
                body: JSON.stringify({
                    requestId: "77777777-7777-4777-8777-777777777777",
                    action: "START",
                }),
            },
        );
    });

    it("submits offline COMPLETE without generating a new request ID", async () => {
        const pendingAction = {
            taskId: "task-2",
            requestId: "88888888-8888-4888-8888-888888888888",
            action: "COMPLETE" as const,
        };

        await submitOfflineTaskAction(pendingAction);
        await submitOfflineTaskAction(pendingAction);

        expect(mockedApiRequest).toHaveBeenCalledTimes(2);

        for (const call of mockedApiRequest.mock.calls) {
            expect(call[0]).toBe(
                "/wkms/tasks/task-2/offline-action",
            );

            expect(call[1]).toEqual({
                method: "POST",
                body: JSON.stringify({
                    requestId: pendingAction.requestId,
                    action: "COMPLETE",
                }),
            });
        }
    });


    it("checks a committed offline action receipt without mutating the task", async () => {
        const taskId = "33333333-3333-4333-8333-333333333333";
        const requestId = "77777777-7777-4777-8777-777777777777";

        await getOfflineTaskActionReceipt(taskId, requestId);

        expect(mockedApiRequest).toHaveBeenCalledWith(
            `/wkms/tasks/${taskId}/offline-action/${requestId}`,
        );

        expect(mockedApiRequest).toHaveBeenCalledTimes(1);
    });

    it("preserves the original request ID when looking up a receipt", async () => {
        const taskId = "33333333-3333-4333-8333-333333333333";
        const requestId = "88888888-8888-4888-8888-888888888888";

        await getOfflineTaskActionReceipt(taskId, requestId);
        await getOfflineTaskActionReceipt(taskId, requestId);

        expect(mockedApiRequest).toHaveBeenNthCalledWith(
            1,
            `/wkms/tasks/${taskId}/offline-action/${requestId}`,
        );

        expect(mockedApiRequest).toHaveBeenNthCalledWith(
            2,
            `/wkms/tasks/${taskId}/offline-action/${requestId}`,
        );
    });

});
