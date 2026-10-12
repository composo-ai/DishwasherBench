/**
 * Convex geometry behind the collision shapes: how a rounded convex hull (the Minkowski sum of
 * the hull of a few points and a sphere) is turned into something Jolt simulates faithfully.
 *
 * Two facts about Jolt 5.6 decide the representation (both read from its source and measured
 * here):
 *
 * 1. A convex shape carries an *inner* convex radius: the polytope handed to it is shrunk by
 *    moving every face plane inwards by the radius and then inflated again, so the rounded shape
 *    never extends beyond the polytope.
 * 2. The simulation does not use the rounded shape for its contact points. Whenever both shapes
 *    of a contact have a supporting face (hulls, boxes and capsules lying side-on all do), the
 *    points are built by clipping the *faces of the polytopes* against each other
 *    (`ManifoldBetweenTwoFaces`). A rounded hull given to Jolt as a mitred polytope with an
 *    inner radius therefore collides as that sharp polytope: a plate made of rounded quads with
 *    a 2.25 mm radius came to rest 0.3 to 0.8 mm clear of every wire it leaned on.
 *
 * A rounded hull is therefore split into parts whose faces all lie on its true surface
 * ({@link facetRoundedHull}): one sharp polytope spanned by its flat faces, each moved out by
 * the radius (for a planar core this is a prism of the true thickness), and one capsule along
 * every edge of the core. The polytope is inscribed in the rounded hull and the capsules restore
 * the rounded edges and corners exactly. A capsule is only needed where the rounded edge is
 * exposed: {@link exposedArc} measures that from all the pieces of a body that share the edge,
 * so the edges between the sectors of a smooth wall cost nothing.
 *
 * Everything here is float64 and independent of the physics engine. Units: metres.
 */

import type { Vec3 } from '@spotless/core';
import { v3Add, v3AddScaled, v3Cross, v3Dot, v3Length, v3Normalise, v3Sub } from '@spotless/core';

/** Two points closer than this are the same point, metres. */
export const POINT_MERGE_DISTANCE = 1e-7;
/** Points within this distance of a line or a plane are on it, metres. */
export const FLATNESS_TOLERANCE = 1e-7;
/** Largest number of points accepted for one hull piece (the face search is O(n^4)). */
export const MAX_HULL_POINTS = 64;

/** A supporting half-space `normal . x <= offset` of a convex set; `normal` is a unit vector. */
export interface HalfSpace {
  readonly normal: Vec3;
  readonly offset: number;
}

/** A sphere: what a rounded hull of coincident points is. Metres. */
export interface SphereForm {
  readonly kind: 'sphere';
  readonly centre: Vec3;
  readonly radius: number;
}

/** A capsule: what a rounded hull of collinear points is. Metres. */
export interface CapsuleForm {
  readonly kind: 'capsule';
  readonly a: Vec3;
  readonly b: Vec3;
  readonly radius: number;
}

/** A sharp polytope: the convex hull of `points`. Metres. */
export interface PolytopeForm {
  readonly kind: 'polytope';
  readonly points: readonly Vec3[];
  /**
   * What to use when the engine's hull builder cannot digest `points` (it loses vertices of
   * long thin hulls with fine facets): another, plainer point set, or `'drop'` when the
   * neighbouring parts describe the piece well enough without this one. Absent when the piece
   * cannot do without it.
   */
  readonly fallback?: readonly Vec3[] | 'drop';
}

/** Affine dimension of a point set, with the frame used to analyse it. */
export type PointSetDimension =
  | { readonly dim: 0; readonly centre: Vec3 }
  | { readonly dim: 1; readonly a: Vec3; readonly b: Vec3 }
  | {
      readonly dim: 2;
      /** A point of the plane and an orthonormal basis: `u`, `v` in the plane, `n` normal. */
      readonly origin: Vec3;
      readonly u: Vec3;
      readonly v: Vec3;
      readonly n: Vec3;
    }
  | { readonly dim: 3 };

function farthestFrom(points: readonly Vec3[], from: Vec3): { index: number; distance: number } {
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

/**
 * Classifies a point set as a point, a segment, a planar polygon or a solid, using
 * {@link POINT_MERGE_DISTANCE} and {@link FLATNESS_TOLERANCE}. Throws on an empty set.
 */
export function pointSetDimension(points: readonly Vec3[]): PointSetDimension {
  if (points.length === 0) throw new Error('physics: a hull needs at least one point');
  const p0 = points[0] as Vec3;
  const first = farthestFrom(points, p0);
  if (first.distance < POINT_MERGE_DISTANCE) return { dim: 0, centre: p0 };
  // Two sweeps give a pair of points close to the diameter of the set: a stable main axis.
  const a = points[first.index] as Vec3;
  const second = farthestFrom(points, a);
  const b = points[second.index] as Vec3;
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
    const d = v3Length(v3AddScaled(rel, axis, -t));
    if (d > offLine) {
      offLine = d;
      offPoint = p;
    }
  }
  if (offLine < FLATNESS_TOLERANCE) {
    return { dim: 1, a: v3AddScaled(a, axis, tMin), b: v3AddScaled(a, axis, tMax) };
  }
  const n = v3Normalise(v3Cross(axis, v3Sub(offPoint, a)));
  let offPlane = 0;
  for (const p of points) offPlane = Math.max(offPlane, Math.abs(v3Dot(v3Sub(p, a), n)));
  if (offPlane < FLATNESS_TOLERANCE) {
    return { dim: 2, origin: a, u: axis, v: v3Cross(n, axis), n };
  }
  return { dim: 3 };
}

/** A point of the plane, as coordinates in a 2D basis. */
export type Point2 = readonly [x: number, y: number];

/**
 * Convex hull of planar points by Andrew's monotone chain: counter-clockwise, without repeated or
 * collinear vertices (a vertex is dropped when it lies within {@link FLATNESS_TOLERANCE} of the
 * line through its neighbours). Returns fewer than three points when the input is degenerate.
 */
export function convexHull2(points: readonly Point2[]): Point2[] {
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const unique: Point2[] = [];
  for (const p of sorted) {
    const last = unique[unique.length - 1];
    if (last === undefined || Math.hypot(p[0] - last[0], p[1] - last[1]) >= POINT_MERGE_DISTANCE) {
      unique.push(p);
    }
  }
  if (unique.length < 3) return unique;
  // Signed distance of c from the directed line a -> b (positive on the left).
  const side = (a: Point2, b: Point2, c: Point2): number => {
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    return (ex * (c[1] - a[1]) - ey * (c[0] - a[0])) / Math.hypot(ex, ey);
  };
  const build = (input: readonly Point2[]): Point2[] => {
    const chain: Point2[] = [];
    for (const p of input) {
      while (chain.length >= 2) {
        const a = chain[chain.length - 2] as Point2;
        const b = chain[chain.length - 1] as Point2;
        if (side(a, p, b) > -FLATNESS_TOLERANCE) chain.pop();
        else break;
      }
      chain.push(p);
    }
    chain.pop();
    return chain;
  };
  const lower = build(unique);
  const upper = build([...unique].reverse());
  return [...lower, ...upper];
}

/** Faces of the convex hull of a solid point set: unique supporting half-spaces. */
export function hullFaces(points: readonly Vec3[]): HalfSpace[] {
  const n = points.length;
  if (n > MAX_HULL_POINTS) {
    throw new Error(`physics: a hull piece may have at most ${MAX_HULL_POINTS} points, got ${n}`);
  }
  const faces: HalfSpace[] = [];
  const add = (normal: Vec3, offset: number): void => {
    for (const f of faces) {
      if (v3Dot(f.normal, normal) > 1 - 1e-10 && Math.abs(f.offset - offset) < FLATNESS_TOLERANCE) {
        return;
      }
    }
    faces.push({ normal, offset });
  };
  for (let i = 0; i < n; i++) {
    const pi = points[i] as Vec3;
    for (let j = i + 1; j < n; j++) {
      const eij = v3Sub(points[j] as Vec3, pi);
      for (let k = j + 1; k < n; k++) {
        const raw = v3Cross(eij, v3Sub(points[k] as Vec3, pi));
        const len = v3Length(raw);
        // Skip (nearly) collinear triples: the plane through them is ill-defined.
        if (len < 1e-12 || len < 1e-6 * v3Length(eij) * v3Length(v3Sub(points[k] as Vec3, pi))) {
          continue;
        }
        const normal: Vec3 = [raw[0] / len, raw[1] / len, raw[2] / len];
        const offset = v3Dot(normal, pi);
        let above = false;
        let below = false;
        for (let m = 0; m < n && !(above && below); m++) {
          const s = v3Dot(normal, points[m] as Vec3) - offset;
          if (s > FLATNESS_TOLERANCE) above = true;
          else if (s < -FLATNESS_TOLERANCE) below = true;
        }
        if (above && below) continue;
        if (above) add([-normal[0], -normal[1], -normal[2]], -offset);
        else add(normal, offset);
      }
    }
  }
  return faces;
}

/** Vertex loop of the hull face lying in `face`, counter-clockwise seen from outside. */
export function faceLoop(points: readonly Vec3[], face: HalfSpace): Vec3[] {
  const on = points.filter((p) => Math.abs(v3Dot(face.normal, p) - face.offset) < 2e-7);
  const dim = pointSetDimension(on);
  if (dim.dim !== 2) return on;
  // Orient the in-plane basis so that u x v = face normal.
  const flip = v3Dot(dim.n, face.normal) < 0;
  const u = dim.u;
  const v = flip ? ([-dim.v[0], -dim.v[1], -dim.v[2]] as Vec3) : dim.v;
  const flat = on.map((p): Point2 => {
    const rel = v3Sub(p, dim.origin);
    return [v3Dot(rel, u), v3Dot(rel, v)];
  });
  return convexHull2(flat).map((q) =>
    v3Add(dim.origin, v3AddScaled(v3AddScaled([0, 0, 0], u, q[0]), v, q[1])),
  );
}

/**
 * One edge of the core of a rounded hull: where a capsule of the piece's radius would restore
 * the rounded edge, and which directions around the edge the piece itself fills.
 */
export interface CoreEdge {
  readonly a: Vec3;
  readonly b: Vec3;
  /** Rounding radius of the piece, metres. */
  readonly radius: number;
  /** Unit vector perpendicular to the edge pointing into the piece. */
  readonly inward: Vec3;
  /**
   * Half-width, radians, of the arc of directions about `inward` that lies inside the rounded
   * piece: a quarter turn for the edge of a flat piece, more for the edge of a solid.
   */
  readonly halfAngle: number;
}

/** A rounded hull split into a sharp polytope of its flats and the edges of its core. */
export interface FacetedHull {
  readonly kind: 'faceted';
  /**
   * Convex hull of the flat faces, each moved out by the radius (inscribed in the rounded hull);
   * `null` when the piece is so narrow that the capsules of its edges describe it to within the
   * sag tolerance.
   */
  readonly solid: PolytopeForm | null;
  readonly edges: readonly CoreEdge[];
}

/** Longest mitre accepted when the faces of a solid are moved out by a radius, in radii. */
export const MITRE_LIMIT = 2;

/**
 * The corners of a solid hull moved out so that every face plane moves out by `radius`: each
 * corner goes to where its face planes meet again (a mitre). Where more than three faces meet
 * the least-squares point is taken and pushed out until no face is short, and a mitre longer
 * than {@link MITRE_LIMIT} radii (a knife edge) is cut back to that length. The result is the
 * plain sharp-cornered envelope of the rounded hull: its flats are exact, its edges and corners
 * stand proud by up to 0.41 and 0.73 of the radius where faces meet at right angles.
 */
export function mitredCorners(
  points: readonly Vec3[],
  faces: readonly HalfSpace[],
  radius: number,
): Vec3[] {
  const out: Vec3[] = [];
  const seen: Vec3[] = [];
  for (const p of points) {
    if (seen.some((q) => v3Length(v3Sub(q, p)) < POINT_MERGE_DISTANCE)) continue;
    seen.push(p);
    const normals = faces
      .filter((f) => Math.abs(v3Dot(f.normal, p) - f.offset) < 2e-7)
      .map((f) => f.normal);
    if (normals.length < 3) continue; // not a corner of the hull
    // Least squares for n . m = 1 over the faces at this corner: (sum n n^T) m = sum n.
    let a00 = 0;
    let a01 = 0;
    let a02 = 0;
    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    let b: Vec3 = [0, 0, 0];
    for (const n of normals) {
      a00 += n[0] * n[0];
      a01 += n[0] * n[1];
      a02 += n[0] * n[2];
      a11 += n[1] * n[1];
      a12 += n[1] * n[2];
      a22 += n[2] * n[2];
      b = v3Add(b, n);
    }
    const c00 = a11 * a22 - a12 * a12;
    const c01 = a02 * a12 - a01 * a22;
    const c02 = a01 * a12 - a02 * a11;
    const det = a00 * c00 + a01 * c01 + a02 * c02;
    let m: Vec3;
    if (Math.abs(det) > 1e-9) {
      const c11 = a00 * a22 - a02 * a02;
      const c12 = a01 * a02 - a00 * a12;
      const c22 = a00 * a11 - a01 * a01;
      m = [
        (c00 * b[0] + c01 * b[1] + c02 * b[2]) / det,
        (c01 * b[0] + c11 * b[1] + c12 * b[2]) / det,
        (c02 * b[0] + c12 * b[1] + c22 * b[2]) / det,
      ];
      let short = Infinity;
      for (const n of normals) short = Math.min(short, v3Dot(n, m));
      if (short > 1e-6 && short < 1) m = [m[0] / short, m[1] / short, m[2] / short];
    } else {
      m = v3Normalise(b);
    }
    const length = v3Length(m);
    if (!(length <= MITRE_LIMIT)) {
      const scale = length > 0 && Number.isFinite(length) ? MITRE_LIMIT / length : 0;
      m = scale > 0 ? [m[0] * scale, m[1] * scale, m[2] * scale] : v3Normalise(b);
    }
    out.push(v3AddScaled(p, m, radius));
  }
  return out;
}

/**
 * Width of a convex planar loop: the smallest, over its edges, of the largest distance of a
 * vertex from the line of that edge. No point of the loop is further than half of it from the
 * boundary.
 */
export function loopWidth(loop: readonly Vec3[]): number {
  let width = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] as Vec3;
    const edge = v3Normalise(v3Sub(loop[(i + 1) % loop.length] as Vec3, a));
    let reach = 0;
    for (const p of loop) {
      const rel = v3Sub(p, a);
      reach = Math.max(reach, v3Length(v3AddScaled(rel, edge, -v3Dot(rel, edge))));
    }
    width = Math.min(width, reach);
  }
  return width;
}

/**
 * Height by which a flat chord falls short of a circular arc of radius `radius` spanning `arc`
 * radians: `radius * (1 - cos(arc / 2))`, metres. This is the error of leaving a rounded edge
 * whose exposed arc is `arc` to the flat faces on either side of it.
 */
export function chordSag(radius: number, arc: number): number {
  return radius * (1 - Math.cos(Math.min(arc, 2 * Math.PI) / 2));
}

function edgeKey(a: Vec3, b: Vec3): { key: string; flipped: boolean } {
  const k = (p: Vec3): string =>
    `${Math.round(p[0] / POINT_MERGE_DISTANCE)},${Math.round(p[1] / POINT_MERGE_DISTANCE)},${Math.round(p[2] / POINT_MERGE_DISTANCE)}`;
  const ka = k(a);
  const kb = k(b);
  return ka <= kb ? { key: `${ka}|${kb}`, flipped: false } : { key: `${kb}|${ka}`, flipped: true };
}

/**
 * Identity of an edge by its end points to within {@link POINT_MERGE_DISTANCE}, the same for
 * both directions, or `null` for an edge of no length.
 */
export function coreEdgeKey(a: Vec3, b: Vec3): string | null {
  const { key } = edgeKey(a, b);
  const [ka, kb] = key.split('|');
  return ka === kb ? null : key;
}

/**
 * Splits the rounded convex hull `hull(points) + ball(radius)` (metres, any frame, `radius` above
 * zero) into parts whose faces lie on its true surface: coincident points give a sphere,
 * collinear points a capsule, anything else a sharp polytope of the flat faces moved out by the
 * radius together with the edges of the core. `sag` is the largest error accepted where a
 * narrow flat is left to its edge capsules, metres.
 */
export function facetRoundedHull(
  points: readonly Vec3[],
  radius: number,
  sag: number,
): SphereForm | CapsuleForm | FacetedHull {
  if (!(radius > 0) || !Number.isFinite(radius)) {
    throw new Error(`physics: a rounded hull needs a radius above zero, got ${radius}`);
  }
  for (const p of points) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) {
      throw new Error('physics: hull point is not finite');
    }
  }
  const dim = pointSetDimension(points);
  switch (dim.dim) {
    case 0:
      return { kind: 'sphere', centre: dim.centre, radius };
    case 1:
      return { kind: 'capsule', a: dim.a, b: dim.b, radius };
    case 2: {
      const flat = points.map((p): Point2 => {
        const rel = v3Sub(p, dim.origin);
        return [v3Dot(rel, dim.u), v3Dot(rel, dim.v)];
      });
      const loop = convexHull2(flat).map((q): Vec3 => [
        dim.origin[0] + q[0] * dim.u[0] + q[1] * dim.v[0],
        dim.origin[1] + q[0] * dim.u[1] + q[1] * dim.v[1],
        dim.origin[2] + q[0] * dim.u[2] + q[1] * dim.v[2],
      ]);
      if (loop.length < 3) {
        // Cannot happen for a set classified as planar, but stay exact if tolerances disagree.
        const a = loop[0] as Vec3;
        const b = loop[loop.length - 1] as Vec3;
        return loop.length < 2
          ? { kind: 'sphere', centre: a, radius }
          : { kind: 'capsule', a, b, radius };
      }
      // The loop is counter-clockwise about dim.n (u x v = n), so its inside is to the left of
      // every edge.
      const edges: CoreEdge[] = [];
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i] as Vec3;
        const b = loop[(i + 1) % loop.length] as Vec3;
        edges.push({
          a,
          b,
          radius,
          inward: v3Normalise(v3Cross(dim.n, v3Sub(b, a))),
          halfAngle: Math.PI / 2,
        });
      }
      const width = loopWidth(loop);
      let solid: PolytopeForm | null = null;
      // Midway across a flat of width w its two edge capsules are w^2 / (8 r) lower than it.
      if ((width * width) / (8 * radius) >= sag) {
        const prism: Vec3[] = [];
        for (const p of loop) {
          prism.push(v3AddScaled(p, dim.n, radius), v3AddScaled(p, dim.n, -radius));
        }
        // Should the engine fail to build it, the capsules along the loop stand in for it.
        solid = { kind: 'polytope', points: prism, fallback: 'drop' };
      }
      return { kind: 'faceted', solid, edges };
    }
    case 3: {
      const faces = hullFaces(points);
      const moved: Vec3[] = [];
      const normalsAt = new Map<string, { a: Vec3; b: Vec3; normals: Vec3[] }>();
      for (const face of faces) {
        const loop = faceLoop(points, face);
        if (loop.length < 3) continue;
        for (let i = 0; i < loop.length; i++) {
          const a = loop[i] as Vec3;
          const b = loop[(i + 1) % loop.length] as Vec3;
          moved.push(v3AddScaled(a, face.normal, radius));
          const { key, flipped } = edgeKey(a, b);
          let entry = normalsAt.get(key);
          if (entry === undefined) {
            entry = flipped ? { a: b, b: a, normals: [] } : { a, b, normals: [] };
            normalsAt.set(key, entry);
          }
          entry.normals.push(face.normal);
        }
      }
      const edges: CoreEdge[] = [];
      for (const { a, b, normals } of normalsAt.values()) {
        if (v3Length(v3Sub(b, a)) < POINT_MERGE_DISTANCE) continue;
        const n1 = normals[0] as Vec3;
        const n2 = normals[1];
        if (n2 === undefined) {
          // An edge found on one face only (tolerances disagreed): treat it as fully exposed.
          edges.push({ a, b, radius, inward: [-n1[0], -n1[1], -n1[2]], halfAngle: 0 });
          continue;
        }
        const exterior = Math.acos(Math.max(-1, Math.min(1, v3Dot(n1, n2))));
        const sum = v3Add(n1, n2);
        edges.push({
          a,
          b,
          radius,
          inward: v3Normalise([-sum[0], -sum[1], -sum[2]], [-n1[0], -n1[1], -n1[2]]),
          halfAngle: Math.PI - exterior / 2,
        });
      }
      return {
        kind: 'faceted',
        solid: { kind: 'polytope', points: moved, fallback: mitredCorners(points, faces, radius) },
        edges,
      };
    }
  }
}

/**
 * Width, radians, of the largest arc of directions around an edge that none of the pieces
 * sharing it fills: the part of the rounded edge that is exposed. `edges` are the same edge as
 * seen by each piece (in either direction). 0 when the pieces close around the edge, pi for the
 * free edge of a single flat piece.
 */
export function exposedArc(edges: readonly CoreEdge[]): number {
  const first = edges[0];
  if (first === undefined) return 2 * Math.PI;
  const axis = v3Normalise(v3Sub(first.b, first.a));
  // Any fixed pair of axes perpendicular to the edge will do to measure angles in.
  const seed: Vec3 =
    Math.abs(axis[0]) <= Math.abs(axis[1]) && Math.abs(axis[0]) <= Math.abs(axis[2])
      ? [1, 0, 0]
      : Math.abs(axis[1]) <= Math.abs(axis[2])
        ? [0, 1, 0]
        : [0, 0, 1];
  const e1 = v3Normalise(v3Cross(axis, seed));
  const e2 = v3Cross(axis, e1);
  const spans: [number, number][] = [];
  for (const edge of edges) {
    if (edge.halfAngle >= Math.PI) return 0;
    if (!(edge.halfAngle > 0)) continue;
    const centre = Math.atan2(v3Dot(edge.inward, e2), v3Dot(edge.inward, e1));
    let lo = centre - edge.halfAngle;
    const twoPi = 2 * Math.PI;
    lo -= Math.floor(lo / twoPi) * twoPi; // into [0, 2 pi)
    const hi = lo + 2 * edge.halfAngle;
    if (hi <= twoPi) spans.push([lo, hi]);
    else spans.push([lo, twoPi], [0, hi - twoPi]);
  }
  if (spans.length === 0) return 2 * Math.PI;
  spans.sort((p, q) => p[0] - q[0]);
  const start = (spans[0] as [number, number])[0];
  let gap = 0;
  let reach = start;
  for (const [lo, hi] of spans) {
    if (lo > reach) gap = Math.max(gap, lo - reach);
    reach = Math.max(reach, hi);
  }
  // The gap across the angle 0: from the end of the last span round to the start of the first.
  return Math.max(gap, 2 * Math.PI - reach + start);
}
