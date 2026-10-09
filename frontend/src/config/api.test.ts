import {
    buildApiUrl,
    getApiGatewayUrl,
} from "./api";

describe("API configuration", () => {
    const originalUrl =
        process.env.NEXT_PUBLIC_API_GATEWAY_URL;

    afterEach(() => {
        if (originalUrl === undefined) {
            delete process.env
                .NEXT_PUBLIC_API_GATEWAY_URL;
        } else {
            process.env.NEXT_PUBLIC_API_GATEWAY_URL =
                originalUrl;
        }
    });

    it("returns the configured gateway without trailing slashes", () => {
        process.env.NEXT_PUBLIC_API_GATEWAY_URL =
            "http://localhost:8080///";

        expect(
            getApiGatewayUrl(),
        ).toBe(
            "http://localhost:8080",
        );
    });

    it("throws when the gateway URL is missing", () => {
        delete process.env
            .NEXT_PUBLIC_API_GATEWAY_URL;

        expect(() =>
            getApiGatewayUrl(),
        ).toThrow(
            "NEXT_PUBLIC_API_GATEWAY_URL is not configured",
        );
    });

    it("builds paths with or without a leading slash", () => {
        process.env.NEXT_PUBLIC_API_GATEWAY_URL =
            "http://localhost:8080";

        expect(
            buildApiUrl(
                "/wkms/tasks/queue",
            ),
        ).toBe(
            "http://localhost:8080/wkms/tasks/queue",
        );

        expect(
            buildApiUrl(
                "wkms/tasks/queue",
            ),
        ).toBe(
            "http://localhost:8080/wkms/tasks/queue",
        );
    });
});
