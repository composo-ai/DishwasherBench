import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The scenarios simulate tens of seconds of loading at 240 steps per second and measure true
 * overlaps along the way, so the default 5 s limit per test does not fit them.
 */
export default defineProject({
  test: {
    name: '@spotless/integration',
    include: ['src/**/*.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 120_000,
  },
});
