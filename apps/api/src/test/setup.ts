/**
 * Global test setup.
 * Sets required env vars before any module imports so config.ts parses successfully.
 * Tests use an in-memory mock DB — no real PostgreSQL needed.
 */
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.HASHNUT_MOCK = 'true'
process.env.PROVIDER = 'mock'
