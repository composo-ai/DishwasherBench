/**
 * Contract of module M6, spray (docs/design/sim-core.md section 4, "M6. Spray"): all droplets.
 * Monte Carlo mode (stage F) samples the diffuse primary sources as parcels and deposits them
 * into phase-binned integer tables, one per active arm; time-coupled mode (inside stage G)
 * advances everything the film emits as live parcels with the film.
 *
 * Types only. The binary records behind the buffers are described in `layouts.ts` and
 * `film-interface.ts`.
 *
 * Units: SI; integer masses in units of 1e-12 kg. Frames: parcel positions and velocities in
 * the tub frame.
 */

import type { SourceTable } from '@spotless/sim-jets';
import type { Scene } from '@spotless/sim-scene';

/** Most accumulator targets one parcel writes to in one deposit (sections M1 and M6). */
export const MAX_DEPOSIT_TARGETS = 49;

/**
 * What the Monte Carlo takes a wall to be at the landing time of a parcel (section M6, "Wall
 * interaction"): wet if the pilot's steady estimate says so, or if the jet-wet table of any
 * active arm has the bit of that arm's phase bin at that time.
 */
export interface WallStateTable {
  /** `SteadyWet` words: 1 bit per block, the pilot's time-mean film-wet estimate. */
  readonly steadyWet: GPUBuffer;
  /** Per active arm: `JetWet[]`, 64 bits per block. */
  readonly jetWet: readonly GPUBuffer[];
}

/**
 * How many parcels each stratum gets and what each is worth (section M6, "Sampling"). Parcels
 * are generated from a counter with no stored list: parcel index to (source row, stratum,
 * sample) through the prefix sums.
 */
export interface ParcelPlan {
  /**
   * Prefix sums of the parcel counts per (source, phase bin) stratum: `strata[k]` is the index
   * of the first parcel of stratum k, with one more entry at the end equal to `total`.
   */
  readonly strata: Uint32Array;
  /**
   * Mass each parcel of a stratum represents per revolution of its arm, in integer units of
   * 1e-12 kg: the stratum's mass flux divided by its count, so the estimate stays unbiased.
   */
  readonly massPerParcel: Uint32Array;
  /** Number of parcels in all. */
  readonly total: number;
}

/**
 * The Monte Carlo result for one arm (section M6): where the diffuse secondary water of that
 * arm's sources lands, by phase bin of the arm, in the accumulator's integer unit.
 */
export interface DepositionTable {
  /** Index of the arm that owns the sources. */
  readonly arm: number;
  /** `PackedDeposition[]`: 144 bytes per block. */
  readonly packed: GPUBuffer;
  /**
   * Mass deposited on each item by the two halves of the parcels (split by the lowest bit of
   * the sample index), kg per revolution of the arm, by item index. Their relative difference
   * is the split-half sampling error.
   */
  readonly perItemHalfMass: readonly [Float64Array, Float64Array];
  /** Time-mean volume of water in flight, m3; reported to M4. */
  readonly vAir_m3: number;
  /**
   * Droplet number density on a 1 cm grid, for the rain interference of M5. The contract fixes
   * neither the extent of the grid nor the element format.
   */
  readonly rainDensity: GPUBuffer;
  /** Per stratum: share of its parcels that landed on blocks classed as sparse, 0 to 1. */
  readonly sparseLanding: Float32Array;
  /** Leaked mass over traced mass; the run fails above 1e-6 (section 3.5). */
  readonly leakFraction: number;
  /** Mass booked to the ledger account `packRemainder` by the packing, in units of 1e-12 kg. */
  readonly packRemainder_units: bigint;
}

/**
 * The buffers of the film stage that live parcels read and write (section M6, `live.bind`):
 * the deposit accumulators, the wet state of the landing cell, the impact-duty counters and
 * the level requests. Their layouts are in `film-interface.ts`.
 */
export interface FilmBuffers {
  /** The `current` deposit accumulators: five i32 words per S cell, two per K block. */
  readonly accCurrent: GPUBuffer;
  /** The `BlockFilm` table of the grid being solved. */
  readonly blockFilm: GPUBuffer;
  /** `SFilm[]`: thickness and wet flag of S cells at impact. */
  readonly sFilm: GPUBuffer;
  /** `KHot[]`: mass and regime of blocks at impact. */
  readonly kHot: GPUBuffer;
  /** `ImpactDuty[]`: two counters per block. */
  readonly impactDuty: GPUBuffer;
  /**
   * Level requests (item, landing base step, level), read back with the monitors at the end of
   * each phase bin. The contract fixes no layout for them.
   */
  readonly levelRequest: GPUBuffer;
}

/** The spray stage (section M6). */
export interface SprayStage {
  /**
   * Stage F: samples the sources of one arm as parcels, traces them to their fate and deposits
   * them into the phase-binned table of that arm. `simSeed` is a u32.
   */
  monteCarlo(a: {
    /** The scene of the current epoch. */
    readonly scene: Scene;
    /** The source records of the hydraulic point. */
    readonly src: SourceTable;
    /** Index of the arm whose sources are sampled. */
    readonly arm: number;
    /** The wall state the Monte Carlo assumes at each landing. */
    readonly wall: WallStateTable;
    /** The parcels of each stratum. */
    readonly plan: ParcelPlan;
    /** Sim seed, u32: the key of every random draw of the parcels. */
    readonly simSeed: number;
  }): Promise<DepositionTable>;
  /**
   * Allots `nParcels` parcels to the strata of a source table, in proportion to mass flux times
   * (1 + G s), with s the pilot's sparse-landing share per source stratum (`importance`).
   */
  plan(src: SourceTable, nParcels: number, importance?: Float32Array): ParcelPlan;
  /** Time-coupled parcels, advanced inside the base step of the film stage. */
  readonly live: {
    /** Binds the film buffers the parcel kernels read and write. */
    bind(film: FilmBuffers): void;
    /**
     * Encodes pass 2 of a base step: advance due parcels by one segment, resolve impacts into
     * the current accumulators, spawn children. `armPhases` holds the u32 phase of every active
     * arm at the start of the step. No CPU count is needed.
     */
    encode(
      pass: GPUComputePassEncoder,
      step: { readonly baseStep: number; readonly armPhases: Uint32Array },
    ): void;
    /** Mass in flight (kg) and parcel slots in use; read with the monitors once per phase bin. */
    airborne(): Promise<{ readonly mass_kg: number; readonly slotsInUse: number }>;
  };
}
