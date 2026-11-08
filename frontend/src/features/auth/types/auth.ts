export type LoginRequest = {
  username: string;
  password: string;
};

export type AuthenticatedWorker = {
  worker_id: string;
  full_name: string;
  username: string;
  role: "WORKER" | "ROOT";
};

export type LoginResponse = {
  access_token: string;
  passwordChangeRequired?: boolean;
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
