import { ENV_KEYS } from './constants';

export default () => ({
    [ENV_KEYS.DATABASE_URL]: process.env.DATABASE_URL,
});