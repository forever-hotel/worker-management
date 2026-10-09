import { render, screen } from "@testing-library/react";

import { useTaskData } from "@/providers/task-data-provider";

import { AppShell } from "./app-shell";

jest.mock("@/providers/task-data-provider", () => ({
  useTaskData: jest.fn(),
}));

const mockedUseTaskData = jest.mocked(useTaskData);

describe("AppShell", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseTaskData.mockReturnValue({
      queue: [],
      myTasks: [],
      queueCount: 4,
      myTasksCount: 2,
      loading: false,
      error: null,
      refreshAll: jest.fn(),
      refreshQueue: jest.fn(),
      refreshMyTasks: jest.fn(),
    });
  });

  it("renders shared task counts and navigation", () => {
    render(
      <AppShell title="Task Queue" activeTab="queue">
        <p>Page content</p>
      </AppShell>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Task Queue",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Online")).toBeInTheDocument();

    expect(screen.getByLabelText("Worker profile")).toBeInTheDocument();

    expect(screen.getByText("Queue (4)")).toBeInTheDocument();

    expect(screen.getByText("My Tasks (2)")).toBeInTheDocument();

    expect(screen.getByText("Page content")).toBeInTheDocument();

    const queueLinks = screen.getAllByRole("link", {
      name: /Queue/,
    });

    queueLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/tasks");
    });

    const myTaskLinks = screen.getAllByRole("link", {
      name: /My Tasks/,
    });

    myTaskLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/my-tasks");
    });

    const shiftLinks = screen.getAllByRole("link", {
      name: "Shift",
    });

    shiftLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/shift");
    });
  });
});
