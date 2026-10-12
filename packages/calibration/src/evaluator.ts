/**
 * The evaluator: what the simulation predicts for the observations of a wash record, for many
 * parameter sets, at the cost of one replay each (docs/calibration/fitting.md section 4).
 *
 * `prepareRecord` does once what does not depend on the soil, liquor and observation
 * parameters: the machine and the programme of the record, the scene, and the exposure of
 * every spray state. The exposure is obtained by running `wash()` of `@spotless/sim-core` on
 * the record's load without soils against the exposure cache and reading the sets back by the
 * keys the result names, so the evaluator does not know or care how exposure is computed.
 *
 * `PreparedRecord.evaluate(params)` then lays the soil down, replays the programme with the
 * public stages (`initSoil`, `createWashSoil`, `createWashLiquor`, `replayWash`) and reads the
 * predictions off the soil state: at the end, and at the time of every observation taken by
 * opening the door, in the same replay.
 *
 * What a replay is restricted to, and what that ignores:
 *
 *  - `restrict: 'observed'` (default): only the soils of observed items are replayed. Deposits
 *    do not act on each other except through the liquor, so this is exact for the observed
 *    items but for one thing: soil washed off the other items no longer loads the liquor
 *    (it consumes peracid, `liq.kSoil`). With `background` (default) that is put back: the
 *    other soils are replayed once at the parameters of the preparation, and what they release
 *    into the sump is fed to every later replay as a fixed history. Exact at those parameters,
 *    and nearly so near them; what is ignored is the change of that history with the
 *    parameters being fitted.
 *  - a soil on a described patch is laid on its whole region by the soil stage and cut down to
 *    the cells of the patch, with the loading the weighed amount gives on the patch.
 *  - `thin: k` keeps the soil cells whose index is a multiple of k (one in k of every block's
 *    cells) and scales masses and areas up. Mass and area fractions keep their expectation and
 *    gain sampling scatter; speck counts, scores and clean verdicts, which hang on single
 *    cells and their neighbours, are no longer those of the full replay. Off by default.
 *
 * Parameters of the `hydro` group need a new preparation (`EvaluatorPool` keeps one per hydro
 * hash); the `cal.*` scales are applied to the cached exposure tables here, and the `prog.*`
 * parameters rebuild the schedule, not the exposure.
 */

import { instantiate } from '@spotless/catalogue';
import {
  canonicalHash,
  poseInverseTransformPoint,
  quatInverseRotate,
  type Vec3,
} from '@spotless/core';
import {
  inspectionRules,
  inspectItem,
  type InspectionElements,
  type InspectionRules,
  type StandingResidue,
} from '@spotless/inspector';
import {
  buildMachineGeometry,
  type MachineConfig,
  type MachineSpec,
  type ProgrammeSpec,
  type ProgrammeStep,
} from '@spotless/machine';
import {
  buildWashHydraulics,
  buildWashScene,
  canonicalPose,
  classShareOf,
  createMemoryExposureCache,
  createWashLiquor,
  createWashSoil,
  decodeExposureSet,
  EXPOSURE_SET_SCHEMA,
  initSoil,
  releasedByClass,
  JET_FIELD,
  JET_FIELD_COUNT,
  replayWash,
  SCENE_NONE,
  sceneChamber,
  sceneGeometryKey,
  sceneMachineParts,
  sceneMaterialOf,
  SIM_VERSION,
  soilTypeInfo,
  soilVisibility,
  standingResidueOf,
  TIERS,
  trappedWaterByStep,
  wash,
  WATER_FIELD,
  WATER_FIELD_COUNT,
  type ExposureCache,
  type ExposureSet,
  type ItemSoilRecord,
  type ParamSet,
  type ParamValue,
  type SceneItem,
  type SoilForcing,
  type SoilRecordState,
  type SoilState,
  type WashHydraulics,
  type WashInput,
  type WashItemInput,
  type WashScene,
  type WashSoil,
} from '@spotless/sim-core';
import { isCalibrationKey, washOverridesOf } from './cal-params.ts';
import { washLoadOfRecord, type PatchPlan } from './load.ts';
import {
  predictEta,
  resolveObsConstants,
  THRESHOLD_LOG_CAP,
  visibilityThresholdLog,
  visibleShare,
  type ObsConstants,
  type ScoreRule,
  type TargetState,
} from './observation.ts';
import {
  observationIdOf,
  observationSd,
  soilIdOf,
  type ObservationKind,
  type RecordObservation,
  type WashRecord,
} from './record.ts';
import { machineOfRecord, programmeOfRecord, RecordSetupError, retimedStep } from './setup.ts';

/** Options of {@link prepareRecord}: how to evaluate, never what the record says. */
export interface EvaluatorOptions {
  /** Where exposure sets are kept; default a cache in memory that lives with the preparation. */
  readonly cache?: ExposureCache;
  /** Replay the soils of observed items only (default), or all of them. */
  readonly restrict?: 'observed' | 'all';
  /** With `restrict: 'observed'`: feed the release of the other soils to the liquor. Default true. */
  readonly background?: boolean;
  /** Keep one soil cell in this many (see the file comment); default 1, all of them. */
  readonly thin?: number;
  /** A scene built before for the same geometry and scene parameters, to be reused. */
  readonly scenes?: Map<string, WashScene>;
  /**
   * True to run the orchestrator's wash again even when the cache already holds the summary of
   * an earlier one for the same load, machine, programme and water parameters (the summary names
   * the exposure sets, so that a later preparation reads them without a wash). Use it after the
   * exposure code changed without a new simulator version.
   */
  readonly refreshExposure?: boolean;
  /** Called with what the preparation is doing. */
  readonly onProgress?: (what: string) => void;
}

/** One observation of a record as the evaluator sees it. */
export interface ObservationSpec {
  /** Position in the record's observations. */
  readonly index: number;
  readonly id: string;
  readonly kind: ObservationKind;
  readonly itemId: string;
  /** `item`, `region:<id>` or `soil:<id>`. */
  readonly target: string;
  /** Seconds from the start of the programme, or null for the end. */
  readonly at: number | null;
  /** The observed value; undefined in a planned record. */
  readonly value: number | boolean | undefined;
  /** Stated standard uncertainty in the unit of the value; 0 where none applies. */
  readonly sd: number;
  /** False for an observation that is reported and not fitted (`RecordObservation.fitted`); absent: fitted. */
  readonly fitted?: boolean;
}

/** An observation of a group of items (`RecordGroupObservation`) as the evaluator takes it. */
export interface GroupSpec {
  /** Position in the record's group observations. */
  readonly index: number;
  readonly id: string;
  readonly members: readonly { readonly itemId: string; readonly weight: number }[];
  /** The observed mean score; undefined in a planned record. */
  readonly value: number | undefined;
  readonly sd: number;
}

/** What the simulation predicts for the observations of a record. */
export interface RecordPrediction {
  readonly recordId: string;
  /** Per observation of the record, in order: the scalar prediction of its model. */
  readonly eta: Float64Array;
  /**
   * Per group observation of the record, in order: the weighted mean of the continuous scores
   * of its items at the end of the programme. Absent or empty for a record without any.
   */
  readonly groupEta?: Float64Array;
  /** Per observation: the simulated state of its target at its time. */
  readonly states: readonly TargetState[];
  /**
   * For a record with input scenarios (`sim.scenarios`: inputs that were not measured): the
   * normalised weights of the scenarios and, per scenario, the prediction and the state of
   * every observation. `eta` and `states` above are those of the first, nominal scenario. A
   * likelihood integrates the scenarios out per item (`recordLikelihood`).
   */
  readonly scenarios?: {
    readonly weights: readonly number[];
    readonly eta: readonly Float64Array[];
    readonly states: readonly (readonly TargetState[])[];
  };
  /** The rule of the inspector at these parameters, and the observation constants. */
  readonly rule: ScoreRule;
  readonly constants: ObsConstants;
  /** Wall-clock milliseconds of this evaluation (0 for one answered from memory). */
  readonly elapsed_ms: number;
  /** True when the replay was not run again (only observation constants differed). */
  readonly reused: boolean;
}

/** Numbers about a preparation. */
export interface PreparedInfo {
  readonly tier: 'official' | 'fast';
  readonly blocks: number;
  readonly soilCells: number;
  /** Deposits replayed per evaluation, and those of the whole load. */
  readonly deposits: number;
  readonly depositsOfLoad: number;
  /** Items whose soils are replayed, and items of the load. */
  readonly itemsReplayed: number;
  readonly items: number;
  readonly ticks: number;
  readonly sprayStates: number;
  /** Input scenarios replayed per evaluation (1: the record as written). */
  readonly scenarios: number;
  /** True when a stand-in stage computed the exposure. */
  readonly exposureStandIn: boolean;
  /** Exposure sets taken from the cache, and computed, by the preparation. */
  readonly exposureCacheHits: number;
  readonly exposureComputed: number;
  /** Wall-clock milliseconds of the preparation, by part. */
  readonly timings_ms: Readonly<Record<string, number>>;
  /** What the replay is restricted to, in words. */
  readonly restriction: string;
  /** What could not be simulated as the record states it. */
  readonly notes: readonly string[];
}

/** A record made ready for many evaluations. */
export interface PreparedRecord {
  readonly record: WashRecord;
  /** Hydro hash of the parameters the exposure was computed with. */
  readonly hydroHash: string;
  readonly observations: readonly ObservationSpec[];
  /** The group observations of the record (mean scores of groups of items). */
  readonly groups: readonly GroupSpec[];
  readonly info: PreparedInfo;
  /** The programme as it is replayed (adapted to a measured course). */
  readonly programme: ProgrammeSpec;
  /**
   * The predictions at `params` (a set on the calibration registry). Throws
   * {@link HydroMismatchError} when its hydro group differs from that of the preparation.
   */
  evaluate(params: ParamSet): Promise<RecordPrediction>;
  /** The effective parameters of this record at `params`: the record's own overrides on top. */
  paramsFor(params: ParamSet): ParamSet;
  /**
   * The predictions at `params` with every soil of the load replayed (no restriction, no
   * frozen background): what `evaluate` approximates when the replay is restricted. One replay
   * of the whole load; the same as `evaluate` where nothing is restricted.
   */
  evaluateFull(params: ParamSet): Promise<RecordPrediction>;
  /**
   * Computes the background (what the soils that are not replayed release into the liquor)
   * again at `params` and forgets every remembered replay. Returns false, and does nothing,
   * when the replay has no background. Later evaluations are exact at `params`.
   */
  refreshBackground(params: ParamSet): Promise<boolean>;
  /**
   * The parameters the background was last computed at (overrides of the effective set), or
   * null when the replay has none.
   */
  backgroundAt(): Readonly<Record<string, ParamValue>> | null;
  /**
   * The input of `wash()` that reproduces this record at `params`: the machine and the load of
   * the record, its programme with the `prog.*` parameters applied, and the overrides of the
   * wash registry. `exact` is false, with the reasons in `notes`, where `wash()` cannot do what
   * the evaluator does (a soil on a described patch, a `cal.*` scale other than 1).
   */
  washInputAt(params: ParamSet): {
    readonly input: WashInput;
    readonly programme: ProgrammeSpec;
    readonly exact: boolean;
    readonly notes: readonly string[];
  };
}

/**
 * Nodes of ln tau on which the visible area of a target is found against a factor tau on the
 * visibility thresholds (sub-element coverage): fine about the inspector's own thresholds
 * (tau = 1), out to factors of 400 either way.
 */
// literal-ok-begin: named arithmetic control, documented where it is declared
const LN_TAU_NODES: readonly number[] = [
  -6, -4, -3, -2, -1.5, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 6,
];
// literal-ok-end

/** Thrown by `evaluate` for parameters whose hydro group is not that of the preparation. */
export class HydroMismatchError extends Error {
  override readonly name = 'HydroMismatchError';
}

/** Soil elements of a target and how its deposits map onto them. */
interface TargetUnit {
  readonly key: string;
  readonly itemId: string;
  readonly regionIds: readonly string[];
  /** Deposits of the target (indices into the soil state) with the slot `C e + k` of each. */
  readonly deposits: Uint32Array;
  readonly slots: Uint32Array;
  readonly elements: InspectionElements;
  /** Area of the elements, mm2, and the factor that undoes thinning. */
  readonly soiledAreaMm2: number;
  readonly scale: number;
}

interface Layout {
  readonly signature: string;
  readonly units: ReadonlyMap<string, TargetUnit>;
}

const NEIGHBOUR_REACH = 1.5;

function regionIdsOf(shape: SceneItem['shape']): string[] {
  const ids: string[] = [];
  for (const region of shape.regions) if (!ids.includes(region.id)) ids.push(region.id);
  return ids;
}

/** FNV-1a over the words of an array: a cheap signature of a deposit layout. */
function signatureOf(cells: Uint32Array, records: Uint32Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < cells.length; i++) {
    h = Math.imul(h ^ (cells[i] as number), 0x01000193);
    h = Math.imul(h ^ (records[i] as number), 0x01000193);
  }
  return `${cells.length}:${h >>> 0}`;
}

/** The hash of what a replay depends on among the `soil` group: everything but `obs.*`. */
function replayKeyOf(params: ParamSet): string {
  const values: Record<string, ParamValue> = {};
  for (const [key, value] of Object.entries(params.values('soil'))) {
    if (!key.startsWith('obs.') || key === 'obs.visibilityLogSd') values[key] = value;
  }
  return canonicalHash(values);
}

/** The values of the hydro group that the scene may depend on: all but the exposure stages'. */
function sceneParamsKey(params: ParamSet): string {
  const values: Record<string, ParamValue> = {};
  for (const [key, value] of Object.entries(params.values('hydro'))) {
    const prefix = key.split('.')[0];
    if (prefix !== 'jets' && prefix !== 'film' && prefix !== 'spray' && prefix !== 'hyd') {
      values[key] = value;
    }
  }
  return canonicalHash(values);
}

/**
 * The parameters of the `soil` group that decide when the spray states of a programme run and
 * not what they are: the calibration's own (`prog.mainWashTargetShift`, `prog.mainWashHoldScale`,
 * `prog.finalRinseTargetShift`) and the soak of Eco 50 in the wash registry (`prog.soakDuty`,
 * `prog.soakCycle`, `prog.soakFrom`). A replay builds its schedule again when one of them
 * differs from the preparation's; the cached exposure is the same.
 */
export const SCHEDULE_KEYS: readonly string[] = [
  'prog.mainWashTargetShift',
  'prog.mainWashHoldScale',
  'prog.finalRinseTargetShift',
  'prog.soakDuty',
  'prog.soakCycle',
  'prog.soakFrom',
];

/** The calibration's own schedule keys with the value that leaves the programme as written. */
const PROGRAMME_AS_WRITTEN: Readonly<Record<string, number>> = {
  'prog.mainWashTargetShift': 0,
  'prog.mainWashHoldScale': 1,
  'prog.finalRinseTargetShift': 0,
};

/**
 * What the schedule of a replay depends on at `params`; with `asWritten`, that of the
 * programme as the record gives it (the calibration's own keys at the values that change
 * nothing) with the soak of `params`.
 */
function scheduleKeyOf(params: ParamSet, asWritten = false): string {
  return SCHEDULE_KEYS.map((key) =>
    String(asWritten ? (PROGRAMME_AS_WRITTEN[key] ?? params.get(key)) : params.get(key)),
  ).join('|');
}

/** The programme with the `prog.*` parameters applied. */
function shiftedProgramme(programme: ProgrammeSpec, params: ParamSet): ProgrammeSpec {
  const washShift = params.get('prog.mainWashTargetShift');
  const holdScale = params.get('prog.mainWashHoldScale');
  const rinseShift = params.get('prog.finalRinseTargetShift');
  if (washShift === 0 && holdScale === 1 && rinseShift === 0) return programme;
  const steps = programme.steps.map((step): ProgrammeStep => {
    if (step.kind !== 'heat' && step.kind !== 'hold') return step;
    const shift =
      step.phase === 'main_wash' ? washShift : step.phase === 'final_rinse' ? rinseShift : 0;
    if (step.kind === 'heat') return shift === 0 ? step : { ...step, target: step.target + shift };
    const scale = step.phase === 'main_wash' ? holdScale : 1;
    if (shift === 0 && scale === 1) return step;
    const retimed = scale === 1 ? step : retimedStep(step, Math.round(step.duration * scale));
    return retimed.kind === 'hold'
      ? { ...retimed, target: retimed.target === null ? null : retimed.target + shift }
      : retimed;
  });
  return { ...programme, steps };
}

/** A copy of an exposure set with columns of its tables multiplied. */
function scaledExposure(
  set: ExposureSet,
  jetShear: number,
  filmShear: number,
  hold: number,
): ExposureSet {
  if (jetShear === 1 && filmShear === 1 && hold === 1) return set;
  let jets = set.jets;
  if (jetShear !== 1) {
    const values = Float32Array.from(set.jets.values);
    for (let i = 0; i < set.jets.cell.length; i++) {
      const o = JET_FIELD_COUNT * i;
      values[o + JET_FIELD.shearPeak] = (values[o + JET_FIELD.shearPeak] as number) * jetShear;
      values[o + JET_FIELD.shearMean] = (values[o + JET_FIELD.shearMean] as number) * jetShear;
    }
    jets = { ...set.jets, values };
  }
  let water = set.water;
  if (filmShear !== 1 || hold !== 1) {
    const values = Float32Array.from(set.water.values);
    for (let b = 0; b < set.water.blockCount; b++) {
      const o = WATER_FIELD_COUNT * b;
      values[o + WATER_FIELD.shear] = (values[o + WATER_FIELD.shear] as number) * filmShear;
      values[o + WATER_FIELD.holdTime] = (values[o + WATER_FIELD.holdTime] as number) * hold;
    }
    water = { ...set.water, values };
  }
  return { ...set, jets, water };
}

/** The cells of a patch among the soil cells of a region of an instance. */
function patchCells(
  scene: WashScene,
  instanceIndex: number,
  plan: PatchPlan,
): { cells: Set<number>; area: number; regionArea: number; problem?: string } {
  const instance = scene.instances[instanceIndex];
  const cells = new Set<number>();
  if (instance === undefined) return { cells, area: 0, regionArea: 0, problem: 'not in the scene' };
  const { blocks, soilCells } = scene;
  const patch = plan.patch;
  const centre: Vec3 = [
    patch.centre_mm[0] / 1000,
    patch.centre_mm[1] / 1000,
    patch.centre_mm[2] / 1000,
  ];
  const depth = (patch.depth_mm ?? 5) / 1000;
  interface Candidate {
    cell: number;
    p: Vec3;
    n: Vec3;
    area: number;
  }
  const candidates: Candidate[] = [];
  let regionArea = 0;
  for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
    const regionIndex = blocks.region[b] as number;
    if (regionIndex < 0 || instance.shape.regions[regionIndex]?.id !== patch.region) continue;
    const first = blocks.soilFirst[b] as number;
    if (first === SCENE_NONE) continue;
    const n = quatInverseRotate(instance.pose.q, [
      blocks.normal[3 * b] as number,
      blocks.normal[3 * b + 1] as number,
      blocks.normal[3 * b + 2] as number,
    ]);
    for (let q = 0; q < 4; q++) {
      const c = first + q;
      const p = poseInverseTransformPoint(instance.pose, [
        soilCells.centre[3 * c] as number,
        soilCells.centre[3 * c + 1] as number,
        soilCells.centre[3 * c + 2] as number,
      ]);
      const area = soilCells.area[c] as number;
      regionArea += area;
      candidates.push({ cell: c, p, n, area });
    }
  }
  if (candidates.length === 0) {
    return { cells, area: 0, regionArea, problem: `no soil cells on region "${patch.region}"` };
  }
  // The centre as stated may lie a little off the surface: take the nearest cell as its foot.
  let nearest = candidates[0] as Candidate;
  let best = Infinity;
  for (const candidate of candidates) {
    const d = Math.hypot(
      candidate.p[0] - centre[0],
      candidate.p[1] - centre[1],
      candidate.p[2] - centre[2],
    );
    if (d < best) {
      best = d;
      nearest = candidate;
    }
  }
  const reach = depth + 2 * Math.sqrt(nearest.area);
  if (best > reach) {
    return {
      cells,
      area: 0,
      regionArea,
      problem: `the centre of the patch is ${(best * 1000).toFixed(1)} mm from region "${patch.region}"`,
    };
  }
  const n = nearest.n;
  // The patch is laid out about the stated centre projected onto the surface at its foot.
  const off =
    (centre[0] - nearest.p[0]) * n[0] +
    (centre[1] - nearest.p[1]) * n[1] +
    (centre[2] - nearest.p[2]) * n[2];
  const foot: Vec3 = [centre[0] - off * n[0], centre[1] - off * n[1], centre[2] - off * n[2]];
  let u: Vec3 = [1, 0, 0];
  if (patch.u_axis !== undefined) u = [patch.u_axis[0], patch.u_axis[1], patch.u_axis[2]];
  const along = u[0] * n[0] + u[1] * n[1] + u[2] * n[2];
  u = [u[0] - along * n[0], u[1] - along * n[1], u[2] - along * n[2]];
  if (Math.hypot(u[0], u[1], u[2]) < 1e-6) {
    u = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
    const a2 = u[0] * n[0] + u[1] * n[1] + u[2] * n[2];
    u = [u[0] - a2 * n[0], u[1] - a2 * n[1], u[2] - a2 * n[2]];
  }
  const un = Math.hypot(u[0], u[1], u[2]);
  u = [u[0] / un, u[1] / un, u[2] / un];
  const v: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const radius = (patch.diameter_mm ?? 0) / 2000;
  const half: [number, number] = [
    (patch.size_mm?.[0] ?? 0) / 2000,
    (patch.size_mm?.[1] ?? 0) / 2000,
  ];
  let area = 0;
  for (const candidate of candidates) {
    const d: Vec3 = [candidate.p[0] - foot[0], candidate.p[1] - foot[1], candidate.p[2] - foot[2]];
    const du = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    const dv = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
    const dn = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
    if (Math.abs(dn) > depth) continue;
    const inside =
      patch.shape === 'disc'
        ? Math.hypot(du, dv) <= radius
        : Math.abs(du) <= half[0] && Math.abs(dv) <= half[1];
    if (inside) {
      cells.add(candidate.cell);
      area += candidate.area;
    }
  }
  if (cells.size === 0) {
    // A patch smaller than a cell: the cell at its foot stands for it.
    cells.add(nearest.cell);
    area = nearest.area;
  }
  return { cells, area, regionArea };
}

/** The soil state restricted to patches and thinned, with exact dry masses per record. */
function restrictState(
  state: SoilState,
  keep: (deposit: number, record: SoilRecordState) => boolean,
  dryMassOf: (record: SoilRecordState) => number,
): SoilState {
  const kept: number[] = [];
  const records: SoilRecordState[] = [];
  const recordOut: number[] = [];
  const scale: number[] = [];
  state.records.forEach((record) => {
    const first = kept.length;
    let mass = 0;
    let area = 0;
    for (let d = record.firstDeposit; d < record.firstDeposit + record.depositCount; d++) {
      if (!keep(d, record)) continue;
      kept.push(d);
      recordOut.push(records.length);
      mass += (state.mass0[d] as number) * (state.area[d] as number);
      area += state.area[d] as number;
    }
    const count = kept.length - first;
    const target = dryMassOf(record);
    const factor = mass > 0 ? target / mass : 0;
    for (let i = 0; i < count; i++) scale.push(factor);
    records.push({
      ...record,
      firstDeposit: first,
      depositCount: count,
      dryMass: count > 0 ? target : 0,
      coveredArea: area,
    });
  });
  const n = kept.length;
  const cell = new Uint32Array(n);
  const block = new Uint32Array(n);
  const classCode = new Uint8Array(n);
  const area = new Float32Array(n);
  const mass0 = new Float64Array(n);
  const hydration = new Float64Array(n);
  const eroded = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const d = kept[i] as number;
    cell[i] = state.cell[d] as number;
    block[i] = state.block[d] as number;
    classCode[i] = state.classCode[d] as number;
    area[i] = state.area[d] as number;
    mass0[i] = (state.mass0[d] as number) * (scale[i] as number);
    hydration[i] = state.hydration[d] as number;
    // A depth taken from the deposit (0 in a state just laid down): it scales with its loading.
    eroded[i] = ((state.eroded[d] as number | undefined) ?? 0) * (scale[i] as number);
  }
  return {
    classes: state.classes,
    count: n,
    cell,
    block,
    record: Uint32Array.from(recordOut),
    classCode,
    area,
    mass0,
    mass: Float64Array.from(mass0),
    hydration,
    eroded,
    records,
    problems: state.problems,
  };
}

/** The element table of a set of deposits of one item, with neighbours on the surface. */
function buildUnit(
  key: string,
  itemId: string,
  scene: WashScene,
  state: SoilState,
  deposits: number[],
  regionIds: readonly string[],
  scale: number,
): TargetUnit {
  const classCount = state.classes.length;
  const cellSet = new Set<number>();
  for (const d of deposits) cellSet.add(state.cell[d] as number);
  const cells = Uint32Array.from(cellSet).sort();
  const count = cells.length;
  const elementOf = new Map<number, number>();
  cells.forEach((c, e) => elementOf.set(c, e));
  const instanceIndex = scene.itemInstance.get(itemId);
  const instance = instanceIndex === undefined ? undefined : scene.instances[instanceIndex];
  const region = new Uint16Array(count).fill(0xffff);
  const areaMm2 = new Float32Array(count);
  let soiled = 0;
  for (let e = 0; e < count; e++) {
    const c = cells[e] as number;
    const b = scene.soilCells.block[c] as number;
    areaMm2[e] = (scene.soilCells.area[c] as number) * 1e6;
    soiled += areaMm2[e] as number;
    const regionIndex = scene.blocks.region[b] as number;
    const id = regionIndex >= 0 ? instance?.shape.regions[regionIndex]?.id : undefined;
    const slot = id === undefined ? -1 : regionIds.indexOf(id);
    if (slot >= 0) region[e] = slot;
  }
  // Neighbours: elements of the same block and of adjoining blocks within one and a half mean
  // cell sides (the rule of the orchestrator's element table).
  const offsets = new Uint32Array(count + 1);
  const indices: number[] = [];
  const centre = scene.soilCells.centre;
  const graph = scene.graph;
  const consider = (c: number, block: number, into: number[]): void => {
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
      if (d <= reach) into.push(o);
    }
  };
  for (let e = 0; e < count; e++) {
    const c = cells[e] as number;
    const b = scene.soilCells.block[c] as number;
    const own: number[] = [];
    consider(c, b, own);
    for (let k = graph.offsets[b] as number; k < (graph.offsets[b + 1] as number); k++) {
      consider(c, graph.neighbour[k] as number, own);
    }
    for (const o of [...new Set(own)].sort((x, y) => x - y)) indices.push(o);
    offsets[e + 1] = indices.length;
  }
  const slots = new Uint32Array(deposits.length);
  deposits.forEach((d, i) => {
    slots[i] =
      classCount * (elementOf.get(state.cell[d] as number) as number) +
      (state.classCode[d] as number);
  });
  return {
    key,
    itemId,
    regionIds,
    deposits: Uint32Array.from(deposits),
    slots,
    elements: {
      count,
      region,
      areaMm2,
      initial_mg_cm2: new Float32Array(count * classCount),
      residual_mg_cm2: new Float32Array(count * classCount),
      neighbours: { offsets, indices: Uint32Array.from(indices) },
    },
    soiledAreaMm2: soiled,
    scale,
  };
}

/**
 * The state of a target for the masses of a snapshot. `standing` is what the water left
 * standing in the item at the end left on the target where it stood (as the wash lays it,
 * `standingResidueOf` of `@spotless/sim-core`): it is residue and visibly soiled area of the
 * target beside what its own soil cells carry, and it is not thinned.
 */
function targetState(
  unit: TargetUnit,
  state: SoilState,
  mass: Float64Array,
  rules: InspectionRules,
  logSd: number,
  pooledWater: number,
  standing?: StandingResidue,
): TargetState {
  const { elements } = unit;
  const classCount = state.classes.length;
  const initial = elements.initial_mg_cm2;
  const residual = elements.residual_mg_cm2;
  initial.fill(0);
  residual.fill(0);
  let m0 = 0;
  let m = 0;
  for (let i = 0; i < unit.deposits.length; i++) {
    const d = unit.deposits[i] as number;
    const slot = unit.slots[i] as number;
    const area = state.area[d] as number;
    // 1 kg/m2 = 100 mg/cm2.
    initial[slot] = (initial[slot] as number) + (state.mass0[d] as number) * 100;
    residual[slot] = (residual[slot] as number) + (mass[d] as number) * 100;
    m0 += (state.mass0[d] as number) * area;
    m += (mass[d] as number) * area;
  }
  const inspection = inspectItem(
    {
      itemId: unit.itemId,
      regionIds: unit.regionIds,
      classCount,
      elements,
      pooledWater_mL: pooledWater,
      ...(standing === undefined ? {} : { standing }),
    },
    rules,
  );
  // The patches under standing water: their visibility index as the inspector reads it (the
  // absolute thresholds), and their area. They are whole or not at all, and are not thinned.
  const patchIndex: number[] = [];
  const patchArea: number[] = [];
  if (standing !== undefined) {
    for (let p = 0; p < standing.count; p++) {
      let sum = 0;
      for (let k = 0; k < classCount; k++) {
        const mk = standing.residue_mg_cm2[classCount * p + k] as number;
        if (!(mk > 0)) continue;
        const threshold = rules.visibleMass_mg_cm2[k] as number;
        sum += threshold > 0 ? mk / threshold : Infinity;
      }
      if (!(sum > 0)) continue;
      patchIndex.push(sum);
      patchArea.push(standing.areaMm2[p] as number);
    }
  }
  const standingVisible = inspection.standingVisibleAreaMm2;
  const ownVisible = inspection.visibleAreaMm2 - standingVisible;
  const limits = [...rules.areaBandsMm2, rules.maxAreaMm2];
  const curveOf = rules.visibleShareOf;
  if (curveOf !== undefined) {
    // The soil model gives the share of an element above a threshold (sub-element coverage:
    // what the inspector sums). The area an observer whose thresholds are tau times the
    // inspector's would see is then A(tau) = sum of a_e phi_e(tau), found on a grid of
    // ln tau; from it the area an observer is expected to see (the mean of A over the
    // scatter of observers) and c(L), the ln tau at which A just meets each limit.
    const seen = new Float64Array(LN_TAU_NODES.length);
    // As the inspector: a residue is seen where the visibly soiled part of a dot-sized patch
    // is at least a speck (here: where the element's own share would fill that much of a
    // dot, which is the inspector's rule for an element among neighbours like itself).
    const dotArea = (Math.PI * rules.dotDiameterMm * rules.dotDiameterMm) / 4;
    const minShare = dotArea > 0 ? rules.speckMinAreaMm2 / dotArea : 0;
    for (let e = 0; e < elements.count; e++) {
      const curves: ((threshold: number) => number)[] = [];
      const levels: number[] = [];
      for (let k = 0; k < classCount; k++) {
        const mk = residual[classCount * e + k] as number;
        if (!(mk > 0)) continue;
        const m0k = initial[classCount * e + k] as number;
        let threshold = rules.visibleMass_mg_cm2[k] as number;
        const share = rules.visibleFraction[k] as number;
        if (share > 0) threshold = Math.min(threshold, share * m0k);
        curves.push(curveOf(k, m0k, mk));
        levels.push(threshold);
      }
      if (curves.length === 0) continue;
      const a = elements.areaMm2[e] as number;
      for (let j = 0; j < LN_TAU_NODES.length; j++) {
        const tau = Math.exp(LN_TAU_NODES[j] as number);
        let phi = 0;
        for (let c = 0; c < curves.length; c++) {
          phi += (curves[c] as (threshold: number) => number)(tau * (levels[c] as number));
        }
        if (phi >= minShare) seen[j] = (seen[j] as number) + a * (phi < 1 ? phi : 1);
      }
    }
    // What an observer whose thresholds are tau times the inspector's sees of the patches
    // under standing water: those whose index is tau or more, each whole.
    const seenStanding = new Float64Array(LN_TAU_NODES.length);
    for (let j = 0; j < LN_TAU_NODES.length; j++) {
      const tau = Math.exp(LN_TAU_NODES[j] as number);
      for (let p = 0; p < patchIndex.length; p++) {
        if ((patchIndex[p] as number) >= tau) {
          seenStanding[j] = (seenStanding[j] as number) + (patchArea[p] as number);
        }
      }
    }
    const seenAt = (j: number): number =>
      (seen[j] as number) * unit.scale + (seenStanding[j] as number);
    let softArea = 0;
    let weight = 0;
    for (let j = 0; j < LN_TAU_NODES.length; j++) {
      const x = LN_TAU_NODES[j] as number;
      const lo = j > 0 ? 0.5 * (x - (LN_TAU_NODES[j - 1] as number)) : 0;
      const hi = j + 1 < LN_TAU_NODES.length ? 0.5 * ((LN_TAU_NODES[j + 1] as number) - x) : 0;
      const w =
        logSd > 0 ? (lo + hi) * Math.exp((-0.5 * x * x) / (logSd * logSd)) : x === 0 ? 1 : 0;
      softArea += w * seenAt(j);
      weight += w;
    }
    const crossing = (limit: number): number => {
      const last = LN_TAU_NODES.length - 1;
      if (!(seenAt(0) > limit)) return -THRESHOLD_LOG_CAP;
      if (seenAt(last) > limit) return THRESHOLD_LOG_CAP;
      for (let j = 0; j < last; j++) {
        const a0 = seenAt(j);
        const a1 = seenAt(j + 1);
        if (a0 > limit && !(a1 > limit)) {
          const x0 = LN_TAU_NODES[j] as number;
          const x1 = LN_TAU_NODES[j + 1] as number;
          return a0 > a1 ? x0 + ((x1 - x0) * (a0 - limit)) / (a0 - a1) : x1;
        }
      }
      return THRESHOLD_LOG_CAP;
    };
    const cs = limits.map(crossing);
    return {
      initialMass_mg: m0 * 1e6 * unit.scale,
      residualMass_mg: m * 1e6 * unit.scale + inspection.standingResidue_mg,
      soiledAreaMm2: unit.soiledAreaMm2 * unit.scale,
      visibleAreaMm2: ownVisible * unit.scale + standingVisible,
      softVisibleAreaMm2: weight > 0 ? softArea / weight : 0,
      bandThresholdLog: cs.slice(0, rules.areaBandsMm2.length),
      cleanThresholdLog: cs[rules.areaBandsMm2.length] as number,
      specks: inspection.specks,
      score: inspection.score,
      clean: inspection.clean,
      pooledWater_mL: pooledWater,
    };
  }
  // Without sub-element coverage: the inspector's own visibility index per element; from it
  // the area an observer is expected to see and the thresholds at which the area would just
  // meet each limit.
  const index = new Float64Array(elements.count);
  let soft = 0;
  for (let e = 0; e < elements.count; e++) {
    let sum = 0;
    for (let k = 0; k < classCount; k++) {
      const mk = residual[classCount * e + k] as number;
      if (!(mk > 0)) continue;
      let threshold = rules.visibleMass_mg_cm2[k] as number;
      const share = rules.visibleFraction[k] as number;
      if (share > 0)
        threshold = Math.min(threshold, share * (initial[classCount * e + k] as number));
      sum += threshold > 0 ? mk / threshold : Infinity;
    }
    index[e] = sum;
    if (sum > 0) soft += (elements.areaMm2[e] as number) * visibleShare(sum, logSd);
  }
  // The patches under standing water join the elements, each with its area as it is (the
  // elements' areas are multiplied by the thinning, the patches' are not).
  let softStanding = 0;
  for (let p = 0; p < patchIndex.length; p++) {
    softStanding += (patchArea[p] as number) * visibleShare(patchIndex[p] as number, logSd);
  }
  const unscale = unit.scale > 0 ? 1 / unit.scale : 0;
  const thresholds =
    patchIndex.length === 0
      ? visibilityThresholdLog(index, elements.areaMm2, limits, unit.scale)
      : visibilityThresholdLog(
          [...index, ...patchIndex],
          [...elements.areaMm2, ...patchArea.map((area) => area * unscale)],
          limits,
          unit.scale,
        );
  return {
    initialMass_mg: m0 * 1e6 * unit.scale,
    residualMass_mg: m * 1e6 * unit.scale + inspection.standingResidue_mg,
    soiledAreaMm2: unit.soiledAreaMm2 * unit.scale,
    visibleAreaMm2: ownVisible * unit.scale + standingVisible,
    softVisibleAreaMm2: soft * unit.scale + softStanding,
    bandThresholdLog: thresholds.slice(0, rules.areaBandsMm2.length),
    cleanThresholdLog: thresholds[rules.areaBandsMm2.length] as number,
    specks: inspection.specks,
    score: inspection.score,
    clean: inspection.clean,
    pooledWater_mL: pooledWater,
  };
}

function targetKeyOf(observation: RecordObservation): string {
  if (observation.target?.soil !== undefined) return `soil:${observation.target.soil}`;
  if (observation.target?.region !== undefined) return `region:${observation.target.region}`;
  return 'item';
}

/**
 * Makes a record ready for many evaluations: see the file comment. `params` is a set on the
 * calibration registry; its hydro group fixes the exposure. Throws `RecordSetupError` for a
 * record the simulation cannot take.
 */
export async function prepareRecord(
  record: WashRecord,
  params: ParamSet,
  options: EvaluatorOptions = {},
): Promise<PreparedRecord> {
  const timings: Record<string, number> = {};
  let mark = performance.now();
  const lap = (name: string): void => {
    const now = performance.now();
    timings[name] = (timings[name] ?? 0) + (now - mark);
    mark = now;
  };
  const say = (what: string): void => options.onProgress?.(what);
  const notes: string[] = [];

  // ---- the machine, the programme and the load of the record
  const { spec, config, changes } = machineOfRecord(record);
  for (const change of changes) notes.push(`machine: ${change}`);
  const course = programmeOfRecord(record, spec, config);
  for (const note of course.notes) notes.push(`programme: ${note}`);
  const load = washLoadOfRecord(record, spec, config);
  for (const note of load.notes) notes.push(`load: ${note}`);
  const recordOverrides: Record<string, ParamValue> = {
    ...(record.sim?.params ?? {}),
    ...load.params,
  };
  const bicarbonate = record.consumables?.water?.bicarbonate_mmol_l;
  if (bicarbonate !== undefined && recordOverrides['liq.supplyBicarbonate'] === undefined) {
    // mmol/L is mol/m3.
    recordOverrides['liq.supplyBicarbonate'] = bicarbonate;
  }
  const paramsFor = (base: ParamSet): ParamSet =>
    Object.keys(recordOverrides).length === 0 ? base : base.with(recordOverrides);
  const prepared = paramsFor(params);
  const tierId = record.sim?.tier ?? 'fast';
  const tier = TIERS[tierId];
  const levelSeed = (record.sim?.level_seed ?? 1) >>> 0;
  const simSeed = (record.sim?.sim_seed ?? 1) >>> 0;
  const thin = Math.max(1, Math.round(options.thin ?? 1));
  // The input scenarios: the record as written when it names none.
  interface Scenario {
    readonly weight: number;
    readonly levelSeed: number;
    readonly amountFactors: Readonly<Record<string, number>>;
    readonly params: Readonly<Record<string, ParamValue>>;
  }
  const statedScenarios = record.sim?.scenarios ?? [];
  const scenarioWeight = statedScenarios.reduce((sum, sc) => sum + (sc.weight ?? 1), 0);
  const scenarios: Scenario[] =
    statedScenarios.length === 0
      ? [{ weight: 1, levelSeed, amountFactors: {}, params: {} }]
      : statedScenarios.map((sc) => ({
          weight: (sc.weight ?? 1) / scenarioWeight,
          levelSeed: (sc.level_seed ?? levelSeed) >>> 0,
          amountFactors: sc.amount_factors ?? {},
          params: (sc.params ?? {}) as Readonly<Record<string, ParamValue>>,
        }));
  for (const [k, sc] of scenarios.entries()) {
    if (
      Object.keys(sc.params).length > 0 &&
      prepared.with(sc.params).hydroHash !== prepared.hydroHash
    ) {
      throw new RecordSetupError(
        `record ${record.id}: sim.scenarios[${k}].params changes the water; a scenario may only change what is replayed`,
      );
    }
  }
  lap('setup');

  // ---- exposure, through the orchestrator and its cache
  const cache = options.cache ?? createMemoryExposureCache();
  const bare: WashItemInput[] = load.items.map((item) => ({ ...item, soils: [] }));
  const washInput: WashInput = {
    machine: spec,
    config,
    programme: course.programme,
    items: bare,
    tier: tierId,
    levelSeed,
    simSeed,
    params: washOverridesOf(prepared),
    dispenserBlocked: load.dispenserBlocked,
    ...(Object.keys(load.stalledArms).length === 0 ? {} : { stalledArms: load.stalledArms }),
  };
  // The summary of a soil-free wash of this load is kept in the cache beside the exposure sets
  // it names, so that a load is washed once per water, not once per preparation.
  const geometry = buildMachineGeometry(spec, config);
  const posed = load.items.map((item) => ({
    itemId: item.itemId,
    typeId: item.typeId,
    shape: item.shape ?? instantiate(item.typeId).shape,
    pose: canonicalPose(item.pose),
    soils: item.soils,
  }));
  const geometryKey = sceneGeometryKey(spec, config, tier.block_m, posed);
  const summaryKey = canonicalHash({
    what: 'calibration reference wash',
    version: 1,
    simulator: SIM_VERSION,
    schema: EXPOSURE_SET_SCHEMA,
    machine: canonicalHash(spec),
    programme: canonicalHash(course.programme),
    geometry: geometryKey,
    hydro: prepared.hydroHash,
    tier: tierId,
    simSeed,
    stalledArms: load.stalledArms,
  });
  interface ReferenceSummary {
    readonly exposureKeys: readonly string[];
    readonly heldWater_mL: number;
    readonly standIn: boolean;
    readonly notes: readonly string[];
  }
  let reference: ReferenceSummary | undefined;
  let cacheHits = 0;
  let computed = 0;
  if (options.refreshExposure !== true) {
    const stored = await cache.get(summaryKey);
    if (stored !== undefined) {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(stored)) as ReferenceSummary;
        if (Array.isArray(parsed.exposureKeys)) {
          reference = parsed;
          cacheHits = parsed.exposureKeys.filter((key) => key !== '').length;
        }
      } catch {
        // A damaged summary is made again.
      }
    }
  }
  if (reference === undefined) {
    say(`exposure of ${record.id}`);
    let washed: Awaited<ReturnType<typeof wash>>;
    try {
      washed = await wash(washInput, { cache, keepScene: false });
    } catch (error) {
      if (error instanceof RangeError) {
        throw new RecordSetupError(`record ${record.id}: ${error.message}`);
      }
      throw error;
    }
    reference = {
      exposureKeys: washed.machine.states.map((state) => state.exposureKey),
      heldWater_mL: washed.machine.heldWater_mL,
      standIn: washed.provenance.exposureStandIn,
      notes: [
        ...washed.problems.map((problem) => `wash: ${problem}`),
        ...washed.machine.timelineProblems.map((problem) => `machine timeline: ${problem}`),
      ],
    };
    cacheHits = washed.run.exposureCacheHits;
    computed = washed.run.exposureComputed;
    await cache.put(summaryKey, new TextEncoder().encode(JSON.stringify(reference)));
  }
  for (const note of reference.notes) notes.push(note);
  const summary: ReferenceSummary = reference;
  lap('exposure');

  // ---- the scene, built as the orchestrator builds it
  say(`scene of ${record.id}`);
  const sceneKey = canonicalHash({ geometry: geometryKey, params: sceneParamsKey(prepared) });
  let scene = options.scenes?.get(sceneKey);
  if (scene === undefined) {
    scene = buildWashScene({
      items: posed.map((item) => ({
        itemId: item.itemId,
        typeId: item.typeId,
        shape: item.shape,
        pose: item.pose,
        soils: [
          {
            type: 'any',
            regions: regionIdsOf(item.shape).map((region) => ({ region, coverage: 1 })),
            amount_g: 0,
            age_h: 0,
            heat_history: 'none',
          } satisfies ItemSoilRecord,
        ],
      })),
      machine: sceneMachineParts(geometry),
      blockSize: tier.block_m,
      materials: sceneMaterialOf,
      params: prepared,
      chamber: sceneChamber(spec),
    });
    options.scenes?.set(sceneKey, scene);
  }
  const builtScene: WashScene = scene;
  lap('scene');

  // ---- the schedule and the exposure sets, by spray state
  const trapped = summary.heldWater_mL * 1e-6;
  const hydraulicsOf = (programme: ProgrammeSpec, p: ParamSet): WashHydraulics =>
    buildWashHydraulics({
      spec,
      programme,
      config,
      params: p,
      ...(Object.keys(load.stalledArms).length === 0 ? {} : { stalledArms: load.stalledArms }),
      // As the orchestrator: the water the upright vessels of the load keep is missing from
      // the first bath only (a starved pump there), not from every bath of the programme.
      ...(trapped > 0 ? { heldWater: trappedWaterByStep(programme, trapped) } : {}),
    });
  // The programme as the record gives it, with the soak of the preparation's parameters. The
  // exposure sets are read by its spray states, which no schedule parameter changes.
  const baseHydraulics = hydraulicsOf(course.programme, prepared);
  const baseScheduleKey = scheduleKeyOf(prepared, true);
  const setsByKey = new Map<string, ExposureSet>();
  for (let i = 0; i < baseHydraulics.states.length; i++) {
    const state = baseHydraulics.states[i];
    const key = summary.exposureKeys[i] ?? '';
    if (state === undefined || key === '') continue;
    const bytes = await cache.get(key);
    if (bytes === undefined) {
      throw new Error(
        `calibration: the exposure of ${state.id} is not in the cache that named it; prepare again with refreshExposure`,
      );
    }
    const set = decodeExposureSet(bytes);
    if (
      set.stateKey !== state.key ||
      set.water.blockCount !== builtScene.blocks.count ||
      set.jets.soilCellCount !== builtScene.soilCells.count ||
      set.poolInflow.length !== builtScene.basins.length
    ) {
      throw new Error(
        `calibration: the exposure of ${state.id} does not fit the scene built here (` +
          `${set.water.blockCount} blocks against ${builtScene.blocks.count}): the orchestrator builds its scene differently now; adapt evaluator.ts`,
      );
    }
    setsByKey.set(state.key, set);
  }
  lap('exposure');

  // ---- observations and what must be replayed for them
  const itemIds = new Set(record.load.items.map((item) => item.id));
  const observations: ObservationSpec[] = record.observations.map((observation, index) => ({
    index,
    id: observationIdOf(observation),
    kind: observation.kind,
    itemId: observation.item,
    target: targetKeyOf(observation),
    at: observation.at_s ?? null,
    value: observation.value,
    sd:
      observation.kind === 'clean' || observation.kind === 'specks'
        ? 0
        : (observationSd(record, observation) ?? 0),
    fitted: observation.fitted !== false,
  }));
  const groups: GroupSpec[] = (record.group_observations ?? []).map((group, index) => ({
    index,
    id: group.id,
    members: group.items.map((member) => ({ itemId: member.item, weight: member.weight ?? 1 })),
    value: group.value,
    sd: group.sd,
  }));
  // The items a group mean is taken over are replayed and inspected whole, like the items of
  // the record's own observations.
  const groupItems = [...new Set(groups.flatMap((g) => g.members.map((m) => m.itemId)))];
  const observedItems = new Set([...observations.map((o) => o.itemId), ...groupItems]);
  const restrict = options.restrict ?? 'observed';
  const replayed = restrict === 'all' ? itemIds : observedItems;
  const times = [
    ...new Set(observations.filter((o) => o.at !== null).map((o) => o.at as number)),
  ].sort((a, b) => a - b);
  const duration = baseHydraulics.schedule.duration;
  for (const t of times) {
    if (t > duration) {
      notes.push(
        `an observation at ${t} s lies after the end of the programme (${duration.toFixed(0)} s); it is read at the end`,
      );
    }
  }

  // ---- patches: their cells, and the amount that gives the weighed loading on the region
  const patchByRecord = new Map<string, { cells: Set<number>; share: number }>();
  const amounts = new Map<string, number>();
  for (const plan of load.patches) {
    const instanceIndex = builtScene.itemInstance.get(plan.itemId);
    const found = patchCells(builtScene, instanceIndex ?? -1, plan);
    const key = `${plan.itemId}#${plan.soilIndex}`;
    if (found.problem !== undefined) {
      notes.push(
        `patch of ${plan.itemId} soil ${plan.soilIndex + 1}: ${found.problem}; it is left out`,
      );
      patchByRecord.set(key, { cells: new Set(), share: 0 });
      continue;
    }
    const share = found.regionArea > 0 ? found.area / found.regionArea : 1;
    patchByRecord.set(key, { cells: found.cells, share });
    const soil = record.load.items.find((i) => i.id === plan.itemId)?.soils[plan.soilIndex];
    if (soil !== undefined) amounts.set(key, soil.amount_g / Math.max(share, 1e-9));
  }
  const soiledItems = (
    ids: ReadonlySet<string>,
    scenario: Scenario,
  ): { itemId: string; soils: ItemSoilRecord[] }[] =>
    posed
      .filter((item) => ids.has(item.itemId))
      .map((item) => {
        const factor = scenario.amountFactors[item.itemId] ?? 1;
        return {
          itemId: item.itemId,
          soils: item.soils.map((soil, k) => {
            const amount = amounts.get(`${item.itemId}#${k}`) ?? soil.amount_g;
            return amount === soil.amount_g && factor === 1
              ? soil
              : { ...soil, amount_g: amount * factor };
          }),
        };
      });

  /**
   * The soil state of the given items at the given parameters in an input scenario (its
   * layout seed and its amounts), patches cut out and thinned.
   */
  const soilStateOf = (ids: ReadonlySet<string>, p: ParamSet, scenario: Scenario): SoilState => {
    const full = initSoil(
      builtScene,
      soiledItems(ids, scenario),
      soilTypeInfo,
      p,
      scenario.levelSeed,
    );
    if (patchByRecord.size === 0 && thin === 1) return full;
    return restrictState(
      full,
      (d, rec) => {
        const patch = patchByRecord.get(`${rec.itemId}#${rec.recordIndex}`);
        const cell = full.cell[d] as number;
        if (patch !== undefined && !patch.cells.has(cell)) return false;
        return thin === 1 || cell % thin === 0;
      },
      (rec) => {
        const patch = patchByRecord.get(`${rec.itemId}#${rec.recordIndex}`);
        // Thinning keeps the loading; a patch keeps the weighed mass.
        return (patch === undefined ? rec.dryMass : rec.dryMass * patch.share) / thin;
      },
    );
  };

  // ---- one replay
  interface Replayed {
    readonly state: SoilState;
    readonly snapshots: Float64Array[];
    readonly pooled: ReadonlyMap<string, number>;
    /**
     * The pools at the end with the soil in their water, what the deposits replayed here gave
     * up per soil class (kg), and how the soil of the liquor is split among the classes
     * (`classShareOf`): from what was replayed here and, in a replay with the background, what
     * the soils that are not replayed gave up when the background was computed.
     */
    readonly pools: Awaited<ReturnType<typeof replayWash>>['pools'];
    readonly released: Float64Array;
    readonly classShare: Float64Array;
    readonly ticks: number;
    /** Cumulative dry mass released into the sump liquor, kg, at the end of every tick. */
    readonly release: { readonly time: Float64Array; readonly mass: Float64Array };
  }
  let background: { time: Float64Array; mass: Float64Array } | undefined;
  /** What the soils of the background gave up per soil class by the end, kg. */
  let backgroundReleased: Float64Array | undefined;
  let backgroundParams: Readonly<Record<string, ParamValue>> | null = null;
  const cumulativeAt = (series: { time: Float64Array; mass: Float64Array }, t: number): number => {
    const { time, mass } = series;
    const n = time.length;
    if (n === 0 || t <= 0) return 0;
    if (t >= (time[n - 1] as number)) return mass[n - 1] as number;
    let lo = -1;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((time[mid] as number) <= t) lo = mid;
      else hi = mid;
    }
    const t0 = lo < 0 ? 0 : (time[lo] as number);
    const m0 = lo < 0 ? 0 : (mass[lo] as number);
    const t1 = time[hi] as number;
    return t1 > t0
      ? m0 + (((mass[hi] as number) - m0) * (t - t0)) / (t1 - t0)
      : (mass[hi] as number);
  };
  let scaled: { key: string; sets: Map<string, ExposureSet> } | undefined;
  let shifted: { key: string; hydraulics: WashHydraulics } | undefined;

  const replay = async (
    ids: ReadonlySet<string>,
    base: ParamSet,
    withBackground: boolean,
    scenario: Scenario = scenarios[0] as Scenario,
  ): Promise<Replayed> => {
    // The parameters of the scenario: its own on top of the candidate's.
    const p = Object.keys(scenario.params).length === 0 ? base : base.with(scenario.params);
    // The schedule: rebuilt only when a programme parameter moves, the calibration's own
    // (what Auto decides for itself) or the wash's (the soak of Eco 50, whose spraying
    // pattern lays the same spray states out over other times).
    const progKey = scheduleKeyOf(p);
    let hydraulics = baseHydraulics;
    if (progKey !== baseScheduleKey) {
      if (shifted?.key !== progKey) {
        shifted = {
          key: progKey,
          hydraulics: hydraulicsOf(shiftedProgramme(course.programme, p), p),
        };
      }
      hydraulics = shifted.hydraulics;
    }
    // The exposure: the cached tables, scaled when a replay-time scale moves.
    const js = p.get('cal.jetShearScale');
    const fs = p.get('cal.filmShearScale');
    const hs = p.get('cal.holdTimeScale');
    let sets = setsByKey;
    if (js !== 1 || fs !== 1 || hs !== 1) {
      const key = `${js}|${fs}|${hs}`;
      if (scaled?.key !== key) {
        const made = new Map<string, ExposureSet>();
        for (const [stateKey, set] of setsByKey)
          made.set(stateKey, scaledExposure(set, js, fs, hs));
        scaled = { key, sets: made };
      }
      sets = scaled.sets;
    }
    const state = soilStateOf(ids, p, scenario);
    const inner = createWashSoil(state, builtScene, p);
    const liquor = createWashLiquor(p, { dispenserBlocked: load.dispenserBlocked });
    const snapshots: Float64Array[] = [];
    const releaseTime: number[] = [];
    const releaseMass: number[] = [];
    let released = 0;
    let next = 0;
    const wrapped: WashSoil = {
      state,
      step(forcing: SoilForcing): Float64Array {
        while (next < times.length && forcing.time >= (times[next] as number)) {
          snapshots.push(Float64Array.from(state.mass));
          next++;
        }
        const removed = inner.step(forcing);
        if (thin !== 1)
          for (let l = 0; l < removed.length; l++) removed[l] = (removed[l] as number) * thin;
        released += removed[0] as number;
        releaseTime.push(forcing.time + forcing.dt);
        releaseMass.push(released);
        if (withBackground && background !== undefined) {
          removed[0] =
            (removed[0] as number) +
            cumulativeAt(background, forcing.time + forcing.dt) -
            cumulativeAt(background, forcing.time);
        }
        return removed;
      },
      totalMass: () => inner.totalMass() * thin,
    };
    const result = await replayWash({
      scene: builtScene,
      hydraulics,
      exposure: (index) => {
        const sprayState = hydraulics.states[index];
        const set = sprayState === undefined ? undefined : sets.get(sprayState.key);
        if (set === undefined) {
          return Promise.reject(
            new Error(
              `calibration: spray state ${sprayState?.id ?? index} has no cached exposure; a programme parameter has changed the pump speed or the water switch, which needs a new preparation`,
            ),
          );
        }
        return Promise.resolve(set);
      },
      liquor,
      soil: wrapped,
      params: p,
    });
    while (snapshots.length < times.length) snapshots.push(Float64Array.from(state.mass));
    snapshots.push(state.mass);
    const pooled = new Map<string, number>();
    for (const pool of result.pools) {
      const id = builtScene.instances[pool.instance]?.id;
      if (id !== undefined) pooled.set(id, (pooled.get(id) ?? 0) + pool.volume * 1e6);
    }
    const gaveUp = releasedByClass(state);
    const rest = withBackground ? backgroundReleased : undefined;
    return {
      state,
      snapshots,
      pooled,
      pools: result.pools,
      released: gaveUp,
      classShare: classShareOf(
        rest === undefined ? gaveUp : gaveUp.map((own, k) => own + (rest[k] as number)),
        state.classes,
      ),
      ticks: result.ticks,
      release: { time: Float64Array.from(releaseTime), mass: Float64Array.from(releaseMass) },
    };
  };

  // ---- the background: what the soils that are not replayed release into the liquor
  const others = new Set([...itemIds].filter((id) => !replayed.has(id)));
  const othersSoiled = posed.some((item) => others.has(item.itemId) && item.soils.length > 0);
  let restriction =
    restrict === 'all' || !othersSoiled
      ? 'every soil of the load is replayed'
      : `the soils of the ${replayed.size} observed items are replayed, those of the other ${others.size} items are not`;
  let depositsOfLoad = 0;
  if (restrict === 'observed' && othersSoiled) {
    if (options.background !== false) {
      say(`background of ${record.id}`);
      const done = await replay(others, prepared, false);
      background = done.release;
      backgroundReleased = done.released;
      backgroundParams = { ...prepared.overrides };
      depositsOfLoad += done.state.count * thin;
      restriction += `; what the others release into the liquor (${((background.mass[background.mass.length - 1] ?? 0) * 1000).toFixed(2)} g by the end) is fed in as the history it has at the parameters of the preparation (refreshBackground moves it)`;
    } else {
      restriction += '; what the others release into the liquor is ignored';
    }
  }
  if (thin > 1)
    restriction += `; one soil cell in ${thin} is kept (masses and areas are scaled up, specks and scores are approximate)`;
  if (load.patches.length > 0)
    restriction += `; ${load.patches.length} soils lie on described patches cut out of their regions`;
  lap('background');

  // ---- targets, laid out per deposit layout
  const regionIdsByItem = new Map(posed.map((item) => [item.itemId, regionIdsOf(item.shape)]));
  const soilIndexById = new Map<string, number>();
  for (const item of record.load.items) {
    item.soils.forEach((soil, k) => soilIndexById.set(`${item.id}#${soilIdOf(soil, k)}`, k));
  }
  // One layout per distinct lay-down of the deposits: that of a restricted replay, that of a
  // full one, and one per layout seed of the input scenarios.
  const layouts = new Map<string, Layout>();
  const LAYOUTS = scenarios.length + 2;
  const layoutOf = (state: SoilState): Layout => {
    const signature = signatureOf(state.cell, state.record);
    const known = layouts.get(signature);
    if (known !== undefined) return known;
    const units = new Map<string, TargetUnit>();
    const wanted = [...observations, ...groupItems.map((itemId) => ({ itemId, target: 'item' }))];
    for (const observation of wanted) {
      const key = `${observation.itemId}|${observation.target}`;
      if (units.has(key)) continue;
      const regionIds = regionIdsByItem.get(observation.itemId) ?? [];
      const instanceIndex = builtScene.itemInstance.get(observation.itemId);
      const instance =
        instanceIndex === undefined ? undefined : builtScene.instances[instanceIndex];
      const deposits: number[] = [];
      for (const rec of state.records) {
        if (rec.itemId !== observation.itemId) continue;
        if (observation.target.startsWith('soil:')) {
          const wanted = soilIndexById.get(`${observation.itemId}#${observation.target.slice(5)}`);
          if (rec.recordIndex !== wanted) continue;
        }
        for (let d = rec.firstDeposit; d < rec.firstDeposit + rec.depositCount; d++) {
          if (observation.target.startsWith('region:')) {
            const b = state.block[d] as number;
            const regionIndex = builtScene.blocks.region[b] as number;
            const id = regionIndex >= 0 ? instance?.shape.regions[regionIndex]?.id : undefined;
            if (id !== observation.target.slice(7)) continue;
          }
          deposits.push(d);
        }
      }
      units.set(
        key,
        buildUnit(key, observation.itemId, builtScene, state, deposits, regionIds, thin),
      );
    }
    const layout: Layout = { signature, units };
    layouts.set(signature, layout);
    if (layouts.size > LAYOUTS) layouts.delete(layouts.keys().next().value as string);
    return layout;
  };

  // ---- a first replay at the parameters of the preparation, for the counts
  say(`first replay of ${record.id}`);
  const first = await replay(replayed, prepared, true);
  lap('firstReplay');
  depositsOfLoad += first.state.count * thin;

  interface Entry {
    states: TargetState[];
    rules: InspectionRules;
    /** The whole-item state at the end of the programme of every item of a group. */
    groupStates: Map<string, TargetState>;
    /** With input scenarios: the states of every observation in every scenario, the nominal first. */
    scenarioStates?: TargetState[][];
  }
  const memory = new Map<string, Entry>();
  const MEMORY = 12;
  const statesOf = (done: Replayed, p: ParamSet): Entry => {
    const rules = inspectionRules(p, soilVisibility(p));
    const logSd = p.get('obs.visibilityLogSd');
    const units = layoutOf(done.state).units;
    /**
     * What the water standing in the item of a unit at the end left on the unit's target: on
     * the whole item, on one region of it, or nothing for a single soil (the residue of the
     * liquor is not that soil).
     */
    const standingOf = (unit: TargetUnit): StandingResidue | undefined => {
      const instance = builtScene.itemInstance.get(unit.itemId);
      if (instance === undefined) return undefined;
      const pools = done.pools.filter((pool) => pool.instance === instance);
      if (pools.length === 0) return undefined;
      const all = standingResidueOf(builtScene, pools, unit.regionIds, done.classShare);
      const target = unit.key.slice(unit.itemId.length + 1);
      if (all === undefined || target === 'item') return all;
      if (!target.startsWith('region:')) return undefined;
      const slot = unit.regionIds.indexOf(target.slice('region:'.length));
      const keep: number[] = [];
      for (let p = 0; p < all.count; p++) if (all.region[p] === slot) keep.push(p);
      if (keep.length === 0) return undefined;
      const classCount = done.classShare.length;
      return {
        count: keep.length,
        region: Uint16Array.from(keep, (p) => all.region[p] as number),
        areaMm2: Float32Array.from(keep, (p) => all.areaMm2[p] as number),
        residue_mg_cm2: Float32Array.from(
          keep.flatMap((p) =>
            Array.from(all.residue_mg_cm2.subarray(classCount * p, classCount * (p + 1))),
          ),
        ),
      };
    };
    const states = observations.map((observation): TargetState => {
      const unit = units.get(`${observation.itemId}|${observation.target}`) as TargetUnit;
      const at = observation.at === null ? times.length : times.indexOf(observation.at);
      const mass = done.snapshots[at] as Float64Array;
      const pooled = observation.at === null ? (done.pooled.get(observation.itemId) ?? 0) : 0;
      // What standing water leaves is of the end of the programme, as its water is.
      const standing = observation.at === null ? standingOf(unit) : undefined;
      return targetState(unit, done.state, mass, rules, logSd, pooled, standing);
    });
    const groupStates = new Map<string, TargetState>();
    for (const itemId of groupItems) {
      const unit = units.get(`${itemId}|item`) as TargetUnit;
      groupStates.set(
        itemId,
        targetState(
          unit,
          done.state,
          done.snapshots[times.length] as Float64Array,
          rules,
          logSd,
          done.pooled.get(itemId) ?? 0,
          standingOf(unit),
        ),
      );
    }
    return { states, rules, groupStates };
  };
  const withScenario = (p: ParamSet, scenario: Scenario): ParamSet =>
    Object.keys(scenario.params).length === 0 ? p : p.with(scenario.params);
  /**
   * The states at `p`: the nominal replay (`done`, or run here) and, for a record with input
   * scenarios, one more replay per further scenario.
   */
  const remember = async (p: ParamSet, done?: Replayed): Promise<Entry> => {
    const nominal = scenarios[0] as Scenario;
    const entry = statesOf(
      done ?? (await replay(replayed, p, true, nominal)),
      withScenario(p, nominal),
    );
    if (scenarios.length > 1) {
      const all: TargetState[][] = [entry.states];
      for (const scenario of scenarios.slice(1)) {
        all.push(
          statesOf(await replay(replayed, p, true, scenario), withScenario(p, scenario)).states,
        );
      }
      entry.scenarioStates = all;
    }
    memory.set(replayKeyOf(p), entry);
    if (memory.size > MEMORY) memory.delete(memory.keys().next().value as string);
    return entry;
  };
  // The first replay answers the first evaluation at the parameters of the preparation.
  await remember(prepared, first);
  lap('firstReplay');

  const predictionOf = (
    entry: Entry,
    p: ParamSet,
    elapsed: number,
    reused: boolean,
  ): RecordPrediction => {
    const constants = resolveObsConstants(p);
    const rule: ScoreRule = {
      areaBandsMm2: entry.rules.areaBandsMm2,
      speckBands: entry.rules.speckBands,
      maxAreaMm2: entry.rules.maxAreaMm2,
      maxSpecks: entry.rules.maxSpecks,
      maxWaterMl: entry.rules.maxWaterMl,
    };
    const eta = new Float64Array(observations.length);
    observations.forEach((observation, i) => {
      eta[i] = predictEta(observation.kind, entry.states[i] as TargetState, rule, constants);
    });
    const groupEta = new Float64Array(groups.length);
    groups.forEach((group, g) => {
      let sum = 0;
      let weight = 0;
      for (const member of group.members) {
        const state = entry.groupStates.get(member.itemId);
        if (state === undefined) continue;
        sum += member.weight * predictEta('score', state, rule, constants);
        weight += member.weight;
      }
      groupEta[g] = weight > 0 ? sum / weight : Number.NaN;
    });
    const perScenario = entry.scenarioStates;
    return {
      recordId: record.id,
      eta,
      groupEta,
      states: entry.states,
      ...(perScenario === undefined
        ? {}
        : {
            scenarios: {
              weights: scenarios.map((scenario) => scenario.weight),
              eta: perScenario.map((states) =>
                Float64Array.from(
                  observations.map((observation, i) =>
                    predictEta(observation.kind, states[i] as TargetState, rule, constants),
                  ),
                ),
              ),
              states: perScenario,
            },
          }),
      rule,
      constants,
      elapsed_ms: elapsed,
      reused,
    };
  };
  const effective = (candidate: ParamSet): ParamSet => {
    const p = paramsFor(candidate);
    if (p.hydroHash !== prepared.hydroHash) {
      throw new HydroMismatchError(
        `record ${record.id} was prepared for another set of water parameters; prepare it again (EvaluatorPool does)`,
      );
    }
    return p;
  };

  const evaluate = async (candidate: ParamSet): Promise<RecordPrediction> => {
    const p = effective(candidate);
    const start = performance.now();
    let entry = memory.get(replayKeyOf(p));
    const reused = entry !== undefined;
    if (entry === undefined) entry = await remember(p);
    return predictionOf(entry, p, reused ? 0 : performance.now() - start, reused);
  };

  const restricted = restrict === 'observed' && othersSoiled;
  const evaluateFull = async (candidate: ParamSet): Promise<RecordPrediction> => {
    if (!restricted) return evaluate(candidate);
    const p = effective(candidate);
    const start = performance.now();
    // Every soil, each acting on the liquor itself, in the nominal scenario.
    const nominal = scenarios[0] as Scenario;
    const entry = statesOf(await replay(itemIds, p, false, nominal), withScenario(p, nominal));
    return predictionOf(entry, p, performance.now() - start, false);
  };

  const refreshBackground = async (candidate: ParamSet): Promise<boolean> => {
    if (!restricted || options.background === false) return false;
    const p = effective(candidate);
    const done = await replay(others, p, false);
    background = done.release;
    backgroundReleased = done.released;
    backgroundParams = { ...p.overrides };
    memory.clear();
    return true;
  };

  const washInputAt = (candidate: ParamSet): ReturnType<PreparedRecord['washInputAt']> => {
    const p = effective(candidate);
    const programme = shiftedProgramme(course.programme, p);
    const why: string[] = [];
    if (load.patches.length > 0) {
      why.push(
        `${load.patches.length} soils lie on described patches, which wash() lays over their whole regions`,
      );
    }
    for (const key of ['cal.jetShearScale', 'cal.filmShearScale', 'cal.holdTimeScale']) {
      if (p.get(key) !== 1) why.push(`${key} = ${p.get(key)} is applied by the calibration only`);
    }
    return {
      input: { ...washInput, programme, items: load.items, params: washOverridesOf(p) },
      programme,
      exact: why.length === 0,
      notes: why,
    };
  };

  return {
    record,
    hydroHash: prepared.hydroHash,
    observations,
    groups,
    programme: course.programme,
    info: {
      tier: tierId,
      blocks: builtScene.blocks.count,
      soilCells: builtScene.soilCells.count,
      deposits: first.state.count,
      depositsOfLoad,
      itemsReplayed: replayed.size,
      items: itemIds.size,
      ticks: first.ticks,
      sprayStates: setsByKey.size,
      scenarios: scenarios.length,
      exposureStandIn: summary.standIn,
      exposureCacheHits: cacheHits,
      exposureComputed: computed,
      timings_ms: timings,
      restriction,
      notes,
    },
    evaluate,
    paramsFor,
    evaluateFull,
    refreshBackground,
    backgroundAt: () => backgroundParams,
    washInputAt,
  };
}

/** Hashes of what a preparation depends on, by record object. */
const preparationKeys = new WeakMap<WashRecord, string>();

/**
 * The key of what a preparation of a record depends on: the whole record but its id, kind,
 * title, weight, provenance, and the values and uncertainties of its observations (which a
 * likelihood takes from the record it is given, not from the preparation). Two records that
 * differ only in what was observed share a preparation; two that share an id and differ in
 * anything else do not.
 */
export function preparationKeyOf(record: WashRecord): string {
  let key = preparationKeys.get(record);
  if (key === undefined) {
    key = canonicalHash({
      machine: record.machine,
      programme: record.programme,
      consumables: record.consumables ?? null,
      load: record.load,
      interruptions: record.interruptions ?? null,
      sim: record.sim ?? null,
      observations: record.observations.map((o) => ({
        item: o.item,
        target: o.target ?? null,
        at_s: o.at_s ?? null,
        kind: o.kind,
      })),
    });
    preparationKeys.set(record, key);
  }
  return key;
}

/**
 * Prepared records by what a preparation depends on ({@link preparationKeyOf}) and hydro hash,
 * so that the outer loop over water parameters prepares each combination once. Scenes are
 * shared between preparations whose geometry and scene parameters agree. The pool holds at
 * most `capacity` preparations per record and drops the least recently used.
 *
 * A restricted replay keeps the background at the parameters it was last computed at (those
 * of the first request, until `refreshBackground`): predictions of a shared pool therefore
 * depend, within the error of that approximation, on what it was asked first.
 */
export class EvaluatorPool {
  private readonly prepared = new Map<string, Promise<PreparedRecord>>();
  private readonly scenes = new Map<string, WashScene>();
  private readonly options: EvaluatorOptions;
  private readonly capacity: number;

  constructor(options: EvaluatorOptions = {}, capacity = 2) {
    this.options = { ...options, cache: options.cache ?? createMemoryExposureCache() };
    this.capacity = Math.max(1, capacity);
  }

  /** The preparation of `record` for the hydro group of `params`. */
  get(record: WashRecord, params: ParamSet): Promise<PreparedRecord> {
    // The record's own overrides may touch the hydro group: hash what it will be prepared with.
    const own = record.sim?.params ?? {};
    const hydro = Object.keys(own).some((key) => !isCalibrationKey(key))
      ? params.with(own).hydroHash
      : params.hydroHash;
    const mark = preparationKeyOf(record);
    const key = `${mark}|${hydro}`;
    const known = this.prepared.get(key);
    if (known !== undefined) {
      this.prepared.delete(key);
      this.prepared.set(key, known);
      return known;
    }
    const made = prepareRecord(record, params, { ...this.options, scenes: this.scenes });
    this.prepared.set(key, made);
    const mine = [...this.prepared.keys()].filter((k) => k.startsWith(`${mark}|`));
    while (mine.length > this.capacity) this.prepared.delete(mine.shift() as string);
    if (this.scenes.size > 2 * this.capacity + 2) {
      this.scenes.delete(this.scenes.keys().next().value as string);
    }
    return made;
  }

  /** Predictions of `record` at `params`, preparing it for their hydro group when needed. */
  async evaluate(record: WashRecord, params: ParamSet): Promise<RecordPrediction> {
    return (await this.get(record, params)).evaluate(params);
  }

  /** Drops every preparation and scene. */
  clear(): void {
    this.prepared.clear();
    this.scenes.clear();
  }
}
