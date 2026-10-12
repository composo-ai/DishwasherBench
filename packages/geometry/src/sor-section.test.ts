import { describe, expect, it } from 'vitest';
import {
  buildSection,
  createProfileHit,
  hitArcLength,
  pieceEnd,
  pieceLength,
  pieceRadiusIntegral,
  pieceStart,
  pieceSupport,
  prepareProfile,
  profileClosest,
  profileDistance,
  sectionMoment,
  splitLoopAtArcLengths,
  type SectionPiece,
  type SorSection,
} from './sor-section.ts';
import { DOSSIER_PROFILES_MM, integrateRegion, profileMm, testRandom } from './test-util.ts';
import type { SorProfilePoint } from './types.ts';

/** Point of a boundary piece at the fraction `l` of its length. */
function pointOn(p: SectionPiece, l: number): [number, number] {
  if (p.kind === 'line') return [p.r0 + l * (p.r1 - p.r0), p.z0 + l * (p.z1 - p.z0)];
  const th = p.th0 + l * (p.th1 - p.th0);
  return [p.cr + p.rho * Math.cos(th), p.cz + p.rho * Math.sin(th)];
}

/** Brute force: smallest `|q - c| - t(c) / 2` over densely sampled mid-surface points `c`. */
function bruteDistance(
  points: readonly SorProfilePoint[],
  qr: number,
  qz: number,
  step: number,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i] as SorProfilePoint;
    const b = points[i + 1] as SorProfilePoint;
    const n = Math.max(1, Math.ceil(Math.hypot(b.r - a.r, b.z - a.z) / step));
    for (let j = 0; j <= n; j++) {
      const l = j / n;
      const d =
        Math.hypot(qr - (a.r + l * (b.r - a.r)), qz - (a.z + l * (b.z - a.z))) -
        (a.t + l * (b.t - a.t)) / 2;
      if (d < best) best = d;
    }
  }
  return best;
}

function randomProfile(seed: number): SorProfilePoint[] {
  const rnd = testRandom(seed);
  const count = 3 + Math.floor(rnd.next() * 4);
  const points: SorProfilePoint[] = [];
  let r = rnd.next() < 0.5 ? 0 : rnd.range(0.004, 0.02);
  let z = rnd.range(0.002, 0.01);
  let heading = rnd.range(-0.2, 0.4);
  for (let i = 0; i < count; i++) {
    points.push({ r, z, t: rnd.range(0.001, 0.006) });
    const length = rnd.range(0.012, 0.05);
    heading = Math.min(1.7, Math.max(-0.3, heading + rnd.range(-0.3, 0.9)));
    r = Math.max(0.002, r + length * Math.cos(heading));
    z += length * Math.sin(heading);
  }
  return points;
}

describe('profile signed distance in the meridian plane', () => {
  it('equals the closed-form distance to a stadium for a straight wall of constant thickness (1e-15 m)', () => {
    // Segment from (20, 5) mm to (20, 45) mm, t = 4 mm: a 2D capsule of radius 2 mm.
    const profile = prepareProfile(
      profileMm([
        [20, 5, 4],
        [20, 45, 4],
      ]),
    );
    const rnd = testRandom(1);
    let worst = 0;
    for (let i = 0; i < 2000; i++) {
      const r = rnd.range(0, 0.05);
      const z = rnd.range(-0.01, 0.06);
      const zc = Math.min(0.045, Math.max(0.005, z));
      const expected = Math.hypot(r - 0.02, z - zc) - 0.002;
      worst = Math.max(worst, Math.abs(profileDistance(profile, r, z, 0) - expected));
    }
    expect(worst).toBeLessThanOrEqual(1e-15);
  });

  it('matches a brute-force minimum over sampled balls for tapered polylines (sampling step 2 um)', () => {
    const step = 2e-6;
    for (const key of ['tumbler', 'pint', 'wineBowl'] as const) {
      const points = profileMm(DOSSIER_PROFILES_MM[key]);
      const profile = prepareProfile(points);
      const rnd = testRandom(7);
      for (let i = 0; i < 60; i++) {
        const r = rnd.range(0, 0.06);
        const z = rnd.range(-0.01, 0.26);
        const brute = bruteDistance(points, r, z, step);
        const exact = profileDistance(profile, r, z, 0);
        // The sampled minimum can only be larger, by at most (1 + |dt/ds| / 2) * step / 2.
        expect(exact).toBeLessThanOrEqual(brute + 1e-15);
        expect(brute - exact).toBeLessThanOrEqual(2 * step);
      }
    }
  });

  it('lifts a point out of the plane exactly as a 3D distance (straight wall, 1e-15 m)', () => {
    // Out-of-plane offset h: distance to the segment becomes sqrt(d^2 + h^2).
    const profile = prepareProfile(
      profileMm([
        [10, 0, 2],
        [30, 0, 2],
      ]),
    );
    // Beyond the end of the wall the nearest centre is the end vertex (30, 0) mm.
    const beyond = profileDistance(profile, 0.035, 0.004, 0.003 ** 2);
    expect(beyond).toBeCloseTo(Math.hypot(0.005, 0.004, 0.003) - 0.001, 15);
    // Beside the wall the foot is perpendicular: sqrt(4^2 + 3^2) - 1 = 4 mm.
    expect(profileDistance(profile, 0.02, 0.004, 0.003 ** 2)).toBeCloseTo(0.004, 15);
  });

  it('reports the centre of the nearest ball and its arc length', () => {
    // Flat disc: (0, 3) to (100, 3) mm. A point above r = 25 mm has its foot at r = 25 mm.
    const profile = prepareProfile(
      profileMm([
        [0, 3, 4],
        [100, 3, 4],
      ]),
    );
    const hit = profileClosest(profile, 0.025, 0.02, 0, createProfileHit());
    expect(hit.value).toBeCloseTo(0.017 - 0.002, 15);
    expect(hit.cr).toBeCloseTo(0.025, 15);
    expect(hit.cz).toBeCloseTo(0.003, 15);
    expect(hitArcLength(profile, hit)).toBeCloseTo(0.25, 14);
  });

  it('treats a segment whose thick end swallows its thin end as the thick disc', () => {
    // 1 mm long, half thickness 3 mm falling to 0.5 mm: |d rho / ds| = 2.5 > 1.
    const profile = prepareProfile(
      profileMm([
        [10, 0, 6],
        [11, 0, 1],
      ]),
    );
    const rnd = testRandom(3);
    for (let i = 0; i < 200; i++) {
      const r = rnd.range(0, 0.03);
      const z = rnd.range(-0.01, 0.01);
      expect(profileDistance(profile, r, z, 0)).toBeCloseTo(Math.hypot(r - 0.01, z) - 0.003, 15);
    }
  });

  it('rejects malformed profiles', () => {
    expect(() => prepareProfile(profileMm([[0, 0, 1]]))).toThrow(RangeError);
    expect(() =>
      prepareProfile(
        profileMm([
          [0, 0, 1],
          [0, 0, 1],
        ]),
      ),
    ).toThrow(RangeError);
    expect(() =>
      prepareProfile(
        profileMm([
          [0, 0, 0],
          [5, 0, 1],
        ]),
      ),
    ).toThrow(RangeError);
    expect(() =>
      prepareProfile(
        profileMm([
          [-1, 0, 1],
          [5, 0, 1],
        ]),
      ),
    ).toThrow(RangeError);
    expect(() =>
      prepareProfile([
        { r: 0, z: Number.NaN, t: 1 },
        { r: 1, z: 0, t: 1 },
      ]),
    ).toThrow(RangeError);
  });
});

function checkLoops(section: SorSection): { onSurface: number; gap: number; minR: number } {
  let onSurface = 0;
  let gap = 0;
  let minR = Number.POSITIVE_INFINITY;
  for (const loop of section.loops) {
    const n = loop.pieces.length;
    for (let i = 0; i < n; i++) {
      const p = loop.pieces[i] as SectionPiece;
      const q = loop.pieces[(i + 1) % n] as SectionPiece;
      const e = pieceEnd(p);
      const s = pieceStart(q);
      // Either the pieces meet, or both points are on the axis and the loop runs down it.
      if (Math.abs(e[0]) < 1e-9 && Math.abs(s[0]) < 1e-9) {
        expect(s[1]).toBeLessThanOrEqual(e[1] + 1e-9);
      } else {
        gap = Math.max(gap, Math.hypot(e[0] - s[0], e[1] - s[1]));
      }
      for (let j = 0; j <= 16; j++) {
        const [r, z] = pointOn(p, j / 16);
        minR = Math.min(minR, r);
        onSurface = Math.max(onSurface, Math.abs(profileDistance(section.profile, r, z, 0)));
      }
    }
  }
  return { onSurface, gap, minR };
}

describe('section boundary', () => {
  it('lies on the zero level set, closes, and stays at r >= 0 for the dossier profiles (1e-13 m)', () => {
    for (const points of Object.values(DOSSIER_PROFILES_MM)) {
      const section = buildSection(prepareProfile(profileMm(points)));
      expect(section.loops).toHaveLength(1);
      const { onSurface, gap, minR } = checkLoops(section);
      expect(onSurface).toBeLessThanOrEqual(1e-13);
      expect(gap).toBeLessThanOrEqual(1e-13);
      expect(minR).toBeGreaterThanOrEqual(-1e-13);
    }
  });

  it('lies on the zero level set and closes for 60 random profiles (1e-12 m)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const section = buildSection(prepareProfile(randomProfile(seed)));
      const { onSurface, gap, minR } = checkLoops(section);
      expect(onSurface).toBeLessThanOrEqual(1e-12);
      expect(gap).toBeLessThanOrEqual(1e-12);
      expect(minR).toBeGreaterThanOrEqual(-1e-12);
    }
  });

  it('is a stadium for a single straight wall: area and Pappus moment in closed form (1e-15 relative)', () => {
    // Vertical wall at r = 30 mm from z = 5 to 45 mm, t = 4 mm (rho = 2 mm): no axis contact.
    const section = buildSection(
      prepareProfile(
        profileMm([
          [30, 5, 4],
          [30, 45, 4],
        ]),
      ),
    );
    const area = 0.04 * 0.004 + Math.PI * 0.002 ** 2;
    expect(sectionMoment(section.loops, 0, 0)).toBeCloseTo(area, 18);
    // Centroid at r = 30 mm by symmetry: integral of r dA = 30 mm * area.
    expect(sectionMoment(section.loops, 1, 0) / (0.03 * area)).toBeCloseTo(1, 14);
    // Perimeter 2 L + 2 pi rho, and the sides are labelled: towards the axis is 'in'.
    let length = 0;
    for (const p of section.loops[0]?.pieces ?? []) {
      length += pieceLength(p);
      if (p.kind === 'line') expect(p.side).toBe(p.r0 < 0.03 ? 'in' : 'out');
    }
    expect(length).toBeCloseTo(0.08 + 2 * Math.PI * 0.002, 15);
    expect(section.rMax).toBeCloseTo(0.032, 15);
    expect(section.zMin).toBeCloseTo(0.003, 15);
    expect(section.zMax).toBeCloseTo(0.047, 15);
  });

  it('clips at the axis: a flat disc is a rectangle plus a half disc (closed forms, 1e-13 relative)', () => {
    // (0, 3) to (50, 3) mm, t = 4 mm. Region: [0, R] x [z - rho, z + rho] plus a half disc at R.
    const R = 0.05;
    const rho = 0.002;
    const z0 = 0.003;
    const section = buildSection(
      prepareProfile(
        profileMm([
          [0, 3, 4],
          [50, 3, 4],
        ]),
      ),
    );
    const half = (Math.PI * rho * rho) / 2;
    const xc = R + (4 * rho) / (3 * Math.PI); // centroid of the half disc
    expect(sectionMoment(section.loops, 0, 0) / (2 * rho * R + half)).toBeCloseTo(1, 13);
    expect(sectionMoment(section.loops, 1, 0) / (rho * R * R + half * xc)).toBeCloseTo(1, 13);
    expect(sectionMoment(section.loops, 0, 1) / (z0 * (2 * rho * R + half))).toBeCloseTo(1, 13);
    // Second moment of the half disc about the axis: about its own diameter line it is
    // pi rho^4 / 8, and the parallel-axis terms follow from the centroid offset.
    const r2 =
      (2 * rho * R ** 3) / 3 +
      (Math.PI * rho ** 4) / 8 +
      2 * R * half * ((4 * rho) / (3 * Math.PI)) +
      R * R * half;
    expect(sectionMoment(section.loops, 2, 0) / r2).toBeCloseTo(1, 13);
  });

  it('agrees with adaptive integration of the signed distance for area and moments (0.1 %)', () => {
    for (const key of ['plateIec', 'tumbler', 'wineBowl', 'lid'] as const) {
      const profile = prepareProfile(profileMm(DOSSIER_PROFILES_MM[key]));
      const section = buildSection(profile);
      const box = [0, section.zMin - 0.001, section.rMax + 0.001, section.zMax + 0.001] as const;
      const sd = (r: number, z: number): number => profileDistance(profile, r, z, 0);
      const cases: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [3, 0],
        [1, 2],
      ];
      for (const [a, b] of cases) {
        const numeric = integrateRegion(sd, (r, z) => r ** a * z ** b, box, 4e-6);
        expect(sectionMoment(section.loops, a, b) / numeric).toBeCloseTo(1, 3);
      }
    }
  });

  it('agrees with adaptive integration for random profiles (0.2 %)', () => {
    for (let seed = 101; seed <= 112; seed++) {
      const profile = prepareProfile(randomProfile(seed));
      const section = buildSection(profile);
      const box = [0, section.zMin - 0.001, section.rMax + 0.001, section.zMax + 0.001] as const;
      const sd = (r: number, z: number): number => profileDistance(profile, r, z, 0);
      for (const [a, b] of [
        [0, 0],
        [1, 0],
        [2, 1],
      ] as const) {
        const numeric = integrateRegion(sd, (r, z) => r ** a * z ** b, box, 8e-6);
        expect(Math.abs(sectionMoment(section.loops, a, b) / numeric - 1)).toBeLessThanOrEqual(
          2e-3,
        );
      }
    }
  });

  it('a rim rolled over onto the wall encloses a void: an outer loop and a clockwise hole', () => {
    // Wall at r = 30 mm, then a 4-segment loop of 4 mm "radius" whose end touches the wall.
    const profile = prepareProfile(
      profileMm([
        [0, 0.5, 1],
        [30, 0.5, 1],
        [30, 40, 1],
        [34, 44, 1],
        [38, 40, 1],
        [34, 36, 1],
        [30.3, 38.5, 1],
      ]),
    );
    const section = buildSection(profile);
    expect(section.loops).toHaveLength(2);
    const areas = section.loops.map((loop) => sectionMoment([loop], 0, 0));
    expect(Math.max(...areas)).toBeGreaterThan(0);
    expect(Math.min(...areas)).toBeLessThan(0);
    // Inside the roll the signed distance is positive, and the boundary is still its zero set.
    expect(profileDistance(profile, 0.034, 0.04, 0)).toBeGreaterThan(0.002);
    const { onSurface, gap } = checkLoops(section);
    expect(onSurface).toBeLessThanOrEqual(1e-13);
    expect(gap).toBeLessThanOrEqual(1e-13);
    // The net area (outer minus hole) is that of the solid: adaptive integration, 0.1 %.
    const numeric = integrateRegion(
      (r, z) => profileDistance(profile, r, z, 0),
      () => 1,
      [0, -0.001, 0.04, 0.046],
      4e-6,
    );
    expect(sectionMoment(section.loops, 0, 0) / numeric).toBeCloseTo(1, 3);
  });

  it('rounds the rim with a semicircle of radius t / 2, split into an in half and an out half', () => {
    const section = buildSection(prepareProfile(profileMm(DOSSIER_PROFILES_MM.plateIec)));
    const rim = (section.loops[0]?.pieces ?? []).filter((p) => p.kind === 'arc' && p.vertex === 3);
    expect(rim).toHaveLength(2);
    expect(rim.map((p) => p.side).sort()).toEqual(['in', 'out']);
    let angle = 0;
    for (const p of rim) if (p.kind === 'arc') angle += p.th1 - p.th0;
    expect(angle).toBeCloseTo(Math.PI, 12);
  });

  it('pieceRadiusIntegral gives the Pappus area of a cone and of a torus quarter (closed forms)', () => {
    const line: SectionPiece = {
      kind: 'line',
      r0: 0.01,
      z0: 0,
      r1: 0.04,
      z1: 0.04,
      nr: 0.8,
      nz: -0.6,
      side: 'out',
      s0: 0,
      s1: 1,
      segment: 0,
    };
    // Frustum: pi (r0 + r1) * slant length; slant = 50 mm.
    expect(2 * Math.PI * pieceRadiusIntegral(line)).toBeCloseTo(Math.PI * 0.05 * 0.05, 15);
    // Outer quarter of a torus of major radius R and minor radius a: 2 pi a (R pi / 2 + a).
    const arc: SectionPiece = {
      kind: 'arc',
      cr: 0.05,
      cz: 0,
      rho: 0.004,
      th0: 0,
      th1: Math.PI / 2,
      side: 'out',
      s0: 1,
      s1: 1,
      vertex: 1,
    };
    expect(2 * Math.PI * pieceRadiusIntegral(arc)).toBeCloseTo(
      2 * Math.PI * 0.004 * (0.05 * (Math.PI / 2) + 0.004),
      15,
    );
  });

  it('pieceSupport returns the extreme of an arc inside its angular range only', () => {
    const arc: SectionPiece = {
      kind: 'arc',
      cr: 0.05,
      cz: 0.01,
      rho: 0.004,
      th0: 0,
      th1: Math.PI / 2,
      side: 'out',
      s0: 1,
      s1: 1,
      vertex: 1,
    };
    expect(pieceSupport(arc, 1, 1)).toBeCloseTo(0.06 + 0.004 * Math.SQRT2, 15);
    // Direction -r: the extreme of the quarter arc is its end at angle pi / 2 (r = 50 mm).
    expect(pieceSupport(arc, -1, 0)).toBeCloseTo(-0.05, 15);
  });

  it('splits lines at arc-length cuts without moving the boundary', () => {
    const section = buildSection(prepareProfile(profileMm(DOSSIER_PROFILES_MM.mug)));
    const loop = section.loops[0];
    if (loop === undefined) throw new Error('no loop');
    const split = splitLoopAtArcLengths(loop, [0.25, 0.5, 0.9]);
    expect(split.pieces.length).toBeGreaterThan(loop.pieces.length);
    const total = (pieces: readonly SectionPiece[]): number =>
      pieces.reduce((s, p) => s + pieceLength(p), 0);
    expect(total(split.pieces)).toBeCloseTo(total(loop.pieces), 15);
    for (const p of split.pieces) {
      if (p.kind !== 'line') continue;
      for (const cut of [0.25, 0.5, 0.9]) {
        const lo = Math.min(p.s0, p.s1);
        const hi = Math.max(p.s0, p.s1);
        expect(lo >= cut - 1e-9 || hi <= cut + 1e-9).toBe(true);
      }
    }
    expect(sectionMoment([split], 1, 0)).toBeCloseTo(sectionMoment([loop], 1, 0), 15);
  });
});
