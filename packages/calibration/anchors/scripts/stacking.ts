/**
 * Stacking under a parameter set: A/B pairs from the phenomena checklist
 * (docs/research/standards.md section 9) on the settled standard load, and the careful against
 * the careless load.
 *
 *   pnpm --filter @spotless/calibration exec tsx anchors/scripts/stacking.ts
 *        [--params anchors/anchored-v1.json] [--set key=value,...]
 *        [--only name,name] [--out anchors/out/stacking] [--exposure-only]
 *        [--level-seed n] [--sim-seed n]
 *
 * Every wash is the settled careful IEC load with the working soils (`src/scenario.ts`) at the
 * official tier, changed in one respect; the B side of a pair is compared with the same items
 * in the unchanged load:
 *
 *   careful        the load as the loading physics left it (A of every pair)
 *   turned         every second dinner, dessert and melamine plate and saucer turned round in
 *                  its slot, every second soup plate pushed 6 mm behind the one before it (the
 *                  poses of the demonstration `iec-13-careful-badly`); vessels as in careful
 *   upright        one mug, one cup and one glass mouth up where they stood mouth down
 *   blocked        the dispenser kept shut (no new exposure)
 *   stalled        the lower arm held at 62 degrees
 *   forks_flipped  every fork turned end for end in its place in the cutlery basket
 *   half           the settled half load (54 items, well spaced), same soils
 *   careless       the loader's own careless settled load of the same offer (92 items)
 *
 * `--exposure-only` computes and caches the exposure of every load and prints nothing else.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { instantiate } from '@spotless/catalogue';
import { quatFromAxisAngle, quatMul, quatRotate, type Quat } from '@spotless/core';
import {
  washInputFromDescription,
  type ItemDescription,
  type ItemWashResult,
  type ParamValue,
  type WashDescription,
  type WashResult,
} from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import { STANDARD_COMPOSITION } from '../src/literature.ts';
import { classMeans } from '../src/objective.ts';
import { readLoad, stdEu13Description } from '../src/scenario.ts';
import { anchorCacheDir, waterSide, waterTag } from '../src/water.ts';
import { readOverrides } from '../src/sets.ts';
import { ITEM_CLASSES, itemClassOf, summariseWash } from '../src/summary.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const params: Record<string, ParamValue> = {};
const paramFile = option('--params');
if (paramFile !== undefined) Object.assign(params, readOverrides(fromOrigin(paramFile)));
for (const part of (option('--set') ?? '').split(',').filter((s) => s !== '')) {
  const at = part.indexOf('=');
  params[part.slice(0, at)] = Number(part.slice(at + 1));
}
/** Eco 50, the only programme the simulation washes on. */
const programme = 'eco_50';
const only = option('--only')?.split(',');
const exposureOnly = args.includes('--exposure-only');
const outDir = fromOrigin(option('--out') ?? 'anchors/out/stacking');
mkdirSync(outDir, { recursive: true });
const cache = createDiskExposureCache(anchorCacheDir());
console.log(
  `water side: ${waterSide().simVersion}, sources ${waterTag()} (${waterSide().files} files); exposure cache ${anchorCacheDir()}`,
);

// ---- the loads
const seeds = {
  ...(option('--level-seed') === undefined ? {} : { levelSeed: Number(option('--level-seed')) }),
  ...(option('--sim-seed') === undefined ? {} : { simSeed: Number(option('--sim-seed')) }),
};
const careful = stdEu13Description({ load: 'iec-13-careful', programme, params, ...seeds });
const badly = readLoad('iec-13-careful-badly');
const poseOf = (items: readonly ItemDescription[], id: string): ItemDescription | undefined =>
  items.find((item) => item.id === id);

/** The careful load with the poses of `ids` taken from the load that was edited badly. */
function withBadPoses(ids: (item: ItemDescription) => boolean): WashDescription {
  return {
    ...careful,
    items: careful.items.map((item) => {
      if (!ids(item)) return item;
      const bad = poseOf(badly.items, item.id);
      return bad === undefined
        ? item
        : {
            ...item,
            position_mm: bad.position_mm,
            ...(bad.quat_wxyz === undefined ? {} : { quat_wxyz: bad.quat_wxyz }),
          };
    }),
  };
}

const moved = (a: ItemDescription, b: ItemDescription | undefined): boolean =>
  b !== undefined &&
  (a.position_mm.some((v, i) => Math.abs(v - (b.position_mm[i] as number)) > 0.01) ||
    (a.quat_wxyz ?? [1, 0, 0, 0]).some(
      (v, i) => Math.abs(v - ((b.quat_wxyz ?? [1, 0, 0, 0])[i] as number)) > 1e-6,
    ));
const original = readLoad('iec-13-careful');
const changedIn = (ids: (item: ItemDescription) => boolean): string[] =>
  original.items
    .filter((item) => ids(item) && moved(item, poseOf(badly.items, item.id)))
    .map((item) => item.id);

const isPlate = (item: ItemDescription): boolean => /plate|saucer/.test(item.type);
const UPRIGHT = ['mug_01', 'cup_01', 'glass_01'];
const turnedIds = changedIn(isPlate);

/** Every fork turned end for end about the middle of its bounding box, in its place. */
function forksFlipped(): WashDescription {
  return {
    ...careful,
    items: careful.items.map((item) => {
      if (!/fork_\d/.test(item.id) || !/dinner_fork/.test(item.type)) return item;
      const box = instantiate(item.type).bbox;
      const size = [0, 1, 2].map((k) => (box.max[k] as number) - (box.min[k] as number));
      // Turn about the thinnest axis of the piece: its ends change places, its faces do not.
      const thin = size.indexOf(Math.min(...size));
      const axis: [number, number, number] = [0, 0, 0];
      axis[thin] = 1;
      const w = item.quat_wxyz ?? [1, 0, 0, 0];
      const q: Quat = [w[1], w[2], w[3], w[0]];
      const turned = quatMul(q, quatFromAxisAngle(axis, Math.PI));
      const centre: [number, number, number] = [
        500 * ((box.min[0] as number) + (box.max[0] as number)),
        500 * ((box.min[1] as number) + (box.max[1] as number)),
        500 * ((box.min[2] as number) + (box.max[2] as number)),
      ];
      const was = quatRotate(q, centre);
      const now = quatRotate(turned, centre);
      return {
        ...item,
        position_mm: [
          item.position_mm[0] + was[0] - now[0],
          item.position_mm[1] + was[1] - now[1],
          item.position_mm[2] + was[2] - now[2],
        ],
        quat_wxyz: [turned[3], turned[0], turned[1], turned[2]],
      };
    }),
  };
}

const loads: Record<string, () => WashDescription> = {
  careful: () => careful,
  turned: () => withBadPoses(isPlate),
  upright: () => withBadPoses((item) => UPRIGHT.includes(item.id)),
  blocked: () => ({ ...careful, dispenserBlocked: true }),
  stalled: () => ({ ...careful, stalledArms_deg: { lower: 62.3 } }),
  forks_flipped: forksFlipped,
  half: () => stdEu13Description({ load: 'half-careful', programme, params, ...seeds }),
  careless: () => stdEu13Description({ load: 'iec-13-careless', programme, params, ...seeds }),
};

const results = new Map<string, WashResult>();
for (const [name, make] of Object.entries(loads)) {
  if (only !== undefined && !only.includes(name)) continue;
  const started = performance.now();
  const result = await washWithSource(washInputFromDescription(make()), {
    cache,
    keepScene: false,
  });
  results.set(name, result);
  const summary = summariseWash(result);
  console.error(
    `${name}: ${((performance.now() - started) / 1000).toFixed(0)} s, exposure ${result.run.exposureCacheHits} cached ${result.run.exposureComputed} computed; mean ${summary.all.meanScore.toFixed(2)}, clean ${summary.all.clean} of ${summary.items}; problems ${result.problems.length}`,
  );
  writeFileSync(
    join(outDir, `${name}.${programme}.json`),
    `${JSON.stringify({ name, programme, params, summary, items: result.items.map(({ cells: _c, regions: _r, ...rest }) => rest), problems: result.problems, timeline: result.machine.timelineProblems, heldWater_mL: result.machine.heldWater_mL }, null, 1)}\n`,
  );
}
if (exposureOnly) process.exit(0);

// ---- the report
const f = (v: number, digits = 2): string => (Number.isFinite(v) ? v.toFixed(digits) : 'n/a');
const itemOf = (name: string, id: string): ItemWashResult | undefined =>
  results.get(name)?.items.find((item) => item.itemId === id);
const soilOf = (item: ItemWashResult | undefined): string =>
  item === undefined ? '' : item.soils.map((s) => s.type.replace('iec_', '')).join('+') || 'none';
const lines: string[] = [];

lines.push(`# Stacking under the parameter set (${programme}, official tier)`);
lines.push('');
lines.push(`Parameters: ${JSON.stringify(params)}`);
lines.push('');
lines.push('## The loads');
lines.push('');
lines.push(
  '| Load | Items | Mean score | Clean | Soiled items clean | Crockery | Cutlery | Glass | Melamine | Dry soil left | Water held (mL) | Detergent dissolved (g) |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [name, result] of results) {
  const s = summariseWash(result);
  lines.push(
    `| ${name} | ${s.items} | ${f(s.all.meanScore)} | ${s.all.clean} (${f((100 * s.all.clean) / s.items, 0)} %) | ${s.soiledOnly.clean} of ${s.soiledOnly.items} | ${ITEM_CLASSES.filter(
      (c) => c !== 'pots',
    )
      .map((c) => `${f(s.byClass[c].meanScore)} (${s.byClass[c].clean}/${s.byClass[c].items})`)
      .join(
        ' | ',
      )} | ${f((100 * s.soil.remaining_mg) / s.soil.initial_mg, 1)} % | ${f(s.heldWater_mL, 0)} | ${f(s.detergent.dissolved_g, 1)} |`,
  );
}
lines.push('');

/** Mean score of some items in a load, and their count. */
function meanOf(name: string, ids: readonly string[]): { mean: number; n: number; clean: number } {
  const items = ids
    .map((id) => itemOf(name, id))
    .filter((i): i is ItemWashResult => i !== undefined);
  return {
    mean: items.reduce((sum, i) => sum + i.score, 0) / Math.max(items.length, 1),
    n: items.length,
    clean: items.filter((i) => i.clean).length,
  };
}

interface Pair {
  readonly id: string;
  readonly what: string;
  readonly a: string;
  readonly b: string;
  readonly ids: readonly string[];
  readonly expected: string;
  /** Lowest and highest change of the mean score the checklist expects (B minus A). */
  readonly band: readonly [number, number];
  readonly control: boolean;
}

const carefulItems = results.get('careful')?.items ?? [];
const idsWhere = (test: (item: ItemWashResult) => boolean): string[] =>
  carefulItems.filter(test).map((item) => item.itemId);
const hasSoil = (item: ItemWashResult, soil: string): boolean =>
  item.soils.some((s) => s.type === soil);
const nested = turnedIds.filter((id) => id.startsWith('soup_plate'));
const hosts = nested.map((id) => {
  const soups = original.items
    .filter((i) => /soup_plate/.test(i.type))
    .map((i) => i.id)
    .sort();
  return soups[soups.indexOf(id) - 1] ?? '';
});
const turnedWith = (soil: string, type: RegExp): string[] =>
  turnedIds.filter((id) => {
    const item = itemOf('careful', id);
    return item !== undefined && type.test(item.typeId) && hasSoil(item, soil);
  });
const lowerRack = idsWhere((item) => {
  const d = original.items.find((i) => i.id === item.itemId);
  return (
    d !== undefined &&
    d.position_mm[2] < 400 &&
    item.initialMass_mg > 0 &&
    itemClassOf(item.typeId) === 'crockery'
  );
});
const upperRack = idsWhere((item) => {
  const d = original.items.find((i) => i.id === item.itemId);
  return d !== undefined && d.position_mm[2] >= 400 && item.initialMass_mg > 0;
});

const pairs: Pair[] = [
  {
    id: 'P02',
    what: 'oven-dried egg yolk on plates: eating face to the spray (A), turned round in the slot (B)',
    a: 'careful',
    b: 'turned',
    ids: turnedWith('iec_egg_yolk', /plate/),
    expected: 'Δs -1 to -2 (S16; estimated)',
    band: [-2, -1],
    control: false,
  },
  {
    id: 'P02 (easy soils)',
    what: 'minced meat and spinach on plates: facing (A), turned round (B)',
    a: 'careful',
    b: 'turned',
    ids: [...turnedWith('iec_minced_meat', /plate/), ...turnedWith('iec_spinach', /plate/)],
    expected: 'about 0 for lightly adhering soils (negative control)',
    band: [-0.5, 0.5],
    control: true,
  },
  {
    id: 'P28 (saucers)',
    what: 'tea film on saucers: facing (A), turned round (B)',
    a: 'careful',
    b: 'turned',
    ids: turnedWith('iec_tea', /saucer/),
    expected: 'abs(Δs) at most 0.5: a bleachable stain is position-insensitive (negative control)',
    band: [-0.5, 0.5],
    control: true,
  },
  {
    id: 'P04',
    what: 'porridge soup plates: one per slot (A), pushed 6 mm behind its neighbour (B); the nested plate',
    a: 'careful',
    b: 'turned',
    ids: nested,
    expected: 'at least half of the overlapped soil stays; score 0 if more than 200 mm2',
    band: [-5, -1],
    control: false,
  },
  {
    id: 'P04 (host)',
    what: 'the plate in front of a nested one',
    a: 'careful',
    b: 'turned',
    ids: hosts.filter((id) => id !== ''),
    expected: 'its back is covered; eating face little changed',
    band: [-1, 0.5],
    control: false,
  },
  {
    id: 'neighbours',
    what: 'lower-rack crockery that was not moved, beside the turned and nested plates (not a checklist pair: a turned plate stands face to face with its neighbour)',
    a: 'careful',
    b: 'turned',
    ids: lowerRack.filter((id) => !turnedIds.includes(id) && !hosts.includes(id)),
    expected: 'the plate a turned plate now faces loses; the others do not change',
    band: [-2, 0],
    control: false,
  },
  {
    id: 'P01',
    what: 'mug and cup (tea) and glass (milk): mouth down (A), mouth up (B)',
    a: 'careful',
    b: 'upright',
    ids: UPRIGHT,
    expected: 'holds its brim volume of water: not clean whatever the stain does',
    band: [-5, 0.5],
    control: false,
  },
  {
    id: 'P25',
    what: 'dispenser free (A), kept shut (B): the whole load',
    a: 'careful',
    b: 'blocked',
    ids: idsWhere((item) => item.initialMass_mg > 0),
    expected: 'load mean -1.5 or more; protein removal near zero',
    band: [-5, -1.5],
    control: false,
  },
  {
    id: 'P06',
    what: 'lower arm turning (A), held still (B): soiled crockery of the lower rack',
    a: 'careful',
    b: 'stalled',
    ids: lowerRack,
    expected: 'rack mean -1.5 or more for tenacious soils',
    band: [-5, -1.5],
    control: false,
  },
  {
    id: 'P06 (upper rack)',
    what: 'the same, soiled items of the upper rack',
    a: 'careful',
    b: 'stalled',
    ids: upperRack,
    expected: 'served by the upper arm: little change (negative control)',
    band: [-0.5, 0.5],
    control: true,
  },
  {
    id: 'P16',
    what: 'egg-yolk forks in the cutlery basket: as loaded (A), turned end for end (B)',
    a: 'careful',
    b: 'forks_flipped',
    ids: idsWhere((item) => /dinner_fork/.test(item.typeId)),
    expected: 'abs(Δs) at most 0.3 (negative control)',
    band: [-0.3, 0.3],
    control: true,
  },
];

lines.push('## A/B pairs');
lines.push('');
lines.push(
  '| Checklist | Pair | Items | Mean score A | Mean score B | Δs | Clean A, B | Expected | Sign | Size |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const pair of pairs) {
  if (!results.has(pair.a) || !results.has(pair.b) || pair.ids.length === 0) continue;
  const a = meanOf(pair.a, pair.ids);
  const b = meanOf(pair.b, pair.ids);
  const delta = b.mean - a.mean;
  const [lo, hi] = pair.band;
  const within = delta >= lo - 1e-9 && delta <= hi + 1e-9;
  const sign = pair.control
    ? Math.abs(delta) <= Math.max(Math.abs(lo), Math.abs(hi)) + 1e-9
      ? 'no effect, as expected'
      : 'EFFECT where none is expected'
    : hi <= 0
      ? delta < 0
        ? 'right'
        : delta === 0
          ? 'NO EFFECT'
          : 'WRONG'
      : 'n/a';
  lines.push(
    `| ${pair.id}${pair.control ? ' (control)' : ''} | ${pair.what} | ${a.n} | ${f(a.mean)} | ${f(b.mean)} | ${delta >= 0 ? '+' : ''}${f(delta)} | ${a.clean}, ${b.clean} | ${pair.expected} | ${sign} | ${within ? 'within the band' : delta < lo ? 'larger than expected' : 'smaller than expected'} |`,
  );
}
lines.push('');
lines.push('## The items of each pair');
lines.push('');
lines.push(
  '| Checklist | Item | Soil | A: score, left (mg), visible (mm2), water (mL) | B: score, left (mg), visible (mm2), water (mL) |',
);
lines.push('|---|---|---|---|---|');
for (const pair of pairs) {
  if (!results.has(pair.a) || !results.has(pair.b) || pair.ids.length > 14) continue;
  for (const id of pair.ids) {
    const a = itemOf(pair.a, id);
    const b = itemOf(pair.b, id);
    if (a === undefined || b === undefined) continue;
    const cell = (i: ItemWashResult): string =>
      `${i.score}${i.clean ? ' clean' : ''}, ${f(i.residualMass_mg, 1)} of ${f(i.initialMass_mg, 1)}, ${f(i.visibleAreaMm2, 0)}, ${f(i.water.pooled_mL, 0)}`;
    lines.push(`| ${pair.id} | ${id} | ${soilOf(a)} | ${cell(a)} | ${cell(b)} |`);
  }
}
lines.push('');

// ---- tea in a good and a poor position, within the careful load (P28)
const tea = carefulItems.filter((item) => hasSoil(item, 'iec_tea'));
if (tea.length > 0) {
  lines.push(
    '## Tea by position within the careful load (P28, negative control: abs(Δs) at most 0.5)',
  );
  lines.push('');
  lines.push('| Item | Position (mm) | Score | Tea left | Visible area (mm2) | Water (mL) |');
  lines.push('|---|---|---|---|---|---|');
  for (const item of tea) {
    const d = original.items.find((i) => i.id === item.itemId);
    lines.push(
      `| ${item.itemId} | ${d?.position_mm.map((v) => v.toFixed(0)).join(', ') ?? ''} | ${item.score} | ${f((100 * item.residualMass_mg) / item.initialMass_mg, 1)} % | ${f(item.visibleAreaMm2, 0)} | ${f(item.water.pooled_mL, 1)} |`,
    );
  }
  const scores = tea.filter((i) => /cup|mug/.test(i.typeId)).map((i) => i.score);
  lines.push('');
  lines.push(
    `Cups and mugs: scores ${scores.join(', ')}; range ${Math.max(...scores) - Math.min(...scores)}.`,
  );
  lines.push('');
}

// ---- density: the half load against the full load (P19), by item type
if (results.has('half') && results.has('careful')) {
  lines.push('## Half load against full load, by item type (P19: a denser load cleans worse)');
  lines.push('');
  lines.push(
    '| Type | Half load: items, mean score, clean | Full load: items, mean score, clean | Δs (full - half) |',
  );
  lines.push('|---|---|---|---|');
  const half = summariseWash(results.get('half') as WashResult);
  const full = summariseWash(results.get('careful') as WashResult);
  for (const type of Object.keys(full.byType)) {
    const h = half.byType[type];
    const g = full.byType[type];
    if (h === undefined || g === undefined || g.soiled === 0) continue;
    lines.push(
      `| ${type} | ${h.items}, ${f(h.meanScore)}, ${h.clean} | ${g.items}, ${f(g.meanScore)}, ${g.clean} | ${g.meanScore - h.meanScore >= 0 ? '+' : ''}${f(g.meanScore - h.meanScore)} |`,
    );
  }
  const hm = classMeans((results.get('half') as WashResult).items, STANDARD_COMPOSITION);
  const fm = classMeans((results.get('careful') as WashResult).items, STANDARD_COMPOSITION);
  lines.push('');
  lines.push(
    `Mean with the standard weights: half ${f(hm.score.all)}, full ${f(fm.score.all)} (Δs ${f(fm.score.all - hm.score.all)}; the checklist expects -0.5 to -1 for 30 % more items than rated, here 80 % more than the half load).`,
  );
  lines.push('');
}

writeFileSync(join(outDir, `stacking.${programme}.md`), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
process.exit(0);
