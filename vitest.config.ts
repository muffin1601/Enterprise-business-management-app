import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Vitest config. The `@/*` alias mirrors tsconfig so tests import the same
 * modules as the app (e.g. `@/validations/auth`). Unit tests here are pure
 * (no DB/network). Integration tests against a test Supabase DB are a separate
 * project (see tests/integration/README) and run in CI with a service container.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    globals: true,
  },
})
