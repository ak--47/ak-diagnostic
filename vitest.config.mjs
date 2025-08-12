import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test files pattern
    include: ['test/**/*.test.{js,mjs,ts}'],

    // Standard exclusions
    exclude: ['node_modules/**', 'dist/**'],

    // Test environment
    environment: 'node',

    // Test timeout for async operations
    testTimeout: 10000,

    // Global test setup
    globals: false,

    // Coverage settings
    coverage: {
      provider: 'v8',
      include: ['index.js', 'index.mjs'],
      exclude: ['test/**', 'examples/**'],
      reporter: ['text', 'html'],
      all: true
    },

    // Reporter configuration
    reporter: ['verbose']
  }
});
