import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The timeout is long because the root run executes every package at once, and the tests that
 * trace whole revolutions of a jet or fly tens of thousands of droplets on the f64 reference
 * tracer (a second or two each alone) take several times that there.
 */
export default defineProject({
  test: {
    name: '@spotless/sim-film',
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
