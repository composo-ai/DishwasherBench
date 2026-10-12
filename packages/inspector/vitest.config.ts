import { defineProject } from 'vitest/config';

/** Vitest project for this package; also picked up by the root configuration's project list. */
export default defineProject({
  test: {
    name: '@spotless/inspector',
    include: ['src/**/*.test.ts'],
  },
});
