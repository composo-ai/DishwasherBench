/**
 * Which water side an anchoring was made on.
 *
 * The anchored set is fitted to what the water side gives every deposit, so it is only valid
 * for the water code it was fitted on. That code is identified as the wash itself identifies
 * it (`@spotless/sim-core/node`): the version string of the simulator and the fingerprint of
 * the exposure sources (`exposureFingerprint`: every source file the exposure of a deposit is
 * computed by, beyond what its cache key hashes by content). An anchored set records both
 * (`anchoredOn`), and `readParamLayerFile` takes a set as stale when either differs from the
 * code on disk, so the game, the phenomena suite and every command refuse a set that was
 * fitted on another water side unless they are told to accept it.
 *
 * Beside them the set records a reference: the digest of one wash of the settled careful load
 * with the set (`referenceDigest`). When the sources change without changing what a wash
 * computes (a comment, a new diagnostic), `scripts/revalidate.ts` washes the reference again
 * and, if the digest is the recorded one, stamps the set with the new fingerprint; when the
 * digest differs the set has to be fitted again.
 */

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { SIM_VERSION, type WashResult } from '@spotless/sim-core';
import {
  EXPOSURE_SOURCE_SCOPE,
  machineFingerprint,
  sourceFingerprint,
} from '@spotless/sim-core/node';
import { ANCHORS_DIR } from './scenario.ts';

/** What identifies the water side: the version string and the fingerprint of its sources. */
export interface WaterSide {
  readonly simVersion: string;
  /** `exposureFingerprint()` of the sources on disk, hex. */
  readonly exposureSource: string;
  /** The same with the prefix `sha256:` (how reports of the anchoring print it). */
  readonly sourceHash: string;
  /** Number of files hashed. */
  readonly files: number;
  /** `machineFingerprint()` of the machine data on disk, hex. */
  readonly machineSource: string;
}

let cached: WaterSide | undefined;

/** The water side of the sources as they are on disk now (read once per process). */
export function waterSide(): WaterSide {
  if (cached !== undefined) return cached;
  const fingerprint = sourceFingerprint(EXPOSURE_SOURCE_SCOPE);
  cached = {
    simVersion: SIM_VERSION,
    exposureSource: fingerprint.hash,
    sourceHash: `sha256:${fingerprint.hash}`,
    files: fingerprint.files,
    machineSource: machineFingerprint(),
  };
  return cached;
}

/** The water side read afresh from disk (to find out whether it changed under a running script). */
export function waterSideNow(): WaterSide {
  cached = undefined;
  return waterSide();
}

/** Hex digits of the fingerprint in the short name of a water side. */
const TAG_DIGITS = 12;

/** The first twelve hex digits of the fingerprint: the short name of a water side in reports. */
export function waterTag(side: WaterSide = waterSide()): string {
  return side.exposureSource.slice(0, TAG_DIGITS);
}

/**
 * The exposure cache of the anchoring: `anchors/out/exposure-cache` (git-ignored scratch; 100 MB
 * per load at the official tier). The disk cache keeps the sets of each water side in its own
 * sub-directory (`src-<fingerprint>`), so exposure computed by other water code is never
 * replayed.
 */
export function anchorCacheDir(): string {
  return join(ANCHORS_DIR, 'out', 'exposure-cache');
}

/** What an anchored set records about the wash it can be checked against. */
export interface AnchorReference {
  /** Load of `anchors/loads`, programme id, tier and seeds of the reference wash. */
  readonly load: string;
  readonly programme: string;
  readonly tier: 'official' | 'fast';
  readonly levelSeed: number;
  readonly simSeed: number;
  /** {@link referenceDigest} of its result. */
  readonly digest: string;
}

/** Decimal places of a milligram kept in the digest of a reference wash. */
const DIGEST_DECIMALS = 6;

/**
 * The digest of a wash result for the reference of an anchored set: SHA-256 over every item's
 * id, clean verdict, score, residual soil (mg, to a nanogram) and pooled water (mL, to a
 * nanolitre), in the order of the result. It leaves out everything that names the code or
 * the files that produced the result, so that it changes exactly when what a wash computes
 * changes.
 */
export function referenceDigest(result: WashResult): string {
  const hash = createHash('sha256');
  for (const item of result.items) {
    hash.update(
      `${item.itemId}|${item.clean ? 1 : 0}|${item.score}|${item.residualMass_mg.toFixed(DIGEST_DECIMALS)}|${item.water.pooled_mL.toFixed(DIGEST_DECIMALS)}\n`,
    );
  }
  return hash.digest('hex');
}
