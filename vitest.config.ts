import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration: every workspace package is one project. A package may add its own
 * `vitest.config.ts` (for example to set a longer timeout); packages without one run with the
 * Vitest defaults, which pick up `src/**\/*.test.ts`.
 */
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    // Several engineers (and agents) run the whole suite at once on one laptop; an uncapped run takes
    // every core and pushes the others' tests past their timeouts.
    maxWorkers: 6,
  },
});
