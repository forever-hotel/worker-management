import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskQueueScreen } from "./task-queue-screen";
import {axe} from "jest-axe";

jest.mock("@/components/layout/app-shell", () => ({
    AppShell: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

jest.mock("@/features/tasks", () => ({
    TaskCard: ({ task }: { task: { id: string; category: string } }) => (
        <div data-testid="task-card">
            {task.id} - {task.category}
        </div>
    ),
}));

describe("TaskQueueScreen", () => {
    it("renders all tasks by default", () => {
        render(<TaskQueueScreen />);

        expect(screen.getAllByTestId("task-card").length).toBeGreaterThan(0);

        expect(
            screen.getByText(/Active limit:/i),
        ).toBeInTheDocument();
    });

    it("filters tasks by cleaning category", async () => {
        const user = userEvent.setup();

        render(<TaskQueueScreen />);

        await user.click(
            screen.getByRole("button", { name: "Cleaning" }),
        );

        const cards = screen.getAllByTestId("task-card");

        cards.forEach((card) => {
            expect(card).toHaveTextContent("ROOM_CLEANING");
        });
    });

    it("filters tasks by maintenance category", async () => {
        const user = userEvent.setup();

        render(<TaskQueueScreen />);

        await user.click(
            screen.getByRole("button", { name: "Maintenance" }),
        );

        const cards = screen.getAllByTestId("task-card");

        cards.forEach((card) => {
            expect(card).toHaveTextContent("MAINTENANCE");
        });
    });

    it("filters tasks by delivery category", async () => {
        const user = userEvent.setup();

        render(<TaskQueueScreen />);

        await user.click(
            screen.getByRole("button", { name: "Delivery" }),
        );

        const cards = screen.getAllByTestId("task-card");

        cards.forEach((card) => {
            expect(card).toHaveTextContent("FOOD_DELIVERY");
        });
    });

    it("has no detectable accessibility violations", async () => {
        const { container } = render(<TaskQueueScreen />);

        const results = await axe(container);

        expect(results).toHaveNoViolations();
    });
});