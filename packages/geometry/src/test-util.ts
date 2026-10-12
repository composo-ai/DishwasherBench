/**
 * Helpers for this package's tests only (not exported from the package entry point).
 *
 * Random inputs come from mulberry32, so that test inputs are deterministic and unrelated to the
 * generator in `@spotless/core`.
 */

import type { Pose, Quat, Vec3 } from '@spotless/core';
import { POSE_IDENTITY, v3Cross, v3Length, v3Sub } from '@spotless/core';
import { buildRenderMesh } from './mesh.ts';
import { signedDistance } from './sdf.ts';
import { collisionSolids } from './collision.ts';
import type { CollisionPiece, CollisionSolid, Primitive, Shape, SorProfilePoint } from './types.ts';

/** A deterministic source of test inputs. */
export interface TestRandom {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number;
  /** Vector with each component uniform in [-scale, scale). */
  vec3(scale?: number): Vec3;
  /** Unit vector, uniformly distributed on the sphere. */
  unitVec3(): Vec3;
  /** Unit quaternion, uniformly distributed over rotations. */
  unitQuat(): Quat;
}

/** Creates a mulberry32-based source of test inputs from a 32-bit seed. */
export function testRandom(seed: number): TestRandom {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (lo: number, hi: number): number => lo + (hi - lo) * next();
  const gaussian = (): number =>
    Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return {
    next,
    range,
    vec3: (scale = 1) => [range(-scale, scale), range(-scale, scale), range(-scale, scale)],
    unitVec3: () => {
      for (;;) {
        const v: Vec3 = [gaussian(), gaussian(), gaussian()];
        const len = Math.hypot(v[0], v[1], v[2]);
        if (len > 1e-6) return [v[0] / len, v[1] / len, v[2] / len];
      }
    },
    unitQuat: () => {
      for (;;) {
        const q: Quat = [gaussian(), gaussian(), gaussian(), gaussian()];
        const len = Math.hypot(q[0], q[1], q[2], q[3]);
        if (len > 1e-6) return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
      }
    },
  };
}

/** Builds a profile in metres from `[r, z, t]` triples in millimetres. */
export function profileMm(
  points: readonly (readonly [number, number, number])[],
): SorProfilePoint[] {
  return points.map(([r, z, t]) => ({ r: r / 1000, z: z / 1000, t: t / 1000 }));
}

/**
 * Starting profiles of docs/research/items.md section 10.2 (mid-surface polylines, mm: r, z, t).
 * All [ESTIMATED] in the dossier: fitted to the outer dimensions and mass of section 10.1.
 */
export const DOSSIER_PROFILES_MM = {
  /** Dinner plate, IEC type (item 1). */
  plateIec: [
    [0, 3, 4.2],
    [85, 3, 4.2],
    [98, 9, 4.2],
    [130, 24, 4.2],
  ],
  /** IKEA 365+ plate 27 cm (item 2). */
  plate270: [
    [0, 4, 5.2],
    [88, 4, 5.2],
    [100, 10, 5.2],
    [135, 27, 5.2],
  ],
  /** Cereal bowl 16 cm (item 10). */
  bowl160: [
    [0, 3, 5],
    [40, 3, 5],
    [62, 20, 5],
    [76, 45, 5],
    [80, 68, 5],
  ],
  /** Mug, ceramic 300 ml (item 18). */
  mug: [
    [0, 2.5, 5],
    [36, 2.5, 5],
    [38, 6, 4.2],
    [40, 100, 4.2],
  ],
  /** Duralex Picardie 250 ml tumbler (item 27): thick base, tapering wall. */
  tumbler: [
    [0, 3.5, 7],
    [27, 3.5, 7],
    [29, 8, 4],
    [40, 60, 3],
    [43.5, 90, 3],
  ],
  /** Pint glass (item 32). */
  pint: [
    [0, 6.5, 13],
    [28, 6.5, 13],
    [30, 14, 4.5],
    [44.5, 149, 3.4],
  ],
  /** Bowl of the 540 ml wine glass (item 33); it starts off the axis, on top of the stem. */
  wineBowl: [
    [4, 120, 3],
    [30, 128, 1.6],
    [46, 165, 1.1],
    [44, 200, 1.0],
    [33, 244, 0.9],
  ],
  /** Glass lid (item 76): a dome, highest on the axis. */
  lid: [
    [0, 22, 4],
    [60, 18, 4],
    [110, 6, 4],
    [118, 2, 4],
  ],
} as const satisfies Record<string, readonly (readonly [number, number, number])[]>;

/**
 * Integral of `weight(r, z)` over the planar set `{ sd(r, z) <= 0, r >= 0 }` by adaptive
 * subdivision of the box `[r0, r1] x [z0, z1]`. `sd` must never exceed the true distance to the
 * set in magnitude (any signed distance bound qualifies): a cell whose centre is further than
 * its half diagonal from the boundary is entirely inside or outside and is integrated exactly
 * for weights of degree up to 3 (a 2x2 Gauss rule); the rest are subdivided down to `minCell`,
 * where the centre decides. The error is at most about `perimeter * minCell * max(weight)`.
 */
export function integrateRegion(
  sd: (r: number, z: number) => number,
  weight: (r: number, z: number) => number,
  box: readonly [r0: number, z0: number, r1: number, z1: number],
  minCell: number,
): number {
  const g = 0.5 / Math.sqrt(3);
  const cell = (r0: number, z0: number, r1: number, z1: number): number => {
    const cr = 0.5 * (r0 + r1);
    const cz = 0.5 * (z0 + z1);
    const wr = r1 - r0;
    const wz = z1 - z0;
    const d = sd(cr, cz);
    const half = 0.5 * Math.hypot(wr, wz);
    if (d > half) return 0;
    const whole = (): number =>
      0.25 *
      wr *
      wz *
      (weight(cr - g * wr, cz - g * wz) +
        weight(cr + g * wr, cz - g * wz) +
        weight(cr - g * wr, cz + g * wz) +
        weight(cr + g * wr, cz + g * wz));
    if (d < -half) return whole();
    if (Math.max(wr, wz) <= minCell) return d <= 0 ? whole() : 0;
    return (
      cell(r0, z0, cr, cz) + cell(cr, z0, r1, cz) + cell(r0, cz, cr, z1) + cell(cr, cz, r1, z1)
    );
  };
  return cell(Math.max(0, box[0]), box[1], box[2], box[3]);
}

/** A shape of one part at the given pose (identity by default). */
export function singlePart(
  prim: Primitive,
  pose: { readonly p: Vec3; readonly q: Quat } = { p: [0, 0, 0], q: [0, 0, 0, 1] },
): Shape {
  return { parts: [{ id: 'body', prim, pose, material: 'test' }], regions: [] };
}

/** One primitive of every kind and variant, for tests that sweep over all of them. */
export function testPrimitives(): Record<string, Primitive> {
  return {
    plate: { kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.plateIec) },
    bowl: { kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.bowl160) },
    tumbler: { kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.tumbler) },
    wineBowl: { kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.wineBowl) },
    lid: { kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.lid) },
    // A solid cone tip: the inner surface meets the axis in an apex.
    cone: {
      kind: 'sor',
      profile: profileMm([
        [0, 0, 2],
        [10, 10, 2],
      ]),
    },
    // A foot ring: a short wall that never touches the axis.
    ring: {
      kind: 'sor',
      profile: profileMm([
        [30, 2, 4],
        [30, 6, 4],
      ]),
    },
    // A knob on a post: the first segment lies on the axis.
    post: {
      kind: 'sor',
      profile: profileMm([
        [0, 4, 8],
        [0, 30, 8],
        [20, 30, 6],
      ]),
    },
    // A rim rolled over until it meets the wall again: the cross-section has a hole.
    rolledRim: {
      kind: 'sor',
      profile: profileMm([
        [0, 0.5, 1],
        [30, 0.5, 1],
        [30, 40, 1],
        [34, 44, 1],
        [38, 40, 1],
        [34, 36, 1],
        [30.3, 38.5, 1],
      ]),
    },
    // A closed vessel: both ends on the axis, so the wall encloses a void.
    bulb: {
      kind: 'sor',
      profile: profileMm([
        [0, 2, 3],
        [22, 12, 3],
        [22, 34, 2],
        [0, 44, 2],
      ]),
    },
    oval: {
      kind: 'sor',
      profile: profileMm([
        [0, 2, 3],
        [30, 2, 3],
        [45, 12, 3],
      ]),
      scaleXY: [1.3, 0.8],
    },
    fillet: {
      kind: 'sor',
      profile: profileMm([
        [0, 1, 2],
        [19, 1, 2],
        [19, 40, 2],
      ]),
      arc: [0, Math.PI / 2],
    },
    capsule: { kind: 'capsule', a: [0, 0, 0], b: [0.03, 0.01, 0.02], radius: 0.004 },
    sphere: { kind: 'capsule', a: [0.01, 0, 0], b: [0.01, 0, 0], radius: 0.01 },
    rbox: { kind: 'rbox', halfExtents: [0.03, 0.02, 0.005], radius: 0.003 },
    sharpBox: { kind: 'rbox', halfExtents: [0.03, 0.02, 0.005], radius: 0 },
    flatBox: { kind: 'rbox', halfExtents: [0.03, 0.02, 0], radius: 0.002 },
    hull: {
      kind: 'hull',
      points: [
        [0, 0, 0],
        [0.03, 0, 0],
        [0, 0.02, 0],
        [0, 0, 0.025],
        [0.02, 0.02, 0.01],
      ],
      radius: 0.002,
    },
    wedge: {
      kind: 'hull',
      points: [
        [0, 0.009, 0.0008],
        [0, 0.009, -0.0008],
        [0, -0.009, 0],
        [0.08, 0.009, 0.0008],
        [0.08, 0.009, -0.0008],
        [0.08, -0.009, 0],
      ],
      radius: 0.0002,
    },
    triangle: {
      kind: 'hull',
      points: [
        [0, 0, 0],
        [0.03, 0.004, 0.002],
        [0.008, 0.025, -0.003],
      ],
      radius: 0.002,
    },
    hullSegment: {
      kind: 'hull',
      points: [
        [0, 0, 0],
        [0.03, 0, 0],
      ],
      radius: 0.002,
    },
  };
}

/** The primitive (in the item frame) whose solid is one collision piece. */
export function pieceShape(piece: CollisionSolid): { prim: Primitive; pose: Pose } {
  switch (piece.kind) {
    case 'hull':
      return {
        prim: { kind: 'hull', points: piece.points, radius: piece.radius },
        pose: POSE_IDENTITY,
      };
    case 'capsule':
      return {
        prim: { kind: 'capsule', a: piece.a, b: piece.b, radius: piece.radius },
        pose: POSE_IDENTITY,
      };
    case 'box':
      return {
        prim: { kind: 'rbox', halfExtents: piece.halfExtents, radius: piece.radius },
        pose: piece.pose,
      };
  }
}

/** A collision piece as a one-part shape, with a sphere that contains it. */
interface PieceBall {
  readonly shape: Shape;
  readonly centre: Vec3;
  readonly radius: number;
}

function pieceBall(piece: CollisionSolid): PieceBall {
  const { prim, pose } = pieceShape(piece);
  const shape = singlePart(prim, pose);
  let points: readonly Vec3[];
  let reach = piece.radius;
  if (piece.kind === 'hull') points = piece.points;
  else if (piece.kind === 'capsule') points = [piece.a, piece.b];
  else {
    points = [piece.pose.p];
    reach += Math.hypot(piece.halfExtents[0], piece.halfExtents[1], piece.halfExtents[2]);
  }
  const centre: [number, number, number] = [0, 0, 0];
  for (const q of points)
    for (let k = 0; k < 3; k++)
      centre[k] = (centre[k] as number) + (q[k] as number) / points.length;
  let radius = 0;
  for (const q of points)
    radius = Math.max(radius, Math.hypot(q[0] - centre[0], q[1] - centre[1], q[2] - centre[2]));
  return { shape, centre, radius: radius + reach };
}

/** Signed distance to the union of the pieces, optionally leaving one piece out. */
function unionDistance(balls: readonly PieceBall[], p: Vec3, skip = -1): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < balls.length; i++) {
    if (i === skip) continue;
    const ball = balls[i] as PieceBall;
    // A piece whose bounding sphere is further than the best so far cannot be nearer.
    const bound =
      Math.hypot(p[0] - ball.centre[0], p[1] - ball.centre[1], p[2] - ball.centre[2]) - ball.radius;
    if (bound >= best) continue;
    const d = signedDistance(ball.shape, p);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Points exactly on the surface of a piece. A rounded planar polygon is sampled analytically (a
 * grid on both faces and on the half cylinder along every edge); other pieces through the
 * vertices of a fine mesh.
 */
function pieceSurfaceSamples(piece: CollisionSolid): Vec3[] {
  const out: Vec3[] = [];
  if (piece.kind === 'hull' && (piece.points.length === 3 || piece.points.length === 4)) {
    const pts = piece.points;
    const p0 = pts[0] as Vec3;
    const raw = v3Cross(v3Sub(pts[1] as Vec3, p0), v3Sub(pts[2] as Vec3, p0));
    const n: Vec3 = [raw[0] / v3Length(raw), raw[1] / v3Length(raw), raw[2] / v3Length(raw)];
    const r = piece.radius;
    const steps = 6;
    // Both faces: a fan of sub-triangles from the first point.
    for (let k = 1; k + 1 < pts.length; k++) {
      const a = pts[k] as Vec3;
      const b = pts[k + 1] as Vec3;
      for (let i = 0; i <= steps; i++) {
        for (let j = 0; i + j <= steps; j++) {
          const u = i / steps;
          const w = j / steps;
          const q: Vec3 = [
            p0[0] + u * (a[0] - p0[0]) + w * (b[0] - p0[0]),
            p0[1] + u * (a[1] - p0[1]) + w * (b[1] - p0[1]),
            p0[2] + u * (a[2] - p0[2]) + w * (b[2] - p0[2]),
          ];
          for (const side of [-1, 1])
            out.push([q[0] + side * r * n[0], q[1] + side * r * n[1], q[2] + side * r * n[2]]);
        }
      }
    }
    // The rounded edges.
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k] as Vec3;
      const b = pts[(k + 1) % pts.length] as Vec3;
      const e = v3Sub(b, a);
      const o = v3Cross(e, n);
      const ol = v3Length(o);
      for (let i = 0; i <= steps; i++) {
        for (let j = 1; j < steps; j++) {
          const alpha = (Math.PI * j) / steps;
          const c = Math.cos(alpha);
          const sn = Math.sin(alpha);
          out.push([
            a[0] + (i / steps) * e[0] + r * (c * n[0] + (sn * o[0]) / ol),
            a[1] + (i / steps) * e[1] + r * (c * n[1] + (sn * o[1]) / ol),
            a[2] + (i / steps) * e[2] + r * (c * n[2] + (sn * o[2]) / ol),
          ]);
        }
      }
    }
    return out;
  }
  const { prim, pose } = pieceShape(piece);
  const mesh = buildRenderMesh(singlePart(prim, pose), { chordError: 0.00002 });
  for (let v = 0; v < mesh.positions.length / 3; v++) {
    out.push([
      mesh.positions[3 * v] as number,
      mesh.positions[3 * v + 1] as number,
      mesh.positions[3 * v + 2] as number,
    ]);
  }
  return out;
}

/**
 * Largest distance between the surface of the union of the pieces and the true surface of the
 * shape, measured both ways: (a) at points sampled on every piece that are not inside another
 * piece, the true signed distance; (b) at points of the true surface (vertices of a fine render
 * mesh that are not inside another part), the signed distance to the union of the pieces. Round
 * rolling surfaces are not part of the solid and are left out.
 */
export function surfaceGap(
  shape: Shape,
  allPieces: readonly CollisionPiece[],
): { piecesToTrue: number; trueToPieces: number; samples: number } {
  const pieces = collisionSolids(allPieces);
  const balls = pieces.map(pieceBall);
  let piecesToTrue = 0;
  let samples = 0;
  pieces.forEach((piece, i) => {
    for (const p of pieceSurfaceSamples(piece)) {
      if (unionDistance(balls, p, i) < -1e-7) continue; // buried in a neighbouring piece
      piecesToTrue = Math.max(piecesToTrue, Math.abs(signedDistance(shape, p)));
      samples++;
    }
  });
  let trueToPieces = 0;
  const surface = buildRenderMesh(shape, { chordError: 0.00005 });
  for (let v = 0; v < surface.positions.length / 3; v += 3) {
    const p: Vec3 = [
      surface.positions[3 * v] as number,
      surface.positions[3 * v + 1] as number,
      surface.positions[3 * v + 2] as number,
    ];
    if (signedDistance(shape, p) < -1e-6) continue; // on a part's surface but inside another part
    trueToPieces = Math.max(trueToPieces, Math.abs(unionDistance(balls, p)));
  }
  return { piecesToTrue, trueToPieces, samples };
}
