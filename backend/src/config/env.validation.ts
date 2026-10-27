import {
    DEFAULT_JWT_EXPIRES_IN_SECONDS,
    ENV_KEYS,
} from './constants';

export function validateEnvironment(
    config: Record<string, unknown>,
): Record<string, unknown> {
    const databaseUrl =
        config[ENV_KEYS.DATABASE_URL];

    if (
        typeof databaseUrl !== 'string' ||
        databaseUrl.trim().length === 0
    ) {
        throw new Error(
            'DATABASE_URL environment variable is not configured',
        );
    }

    const jwtSecret =
        config[ENV_KEYS.JWT_SECRET];

    if (
        typeof jwtSecret !== 'string' ||
        jwtSecret.trim().length < 32
    ) {
        throw new Error(
            'JWT_SECRET must be configured with at least 32 characters',
        );
    }

    const expiresInSeconds = Number(
        config[
            ENV_KEYS.JWT_EXPIRES_IN_SECONDS
            ] ?? DEFAULT_JWT_EXPIRES_IN_SECONDS,
    );

    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new Error('JWT_EXPIRES_IN_SECONDS must be a positive integer');
    }

    const frontDeskServiceToken = config.FDS_WKMS_SERVICE_TOKEN;

    if (
      frontDeskServiceToken !== undefined &&
      frontDeskServiceToken !== null &&
      frontDeskServiceToken !== '' &&
      (typeof frontDeskServiceToken !== 'string' ||
        frontDeskServiceToken.length < 32)
    ) {
      throw new Error(
        'FDS_WKMS_SERVICE_TOKEN must contain at least 32 characters when configured',
      );
    }

    return {
        ...config,
        [ENV_KEYS.JWT_EXPIRES_IN_SECONDS]:
        expiresInSeconds,
    };
}