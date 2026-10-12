import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The scenario tests simulate tens of seconds of loading at 240 steps per second, so the
 * default 5 s limit per test does not fit them.
 */
export default defineProject({
  test: {
    name: '@spotless/physics',
    include: ['src/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
