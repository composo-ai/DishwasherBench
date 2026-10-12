/**
 * What explains a result without a debugger: for every item and region of a wash, what the
 * water did to it in each spray state (from the exposure set, on the scene's blocks and soil
 * cells), put together over the programme by the time each state is active; the pools; and
 * the liquor of the wash.
 *
 * {@link summariseExposure} reduces one exposure set to sums per item and region. The sums are
 * small and are kept beside the cached exposure set (`<cache>/diagnostics/<key>.json`), so
 * that a wash whose exposure comes from the cache needs no scene to be explained.
 *
 * Units: SI in the stored sums (m2, Pa, kg/(m2 s)); the units of the report in
 * {@link SurfaceExposure}.
 */

import { poseInverseTransformPoint } from '@spotless/core';
import { signedDistance } from '@spotless/geometry';
import {
  JET_FIELD,
  JET_FIELD_COUNT,
  SCENE_NONE,
  WATER_FIELD,
  WATER_FIELD_COUNT,
  type ExposureSet,
  type WashResult,
  type WashScene,
} from '@spotless/sim-core';
import type { LiquorSummary, PoolDiagnostic, SurfaceExposure } from './types.ts';

/** Version of the stored summaries; raise it when a sum changes its meaning. */
export const DIAGNOSTICS_VERSION = 2;

/** Sums over one region of one item in one spray state. Areas in m2. */
export interface RegionSums {
  readonly region: string;
  /** Area of its blocks, and of its soil cells. */
  readonly area: number;
  readonly cellArea: number;
  /** Soil-cell area times duty, area ever under a footprint, and that area times peak shear. */
  readonly duty: number;
  readonly jetArea: number;
  readonly peakSum: number;
  readonly peakMax: number;
  /** Soil-cell area times duty times mean shear inside the footprint. */
  readonly shearDuty: number;
  /** Block area times: wet fraction, wet time, flux, renewal, film shear, film thickness, retained. */
  readonly wetFraction: number;
  readonly wetTime: number;
  readonly flux: number;
  readonly renewal: number;
  readonly filmShear: number;
  readonly thickness: number;
  readonly retained: number;
  /** Block area that is wet at all, and that lies under a pool when the pool is full. */
  readonly wetArea: number;
  readonly pooledArea: number;
}

/** One item in one spray state. */
export interface ItemSums {
  readonly regions: readonly RegionSums[];
  /** Its basins: what each holds, m3, and the water entering it in this state, kg/s. */
  readonly basins: readonly { readonly capacity: number; readonly inflow: number }[];
  /** Contacts of the scene (surfaces nearer than `scene.contactGap`) that involve the item. */
  readonly contacts: number;
}

/** One exposure set reduced to what the reports show. */
export interface StateSums {
  readonly version: number;
  readonly stateId: string;
  readonly items: Readonly<Record<string, ItemSums>>;
  /** Per item with an exact pose: how deep it cuts into anything, metres, and into what. */
  readonly overlaps: Readonly<Record<string, { readonly depth: number; readonly with: string }>>;
}

interface Acc {
  region: string;
  area: number;
  cellArea: number;
  duty: number;
  jetArea: number;
  peakSum: number;
  peakMax: number;
  shearDuty: number;
  wetFraction: number;
  wetTime: number;
  flux: number;
  renewal: number;
  filmShear: number;
  thickness: number;
  retained: number;
  wetArea: number;
  pooledArea: number;
}

const emptyAcc = (region: string): Acc => ({
  region,
  area: 0,
  cellArea: 0,
  duty: 0,
  jetArea: 0,
  peakSum: 0,
  peakMax: 0,
  shearDuty: 0,
  wetFraction: 0,
  wetTime: 0,
  flux: 0,
  renewal: 0,
  filmShear: 0,
  thickness: 0,
  retained: 0,
  wetArea: 0,
  pooledArea: 0,
});

/** Most block centres of one instance tested against the shape of another. */
const OVERLAP_SAMPLES = 4000;

/**
 * How deep an item cuts into anything else of the scene, metres, and into what: block centres
 * of the item inside the shape of another instance, and block centres of other instances
 * inside the shape of the item (wires are thinner than a block, so both ways are needed).
 * Rotating parts are tested where they stand at arm angle 0.
 */
export function deepestOverlap(scene: WashScene, itemId: string): { depth: number; with: string } {
  const index = scene.itemInstance.get(itemId);
  const item = index === undefined ? undefined : scene.instances[index];
  if (item === undefined) return { depth: 0, with: '' };
  const { blocks } = scene;
  let depth = 0;
  let into = '';
  for (const other of scene.instances) {
    if (other.index === item.index) continue;
    let apart = false;
    for (let k = 0; k < 3 && !apart; k++) {
      apart =
        (item.box.min[k] as number) > (other.box.max[k] as number) ||
        (item.box.max[k] as number) < (other.box.min[k] as number);
    }
    if (apart) continue;
    const probe = (from: typeof item, shapeOf: typeof item): void => {
      const stride = Math.max(1, Math.ceil(from.blockCount / OVERLAP_SAMPLES));
      for (let b = from.firstBlock; b < from.firstBlock + from.blockCount; b += stride) {
        const x = blocks.centre[3 * b] as number;
        const y = blocks.centre[3 * b + 1] as number;
        const z = blocks.centre[3 * b + 2] as number;
        if (
          x < shapeOf.box.min[0] ||
          x > shapeOf.box.max[0] ||
          y < shapeOf.box.min[1] ||
          y > shapeOf.box.max[1] ||
          z < shapeOf.box.min[2] ||
          z > shapeOf.box.max[2]
        ) {
          continue;
        }
        const d = signedDistance(shapeOf.shape, poseInverseTransformPoint(shapeOf.pose, [x, y, z]));
        if (-d > depth) {
          depth = -d;
          into = other.id;
        }
      }
    };
    probe(item, other);
    probe(other, item);
  }
  return { depth, with: into };
}

/**
 * Reduces the exposure set of one spray state to sums per item and region, with the basins
 * and contacts of every item and the overlaps of the items in `exact`.
 */
export function summariseExposure(
  scene: WashScene,
  set: ExposureSet,
  exact: readonly string[],
): StateSums {
  const { blocks, soilCells } = scene;
  const jetOf = new Int32Array(soilCells.count).fill(-1);
  for (let i = 0; i < set.jets.cell.length; i++) jetOf[set.jets.cell[i] as number] = i;
  const jets = set.jets.values;
  const water = set.water.values;
  const fields = blocks.count > 0 ? water.length / blocks.count : WATER_FIELD_COUNT;
  const hasWetTime = fields > WATER_FIELD.wetTime;
  const contactsOf = new Map<number, number>();
  for (let c = 0; c < scene.contacts.blockA.length; c++) {
    for (const b of [scene.contacts.blockA[c] as number, scene.contacts.blockB[c] as number]) {
      const instance = blocks.instance[b] as number;
      contactsOf.set(instance, (contactsOf.get(instance) ?? 0) + 1);
    }
  }
  const items: Record<string, ItemSums> = {};
  for (const instance of scene.instances) {
    if (instance.kind !== 'item') continue;
    const accs = new Map<string, Acc>();
    for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
      const regionIndex = blocks.region[b] as number;
      const region = regionIndex >= 0 ? (instance.shape.regions[regionIndex]?.id ?? '') : '';
      let acc = accs.get(region);
      if (acc === undefined) {
        acc = emptyAcc(region);
        accs.set(region, acc);
      }
      const area = blocks.area[b] as number;
      const o = fields * b;
      const wetFraction = water[o + WATER_FIELD.wetFraction] as number;
      const wetTime = hasWetTime
        ? Math.max(water[o + WATER_FIELD.wetTime] as number, wetFraction)
        : wetFraction;
      acc.area += area;
      acc.wetFraction += area * wetFraction;
      acc.wetTime += area * wetTime;
      acc.flux += area * (water[o + WATER_FIELD.flux] as number);
      acc.renewal += area * (water[o + WATER_FIELD.renewal] as number);
      acc.filmShear += area * (water[o + WATER_FIELD.shear] as number);
      acc.thickness += area * (water[o + WATER_FIELD.thickness] as number);
      acc.retained += area * (water[o + WATER_FIELD.retained] as number);
      if (wetTime > 0) acc.wetArea += area;
      if ((water[o + WATER_FIELD.poolDepth] as number) > 0) acc.pooledArea += area;
      const first = blocks.soilFirst[b] as number;
      if (first === SCENE_NONE) continue;
      for (let q = 0; q < 4; q++) {
        const cell = first + q;
        const cellArea = soilCells.area[cell] as number;
        acc.cellArea += cellArea;
        const row = jetOf[cell] as number;
        if (row < 0) continue;
        const j = JET_FIELD_COUNT * row;
        const duty = jets[j + JET_FIELD.duty] as number;
        if (!(duty > 0)) continue;
        const peak = jets[j + JET_FIELD.shearPeak] as number;
        acc.duty += cellArea * duty;
        acc.jetArea += cellArea;
        acc.peakSum += cellArea * peak;
        if (peak > acc.peakMax) acc.peakMax = peak;
        acc.shearDuty += cellArea * duty * (jets[j + JET_FIELD.shearMean] as number);
      }
    }
    const basins = scene.basins
      .map((basin, k) => ({ basin, k }))
      .filter((entry) => entry.basin.instance === instance.index)
      .map((entry) => ({
        capacity: entry.basin.volume,
        inflow: set.poolInflow[entry.k] as number,
      }));
    items[instance.id] = {
      regions: [...accs.values()].sort((a, b) =>
        a.region < b.region ? -1 : a.region > b.region ? 1 : 0,
      ),
      basins,
      contacts: contactsOf.get(instance.index) ?? 0,
    };
  }
  const overlaps: Record<string, { depth: number; with: string }> = {};
  for (const id of [...exact].sort()) overlaps[id] = deepestOverlap(scene, id);
  return { version: DIAGNOSTICS_VERSION, stateId: set.stateId, items, overlaps };
}

/** Density of the water of the pools, kg/m3 (water at about 50 C; for fill times only). */
const POOL_WATER_DENSITY = 988;

/**
 * The exposure of some regions of an item over the programme: the sums of every spray state
 * weighted by the time the state is active. `regions` empty or absent means the whole item.
 * Shares of area that hold "in at least one state" are the largest share of any state (a
 * lower bound of the union, which the sums cannot give).
 */
export function exposureOver(
  states: readonly { readonly sums: StateSums; readonly duration: number }[],
  itemId: string,
  regions?: readonly string[],
): SurfaceExposure {
  let total = 0;
  let area = 0;
  let fJet = 0;
  let jetShare = 0;
  let peakMax = 0;
  let peakSum = 0;
  let peakArea = 0;
  let shearDuty = 0;
  let dutySum = 0;
  let wetFraction = 0;
  let wetTime = 0;
  let wetShare = 0;
  let flux = 0;
  let renewal = 0;
  let filmShear = 0;
  let thickness = 0;
  let pooled = 0;
  let retained = 0;
  for (const state of states) {
    const item = state.sums.items[itemId];
    if (item === undefined) continue;
    const acc = emptyAcc('');
    for (const r of item.regions) {
      if (regions !== undefined && regions.length > 0 && !regions.includes(r.region)) continue;
      for (const key of Object.keys(acc) as (keyof Acc)[]) {
        if (key === 'region') continue;
        if (key === 'peakMax') acc.peakMax = Math.max(acc.peakMax, r.peakMax);
        else acc[key] += r[key];
      }
    }
    if (!(acc.area > 0)) continue;
    const w = state.duration;
    total += w;
    area = acc.area;
    const cells = acc.cellArea > 0 ? acc.cellArea : 1;
    fJet += (w * acc.duty) / cells;
    jetShare = Math.max(jetShare, acc.jetArea / cells);
    peakMax = Math.max(peakMax, acc.peakMax);
    peakSum += w * acc.peakSum;
    peakArea += w * acc.jetArea;
    shearDuty += w * acc.shearDuty;
    dutySum += w * acc.duty;
    wetFraction += (w * acc.wetFraction) / acc.area;
    wetTime += (w * acc.wetTime) / acc.area;
    wetShare = Math.max(wetShare, acc.wetArea / acc.area);
    flux += (w * acc.flux) / acc.area;
    renewal += (w * acc.renewal) / acc.area;
    filmShear += (w * acc.filmShear) / acc.area;
    thickness += (w * acc.thickness) / acc.area;
    pooled = Math.max(pooled, acc.pooledArea / acc.area);
    retained = Math.max(retained, acc.retained / acc.area);
  }
  const t = total > 0 ? total : 1;
  return {
    area_cm2: area * 1e4,
    fJet: fJet / t,
    jetAreaShare: jetShare,
    shearPeakMax_Pa: peakMax,
    shearPeakMean_Pa: peakArea > 0 ? peakSum / peakArea : 0,
    shearMean_Pa: dutySum > 0 ? shearDuty / dutySum : 0,
    wetFraction: wetFraction / t,
    wetTime: wetTime / t,
    wettedAreaShare: wetShare,
    flux_kg_m2_s: flux / t,
    renewal_per_s: renewal / t,
    filmShear_Pa: filmShear / t,
    filmThickness_um: (thickness / t) * 1e6,
    pooledAreaShare: pooled,
    retained_g_m2: retained * 1000,
  };
}

/** The pools of an item over the programme: capacity, time to fill, time it then stands full. */
export function poolsOver(
  states: readonly { readonly sums: StateSums; readonly duration: number }[],
  itemId: string,
): PoolDiagnostic[] {
  const first = states.find((state) => state.sums.items[itemId] !== undefined);
  const count = first?.sums.items[itemId]?.basins.length ?? 0;
  const out: PoolDiagnostic[] = [];
  let spraying = 0;
  for (const state of states) spraying += state.duration;
  for (let k = 0; k < count; k++) {
    let capacity = 0;
    let water = 0;
    for (const state of states) {
      const basin = state.sums.items[itemId]?.basins[k];
      if (basin === undefined) continue;
      capacity = basin.capacity;
      water += basin.inflow * state.duration;
    }
    const rate = spraying > 0 ? water / spraying : 0;
    const fill = rate > 0 ? (capacity * POOL_WATER_DENSITY) / rate : null;
    out.push({
      capacity_mL: capacity * 1e6,
      fillTime_s: fill,
      timeFull_s: fill === null ? 0 : Math.max(0, spraying - fill),
    });
  }
  return out;
}

/** Share of the peak detergent concentration above which the liquor counts as the main wash. */
const WASH_SHARE = 0.05;

/** The liquor of a wash while detergent was in it. All zero for a wash without detergent. */
export function liquorSummary(result: WashResult): LiquorSummary {
  const { fields, tickTime_s, values } = result.machine.liquor;
  const col = (name: string): number => fields.indexOf(name);
  const n = fields.length;
  const ticks = tickTime_s.length;
  const cT = col('temperature');
  const cPH = col('pH');
  const cDet = col('detergent');
  const cProt = col('protease');
  const cAmy = col('amylase');
  const cPer = col('peracid');
  const at = (tick: number, c: number): number => (c < 0 ? 0 : (values[n * tick + c] as number));
  let detPeak = 0;
  for (let i = 0; i < ticks; i++) detPeak = Math.max(detPeak, at(i, cDet));
  let time = 0;
  let tSum = 0;
  let tMax = 0;
  let pHSum = 0;
  let pHMax = 0;
  let protPeak = 0;
  let protSum = 0;
  let amyPeak = 0;
  let perPeak = 0;
  let perSum = 0;
  for (let i = 0; i < ticks; i++) {
    if (!(detPeak > 0) || at(i, cDet) < WASH_SHARE * detPeak) continue;
    const next = i + 1 < ticks ? (tickTime_s[i + 1] as number) : result.machine.duration_s;
    const dt = Math.max(0, next - (tickTime_s[i] as number));
    time += dt;
    tSum += dt * at(i, cT);
    tMax = Math.max(tMax, at(i, cT));
    pHSum += dt * at(i, cPH);
    pHMax = Math.max(pHMax, at(i, cPH));
    protPeak = Math.max(protPeak, at(i, cProt));
    protSum += dt * at(i, cProt);
    amyPeak = Math.max(amyPeak, at(i, cAmy));
    perPeak = Math.max(perPeak, at(i, cPer));
    perSum += dt * at(i, cPer);
  }
  const t = time > 0 ? time : 1;
  return {
    washTime_s: time,
    temperatureMean_C: tSum / t,
    temperatureMax_C: tMax,
    pHMean: pHSum / t,
    pHMax,
    detergentPeak_g_L: detPeak,
    proteasePeak_g_L: protPeak,
    proteaseMean_g_L: protSum / t,
    amylasePeak_g_L: amyPeak,
    peracidPeak_mmol_L: perPeak,
    peracidMean_mmol_L: perSum / t,
  };
}
