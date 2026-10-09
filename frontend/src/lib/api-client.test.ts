import {
    clearAuthSession,
    getAccessToken,
} from "./auth-session";

import {
    ApiError,
    apiRequest,
} from "./api-client";

jest.mock(
    "./auth-session",
    () => ({
        getAccessToken:
            jest.fn(),
        clearAuthSession:
            jest.fn(),
    }),
);

const mockedGetAccessToken =
    jest.mocked(
        getAccessToken,
    );

const mockedClearAuthSession =
    jest.mocked(
        clearAuthSession,
    );

const mockFetch =
    jest.fn();

function jsonResponse(
    body: unknown,
    status = 200,
): Response {
    return {
        ok:
            status >= 200 &&
            status < 300,
        status,
        headers:
            new Headers({
                "content-type":
                    "application/json",
            }),
        json:
            jest.fn()
                .mockResolvedValue(
                    body,
                ),
        text:
            jest.fn()
                .mockResolvedValue(
                    "",
                ),
    } as unknown as Response;
}

function textResponse(
    body: string,
    status: number,
): Response {
    return {
        ok: false,
        status,
        headers:
            new Headers({
                "content-type":
                    "text/plain",
            }),
        json:
            jest.fn(),
        text:
            jest.fn()
                .mockResolvedValue(
                    body,
                ),
    } as unknown as Response;
}

describe("apiRequest", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        process.env.NEXT_PUBLIC_API_GATEWAY_URL =
            "http://localhost:8080";

        global.fetch =
            mockFetch;

        mockedGetAccessToken
            .mockReturnValue(
                "token-123",
            );
    });

    it("sends an authenticated GET request", async () => {
        mockFetch
            .mockResolvedValue(
                jsonResponse({
                    success: true,
                }),
            );

        await expect(
            apiRequest<{
                success:
                    boolean;
            }>(
                "/wkms/tasks/queue",
            ),
        ).resolves.toEqual({
            success: true,
        });

        const [
            url,
            options,
        ] =
            mockFetch
                .mock
                .calls[0];

        expect(
            url,
        ).toBe(
            "http://localhost:8080/wkms/tasks/queue",
        );

        const headers =
            options.headers as Headers;

        expect(
            headers.get(
                "Authorization",
            ),
        ).toBe(
            "Bearer token-123",
        );

        expect(
            headers.get(
                "Accept",
            ),
        ).toBe(
            "application/json",
        );

        expect(
            options.credentials,
        ).toBe(
            "include",
        );
    });

    it("adds JSON content type for requests with a JSON body", async () => {
        mockFetch
            .mockResolvedValue(
                jsonResponse({
                    ok: true,
                }),
            );

        await apiRequest(
            "/wkms/auth/login",
            {
                method:
                    "POST",
                body:
                    JSON.stringify({
                        username:
                            "worker",
                    }),
            },
        );

        const options =
            mockFetch
                .mock
                .calls[0][1];

        const headers =
            options.headers as Headers;

        expect(
            headers.get(
                "Content-Type",
            ),
        ).toBe(
            "application/json",
        );
    });

    it("does not add authorization when no token exists", async () => {
        mockedGetAccessToken
            .mockReturnValue(
                null,
            );

        mockFetch
            .mockResolvedValue(
                jsonResponse({
                    ok: true,
                }),
            );

        await apiRequest(
            "/wkms/auth/login",
        );

        const options =
            mockFetch
                .mock
                .calls[0][1];

        const headers =
            options.headers as Headers;

        expect(
            headers.has(
                "Authorization",
            ),
        ).toBe(false);
    });

    it("clears authentication and throws ApiError on 401", async () => {
        mockFetch
            .mockResolvedValue(
                jsonResponse(
                    {
                        message:
                            "Unauthorized",
                    },
                    401,
                ),
            );

        await expect(
            apiRequest(
                "/wkms/tasks/queue",
            ),
        ).rejects.toMatchObject({
            status: 401,
            message:
                "Unauthorized",
        });

        expect(
            mockedClearAuthSession,
        ).toHaveBeenCalled();
    });

    it("uses text responses for non-JSON errors", async () => {
        mockFetch
            .mockResolvedValue(
                textResponse(
                    "Gateway failure",
                    502,
                ),
            );

        await expect(
            apiRequest(
                "/wkms/tasks/queue",
            ),
        ).rejects.toBeInstanceOf(
            ApiError,
        );
    });

    it("uses the fallback message when an error body has no message", async () => {
        mockFetch
            .mockResolvedValue(
                jsonResponse(
                    {
                        error:
                            "bad",
                    },
                    500,
                ),
            );

        await expect(
            apiRequest(
                "/wkms/tasks/queue",
            ),
        ).rejects.toMatchObject({
            message:
                "Request failed",
        });
    });
});
