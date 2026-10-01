import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskFilters } from "./task-filters";

describe("TaskFilters", () => {
    it("renders all task filter buttons", () => {
        render(
            <TaskFilters
                activeFilter="ALL"
                onChange={jest.fn()}
            />,
        );

        expect(
            screen.getByRole("button", { name: "All" }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "Cleaning" }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "Maintenance" }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "Delivery" }),
        ).toBeInTheDocument();
    });

    it("marks the active filter as pressed", () => {
        render(
            <TaskFilters
                activeFilter="MAINTENANCE"
                onChange={jest.fn()}
            />,
        );

        expect(
            screen.getByRole("button", { name: "Maintenance" }),
        ).toHaveAttribute("aria-pressed", "true");

        expect(
            screen.getByRole("button", { name: "All" }),
        ).toHaveAttribute("aria-pressed", "false");
    });

    it("calls onChange with the selected filter", async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();

        render(
            <TaskFilters
                activeFilter="ALL"
                onChange={onChange}
            />,
        );

        await user.click(
            screen.getByRole("button", { name: "Cleaning" }),
        );

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith("CLEANING");
    });
});