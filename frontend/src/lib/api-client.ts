import { buildApiUrl } from "@/config/api";
import {
    clearAuthSession,
    getAccessToken,
} from "@/lib/auth-session";

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: unknown,
        message: string,
    ) {
        super(message);
        this.name = "ApiError";
    }
}

function getErrorMessage(
    body: unknown,
): string {
    if (
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof body.message === "string"
    ) {
        return body.message;
    }

    return "Request failed";
}

async function readResponseBody(
    response: Response,
): Promise<unknown> {
    const contentType =
        response.headers.get(
            "content-type",
        );

    if (
        contentType?.includes(
            "application/json",
        )
    ) {
        return response.json();
    }

    const text = await response.text();

    return text || null;
}

export async function apiRequest<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const headers =
        new Headers(options.headers);

    headers.set(
        "Accept",
        "application/json",
    );

    if (
        options.body &&
        !(options.body instanceof FormData)
    ) {
        headers.set(
            "Content-Type",
            "application/json",
        );
    }

    const accessToken =
        getAccessToken();

    if (accessToken) {
        headers.set(
            "Authorization",
            `Bearer ${accessToken}`,
        );
    }

    const response =
        await fetch(
            buildApiUrl(path),
            {
                ...options,
                headers,
                credentials: "include",
            },
        );

    const body =
        await readResponseBody(response);

    if (!response.ok) {
        if (response.status === 401) {
            clearAuthSession();
        }

        throw new ApiError(
            response.status,
            body,
            getErrorMessage(body),
        );
    }

    return body as T;
}
