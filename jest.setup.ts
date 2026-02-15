Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
});

if (!global.fetch) {
  global.fetch = jest.fn() as unknown as typeof fetch;
}
