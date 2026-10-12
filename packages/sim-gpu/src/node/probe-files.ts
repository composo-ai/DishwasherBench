/**
 * Node-only: the probe records on disk, `packages/sim-gpu/probes/<stack>.json`
 * (docs/design/sim-core.md section M1, "Determinism probes": "its result hash recorded per
 * stack string in probes/<stack>.json"). One file per GPU stack (GPU, operating-system build,
 * bindings, runtime); after an operating-system or bindings update there is no file for the new
 * stack until `pnpm --filter @spotless/sim-gpu run record-probes` writes one (rule 13).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProbeRecord } from '../probes.ts';
import { gpuStackSlug, type GpuStack } from '../stack.ts';

/** The directory of the recorded probe files: `packages/sim-gpu/probes`. */
export const PROBES_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'probes');

/** Path of the probe file of a GPU stack. */
export function probeFilePath(stack: GpuStack, directory: string = PROBES_DIRECTORY): string {
  return join(directory, `${gpuStackSlug(stack)}.json`);
}

/** The recorded probes of a GPU stack, or null if that stack has not been recorded. */
export function readProbeRecord(
  stack: GpuStack,
  directory: string = PROBES_DIRECTORY,
): ProbeRecord | null {
  const path = probeFilePath(stack, directory);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as ProbeRecord;
}

/** Writes the probe file of the record's stack and returns its path. */
export function writeProbeRecord(
  record: ProbeRecord,
  directory: string = PROBES_DIRECTORY,
): string {
  mkdirSync(directory, { recursive: true });
  const path = probeFilePath(record.stack, directory);
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  return path;
}

/** Every recorded probe file, sorted by file name. */
export function readAllProbeRecords(directory: string = PROBES_DIRECTORY): ProbeRecord[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as ProbeRecord);
}
