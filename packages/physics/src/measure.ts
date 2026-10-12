/**
 * Independent float64 measurement of the distance and penetration between collision pieces.
 *
 * It does not use the physics engine: every piece is treated as the Minkowski sum of a convex
 * core (a point, a segment, a planar polygon or a polytope) and a sphere, and the distance
 * between two cores is found by enumerating their features (vertices, edges, faces). The bake-off
 * recommended keeping such a check beside the engine for tests and scoring instead of trusting
 * any engine's own penetration query (docs/research/spike-rigid-body.md).
 *
 * Units: metres. Poses map the item frame of the pieces to the common (tub) frame.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { poseTransformPoint, v3Cross, v3Dot, v3Length, v3Sub } from '@spotless/core';
import type { CollisionPiece } from '@spotless/geometry';
import type { HalfSpace, Point2 } from './convex.ts';
import { convexHull2, faceLoop, hullFaces, pointSetDimension } from './convex.ts';

/** The sharp convex core of a rounded piece, with the radius of the sphere added to it. */
export interface ConvexCore {
  /**
   * Boundary of the core: one loop of a single point (a sphere core), of two points (a capsule
   * core), a planar convex loop (a rounded polygon core) or the face loops of a polytope.
   */
  readonly loops: readonly (readonly Vec3[])[];
  /** Face half-spaces when the core is a solid polytope, otherwise `null`. */
  readonly planes: readonly HalfSpace[] | null;
  /** Radius of the rounding sphere, metres. */
  readonly radius: number;
  /** Axis-aligned bounds of the core (without the radius). */
  readonly min: Vec3;
  readonly max: Vec3;
}

function boundsOf(loops: readonly (readonly Vec3[])[]): { min: Vec3; max: Vec3 } {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const loop of loops) {
    for (const p of loop) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i] as number, p[i] as number);
        hi[i] = Math.max(hi[i] as number, p[i] as number);
      }
    }
  }
  return {
    min: [lo[0] as number, lo[1] as number, lo[2] as number],
    max: [hi[0] as number, hi[1] as number, hi[2] as number],
  };
}

/** Builds the core spanned by a set of points (any affine dimension) with a rounding radius. */
export function coreFromPoints(points: readonly Vec3[], radius: number): ConvexCore {
  const dim = pointSetDimension(points);
  let loops: Vec3[][];
  let planes: HalfSpace[] | null = null;
  switch (dim.dim) {
    case 0:
      loops = [[dim.centre]];
      break;
    case 1:
      loops = [[dim.a, dim.b]];
      break;
    case 2: {
      const flat = points.map((p): Point2 => {
        const rel = v3Sub(p, dim.origin);
        return [v3Dot(rel, dim.u), v3Dot(rel, dim.v)];
      });
      loops = [
        convexHull2(flat).map((q): Vec3 => [
          dim.origin[0] + q[0] * dim.u[0] + q[1] * dim.v[0],
          dim.origin[1] + q[0] * dim.u[1] + q[1] * dim.v[1],
          dim.origin[2] + q[0] * dim.u[2] + q[1] * dim.v[2],
        ]),
      ];
      break;
    }
    case 3:
      planes = hullFaces(points);
      loops = planes.map((f) => faceLoop(points, f));
      break;
  }
  return { loops, planes, radius, ...boundsOf(loops) };
}

/**
 * The core of one collision piece, in the frame `pose` maps the item frame to. A round rolling
 * surface is not a solid: its core is empty, at an infinite distance from everything, so that
 * it never counts in an overlap while the indices of the pieces stay what they are.
 */
export function pieceCore(piece: CollisionPiece, pose: Pose): ConvexCore {
  switch (piece.kind) {
    case 'round':
      return { loops: [], planes: null, radius: 0, ...boundsOf([]) };
    case 'hull':
      return coreFromPoints(
        piece.points.map((p) => poseTransformPoint(pose, p)),
        piece.radius,
      );
    case 'capsule':
      return coreFromPoints(
        [poseTransformPoint(pose, piece.a), poseTransformPoint(pose, piece.b)],
        piece.radius,
      );
    case 'box': {
      const h = piece.halfExtents;
      const corners: Vec3[] = [];
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const local = poseTransformPoint(piece.pose, [sx * h[0], sy * h[1], sz * h[2]]);
            corners.push(poseTransformPoint(pose, local));
          }
        }
      }
      return coreFromPoints(corners, piece.radius);
    }
  }
}

/** Distance between the segments `p1 q1` and `p2 q2` (either may be a single point). */
export function segmentSegmentDistance(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const d1 = v3Sub(q1, p1);
  const d2 = v3Sub(q2, p2);
  const r = v3Sub(p1, p2);
  const a = v3Dot(d1, d1);
  const e = v3Dot(d2, d2);
  const f = v3Dot(d2, r);
  let s = 0;
  let t = 0;
  const tiny = 1e-24;
  if (a <= tiny && e <= tiny) {
    return v3Length(r);
  }
  if (a <= tiny) {
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = v3Dot(d1, r);
    if (e <= tiny) {
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = v3Dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > 1e-18 * a * e ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }
  return Math.hypot(
    r[0] + d1[0] * s - d2[0] * t,
    r[1] + d1[1] * s - d2[1] * t,
    r[2] + d1[2] * s - d2[2] * t,
  );
}

/** Unit normal of a planar convex loop of at least three points (Newell's method). */
function loopNormal(loop: readonly Vec3[]): Vec3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] as Vec3;
    const b = loop[(i + 1) % loop.length] as Vec3;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz);
  return [nx / len, ny / len, nz / len];
}

/** True when `x` (assumed in the plane of the loop) is inside the convex loop or on its edge. */
function insideLoop(x: Vec3, loop: readonly Vec3[], normal: Vec3): boolean {
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] as Vec3;
    const b = loop[(i + 1) % loop.length] as Vec3;
    if (v3Dot(v3Cross(v3Sub(b, a), v3Sub(x, a)), normal) < -1e-12) return false;
  }
  return true;
}

/**
 * Distance between two convex loops, each a point, a segment or a planar convex polygon
 * (including its interior). Zero when they intersect.
 */
export function loopDistance(p: readonly Vec3[], q: readonly Vec3[]): number {
  let best = Infinity;
  const edgeCount = (loop: readonly Vec3[]): number => (loop.length >= 3 ? loop.length : 1);
  for (let i = 0; i < edgeCount(p); i++) {
    const a1 = p[i] as Vec3;
    const b1 = p[(i + 1) % p.length] as Vec3;
    for (let j = 0; j < edgeCount(q); j++) {
      const a2 = q[j] as Vec3;
      const b2 = q[(j + 1) % q.length] as Vec3;
      best = Math.min(best, segmentSegmentDistance(a1, b1, a2, b2));
    }
  }
  // A vertex or an edge of one loop over the interior of the other.
  const against = (poly: readonly Vec3[], other: readonly Vec3[]): void => {
    if (poly.length < 3) return;
    const n = loopNormal(poly);
    const origin = poly[0] as Vec3;
    const heights = other.map((x) => v3Dot(v3Sub(x, origin), n));
    for (let i = 0; i < other.length; i++) {
      const x = other[i] as Vec3;
      const h = heights[i] as number;
      const foot: Vec3 = [x[0] - h * n[0], x[1] - h * n[1], x[2] - h * n[2]];
      if (insideLoop(foot, poly, n)) best = Math.min(best, Math.abs(h));
    }
    for (let i = 0; i < edgeCount(other); i++) {
      const j = (i + 1) % other.length;
      const h0 = heights[i] as number;
      const h1 = heights[j] as number;
      if (h0 * h1 > 0 || h0 === h1) continue;
      const t = h0 / (h0 - h1);
      const a = other[i] as Vec3;
      const b = other[j] as Vec3;
      const x: Vec3 = [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ];
      if (insideLoop(x, poly, n)) best = 0;
    }
  };
  against(p, q);
  against(q, p);
  return best;
}

function containsPoint(core: ConvexCore, x: Vec3): boolean {
  if (core.planes === null) return false;
  for (const h of core.planes) if (v3Dot(h.normal, x) - h.offset > 0) return false;
  return true;
}

/** Distance between two cores without their radii, metres; zero when they intersect. */
export function coreDistance(a: ConvexCore, b: ConvexCore): number {
  for (const loop of b.loops) for (const x of loop) if (containsPoint(a, x)) return 0;
  for (const loop of a.loops) for (const x of loop) if (containsPoint(b, x)) return 0;
  let best = Infinity;
  for (const la of a.loops) {
    for (const lb of b.loops) {
      best = Math.min(best, loopDistance(la, lb));
      if (best === 0) return 0;
    }
  }
  return best;
}

/**
 * Signed distance between the surfaces of two collision pieces at the given poses, metres:
 * positive when apart, negative when they overlap. The overlap is exact while the cores are
 * apart (depth up to the sum of the radii) and saturates at minus the sum of the radii once the
 * cores themselves intersect.
 */
export function pieceDistance(
  a: CollisionPiece,
  poseA: Pose,
  b: CollisionPiece,
  poseB: Pose,
): number {
  const ca = pieceCore(a, poseA);
  const cb = pieceCore(b, poseB);
  return coreDistance(ca, cb) - ca.radius - cb.radius;
}

/** A rigid set of pieces placed in the common frame. */
export interface PlacedPieces {
  readonly pieces: readonly CollisionPiece[];
  /** Item frame of the pieces to the common frame. */
  readonly pose: Pose;
}

/** Deepest overlap found between two placed bodies. */
export interface PenetrationMeasurement {
  /** Deepest overlap between any piece of `a` and any piece of `b`, metres; 0 when none. */
  readonly depth: number;
  /** Indices of the two pieces involved, or -1 when there is no overlap. */
  readonly pieceA: number;
  readonly pieceB: number;
}

/** Cores of all the pieces of a placed body (compute once, reuse across measurements). */
export function placedCores(body: PlacedPieces): ConvexCore[] {
  return body.pieces.map((piece) => pieceCore(piece, body.pose));
}

/** Deepest overlap between two sets of cores, metres (see {@link pieceDistance} for saturation). */
export function coresPenetration(
  a: readonly ConvexCore[],
  b: readonly ConvexCore[],
): PenetrationMeasurement {
  let depth = 0;
  let pieceA = -1;
  let pieceB = -1;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i] as ConvexCore;
    for (let j = 0; j < b.length; j++) {
      const cb = b[j] as ConvexCore;
      const reach = ca.radius + cb.radius;
      // Bounding boxes further apart than the two radii cannot overlap.
      if (
        ca.min[0] - cb.max[0] > reach ||
        cb.min[0] - ca.max[0] > reach ||
        ca.min[1] - cb.max[1] > reach ||
        cb.min[1] - ca.max[1] > reach ||
        ca.min[2] - cb.max[2] > reach ||
        cb.min[2] - ca.max[2] > reach
      ) {
        continue;
      }
      const overlap = reach - coreDistance(ca, cb);
      if (overlap > depth) {
        depth = overlap;
        pieceA = i;
        pieceB = j;
      }
    }
  }
  return { depth, pieceA, pieceB };
}

/** Deepest overlap between two placed bodies, metres, measured without the physics engine. */
export function measurePenetration(a: PlacedPieces, b: PlacedPieces): PenetrationMeasurement {
  return coresPenetration(placedCores(a), placedCores(b));
}
