import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Vitest 4 removed `poolOptions.threads.singleThread`.
    // Disabling file parallelism provides the same database-safe behavior.
    fileParallelism: false,
    maxWorkers: 1,
  },
});
