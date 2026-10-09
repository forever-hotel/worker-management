import type {
    AuthSession,
    LoginResponse,
} from "@/features/auth/types/auth";

const AUTH_SESSION_KEY = "wkms.auth.session";

function hasBrowserStorage(): boolean {
    return typeof window !== "undefined";
}

export function saveAuthSession(
    response: LoginResponse,
): AuthSession {
    const session: AuthSession = {
        accessToken: response.access_token,
        tokenType: response.token_type,
        expiresAt:
            Date.now() +
            response.expires_in * 1000,
        worker: response.worker,
    };

    if (hasBrowserStorage()) {
        window.sessionStorage.setItem(
            AUTH_SESSION_KEY,
            JSON.stringify(session),
        );
    }

    return session;
}

export function clearAuthSession(): void {
    if (!hasBrowserStorage()) {
        return;
    }

    window.sessionStorage.removeItem(
        AUTH_SESSION_KEY,
    );
}

export function getAuthSession():
    AuthSession | null {
    if (!hasBrowserStorage()) {
        return null;
    }

    const stored =
        window.sessionStorage.getItem(
            AUTH_SESSION_KEY,
        );

    if (!stored) {
        return null;
    }

    try {
        const session =
            JSON.parse(stored) as AuthSession;

        if (
            !session.accessToken ||
            !session.worker ||
            !session.expiresAt
        ) {
            clearAuthSession();
            return null;
        }

        if (Date.now() >= session.expiresAt) {
            clearAuthSession();
            return null;
        }

        return session;
    } catch {
        clearAuthSession();
        return null;
    }
}

export function getAccessToken():
    string | null {
    return getAuthSession()?.accessToken ?? null;
}
