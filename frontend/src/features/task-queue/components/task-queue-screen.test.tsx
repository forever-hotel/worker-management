import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import { claimTask } from "@/features/tasks/api/tasks.api";

import type { Task } from "@/features/tasks/types/task";

import type { TaskApiRecord } from "@/features/tasks/types/task-api";

import { ApiError } from "@/lib/api-client";

import { useTaskData } from "@/providers/task-data-provider";

import { TaskQueueScreen } from "./task-queue-screen";

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
  claimTask: jest.fn(),
}));

jest.mock("@/features/tasks/components/task-card", () => ({
  TaskCard: ({
    task,
    onClaim,
  }: {
    task: Task;
    onClaim?: (task: Task) => void;
  }) => (
    <div data-testid="task-card">
      {task.id} - {task.category}
      <button type="button" onClick={() => onClaim?.(task)}>
        Claim {task.id}
      </button>
    </div>
  ),
}));

const mockedUseTaskData = jest.mocked(useTaskData);

const mockedClaimTask = jest.mocked(claimTask);

const mockRefreshAll = jest.fn(async () => undefined);

const mockRefreshQueue = jest.fn(async () => undefined);

const mockRefreshMyTasks = jest.fn(async () => undefined);

const queueTasks: TaskApiRecord[] = [
  {
    task_id: "task-cleaning",
    room_number: "101",
    category: "ROOM_CLEANING",
    description: "Clean room",
    priority: "HIGH",
    status: "UNASSIGNED",
    assigned_worker_id: null,
    booking_id: "booking-1",
    service_request_id: null,
    food_order_id: null,
    submitted_at: "2026-10-03T08:00:00.000Z",
    completed_at: null,
    source: "CHECKOUT_TRIGGER",
    created_at: "2026-10-03T08:00:00.000Z",
    updated_at: "2026-10-03T08:00:00.000Z",
  },
  {
    task_id: "task-maintenance",
    room_number: "102",
    category: "MAINTENANCE",
    description: "Fix light",
    priority: "NORMAL",
    status: "UNASSIGNED",
    assigned_worker_id: null,
    booking_id: null,
    service_request_id: "service-1",
    food_order_id: null,
    submitted_at: "2026-10-03T08:05:00.000Z",
    completed_at: null,
    source: "FRONT_DESK",
    created_at: "2026-10-03T08:05:00.000Z",
    updated_at: "2026-10-03T08:05:00.000Z",
  },
  {
    task_id: "task-delivery",
    room_number: "103",
    category: "FOOD_DELIVERY",
    description: "Deliver order",
    priority: "NORMAL",
    status: "ESCALATED",
    assigned_worker_id: null,
    booking_id: null,
    service_request_id: null,
    food_order_id: "order-1",
    submitted_at: "2026-10-03T08:10:00.000Z",
    completed_at: null,
    source: "KMS",
    created_at: "2026-10-03T08:10:00.000Z",
    updated_at: "2026-10-03T08:10:00.000Z",
  },
];

function setTaskData(overrides: Partial<ReturnType<typeof useTaskData>> = {}) {
  mockedUseTaskData.mockReturnValue({
    queue: queueTasks,
    myTasks: [],
    queueCount: queueTasks.length,
    myTasksCount: 0,
    loading: false,
    error: null,
    refreshAll: mockRefreshAll,
    refreshQueue: mockRefreshQueue,
    refreshMyTasks: mockRefreshMyTasks,
    ...overrides,
  });
}

describe("TaskQueueScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    setTaskData();

    mockedClaimTask.mockResolvedValue(queueTasks[0]);
  });

  it("renders shared queue data without fetching on mount", () => {
    render(<TaskQueueScreen />);

    expect(screen.getAllByTestId("task-card")).toHaveLength(3);

    expect(mockRefreshAll).not.toHaveBeenCalled();
  });

  it("filters tasks by cleaning category", async () => {
    const user = userEvent.setup();

    render(<TaskQueueScreen />);

    await user.click(
      screen.getByRole("button", {
        name: "Cleaning",
      }),
    );

    const cards = screen.getAllByTestId("task-card");

    expect(cards).toHaveLength(1);

    expect(cards[0]).toHaveTextContent("ROOM_CLEANING");
  });

  it("claims a task and refreshes shared task data", async () => {
    const user = userEvent.setup();

    render(<TaskQueueScreen />);

    await user.click(
      screen.getByRole("button", {
        name: "Claim task-cleaning",
      }),
    );

    await waitFor(() => {
      expect(mockedClaimTask).toHaveBeenCalledWith("task-cleaning");

      expect(mockRefreshAll).toHaveBeenCalledTimes(1);
    });
  });

  it("reconciles shared data after a claim conflict", async () => {
    mockedClaimTask.mockRejectedValue(
      new ApiError(
        409,
        {
          message: "Task is no longer available",
        },
        "Task is no longer available",
      ),
    );

    const user = userEvent.setup();

    render(<TaskQueueScreen />);

    await user.click(
      screen.getByRole("button", {
        name: "Claim task-cleaning",
      }),
    );

    expect(
      await screen.findByText("Task is no longer available"),
    ).toBeInTheDocument();

    expect(mockRefreshAll).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state", () => {
    setTaskData({
      queue: [],
      queueCount: 0,
    });

    render(<TaskQueueScreen />);

    expect(screen.getByText("No tasks available")).toBeInTheDocument();
  });

  it("shows provider errors and retries through shared data", async () => {
    setTaskData({
      error: "Unable to refresh task data.",
    });

    const user = userEvent.setup();

    render(<TaskQueueScreen />);

    expect(
      screen.getByText("Unable to refresh task data."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Retry",
      }),
    );

    expect(mockRefreshAll).toHaveBeenCalledTimes(1);
  });

  it("shows loading state from the provider", () => {
    setTaskData({
      loading: true,
    });

    render(<TaskQueueScreen />);

    expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
  });

  it("shows a generic claim error", async () => {
    mockedClaimTask.mockRejectedValueOnce(new Error("network"));

    const user = userEvent.setup();

    render(<TaskQueueScreen />);

    await user.click(
      screen.getByRole("button", {
        name: "Claim task-cleaning",
      }),
    );

    expect(
      await screen.findByText("Unable to claim this task."),
    ).toBeInTheDocument();
  });

  it("redirects to login when claiming returns 401", async () => {
    mockedClaimTask.mockRejectedValueOnce(
      new ApiError(
        401,
        {
          message: "Unauthorized",
        },
        "Unauthorized",
      ),
    );

    const user = userEvent.setup();

    render(<TaskQueueScreen />);

    await user.click(
      screen.getByRole("button", {
        name: "Claim task-cleaning",
      }),
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<TaskQueueScreen />);

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
