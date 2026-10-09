import {
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError } from "@/lib/api-client";
import { LoginScreen } from "./login-screen";
import { loginWorker } from "../api/auth.api";
import { saveAuthSession } from "@/lib/auth-session";

const mockReplace = jest.fn();

jest.mock(
    "next/navigation",
    () => ({
        useRouter: () => ({
            replace: mockReplace,
        }),
    }),
);

jest.mock(
    "../api/auth.api",
    () => ({
        loginWorker: jest.fn(),
    }),
);

jest.mock(
    "@/lib/auth-session",
    () => ({
        saveAuthSession:
            jest.fn(),
    }),
);

const mockedLoginWorker =
    jest.mocked(loginWorker);

const mockedSaveAuthSession =
    jest.mocked(saveAuthSession);

const loginResponse = {
    access_token:
        "test-access-token",
    token_type:
        "Bearer" as const,
    expires_in: 28800,
    worker: {
        worker_id:
            "worker-1",
        full_name:
            "Test Worker",
        username:
            "worker_001",
        role:
            "WORKER" as const,
    },
};

describe(
    "LoginScreen",
    () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it(
            "renders the worker sign-in form",
            () => {
                render(
                    <LoginScreen />,
                );

                expect(
                    screen.getByText(
                        "FOREVER CITY HOTEL",
                    ),
                ).toBeInTheDocument();

                expect(
                    screen.getByPlaceholderText(
                        "worker_001",
                    ),
                ).toBeInTheDocument();

                expect(
                    screen.getByPlaceholderText(
                        "••••••••",
                    ),
                ).toBeInTheDocument();
            },
        );

        it(
            "shows validation messages when required fields are empty",
            async () => {
                const user =
                    userEvent.setup();

                render(
                    <LoginScreen />,
                );

                await user.click(
                    screen.getByRole(
                        "button",
                        {
                            name:
                                "Sign In",
                        },
                    ),
                );

                expect(
                    await screen.findByText(
                        "Username is required.",
                    ),
                ).toBeInTheDocument();

                expect(
                    await screen.findByText(
                        "Password is required.",
                    ),
                ).toBeInTheDocument();

                expect(
                    mockedLoginWorker,
                ).not.toHaveBeenCalled();
            },
        );

        it(
            "authenticates, stores the session and navigates to the queue",
            async () => {
                mockedLoginWorker
                    .mockResolvedValue(
                        loginResponse,
                    );

                const user =
                    userEvent.setup();

                render(
                    <LoginScreen />,
                );

                await user.type(
                    screen.getByPlaceholderText(
                        "worker_001",
                    ),
                    "worker_001",
                );

                await user.type(
                    screen.getByPlaceholderText(
                        "••••••••",
                    ),
                    "Password123",
                );

                await user.click(
                    screen.getByRole(
                        "button",
                        {
                            name:
                                "Sign In",
                        },
                    ),
                );

                await waitFor(
                    () => {
                        expect(
                            mockedLoginWorker,
                        ).toHaveBeenCalledWith(
                            {
                                username:
                                    "worker_001",
                                password:
                                    "Password123",
                            },
                        );
                    },
                );

                expect(
                    mockedSaveAuthSession,
                ).toHaveBeenCalledWith(
                    loginResponse,
                );

                expect(
                    mockReplace,
                ).toHaveBeenCalledWith(
                    "/tasks",
                );
            },
        );

        it(
            "shows an authentication error for invalid credentials",
            async () => {
                mockedLoginWorker
                    .mockRejectedValue(
                        new ApiError(
                            401,
                            {
                                message:
                                    "Invalid username or password",
                            },
                            "Invalid username or password",
                        ),
                    );

                const user =
                    userEvent.setup();

                render(
                    <LoginScreen />,
                );

                await user.type(
                    screen.getByPlaceholderText(
                        "worker_001",
                    ),
                    "worker_001",
                );

                await user.type(
                    screen.getByPlaceholderText(
                        "••••••••",
                    ),
                    "wrong-password",
                );

                await user.click(
                    screen.getByRole(
                        "button",
                        {
                            name:
                                "Sign In",
                        },
                    ),
                );

                expect(
                    await screen.findByText(
                        "Invalid username or password.",
                    ),
                ).toBeInTheDocument();

                expect(
                    mockReplace,
                ).not.toHaveBeenCalled();
            },
        );
    },
);
