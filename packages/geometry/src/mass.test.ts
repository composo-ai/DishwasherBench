import {
  POSE_IDENTITY,
  quatFromAxisAngle,
  symmetricEigen3,
  type Mat3,
  type Pose,
  type Vec3,
} from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  computeMassProperties,
  materialVolume,
  primitiveMoments,
  primitiveVolume,
  shapeVolume,
} from './mass.ts';
import { primitiveSignedDistance } from './sdf.ts';
import { DOSSIER_PROFILES_MM, profileMm, testRandom } from './test-util.ts';
import type { Primitive, Shape, SorProfilePoint } from './types.ts';

const RHO = 2400; // porcelain, kg/m^3 (docs/research/items.md section 3.1 [VERIFIED])

function single(prim: Primitive, pose: Pose = POSE_IDENTITY): Shape {
  return { parts: [{ id: 'body', prim, pose, material: 'm' }], regions: [] };
}

function expectMat3(actual: Mat3, expected: Mat3, tolerance: number): void {
  for (let i = 0; i < 9; i++) {
    expect(Math.abs((actual[i] as number) - (expected[i] as number))).toBeLessThanOrEqual(
      tolerance,
    );
  }
}

/**
 * Volume, centre and inertia-like integrals of the set `sd <= 0` by adaptive subdivision of a
 * box (a cell further from the surface than its half diagonal is entirely in or out). Returns
 * the volume and the integrals of x, y, z, x^2, y^2, z^2.
 */
function integrateSolid(sd: (p: Vec3) => number, lo: Vec3, hi: Vec3, minCell: number): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  const visit = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void => {
    const cx = 0.5 * (x0 + x1);
    const cy = 0.5 * (y0 + y1);
    const cz = 0.5 * (z0 + z1);
    const wx = x1 - x0;
    const wy = y1 - y0;
    const wz = z1 - z0;
    const d = sd([cx, cy, cz]);
    const half = 0.5 * Math.hypot(wx, wy, wz);
    if (d > half) return;
    if (d < -half || Math.max(wx, wy, wz) <= minCell) {
      if (d > 0) return;
      const v = wx * wy * wz;
      out[0] = (out[0] as number) + v;
      out[1] = (out[1] as number) + v * cx;
      out[2] = (out[2] as number) + v * cy;
      out[3] = (out[3] as number) + v * cz;
      out[4] = (out[4] as number) + v * (cx * cx + (wx * wx) / 12);
      out[5] = (out[5] as number) + v * (cy * cy + (wy * wy) / 12);
      out[6] = (out[6] as number) + v * (cz * cz + (wz * wz) / 12);
      return;
    }
    for (const [ax, bx] of [
      [x0, cx],
      [cx, x1],
    ] as const) {
      for (const [ay, by] of [
        [y0, cy],
        [cy, y1],
      ] as const) {
        for (const [az, bz] of [
          [z0, cz],
          [cz, z1],
        ] as const)
          visit(ax, ay, az, bx, by, bz);
      }
    }
  };
  visit(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]);
  return out;
}

describe('mass properties of shells of revolution', () => {
  it('thick spherical shell: mass and inertia of the closed form (polyline of 720 chords, 2e-5)', () => {
    // Mid-surface radius 50 mm, thickness 4 mm, profile from the south to the north pole.
    const R = 0.05;
    const t = 0.004;
    const n = 720;
    const profile: SorProfilePoint[] = [];
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / n;
      profile.push({ r: i === 0 || i === n ? 0 : R * Math.cos(a), z: R * Math.sin(a), t });
    }
    const got = computeMassProperties(single({ kind: 'sor', profile }), () => RHO);
    const ro = R + t / 2;
    const ri = R - t / 2;
    const mass = RHO * (4 / 3) * Math.PI * (ro ** 3 - ri ** 3);
    const inertia = (2 / 5) * mass * ((ro ** 5 - ri ** 5) / (ro ** 3 - ri ** 3));
    // The inscribed polyline is short of the sphere by R (1 - cos(pi / 2n)) = 2.4e-6 R.
    expect(got.mass / mass).toBeCloseTo(1, 4);
    expect(Math.abs(got.mass / mass - 1)).toBeLessThanOrEqual(2e-5);
    expect(Math.abs(got.inertia[0] / inertia - 1)).toBeLessThanOrEqual(2e-5);
    expect(Math.abs(got.inertia[4] / inertia - 1)).toBeLessThanOrEqual(2e-5);
    expect(Math.abs(got.inertia[8] / inertia - 1)).toBeLessThanOrEqual(2e-5);
    expect(Math.abs(got.com[2])).toBeLessThanOrEqual(1e-12);
    // Thin-shell limit of the items dossier: m = rho t 4 pi R^2 and I = 2/3 m R^2. With
    // e = t / (2 R) = 0.04 the thick shell exceeds them by e^2 / 3 = 5.3e-4 and 5 e^2 / 3 = 2.7e-3.
    expect(Math.abs(got.mass / (RHO * t * 4 * Math.PI * R * R) - 1)).toBeLessThanOrEqual(6e-4);
    expect(Math.abs(got.inertia[8] / ((2 / 3) * got.mass * R * R) - 1)).toBeLessThanOrEqual(2.8e-3);
  });

  it('cylinder wall with rounded ends: tube plus two half tori in closed form (1e-12 relative)', () => {
    // R = 40 mm, z from 0 to H = 90 mm, t = 3 mm.
    const R = 0.04;
    const H = 0.09;
    const rho = 0.0015;
    const prim: Primitive = {
      kind: 'sor',
      profile: profileMm([
        [40, 0, 3],
        [40, 90, 3],
      ]),
    };
    const got = computeMassProperties(single(prim), () => RHO);
    const halfDisc = (Math.PI * rho * rho) / 2;
    // Planar integrals over the rectangle and the two half discs (see the test names for each).
    const m10 = 2 * R * rho * H + 2 * halfDisc * R; // integral of r
    const m30 =
      (H * ((R + rho) ** 4 - (R - rho) ** 4)) / 4 +
      2 * (R ** 3 * halfDisc + 3 * R * ((Math.PI * rho ** 4) / 8));
    const yFirst = (2 * rho ** 3) / 3; // integral of y over a half disc
    const ySecond = (Math.PI * rho ** 4) / 8; // integral of y^2 over a half disc
    const m11 = (2 * R * rho * (H * H)) / 2 + R * (H * halfDisc + yFirst) + R * -yFirst;
    const m12 =
      2 * R * rho * (H ** 3 / 3) + R * (H * H * halfDisc + 2 * H * yFirst + ySecond) + R * ySecond;
    const mass = RHO * 2 * Math.PI * m10;
    const zc = m11 / m10;
    const izz = RHO * 2 * Math.PI * m30;
    const ixx = RHO * (Math.PI * m30 + 2 * Math.PI * m12) - mass * zc * zc;
    expect(got.mass / mass).toBeCloseTo(1, 12);
    expect(got.com[0]).toBe(0);
    expect(got.com[1]).toBe(0);
    expect(got.com[2] / zc).toBeCloseTo(1, 12);
    expect(got.inertia[8] / izz).toBeCloseTo(1, 12);
    expect(got.inertia[0] / ixx).toBeCloseTo(1, 12);
    expect(got.inertia[4] / ixx).toBeCloseTo(1, 12);
    // Thin-walled open tube (items dossier formulas): m = rho t 2 pi R H, I_zz = m R^2,
    // I_xx = m (R^2 / 2 + H^2 / 12) about the centre; the rounded ends add about rho/H = 2 %.
    expect(Math.abs(got.mass / (RHO * 0.003 * 2 * Math.PI * R * H) - 1)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(got.inertia[8] / (got.mass * R * R) - 1)).toBeLessThanOrEqual(0.002);
    expect(
      Math.abs(got.inertia[0] / (got.mass * ((R * R) / 2 + (H * H) / 12)) - 1),
    ).toBeLessThanOrEqual(0.03);
  });

  it('agrees with the thin-shell estimator of the items dossier to a few percent on real profiles', () => {
    // docs/research/items.md 2.3: m = rho * integral of t * 2 pi r ds over the mid-surface. The
    // exact solid adds the rounded rim and corrects the bends; the dossier quotes t / (2 r).
    const cases: [keyof typeof DOSSIER_PROFILES_MM, number][] = [
      ['plateIec', 0.03],
      ['plate270', 0.03],
      ['bowl160', 0.03],
      ['mug', 0.03],
      ['tumbler', 0.03],
      ['pint', 0.04],
    ];
    for (const [key, tolerance] of cases) {
      const profile = profileMm(DOSSIER_PROFILES_MM[key]);
      let thin = 0;
      for (let i = 0; i + 1 < profile.length; i++) {
        const a = profile[i] as SorProfilePoint;
        const b = profile[i + 1] as SorProfilePoint;
        const length = Math.hypot(b.r - a.r, b.z - a.z);
        for (let j = 0; j < 200; j++) {
          const l = (j + 0.5) / 200;
          thin += (a.t + l * (b.t - a.t)) * 2 * Math.PI * (a.r + l * (b.r - a.r)) * (length / 200);
        }
      }
      const exact = primitiveVolume({ kind: 'sor', profile });
      expect(Math.abs(exact / thin - 1)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('reproduces the dossier model masses of the plate and the tumbler shells within 3 %', () => {
    // docs/research/items.md 10.2 [ESTIMATED]: dinner plate (1) 591 g including a foot ring of
    // 2 pi * 80 * 5 * 4 mm^3 of porcelain (24 g); Picardie tumbler (27) 211 g of glass at 2500.
    const plate =
      primitiveVolume({ kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.plateIec) }) * 2400;
    const ring = 2 * Math.PI * 0.08 * 0.005 * 0.004 * 2400;
    expect(Math.abs((plate + ring) / 0.591 - 1)).toBeLessThanOrEqual(0.03);
    const tumbler =
      primitiveVolume({ kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.tumbler) }) * 2500;
    expect(Math.abs(tumbler / 0.211 - 1)).toBeLessThanOrEqual(0.03);
  });

  it('half of a flat ring: centre of mass and inertia from closed-form planar integrals (1e-12)', () => {
    // Annulus from r = 30 to 50 mm at z = 2 mm, t = 4 mm (rounded edges), azimuth 0 to pi.
    const [r1, r2, rho, z0] = [0.03, 0.05, 0.002, 0.002];
    const prim: Primitive = {
      kind: 'sor',
      profile: profileMm([
        [30, 2, 4],
        [50, 2, 4],
      ]),
      arc: [0, Math.PI],
    };
    const got = computeMassProperties(single(prim), () => RHO);
    const halfDisc = (Math.PI * rho * rho) / 2;
    const xFirst = (2 * rho ** 3) / 3;
    const xSecond = (Math.PI * rho ** 4) / 8;
    const m10 = rho * (r2 * r2 - r1 * r1) + halfDisc * (r1 + r2);
    const m20 =
      (2 * rho * (r2 ** 3 - r1 ** 3)) / 3 +
      (r2 * r2 * halfDisc + 2 * r2 * xFirst + xSecond) +
      (r1 * r1 * halfDisc - 2 * r1 * xFirst + xSecond);
    const mass = RHO * Math.PI * m10;
    expect(got.mass / mass).toBeCloseTo(1, 12);
    // x by symmetry 0; y = integral of r sin(phi) = 2 m20 / (pi m10); z = z0.
    expect(Math.abs(got.com[0])).toBeLessThanOrEqual(1e-17);
    expect(got.com[1] / ((2 * m20) / (Math.PI * m10))).toBeCloseTo(1, 12);
    expect(got.com[2] / z0).toBeCloseTo(1, 12);
  });

  it('stretching scales mass by sx sy and makes a thin disc an elliptical plate (1e-3)', () => {
    // Disc of radius 100 mm, 0.02 mm thick, stretched to semi-axes 150 mm and 60 mm.
    const prim: Primitive = {
      kind: 'sor',
      profile: profileMm([
        [0, 0.01, 0.02],
        [100, 0.01, 0.02],
      ]),
      scaleXY: [1.5, 0.6],
    };
    const got = computeMassProperties(single(prim), () => RHO);
    const mass = RHO * 0.00002 * Math.PI * 0.15 * 0.06;
    expect(Math.abs(got.mass / mass - 1)).toBeLessThanOrEqual(1e-3);
    // Thin elliptical plate: I_xx = m b^2 / 4, I_yy = m a^2 / 4, I_zz = their sum.
    expect(Math.abs(got.inertia[0] / ((got.mass * 0.06 ** 2) / 4) - 1)).toBeLessThanOrEqual(1e-3);
    expect(Math.abs(got.inertia[4] / ((got.mass * 0.15 ** 2) / 4) - 1)).toBeLessThanOrEqual(1e-3);
    expect(
      Math.abs(got.inertia[8] / ((got.mass * (0.15 ** 2 + 0.06 ** 2)) / 4) - 1),
    ).toBeLessThanOrEqual(1e-3);
  });
});

describe('mass properties of capsules, boxes and hulls', () => {
  it('solid capsule: cylinder plus hemispheres in closed form (1e-13 relative)', () => {
    // Along z, L = 60 mm between centres, radius 8 mm, centred at (10, 20, 30) mm.
    const [L, R] = [0.06, 0.008];
    const prim: Primitive = {
      kind: 'capsule',
      a: [0.01, 0.02, 0],
      b: [0.01, 0.02, 0.06],
      radius: R,
    };
    const got = computeMassProperties(single(prim), () => RHO);
    const mCyl = RHO * Math.PI * R * R * L;
    const mSph = RHO * (4 / 3) * Math.PI * R ** 3;
    const axial = (mCyl * R * R) / 2 + (2 / 5) * mSph * R * R;
    const transverse =
      mCyl * ((L * L) / 12 + (R * R) / 4) +
      mSph * ((2 * R * R) / 5 + (L * L) / 4 + (3 * L * R) / 8);
    expect(got.mass / (mCyl + mSph)).toBeCloseTo(1, 13);
    expect(got.com[0]).toBeCloseTo(0.01, 15);
    expect(got.com[1]).toBeCloseTo(0.02, 15);
    expect(got.com[2]).toBeCloseTo(0.03, 15);
    expect(got.inertia[8] / axial).toBeCloseTo(1, 11);
    expect(got.inertia[0] / transverse).toBeCloseTo(1, 11);
    expect(got.inertia[4] / transverse).toBeCloseTo(1, 11);
    expectMat3(got.inertia, [transverse, 0, 0, 0, transverse, 0, 0, 0, axial], 1e-18);
  });

  it('sphere: 4/3 pi r^3 and 2/5 m r^2, as a capsule and as a one-point hull (1e-14 relative)', () => {
    const r = 0.012;
    const mass = RHO * (4 / 3) * Math.PI * r ** 3;
    for (const prim of [
      { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius: r },
      { kind: 'hull', points: [[0, 0, 0]], radius: r },
    ] as Primitive[]) {
      const got = computeMassProperties(single(prim), () => RHO);
      expect(got.mass / mass).toBeCloseTo(1, 14);
      for (const k of [0, 4, 8])
        expect((got.inertia[k] as number) / (0.4 * mass * r * r)).toBeCloseTo(1, 13);
    }
  });

  it('sharp box: m = rho 8 hx hy hz and I = m / 3 (h_j^2 + h_k^2) (1e-14 relative)', () => {
    const h: Vec3 = [0.17, 0.12, 0.004]; // a 340 x 240 x 8 mm chopping board
    const got = computeMassProperties(
      single({ kind: 'rbox', halfExtents: h, radius: 0 }),
      () => 950,
    );
    const mass = 950 * 8 * h[0] * h[1] * h[2];
    expect(got.mass / mass).toBeCloseTo(1, 14);
    expect(got.inertia[0] / ((mass / 3) * (h[1] ** 2 + h[2] ** 2))).toBeCloseTo(1, 13);
    expect(got.inertia[4] / ((mass / 3) * (h[0] ** 2 + h[2] ** 2))).toBeCloseTo(1, 13);
    expect(got.inertia[8] / ((mass / 3) * (h[0] ** 2 + h[1] ** 2))).toBeCloseTo(1, 13);
    expect(Math.hypot(...got.com)).toBeLessThanOrEqual(1e-17);
  });

  it('rounded box: core, slabs, quarter cylinders and sphere octants summed directly (1e-12 relative)', () => {
    const h: Vec3 = [0.03, 0.02, 0.005];
    const r = 0.003;
    const got = computeMassProperties(single({ kind: 'rbox', halfExtents: h, radius: r }), () => 1);
    // Integral of x_a^2 over the solid, by pieces. Axis a with the other two axes b and c.
    const second = (a: number): number => {
      const [ha, hb, hc] = [h[a] as number, h[(a + 1) % 3] as number, h[(a + 2) % 3] as number];
      const core = (8 * ha * hb * hc * ha * ha) / 3;
      // Two slabs on the +-a faces, and the slabs on the b and c faces.
      const slabA = (2 * 4 * hb * hc * ((ha + r) ** 3 - ha ** 3)) / 3;
      const slabBC = 2 * 4 * ha * hc * r * ((ha * ha) / 3) + 2 * 4 * ha * hb * r * ((ha * ha) / 3);
      // Four edges parallel to a: quarter cylinders, x_a along the axis.
      const edgeAlong = 4 * ((Math.PI * r * r) / 4) * 2 * ha * ((ha * ha) / 3);
      // Eight edges perpendicular to a: x_a = ha + rho cos(alpha) over a quarter disc.
      const quarter =
        ha * ha * ((Math.PI * r * r) / 4) + 2 * ha * (r ** 3 / 3) + (r ** 4 / 4) * (Math.PI / 4);
      const edgeAcross = 4 * 2 * hc * quarter + 4 * 2 * hb * quarter;
      // Eight corners: sphere octants, x_a = ha + s u_a.
      const corner =
        8 *
        (ha * ha * ((Math.PI * r ** 3) / 6) +
          2 * ha * (r ** 4 / 4) * (Math.PI / 4) +
          (r ** 5 / 5) * (Math.PI / 6));
      return core + slabA + slabBC + edgeAlong + edgeAcross + corner;
    };
    const volume =
      8 * h[0] * h[1] * h[2] +
      8 * r * (h[0] * h[1] + h[1] * h[2] + h[2] * h[0]) +
      2 * Math.PI * r * r * (h[0] + h[1] + h[2]) +
      (4 / 3) * Math.PI * r ** 3;
    expect(got.mass / volume).toBeCloseTo(1, 12);
    expect(got.inertia[0] / (second(1) + second(2))).toBeCloseTo(1, 12);
    expect(got.inertia[4] / (second(0) + second(2))).toBeCloseTo(1, 12);
    expect(got.inertia[8] / (second(0) + second(1))).toBeCloseTo(1, 12);
    expect(Math.hypot(...got.com)).toBeLessThanOrEqual(1e-17);
  });

  it('regular tetrahedron: V = a^3 / (6 sqrt 2), I = m a^2 / 20 about any axis (1e-13 relative)', () => {
    const s = 0.02;
    const points: Vec3[] = [
      [s, s, s],
      [s, -s, -s],
      [-s, s, -s],
      [-s, -s, s],
    ];
    const got = computeMassProperties(single({ kind: 'hull', points, radius: 0 }), () => RHO);
    const a = 2 * Math.SQRT2 * s;
    const mass = (RHO * a ** 3) / (6 * Math.SQRT2);
    expect(got.mass / mass).toBeCloseTo(1, 13);
    expectMat3(
      got.inertia,
      [(mass * a * a) / 20, 0, 0, 0, (mass * a * a) / 20, 0, 0, 0, (mass * a * a) / 20],
      1e-18,
    );
    expect(Math.hypot(...got.com)).toBeLessThanOrEqual(1e-17);
  });

  it('rounded hulls: volume obeys the Steiner formula V + S r + M r^2 + 4/3 pi r^3 (1e-12 relative)', () => {
    // Regular tetrahedron of edge a: S = sqrt(3) a^2; mean-width term M = 1/2 * 6 a * theta with
    // theta = pi - acos(1/3) the angle between adjacent face normals.
    const s = 0.02;
    const r = 0.003;
    const points: Vec3[] = [
      [s, s, s],
      [s, -s, -s],
      [-s, s, -s],
      [-s, -s, s],
    ];
    const a = 2 * Math.SQRT2 * s;
    const theta = Math.PI - Math.acos(1 / 3);
    const volume =
      a ** 3 / (6 * Math.SQRT2) +
      Math.sqrt(3) * a * a * r +
      3 * a * theta * r * r +
      (4 / 3) * Math.PI * r ** 3;
    expect(primitiveVolume({ kind: 'hull', points, radius: r }) / volume).toBeCloseTo(1, 12);
    // A flat rounded rectangle: 2 A r + pi r^2 P / 2 + 4/3 pi r^3.
    const plate: Primitive = {
      kind: 'hull',
      points: [
        [0, 0, 0],
        [0.04, 0, 0],
        [0.04, 0.03, 0],
        [0, 0.03, 0],
      ],
      radius: r,
    };
    const plateVolume =
      2 * 0.04 * 0.03 * r + (Math.PI * r * r * 0.14) / 2 + (4 / 3) * Math.PI * r ** 3;
    expect(primitiveVolume(plate) / plateVolume).toBeCloseTo(1, 12);
  });

  it('random rounded hulls: moments agree with adaptive integration of the signed distance (0.5 %)', () => {
    const rnd = testRandom(61);
    for (let trial = 0; trial < 4; trial++) {
      const points: Vec3[] = [];
      for (let i = 0; i < 7; i++) points.push(rnd.vec3(0.015));
      const prim: Primitive = { kind: 'hull', points, radius: rnd.range(0.001, 0.004) };
      const m = primitiveMoments(prim);
      const num = integrateSolid(
        (p) => primitiveSignedDistance(prim, p),
        [-0.02, -0.02, -0.02],
        [0.02, 0.02, 0.02],
        0.0003,
      );
      expect(Math.abs(m.volume / (num[0] as number) - 1)).toBeLessThanOrEqual(5e-3);
      // First moments to 0.5 % of volume * size, second moments (diagonal) to 0.5 %.
      for (let k = 0; k < 3; k++) {
        expect(Math.abs((m.first[k] as number) - (num[1 + k] as number))).toBeLessThanOrEqual(
          5e-3 * m.volume * 0.015,
        );
        expect(
          Math.abs((m.second[4 * k] as number) / (num[4 + k] as number) - 1),
        ).toBeLessThanOrEqual(5e-3);
      }
    }
  });

  it('a flat rounded triangle: moments agree with adaptive integration (0.5 %)', () => {
    const prim: Primitive = {
      kind: 'hull',
      points: [
        [0, 0, 0],
        [0.03, 0.004, 0.002],
        [0.008, 0.025, -0.003],
      ],
      radius: 0.002,
    };
    const m = primitiveMoments(prim);
    const num = integrateSolid(
      (p) => primitiveSignedDistance(prim, p),
      [-0.004, -0.004, -0.006],
      [0.034, 0.029, 0.005],
      0.00015,
    );
    expect(Math.abs(m.volume / (num[0] as number) - 1)).toBeLessThanOrEqual(5e-3);
    for (let k = 0; k < 3; k++) {
      expect(Math.abs((m.first[k] as number) / (num[1 + k] as number) - 1)).toBeLessThanOrEqual(
        5e-3,
      );
      expect(
        Math.abs((m.second[4 * k] as number) / (num[4 + k] as number) - 1),
      ).toBeLessThanOrEqual(5e-3);
    }
  });
});

describe('mass properties of compound shapes', () => {
  it('dumbbell of two spheres: parallel-axis composition in closed form (1e-13 relative)', () => {
    // Spheres of radius 10 mm and 15 mm, densities 1000 and 2000, centres 100 mm apart on x.
    const [r1, r2, d] = [0.01, 0.015, 0.1];
    const shape: Shape = {
      parts: [
        {
          id: 'a',
          prim: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius: r1 },
          pose: POSE_IDENTITY,
          material: 'light',
        },
        {
          id: 'b',
          prim: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius: r2 },
          pose: { p: [d, 0, 0], q: [0, 0, 0, 1] },
          material: 'heavy',
        },
      ],
      regions: [],
    };
    const got = computeMassProperties(shape, (id) => (id === 'light' ? 1000 : 2000));
    const m1 = 1000 * (4 / 3) * Math.PI * r1 ** 3;
    const m2 = 2000 * (4 / 3) * Math.PI * r2 ** 3;
    const xc = (m2 * d) / (m1 + m2);
    const own = 0.4 * m1 * r1 * r1 + 0.4 * m2 * r2 * r2;
    const transverse = own + m1 * xc * xc + m2 * (d - xc) ** 2;
    expect(got.mass / (m1 + m2)).toBeCloseTo(1, 14);
    expect(got.com[0] / xc).toBeCloseTo(1, 14);
    expect(got.inertia[0] / own).toBeCloseTo(1, 13);
    expect(got.inertia[4] / transverse).toBeCloseTo(1, 13);
    expect(got.inertia[8] / transverse).toBeCloseTo(1, 13);
    expect(shapeVolume(shape) / ((4 / 3) * Math.PI * (r1 ** 3 + r2 ** 3))).toBeCloseTo(1, 14);
  });

  it('a part pose rotates the inertia tensor: a box turned a quarter turn about z swaps I_xx and I_yy', () => {
    const h: Vec3 = [0.05, 0.02, 0.01];
    const pose: Pose = { p: [0.1, -0.05, 0.02], q: quatFromAxisAngle([0, 0, 1], Math.PI / 2) };
    const got = computeMassProperties(
      single({ kind: 'rbox', halfExtents: h, radius: 0 }, pose),
      () => 1000,
    );
    const mass = 1000 * 8 * h[0] * h[1] * h[2];
    expect(got.com[0]).toBeCloseTo(0.1, 15);
    expect(got.com[1]).toBeCloseTo(-0.05, 15);
    expect(got.com[2]).toBeCloseTo(0.02, 15);
    expectMat3(
      got.inertia,
      [
        (mass / 3) * (h[0] ** 2 + h[2] ** 2),
        0,
        0,
        0,
        (mass / 3) * (h[1] ** 2 + h[2] ** 2),
        0,
        0,
        0,
        (mass / 3) * (h[0] ** 2 + h[1] ** 2),
      ],
      1e-17,
    );
  });

  it('a general rotation keeps the principal moments (eigenvalues, 1e-13 relative)', () => {
    const rnd = testRandom(62);
    const prim: Primitive = { kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.mug) };
    const upright = computeMassProperties(single(prim), () => RHO);
    const pose: Pose = { p: rnd.vec3(0.2), q: rnd.unitQuat() };
    const turned = computeMassProperties(single(prim, pose), () => RHO);
    const e0 = symmetricEigen3(upright.inertia).values;
    const e1 = symmetricEigen3(turned.inertia).values;
    for (let k = 0; k < 3; k++) expect((e1[k] as number) / (e0[k] as number)).toBeCloseTo(1, 12);
    expect(turned.mass).toBeCloseTo(upright.mass, 14);
  });

  it('rejects a missing density and an empty shape', () => {
    const prim: Primitive = { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0.01], radius: 0.002 };
    expect(() => computeMassProperties(single(prim), () => 0)).toThrow(RangeError);
    expect(() => computeMassProperties(single(prim), () => Number.NaN)).toThrow(RangeError);
    expect(() => computeMassProperties({ parts: [], regions: [] }, () => 1)).toThrow(RangeError);
  });
});

describe('mass properties of perforated parts (porosity)', () => {
  /** A ball of radius `r` at `x` on the x axis, with an open-area fraction. */
  const ball = (id: string, r: number, x: number, porosity?: number): Shape['parts'][number] => ({
    id,
    prim: { kind: 'capsule', a: [0, 0, 0], b: [0, 0, 0], radius: r },
    pose: { p: [x, 0, 0], q: [0, 0, 0, 1] },
    material: 'm',
    ...(porosity === undefined ? {} : { porosity }),
  });

  it('a perforated part weighs (1 - porosity) of the solid and keeps its centre and gyration (1e-14 relative)', () => {
    // A colander wall with 30 % open area holds 70 % of the steel of the solid wall. The holes
    // are spread evenly, so the centre of mass and the radii of gyration I / m do not change.
    const prim: Primitive = { kind: 'sor', profile: profileMm(DOSSIER_PROFILES_MM.mug) };
    const solid = computeMassProperties(single(prim), () => 7900);
    const open: Shape = {
      parts: [{ id: 'body', prim, pose: POSE_IDENTITY, material: 'm', porosity: 0.3 }],
      regions: [],
    };
    const got = computeMassProperties(open, () => 7900);
    expect(got.mass / (0.7 * solid.mass)).toBeCloseTo(1, 14);
    for (let k = 0; k < 3; k++) expect(got.com[k]).toBeCloseTo(solid.com[k] as number, 15);
    for (const k of [0, 4, 8]) {
      expect((got.inertia[k] as number) / (0.7 * (solid.inertia[k] as number))).toBeCloseTo(1, 13);
    }
    // The space taken up is unchanged; the material is 70 % of it.
    expect(shapeVolume(open)).toBe(shapeVolume(single(prim)));
    expect(materialVolume(open) / (0.7 * shapeVolume(open))).toBeCloseTo(1, 14);
    expect(materialVolume(single(prim))).toBe(shapeVolume(single(prim)));
  });

  it('a solid and a perforated ball: the centre of mass moves towards the solid one (closed form, 1e-14)', () => {
    // Two equal balls 100 mm apart, the second half open: masses m and m / 2, so the centre of
    // mass is a third of the way along, and the transverse inertia is the two point masses about
    // it plus 2/5 m r^2 of each ball.
    const [r, d, rho] = [0.01, 0.1, 1000];
    const shape: Shape = { parts: [ball('a', r, 0), ball('b', r, d, 0.5)], regions: [] };
    const got = computeMassProperties(shape, () => rho);
    const m = rho * (4 / 3) * Math.PI * r ** 3;
    expect(got.mass / (1.5 * m)).toBeCloseTo(1, 14);
    expect(got.com[0] / (d / 3)).toBeCloseTo(1, 14);
    const own = 0.4 * m * r * r * 1.5;
    const transverse = own + m * (d / 3) ** 2 + 0.5 * m * ((2 * d) / 3) ** 2;
    expect(got.inertia[0] / own).toBeCloseTo(1, 13);
    expect(got.inertia[4] / transverse).toBeCloseTo(1, 13);
    expect(materialVolume(shape) / ((1.5 * m) / rho)).toBeCloseTo(1, 14);
  });

  it('a porosity of zero is solid, and one outside [0, 1) is an error', () => {
    const solid = computeMassProperties({ parts: [ball('a', 0.01, 0)], regions: [] }, () => 1000);
    const zero = computeMassProperties({ parts: [ball('a', 0.01, 0, 0)], regions: [] }, () => 1000);
    expect(zero).toEqual(solid);
    for (const bad of [1, 1.5, -0.1, Number.NaN]) {
      const shape: Shape = { parts: [ball('a', 0.01, 0, bad)], regions: [] };
      expect(() => computeMassProperties(shape, () => 1000)).toThrow(RangeError);
      expect(() => materialVolume(shape)).toThrow(RangeError);
    }
  });
});
