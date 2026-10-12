/**
 * Wash runners for this package's tests, loaded by the wash worker process by module path.
 * None of them simulates anything. Not exported from the package entry point.
 */

import type { WashRunner } from '@spotless/session';
import { placeholderWashRunner } from '@spotless/session';

function pause(ms: number): Promise<void> {
  return new Promise<void>((next) => {
    setTimeout(next, ms);
  });
}

/** Reports progress in ten steps, 30 ms apart, then answers like the placeholder. */
export const steppedRunner: WashRunner = async (manifest, onProgress) => {
  for (let step = 0; step <= 10; step++) {
    onProgress(step / 10);
    await pause(30);
  }
  return placeholderWashRunner(manifest, () => undefined);
};

/** Fails the way a simulation that hits a fault would: by throwing. */
export const throwingRunner: WashRunner = async (_manifest, onProgress) => {
  onProgress(0.25);
  await pause(10);
  throw new Error('the simulated GPU was lost');
};

/** Takes the whole process down, as a crash of native code would. */
export const crashingRunner: WashRunner = async () => {
  await pause(10);
  process.exit(3);
};

/** Answers with something that is not a report of the load. */
export const emptyReportRunner: WashRunner = () =>
  Promise.resolve({ score: { points: 0 } } as never);
