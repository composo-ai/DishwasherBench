import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * Most tests are arithmetic on manifests and results; one runs the real simulation on a small
 * load at the fast tier, which takes some tens of seconds on a busy machine.
 */
export default defineProject({
  test: {
    name: '@spotless/wash-runner',
    include: ['src/**/*.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
