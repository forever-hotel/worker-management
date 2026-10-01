import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { MyTask } from "../types/my-task";
import { MyTaskCard } from "./my-task-card";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

const baseTask = {
    id: "TASK-101",
    roomNumber: "305",
    category: "ROOM_CLEANING",
    description: "Clean and prepare room",
    status: "ASSIGNED",
    claimedAtLabel: "5 min ago",
} as MyTask;

describe("MyTaskCard", () => {
    beforeEach(() => {
        mockPush.mockClear();
    });

    it("renders assigned task information", () => {
        render(<MyTaskCard task={baseTask} />);

        expect(screen.getByText("TASK-101")).toBeInTheDocument();
        expect(screen.getByText("Room 305")).toBeInTheDocument();
        expect(screen.getByText("Room Cleaning")).toBeInTheDocument();
        expect(
            screen.getByText("Clean and prepare room"),
        ).toBeInTheDocument();

        expect(screen.getByText("● Assigned")).toBeInTheDocument();
        expect(screen.getByText("Claimed 5 min ago")).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "In Progress" }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "Mark Complete" }),
        ).toBeInTheDocument();
    });

    it("calls onStart when In Progress is clicked without navigating", async () => {
        const user = userEvent.setup();
        const onStart = jest.fn();

        render(
            <MyTaskCard
                task={baseTask}
                onStart={onStart}
            />,
        );

        await user.click(
            screen.getByRole("button", { name: "In Progress" }),
        );

        expect(onStart).toHaveBeenCalledWith("TASK-101");
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("calls onComplete when Mark Complete is clicked without navigating", async () => {
        const user = userEvent.setup();
        const onComplete = jest.fn();

        render(
            <MyTaskCard
                task={baseTask}
                onComplete={onComplete}
            />,
        );

        await user.click(
            screen.getByRole("button", { name: "Mark Complete" }),
        );

        expect(onComplete).toHaveBeenCalledWith("TASK-101");
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("shows the in progress state", () => {
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
            screen.queryByRole("button", { name: "In Progress" }),
        ).not.toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "Mark Complete" }),
        ).toBeInTheDocument();
    });

    it("shows delivery-specific text for food delivery tasks", () => {
        render(
            <MyTaskCard
                task={{
                    ...baseTask,
                    category: "FOOD_DELIVERY",
                }}
            />,
        );

        expect(screen.getByText("Food Delivery")).toBeInTheDocument();
        expect(screen.getByText("Delivery")).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "Mark Delivered" }),
        ).toBeInTheDocument();
    });

    it("opens task details when the card is clicked", async () => {
        const user = userEvent.setup();

        render(<MyTaskCard task={baseTask} />);

        await user.click(screen.getByRole("link"));

        expect(mockPush).toHaveBeenCalledWith(
            "/tasks/TASK-101",
        );
    });

    it("opens task details using Enter", () => {
        render(<MyTaskCard task={baseTask} />);

        fireEvent.keyDown(screen.getByRole("link"), {
            key: "Enter",
        });

        expect(mockPush).toHaveBeenCalledWith(
            "/tasks/TASK-101",
        );
    });

    it("opens task details using Space", () => {
        render(<MyTaskCard task={baseTask} />);

        fireEvent.keyDown(screen.getByRole("link"), {
            key: " ",
        });

        expect(mockPush).toHaveBeenCalledWith(
            "/tasks/TASK-101",
        );
    });
});