/**
 * Contract of module M2, parameters and closure tables (docs/design/sim-core.md section 4,
 * "M2. Parameters and closure tables", and section 7.5 for the tiers).
 *
 * The registry is the only place a physical constant may be defined (section 0): every constant
 * has a key (`film.betaCl0`), a default, a range, a confidence tag and a source, and kernels
 * receive constants only through uniform blocks built from the registry.
 *
 * Types and the enumerations the contract fixes. The mechanism is in the sibling files
 * (`registry.ts`, `param-set.ts`, `uniform-block.ts`, `closure-table.ts`, `expr.ts`, `fit.ts`).
 * Units are SI unless a field name says otherwise.
 */

// ---------------------------------------------------------------------------------------------
// Parameter registry
// ---------------------------------------------------------------------------------------------

/**
 * Confidence tag of a parameter (section 0): the three tags of the dossiers, `SYN` for an
 * estimate or choice made in the contract itself, `MEASURED` for a figure from the GPU or
 * rigid-body spike.
 */
export type ParamTag = 'VERIFIED' | 'RECALLED' | 'ESTIMATED' | 'SYN' | 'MEASURED';

/** Every {@link ParamTag}. */
export const PARAM_TAGS: readonly ParamTag[] = [
  'VERIFIED',
  'RECALLED',
  'ESTIMATED',
  'SYN',
  'MEASURED',
];

/**
 * Hash group of a parameter (section M2). `hydro` holds the keys read by stages A to G
 * (`scene.*`, `hyd.*`, `jets.*`, `spray.*`, `film.*`, contact angles); `soil` holds `soil.*`,
 * `liq.*`, `tl.*` and `dry.*`. An exposure set is keyed by the hydro hash only, so changing a
 * soil parameter reuses cached exposure.
 */
export type ParamGroup = 'hydro' | 'soil';

/** Every {@link ParamGroup}. */
export const PARAM_GROUPS: readonly ParamGroup[] = ['hydro', 'soil'];

/**
 * Closure group of the bracket option (section 7.6): `G1` splatter and the surface tension of
 * young surfaces; `G2` secondary break-up and wires; `G3` contact angles; `G4` edges,
 * undersides, contacts and gaps; `S` the soil-side group, run on cached exposure.
 */
export type BracketGroup = 'G1' | 'G2' | 'G3' | 'G4' | 'S';

/** Every {@link BracketGroup}. */
export const BRACKET_GROUPS: readonly BracketGroup[] = ['G1', 'G2', 'G3', 'G4', 'S'];

/**
 * A parameter value: a number, a short numeric vector (at most {@link MAX_PARAM_VECTOR_LENGTH}
 * components, for example one value per liquor class) or one of a fixed set of names (for
 * example `soil.erosionLaw`). The contract's `ParamDef` is numbers-only and cannot hold its own
 * enumerations and per-class vectors (contract-issues.md entry 31); this is the correction.
 */
export type ParamValue = number | readonly number[] | string;

/** The largest number of components a vector parameter may have. */
export const MAX_PARAM_VECTOR_LENGTH = 16;

/** How a numeric range is traversed by a fitting tool: evenly, or evenly in the logarithm. */
export type ParamScale = 'linear' | 'log';

/**
 * What a vector or enumeration entry of the registry carries besides its value: the same
 * members as the scalar {@link ParamDef}.
 */
export interface ParamDefBase {
  /**
   * Registry key, for example `film.betaCl0`: dot-separated segments, the first one the module
   * prefix. A per-class soil key is `soil.<class>.<name>` and overrides the global `soil.<name>`.
   */
  readonly key: string;
  /** Unit of the value and of its range: SI, or `1` for a pure number or a name. */
  readonly unit: string;
  /** Confidence tag of the default. */
  readonly tag: ParamTag;
  /** Where the value comes from: the contract section and the dossier section it cites. */
  readonly source: string;
  /**
   * The range in which the source verified the parameter, for example "incidence 30 to 120
   * degrees, Re up to 32,000".
   */
  readonly validity?: string;
  /**
   * Which of the two hashes covers the parameter: `hydro` for everything that affects water
   * exposure, `soil` for soil, liquor, timeline and drying parameters.
   */
  readonly group: ParamGroup;
  /** The bracket group that pushes this parameter to its limits, if any. */
  readonly bracket?: BracketGroup;
  /**
   * Calibration group: a free name (`wetting`, `jetStress`, `soil.egg_yolk_dried` ...) under
   * which a fitting tool finds the parameters that are adjusted together (scope note,
   * "Calibration is a first-class feature"). Absent for parameters that are not fitted, such as
   * directly measured machine quantities and the properties of water.
   */
  readonly calibration?: string;
}

/**
 * A numeric parameter: the `ParamDef` of section M2, with every member the contract names in
 * this declaration, plus `kind` (which may be omitted), `calibration` and `scale`. A parameter
 * with `min === max` is fixed: it cannot be overridden and is never offered to a fitting tool.
 * Vectors and enumerations are the sibling types {@link VectorParamDef} and
 * {@link EnumParamDef}; the registry holds {@link AnyParamDef}.
 */
export interface ParamDef {
  /** Discriminant; a definition without `kind` is a scalar. */
  readonly kind?: 'scalar';
  /**
   * Registry key, for example `film.betaCl0`: dot-separated segments, the first one the module
   * prefix. A per-class soil key is `soil.<class>.<name>` and overrides the global `soil.<name>`.
   */
  readonly key: string;
  /** Unit of `default`, `min` and `max`: SI, or `1` for a pure number. */
  readonly unit: string;
  /** Default value, in `unit`. */
  readonly default: number;
  /** Lower end of the range the parameter may be set to, in `unit`. */
  readonly min: number;
  /** Upper end of the range, in `unit`. */
  readonly max: number;
  /** Confidence tag of the default. */
  readonly tag: ParamTag;
  /** Where the value comes from: the contract section and the dossier section it cites. */
  readonly source: string;
  /**
   * The range in which the source verified the parameter, for example "incidence 30 to 120
   * degrees, Re up to 32,000".
   */
  readonly validity?: string;
  /**
   * Which of the two hashes covers the parameter: `hydro` for everything that affects water
   * exposure, `soil` for soil, liquor, timeline and drying parameters.
   */
  readonly group: ParamGroup;
  /** The bracket group that pushes this parameter to its limits, if any. */
  readonly bracket?: BracketGroup;
  /** Calibration group; see {@link ParamDefBase.calibration}. */
  readonly calibration?: string;
  /**
   * How a fitting tool traverses the range. Default: `log` when the range is positive and spans
   * more than a decade (`max / min > 10`), else `linear`.
   */
  readonly scale?: ParamScale;
}

/** A short numeric vector, for example `film.sigma` per liquor class W / D / R. */
export interface VectorParamDef extends ParamDefBase {
  /** Discriminant. */
  readonly kind: 'vector';
  /** Default components, in `unit`; 1 to {@link MAX_PARAM_VECTOR_LENGTH} of them. */
  readonly default: readonly number[];
  /** Lower end of the range of every component, in `unit`. */
  readonly min: number;
  /** Upper end of the range of every component, in `unit`. */
  readonly max: number;
  /** Names of the components (`['W', 'D', 'R']`), used in uniform field names and fit axes. */
  readonly components?: readonly string[];
  /** As {@link ParamDef.scale}, for every component. */
  readonly scale?: ParamScale;
}

/** One of a fixed set of names, for example `soil.erosionLaw`. Kernels receive its index. */
export interface EnumParamDef extends ParamDefBase {
  /** Discriminant. */
  readonly kind: 'enum';
  /** Default name; one of `options`. */
  readonly default: string;
  /** The allowed names. The position of a name is the code a kernel receives. */
  readonly options: readonly string[];
}

/**
 * Any entry of the parameter registry (section M2, widened to vectors and enumerations). Each
 * simulation package declares its definitions next to the code that uses them and contributes
 * them to one registry at start-up (`createRegistry`).
 */
export type AnyParamDef = ParamDef | VectorParamDef | EnumParamDef;

// ---------------------------------------------------------------------------------------------
// Closure tables
// ---------------------------------------------------------------------------------------------

/**
 * A regular grid evaluated by clamped multilinear interpolation, on the CPU in f64 and in
 * kernels with `textureLoad` and explicit interpolation (sections M2 and M1; determinism
 * rule 10). The plug-in point of the offline closure campaign (section 11.2).
 */
export interface ClosureTable {
  /** Table id, for example `sweep.correction`. */
  readonly id: string;
  /** The axes, outermost first; `values` are the strictly increasing grid coordinates. */
  readonly axes: readonly {
    /** Name of the axis, for example `phi`. */
    readonly name: string;
    /** Unit of the grid coordinates. */
    readonly unit: string;
    /** Grid coordinates, strictly increasing. */
    readonly values: Float64Array;
  }[];
  /** Grid values in row-major order: the last axis varies fastest. */
  readonly data: Float64Array;
  /** Unit of `data`. */
  readonly unit: string;
  /** Where the content comes from: `analytic default`, or the campaign case set and solver. */
  readonly provenance: string;
}

/** The table ids that have analytic defaults (section M2). */
export const CLOSURE_TABLE_IDS = [
  'wire.split',
  'rim.split',
  'sweep.correction',
  'vessel.interior',
  'splatter.fraction',
  'splash.massRatio',
  'slot.footprint',
] as const;

/** A table id of {@link CLOSURE_TABLE_IDS}. */
export type ClosureTableId = (typeof CLOSURE_TABLE_IDS)[number];

// ---------------------------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------------------------

/** Tier of a wash (section 7.5): scoring, level design and CI, instant feedback, offline. */
export type TierId = 'official' | 'fast' | 'preview' | 'reference';

/** Every {@link TierId}, in the column order of section 7.5. */
export const TIER_IDS: readonly TierId[] = ['official', 'fast', 'preview', 'reference'];

/**
 * Official variant, decided once from the MS0 and MS3 measurements and frozen in the version
 * string (section 7.4): `S-split` (planned) S on S-class items and K elsewhere; `S-all` flat
 * ware joins class S2; `S-mainwash` S in the main-wash class only; `K-only` the cascade
 * everywhere.
 */
export type TierVariant = 'S-split' | 'S-all' | 'S-mainwash' | 'K-only';

/** Every {@link TierVariant}, in the row order of section 7.4. */
export const TIER_VARIANTS: readonly TierVariant[] = ['S-all', 'S-split', 'S-mainwash', 'K-only'];

/**
 * Frozen planning rates of a tier definition (section 7.1; used by the work prediction of M12,
 * which converts work counts to predicted seconds with these constants and never with the
 * clock). All in executions per second of GPU time.
 */
export interface PlanningRates {
  /** Segment queries of jets and parcels, 1/s (60 M/s planned). */
  readonly segmentQueries: number;
  /** S stage updates, cell-updates/s (0.60 G/s planned). */
  readonly sStageUpdates: number;
  /** S apply passes, cells/s (0.87 G/s planned). */
  readonly sApply: number;
  /** K block steps, 1/s (0.79 G/s planned). */
  readonly kBlockSteps: number;
  /** Film statistics samples, 1/s (0.38 G/s planned). */
  readonly statSamples: number;
  /** R0 sweep, cells/s (1.65 G/s planned). */
  readonly r0Sweep: number;
  /** Jet gather, (cell, sample) pairs/s (0.2 G/s planned). */
  readonly gatherPairs: number;
  /** Soil cell-ticks, 1/s (0.19 G/s planned). */
  readonly soilCellTicks: number;
  /** Pass W of the replay, film cell-ticks/s (0.66 G/s planned). */
  readonly passW: number;
  /** Pass T of the replay, block-ticks/s (0.33 G/s planned). */
  readonly passT: number;
  /** Sustained-load factor every total is divided by (0.9). */
  readonly sustainedLoad: number;
}

/**
 * Every count of one tier (section 7.5). The tier id, the variant and the parameter hashes are
 * inputs and part of every cache key; every count in the run derives from this table and the
 * load before stage C, and nothing adapts during a run.
 */
export interface TierParams {
  /** The tier. */
  readonly id: TierId;
  /** The official variant the tier definition was frozen with. */
  readonly variant: TierVariant;
  /**
   * Block size, metres: 2 mm official, 4 mm fast and preview, 1 mm reference. Rows and columns
   * are laid out on the 4 mm coarse grid and halved (section 3.2), so tiers are nested.
   */
  readonly block_m: number;
  /**
   * Film cell of class S1 in main-wash-class (class D) solves, metres: 1 mm official, 2 mm fast,
   * 0.5 mm reference; `null` in the preview tier, which has no S solver.
   */
  readonly s1FilmCellD_m: number | null;
  /** Soil cell size, metres: 1 mm official, 2 mm fast and preview, 0.5 mm reference. */
  readonly soilCell_m: number;
  /**
   * Film solvers: `S-on-S-class` S on S-class items and K elsewhere (official and fast, the same
   * allocation); `R0` steady routing with the pulsatility closure (preview); `S-everywhere` S on
   * every structured patch, with 1 mm cells on all partially wetting materials (reference).
   */
  readonly filmSolvers: 'S-on-S-class' | 'R0' | 'S-everywhere';
  /** Arm phases per revolution: 16,384 / 4,096 / 2,048 / 32,768. */
  readonly armPhases: number;
  /** Sub-rays per round jet: 19 / 7 / 7 / 37. Slot sub-jets come from the nozzle table. */
  readonly subRays: number;
  /**
   * Monte Carlo parcels per (diverter state, pump class) in the main-wash pump class:
   * 3e8 / 3e7 / 1e7 / 1.2e9.
   */
  readonly parcelsMainWash: number;
  /** The same for the other pump classes: 1.5e8 / 1.5e7 / 1e7 / 1.2e9. */
  readonly parcelsOther: number;
  /** Settle revolutions per state, discarded: 2 / 1 / 0 / 4. */
  readonly settleRevolutions: number;
  /** Recorded steady revolutions per state: 2 / 2 / 0 / 4. */
  readonly steadyRevolutions: number;
  /**
   * Which liquor classes get a transient record: the main-wash class only (official), none
   * (fast, preview), every class (reference).
   */
  readonly transientRecord: 'mainWash' | 'none' | 'all';
  /** Solve temperatures of the main-wash class: 1, or 2 in the reference tier. */
  readonly mainWashSolveTemperatures: 1 | 2;
  /**
   * Highest time-step level of the S solver (levels run from 0): 5 / 5 / none / 8; `null` in
   * the preview tier.
   */
  readonly maxLevel: number | null;
  /**
   * Hand-over speed cap, m/s: 2.2 official and fast; `null` where there is none (reference) or
   * no time-marched film (preview).
   */
  readonly handoverCap_m_s: number | null;
  /**
   * Drain-down schedule: the cascade with a step that doubles every `doublingSteps` steps
   * (512 official, 192 fast, 1,024 reference), or Jeffreys' law per block (preview).
   */
  readonly drainDown:
    { readonly kind: 'cascade'; readonly doublingSteps: number } | { readonly kind: 'jeffreys' };
  /** Pump class half-width as a fraction of the class centre: 0.04 / 0.04 / 0.08 / 0. */
  readonly pumpClassHalfWidth: number;
  /** Hydration layers per soil cell: 12 / 8 / 4 / 12. */
  readonly soilLayers: number;
  /** Master revolutions per soil tick: 1 / 1 / 3 / 1. */
  readonly tickEveryRevolutions: number;
  /**
   * Sampling of the pilot inside every run, which is not a tier: preview sampling on the grid of
   * the run (2,048 phases, 7 sub-rays, 1e7 parcels; sections 7.5 and M7.2).
   */
  readonly pilot: {
    /** Arm phases per revolution of the pilot trace: 2,048. */
    readonly armPhases: number;
    /** Sub-rays per round jet of the pilot trace: 7. */
    readonly subRays: number;
    /** Parcels of the pilot Monte Carlo per (diverter state, pump class): 1e7. */
    readonly parcels: number;
  };
  /** The frozen planning rates of the tier definition (sections 7.1 and M12). */
  readonly planningRates: PlanningRates;
}
