import { render, screen } from "@testing-library/react";

import { AppShell } from "./app-shell";

describe("AppShell", () => {
    it("renders the application shell and navigation", () => {
        render(
            <AppShell
                title="Task Queue"
                activeTab="queue"
                queueCount={4}
                myTasksCount={2}
            >
                <p>Page content</p>
            </AppShell>,
        );

        expect(
            screen.getByRole("heading", {
                name: "Task Queue",
            }),
        ).toBeInTheDocument();

        expect(screen.getByText("Online")).toBeInTheDocument();

        expect(
            screen.getByLabelText("Worker profile"),
        ).toBeInTheDocument();

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