/**
 * Contract of module M10, the timeline (docs/design/sim-core.md section 4, "M10. Timeline", and
 * sections 5.1 and 5.5): the replay loop over the whole programme and every state with memory
 * longer than one revolution. Effective exposure per tick, block energy balance, wetting-onset
 * gate, film composition, local stores, pools and gaps, tablet supply, redeposition,
 * carry-over and drying. Soil settling from the wash water onto clean items (redeposition) and
 * the movement of items and of the tablet are out of scope (docs/design/scope.md): their
 * fields are declared and never filled.
 *
 * Types only. The layouts of `TimelineBlock`, `EffectiveExposure` and `ReservoirLiquor` belong
 * to this module by the contract and are declared in `@spotless/sim-soil`
 * (`timeline-interface.ts`), because the soil kernel binds those buffers and M8 may not depend
 * on M10; they are re-exported from this package's entry point. The exposure set of section 5.1,
 * which the contract assigns to no module, is declared here as `ContractExposureSet`: the
 * timeline is the lowest module that needs it, and the name `ExposureSet` belongs to the
 * exposure set of the first build (`@spotless/sim-film`).
 *
 * Units: SI, with carry-over in litres as the contract writes it (`carryOver_L`). Per-item
 * arrays use the item index of `@spotless/sim-scene`.
 */

import type { ItemLoads, JetRecordSet, Scene, StateSummary } from '@spotless/sim-film';
import type { ComboId, LiquorProps, MachineModel, ProgrammeSpec } from '@spotless/sim-hydraulics';
import type { LiquorModel, LiquorState } from '@spotless/sim-liquor';
import type { SoilRelease, SoilStage } from '@spotless/sim-soil';
import type { RigidCouplerPort } from './rigid-boundary.ts';

// ---------------------------------------------------------------------------------------------
// Constants of the replay (sections 0, 5.5 and M12)
// ---------------------------------------------------------------------------------------------

/** Length of a tick with the pump off, seconds (section 0, "tick"). */
export const TICK_PUMP_OFF_S = 2;

/** Length of a tick in drying, seconds (section 0, "tick"; section M10, "Drying"). */
export const TICK_DRYING_S = 10;

/**
 * Every this-many ticks the replay runs the drift monitors, the rigid-body triggers and the
 * checkpoint test (section 5.5).
 */
export const MONITOR_TICKS = 64;

/** A checkpoint is written every this-many ticks, and at stage boundaries (sections 2.1, M12). */
export const CHECKPOINT_TICKS = 512;

// ---------------------------------------------------------------------------------------------
// Exposure set (section 5.1)
// ---------------------------------------------------------------------------------------------

/**
 * Everything the periodic solves produce for one combo, cached by `key` (section 5.1). The
 * timeline replays it every tick the combo is active; nothing in it depends on the momentary
 * pool levels or liquor temperature.
 */
export interface ContractExposureSet {
  /** Cache key: SHA-256 of the canonical JSON of every value passed to stages C to G (M12). */
  readonly key: string;
  /** The combo. */
  readonly combo: ComboId;
  /** Geometry epoch the set was computed in. */
  readonly epoch: number;
  /** The liquor properties of the solve: those of the class at its solve temperature. */
  readonly liquor: LiquorProps;
  /** The film grid of the class: `classD` for the main-wash class, `block` otherwise. */
  readonly grid: 'block' | 'classD';
  /** `JetExposure` at the three viscosity points (20, 45 and 65 C), each with its tile table. */
  readonly jet: readonly JetRecordSet[];
  /** `FilmExposure[]` per film cell; there is no transient record outside the main-wash class. */
  readonly film: { readonly steady: GPUBuffer; readonly transient?: GPUBuffer };
  /** `DrainDown[]` per block. */
  readonly drain: GPUBuffer;
  /** The onset-time field: f32 seconds per block. */
  readonly onset: GPUBuffer;
  /** Per active arm: `JetWet[]`, 64 bits per block. */
  readonly jetWet: readonly GPUBuffer[];
  /** Summary of the steady solve. */
  readonly summary: StateSummary;
  /** Jet loads on items for this combo. */
  readonly loads: ItemLoads;
  /** True when the set was computed under a reduced reserve setting (section 7.3). */
  readonly approximate: boolean;
}

// ---------------------------------------------------------------------------------------------
// The timeline
// ---------------------------------------------------------------------------------------------

/** What the timeline runs against (section M10). The orchestrator builds it. */
export interface TimelineContext {
  /** The lumped machine model: controller, hydraulic points, inventory. */
  readonly machine: MachineModel;
  /** The programme to replay. */
  readonly programme: ProgrammeSpec;
  /** The liquor model. */
  readonly liquor: LiquorModel;
  /** The soil stage, already initialised. */
  readonly soil: SoilStage;
  /**
   * The rigid coupler, through the port of `rigid-boundary.ts` (the contract types this member
   * as `RigidCoupler` of M11, which M10 may not depend on).
   */
  readonly rigid: RigidCouplerPort;
  /** The scene of the current geometry epoch. */
  readonly scene: () => Scene;
  /**
   * The exposure set of a combo: runs stages C to G or returns a cached set, and evicts and
   * readmits the replay state meanwhile (M1).
   */
  readonly exposure: (combo: ComboId) => Promise<ContractExposureSet>;
  /** Progress of the replay, 0 to 1. */
  readonly onProgress: (fraction: number) => void;
}

/** A lumped basin with its liquor at the end of the programme, or at a tick (section M10). */
export interface PoolState {
  /** Basin id. */
  readonly basin: number;
  /** Volume of liquid in the basin, m3. */
  readonly volume_m3: number;
  /** Level above the basin's lowest point, metres. */
  readonly level_m: number;
  /** The pool's own liquor. */
  readonly liquor: LiquorState;
  /** Settled solids, kg, by speck size class: fines, grit. */
  readonly settled_kg: readonly number[];
  /** Soil dissolved under the pool, kg, by release class (`RELEASE_CLASSES`). */
  readonly dissolvedSoil_kg: readonly number[];
}

/** A gap reservoir with its liquor (section M10). */
export interface GapState {
  /** Gap reservoir id. */
  readonly gap: number;
  /** True once the reservoir has filled; it does not drain. */
  readonly filled: boolean;
  /** The gap's own liquor. */
  readonly liquor: LiquorState;
  /** Soil dissolved in the gap, kg, by release class (`RELEASE_CLASSES`). */
  readonly dissolvedSoil_kg: readonly number[];
}

/** Quality flags of the replay (section M10). */
export interface TimelineFlags {
  /**
   * `[item][2]` row-major: the area-time share of S cells whose receding angle has moved by
   * more than `tl.wettingDriftAngle` since their solve, and the share of ticks in which the
   * liquor viscosity differs from the solve viscosity by more than `tl.wettingDriftNu`.
   */
  readonly wettingDrift: Float32Array;
  /** Ticks flagged for loss of prime (f_H below 0.85; section M4). */
  readonly primeLossTicks: number;
  /**
   * Ticks replayed against a set of another liquor class or beyond the class half-width (for
   * example the first minutes of a heat-up, while the liquor is still cold).
   */
  readonly classApproximationTicks: number;
}

/** What the replay hands to the orchestrator (section M10). */
export interface TimelineResult {
  /** `TimelineBlock[]` per block at the end of the programme. */
  readonly blocks: GPUBuffer;
  /** The lumped basins at the end. */
  readonly pools: readonly PoolState[];
  /** The gap reservoirs at the end. */
  readonly gaps: readonly GapState[];
  /** Soil released over the whole programme, by sink. */
  readonly release: SoilRelease;
  /** Number of ticks replayed. */
  readonly ticks: number;
  /** Carry-over at each drain, litres, in programme order. */
  readonly carryOver_L: readonly number[];
  /** Quality flags. */
  readonly flags: TimelineFlags;
}

/** The timeline stage (section M10): stages H and I of the pipeline. */
export interface TimelineStage {
  /** Replays the programme. */
  run(ctx: TimelineContext): Promise<TimelineResult>;
}
