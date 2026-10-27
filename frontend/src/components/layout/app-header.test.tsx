import { fireEvent, render, screen } from "@testing-library/react";

import { clearAuthSession, getAuthSession } from "@/lib/auth-session";
import { AppHeader } from "./app-header";

const replace = jest.fn();
const refresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

jest.mock("@/lib/auth-session", () => ({
  clearAuthSession: jest.fn(),
  getAuthSession: jest.fn(),
}));

const mockedClearAuthSession = jest.mocked(clearAuthSession);
const mockedGetAuthSession = jest.mocked(getAuthSession);

describe("AppHeader worker profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAuthSession.mockReturnValue(null);
  });

  it("keeps the menu closed until the worker opens the profile", () => {
    render(<AppHeader title="Task Queue" />);

    expect(screen.getByRole("heading", { name: "Task Queue" })).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Worker profile" }));
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Worker profile" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Worker profile" }));
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });

  it("clears the session and redirects to login on logout", () => {
    render(<AppHeader title="My Tasks" />);

    fireEvent.click(screen.getByRole("button", { name: "Worker profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(mockedClearAuthSession).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });
});
