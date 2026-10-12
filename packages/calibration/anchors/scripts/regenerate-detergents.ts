/**
 * Writes every detergent set of `packages/calibration/detergents/` again against the current
 * registry: the overrides and the provenance are kept, the definitions and hashes stored in
 * the file are those of the registry as it is now. A detergent set is a composition from desk
 * research, not a fit, so nothing in it depends on the registry beyond the keys it names; a
 * key the registry no longer holds, or a value outside its range, stops the script.
 *
 *   cd packages/calibration && pnpm exec tsx anchors/scripts/regenerate-detergents.ts
 *
 * `--set key=value` changes one value of every file on the way (with `--note` appended to the
 * provenance note): how the protease level of the owner's capsule was put on the basis of
 * `OWNER_CAPSULE` (`src/anchored.ts`).
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWashParams, washRegistry, type ParamValue } from '@spotless/sim-core';
import { readParamSet } from '@spotless/sim-params';
import { ANCHORS_DIR } from '../src/scenario.ts';
import { readOverrides } from '../src/sets.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const changes: Record<string, ParamValue> = {};
for (const part of (option('--set') ?? '').split(',').filter((s) => s !== '')) {
  const at = part.indexOf('=');
  changes[part.slice(0, at)] = Number(part.slice(at + 1));
}
const note = option('--note');

const dir = join(ANCHORS_DIR, '..', 'detergents');
for (const file of readdirSync(dir).sort()) {
  if (!file.endsWith('.json') || file.endsWith('.notes.json')) continue;
  const path = join(dir, file);
  const before = JSON.parse(readFileSync(path, 'utf8')) as {
    provenance: { name: string; origin: 'manual'; note: string; createdAt: string };
  };
  const overrides = { ...readOverrides(path, true), ...changes };
  const set = createWashParams(overrides, {
    ...before.provenance,
    note:
      note === undefined || before.provenance.note.includes(note)
        ? before.provenance.note
        : `${before.provenance.note} ${note}`,
  });
  const document = set.toJSON();
  const back = readParamSet(washRegistry(), JSON.parse(JSON.stringify(document)) as unknown);
  if (!back.ok) throw new Error(`${file} does not read back: ${JSON.stringify(back.error)}`);
  writeFileSync(path, `${JSON.stringify(document, null, 1)}\n`);
  console.log(
    `${file}: ${Object.keys(overrides).length} overrides, written against the current registry`,
  );
}
