/**
 * Writes a saved standard load as the wash simulation's JSON input (`WashDescription` of
 * `@spotless/sim-core`, what `spotless-wash` reads) to standard output.
 *
 *   pnpm --filter @spotless/loader exec tsx scripts/export-wash.ts loads/iec-13-careful.json \
 *        [--tier fast|official] [--sim-seed 1] > iec-13-careful.wash.json
 *
 * What the description cannot carry (arms the load holds still) is printed to standard error.
 */

import { readFileSync } from 'node:fs';
import type { StandardLoad } from '../src/standard-loads.ts';
import { washDescriptionOf } from '../src/wash-export.ts';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
if (file === undefined) {
  console.error('usage: export-wash.ts <load.json> [--tier fast|official] [--sim-seed n]');
  process.exit(2);
}
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
const { description, notes } = washDescriptionOf(load, {
  tier: option('--tier') === 'official' ? 'official' : 'fast',
  simSeed: Number(option('--sim-seed') ?? 1),
});
console.log(JSON.stringify(description, null, 1));
if (Object.keys(notes.stalledArms).length > 0) {
  console.error(`stalled arms (degrees): ${JSON.stringify(notes.stalledArms)}`);
}
if (notes.configDiffersBeyondHeights) {
  console.error(
    `the load was frozen with rows, shelves or the cutlery basket moved from the machine's default (${notes.shelvesMoved.join(', ') || 'rows or cutlery basket'}): the description carries the whole configuration as machineConfig`,
  );
}
