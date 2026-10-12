/**
 * Parameters that change the water (docs/calibration/fitting.md section 4.3): a nozzle
 * coefficient, the closure scales of the jets and of the film, anything in the `hydro` group.
 * Each value needs a new exposure, which is the expensive part of a wash, so they are fitted
 * in an outer loop that asks for few of them.
 *
 * {@link fitWithWaterParameters} runs, for `rounds` rounds:
 *
 *   design      the current water parameters and each of them moved up and down by a step
 *               (2 m + 1 points, of which the centre is known from the round before)
 *   profile     at every point the replay-time parameters are re-fitted (a short Nelder-Mead
 *               from the values of the centre), which gives the profiled log posterior L
 *   surrogate   per water parameter a parabola through its three points; the next centre is
 *               the vertex of each (limited to two steps), or the better end where the three
 *               points are not concave
 *   accept      the new centre is evaluated and kept if it is the best point seen, else the
 *               best point seen becomes the centre; the step is halved
 *
 * and then fits the replay-time parameters in full at the water parameters reached. The
 * deviation of a water parameter is that of its parabola in the last round (the other water
 * parameters held, the replay-time ones profiled out). Every exposure is cached under its own
 * key, so a second run of the same fit computes none.
 *
 * {@link checkReplayScale} tests whether a scale of the water model can be applied at replay
 * time instead: it computes the exposure at two values of the registry key and compares the
 * tables column by column. Where the columns the key stands for scale exactly and nothing else
 * moves, the `cal.*` scale is exact, and the key should be made a replay-time parameter.
 */

import {
  createMemoryExposureCache,
  decodeExposureSet,
  JET_FIELDS,
  wash,
  WATER_FIELDS,
  type ExposureCache,
  type ExposureSet,
  type ParamSet,
} from '@spotless/sim-core';
import { createCalibrationParams, REPLAY_SCALES, washOverridesOf } from './cal-params.ts';
import { EvaluatorPool } from './evaluator.ts';
import { fitRecords, type FitOptions, type FitResult } from './fit.ts';
import { washLoadOfRecord } from './load.ts';
import {
  createObjective,
  fitParameters,
  fromZ,
  logPrior,
  paramsAt,
  zOf,
  type FitParameter,
} from './objective.ts';
import { minimise } from './optimise.ts';
import type { WashRecord } from './record.ts';
import { machineOfRecord, programmeOfRecord } from './setup.ts';
import { fmt, textTable } from './util.ts';

/** Options of {@link fitWithWaterParameters}. */
export interface OuterFitOptions extends FitOptions {
  /** Rounds of design, surrogate and step; default 2. */
  readonly rounds?: number;
  /** First step of the design in prior deviations of each water parameter; default 0.75. */
  readonly designStep?: number;
  /** Evaluations of the short inner fit at each design point; default 30 per parameter. */
  readonly innerEvaluations?: number;
}

/** One fitted water parameter. */
export interface WaterParameterFit {
  readonly id: string;
  readonly unit: string;
  readonly default: number;
  readonly estimate: number;
  /** Deviation in the transformed coordinate from the last parabola; null where it was not concave. */
  readonly sd: number | null;
  /** How far it moved from its prior centre, in prior deviations. */
  readonly movedSd: number;
}

/** What {@link fitWithWaterParameters} returns. */
export interface OuterFitResult {
  readonly water: readonly WaterParameterFit[];
  /** The full fit of the replay-time parameters at the water parameters reached. */
  readonly inner: FitResult;
  /** Every point of the water parameters that was evaluated, with its profiled log posterior. */
  readonly history: readonly {
    readonly values: readonly number[];
    readonly logPosterior: number;
  }[];
  /** Distinct points of the water parameters, each of which needed an exposure per record. */
  readonly exposures: number;
  readonly report: string;
}

/**
 * Fits the replay-time parameters `innerKeys` and the water parameters `waterKeys` to
 * `records`: see the file comment.
 */
export async function fitWithWaterParameters(
  records: readonly WashRecord[],
  innerKeys: readonly string[],
  waterKeys: readonly string[],
  options: OuterFitOptions = {},
): Promise<OuterFitResult> {
  const say = (message: string): void => options.onProgress?.(message);
  const base = options.base ?? createCalibrationParams();
  const water = fitParameters(waterKeys, options.priors);
  const pool = options.pool ?? new EvaluatorPool(options.evaluator, 2 * water.length + 2);
  const m = water.length;
  const history: { z: number[]; values: number[]; logPosterior: number; inner: number[] }[] = [];
  let warm: number[] | undefined;
  const clip = (z: readonly number[]): number[] =>
    water.map((p, j) => Math.min(p.upper, Math.max(p.lower, z[j] as number)));

  /** The log posterior with the replay-time parameters profiled out, at water parameters z. */
  const profiled = async (zIn: readonly number[]): Promise<number> => {
    const z = clip(zIn);
    const known = history.find((h) => h.z.every((v, j) => Math.abs(v - (z[j] as number)) < 1e-12));
    if (known !== undefined) return known.logPosterior;
    const at = paramsAt(base, water, z);
    const objective = createObjective(records, innerKeys, { ...options, base: at, pool });
    const inner = objective.parameters;
    let zInner = warm ?? objective.clip(zOf(at, inner));
    let value: number;
    if (inner.length === 0) value = (await objective.evaluate([])).logPosterior;
    else {
      const trace = await minimise(
        async (x) => -(await objective.evaluate(x)).logPosterior,
        zInner,
        {
          lower: inner.map((p) => p.lower),
          upper: inner.map((p) => p.upper),
          step: inner.map((p) => 0.25 * p.priorSd),
          maxEvaluations: options.innerEvaluations ?? 30 * inner.length,
          fTolerance: options.fTolerance ?? 0.01,
          xTolerance: 0.04,
          restarts: 0,
        },
      );
      value = -trace.f;
      zInner = [...trace.x];
    }
    const total = value + logPrior(water, z);
    history.push({
      z,
      values: water.map((p, j) => fromZ(p, z[j] as number)),
      logPosterior: total,
      inner: zInner,
    });
    say(
      `water parameters ${water.map((p, j) => `${p.id}=${fmt(fromZ(p, z[j] as number))}`).join(' ')}: log posterior ${total.toFixed(3)}`,
    );
    return total;
  };
  const bestSeen = (): { z: number[]; logPosterior: number; inner: number[] } =>
    history.reduce((a, b) => (b.logPosterior > a.logPosterior ? b : a));

  let centre = clip(zOf(base, water));
  let step = water.map((p) => (options.designStep ?? 0.75) * p.priorSd);
  const curvature: (number | null)[] = water.map(() => null);
  const rounds = Math.max(1, options.rounds ?? 2);
  for (let round = 0; round < rounds && m > 0; round++) {
    const lc = await profiled(centre);
    warm = bestSeen().inner;
    const next = [...centre];
    for (let j = 0; j < m; j++) {
      const p = water[j] as FitParameter;
      const hi = Math.min(p.upper, (centre[j] as number) + (step[j] as number));
      const lo = Math.max(p.lower, (centre[j] as number) - (step[j] as number));
      const lHi =
        hi > (centre[j] as number) ? await profiled(centre.map((v, i) => (i === j ? hi : v))) : lc;
      const lLo =
        lo < (centre[j] as number) ? await profiled(centre.map((v, i) => (i === j ? lo : v))) : lc;
      const up = hi - (centre[j] as number);
      const down = (centre[j] as number) - lo;
      curvature[j] = null;
      if (up > 0 && down > 0) {
        // The parabola through three points of unequal spacing.
        const slope = (lHi - lLo) / (up + down);
        const second = (2 * ((lHi - lc) / up - (lc - lLo) / down)) / (up + down);
        const gradient = slope - 0.5 * second * (up - down);
        if (second < 0) {
          curvature[j] = second;
          const move = Math.max(-2 * down, Math.min(2 * up, -gradient / second));
          next[j] = (centre[j] as number) + move;
        } else {
          next[j] = lHi >= lLo ? hi : lo;
        }
      } else {
        next[j] = lHi > lc ? hi : lLo > lc ? lo : (centre[j] as number);
      }
    }
    await profiled(next);
    centre = [...bestSeen().z];
    step = step.map((h) => 0.5 * h);
  }
  if (m === 0) await profiled(centre);
  const best = bestSeen();
  const at = paramsAt(base, water, best.z);
  say('full fit of the replay-time parameters at the water parameters reached');
  const inner = await fitRecords(records, innerKeys, { ...options, base: at, pool });
  const fits: WaterParameterFit[] = water.map((p, j) => ({
    id: p.id,
    unit: p.unit,
    default: p.default,
    estimate: fromZ(p, best.z[j] as number),
    sd:
      curvature[j] === null || curvature[j] === undefined
        ? null
        : 1 / Math.sqrt(-(curvature[j] as number)),
    movedSd: ((best.z[j] as number) - p.priorMean) / p.priorSd,
  }));
  const rows: string[][] = [
    ['water parameter', 'unit', 'default', 'estimate', 'sd (transformed)', 'moved (prior sd)'],
  ];
  for (const f of fits) {
    rows.push([
      f.id,
      f.unit,
      fmt(f.default),
      fmt(f.estimate, 4),
      f.sd === null ? 'not concave' : fmt(f.sd),
      f.movedSd.toFixed(2),
    ]);
  }
  const report =
    `${history.length} points of the water parameters were evaluated, each with a new exposure per record:\n` +
    `${textTable(rows, [2, 3, 4, 5])}\n\n` +
    `history:\n${history.map((h) => `  ${h.values.map((v) => fmt(v, 4)).join(' ')}: ${h.logPosterior.toFixed(3)}`).join('\n')}\n\n` +
    inner.report;
  return {
    water: fits,
    inner,
    history: history.map((h) => ({ values: h.values, logPosterior: h.logPosterior })),
    exposures: history.length,
    report,
  };
}

/** The exposure sets of a record's load at given parameters, through the orchestrator. */
async function exposureOfRecord(
  record: WashRecord,
  params: ParamSet,
  cache: ExposureCache,
): Promise<ExposureSet[]> {
  const { spec, config } = machineOfRecord(record);
  const course = programmeOfRecord(record, spec, config);
  const load = washLoadOfRecord(record, spec, config);
  const result = await wash(
    {
      machine: spec,
      config,
      programme: course.programme,
      items: load.items.map((item) => ({ ...item, soils: [] })),
      tier: record.sim?.tier ?? 'fast',
      levelSeed: (record.sim?.level_seed ?? 1) >>> 0,
      simSeed: (record.sim?.sim_seed ?? 1) >>> 0,
      params: washOverridesOf(params),
    },
    { cache, keepScene: false },
  );
  const sets: ExposureSet[] = [];
  for (const state of result.machine.states) {
    if (state.exposureKey === '') continue;
    const bytes = await cache.get(state.exposureKey);
    if (bytes !== undefined) sets.push(decodeExposureSet(bytes));
  }
  return sets;
}

/** How one column of the exposure tables responds to a change of a registry key. */
export interface ColumnResponse {
  readonly table: 'jets' | 'water';
  readonly field: string;
  /**
   * Smallest and largest ratio of the column after over before, over the entries (soil cells
   * of the jet table, blocks of the water table) that are not 0 in both.
   */
  readonly minRatio: number;
  readonly maxRatio: number;
  /** Entries compared, and entries that are 0 in one table and not in the other. */
  readonly entries: number;
  readonly flipped: number;
}

/** What {@link checkReplayScale} finds. */
export interface ReplayScaleCheck {
  readonly scale: string;
  readonly standsFor: string;
  /** The factor the registry key was multiplied by. */
  readonly factor: number;
  /** True when the columns the scale multiplies changed by exactly the factor and no other did. */
  readonly exact: boolean;
  /** Largest relative departure of a scaled column from the factor, and of any other from 1. */
  readonly worstScaled: number;
  readonly worstOther: number;
  /** Entries that are 0 in one table and not in the other, over all columns. */
  readonly flipped: number;
  readonly columns: readonly ColumnResponse[];
  readonly summary: string;
}

/**
 * Computes the exposure of a record's load at the registry default and with the key a `cal.*`
 * scale stands for multiplied by `factor`, and compares the tables: see the file comment.
 */
export async function checkReplayScale(
  record: WashRecord,
  scaleKey: string,
  options: {
    readonly factor?: number;
    readonly cache?: ExposureCache;
    readonly base?: ParamSet;
    readonly tolerance?: number;
  } = {},
): Promise<ReplayScaleCheck> {
  const scale = REPLAY_SCALES.find((s) => s.key === scaleKey);
  if (scale === undefined) {
    throw new RangeError(
      `${scaleKey} is not a replay-time scale (${REPLAY_SCALES.map((s) => s.key).join(', ')})`,
    );
  }
  if (scale.standsFor === null) {
    throw new RangeError(
      `${scaleKey} stands for no registry key: there is nothing to check it against`,
    );
  }
  const standsFor = scale.standsFor;
  const base = options.base ?? createCalibrationParams();
  const def = base.registry.def(standsFor);
  if (def.kind === 'vector' || def.kind === 'enum')
    throw new RangeError(`${standsFor} is not a scalar`);
  const current = base.get(standsFor);
  let factor = options.factor ?? 1.5;
  if (current * factor > def.max) factor = def.max / current;
  if (current * factor < def.min) factor = def.min / current;
  const cache = options.cache ?? createMemoryExposureCache();
  const before = await exposureOfRecord(record, base, cache);
  const after = await exposureOfRecord(record, base.with({ [standsFor]: current * factor }), cache);
  const columns: ColumnResponse[] = [];
  /** One column of both tables, entry by entry: the jet table by soil cell, the water table by block. */
  const compare = (table: 'jets' | 'water', field: string): void => {
    let lo = Infinity;
    let hi = -Infinity;
    let entries = 0;
    let flipped = 0;
    const pair = (x: number, y: number): void => {
      if (x === 0 && y === 0) return;
      if (x === 0 || y === 0) {
        flipped++;
        return;
      }
      const ratio = y / x;
      lo = Math.min(lo, ratio);
      hi = Math.max(hi, ratio);
      entries++;
    };
    before.forEach((set, s) => {
      const other = after[s] as ExposureSet;
      if (table === 'water') {
        const count = set.water.blockCount > 0 ? set.water.values.length / set.water.blockCount : 0;
        const at = (WATER_FIELDS as readonly string[]).indexOf(field);
        if (at < 0 || at >= count) return;
        for (let b = 0; b < set.water.blockCount; b++) {
          pair(
            set.water.values[count * b + at] as number,
            other.water.values[count * b + at] as number,
          );
        }
        return;
      }
      const count = set.jets.cell.length > 0 ? set.jets.values.length / set.jets.cell.length : 0;
      const otherCount =
        other.jets.cell.length > 0 ? other.jets.values.length / other.jets.cell.length : 0;
      const at = (JET_FIELDS as readonly string[]).indexOf(field);
      if (at < 0 || at >= count || at >= otherCount) return;
      const where = new Map<number, number>();
      other.jets.cell.forEach((cell, i) => where.set(cell, i));
      const seen = new Set<number>();
      set.jets.cell.forEach((cell, i) => {
        const j = where.get(cell);
        seen.add(cell);
        pair(
          set.jets.values[count * i + at] as number,
          j === undefined ? 0 : (other.jets.values[otherCount * j + at] as number),
        );
      });
      other.jets.cell.forEach((cell, j) => {
        if (!seen.has(cell)) pair(0, other.jets.values[otherCount * j + at] as number);
      });
    });
    columns.push({
      table,
      field,
      minRatio: entries > 0 ? lo : 1,
      maxRatio: entries > 0 ? hi : 1,
      entries,
      flipped,
    });
  };
  for (const field of JET_FIELDS) compare('jets', field);
  for (const field of WATER_FIELDS) compare('water', field);
  let worstScaled = 0;
  let worstOther = 0;
  for (const column of columns) {
    const scaled = column.table === scale.table && scale.fields.includes(column.field);
    const target = scaled ? factor : 1;
    const off = Math.max(
      Math.abs(column.minRatio / target - 1),
      Math.abs(column.maxRatio / target - 1),
    );
    if (scaled) worstScaled = Math.max(worstScaled, off);
    else worstOther = Math.max(worstOther, off);
  }
  const tolerance = options.tolerance ?? 1e-4;
  const flipped = columns.reduce((sum, column) => sum + column.flipped, 0);
  const exact =
    before.length === after.length &&
    flipped === 0 &&
    worstScaled <= tolerance &&
    worstOther <= tolerance;
  const moved = columns
    .filter(
      (c) =>
        c.flipped > 0 ||
        Math.abs(c.minRatio - 1) > tolerance ||
        Math.abs(c.maxRatio - 1) > tolerance,
    )
    .map(
      (c) =>
        `${c.table}.${c.field} x ${fmt(c.minRatio, 4)}${Math.abs(c.maxRatio - c.minRatio) <= tolerance ? '' : ` to ${fmt(c.maxRatio, 4)}`}` +
        (c.flipped > 0
          ? ` (${c.flipped} of ${c.entries + c.flipped} entries appear or vanish)`
          : ''),
    );
  return {
    scale: scale.key,
    standsFor,
    factor,
    exact,
    worstScaled,
    worstOther,
    flipped,
    columns,
    summary:
      `${standsFor} x ${fmt(factor, 4)}: ${moved.length === 0 ? 'no column of the exposure tables changes' : moved.join(', ')}. ` +
      (exact
        ? `${scale.key} applied at replay time is exact.`
        : `${scale.key} at replay time is NOT equivalent (scaled columns off by ${fmt(worstScaled)}, others by ${fmt(worstOther)}): fit ${standsFor} in the outer loop.`),
  };
}
