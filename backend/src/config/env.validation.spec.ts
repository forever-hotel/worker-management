import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
    it('should return the configuration when DATABASE_URL is valid', () => {
        const config = {
            DATABASE_URL: 'postgresql://localhost:5432/wkms',
        };

        expect(validateEnvironment(config)).toBe(config);
    });

    it('should reject a missing DATABASE_URL', () => {
        expect(() => validateEnvironment({})).toThrow(
            'DATABASE_URL environment variable is not configured',
        );
    });

    it('should reject an empty DATABASE_URL', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL: '   ',
            }),
        ).toThrow(
            'DATABASE_URL environment variable is not configured',
        );
    });

    it('should reject a non-string DATABASE_URL', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL: 123,
            }),
        ).toThrow(
            'DATABASE_URL environment variable is not configured',
        );
    });
});