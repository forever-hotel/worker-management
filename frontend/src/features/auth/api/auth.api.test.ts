import { loginWorker } from "./auth.api";
describe("Central staff login API", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses the same-origin BFF and returns a token-free worker session", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: "worker",
        username: "worker",
        role: "WORKER",
        roles: ["WORKER"],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        passwordChangeRequired: true,
      }),
    });
    global.fetch = fetcher;
    const response = await loginWorker({
      username: "worker",
      password: "initial-password",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.access_token).toBe("");
    expect(response.passwordChangeRequired).toBe(true);
  });
});
