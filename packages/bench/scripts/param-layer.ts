/**
 * Writes a parameter layer for a study: a few values laid over the machine's default set.
 *
 * A calibrated set file vouches for its own values by hashes, so a copy of it with a value
 * changed reads as stale. A study that wants "the default set, but with this soak duty" lays a
 * second file over it instead: a set of only the changed values, written against the current
 * registry (`createWashParams(...).toJSON()`, as the detergent files are made). The wash runner
 * lays the files over the registry defaults in order.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MACHINE_WASH_DEFAULTS, washParamFilesFor } from '@spotless/wash-runner/contract';
import type { WashParamChoice } from '@spotless/wash-runner/contract';
import { createWashParams } from '../../sim-core/src/index.ts';

/**
 * The machine's default parameters with `overrides` laid over them, as a choice the wash
 * runner takes; the layer is written to `file`. Throws for a machine without a default set and
 * for a key or value the registry does not accept.
 */
export function defaultsWith(
  machineId: string,
  name: string,
  what: string,
  overrides: Readonly<Record<string, number>>,
  file: string,
): WashParamChoice {
  const base = MACHINE_WASH_DEFAULTS[machineId];
  const files = washParamFilesFor(machineId, 'machine-default');
  if (base === undefined || files === null) {
    throw new Error(`the machine ${machineId} has no default parameter set to vary`);
  }
  const layer = createWashParams(overrides, {
    name,
    origin: 'manual',
    note: `study layer over the default set of ${machineId}: ${what}. Not a calibrated set.`,
  });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(layer.toJSON(), null, 1)}\n`);
  return { ...base, paramSets: [...files.paramSets, file] };
}
