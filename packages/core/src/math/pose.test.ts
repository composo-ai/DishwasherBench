import { describe, expect, it } from 'vitest';
import { maxAbsDiff, testRandom } from '../test-util.ts';
import {
  POSE_IDENTITY,
  pose,
  poseCompose,
  poseInverse,
  poseInverseTransformPoint,
  poseInverseTransformVector,
  poseRelative,
  poseTransformPoint,
  poseTransformVector,
} from './pose.ts';
import { quatAngleBetween, quatFromAxisAngle, quatRotate } from './quat.ts';
import type { Pose } from './types.ts';
import { v3Add, v3Distance } from './vec3.ts';

function randomPose(rnd: ReturnType<typeof testRandom>): Pose {
  return { p: rnd.vec3(2), q: rnd.unitQuat() };
}

describe('pose', () => {
  it('maps a child point to the parent: p + rotate(q, x), worked example (1e-15)', () => {
    // Child frame at (1, 2, 3), turned a quarter turn about +z: child +x is parent +y.
    const a = pose([1, 2, 3], quatFromAxisAngle([0, 0, 1], Math.PI / 2));
    expect(maxAbsDiff(poseTransformPoint(a, [1, 0, 0]), [1, 3, 3])).toBeLessThanOrEqual(1e-15);
    expect(maxAbsDiff(poseTransformPoint(a, [0, 1, 0]), [0, 2, 3])).toBeLessThanOrEqual(1e-15);
    expect(maxAbsDiff(poseTransformPoint(a, [0, 0, 0]), [1, 2, 3])).toBe(0);
  });

  it('with parallel axes a rack-frame position adds to the rack origin (exact)', () => {
    // Rack frame origin in the tub frame; item at (212, 148, 61) mm in the rack frame.
    const rackInTub = pose([-0.25, -0.3, 0.125]);
    expect(poseTransformPoint(rackInTub, [0.25, 0.5, 0.0625])).toEqual([0, 0.2, 0.1875]);
  });

  it('composition applies the right-hand pose first (1e-13)', () => {
    const rnd = testRandom(61);
    for (let i = 0; i < 300; i++) {
      const a = randomPose(rnd);
      const b = randomPose(rnd);
      const x = rnd.vec3(3);
      const lhs = poseTransformPoint(poseCompose(a, b), x);
      const rhs = poseTransformPoint(a, poseTransformPoint(b, x));
      expect(maxAbsDiff(lhs, rhs)).toBeLessThanOrEqual(1e-13);
    }
  });

  it('composition is associative (1e-13 m, 1e-14 rad)', () => {
    const rnd = testRandom(62);
    for (let i = 0; i < 100; i++) {
      const [a, b, c] = [randomPose(rnd), randomPose(rnd), randomPose(rnd)];
      const left = poseCompose(poseCompose(a, b), c);
      const right = poseCompose(a, poseCompose(b, c));
      expect(v3Distance(left.p, right.p)).toBeLessThanOrEqual(1e-13);
      expect(quatAngleBetween(left.q, right.q)).toBeLessThanOrEqual(1e-14);
    }
  });

  it('the inverse composes to the identity on both sides (1e-14)', () => {
    const rnd = testRandom(63);
    for (let i = 0; i < 200; i++) {
      const a = randomPose(rnd);
      for (const id of [poseCompose(a, poseInverse(a)), poseCompose(poseInverse(a), a)]) {
        expect(v3Distance(id.p, POSE_IDENTITY.p)).toBeLessThanOrEqual(1e-14);
        expect(quatAngleBetween(id.q, POSE_IDENTITY.q)).toBeLessThanOrEqual(1e-14);
      }
    }
  });

  it('inverse point transform undoes the forward one without building the inverse (1e-13)', () => {
    const rnd = testRandom(64);
    for (let i = 0; i < 200; i++) {
      const a = randomPose(rnd);
      const x = rnd.vec3(3);
      const there = poseTransformPoint(a, x);
      expect(maxAbsDiff(poseInverseTransformPoint(a, there), x)).toBeLessThanOrEqual(1e-13);
      expect(
        maxAbsDiff(poseInverseTransformPoint(a, there), poseTransformPoint(poseInverse(a), there)),
      ).toBeLessThanOrEqual(1e-13);
    }
  });

  it('vectors are rotated but not translated (1e-14)', () => {
    const rnd = testRandom(65);
    for (let i = 0; i < 100; i++) {
      const a = randomPose(rnd);
      const v = rnd.vec3(3);
      expect(maxAbsDiff(poseTransformVector(a, v), quatRotate(a.q, v))).toBe(0);
      // The difference of two transformed points is the transformed difference.
      const x = rnd.vec3(3);
      const diff = poseTransformPoint(a, v3Add(x, v)).map(
        (c, k) => c - (poseTransformPoint(a, x)[k] as number),
      );
      expect(maxAbsDiff(diff, poseTransformVector(a, v))).toBeLessThanOrEqual(1e-14);
      expect(
        maxAbsDiff(poseInverseTransformVector(a, poseTransformVector(a, v)), v),
      ).toBeLessThanOrEqual(1e-14);
    }
  });

  it('the relative pose satisfies a . relative(a, b) = b (1e-13 m, 1e-14 rad)', () => {
    const rnd = testRandom(66);
    for (let i = 0; i < 100; i++) {
      const a = randomPose(rnd);
      const b = randomPose(rnd);
      const back = poseCompose(a, poseRelative(a, b));
      expect(v3Distance(back.p, b.p)).toBeLessThanOrEqual(1e-13);
      expect(quatAngleBetween(back.q, b.q)).toBeLessThanOrEqual(1e-14);
    }
  });

  it('the inverse of a pure translation has no negative zeros', () => {
    const inv = poseInverse(pose([0, 1, 0]));
    expect(inv.p).toEqual([0, -1, 0]);
    for (const c of inv.p) expect(Object.is(c, -0)).toBe(false);
  });
});
