import { render, screen } from "@testing-library/react";

import { TaskDetailScreen } from "./task-detail-screen";

jest.mock("next/navigation", () => ({
    notFound: jest.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
}));

describe("TaskDetailScreen", () => {
    it("renders an in-progress task and near-escalation warning", () => {
        render(<TaskDetailScreen taskId="REQ-0041" />);

        expect(screen.getByText("Task Detail")).toBeInTheDocument();
        expect(screen.getAllByText("REQ-0041").length).toBeGreaterThan(0);
        expect(screen.getByText("● In Progress")).toBeInTheDocument();

        expect(
            screen.getByText(
                "⚠ Task escalates in ~2 min if incomplete",
            ),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", {
                name: "✓ Mark as Complete",
            }),
        ).toBeInTheDocument();
    });

    it("renders an escalated task", () => {
        render(<TaskDetailScreen taskId="REQ-0042" />);

        expect(screen.getByText("⚠ Escalated")).toBeInTheDocument();

        expect(
            screen.getByText("⚠ This task has been escalated"),
        ).toBeInTheDocument();

        expect(screen.getByText("100%")).toBeInTheDocument();

        expect(
            screen.getByRole("button", {
                name: "Claim Task",
            }),
        ).toBeInTheDocument();
    });

    it("renders an assigned task", () => {
        render(<TaskDetailScreen taskId="DEL-0029" />);

        expect(screen.getByText("● Assigned")).toBeInTheDocument();

        expect(
            screen.getByRole("button", {
                name: "Start Task",
            }),
        ).toBeInTheDocument();

        expect(screen.getByText("10:22 AM")).toBeInTheDocument();
    });

    it("renders an unassigned task", () => {
        render(<TaskDetailScreen taskId="REQ-0045" />);

        expect(screen.getByText("● Unassigned")).toBeInTheDocument();

        expect(
            screen.getByRole("button", {
                name: "Claim Task",
            }),
        ).toBeInTheDocument();
    });

    it("renders a completed task", () => {
        render(<TaskDetailScreen taskId="REQ-0038" />);

        expect(screen.getByText("✓ Completed")).toBeInTheDocument();
        expect(screen.getByText("✓ Task completed")).toBeInTheDocument();
        expect(screen.getByText("✓ Task Completed")).toBeInTheDocument();
    });

    it("invokes notFound for an unknown task", () => {
        expect(() => {
            render(<TaskDetailScreen taskId="UNKNOWN-TASK" />);
        }).toThrow("NEXT_NOT_FOUND");
    });
});