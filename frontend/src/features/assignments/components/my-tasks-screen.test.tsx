import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { getShiftSummary } from "@/features/shifts/api/shift.api";
import type { ShiftSummary } from "@/features/shifts/types/shift-summary";
import { completeTask, startTask } from "@/features/tasks/api/tasks.api";
import type { TaskApiRecord } from "@/features/tasks/types/task-api";
import { ApiError } from "@/lib/api-client";
import { useTaskData } from "@/providers/task-data-provider";

import type { MyTask } from "../types/my-task";
import { MyTasksScreen } from "./my-tasks-screen";

const mockReplace = jest.fn();

const mockRouter = {
  replace: mockReplace,
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/providers/task-data-provider", () => ({
  useTaskData: jest.fn(),
}));

jest.mock("@/features/tasks/api/tasks.api", () => ({
  startTask: jest.fn(),
  completeTask: jest.fn(),
}));

jest.mock("@/features/shifts/api/shift.api", () => ({
  getShiftSummary: jest.fn(),
}));

jest.mock("./my-task-card", () => ({
  MyTaskCard: ({
    task,
    onStart,
    onComplete,
  }: {
    task: MyTask;
    onStart?: (taskId: string) => void;
    onComplete?: (taskId: string) => void;
  }) => (
    <div data-testid="my-task-card">
      {task.id} - {task.status}
      {task.status === "ASSIGNED" && (
        <button type="button" onClick={() => onStart?.(task.id)}>
          Start {task.id}
        </button>
      )}
      {task.status === "IN_PROGRESS" && (
        <button type="button" onClick={() => onComplete?.(task.id)}>
          Complete {task.id}
        </button>
      )}
    </div>
  ),
}));

const mockedUseTaskData = jest.mocked(useTaskData);
const mockedStartTask = jest.mocked(startTask);
const mockedCompleteTask = jest.mocked(completeTask);
const mockedGetShiftSummary = jest.mocked(getShiftSummary);

const shiftSummaryFixture: ShiftSummary = {
  operational_day: {
    timezone: "UTC",
    start_at: "2026-10-09T00:00:00.000Z",
    end_at: "2026-10-10T00:00:00.000Z",
  },
  worker: {
    worker_id: "worker-1",
    full_name: "Demo Worker",
    vocation: "Housekeeping",
  },
  active_task_count: 2,
  completed_task_count: 1,
  available_escalated_task_count: 0,
  average_task_turnaround_seconds: 600,
  completed_tasks: [
    {
      task_id: "task-completed",
      room_number: "203",
      category: "EXTRA_TOWELS",
      priority: "NORMAL",
      submitted_at: "2026-10-09T08:00:00.000Z",
      completed_at: "2026-10-09T08:10:00.000Z",
      turnaround_seconds: 600,
    },
  ],
};

const mockRefreshAll = jest.fn(async () => undefined);
const mockRefreshQueue = jest.fn(async () => undefined);
const mockRefreshMyTasks = jest.fn(async () => undefined);

const assignedTask: TaskApiRecord = {
  task_id: "task-assigned",
  room_number: "201",
  category: "ROOM_CLEANING",
  description: "Clean room 201",
  priority: "NORMAL",
  status: "ASSIGNED",
  assigned_worker_id: "worker-1",
  booking_id: "booking-1",
  service_request_id: null,
  food_order_id: null,
  submitted_at: "2026-10-03T08:00:00.000Z",
  completed_at: null,
  source: "CHECKOUT_TRIGGER",
  created_at: "2026-10-03T08:00:00.000Z",
  updated_at: "2026-10-03T08:00:00.000Z",
};

const inProgressTask: TaskApiRecord = {
  ...assignedTask,
  task_id: "task-progress",
  room_number: "202",
  status: "IN_PROGRESS",
};

function setTaskData(overrides: Partial<ReturnType<typeof useTaskData>> = {}) {
  mockedUseTaskData.mockReturnValue({
    queue: [],
    myTasks: [assignedTask, inProgressTask],
    queueCount: 0,
    myTasksCount: 2,
    loading: false,
    error: null,
    refreshAll: mockRefreshAll,
    refreshQueue: mockRefreshQueue,
    refreshMyTasks: mockRefreshMyTasks,
    ...overrides,
  });
}

/**
 * Wait for the initial Shift Summary request to finish.
 *
 * This prevents tests from ending while MyTasksScreen
 * still has pending asynchronous React state updates.
 */
async function renderSettledScreen() {
  render(<MyTasksScreen />);

  await waitFor(() => {
    const completedLink = screen.queryByRole("link", {
      name: "View completed task for Room 203",
    });

    const emptyMessage = screen.queryByText("No completed tasks today");

    const errorMessage = screen.queryByText("Unable to load completed tasks.");

    expect(completedLink ?? emptyMessage ?? errorMessage).not.toBeNull();
  });
}

describe("MyTasksScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetShiftSummary.mockResolvedValue(shiftSummaryFixture);

    setTaskData();

    mockedStartTask.mockResolvedValue(inProgressTask);

    mockedCompleteTask.mockResolvedValue({
      ...inProgressTask,
      status: "COMPLETED",
      completed_at: "2026-10-09T09:00:00.000Z",
    });
  });

  it("renders shared authenticated tasks without fetching on mount", async () => {
    await renderSettledScreen();

    expect(screen.getAllByTestId("my-task-card")).toHaveLength(2);

    expect(screen.getByText("ACTIVE — 2 OF 3 SLOTS USED")).toBeInTheDocument();

    expect(mockRefreshMyTasks).not.toHaveBeenCalled();
    expect(mockedGetShiftSummary).toHaveBeenCalledTimes(1);
  });

  it("starts an assigned task and refreshes only My Tasks", async () => {
    const user = userEvent.setup();

    await renderSettledScreen();

    await user.click(
      screen.getByRole("button", {
        name: "Start task-assigned",
      }),
    );

    await waitFor(() => {
      expect(mockedStartTask).toHaveBeenCalledWith("task-assigned");
      expect(mockRefreshMyTasks).toHaveBeenCalledTimes(1);
      expect(mockRefreshAll).not.toHaveBeenCalled();
    });

    expect(mockedGetShiftSummary).toHaveBeenCalledTimes(1);
  });

  it("completes an in-progress task and refreshes My Tasks", async () => {
    const user = userEvent.setup();

    await renderSettledScreen();

    await user.click(
      screen.getByRole("button", {
        name: "Complete task-progress",
      }),
    );

    await waitFor(() => {
      expect(mockedCompleteTask).toHaveBeenCalledWith("task-progress");
      expect(mockRefreshMyTasks).toHaveBeenCalledTimes(1);
      expect(mockRefreshAll).not.toHaveBeenCalled();
      expect(mockedGetShiftSummary).toHaveBeenCalledTimes(2);
    });
  });

  it("shows an empty active-task state", async () => {
    setTaskData({
      myTasks: [],
      myTasksCount: 0,
    });

    await renderSettledScreen();

    expect(screen.getByText("No active tasks")).toBeInTheDocument();
  });

  it("shows provider error and retries My Tasks", async () => {
    setTaskData({
      error: "Unable to refresh task data.",
    });

    const user = userEvent.setup();

    await renderSettledScreen();

    expect(
      screen.getByText("Unable to refresh task data."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Retry",
      }),
    );

    await waitFor(() => {
      expect(mockRefreshMyTasks).toHaveBeenCalledTimes(1);
    });
  });

  it("shows loading state from the task provider", async () => {
    setTaskData({
      loading: true,
    });

    await renderSettledScreen();

    expect(screen.getByText("Loading your tasks...")).toBeInTheDocument();
  });

  it("shows backend conflict when starting and reconciles My Tasks", async () => {
    mockedStartTask.mockRejectedValueOnce(
      new ApiError(
        409,
        { message: "Task state changed" },
        "Task state changed",
      ),
    );

    const user = userEvent.setup();

    await renderSettledScreen();

    await user.click(
      screen.getByRole("button", {
        name: "Start task-assigned",
      }),
    );

    expect(await screen.findByText("Task state changed")).toBeInTheDocument();

    expect(mockRefreshMyTasks).toHaveBeenCalledTimes(1);
  });

  it("shows a generic completion error", async () => {
    mockedCompleteTask.mockRejectedValueOnce(new Error("network"));

    const user = userEvent.setup();

    await renderSettledScreen();

    await user.click(
      screen.getByRole("button", {
        name: "Complete task-progress",
      }),
    );

    expect(
      await screen.findByText("Unable to complete this task."),
    ).toBeInTheDocument();
  });

  it("redirects when starting returns 401", async () => {
    mockedStartTask.mockRejectedValueOnce(
      new ApiError(401, { message: "Unauthorized" }, "Unauthorized"),
    );

    const user = userEvent.setup();

    await renderSettledScreen();

    await user.click(
      screen.getByRole("button", {
        name: "Start task-assigned",
      }),
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("displays completed tasks from the authenticated shift summary", async () => {
    await renderSettledScreen();

    const completedLink = screen.getByRole("link", {
      name: "View completed task for Room 203",
    });

    expect(completedLink).toHaveAttribute(
      "href",
      "/tasks/task-completed?from=my-tasks",
    );

    expect(
      screen.getByText("task-completed · Extra Towels"),
    ).toBeInTheDocument();

    expect(screen.getByText("Room 203")).toBeInTheDocument();

    expect(screen.getByText("10 min turnaround")).toBeInTheDocument();

    expect(
      screen.getByRole("img", { name: "Extra Towels" }),
    ).toBeInTheDocument();

    expect(mockedGetShiftSummary).toHaveBeenCalledTimes(1);
  });

  it("displays an empty state when no tasks were completed today", async () => {
    mockedGetShiftSummary.mockResolvedValue({
      ...shiftSummaryFixture,
      completed_task_count: 0,
      completed_tasks: [],
    });

    await renderSettledScreen();

    expect(screen.getByText("No completed tasks today")).toBeInTheDocument();
  });

  it("handles completed-history failure without losing active tasks", async () => {
    mockedGetShiftSummary.mockRejectedValueOnce(
      new Error("Temporary Gateway timeout"),
    );

    const user = userEvent.setup();

    await renderSettledScreen();

    expect(
      screen.getByText("Unable to load completed tasks."),
    ).toBeInTheDocument();

    // Completed-history failures must not hide active tasks.
    expect(screen.getAllByTestId("my-task-card")).toHaveLength(2);

    await user.click(
      screen.getByRole("button", {
        name: "Retry",
      }),
    );

    expect(
      await screen.findByRole("link", {
        name: "View completed task for Room 203",
      }),
    ).toBeInTheDocument();

    expect(mockedGetShiftSummary).toHaveBeenCalledTimes(2);
  });

  it("refreshes completed history after successfully completing a task", async () => {
    mockedGetShiftSummary
      .mockResolvedValueOnce(shiftSummaryFixture)
      .mockResolvedValueOnce({
        ...shiftSummaryFixture,
        completed_task_count: 2,
        completed_tasks: [
          ...shiftSummaryFixture.completed_tasks,
          {
            task_id: "task-progress",
            room_number: "202",
            category: "ROOM_CLEANING",
            priority: "NORMAL",
            submitted_at: "2026-10-09T08:30:00.000Z",
            completed_at: "2026-10-09T09:00:00.000Z",
            turnaround_seconds: 1800,
          },
        ],
      });

    const user = userEvent.setup();

    await renderSettledScreen();

    expect(mockedGetShiftSummary).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", {
        name: "Complete task-progress",
      }),
    );

    // Verify the new completed task appears after the refresh.
    const newlyCompletedLink = await screen.findByRole("link", {
      name: "View completed task for Room 202",
    });

    expect(newlyCompletedLink).toHaveAttribute(
      "href",
      "/tasks/task-progress?from=my-tasks",
    );

    expect(mockedCompleteTask).toHaveBeenCalledWith("task-progress");
    expect(mockRefreshMyTasks).toHaveBeenCalledTimes(1);
    expect(mockedGetShiftSummary).toHaveBeenCalledTimes(2);
  });
});
