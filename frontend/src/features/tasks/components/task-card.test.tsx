import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Task } from "../types/task";
import { TaskCard } from "./task-card";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const baseTask: Task = {
  id: "TASK-001",
  roomNumber: "204",
  category: "ROOM_CLEANING",
  description: "Clean the guest room",
  priority: "NORMAL",
  status: "UNASSIGNED",
  source: "FRONT_DESK",
  submittedAt: "2026-10-01T10:00:00Z",
  elapsedMinutes: 5,
};

describe("TaskCard", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders the task information", () => {
    render(<TaskCard task={baseTask} />);

    expect(screen.getByText("TASK-001")).toBeInTheDocument();
    expect(screen.getByText("Room 204")).toBeInTheDocument();
    expect(screen.getByText("Room Cleaning")).toBeInTheDocument();
    expect(screen.getByText("Clean the guest room")).toBeInTheDocument();

    expect(screen.getByText("5 min ago")).toBeInTheDocument();

    expect(
      screen.getByRole("img", {
        name: "Room Cleaning for Room 204",
      }),
    ).toBeInTheDocument();
  });

  it("shows the normal status tag for a normal task", () => {
    render(<TaskCard task={baseTask} />);

    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("shows the high priority tag for a high priority task", () => {
    render(
      <TaskCard
        task={{
          ...baseTask,
          priority: "HIGH",
        }}
      />,
    );

    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("shows the delivery tag for a food delivery task", () => {
    render(
      <TaskCard
        task={{
          ...baseTask,
          category: "FOOD_DELIVERY",
        }}
      />,
    );

    expect(screen.getByText("Food Delivery")).toBeInTheDocument();

    expect(screen.getAllByText("Delivery").length).toBeGreaterThan(0);
  });

  it("shows escalation information for an escalated task", () => {
    render(
      <TaskCard
        task={{
          ...baseTask,
          status: "ESCALATED",
          elapsedMinutes: 18,
        }}
      />,
    );

    expect(screen.getByText("⚠ Escalated")).toBeInTheDocument();

    expect(
      screen.getByText("● Unclaimed 18 min · Escalated"),
    ).toBeInTheDocument();
  });

  it("navigates to task details when the card is clicked", async () => {
    const user = userEvent.setup();

    render(<TaskCard task={baseTask} />);

    await user.click(screen.getByRole("link"));

    expect(mockPush).toHaveBeenCalledWith("/tasks/TASK-001?from=queue");
  });

  it("navigates to task details when Enter is pressed", () => {
    render(<TaskCard task={baseTask} />);

    const card = screen.getByRole("link");

    fireEvent.keyDown(card, {
      key: "Enter",
    });

    expect(mockPush).toHaveBeenCalledWith("/tasks/TASK-001?from=queue");
  });

  it("navigates to task details when Space is pressed", () => {
    render(<TaskCard task={baseTask} />);

    const card = screen.getByRole("link");

    fireEvent.keyDown(card, {
      key: " ",
    });

    expect(mockPush).toHaveBeenCalledWith("/tasks/TASK-001?from=queue");
  });

  it("does not open task details when Claim Task is clicked", async () => {
    const user = userEvent.setup();

    render(<TaskCard task={baseTask} />);

    await user.click(
      screen.getByRole("button", {
        name: "Claim Task",
      }),
    );

    expect(mockPush).not.toHaveBeenCalled();
  });
});
