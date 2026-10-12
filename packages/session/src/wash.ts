/**
 * The hand-over from loading to washing: the load manifest the wash simulation is run on, the
 * wash runner the session is given, and a placeholder runner for exercising the game loop
 * before the simulation is wired in.
 */

import type { Pose } from '@spotless/core';
import { compareIds } from '@spotless/core';
import type { Level, LevelSoil } from '@spotless/levels';
import type { MachineConfig } from '@spotless/machine';
import type { LoadCheck, LoadManifest, WashReport, WashReportItem } from './types.ts';

/** One loaded item as the wash simulation needs it. */
export interface WashManifestItem {
  readonly item_id: string;
  /** Catalogue item type id. */
  readonly item_type: string;
  /**
   * Settled pose of the item frame in the tub frame after the baskets were pushed in: SI,
   * `Pose` of `@spotless/core` (`p` metres, `q` as `[x, y, z, w]`), exact as the loading
   * physics left it.
   */
  readonly pose: Pose;
  /** The soils on it, as the level states them. */
  readonly soils: readonly LevelSoil[];
  /** Points scored if it comes out clean. */
  readonly points: number;
}

/**
 * Everything a wash is a function of: the machine and how it is set, the programme, every
 * loaded item with its pose and soils, and the seed. It is handed to the wash runner and never
 * to the player (it contains the seed).
 */
export interface WashManifest {
  /** The player-visible manifest of the same load (rounded poses, no seed). */
  readonly load: LoadManifest;
  readonly level: Level;
  readonly machine_id: string;
  /** The machine configuration the load was frozen in. */
  readonly machine_config: MachineConfig;
  readonly programme_id: string;
  /** Loaded items, sorted by `item_id`. */
  readonly items: readonly WashManifestItem[];
  /** Ids of the items left on the counter, sorted. */
  readonly unloaded: readonly string[];
  /** Seed of everything random in the wash. */
  readonly seed: number;
  /**
   * What `start_cycle` found mechanically as it pushed the baskets in and closed the door on
   * this load: a spray arm the load holds still (and at which angle), a dispenser lid that
   * cannot open, a tablet that cannot fall. The wash takes these as boundary conditions.
   * Absent in a manifest written before the field existed: nothing is then taken as blocked.
   */
  readonly prechecks?: LoadCheck;
}

/**
 * Runs a wash: takes the manifest and a callback for progress (a fraction from 0 to 1) and
 * resolves with the report. A rejection is an infrastructure failure: the job is reported as
 * failed, never as a score.
 */
export type WashRunner = (
  manifest: WashManifest,
  onProgress: (fraction: number) => void,
) => Promise<WashReport>;

/** `job.fidelity` of a report made by {@link placeholderWashRunner}. */
export const PLACEHOLDER_FIDELITY = 'placeholder_not_simulated';

/**
 * PLACEHOLDER, NOT A SIMULATION. Reports every loaded item as loaded and not simulated
 * (`simulated: false`, not clean, no points) and every other item as not loaded, so that the
 * game loop, the server and the clients can be exercised end to end. Replace it with the wash
 * simulation by passing another `WashRunner` to `createSession`.
 */
export const placeholderWashRunner: WashRunner = (manifest, onProgress) => {
  onProgress(0);
  const loaded = new Set(manifest.items.map((item) => item.item_id));
  const items: WashReportItem[] = [...manifest.level.items]
    .sort((a, b) => compareIds(a.id, b.id))
    .map((item) =>
      loaded.has(item.id)
        ? {
            item_id: item.id,
            loaded: true as const,
            clean: false,
            points_awarded: 0,
            graded_score: 0,
            residual_fraction_area: 0,
            residue_regions: [],
            moved_during_wash: false,
            holds_water: false,
            simulated: false,
          }
        : { item_id: item.id, loaded: false as const },
    );
  onProgress(1);
  return Promise.resolve({
    benchmark_version: manifest.load.benchmark_version,
    level_id: manifest.load.level_id,
    state_hash: manifest.load.state_hash,
    job: { status: 'done' as const, runtime_s: 0, fidelity: PLACEHOLDER_FIDELITY },
    score: {
      points: 0,
      points_available: manifest.level.items.reduce((sum, item) => sum + item.points, 0),
      graded_points: 0,
    },
    items,
  });
};
