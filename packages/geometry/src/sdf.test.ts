import {
  POSE_IDENTITY,
  poseTransformPoint,
  poseTransformVector,
  quatFromAxisAngle,
  v3Add,
  v3Cross,
  v3Dot,
  v3Length,
  v3Scale,
  v3Sub,
  type Pose,
  type Vec3,
} from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { preparePrimitive } from './prepared.ts';
import {
  primitiveSignedDistance,
  primitiveSignedDistanceGradient,
  sampleSignedDistance,
  signedDistance,
  signedDistanceGradient,
} from './sdf.ts';
import { DOSSIER_PROFILES_MM, profileMm, testPrimitives, testRandom } from './test-util.ts';
import type { Part, Primitive, Shape, SorPrimitive, SorProfilePoint } from './types.ts';

function sor(
  points: readonly (readonly [number, number, number])[],
  extra: Partial<SorPrimitive> = {},
): SorPrimitive {
  return { kind: 'sor', profile: profileMm(points), ...extra };
}

/**
 * Brute force for a full, unscaled shell: the smallest `|p - c| - t(c) / 2` over mid-surface
 * points `c` sampled on a grid of the given spacing in arc length and around the axis.
 */
function bruteShell(
  profile: readonly SorProfilePoint[],
  p: Vec3,
  spacing: number,
  arc?: readonly [number, number],
): number {
  let best = Number.POSITIVE_INFINITY;
  const [phi0, phi1] = arc ?? [0, 2 * Math.PI];
  for (let i = 0; i + 1 < profile.length; i++) {
    const a = profile[i] as SorProfilePoint;
    const b = profile[i + 1] as SorProfilePoint;
    const ns = Math.max(1, Math.ceil(Math.hypot(b.r - a.r, b.z - a.z) / spacing));
    for (let j = 0; j <= ns; j++) {
      const l = j / ns;
      const r = a.r + l * (b.r - a.r);
      const z = a.z + l * (b.z - a.z);
      const rho = (a.t + l * (b.t - a.t)) / 2;
      const nphi = Math.max(1, Math.ceil((r * (phi1 - phi0)) / spacing));
      for (let k = 0; k <= nphi; k++) {
        const phi = phi0 + ((phi1 - phi0) * k) / nphi;
        const d = Math.hypot(p[0] - r * Math.cos(phi), p[1] - r * Math.sin(phi), p[2] - z) - rho;
        if (d < best) best = d;
      }
    }
  }
  return best;
}

/** Central finite-difference gradient of a scalar field. */
function numericGradient(f: (p: Vec3) => number, p: Vec3, h: number): Vec3 {
  return [
    (f([p[0] + h, p[1], p[2]]) - f([p[0] - h, p[1], p[2]])) / (2 * h),
    (f([p[0], p[1] + h, p[2]]) - f([p[0], p[1] - h, p[2]])) / (2 * h),
    (f([p[0], p[1], p[2] + h]) - f([p[0], p[1], p[2] - h])) / (2 * h),
  ];
}

/** Nearest point of the triangle `abc` to `p` (Ericson, Real-Time Collision Detection 5.1.5). */
function closestOnTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ab = v3Sub(b, a);
  const ac = v3Sub(c, a);
  const ap = v3Sub(p, a);
  const d1 = v3Dot(ab, ap);
  const d2 = v3Dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = v3Sub(p, b);
  const d3 = v3Dot(ab, bp);
  const d4 = v3Dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return v3Add(a, v3Scale(ab, d1 / (d1 - d3)));
  const cp = v3Sub(p, c);
  const d5 = v3Dot(ab, cp);
  const d6 = v3Dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return v3Add(a, v3Scale(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return v3Add(b, v3Scale(v3Sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6))));
  }
  const denom = 1 / (va + vb + vc);
  return v3Add(a, v3Add(v3Scale(ab, vb * denom), v3Scale(ac, vc * denom)));
}

describe('signed distance: shells of revolution against closed forms', () => {
  it('a wall segment on the axis is a capsule, and its ends are spheres (1e-15 m)', () => {
    // Profile (0, 0) to (0, 30) mm with t = 8 mm: a solid capsule of radius 4 mm about the axis.
    const prim = sor([
      [0, 0, 8],
      [0, 30, 8],
    ]);
    const rnd = testRandom(11);
    for (let i = 0; i < 500; i++) {
      const p = rnd.vec3(0.05);
      const zc = Math.min(0.03, Math.max(0, p[2]));
      const expected = Math.hypot(p[0], p[1], p[2] - zc) - 0.004;
      expect(primitiveSignedDistance(prim, p)).toBeCloseTo(expected, 15);
    }
    // Below the lower end the solid is a sphere of radius 4 mm about the origin.
    expect(primitiveSignedDistance(prim, [0.006, 0, -0.008])).toBeCloseTo(0.01 - 0.004, 15);
  });

  it('cylinder shell: distance to the mid-surface cylinder minus t / 2 (1e-15 m)', () => {
    // R = 40 mm, z from 10 to 90 mm, t = 3 mm.
    const prim = sor([
      [40, 10, 3],
      [40, 90, 3],
    ]);
    const rnd = testRandom(12);
    for (let i = 0; i < 1000; i++) {
      const p: Vec3 = [rnd.range(-0.08, 0.08), rnd.range(-0.08, 0.08), rnd.range(-0.02, 0.12)];
      const rho = Math.hypot(p[0], p[1]);
      const zc = Math.min(0.09, Math.max(0.01, p[2]));
      const expected = Math.hypot(rho - 0.04, p[2] - zc) - 0.0015;
      expect(primitiveSignedDistance(prim, p)).toBeCloseTo(expected, 15);
    }
  });

  it('flat disc: distance to the disc minus t / 2, inside and outside (1e-15 m)', () => {
    // Radius 100 mm at z = 3 mm, t = 4 mm.
    const prim = sor([
      [0, 3, 4],
      [100, 3, 4],
    ]);
    const rnd = testRandom(13);
    for (let i = 0; i < 1000; i++) {
      const p: Vec3 = [rnd.range(-0.15, 0.15), rnd.range(-0.15, 0.15), rnd.range(-0.03, 0.03)];
      const rho = Math.hypot(p[0], p[1]);
      const expected = Math.hypot(Math.max(rho - 0.1, 0), p[2] - 0.003) - 0.002;
      expect(primitiveSignedDistance(prim, p)).toBeCloseTo(expected, 15);
    }
    // On the top face, at the centre, and in the middle of the wall.
    expect(primitiveSignedDistance(prim, [0.02, 0.03, 0.005])).toBeCloseTo(0, 15);
    expect(primitiveSignedDistance(prim, [0, 0, 0.003])).toBeCloseTo(-0.002, 15);
  });

  it('the rim is a torus of minor radius t / 2 about the rim circle (1e-15 m)', () => {
    // IEC-type plate: rim vertex at r = 130 mm, z = 24 mm, t = 4.2 mm. Points beyond the rim, in
    // the wedge where the rim circle is the nearest part of the mid-surface.
    const prim = sor(DOSSIER_PROFILES_MM.plateIec);
    const rnd = testRandom(14);
    // Direction of the last profile segment in the meridian plane.
    const ur = 32 / Math.hypot(32, 15);
    const uz = 15 / Math.hypot(32, 15);
    for (let i = 0; i < 500; i++) {
      const phi = rnd.range(0, 2 * Math.PI);
      const dist = rnd.range(0.0005, 0.03);
      const spread = rnd.range(-1.2, 1.2); // angle from the segment direction, within +-90 degrees
      const dr = Math.cos(spread) * ur - Math.sin(spread) * uz;
      const dz = Math.sin(spread) * ur + Math.cos(spread) * uz;
      const r = 0.13 + dist * dr;
      const z = 0.024 + dist * dz;
      const p: Vec3 = [r * Math.cos(phi), r * Math.sin(phi), z];
      expect(primitiveSignedDistance(prim, p)).toBeCloseTo(dist - 0.0021, 15);
      // The gradient points from the rim circle to the point.
      const g = primitiveSignedDistanceGradient(prim, p);
      expect(g[0]).toBeCloseTo(dr * Math.cos(phi), 12);
      expect(g[1]).toBeCloseTo(dr * Math.sin(phi), 12);
      expect(g[2]).toBeCloseTo(dz, 12);
    }
  });

  it('on the axis the gradient is vertical', () => {
    const prim = sor(DOSSIER_PROFILES_MM.plateIec);
    expect(primitiveSignedDistanceGradient(prim, [0, 0, 0.02])).toEqual([0, 0, 1]);
    expect(primitiveSignedDistanceGradient(prim, [0, 0, -0.02])).toEqual([0, 0, -1]);
  });
});

describe('signed distance: shells of revolution against brute-force sampling', () => {
  it('mug and tumbler bodies: within the sampling spacing of a dense 3D sampling (0.2 mm)', () => {
    const spacing = 0.0002;
    for (const key of ['mug', 'tumbler'] as const) {
      const prim = sor(DOSSIER_PROFILES_MM[key]);
      const rnd = testRandom(21);
      for (let i = 0; i < 24; i++) {
        const p: Vec3 = [rnd.range(-0.07, 0.07), rnd.range(-0.07, 0.07), rnd.range(-0.02, 0.12)];
        const brute = bruteShell(prim.profile, p, spacing);
        const exact = primitiveSignedDistance(prim, p);
        // Sampling can only miss the nearest point: brute >= exact, by less than the spacing.
        expect(exact).toBeLessThanOrEqual(brute + 1e-12);
        expect(brute - exact).toBeLessThanOrEqual(spacing);
      }
    }
  });

  it('the gradient has unit length and matches finite differences outside (1e-6)', () => {
    for (const key of ['plateIec', 'tumbler', 'wineBowl'] as const) {
      const prim = sor(DOSSIER_PROFILES_MM[key]);
      const rnd = testRandom(22);
      let checked = 0;
      while (checked < 100) {
        const p: Vec3 = [rnd.range(-0.15, 0.15), rnd.range(-0.15, 0.15), rnd.range(-0.03, 0.27)];
        const d = primitiveSignedDistance(prim, p);
        if (d < 0.002) continue;
        // Skip points next to the medial axis, where the distance has a kink.
        const g = primitiveSignedDistanceGradient(prim, p);
        const numeric = numericGradient((q) => primitiveSignedDistance(prim, q), p, 1e-7);
        if (Math.abs(v3Length(numeric) - 1) > 1e-6) continue;
        expect(v3Length(g)).toBeCloseTo(1, 12);
        expect(v3Length(v3Sub(g, numeric))).toBeLessThanOrEqual(1e-6);
        checked++;
      }
    }
  });

  it('is 1-Lipschitz: the value never changes faster than the distance moved', () => {
    const prim = sor(DOSSIER_PROFILES_MM.pint);
    const rnd = testRandom(23);
    for (let i = 0; i < 3000; i++) {
      const p: Vec3 = [rnd.range(-0.06, 0.06), rnd.range(-0.06, 0.06), rnd.range(-0.02, 0.17)];
      const q = v3Add(p, rnd.vec3(0.01));
      const change = Math.abs(primitiveSignedDistance(prim, p) - primitiveSignedDistance(prim, q));
      expect(change).toBeLessThanOrEqual(v3Length(v3Sub(p, q)) + 1e-15);
    }
  });
});

describe('signed distance: scaled and partial shells are conservative bounds', () => {
  /** Dense sampling of the true surface of a (possibly scaled, possibly partial) shell. */
  function surfaceSamples(prim: SorPrimitive, spacing: number): Vec3[] {
    const prep = preparePrimitive(prim);
    if (prep.kind !== 'sor') throw new Error('not a sor');
    const [sx, sy] = [prep.sx, prep.sy];
    const [phi0, phi1] = prim.arc ?? [0, 2 * Math.PI];
    const out: Vec3[] = [];
    for (const loop of prep.section().loops) {
      for (const piece of loop.pieces) {
        const length =
          piece.kind === 'line'
            ? Math.hypot(piece.r1 - piece.r0, piece.z1 - piece.z0)
            : piece.rho * (piece.th1 - piece.th0);
        const n = Math.max(1, Math.ceil(length / spacing));
        for (let j = 0; j <= n; j++) {
          const l = j / n;
          let r: number;
          let z: number;
          if (piece.kind === 'line') {
            r = piece.r0 + l * (piece.r1 - piece.r0);
            z = piece.z0 + l * (piece.z1 - piece.z0);
          } else {
            const th = piece.th0 + l * (piece.th1 - piece.th0);
            r = piece.cr + piece.rho * Math.cos(th);
            z = piece.cz + piece.rho * Math.sin(th);
          }
          const nphi = Math.max(1, Math.ceil((r * Math.max(sx, sy) * (phi1 - phi0)) / spacing));
          for (let k = 0; k <= nphi; k++) {
            const phi = phi0 + ((phi1 - phi0) * k) / nphi;
            out.push([sx * r * Math.cos(phi), sy * r * Math.sin(phi), z]);
          }
        }
      }
    }
    return out;
  }

  function nearest(samples: readonly Vec3[], p: Vec3): number {
    let best = Number.POSITIVE_INFINITY;
    for (const s of samples) {
      const d = (p[0] - s[0]) ** 2 + (p[1] - s[1]) ** 2 + (p[2] - s[2]) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  it('scaled shell: zero on the stretched surface, and smin/smax * d <= |sdf| <= d elsewhere', () => {
    // A shallow oval dish: bowl profile stretched to 1.3 x 0.8.
    const prim = sor(
      [
        [0, 2, 3],
        [30, 2, 3],
        [45, 12, 3],
      ],
      { scaleXY: [1.3, 0.8] },
    );
    const spacing = 0.00025;
    const samples = surfaceSamples(prim, spacing);
    for (let i = 0; i < samples.length; i += 97) {
      expect(Math.abs(primitiveSignedDistance(prim, samples[i] as Vec3))).toBeLessThanOrEqual(
        1e-12,
      );
    }
    const rnd = testRandom(31);
    for (let i = 0; i < 60; i++) {
      const p: Vec3 = [rnd.range(-0.08, 0.08), rnd.range(-0.06, 0.06), rnd.range(-0.02, 0.04)];
      const d = nearest(samples, p);
      const m = Math.abs(primitiveSignedDistance(prim, p));
      expect(m).toBeLessThanOrEqual(d + 1e-12);
      // The sampled distance exceeds the true one by less than the spacing.
      expect(m).toBeGreaterThanOrEqual((0.8 / 1.3) * (d - spacing) - 1e-12);
    }
  });

  it('scaled shell: the gradient is the normal of the stretched surface (finite differences, 1e-5)', () => {
    const prim = sor(
      [
        [0, 2, 3],
        [30, 2, 3],
        [45, 12, 3],
      ],
      { scaleXY: [1.3, 0.8] },
    );
    const rnd = testRandom(32);
    let checked = 0;
    while (checked < 60) {
      const p: Vec3 = [rnd.range(-0.08, 0.08), rnd.range(-0.06, 0.06), rnd.range(-0.02, 0.04)];
      if (primitiveSignedDistance(prim, p) < 0.002) continue;
      const numeric = numericGradient((q) => primitiveSignedDistance(prim, q), p, 1e-7);
      const len = v3Length(numeric);
      const g = primitiveSignedDistanceGradient(prim, p);
      const diff = v3Length(v3Sub(g, v3Scale(numeric, 1 / len)));
      if (diff > 1e-3) continue; // next to a kink of the distance field
      expect(diff).toBeLessThanOrEqual(1e-5);
      expect(v3Length(g)).toBeCloseTo(1, 12);
      checked++;
    }
    expect(checked).toBe(60);
  });

  it('partial shell: exact within a quarter turn of the end faces, a lower bound beyond (0.2 mm sampling)', () => {
    // Quarter-turn corner fillet of a tray: floor plus wall, as used by box shells.
    const prim = sor(
      [
        [0, 1, 2],
        [19, 1, 2],
        [19, 40, 2],
      ],
      { arc: [0, Math.PI / 2] },
    );
    const spacing = 0.0002;
    const prep = preparePrimitive(prim);
    if (prep.kind !== 'sor') throw new Error('not a sor');
    // Surface samples: the revolved boundary plus the two flat end faces (filled by sampling
    // the section region on a grid and keeping points inside it).
    const samples = surfaceSamples(prim, spacing);
    const full = sor([
      [0, 1, 2],
      [19, 1, 2],
      [19, 40, 2],
    ]);
    for (let r = 0; r <= 0.021; r += spacing) {
      for (let z = -0.001; z <= 0.042; z += spacing) {
        if (primitiveSignedDistance(full, [r, 0, z]) <= 0) {
          samples.push([r, 0, z], [0, r, z]);
        }
      }
    }
    const rnd = testRandom(33);
    let exactChecked = 0;
    for (let i = 0; i < 400; i++) {
      const p: Vec3 = [rnd.range(-0.03, 0.04), rnd.range(-0.03, 0.04), rnd.range(-0.01, 0.05)];
      const value = primitiveSignedDistance(prim, p);
      const d = nearest(samples, p);
      const phi = Math.atan2(p[1], p[0]);
      const inRange = phi >= 0 && phi <= Math.PI / 2;
      if (value > 0) {
        expect(value).toBeLessThanOrEqual(d + 1e-12);
        // Within a quarter turn of an end face (azimuth in [-90, 180] degrees) it is exact.
        if (inRange || (phi > -Math.PI / 2 && phi < Math.PI)) {
          expect(d - value).toBeLessThanOrEqual(spacing);
          exactChecked++;
        }
      } else {
        // Inside: never deeper than the true depth.
        expect(-value).toBeLessThanOrEqual(d + 1e-12);
        expect(inRange).toBe(true);
      }
    }
    expect(exactChecked).toBeGreaterThan(200);
  });

  it('partial shell: the gradient beyond an end face matches finite differences (1e-6)', () => {
    const prim = sor(
      [
        [0, 1, 2],
        [19, 1, 2],
        [19, 40, 2],
      ],
      { arc: [0, Math.PI / 2] },
    );
    const rnd = testRandom(34);
    let checked = 0;
    while (checked < 80) {
      const p: Vec3 = [rnd.range(-0.02, 0.04), rnd.range(-0.03, -0.001), rnd.range(-0.01, 0.05)];
      if (p[0] < 0.001 || primitiveSignedDistance(prim, p) < 0.001) continue;
      const numeric = numericGradient((q) => primitiveSignedDistance(prim, q), p, 1e-7);
      if (Math.abs(v3Length(numeric) - 1) > 1e-6) continue;
      const g = primitiveSignedDistanceGradient(prim, p);
      expect(v3Length(v3Sub(g, numeric))).toBeLessThanOrEqual(1e-6);
      checked++;
    }
  });
});

describe('signed distance: capsule, rounded box and hull', () => {
  it('capsule: closed form for a sphere and a general capsule (1e-15 m)', () => {
    const sphere: Primitive = {
      kind: 'capsule',
      a: [0.01, 0.02, 0.03],
      b: [0.01, 0.02, 0.03],
      radius: 0.005,
    };
    expect(primitiveSignedDistance(sphere, [0.01, 0.02, 0.05])).toBeCloseTo(0.015, 15);
    expect(primitiveSignedDistance(sphere, [0.01, 0.02, 0.03])).toBeCloseTo(-0.005, 15);
    expect(primitiveSignedDistanceGradient(sphere, [0.01, 0.05, 0.03])).toEqual([0, 1, 0]);
    // Capsule along x from 0 to 40 mm, radius 2 mm.
    const cap: Primitive = { kind: 'capsule', a: [0, 0, 0], b: [0.04, 0, 0], radius: 0.002 };
    const rnd = testRandom(41);
    for (let i = 0; i < 500; i++) {
      const p = rnd.vec3(0.06);
      const xc = Math.min(0.04, Math.max(0, p[0]));
      expect(primitiveSignedDistance(cap, p)).toBeCloseTo(
        Math.hypot(p[0] - xc, p[1], p[2]) - 0.002,
        15,
      );
    }
  });

  it('rounded box: face, edge and corner regions in closed form (1e-15 m)', () => {
    // Half extents (30, 20, 5) mm, radius 2 mm: outer half extents (32, 22, 7) mm.
    const box: Primitive = { kind: 'rbox', halfExtents: [0.03, 0.02, 0.005], radius: 0.002 };
    expect(primitiveSignedDistance(box, [0.05, 0, 0])).toBeCloseTo(0.018, 15);
    expect(primitiveSignedDistance(box, [0, 0, 0])).toBeCloseTo(-0.007, 15);
    expect(primitiveSignedDistance(box, [0.02, 0.03, 0.02])).toBeCloseTo(
      Math.hypot(0.01, 0.015) - 0.002,
      15,
    );
    expect(primitiveSignedDistance(box, [0.04, 0.03, 0.015])).toBeCloseTo(
      Math.hypot(0.01, 0.01, 0.01) - 0.002,
      15,
    );
    const g = primitiveSignedDistanceGradient(box, [0.04, 0.03, 0.015]);
    expect(g[0]).toBeCloseTo(1 / Math.sqrt(3), 14);
    expect(g[1]).toBeCloseTo(1 / Math.sqrt(3), 14);
    expect(g[2]).toBeCloseTo(1 / Math.sqrt(3), 14);
    expect(primitiveSignedDistanceGradient(box, [0.001, -0.019, 0.001])).toEqual([0, -1, 0]);
  });

  it('a hull of the corners of a box agrees with the rounded box everywhere (1e-14 m)', () => {
    const h: Vec3 = [0.03, 0.02, 0.005];
    const box: Primitive = { kind: 'rbox', halfExtents: h, radius: 0.0015 };
    const corners: Vec3[] = [];
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) corners.push([sx * h[0], sy * h[1], sz * h[2]]);
    const hull: Primitive = { kind: 'hull', points: corners, radius: 0.0015 };
    const rnd = testRandom(42);
    for (let i = 0; i < 4000; i++) {
      const p = rnd.vec3(0.05);
      expect(primitiveSignedDistance(hull, p)).toBeCloseTo(primitiveSignedDistance(box, p), 14);
    }
  });

  it('flat hulls: a rounded rectangle plate equals a rounded box of zero thickness (1e-14 m)', () => {
    const plate: Primitive = {
      kind: 'hull',
      points: [
        [-0.03, -0.02, 0],
        [0.03, -0.02, 0],
        [0.03, 0.02, 0],
        [-0.03, 0.02, 0],
      ],
      radius: 0.002,
    };
    const box: Primitive = { kind: 'rbox', halfExtents: [0.03, 0.02, 0], radius: 0.002 };
    const rnd = testRandom(43);
    for (let i = 0; i < 3000; i++) {
      const p = rnd.vec3(0.05);
      expect(primitiveSignedDistance(plate, p)).toBeCloseTo(primitiveSignedDistance(box, p), 14);
    }
  });

  it('degenerate hulls: collinear points are a capsule, coincident points a sphere (1e-14 m)', () => {
    const line: Primitive = {
      kind: 'hull',
      points: [
        [0, 0, 0],
        [0.01, 0, 0],
        [0.04, 0, 0],
      ],
      radius: 0.002,
    };
    const cap: Primitive = { kind: 'capsule', a: [0, 0, 0], b: [0.04, 0, 0], radius: 0.002 };
    const point: Primitive = { kind: 'hull', points: [[0.01, 0.02, 0.03]], radius: 0.004 };
    const rnd = testRandom(44);
    for (let i = 0; i < 500; i++) {
      const p = rnd.vec3(0.06);
      expect(primitiveSignedDistance(line, p)).toBeCloseTo(primitiveSignedDistance(cap, p), 14);
      expect(primitiveSignedDistance(point, p)).toBeCloseTo(
        Math.hypot(p[0] - 0.01, p[1] - 0.02, p[2] - 0.03) - 0.004,
        14,
      );
    }
  });

  it('random hulls: outside, equals the brute-force distance to every triangle of the points (1e-13 m)', () => {
    // The nearest point of a hull to an outside point lies on a face, hence in a triangle of
    // three of the points; triangles through the interior can only be further away.
    const rnd = testRandom(45);
    for (let trial = 0; trial < 12; trial++) {
      const points: Vec3[] = [];
      const count = 4 + Math.floor(rnd.next() * 7);
      for (let i = 0; i < count; i++) points.push(rnd.vec3(0.03));
      const radius = rnd.range(0.0005, 0.004);
      const hull: Primitive = { kind: 'hull', points, radius };
      for (let i = 0; i < 40; i++) {
        const p = v3Scale(rnd.unitVec3(), rnd.range(0.055, 0.1));
        let best = Number.POSITIVE_INFINITY;
        for (let a = 0; a < count; a++) {
          for (let b = a + 1; b < count; b++) {
            for (let c = b + 1; c < count; c++) {
              best = Math.min(
                best,
                v3Length(
                  v3Sub(
                    p,
                    closestOnTriangle(p, points[a] as Vec3, points[b] as Vec3, points[c] as Vec3),
                  ),
                ),
              );
            }
          }
        }
        expect(Math.abs(primitiveSignedDistance(hull, p) - (best - radius))).toBeLessThanOrEqual(
          1e-13,
        );
      }
    }
  });

  it('random hulls: inside, the depth is the distance to the nearest supporting plane (1e-13 m)', () => {
    const rnd = testRandom(46);
    for (let trial = 0; trial < 12; trial++) {
      const points: Vec3[] = [];
      for (let i = 0; i < 8; i++) points.push(rnd.vec3(0.03));
      const hull: Primitive = { kind: 'hull', points, radius: 0.001 };
      let centre: Vec3 = [0, 0, 0];
      for (const q of points) centre = v3Add(centre, v3Scale(q, 1 / points.length));
      // Brute force over the planes through three points that have every point on one side.
      let depth = Number.POSITIVE_INFINITY;
      for (let a = 0; a < 8; a++) {
        for (let b = a + 1; b < 8; b++) {
          for (let c = b + 1; c < 8; c++) {
            const pa = points[a] as Vec3;
            const n = v3Cross(v3Sub(points[b] as Vec3, pa), v3Sub(points[c] as Vec3, pa));
            const len = v3Length(n);
            const sides = points.map((q) => v3Dot(n, v3Sub(q, pa)) / len);
            if (Math.max(...sides) > 1e-12 && Math.min(...sides) < -1e-12) continue;
            depth = Math.min(depth, Math.abs(v3Dot(n, v3Sub(centre, pa)) / len));
          }
        }
      }
      expect(Math.abs(primitiveSignedDistance(hull, centre) + depth + 0.001)).toBeLessThanOrEqual(
        1e-13,
      );
    }
  });

  it('hull gradients match finite differences outside (1e-6)', () => {
    const rnd = testRandom(47);
    const points: Vec3[] = [];
    for (let i = 0; i < 7; i++) points.push(rnd.vec3(0.03));
    const hull: Primitive = { kind: 'hull', points, radius: 0.002 };
    for (let i = 0; i < 200; i++) {
      const p = v3Scale(rnd.unitVec3(), rnd.range(0.06, 0.1));
      const numeric = numericGradient((q) => primitiveSignedDistance(hull, q), p, 1e-7);
      const g = primitiveSignedDistanceGradient(hull, p);
      expect(v3Length(v3Sub(g, numeric))).toBeLessThanOrEqual(1e-6);
    }
  });

  it('rejects malformed primitives with a RangeError', () => {
    expect(() =>
      primitiveSignedDistance(
        { kind: 'capsule', a: [0, 0, 0], b: [1, 0, 0], radius: 0 },
        [0, 0, 0],
      ),
    ).toThrow(RangeError);
    expect(() =>
      primitiveSignedDistance({ kind: 'rbox', halfExtents: [1, 0, 1], radius: 0 }, [0, 0, 0]),
    ).toThrow(RangeError);
    expect(() =>
      primitiveSignedDistance({ kind: 'rbox', halfExtents: [1, -1, 1], radius: 0.1 }, [0, 0, 0]),
    ).toThrow(RangeError);
    expect(() =>
      primitiveSignedDistance({ kind: 'hull', points: [], radius: 0.1 }, [0, 0, 0]),
    ).toThrow(RangeError);
    expect(() =>
      primitiveSignedDistance(
        {
          kind: 'hull',
          points: [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
          ],
          radius: 0,
        },
        [0, 0, 0],
      ),
    ).toThrow(RangeError);
    expect(() =>
      primitiveSignedDistance(
        sor(
          [
            [0, 0, 1],
            [5, 0, 1],
          ],
          { scaleXY: [1, 0] },
        ),
        [0, 0, 0],
      ),
    ).toThrow(RangeError);
    expect(() =>
      primitiveSignedDistance(
        sor(
          [
            [0, 0, 1],
            [5, 0, 1],
          ],
          { arc: [1, 1] },
        ),
        [0, 0, 0],
      ),
    ).toThrow(RangeError);
  });
});

describe('signed distance: shapes', () => {
  const body: Primitive = sor(DOSSIER_PROFILES_MM.mug);
  const handlePose: Pose = { p: [0.06, 0, 0.05], q: quatFromAxisAngle([0, 1, 0], 0.4) };
  const handle: Primitive = { kind: 'capsule', a: [0, 0, -0.02], b: [0, 0, 0.02], radius: 0.004 };
  const shape: Shape = {
    parts: [
      { id: 'body', prim: body, pose: POSE_IDENTITY, material: 'porcelain_glazed' },
      { id: 'handle', prim: handle, pose: handlePose, material: 'porcelain_glazed' },
    ],
    regions: [],
  };

  it('is the minimum over parts, each evaluated in its own frame (1e-15 m)', () => {
    const rnd = testRandom(51);
    for (let i = 0; i < 500; i++) {
      const p = rnd.vec3(0.12);
      // Independent route to the part frame: express p in the handle frame by solving
      // p = pose.p + R x with the inverse rotation.
      const inv: Pose = {
        p: [0, 0, 0],
        q: [-handlePose.q[0], -handlePose.q[1], -handlePose.q[2], handlePose.q[3]],
      };
      const local = poseTransformVector(inv, v3Sub(p, handlePose.p));
      const expected = Math.min(
        primitiveSignedDistance(body, p),
        primitiveSignedDistance(handle, local),
      );
      expect(signedDistance(shape, p)).toBeCloseTo(expected, 15);
    }
  });

  it('follows a part pose: a posed capsule equals the capsule between the posed end points', () => {
    const posed: Shape = {
      parts: [{ id: 'h', prim: handle, pose: handlePose, material: 'm' }],
      regions: [],
    };
    const a = poseTransformPoint(handlePose, [0, 0, -0.02]);
    const b = poseTransformPoint(handlePose, [0, 0, 0.02]);
    const direct: Primitive = { kind: 'capsule', a, b, radius: 0.004 };
    const rnd = testRandom(52);
    for (let i = 0; i < 300; i++) {
      const p = rnd.vec3(0.12);
      expect(signedDistance(posed, p)).toBeCloseTo(primitiveSignedDistance(direct, p), 15);
      const g = signedDistanceGradient(posed, p);
      const gd = primitiveSignedDistanceGradient(direct, p);
      expect(v3Length(v3Sub(g, gd))).toBeLessThanOrEqual(1e-12);
    }
  });

  it('reports the nearest part and a gradient in the item frame', () => {
    const nearHandle = sampleSignedDistance(shape, [0.08, 0, 0.05]);
    expect(nearHandle.part).toBe(1);
    const nearBody = sampleSignedDistance(shape, [-0.06, 0, 0.05]);
    expect(nearBody.part).toBe(0);
    // Left of the mug wall (outer radius about 41 mm) the outward direction is -x.
    expect(nearBody.gradient[0]).toBeLessThan(-0.99);
    expect(nearBody.distance).toBeGreaterThan(0.015);
    expect(nearBody.distance).toBeLessThan(0.022);
  });

  it('rejects a shape without parts', () => {
    expect(() => signedDistance({ parts: [], regions: [] }, [0, 0, 0])).toThrow(RangeError);
  });
});

describe('signed distance: shapes with many parts', () => {
  /** A wire rack: a 21 x 21 grid of 4 mm wires with 40 upright tines, about 880 capsules. */
  function rack(): Shape {
    const parts: Part[] = [];
    const add = (a: Vec3, b: Vec3): void => {
      parts.push({
        id: `wire.${parts.length}`,
        prim: { kind: 'capsule', a, b, radius: 0.002 },
        pose: POSE_IDENTITY,
        material: 'wire',
      });
    };
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j < 20; j++) {
        add([0.025 * i, 0.025 * j, 0], [0.025 * i, 0.025 * (j + 1), 0]);
        add([0.025 * j, 0.025 * i, 0], [0.025 * (j + 1), 0.025 * i, 0]);
      }
    }
    for (let k = 0; k < 40; k++) add([0.0125 * k, 0.1, 0], [0.0125 * k + 0.01, 0.1, 0.06]);
    return { parts, regions: [] };
  }

  it('gives exactly the minimum over the parts, and the first of the nearest parts', () => {
    const shape = rack();
    expect(shape.parts.length).toBe(880);
    const rnd = testRandom(61);
    for (let i = 0; i < 3000; i++) {
      // Points around the rack, some far away, some inside wires.
      const p: Vec3 =
        i % 3 === 0
          ? [rnd.range(-1, 1.5), rnd.range(-1, 1.5), rnd.range(-1, 1)]
          : [rnd.range(-0.02, 0.52), rnd.range(-0.02, 0.52), rnd.range(-0.01, 0.07)];
      let best = Number.POSITIVE_INFINITY;
      let index = -1;
      shape.parts.forEach((part, k) => {
        const d = primitiveSignedDistance(part.prim, p);
        if (d < best) {
          best = d;
          index = k;
        }
      });
      const sample = sampleSignedDistance(shape, p);
      expect(sample.distance).toBe(best);
      expect(sample.part).toBe(index);
      expect(signedDistance(shape, p)).toBe(best);
    }
  });

  it('finds the deepest part when the point is inside several overlapping parts', () => {
    // 150 rounded boxes and capsules crowded into a 60 mm cube: most query points are inside
    // several of them, and many are on or just under a surface.
    const rnd = testRandom(63);
    const parts: Part[] = [];
    for (let k = 0; k < 150; k++) {
      const prim: Primitive =
        k % 2 === 0
          ? {
              kind: 'rbox',
              halfExtents: [rnd.range(0.002, 0.02), rnd.range(0.002, 0.02), rnd.range(0, 0.01)],
              radius: rnd.range(0.0005, 0.003),
            }
          : {
              kind: 'capsule',
              a: rnd.vec3(0.01),
              b: rnd.vec3(0.01),
              radius: rnd.range(0.001, 0.006),
            };
      parts.push({
        id: `p${k}`,
        prim,
        pose: { p: rnd.vec3(0.03), q: rnd.unitQuat() },
        material: 'm',
      });
    }
    const shape: Shape = { parts, regions: [] };
    const singles = parts.map((part): Shape => ({ parts: [part], regions: [] }));
    let inside = 0;
    for (let i = 0; i < 4000; i++) {
      const p = rnd.vec3(0.05);
      let best = Number.POSITIVE_INFINITY;
      let index = -1;
      singles.forEach((single, k) => {
        const d = signedDistance(single, p);
        if (d < best) {
          best = d;
          index = k;
        }
      });
      const sample = sampleSignedDistance(shape, p);
      expect(sample.distance).toBe(best);
      expect(sample.part).toBe(index);
      if (best < 0) inside++;
    }
    expect(inside).toBeGreaterThan(1000);
  });

  it('handles posed parts of every kind in the tree', () => {
    const rnd = testRandom(62);
    const prims = Object.values(testPrimitives());
    const parts: Part[] = [];
    for (let k = 0; k < 60; k++) {
      parts.push({
        id: `p${k}`,
        prim: prims[k % prims.length] as Primitive,
        pose: { p: rnd.vec3(0.4), q: rnd.unitQuat() },
        material: 'm',
      });
    }
    const shape: Shape = { parts, regions: [] };
    const singles = parts.map((part): Shape => ({ parts: [part], regions: [] }));
    for (let i = 0; i < 1500; i++) {
      const p = rnd.vec3(0.6);
      let best = Number.POSITIVE_INFINITY;
      for (const single of singles) best = Math.min(best, signedDistance(single, p));
      expect(signedDistance(shape, p)).toBe(best);
    }
  });
});
