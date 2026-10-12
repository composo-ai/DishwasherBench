/**
 * Makes an anchored set current again after a change of the water sources, or of the registry
 * of parameters, that did not change what a wash computes (a comment, a diagnostic, a
 * refactoring, a new parameter the set switches off), without fitting anything.
 *
 * An anchored set records the water side it was fitted on and the digest of one reference
 * wash with it (`anchoredOn`, written by `fit.ts`; `src/water.ts`). This script washes that
 * reference again on the code on disk. When the digest is the recorded one (every item's
 * verdict, score, residue to a nanogram and pooled water are the same), the set and its
 * layers (`<name>.*.json`) are stamped with the water side on disk. When it differs, nothing
 * is written and the script says by how much: the set has to be fitted again (`fit.ts`).
 *
 * A set is current only when BOTH the water side on disk is the one it records and the
 * hashes of the registry stored in it and in every one of its layers (`registryHash`,
 * `hydroHash`, `soilHash`) are those the registry on disk gives: a change of the soil side
 * (new soil parameters, a changed default) makes the files stale to the wash although no
 * water source moved, and is checked by the same reference wash.
 *
 * The reference wash vouches for the code only. When the MACHINE or the frozen loads changed
 * (the reference load is one of them), the digest differs by construction and says nothing
 * about whether the set still holds: the tables of the anchoring are then washed again and
 * compared (docs/calibration/anchoring-v7.md is such a comparison), and the set is fitted
 * again under a new name. A set that another one has replaced (`supersededBy`, written by
 * `supersede.ts`) is refused.
 *
 *   cd packages/calibration && pnpm exec tsx anchors/scripts/revalidate.ts [<set name>]
 *
 * Takes one fast wash of the careful standard load: about a minute and a half.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWashParams, washInputFromDescription } from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import type { ParamProvenance } from '@spotless/sim-params';
import { ANCHORS_DIR, CURRENT_ANCHORED, stdEu13Description } from '../src/scenario.ts';
import { readOverrides } from '../src/sets.ts';
import { anchorCacheDir, referenceDigest, waterSide, type AnchorReference } from '../src/water.ts';

const name = process.argv.slice(2).filter((a) => a !== '--')[0] ?? CURRENT_ANCHORED;
const file = join(ANCHORS_DIR, `${name}.json`);
const document = JSON.parse(readFileSync(file, 'utf8')) as {
  provenance: ParamProvenance;
  supersededBy?: unknown;
  anchoredOn?: {
    simVersion?: string;
    exposureSource?: string;
    machineSource?: string;
    reference?: AnchorReference;
  };
};
if (document.supersededBy !== undefined) {
  console.error(
    `${name}.json says another set replaced it (${JSON.stringify(document.supersededBy)}): it is not made current again. Wash with the set that replaced it.`,
  );
  process.exit(1);
}
const recorded = document.anchoredOn;
const reference = recorded?.reference;
if (recorded === undefined || reference === undefined) {
  console.error(`${name}.json records no reference wash: fit it again (anchors/scripts/fit.ts).`);
  process.exit(1);
}
const water = waterSide();
const sameWater =
  recorded.simVersion === water.simVersion &&
  recorded.exposureSource === water.exposureSource &&
  recorded.machineSource === water.machineSource;
// The hashes of the registry each file of the set stores against those the registry on disk
// gives for the same values: the soil side changes them without touching a water source.
const HASHES = ['registryHash', 'hydroHash', 'soilHash'] as const;
const staleHashes: string[] = [];
for (const entry of readdirSync(ANCHORS_DIR).sort()) {
  if (entry !== `${name}.json` && !(entry.startsWith(`${name}.`) && entry.endsWith('.json'))) {
    continue;
  }
  const path = join(ANCHORS_DIR, entry);
  const stored = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown> & {
    provenance: ParamProvenance;
  };
  const now = createWashParams(
    readOverrides(path, true),
    stored.provenance,
  ).toJSON() as unknown as Record<string, unknown>;
  for (const key of HASHES) {
    if (stored[key] !== now[key]) {
      staleHashes.push(
        `${entry} ${key} ${String(stored[key]).slice(0, 19)} is now ${String(now[key]).slice(0, 19)}`,
      );
    }
  }
}
if (sameWater && staleHashes.length === 0) {
  console.log(
    `${name}.json is current: ${water.simVersion}, sources ${water.exposureSource.slice(0, 12)}, and the registry's hashes are those stored.`,
  );
  process.exit(0);
}
if (staleHashes.length > 0) {
  console.log(
    `${name}.json is not current as stored: the registry of parameters has changed (${staleHashes.join('; ')}). Washing the reference of the set again to see whether what a wash computes has changed.`,
  );
}
// The values of the set under the definitions on disk (a registry that changed beside it, a
// new parameter elsewhere, is the other thing the reference wash vouches for).
const overrides = readOverrides(file, true);
const result = await washWithSource(
  washInputFromDescription(
    stdEu13Description({
      load: reference.load,
      programme: reference.programme,
      tier: reference.tier,
      levelSeed: reference.levelSeed,
      simSeed: reference.simSeed,
      params: overrides,
    }),
  ),
  { cache: createDiskExposureCache(anchorCacheDir()) },
);
const digest = referenceDigest(result);
if (digest !== reference.digest) {
  console.error(
    `${name}.json is NOT current (${sameWater ? 'the water side is the one recorded, the registry of parameters is not' : 'the water side has changed'}): the reference wash (${reference.load}, ${reference.programme}, ${reference.tier}) gives digest ${digest.slice(0, 12)} on ${water.simVersion}, sources ${water.exposureSource.slice(0, 12)}; the set recorded ${reference.digest.slice(0, 12)} on ${String(recorded.simVersion)}, sources ${String(recorded.exposureSource).slice(0, 12)}. ` +
      `${result.items.filter((item) => item.clean).length} of ${result.items.length} items clean now. What a wash computes has changed: fit the set again (anchors/scripts/fit.ts, then make-owner-set.ts).`,
  );
  process.exit(1);
}
const stamped: string[] = [];
for (const entry of readdirSync(ANCHORS_DIR).sort()) {
  if (!entry.startsWith(`${name}.`) || !entry.endsWith('.json')) continue;
  const path = join(ANCHORS_DIR, entry);
  const layer = JSON.parse(readFileSync(path, 'utf8')) as {
    provenance: ParamProvenance;
    anchoredOn?: Record<string, unknown>;
  };
  // Written again against the registry on disk, with the water side on disk.
  const written = {
    ...createWashParams(readOverrides(path, true), layer.provenance).toJSON(),
    anchoredOn: {
      ...(layer.anchoredOn ?? {}),
      simVersion: water.simVersion,
      exposureSource: water.exposureSource,
      machineSource: water.machineSource,
      files: water.files,
    },
  };
  writeFileSync(path, `${JSON.stringify(written, null, 1)}\n`);
  stamped.push(entry);
}
console.log(
  `the reference wash gives the recorded digest (${digest.slice(0, 12)}): stamped ${stamped.join(', ')} with ${water.simVersion}, sources ${water.exposureSource.slice(0, 12)}.`,
);
process.exit(0);
