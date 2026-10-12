import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The tests play small loads through the session layer with real loading physics, so a test may
 * take some seconds.
 */
export default defineProject({
  test: {
    name: '@spotless/loader',
    include: ['src/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
