/**
 * Contract of module M7, film (docs/design/sim-core.md section 4, "M7. Film"): water on
 * surfaces between the fan limit and the moment it leaves as a droplet or reaches the sump.
 * Wetting, drainage, rivulets and beads, edges, gutters and drips, pools, gaps and bridges; the
 * wetting parameters of every exposure; and the statistics that become the exposure records.
 * Four solvers behind one contract: R0 (steady routing), K (kinematic cascade), S (inertial
 * shallow film) and LINE.
 *
 * Types only. The binary records behind the buffers are described in `layouts.ts`. The layouts
 * of `SFilm`, `KHot`, the deposit accumulators and the pilot's wet bitset belong to this module
 * by the contract and are declared in `@spotless/sim-spray` (`film-interface.ts`), because the
 * spray kernels bind those buffers and M6 may not depend on M7; `HRes` likewise in
 * `@spotless/sim-jets`; `WettingSummary` in `@spotless/sim-scene`. All are re-exported from this
 * package's entry point.
 *
 * Units: SI. Per-item arrays use the item index of `@spotless/sim-scene`, per-basin arrays the
 * basin id.
 */

import type { EmitterTable, HydraulicPoint, LiquorProps } from '@spotless/sim-jets';
import type { Scene, WettingSummary } from '@spotless/sim-scene';
import type { DepositionTable, SprayStage } from '@spotless/sim-spray';

// ---------------------------------------------------------------------------------------------
// Constants of the film stage
// ---------------------------------------------------------------------------------------------

/**
 * Film-shear levels of the duty curve, pascals (sections M7.8 and 5.2): `nTau[k]` of
 * `FilmStats` counts the samples above level k; the first four become `tauDuty[4]` of
 * `FilmExposure` and the last, the protein threshold tau*, `tauDuty10`.
 */
export const FILM_TAU_LEVELS_PA = [0.5, 1, 2, 4, 10] as const;

/** Times after the sources stop at which `DrainDown` records the film thickness, seconds. */
export const DRAIN_DOWN_TIMES_S = [2, 10, 60] as const;

/**
 * Registered bound of the sample counters of `FilmStats` (section M7.8): 6 recorded revolutions
 * of 1,216 base steps, sampled every second step.
 */
export const FILM_STATS_COUNTER_BOUND = 3648;

// ---------------------------------------------------------------------------------------------
// Plans, parameters and state
// ---------------------------------------------------------------------------------------------

/** What a periodic solve runs (section M7.7). */
export interface SolvePlan {
  /**
   * The revolutions of the master arm, in order: `settle` revolutions are discarded,
   * `transient` and `steady` ones are recorded into the record of that label.
   */
  readonly revolutions: readonly {
    /** What the revolutions are for. */
    readonly label: 'settle' | 'transient' | 'steady';
    /** Number of master revolutions. */
    readonly count: number;
  }[];
  /** The grid solved: one film cell per block, or the grid of main-wash-class solves. */
  readonly grid: 'block' | 'classD';
  /** Highest time-step level of the S solver (5 official and fast, 8 reference). */
  readonly maxLevel: number;
}

/**
 * The wetting parameters of one exposure (sections M7.3 and M7.8): built by `wetParams` from
 * the material table, the frozen contact-angle offset field and the soil model's wetting
 * summary, for one liquor class and grid.
 */
export interface WetParams {
  /** `KParams[]`: 32 bytes per block. */
  readonly kParams: GPUBuffer;
  /** `SStatic[]`: 8 bytes per S film cell. */
  readonly sStatic: GPUBuffer;
  /** The liquor the parameters were built for. */
  readonly liquor: LiquorProps;
  /** Hash of the quantised inputs, so that the cache key covers what the solver uses. */
  readonly hash: string;
}

/**
 * The complete state of the film stage on one grid: what the pilot, K, S and the drain-down
 * hand to each other (section M7).
 */
export interface FilmState {
  /** The grid of the state. */
  readonly grid: 'block' | 'classD';
  /** The liquor of the solve. */
  readonly liquor: LiquorProps;
  /** `KHot[]` per block: every block; S-class blocks hold the restriction of their S cells. */
  readonly kHot: GPUBuffer;
  /** `SFilm[]` per S film cell of the grid. */
  readonly sFilm: GPUBuffer;
  /** `SSlow[]` per S film cell of the grid. */
  readonly sSlow: GPUBuffer;
  /** LINE elements and drip-site stores (the contract gives them no layout). */
  readonly lines: GPUBuffer;
  /** Basin, gap and bridge stores (the contract gives them no layout). */
  readonly reservoirs: GPUBuffer;
  /** `Parcel[]`: the live time-coupled parcels; empty in a pilot state. */
  readonly parcels: GPUBuffer;
  /** Number of live parcels. */
  readonly parcelsLive: number;
  /** The `next` deposit accumulators: deposits already written for the next base step. */
  readonly accNext: GPUBuffer;
  /** Base step counter of the state (integer; determinism rule 2). */
  readonly baseStep: number;
  /** The u32 phase of every active arm at `baseStep`, in the order of `HydraulicPoint.arms`. */
  readonly armPhases: Uint32Array;
}

/**
 * What a film solve reports besides its records (section M7): inventories for M4, basin and
 * drip rates for the timeline, the convergence monitors of section M7.7 and the quality flags.
 */
export interface StateSummary {
  /** Time-mean volume of water in flight, m3. */
  readonly vAir_m3: number;
  /** Time-mean volume of water in films, beads, gutters and on wires, m3. */
  readonly vFilm_m3: number;
  /** Time-mean mass flow returned to the sump, kg/s. */
  readonly returnToSump_kg_s: number;
  /** Time-mean inflow of each basin, kg/s, by basin id (the solve takes lumped basins as full). */
  readonly basinInflow_kg_s: Float32Array;
  /**
   * Per basin: share of its inflow that arrived as jet hand-over or as a parcel faster than
   * 2 m/s, 0 to 1; the timeline chooses the mixing efficiency from it.
   */
  readonly basinInflowJetShare: Float32Array;
  /** Time-mean release of each drip site, kg/s, in the order of `LineGraph.dripSites`. */
  readonly dripRate_kg_s: Float32Array;
  /** eps_Gamma: relative L2 change of the mean loading between the two recorded revolutions. */
  readonly epsGamma: number;
  /** eps_wet: area fraction of item cells whose wet duty changed by more than 0.1, overall. */
  readonly epsWet: number;
  /** eps_mass: relative closure error of the water mass balance per revolution. */
  readonly epsMass: number;
  /** eps_wet per item, by item index. */
  readonly perItemEpsWet: Float32Array;
  /** True when every monitor met its target (5 %, 2 %, 0.1 %). */
  readonly converged: boolean;
  /** Extension revolutions this solve drew from the run's allowance of 4. */
  readonly extensionRevolutions: number;
  /** Number of time-step level raises that the tile monitors caused. */
  readonly cflRaises: number;
  /** Reserved for tile-level activity lists (section 11.1); 0 until they exist. */
  readonly frontHeldShare: number;
  /**
   * Per item: mass fraction of Monte Carlo deposits whose assumed wall state was wrong, 0 to 1.
   */
  readonly wetAssumptionMismatch: Float32Array;
  /** Per item: share of its hand-over momentum that the speed cap clipped, 0 to 1. */
  readonly handoverClipped: Float32Array;
}

/** Result of the pilot, stage E (section M7.2). */
export interface PilotResult {
  /** `SteadyWet` words: 1 bit per block, film-wet in the time mean. */
  readonly steadyWet: GPUBuffer;
  /** `HRes[]`: f16 per block, the residual film thickness in um. */
  readonly hRes: GPUBuffer;
  /** The initial state of the steady solve of the same combo. */
  readonly init: FilmState;
  /** Summary of the pilot state. */
  readonly summary: StateSummary;
}

/** Result of a periodic solve (section M7.7). */
export interface PeriodicResult {
  /** `FilmExposure[]` per film cell of the grid, for each label the plan recorded. */
  readonly records: Readonly<Partial<Record<'transient' | 'steady', GPUBuffer>>>;
  /** The onset-time field: f32 seconds per block (section M10, "Wetting-onset gate"). */
  readonly onset: GPUBuffer;
  /** The state at the end of the solve. */
  readonly final: FilmState;
  /** Summary over the recorded revolutions. */
  readonly summary: StateSummary;
}

/** Result of a drain-down (section M7.7). */
export interface DrainDownResult {
  /** `DrainDown[]` per block. */
  readonly record: GPUBuffer;
  /** The state at the end of the drain-down. */
  readonly final: FilmState;
}

// ---------------------------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------------------------

/** The film stage (section M7): stages E and G of the pipeline. */
export interface FilmStage {
  /**
   * Builds the wetting parameters of an exposure. The inputs are already quantised (soil cover
   * to sixteenths), so the hash covers what the solver uses.
   */
  wetParams(
    scene: Scene,
    liquor: LiquorProps,
    soil: WettingSummary,
    grid: 'block' | 'classD',
  ): Promise<WetParams>;
  /**
   * Stage E: steady routing R0 on the grid of the run from the emitter means of M5
   * (`EmitterMean[]`) and the pilot deposition tables, one per arm.
   */
  pilot(a: {
    /** The scene of the current epoch. */
    readonly scene: Scene;
    /** The wetting parameters of the liquor class. */
    readonly wet: WetParams;
    /** `EmitterMean[]` of `JetStage.emitterMeans`: fan limits at h_res = 0. */
    readonly emitterMeans: GPUBuffer;
    /** The pilot deposition tables (1e7 parcels), one per active arm. */
    readonly dep: readonly DepositionTable[];
  }): Promise<PilotResult>;
  /** Stage G: a periodic solve through the forcing of one hydraulic point. */
  periodic(a: {
    /** The scene of the current epoch. */
    readonly scene: Scene;
    /** The hydraulic point whose forcing is marched: arm phases and the time base. */
    readonly hp: HydraulicPoint;
    /** The wetting parameters of the liquor class on the grid of the plan. */
    readonly wet: WetParams;
    /** The ring emitters of the point, rasterised on the grid of the plan. */
    readonly emitters: EmitterTable;
    /** The Monte Carlo deposition tables, one per active arm. */
    readonly dep: readonly DepositionTable[];
    /** The time-coupled parcels, advanced inside every base step. */
    readonly spray: SprayStage['live'];
    /**
     * The state to start from: the pilot state of the same combo for a steady solve, the
     * periodic state of the other diverter state for a transient solve (section M7.7).
     */
    readonly init: FilmState;
    /** The revolutions to run and record. */
    readonly plan: SolvePlan;
  }): Promise<PeriodicResult>;
  /** Stage G: K for `seconds` seconds (60) from a periodic state with all sources off. */
  drainDown(a: {
    /** The scene of the current epoch. */
    readonly scene: Scene;
    /** The wetting parameters of the liquor class on the block grid. */
    readonly wet: WetParams;
    /** The final state of the periodic solve; restricted to blocks before the cascade runs. */
    readonly init: FilmState;
    /** The time-coupled parcels: discrete last drops are traced onto whatever is below. */
    readonly spray: SprayStage['live'];
    /** Simulated length of the drain-down, seconds (60). */
    readonly seconds: number;
  }): Promise<DrainDownResult>;
  /** Restricts a class-D state to the block grid by index shifts; mass is conserved. */
  restrict(s: FilmState, to: 'block'): Promise<FilmState>;
  /** Prolongs a block-grid state to the class-D grid by index shifts; mass is conserved. */
  prolong(s: FilmState, to: 'classD'): Promise<FilmState>;
}
