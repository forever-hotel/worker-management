import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { MyTask } from "../types/my-task";
import { CompletedTaskCard } from "./completed-task-card";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const completedTask: MyTask = {
  id: "REQ-0038",
  roomNumber: "302",
  category: "ROOM_CLEANING",
  description: "Post-checkout room cleaning completed.",
  priority: "NORMAL",
  status: "COMPLETED",
  source: "CHECKOUT_TRIGGER",
  submittedAt: "9:41 AM",
  elapsedMinutes: 14,
  completedAtLabel: "9:55 AM",
  completionMinutes: 14,
};

describe("CompletedTaskCard", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders completed task details", () => {
    render(<CompletedTaskCard task={completedTask} />);

    expect(screen.getByText("REQ-0038")).toBeInTheDocument();
    expect(screen.getByText("Room 302")).toBeInTheDocument();
    expect(screen.getByText("Room Cleaning")).toBeInTheDocument();
    expect(screen.getByText("✓ Completed")).toBeInTheDocument();
    expect(screen.getByText("9:55 AM · 14 min")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("renders HIGH for a high-priority completed task", () => {
    render(
      <CompletedTaskCard
        task={{
          ...completedTask,
          priority: "HIGH",
        }}
      />,
    );

    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("renders completion time without duration when duration is missing", () => {
    render(
      <CompletedTaskCard
        task={{
          ...completedTask,
          completionMinutes: undefined,
        }}
      />,
    );

    expect(screen.getByText("9:55 AM")).toBeInTheDocument();
  });

  it("navigates when the card is clicked", async () => {
    const user = userEvent.setup();

    render(<CompletedTaskCard task={completedTask} />);

    await user.click(screen.getByRole("link"));

    expect(mockPush).toHaveBeenCalledWith("/tasks/REQ-0038?from=my-tasks");
  });

  it("supports keyboard navigation", () => {
    render(<CompletedTaskCard task={completedTask} />);

    const card = screen.getByRole("link");

    fireEvent.keyDown(card, { key: " " });

    expect(mockPush).toHaveBeenCalledWith("/tasks/REQ-0038?from=my-tasks");
  });
});
