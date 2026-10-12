import type { Vec3 } from '@spotless/core';
import { v3Distance, v3Dot, v3Normalise, v3Sub } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { expectNear } from '../test-util.ts';
import {
  bendCapsuleCount,
  capsuleLength,
  filletPolyline,
  roundedCorner,
  wireParts,
} from './wire.ts';

const deg = (d: number): number => (d * Math.PI) / 180;

describe('wire bends', () => {
  it('uses 3 to 5 capsules per bend, one per 30 degrees of turn', () => {
    // platform.md section 4.4: "3 to 5 short capsules per bend".
    expect(bendCapsuleCount(deg(26))).toBe(3);
    expect(bendCapsuleCount(deg(90))).toBe(3);
    expect(bendCapsuleCount(deg(100))).toBe(4);
    expect(bendCapsuleCount(deg(135))).toBe(5);
    expect(bendCapsuleCount(deg(170))).toBe(5);
  });

  it('rounds a right angle with chords of an arc tangent to both legs', () => {
    // Analytic: corner at the origin, legs along -x and +y, radius 10 mm. The arc is centred on
    // (-10, 10) mm, starts 10 mm before the corner and ends 10 mm after it.
    const r = 0.01;
    const points = roundedCorner([-0.1, 0, 0], [0, 0, 0], [0, 0.1, 0], r);
    expect(points).toHaveLength(4);
    const centre: Vec3 = [-r, r, 0];
    for (const p of points) expectNear(v3Distance(p, centre), r, 1e-12, 'chord end on the arc');
    expectNear(v3Distance(points[0] as Vec3, [-r, 0, 0]), 0, 1e-12);
    expectNear(v3Distance(points[3] as Vec3, [0, r, 0]), 0, 1e-12);
    // Equal chords: each spans 30 degrees, 2 r sin(15 deg).
    for (let i = 0; i + 1 < points.length; i++) {
      expectNear(
        v3Distance(points[i] as Vec3, points[i + 1] as Vec3),
        2 * r * Math.sin(deg(15)),
        1e-12,
      );
    }
  });

  it('keeps a shallow bend as a plain joint and shrinks a bend that the legs are too short for', () => {
    expect(roundedCorner([-0.1, 0, 0], [0, 0, 0], [0.1, 0.03, 0], 0.01)).toHaveLength(1);
    // Legs of 10 mm cannot hold a 20 mm radius at a right angle: the tangent length is capped at
    // 45 % of a leg, 4.5 mm, which is also the radius at 90 degrees.
    const points = roundedCorner([-0.01, 0, 0], [0, 0, 0], [0, 0.01, 0], 0.02);
    expectNear(v3Distance(points[0] as Vec3, [0, 0, 0]), 0.0045, 1e-12);
    for (const p of points) expectNear(v3Distance(p, [-0.0045, 0.0045, 0]), 0.0045, 1e-12);
  });

  it('turns a closed square into 4 straight runs and 4 bends of 3 capsules', () => {
    const square: Vec3[] = [
      [0, 0, 0],
      [0.1, 0, 0],
      [0.1, 0.1, 0],
      [0, 0.1, 0],
    ];
    const r = 0.012;
    const parts = wireParts(
      { id: 'w', points: square, radius: 0.002, closed: true, bendRadius: r },
      'm',
    );
    expect(parts).toHaveLength(16);
    expect(parts.every((p) => p.prim.kind === 'capsule')).toBe(true);
    // Length: four straights of (100 - 2 r) mm and four quarter arcs drawn as three chords.
    const expected = 4 * (0.1 - 2 * r) + 4 * 3 * 2 * r * Math.sin(deg(15));
    expectNear(capsuleLength(parts), expected, 1e-12, 'length');
    // The chain is continuous and closed: each capsule starts where the one before ends.
    parts.forEach((part, i) => {
      const next = parts[(i + 1) % parts.length];
      if (part.prim.kind !== 'capsule' || next === undefined || next.prim.kind !== 'capsule')
        return;
      expectNear(v3Distance(part.prim.b, next.prim.a), 0, 1e-12, `joint ${i}`);
    });
  });

  it('never turns more than 30 degrees between neighbouring capsules of a rounded bend', () => {
    const line = filletPolyline(
      [
        [0, 0, 0],
        [0.05, 0, 0],
        [0.05, 0, 0.08],
        [0.12, 0.03, 0.08],
      ],
      0.012,
    );
    for (let i = 1; i + 1 < line.length; i++) {
      const u = v3Normalise(v3Sub(line[i] as Vec3, line[i - 1] as Vec3));
      const v = v3Normalise(v3Sub(line[i + 1] as Vec3, line[i] as Vec3));
      const turn = Math.acos(Math.min(1, v3Dot(u, v)));
      expect(turn).toBeLessThanOrEqual(deg(30) + 1e-9);
    }
    // Ends are kept.
    expect(line[0]).toEqual([0, 0, 0]);
    expect(line[line.length - 1]).toEqual([0.12, 0.03, 0.08]);
  });
});
