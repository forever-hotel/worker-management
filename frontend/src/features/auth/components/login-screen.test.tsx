import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoginScreen } from "./login-screen";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

describe("LoginScreen", () => {
    beforeEach(() => {
        mockPush.mockClear();
    });

    it("renders the worker sign-in form", () => {
        render(<LoginScreen />);

        expect(screen.getByText("FOREVER CITY HOTEL")).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("worker_001"),
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("••••••••"),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", {
                name: "Sign In",
            }),
        ).toBeInTheDocument();
    });

    it("shows validation messages when required fields are empty", async () => {
        const user = userEvent.setup();

        render(<LoginScreen />);

        await user.click(
            screen.getByRole("button", {
                name: "Sign In",
            }),
        );

        expect(
            await screen.findByText("Username is required."),
        ).toBeInTheDocument();

        expect(
            await screen.findByText("Password is required."),
        ).toBeInTheDocument();

        expect(mockPush).not.toHaveBeenCalled();
    });

    it("navigates to the task queue after valid submission", async () => {
        const user = userEvent.setup();

        render(<LoginScreen />);

        await user.type(
            screen.getByPlaceholderText("worker_001"),
            "worker_001",
        );

        await user.type(
            screen.getByPlaceholderText("••••••••"),
            "Password123",
        );

        await user.click(
            screen.getByRole("button", {
                name: "Sign In",
            }),
        );

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith("/tasks");
        });
    });
});