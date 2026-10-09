import {
    apiRequest,
} from "@/lib/api-client";

import {
    claimTask,
    completeTask,
    getMyTasks,
    getTaskDetail,
    getTaskQueue,
    startTask,
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
});
