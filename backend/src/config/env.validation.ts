import { ENV_KEYS } from './constants';

export function validateEnvironment(
    config: Record<string, unknown>,
): Record<string, unknown> {
    const databaseUrl = config[ENV_KEYS.DATABASE_URL];

    if (
        typeof databaseUrl !== 'string' ||
        databaseUrl.trim().length === 0
    ) {
        throw new Error(
            'DATABASE_URL environment variable is not configured',
        );
    }

    return config;
}