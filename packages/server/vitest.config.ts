import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The tests play real sessions through the server and run washes in a worker process, so a
 * test may take a few seconds.
 */
export default defineProject({
  test: {
    name: '@spotless/server',
    include: ['src/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
