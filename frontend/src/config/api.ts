export function getApiGatewayUrl(): string {
    const gatewayUrl =
        process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim();

    if (!gatewayUrl) {
        throw new Error(
            "NEXT_PUBLIC_API_GATEWAY_URL is not configured",
        );
    }

    return gatewayUrl.replace(/\/+$/, "");
}

export function buildApiUrl(
    path: string,
): string {
    const normalizedPath =
        path.startsWith("/")
            ? path
            : `/${path}`;

    return `${getApiGatewayUrl()}${normalizedPath}`;
}
