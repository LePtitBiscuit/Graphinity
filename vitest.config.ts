import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts, whose root points at the viewer.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
})
