import { validateEnvironment } from './env.validation';
describe('WMS central-auth configuration', () => {
  it('does not require a local JWT secret', () => {
    expect(
      validateEnvironment({ DATABASE_URL: 'postgresql://localhost/test' }),
    ).toEqual({ DATABASE_URL: 'postgresql://localhost/test' });
  });
  it.each([undefined, '', 42])(
    'rejects invalid DB configuration %s',
    (DATABASE_URL) => {
      expect(() => validateEnvironment({ DATABASE_URL })).toThrow(
        'DATABASE_URL',
      );
    },
  );
  it('rejects a non-HTTP introspection origin', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost/test',
        AUTH_SERVICE_URL: 'file:///tmp/token',
      }),
    ).toThrow('AUTH_SERVICE_URL');
  });
  it('validates the independent FDS service credential', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost/test',
        FDS_WKMS_SERVICE_TOKEN: 'short',
      }),
    ).toThrow('FDS_WKMS_SERVICE_TOKEN');
  });
});
