/**
 * What the game server and the wash runner agree on, beyond the session's `WashRunner` hook:
 * the context a runner is called with (tier, cache directory, where to report progress in
 * detail and where to hand the residue maps), and the packing of residue maps.
 *
 * This module imports nothing of the simulation, so that the server can take its types from
 * here (`@spotless/wash-runner/contract`) without loading the simulation into its process or
 * its type check.
 */

import type {
  ResidueMap,
  WashManifest,
  WashReport,
  WashStageProgress,
  WashTier,
} from '@spotless/session';

import type { WashParamChoice } from './defaults.ts';

export { decodeResidueMap, encodeResidueMap } from './residue-codec.ts';
export type { ResidueCells } from './residue-codec.ts';
export {
  MACHINE_WASH_DEFAULTS,
  scoredProgrammeOf,
  washCaveatsFor,
  washParamFilesFor,
  washTierNoteFor,
  washParamsFingerprint,
  washParamsIdentity,
} from './defaults.ts';
export type {
  WashDetergentChoice,
  WashParamChoice,
  WashParamFilesChoice,
  WashVerdictCaveat,
} from './defaults.ts';
export { simulationFingerprint } from '@spotless/sim-core/fingerprint';
// The estimate of the time of a wash, per stage and whole, with the built-in figures and the
// history of timings it reads: offered here because `progress.ts` loads nothing of the
// simulation, so the server can show an estimate without carrying a copy of the figures.
export {
  defaultStageSeconds,
  estimateStageSeconds,
  estimateWashSeconds,
  JOB_STAGES,
  parseTimingHistory,
  STAGE_MODEL,
} from './progress.ts';
export type { JobStage, StageSeconds, TimingHistory, TimingRecord } from './progress.ts';

/** Version of this runner: part of every report it makes. Raise it when the mapping changes. */
export const WASH_RUNNER_VERSION = 'wash-runner 2';

/** Progress of a wash as the runner reports it: the overall fraction and the stage. */
export interface WashProgressDetail {
  /** Share of the estimated wall-clock time of the wash that has passed, 0 to 1. */
  readonly fraction: number;
  readonly stage: WashStageProgress;
}

/** How a wash went as a run of a process: for job records and measurements, never for scores. */
export interface WashRunStats {
  readonly tier: WashTier;
  /** Wall-clock seconds per stage of the simulation, and the whole run of the runner. */
  readonly stage_s: { readonly [stage: string]: number };
  readonly total_s: number;
  /** Loaded items, and surface blocks and soil cells of the simulated scene. */
  readonly items: number;
  readonly blocks: number;
  readonly soil_cells: number;
  /** Exposure sets taken from the cache on disk and computed. */
  readonly exposure_cached: number;
  readonly exposure_computed: number;
  /** Where rays were traced: `gpu`, `cpu`, or `none` when nothing was traced. */
  readonly backend: string;
  /** Largest resident set of the process so far, megabytes (the operating system's figure). */
  readonly peak_rss_mb: number;
  /** Largest total of live GPU buffers during the wash, megabytes; null when not known. */
  readonly gpu_buffers_mb: number | null;
  /**
   * The named parameter sets the wash was run with, in order (a set read although its stored
   * hashes were stale is marked), the detergent and its dose, and the fingerprint of the
   * simulation's source that computed it. Absent for a wash that simulated nothing.
   */
  readonly param_sets?: readonly { readonly name: string; readonly stale: boolean }[];
  readonly detergent?: { readonly name: string; readonly dose_g: number };
  readonly source?: string;
}

/**
 * What the caller of a runner may pass beside the session's two arguments. Every member is
 * optional: a runner that knows nothing of it (the placeholder, a test double) ignores it.
 */
export interface WashRunContext {
  /** The tier asked for; the rules of the level may still say otherwise. */
  readonly tier?: WashTier;
  /** Directory for the simulation's exposure cache; none when absent. */
  readonly exposureCacheDir?: string;
  /**
   * Which parameters the wash is run with (`defaults.ts`); default `machine-default`: the
   * current anchored set and the owner's detergent for the owner's machine.
   */
  readonly params?: WashParamChoice;
  /**
   * True to wash with a parameter-set file whose stored hashes are stale (written against
   * another state of the parameter registry). Without it such a wash fails and says what to
   * do; with it the report says that a stale set was used.
   */
  readonly acceptStaleParams?: boolean;
  /** File in which the runner keeps the stage timings of earlier washes, for its estimates. */
  readonly timingsFile?: string;
  /**
   * When the wash began, in seconds on the clock of the process (`performance.now() / 1000`,
   * so 0 is the start of the process): what `elapsed_s` and the stage timings count from.
   * Default: the moment the runner is called.
   */
  readonly startedAt?: number;
  /**
   * Aborted when the wash is no longer wanted (a time limit, the server closing): the runner
   * destroys its GPU device, so that the simulation stops at its next use of it, and rejects.
   */
  readonly signal?: AbortSignal;
  /** Progress with stage and time estimate (the plain fraction is reported as well). */
  readonly onDetail?: (progress: WashProgressDetail) => void;
  /** Receives the residue maps of the washed items before the runner resolves. */
  readonly onResidue?: (maps: readonly ResidueMap[]) => void;
  /** Receives the statistics of the run before the runner resolves. */
  readonly onStats?: (stats: WashRunStats) => void;
  /**
   * Receives what the simulation could not simulate as asked, in its own words, when there is
   * any. For a log: it is written for developers and is not part of the report.
   */
  readonly onProblems?: (problems: readonly string[]) => void;
}

/**
 * A wash runner that takes a {@link WashRunContext} as third argument. It is assignable to the
 * session's `WashRunner`, which is how the session and the wash worker call it.
 */
export type ContextWashRunner = (
  manifest: WashManifest,
  onProgress: (fraction: number) => void,
  context?: WashRunContext,
) => Promise<WashReport>;
