/**
 * Progress of a wash that says what is true: which stage the simulation is in, how much of it
 * is done as far as the simulation says, and an estimate of the time still needed.
 *
 * The simulation reports progress per stage, and its long stages in coarse steps: the scene is
 * built in one go, and the exposure stage reports once per spray state, each of which takes
 * from seconds to minutes. A bar driven by those fractions alone would stand still for most of
 * the wash and then jump. So the overall fraction here is a share of estimated wall-clock time:
 *
 *   remaining = (what is left of the current stage) + (the stages still to come)
 *   fraction  = elapsed / (elapsed + remaining)
 *
 * with stage durations estimated from the timings of earlier washes on this machine at the same
 * tier (`TimingHistory`), scaled to the size of the load, and corrected as this wash goes by
 * how its finished stages compared with their estimates. Without a history the built-in
 * figures are used: measurements on the reference machine (M3 Pro, 2026-10-10), see
 * `STAGE_MODEL`.
 *
 * Between two reports nothing here runs (the simulation holds the process), so the estimate is
 * a value at the time of the report; whoever shows it counts it down and says so when a stage
 * overruns it.
 *
 * Nothing here affects the wash or its result.
 */

import type { WashStageProgress, WashTier } from '@spotless/session';
import type { WashProgressDetail } from './contract.ts';

/** The stages of a wash job, in order: starting the process, then the simulation's own. */
export const JOB_STAGES = [
  'starting',
  'scene',
  'hydraulics',
  'exposure',
  'soil',
  'replay',
  'result',
] as const;

/** One of {@link JOB_STAGES}. */
export type JobStage = (typeof JOB_STAGES)[number];

/** What each stage does, for display. */
export const STAGE_LABELS: { readonly [stage in JobStage]: string } = {
  starting: 'Starting the simulation',
  scene: 'Measuring every surface of the machine and the load',
  hydraulics: 'Working out the pump and the spray arms',
  exposure: 'Tracing the jets, the splashing and the run-off',
  soil: 'Laying the soil on the items',
  replay: 'Running the programme against the soil',
  result: 'Inspecting every item',
};

/** Seconds per stage. */
export type StageSeconds = { readonly [stage in JobStage]: number };

/**
 * Built-in stage durations, seconds, as `base + perItem * items`: what an empty machine costs
 * (its baskets and walls are most of the surface) and what each loaded item adds. Fitted to
 * washes of 7, 37 and 74 items measured with `scripts/measure.ts` on the reference machine
 * (M3 Pro, 2026-10-10, with other work running on it; the table is in docs/design/platform.md
 * section 7.3). They are a starting point only: the history of the machine the server runs on
 * replaces them after its first wash, and the simulation was still being changed when they
 * were taken.
 */
export const STAGE_MODEL: {
  readonly [tier in WashTier]: {
    readonly [stage in JobStage]: { readonly base: number; readonly perItem: number };
  };
} = {
  fast: {
    starting: { base: 0.4, perItem: 0 },
    scene: { base: 2, perItem: 0.065 },
    hydraulics: { base: 0.05, perItem: 0 },
    exposure: { base: 7.5, perItem: 0.18 },
    soil: { base: 0.06, perItem: 0.006 },
    replay: { base: 0.25, perItem: 0.012 },
    result: { base: 0.03, perItem: 0.006 },
  },
  official: {
    starting: { base: 0.4, perItem: 0 },
    scene: { base: 5, perItem: 0.105 },
    hydraulics: { base: 0.05, perItem: 0 },
    exposure: { base: 67, perItem: 1.5 },
    soil: { base: 0.5, perItem: 0.04 },
    replay: { base: 1, perItem: 0.05 },
    result: { base: 0.3, perItem: 0.017 },
  },
};

/** The built-in estimate of the stage durations of a wash of `items` items at a tier. */
export function defaultStageSeconds(tier: WashTier, items: number): StageSeconds {
  const model = STAGE_MODEL[tier];
  const of = (stage: JobStage): number => model[stage].base + model[stage].perItem * items;
  return {
    starting: of('starting'),
    scene: of('scene'),
    hydraulics: of('hydraulics'),
    exposure: of('exposure'),
    soil: of('soil'),
    replay: of('replay'),
    result: of('result'),
  };
}

/** The timings of one finished wash, as kept for later estimates. */
export interface TimingRecord {
  readonly tier: WashTier;
  /** Loaded items. */
  readonly items: number;
  /** Wall-clock seconds per stage. */
  readonly stage_s: { readonly [stage: string]: number };
  /** Exposure sets computed (0 when every one came from the cache). */
  readonly exposure_computed: number;
}

/** The timings of earlier washes on this machine, newest last. */
export interface TimingHistory {
  readonly version: 1;
  readonly records: readonly TimingRecord[];
}

/** Records kept in a history. */
export const HISTORY_RECORDS = 40;
/** Records of the same tier an estimate looks at, newest first. */
const HISTORY_WINDOW = 8;
/** A stage shorter than this says nothing reliable about the speed of the machine, seconds. */
const MEANINGFUL_STAGE_S = 0.5;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * The estimate of the stage durations of a wash from the history of this machine: per stage,
 * the built-in figure times the median ratio of what earlier washes at the same tier took to
 * what the built-in figure said they would. A stage without usable records keeps the built-in
 * figure. `basis` says whether any stage was corrected.
 */
export function estimateStageSeconds(
  tier: WashTier,
  items: number,
  history: TimingHistory | null,
): { readonly seconds: StageSeconds; readonly basis: 'history' | 'built-in' } {
  const builtIn = defaultStageSeconds(tier, items);
  const records = (history?.records ?? [])
    .filter((record) => record.tier === tier)
    .slice(-HISTORY_WINDOW);
  if (records.length === 0) return { seconds: builtIn, basis: 'built-in' };
  let corrected = false;
  const scaled = (stage: JobStage): number => {
    const ratios: number[] = [];
    for (const record of records) {
      // A wash whose exposure came from the cache says nothing about computing it.
      if (stage === 'exposure' && record.exposure_computed === 0) continue;
      const took = record.stage_s[stage];
      const expected = defaultStageSeconds(tier, record.items)[stage];
      if (took === undefined || !Number.isFinite(took) || !(took >= 0) || !(expected > 0)) continue;
      ratios.push(took / expected);
    }
    if (ratios.length === 0) return builtIn[stage];
    corrected = true;
    return builtIn[stage] * median(ratios);
  };
  const seconds: StageSeconds = {
    starting: scaled('starting'),
    scene: scaled('scene'),
    hydraulics: scaled('hydraulics'),
    exposure: scaled('exposure'),
    soil: scaled('soil'),
    replay: scaled('replay'),
    result: scaled('result'),
  };
  return { seconds, basis: corrected ? 'history' : 'built-in' };
}

/**
 * The estimate of the whole wash, seconds: the sum of {@link estimateStageSeconds} over the
 * stages. What a caller shows before a wash starts (the server's choice between the two
 * tiers); this module loads nothing of the simulation and is offered beside the contract
 * (`@spotless/wash-runner/contract`).
 */
export function estimateWashSeconds(
  tier: WashTier,
  items: number,
  history: TimingHistory | null,
): { readonly seconds: number; readonly basis: 'history' | 'built-in' } {
  const estimate = estimateStageSeconds(tier, items, history);
  return {
    seconds: JOB_STAGES.reduce((sum, stage) => sum + estimate.seconds[stage], 0),
    basis: estimate.basis,
  };
}

/** A history with one more record, cut to the newest {@link HISTORY_RECORDS}. */
export function appendTiming(history: TimingHistory | null, record: TimingRecord): TimingHistory {
  return {
    version: 1,
    records: [...(history?.records ?? []), record].slice(-HISTORY_RECORDS),
  };
}

/** A history read from JSON text, or null for anything that is not one. */
export function parseTimingHistory(text: string): TimingHistory | null {
  try {
    const value = JSON.parse(text) as Partial<TimingHistory> | null;
    if (value === null || typeof value !== 'object' || value.version !== 1) return null;
    if (!Array.isArray(value.records)) return null;
    const records = (value.records as unknown[]).filter((record): record is TimingRecord => {
      if (typeof record !== 'object' || record === null) return false;
      const r = record as Partial<TimingRecord>;
      return (
        (r.tier === 'official' || r.tier === 'fast') &&
        typeof r.items === 'number' &&
        typeof r.exposure_computed === 'number' &&
        typeof r.stage_s === 'object' &&
        r.stage_s !== null
      );
    });
    return { version: 1, records };
  } catch {
    return null;
  }
}

function isJobStage(stage: string): stage is JobStage {
  return (JOB_STAGES as readonly string[]).includes(stage);
}

/**
 * Follows one wash through its stages and turns each report of the simulation into a
 * {@link WashProgressDetail}. `clock` gives seconds from a fixed origin; the wash is taken to
 * have begun at `startedAt` on that clock (the start of the process, for a wash that has a
 * process of its own).
 */
export class ProgressTracker {
  private readonly estimate: StageSeconds;
  private readonly clock: () => number;
  private readonly startedAt: number;
  private readonly began = new Map<JobStage, number>();
  private readonly ended = new Map<JobStage, number>();
  private current: JobStage = 'starting';
  private fraction = 0;
  private lastOverall = 0;

  constructor(estimate: StageSeconds, clock: () => number, startedAt: number = clock()) {
    this.estimate = estimate;
    this.clock = clock;
    this.startedAt = startedAt;
    this.began.set('starting', startedAt);
  }

  /** Wall-clock seconds per stage that has ended, so far. */
  stageSeconds(): { [stage: string]: number } {
    const out: { [stage: string]: number } = {};
    for (const stage of JOB_STAGES) {
      const from = this.began.get(stage);
      const to = this.ended.get(stage);
      if (from !== undefined && to !== undefined) out[stage] = Math.max(0, to - from);
    }
    return out;
  }

  /**
   * How much slower (above 1) or faster this wash runs than estimated, from the stages that
   * have ended: the machine may be busy with other work, or the load heavier than its item
   * count says.
   */
  private pace(): number {
    let took = 0;
    let expected = 0;
    for (const stage of JOB_STAGES) {
      const from = this.began.get(stage);
      const to = this.ended.get(stage);
      if (from === undefined || to === undefined) continue;
      if (this.estimate[stage] < MEANINGFUL_STAGE_S) continue;
      took += to - from;
      expected += this.estimate[stage];
    }
    if (!(expected > 0)) return 1;
    return Math.max(0.2, Math.min(10, took / expected));
  }

  /**
   * Records that `stage` has reached `fraction` (0 to 1) and returns what to report. A stage
   * that is not one of {@link JOB_STAGES} is counted under the current stage. Reports that go
   * back to an earlier stage (the simulation revisits its hydraulics after the exposure) are
   * counted under the current one as well.
   */
  report(stage: string, fraction: number, detail?: string): WashProgressDetail {
    const now = this.clock();
    const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
    const at = isJobStage(stage) ? JOB_STAGES.indexOf(stage) : -1;
    const currentAt = JOB_STAGES.indexOf(this.current);
    if (at > currentAt) {
      // Everything before the stage reported has ended now.
      for (let i = currentAt; i < at; i++) {
        const passed = JOB_STAGES[i] as JobStage;
        if (!this.began.has(passed)) this.began.set(passed, now);
        if (!this.ended.has(passed)) this.ended.set(passed, now);
      }
      this.current = JOB_STAGES[at] as JobStage;
      this.began.set(this.current, now);
      this.fraction = f;
    } else if (at === currentAt) {
      this.fraction = Math.max(this.fraction, f);
    }
    const current = this.current;
    const index = JOB_STAGES.indexOf(current);
    const last = index === JOB_STAGES.length - 1;
    if (this.fraction >= 1 && !this.ended.has(current) && !last) this.ended.set(current, now);

    const elapsed = Math.max(0, now - this.startedAt);
    const inStage = Math.max(0, now - (this.began.get(current) ?? now));
    const pace = this.pace();
    // What is left of this stage: the estimate, and from a fair way in, more and more the
    // rate the stage itself has shown.
    const byEstimate = this.estimate[current] * pace * (1 - this.fraction);
    const byRate = this.fraction > 0 ? (inStage * (1 - this.fraction)) / this.fraction : byEstimate;
    let remaining = (1 - this.fraction) * byEstimate + this.fraction * byRate;
    for (let i = index + 1; i < JOB_STAGES.length; i++) {
      remaining += this.estimate[JOB_STAGES[i] as JobStage] * pace;
    }
    const done = last && this.fraction >= 1;
    if (done) {
      remaining = 0;
      this.ended.set(current, now);
    }
    const overall = done ? 1 : Math.min(0.999, elapsed / Math.max(1e-9, elapsed + remaining));
    this.lastOverall = Math.max(this.lastOverall, overall);
    const stageProgress: WashStageProgress = {
      stage: current,
      label: STAGE_LABELS[current] + (detail === undefined || detail === '' ? '' : ` (${detail})`),
      index: index + 1,
      count: JOB_STAGES.length,
      fraction: this.fraction,
      eta_s: Math.round(remaining * 10) / 10,
      elapsed_s: Math.round(elapsed * 10) / 10,
    };
    return { fraction: this.lastOverall, stage: stageProgress };
  }
}
