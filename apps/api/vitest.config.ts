import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Each test file runs in isolation — critical for DB tests
    pool: 'forks',
    poolOptions: { forks: { singleFork: false } },
    setupFiles: ['src/test/setup.ts'],
    // Only run __tests__ directories
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/modules/**/*.ts'],
      exclude: ['src/modules/**/__tests__/**', 'src/modules/**/provider/mock*'],
    },
  },
})
