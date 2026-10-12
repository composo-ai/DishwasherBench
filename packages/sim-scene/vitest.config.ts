import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The timeout is longer than the default because the root run executes every package at once:
 * tests that take half a second alone (the links of a 2 mm atlas, the 10^5 rays of the GPU
 * comparison) then take several.
 */
export default defineProject({
  test: {
    name: '@spotless/sim-scene',
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
