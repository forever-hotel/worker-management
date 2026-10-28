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

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("./my-task-card", () => ({
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
let refreshMyTasks: jest.Mock;

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

async function renderReadyScreen() {
  render(<MyTasksScreen />);
  await screen.findByText("No completed tasks today");
}

describe("DDP-199 My Tasks synchronization controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    savedUpdates = [pendingUpdate()];
    refreshMyTasks = jest.fn(async () => undefined);
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
      refreshMyTasks,
      refreshQueue: jest.fn(async () => undefined),
      refreshAll: jest.fn(async () => undefined),
    } as ReturnType<typeof useTaskData>);

    mockedSummary.mockResolvedValue({
      completed_tasks: [],
    } as unknown as Awaited<ReturnType<typeof getShiftSummary>>);

    mockedLoad.mockImplementation((workerId) =>
      workerId === WORKER_ID ? [...savedUpdates] : [],
    );

    mockedRemove.mockImplementation((workerId, updateId) => {
      if (
        workerId !== WORKER_ID ||
        !savedUpdates.some((item) => item.id === updateId)
      ) {
        return false;
      }
      savedUpdates = savedUpdates.filter((item) => item.id !== updateId);
      return true;
    });

    mockedMark.mockImplementation((workerId, updateId) => {
      if (
        workerId !== WORKER_ID ||
        !savedUpdates.some((item) => item.id === updateId)
      ) {
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

  it("removes a request only after server confirmation", async () => {
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(screen.getByRole("button", { name: "Sync" }));

    await waitFor(() => {
      expect(mockedSync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: REQUEST_ID,
          workerId: WORKER_ID,
          taskId: TASK_ID,
          action: "START",
        }),
      );
      expect(mockedRemove).toHaveBeenCalledWith(WORKER_ID, REQUEST_ID);
    });

    expect(savedUpdates).toHaveLength(0);
    expect(mockedMark).not.toHaveBeenCalled();
    expect(refreshMyTasks).toHaveBeenCalledTimes(1);
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });

  it("marks conflicts for review without removing the original request", async () => {
    mockedSync.mockResolvedValue("NEEDS_REVIEW");
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(screen.getByRole("button", { name: "Sync" }));

    await waitFor(() => {
      expect(mockedMark).toHaveBeenCalledWith(WORKER_ID, REQUEST_ID);
    });
    expect(savedUpdates).toHaveLength(1);
    expect(savedUpdates[0]).toMatchObject({
      id: REQUEST_ID,
      state: "NEEDS_REVIEW",
    });
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Check confirmation" }),
    ).toBeInTheDocument();
  });

  it("checks an existing review item without silently discarding it", async () => {
    savedUpdates = [pendingUpdate("NEEDS_REVIEW")];
    mockedSync.mockResolvedValue("NEEDS_REVIEW");
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(
      screen.getByRole("button", { name: "Check confirmation" }),
    );

    await waitFor(() => {
      expect(mockedSync).toHaveBeenCalledWith(
        expect.objectContaining({ state: "NEEDS_REVIEW" }),
      );
    });
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(savedUpdates[0].id).toBe(REQUEST_ID);
  });

  it("retains an uncertain result and its original request ID", async () => {
    mockedSync.mockResolvedValue("UNCERTAIN");
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(screen.getByRole("button", { name: "Sync" }));

    expect(
      await screen.findByText(/result for task .* is uncertain/i),
    ).toBeInTheDocument();
    expect(savedUpdates).toHaveLength(1);
    expect(savedUpdates[0].id).toBe(REQUEST_ID);
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(mockedMark).not.toHaveBeenCalled();
  });

  it("retains a request when server connectivity is unavailable", async () => {
    mockedSync.mockResolvedValue("RETRY_LATER");
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(screen.getByRole("button", { name: "Sync" }));

    expect(
      await screen.findByText(/server could not be reached/i),
    ).toBeInTheDocument();
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(savedUpdates).toHaveLength(1);
  });

  it("does not synchronize when the worker cancels confirmation", async () => {
    jest.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(screen.getByRole("button", { name: "Sync" }));

    expect(mockedSync).not.toHaveBeenCalled();
    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("disables Sync while the provider reports offline", async () => {
    mockedTaskData.mockReturnValue({
      myTasks: [],
      queue: [],
      myTasksCount: 0,
      queueCount: 0,
      loading: false,
      error: null,
      offline: true,
      refreshMyTasks,
      refreshQueue: jest.fn(async () => undefined),
      refreshAll: jest.fn(async () => undefined),
    } as ReturnType<typeof useTaskData>);
    await renderReadyScreen();

    expect(
        screen.getByRole("button", { name: /Sync/ }),
    ).toBeDisabled();
    expect(mockedSync).not.toHaveBeenCalled();
  });

  it("prevents a second submission while the first is in flight", async () => {
    let resolveSync!: (outcome: "CONFIRMED") => void;
    mockedSync.mockImplementation(
      () => new Promise<"CONFIRMED">((resolve) => { resolveSync = resolve; }),
    );
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(screen.getByRole("button", { name: "Sync" }));
    expect(
        screen.getByRole("button", { name: /Sync/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /Discard pending START/ })).toBeDisabled();
    expect(mockedSync).toHaveBeenCalledTimes(1);

    resolveSync("CONFIRMED");
    await waitFor(() => expect(mockedRemove).toHaveBeenCalledTimes(1));
  });

  it("retains the queue entry when local removal fails", async () => {
    mockedRemove.mockReturnValue(false);
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(screen.getByRole("button", { name: "Sync" }));
    expect(
      await screen.findByText(/local queue entry could not be removed/i),
    ).toBeInTheDocument();
    expect(savedUpdates).toHaveLength(1);
  });

  it("retains a request when the coordinator throws unexpectedly", async () => {
    mockedSync.mockRejectedValue(new Error("unexpected"));
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(screen.getByRole("button", { name: "Sync" }));
    expect(
      await screen.findByText(/Synchronization could not be confirmed/i),
    ).toBeInTheDocument();
    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("does not remove requests if login changes during synchronization", async () => {
    mockedSync.mockImplementation(async () => {
      mockedSession.mockReturnValue({
        accessToken: "new-session-token",
        worker: { worker_id: WORKER_ID },
      } as unknown as ReturnType<typeof getAuthSession>);
      return "CONFIRMED";
    });
    const user = userEvent.setup();
    await renderReadyScreen();

    await user.click(screen.getByRole("button", { name: "Sync" }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(savedUpdates).toHaveLength(1);
  });
});
