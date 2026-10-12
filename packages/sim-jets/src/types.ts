/**
 * Contract of module M5, jets (docs/design/sim-core.md section 4, "M5. Jets"): everything
 * between a nozzle and the edge of the fast radial film. The phase-domain trace, hit
 * classification, footprint records, impingement closures, the exposure gather onto soil cells,
 * the hand-over of liquid to the film solvers, the source records for secondary droplets, and
 * jet loads on items.
 *
 * Types only. The binary records behind the buffers are described in `layouts.ts`;
 * `JetRecordSet` and the `JetExposure` layout belong to this module by the contract and are
 * declared in `@spotless/sim-scene` (`exposure.ts`), because the soil kernel of M8 reads them
 * and may not depend on M5; they are re-exported from this package's entry point.
 *
 * Units: SI. Frames: forces and torques in the tub frame, torques about the centre of mass of
 * the item. Per-item arrays use the item index of `@spotless/sim-scene`. Note the two bin
 * counts: loads and time-step levels are tabulated in 256 phase bins per revolution of an arm,
 * while the "phase bins" of M4, M6 and M7 (jet-wet tables, Monte Carlo tables, statistics) are
 * 64 per revolution.
 */

import type { Pose, Vec3 } from '@spotless/core';
import type { HydraulicPoint, LiquorProps } from '@spotless/sim-hydraulics';
import type { JetRecordSet, Scene } from '@spotless/sim-scene';

// ---------------------------------------------------------------------------------------------
// Constants of the jet stage
// ---------------------------------------------------------------------------------------------

/** Phase bins per revolution of an arm in `ItemLoads` and in `levelByPhase` (section M5). */
export const LOAD_PHASE_BINS = 256;

/** Arrival-phase buckets per revolution of an arm into which emitter entries are sorted. */
export const EMITTER_BUCKETS = 4096;

/** Azimuths about the source point at which a sector walk records the fan limit (section M5). */
export const SECTOR_AZIMUTHS = 32;

/** A sector walk is made for every this-many-th phase of the trace (section M5). */
export const SECTOR_PHASE_STRIDE = 4;

// ---------------------------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------------------------

/**
 * The footprints of one hydraulic point: one `FootprintRecord` per (sub-jet, phase) and, once
 * complete, one `SectorRecord` per (sub-jet, walked phase). Written in two parts: geometry by
 * stage C (`trace`), film quantities by stage D (`completeFootprints`).
 */
export interface FootprintTable {
  /** The hydraulic point that was traced. */
  readonly hp: HydraulicPoint;
  /** Arm phases per revolution of the trace (16,384 official, 4,096 fast, 2,048 preview). */
  readonly phases: number;
  /** Number of sub-jets: `hp.nozzles.length`. */
  readonly subJets: number;
  /** The records read back to the CPU: `[subJet][phase]` row-major. */
  readonly cpu: {
    /** `FootprintRecord[]`. */
    readonly footprints: ArrayBuffer;
    /** `SectorRecord[]`, `[subJet][phase / 4]`; present once the table is complete. */
    readonly sectors?: ArrayBuffer;
  };
  /** The same records on the GPU. */
  readonly gpu: {
    /** `FootprintRecord[]`. */
    readonly footprints: GPUBuffer;
    /** `SectorRecord[]`; present once the table is complete. */
    readonly sectors?: GPUBuffer;
  };
  /** False after `trace`, true after `completeFootprints`. */
  readonly complete: boolean;
}

/**
 * Jet loads on items by the momentum theorem (section M5, "Loads on items"), tabulated per arm
 * and phase bin of that arm. Needs only the trace; used to screen for mobile items.
 */
export interface ItemLoads {
  /** Phase bins per revolution of each arm: 256. */
  readonly phaseBins: 256;
  /**
   * Force on each item, newtons, tub frame: `[arm][item][bin][3]` row-major, arms in the order
   * of `HydraulicPoint.arms`, items by item index.
   */
  readonly force: Float32Array;
  /** Torque about the centre of mass of each item, N m, tub frame: `[arm][item][bin][3]`. */
  readonly torque: Float32Array;
}

/** The jet load on one item at one instant (section M5, `liveWrench`). */
export interface Wrench {
  /** Item id. */
  readonly item: string;
  /** Force on the item, newtons, tub frame. */
  readonly forceN: Vec3;
  /** Torque about the centre of mass of the item, N m, tub frame. */
  readonly torqueNm: Vec3;
}

/**
 * The retarded ring emitters of one hydraulic point (section M5, "Hand-over"): what the fans
 * hand to the film solvers, replayed every revolution of the emitting arm.
 */
export interface EmitterTable {
  /** One table per fed arm. */
  readonly perArm: readonly {
    /** Index of the arm. */
    readonly arm: number;
    /**
     * Start of each of the 4,096 arrival-phase buckets of that arm in `entries`: 4,097 values,
     * bucket k holding entries `bucketOffsets[k]` up to but not including `bucketOffsets[k + 1]`.
     */
    readonly bucketOffsets: Uint32Array;
    /** `EmitterEntry[]`, sorted by arrival phase. */
    readonly entries: GPUBuffer;
    /**
     * `[item][256 phase bins of that arm]` row-major: the time-step level the emitters require
     * of the item, from 4 ms before until 60 ms after the fastest emitter of that arm lands on
     * it (section M7.4).
     */
    readonly levelByPhase: Uint8Array;
    /**
     * `JetWet[]`: 64 bits per block, the phase bins of that arm in which the block lies inside
     * a fan.
     */
    readonly jetWet: GPUBuffer;
  }[];
  /** Per item: share of its hand-over momentum that the speed cap clipped, 0 to 1. */
  readonly clippedMomentumShare: Float32Array;
}

/** The source records for the diffuse secondary water of one hydraulic point (section M5). */
export interface SourceTable {
  /** `SourceRecord[]`, grouped by arm. */
  readonly records: GPUBuffer;
  /** Number of records. */
  readonly count: number;
  /** The range of records and the total mass rate of each fed arm. */
  readonly perArm: readonly {
    /** Index of the arm. */
    readonly arm: number;
    /** Index of the arm's first record. */
    readonly first: number;
    /** Number of records of the arm. */
    readonly count: number;
    /** Mass rate of all the arm's sources, kg/s. */
    readonly massRate_kg_s: number;
  }[];
}

// ---------------------------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------------------------

/** The jet stage (section M5): stages C and D of the pipeline, and the loads on items. */
export interface JetStage {
  /**
   * Stage C: traces the active arms at `phases` phases per revolution and writes the trace part
   * of the footprint records; read back.
   */
  trace(scene: Scene, hp: HydraulicPoint, phases: number): Promise<FootprintTable>;
  /** Tabulated loads on items; CPU, needs only the trace. */
  loads(t: FootprintTable, scene: Scene): ItemLoads;
  /**
   * The momentum-theorem wrench on each awake body at `baseTime_s` seconds into the revolution,
   * for the current poses (item id to pose, tub frame). CPU f64: re-casts the sub-rays that can
   * reach the awake bodies with `RayQuery.traceCpu`.
   */
  liveWrench(
    hp: HydraulicPoint,
    baseTime_s: number,
    poses: ReadonlyMap<string, Pose>,
    awake: readonly string[],
    scene: Scene,
  ): readonly Wrench[];
  /**
   * The pilot's input: `EmitterMean[]`, the time-mean hand-over per block with fan limits at
   * h_res = 0.
   */
  emitterMeans(t: FootprintTable, scene: Scene, liq: LiquorProps): Promise<GPUBuffer>;
  /**
   * Stage D: completes the film part of the footprint records (coherent fraction with rain
   * interference, splatter fraction) and makes the sector walks. `hRes` is `HRes[]` of the
   * pilot (f16 per block); `rain` is the droplet number density of the pilot on a 1 cm grid,
   * whose format the contract does not fix.
   */
  completeFootprints(
    t: FootprintTable,
    scene: Scene,
    liq: LiquorProps,
    hRes: GPUBuffer,
    rain: GPUBuffer,
  ): Promise<FootprintTable>;
  /** Stage D: gathers the closures onto soil cells at the viscosity of `liq`. */
  gather(t: FootprintTable, scene: Scene, liq: LiquorProps): Promise<JetRecordSet>;
  /** Stage D: rasterises the ring emitters onto the film cells of a grid. */
  emitters(
    t: FootprintTable,
    scene: Scene,
    liq: LiquorProps,
    grid: 'block' | 'classD',
  ): Promise<EmitterTable>;
  /**
   * The source records for M6. On a table that is not complete: no rain interference, sector
   * ends at h_res = 0 (what the pilot uses).
   */
  sources(t: FootprintTable): SourceTable;
}
