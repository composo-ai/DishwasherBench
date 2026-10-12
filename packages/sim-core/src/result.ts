/**
 * The result of a wash in the first build (docs/design/scope.md; docs/design/sim-core.md
 * section 5.6, reduced to what the first build computes; docs/research/standards.md section
 * 10): per item and per region the soil before and after, the area still visibly soiled, the
 * separate specks, the water it keeps, and clean or not; with the machine's side of the wash
 * and, on request, per-cell arrays for drawing a residue map.
 *
 * Everything here is a deterministic function of the input except `run`, which says how this
 * particular run went (timings, cache hits) and is left out of the result hash.
 *
 * Units as the standards dossier reports them: mg and mg/cm2 of dry soil, mm2, mL and g of
 * water; SI elsewhere, with unit-suffixed names where a value is not SI.
 */

import type { RegionInspection } from '@spotless/inspector';
import type { ExposureSetStats } from '@spotless/sim-film';
import type { CarryOver } from '@spotless/sim-timeline';
import type { ItemExposure } from './exposure-summary.ts';
import type { ParamSetRecord } from './param-layers.ts';

/** A pool of water an item holds at the end of the wash. */
export interface ItemPool {
  readonly volume_mL: number;
  readonly capacity_mL: number;
  /**
   * Detergent in it, g/L, and the soil in its water, mg: what dissolved under it and is still
   * in it, and what the liquor that entered it brought and left.
   */
  readonly detergent_g_L: number;
  readonly dissolvedSoil_mg: number;
  readonly carriedSoil_mg: number;
}

/** One soil record of an item, before and after. */
export interface ItemSoilResult {
  /** Catalogue soil id as given, and the model class that stood for it. */
  readonly type: string;
  readonly modelClass: string;
  /** Bake index from its heat history, 0 to 1. */
  readonly bake: number;
  /** Area it covered, mm2, and dry mass at the start and at the end, mg. */
  readonly coveredAreaMm2: number;
  readonly initialMass_mg: number;
  readonly residualMass_mg: number;
}

/** Per-cell arrays of one item, for drawing a residue map. One entry per soil element. */
export interface ItemCells {
  /** Number of soil elements N: the soil cells that carried soil at the start. */
  readonly count: number;
  /** [N] index into `regionIds`, or 0xFFFF. */
  readonly region: Uint16Array;
  /** [N x 3] centre and outward normal in the item frame, metres. */
  readonly centre: Float32Array;
  readonly normal: Float32Array;
  /** [N] area, mm2. */
  readonly areaMm2: Float32Array;
  /** [N x C] dry soil per area at the start and at the end, mg/cm2, per soil class. */
  readonly initial_mg_cm2: Float32Array;
  readonly residual_mg_cm2: Float32Array;
  /** [N] 1 where the element is visibly soiled at the end. */
  readonly visible: Uint8Array;
}

/** The result for one item. */
export interface ItemWashResult {
  readonly itemId: string;
  readonly typeId: string;
  /** At most the allowed specks and visibly soiled area, and at most the allowed pooled water. */
  readonly clean: boolean;
  /** IEC cleaning score, 0 to 5. */
  readonly score: number;
  /** Dry soil at the start and at the end, mg. */
  readonly initialMass_mg: number;
  readonly residualMass_mg: number;
  /** Area visibly soiled at the start and at the end, mm2. */
  readonly initialVisibleAreaMm2: number;
  readonly visibleAreaMm2: number;
  /** Separate visibly soiled regions small enough to count as specks. */
  readonly specks: number;
  /**
   * The verdict at the two ends of the band in which residues become visible (standards 10.3
   * gives a range per appearance; `inspectBand`): `strict` at the low end, `lenient` at the
   * high end, each with its IEC score. `decided` is true when both ends give the same clean
   * verdict: what the item reads does then not depend on the eye of the inspector. An item
   * that is not decided is at the edge of clean; `clean` above is the reading at the
   * registered thresholds. Always present in a result of `wash`.
   */
  readonly band?: {
    readonly strictClean: boolean;
    readonly strictScore: number;
    readonly lenientClean: boolean;
    readonly lenientScore: number;
    readonly decided: boolean;
  };
  /** The water the item keeps: standing in its cavities (mL) and as film on its surface (g). */
  readonly water: {
    /** All standing water: the pools of its basins and its puddles, mL. */
    readonly pooled_mL: number;
    /**
     * Of `pooled_mL`: water standing deeper than `inspect.puddleDepthMm` on upward faces
     * outside any basin (a level board, a hollow no basin was found for), mL.
     */
    readonly puddle_mL: number;
    readonly film_g: number;
    readonly pools: readonly ItemPool[];
    /**
     * What the water standing in the pools left where it stood: dry residue, mg, and the area
     * on which it is visible, mm2 (part of `visibleAreaMm2` of the item). Absent when the
     * standing water holds no soil.
     */
    readonly standingResidue_mg?: number;
    readonly standingVisibleAreaMm2?: number;
  };
  /**
   * Peak upward force of the jets on the item over its weight, the largest of all spray
   * states; absent where no jet strikes it. Above `inspect.liftWarnRatio` the wash reports
   * the item in `problems` as likely to be moved (the load is simulated static all the same).
   */
  readonly jetLiftRatio?: number;
  /** `SurfaceRegion` ids of the item's shape (distinct, in shape order). */
  readonly regionIds: readonly string[];
  /** Per region that carried soil. */
  readonly regions: readonly RegionInspection[];
  /**
   * What the water did to every region of the item, per spray state and over the programme:
   * share of the time under a direct jet, wet time, liquor exchange, pooled and never-wetted
   * area, retained water (`exposure-summary.ts`). A diagnostic for reports, the phenomena
   * suite and calibration; the game's report to a player does not carry it.
   */
  readonly exposure: ItemExposure;
  /** Per soil record of the item, in the order given. */
  readonly soils: readonly ItemSoilResult[];
  /** Present when the wash was asked for per-cell arrays. */
  readonly cells?: ItemCells;
}

/** One spray state of the wash. */
export interface SprayStateResult {
  readonly id: string;
  /** Total time active, seconds, and the tick of the replay while it is, seconds. */
  readonly duration_s: number;
  readonly period_s: number;
  /** Circulated flow, L/min. */
  readonly flow_L_min: number;
  /** The arms it feeds, with their speed in rev/min. */
  readonly arms: readonly {
    readonly level: string;
    readonly rpm: number;
    readonly stalled: boolean;
  }[];
  /** Cache key of its exposure set, and what the exposure stage reported. */
  readonly exposureKey: string;
  readonly exposure: ExposureSetStats;
}

/** The machine's side of the wash. */
export interface MachineWashResult {
  readonly machineId: string;
  readonly programmeId: string;
  readonly duration_s: number;
  /** Ticks of the replay. */
  readonly ticks: number;
  readonly states: readonly SprayStateResult[];
  /** Mains water drawn, litres, and electrical energy, kWh (the machine's own model). */
  readonly water_L: number;
  readonly energy_kWh: number;
  /** Water the load kept out of the sump in pools, mL (given to the machine's timeline). */
  readonly heldWater_mL: number;
  readonly dispenser: 'free' | 'blocked';
  /** Detergent released by the dispenser and dissolved by the end, grams. */
  readonly detergent: { readonly dosed_g: number; readonly dissolved_g: number };
  /** The water changes of the programme. */
  readonly carryOver: readonly CarryOver[];
  /**
   * The liquor through the wash: `fields` names the columns, `values` holds one row per tick
   * (`ticks` x `fields.length`), `tickTime_s` the start of every tick.
   */
  readonly liquor: {
    readonly fields: readonly string[];
    readonly tickTime_s: Float64Array;
    readonly values: Float64Array;
  };
  /** Dry soil, mg: on the load at the start and at the end, gone into the liquor, and into pools. */
  readonly soil: {
    readonly initial_mg: number;
    readonly remaining_mg: number;
    readonly toLiquor_mg: number;
    readonly toPools_mg: number;
  };
  /** What did not add up in the machine's own timeline (for example `pump_starved`). */
  readonly timelineProblems: readonly string[];
}

/** Where a result comes from. */
export interface WashProvenance {
  /** Version of the simulator that computed it. */
  readonly simVersion: string;
  readonly tier: string;
  /** Hashes of the two parameter groups, and of the input. */
  readonly hydroHash: string;
  readonly soilHash: string;
  readonly inputHash: string;
  readonly levelSeed: number;
  readonly simSeed: number;
  /** Schema of the exposure sets, and whether a stand-in stage computed them. */
  readonly exposureSchema: number;
  readonly exposureStandIn: boolean;
  /**
   * The tracer the exposure was computed on: `gpu`, `cpu`, or `mixed` when cached sets of
   * both were used. The result hash is reproducible per back end, not across them: the two
   * tracers differ on rare grazing rays.
   */
  readonly exposureBackend: 'gpu' | 'cpu' | 'mixed' | 'unknown';
  /**
   * The named parameter sets the parameters of the wash were composed from, in the order
   * they were laid over the registry defaults (`WashInput.paramSets`); empty when the
   * overrides were given directly. The two hashes above cover the values that resulted.
   */
  readonly paramSets: readonly ParamSetRecord[];
  /** The detergent dosed: its name (`machine default` when none was given) and mass, grams. */
  readonly detergent: { readonly name: string; readonly dose_g: number };
  /**
   * Fingerprint of the sources the exposure was computed by, as the exposure cache names it
   * (empty for a cache that names none, or no cache), and of the sources of the whole
   * simulation as the caller gave it (`WashOptions.sourceFingerprint`; empty when not given).
   * Neither is part of the result hash: they say which code ran, not what it computed.
   */
  readonly exposureSource: string;
  readonly sourceFingerprint: string;
  /**
   * `sha256:` hash of everything in the result except `run`, the fingerprints of the source
   * and this field.
   */
  readonly resultHash: string;
}

/** How one run of a wash went: not part of the result hash. */
export interface WashRunInfo {
  /** Wall-clock time per stage, milliseconds. */
  readonly timings_ms: Readonly<Record<string, number>>;
  /** True when the scene was that of the wash before in this process, not built again. */
  readonly sceneReused: boolean;
  /** Exposure sets taken from the cache and computed. */
  readonly exposureCacheHits: number;
  readonly exposureComputed: number;
  /** Counts of the scene. */
  readonly blocks: number;
  readonly soilCells: number;
  readonly deposits: number;
}

/** The result of one wash. */
export interface WashResult {
  readonly provenance: WashProvenance;
  /** The model soil classes: the columns of the per-cell arrays. */
  readonly soilClasses: readonly string[];
  /** Per item, sorted by item id. */
  readonly items: readonly ItemWashResult[];
  readonly machine: MachineWashResult;
  /** What could not be simulated as asked (a soil on a region the item lacks, ...), in words. */
  readonly problems: readonly string[];
  readonly run: WashRunInfo;
}
