import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MyTasksScreen } from "./my-tasks-screen";

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

jest.mock("@/components/layout/app-shell", () => ({
    AppShell: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

describe("MyTasksScreen", () => {
    it("renders active and completed tasks", () => {
        render(<MyTasksScreen />);

        expect(
            screen.getByText("ACTIVE — 2 OF 3 SLOTS USED"),
        ).toBeInTheDocument();

        expect(screen.getByText("REQ-0041")).toBeInTheDocument();
        expect(screen.getByText("DEL-0029")).toBeInTheDocument();
        expect(screen.getByText("REQ-0038")).toBeInTheDocument();

        expect(
            screen.getByText("COMPLETED THIS SHIFT"),
        ).toBeInTheDocument();
    });

    it("changes an assigned task to in progress", async () => {
        const user = userEvent.setup();

        render(<MyTasksScreen />);

        await user.click(
            screen.getByRole("button", {
                name: "In Progress",
            }),
        );

        expect(
            screen.getAllByText("● In Progress"),
        ).toHaveLength(2);
    });

    it("moves a completed delivery from active to completed", async () => {
        const user = userEvent.setup();

        render(<MyTasksScreen />);

        await user.click(
            screen.getByRole("button", {
                name: "Mark Delivered",
            }),
        );

        expect(
            screen.getByText("ACTIVE — 1 OF 3 SLOTS USED"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Just now · 6 min"),
        ).toBeInTheDocument();
    });
});