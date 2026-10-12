/**
 * The triangles of a shape for the ray hierarchy (docs/design/sim-core.md section 3.5, the
 * fallback of decision D4 that docs/design/scope.md makes the first build): the render mesh of
 * the geometry kernel at a fine chord error, with every triangle tied to the analytic surface
 * piece it approximates and to the patch its hits are mapped on.
 *
 * The kernel meshes every primitive from its exact surface, piece by piece: a triangle of a
 * shell lies on one line or arc of the cross-section, a triangle of a polytope on one face, one
 * rounded edge or one rounded corner, and every vertex carries the exact normal of its own
 * piece. The classification here finds that piece again from the vertex positions and normals.
 * A triangle that fits no piece within {@link CLASSIFY_TOLERANCE} is counted; it still gets the
 * best-fitting piece.
 *
 * Units: metres. Frame: item frame.
 */

import { buildRenderMesh } from '@spotless/geometry';
import { affinePoint, affineTransposeVector, affineVector } from './affine.ts';
import { NO_INDEX, type AtlasTriangles } from './atlas-core.ts';
import type { PartGeometry, ShapeAtlasBuilt } from './atlas.ts';
import { pieceMisfit } from './locate.ts';
import type { MeridianPiece } from './meridian.ts';

const TWO_PI = 2 * Math.PI;

/** A triangle fits a surface piece when its vertices are within this of it, metres. */
export const CLASSIFY_TOLERANCE = 1e-5;

/** A mesh vertex (stored in f32) closer to an axis than this is on it, metres. */
const ON_AXIS = 1e-6;

/** Triangles with how well they were classified. */
export interface ClassifiedTriangles extends AtlasTriangles {
  /** Triangles that fitted no piece within {@link CLASSIFY_TOLERANCE}. */
  readonly unclassified: number;
}

type V3 = [number, number, number];

function classifySor(
  g: Extract<PartGeometry, { kind: 'sor' }>,
  P: readonly V3[],
  N: readonly V3[],
): [surf: number, patch: number, misfit: number] {
  const r: number[] = [];
  const z: number[] = [];
  const mr: number[] = [];
  const mz: number[] = [];
  let inPlane = 0;
  let azimuthX = 0;
  let azimuthY = 0;
  for (let i = 0; i < 3; i++) {
    const p = P[i] as V3;
    const n = N[i] as V3;
    const q = affinePoint(g.frame, p[0], p[1], p[2]);
    // The gradient in the unscaled frame is the transpose of the stretch applied to the normal.
    const gu = affineTransposeVector(g.toItem, n[0], n[1], n[2]);
    const len = Math.hypot(gu[0], gu[1], gu[2]) || 1;
    const rr = Math.hypot(q[0], q[1]);
    // On the axis there is no radial direction: a surface normal there is along the axis, and a
    // normal across it belongs to a flat end face.
    const radial = rr > ON_AXIS ? (gu[0] * q[0] + gu[1] * q[1]) / (rr * len) : 0;
    const axial = gu[2] / len;
    inPlane = Math.max(inPlane, Math.hypot(radial, axial));
    const norm = Math.hypot(radial, axial) || 1;
    // The mesh gives a vertex on the axis the normal of a flat cap, whatever the surface does
    // there, so it says nothing about which piece the triangle lies on.
    const onAxis = rr <= ON_AXIS;
    r.push(rr);
    z.push(q[2]);
    mr.push(onAxis ? 0 : radial / norm);
    mz.push(onAxis ? 0 : axial / norm);
    azimuthX += q[0];
    azimuthY += q[1];
  }
  if (g.arc !== null && inPlane < 1e-3) {
    // A flat end face: the normal has no component in the meridian plane.
    const phi = Math.atan2(azimuthY, azimuthX);
    const off = (a: number): number => {
      let d = (phi - a) % TWO_PI;
      if (d > Math.PI) d -= TWO_PI;
      if (d < -Math.PI) d += TWO_PI;
      return Math.abs(d);
    };
    const end = off(g.arc.phi0) <= off(g.arc.phi1) ? 0 : 1;
    return [g.arc.endSurf[end], g.arc.endPatch[end], 0];
  }
  let best = NO_INDEX;
  let bestPatch = NO_INDEX;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const { place, run } of g.runs) {
    for (let k = 0; k < run.pieces.length; k++) {
      const piece = run.pieces[k] as MeridianPiece;
      let score = 0;
      for (let i = 0; i < 3 && score < bestScore; i++) {
        score = Math.max(
          score,
          pieceMisfit(piece, r[i] as number, z[i] as number, mr[i] as number, mz[i] as number),
        );
      }
      if (score < bestScore) {
        bestScore = score;
        best = place.surfStart + k;
        bestPatch = place.patch;
      }
    }
  }
  return [best, bestPatch, bestScore];
}

function classifyPoly(
  g: Extract<PartGeometry, { kind: 'poly' }>,
  P: readonly V3[],
  N: readonly V3[],
): [surf: number, patch: number, misfit: number] {
  const q = P.map((p) => affinePoint(g.itemToPart, p[0], p[1], p[2]));
  const m = N.map((n) => affineVector(g.itemToPart, n[0], n[1], n[2]));
  const { core, radius, place } = g;
  const dot = (a: readonly number[], c: readonly number[]): number =>
    (a[0] as number) * (c[0] as number) +
    (a[1] as number) * (c[1] as number) +
    (a[2] as number) * (c[2] as number);
  const mc: V3 = [0, 1, 2].map(
    (i) => ((m[0] as V3)[i] as number) + ((m[1] as V3)[i] as number) + ((m[2] as V3)[i] as number),
  ) as V3;
  const nearestFace = (faces: readonly number[]): number => {
    let bestFace = faces[0] as number;
    let bestDot = Number.NEGATIVE_INFINITY;
    for (const f of faces) {
      const d = dot(mc, (core.faces[f] as { normal: readonly number[] }).normal);
      if (d > bestDot) {
        bestDot = d;
        bestFace = f;
      }
    }
    return bestFace;
  };
  const m0 = m[0] as V3;
  const same = (a: V3, c: V3): boolean => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]) < 1e-5;
  if (same(m0, m[1] as V3) && same(m0, m[2] as V3)) {
    for (let f = 0; f < core.faces.length; f++) {
      const face = core.faces[f] as { normal: readonly number[]; loop: readonly number[] };
      if (dot(m0, face.normal) < 1 - 1e-6) continue;
      const offset =
        dot(face.normal, core.vertices[face.loop[0] as number] as readonly number[]) + radius;
      const off = Math.abs(dot(face.normal, q[0] as V3) - offset);
      if (off < CLASSIFY_TOLERANCE)
        return [place.faceSurf[f] as number, place.facePatch[f] as number, off];
    }
  }
  if (radius > 0) {
    for (let e = 0; e < core.edges.length; e++) {
      const edge = core.edges[e] as (typeof core.edges)[number];
      const va = core.vertices[edge.a] as readonly number[];
      const vb = core.vertices[edge.b] as readonly number[];
      const dir = [0, 1, 2].map((i) => ((vb[i] as number) - (va[i] as number)) / edge.length);
      let worst = 0;
      for (let i = 0; i < 3 && worst < CLASSIFY_TOLERANCE; i++) {
        const rel = [0, 1, 2].map((k) => ((q[i] as V3)[k] as number) - (va[k] as number));
        const t = dot(rel, dir);
        const perp = Math.hypot(
          (rel[0] as number) - t * (dir[0] as number),
          (rel[1] as number) - t * (dir[1] as number),
          (rel[2] as number) - t * (dir[2] as number),
        );
        worst = Math.max(
          worst,
          Math.abs(perp - radius),
          Math.max(0, -t, t - edge.length),
          1e-1 * Math.abs(dot(m[i] as V3, dir)),
        );
      }
      if (worst < CLASSIFY_TOLERANCE) {
        const face = nearestFace([edge.face0, edge.face1]);
        return [place.edgeSurf[e] as number, place.facePatch[face] as number, worst];
      }
    }
    let bestVertex = -1;
    let bestWorst = Number.POSITIVE_INFINITY;
    for (let v = 0; v < core.vertices.length; v++) {
      const p = core.vertices[v] as readonly number[];
      let worst = 0;
      for (let i = 0; i < 3; i++) {
        const d = Math.hypot(
          ((q[i] as V3)[0] as number) - (p[0] as number),
          ((q[i] as V3)[1] as number) - (p[1] as number),
          ((q[i] as V3)[2] as number) - (p[2] as number),
        );
        worst = Math.max(worst, Math.abs(d - radius));
      }
      if (worst < bestWorst) {
        bestWorst = worst;
        bestVertex = v;
      }
    }
    if (bestVertex >= 0) {
      const face = nearestFace(core.vertexFaces[bestVertex] as readonly number[]);
      return [place.vertexSurf[bestVertex] as number, place.facePatch[face] as number, bestWorst];
    }
  }
  // No rounding and no face matched: the face the normal points along.
  const face = nearestFace(core.faces.map((_, f) => f));
  return [place.faceSurf[face] as number, place.facePatch[face] as number, 1];
}

const cache = new WeakMap<ShapeAtlasBuilt, Map<number, ClassifiedTriangles>>();

/**
 * The triangles of an atlas's shape at the given chord error (metres), classified. Cached per
 * atlas and chord error. Triangles of a part the atlas could not represent are left out.
 */
export function atlasTriangles(atlas: ShapeAtlasBuilt, chordError: number): ClassifiedTriangles {
  let perAtlas = cache.get(atlas);
  if (perAtlas === undefined) {
    perAtlas = new Map();
    cache.set(atlas, perAtlas);
  }
  const cached = perAtlas.get(chordError);
  if (cached !== undefined) return cached;

  const mesh = buildRenderMesh(atlas.shape, { chordError });
  const total = mesh.indices.length / 3;
  const positions = new Float64Array(9 * total);
  const surf = new Uint32Array(total);
  const patch = new Uint32Array(total);
  const part = new Uint32Array(total);
  let count = 0;
  let unclassified = 0;
  const P: V3[] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const N: V3[] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let t = 0; t < total; t++) {
    const pi = mesh.triPart[t] as number;
    const g = atlas.partGeometry[pi] as PartGeometry;
    if (g.kind === 'none') continue;
    for (let i = 0; i < 3; i++) {
      const v = mesh.indices[3 * t + i] as number;
      const p = P[i] as V3;
      const n = N[i] as V3;
      p[0] = mesh.positions[3 * v] as number;
      p[1] = mesh.positions[3 * v + 1] as number;
      p[2] = mesh.positions[3 * v + 2] as number;
      n[0] = mesh.normals[3 * v] as number;
      n[1] = mesh.normals[3 * v + 1] as number;
      n[2] = mesh.normals[3 * v + 2] as number;
    }
    let s = NO_INDEX;
    let pa = NO_INDEX;
    let misfit = 0;
    if (g.kind === 'line') {
      s = g.place.surfStart;
      pa = g.place.patch;
    } else if (g.kind === 'capsule') {
      let lo = Number.POSITIVE_INFINITY;
      let hi = Number.NEGATIVE_INFINITY;
      for (const p of P) {
        const z = affinePoint(g.frame, p[0], p[1], p[2])[2];
        lo = Math.min(lo, z);
        hi = Math.max(hi, z);
      }
      pa = g.place.patch;
      if (hi <= 1e-6) s = g.place.surfStart;
      else if (lo >= g.length - 1e-6) s = g.place.surfStart + g.place.surfCount - 1;
      else s = g.place.surfStart + 1;
    } else if (g.kind === 'sor') {
      [s, pa, misfit] = classifySor(g, P, N);
    } else {
      [s, pa, misfit] = classifyPoly(g, P, N);
    }
    if (s === NO_INDEX || pa === NO_INDEX) continue;
    if (misfit > CLASSIFY_TOLERANCE) unclassified++;
    for (let i = 0; i < 3; i++) {
      const p = P[i] as V3;
      positions[9 * count + 3 * i] = p[0];
      positions[9 * count + 3 * i + 1] = p[1];
      positions[9 * count + 3 * i + 2] = p[2];
    }
    surf[count] = s;
    patch[count] = pa;
    part[count] = pi;
    count++;
  }
  const result: ClassifiedTriangles = {
    chordError,
    count,
    positions: positions.subarray(0, 9 * count),
    surf: surf.subarray(0, count),
    patch: patch.subarray(0, count),
    part: part.subarray(0, count),
    unclassified,
  };
  perAtlas.set(chordError, result);
  return result;
}
