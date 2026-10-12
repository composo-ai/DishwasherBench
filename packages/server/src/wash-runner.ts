/**
 * Which wash the server runs: the wash simulation, through `simWashRunner` of
 * `@spotless/wash-runner`. The runner is loaded in the wash worker process, never in the
 * server's, which therefore starts and answers without the simulation.
 *
 * The version is part of the cache key of stored results and names the directory of the
 * exposure cache. It is the runner's own version followed by a fingerprint of the source of
 * everything a wash result depends on: the simulation packages, the inspector, the machine,
 * the catalogue, the geometry kernel, the shared mathematics and the runner. So a result
 * computed by other code is never served for a wash, whether or not anyone remembered to
 * raise a version number, and the simulation's own version constant is covered because it is
 * in that source. The packages are consumed as TypeScript source, so the source that is
 * fingerprinted is the code that runs.
 *
 * Which parameters a wash is run with (the named parameter sets and the detergent,
 * `@spotless/wash-runner/contract`) is not part of the version: the queue keys a stored result
 * by the choice and by the bytes of the files it names.
 */

import { simulationFingerprint, WASH_RUNNER_VERSION } from '@spotless/wash-runner/contract';
import type { WashRunnerModule } from './types.ts';

// The fingerprint is the simulation's own (`@spotless/sim-core/fingerprint`, which the runner's
// contract passes on and which loads nothing of the simulation): the same mechanism keys the
// simulation's exposure cache by the sources of the exposure side alone.
export { simulationFingerprint };

/** How long a computed fingerprint is taken to hold, milliseconds. */
const FINGERPRINT_TTL_MS = 3000;

let fingerprint: { readonly value: string; readonly at: number } | undefined;

/**
 * The wash runner of the server: the wash simulation. `version` is computed when it is read
 * (it reads some hundreds of source files, some tens of milliseconds) and again when it is
 * read more than a few seconds later: every wash loads the simulation afresh in its own
 * process, so a server that outlives a change of the source must key the next wash by the new
 * source. The wash worker reports the version it ran with, and the queue keeps a result only
 * when that is the version it was keyed by.
 */
export const WASH_RUNNER: WashRunnerModule = {
  module: '@spotless/wash-runner',
  exportName: 'simWashRunner',
  get version(): string {
    const now = Date.now();
    if (fingerprint === undefined || now - fingerprint.at > FINGERPRINT_TTL_MS) {
      fingerprint = { value: simulationFingerprint(), at: now };
    }
    return `${WASH_RUNNER_VERSION}+src.${fingerprint.value.slice(0, 16)}`;
  },
};
