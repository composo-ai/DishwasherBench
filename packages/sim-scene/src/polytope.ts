/**
 * The convex core of a rounded box or a rounded hull: the faces, edges and vertices of the convex
 * hull of a few points, which the scene needs to lay a grid on every planar face and to tell
 * which face a rounded edge or corner belongs to.
 *
 * `@spotless/geometry` builds the same structure internally (its `convex.ts`) and does not
 * export it, so it is rebuilt here with the same tolerances; the surface-area tests of this
 * package hold the two to each other. Reported as a request to export the kernel's.
 *
 * A point set of affine dimension 0 is a ball, of dimension 1 a capsule; dimension 2 gives a
 * polygon treated as a polytope with a top and a bottom face that share every edge (a rounded
 * plate), dimension 3 a solid polytope. Hull primitives have a handful of points, so the face
 * search is brute force.
 *
 * Units: metres, part frame.
 */

import type { Vec3 } from '@spotless/core';
import { v3Cross, v3Dot, v3Length, v3Normalise, v3Sub } from '@spotless/core';

/** Two points closer than this are one point, metres (as in the geometry kernel). */
const MERGE_DISTANCE = 1e-7;
/** Points within this distance of a line or plane are on it, metres (as in the kernel). */
const FLATNESS_TOLERANCE = 1e-7;

/** One face of a polytope. */
export interface CoreFace {
  /** Outward unit normal. */
  readonly normal: Vec3;
  /** Vertex indices, counter-clockwise seen from outside. */
  readonly loop: readonly number[];
}

/** One edge of a polytope. */
export interface CoreEdge {
  /** End vertices; the edge runs `a -> b` in the loop of `face0` and `b -> a` in `face1`. */
  readonly a: number;
  readonly b: number;
  readonly face0: number;
  readonly face1: number;
  /** Length, metres. */
  readonly length: number;
  /** Angle between the two face normals (the exterior dihedral angle), radians in (0, pi]. */
  readonly angle: number;
}

/** A convex polygon in space (dimension 2) or a solid convex polytope (dimension 3). */
export interface CorePolytope {
  readonly dim: 2 | 3;
  readonly vertices: readonly Vec3[];
  readonly faces: readonly CoreFace[];
  readonly edges: readonly CoreEdge[];
  /** Per vertex: the faces that meet there, ascending. */
  readonly vertexFaces: readonly (readonly number[])[];
  /**
   * Per vertex: the solid angle of its cone of outward normals, steradians (2 pi minus the sum
   * of the interior angles of the faces meeting there). Times the rounding radius squared it is
   * the area of the spherical patch at the vertex; the defects of a polytope sum to 4 pi.
   */
  readonly vertexDefect: readonly number[];
}

/** The convex hull of a point set, classified by affine dimension. */
export type ConvexCore =
  | { readonly dim: 0; readonly centre: Vec3 }
  | { readonly dim: 1; readonly a: Vec3; readonly b: Vec3 }
  | CorePolytope;

type Point2 = readonly [number, number];

/** Convex hull of planar points (monotone chain): indices, counter-clockwise, no collinear points. */
function convexHull2(points: readonly Point2[]): number[] {
  const order = points.map((_, i) => i);
  order.sort((i, j) => {
    const p = points[i] as Point2;
    const q = points[j] as Point2;
    return p[0] - q[0] || p[1] - q[1] || i - j;
  });
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
        if (side(a, p, b) > -FLATNESS_TOLERANCE) chain.pop();
        else break;
      }
      chain.push(idx);
    }
    chain.pop();
    return chain;
  };
  return [...build(order), ...build([...order].reverse())];
}

function farthest(points: readonly Vec3[], from: Vec3): { index: number; distance: number } {
  let index = 0;
  let distance = -1;
  for (let i = 0; i < points.length; i++) {
    const d = v3Length(v3Sub(points[i] as Vec3, from));
    if (d > distance) {
      distance = d;
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

function assemble(dim: 2 | 3, vertices: readonly Vec3[], faces: readonly CoreFace[]): CorePolytope {
  const n = vertices.length;
  const directed = new Map<number, number>();
  faces.forEach((face, f) => {
    face.loop.forEach((a, i) => {
      const b = face.loop[(i + 1) % face.loop.length] as number;
      if (directed.has(a * n + b)) throw new Error('sim-scene: degenerate hull (repeated edge)');
      directed.set(a * n + b, f);
    });
  });
  const edges: CoreEdge[] = [];
  const seen = new Set<number>();
  faces.forEach((face, f) => {
    face.loop.forEach((a, i) => {
      const b = face.loop[(i + 1) % face.loop.length] as number;
      if (seen.has(b * n + a)) return;
      const other = directed.get(b * n + a);
      if (other === undefined) throw new Error('sim-scene: degenerate hull (open edge)');
      seen.add(a * n + b);
      const va = vertices[a] as Vec3;
      const vb = vertices[b] as Vec3;
      const dir = v3Normalise(v3Sub(vb, va));
      const w = v3Normalise(v3Cross(dir, face.normal));
      const n1 = (faces[other] as CoreFace).normal;
      const angle = Math.atan2(Math.max(0, v3Dot(n1, w)), v3Dot(n1, face.normal));
      edges.push({
        a,
        b,
        face0: f,
        face1: other,
        length: v3Length(v3Sub(vb, va)),
        // Two faces back to back (a plate) meet at pi whichever way the cross product rounds.
        angle: angle > 0 ? angle : Math.PI,
      });
    });
  });
  const vertexFaces: number[][] = vertices.map(() => []);
  const angleSum = vertices.map(() => 0);
  faces.forEach((face, f) => {
    const loop = face.loop;
    loop.forEach((v, i) => {
      (vertexFaces[v] as number[]).push(f);
      angleSum[v] =
        (angleSum[v] as number) +
        interiorAngle(
          vertices[loop[(i + loop.length - 1) % loop.length] as number] as Vec3,
          vertices[v] as Vec3,
          vertices[loop[(i + 1) % loop.length] as number] as Vec3,
        );
    });
  });
  return {
    dim,
    vertices,
    faces,
    edges,
    vertexFaces,
    vertexDefect: angleSum.map((a) => Math.max(0, 2 * Math.PI - a)),
  };
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
    const a = points[farthest(points, points[0] as Vec3).index] as Vec3;
    const b = points[farthest(points, a).index] as Vec3;
    return { dim: 1, a, b };
  }
  const top = vertices.map((_, i) => i);
  return assemble(2, vertices, [
    { normal, loop: top },
    { normal: [-normal[0] + 0, -normal[1] + 0, -normal[2] + 0], loop: [...top].reverse() },
  ]);
}

function buildSolid(points: readonly Vec3[]): CorePolytope {
  const n = points.length;
  const found: { normal: Vec3; on: number[] }[] = [];
  for (let i = 0; i < n; i++) {
    const pi = points[i] as Vec3;
    for (let j = i + 1; j < n; j++) {
      const eij = v3Sub(points[j] as Vec3, pi);
      for (let k = j + 1; k < n; k++) {
        if (found.some((f) => f.on.includes(i) && f.on.includes(j) && f.on.includes(k))) continue;
        const eik = v3Sub(points[k] as Vec3, pi);
        const raw = v3Cross(eij, eik);
        const len = v3Length(raw);
        if (len < 1e-6 * v3Length(eij) * v3Length(eik) || len === 0) continue;
        let normal: Vec3 = [raw[0] / len, raw[1] / len, raw[2] / len];
        const offset = v3Dot(normal, pi);
        let above = false;
        let below = false;
        const on: number[] = [];
        for (let m = 0; m < n && !(above && below); m++) {
          const s = v3Dot(normal, points[m] as Vec3) - offset;
          if (s > FLATNESS_TOLERANCE) above = true;
          else if (s < -FLATNESS_TOLERANCE) below = true;
          else on.push(m);
        }
        if (above && below) continue;
        if (above) normal = [-normal[0], -normal[1], -normal[2]];
        found.push({ normal, on });
      }
    }
  }
  const used = new Map<number, number>();
  const vertices: Vec3[] = [];
  const faces: CoreFace[] = [];
  for (const f of found) {
    const origin = points[f.on[0] as number] as Vec3;
    const far = farthest(
      f.on.map((i) => points[i] as Vec3),
      origin,
    );
    const u = v3Normalise(v3Sub(points[f.on[far.index] as number] as Vec3, origin));
    const v = v3Cross(f.normal, u);
    const flat = f.on.map((i): Point2 => {
      const rel = v3Sub(points[i] as Vec3, origin);
      return [v3Dot(rel, u), v3Dot(rel, v)];
    });
    const hull = convexHull2(flat);
    if (hull.length < 3) continue;
    const loop = hull.map((h) => {
      const original = f.on[h] as number;
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
 * The convex hull of a point set (metres, any frame). Throws a RangeError for an empty set and
 * an Error when the points are too close to degenerate for a consistent hull.
 */
export function convexCore(input: readonly Vec3[]): ConvexCore {
  if (input.length === 0) throw new RangeError('sim-scene: a hull needs at least one point');
  const points: Vec3[] = [];
  for (const p of input) {
    if (!points.some((q) => v3Length(v3Sub(q, p)) < MERGE_DISTANCE)) points.push(p);
  }
  const p0 = points[0] as Vec3;
  const first = farthest(points, p0);
  if (points.length === 1 || first.distance < MERGE_DISTANCE) return { dim: 0, centre: p0 };
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
    const d = v3Length([rel[0] - t * axis[0], rel[1] - t * axis[1], rel[2] - t * axis[2]]);
    if (d > offLine) {
      offLine = d;
      offPoint = p;
    }
  }
  if (offLine < FLATNESS_TOLERANCE) {
    return {
      dim: 1,
      a: [a[0] + tMin * axis[0], a[1] + tMin * axis[1], a[2] + tMin * axis[2]],
      b: [a[0] + tMax * axis[0], a[1] + tMax * axis[1], a[2] + tMax * axis[2]],
    };
  }
  const normal = v3Normalise(v3Cross(axis, v3Sub(offPoint, a)));
  let offPlane = 0;
  for (const p of points) offPlane = Math.max(offPlane, Math.abs(v3Dot(v3Sub(p, a), normal)));
  if (offPlane < FLATNESS_TOLERANCE) {
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
