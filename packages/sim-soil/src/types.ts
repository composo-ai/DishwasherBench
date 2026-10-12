/**
 * Contract of module M8, soil (docs/design/sim-core.md section 4, "M8. Soil"): the unified
 * per-element soil model of the soils dossier on 1 mm soil cells. Initial state from the
 * level's soil records, the per-tick update, release to the liquor by sink, and the
 * soil-dependent wetting summary handed back to the film solvers.
 *
 * Types only. The binary records are described in `layouts.ts` (`SoilCell`, `BlockRelease`) and
 * `timeline-interface.ts` (the buffers of the timeline that the soil kernel binds).
 * `SoilRelease` and the release classes belong to this module by the contract and are declared
 * in `@spotless/sim-params` (`shared.ts`), because the liquor model of M9 consumes them and may
 * depend on M2 only; `RateTables` of M9 is declared there too, and `WettingSummary` and
 * `JetRecordSet` in `@spotless/sim-scene`. All are re-exported from this package's entry point.
 *
 * Units: SI.
 */

import type { RateTables } from '@spotless/sim-params';
import type { JetRecordSet, Scene, WashItem, WettingSummary } from '@spotless/sim-scene';

// ---------------------------------------------------------------------------------------------
// Enumerations of the soil model
// ---------------------------------------------------------------------------------------------

/**
 * The soil classes (docs/research/soils.md section 7.9), in the order of `SOIL_CLASSES` of
 * `@spotless/catalogue`, which M8 may not depend on: `SOL` soluble, `SWP` swelling protein,
 * `SWS` swelling starch, `PEEL` dried sauces and gum films, `FAT`, `BURN` baked or polymerised,
 * `STAIN` chromophore films, `PART` particles. The position of a class is its code in
 * `SoilCell.class` and its index in the per-class arrays of `RateTables`. The contract leaves
 * the classes to the catalogue and fixes no codes.
 */
export const SOIL_CLASS_IDS = [
  'SOL',
  'SWP',
  'SWS',
  'PEEL',
  'FAT',
  'BURN',
  'STAIN',
  'PART',
] as const;

/** One of the {@link SOIL_CLASS_IDS}. */
export type SoilClassId = (typeof SOIL_CLASS_IDS)[number];

/**
 * The five states through which every soil mechanism sees water (section 0; the wetness
 * contract of section M8). Pass W of the timeline gives each film cell, per tick, the shares of
 * the tick it spends in each; they sum to 1.
 */
export const WETNESS_STATES = ['dry', 'sparse', 'residualFilm', 'flowingFilm', 'immersed'] as const;

/** One of the {@link WETNESS_STATES}. */
export type WetnessState = (typeof WETNESS_STATES)[number];

/** Hydration layers a `SoilCell` has room for (section M8: 12; 1 for dry thickness under 20 um). */
export const SOIL_CELL_LAYERS = 12;

/** Value of `soil.erosionLaw` (section M8): the adopted law, or the optional loosened-layer law. */
export type ErosionLaw = 'linearDuty' | 'loosenedLayer';

/** Value of `soil.kineticSet` (section M8): the soils dossier's kinetics, or the chemistry set. */
export type KineticSet = 'soils' | 'chemistry';

// ---------------------------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------------------------

/** The soil stage (section M8). */
export interface SoilStage {
  /**
   * Builds the initial soil state from the soil records of the items: the ageing transform and
   * the spatial pattern, computed on the CPU and uploaded. Keyed by the level seed (a u32), not
   * by the wash seed.
   */
  init(scene: Scene, items: readonly WashItem[], levelSeed: number): Promise<void>;
  /** Encodes the soil kernel for one tick; writes `SoilCell` and `BlockRelease`. */
  tick(a: {
    /** `EffectiveExposure[]` per film cell, written by pass W of M10 for this tick. */
    readonly eff: GPUBuffer;
    /** Jet records, with their tile table, at the viscosity point below the current viscosity. */
    readonly jetLo: JetRecordSet;
    /** Jet records at the viscosity point above it. */
    readonly jetHi: JetRecordSet;
    /** Weight of `jetHi` in the interpolation in ln(nu), 0 to 1. */
    readonly wNu: number;
    /** Velocity scale s_V of the tick (`MachineTick.sV`). */
    readonly sV: number;
    /** `TimelineBlock[]` per block. */
    readonly blocks: GPUBuffer;
    /** `ReservoirLiquor[]`: 32 bytes per basin and gap, uploaded for this tick. */
    readonly reservoirs: GPUBuffer;
    /** The rate tables of the liquor model for this tick. */
    readonly rates: RateTables;
    /** Length of the tick, seconds. */
    readonly dt_s: number;
    /** Period of the master revolution, seconds: the unit of the jet exceedance times. */
    readonly revPeriod_s: number;
  }): void;
  /**
   * The wetting summary for the film solvers: soil cover in sixteenths and angle class per film
   * cell of a grid, with its hash.
   */
  wettingSummary(grid: 'block' | 'classD'): Promise<WettingSummary>;
  /** The complete soil state, for checkpoints. */
  snapshot(): Promise<Uint8Array>;
  /** Restores a snapshot. */
  restore(s: Uint8Array): Promise<void>;
}
