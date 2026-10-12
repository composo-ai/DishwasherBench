/**
 * The two tiers of the first build (scope note, "Tiers": one official tier and one fast tier):
 * the Official and Fast columns of docs/design/sim-core.md section 7.5 as plain records, with
 * the variant `K-only` the scope note fixes for the first build (the kinematic cascade on every
 * surface). Counts that only the inertial film solver S reads (`s1FilmCellD_m`, `maxLevel`,
 * `handoverCap_m_s`, `filmSolvers`) are transcribed from the table and are unused under
 * `K-only`. The preview and reference tiers are deferred.
 */
import type { PlanningRates, TierParams } from './types.ts';

/**
 * Planning rates of section 7.1, executions per second of GPU time. Planning figures: each
 * kernel's engineer replaces its rate with a measurement (scope note, "Process").
 */
export const PLANNING_RATES: PlanningRates = {
  segmentQueries: 60e6,
  sStageUpdates: 0.6e9,
  sApply: 0.87e9,
  kBlockSteps: 0.79e9,
  statSamples: 0.38e9,
  r0Sweep: 1.65e9,
  gatherPairs: 0.2e9,
  soilCellTicks: 0.19e9,
  passW: 0.66e9,
  passT: 0.33e9,
  sustainedLoad: 0.9,
};

const PILOT = { armPhases: 2048, subRays: 7, parcels: 1e7 } as const;

/** The official tier (section 7.5, column Official), variant `K-only`. Lengths in metres. */
export const TIER_OFFICIAL: TierParams = {
  id: 'official',
  variant: 'K-only',
  block_m: 2e-3,
  s1FilmCellD_m: 1e-3,
  soilCell_m: 1e-3,
  filmSolvers: 'S-on-S-class',
  armPhases: 16384,
  subRays: 19,
  parcelsMainWash: 3e8,
  parcelsOther: 1.5e8,
  settleRevolutions: 2,
  steadyRevolutions: 2,
  transientRecord: 'mainWash',
  mainWashSolveTemperatures: 1,
  maxLevel: 5,
  handoverCap_m_s: 2.2,
  drainDown: { kind: 'cascade', doublingSteps: 512 },
  pumpClassHalfWidth: 0.04,
  soilLayers: 12,
  tickEveryRevolutions: 1,
  pilot: PILOT,
  planningRates: PLANNING_RATES,
};

/** The fast tier (section 7.5, column Fast), variant `K-only`. Lengths in metres. */
export const TIER_FAST: TierParams = {
  id: 'fast',
  variant: 'K-only',
  block_m: 4e-3,
  s1FilmCellD_m: 2e-3,
  soilCell_m: 2e-3,
  filmSolvers: 'S-on-S-class',
  armPhases: 4096,
  subRays: 7,
  parcelsMainWash: 3e7,
  parcelsOther: 1.5e7,
  settleRevolutions: 1,
  steadyRevolutions: 2,
  transientRecord: 'none',
  mainWashSolveTemperatures: 1,
  maxLevel: 5,
  handoverCap_m_s: 2.2,
  drainDown: { kind: 'cascade', doublingSteps: 192 },
  pumpClassHalfWidth: 0.04,
  soilLayers: 8,
  tickEveryRevolutions: 1,
  pilot: PILOT,
  planningRates: PLANNING_RATES,
};

/** The tiers of the first build, by id. */
export const TIERS: Readonly<Record<'official' | 'fast', TierParams>> = {
  official: TIER_OFFICIAL,
  fast: TIER_FAST,
};
