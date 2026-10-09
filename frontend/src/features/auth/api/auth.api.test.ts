import {
    apiRequest,
} from "@/lib/api-client";

import {
    loginWorker,
} from "./auth.api";

jest.mock(
    "@/lib/api-client",
    () => ({
        apiRequest:
            jest.fn(),
    }),
);

const mockedApiRequest =
    jest.mocked(
        apiRequest,
    );

describe("auth API", () => {
    it("posts worker credentials to the WKMS login endpoint", async () => {
        mockedApiRequest
            .mockResolvedValue(
                {} as never,
            );

        await loginWorker({
            username:
                "worker_001",
            password:
                "Password123",
        });

        expect(
            mockedApiRequest,
        ).toHaveBeenCalledWith(
            "/wkms/auth/login",
            {
                method:
                    "POST",
                body:
                    JSON.stringify({
                        username:
                            "worker_001",
                        password:
                            "Password123",
                    }),
            },
        );
    });
});
