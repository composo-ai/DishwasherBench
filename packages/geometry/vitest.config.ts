import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 *
 * The timeout is raised because a few tests compare against brute-force references (dense
 * sampling, adaptive integration) that take one to three seconds on an idle machine and longer
 * when the whole workspace is under test.
 */
export default defineProject({
  test: {
    name: '@spotless/geometry',
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
