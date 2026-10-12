import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The tests run real loading physics on the owner's machine, so a test may take a few seconds.
 */
export default defineProject({
  test: {
    name: '@spotless/session',
    include: ['src/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
