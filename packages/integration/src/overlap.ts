/**
 * How deep the bodies of a scene are inside each other, measured two independent ways, neither
 * of which asks the physics engine:
 *
 * 1. {@link measureOverlap}: on the collision pieces (the rounded convex pieces the engine was
 *    given), with the float64 measurer of the physics package. This is the number the "resting
 *    penetration under 0.2 mm" requirement is about: how well the solver keeps the shapes it
 *    simulates apart.
 * 2. {@link exactOverlap}: on the analytic shapes themselves, with the geometry kernel's signed
 *    distance. It differs from the first by what the collision pieces leave out of a curved
 *    surface: facets are chords, so two round surfaces whose pieces just touch may overlap by up
 *    to the collision chord error each (0.5 mm).
 *
 * Units: metres. Poses are the bodies' current poses in the world frame.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { compareIds, poseInverseTransformPoint, poseTransformPoint } from '@spotless/core';
import type { Aabb, Shape } from '@spotless/geometry';
import { boundingBox, buildRenderMesh, signedDistance } from '@spotless/geometry';
import type { ConvexCore } from '@spotless/physics';
import { coresPenetration, placedCores } from '@spotless/physics';
import type { LoadingScene, SceneBody } from './scene.ts';

/** The deepest overlap found between two bodies. */
export interface OverlapPair {
  readonly a: string;
  readonly b: string;
  /** Depth of the overlap, metres. */
  readonly depth: number;
}

/** Deepest overlaps of the collision pieces of a scene. */
export interface OverlapReading {
  /** Deepest overlap of any item with a fixture (rack, basket, floor), metres; 0 when none. */
  readonly withFixtures: number;
  /** Deepest overlap between two items, metres; 0 when none. */
  readonly betweenItems: number;
  /** The larger of the two. */
  readonly deepest: number;
  /** The pair of bodies with the deepest overlap, if any overlap at all. */
  readonly worst?: OverlapPair;
}

interface Placed {
  readonly id: string;
  readonly cores: readonly ConvexCore[];
  readonly min: Vec3;
  readonly max: Vec3;
}

function place(body: SceneBody, pose: Pose): Placed {
  const cores = placedCores({ pieces: body.pieces, pose });
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const core of cores) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k] as number, (core.min[k] as number) - core.radius);
      max[k] = Math.max(max[k] as number, (core.max[k] as number) + core.radius);
    }
  }
  return {
    id: body.id,
    cores,
    min: [min[0] as number, min[1] as number, min[2] as number],
    max: [max[0] as number, max[1] as number, max[2] as number],
  };
}

function apart(a: Placed, b: Placed): boolean {
  for (let k = 0; k < 3; k++) {
    if ((a.min[k] as number) > (b.max[k] as number) || (b.min[k] as number) > (a.max[k] as number))
      return true;
  }
  return false;
}

/**
 * A meter for the true overlap of the collision pieces of a scene's bodies at their current
 * poses. The fixtures are placed once (they must not move afterwards); every call places the
 * items afresh. `ids` restricts the items measured (default: all of them, as of each call).
 */
export function overlapMeter(scene: LoadingScene, ids?: readonly string[]): () => OverlapReading {
  const fixed = scene.fixtures.map((body) => place(body, scene.world.getPose(body.id)));
  return () => {
    const items = (
      ids === undefined ? scene.items : scene.items.filter((item) => ids.includes(item.id))
    ).map((item) => place(item, scene.world.getPose(item.id)));
    let withFixtures = 0;
    let betweenItems = 0;
    const found: { worst?: OverlapPair } = {};
    const note = (a: Placed, b: Placed, depth: number): void => {
      if (depth > (found.worst?.depth ?? 0)) {
        found.worst =
          compareIds(a.id, b.id) <= 0 ? { a: a.id, b: b.id, depth } : { a: b.id, b: a.id, depth };
      }
    };
    for (let i = 0; i < items.length; i++) {
      const own = items[i] as Placed;
      for (const other of fixed) {
        if (apart(own, other)) continue;
        const depth = coresPenetration(own.cores, other.cores).depth;
        withFixtures = Math.max(withFixtures, depth);
        note(own, other, depth);
      }
      for (let j = i + 1; j < items.length; j++) {
        const other = items[j] as Placed;
        if (apart(own, other)) continue;
        const depth = coresPenetration(own.cores, other.cores).depth;
        betweenItems = Math.max(betweenItems, depth);
        note(own, other, depth);
      }
    }
    return { withFixtures, betweenItems, deepest: Math.max(withFixtures, betweenItems), ...found };
  };
}

/** Deepest true overlap of the collision pieces of a scene right now (see {@link overlapMeter}). */
export function measureOverlap(scene: LoadingScene, ids?: readonly string[]): OverlapReading {
  return overlapMeter(scene, ids)();
}

/** Chord error of the meshes that sample a surface for {@link exactOverlap}, metres. */
export const SURFACE_SAMPLE_CHORD_ERROR = 0.0001;
/** Largest distance between neighbouring surface samples, metres. */
export const SURFACE_SAMPLE_SPACING = 0.002;
/** Distance between the samples along the axis of a capsule, metres. */
export const AXIS_SAMPLE_SPACING = 0.0005;

const probeCache = new WeakMap<Shape, Float64Array>();

/**
 * Probes of a shape for overlap tests, in its own frame, four numbers each: a point and the
 * radius of the ball about it that belongs to the shape. A capsule part is probed along its axis
 * with its own radius, which is exact however thin it is; every other part by points on its
 * surface (radius 0), at most {@link SURFACE_SAMPLE_SPACING} apart.
 */
export function shapeProbes(shape: Shape): Float64Array {
  const cached = probeCache.get(shape);
  if (cached !== undefined) return cached;
  const out: number[] = [];
  const capsuleParts = new Set<number>();
  shape.parts.forEach((part, index) => {
    if (part.prim.kind !== 'capsule') return;
    capsuleParts.add(index);
    const a = poseTransformPoint(part.pose, part.prim.a);
    const b = poseTransformPoint(part.pose, part.prim.b);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(length / AXIS_SAMPLE_SPACING));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      out.push(
        a[0] + f * (b[0] - a[0]),
        a[1] + f * (b[1] - a[1]),
        a[2] + f * (b[2] - a[2]),
        part.prim.radius,
      );
    }
  });
  if (capsuleParts.size < shape.parts.length) {
    const mesh = buildRenderMesh(shape, { chordError: SURFACE_SAMPLE_CHORD_ERROR });
    const at = (v: number): Vec3 => [
      mesh.positions[3 * v] as number,
      mesh.positions[3 * v + 1] as number,
      mesh.positions[3 * v + 2] as number,
    ];
    const mid = (p: Vec3, q: Vec3): Vec3 => [
      (p[0] + q[0]) / 2,
      (p[1] + q[1]) / 2,
      (p[2] + q[2]) / 2,
    ];
    const far = (p: Vec3, q: Vec3): number => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    // Split every triangle at the middle of its longest edge until no edge exceeds the spacing;
    // the corners of the pieces are the samples.
    const split = (a: Vec3, b: Vec3, c: Vec3): void => {
      const ab = far(a, b);
      const bc = far(b, c);
      const ca = far(c, a);
      const longest = Math.max(ab, bc, ca);
      if (longest <= SURFACE_SAMPLE_SPACING) {
        out.push(a[0], a[1], a[2], 0, b[0], b[1], b[2], 0, c[0], c[1], c[2], 0);
        return;
      }
      if (longest === ab) {
        const m = mid(a, b);
        split(a, m, c);
        split(m, b, c);
      } else if (longest === bc) {
        const m = mid(b, c);
        split(a, b, m);
        split(a, m, c);
      } else {
        const m = mid(c, a);
        split(a, b, m);
        split(m, b, c);
      }
    };
    for (let t = 0; t < mesh.triPart.length; t++) {
      if (capsuleParts.has(mesh.triPart[t] as number)) continue;
      split(
        at(mesh.indices[3 * t] as number),
        at(mesh.indices[3 * t + 1] as number),
        at(mesh.indices[3 * t + 2] as number),
      );
    }
  }
  const probes = Float64Array.from(out);
  probeCache.set(shape, probes);
  return probes;
}

function boxesApart(a: Aabb, b: Aabb): boolean {
  for (let k = 0; k < 3; k++) {
    if ((a.min[k] as number) > (b.max[k] as number) || (b.min[k] as number) > (a.max[k] as number))
      return true;
  }
  return false;
}

/**
 * Deepest overlap of the exact analytic shapes of two bodies, metres (0 when they are apart):
 * the largest depth, under the kernel's signed distance of either shape, of a probe of the other
 * (see {@link shapeProbes}). Exact for wires and tines against anything; for two curved surfaces
 * it can miss an overlap whose patch is smaller than the sample spacing, and its samples lie on
 * facets up to {@link SURFACE_SAMPLE_CHORD_ERROR} inside the surface.
 */
export function exactOverlapOfPair(a: SceneBody, poseA: Pose, b: SceneBody, poseB: Pose): number {
  if (boxesApart(boundingBox(a.shape, poseA), boundingBox(b.shape, poseB))) return 0;
  let deepest = 0;
  const probe = (from: SceneBody, fromPose: Pose, into: SceneBody, intoPose: Pose): void => {
    const box = boundingBox(into.shape, intoPose);
    const probes = shapeProbes(from.shape);
    for (let i = 0; i < probes.length; i += 4) {
      const radius = probes[i + 3] as number;
      const world = poseTransformPoint(fromPose, [
        probes[i] as number,
        probes[i + 1] as number,
        probes[i + 2] as number,
      ]);
      if (
        world[0] < box.min[0] - radius ||
        world[0] > box.max[0] + radius ||
        world[1] < box.min[1] - radius ||
        world[1] > box.max[1] + radius ||
        world[2] < box.min[2] - radius ||
        world[2] > box.max[2] + radius
      )
        continue;
      const depth = radius - signedDistance(into.shape, poseInverseTransformPoint(intoPose, world));
      if (depth > deepest) deepest = depth;
    }
  };
  probe(a, poseA, b, poseB);
  probe(b, poseB, a, poseA);
  return deepest;
}

/**
 * Deepest overlap of the exact shape of one item with the exact shape of any other body of the
 * scene at their current poses (see {@link exactOverlapOfPair}); `undefined` when it overlaps
 * nothing.
 */
export function exactOverlap(scene: LoadingScene, id: string): OverlapPair | undefined {
  const item = scene.items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`integration: no item '${id}' in the scene`);
  const pose = scene.world.getPose(id);
  let worst: OverlapPair | undefined;
  for (const other of [...scene.fixtures, ...scene.items]) {
    if (other.id === id) continue;
    const depth = exactOverlapOfPair(item, pose, other, scene.world.getPose(other.id));
    if (depth > (worst?.depth ?? 0)) worst = { a: id, b: other.id, depth };
  }
  return worst;
}
