import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  claimTask,
  completeTask,
  getTaskDetail,
  startTask,
} from "../api/tasks.api";

import { TaskDetailScreen } from "./task-detail-screen";

const mockReplace = jest.fn();

const mockRouter = {
  replace: mockReplace,
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("../api/tasks.api", () => ({
  getTaskDetail: jest.fn(),

  claimTask: jest.fn(),

  startTask: jest.fn(),

  completeTask: jest.fn(),
}));

const mockedGetTaskDetail = jest.mocked(getTaskDetail);

const mockedClaimTask = jest.mocked(claimTask);

const mockedStartTask = jest.mocked(startTask);

const mockedCompleteTask = jest.mocked(completeTask);

const baseTask = {
  task_id: "task-101",
  room_number: "305",
  category: "ROOM_CLEANING" as const,
  description: "Clean and prepare room",
  priority: "NORMAL" as const,
  status: "UNASSIGNED" as const,
  assigned_worker_id: null,
  booking_id: "booking-1",
  service_request_id: null,
  food_order_id: null,
  submitted_at: "2026-10-03T08:00:00.000Z",
  completed_at: null,
  source: "CHECKOUT_TRIGGER" as const,
  created_at: "2026-10-03T08:00:00.000Z",
  updated_at: "2026-10-03T08:00:00.000Z",
};

describe("TaskDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetTaskDetail.mockResolvedValue(baseTask);
  });

  it("loads and renders a real unassigned task", async () => {
    render(<TaskDetailScreen taskId="task-101" />);

    expect(await screen.findByText("Task Detail")).toBeInTheDocument();

    expect(screen.getAllByText("task-101").length).toBeGreaterThan(0);

    expect(screen.getByText("Room 305")).toBeInTheDocument();

    expect(screen.getByText("Clean and prepare room")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Claim Task",
      }),
    ).toBeInTheDocument();

    expect(mockedGetTaskDetail).toHaveBeenCalledWith("task-101");
  });

  it("claims an available task and reloads its detail", async () => {
    mockedClaimTask.mockResolvedValue({
      ...baseTask,
      status: "ASSIGNED",
      assigned_worker_id: "worker-1",
    });

    mockedGetTaskDetail.mockResolvedValueOnce(baseTask).mockResolvedValueOnce({
      ...baseTask,
      status: "ASSIGNED",
      assigned_worker_id: "worker-1",
    });

    const user = userEvent.setup();

    render(<TaskDetailScreen taskId="task-101" />);

    await user.click(
      await screen.findByRole("button", {
        name: "Claim Task",
      }),
    );

    await waitFor(() => {
      expect(mockedClaimTask).toHaveBeenCalledWith("task-101");
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Start Task",
        }),
      ).toBeInTheDocument();
    });
  });

  it("starts an assigned task", async () => {
    const assignedTask = {
      ...baseTask,
      status: "ASSIGNED" as const,
      assigned_worker_id: "worker-1",
    };

    mockedGetTaskDetail
      .mockResolvedValueOnce(assignedTask)
      .mockResolvedValueOnce({
        ...assignedTask,
        status: "IN_PROGRESS",
      });

    mockedStartTask.mockResolvedValue({
      ...assignedTask,
      status: "IN_PROGRESS",
    });

    const user = userEvent.setup();

    render(<TaskDetailScreen taskId="task-101" />);

    await user.click(
      await screen.findByRole("button", {
        name: "Start Task",
      }),
    );

    await waitFor(() => {
      expect(mockedStartTask).toHaveBeenCalledWith("task-101");
    });

    expect(
      await screen.findByRole("button", {
        name: "Mark Complete",
      }),
    ).toBeInTheDocument();
  });

  it("completes an in-progress task", async () => {
    const inProgressTask = {
      ...baseTask,
      status: "IN_PROGRESS" as const,
      assigned_worker_id: "worker-1",
    };

    mockedGetTaskDetail
      .mockResolvedValueOnce(inProgressTask)
      .mockResolvedValueOnce({
        ...inProgressTask,
        status: "COMPLETED",
        completed_at: "2026-10-03T09:00:00.000Z",
      });

    mockedCompleteTask.mockResolvedValue({
      ...inProgressTask,
      status: "COMPLETED",
      completed_at: "2026-10-03T09:00:00.000Z",
    });

    const user = userEvent.setup();

    render(<TaskDetailScreen taskId="task-101" />);

    await user.click(
      await screen.findByRole("button", {
        name: "Mark Complete",
      }),
    );

    await waitFor(() => {
      expect(mockedCompleteTask).toHaveBeenCalledWith("task-101");
    });

    expect(await screen.findByText("✓ Task Completed")).toBeInTheDocument();
  });

  it("renders an escalated task truthfully", async () => {
    mockedGetTaskDetail.mockResolvedValue({
      ...baseTask,
      status: "ESCALATED",
    });

    render(<TaskDetailScreen taskId="task-101" />);

    expect(await screen.findByText("Escalated")).toBeInTheDocument();

    expect(
      screen.getByText("⚠ This task has been escalated"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Claim Task",
      }),
    ).toBeInTheDocument();
  });

  it("shows task not found when API returns 404", async () => {
    const { ApiError } = await import("@/lib/api-client");

    mockedGetTaskDetail.mockRejectedValue(
      new ApiError(
        404,
        {
          message: "Task not found",
        },
        "Task not found",
      ),
    );

    render(<TaskDetailScreen taskId="missing-task" />);

    expect(await screen.findByText("Task not found.")).toBeInTheDocument();
  });
});

describe("TaskDetailScreen branch coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(getTaskDetail).mockResolvedValue(baseTask);
  });

  it("redirects to login when loading returns 401", async () => {
    const { ApiError } = await import("@/lib/api-client");

    jest
      .mocked(getTaskDetail)
      .mockRejectedValueOnce(
        new ApiError(401, { message: "Unauthorized" }, "Unauthorized"),
      );

    render(<TaskDetailScreen taskId="task-101" />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("shows an access error for 403", async () => {
    const { ApiError } = await import("@/lib/api-client");

    jest
      .mocked(getTaskDetail)
      .mockRejectedValueOnce(
        new ApiError(403, { message: "Forbidden" }, "Forbidden"),
      );

    render(<TaskDetailScreen taskId="task-101" />);

    expect(
      await screen.findByText("You do not have access to this task."),
    ).toBeInTheDocument();
  });

  it("shows a generic load error", async () => {
    jest.mocked(getTaskDetail).mockRejectedValueOnce(new Error("network"));

    render(<TaskDetailScreen taskId="task-101" />);

    expect(
      await screen.findByText("Unable to load this task."),
    ).toBeInTheDocument();
  });
});

describe("Task Detail origin-aware back navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetTaskDetail.mockResolvedValue(baseTask);
  });

  it.each([
    ["queue", "/tasks"],
    ["my-tasks", "/my-tasks"],
    ["shift", "/shift"],
  ])("returns to %s when opened from that tab", async (origin, destination) => {
    render(<TaskDetailScreen taskId="task-101" from={origin} />);

    expect(await screen.findByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      destination,
    );
  });

  it("falls back to My Tasks for a directly opened completed task", async () => {
    mockedGetTaskDetail.mockResolvedValue({
      ...baseTask,
      status: "COMPLETED",
    });

    render(<TaskDetailScreen taskId="task-101" />);

    expect(await screen.findByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/my-tasks",
    );
  });

  it("falls back to Queue for a directly opened unassigned task", async () => {
    render(<TaskDetailScreen taskId="task-101" />);

    expect(await screen.findByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/tasks",
    );
  });

  it("rejects an unrecognized navigation origin", async () => {
    render(<TaskDetailScreen taskId="task-101" from="https://example.com" />);

    expect(await screen.findByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/tasks",
    );
  });
});
