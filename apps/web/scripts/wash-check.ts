/**
 * The wash of a manifest repeated outside the server, for checking what the page paints
 * against what the simulation computed: the same runner, the same tier, the exposure taken
 * from the server's cache on disk, and the simulation's own per-cell arrays kept.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TILE_LIFT } from '@spotless/render';
import type { WashManifest, WashTier } from '@spotless/session';
import { runWash as runSimulatedWash } from '@spotless/wash-runner';

/** How far a tile stands off the surface, metres: the page draws its tiles this far out. */
export const TILE_LIFT_CHECK = TILE_LIFT;

/** The cells of one item as the simulation returned them, in the item frame. */
export interface SimulatedCells {
  readonly count: number;
  readonly centre: Float32Array;
  readonly normal: Float32Array;
  readonly visible: Uint8Array;
}

/** The newest directory of the server's exposure cache, or undefined when it has none. */
function exposureDir(root: string): string | undefined {
  if (!existsSync(root)) return undefined;
  return readdirSync(root)
    .map((name) => join(root, name))
    .filter((path) => statSync(path).isDirectory())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

/**
 * Washes a manifest in this process and returns the hash of the simulation's result with the
 * per-cell arrays of every item.
 */
export async function runWash(
  manifest: WashManifest,
  tier: WashTier,
  exposureCacheRoot: string,
): Promise<{ resultHash: string; items: Map<string, SimulatedCells> }> {
  const cache = exposureDir(exposureCacheRoot);
  const outcome = await runSimulatedWash(manifest, {
    tier,
    keepResult: true,
    ...(cache === undefined ? {} : { exposureCacheDir: cache }),
  });
  const result = outcome.result;
  if (result === undefined) throw new Error('the wash returned no simulation result');
  const items = new Map<string, SimulatedCells>();
  for (const item of result.items) {
    if (item.cells === undefined) continue;
    items.set(item.itemId, {
      count: item.cells.count,
      centre: item.cells.centre,
      normal: item.cells.normal,
      visible: item.cells.visible,
    });
  }
  return { resultHash: result.provenance.resultHash, items };
}
