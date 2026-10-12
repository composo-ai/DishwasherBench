/**
 * The result contract of a wash (docs/design/sim-core.md section 5.6).
 *
 * The result is representation-independent, so the inspector, the renderer and the report do
 * not depend on patch internals. Every array has a stated shape: N_e is the number of soil
 * elements of the item, N_d the number of deposit rows, C_s the number of soil appearance
 * classes (`WashResult.soilClasses`), C_p = 2 the speck size classes (fines, grit). Arrays of
 * several values per row are row-major: row i occupies indices `i * width` to
 * `i * width + width - 1`.
 *
 * Rules of the contract: residual mass is reported, not a verdict; visibility thresholds,
 * connected-region counting, the speck rule and the clean flag belong to the inspector.
 * Deposits have one owner, the timeline's per-block state, and one table; soil elements carry
 * only what was put on the item before the wash. sim-core never draws discrete specks.
 *
 * Units are those of the field names where they are not SI (`areaMm2`, `residual_mg_cm2`,
 * `fatFilm_um`, `pooled_mL`, `energy_kWh`); positions and normals are in the item frame.
 */

import type { Pose } from '@spotless/core';
import type { StackString } from '@spotless/sim-gpu';
import type { RigidEvent } from '@spotless/sim-rigid';

/** The speck size classes of the result, in column order: C_p = 2 (section 5.6). */
export const SPECK_SIZE_CLASSES = ['fines', 'grit'] as const;

/** What a result was computed with: part of every result, cache key and golden hash (rule 13). */
export interface ContractProvenance {
  /** The full stack string. */
  readonly stack: StackString;
  /** Simulator version, `MAJOR.MINOR.PATCH`. */
  readonly simVersion: string;
  /** Tier id. */
  readonly tier: string;
  /** Official variant the tier was frozen with. */
  readonly variant: string;
  /** Hash of the hydro parameter group. */
  readonly hydroHash: string;
  /** Hash of the soil parameter group. */
  readonly soilHash: string;
  /** Hash of the canonical wash input. */
  readonly inputHash: string;
  /** Level seed, u32. */
  readonly levelSeed: number;
  /** Sim seed, u32. */
  readonly simSeed: number;
  /** Version of the exposure record layouts (`EXPOSURE_SCHEMA`). */
  readonly exposureSchema: number;
  /** Source hash of every kernel that ran, by kernel name. */
  readonly shaderHashes: Readonly<Record<string, string>>;
  /** Hash of the report: the same inputs, seed, tier and stack give the same hash (section 6). */
  readonly reportHash: string;
}

/** The outcome of the wash for one item (section 5.6). */
export interface ContractItemWashResult {
  /** Item instance id. */
  readonly itemId: string;
  /** `SurfaceRegion` ids of the item's shape, in shape order. */
  readonly regionIds: readonly string[];
  /** One row per soil cell of every block that was soiled at the start: N_e rows. */
  readonly elements: {
    /** N_e. */
    readonly count: number;
    /** `[N_e]` index into `regionIds`; 0xFFFF = outside every region. */
    readonly region: Uint16Array;
    /** `[N_e]` index of the element's part in the parts of the item's shape. */
    readonly part: Uint16Array;
    /** `[N_e]` 0 out, 1 in, 2 rim or edge. */
    readonly side: Uint8Array;
    /** `[N_e x 3]` centre of the element, item frame, metres. */
    readonly centre: Float32Array;
    /** `[N_e x 3]` outward unit normal, item frame. */
    readonly normal: Float32Array;
    /** `[N_e x 2]` (sNorm, theta) on sor parts, (u, v) on faces. */
    readonly param: Float32Array;
    /** `[N_e]` area of the element, mm2. */
    readonly areaMm2: Float32Array;
    /** `[N_e]` covered area fraction, 0 to 1. */
    readonly cover: Float32Array;
    /** `[N_e x C_s]` residual dry mass per soil appearance class, per covered area, mg/cm2. */
    readonly residual_mg_cm2: Float32Array;
    /** `[N_e]` fat film thickness, um. */
    readonly fatFilm_um: Float32Array;
    /** `[N_e]` remaining chromophore fraction, 0 to 1. */
    readonly stain: Float32Array;
    /** `[N_e]` attached particles per cm2. */
    readonly particles_per_cm2: Float32Array;
    /**
     * Edge-sharing neighbours on the surface, across seams (for connected regions), in
     * compressed rows: the neighbours of element i are `indices[offsets[i]]` up to but not
     * including `indices[offsets[i + 1]]`.
     */
    readonly neighbours: {
      /** `[N_e + 1]`. */
      readonly offsets: Uint32Array;
      /** Element indices. */
      readonly indices: Uint32Array;
    };
  };
  /**
   * What the wash left on the item, soiled or not: one row per block above a threshold, N_d
   * rows. A block is listed if any of its values exceeds `result.depositFloor` (default 0.01
   * specks per cm2, 0.01 mg/cm2).
   */
  readonly deposits: {
    /** N_d. */
    readonly count: number;
    /** `[N_d]` index into `regionIds`; 0xFFFF = outside every region. */
    readonly region: Uint16Array;
    /** `[N_d]` index of the block's part in the parts of the item's shape. */
    readonly part: Uint16Array;
    /** `[N_d]` 0 out, 1 in, 2 rim or edge. */
    readonly side: Uint8Array;
    /** `[N_d x 3]` centre of the block, item frame, metres. */
    readonly centre: Float32Array;
    /** `[N_d x 3]` outward unit normal, item frame. */
    readonly normal: Float32Array;
    /** `[N_d x 2]` (sNorm, theta) on sor parts, (u, v) on faces. */
    readonly param: Float32Array;
    /** `[N_d]` area of the block, mm2. */
    readonly areaMm2: Float32Array;
    /** `[N_d x C_p]` expected redeposited specks per mm2, by speck size class. */
    readonly speckIntensity_per_mm2: Float32Array;
    /** `[N_d]` dried dissolved residue, including local stores that dried in place, mg/cm2. */
    readonly residue_mg_cm2: Float32Array;
    /** `[N_d]` fat and soap film, mg/cm2. */
    readonly fatDeposit_mg_cm2: Float32Array;
    /** `[N_d]` pigment taken up, dimensionless. */
    readonly pigment: Float32Array;
    /** Sums over the blocks not listed. */
    readonly belowFloorTotals: {
      /** `[C_p]` expected number of specks. */
      readonly specks: Float32Array;
      /** Residue, mg. */
      readonly residue_mg: number;
      /** Fat, mg. */
      readonly fat_mg: number;
    };
  };
  /** Water left on the item. */
  readonly water: {
    /** Water in pools, mL. */
    readonly pooled_mL: number;
    /** The pools, each with what it holds. */
    readonly pools: readonly {
      /** Volume of the pool, mL. */
      readonly volume_mL: number;
      /** True when the pool holds dissolved or settled soil. */
      readonly dirty: boolean;
      /** Soil dissolved in the pool, mg. */
      readonly dissolvedSoil_mg: number;
      /** Solids settled in the pool, mg. */
      readonly settled_mg: number;
    }[];
    /** Film water, g. */
    readonly film_g: number;
    /** Bead water, g. */
    readonly beads_g: number;
    /** Number of edge drops. */
    readonly edgeDrops: number;
    /** Number of capillary bridges. */
    readonly bridges: number;
    /** Water in gap reservoirs, mL. */
    readonly gaps_mL: number;
    /** Water left after drying, g. */
    readonly afterDrying_g: number;
  };
  /** How the item moved during the wash. */
  readonly motion: {
    /** True when the item moved by more than the tolerance of M11 (2 mm or 2 degrees). */
    readonly moved: boolean;
    /** True when the item was frozen while still moving. */
    readonly unsettled: boolean;
    /** Largest displacement of the item from its loaded pose, mm. */
    readonly maxDisplacement_mm: number;
    /** What happened to the item, in order. */
    readonly events: readonly RigidEvent[];
    /** Item frame to tub frame at the end of the wash. */
    readonly finalPose: Pose;
  };
  /** Quality flags of the item (section M12, "Failure classes"); they do not fail a run. */
  readonly flags: {
    /** A solve that covers the item missed a convergence target of M7.7. */
    readonly hydroUnconverged: boolean;
    /** An exposure set of the item was computed under a reduced reserve setting. */
    readonly exposureApproximate: boolean;
    /** The wetting of the item rests on blocks flagged sparse (fewer than 16 parcels). */
    readonly sparseWetting: boolean;
    /** Mass fraction of Monte Carlo deposits whose assumed wall state was wrong, 0 to 1. */
    readonly wetAssumptionMismatch: number;
    /** The two drift measures of M10, 0 to 1 each. */
    readonly wettingDrift: { readonly angle: number; readonly viscosity: number };
    /** Share of the item's hand-over momentum that the speed cap clipped, 0 to 1. */
    readonly handoverClipped: number;
    /** Share of the item's soiled area whose time-mean chi_E fell below 0.8, 0 to 1. */
    readonly supplyLimitedArea: number;
  };
  /** Per-item uncertainty (section 7.6). */
  readonly confidence: {
    /** Monte Carlo split-half sampling error (relative). */
    readonly mcSplitHalf: number;
    /** Revolution-to-revolution spread (relative). */
    readonly revSpread: number;
    /** eps_wet of the item. */
    readonly epsWet: number;
    /** With `sigmaReplay`: sigma of the residual from re-integrating with perturbed records. */
    readonly sigmaResidual?: number;
    /** With `supplyBracket`: residuals `[N_e x C_s]` with `soil.kuE` at 0 and at 3. */
    readonly supplyBracket?: readonly [Float32Array, Float32Array];
    /** With `bracket`: the result of the closure bracket for the item. */
    readonly bracket?: Float32Array;
  };
}

/** The outcome of the wash for the machine (section 5.6). */
export interface ContractMachineWashResult {
  /** Every arm: whether it stalled or knocked at any time. */
  readonly arms: readonly {
    /** Index of the arm in the machine's arm list. */
    readonly arm: number;
    /** True when the arm stood still at any time while it was fed. */
    readonly stalled: boolean;
    /** True when the arm knocked against the load at any time. */
    readonly knocking: boolean;
  }[];
  /** Time the pump ran starved (loss of prime), seconds. */
  readonly starvation_s: number;
  /** Soil mass on the filter at the end, kg. */
  readonly filterLoad_kg: number;
  /** Electrical energy used, kWh. */
  readonly energy_kWh: number;
  /** Water used, litres. */
  readonly water_L: number;
  /** Carry-over at each drain, litres, in programme order. */
  readonly carryOver_L: readonly number[];
  /** `[ticks]` liquor temperature at every tick, kelvin. */
  readonly temperatures: Float32Array;
  /** Whether the dispenser lid could open. */
  readonly dispenser: 'free' | 'blocked';
  /** Fraction of the detergent dose released by the end of the main wash, 0 to 1. */
  readonly detergentReleased: number;
}

/**
 * Developer diagnostics of a wash (`WashInput.developer.diagnostics`). The contract names this
 * type in `WashResult` and never defines it; it is an open record until the contract does.
 * Reported as a contract issue.
 */
export type ContractDiagnostics = Readonly<Record<string, unknown>>;

/** The result of a wash (section 5.6). */
export interface ContractWashResult {
  /** What the result was computed with. */
  readonly provenance: ContractProvenance;
  /** The soil appearance classes of the catalogue: the C_s columns of `residual_mg_cm2`. */
  readonly soilClasses: readonly string[];
  /** One result per item, in the order of `WashInput.items`. */
  readonly items: readonly ContractItemWashResult[];
  /** The machine. */
  readonly machine: ContractMachineWashResult;
  /** Present when the developer option asked for it. */
  readonly diagnostics?: ContractDiagnostics;
}
