import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The tests run whole episodes on a real game server (loading physics, a wash job, a replay),
 * so a test may take tens of seconds on a busy machine.
 */
export default defineProject({
  test: {
    name: '@spotless/bench',
    include: ['src/**/*.test.ts'],
    testTimeout: 240_000,
    hookTimeout: 240_000,
  },
});
