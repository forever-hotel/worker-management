import { validateEnvironment } from './env.validation';

const VALID_SECRET =
    'this-is-a-valid-test-secret-with-more-than-32-characters';

describe('validateEnvironment', () => {
    it('should return valid configuration', () => {
        const config = {
            DATABASE_URL: 'postgresql://localhost:5432/wkms',
            JWT_SECRET: VALID_SECRET,
            JWT_EXPIRES_IN_SECONDS: '28800',
        };

        expect(validateEnvironment(config)).toEqual({
            DATABASE_URL: 'postgresql://localhost:5432/wkms',
            JWT_SECRET: VALID_SECRET,
            JWT_EXPIRES_IN_SECONDS: 28800,
        });
    });

    it('should use the default JWT expiry when it is not provided', () => {
        const config = {
            DATABASE_URL: 'postgresql://localhost:5432/wkms',
            JWT_SECRET: VALID_SECRET,
        };

        expect(validateEnvironment(config)).toEqual({
            DATABASE_URL: 'postgresql://localhost:5432/wkms',
            JWT_SECRET: VALID_SECRET,
            JWT_EXPIRES_IN_SECONDS: 28800,
        });
    });

    it('should reject a missing DATABASE_URL', () => {
        expect(() =>
            validateEnvironment({
                JWT_SECRET: VALID_SECRET,
            }),
        ).toThrow(
            'DATABASE_URL environment variable is not configured',
        );
    });

    it('should reject an empty DATABASE_URL', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL: '   ',
                JWT_SECRET: VALID_SECRET,
            }),
        ).toThrow(
            'DATABASE_URL environment variable is not configured',
        );
    });

    it('should reject a non-string DATABASE_URL', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL: 123,
                JWT_SECRET: VALID_SECRET,
            }),
        ).toThrow(
            'DATABASE_URL environment variable is not configured',
        );
    });

    it('should reject a missing JWT_SECRET', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL: 'postgresql://localhost:5432/wkms',
            }),
        ).toThrow(
            'JWT_SECRET must be configured with at least 32 characters',
        );
    });

    it('should reject a short JWT_SECRET', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL: 'postgresql://localhost:5432/wkms',
                JWT_SECRET: 'too-short',
            }),
        ).toThrow(
            'JWT_SECRET must be configured with at least 32 characters',
        );
    });

    it('should reject an invalid JWT expiry', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL: 'postgresql://localhost:5432/wkms',
                JWT_SECRET: VALID_SECRET,
                JWT_EXPIRES_IN_SECONDS: 'invalid',
            }),
        ).toThrow(
            'JWT_EXPIRES_IN_SECONDS must be a positive integer',
        );
    });

    it('should reject a non-positive JWT expiry', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL: 'postgresql://localhost:5432/wkms',
                JWT_SECRET: VALID_SECRET,
                JWT_EXPIRES_IN_SECONDS: '0',
            }),
        ).toThrow(
            'JWT_EXPIRES_IN_SECONDS must be a positive integer',
        );
    });
});