/**
 * Washes a saved load of `@spotless/loader` with the wash runner and reduces the result to a
 * `ReferenceWash` (`src/reference.ts`): per item the verdict, the verdict on soil alone at both
 * ends of the band of visibility, whether the parameters vouch for it, and what is left of each
 * soil. Shared by `reference-table.ts` and `mistake-study.ts`; each wash runs in a process of
 * its own.
 */

import type { Level } from '@spotless/levels';
import type { StandardLoad } from '@spotless/loader';
import type { WashManifest, WashTier } from '@spotless/session';
import { washCaveatsFor } from '@spotless/wash-runner/contract';
import type { WashParamChoice } from '@spotless/wash-runner/contract';
import type { ReferenceItem, ReferenceWash } from '../src/reference.ts';

/**
 * Lowest IEC score of an item that is clean by the card's rule (at most 4 specks and 4 mm2 of
 * visible soil: the band of score 4 of the standard, docs/research/standards.md section 7).
 */
export const CLEAN_SCORE = 4;

/**
 * The verdict on soil alone at the two ends of the band of visibility. The simulation's band
 * also fails an item that holds water, which the game's verdict does not (the level card:
 * water is reported and does not count), so the two ends are read from their IEC scores, which
 * are of soil alone, and made to bracket the verdict the report gives.
 */
export function soilBand(
  band: { readonly strictScore: number; readonly lenientScore: number },
  clean: boolean,
): { strict_clean: boolean; lenient_clean: boolean; decided: boolean } {
  const strict = band.strictScore >= CLEAN_SCORE && clean;
  const lenient = band.lenientScore >= CLEAN_SCORE || clean;
  return { strict_clean: strict, lenient_clean: lenient, decided: strict === lenient };
}

/** How {@link washSummary} washes. */
export interface WashSummaryOptions {
  readonly tier: WashTier;
  /** Directory of the exposure cache (the water of a load is computed once per tier). */
  readonly cacheDir: string;
  readonly params: WashParamChoice;
  readonly acceptStaleParams: boolean;
  /** The programme; default the one the level is scored on. */
  readonly programme?: string;
  /** Notes put before those of the wash report. */
  readonly notes?: readonly string[];
  /**
   * Seed of the wash's own sampling (droplets, sub-cell soil); default the one the game derives
   * from the level's seed. For studies of how much a score moves with it.
   */
  readonly simSeed?: number;
}

/**
 * Washes a saved load as a load of `level` (the poses are the load's; the soils, the points,
 * the programme and the seed are the level's) and summarises the result.
 */
export async function washSummary(
  load: StandardLoad,
  level: Level,
  options: WashSummaryOptions,
): Promise<ReferenceWash> {
  const items = new Map(level.items.map((item) => [item.id, item]));
  const programme = options.programme ?? level.programmeId;
  const manifest: WashManifest = {
    ...load.wash_manifest,
    level,
    programme_id: programme,
    load: { ...load.wash_manifest.load, programme_id: programme },
    seed: level.seed,
    items: load.wash_manifest.items.map((item) => {
      const now = items.get(item.item_id);
      if (now === undefined) throw new Error(`the level has no ${item.item_id}`);
      return { ...item, soils: now.soils, points: now.points };
    }),
    prechecks: load.wash_manifest.prechecks ?? load.check,
  };
  const { runWash } = await import('@spotless/wash-runner');
  const started = performance.now();
  const outcome = await runWash(manifest, {
    tier: options.tier,
    startedAt: 0,
    exposureCacheDir: options.cacheDir,
    params: options.params,
    ...(options.acceptStaleParams ? { acceptStaleParams: true } : {}),
    ...(options.simSeed === undefined ? {} : { simSeed: options.simSeed }),
    keepResult: true,
  });
  const caveats = washCaveatsFor(manifest.machine_id, programme, options.params);
  const unvouched = new Set(caveats.flatMap((caveat) => caveat.soilClasses));
  // A programme the level is not scored on is uncalibrated: every verdict is provisional.
  const uncalibrated = programme !== level.programmeId;
  const results = new Map((outcome.result?.items ?? []).map((item) => [item.itemId, item]));
  const reported = new Map(outcome.report.items.map((item) => [item.item_id, item]));
  return {
    load: load.name,
    level: level.id,
    policy: load.policy.name,
    tier: options.tier,
    programme,
    sim_version: outcome.report.job.sim_version ?? '',
    result_hash: outcome.report.job.result_hash ?? '',
    load_state: load.final_state_hash,
    offered: level.items.length,
    items: level.items.map((item): ReferenceItem => {
      const report = reported.get(item.id);
      if (report === undefined || !report.loaded) {
        return { item_id: item.id, points: item.points, loaded: false };
      }
      const result = results.get(item.id);
      return {
        item_id: item.id,
        points: item.points,
        loaded: true,
        clean: report.clean,
        score: report.score_iec ?? 0,
        ...(result?.band === undefined ? {} : soilBand(result.band, report.clean)),
        ...(uncalibrated ||
        (result !== undefined && result.soils.some((soil) => unvouched.has(soil.modelClass)))
          ? { provisional: true }
          : {}),
        soils: (result?.soils ?? []).map((soil) => ({
          type: soil.type,
          model_class: soil.modelClass,
          left: soil.initialMass_mg > 0 ? soil.residualMass_mg / soil.initialMass_mg : 0,
        })),
        water_ml: report.retained_water_ml ?? 0,
      };
    }),
    mistakes: load.mistakes,
    notes: [...(options.notes ?? []), ...(outcome.report.job.notes ?? [])],
    seconds: Math.round((performance.now() - started) / 100) / 10,
  };
}
