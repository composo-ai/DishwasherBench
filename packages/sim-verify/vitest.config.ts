import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The timeouts are long because the end-to-end tests run whole washes of the owner's machine
 * (a few seconds each alone, several times that when the root run executes every package at
 * once).
 */
export default defineProject({
  test: {
    name: '@spotless/sim-verify',
    include: ['src/**/*.test.ts'],
    testTimeout: 240_000,
    hookTimeout: 900_000,
  },
});
