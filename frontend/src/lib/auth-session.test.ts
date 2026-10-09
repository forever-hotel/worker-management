import {
    clearAuthSession,
    getAccessToken,
    getAuthSession,
    saveAuthSession,
} from "./auth-session";

const loginResponse = {
    access_token:
        "test-token",
    token_type:
        "Bearer" as const,
    expires_in: 3600,
    worker: {
        worker_id:
            "worker-1",
        full_name:
            "Test Worker",
        username:
            "worker_1",
        role:
            "WORKER" as const,
    },
};

describe("auth session", () => {
    beforeEach(() => {
        sessionStorage.clear();

        jest.spyOn(
            Date,
            "now",
        ).mockReturnValue(
            1_000_000,
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("saves and reads an authenticated session", () => {
        const session =
            saveAuthSession(
                loginResponse,
            );

        expect(
            session.accessToken,
        ).toBe(
            "test-token",
        );

        expect(
            session.expiresAt,
        ).toBe(
            4_600_000,
        );

        expect(
            getAuthSession(),
        ).toEqual(
            session,
        );

        expect(
            getAccessToken(),
        ).toBe(
            "test-token",
        );
    });

    it("clears a saved session", () => {
        saveAuthSession(
            loginResponse,
        );

        clearAuthSession();

        expect(
            getAuthSession(),
        ).toBeNull();
    });

    it("returns null when no session exists", () => {
        expect(
            getAuthSession(),
        ).toBeNull();

        expect(
            getAccessToken(),
        ).toBeNull();
    });

    it("clears malformed session JSON", () => {
        sessionStorage.setItem(
            "wkms.auth.session",
            "{not-json",
        );

        expect(
            getAuthSession(),
        ).toBeNull();

        expect(
            sessionStorage.getItem(
                "wkms.auth.session",
            ),
        ).toBeNull();
    });

    it("clears an expired session", () => {
        sessionStorage.setItem(
            "wkms.auth.session",
            JSON.stringify({
                accessToken:
                    "expired",
                tokenType:
                    "Bearer",
                expiresAt:
                    999_999,
                worker: {
                    worker_id:
                        "worker-1",
                },
            }),
        );

        expect(
            getAuthSession(),
        ).toBeNull();
    });

    it("clears an invalid stored session", () => {
        sessionStorage.setItem(
            "wkms.auth.session",
            JSON.stringify({
                accessToken:
                    "",
                expiresAt:
                    2_000_000,
            }),
        );

        expect(
            getAuthSession(),
        ).toBeNull();
    });
});
