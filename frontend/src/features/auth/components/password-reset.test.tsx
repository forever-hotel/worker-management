import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextEncoder } from "node:util";
import { PasswordReset } from "./password-reset";

describe("staff password recovery", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = jest.fn();
    Object.defineProperty(globalThis, "TextEncoder", {
      configurable: true,
      value: TextEncoder,
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("requests a code, submits matching passwords and returns to sign in", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Check your inbox." }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Password changed. Sign in again." }),
      } as Response);
    const user = userEvent.setup();
    render(<PasswordReset />);
    await user.type(
      screen.getByLabelText("Account email"),
      "staff@example.invalid",
    );
    await user.click(
      screen.getByRole("button", { name: "Send verification code" }),
    );
    await screen.findByLabelText("Email verification code");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/request-password-reset",
      expect.objectContaining({
        body: JSON.stringify({ email: "staff@example.invalid" }),
      }),
    );
    await user.type(screen.getByLabelText("Email verification code"), "123456");
    await user.type(
      screen.getByLabelText("New password", { exact: true }),
      "new-private-password",
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new-private-password",
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await screen.findByText("Password changed. Sign in again.");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/reset-password",
      expect.objectContaining({
        body: JSON.stringify({
          email: "staff@example.invalid",
          code: "123456",
          newPassword: "new-private-password",
        }),
      }),
    );
    expect(
      screen.queryByLabelText("New password", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("does not send mismatched passwords and retains the code form on rejection", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Check your inbox." }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "The code is invalid or expired." }),
      } as Response);
    const user = userEvent.setup();
    render(<PasswordReset />);
    await user.type(
      screen.getByLabelText("Account email"),
      "staff@example.invalid",
    );
    await user.click(
      screen.getByRole("button", { name: "Send verification code" }),
    );
    await user.type(
      await screen.findByLabelText("Email verification code"),
      "123456",
    );
    await user.type(
      screen.getByLabelText("New password", { exact: true }),
      "new-private-password",
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "different-password",
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await screen.findByText("Passwords must match.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new-private-password",
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await screen.findByText("The code is invalid or expired.");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Change password" }),
      ).toBeEnabled(),
    );
    expect(screen.getByLabelText("Email verification code")).toHaveValue(
      "123456",
    );
  });
});
