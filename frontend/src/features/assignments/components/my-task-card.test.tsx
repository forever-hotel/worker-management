import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { MyTask } from "../types/my-task";
import { MyTaskCard } from "./my-task-card";

const mockPush = jest.fn();

const mockRouter = {
  push: mockPush,
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const baseTask: MyTask = {
  id: "TASK-101",
  roomNumber: "305",
  category: "ROOM_CLEANING",
  description: "Clean and prepare room",
  priority: "NORMAL",
  status: "ASSIGNED",
  source: "CHECKOUT_TRIGGER",
  submittedAt: "2026-10-03T08:00:00.000Z",
  elapsedMinutes: 5,
};

describe("MyTaskCard", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders assigned task information", () => {
    render(<MyTaskCard task={baseTask} />);

    expect(screen.getByText("TASK-101")).toBeInTheDocument();

    expect(screen.getByText("Room 305")).toBeInTheDocument();

    expect(screen.getByText("Room Cleaning")).toBeInTheDocument();

    expect(screen.getByText("Clean and prepare room")).toBeInTheDocument();

    expect(screen.getByText("● Assigned")).toBeInTheDocument();

    expect(screen.getByText("5 min since submitted")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Start Task",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Mark Complete",
      }),
    ).not.toBeInTheDocument();
  });

  it("calls onStart when Start Task is clicked without navigating", async () => {
    const user = userEvent.setup();

    const onStart = jest.fn();

    render(<MyTaskCard task={baseTask} onStart={onStart} />);

    await user.click(
      screen.getByRole("button", {
        name: "Start Task",
      }),
    );

    expect(onStart).toHaveBeenCalledWith("TASK-101");

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows the in-progress state", () => {
    render(
      <MyTaskCard
        task={{
          ...baseTask,
          status: "IN_PROGRESS",
        }}
      />,
    );

    expect(screen.getByText("● In Progress")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Start Task",
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Mark Complete",
      }),
    ).toBeInTheDocument();
  });

  it("calls onComplete for an in-progress task without navigating", async () => {
    const user = userEvent.setup();

    const onComplete = jest.fn();

    render(
      <MyTaskCard
        task={{
          ...baseTask,
          status: "IN_PROGRESS",
        }}
        onComplete={onComplete}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Mark Complete",
      }),
    );

    expect(onComplete).toHaveBeenCalledWith("TASK-101");

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows delivery-specific completion text for an in-progress food-delivery task", () => {
    render(
      <MyTaskCard
        task={{
          ...baseTask,
          category: "FOOD_DELIVERY",
          status: "IN_PROGRESS",
        }}
      />,
    );

    expect(screen.getByText("Food Delivery")).toBeInTheDocument();

    expect(screen.getByText("Delivery")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Mark Delivered",
      }),
    ).toBeInTheDocument();
  });

  it("opens task details when the card is clicked", async () => {
    const user = userEvent.setup();

    render(<MyTaskCard task={baseTask} />);

    await user.click(screen.getByRole("link"));

    expect(mockPush).toHaveBeenCalledWith("/tasks/TASK-101?from=my-tasks");
  });

  it("opens task details using Enter", () => {
    render(<MyTaskCard task={baseTask} />);

    fireEvent.keyDown(screen.getByRole("link"), {
      key: "Enter",
    });

    expect(mockPush).toHaveBeenCalledWith("/tasks/TASK-101?from=my-tasks");
  });

  it("opens task details using Space", () => {
    render(<MyTaskCard task={baseTask} />);

    fireEvent.keyDown(screen.getByRole("link"), {
      key: " ",
    });

    expect(mockPush).toHaveBeenCalledWith("/tasks/TASK-101?from=my-tasks");
  });
});
