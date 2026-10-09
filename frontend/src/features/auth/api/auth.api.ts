import { apiRequest } from "@/lib/api-client";
import type {
    LoginRequest,
    LoginResponse,
} from "../types/auth";

export function loginWorker(
    credentials: LoginRequest,
): Promise<LoginResponse> {
    return apiRequest<LoginResponse>(
        "/wkms/auth/login",
        {
            method: "POST",
            body: JSON.stringify(
                credentials,
            ),
        },
    );
}
