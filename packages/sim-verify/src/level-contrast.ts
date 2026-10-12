/**
 * The report of `scripts/level-contrast.ts`: the points of careful and of careless loading on
 * every starter level, with what identifies the washes it was made from.
 */

/** One policy on one level. */
export interface LevelContrastSide {
  /** Points of the items that came out clean, and at the two ends of the band of visibility. */
  readonly points: number;
  readonly pointsStrict: number;
  readonly pointsLenient: number;
  /** Points of every item the level offers. */
  readonly offered: number;
  /** Items the policy placed, and items of the level. */
  readonly placed: number;
  readonly items: number;
  /** Washed items that are not clean, and washed items at the edge of clean. */
  readonly dirty: readonly string[];
  readonly edge: readonly string[];
  /** Mistakes the policy made on purpose. */
  readonly mistakes: number;
  /** `final_state_hash` of the load that was washed. */
  readonly loadState: string;
  readonly programme: string;
}

/** A level with both policies. */
export interface LevelContrastRow {
  readonly level: string;
  readonly careful: LevelContrastSide;
  readonly careless: LevelContrastSide;
}

/** The report. */
export interface LevelContrastReport {
  readonly suite: 'spotless-level-contrast';
  readonly simVersion: string;
  readonly tier: string;
  /** Fingerprints of the exposure sources and of the whole simulation the washes ran on. */
  readonly exposureSource: string;
  readonly sourceFingerprint: string;
  /** Names of the parameter sets, and a hash of their names and overrides. */
  readonly paramSets: readonly string[];
  readonly paramSetsHash: string;
  readonly detergent: { readonly name: string; readonly dose_g: number };
  readonly rows: readonly LevelContrastRow[];
}
