import {
    render,
    screen,
    waitFor,
} from "@testing-library/react";

import {
    getAuthSession,
} from "@/lib/auth-session";

import {
    RequireAuth,
} from "./require-auth";

const mockReplace =
    jest.fn();

const mockRouter = {
    replace:
        mockReplace,
};

jest.mock(
    "next/navigation",
    () => ({
        useRouter: () =>
            mockRouter,
    }),
);

jest.mock(
    "@/lib/auth-session",
    () => ({
        getAuthSession:
            jest.fn(),
    }),
);

const mockedGetAuthSession =
    jest.mocked(
        getAuthSession,
    );

describe("RequireAuth", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders protected content when a valid session exists", () => {
        mockedGetAuthSession
            .mockReturnValue({
                accessToken:
                    "token",
                tokenType:
                    "Bearer",
                expiresAt:
                    Date.now() +
                    60_000,
                worker: {
                    worker_id:
                        "worker-1",
                    full_name:
                        "Test Worker",
                    username:
                        "worker",
                    role:
                        "WORKER",
                },
            });

        render(
            <RequireAuth>
                <div>
                    Protected content
                </div>
            </RequireAuth>,
        );

        expect(
            screen.getByText(
                "Protected content",
            ),
        ).toBeInTheDocument();

        expect(
            mockReplace,
        ).not.toHaveBeenCalled();
    });

    it("redirects to login when no valid session exists", async () => {
        mockedGetAuthSession
            .mockReturnValue(
                null,
            );

        render(
            <RequireAuth>
                <div>
                    Protected content
                </div>
            </RequireAuth>,
        );

        await waitFor(
            () => {
                expect(
                    mockReplace,
                ).toHaveBeenCalledWith(
                    "/login",
                );
            },
        );

        expect(
            screen.queryByText(
                "Protected content",
            ),
        ).not.toBeInTheDocument();
    });
});
