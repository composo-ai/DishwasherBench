/**
 * The orchestrator of the first build (docs/design/scope.md; docs/design/sim-core.md sections
 * 2 and 5.5): one wash, from a loaded machine to a result per item.
 *
 *   A  scene        the machine and the items as blocks, soil cells, cell graph, basins, rays
 *   B  hydraulics   the spray states of the programme and its schedule
 *   C  exposure     per spray state, in the order the programme first needs it: what the state
 *                   does to every surface. Taken from the cache when it is there
 *   B' hydraulics   the schedule again, with the water the load traps in its pools held back
 *                   while they fill (the first bath), and the exposure of the spray states a
 *                   pump that then runs short of water adds (the same position and speed at a
 *                   lower head)
 *   D  soil         the soil records of the items laid down on the soil cells
 *   E  replay       the whole programme in ticks: liquor, pools, soil
 *   F  result       per item and region: residue, visible area, specks, water, clean or not
 *
 * The scene is built with soil cells on every region of every item, whatever is soiled, so
 * that its geometry, and with it the key of every exposure set, does not depend on the soils:
 * a wash that differs only in the soils, in the liquor or in a soil parameter replays cached
 * exposure.
 *
 * Deterministic: the same input gives the same result and the same result hash, with a cold
 * or a warm cache. The clock is read for the timings of `run` only.
 *
 * Placement is checked, not corrected: an item outside the wash chamber, two items one inside
 * the other, an item in the path of a spray arm that was not given as stalled or in the way
 * of the dispenser lid that was not given as blocked, and an item the jets would lift, are
 * each named in `problems`; the wash is then computed as described all the same.
 *
 * Simplifications of the orchestration (those of each stage are listed in its own file): the
 * load is static (no shake-down, no item moved by a jet: a blocked arm or dispenser is an
 * input; when the load implies one that was not given, the wash only says so); the machine's thermal timeline assumes its rated load
 * whatever is loaded; the water trapped in pools is the volume of every basin that any fully
 * primed spray state fills, taken out of the machine's inventory as one amount from the start
 * of the programme (the pools are not filled gradually) up to the first drain after the pump
 * has run: the vessels then stay full, so the baths after it lose nothing to them (the
 * machine's own drain step empties them in its books, which is why the amount is not held back
 * again). Which pools fill is not looked at again with the exposure of the starved states.
 */

import { getSoil, hasSoil, instantiate } from '@spotless/catalogue';
import {
  bytesToHex,
  canonicalHash,
  createSha256,
  poseInverseTransformPoint,
  quatInverseRotate,
} from '@spotless/core';
import {
  inspectionRules,
  inspectBand,
  inspectItem,
  type InspectionElements,
  type InspectionRules,
  type ItemInspection,
  type StandingResidue,
} from '@spotless/inspector';
import type { MachineGeometry, MachineSpec } from '@spotless/machine';
import {
  computeExposureSet,
  decodeExposureSet,
  encodeExposureSet,
  EXPOSURE_SET_SCHEMA,
  type ExposureSet,
  type ExposureStage,
} from '@spotless/sim-film';
import { signedDistance } from '@spotless/geometry';
import type { GpuContext } from '@spotless/sim-gpu';
import { buildWashHydraulics, type WashHydraulics } from '@spotless/sim-hydraulics';
import { exposureBackendInfo } from '@spotless/sim-jets';
import { createWashLiquor, LIQUOR_FIELDS } from '@spotless/sim-liquor';
import { bindSharedClosures, TIERS, type ParamSet } from '@spotless/sim-params';
import {
  BLOCK_FLAG,
  SCENE_NONE,
  sceneChamber,
  type SceneItem,
  type WashScene,
} from '@spotless/sim-scene';
import {
  createWashSoil,
  initSoil,
  SOIL_CLASS_LAW,
  SOIL_CLASS_OF_MECHANISM,
  SOIL_MODEL_CLASSES,
  soilVisibility,
  visibilityBand,
  type SoilModelClass,
  type SoilState,
  type SoilTypeInfo,
} from '@spotless/sim-soil';
import { replayWash, type ReplayResult } from '@spotless/sim-timeline';
import { exposureKey, sceneGeometryKey, type ExposureCache } from './exposure-cache.ts';
import { jetRowsOf, summariseItemExposure, type SummaryState } from './exposure-summary.ts';
import type { WashInput } from './input.ts';
import { createWashParams } from './registry.ts';
import {
  buildSceneOfWash,
  canonicalPose,
  regionIdsOf,
  washMachineGeometry,
} from './scene-setup.ts';
import type {
  ItemCells,
  ItemSoilResult,
  ItemWashResult,
  MachineWashResult,
  SprayStateResult,
  WashResult,
} from './result.ts';

/** Version of the simulator: part of every result. Raise it when results change. */
export const SIM_VERSION = 'spotless-sim 0.5.0 water-7';

/** The stages a wash reports progress in, in order. */
export const WASH_STAGES = ['scene', 'hydraulics', 'exposure', 'soil', 'replay', 'result'] as const;

/** One of the {@link WASH_STAGES}. */
export type WashStage = (typeof WASH_STAGES)[number];

/** Progress of a wash. */
export interface WashProgress {
  readonly stage: WashStage;
  /** Share of that stage done, 0 to 1. */
  readonly fraction: number;
  /** What the stage is doing, in a few words. */
  readonly detail?: string;
}

/** Options of {@link wash}: how to run it, never what it computes. */
export interface WashOptions {
  /** Where exposure sets are kept between washes; default: nowhere. */
  readonly cache?: ExposureCache;
  /**
   * For a wash without a cache: the fingerprint of the exposure sources as the caller found
   * them (`loadedExposureSource` of `@spotless/sim-core/node`), which a cache would name as
   * its `source`. It becomes part of every exposure key and of the provenance exactly as a
   * cache's would, so that the result hash of a wash does not depend on whether a cache was
   * configured. A cache's own `source` wins.
   */
  readonly exposureSource?: string;
  readonly onProgress?: (progress: WashProgress) => void;
  /** True to return per-cell arrays with every item (`ItemWashResult.cells`). */
  readonly cells?: boolean;
  /**
   * False to drop the scene when the wash is done. By default the scene of the latest wash is
   * kept in memory, so that a wash of the same load with other soils or soil parameters does
   * not build it again (`releaseWashScene` drops it).
   */
  readonly keepScene?: boolean;
  /** Milliseconds from an arbitrary origin, for the timings; default `performance.now`. */
  readonly clock?: () => number;
  /**
   * The exposure stage, with a name that identifies it in cache keys. Default: the real stages
   * of the first build (`computeExposureSet`), under the name `exposure-v<schema>`.
   */
  readonly exposure?: { readonly id: string; readonly stage: ExposureStage };
  /**
   * The device the exposure stages trace on: a context to use it, `null` for the CPU tracer.
   * Default: the device of the process (`setExposureGpu`, else the Dawn bindings under Node);
   * when that cannot be made the CPU answers and the wash says so in `problems`.
   */
  readonly gpu?: GpuContext | null;
  /**
   * Fingerprint of the sources of the whole simulation as the caller found them
   * (`simulationFingerprint` of `@spotless/sim-core/node`), to be recorded in the provenance
   * of the result. The simulation itself reads no files, so it cannot know it.
   */
  readonly sourceFingerprint?: string;
}

/**
 * Two soil elements of one or of adjoining blocks count as neighbours on the surface when
 * their centres are within this many mean cell sides: edge and corner neighbours of a grid of
 * cells are (1 and 1.41 sides apart), cells one further are not (2 sides). A rule of the
 * element table, not a physical quantity.
 */
const NEIGHBOUR_REACH = 1.5;

/**
 * What the soil model needs to know about a soil id: a catalogue soil gives the model class
 * that stands for its mechanism class and its solids fraction; the name of a model class
 * stands for itself. Throws a RangeError for anything else.
 */
export function soilTypeInfo(soilTypeId: string): SoilTypeInfo {
  if ((SOIL_MODEL_CLASSES as readonly string[]).includes(soilTypeId)) {
    return { modelClass: soilTypeId as SoilModelClass, solidsFraction: null };
  }
  if (!hasSoil(soilTypeId)) throw new RangeError(`unknown soil "${soilTypeId}"`);
  const soil = getSoil(soilTypeId);
  return {
    modelClass: SOIL_CLASS_OF_MECHANISM[soil.soilClass],
    solidsFraction: soil.loading.solidsFraction,
  };
}

/**
 * The scene of the latest wash of this process, by the hash of everything it was built from.
 * A wash that differs from the one before only in soils, liquor or soil parameters (a
 * calibration replay) takes its scene from here instead of building it again. One entry: a
 * scene of a full load at the official tier holds most of a gigabyte.
 */
let latestScene: { readonly key: string; readonly scene: WashScene } | undefined;

/** Forgets the scene kept from the latest wash (see `WashOptions.keepScene`). */
export function releaseWashScene(): void {
  latestScene = undefined;
}

/** The soil elements of one item for the inspector, with what the per-cell arrays need. */
interface ItemElements {
  readonly cells: Uint32Array;
  readonly elements: InspectionElements;
}

/**
 * How the soil in the liquor is split among the soil classes when standing water leaves it
 * behind, per class code of `state.classes`: the liquor counts its soil as one number, and
 * the split is that of the soil the deposits of the state gave up over the wash. A stain that
 * was bleached is no soil in the liquor (its colour is destroyed, nothing of it is left to dry
 * on): its share of the number leaves no residue, so the shares may sum to less than 1.
 */
export function releasedClassShare(state: SoilState): Float64Array {
  return classShareOf(releasedByClass(state), state.classes);
}

/** The dry soil the deposits of a state have given up, kg, per class code of `state.classes`. */
export function releasedByClass(state: SoilState): Float64Array {
  const released = new Float64Array(state.classes.length);
  for (let d = 0; d < state.count; d++) {
    const lost =
      Math.max(0, (state.mass0[d] as number) - (state.mass[d] as number)) *
      (state.area[d] as number);
    const k = state.classCode[d] as number;
    released[k] = (released[k] as number) + lost;
  }
  return released;
}

/**
 * The split of {@link releasedClassShare} from the soil given up per class (kg, as
 * {@link releasedByClass} counts it; a caller that replays part of a load adds what the rest
 * of the load gave up).
 */
export function classShareOf(
  released: ArrayLike<number>,
  classes: readonly string[],
): Float64Array {
  const share = new Float64Array(classes.length);
  let given = 0;
  for (let k = 0; k < share.length; k++) given += released[k] as number;
  for (let k = 0; k < share.length; k++) {
    const law = SOIL_CLASS_LAW[classes[k] as SoilModelClass]?.law;
    share[k] = given > 0 && law !== 'bleach' ? (released[k] as number) / given : 0;
  }
  return share;
}

/**
 * What the water standing in the pools of an item leaves where it stood (sim-core.md M10: at
 * the end the content of a pool is deposited over its footprint; chemistry 5.3, R2: m'' =
 * C h_pool). Every block of a pool that faces up and lies under water gets the soil of the
 * column of water above it: concentration x depth x n_z per area of the block, so that the
 * patches of a pool hold what its water held. The soil of a pool is one number; it is split
 * among the soil classes as the soil the whole load gave up to the liquor (`classShare`).
 * Undefined when no pool of the item holds soil. Exported for the calibration, whose replay
 * of a wash record must inspect an item exactly as the wash does.
 */
export function standingResidueOf(
  scene: WashScene,
  pools: readonly ReplayResult['pools'][number][],
  regionIds: readonly string[],
  classShare: Float64Array,
): StandingResidue | undefined {
  const classCount = classShare.length;
  const region: number[] = [];
  const areaMm2: number[] = [];
  const residue: number[] = [];
  for (const pool of pools) {
    const held = pool.dissolvedSoil + pool.carriedSoil;
    if (!(held > 0) || !(pool.volume > 0)) continue;
    const basin = scene.basins[pool.basin];
    if (basin === undefined) continue;
    const instance = scene.instances[basin.instance];
    // The columns of water over the blocks that face up, m3: the volume of the pool as the
    // blocks see it. The soil is shared by column, so that the patches hold what the water held.
    let columns = 0;
    for (let i = 0; i < basin.blocks.length; i++) {
      const b = basin.blocks[i] as number;
      const column = (basin.depth[i] as number) - pool.dry;
      const up = scene.blocks.normal[3 * b + 2] as number;
      if (column > 0 && up > 0) columns += column * up * (scene.blocks.area[b] as number);
    }
    if (!(columns > 0)) continue;
    for (let i = 0; i < basin.blocks.length; i++) {
      const b = basin.blocks[i] as number;
      const column = (basin.depth[i] as number) - pool.dry;
      const up = scene.blocks.normal[3 * b + 2] as number;
      if (!(column > 0) || !(up > 0)) continue;
      // kg/m2 of the block; 1 kg/m2 = 100 mg/cm2.
      const load = ((held * column * up) / columns) * 100;
      const regionIndex = scene.blocks.region[b] as number;
      const id = regionIndex >= 0 ? instance?.shape.regions[regionIndex]?.id : undefined;
      const slot = id === undefined ? -1 : regionIds.indexOf(id);
      region.push(slot >= 0 ? slot : 0xffff);
      areaMm2.push((scene.blocks.area[b] as number) * 1e6);
      for (let k = 0; k < classCount; k++) residue.push(load * (classShare[k] as number));
    }
  }
  if (areaMm2.length === 0) return undefined;
  return {
    count: areaMm2.length,
    region: Uint16Array.from(region),
    areaMm2: Float32Array.from(areaMm2),
    residue_mg_cm2: Float32Array.from(residue),
  };
}

function itemElements(
  scene: WashScene,
  state: SoilState,
  instanceIndex: number,
  regionIds: readonly string[],
): ItemElements {
  const classCount = state.classes.length;
  const instance = scene.instances[instanceIndex];
  if (instance === undefined) throw new RangeError('itemElements: no such instance');
  // The cells that carry a deposit of this item, ascending.
  const cellSet = new Set<number>();
  for (const record of state.records) {
    if (record.instance !== instanceIndex) continue;
    for (let d = record.firstDeposit; d < record.firstDeposit + record.depositCount; d++) {
      cellSet.add(state.cell[d] as number);
    }
  }
  const cells = Uint32Array.from(cellSet).sort();
  const count = cells.length;
  const elementOf = new Map<number, number>();
  cells.forEach((c, e) => elementOf.set(c, e));
  const region = new Uint16Array(count).fill(0xffff);
  const areaMm2 = new Float32Array(count);
  const initial = new Float32Array(count * classCount);
  const residual = new Float32Array(count * classCount);
  for (let e = 0; e < count; e++) {
    const c = cells[e] as number;
    const b = scene.soilCells.block[c] as number;
    areaMm2[e] = (scene.soilCells.area[c] as number) * 1e6;
    const regionIndex = scene.blocks.region[b] as number;
    const id = regionIndex >= 0 ? instance.shape.regions[regionIndex]?.id : undefined;
    const slot = id === undefined ? -1 : regionIds.indexOf(id);
    if (slot >= 0) region[e] = slot;
  }
  for (const record of state.records) {
    if (record.instance !== instanceIndex) continue;
    for (let d = record.firstDeposit; d < record.firstDeposit + record.depositCount; d++) {
      const e = elementOf.get(state.cell[d] as number);
      if (e === undefined) continue;
      const o = classCount * e + (state.classCode[d] as number);
      // 1 kg/m2 = 100 mg/cm2.
      initial[o] = (initial[o] as number) + (state.mass0[d] as number) * 100;
      residual[o] = (residual[o] as number) + (state.mass[d] as number) * 100;
    }
  }
  // Neighbours on the surface: elements of the same block and of adjoining blocks whose
  // centres are within one and a half mean cell sides.
  const offsets = new Uint32Array(count + 1);
  const indices: number[] = [];
  const centre = scene.soilCells.centre;
  const graph = scene.graph;
  const consider = (e: number, c: number, block: number): void => {
    const first = scene.blocks.soilFirst[block] as number;
    if (first === SCENE_NONE) return;
    for (let q = 0; q < 4; q++) {
      const other = first + q;
      if (other === c) continue;
      const o = elementOf.get(other);
      if (o === undefined) continue;
      const reach =
        0.5 *
        NEIGHBOUR_REACH *
        (Math.sqrt(scene.soilCells.area[c] as number) +
          Math.sqrt(scene.soilCells.area[other] as number));
      const d = Math.hypot(
        (centre[3 * c] as number) - (centre[3 * other] as number),
        (centre[3 * c + 1] as number) - (centre[3 * other + 1] as number),
        (centre[3 * c + 2] as number) - (centre[3 * other + 2] as number),
      );
      if (d <= reach) indices.push(o);
    }
  };
  for (let e = 0; e < count; e++) {
    const c = cells[e] as number;
    const b = scene.soilCells.block[c] as number;
    const start = indices.length;
    consider(e, c, b);
    for (let k = graph.offsets[b] as number; k < (graph.offsets[b + 1] as number); k++) {
      consider(e, c, graph.neighbour[k] as number);
    }
    // Ascending and without repeats, so that the table does not depend on the order of links.
    const own = [...new Set(indices.splice(start))].sort((x, y) => x - y);
    for (const o of own) indices.push(o);
    offsets[e + 1] = indices.length;
  }
  return {
    cells,
    elements: {
      count,
      region,
      areaMm2,
      initial_mg_cm2: initial,
      residual_mg_cm2: residual,
      neighbours: { offsets, indices: Uint32Array.from(indices) },
    },
  };
}

function itemCells(
  scene: WashScene,
  instanceIndex: number,
  built: ItemElements,
  inspection: ItemInspection,
): ItemCells {
  const instance = scene.instances[instanceIndex];
  if (instance === undefined) throw new RangeError('itemCells: no such instance');
  const count = built.cells.length;
  const centre = new Float32Array(3 * count);
  const normal = new Float32Array(3 * count);
  for (let e = 0; e < count; e++) {
    const c = built.cells[e] as number;
    const b = scene.soilCells.block[c] as number;
    const p = poseInverseTransformPoint(instance.pose, [
      scene.soilCells.centre[3 * c] as number,
      scene.soilCells.centre[3 * c + 1] as number,
      scene.soilCells.centre[3 * c + 2] as number,
    ]);
    const nrm = quatInverseRotate(instance.pose.q, [
      scene.blocks.normal[3 * b] as number,
      scene.blocks.normal[3 * b + 1] as number,
      scene.blocks.normal[3 * b + 2] as number,
    ]);
    for (let i = 0; i < 3; i++) {
      centre[3 * e + i] = p[i] as number;
      normal[3 * e + i] = nrm[i] as number;
    }
  }
  return {
    count,
    region: built.elements.region,
    centre,
    normal,
    areaMm2: built.elements.areaMm2,
    initial_mg_cm2: built.elements.initial_mg_cm2,
    residual_mg_cm2: built.elements.residual_mg_cm2,
    visible: inspection.visible,
  };
}

/** Two poses whose quaternions have a dot product above this are the same orientation (0.5 degrees). */
const COINCIDENT_QUAT = 0.99999;

/** Most block centres of one item tested against another item (a stride over its blocks). */
const OVERLAP_SAMPLES = 1500;

/**
 * What is wrong with where the items are, in words: outside the chamber, one inside another,
 * in the path of a spray arm or of the dispenser lid. The wash is computed all the same.
 */
export function placementProblems(
  scene: WashScene,
  geometry: MachineGeometry,
  chamber: { readonly min: readonly number[]; readonly max: readonly number[] },
  params: ParamSet,
  input: Pick<WashInput, 'stalledArms' | 'dispenserBlocked'>,
): string[] {
  const out: string[] = [];
  const { blocks } = scene;
  const items = scene.instances.filter((instance) => instance.kind === 'item');
  const overlap = params.get('inspect.overlapDepthMm') / 1000;
  const stalled = input.stalledArms ?? {};
  for (const item of items) {
    // Share of its blocks outside the chamber.
    let outside = 0;
    const end = item.firstBlock + item.blockCount;
    const sweeps = geometry.affordances.armSweeps.map(() => false);
    let lid = false;
    const swept = geometry.affordances.dispenserLid.swept;
    for (let b = item.firstBlock; b < end; b++) {
      const x = blocks.centre[3 * b] as number;
      const y = blocks.centre[3 * b + 1] as number;
      const z = blocks.centre[3 * b + 2] as number;
      if (
        x < (chamber.min[0] as number) ||
        x > (chamber.max[0] as number) ||
        y < (chamber.min[1] as number) ||
        y > (chamber.max[1] as number) ||
        z < (chamber.min[2] as number) ||
        z > (chamber.max[2] as number)
      ) {
        outside++;
      }
      geometry.affordances.armSweeps.forEach((sweep, k) => {
        if (sweeps[k] === true || z < sweep.zMin || z > sweep.zMax) return;
        const r = Math.hypot(x - sweep.axis[0], y - sweep.axis[1]);
        if (r > sweep.radius) return;
        for (const ring of sweep.rings) {
          if (r >= ring.rMin && r <= ring.rMax && z >= ring.zMin && z <= ring.zMax) {
            sweeps[k] = true;
            return;
          }
        }
      });
      if (
        !lid &&
        x >= swept.min[0] &&
        x <= swept.max[0] &&
        y >= swept.min[1] &&
        y <= swept.max[1] &&
        z >= swept.min[2] &&
        z <= swept.max[2]
      ) {
        lid = true;
      }
    }
    if (item.blockCount > 0 && outside > 0) {
      out.push(
        `placement: ${item.id} lies ${outside === item.blockCount ? 'wholly' : 'partly'} outside the wash chamber (${Math.round((100 * outside) / item.blockCount)} % of its surface)`,
      );
    }
    geometry.affordances.armSweeps.forEach((sweep, k) => {
      if (sweeps[k] !== true || stalled[sweep.levelId] !== undefined) return;
      out.push(
        `placement: ${item.id} stands in the path of the ${sweep.levelId} spray arm, which is simulated turning through it; give stalledArms for this level to hold the arm`,
      );
    });
    if (lid && input.dispenserBlocked !== true) {
      out.push(
        `placement: ${item.id} stands in the way of the dispenser lid, which is simulated opening; give dispenserBlocked to keep it shut`,
      );
    }
  }
  // Two items of one type in one place: their surfaces coincide, so neither lies inside the other.
  for (let i = 0; i < items.length; i++) {
    const a = items[i] as (typeof items)[number];
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j] as (typeof items)[number];
      if (a.typeId !== b.typeId || a.shape !== b.shape) continue;
      const same =
        a.pose.p.every((v, k) => Math.abs(v - (b.pose.p[k] as number)) <= overlap) &&
        Math.abs(a.pose.q.reduce((sum, v, k) => sum + v * (b.pose.q[k] as number), 0)) >
          COINCIDENT_QUAT;
      if (same) {
        out.push(
          `placement: ${a.id} and ${b.id} are in the same place; both are simulated as if alone there`,
        );
      }
    }
  }
  // One item inside another: block centres of the one deeper than the tolerance in the other.
  for (let i = 0; i < items.length; i++) {
    const a = items[i] as (typeof items)[number];
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const b = items[j] as (typeof items)[number];
      let apart = false;
      for (let k = 0; k < 3 && !apart; k++) {
        apart =
          (a.box.min[k] as number) > (b.box.max[k] as number) ||
          (a.box.max[k] as number) < (b.box.min[k] as number);
      }
      if (apart) continue;
      const stride = Math.max(1, Math.ceil(a.blockCount / OVERLAP_SAMPLES));
      let deepest = 0;
      for (let n = a.firstBlock; n < a.firstBlock + a.blockCount; n += stride) {
        const x = blocks.centre[3 * n] as number;
        const y = blocks.centre[3 * n + 1] as number;
        const z = blocks.centre[3 * n + 2] as number;
        if (
          x < b.box.min[0] ||
          x > b.box.max[0] ||
          y < b.box.min[1] ||
          y > b.box.max[1] ||
          z < b.box.min[2] ||
          z > b.box.max[2]
        ) {
          continue;
        }
        const d = signedDistance(b.shape, poseInverseTransformPoint(b.pose, [x, y, z]));
        if (-d > deepest) deepest = -d;
      }
      // Reported once per pair, by the item whose surface lies deeper in the other.
      if (
        deepest > overlap &&
        (i < j || !out.some((line) => line.includes(`${b.id} cuts`) && line.includes(a.id)))
      ) {
        out.push(
          `placement: ${a.id} cuts ${(deepest * 1000).toFixed(1)} mm into ${b.id}; both are simulated where they were placed`,
        );
      }
    }
  }
  return out;
}

/**
 * The water the pools of the load keep out of the sump, as the machine's programme expansion
 * takes it (`ExpandOptions.heldWater`): `trapped` (m3) in every step up to the first drain
 * after the pump has run, nothing after it. Upright vessels fill in the first bath and stay
 * full through every drain (a drain pump cannot empty them), so only the first bath is short
 * of the water they took: in the owner's Auto programme the pre-rinse, where the machine checks
 * the level by the pump current and tops up (machine dossier, row D4).
 */
export function trappedWaterByStep(
  programme: WashInput['programme'],
  trapped: number,
): (step: { readonly stepId: string }) => { readonly trapped?: number } {
  const firstBath = new Set<string>();
  let pumped = false;
  for (const step of programme.steps) {
    if (step.kind === 'drain' && pumped) break;
    firstBath.add(step.id);
    if (step.kind === 'circulate' || step.kind === 'heat' || step.kind === 'hold') pumped = true;
  }
  return (step) => (firstBath.has(step.stepId) ? { trapped } : {});
}

/** `sha256:` hash of the bytes of some typed arrays, in order. */
function arraysHash(arrays: readonly ArrayBufferView[]): string {
  const hasher = createSha256();
  for (const a of arrays) hasher.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
  return `sha256:${bytesToHex(hasher.digest())}`;
}

/**
 * Runs one wash: see the file comment. Throws a RangeError for an input that cannot be a wash
 * (an unknown item type or soil parameter, two items with one id); what can be simulated only
 * in part (a soil on a region the item lacks) is reported in `problems`.
 */
export async function wash(input: WashInput, options: WashOptions = {}): Promise<WashResult> {
  const clock = options.clock ?? ((): number => performance.now());
  const timings: Record<string, number> = {};
  let mark = clock();
  const lap = (stage: string): void => {
    const now = clock();
    timings[stage] = (timings[stage] ?? 0) + (now - mark);
    mark = now;
  };
  const progress = (stage: WashStage, fraction: number, detail?: string): void => {
    options.onProgress?.({ stage, fraction, ...(detail === undefined ? {} : { detail }) });
  };

  const params: ParamSet = createWashParams(input.params ?? {});
  const tier = TIERS[input.tier];
  // The detergent: its dose replaces the machine's own (the composition is in the parameters).
  const dose = input.detergent?.dose;
  if (dose !== undefined && !(dose >= 0 && Number.isFinite(dose))) {
    throw new RangeError(`wash: detergent dose ${String(dose)} kg`);
  }
  const spec: MachineSpec =
    dose === undefined
      ? input.machine
      : { ...input.machine, dosing: { ...input.machine.dosing, detergentMass: dose } };
  const config = input.config ?? spec.defaultConfig;
  const problems: string[] = [];

  // ---- A scene
  progress('scene', 0);
  let sceneReused = false;
  const ids = new Set<string>();
  const items = input.items.map((item) => {
    if (ids.has(item.itemId)) throw new RangeError(`wash: two items with the id "${item.itemId}"`);
    ids.add(item.itemId);
    const shape = item.shape ?? instantiate(item.typeId).shape;
    return {
      itemId: item.itemId,
      typeId: item.typeId,
      shape,
      pose: canonicalPose(item.pose),
      soils: item.soils,
    };
  });
  // The geometry is that of the machine as given: a detergent dose does not change it.
  const geometry = washMachineGeometry(input.machine, config);
  const sceneKey = sceneGeometryKey(input.machine, config, tier.block_m, items);
  // The scene reads the `scene.*` keys, which are in the hydro group, and nothing else of the
  // parameters.
  const builtKey = canonicalHash({ scene: sceneKey, hydro: params.hydroHash });
  let scene: WashScene;
  if (latestScene !== undefined && latestScene.key === builtKey) {
    scene = latestScene.scene;
    sceneReused = true;
  } else {
    scene = buildSceneOfWash(input.machine, config, tier.block_m, items, params);
  }
  latestScene = options.keepScene === false ? undefined : { key: builtKey, scene };
  // The scene carries soil cells on every region; that a region too small for a block got none
  // matters only when a soil really lies there, which the soil stage reports itself.
  for (const what of scene.unsupported) {
    if (!what.includes('soil on region')) problems.push(`scene: ${what}`);
  }
  for (const line of placementProblems(scene, geometry, sceneChamber(spec), params, input)) {
    problems.push(line);
  }
  const armLevels: string[] = [];
  for (const root of scene.trace.roots) {
    if (root.rotating === null) continue;
    const part = geometry.parts.find((p) => p.id === scene.instances[root.instance]?.id);
    if (part?.arm === undefined)
      throw new Error('wash: a rotating part of the scene is not a spray arm');
    armLevels.push(part.arm.levelId);
  }
  lap('scene');
  progress('scene', 1);

  // ---- B hydraulics
  const hydraulicsInput = {
    spec,
    programme: input.programme,
    config,
    params,
    ...(input.stalledArms === undefined ? {} : { stalledArms: input.stalledArms }),
  };
  let hydraulics: WashHydraulics = buildWashHydraulics(hydraulicsInput);
  lap('hydraulics');
  progress('hydraulics', 1);

  // ---- C exposure, in the order the programme first needs each state
  const stage = options.exposure ?? {
    id: `exposure-v${EXPOSURE_SET_SCHEMA}`,
    stage: computeExposureSet,
  };
  // Which tracer will answer: part of the key, because the two tracers (and two GPU stacks)
  // differ on rare grazing rays.
  const backend = await exposureBackendInfo(options.gpu);
  if (backend.fallback) {
    problems.push(
      'exposure: no GPU device could be made; rays are traced on the CPU, which is slower and differs from a GPU run on rare grazing rays (the result hash is that of the CPU tracer)',
    );
  }
  const itemMass = new Map<string, number>();
  for (const item of input.items) {
    try {
      itemMass.set(item.itemId, instantiate(item.typeId).mass.mass);
    } catch {
      // An item given by its shape alone has no catalogue mass: no lift ratio for it.
    }
  }
  // The code the cached sets were computed by, where the cache names it.
  const exposureSource = options.cache?.source ?? options.exposureSource ?? '';
  // Exposure sets by the key of their spray state: the schedule is built twice (B and B'),
  // and a state the two share is computed once.
  const known = new Map<string, { readonly set: ExposureSet; readonly key: string }>();
  let sets: (ExposureSet | undefined)[] = [];
  let keys: string[] = [];
  let cacheHits = 0;
  let computed = 0;
  /** Fills `sets` and `keys` for the states of `of`, in the order its schedule first needs them. */
  const expose = async (of: WashHydraulics): Promise<void> => {
    const order: number[] = [];
    for (const span of of.schedule.spans) {
      if (span.state >= 0 && !order.includes(span.state)) order.push(span.state);
    }
    sets = of.states.map(() => undefined);
    keys = of.states.map(() => '');
    for (let i = 0; i < order.length; i++) {
      const index = order[i] as number;
      const state = of.states[index];
      if (state === undefined) continue;
      const had = known.get(state.key);
      if (had !== undefined) {
        sets[index] = had.set;
        keys[index] = had.key;
        continue;
      }
      progress('exposure', i / order.length, state.id);
      const key = exposureKey({
        scene: sceneKey,
        state,
        armLevels,
        params,
        tier,
        simSeed: input.simSeed,
        stage: stage.id,
        backend: backend.kind === 'gpu' ? `gpu ${backend.stack}` : 'cpu',
        version: SIM_VERSION,
        materials: scene.materials,
        itemMass,
        ...(exposureSource === '' ? {} : { source: exposureSource }),
      });
      keys[index] = key;
      let set: ExposureSet | undefined;
      const stored = await options.cache?.get(key);
      if (stored !== undefined) {
        try {
          const decoded = decodeExposureSet(stored);
          if (
            decoded.schema === EXPOSURE_SET_SCHEMA &&
            decoded.stateKey === state.key &&
            decoded.water.blockCount === scene.blocks.count &&
            decoded.jets.soilCellCount === scene.soilCells.count &&
            decoded.poolInflow.length === scene.basins.length
          ) {
            set = decoded;
            cacheHits++;
          }
        } catch {
          // A damaged entry is computed again and overwritten.
        }
      }
      if (set === undefined) {
        set = await stage.stage({
          scene,
          state,
          armLevels,
          params,
          tier,
          seed: input.simSeed >>> 0,
          itemMass,
          ...(options.gpu === undefined ? {} : { gpu: options.gpu }),
        });
        computed++;
        await options.cache?.put(key, encodeExposureSet(set));
      }
      sets[index] = set;
      known.set(state.key, { set, key });
    }
  };
  await expose(hydraulics);
  lap('exposure');

  // ---- B' the schedule with the water the load traps held back
  let trapped = 0;
  scene.basins.forEach((basin, k) => {
    if (sets.some((set) => set !== undefined && (set.poolInflow[k] as number) > 0))
      trapped += basin.volume;
  });
  if (trapped > 0) {
    hydraulics = buildWashHydraulics({
      ...hydraulicsInput,
      heldWater: trappedWaterByStep(input.programme, trapped),
    });
    lap('hydraulics');
    // A pump that runs short of water has spray states of its own.
    await expose(hydraulics);
    lap('exposure');
  }
  // Items the jets would lift: reported, not moved.
  const liftWarn = params.get('inspect.liftWarnRatio');
  const liftRatio = new Map<string, number>();
  for (const set of sets) {
    for (const load of set?.stats.itemLoads ?? []) {
      if (load.liftRatio === undefined) continue;
      if (load.liftRatio > (liftRatio.get(load.itemId) ?? 0)) {
        liftRatio.set(load.itemId, load.liftRatio);
      }
    }
  }
  for (const id of [...liftRatio.keys()].sort()) {
    const ratio = liftRatio.get(id) as number;
    if (ratio > liftWarn) {
      problems.push(
        `placement: ${id} is likely to be moved by the jets (peak upward jet force ${ratio.toFixed(2)} of its weight); it is simulated where it was placed`,
      );
    }
  }
  const backends = new Set<string>();
  for (const set of sets) if (set?.stats.backend !== undefined) backends.add(set.stats.backend);
  const exposureBackend: 'gpu' | 'cpu' | 'mixed' | 'unknown' =
    backends.size === 0
      ? 'unknown'
      : backends.size > 1
        ? 'mixed'
        : backends.has('gpu')
          ? 'gpu'
          : 'cpu';
  lap('exposure');
  progress('exposure', 1);

  // ---- D soil
  progress('soil', 0);
  const soilState = initSoil(scene, items, soilTypeInfo, params, input.levelSeed);
  for (const problem of soilState.problems) problems.push(`soil: ${problem}`);
  const soil = createWashSoil(soilState, scene, params);
  const liquor = createWashLiquor(params, { dispenserBlocked: input.dispenserBlocked === true });
  lap('soil');
  progress('soil', 1);

  // ---- E replay
  const replay: ReplayResult = await replayWash({
    scene,
    hydraulics,
    exposure: (index) => {
      const set = sets[index];
      if (set === undefined) throw new Error(`wash: no exposure for state ${index}`);
      return Promise.resolve(set);
    },
    liquor,
    soil,
    params,
    onProgress: (fraction) => progress('replay', fraction),
  });
  lap('replay');

  // ---- F result
  progress('result', 0);
  const visibility = soilVisibility(params);
  const rules: InspectionRules = inspectionRules(params, {
    ...visibility,
    band: visibilityBand(SOIL_MODEL_CLASSES, visibility.mass),
  });
  const waterDensity = bindSharedClosures(params).water(params.get('jets.solveTemperature')).rho;
  // Standing water outside the basins: deeper than this (kg/m2) on a face that looks up and is
  // open above. What capillarity holds between a face and another body close in front of it (a
  // contact of the scene) is retained water like the meniscus of any contact, not a puddle.
  const puddleLoad = (params.get('inspect.puddleDepthMm') / 1000) * waterDensity;
  const puddleNormal = params.get('inspect.puddleMinNormalZ');
  const facesBody = new Uint8Array(scene.blocks.count);
  for (let c = 0; c < scene.contacts.count; c++) {
    const b = scene.contacts.blockA[c] as number;
    if (b !== SCENE_NONE) facesBody[b] = 1;
  }
  const classes = soilState.classes;
  const classShare = releasedClassShare(soilState);
  // The spray states as the exposure summary reads them, in the order of the result.
  const summaryStates: SummaryState[] = hydraulics.states.map((state, index) => {
    const set = sets[index];
    if (set === undefined) throw new Error(`wash: no exposure for state ${index}`);
    return { duration: state.duration, set, jetRow: jetRowsOf(scene, set) };
  });
  const itemResults: ItemWashResult[] = [];
  const sorted = [...items].sort((a, b) =>
    a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0,
  );
  for (const item of sorted) {
    const instanceIndex = scene.itemInstance.get(item.itemId);
    const instance = instanceIndex === undefined ? undefined : scene.instances[instanceIndex];
    if (instance === undefined || instanceIndex === undefined) continue;
    const regionIds = regionIdsOf(item.shape);
    const built = itemElements(scene, soilState, instanceIndex, regionIds);
    const pools = replay.pools.filter((pool) => pool.instance === instanceIndex);
    let film = 0;
    let puddle = 0;
    for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
      const load = replay.retainedFilm[b] as number;
      const mass = load * (scene.blocks.area[b] as number);
      if (
        load > puddleLoad &&
        (scene.blocks.normal[3 * b + 2] as number) > puddleNormal &&
        ((scene.blocks.flags[b] as number) & BLOCK_FLAG.basin) === 0 &&
        facesBody[b] === 0
      ) {
        puddle += mass;
      } else {
        film += mass;
      }
    }
    const puddle_mL = (puddle / waterDensity) * 1e6;
    const pooled = pools.reduce((sum, pool) => sum + pool.volume, 0) * 1e6 + puddle_mL;
    const standing = standingResidueOf(scene, pools, regionIds, classShare);
    const inspected = {
      itemId: item.itemId,
      regionIds,
      classCount: classes.length,
      elements: built.elements,
      pooledWater_mL: pooled,
      ...(standing === undefined ? {} : { standing }),
    };
    const inspection = inspectItem(inspected, rules);
    const band = inspectBand(inspected, rules);
    const soils: ItemSoilResult[] = soilState.records
      .filter((record) => record.instance === instanceIndex)
      .map((record) => {
        let left = 0;
        for (let d = record.firstDeposit; d < record.firstDeposit + record.depositCount; d++) {
          left += (soilState.mass[d] as number) * (soilState.area[d] as number);
        }
        return {
          type: record.soilType,
          modelClass: classes[record.classCode] ?? '',
          bake: record.bake,
          coveredAreaMm2: record.coveredArea * 1e6,
          initialMass_mg: record.dryMass * 1e6,
          residualMass_mg: left * 1e6,
        };
      });
    itemResults.push({
      itemId: item.itemId,
      typeId: item.typeId,
      clean: inspection.clean,
      score: inspection.score,
      initialMass_mg: inspection.initialMass_mg,
      residualMass_mg: inspection.residualMass_mg,
      initialVisibleAreaMm2: inspection.initialVisibleAreaMm2,
      visibleAreaMm2: inspection.visibleAreaMm2,
      specks: inspection.specks,
      band: {
        strictClean: band.strict.clean,
        strictScore: band.strict.score,
        lenientClean: band.lenient.clean,
        lenientScore: band.lenient.score,
        decided: band.decided,
      },
      water: {
        pooled_mL: pooled,
        puddle_mL,
        film_g: film * 1000,
        pools: pools.map((pool) => ({
          volume_mL: pool.volume * 1e6,
          capacity_mL: pool.capacity * 1e6,
          detergent_g_L: pool.detergent,
          dissolvedSoil_mg: pool.dissolvedSoil * 1e6,
          carriedSoil_mg: pool.carriedSoil * 1e6,
        })),
        ...(inspection.standingResidue_mg > 0
          ? {
              standingResidue_mg: inspection.standingResidue_mg,
              standingVisibleAreaMm2: inspection.standingVisibleAreaMm2,
            }
          : {}),
      },
      ...(liftRatio.has(item.itemId) ? { jetLiftRatio: liftRatio.get(item.itemId) as number } : {}),
      regionIds,
      regions: inspection.regions,
      exposure: summariseItemExposure(
        scene,
        instanceIndex,
        regionIds,
        summaryStates,
        replay.retainedFilm,
      ),
      soils,
      ...(options.cells === true
        ? { cells: itemCells(scene, instanceIndex, built, inspection) }
        : {}),
    });
  }

  const totals = hydraulics.schedule.timeline.totals;
  const states: SprayStateResult[] = hydraulics.states.map((state, index) => ({
    id: state.id,
    duration_s: state.duration,
    period_s: state.period,
    flow_L_min: state.flow * 60000,
    arms: state.arms.map((arm) => ({
      level: arm.level,
      rpm: (arm.omega * 30) / Math.PI,
      stalled: arm.stalled,
    })),
    exposureKey: keys[index] ?? '',
    exposure: (sets[index] as ExposureSet).stats,
  }));
  const machine: MachineWashResult = {
    machineId: spec.id,
    programmeId: input.programme.id,
    duration_s: hydraulics.schedule.duration,
    ticks: replay.ticks,
    states,
    water_L: totals.mainsWater * 1000,
    energy_kWh: totals.energy / 3.6e6,
    heldWater_mL: trapped * 1e6,
    dispenser: input.dispenserBlocked === true ? 'blocked' : 'free',
    detergent: {
      dosed_g: replay.detergent.dosed * 1000,
      dissolved_g: replay.detergent.dissolved * 1000,
    },
    carryOver: replay.carryOver,
    liquor: { fields: [...LIQUOR_FIELDS], tickTime_s: replay.tickTime, values: replay.liquor },
    soil: {
      initial_mg: replay.soilLedger.initial * 1e6,
      remaining_mg: replay.soilLedger.remaining * 1e6,
      toLiquor_mg: replay.soilLedger.toLiquor * 1e6,
      toPools_mg: replay.soilLedger.toPools * 1e6,
    },
    timelineProblems: hydraulics.schedule.timeline.problems.map(
      (p) => `${p.code}: ${p.stepId}: ${p.message}`,
    ),
  };

  const detergentRecord = {
    name: input.detergent?.name ?? 'machine default',
    dose_g: spec.dosing.detergentMass * 1000,
  };
  const inputHash = canonicalHash({
    machine: canonicalHash(spec),
    config,
    programme: canonicalHash(input.programme),
    scene: sceneKey,
    soils: items.map((item) => ({ itemId: item.itemId, soils: item.soils })),
    tier: input.tier,
    levelSeed: input.levelSeed >>> 0,
    simSeed: input.simSeed >>> 0,
    params: params.overrides,
    paramSets: input.paramSets ?? [],
    detergent: detergentRecord,
    dispenserBlocked: input.dispenserBlocked === true,
    stalledArms: input.stalledArms ?? {},
  });
  const resultHash = canonicalHash({
    soilClasses: classes,
    items: itemResults.map((item) => {
      const { cells: _cells, ...scalars } = item;
      return scalars;
    }),
    machine: { ...machine, liquor: { fields: machine.liquor.fields } },
    problems,
    state: arraysHash([
      soilState.cell,
      soilState.mass0,
      soilState.mass,
      soilState.hydration,
      replay.liquor,
      replay.tickTime,
      replay.retainedFilm,
    ]),
  });
  lap('result');
  progress('result', 1);

  return {
    provenance: {
      simVersion: SIM_VERSION,
      tier: input.tier,
      hydroHash: params.hydroHash,
      soilHash: params.soilHash,
      inputHash,
      levelSeed: input.levelSeed >>> 0,
      simSeed: input.simSeed >>> 0,
      exposureSchema: EXPOSURE_SET_SCHEMA,
      exposureStandIn: sets.some((set) => set?.standIn === true),
      exposureBackend,
      paramSets: input.paramSets ?? [],
      detergent: detergentRecord,
      exposureSource,
      sourceFingerprint: options.sourceFingerprint ?? '',
      resultHash,
    },
    soilClasses: classes,
    items: itemResults,
    machine,
    problems,
    run: {
      timings_ms: timings,
      sceneReused,
      exposureCacheHits: cacheHits,
      exposureComputed: computed,
      blocks: scene.blocks.count,
      soilCells: scene.soilCells.count,
      deposits: soilState.count,
    },
  };
}
