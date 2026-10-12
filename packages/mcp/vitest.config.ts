import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * The tests play real sessions on a real game server through the tools, so a test may take
 * several seconds, more on a busy machine.
 */
export default defineProject({
  test: {
    name: '@spotless/mcp',
    include: ['src/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
