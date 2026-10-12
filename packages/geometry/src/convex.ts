/**
 * Convex hull of a few points, with the adjacency needed to treat `hull + ball` exactly.
 *
 * A `'hull'` primitive (and an `'rbox'`, whose core is a box) is the Minkowski sum of the convex
 * hull of its points and a ball. Its surface splits into three kinds of patch: the faces of the
 * hull moved out by the radius, a cylindrical strip along every edge and a spherical patch at
 * every vertex. This module finds the faces, edges and the cyclic order of the edges around each
 * vertex; signed distance, mass properties, surface area and the render mesh all build on it.
 *
 * Point sets of every affine dimension are handled: a single point (the solid is a ball), a
 * segment (a capsule), a planar convex polygon (a rounded plate, treated as a polytope with two
 * faces that share every edge) and a solid polytope.
 *
 * The algorithms are brute force (the face search is O(n^4)): hull primitives have a handful of
 * points. Units: metres.
 */

import type { Vec3 } from '@spotless/core';
import { v3Cross, v3Dot, v3Length, v3Normalise, v3Sub } from '@spotless/core';

/** Two hull points closer than this are the same point, metres. */
export const HULL_POINT_MERGE_DISTANCE = 1e-7;
/** Points within this distance of a line or a plane are on it, metres. */
export const HULL_FLATNESS_TOLERANCE = 1e-7;
/** Largest number of points accepted for one hull. */
export const HULL_MAX_POINTS = 64;

/** One face of a polytope. */
export interface PolyFace {
  /** Outward unit normal. */
  readonly normal: Vec3;
  /** Vertex indices, counter-clockwise seen from outside. */
  readonly loop: readonly number[];
}

/**
 * One edge of a polytope with the arc its outward normals sweep: the directions
 * `cos(alpha) u0 + sin(alpha) w` for `alpha` in `[0, angle]`, from the normal of `face0` to the
 * normal of `face1`.
 */
export interface PolyEdge {
  /** End vertices; the edge runs `a -> b` in the loop of `face0` and `b -> a` in `face1`. */
  readonly a: number;
  readonly b: number;
  readonly face0: number;
  readonly face1: number;
  /** Unit direction from `a` to `b`. */
  readonly dir: Vec3;
  /** Length, metres. */
  readonly length: number;
  /** Normal of `face0`. */
  readonly u0: Vec3;
  /** Unit vector perpendicular to `u0` and to the edge, pointing away from `face0`. */
  readonly w: Vec3;
  /** Angle between the two face normals (exterior dihedral angle), radians in (0, pi]. */
  readonly angle: number;
}

/** A step of the walk around a vertex: an edge, and whether its arc is traversed backwards. */
export interface FanStep {
  readonly edge: number;
  /** True when the walk crosses the edge from `face1` to `face0`. */
  readonly reversed: boolean;
}

/**
 * A convex polygon in space (`dim` 2, a degenerate polytope with a top and a bottom face) or a
 * solid convex polytope (`dim` 3).
 */
export interface Polytope {
  readonly dim: 2 | 3;
  readonly vertices: readonly Vec3[];
  readonly faces: readonly PolyFace[];
  readonly edges: readonly PolyEdge[];
  /**
   * Per vertex: the edges met when walking once around it, in cyclic order. Consecutive steps
   * share a face, so the arcs of the steps chain into the boundary of the vertex's normal cone.
   */
  readonly fans: readonly (readonly FanStep[])[];
  /** Per vertex: sum of the interior angles of the faces meeting there, radians. */
  readonly angleSums: readonly number[];
  /** Packed for distance queries, per face: nx, ny, nz, offset (the plane `n . x = offset`). */
  readonly planes: Float64Array;
  /**
   * Per face, per edge of its loop: ax, ay, az, ox, oy, oz (start point, and the direction in
   * the face plane that points out of the face across that edge; not normalised).
   */
  readonly faceEdges: readonly Float64Array[];
  /** Per edge: ax, ay, az, ex, ey, ez, 1 / |e|^2 (start point and vector to the end point). */
  readonly segments: Float64Array;
}

/** The convex hull of a point set, classified by affine dimension. */
export type ConvexCore =
  | { readonly dim: 0; readonly centre: Vec3 }
  | { readonly dim: 1; readonly a: Vec3; readonly b: Vec3 }
  | Polytope;

type Point2 = readonly [number, number];

/** Convex hull of planar points (monotone chain): indices, counter-clockwise, no collinear points. */
function convexHull2(points: readonly Point2[]): number[] {
  const order = points.map((_, i) => i);
  order.sort((i, j) => {
    const p = points[i] as Point2;
    const q = points[j] as Point2;
    return p[0] - q[0] || p[1] - q[1] || i - j;
  });
  // Signed distance of c from the directed line a -> b (positive on the left).
  const side = (a: Point2, b: Point2, c: Point2): number => {
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    if (len === 0) return 0;
    return (ex * (c[1] - a[1]) - ey * (c[0] - a[0])) / len;
  };
  const build = (input: readonly number[]): number[] => {
    const chain: number[] = [];
    for (const idx of input) {
      const p = points[idx] as Point2;
      while (chain.length >= 2) {
        const a = points[chain[chain.length - 2] as number] as Point2;
        const b = points[chain[chain.length - 1] as number] as Point2;
        // Pop b unless the turn a -> b -> p is clearly to the left.
        if (side(a, p, b) > -HULL_FLATNESS_TOLERANCE) chain.pop();
        else break;
      }
      chain.push(idx);
    }
    chain.pop();
    return chain;
  };
  const lower = build(order);
  const upper = build([...order].reverse());
  return [...lower, ...upper];
}

function dedupe(points: readonly Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (const p of points) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) {
      throw new RangeError('geometry: hull point is not finite');
    }
    if (!out.some((q) => v3Length(v3Sub(q, p)) < HULL_POINT_MERGE_DISTANCE)) out.push(p);
  }
  return out;
}

function farthest(points: readonly Vec3[], from: Vec3): { index: number; distance: number } {
  let index = 0;
  let distance = -1;
  for (let i = 0; i < points.length; i++) {
    const dist = v3Length(v3Sub(points[i] as Vec3, from));
    if (dist > distance) {
      distance = dist;
      index = i;
    }
  }
  return { index, distance };
}

function interiorAngle(prev: Vec3, at: Vec3, next: Vec3): number {
  const a = v3Sub(prev, at);
  const b = v3Sub(next, at);
  return Math.atan2(v3Length(v3Cross(a, b)), v3Dot(a, b));
}

/** Assembles edges, vertex fans and angle sums from oriented face loops. */
function assemble(dim: 2 | 3, vertices: readonly Vec3[], faces: readonly PolyFace[]): Polytope {
  const directed = new Map<number, number>(); // a * n + b -> face holding a -> b
  const n = vertices.length;
  for (let f = 0; f < faces.length; f++) {
    const loop = (faces[f] as PolyFace).loop;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i] as number;
      const b = loop[(i + 1) % loop.length] as number;
      if (directed.has(a * n + b)) throw new Error('geometry: degenerate hull (repeated edge)');
      directed.set(a * n + b, f);
    }
  }
  const edges: PolyEdge[] = [];
  const edgeOf = new Map<number, number>(); // a * n + b (a -> b in face0) -> edge index
  for (let f = 0; f < faces.length; f++) {
    const face = faces[f] as PolyFace;
    for (let i = 0; i < face.loop.length; i++) {
      const a = face.loop[i] as number;
      const b = face.loop[(i + 1) % face.loop.length] as number;
      if (edgeOf.has(b * n + a)) continue; // already created from the other side
      const other = directed.get(b * n + a);
      if (other === undefined) throw new Error('geometry: degenerate hull (open edge)');
      const va = vertices[a] as Vec3;
      const vb = vertices[b] as Vec3;
      const length = v3Length(v3Sub(vb, va));
      const dir = v3Normalise(v3Sub(vb, va));
      const u0 = face.normal;
      const w = v3Normalise(v3Cross(dir, u0));
      const n1 = (faces[other] as PolyFace).normal;
      const angle = Math.atan2(Math.max(0, v3Dot(n1, w)), v3Dot(n1, u0));
      edgeOf.set(a * n + b, edges.length);
      edges.push({ a, b, face0: f, face1: other, dir, length, u0, w, angle });
    }
  }
  // Walk around every vertex: from a face, cross its edge that leaves the vertex.
  const fans: FanStep[][] = [];
  const angleSums: number[] = [];
  for (let v = 0; v < n; v++) {
    const start = faces.findIndex((face) => face.loop.includes(v));
    if (start < 0) throw new Error('geometry: degenerate hull (unused vertex)');
    const fan: FanStep[] = [];
    let angleSum = 0;
    let f = start;
    for (let guard = 0; guard <= faces.length; guard++) {
      const loop = (faces[f] as PolyFace).loop;
      const i = loop.indexOf(v);
      const next = loop[(i + 1) % loop.length] as number;
      const prev = loop[(i + loop.length - 1) % loop.length] as number;
      angleSum += interiorAngle(
        vertices[prev] as Vec3,
        vertices[v] as Vec3,
        vertices[next] as Vec3,
      );
      const forward = edgeOf.get(v * n + next);
      if (forward !== undefined) {
        fan.push({ edge: forward, reversed: false });
        f = (edges[forward] as PolyEdge).face1;
      } else {
        const backward = edgeOf.get(next * n + v);
        if (backward === undefined) throw new Error('geometry: degenerate hull (missing edge)');
        fan.push({ edge: backward, reversed: true });
        f = (edges[backward] as PolyEdge).face0;
      }
      if (f === start) break;
      if (guard === faces.length) throw new Error('geometry: degenerate hull (open vertex fan)');
    }
    fans.push(fan);
    angleSums.push(angleSum);
  }
  if (dim === 3 && n - edges.length + faces.length !== 2) {
    throw new Error('geometry: degenerate hull (not a closed polytope)');
  }
  const planes = new Float64Array(faces.length * 4);
  const faceEdges: Float64Array[] = [];
  faces.forEach((face, f) => {
    const normal = face.normal;
    const v0 = vertices[face.loop[0] as number] as Vec3;
    planes.set([normal[0], normal[1], normal[2], v3Dot(normal, v0)], 4 * f);
    const data = new Float64Array(face.loop.length * 6);
    for (let i = 0; i < face.loop.length; i++) {
      const a = vertices[face.loop[i] as number] as Vec3;
      const b = vertices[face.loop[(i + 1) % face.loop.length] as number] as Vec3;
      const out = v3Cross(v3Sub(b, a), normal);
      data.set([a[0], a[1], a[2], out[0], out[1], out[2]], 6 * i);
    }
    faceEdges.push(data);
  });
  const segments = new Float64Array(edges.length * 7);
  edges.forEach((edge, i) => {
    const a = vertices[edge.a] as Vec3;
    const e = v3Sub(vertices[edge.b] as Vec3, a);
    segments.set([a[0], a[1], a[2], e[0], e[1], e[2], 1 / v3Dot(e, e)], 7 * i);
  });
  return { dim, vertices, faces, edges, fans, angleSums, planes, faceEdges, segments };
}

function buildPolygon(
  points: readonly Vec3[],
  origin: Vec3,
  u: Vec3,
  v: Vec3,
  normal: Vec3,
): ConvexCore {
  const flat = points.map((p): Point2 => {
    const rel = v3Sub(p, origin);
    return [v3Dot(rel, u), v3Dot(rel, v)];
  });
  const hull = convexHull2(flat);
  const vertices = hull.map((i) => points[i] as Vec3);
  if (vertices.length < 3) {
    // Tolerances disagreed about collinearity: fall back to the segment between the extremes.
    const a = points[farthest(points, points[0] as Vec3).index] as Vec3;
    const b = points[farthest(points, a).index] as Vec3;
    return { dim: 1, a, b };
  }
  const top = vertices.map((_, i) => i);
  const faces: PolyFace[] = [
    { normal, loop: top },
    { normal: [-normal[0] + 0, -normal[1] + 0, -normal[2] + 0], loop: [...top].reverse() },
  ];
  return assemble(2, vertices, faces);
}

function buildSolid(points: readonly Vec3[]): Polytope {
  const n = points.length;
  if (n > HULL_MAX_POINTS) {
    throw new RangeError(`geometry: a hull may have at most ${HULL_MAX_POINTS} points, got ${n}`);
  }
  const found: { normal: Vec3; on: Set<number> }[] = [];
  for (let i = 0; i < n; i++) {
    const pi = points[i] as Vec3;
    for (let j = i + 1; j < n; j++) {
      const eij = v3Sub(points[j] as Vec3, pi);
      for (let k = j + 1; k < n; k++) {
        if (found.some((f) => f.on.has(i) && f.on.has(j) && f.on.has(k))) continue;
        const eik = v3Sub(points[k] as Vec3, pi);
        const raw = v3Cross(eij, eik);
        const len = v3Length(raw);
        // Skip (nearly) collinear triples: their plane is ill-defined.
        if (len < 1e-6 * v3Length(eij) * v3Length(eik) || len === 0) continue;
        let normal: Vec3 = [raw[0] / len, raw[1] / len, raw[2] / len];
        const offset = v3Dot(normal, pi);
        let above = false;
        let below = false;
        const on = new Set<number>();
        for (let m = 0; m < n; m++) {
          const s = v3Dot(normal, points[m] as Vec3) - offset;
          if (s > HULL_FLATNESS_TOLERANCE) above = true;
          else if (s < -HULL_FLATNESS_TOLERANCE) below = true;
          else on.add(m);
          if (above && below) break;
        }
        if (above && below) continue;
        if (above) normal = [-normal[0], -normal[1], -normal[2]];
        found.push({ normal, on });
      }
    }
  }
  // Order the points of every face counter-clockwise about its outward normal.
  const used = new Map<number, number>();
  const vertices: Vec3[] = [];
  const faces: PolyFace[] = [];
  for (const f of found) {
    const idx = [...f.on];
    const origin = points[idx[0] as number] as Vec3;
    const far = farthest(
      idx.map((i) => points[i] as Vec3),
      origin,
    );
    const u = v3Normalise(v3Sub(points[idx[far.index] as number] as Vec3, origin));
    const v = v3Cross(f.normal, u);
    const flat = idx.map((i): Point2 => {
      const rel = v3Sub(points[i] as Vec3, origin);
      return [v3Dot(rel, u), v3Dot(rel, v)];
    });
    const hull = convexHull2(flat);
    if (hull.length < 3) continue;
    const loop = hull.map((h) => {
      const original = idx[h] as number;
      let mapped = used.get(original);
      if (mapped === undefined) {
        mapped = vertices.length;
        used.set(original, mapped);
        vertices.push(points[original] as Vec3);
      }
      return mapped;
    });
    faces.push({ normal: f.normal, loop });
  }
  return assemble(3, vertices, faces);
}

/**
 * Builds the convex hull of a point set (metres, any frame). Coincident points are merged
 * ({@link HULL_POINT_MERGE_DISTANCE}); flatness is decided with {@link HULL_FLATNESS_TOLERANCE}.
 * Throws a RangeError for an empty set, a non-finite point or more than {@link HULL_MAX_POINTS}
 * points, and an Error when the points are too close to degenerate for a consistent hull.
 */
export function buildConvexCore(input: readonly Vec3[]): ConvexCore {
  if (input.length === 0) throw new RangeError('geometry: a hull needs at least one point');
  const points = dedupe(input);
  const p0 = points[0] as Vec3;
  const first = farthest(points, p0);
  if (points.length === 1 || first.distance < HULL_POINT_MERGE_DISTANCE)
    return { dim: 0, centre: p0 };
  // Two sweeps give a pair of points close to the diameter of the set: a stable main axis.
  const a = points[first.index] as Vec3;
  const b = points[farthest(points, a).index] as Vec3;
  const axis = v3Normalise(v3Sub(b, a));
  let offLine = 0;
  let offPoint = a;
  let tMin = 0;
  let tMax = 0;
  for (const p of points) {
    const rel = v3Sub(p, a);
    const t = v3Dot(rel, axis);
    tMin = Math.min(tMin, t);
    tMax = Math.max(tMax, t);
    const dist = v3Length([rel[0] - t * axis[0], rel[1] - t * axis[1], rel[2] - t * axis[2]]);
    if (dist > offLine) {
      offLine = dist;
      offPoint = p;
    }
  }
  if (offLine < HULL_FLATNESS_TOLERANCE) {
    return {
      dim: 1,
      a: [a[0] + tMin * axis[0], a[1] + tMin * axis[1], a[2] + tMin * axis[2]],
      b: [a[0] + tMax * axis[0], a[1] + tMax * axis[1], a[2] + tMax * axis[2]],
    };
  }
  const normal = v3Normalise(v3Cross(axis, v3Sub(offPoint, a)));
  let offPlane = 0;
  for (const p of points) offPlane = Math.max(offPlane, Math.abs(v3Dot(v3Sub(p, a), normal)));
  if (offPlane < HULL_FLATNESS_TOLERANCE) {
    return buildPolygon(points, a, axis, v3Cross(normal, axis), normal);
  }
  return buildSolid(points);
}

/** The eight corners of a box with the given half extents (metres), centred on the origin. */
export function boxCorners(halfExtents: Vec3): Vec3[] {
  const out: Vec3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push([sx * halfExtents[0], sy * halfExtents[1], sz * halfExtents[2]]);
      }
    }
  }
  return out;
}

/** Unit direction at the angle `alpha` along the normal arc of an edge. */
export function edgeArcDirection(edge: PolyEdge, alpha: number): Vec3 {
  const c = Math.cos(alpha);
  const s = Math.sin(alpha);
  return [
    c * edge.u0[0] + s * edge.w[0],
    c * edge.u0[1] + s * edge.w[1],
    c * edge.u0[2] + s * edge.w[2],
  ];
}
