import { defineProject } from 'vitest/config';

/** Vitest project for this package; also picked up by the root configuration's project list. */
export default defineProject({
  test: {
    name: '@spotless/calibration',
    include: ['src/**/*.test.ts', 'anchors/src/**/*.test.ts'],
    // The evaluator's tests run the wash simulation: one exposure of a small load and some
    // tens of replays, a minute on a busy machine.
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
