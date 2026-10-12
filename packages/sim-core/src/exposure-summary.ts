/**
 * The exposure summary of a wash result: per item and per region, what the water did there in
 * every spray state and over the programme, reduced from the exposure sets on the blocks and
 * soil cells of the scene (docs/design/scope.md, items 1 to 5 of "What links stacking to
 * cleaning").
 *
 * It is made so that reports, the phenomena suite and the calibration tool need not compute
 * it again from the tables. It is a diagnostic of the simulation, not part of what a player
 * is told: the game's report does not carry it (`@spotless/wash-runner`).
 *
 * Means are over the area of the region. "Over the programme" weights every spray state by
 * the time it is active (the pump-off time is not in it).
 *
 * Units: SI except where a name says otherwise (mm2, grams).
 */

import {
  JET_FIELD,
  JET_FIELD_COUNT,
  WATER_FIELD,
  WATER_FIELD_COUNT,
  type ExposureSet,
} from '@spotless/sim-film';
import { SCENE_NONE, type WashScene } from '@spotless/sim-scene';

/** What the water did to one region of an item while one spray state was active. */
export interface RegionStateExposure {
  /** Share of the time under a direct jet: inside a footprint (shear above the first level). */
  readonly jetShare: number;
  /** Share of the time under the fast film of a jet at all, out to its film jump. */
  readonly jetFilmShare: number;
  /** Share of the area a direct jet ever reaches. */
  readonly jetArea: number;
  /** Largest wall shear of a jet anywhere on the region, Pa. */
  readonly jetShearPeak: number;
  /** Share of the time there is water on the surface (film, rivulet or drops). */
  readonly wetTime: number;
  /** Share of the area that is never wet. */
  readonly dryArea: number;
  /**
   * Water received, kg/(m2 s): what lands out of the air per area, plus what runs on from the
   * surface above per width over the reference run `film.renewalLength` (the surface-water
   * table's `flux`: the same at both tiers).
   */
  readonly flux: number;
  /** Rate at which the liquor on the surface is replaced by liquor from the bulk, 1/s. */
  readonly exchange: number;
  /** Rate at which the water on a block is replaced along the reference run, 1/s. */
  readonly renewal: number;
  /** Wall shear of the flowing film, Pa. */
  readonly filmShear: number;
}

/** What the water did to one region of an item. */
export interface RegionExposure extends RegionStateExposure {
  readonly regionId: string;
  /** Area of the region as the scene grids it, mm2. */
  readonly areaMm2: number;
  /** Share of the area that is dry in every spray state. */
  readonly neverWetArea: number;
  /** Share of the area under water when the pools of the item are full. */
  readonly pooledArea: number;
  /** Water left on the region as film and drops at the end of the wash, grams. */
  readonly retained_g: number;
  /** The same per spray state, in the order of `MachineWashResult.states`. */
  readonly states: readonly RegionStateExposure[];
}

/** The exposure summary of one item. */
export interface ItemExposure {
  /** Per region of the item's shape, in shape order (`ItemWashResult.regionIds`). */
  readonly regions: readonly RegionExposure[];
}

/** One spray state as the summary reads it. */
export interface SummaryState {
  /** Time the state is active in the programme, seconds: its weight. */
  readonly duration: number;
  readonly set: ExposureSet;
  /** Row of every soil cell of the scene in the jet table of the set, or -1. */
  readonly jetRow: Int32Array;
}

/** The row of every soil cell of a scene in the jet table of an exposure set, or -1. */
export function jetRowsOf(scene: WashScene, set: ExposureSet): Int32Array {
  const rows = new Int32Array(scene.soilCells.count).fill(-1);
  for (let i = 0; i < set.jets.cell.length; i++) rows[set.jets.cell[i] as number] = i;
  return rows;
}

interface Sums {
  jet: number;
  jetFilm: number;
  jetArea: number;
  peak: number;
  wet: number;
  dry: number;
  flux: number;
  exchange: number;
  renewal: number;
  shear: number;
}

const zero = (): Sums => ({
  jet: 0,
  jetFilm: 0,
  jetArea: 0,
  peak: 0,
  wet: 0,
  dry: 0,
  flux: 0,
  exchange: 0,
  renewal: 0,
  shear: 0,
});

/**
 * The exposure summary of the item at `instanceIndex` (see the file comment). `retainedFilm`
 * is the water left on every block at the end of the wash, kg/m2.
 */
export function summariseItemExposure(
  scene: WashScene,
  instanceIndex: number,
  regionIds: readonly string[],
  states: readonly SummaryState[],
  retainedFilm: Float32Array,
): ItemExposure {
  const instance = scene.instances[instanceIndex];
  if (instance === undefined) throw new RangeError('summariseItemExposure: no such instance');
  const { blocks, soilCells } = scene;
  const R = regionIds.length;
  // Region slot of every region index of the shape.
  const slotOf = instance.shape.regions.map((region) => regionIds.indexOf(region.id));
  const area = new Float64Array(R);
  const cellArea = new Float64Array(R);
  const neverWet = new Float64Array(R);
  const pooled = new Float64Array(R);
  const retained = new Float64Array(R);
  const sums: Sums[][] = states.map(() => Array.from({ length: R }, zero));
  const first = instance.firstBlock;
  const end = first + instance.blockCount;
  for (let b = first; b < end; b++) {
    const regionIndex = blocks.region[b] as number;
    const slot = regionIndex >= 0 ? (slotOf[regionIndex] ?? -1) : -1;
    if (slot < 0) continue;
    const a = blocks.area[b] as number;
    area[slot] = (area[slot] as number) + a;
    retained[slot] = (retained[slot] as number) + (retainedFilm[b] as number) * a;
    let everWet = false;
    let underPool = false;
    const o = WATER_FIELD_COUNT * b;
    const firstCell = blocks.soilFirst[b] as number;
    for (let k = 0; k < states.length; k++) {
      const state = states[k] as SummaryState;
      const w = state.set.water.values;
      const sum = (sums[k] as Sums[])[slot] as Sums;
      const wet = Math.max(
        w[o + WATER_FIELD.wetTime] as number,
        w[o + WATER_FIELD.wetFraction] as number,
      );
      if (wet > 0) everWet = true;
      else sum.dry += a;
      sum.wet += wet * a;
      sum.flux += (w[o + WATER_FIELD.flux] as number) * a;
      sum.exchange += (w[o + WATER_FIELD.exchange] as number) * a;
      sum.renewal += (w[o + WATER_FIELD.renewal] as number) * a;
      sum.shear += (w[o + WATER_FIELD.shear] as number) * a;
      if ((w[o + WATER_FIELD.poolDepth] as number) > 0) underPool = true;
      if (firstCell === SCENE_NONE) continue;
      const jets = state.set.jets.values;
      for (let q = 0; q < 4; q++) {
        const c = firstCell + q;
        const ca = soilCells.area[c] as number;
        if (!(ca > 0)) continue;
        const row = state.jetRow[c] as number;
        if (row < 0) continue;
        const j = JET_FIELD_COUNT * row;
        const duty = jets[j + JET_FIELD.duty] as number;
        sum.jet += duty * ca;
        sum.jetFilm += (jets[j + JET_FIELD.wetDuty] as number) * ca;
        if (duty > 0) sum.jetArea += ca;
        const peak = jets[j + JET_FIELD.shearPeak] as number;
        if (peak > sum.peak) sum.peak = peak;
      }
    }
    if (firstCell !== SCENE_NONE) {
      for (let q = 0; q < 4; q++) {
        const ca = soilCells.area[firstCell + q] as number;
        if (ca > 0) cellArea[slot] = (cellArea[slot] as number) + ca;
      }
    }
    if (!everWet) neverWet[slot] = (neverWet[slot] as number) + a;
    if (underPool) pooled[slot] = (pooled[slot] as number) + a;
  }
  let sprayed = 0;
  for (const state of states) sprayed += state.duration;
  const regions: RegionExposure[] = regionIds.map((regionId, slot) => {
    const a = area[slot] as number;
    const ca = cellArea[slot] as number;
    const of = (sum: Sums): RegionStateExposure => ({
      jetShare: ca > 0 ? sum.jet / ca : 0,
      jetFilmShare: ca > 0 ? sum.jetFilm / ca : 0,
      jetArea: ca > 0 ? sum.jetArea / ca : 0,
      jetShearPeak: sum.peak,
      wetTime: a > 0 ? sum.wet / a : 0,
      dryArea: a > 0 ? sum.dry / a : 0,
      flux: a > 0 ? sum.flux / a : 0,
      exchange: a > 0 ? sum.exchange / a : 0,
      renewal: a > 0 ? sum.renewal / a : 0,
      filmShear: a > 0 ? sum.shear / a : 0,
    });
    const perState = states.map((_, k) => of((sums[k] as Sums[])[slot] as Sums));
    // Over the programme: every state by the time it is active.
    const mean = (pick: (e: RegionStateExposure) => number): number => {
      if (!(sprayed > 0)) return 0;
      let total = 0;
      perState.forEach((e, k) => {
        total += pick(e) * (states[k] as SummaryState).duration;
      });
      return total / sprayed;
    };
    return {
      regionId,
      areaMm2: a * 1e6,
      jetShare: mean((e) => e.jetShare),
      jetFilmShare: mean((e) => e.jetFilmShare),
      jetArea: perState.reduce((most, e) => Math.max(most, e.jetArea), 0),
      jetShearPeak: perState.reduce((most, e) => Math.max(most, e.jetShearPeak), 0),
      wetTime: mean((e) => e.wetTime),
      dryArea: mean((e) => e.dryArea),
      flux: mean((e) => e.flux),
      exchange: mean((e) => e.exchange),
      renewal: mean((e) => e.renewal),
      filmShear: mean((e) => e.filmShear),
      neverWetArea: a > 0 ? (neverWet[slot] as number) / a : 0,
      pooledArea: a > 0 ? (pooled[slot] as number) / a : 0,
      retained_g: (retained[slot] as number) * 1000,
      states: perState,
    };
  });
  return { regions };
}
