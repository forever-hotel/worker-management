import { render, screen, waitFor } from "@testing-library/react";
import { staffRequest } from "../api/auth.api";
import { RequireAuth } from "./require-auth";
const replace = jest.fn();
const router = { replace };
jest.mock("next/navigation", () => ({ useRouter: () => router }));
jest.mock("../api/auth.api", () => ({
  staffRequest: jest.fn(),
  sessionResponse: jest.fn(),
}));
jest.mock("@/lib/auth-session", () => ({
  saveAuthSession: jest.fn(),
  clearAuthSession: jest.fn(),
}));
describe("Server-verified WMS gate", () => {
  beforeEach(() => jest.clearAllMocks());
  it("renders only after a verified central session", async () => {
    jest.mocked(staffRequest).mockResolvedValue({
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      passwordChangeRequired: false,
    });
    render(
      <RequireAuth>
        <p>Protected tasks</p>
      </RequireAuth>,
    );
    expect(await screen.findByText("Protected tasks")).toBeInTheDocument();
  });
  it("requires first password change", async () => {
    jest
      .mocked(staffRequest)
      .mockResolvedValue({ passwordChangeRequired: true });
    render(
      <RequireAuth>
        <p>Protected tasks</p>
      </RequireAuth>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/change-password"),
    );
    expect(screen.queryByText("Protected tasks")).not.toBeInTheDocument();
  });
  it("redirects revoked sessions to login", async () => {
    jest.mocked(staffRequest).mockRejectedValue({ status: 401 });
    render(
      <RequireAuth>
        <p>Protected tasks</p>
      </RequireAuth>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
