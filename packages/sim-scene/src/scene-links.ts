/**
 * The links of the scene that leave the surface of one body: where water falls to, and where
 * two bodies touch or nearly touch (docs/design/sim-core.md sections 3.6 and 3.7, items 4, 6
 * and 7, in the first-build form of the scene brief).
 *
 * **Drip sites.** A block is terminal when no neighbour in the cell graph (stitches and seams
 * included) is lower than it by more than `scene.dripLevelTolerance`. A terminal block that
 * faces up (vertical component of its normal above `scene.pitMinNormalZ`) holds water: a pit.
 * Every other terminal block, and every terminal line element, is a drip site: lower edges,
 * rims, the low points of wires, downward-facing ends. Its drop is followed by a ray straight
 * down from just off the surface; it lands on a block or on the tub floor.
 *
 * **Contacts.** For every block of a wash item and every other instance near it, the signed
 * distance of the geometry kernel gives the gap and the nearest point of the other body; a gap
 * below `scene.contactGap` is recorded as a link to the block at that point. Surfaces that face
 * away from the other body are not linked (a wall between them is not a gap).
 *
 * Simplifications: rotating parts (spray arms) stand at their reference angle for drip targets
 * and take no part in contacts; a drip is one vertical ray from the block centre (no spread, no
 * sideways throw from a moving film); a contact link is found from the item's side only, one
 * per block and neighbour, with no test that the straight line between the two points is free.
 *
 * Units: SI. Frame: tub frame.
 */

import { sampleSignedDistance, signedDistance } from '@spotless/geometry';
import { affinePoint, affineVector } from './affine.ts';
import { locateOnPart } from './locate.ts';
import type { InstanceBuild, SceneBuild } from './scene-internal.ts';
import {
  BLOCK_FLAG,
  DRIP_TO_FLOOR,
  SCENE_NONE,
  type SceneContacts,
  type SceneDrips,
} from './scene-types.ts';
import { createTraceHit } from './trace-cpu.ts';

/** Classifies terminal blocks and follows the drops of the drip sites. Sets the block flags. */
export function findDrips(scene: SceneBuild): SceneDrips {
  const { blocks, graph, centre, normal, params, rays } = scene;
  const n = blocks.count;
  const tolerance = params.dripLevelTolerance;
  const sites: number[] = [];
  const targets: number[] = [];
  const falls: number[] = [];
  const hit = createTraceHit();
  const reach = Math.max(1, scene.box.max[2] - scene.box.min[2]) + 1;
  for (let b = 0; b < n; b++) {
    const z = centre[3 * b + 2] as number;
    let terminal = true;
    for (let k = graph.offsets[b] as number; k < (graph.offsets[b + 1] as number); k++) {
      if ((centre[3 * (graph.neighbour[k] as number) + 2] as number) < z - tolerance) {
        terminal = false;
        break;
      }
    }
    if (!terminal) continue;
    const line = ((blocks.flags[b] as number) & BLOCK_FLAG.line) !== 0;
    const nz = normal[3 * b + 2] as number;
    if (!line && nz > params.pitMinNormalZ) {
      blocks.flags[b] = (blocks.flags[b] as number) | BLOCK_FLAG.pit;
      continue;
    }
    // Start just off the surface: below a wire, along the normal of a face.
    let sx = centre[3 * b] as number;
    let sy = centre[3 * b + 1] as number;
    let sz = z;
    if (line) {
      const patch = scene.patches[blocks.patch[b] as number] as (typeof scene.patches)[number];
      const instance = scene.instances[blocks.instance[b] as number] as InstanceBuild;
      const atlasPatch = instance.atlas.patches[patch.index - instance.instance.firstPatch] as {
        length: number;
        rowCount: number;
      };
      const half = (0.5 * atlasPatch.length) / atlasPatch.rowCount;
      sz -= half * Math.abs(patch.axis[2]) + patch.radius + params.dripStartOffset;
    } else {
      sx += params.dripStartOffset * (normal[3 * b] as number);
      sy += params.dripStartOffset * (normal[3 * b + 1] as number);
      sz += params.dripStartOffset * nz;
    }
    const struck = rays.trace(sx, sy, sz, 0, 0, -1, reach, b, 0, hit);
    if (struck && hit.block === b) {
      // The drop lands where it started: the water stays.
      blocks.flags[b] = (blocks.flags[b] as number) | BLOCK_FLAG.pit;
      continue;
    }
    blocks.flags[b] = (blocks.flags[b] as number) | BLOCK_FLAG.dripSite;
    sites.push(b);
    targets.push(struck && hit.block !== SCENE_NONE ? hit.block : DRIP_TO_FLOOR);
    falls.push(struck ? hit.t : sz - scene.box.min[2]);
  }
  const ofBlock = new Uint32Array(n).fill(SCENE_NONE);
  sites.forEach((b, k) => {
    ofBlock[b] = k;
  });
  return {
    count: sites.length,
    block: Uint32Array.from(sites),
    target: Uint32Array.from(targets),
    fall: Float32Array.from(falls),
    ofBlock,
  };
}

/** Finds the contacts and near-contacts of the wash items with the other instances. */
export function findContacts(scene: SceneBuild): SceneContacts {
  const { blocks, centre, normal, params, instances } = scene;
  const gapMax = params.contactGap;
  const blockA: number[] = [];
  const blockB: number[] = [];
  const gaps: number[] = [];
  for (const a of instances) {
    if (a.instance.kind !== 'item') continue;
    const first = a.instance.firstBlock;
    const boxA = a.instance.box;
    // The other instances whose boxes come within the gap of this one.
    const others = instances.filter((b) => {
      if (b === a || b.instance.rotating || b.instance.blockCount === 0) return false;
      const boxB = b.instance.box;
      for (let i = 0; i < 3; i++) {
        if (
          (boxA.min[i] as number) > (boxB.max[i] as number) + gapMax ||
          (boxA.max[i] as number) < (boxB.min[i] as number) - gapMax
        ) {
          return false;
        }
      }
      return true;
    });
    if (others.length === 0) continue;
    for (let k = 0; k < a.instance.blockCount; k++) {
      const block = first + k;
      const cx = centre[3 * block] as number;
      const cy = centre[3 * block + 1] as number;
      const cz = centre[3 * block + 2] as number;
      const line = ((blocks.flags[block] as number) & BLOCK_FLAG.line) !== 0;
      const own = line
        ? (scene.patches[blocks.patch[block] as number] as { radius: number }).radius
        : 0;
      const reach = gapMax + own;
      for (const b of others) {
        const boxB = b.instance.box;
        if (
          cx < boxB.min[0] - reach ||
          cx > boxB.max[0] + reach ||
          cy < boxB.min[1] - reach ||
          cy > boxB.max[1] + reach ||
          cz < boxB.min[2] - reach ||
          cz > boxB.max[2] + reach
        ) {
          continue;
        }
        const local = affinePoint(b.toItem, cx, cy, cz);
        if (signedDistance(b.instance.shape, local) - own >= gapMax) continue;
        const sample = sampleSignedDistance(b.instance.shape, local);
        const gradient = affineVector(
          b.toTub,
          sample.gradient[0],
          sample.gradient[1],
          sample.gradient[2],
        );
        if (!line) {
          // The other body must lie in front of the face, not behind it.
          const facing = -(
            gradient[0] * (normal[3 * block] as number) +
            gradient[1] * (normal[3 * block + 1] as number) +
            gradient[2] * (normal[3 * block + 2] as number)
          );
          if (!(facing > 0)) continue;
        }
        const foot = [
          local[0] - sample.distance * sample.gradient[0],
          local[1] - sample.distance * sample.gradient[1],
          local[2] - sample.distance * sample.gradient[2],
        ];
        const where = locateOnPart(b.atlas, sample.part, foot, sample.gradient);
        if (where === null || where.block === SCENE_NONE) continue;
        const other = b.blockOf[where.block] as number;
        if (other === SCENE_NONE) continue;
        blockA.push(block);
        blockB.push(other);
        gaps.push(Math.max(0, sample.distance - own));
      }
    }
  }
  return {
    count: blockA.length,
    blockA: Uint32Array.from(blockA),
    blockB: Uint32Array.from(blockB),
    gap: Float32Array.from(gaps),
  };
}
