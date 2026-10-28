import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  loadPendingTaskUpdates,
  markTaskUpdateForReview,
  queueTaskUpdate,
  removePendingTaskUpdate,
  type PendingTaskUpdate,
} from "@/features/offline/offline-task-queue";
import { synchronizePendingTaskUpdate } from "@/features/offline/offline-task-sync";
import { getShiftSummary } from "@/features/shifts/api/shift.api";
import { completeTask, startTask } from "@/features/tasks/api/tasks.api";
import type { TaskApiRecord } from "@/features/tasks/types/task-api";
import { ApiError } from "@/lib/api-client";
import { getAuthSession } from "@/lib/auth-session";
import { useTaskData } from "@/providers/task-data-provider";
import type { MyTask } from "../types/my-task";
import { MyTasksScreen } from "./my-tasks-screen";

const WORKER_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "77777777-7777-4777-8777-777777777777";

const mockReplace = jest.fn();
// Keep router identity stable so effect dependencies do not retrigger on every render.
const mockRouter = { replace: mockReplace };
const mockedStart = jest.mocked(startTask);
const mockedComplete = jest.mocked(completeTask);
const mockedSession = jest.mocked(getAuthSession);
const mockedData = jest.mocked(useTaskData);
const mockedSummary = jest.mocked(getShiftSummary);
const mockedLoad = jest.mocked(loadPendingTaskUpdates);
const mockedQueue = jest.mocked(queueTaskUpdate);
const mockedRemove = jest.mocked(removePendingTaskUpdate);
const mockedMark = jest.mocked(markTaskUpdateForReview);
const mockedSync = jest.mocked(synchronizePendingTaskUpdate);

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.ComponentProps<"a">) =>
    <a href={href} {...props}>{children}</a>,
}));

jest.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Small action-capable card: exercise the real MyTasksScreen handlers while
// isolating this suite from presentation-only MyTaskCard behavior.
jest.mock("./my-task-card", () => ({
  MyTaskCard: ({
    task, onStart, onComplete, actionLoading,
  }: {
    task: MyTask;
    onStart?: (taskId: string) => void;
    onComplete?: (taskId: string) => void;
    actionLoading?: boolean;
  }) => (
    <div data-testid={`task-${task.id}`}>
      <span>{task.status}</span>
      <button type="button" disabled={actionLoading} onClick={() => onStart?.(task.id)}>
        Start {task.id}
      </button>
      <button type="button" disabled={actionLoading} onClick={() => onComplete?.(task.id)}>
        Complete {task.id}
      </button>
    </div>
  ),
}));

jest.mock("@/providers/task-data-provider", () => ({ useTaskData: jest.fn() }));
jest.mock("@/lib/auth-session", () => ({ getAuthSession: jest.fn() }));
jest.mock("@/features/shifts/api/shift.api", () => ({ getShiftSummary: jest.fn() }));
jest.mock("@/features/tasks/api/tasks.api", () => ({
  startTask: jest.fn(),
  completeTask: jest.fn(),
}));
jest.mock("@/features/offline/offline-task-sync", () => ({
  synchronizePendingTaskUpdate: jest.fn(),
}));
jest.mock("@/features/offline/offline-task-queue", () => ({
  loadPendingTaskUpdates: jest.fn(),
  queueTaskUpdate: jest.fn(),
  removePendingTaskUpdate: jest.fn(),
  markTaskUpdateForReview: jest.fn(),
}));

const assignedTask: TaskApiRecord = {
  task_id: TASK_ID,
  room_number: "203",
  category: "ROOM_CLEANING",
  description: "Clean guest room",
  priority: "NORMAL",
  status: "ASSIGNED",
  assigned_worker_id: WORKER_ID,
  booking_id: null,
  service_request_id: null,
  food_order_id: null,
  submitted_at: "2026-10-28T07:00:00.000Z",
  completed_at: null,
  source: "CHECKOUT_TRIGGER",
  created_at: "2026-10-28T07:00:00.000Z",
  updated_at: "2026-10-28T07:00:00.000Z",
};

let storedUpdates: PendingTaskUpdate[];
let currentTasks: TaskApiRecord[];
let isOffline: boolean;
let providerError: string | null;
let providerLoading: boolean;
let refreshMine: jest.Mock;

function pendingAction(
  action: PendingTaskUpdate["action"] = "START",
  state: PendingTaskUpdate["state"] = "PENDING",
): PendingTaskUpdate {
  return {
    id: REQUEST_ID,
    workerId: WORKER_ID,
    taskId: TASK_ID,
    action,
    expectedStatus: action === "START" ? "ASSIGNED" : "IN_PROGRESS",
    createdAt: Date.now(),
    state,
  };
}

function configureData() {
  mockedData.mockImplementation(() => ({
    myTasks: currentTasks,
    queue: [],
    myTasksCount: currentTasks.length,
    queueCount: 0,
    loading: providerLoading,
    error: providerError,
    offline: isOffline,
    refreshMyTasks: refreshMine,
    refreshQueue: jest.fn(async () => undefined),
    refreshAll: jest.fn(async () => undefined),
  } as ReturnType<typeof useTaskData>));
}

async function renderReady() {
  render(<MyTasksScreen />);
  await screen.findByText("No completed tasks today");
}

async function clickStart() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: `Start ${TASK_ID}` }));
}

async function clickComplete() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: `Complete ${TASK_ID}` }));
}

function httpError(status: number, message: string): ApiError {
  return new ApiError(status, { message }, message);
}

describe("DDP-199 My Tasks additional action and error paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentTasks = [{ ...assignedTask }];
    storedUpdates = [];
    isOffline = false;
    providerError = null;
    providerLoading = false;
    refreshMine = jest.fn(async () => undefined);
    configureData();

    jest.spyOn(window, "confirm").mockReturnValue(true);
    mockedSession.mockReturnValue({
      accessToken: "worker-session",
      worker: { worker_id: WORKER_ID },
    } as unknown as ReturnType<typeof getAuthSession>);

    mockedSummary.mockResolvedValue({
      completed_tasks: [],
    } as unknown as Awaited<ReturnType<typeof getShiftSummary>>);

    mockedLoad.mockImplementation((workerId) =>
      workerId === WORKER_ID ? [...storedUpdates] : [],
    );
    mockedQueue.mockImplementation((workerId, taskId, action) => {
      const created: PendingTaskUpdate = {
        ...pendingAction(action),
        workerId,
        taskId,
      };
      storedUpdates.push(created);
      return created;
    });
    mockedRemove.mockImplementation((_workerId, requestId) => {
      const exists = storedUpdates.some((update) => update.id === requestId);
      storedUpdates = storedUpdates.filter((update) => update.id !== requestId);
      return exists;
    });
    mockedMark.mockImplementation((_workerId, requestId) => {
      const exists = storedUpdates.some((update) => update.id === requestId);
      storedUpdates = storedUpdates.map((update) =>
        update.id === requestId ? { ...update, state: "NEEDS_REVIEW" } : update,
      );
      return exists;
    });
    mockedSync.mockResolvedValue("CONFIRMED");
    mockedStart.mockResolvedValue(undefined as never);
    mockedComplete.mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("queues an assigned START while offline without calling the server", async () => {
    isOffline = true;
    await renderReady();
    await clickStart();
    expect(mockedQueue).toHaveBeenCalledWith(WORKER_ID, TASK_ID, "START");
    expect(storedUpdates).toHaveLength(1);
    expect(storedUpdates[0].expectedStatus).toBe("ASSIGNED");
    expect(screen.getByRole("button", { name: "Sync" })).toBeDisabled();
    expect(mockedStart).not.toHaveBeenCalled();
    expect(refreshMine).not.toHaveBeenCalled();
  });

  it("queues an IN_PROGRESS COMPLETE while offline without calling the server", async () => {
    isOffline = true;
    currentTasks = [{ ...assignedTask, status: "IN_PROGRESS" }];
    await renderReady();
    await clickComplete();
    expect(mockedQueue).toHaveBeenCalledWith(WORKER_ID, TASK_ID, "COMPLETE");
    expect(storedUpdates[0].expectedStatus).toBe("IN_PROGRESS");
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("rejects offline edits when the worker session is missing", async () => {
    isOffline = true;
    mockedSession.mockReturnValue(null);
    await renderReady();
    await clickStart();
    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(mockedQueue).not.toHaveBeenCalled();
  });

  it("rejects offline edits to tasks owned by another worker", async () => {
    isOffline = true;
    currentTasks = [{ ...assignedTask, assigned_worker_id: "another-worker" }];
    await renderReady();
    await clickStart();
    expect(screen.getByText(/not eligible for the requested offline update/i)).toBeInTheDocument();
    expect(mockedQueue).not.toHaveBeenCalled();
  });

  it("rejects offline START for a non-assigned status", async () => {
    isOffline = true;
    currentTasks = [{ ...assignedTask, status: "IN_PROGRESS" }];
    await renderReady();
    await clickStart();
    expect(screen.getByText(/not eligible for the requested offline update/i)).toBeInTheDocument();
    expect(mockedQueue).not.toHaveBeenCalled();
  });

  it("rejects offline COMPLETE for a non-progress status", async () => {
    isOffline = true;
    await renderReady();
    await clickComplete();
    expect(screen.getByText(/not eligible for the requested offline update/i)).toBeInTheDocument();
    expect(mockedQueue).not.toHaveBeenCalled();
  });

  it("reports storage failure without making any server mutation", async () => {
    isOffline = true;
    mockedQueue.mockReturnValue(null);
    await renderReady();
    await clickStart();
    expect(screen.getByText(/Unable to save this update/i)).toBeInTheDocument();
    expect(mockedStart).not.toHaveBeenCalled();
  });

  it("starts an assigned task online and refreshes its server state", async () => {
    await renderReady();
    await clickStart();
    await waitFor(() => expect(refreshMine).toHaveBeenCalledTimes(1));
    expect(mockedStart).toHaveBeenCalledWith(TASK_ID);
    expect(mockedQueue).not.toHaveBeenCalled();
  });

  it("completes an in-progress task online and reloads completed history", async () => {
    currentTasks = [{ ...assignedTask, status: "IN_PROGRESS" }];
    await renderReady();
    expect(mockedSummary).toHaveBeenCalledTimes(1);
    await clickComplete();
    await waitFor(() => expect(mockedSummary).toHaveBeenCalledTimes(2));
    expect(mockedComplete).toHaveBeenCalledWith(TASK_ID);
    expect(refreshMine).toHaveBeenCalledTimes(1);
  });

  it("redirects on an unauthorized online START", async () => {
    mockedStart.mockRejectedValue(httpError(401, "Unauthorized"));
    await renderReady();
    await clickStart();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(refreshMine).not.toHaveBeenCalled();
  });

  it("redirects on an unauthorized online COMPLETE", async () => {
    mockedComplete.mockRejectedValue(httpError(401, "Unauthorized"));
    await renderReady();
    await clickComplete();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows server conflict for START after refreshing tasks", async () => {
    mockedStart.mockRejectedValue(httpError(409, "Already started"));
    await renderReady();
    await clickStart();
    expect(await screen.findByText("Already started")).toBeInTheDocument();
    expect(refreshMine).toHaveBeenCalledTimes(1);
  });

  it("shows forbidden COMPLETE after refreshing tasks", async () => {
    mockedComplete.mockRejectedValue(httpError(403, "Task owned by another worker"));
    await renderReady();
    await clickComplete();
    expect(await screen.findByText("Task owned by another worker")).toBeInTheDocument();
    expect(refreshMine).toHaveBeenCalledTimes(1);
  });

  it("uses a safe generic error for unknown START failures", async () => {
    mockedStart.mockRejectedValue(new Error("private server details"));
    await renderReady();
    await clickStart();
    expect(await screen.findByText("Unable to start this task.")).toBeInTheDocument();
    expect(screen.queryByText("private server details")).not.toBeInTheDocument();
  });

  it("uses a safe generic error for unknown COMPLETE failures", async () => {
    mockedComplete.mockRejectedValue(new Error("private server details"));
    await renderReady();
    await clickComplete();
    expect(await screen.findByText("Unable to complete this task.")).toBeInTheDocument();
  });

  it("retries a failed active-task refresh and clears the local error", async () => {
    providerError = "Unable to refresh task data.";
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(refreshMine).toHaveBeenCalledTimes(1));
  });

  it("redirects when a retry receives an unauthorized response", async () => {
    providerError = "Unable to refresh task data.";
    refreshMine.mockRejectedValue(httpError(401, "Unauthorized"));
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows a retry-specific error after a general refresh failure", async () => {
    providerError = "Unable to refresh task data.";
    refreshMine.mockRejectedValue(new Error("network"));
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Unable to load your tasks.")).toBeInTheDocument();
  });

  it("redirects if the completed-history API returns 401", async () => {
    mockedSummary.mockRejectedValue(httpError(401, "Unauthorized"));
    render(<MyTasksScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    await screen.findByText("No completed tasks today");
  });

  it("retries completed-history failures and then displays an empty history", async () => {
    mockedSummary.mockRejectedValueOnce(new Error("network"));
    render(<MyTasksScreen />);
    expect(await screen.findByText("Unable to load completed tasks.")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No completed tasks today")).toBeInTheDocument();
    expect(mockedSummary).toHaveBeenCalledTimes(2);
  });

  it("renders received completed tasks, not just the empty-state branch", async () => {
    mockedSummary.mockResolvedValue({
      completed_tasks: [
        { task_id: TASK_ID, room_number: "203", category: "ROOM_CLEANING",
          priority: "NORMAL", submitted_at: "2026-10-28T07:00:00.000Z",
          completed_at: "2026-10-28T07:20:00.000Z", turnaround_seconds: 1200 },
      ],
    } as unknown as Awaited<ReturnType<typeof getShiftSummary>>);
    render(<MyTasksScreen />);
    expect(await screen.findByRole("link", { name: /View completed task for Room 203/i })).toHaveAttribute(
      "href", `/tasks/${TASK_ID}?from=my-tasks`,
    );
  });

  it("does not discard a pending offline action when the user cancels", async () => {
    storedUpdates = [pendingAction()];
    jest.mocked(window.confirm).mockReturnValue(false);
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Discard pending START/i }));
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(storedUpdates).toHaveLength(1);
  });

  it("discards a pending offline action only after explicit confirmation", async () => {
    storedUpdates = [pendingAction()];
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Discard pending START/i }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Discard pending START/i })).not.toBeInTheDocument());
    expect(mockedRemove).toHaveBeenCalledWith(WORKER_ID, REQUEST_ID);
  });

  it("redirects instead of discarding when the session has expired", async () => {
    storedUpdates = [pendingAction()];
    await renderReady();
    mockedSession.mockReturnValue(null);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Discard pending START/i }));
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("shows a safe failure if a confirmed discard cannot be persisted", async () => {
    storedUpdates = [pendingAction()];
    mockedRemove.mockReturnValue(false);
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Discard pending START/i }));
    expect(await screen.findByText("Unable to discard this pending update.")).toBeInTheDocument();
  });

  it("redirects on a rejected synchronization session", async () => {
    storedUpdates = [pendingAction()];
    mockedSync.mockResolvedValue("AUTH_REQUIRED");
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sync" }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("shows a busy notice without removing the pending request", async () => {
    storedUpdates = [pendingAction()];
    mockedSync.mockResolvedValue("BUSY");
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sync" }));
    expect(await screen.findByText("This request is already being checked.")).toBeInTheDocument();
    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("does not resubmit a conflicting request when marking review fails", async () => {
    storedUpdates = [pendingAction()];
    mockedSync.mockResolvedValue("NEEDS_REVIEW");
    mockedMark.mockReturnValue(false);
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sync" }));
    expect(await screen.findByText(/review status could not be saved/i)).toBeInTheDocument();
    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("uses the offline-warning path when navigator itself is offline", async () => {
    storedUpdates = [pendingAction()];
    const prior = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    try {
      await renderReady();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Sync" }));
      expect(await screen.findByText("Reconnect to the internet before synchronizing.")).toBeInTheDocument();
      expect(mockedSync).not.toHaveBeenCalled();
    } finally {
      if (prior) Object.defineProperty(window.navigator, "onLine", prior);
      else Reflect.deleteProperty(window.navigator, "onLine");
    }
  });

  it("does not synchronize using a session that changed after rendering", async () => {
    storedUpdates = [pendingAction()];
    await renderReady();
    mockedSession.mockReturnValue(null);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sync" }));
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(mockedSync).not.toHaveBeenCalled();
  });

  it("does not allow the coordinator to erase a receipt if refreshing tasks fails", async () => {
    storedUpdates = [pendingAction()];
    refreshMine.mockRejectedValue(new Error("temporary refresh error"));
    await renderReady();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sync" }));
    await waitFor(() => expect(mockedRemove).toHaveBeenCalledWith(WORKER_ID, REQUEST_ID));
    expect(storedUpdates).toHaveLength(0);
    expect(mockedSync).toHaveBeenCalledTimes(1);
  });

  it("shows the active loading state without rendering a fake empty list", async () => {
    providerLoading = true;
    render(<MyTasksScreen />);
    expect(screen.getByText("Loading your tasks...")).toBeInTheDocument();
    // Complete the unrelated Shift Summary effect before the test finishes.
    await screen.findByText("No completed tasks today");
    expect(screen.getByText("Loading your tasks...")).toBeInTheDocument();
  });
});
