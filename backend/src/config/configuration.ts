import {
    DEFAULT_JWT_EXPIRES_IN_SECONDS,
    ENV_KEYS,
} from './constants';

export default () => ({
    [ENV_KEYS.DATABASE_URL]:
    process.env.DATABASE_URL,

    [ENV_KEYS.JWT_SECRET]:
    process.env.JWT_SECRET,

    [ENV_KEYS.JWT_EXPIRES_IN_SECONDS]:
        Number(
            process.env.JWT_EXPIRES_IN_SECONDS ??
            DEFAULT_JWT_EXPIRES_IN_SECONDS,
        ),
});