Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
});

Object.assign(globalThis as Record<string, unknown>, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

if (!global.fetch) {
  global.fetch = jest.fn() as unknown as typeof fetch;
}
