export default () => ({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL ?? 'http://localhost:8080',
});
