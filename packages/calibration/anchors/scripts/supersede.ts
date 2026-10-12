/**
 * Marks an anchored set and its layers (`<name>.json`, `<name>.*.json`) as replaced by another
 * set, so that no wash reads them as current again whatever code is on disk.
 *
 *   cd packages/calibration
 *   pnpm exec tsx anchors/scripts/supersede.ts <name> --by <name> --why "<a sentence>"
 *        [--on 2026-10-11]
 *
 * A calibrated set is refused by every wash when the code on disk is not the code it was
 * fitted on (`anchoredOn`, `readParamLayerFile` of `@spotless/sim-core/node`). That says
 * nothing about a set a measurement has contradicted: on 11 October 2026 `anchored-v5`, with
 * the soak the owner's first wash contradicts, was current on the water side and went on
 * loading. The mark written here (`supersededBy`: the set that replaced it, why, and when)
 * makes the same guard refuse the file for that reason alone. A caller who wants an old result
 * again accepts stale sets knowingly, and the result of the wash then records the set as stale.
 *
 * Nothing else in the file is touched: its values, its hashes and the water side it records
 * stay as they were made. `revalidate.ts` and `restamp.ts` refuse a set that carries the mark.
 * The sets that are marked are listed, with the same sentence, in `SUPERSEDED_ANCHORED` of
 * `src/scenario.ts`, and a test holds the files to that list.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANCHORS_DIR, CURRENT_ANCHORED } from '../src/scenario.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const name = args[0];
const by = option('--by');
const why = option('--why');
const on = option('--on') ?? new Date().toISOString().slice(0, 'yyyy-mm-dd'.length);
if (name === undefined || name.startsWith('--') || by === undefined || why === undefined) {
  console.error('usage: supersede.ts <name> --by <name> --why "<a sentence>" [--on yyyy-mm-dd]');
  process.exit(2);
}
if (name === CURRENT_ANCHORED) {
  console.error(
    `${name} is the current anchored set (CURRENT_ANCHORED of anchors/src/scenario.ts): name its replacement there first.`,
  );
  process.exit(1);
}
const files = readdirSync(ANCHORS_DIR)
  .filter((f) => f === `${name}.json` || (f.startsWith(`${name}.`) && f.endsWith('.json')))
  .sort();
if (files.length === 0) {
  console.error(`no file of ${name} in ${ANCHORS_DIR}`);
  process.exit(1);
}
for (const file of files) {
  const path = join(ANCHORS_DIR, file);
  const document = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const { supersededBy: _before, ...rest } = document;
  writeFileSync(
    path,
    `${JSON.stringify({ ...rest, supersededBy: { set: by, why, on } }, null, 1)}\n`,
  );
  console.log(`${file}: superseded by ${by} on ${on}`);
}
