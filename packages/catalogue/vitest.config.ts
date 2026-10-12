import { defineProject } from 'vitest/config';

/**
 * Vitest project for this package; also picked up by the root configuration's project list.
 * Validating the whole catalogue (joints, double-counted mass, settled poses of every item) and
 * flooding vessels for their capacity take a few seconds each on a free machine and more when
 * the whole repository is tested at once, so the default 5 s limit per test does not fit.
 */
export default defineProject({
  test: {
    name: '@spotless/catalogue',
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
