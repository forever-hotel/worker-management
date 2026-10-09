export type LoginRequest = {
    username: string;
    password: string;
};

export type AuthenticatedWorker = {
    worker_id: string;
    full_name: string;
    username: string;
    role: "WORKER";
};

export type LoginResponse = {
    access_token: string;
    token_type: "Bearer";
    expires_in: number;
    worker: AuthenticatedWorker;
};

export type AuthSession = {
    accessToken: string;
    tokenType: string;
    expiresAt: number;
    worker: AuthenticatedWorker;
};
