/**
 * Writes an anchored set again against the current registry without fitting anything: the
 * overrides, the provenance and the water side it was fitted on are kept, the values that are
 * not searched (`MECHANISM_CORRECTIONS` of `src/anchored.ts`) are laid in, and the definitions
 * and hashes stored in the file are those of the registry as it is now. For a change of the
 * registry that does not change what a wash with the set computes (a default that the set now
 * states itself, a new parameter elsewhere). A change that does needs `fit.ts`.
 *
 * It refuses when the water side on disk is not the one the set records (`anchoredOn`): a set
 * fitted on other water code is not made current by writing it again (the review of 10 October
 * 2026 found exactly that done). When the sources changed without changing what a wash
 * computes, `revalidate.ts` shows it by washing the reference of the set again.
 *
 *   cd packages/calibration && pnpm exec tsx anchors/scripts/restamp.ts [<set name>]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWashParams, washRegistry } from '@spotless/sim-core';
import { waterSideIssues } from '@spotless/sim-core/node';
import { readParamSet, type ParamProvenance } from '@spotless/sim-params';
import { mechanismOverrides } from '../src/anchored.ts';
import { ANCHORS_DIR, CURRENT_ANCHORED } from '../src/scenario.ts';
import { readOverrides } from '../src/sets.ts';

const name = process.argv.slice(2).filter((a) => a !== '--')[0] ?? CURRENT_ANCHORED;
const file = join(ANCHORS_DIR, `${name}.json`);
const before = JSON.parse(readFileSync(file, 'utf8')) as {
  provenance: ParamProvenance;
  anchoredOn?: unknown;
  supersededBy?: unknown;
};
if (before.supersededBy !== undefined) {
  console.error(
    `${name}.json says another set replaced it (${JSON.stringify(before.supersededBy)}): it is not written again.`,
  );
  process.exit(1);
}
const water = waterSideIssues(before);
if (water.length > 0) {
  console.error(
    `${name}.json is not written again: ${water.map((issue) => issue.message).join('; ')}.\n` +
      'Fit it again (anchors/scripts/fit.ts), or, if only the sources changed and not what a wash computes, run anchors/scripts/revalidate.ts.',
  );
  process.exit(1);
}
const overrides = { ...readOverrides(file, true), ...mechanismOverrides() };
const document = {
  ...createWashParams(overrides, before.provenance).toJSON(),
  anchoredOn: before.anchoredOn,
};
const back = readParamSet(washRegistry(), JSON.parse(JSON.stringify(document)) as unknown);
if (!back.ok) throw new Error(`${name} does not read back: ${JSON.stringify(back.error)}`);
writeFileSync(file, `${JSON.stringify(document, null, 1)}\n`);
console.log(
  `${name}.json: ${Object.keys(overrides).length} overrides: ${JSON.stringify(overrides)}`,
);
