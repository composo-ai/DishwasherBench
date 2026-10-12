/**
 * The published class means of the literature record as a table over parameters it shares
 * with a wash of the owner's machine, and the literature record as a record the calibration
 * tool can fit beside a measured one.
 *
 * A wash of the standard load at the official tier takes 20 to 60 s with its exposure cached,
 * and a fit asks for hundreds of evaluations: the class means are therefore washed once on a
 * grid (`scripts/literature-surface.ts`, one line per wash) and read from it here, linear
 * between the grid values of every axis (an axis whose values span a factor of four or more is
 * interpolated in its logarithm). The class means move slowly and in steps of single items
 * (one of 13 milk glasses is 0.2 of the glass class), so the grid error is that of the seeds,
 * which the table averages over.
 *
 * Parameters of the reference detergent that the owner's capsule does not share (the protease
 * level of detergent D, `liq.xProtease`) are nuisance of the literature record: an axis named
 * in `nuisance` is not interpolated; at every point the value of it that the record itself
 * likes best is taken (its likelihood of the fitted class means with the tool's prior of the
 * axis), as the anchoring fit chooses it.
 */

import { readFileSync } from 'node:fs';
import {
  fitParameters,
  groupMeanLogLikelihood,
  logPrior,
  toZ,
  type RecordGroupObservation,
  type WashRecord,
} from '../../src/index.ts';
import type { ClassMeanAggregate, LiteratureRecord } from './literature.ts';
import { ITEM_CLASSES, itemClassOf, type ItemClass } from './summary.ts';

/** One wash of the surface as `scripts/literature-surface.ts` writes it. */
export interface SurfaceRow {
  readonly id: string;
  readonly point: Readonly<Record<string, number>>;
  readonly levelSeed: number;
  readonly simSeed: number;
  readonly source: string;
  readonly score: Readonly<Record<string, number>>;
  readonly continuous: Readonly<Record<string, number>>;
  readonly milkGlasses: number;
  readonly teaItems: number;
  readonly crockeryWithoutTea: number;
  readonly cleanShare: number;
  readonly soiledClean: number;
  readonly soiledItems: number;
  readonly bySoil: Readonly<
    Record<string, { records: number; left: number; meanScore: number; clean: number }>
  >;
}

/** What the surface gives at a point. */
export interface SurfacePoint {
  /** The value taken for every nuisance axis. */
  readonly nuisance: Readonly<Record<string, number>>;
  /** Class means of the continuous score (what the likelihood reads) and of the whole-number score. */
  readonly continuous: Readonly<Record<string, number>>;
  readonly score: Readonly<Record<string, number>>;
  readonly milkGlasses: number;
  readonly teaItems: number;
  readonly crockeryWithoutTea: number;
  readonly soiledClean: number;
  /** Per soil: mean score and items clean. */
  readonly bySoil: Readonly<Record<string, { meanScore: number; clean: number }>>;
  /** Log likelihood of the fitted class means, relative to a perfect match, before the weight. */
  readonly logLikelihood: number;
  /** True when the point lay outside the grid of an axis and was moved to its end. */
  readonly clamped: boolean;
}

/** The table of the class means of the literature record. */
export interface LiteratureSurface {
  /** The axes of the table and their grid values, ascending. */
  readonly axes: Readonly<Record<string, readonly number[]>>;
  readonly nuisance: readonly string[];
  /** Washes read, and the seeds they average over. */
  readonly rows: number;
  readonly seeds: readonly string[];
  /** The fitted class means the likelihood is taken over. */
  readonly classes: readonly string[];
  /**
   * The class means at a point: the interpolated axes from `at` (an axis `at` does not name is
   * taken at `fallback`), the nuisance axes at the value the record likes best.
   */
  at(values: Readonly<Record<string, number>>): SurfacePoint;
}

/** Reads the lines of surface files (`*.jsonl`). */
export function readSurfaceRows(files: readonly string[]): SurfaceRow[] {
  const rows: SurfaceRow[] = [];
  for (const file of files) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.trim() !== '') rows.push(JSON.parse(line) as SurfaceRow);
    }
  }
  return rows;
}

/** The fitted class means of a literature record. */
export function fittedAggregates(record: LiteratureRecord): ClassMeanAggregate[] {
  return record.aggregates.filter(
    (a): a is ClassMeanAggregate => a.kind === 'class_mean_score' && a.fitted,
  );
}

/** A ratio of the ends of an axis from which it is interpolated in its logarithm. */
const LOG_AXIS_FROM = 4;

/**
 * The surface of `rows` for `record`. `fallback` gives the value of an interpolated axis that a
 * query does not name (the value of the set the surface was washed about).
 */
export function createLiteratureSurface(
  record: LiteratureRecord,
  rows: readonly SurfaceRow[],
  options: {
    readonly nuisance?: readonly string[];
    readonly fallback?: Readonly<Record<string, number>>;
  } = {},
): LiteratureSurface {
  if (rows.length === 0) throw new RangeError('the surface has no washes');
  const keys = Object.keys((rows[0] as SurfaceRow).point);
  const nuisance = (options.nuisance ?? []).filter((key) => keys.includes(key));
  const free = keys.filter((key) => !nuisance.includes(key));
  const axes: Record<string, number[]> = {};
  for (const key of keys) {
    axes[key] = [...new Set(rows.map((row) => row.point[key] as number))].sort((a, b) => a - b);
  }
  const seeds = [...new Set(rows.map((row) => `L${row.levelSeed}S${row.simSeed}`))].sort();
  const aggregates = fittedAggregates(record);
  // The mean over the seeds at every grid point.
  const nodeKey = (point: Readonly<Record<string, number>>): string =>
    keys.map((key) => String(point[key])).join('|');
  interface Node {
    n: number;
    continuous: Record<string, number>;
    score: Record<string, number>;
    milkGlasses: number;
    teaItems: number;
    crockeryWithoutTea: number;
    soiledClean: number;
    bySoil: Record<string, { meanScore: number; clean: number }>;
  }
  const nodes = new Map<string, Node>();
  for (const row of rows) {
    const key = nodeKey(row.point);
    let node = nodes.get(key);
    if (node === undefined) {
      node = {
        n: 0,
        continuous: {},
        score: {},
        milkGlasses: 0,
        teaItems: 0,
        crockeryWithoutTea: 0,
        soiledClean: 0,
        bySoil: {},
      };
      nodes.set(key, node);
    }
    node.n++;
    for (const cls of [...ITEM_CLASSES, 'all']) {
      node.continuous[cls] = (node.continuous[cls] ?? 0) + (row.continuous[cls] as number);
      node.score[cls] = (node.score[cls] ?? 0) + (row.score[cls] as number);
    }
    node.milkGlasses += row.milkGlasses;
    node.teaItems += row.teaItems;
    node.crockeryWithoutTea += row.crockeryWithoutTea;
    node.soiledClean += row.soiledClean;
    for (const [soil, standing] of Object.entries(row.bySoil)) {
      const sum = (node.bySoil[soil] ??= { meanScore: 0, clean: 0 });
      sum.meanScore += standing.meanScore;
      sum.clean += standing.clean;
    }
  }
  for (const node of nodes.values()) {
    for (const cls of Object.keys(node.continuous)) {
      node.continuous[cls] = (node.continuous[cls] as number) / node.n;
      node.score[cls] = (node.score[cls] as number) / node.n;
    }
    node.milkGlasses /= node.n;
    node.teaItems /= node.n;
    node.crockeryWithoutTea /= node.n;
    node.soiledClean /= node.n;
    for (const standing of Object.values(node.bySoil)) {
      standing.meanScore /= node.n;
      standing.clean /= node.n;
    }
  }
  const coordinate = (key: string, value: number): number => {
    const grid = axes[key] as number[];
    const first = grid[0] as number;
    const last = grid[grid.length - 1] as number;
    return first > 0 && last / first >= LOG_AXIS_FROM ? Math.log(value) : value;
  };
  /** The bracket of `value` on the grid of an axis and its share of the way across it. */
  const bracket = (
    key: string,
    value: number,
  ): { lo: number; hi: number; t: number; clamped: boolean } => {
    const grid = axes[key] as number[];
    const first = grid[0] as number;
    const last = grid[grid.length - 1] as number;
    if (value <= first) return { lo: first, hi: first, t: 0, clamped: value < first };
    if (value >= last) return { lo: last, hi: last, t: 0, clamped: value > last };
    let i = 0;
    while ((grid[i + 1] as number) < value) i++;
    const lo = grid[i] as number;
    const hi = grid[i + 1] as number;
    return {
      lo,
      hi,
      t:
        (coordinate(key, value) - coordinate(key, lo)) /
        (coordinate(key, hi) - coordinate(key, lo)),
      clamped: false,
    };
  };
  const [proteasePrior] = nuisance.length > 0 ? fitParameters([nuisance[0] as string]) : [];
  const likelihoodOf = (continuous: Readonly<Record<string, number>>): number =>
    aggregates.reduce(
      (sum, a) =>
        sum +
        groupMeanLogLikelihood(a.value, continuous[a.class] as number, a.sd) -
        groupMeanLogLikelihood(a.value, a.value, a.sd),
      0,
    );
  const weight = record.weight ?? 1;
  const blend = <T extends Record<string, number>>(parts: { w: number; v: T }[]): T => {
    const out: Record<string, number> = {};
    for (const { w, v } of parts) {
      for (const [k, x] of Object.entries(v)) out[k] = (out[k] ?? 0) + w * x;
    }
    return out as T;
  };
  return {
    axes,
    nuisance,
    rows: rows.length,
    seeds,
    classes: aggregates.map((a) => a.class),
    at(values) {
      const brackets = free.map((key) => {
        const value = values[key] ?? options.fallback?.[key];
        if (value === undefined) {
          throw new RangeError(
            `the surface has an axis ${key} and the point gives no value for it`,
          );
        }
        return { key, ...bracket(key, value) };
      });
      const clamped = brackets.some((b) => b.clamped);
      // The corners of the cell with their weights.
      let corners: { w: number; point: Record<string, number> }[] = [{ w: 1, point: {} }];
      for (const b of brackets) {
        corners = corners.flatMap((corner) =>
          b.t === 0
            ? [{ w: corner.w, point: { ...corner.point, [b.key]: b.lo } }]
            : [
                { w: corner.w * (1 - b.t), point: { ...corner.point, [b.key]: b.lo } },
                { w: corner.w * b.t, point: { ...corner.point, [b.key]: b.hi } },
              ],
        );
      }
      // Every combination of the nuisance axes; the one the record likes best is taken.
      let combos: Record<string, number>[] = [{}];
      for (const key of nuisance) {
        combos = combos.flatMap((c) => (axes[key] as number[]).map((v) => ({ ...c, [key]: v })));
      }
      let best: SurfacePoint | undefined;
      let bestObjective = -Infinity;
      for (const combo of combos) {
        const parts = corners.map((corner) => {
          const node = nodes.get(nodeKey({ ...corner.point, ...combo }));
          if (node === undefined) {
            throw new RangeError(
              `the surface has no wash at ${JSON.stringify({ ...corner.point, ...combo })}`,
            );
          }
          return { w: corner.w, node };
        });
        const continuous = blend(parts.map((p) => ({ w: p.w, v: p.node.continuous })));
        const logLikelihood = likelihoodOf(continuous);
        const prior =
          proteasePrior !== undefined && nuisance.length === 1
            ? logPrior(
                [proteasePrior],
                [toZ(proteasePrior, combo[nuisance[0] as string] as number)],
              )
            : 0;
        const objective = weight * logLikelihood + prior;
        if (objective <= bestObjective) continue;
        bestObjective = objective;
        const scalar = (of: (node: Node) => number): number =>
          parts.reduce((sum, p) => sum + p.w * of(p.node), 0);
        const soils = Object.keys((parts[0] as { node: Node }).node.bySoil);
        best = {
          nuisance: combo,
          continuous,
          score: blend(parts.map((p) => ({ w: p.w, v: p.node.score }))),
          milkGlasses: scalar((n) => n.milkGlasses),
          teaItems: scalar((n) => n.teaItems),
          crockeryWithoutTea: scalar((n) => n.crockeryWithoutTea),
          soiledClean: scalar((n) => n.soiledClean),
          bySoil: Object.fromEntries(
            soils.map((soil) => [
              soil,
              {
                meanScore: scalar((n) => n.bySoil[soil]?.meanScore ?? Number.NaN),
                clean: scalar((n) => n.bySoil[soil]?.clean ?? Number.NaN),
              },
            ]),
          ),
          logLikelihood,
          clamped,
        };
      }
      return best as SurfacePoint;
    },
  };
}

/**
 * The literature record with its fitted class means as observations of groups of items
 * (`group_observations`, the tool's own form of a published mean score): every item of a
 * class with the weight of its type in the standard load over the items of that type the
 * record holds. The tool's likelihood of the record is then that of its class means
 * (`groupMeanLogLikelihood`) with the record's weight.
 */
export function literatureAsGroupRecord(record: LiteratureRecord): WashRecord {
  const count = new Map<string, number>();
  for (const item of record.load.items) count.set(item.type, (count.get(item.type) ?? 0) + 1);
  const groups: RecordGroupObservation[] = fittedAggregates(record).map((a) => ({
    id: a.id,
    kind: 'mean_score',
    items: record.load.items
      .filter((item) => (itemClassOf(item.type) as ItemClass | undefined) === a.class)
      .map((item) => ({
        item: item.id,
        weight: (record.standard_composition[item.type] ?? 0) / (count.get(item.type) ?? 1),
      }))
      .filter((member) => member.weight > 0),
    value: a.value,
    sd: a.sd,
    method: a.method,
    notes: a.sd_basis,
  }));
  return { ...record, group_observations: groups };
}
