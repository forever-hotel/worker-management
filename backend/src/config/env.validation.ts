import { ENV_KEYS } from './constants';

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const databaseUrl = config[ENV_KEYS.DATABASE_URL];

  if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL environment variable is not configured');
  }

  const authUrl = String(config.AUTH_SERVICE_URL ?? 'http://localhost:8080');
  try {
    const url = new URL(authUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    throw new Error('AUTH_SERVICE_URL must be an HTTP(S) service origin');
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
  };
}
