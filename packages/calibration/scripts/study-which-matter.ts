/**
 * Study: which parameters matter for clean or not clean (docs/calibration/fitting.md section 9.2).
 *
 *   pnpm --filter @spotless/calibration study:which-matter [--top n] [--water key,key,...]
 *
 * The load is the 114-item lattice with one typical soil on every item (the items of a type
 * take turns through the soils the catalogue lists for it), on 30 % of its region at the
 * typical loading. For every registered
 * parameter that can be fitted, the number of clean items is computed with the parameter at
 * the lower and at the upper end of its registered range, everything else at its default.
 *
 *   1. screen   every replay-time parameter (soil, liquor, timeline, inspector, and the
 *               calibration's replay-time scales and programme parameters) at both ends, on a
 *               replay of every third item thinned to one soil cell in eight (the other items
 *               as a fixed history in the liquor), by the mean share of the soiled area
 *               and of the dry soil the items keep (which, unlike a count of clean items,
 *               survives thinning)
 *   2. exact    the `top` parameters of the screen at both ends on the full replay: the count
 *               of clean items by the inspector's rule
 *   3. water    the named parameters of the water model at both ends, each a new exposure of
 *               the whole load (`--water`; none by default, because each costs minutes)
 *
 * `--keys a,b` skips the screen and evaluates the named replay-time parameters exactly (for
 * those a screen by residue cannot see: the inspector's own rule moves verdicts, not residue).
 *
 * The table lists the ten parameters that move the number of clean items furthest.
 */

import type { ParamSet, ParamValue } from '@spotless/sim-core';
import {
  calibrationRegistry,
  continuousScore,
  createCalibrationParams,
  EvaluatorPool,
  fitParameters,
  fmt,
  prepareRecord,
  textTable,
  type FitParameter,
  type PreparedRecord,
} from '../src/index.ts';
import { diskExposureCache } from '../src/node/index.ts';
import { fullLoadRecord, STUDY_CACHE } from './study-loads.ts';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const top = Number(option('--top') ?? 16);
const water = (option('--water') ?? '').split(',').filter((key) => key !== '');
/** Replay-time parameters to evaluate exactly without a screen (`--keys a,b`). */
const named = (option('--keys') ?? '').split(',').filter((key) => key !== '');
const cache = diskExposureCache(STUDY_CACHE);
const base = createCalibrationParams();
const record = fullLoadRecord({ id: 'which-matter', kinds: ['clean'], soiling: 'one' });

/** The parameter set with one fit parameter at a value. */
function at(parameter: FitParameter, value: number): ParamSet {
  if (parameter.index === null) return base.with({ [parameter.key]: value });
  const vector = [...base.getVector(parameter.key)];
  vector[parameter.index] = value;
  return base.with({ [parameter.key]: vector as ParamValue });
}

interface Outcome {
  /** Items the inspector calls clean. */
  readonly clean: number;
  /** Mean over the soiled items of the area still visibly soiled over the area soiled, and of the residual mass fraction. */
  readonly area: number;
  readonly mass: number;
  /** Mean continuous IEC score (it is at its floor of -0.5 for an item with more than 800 mm2 left). */
  readonly meanScore: number;
}

async function outcome(prepared: PreparedRecord, params: ParamSet): Promise<Outcome> {
  const prediction = await prepared.evaluate(params);
  let clean = 0;
  let score = 0;
  let area = 0;
  let mass = 0;
  let soiled = 0;
  for (const state of prediction.states) {
    if (state.clean) clean++;
    score += continuousScore(state, prediction.rule, prediction.constants);
    if (state.soiledAreaMm2 > 0 && state.initialMass_mg > 0) {
      soiled++;
      area += Math.min(1, state.softVisibleAreaMm2 / state.soiledAreaMm2);
      mass += state.residualMass_mg / state.initialMass_mg;
    }
  }
  return {
    clean,
    area: area / Math.max(soiled, 1),
    mass: mass / Math.max(soiled, 1),
    meanScore: score / prediction.states.length,
  };
}

/** How far a parameter moves the residue between the ends of its range and its default. */
function moveOf(low: Outcome, mid: Outcome, high: Outcome): number {
  const span = (pick: (o: Outcome) => number): number =>
    Math.max(pick(low), pick(mid), pick(high)) - Math.min(pick(low), pick(mid), pick(high));
  return Math.max(
    span((o) => o.area),
    span((o) => o.mass),
  );
}

// Every replay-time parameter of the registry that can be fitted.
const registry = calibrationRegistry();
const candidates: FitParameter[] = [];
for (const def of registry.defs) {
  if (def.kind === 'enum' || def.min === def.max || def.group !== 'soil') continue;
  if (def.key.startsWith('obs.')) continue;
  candidates.push(...fitParameters([def.key]));
}
console.log(
  `${record.load.items.length} items, ${candidates.length} replay-time parameters to screen, ${water.length} water parameters`,
);

const screened: { parameter: FitParameter; low: Outcome; high: Outcome; move: number }[] = [];
const pct = (x: number): string => (100 * x).toFixed(1);
if (named.length === 0) {
  // 1. Screen on a thinned replay of every third item (the others are the background of the liquor).
  const screenRecord = fullLoadRecord({
    id: 'which-matter-screen',
    kinds: ['clean'],
    soiling: 'one',
    observe: (_, i) => i % 3 === 0,
  });
  const thinned = await prepareRecord(screenRecord, base, {
    cache,
    thin: 8,
    onProgress: (m) => console.error(`  ${m}`),
  });
  const reference = await outcome(thinned, base);
  console.log(
    `screen: ${thinned.info.itemsReplayed} items, ${thinned.info.deposits} deposits (one cell in 8); at the defaults the items keep ${(100 * reference.area).toFixed(1)} % of their soiled area visibly soiled and ${(100 * reference.mass).toFixed(1)} % of their dry soil on average`,
  );
  let done = 0;
  const started = performance.now();
  for (const parameter of candidates) {
    try {
      const low = await outcome(thinned, at(parameter, parameter.min));
      const high = await outcome(thinned, at(parameter, parameter.max));
      screened.push({ parameter, low, high, move: moveOf(low, reference, high) });
    } catch (error) {
      console.error(`  ${parameter.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    done++;
    if (done % 20 === 0) {
      console.error(
        `  screened ${done} of ${candidates.length} in ${((performance.now() - started) / 1000).toFixed(0)} s`,
      );
    }
  }
  screened.sort((a, b) => b.move - a.move);
  const screenRows: string[][] = [
    [
      'rank',
      'parameter',
      'range',
      'area left % at min',
      'at default',
      'at max',
      'mass left % at min',
      'at default',
      'at max',
    ],
  ];
  screened.slice(0, 30).forEach((s, i) => {
    screenRows.push([
      String(i + 1),
      s.parameter.id,
      `${fmt(s.parameter.min)} .. ${fmt(s.parameter.max)}`,
      pct(s.low.area),
      pct(reference.area),
      pct(s.high.area),
      pct(s.low.mass),
      pct(reference.mass),
      pct(s.high.mass),
    ]);
  });
  console.log(
    '\nscreen (thinned replay): mean share of the soiled area still visibly soiled, and of the dry soil left, across the range of each parameter; top 30',
  );
  console.log(textTable(screenRows, [0, 3, 4, 5, 6, 7, 8]));
  console.log(
    `${screened.filter((s) => s.move < 1e-4).length} of ${screened.length} parameters move neither by as much as 0.01 % anywhere in their range`,
  );
} else {
  // The named parameters are evaluated exactly, whatever a screen would say of them. (The rule
  // of the inspector, for one, moves the verdicts without moving any residue.)
  for (const parameter of fitParameters(named)) {
    screened.push({
      parameter,
      low: { clean: 0, area: 0, mass: 0, meanScore: 0 },
      high: { clean: 0, area: 0, mass: 0, meanScore: 0 },
      move: 0,
    });
  }
}

// 2. Exact counts for the top of the screen.
const exact = await prepareRecord(record, base, {
  cache,
  restrict: 'all',
  onProgress: (m) => console.error(`  ${m}`),
});
const atDefault = await outcome(exact, base);
console.log(
  `\nexact: ${exact.info.deposits} deposits; at the defaults ${atDefault.clean} of ${record.load.items.length} items are clean; ${pct(atDefault.area)} % of the soiled area and ${pct(atDefault.mass)} % of the dry soil are left on average`,
);
interface Row {
  id: string;
  unit: string;
  tag: string;
  default: number;
  min: number;
  max: number;
  low: Outcome;
  high: Outcome;
  how: string;
}
const rows: Row[] = [];
for (const s of named.length > 0 ? screened : screened.slice(0, top)) {
  const low = await outcome(exact, at(s.parameter, s.parameter.min));
  const high = await outcome(exact, at(s.parameter, s.parameter.max));
  rows.push({
    id: s.parameter.id,
    unit: s.parameter.unit,
    tag: s.parameter.tag,
    default: s.parameter.default,
    min: s.parameter.min,
    max: s.parameter.max,
    low,
    high,
    how: 'replay',
  });
  console.error(`  ${s.parameter.id}: ${low.clean} .. ${high.clean} clean`);
}

// 3. Water parameters: a new exposure at each end.
if (water.length > 0) {
  const pool = new EvaluatorPool({ cache, restrict: 'all' }, 1);
  for (const parameter of fitParameters(water)) {
    const ends: Outcome[] = [];
    for (const value of [parameter.min, parameter.max]) {
      const params = at(parameter, value);
      const prepared = await pool.get(record, params);
      ends.push(await outcome(prepared, params));
      pool.clear();
    }
    rows.push({
      id: parameter.id,
      unit: parameter.unit,
      tag: parameter.tag,
      default: parameter.default,
      min: parameter.min,
      max: parameter.max,
      low: ends[0] as Outcome,
      high: ends[1] as Outcome,
      how: 'new exposure',
    });
    console.error(`  ${parameter.id}: ${ends[0]?.clean} .. ${ends[1]?.clean} clean`);
  }
}

const span = (row: Row): number =>
  Math.max(row.low.clean, row.high.clean, atDefault.clean) -
  Math.min(row.low.clean, row.high.clean, atDefault.clean);
rows.sort(
  (a, b) =>
    span(b) - span(a) || moveOf(b.low, atDefault, b.high) - moveOf(a.low, atDefault, a.high),
);
const table: string[][] = [
  [
    'rank',
    'parameter',
    'unit',
    'tag',
    'default',
    'range',
    'clean at min',
    'at default',
    'at max',
    'moves',
    'area left % min .. max',
    'evaluated by',
  ],
];
rows.slice(0, 10).forEach((row, i) => {
  table.push([
    String(i + 1),
    row.id,
    row.unit,
    row.tag,
    fmt(row.default),
    `${fmt(row.min)} .. ${fmt(row.max)}`,
    String(row.low.clean),
    String(atDefault.clean),
    String(row.high.clean),
    String(span(row)),
    `${pct(row.low.area)} .. ${pct(row.high.area)}`,
    row.how,
  ]);
});
console.log(
  `\nthe ten parameters that move the number of clean items furthest across their registered range (${record.load.items.length} items)`,
);
console.log(textTable(table, [0, 4, 6, 7, 8, 9]));
if (rows.length > 10) {
  console.log('\nthe rest of those evaluated exactly:');
  console.log(
    rows
      .slice(10)
      .map(
        (row) =>
          `  ${row.id}: ${row.low.clean} .. ${row.high.clean} clean (${fmt(row.min)} .. ${fmt(row.max)})`,
      )
      .join('\n'),
  );
}
