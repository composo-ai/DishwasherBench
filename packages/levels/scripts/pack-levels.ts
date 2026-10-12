/**
 * Packs every level of the game (the starter levels and the generated ones) with the careful
 * loading policy, so that "offers clearly more than fits" rests on the loading physics and not
 * on the plan-area estimate of `capacity.ts`.
 *
 *   pnpm --filter @spotless/levels exec tsx scripts/pack-levels.ts            every level
 *   pnpm --filter @spotless/levels exec tsx scripts/pack-levels.ts breakfast  the named ones
 *   ... pack-levels.ts --json                                                 one JSON line per level
 *   ... pack-levels.ts --from-loads                                           read the saved careful loads
 *
 * With `--from-loads` nothing is packed: the table is read from the saved careful reference
 * loads of the loader (`packages/loader/loads/<level>-careful.json`), which are this same
 * packing kept on disk (the same policy, seed and order of items), and a load that was made
 * for another definition of its level is reported as stale and fails the run.
 *
 * For each level a fresh session is played by `runPolicy(session, { policy: 'careful' })` of
 * `@spotless/loader`: the policy that loads the way the manufacturer's scheme and the dossiers
 * say, lets nothing rest on another item, and takes out what a move of the baskets throws or
 * what stops an arm, the tablet or the door. What it places is what a careful person gets
 * into the machine; what it leaves on the counter is the "more than fits". A level passes when
 * it leaves at least {@link MIN_LEFT_SHARE} of its points on the counter (the tutorial, which
 * is meant to fit, is exempt: {@link MEANT_TO_FIT}).
 *
 * The loader stands above this package in the workspace (it depends on `@spotless/session`,
 * which depends on `@spotless/levels`), so it and the session are imported here by path, from
 * source, as the machine package does for its physics experiments: naming them as dependencies
 * would close a cycle that `sim-verify`'s dependency test forbids. Scripts only; nothing in
 * `src/` imports them.
 *
 * Takes one to ten minutes per level on the owner's machine. Deterministic: the same level
 * gives the same table, and the same load as the loader's saved `<level>-careful`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { referenceItems, referenceSeed, runPolicy } from '../../loader/src/index.ts';
import type { StandardLoad } from '../../loader/src/index.ts';
import { createSession } from '../../session/src/index.ts';
import { OVERFULL_RATIO, allLevels, capacityEstimate } from '../src/index.ts';
import type { Level } from '../src/index.ts';

/** Levels that are meant to fit whole: they teach the interface, not the choosing. */
export const MEANT_TO_FIT: readonly string[] = ['tutorial'];

/** Share of a level's points a careful load must leave on the counter. */
export const MIN_LEFT_SHARE = 0.15;

interface Packed {
  readonly level: string;
  readonly items: number;
  readonly placed: number;
  readonly points: number;
  readonly points_placed: number;
  readonly left_share: number;
  readonly by_frame: { readonly [frame: string]: number };
  readonly estimate_ratio: number;
  readonly left_out_kinds: { readonly [kind: string]: number };
  readonly check_passes: boolean;
  readonly seconds: number;
}

async function pack(level: Level): Promise<Packed> {
  const started = performance.now();
  const session = await createSession({ level });
  try {
    // As the saved standard loads `<level>-careful` of the loader are made: the level's seed
    // (the careful policy makes no random choice) and the items in the order of the level.
    const result = runPolicy(session, {
      policy: 'careful',
      seed: referenceSeed(level, 1),
      items: referenceItems(level),
    });
    const placed = new Set(result.placed);
    const points = level.items.reduce((sum, item) => sum + item.points, 0);
    const pointsPlaced = level.items
      .filter((item) => placed.has(item.id))
      .reduce((sum, item) => sum + item.points, 0);
    const kinds: { [kind: string]: number } = {};
    for (const item of level.items) {
      if (!placed.has(item.id)) kinds[item.itemType] = (kinds[item.itemType] ?? 0) + 1;
    }
    const check = result.check;
    return {
      level: level.id,
      items: level.items.length,
      placed: result.placed.length,
      points,
      points_placed: pointsPlaced,
      left_share: Math.round((1 - pointsPlaced / points) * 1000) / 1000,
      by_frame: result.counts.placedByBasket,
      estimate_ratio: Math.round(capacityEstimate(level).ratio * 100) / 100,
      left_out_kinds: kinds,
      check_passes:
        check !== null &&
        check.door_closes &&
        check.dispenser_opens &&
        check.tablet_path_clear &&
        check.spray_arms.every((arm) => arm.full_rotation) &&
        check.protruding.length === 0,
      seconds: Math.round((performance.now() - started) / 100) / 10,
    };
  } finally {
    session.dispose();
  }
}

/** The packing of a level as its saved careful reference load has it; null when there is none. */
function fromLoad(level: Level): Packed | 'stale' | null {
  const file = fileURLToPath(
    new URL(`../../loader/loads/${level.id}-careful.json`, import.meta.url),
  );
  if (!existsSync(file)) return null;
  const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
  if (JSON.stringify(load.level) !== JSON.stringify(level)) return 'stale';
  const placed = new Set(load.placed);
  const points = level.items.reduce((sum, item) => sum + item.points, 0);
  const pointsPlaced = level.items
    .filter((item) => placed.has(item.id))
    .reduce((sum, item) => sum + item.points, 0);
  const kinds: { [kind: string]: number } = {};
  for (const item of level.items) {
    if (!placed.has(item.id)) kinds[item.itemType] = (kinds[item.itemType] ?? 0) + 1;
  }
  return {
    level: level.id,
    items: level.items.length,
    placed: load.placed.length,
    points,
    points_placed: pointsPlaced,
    left_share: Math.round((1 - pointsPlaced / points) * 1000) / 1000,
    by_frame: load.numbers.by_basket,
    estimate_ratio: Math.round(capacityEstimate(level).ratio * 100) / 100,
    left_out_kinds: kinds,
    check_passes: load.numbers.check_passes,
    seconds: Math.round(load.measured.totalMs / 100) / 10,
  };
}

const args = process.argv.slice(2);
const json = args.includes('--json');
const saved = args.includes('--from-loads');
const wanted = args.filter((a) => !a.startsWith('--'));
const levels = allLevels().filter((level) => wanted.length === 0 || wanted.includes(level.id));
if (levels.length === 0) {
  console.error(`no level among: ${wanted.join(', ')}`);
  process.exit(2);
}
let failed = false;
if (!json) {
  console.log(
    'level | items | placed | points placed / offered | left on the counter | by frame | estimate ratio | check | seconds',
  );
}
for (const level of levels) {
  const read = saved ? fromLoad(level) : null;
  if (saved && (read === null || read === 'stale')) {
    console.error(
      read === null
        ? `${level.id}: no saved careful load`
        : `${level.id}: its saved careful load was made for another definition of the level: generate it again`,
    );
    failed = true;
    continue;
  }
  const row = read !== null && read !== 'stale' ? read : await pack(level);
  const meant = MEANT_TO_FIT.includes(level.id);
  const ok = meant || row.left_share >= MIN_LEFT_SHARE;
  if (!ok) failed = true;
  if (json) {
    console.log(JSON.stringify({ ...row, offers_more_than_fits: ok }));
    continue;
  }
  const frames = Object.keys(row.by_frame)
    .sort()
    .map((frame) => `${frame.replace('_rack', '').replace('_basket', '')} ${row.by_frame[frame]}`)
    .join(', ');
  console.log(
    `${row.level} | ${row.items} | ${row.placed} | ${row.points_placed} / ${row.points} | ${(row.left_share * 100).toFixed(1)} % of the points${meant ? ' (meant to fit)' : ok ? '' : ` (UNDER ${MIN_LEFT_SHARE * 100} %)`} | ${frames} | ${row.estimate_ratio}${row.estimate_ratio >= OVERFULL_RATIO || meant ? '' : " (under the estimate's mark)"} | ${row.check_passes ? 'passes' : 'findings'} | ${row.seconds}`,
  );
  const left = Object.entries(row.left_out_kinds)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => `${n} ${kind}`)
    .join(', ');
  console.log(`  left on the counter: ${left || 'nothing'}`);
}
if (failed) {
  console.error(
    `a level leaves less than ${MIN_LEFT_SHARE * 100} % of its points on the counter when loaded carefully: it does not offer clearly more than fits`,
  );
  process.exit(1);
}
