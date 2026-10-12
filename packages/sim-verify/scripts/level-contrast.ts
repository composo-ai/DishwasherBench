/**
 * Does careful loading beat careless loading on every starter level, with the parameters the
 * game washes with? (Review of 10 October 2026: on the tutorial both scripted policies scored
 * the same points with the same items dirty.)
 *
 *   pnpm --filter @spotless/sim-verify exec tsx scripts/level-contrast.ts --from <dir>
 *        [--out levels/level-contrast.json]
 *
 * `<dir>` holds the results of the demonstration washes of the loader's settled loads
 * `<level>-careful` and `<level>-careless` (`scripts/demo-washes.ts <names> --out <dir>` with
 * the game's parameter set, detergent and dose). For every level with both, the points of the
 * items that came out clean are added up per policy (an item left on the counter scores
 * nothing), with the items at the edge of clean counted apart, and the report is written with
 * what identifies the washes: the simulator, the sets, the detergent, the fingerprint of the
 * source and the hash of the final state of each load. `src/level-contrast.test.ts` reads it.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LevelContrastReport, LevelContrastRow } from '../src/level-contrast.ts';

const here = dirname(fileURLToPath(import.meta.url));
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const from = option('--from');
if (from === undefined) {
  console.error('level-contrast: --from <directory of demonstration washes> is needed');
  process.exit(2);
}
const results = fromOrigin(from);
const out = fromOrigin(option('--out') ?? join(here, '..', 'levels', 'level-contrast.json'));
const loads = join(here, '..', '..', 'loader', 'loads');

interface LoadFile {
  readonly level: {
    readonly id: string;
    readonly programmeId: string;
    readonly items: readonly { readonly id: string; readonly points: number }[];
  };
  readonly placed: readonly string[];
  readonly final_state_hash: string;
  readonly mistakes: readonly { readonly kind: string }[];
}
interface ResultFile {
  readonly provenance: {
    readonly simVersion: string;
    readonly tier: string;
    readonly sourceFingerprint: string;
    readonly exposureSource: string;
    readonly paramSets: readonly { name: string; stale: boolean; overridesHash: string }[];
    readonly detergent: { readonly name: string; readonly dose_g: number };
  };
  readonly items: readonly {
    readonly itemId: string;
    readonly clean: boolean;
    readonly band?: {
      readonly decided: boolean;
      readonly strictClean: boolean;
      readonly lenientClean: boolean;
    };
  }[];
}

const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const names = readdirSync(results)
  .filter((file) => file.endsWith('-careful.result.json'))
  .map((file) => file.slice(0, -'-careful.result.json'.length))
  .sort();
const rows: LevelContrastRow[] = [];
let identity: ResultFile['provenance'] | undefined;
for (const level of names) {
  const side = (policy: 'careful' | 'careless') => {
    const load = read<LoadFile>(join(loads, `${level}-${policy}.json`));
    let result: ResultFile;
    try {
      result = read<ResultFile>(join(results, `${level}-${policy}.result.json`));
    } catch {
      return undefined;
    }
    identity ??= result.provenance;
    const byId = new Map(result.items.map((item) => [item.itemId, item]));
    let points = 0;
    let strict = 0;
    let lenient = 0;
    let offered = 0;
    const dirty: string[] = [];
    const edge: string[] = [];
    for (const item of load.level.items) {
      offered += item.points;
      const washed = byId.get(item.id);
      if (washed === undefined) continue;
      if (washed.clean) points += item.points;
      else dirty.push(item.id);
      if (washed.band?.strictClean ?? washed.clean) strict += item.points;
      if (washed.band?.lenientClean ?? washed.clean) lenient += item.points;
      if (washed.band !== undefined && !washed.band.decided) edge.push(item.id);
    }
    return {
      points,
      pointsStrict: strict,
      pointsLenient: lenient,
      offered,
      placed: load.placed.length,
      items: load.level.items.length,
      dirty: dirty.sort(),
      edge: edge.sort(),
      mistakes: load.mistakes.length,
      loadState: load.final_state_hash,
      programme: load.level.programmeId,
    };
  };
  const careful = side('careful');
  const careless = side('careless');
  if (careful === undefined || careless === undefined) continue;
  rows.push({ level, careful, careless });
}
if (identity === undefined || rows.length === 0) {
  console.error(
    `level-contrast: no pair of <level>-careful and <level>-careless results in ${results}`,
  );
  process.exit(1);
}
const setHash = createHash('sha256')
  .update(JSON.stringify(identity.paramSets.map((set) => [set.name, set.overridesHash])))
  .digest('hex');
const report: LevelContrastReport = {
  suite: 'spotless-level-contrast',
  simVersion: identity.simVersion,
  tier: identity.tier,
  exposureSource: identity.exposureSource,
  sourceFingerprint: identity.sourceFingerprint,
  paramSets: identity.paramSets.map((set) => `${set.name}${set.stale ? ' (stale)' : ''}`),
  paramSetsHash: setHash,
  detergent: identity.detergent,
  rows,
};
writeFileSync(out, `${JSON.stringify(report, null, 1)}\n`);
for (const row of rows) {
  console.log(
    `${row.level}: careful ${row.careful.points} of ${row.careful.offered} points (${row.careful.dirty.length} dirty, ${row.careful.edge.length} at the edge), careless ${row.careless.points} (${row.careless.dirty.length} dirty of ${row.careless.placed} placed)${row.careful.points > row.careless.points ? '' : '  <-- NOT BEATEN'}`,
  );
}
console.log(out);
