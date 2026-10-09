import { render, screen, waitFor } from "@testing-library/react";

import { getShiftSummary } from "../api/shift.api";

import { ShiftDashboardScreen } from "./shift-dashboard-screen";

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
jest.mock("../api/shift.api", () => ({
  getShiftSummary: jest.fn(),
}));

const mockedGetShiftSummary = jest.mocked(getShiftSummary);
const shiftSummary = {
  operational_day: {
    timezone: "UTC",
    start_at: "2026-10-03T00:00:00.000Z",
    end_at: "2026-10-04T00:00:00.000Z",
  },

  worker: {
    worker_id: "worker-1",
    full_name: "WKMS E2E Worker",
    vocation: "Housekeeping",
  },

  active_task_count: 2,

  completed_task_count: 2,

  available_escalated_task_count: 1,

  average_task_turnaround_seconds: 900,

  completed_tasks: [
    {
      task_id: "task-complete-1",
      room_number: "302",
      category: "ROOM_CLEANING" as const,
      priority: "NORMAL" as const,
      submitted_at: "2026-10-03T08:00:00.000Z",
      completed_at: "2026-10-03T08:15:00.000Z",
      turnaround_seconds: 900,
    },
    {
      task_id: "task-complete-2",
      room_number: "207",
      category: "FOOD_DELIVERY" as const,
      priority: "NORMAL" as const,
      submitted_at: "2026-10-03T09:00:00.000Z",
      completed_at: "2026-10-03T09:10:00.000Z",
      turnaround_seconds: 600,
    },
  ],
};

describe("ShiftDashboardScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetShiftSummary.mockResolvedValue(shiftSummary);
  });

  it("renders the real worker summary", async () => {
    render(<ShiftDashboardScreen />);

    expect(await screen.findByText("WKMS E2E Worker")).toBeInTheDocument();

    expect(screen.getByText("Housekeeping")).toBeInTheDocument();

    expect(screen.getByText("UTC")).toBeInTheDocument();

    expect(screen.getByText("Tasks completed")).toBeInTheDocument();

    expect(screen.getByText("Avg. turnaround")).toBeInTheDocument();

    expect(screen.getByText("Available escalated")).toBeInTheDocument();

    expect(screen.getByText("15m")).toBeInTheDocument();
  });

  it("renders completed task history using real turnaround values", async () => {
    render(<ShiftDashboardScreen />);

    expect(
      await screen.findByText(/task-complete-1 · Room Cleaning/),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/task-complete-2 · Food Delivery/),
    ).toBeInTheDocument();

    expect(screen.getByText("15 min turnaround")).toBeInTheDocument();

    expect(screen.getByText("10 min turnaround")).toBeInTheDocument();
  });

  it("does not render unsupported mock shift fields", async () => {
    render(<ShiftDashboardScreen />);

    await screen.findByText("WKMS E2E Worker");

    expect(screen.queryByText("Rating")).not.toBeInTheDocument();

    expect(screen.queryByText(/Shift started/i)).not.toBeInTheDocument();

    expect(screen.queryByText(/Offline cache/i)).not.toBeInTheDocument();

    expect(screen.queryByText(/Last sync/i)).not.toBeInTheDocument();
  });

  it("renders an empty completed history", async () => {
    mockedGetShiftSummary.mockResolvedValue({
      ...shiftSummary,

      completed_task_count: 0,

      average_task_turnaround_seconds: null,

      completed_tasks: [],
    });

    render(<ShiftDashboardScreen />);

    expect(
      await screen.findByText("No completed tasks today"),
    ).toBeInTheDocument();
  });
});

describe("ShiftDashboardScreen branch coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(getShiftSummary).mockResolvedValue(shiftSummary);
  });

  it("shows a load error", async () => {
    jest.mocked(getShiftSummary).mockRejectedValueOnce(new Error("network"));

    render(<ShiftDashboardScreen />);

    expect(
      await screen.findByText("Unable to load shift summary."),
    ).toBeInTheDocument();
  });

  it("redirects to login on 401", async () => {
    const { ApiError } = await import("@/lib/api-client");

    jest
      .mocked(getShiftSummary)
      .mockRejectedValueOnce(
        new ApiError(401, { message: "Unauthorized" }, "Unauthorized"),
      );

    render(<ShiftDashboardScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("renders fallback vocation and no-average states", async () => {
    jest.mocked(getShiftSummary).mockResolvedValue({
      ...shiftSummary,
      worker: {
        ...shiftSummary.worker,
        vocation: null,
      },
      average_task_turnaround_seconds: null,
      completed_task_count: 0,
      completed_tasks: [],
    });

    render(<ShiftDashboardScreen />);

    expect(await screen.findByText("Hotel Worker")).toBeInTheDocument();

    expect(screen.getByText("—")).toBeInTheDocument();

    expect(screen.getByText("No completed tasks today")).toBeInTheDocument();
  });
});
