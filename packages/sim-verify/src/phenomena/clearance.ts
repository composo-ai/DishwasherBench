/**
 * Whether a pose that was set (not settled by the loading physics) cuts into the machine: the
 * check the suite makes before it washes an exact pose, on the geometry kernel's own shapes.
 *
 * Vertices of the item's mesh are tested against the solid of every part of the baskets and
 * their fittings, and vertices of those parts against the solid of the item (wires are thin,
 * so both ways are needed). The tub, the door and the spray arms are left out: an item in a
 * basket is clear of them, and the wash reports one that is not.
 *
 * Units: SI, tub frame.
 */

import { instantiate } from '@spotless/catalogue';
import {
  poseInverseTransformPoint,
  poseTransformPoint,
  v3Normalise,
  type Pose,
  type Vec3,
} from '@spotless/core';
import {
  boundingBox,
  buildRenderMesh,
  signedDistance,
  type Aabb,
  type Shape,
} from '@spotless/geometry';
import { buildMachineGeometry, PRIMARY_MACHINE, type MachineConfig } from '@spotless/machine';
import type { LoadItem } from './types.ts';

/** Chord error of the meshes whose surfaces are sampled, metres (a rule of the check). */
const MESH_CHORD_ERROR = 0.0001;

interface Solid {
  readonly id: string;
  readonly shape: Shape;
  readonly pose: Pose;
  readonly box: Aabb;
  /** Mesh vertices in the tub frame, 3 per vertex. */
  readonly points: Float32Array;
}

/** Largest distance between neighbouring sample points along an edge of a mesh, metres. */
const SAMPLE_SPACING = 0.003;

/**
 * Sample points of a shape's surface in its own frame: the vertices of its mesh and points
 * along every edge of the mesh no further apart than {@link SAMPLE_SPACING} (the edges of a
 * wire run along its length, those of a plate's face from ring to ring).
 */
function samplePoints(shape: Shape): Float32Array {
  const mesh = buildRenderMesh(shape, { chordError: MESH_CHORD_ERROR });
  const out: number[] = Array.from(mesh.positions);
  const seen = new Set<number>();
  const vertices = mesh.positions.length / 3;
  const edge = (i: number, j: number): void => {
    const key = i < j ? i * vertices + j : j * vertices + i;
    if (seen.has(key)) return;
    seen.add(key);
    const ax = mesh.positions[3 * i] as number;
    const ay = mesh.positions[3 * i + 1] as number;
    const az = mesh.positions[3 * i + 2] as number;
    const bx = mesh.positions[3 * j] as number;
    const by = mesh.positions[3 * j + 1] as number;
    const bz = mesh.positions[3 * j + 2] as number;
    const pieces = Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / SAMPLE_SPACING);
    for (let k = 1; k < pieces; k++) {
      const t = k / pieces;
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
    }
  };
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const i = mesh.indices[t] as number;
    const j = mesh.indices[t + 1] as number;
    const k = mesh.indices[t + 2] as number;
    edge(i, j);
    edge(j, k);
    edge(k, i);
  }
  return Float32Array.from(out);
}

const itemSamples = new Map<string, Float32Array>();

function solidOf(id: string, shape: Shape, pose: Pose, cacheAs?: string): Solid {
  let local = cacheAs === undefined ? undefined : itemSamples.get(cacheAs);
  if (local === undefined) {
    local = samplePoints(shape);
    if (cacheAs !== undefined) itemSamples.set(cacheAs, local);
  }
  const points = new Float32Array(local.length);
  for (let i = 0; i < local.length; i += 3) {
    const p = poseTransformPoint(pose, [
      local[i] as number,
      local[i + 1] as number,
      local[i + 2] as number,
    ]);
    points[i] = p[0];
    points[i + 1] = p[1];
    points[i + 2] = p[2];
  }
  return { id, shape, pose, box: boundingBox(shape, pose), points };
}

const machines = new Map<string, readonly Solid[]>();

/**
 * The baskets and their fittings as solids, one per primitive (a wire, a tine, a panel), so
 * that a point is tested only against the primitives whose box it lies in.
 */
function machineSolids(config: MachineConfig): readonly Solid[] {
  const key = JSON.stringify(config);
  let solids = machines.get(key);
  if (solids === undefined) {
    const made: Solid[] = [];
    for (const part of buildMachineGeometry(PRIMARY_MACHINE, config).parts) {
      if (part.component === 'tub' || part.component === 'door' || part.arm !== undefined) continue;
      for (const primitive of part.shape.parts) {
        made.push(solidOf(part.id, { ...part.shape, parts: [primitive], regions: [] }, part.pose));
      }
    }
    solids = made;
    machines.set(key, solids);
  }
  return solids;
}

/** Points of `points` no further than `reach` outside the box `within`: their least signed distance to `solid`. */
function nearest(points: Float32Array, within: Aabb, reach: number, solid: Solid): number {
  let least = Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i] as number;
    const y = points[i + 1] as number;
    const z = points[i + 2] as number;
    if (
      x < within.min[0] - reach ||
      x > within.max[0] + reach ||
      y < within.min[1] - reach ||
      y > within.max[1] + reach ||
      z < within.min[2] - reach ||
      z > within.max[2] + reach
    ) {
      continue;
    }
    const d = signedDistance(solid.shape, poseInverseTransformPoint(solid.pose, [x, y, z]));
    if (d < least) least = d;
  }
  return least;
}

/** Distances beyond this are not looked for, metres. */
const GAP_REACH = 0.01;

/**
 * The least distance between an item at a pose and the baskets and their fittings, metres,
 * as sampled at the vertices of both: negative where one cuts into the other (then the depth),
 * at most {@link GAP_REACH}; and the part it is least to.
 */
export function machineGap(
  typeId: string,
  pose: Pose,
  config: MachineConfig = PRIMARY_MACHINE.defaultConfig,
): { gap: number; with: string } {
  const item = solidOf(typeId, instantiate(typeId).shape, pose, typeId);
  let gap = GAP_REACH;
  let to = '';
  for (const part of machineSolids(config)) {
    let apart = false;
    for (let k = 0; k < 3 && !apart; k++) {
      apart =
        (item.box.min[k] as number) > (part.box.max[k] as number) + GAP_REACH ||
        (item.box.max[k] as number) < (part.box.min[k] as number) - GAP_REACH;
    }
    if (apart) continue;
    const d = Math.min(
      nearest(item.points, part.box, GAP_REACH, part),
      nearest(part.points, item.box, GAP_REACH, item),
    );
    if (d < gap) {
      gap = d;
      to = part.id;
    }
  }
  return { gap, with: to };
}

/**
 * How deep an item at a pose cuts into the baskets and their fittings, metres (0 when it is
 * clear), and into which part.
 */
export function machineOverlap(
  typeId: string,
  pose: Pose,
  config?: MachineConfig,
): { depth: number; with: string } {
  const found = machineGap(typeId, pose, config);
  return { depth: Math.max(0, -found.gap), with: found.gap < 0 ? found.with : '' };
}

/**
 * Distance a set pose keeps from the baskets, metres: with sample points 3 mm apart along
 * the wires and across the faces, a 4 mm wire that every point is 0.5 mm clear of cannot cut
 * 1 mm into the item between two of them.
 */
export const CLEAR_MARGIN = 0.0005;

/**
 * A set pose moved by the smallest step at which the item is {@link CLEAR_MARGIN} clear of
 * the baskets: along `along` (a horizontal direction, tub frame) by up to 8 mm either way,
 * and lifted by up to 6 mm. Flagged `exact`. Throws when no such pose is found.
 */
export function cleared(item: LoadItem, along: Vec3, config?: MachineConfig): LoadItem {
  const dir = v3Normalise(along);
  let best: { pose: Pose; gap: number } | undefined;
  for (const lift of [0, 0.001, 0.002, 0.003, 0.004, 0.006]) {
    for (const step of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8]) {
      const s = step / 1000;
      const pose: Pose = {
        p: [
          item.pose.p[0] + s * dir[0],
          item.pose.p[1] + s * dir[1],
          item.pose.p[2] + s * dir[2] + lift,
        ],
        q: item.pose.q,
      };
      const gap = machineGap(item.typeId, pose, config).gap;
      if (gap >= CLEAR_MARGIN) return { ...item, pose, exact: true };
      if (best === undefined || gap > best.gap) best = { pose, gap };
    }
  }
  throw new Error(
    `${item.itemId}: no pose within 8 mm is clear of the basket (the best leaves ${((best?.gap ?? 0) * 1000).toFixed(1)} mm)`,
  );
}
