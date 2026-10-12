/**
 * Render mesh of a shape (docs/design/platform.md section 4.2).
 *
 * Every primitive is tessellated from its exact surface, so every vertex lies on the zero level
 * set of the signed distance and every point of every facet within `chordError` of it:
 *  - sor: the exact cross-section boundary (inner and outer faces, round joins and the rounded
 *    rim are real geometry) is sampled and revolved. Straight boundary pieces need no
 *    subdivision along the profile; arcs are split by the chord-error rule. A partial shell gets
 *    two flat end faces.
 *  - capsule: a hemisphere, a cylinder and a hemisphere revolved about its axis.
 *  - rbox and hull: the faces of the inner polytope moved out by the radius, a cylindrical strip
 *    along every edge and a spherical patch at every vertex.
 * A rim, a round join or a spherical patch curves in two directions and the sagittas of the two
 * facetings add. Half the chord error is therefore spent on each direction: a shell of maximum
 * outer radius R gets the sector count of the platform rule evaluated at `chordError / 2`,
 * `N = max(minSectors, ceil(pi / acos(1 - chordError / (2 R))))`, which is about 1.4 times the
 * count of the collision pieces at the same chord error. Cones, cylinders and flats, which curve
 * one way or not at all, end up within `chordError / 2`.
 * The triangles of one part, with vertices welded by position, form a closed, consistently
 * oriented surface (counter-clockwise seen from outside). Vertices are duplicated where the
 * surface has a crease, so normals are exact surface normals, not averages. Triangles are tagged
 * with their part and with the first matching surface region (see `regions.ts`); region
 * boundaries along a sor profile coincide with mesh edges.
 *
 * Units: metres, item frame.
 */

import type { Vec3 } from '@spotless/core';
import { quatToMat3 } from '@spotless/core';
import {
  edgeArcDirection,
  type ConvexCore,
  type PolyEdge,
  type PolyFace,
  type Polytope,
} from './convex.ts';
import { arcStep, preparePrimitive, sectorCount, type PreparedSor } from './prepared.ts';
import { shapeRegionRules, sideOfNormalZ, type PatchSide } from './regions.ts';
import {
  SECTION_JOIN_TOLERANCE,
  splitLoopAtArcLengths,
  type SectionLoop,
  type SectionPiece,
} from './sor-section.ts';
import type { Part, RenderMesh, Shape, TessellationOptions } from './types.ts';

/** Default lower bound on the angular sectors of a shell of revolution per full turn. */
export const DEFAULT_MIN_SECTORS = 16;
/** Lower bound on the angular sectors around a capsule. */
export const CAPSULE_MIN_SECTORS = 8;
/** Largest angle spanned by one facet of a rim, a round join or a rounded edge, radians. */
export const MAX_FACET_ANGLE = Math.PI / 4;

const TWO_PI = 2 * Math.PI;
const AXIS_TOLERANCE = 1e-9;

/** Accumulates vertices and triangles; vertices are given in a local frame and stored in the item frame. */
class MeshBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly indices: number[] = [];
  readonly triPart: number[] = [];
  readonly triRegion: number[] = [];
  /** Rotation (row-major) and translation of the local frame in the item frame. */
  private m: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  private t: Vec3 = [0, 0, 0];
  part = 0;

  setFrame(m: readonly number[], t: Vec3): void {
    this.m = m;
    this.t = t;
  }

  /** Adds a vertex given in the local frame; returns its index. */
  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    const m = this.m as readonly [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    this.positions.push(
      this.t[0] + m[0] * x + m[1] * y + m[2] * z,
      this.t[1] + m[3] * x + m[4] * y + m[5] * z,
      this.t[2] + m[6] * x + m[7] * y + m[8] * z,
    );
    this.normals.push(
      m[0] * nx + m[1] * ny + m[2] * nz,
      m[3] * nx + m[4] * ny + m[5] * nz,
      m[6] * nx + m[7] * ny + m[8] * nz,
    );
    return this.positions.length / 3 - 1;
  }

  /** Adds a triangle whose winding is already counter-clockwise seen from outside. */
  triangle(a: number, b: number, c: number, region: number): void {
    if (a === b || b === c || a === c) return;
    this.indices.push(a, b, c);
    this.triPart.push(this.part);
    this.triRegion.push(region);
  }

  /** Squared distance between two vertices, m^2. */
  distanceSquared(a: number, b: number): number {
    const p = this.positions;
    const dx = (p[3 * a] as number) - (p[3 * b] as number);
    const dy = (p[3 * a + 1] as number) - (p[3 * b + 1] as number);
    const dz = (p[3 * a + 2] as number) - (p[3 * b + 2] as number);
    return dx * dx + dy * dy + dz * dz;
  }

  /** Adds a triangle, choosing the winding that agrees with the vertex normals. */
  orientedTriangle(a: number, b: number, c: number, region: number): void {
    if (a === b || b === c || a === c) return;
    const p = this.positions;
    const n = this.normals;
    const ux = (p[3 * b] as number) - (p[3 * a] as number);
    const uy = (p[3 * b + 1] as number) - (p[3 * a + 1] as number);
    const uz = (p[3 * b + 2] as number) - (p[3 * a + 2] as number);
    const vx = (p[3 * c] as number) - (p[3 * a] as number);
    const vy = (p[3 * c + 1] as number) - (p[3 * a + 1] as number);
    const vz = (p[3 * c + 2] as number) - (p[3 * a + 2] as number);
    const gx = uy * vz - uz * vy;
    const gy = uz * vx - ux * vz;
    const gz = ux * vy - uy * vx;
    const sx = (n[3 * a] as number) + (n[3 * b] as number) + (n[3 * c] as number);
    const sy = (n[3 * a + 1] as number) + (n[3 * b + 1] as number) + (n[3 * c + 1] as number);
    const sz = (n[3 * a + 2] as number) + (n[3 * b + 2] as number) + (n[3 * c + 2] as number);
    if (gx * sx + gy * sy + gz * sz >= 0) this.triangle(a, b, c, region);
    else this.triangle(a, c, b, region);
  }
}

// ---------------------------------------------------------------------------------------------
// Solids of revolution
// ---------------------------------------------------------------------------------------------

interface Sample {
  r: number;
  z: number;
  nr: number;
  nz: number;
}

interface SampledPiece {
  readonly piece: SectionPiece;
  readonly samples: Sample[];
}

/** Samples the pieces of a loop; consecutive pieces share their common point exactly. */
function sampleLoop(loop: SectionLoop, chordError: number, stretch: number): SampledPiece[] {
  const out: SampledPiece[] = [];
  let prev: Sample | undefined;
  for (const piece of loop.pieces) {
    const samples: Sample[] = [];
    if (piece.kind === 'line') {
      samples.push({ r: piece.r0, z: piece.z0, nr: piece.nr, nz: piece.nz });
      samples.push({ r: piece.r1, z: piece.z1, nr: piece.nr, nz: piece.nz });
    } else {
      const step = arcStep(piece.rho * stretch, chordError, MAX_FACET_ANGLE);
      const count = Math.max(1, Math.ceil((piece.th1 - piece.th0) / step - 1e-9));
      for (let i = 0; i <= count; i++) {
        const th = piece.th0 + ((piece.th1 - piece.th0) * i) / count;
        const c = Math.cos(th);
        const s = Math.sin(th);
        samples.push({ r: piece.cr + piece.rho * c, z: piece.cz + piece.rho * s, nr: c, nz: s });
      }
    }
    for (const s of samples) if (Math.abs(s.r) <= AXIS_TOLERANCE) s.r = 0;
    const first = samples[0] as Sample;
    if (
      prev !== undefined &&
      Math.hypot(prev.r - first.r, prev.z - first.z) <= SECTION_JOIN_TOLERANCE
    ) {
      first.r = prev.r;
      first.z = prev.z;
    }
    prev = samples[samples.length - 1] as Sample;
    out.push({ piece, samples });
  }
  // Close the loop: the last point of the last piece is the first point of the first piece.
  const head = (out[0] as SampledPiece).samples[0] as Sample;
  if (
    prev !== undefined &&
    Math.hypot(prev.r - head.r, prev.z - head.z) <= SECTION_JOIN_TOLERANCE
  ) {
    prev.r = head.r;
    prev.z = head.z;
  }
  return out;
}

/** Triangulates a simple counter-clockwise polygon by ear clipping; returns index triples. */
export function triangulatePolygon(points: readonly (readonly [number, number])[]): number[] {
  const n = points.length;
  const out: number[] = [];
  if (n < 3) return out;
  const cross = (a: number, b: number, c: number): number => {
    const pa = points[a] as readonly [number, number];
    const pb = points[b] as readonly [number, number];
    const pc = points[c] as readonly [number, number];
    return (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
  };
  let scale = 0;
  for (const p of points) scale = Math.max(scale, Math.abs(p[0]), Math.abs(p[1]));
  const eps = 1e-14 * scale * scale;
  const remaining = points.map((_, i) => i);
  let guard = 0;
  while (remaining.length > 3) {
    let clipped = false;
    const m = remaining.length;
    for (let i = 0; i < m; i++) {
      const a = remaining[(i + m - 1) % m] as number;
      const b = remaining[i] as number;
      const c = remaining[(i + 1) % m] as number;
      if (cross(a, b, c) <= eps) continue; // reflex or flat corner
      // No other vertex may lie in the closed triangle (a vertex on the diagonal would be
      // left as a T-junction).
      let blocked = false;
      for (let k = 0; k < m && !blocked; k++) {
        const q = remaining[k] as number;
        if (q === a || q === b || q === c) continue;
        const pq = points[q] as readonly [number, number];
        if (
          (pq[0] === (points[a] as readonly [number, number])[0] &&
            pq[1] === (points[a] as readonly [number, number])[1]) ||
          (pq[0] === (points[c] as readonly [number, number])[0] &&
            pq[1] === (points[c] as readonly [number, number])[1])
        ) {
          continue;
        }
        if (cross(a, b, q) >= -eps && cross(b, c, q) >= -eps && cross(c, a, q) >= -eps)
          blocked = true;
      }
      if (blocked) continue;
      out.push(a, b, c);
      remaining.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped || ++guard > 10 * n) {
      throw new Error('geometry: cannot triangulate the end face of a partial shell');
    }
  }
  out.push(remaining[0] as number, remaining[1] as number, remaining[2] as number);
  return out;
}

interface RevolveOptions {
  /** `null` for a full turn. */
  readonly arc: { phi0: number; phi1: number } | null;
  /** Sectors per full turn. */
  readonly sectors: number;
  readonly sx: number;
  readonly sy: number;
  readonly chordError: number;
  regionOf(side: PatchSide, s: number): number;
  /** Region of the flat end faces of a partial shell. */
  readonly capRegion: number;
}

function revolve(b: MeshBuilder, loops: readonly SectionLoop[], o: RevolveOptions): void {
  const full = o.arc === null;
  const phi0 = o.arc?.phi0 ?? 0;
  const span = full ? TWO_PI : (o.arc as { phi1: number }).phi1 - phi0;
  const count = full ? o.sectors : Math.max(1, Math.ceil((o.sectors * span) / TWO_PI - 1e-9));
  const ringSize = full ? count : count + 1;
  const cosines: number[] = [];
  const sines: number[] = [];
  for (let j = 0; j < ringSize; j++) {
    const phi = phi0 + (span * j) / count;
    cosines.push(Math.cos(phi));
    sines.push(Math.sin(phi));
  }
  const stretch = Math.max(1, o.sx, o.sy);
  // Adds the ring of one sample: `ringSize` vertices, or one vertex on the axis.
  const ring = (s: Sample): number => {
    if (s.r === 0) {
      let nx = 0;
      let ny = 0;
      if (!full) {
        // Average normal over the azimuth range.
        for (let j = 0; j < ringSize; j++) {
          nx += (s.nr * (cosines[j] as number)) / o.sx;
          ny += (s.nr * (sines[j] as number)) / o.sy;
        }
        nx /= ringSize;
        ny /= ringSize;
      }
      let nz = s.nz;
      if (full) nz = s.nz >= 0 ? 1 : -1;
      const len = Math.hypot(nx, ny, nz) || 1;
      return b.vertex(0, 0, s.z, nx / len, ny / len, nz / len);
    }
    const start = b.positions.length / 3;
    for (let j = 0; j < ringSize; j++) {
      const c = cosines[j] as number;
      const sn = sines[j] as number;
      // Normals transform by the inverse transpose of the stretch.
      const nx = (s.nr * c) / o.sx;
      const ny = (s.nr * sn) / o.sy;
      const len = Math.hypot(nx, ny, s.nz) || 1;
      b.vertex(o.sx * s.r * c, o.sy * s.r * sn, s.z, nx / len, ny / len, s.nz / len);
    }
    return start;
  };
  for (const loop of loops) {
    const sampled = sampleLoop(loop, o.chordError, stretch);
    for (const { piece, samples } of sampled) {
      const region = o.regionOf(piece.side, 0.5 * (piece.s0 + piece.s1));
      let prevStart = ring(samples[0] as Sample);
      let prevPole = (samples[0] as Sample).r === 0;
      for (let i = 1; i < samples.length; i++) {
        const cur = samples[i] as Sample;
        const curStart = ring(cur);
        const curPole = cur.r === 0;
        for (let j = 0; j < count; j++) {
          const j1 = full ? (j + 1) % count : j + 1;
          const a0 = prevPole ? prevStart : prevStart + j;
          const a1 = prevPole ? prevStart : prevStart + j1;
          const b0 = curPole ? curStart : curStart + j;
          const b1 = curPole ? curStart : curStart + j1;
          // Outward is (direction of increasing azimuth) x (direction of travel along the loop).
          b.triangle(a0, a1, b0, region);
          b.triangle(a1, b1, b0, region);
        }
        prevStart = curStart;
        prevPole = curPole;
      }
    }
    if (full) continue;
    // Flat end faces of a partial shell.
    const polygon: [number, number][] = [];
    for (const { samples } of sampled) {
      for (const s of samples) {
        const last = polygon[polygon.length - 1];
        if (last !== undefined && last[0] === s.r && last[1] === s.z) continue;
        polygon.push([s.r, s.z]);
      }
    }
    const firstPoint = polygon[0] as [number, number];
    const lastPoint = polygon[polygon.length - 1] as [number, number];
    if (polygon.length > 1 && firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1])
      polygon.pop();
    const triangles = triangulatePolygon(polygon);
    for (const end of [0, count]) {
      const c = cosines[end] as number;
      const sn = sines[end] as number;
      // The face at phi0 looks back along the azimuth, the face at phi1 forward.
      const sign = end === 0 ? -1 : 1;
      const nx = (-sign * sn) / o.sx;
      const ny = (sign * c) / o.sy;
      const len = Math.hypot(nx, ny);
      const start = b.positions.length / 3;
      for (const [r, z] of polygon) b.vertex(o.sx * r * c, o.sy * r * sn, z, nx / len, ny / len, 0);
      for (let k = 0; k < triangles.length; k += 3) {
        const i0 = triangles[k] as number;
        const i1 = triangles[k + 1] as number;
        const i2 = triangles[k + 2] as number;
        // A counter-clockwise triangle of the (r, z) plane faces backwards along the azimuth.
        if (end === 0) b.triangle(start + i0, start + i1, start + i2, o.capRegion);
        else b.triangle(start + i0, start + i2, start + i1, o.capRegion);
      }
    }
  }
}

function meshSor(
  b: MeshBuilder,
  prep: PreparedSor,
  options: Required<TessellationOptions>,
  cuts: readonly number[],
  regionOf: (side: PatchSide, s: number | undefined) => number,
): void {
  const section = prep.section();
  if (prep.arc !== null && section.loops.length !== 1) {
    throw new Error(
      'geometry: a partial shell whose cross-section encloses a void cannot be meshed',
    );
  }
  const loops = section.loops.map((loop) => splitLoopAtArcLengths(loop, cuts));
  const stretch = Math.max(prep.sx, prep.sy);
  // Half the chord error is spent around the axis and half along the profile (see the module
  // comment), so the sector count is that of the platform rule at chordError / 2.
  const budget = options.chordError / 2;
  revolve(b, loops, {
    arc: prep.arc,
    sectors: sectorCount(section.rMax * stretch, budget, options.minSectors),
    sx: prep.sx,
    sy: prep.sy,
    chordError: budget,
    regionOf,
    capRegion: regionOf('none', undefined),
  });
}

/** Orthonormal frame whose third axis is the unit vector `e` (deterministic choice of the others). */
function frameAlong(e: Vec3): [Vec3, Vec3] {
  const ax = Math.abs(e[0]);
  const ay = Math.abs(e[1]);
  const az = Math.abs(e[2]);
  // Cross with the coordinate axis along which e is smallest.
  let u: Vec3;
  if (ax <= ay && ax <= az) u = [0, e[2], -e[1]];
  else if (ay <= az) u = [-e[2], 0, e[0]];
  else u = [e[1], -e[0], 0];
  const len = Math.hypot(u[0], u[1], u[2]);
  u = [u[0] / len, u[1] / len, u[2] / len];
  const v: Vec3 = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]];
  return [u, v];
}

/** Meshes the capsule from `a` to `b` (local frame of the builder's current frame `m`, `t`). */
function meshCapsule(
  b: MeshBuilder,
  partM: readonly number[],
  partT: Vec3,
  a: Vec3,
  c: Vec3,
  radius: number,
  chordError: number,
  region: number,
): void {
  const ex = c[0] - a[0];
  const ey = c[1] - a[1];
  const ez = c[2] - a[2];
  const length = Math.hypot(ex, ey, ez);
  const e: Vec3 = length > 0 ? [ex / length, ey / length, ez / length] : [0, 0, 1];
  const [u, v] = frameAlong(e);
  // Capsule frame (columns u, v, e; origin at the middle) composed with the part frame.
  const mid: Vec3 = [0.5 * (a[0] + c[0]), 0.5 * (a[1] + c[1]), 0.5 * (a[2] + c[2])];
  const local = [u[0], v[0], e[0], u[1], v[1], e[1], u[2], v[2], e[2]];
  const m: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      m.push(
        (partM[3 * i] as number) * (local[j] as number) +
          (partM[3 * i + 1] as number) * (local[3 + j] as number) +
          (partM[3 * i + 2] as number) * (local[6 + j] as number),
      );
    }
  }
  const t: Vec3 = [
    partT[0] +
      (partM[0] as number) * mid[0] +
      (partM[1] as number) * mid[1] +
      (partM[2] as number) * mid[2],
    partT[1] +
      (partM[3] as number) * mid[0] +
      (partM[4] as number) * mid[1] +
      (partM[5] as number) * mid[2],
    partT[2] +
      (partM[6] as number) * mid[0] +
      (partM[7] as number) * mid[1] +
      (partM[8] as number) * mid[2],
  ];
  b.setFrame(m, t);
  const half = 0.5 * length;
  const pieces: SectionPiece[] = [
    {
      kind: 'arc',
      cr: 0,
      cz: -half,
      rho: radius,
      th0: -Math.PI / 2,
      th1: 0,
      side: 'out',
      s0: 0,
      s1: 0,
      vertex: 0,
    },
  ];
  if (length > 0) {
    pieces.push({
      kind: 'line',
      r0: radius,
      z0: -half,
      r1: radius,
      z1: half,
      nr: 1,
      nz: 0,
      side: 'out',
      s0: 0,
      s1: 1,
      segment: 0,
    });
  }
  pieces.push({
    kind: 'arc',
    cr: 0,
    cz: half,
    rho: radius,
    th0: 0,
    th1: Math.PI / 2,
    side: 'out',
    s0: 1,
    s1: 1,
    vertex: 1,
  });
  revolve(b, [{ pieces }], {
    arc: null,
    sectors: sectorCount(radius, chordError / 2, CAPSULE_MIN_SECTORS),
    sx: 1,
    sy: 1,
    chordError: chordError / 2,
    regionOf: () => region,
    capRegion: region,
  });
  b.setFrame(partM, partT);
}

// ---------------------------------------------------------------------------------------------
// Polytope + ball
// ---------------------------------------------------------------------------------------------

function meshPolytope(
  b: MeshBuilder,
  core: Polytope,
  radius: number,
  chordError: number,
  regionOf: (side: PatchSide) => number,
): void {
  const vertices = core.vertices;
  const regionOfNormal = (n: Vec3): number => regionOf(sideOfNormalZ(n[2]));
  const at = (v: number, dir: Vec3): number => {
    const p = vertices[v] as Vec3;
    return b.vertex(
      p[0] + radius * dir[0],
      p[1] + radius * dir[1],
      p[2] + radius * dir[2],
      dir[0],
      dir[1],
      dir[2],
    );
  };
  if (!(radius > 0)) {
    // Sharp polytope: flat faces only, each with its own vertices.
    for (const face of core.faces) {
      const idx = face.loop.map((v) => at(v, face.normal));
      const region = regionOfNormal(face.normal);
      for (let i = 1; i + 1 < idx.length; i++)
        b.triangle(idx[0] as number, idx[i] as number, idx[i + 1] as number, region);
    }
    return;
  }
  // Corner vertices: one per (face, vertex), shared by the face, two strips and a patch.
  const corner = new Map<number, number>();
  const nv = vertices.length;
  const cornerOf = (f: number, v: number): number => {
    const key = f * nv + v;
    let index = corner.get(key);
    if (index === undefined) {
      index = at(v, (core.faces[f] as PolyFace).normal);
      corner.set(key, index);
    }
    return index;
  };
  core.faces.forEach((face, f) => {
    const idx = face.loop.map((v) => cornerOf(f, v));
    const region = regionOfNormal(face.normal);
    for (let i = 1; i + 1 < idx.length; i++)
      b.triangle(idx[0] as number, idx[i] as number, idx[i + 1] as number, region);
  });
  // Half the chord error per direction of curvature: the vertex patches curve both ways.
  const step = arcStep(radius, chordError / 2, MAX_FACET_ANGLE);
  // Per edge: the rings of vertices at its two ends, along the arc from face0 to face1.
  const ringA: number[][] = [];
  const ringB: number[][] = [];
  const dirs: Vec3[][] = [];
  core.edges.forEach((edge: PolyEdge) => {
    let k = Math.max(1, Math.ceil(edge.angle / step - 1e-9));
    // The edge of a flat plate is a half cylinder: an even count puts a row of vertices on its
    // crest, so that no facet straddles the line between the plate's two sides.
    if (edge.angle > Math.PI - 1e-9 && k % 2 === 1) k += 1;
    const ra: number[] = [cornerOf(edge.face0, edge.a)];
    const rb: number[] = [cornerOf(edge.face0, edge.b)];
    const ds: Vec3[] = [(core.faces[edge.face0] as PolyFace).normal];
    for (let j = 1; j < k; j++) {
      const dir = edgeArcDirection(edge, (edge.angle * j) / k);
      ds.push(dir);
      ra.push(at(edge.a, dir));
      rb.push(at(edge.b, dir));
    }
    ra.push(cornerOf(edge.face1, edge.a));
    rb.push(cornerOf(edge.face1, edge.b));
    ds.push((core.faces[edge.face1] as PolyFace).normal);
    for (let j = 0; j < k; j++) {
      const d0 = ds[j] as Vec3;
      const d1 = ds[j + 1] as Vec3;
      const region = regionOfNormal([d0[0] + d1[0], d0[1] + d1[1], d0[2] + d1[2]]);
      b.orientedTriangle(ra[j] as number, rb[j] as number, rb[j + 1] as number, region);
      b.orientedTriangle(ra[j] as number, rb[j + 1] as number, ra[j + 1] as number, region);
    }
    ringA.push(ra);
    ringB.push(rb);
    dirs.push(ds);
  });
  // Spherical patch at every vertex: a fan of rings from the middle of the normal cone.
  for (let v = 0; v < nv; v++) {
    const boundary: number[] = [];
    const boundaryDirs: Vec3[] = [];
    for (const fanStep of core.fans[v] as readonly { edge: number; reversed: boolean }[]) {
      const edge = core.edges[fanStep.edge] as PolyEdge;
      const ringAtV =
        edge.a === v ? (ringA[fanStep.edge] as number[]) : (ringB[fanStep.edge] as number[]);
      const ds = dirs[fanStep.edge] as Vec3[];
      const k = ringAtV.length - 1;
      // Every point of the arc except its last, which starts the next arc.
      for (let j = 0; j < k; j++) {
        const jj = fanStep.reversed ? k - j : j;
        boundary.push(ringAtV[jj] as number);
        boundaryDirs.push(ds[jj] as Vec3);
      }
    }
    const m = boundary.length;
    if (m < 3) continue;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const dir of boundaryDirs) {
      cx += dir[0];
      cy += dir[1];
      cz += dir[2];
    }
    const clen = Math.hypot(cx, cy, cz);
    if (!(clen > 1e-12)) continue;
    const centre: Vec3 = [cx / clen, cy / clen, cz / clen];
    let widest = 0;
    for (const dir of boundaryDirs) {
      const dot = Math.min(
        1,
        Math.max(-1, dir[0] * centre[0] + dir[1] * centre[1] + dir[2] * centre[2]),
      );
      widest = Math.max(widest, Math.acos(dot));
    }
    const levels = Math.max(1, Math.ceil(widest / step - 1e-9));
    const centreIndex = at(v, centre);
    // Ring `l` runs from the centre (l = 0) to the boundary (l = levels).
    let inner: number[] | null = null;
    let innerDirs: Vec3[] = [];
    const regionOf3 = (d0: Vec3, d1: Vec3, d2: Vec3): number =>
      regionOfNormal([d0[0] + d1[0] + d2[0], d0[1] + d1[1] + d2[1], d0[2] + d1[2] + d2[2]]);
    for (let l = 1; l <= levels; l++) {
      let ringIdx: number[];
      let ringDirs: Vec3[];
      if (l === levels) {
        ringIdx = boundary;
        ringDirs = boundaryDirs;
      } else {
        ringIdx = [];
        ringDirs = [];
        const f = l / levels;
        for (const dir of boundaryDirs) {
          // Spherical interpolation from the centre towards the boundary direction.
          const dot = Math.min(
            1,
            Math.max(-1, dir[0] * centre[0] + dir[1] * centre[1] + dir[2] * centre[2]),
          );
          const omega = Math.acos(dot);
          let d: Vec3;
          if (omega < 1e-9) {
            d = centre;
          } else {
            const s0 = Math.sin((1 - f) * omega) / Math.sin(omega);
            const s1 = Math.sin(f * omega) / Math.sin(omega);
            d = [
              s0 * centre[0] + s1 * dir[0],
              s0 * centre[1] + s1 * dir[1],
              s0 * centre[2] + s1 * dir[2],
            ];
          }
          ringDirs.push(d);
          ringIdx.push(at(v, d));
        }
      }
      for (let i = 0; i < m; i++) {
        const i1 = (i + 1) % m;
        const d0 = ringDirs[i] as Vec3;
        const d1 = ringDirs[i1] as Vec3;
        const r0 = ringIdx[i] as number;
        const r1 = ringIdx[i1] as number;
        if (inner === null) {
          b.orientedTriangle(centreIndex, r0, r1, regionOf3(centre, d0, d1));
          continue;
        }
        const n0 = inner[i] as number;
        const n1 = inner[i1] as number;
        const e0 = innerDirs[i] as Vec3;
        const e1 = innerDirs[i1] as Vec3;
        // Split the quad along its shorter diagonal: the rays from the centre are skewed against
        // the boundary near a corner of the patch, and the long diagonal would double the sagitta.
        if (b.distanceSquared(n0, r1) <= b.distanceSquared(r0, n1)) {
          b.orientedTriangle(n0, r0, r1, regionOf3(e0, d0, d1));
          b.orientedTriangle(n0, r1, n1, regionOf3(e0, d1, e1));
        } else {
          b.orientedTriangle(n0, r0, n1, regionOf3(e0, d0, e1));
          b.orientedTriangle(r0, r1, n1, regionOf3(d0, d1, e1));
        }
      }
      inner = ringIdx;
      innerDirs = ringDirs;
    }
  }
}

function meshCore(
  b: MeshBuilder,
  partM: readonly number[],
  partT: Vec3,
  core: ConvexCore,
  radius: number,
  chordError: number,
  regionOf: (side: PatchSide) => number,
): void {
  if (core.dim === 0)
    meshCapsule(b, partM, partT, core.centre, core.centre, radius, chordError, regionOf('none'));
  else if (core.dim === 1)
    meshCapsule(b, partM, partT, core.a, core.b, radius, chordError, regionOf('none'));
  else meshPolytope(b, core, radius, chordError, regionOf);
}

/** Checks tessellation options and fills in the defaults. */
export function resolveTessellation(options: TessellationOptions): Required<TessellationOptions> {
  const minSectors = options.minSectors ?? DEFAULT_MIN_SECTORS;
  // sectorCount validates both values.
  sectorCount(1, options.chordError, minSectors);
  return {
    chordError: options.chordError,
    minSectors,
    roundSurfaces: options.roundSurfaces ?? true,
  };
}

/**
 * `buildRenderMesh(shape, { chordError })`: indexed triangle mesh of a shape in the item frame,
 * with unit outward vertex normals and, per triangle, the index of its part and of its surface
 * region (-1 when it is in none). See the module comment for the guarantees.
 */
export function buildRenderMesh(shape: Shape, options: TessellationOptions): RenderMesh {
  const rules = shapeRegionRules(shape);
  const resolved = resolveTessellation(options);
  if (shape.parts.length > 65535)
    throw new RangeError('geometry: too many parts for a render mesh');
  const b = new MeshBuilder();
  shape.parts.forEach((part: Part, partIndex) => {
    const prep = preparePrimitive(part.prim);
    const m = quatToMat3(part.pose.q);
    b.part = partIndex;
    b.setFrame(m, part.pose.p);
    switch (prep.kind) {
      case 'sor':
        meshSor(b, prep, resolved, rules.arcLengthCuts(partIndex), (side, s) =>
          rules.regionOf(partIndex, side, s),
        );
        break;
      case 'capsule':
        meshCapsule(
          b,
          m,
          part.pose.p,
          prep.a,
          prep.b,
          prep.radius,
          resolved.chordError,
          rules.regionOf(partIndex, 'none', undefined),
        );
        break;
      case 'rbox':
        meshCore(b, m, part.pose.p, prep.core(), prep.radius, resolved.chordError, (side) =>
          rules.regionOf(partIndex, side, undefined),
        );
        break;
      case 'hull':
        meshCore(b, m, part.pose.p, prep.core, prep.radius, resolved.chordError, (side) =>
          rules.regionOf(partIndex, side, undefined),
        );
        break;
    }
  });
  return {
    positions: Float32Array.from(b.positions),
    normals: Float32Array.from(b.normals),
    indices: Uint32Array.from(b.indices),
    triPart: Uint16Array.from(b.triPart),
    triRegion: Int16Array.from(b.triRegion),
    partIds: shape.parts.map((p) => p.id),
    regionIds: shape.regions.map((r) => r.id),
  };
}
