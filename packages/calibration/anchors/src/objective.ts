/**
 * How a simulated wash of the standard load is compared with the published class means of a
 * literature record (`literature.ts`): the class means of the simulation with the item types
 * weighted as in the standard load, a continuous form of the IEC score for the fit, and the
 * terms of the log likelihood.
 *
 *   class mean      m_c = sum_types n_std(type) mean_sim(type) / sum_types n_std(type)
 *                   over the item types of class c that the record holds
 *   class term      -1/2 ((m_c - y_c) / sd_c)^2      for every fitted class mean
 *   ranking term    -1/2 (max(0, m_lower - m_higher) / sd)^2   for every pair the ranking orders
 *
 * The continuous score of an item is the calibration tool's for specks
 * (`continuousSpeckScore`) and, for the visibly soiled area, the IEC bands made continuous in
 * the logarithm of the area: half way between two scores at a band edge. It is used by the fit
 * only; every reported mean is of the inspector's own whole-number scores. The fit reads it
 * with the tea items set to the middle of the scale (`UNFITTED_SOILS`).
 */

import type { ItemWashResult } from '@spotless/sim-core';
import { continuousSpeckScore } from '../../src/index.ts';
import type { ClassMeanAggregate, LiteratureRecord, RankingAggregate } from './literature.ts';
import { ITEM_CLASSES, itemClassOf, type ItemClass } from './summary.ts';

/** The IEC area bands (mm2 up to which the score is 5, 4, 3, 2, 1) and speck bands (5, 4, 3). */
export const IEC_AREA_BANDS = [0, 4, 20, 50, 200] as const;
export const IEC_SPECK_BANDS = [0, 4, 10] as const;

/** Smallest visibly soiled area that is seen, mm2 (a speck of 0.3 mm): score 5 below it. */
const SEEN_FROM_MM2 = 0.07;

/**
 * The IEC score by area made continuous: 5 for nothing, 4.5 at the smallest area that is
 * seen, then linear in ln(area) through k + 1/2 at the edge between the scores k + 1 and k
 * (3.5 at 4 mm2, 2.5 at 20, 1.5 at 50, 0.5 at 200), and 0 from four times the last edge.
 */
export function continuousAreaScore(areaMm2: number): number {
  if (!(areaMm2 > 0)) return 5;
  const knots: [number, number][] = [
    [SEEN_FROM_MM2 / 4, 5],
    [SEEN_FROM_MM2, 4.5],
    [4, 3.5],
    [20, 2.5],
    [50, 1.5],
    [200, 0.5],
    [800, 0],
  ];
  if (areaMm2 <= (knots[0] as [number, number])[0]) return 5;
  for (let i = 1; i < knots.length; i++) {
    const [a1, s1] = knots[i] as [number, number];
    if (areaMm2 <= a1) {
      const [a0, s0] = knots[i - 1] as [number, number];
      return s0 + ((s1 - s0) * Math.log(areaMm2 / a0)) / Math.log(a1 / a0);
    }
  }
  return 0;
}

/** The continuous IEC score of an item: the lower of the score by area and the score by specks. */
export function continuousItemScore(
  item: Pick<ItemWashResult, 'visibleAreaMm2' | 'specks'>,
): number {
  return Math.min(
    continuousAreaScore(item.visibleAreaMm2),
    continuousSpeckScore(item.specks, IEC_SPECK_BANDS),
  );
}

/**
 * Soils whose items the fit does not read (their score is set to the middle of the scale in
 * `ClassMeans.fitted`). None since the third anchoring: the second left the tea out, with its
 * visibility level and its film mass unresolved; both are set from evidence now
 * (`soil.tea.visibleMass`, the soil data of `@spotless/sim-soil`), so the crockery mean, tea
 * included, identifies the bleach rate.
 */
export const UNFITTED_SOILS: readonly string[] = [];

/** The tea soils: their items are reported apart from the plates and bowls of the crockery class. */
export const TEA_SOILS: readonly string[] = ['iec_tea'];

/** The score an item with an unfitted soil is given in the fit: the middle of the scale. */
// literal-ok-begin: named arithmetic control, documented where it is declared
export const UNFITTED_SCORE = 2.5;
// literal-ok-end

/** Class means of a simulated wash, the item types weighted as in the standard load. */
export interface ClassMeans {
  /**
   * The continuous score with every item that carries an unfitted soil (tea) set to the middle
   * of the scale: what the class terms of the fit read, so that no parameter is moved by a
   * soil the record cannot identify (see `UNFITTED_SOILS`).
   */
  readonly fitted: Readonly<Record<ItemClass | 'all', number>>;
  /**
   * Mean whole-number score of the soiled items only, weighted to the standard composition,
   * and the share of them clean: the class means are carried by the unsoiled items (30 of the
   * 69 pieces of cutlery), so these say more about the soil model.
   */
  readonly soiled: Readonly<Record<ItemClass | 'all', number>>;
  readonly soiledCleanShare: Readonly<Record<ItemClass | 'all', number>>;
  /** Mean score of the milk glasses alone (the glass class without the glass dessert bowls). */
  readonly milkGlasses: number;
  /** Mean score of the items that carry tea, and of the crockery that does not. */
  readonly teaItems: number;
  readonly crockeryWithoutTea: number;
  /** Mean of the inspector's whole-number scores, weighted to the standard composition. */
  readonly score: Readonly<Record<ItemClass | 'all', number>>;
  /** The same of the continuous score. */
  readonly continuous: Readonly<Record<ItemClass | 'all', number>>;
  /** Unweighted mean of the whole-number scores over the items of the record. */
  readonly raw: Readonly<Record<ItemClass | 'all', number>>;
  /** Share of items clean by the game's rule, weighted to the standard composition, and unweighted. */
  readonly cleanShare: number;
  readonly cleanShareRaw: number;
}

/** How the items that carry one soil stand in a wash: what the floor rule of the fit reads. */
export interface SoilStanding {
  /** Number of items of the record that carry the soil, and their mean whole-number score. */
  readonly items: number;
  readonly mean: number;
  /**
   * Per class that holds such items (and for the whole load): the highest value the class
   * mean could take with those items as they scored and every other item of the class at the
   * top of the scale (5), the item types weighted as in the standard load.
   */
  readonly ceiling: Readonly<Partial<Record<ItemClass | 'all', number>>>;
}

/** The top of the IEC scale. */
const TOP_SCORE = 5;

/**
 * The standing of every soil of a wash (see {@link SoilStanding}), by soil id. A class mean
 * that a record publishes above the ceiling a soil leaves it cannot be met while the items
 * of that soil score as they do, whatever the rest of the class does.
 */
export function soilStandings(
  items: readonly ItemWashResult[],
  composition: Readonly<Record<string, number>>,
): Record<string, SoilStanding> {
  const soils = new Set<string>();
  for (const item of items) for (const soil of item.soils) soils.add(soil.type);
  const byType = new Map<string, ItemWashResult[]>();
  for (const item of items) {
    const list = byType.get(item.typeId);
    if (list === undefined) byType.set(item.typeId, [item]);
    else list.push(item);
  }
  const out: Record<string, SoilStanding> = {};
  for (const soil of [...soils].sort()) {
    const carries = (item: ItemWashResult): boolean => item.soils.some((s) => s.type === soil);
    const carriers = items.filter(carries);
    const weight: Partial<Record<ItemClass | 'all', number>> = {};
    const sum: Partial<Record<ItemClass | 'all', number>> = {};
    const holds = new Set<ItemClass | 'all'>();
    for (const [type, list] of byType) {
      const cls = itemClassOf(type);
      if (cls === undefined) continue;
      const n = composition[type] ?? 0;
      const best =
        list.reduce((total, item) => total + (carries(item) ? item.score : TOP_SCORE), 0) /
        list.length;
      for (const key of [cls, 'all'] as const) {
        weight[key] = (weight[key] ?? 0) + n;
        sum[key] = (sum[key] ?? 0) + n * best;
        if (n > 0 && list.some(carries)) holds.add(key);
      }
    }
    const ceiling: Partial<Record<ItemClass | 'all', number>> = {};
    for (const key of holds) {
      const w = weight[key] ?? 0;
      if (w > 0) ceiling[key] = (sum[key] ?? 0) / w;
    }
    out[soil] = {
      items: carriers.length,
      mean:
        carriers.length > 0
          ? carriers.reduce((total, item) => total + item.score, 0) / carriers.length
          : Number.NaN,
      ceiling,
    };
  }
  return out;
}

/**
 * The class means of a wash. `composition` gives the items of each catalogue type in the
 * standard load; a type the wash does not hold is left out of its class (its weight is not
 * given to the others), a type the standard does not hold counts with weight 0.
 */
export function classMeans(
  items: readonly ItemWashResult[],
  composition: Readonly<Record<string, number>>,
): ClassMeans {
  const carriesTea = (item: ItemWashResult): boolean =>
    item.soils.some((soil) => TEA_SOILS.includes(soil.type));
  const unfitted = (item: ItemWashResult): boolean =>
    item.soils.some((soil) => UNFITTED_SOILS.includes(soil.type));
  const meanOf = (list: readonly ItemWashResult[]): number =>
    list.length > 0 ? list.reduce((sum, item) => sum + item.score, 0) / list.length : Number.NaN;
  const byType = new Map<string, ItemWashResult[]>();
  for (const item of items) {
    const list = byType.get(item.typeId);
    if (list === undefined) byType.set(item.typeId, [item]);
    else list.push(item);
  }
  const zero = (): Record<ItemClass | 'all', number> => ({
    crockery: 0,
    cutlery: 0,
    glass: 0,
    melamine: 0,
    pots: 0,
    all: 0,
  });
  const weight = zero();
  const score = zero();
  const continuous = zero();
  const fitted = zero();
  const soiledWeight = zero();
  const soiled = zero();
  const soiledClean = zero();
  const rawSum = zero();
  const rawCount = zero();
  let clean = 0;
  let cleanRaw = 0;
  for (const [type, list] of byType) {
    const cls = itemClassOf(type);
    if (cls === undefined) continue;
    const n = composition[type] ?? 0;
    const mean = list.reduce((sum, item) => sum + item.score, 0) / list.length;
    const meanContinuous =
      list.reduce((sum, item) => sum + continuousItemScore(item), 0) / list.length;
    const share = list.filter((item) => item.clean).length / list.length;
    const meanFitted =
      list.reduce(
        (sum, item) => sum + (unfitted(item) ? UNFITTED_SCORE : continuousItemScore(item)),
        0,
      ) / list.length;
    const dirty = list.filter((item) => item.initialMass_mg > 0);
    for (const key of [cls, 'all'] as const) {
      weight[key] += n;
      score[key] += n * mean;
      continuous[key] += n * meanContinuous;
      fitted[key] += n * meanFitted;
      if (dirty.length > 0) {
        soiledWeight[key] += n;
        soiled[key] += n * meanOf(dirty);
        soiledClean[key] += (n * dirty.filter((item) => item.clean).length) / dirty.length;
      }
      rawSum[key] += list.reduce((sum, item) => sum + item.score, 0);
      rawCount[key] += list.length;
    }
    clean += n * share;
    cleanRaw += list.filter((item) => item.clean).length;
  }
  const raw = zero();
  for (const key of [...ITEM_CLASSES, 'all'] as const) {
    score[key] = weight[key] > 0 ? score[key] / weight[key] : Number.NaN;
    continuous[key] = weight[key] > 0 ? continuous[key] / weight[key] : Number.NaN;
    fitted[key] = weight[key] > 0 ? fitted[key] / weight[key] : Number.NaN;
    soiled[key] = soiledWeight[key] > 0 ? soiled[key] / soiledWeight[key] : Number.NaN;
    soiledClean[key] = soiledWeight[key] > 0 ? soiledClean[key] / soiledWeight[key] : Number.NaN;
    raw[key] = rawCount[key] > 0 ? rawSum[key] / rawCount[key] : Number.NaN;
  }
  // Crockery without its tea items, weighted to the standard composition.
  let plateWeight = 0;
  let plateSum = 0;
  for (const [type, list] of byType) {
    if (itemClassOf(type) !== 'crockery' || list.some(carriesTea)) continue;
    const n = composition[type] ?? 0;
    plateWeight += n;
    plateSum += n * meanOf(list);
  }
  return {
    fitted,
    soiled,
    soiledCleanShare: soiledClean,
    milkGlasses: meanOf(
      items.filter((item) => item.soils.some((soil) => soil.type === 'iec_milk')),
    ),
    teaItems: meanOf(items.filter(carriesTea)),
    crockeryWithoutTea: plateWeight > 0 ? plateSum / plateWeight : Number.NaN,
    score,
    continuous,
    raw,
    cleanShare: weight.all > 0 ? clean / weight.all : Number.NaN,
    cleanShareRaw: rawCount.all > 0 ? cleanRaw / rawCount.all : Number.NaN,
  };
}

/** One term of the comparison with a literature record. */
export interface AggregateTerm {
  readonly id: string;
  /** Published value and its uncertainty; simulated value (continuous score); (sim - obs) / sd. */
  readonly value: number;
  readonly sd: number;
  readonly simulated: number;
  readonly z: number;
  /** Its part of the log likelihood before the weight of the record; 0 for a term not fitted. */
  readonly logLikelihood: number;
}

/** The terms of a wash against the aggregates of a literature record, and their weighted sum. */
export function aggregateTerms(
  record: LiteratureRecord,
  means: ClassMeans,
): { readonly terms: readonly AggregateTerm[]; readonly logLikelihood: number } {
  const terms: AggregateTerm[] = [];
  let sum = 0;
  for (const aggregate of record.aggregates) {
    if (aggregate.kind === 'class_mean_score') {
      const a: ClassMeanAggregate = aggregate;
      const simulated = means.fitted[a.class];
      const z = (simulated - a.value) / a.sd;
      const logLikelihood = a.fitted ? -0.5 * z * z : 0;
      sum += logLikelihood;
      terms.push({ id: a.id, value: a.value, sd: a.sd, simulated, z, logLikelihood });
    } else {
      const r: RankingAggregate = aggregate;
      for (let i = 0; i + 1 < r.order.length; i++) {
        for (const higher of r.order[i] ?? []) {
          for (const lower of r.order.slice(i + 1).flat()) {
            const gap = means.fitted[lower] - means.fitted[higher];
            const z = Math.max(0, gap) / r.sd;
            const logLikelihood = -0.5 * z * z;
            sum += logLikelihood;
            terms.push({
              id: `${r.id}.${higher}>${lower}`,
              value: 0,
              sd: r.sd,
              simulated: gap,
              z,
              logLikelihood,
            });
          }
        }
      }
    }
  }
  return { terms, logLikelihood: (record.weight ?? 1) * sum };
}
