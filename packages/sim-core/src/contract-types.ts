/**
 * Contract of module M12, the orchestrator (docs/design/sim-core.md section 4, "M12.
 * Orchestrator", with sections 5.5, 7.3 and 7.5): the stage graph of section 2, tiers, the
 * exposure cache, reserves, checkpoints and resume, progress, result assembly and failure
 * handling.
 *
 * Types only; the result contract of section 5.6 is in `result.ts`. The contract writes the
 * entry point as `function wash(input, env): Promise<ContractWashResult>`; its type is `ContractWash` here and
 * the function itself belongs to the orchestrator engineer.
 *
 * Units: SI. Seeds are u32.
 */

import type { StackString, StageId, GpuContext } from '@spotless/sim-gpu';
import type {
  ComboId,
  LiquorProps,
  MachineConfig,
  MachineSpec,
  ProgrammeSpec,
} from '@spotless/sim-hydraulics';
import type { DetergentSpec, RinseAidSpec, SupplySpec } from '@spotless/sim-liquor';
import type { TierId, TierVariant } from '@spotless/sim-params';
import type { WashItem } from '@spotless/sim-scene';
import type { ContractExposureSet } from '@spotless/sim-timeline';
import type { ContractWashResult } from './contract-result.ts';

// ---------------------------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------------------------

/**
 * Everything one wash is computed from (section M12). Identical inputs give identical reports
 * on one stack.
 */
export interface ContractWashInput {
  /** Simulator version, `MAJOR.MINOR.PATCH`. */
  readonly simVersion: string;
  /** The machine (`@spotless/machine`). */
  readonly machine: MachineSpec;
  /** The player-adjustable options of the machine (`@spotless/machine`). */
  readonly machineConfig: MachineConfig;
  /** The programme. */
  readonly programme: ProgrammeSpec;
  /** The detergent dose. */
  readonly detergent: DetergentSpec;
  /** The rinse-aid dose. */
  readonly rinseAid: RinseAidSpec;
  /** The water supply. */
  readonly supply: SupplySpec;
  /**
   * The load, sorted by item id; poses are the canonical rounded poses of the load manifest
   * (positions to 0.1 mm, quaternion components to 1e-4).
   */
  readonly items: readonly WashItem[];
  /** Level seed, u32: surface fields, soil pattern, lanes and coverage ranks. */
  readonly levelSeed: number;
  /** Sim seed, u32: arm start phases, parcels, drip-site offsets. */
  readonly simSeed: number;
  /** The tier. */
  readonly tier: TierId;
  /** Developer and level-acceptance options; none of them is part of a scored run. */
  readonly developer?: {
    /** Registry overrides by key, in the unit of each key. */
    readonly params?: Readonly<Record<string, number>>;
    /** Run the closure bracket (eight preview-tier members, groups G1 to G4 and S). */
    readonly bracket?: boolean;
    /** Re-integrate the soil with `soil.kuE` at 0 and at 3. */
    readonly supplyBracket?: boolean;
    /** Re-integrate the soil twice with records perturbed by plus and minus the spread. */
    readonly sigmaReplay?: boolean;
    /**
     * `frozen`: the wetting summary of every exposure is that of the initial soil state, so a
     * cached set is reused whatever the soil model does. Default `coupled`.
     */
    readonly wettingFeedback?: 'coupled' | 'frozen';
    /** Fill `WashResult.diagnostics`. */
    readonly diagnostics?: boolean;
  };
}

// ---------------------------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------------------------

/**
 * Progress of a wash. The contract passes this type to `onProgress` and never defines it; it
 * is read here as the stage in progress and the fraction of the predicted work done. Reported
 * as a contract issue.
 */
export interface ContractProgress {
  /** The stage in progress (section 2.1). */
  readonly stage: StageId;
  /** Fraction of the run's predicted work that is done, 0 to 1. */
  readonly fraction: number;
}

/**
 * The exposure cache. The contract passes this type to `wash` and never defines it; it is read
 * here as a store of exposure sets by cache key. (The contract also keys the pilot result and
 * the deposition tables by the subsets they depend on and gives no interface for them.)
 * Reported as a contract issue.
 */
export interface ContractExposureCache {
  /** The set stored under a key, or `undefined`. */
  get(key: string): Promise<ContractExposureSet | undefined>;
  /** Stores a set under its own `key`. */
  put(set: ContractExposureSet): Promise<void>;
}

/** What a wash runs in (section M12). */
export interface ContractWashEnv {
  /** The GPU foundation. */
  readonly gpu: GpuContext;
  /** The exposure cache. */
  readonly cache: ContractExposureCache;
  /** Directory of the checkpoints and of the staging file. */
  readonly checkpointDir: string;
  /** Called as the wash advances. */
  onProgress(p: ContractProgress): void;
}

/**
 * The type of the entry point `wash(input, env)` of section M12: runs one wash, lazily and in
 * programme order, and returns its result.
 */
export type ContractWash = (
  input: ContractWashInput,
  env: ContractWashEnv,
) => Promise<ContractWashResult>;

// ---------------------------------------------------------------------------------------------
// Cache key, reserves, failures
// ---------------------------------------------------------------------------------------------

/**
 * What the cache key of an exposure set is the SHA-256 of, as canonical JSON (section M12,
 * "Cache key"): every value that is passed to stages C to G, and nothing else. Soil, liquor
 * and timeline parameters are not in the key.
 */
export interface ContractExposureKeyInput {
  /** The full stack string. */
  readonly stack: StackString;
  /** Simulator version. */
  readonly simVersion: string;
  /** Version of the exposure record layouts. */
  readonly exposureSchema: number;
  /** Tier. */
  readonly tier: TierId;
  /** Official variant. */
  readonly variant: TierVariant;
  /** Hash of the hydro parameter group. */
  readonly hydroHash: string;
  /** Hash of the machine geometry and of the nozzle tables. */
  readonly machineHash: string;
  /**
   * The hydraulic point: its combo (diverter state, pump class, liquor class, arm states with
   * the hashes of their phase tables), its pump speed in rpm and the flow of every sub-jet in
   * m3/s.
   */
  readonly point: {
    /** The combo, with the state of every fed arm and the hash of each phase table. */
    readonly combo: ComboId;
    /** Pump speed of the class centre, rpm. */
    readonly pumpRpm: number;
    /** Volume flow of every sub-jet, m3/s, in the order of `HydraulicPoint.nozzles`. */
    readonly nozzleFlows_m3_s: readonly number[];
  };
  /** The liquor properties of the solve. */
  readonly liquor: LiquorProps;
  /** Hash of the geometry: shapes, canonical poses and epoch. */
  readonly geometryHash: string;
  /** Hash of the quantised wetting summary that `wetParams` consumes. */
  readonly wettingHash: string;
  /** Level seed, u32. */
  readonly levelSeed: number;
  /** Sim seed, u32. */
  readonly simSeed: number;
}

/**
 * Reserve policy of a run, chosen before stage C from the predicted base time (section 7.3):
 * `A` (up to 17 minutes) one reduced re-exposure, then one fast re-exposure; `B` (17 to 20.5
 * minutes) two fast re-exposures; `C` (above) no re-exposure, a moved item is frozen and
 * flagged.
 */
export type ReservePolicy = 'A' | 'B' | 'C';

/** Every {@link ReservePolicy}. */
export const RESERVE_POLICIES: readonly ReservePolicy[] = ['A', 'B', 'C'];

/**
 * Upper end of the predicted base time of policies A and B, seconds (section 7.3): 17 and
 * 20.5 minutes.
 */
export const RESERVE_POLICY_LIMITS_S = { A: 17 * 60, B: 20.5 * 60 } as const;

/**
 * Extension revolutions a run may spend in all when a convergence monitor misses its target,
 * counted in programme order; at most 2 per state (sections M7.7 and 7.3).
 */
export const EXTENSION_REVOLUTIONS_PER_RUN = 4;

/**
 * The quality flags of a run (section M12, "Failure classes"): they do not fail a run; they
 * are in the report.
 */
export const QUALITY_FLAGS = [
  'hydroUnconverged',
  'unsettled',
  'exposureApproximate',
  'wetAssumptionMismatch',
  'wettingDrift',
  'handoverClipped',
  'supplyLimitedArea',
  'cflRaises',
] as const;

/** One of the {@link QUALITY_FLAGS}. */
export type QualityFlag = (typeof QUALITY_FLAGS)[number];

/**
 * The infrastructure failures of a run (section M12; determinism rule 12): the run is retried
 * once and then the level is flagged; it is never scored as zero.
 */
export const INFRASTRUCTURE_FAILURES = [
  'nonFinite',
  'saturation',
  'ledger',
  'bufferExhaustion',
  'leakFraction',
  'deviceLoss',
] as const;

/** One of the {@link INFRASTRUCTURE_FAILURES}. */
export type InfrastructureFailure = (typeof INFRASTRUCTURE_FAILURES)[number];
