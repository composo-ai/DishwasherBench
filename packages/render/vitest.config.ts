import { defineProject } from 'vitest/config';

/** Vitest project for this package; also picked up by the root configuration's project list. */
export default defineProject({
  test: {
    name: '@spotless/render',
    include: ['src/**/*.test.ts'],
  },
});
