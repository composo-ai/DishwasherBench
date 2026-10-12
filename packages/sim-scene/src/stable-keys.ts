/**
 * Stable keys for the blocks of a scene: a u32 per block that depends on the instance the
 * block belongs to (by its id) and on the block's place among that instance's blocks, and on
 * nothing else of the scene.
 *
 * The counters of the exposure stages are keyed by these (a droplet source by the block its
 * jet strikes, a drip site by its block, a probe ray by the block it leaves), so that an edit
 * elsewhere in the machine (an item added, removed or turned) leaves the random numbers of an
 * untouched item as they were: its exposure changes only where the water that reaches it
 * really changes. Block indices cannot serve for that: adding an item shifts the blocks of
 * every item after it.
 *
 * The blocks of an item are laid out in its own frame from its shape and the block size, so
 * the place of a block among them does not depend on the pose or on anything else in the
 * machine.
 */

import { hashU32 } from '@spotless/core';
import type { WashScene } from './scene-types.ts';

/** Domain of the block keys (so that they are not the plain hash of two small integers). */
const BLOCK_KEY_DOMAIN = 0x626c6b79;

/** FNV-1a offset basis and prime, 32 bits. */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** A u32 from an id string (FNV-1a over its UTF-16 code units): the same on every run. */
export function stableIdKey(id: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

const known = new WeakMap<WashScene, Uint32Array>();

/**
 * One stable u32 per block of the scene (see the file comment), computed once per scene:
 * the hash of the id of the block's instance and of its index among that instance's blocks.
 */
export function sceneBlockKeys(scene: WashScene): Uint32Array {
  let keys = known.get(scene);
  if (keys !== undefined) return keys;
  keys = new Uint32Array(scene.blocks.count);
  for (const instance of scene.instances) {
    const idKey = stableIdKey(instance.id);
    for (let k = 0; k < instance.blockCount; k++) {
      keys[instance.firstBlock + k] = hashU32(BLOCK_KEY_DOMAIN, idKey, k);
    }
  }
  known.set(scene, keys);
  return keys;
}
