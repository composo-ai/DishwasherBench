/**
 * The wash runner: the session's hook for the wash, backed by the wash simulation.
 *
 *   manifest  ->  simulation input  ->  wash() at a tier  ->  report + residue maps
 *
 * `runWash` does the whole of it and returns everything; `simWashRunner` is the same as the
 * `WashRunner` the session and the server's wash worker call (`WASH_RUNNER` of the server
 * names it). A wash that cannot be run to a report rejects: the caller reports a failed job,
 * never a score.
 *
 * Tier: the rules of the level decide when they say (`rules.washTier`), else the caller
 * (`WashRunContext.tier`: the server asks for `official` unless it was started otherwise),
 * else `official`. The fast tier is a preview: its verdicts differ from the official ones on
 * a few items of a full load; a report says which tier made it (`job.fidelity`).
 *
 * An empty machine is not simulated: with nothing loaded there is nothing to judge, and the
 * report says so at once.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { compareIds } from '@spotless/core';
import type { ResidueMap, WashManifest, WashReport, WashTier } from '@spotless/session';
import type {
  ContextWashRunner,
  WashProgressDetail,
  WashRunContext,
  WashRunStats,
} from './contract.ts';
import { washCaveatsFor, washTierNoteFor } from './defaults.ts';
import { poseDisagreement, washInputOf, WashManifestError, withWashParams } from './input.ts';
import type { TimingHistory } from './progress.ts';
import {
  appendTiming,
  estimateStageSeconds,
  parseTimingHistory,
  ProgressTracker,
} from './progress.ts';
import { washReportOf } from './report.ts';
import type { WashInput, WashResult } from './sim.ts';
import {
  acquireWashDevice,
  cleanRule,
  createDiskExposureCache,
  loadedExposureSource,
  SIM_VERSION,
  simulationFingerprint,
  wash,
} from './sim.ts';

/** Options of {@link runWash}: the context of a runner and what scripts and tests add. */
export interface RunWashOptions extends WashRunContext {
  /** Seed of the wash's own sampling; default derived from the level's seed. */
  readonly simSeed?: number;
  /** Seconds from a fixed origin, for timings and estimates; default the process clock. */
  readonly clock?: () => number;
  /** True to return the simulation's own input and result as well (scripts and tests). */
  readonly keepResult?: boolean;
}

/** Everything a wash produced. */
export interface WashOutcome {
  readonly report: WashReport;
  /** The residue maps of the washed items, sorted by item id. */
  readonly residue: readonly ResidueMap[];
  readonly stats: WashRunStats;
  /** What the simulation could not simulate as asked, in its own words (for a log). */
  readonly problems: readonly string[];
  /** With `keepResult`: what the simulation was given and what it returned. */
  readonly input?: WashInput;
  readonly result?: WashResult;
}

/** The tier a manifest is washed at: the level's rule, else `requested`, else `official`. */
export function tierOf(manifest: WashManifest, requested?: WashTier): WashTier {
  const rule = (manifest.level.rules as { readonly washTier?: unknown }).washTier;
  if (rule === 'official' || rule === 'fast') return rule;
  return requested ?? 'official';
}

function readHistory(file: string | undefined): TimingHistory | null {
  if (file === undefined) return null;
  try {
    return parseTimingHistory(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeHistory(file: string, history: TimingHistory): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(history)}\n`);
    renameSync(temporary, file);
  } catch {
    // The history only serves estimates: a wash does not fail because it could not be kept.
  }
}

function megabytes(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

/** Largest resident set of this process so far, megabytes. */
function peakRssMb(): number {
  // `maxRSS` is in kilobytes on every platform Node runs on.
  return Math.round((process.resourceUsage().maxRSS / 1024) * 10) / 10;
}

/** The report of a wash with nothing in the machine. */
function emptyReport(manifest: WashManifest, tier: WashTier): WashReport {
  return {
    benchmark_version: manifest.load.benchmark_version,
    level_id: manifest.load.level_id,
    state_hash: manifest.load.state_hash,
    job: {
      status: 'done',
      runtime_s: 0,
      fidelity: tier,
      sim_version: SIM_VERSION,
      notes: ['Nothing was in the machine: there was nothing to wash and nothing was simulated.'],
    },
    score: {
      points: 0,
      points_available: manifest.level.items.reduce((sum, item) => sum + item.points, 0),
      graded_points: 0,
      points_loaded: 0,
    },
    items: [...manifest.level.items]
      .map((item) => item.id)
      .sort(compareIds)
      .map((id) => ({ item_id: id, loaded: false as const })),
  };
}

/**
 * Washes the load of a manifest and returns the report, the residue maps and the statistics of
 * the run. Rejects with the cause when the wash cannot be run to a report.
 */
export async function runWash(
  manifest: WashManifest,
  options: RunWashOptions = {},
): Promise<WashOutcome> {
  const clock = options.clock ?? ((): number => performance.now() / 1000);
  const startedAt = options.startedAt ?? clock();
  const tier = tierOf(manifest, options.tier);
  const items = manifest.items.length;
  const history = readHistory(options.timingsFile);
  const tracker = new ProgressTracker(
    estimateStageSeconds(tier, items, history).seconds,
    clock,
    startedAt,
  );
  const emit = (detail: WashProgressDetail): void => {
    options.onDetail?.(detail);
  };
  const baseStats = {
    tier,
    items,
    blocks: 0,
    soil_cells: 0,
    exposure_cached: 0,
    exposure_computed: 0,
    backend: 'none',
    gpu_buffers_mb: null,
  };
  emit(tracker.report('starting', 0));

  if (items === 0) {
    emit(tracker.report('result', 1));
    return {
      report: emptyReport(manifest, tier),
      residue: [],
      problems: [],
      stats: {
        ...baseStats,
        stage_s: tracker.stageSeconds(),
        total_s: clock() - startedAt,
        peak_rss_mb: peakRssMb(),
      },
    };
  }

  const plain = washInputOf(manifest, {
    tier,
    ...(options.simSeed === undefined ? {} : { simSeed: options.simSeed }),
  });
  // The hand-over of poses is checked on every wash against the load the player was shown: a
  // convention that slipped would otherwise wash another load and score it.
  const off = poseDisagreement(manifest, plain);
  if (off.length > 0) {
    const first = off[0] as (typeof off)[number];
    throw new WashManifestError(
      `the poses of the wash do not match the load manifest: ${first.item_id} is ` +
        `${first.position_mm.toFixed(2)} mm and ${first.angle_deg.toFixed(2)} degrees off` +
        (off.length > 1 ? ` (and ${off.length - 1} more)` : ''),
    );
  }

  // The parameters and the detergent of the wash. A stale parameter-set file ends the wash
  // here, with what to do about it.
  const input = withWashParams(plain, options.params, options.acceptStaleParams === true);

  const device = await acquireWashDevice();
  // A wash that is no longer wanted loses its device: the simulation fails at its next use of
  // it, and the failure below says why.
  const onAbort = (): void => {
    void device.release();
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });
  if (options.signal?.aborted === true) onAbort();
  let result: WashResult;
  // The spray states the exposure stage has named so far, for "pattern 2 of 4".
  const patterns: string[] = [];
  let patternCount = 0;
  try {
    result = await wash(input, {
      ...device.washOptions,
      // With or without a cache the exposure keys name the sources that compute the sets: a
      // wash gives one result hash whether or not it was given somewhere to keep them.
      ...(options.exposureCacheDir === undefined
        ? { exposureSource: loadedExposureSource() }
        : { cache: createDiskExposureCache(options.exposureCacheDir) }),
      cells: true,
      sourceFingerprint: simulationFingerprint(),
      // One wash per process: nothing would reuse the scene, and it is most of a gigabyte.
      keepScene: false,
      onProgress: (progress) => {
        // Every report of the simulation is a point at which a wash nobody wants can end.
        if (options.signal?.aborted === true) throw new Error('the wash was stopped');
        let detail: string | undefined;
        if (progress.stage === 'exposure' && progress.detail !== undefined) {
          if (!patterns.includes(progress.detail)) patterns.push(progress.detail);
          if (patterns.length === 2 && progress.fraction > 0) {
            patternCount = Math.round(1 / progress.fraction);
          }
          detail =
            `spray pattern ${patterns.length}` + (patternCount > 0 ? ` of ${patternCount}` : '');
        }
        emit(tracker.report(progress.stage, progress.fraction, detail));
      },
    });
  } catch (error) {
    if (options.signal?.aborted === true) throw new Error('the wash was stopped', { cause: error });
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    await device.release();
  }
  if (options.signal?.aborted === true) throw new Error('the wash was stopped');

  const stageS: { [stage: string]: number } = { ...tracker.stageSeconds() };
  // The simulation's own timings are the better ones for its stages: it laps its clock where
  // the work ends, not where the next report happens to come.
  for (const [stage, ms] of Object.entries(result.run.timings_ms)) stageS[stage] = ms / 1000;
  const bundle = washReportOf(manifest, result, {
    tier,
    runtimeS: Math.round((clock() - startedAt) * 10) / 10,
    rule: cleanRule(input.params),
    simVersion: result.provenance.simVersion,
    caveats: washCaveatsFor(manifest.machine_id, manifest.programme_id, options.params),
    tierNote: washTierNoteFor(manifest.machine_id, manifest.programme_id, tier, options.params),
  });
  emit(tracker.report('result', 1));
  const peakBytes = device.peakBytes();
  const stats: WashRunStats = {
    ...baseStats,
    stage_s: stageS,
    total_s: Math.round((clock() - startedAt) * 100) / 100,
    blocks: result.run.blocks,
    soil_cells: result.run.soilCells,
    exposure_cached: result.run.exposureCacheHits,
    exposure_computed: result.run.exposureComputed,
    backend: result.provenance.exposureBackend,
    peak_rss_mb: peakRssMb(),
    gpu_buffers_mb: peakBytes === null ? null : megabytes(peakBytes),
    param_sets: result.provenance.paramSets.map((set) => ({ name: set.name, stale: set.stale })),
    detergent: result.provenance.detergent,
    source: result.provenance.sourceFingerprint,
  };
  if (options.timingsFile !== undefined) {
    writeHistory(
      options.timingsFile,
      appendTiming(readHistory(options.timingsFile), {
        tier,
        items,
        stage_s: stageS,
        exposure_computed: stats.exposure_computed,
      }),
    );
  }
  return {
    report: bundle.report,
    residue: bundle.residue,
    problems: bundle.problems,
    stats,
    ...(options.keepResult === true ? { input, result } : {}),
  };
}

/**
 * The wash simulation as the session's `WashRunner`. Called with a {@link WashRunContext} as
 * third argument (as the server's wash worker does) it also reports progress by stage and
 * hands over the residue maps and the statistics of the run; called without, it washes at the
 * tier the level's rules name, or `official`, with no cache.
 */
export const simWashRunner: ContextWashRunner = async (manifest, onProgress, context) => {
  const outcome = await runWash(manifest, {
    ...context,
    onDetail: (detail) => {
      onProgress(detail.fraction);
      context?.onDetail?.(detail);
    },
  });
  context?.onResidue?.(outcome.residue);
  context?.onStats?.(outcome.stats);
  if (outcome.problems.length > 0) context?.onProblems?.(outcome.problems);
  onProgress(1);
  return outcome.report;
};
