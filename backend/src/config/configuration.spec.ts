import configuration from './configuration';
it('reads a gateway origin, not a local staff signing key', () => {
  const prior = process.env.AUTH_SERVICE_URL;
  process.env.AUTH_SERVICE_URL = 'http://gateway:8080';
  expect(configuration().AUTH_SERVICE_URL).toBe('http://gateway:8080');
  expect(configuration()).not.toHaveProperty('JWT_SECRET');
  if (prior === undefined) delete process.env.AUTH_SERVICE_URL;
  else process.env.AUTH_SERVICE_URL = prior;
});
