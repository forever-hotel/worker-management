import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { synchronizePendingTaskUpdate } from "@/features/offline/offline-task-sync";
import {
  loadPendingTaskUpdates,
  markTaskUpdateForReview,
  removePendingTaskUpdate,
  type PendingTaskUpdate,
} from "@/features/offline/offline-task-queue";
import { getShiftSummary } from "@/features/shifts/api/shift.api";
import { getAuthSession } from "@/lib/auth-session";
import { useTaskData } from "@/providers/task-data-provider";

import { MyTasksScreen } from "./my-tasks-screen";

const WORKER_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "77777777-7777-4777-8777-777777777777";

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
  ),
}));

jest.mock("@/features/assignments/components/my-task-card", () => ({
  MyTaskCard: () => <div>Task card</div>,
}));

jest.mock("@/providers/task-data-provider", () => ({
  useTaskData: jest.fn(),
}));

jest.mock("@/lib/auth-session", () => ({
  getAuthSession: jest.fn(),
}));

jest.mock("@/features/shifts/api/shift.api", () => ({
  getShiftSummary: jest.fn(),
}));

jest.mock("@/features/offline/offline-task-sync", () => ({
  synchronizePendingTaskUpdate: jest.fn(),
}));

jest.mock("@/features/offline/offline-task-queue", () => ({
  loadPendingTaskUpdates: jest.fn(),
  markTaskUpdateForReview: jest.fn(),
  removePendingTaskUpdate: jest.fn(),
  queueTaskUpdate: jest.fn(),
}));

const mockedSync = jest.mocked(synchronizePendingTaskUpdate);
const mockedLoad = jest.mocked(loadPendingTaskUpdates);
const mockedMark = jest.mocked(markTaskUpdateForReview);
const mockedRemove = jest.mocked(removePendingTaskUpdate);
const mockedSession = jest.mocked(getAuthSession);
const mockedTaskData = jest.mocked(useTaskData);
const mockedSummary = jest.mocked(getShiftSummary);

let savedUpdates: PendingTaskUpdate[];

function pendingUpdate(
    state: PendingTaskUpdate["state"] = "PENDING",
): PendingTaskUpdate {
  return {
    id: REQUEST_ID,
    workerId: WORKER_ID,
    taskId: TASK_ID,
    action: "START",
    expectedStatus: "ASSIGNED",
    createdAt: Date.now(),
    state,
  };
}

describe("DDP-199 My Tasks synchronization controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    savedUpdates = [pendingUpdate()];

    jest.spyOn(window, "confirm").mockReturnValue(true);

    mockedSession.mockReturnValue({
      accessToken: "test-token",
      worker: { worker_id: WORKER_ID },
    } as unknown as ReturnType<typeof getAuthSession>);

    mockedTaskData.mockReturnValue({
      myTasks: [],
      queue: [],
      myTasksCount: 0,
      queueCount: 0,
      loading: false,
      error: null,
      offline: false,
      refreshMyTasks: jest.fn(async () => undefined),
      refreshQueue: jest.fn(async () => undefined),
      refreshAll: jest.fn(async () => undefined),
    } as ReturnType<typeof useTaskData>);

    mockedSummary.mockResolvedValue({
      completed_tasks: [],
    } as unknown as Awaited<ReturnType<typeof getShiftSummary>>);

    mockedLoad.mockImplementation(() => [...savedUpdates]);

    mockedRemove.mockImplementation((_workerId, updateId) => {
      if (!savedUpdates.some((item) => item.id === updateId)) {
        return false;
      }

      savedUpdates = savedUpdates.filter(
          (item) => item.id !== updateId,
      );

      return true;
    });

    mockedMark.mockImplementation((_workerId, updateId) => {
      if (!savedUpdates.some((item) => item.id === updateId)) {
        return false;
      }

      savedUpdates = savedUpdates.map((item) =>
          item.id === updateId
              ? { ...item, state: "NEEDS_REVIEW" }
              : item,
      );

      return true;
    });

    mockedSync.mockResolvedValue("CONFIRMED");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("removes an action only after server confirmation", async () => {
    const user = userEvent.setup();

    render(<MyTasksScreen />);

    // Wait for the completed-history effect and its state updates.
    await screen.findByText("No completed tasks today");

    await user.click(screen.getByRole("button", { name: "Sync" }));

    await waitFor(() => {
      expect(mockedSync).toHaveBeenCalledWith(
          expect.objectContaining({
            id: REQUEST_ID,
            taskId: TASK_ID,
            action: "START",
          }),
      );

      expect(mockedRemove).toHaveBeenCalledWith(
          WORKER_ID,
          REQUEST_ID,
      );
    });

    expect(savedUpdates).toHaveLength(0);
    expect(mockedMark).not.toHaveBeenCalled();
  });

  it("persists NEEDS_REVIEW without removing the request", async () => {
    mockedSync.mockResolvedValue("NEEDS_REVIEW");

    const user = userEvent.setup();

    render(<MyTasksScreen />);

    // Wait for the completed-history effect and its state updates.
    await screen.findByText("No completed tasks today");

    await user.click(screen.getByRole("button", { name: "Sync" }));

    await waitFor(() => {
      expect(mockedMark).toHaveBeenCalledWith(
          WORKER_ID,
          REQUEST_ID,
      );
    });

    expect(savedUpdates).toHaveLength(1);
    expect(savedUpdates[0].state).toBe("NEEDS_REVIEW");
    expect(savedUpdates[0].id).toBe(REQUEST_ID);

    expect(mockedRemove).not.toHaveBeenCalled();

    expect(
        screen.getByRole("button", { name: "Check confirmation" }),
    ).toBeInTheDocument();
  });

  it("retains the request when the server outcome is uncertain", async () => {
    mockedSync.mockResolvedValue("UNCERTAIN");

    const user = userEvent.setup();

    render(<MyTasksScreen />);

    // Wait for the completed-history effect and its state updates.
    await screen.findByText("No completed tasks today");

    await user.click(screen.getByRole("button", { name: "Sync" }));

    await waitFor(() => {
      expect(mockedSync).toHaveBeenCalledTimes(1);
      expect(
          screen.getByText(/result for task .* is uncertain/i),
      ).toBeInTheDocument();
    });

    expect(savedUpdates).toHaveLength(1);
    expect(savedUpdates[0].id).toBe(REQUEST_ID);
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(mockedMark).not.toHaveBeenCalled();
  });

  it("does not allow synchronization while offline", async () => {
    mockedTaskData.mockReturnValue({
      myTasks: [],
      queue: [],
      myTasksCount: 0,
      queueCount: 0,
      loading: false,
      error: null,
      offline: true,
      refreshMyTasks: jest.fn(async () => undefined),
      refreshQueue: jest.fn(async () => undefined),
      refreshAll: jest.fn(async () => undefined),
    } as ReturnType<typeof useTaskData>);

    render(<MyTasksScreen />);

    // Wait for the completed-history effect and its state updates.
    await screen.findByText("No completed tasks today");

    expect(
        screen.getByRole("button", { name: "Sync" }),
    ).toBeDisabled();

    expect(mockedSync).not.toHaveBeenCalled();
  });
});
