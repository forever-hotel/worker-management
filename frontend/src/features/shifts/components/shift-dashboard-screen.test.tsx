import { render, screen } from "@testing-library/react";

import { ShiftDashboardScreen } from "./shift-dashboard-screen";

jest.mock("@/components/layout/app-shell", () => ({
    AppShell: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

describe("ShiftDashboardScreen", () => {
    it("renders worker and shift summary", () => {
        render(<ShiftDashboardScreen />);

        expect(screen.getByText("Worker 001")).toBeInTheDocument();
        expect(screen.getByText("A+")).toBeInTheDocument();
        expect(screen.getByText("7")).toBeInTheDocument();
        expect(screen.getByText("12m")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("0")).toBeInTheDocument();

        expect(
            screen.getByText("Tasks completed"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Avg. completion"),
        ).toBeInTheDocument();
    });

    it("renders completed task history", () => {
        render(<ShiftDashboardScreen />);

        expect(
            screen.getByText(/REQ-0038 · Room Cleaning/),
        ).toBeInTheDocument();

        expect(
            screen.getByText(/DEL-0025 · Food Delivery/),
        ).toBeInTheDocument();

        expect(
            screen.getByText(/REQ-0034 · Extra Towels/),
        ).toBeInTheDocument();

        expect(
            screen.getByText(/REQ-0031 · Laundry Pickup/),
        ).toBeInTheDocument();
    });

    it("renders connectivity information", () => {
        render(<ShiftDashboardScreen />);

        expect(
            screen.getByText(/Online.*Hotel Wi-Fi/),
        ).toBeInTheDocument();

        expect(
            screen.getByText("My Tasks cached ✓"),
        ).toBeInTheDocument();

        expect(screen.getByText("10:41 AM")).toBeInTheDocument();
    });
});