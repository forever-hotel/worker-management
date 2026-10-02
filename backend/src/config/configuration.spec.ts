import configuration from './configuration';

describe('configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should load authentication and database configuration', () => {
        process.env.DATABASE_URL =
            'postgresql://example';
        process.env.JWT_SECRET =
            'test-secret-at-least-32-characters-long';
        process.env.JWT_EXPIRES_IN_SECONDS =
            '7200';

        expect(configuration()).toEqual({
            DATABASE_URL:
                'postgresql://example',
            JWT_SECRET:
                'test-secret-at-least-32-characters-long',
            JWT_EXPIRES_IN_SECONDS: 7200,
        });
    });

    it('should default JWT expiry to 28800 seconds', () => {
        process.env.DATABASE_URL =
            'postgresql://example';
        process.env.JWT_SECRET =
            'test-secret-at-least-32-characters-long';

        delete process.env.JWT_EXPIRES_IN_SECONDS;

        expect(
            configuration()
                .JWT_EXPIRES_IN_SECONDS,
        ).toBe(28800);
    });
});