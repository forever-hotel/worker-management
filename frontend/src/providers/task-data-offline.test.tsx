
import { act, render, screen, waitFor } from "@testing-library/react";

import {
    getMyTasks,
    getTaskQueue,
} from "@/features/tasks/api/tasks.api";
import type { TaskApiRecord } from "@/features/tasks/types/task-api";
import {
    loadOfflineTasks,
    saveOfflineTasks,
} from "@/features/offline/offline-task-storage";
import { getAuthSession } from "@/lib/auth-session";
import { ApiError } from "@/lib/api-client";
import { connectTaskSocket } from "@/lib/task-socket";

import {
    TaskDataProvider,
    useTaskData,
} from "./task-data-provider";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/features/tasks/api/tasks.api", () => ({
    getTaskQueue: jest.fn(),
    getMyTasks: jest.fn(),
}));

jest.mock("@/features/offline/offline-task-storage", () => ({
    loadOfflineTasks: jest.fn(),
    saveOfflineTasks: jest.fn(),
}));

jest.mock("@/lib/auth-session", () => ({
    getAuthSession: jest.fn(),
}));

jest.mock("@/lib/task-socket", () => ({
    connectTaskSocket: jest.fn(),
    TASK_SOCKET_EVENTS: [
        "task.created",
        "task.claimed",
        "task.escalated",
    ],
}));

const mockedQueue = jest.mocked(getTaskQueue);
const mockedMyTasks = jest.mocked(getMyTasks);
const mockedLoad = jest.mocked(loadOfflineTasks);
const mockedSave = jest.mocked(saveOfflineTasks);
const mockedSession = jest.mocked(getAuthSession);
const mockedSocket = jest.mocked(connectTaskSocket);

const WORKER_ID = "11111111-1111-4111-8111-111111111111";

const task: TaskApiRecord = {
    task_id: "22222222-2222-4222-8222-222222222222",
    room_number: "201",
    category: "EXTRA_TOWELS",
    description: "",
    priority: "NORMAL",
    status: "ASSIGNED",
    assigned_worker_id: WORKER_ID,
    booking_id: null,
    service_request_id: null,
    food_order_id: null,
    submitted_at: "2026-10-27T08:00:00.000Z",
    completed_at: null,
    source: "FRONT_DESK",
    created_at: "2026-10-27T08:00:00.000Z",
    updated_at: "2026-10-27T08:00:00.000Z",
};

function Probe() {
    const {
        myTasks,
        queueCount,
        loading,
        offline,
        error,
    } = useTaskData();

    return (
        <div>
      <span data-testid="loading">
        {loading ? "loading" : "ready"}
      </span>
            <span data-testid="offline">
        {offline ? "offline" : "online"}
      </span>
            <span data-testid="tasks">
        {myTasks.length}
      </span>
            <span data-testid="queue">
        {queueCount}
      </span>
            <span data-testid="error">
        {error ?? "none"}
      </span>
        </div>
    );
}

function mountProvider() {
    return render(
        <TaskDataProvider>
            <Probe />
        </TaskDataProvider>,
    );
}

describe("DDP-199 offline task provider", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockReplace.mockReset();
        mockedQueue.mockResolvedValue([]);
        mockedMyTasks.mockResolvedValue([task]);
        mockedLoad.mockReturnValue(null);
        mockedSocket.mockReturnValue(null);

        mockedSession.mockReturnValue({
            accessToken: "unit-test-token",
            tokenType: "Bearer",
            expiresAt: Date.now() + 60_000,
            worker: {
                worker_id: WORKER_ID,
                full_name: "Test Worker",
                username: "worker_test",
                role: "WORKER",
            },
        });
    });

    it("saves an authenticated worker snapshot after online loading", async () => {
        mountProvider();

        await waitFor(() => {
            expect(screen.getByTestId("loading")).toHaveTextContent(
                "ready",
            );
        });

        expect(screen.getByTestId("offline")).toHaveTextContent(
            "online",
        );

        expect(mockedSave).toHaveBeenCalledWith(
            WORKER_ID,
            [task],
        );
    });

    it("shows saved My Tasks when the network request fails", async () => {
        mockedQueue.mockRejectedValue(new TypeError("Failed to fetch"));
        mockedLoad.mockReturnValue([task]);

        mountProvider();

        await waitFor(() => {
            expect(screen.getByTestId("offline")).toHaveTextContent(
                "offline",
            );
        });

        expect(screen.getByTestId("tasks")).toHaveTextContent("1");
        expect(screen.getByTestId("queue")).toHaveTextContent("0");
        expect(screen.getByTestId("error")).toHaveTextContent("none");

        expect(mockedLoad).toHaveBeenCalledWith(WORKER_ID);
    });

    it("restores live data after reconnection", async () => {
        mockedQueue.mockRejectedValueOnce(new Error("Network unavailable"));
        mockedLoad.mockReturnValue([task]);

        mountProvider();

        await waitFor(() => {
            expect(screen.getByTestId("offline")).toHaveTextContent(
                "offline",
            );
        });

        await act(async () => {
            window.dispatchEvent(new Event("online"));
        });

        await waitFor(() => {
            expect(screen.getByTestId("offline")).toHaveTextContent(
                "online",
            );
        });

        expect(mockedMyTasks).toHaveBeenCalledTimes(2);
        expect(mockedSave).toHaveBeenCalledWith(WORKER_ID, [task]);
    });

    it("never uses an offline snapshot after a 401 response", async () => {
        mockedQueue.mockRejectedValue(
            new ApiError(
                401,
                { message: "Unauthorized" },
                "Unauthorized",
            ),
        );

        mockedLoad.mockReturnValue([task]);

        mountProvider();

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith("/login");
        });

        expect(mockedLoad).not.toHaveBeenCalled();
        expect(screen.getByTestId("offline")).toHaveTextContent(
            "online",
        );
    });

    it("does not invent tasks when no snapshot exists", async () => {
        mockedQueue.mockRejectedValue(new Error("Network unavailable"));
        mockedLoad.mockReturnValue(null);

        mountProvider();

        await waitFor(() => {
            expect(screen.getByTestId("error")).toHaveTextContent(
                "Unable to refresh task data.",
            );
        });

        expect(screen.getByTestId("tasks")).toHaveTextContent("0");
    });
});
