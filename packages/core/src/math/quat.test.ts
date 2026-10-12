import { describe, expect, it } from 'vitest';
import { maxAbsDiff, testRandom } from '../test-util.ts';
import {
  QUAT_IDENTITY,
  quat,
  quatAngleBetween,
  quatCanonical,
  quatConjugate,
  quatDot,
  quatFromAxisAngle,
  quatFromEulerXYZ,
  quatFromMat3,
  quatFromTo,
  quatInverseRotate,
  quatLength,
  quatMul,
  quatNeg,
  quatNormalise,
  quatRotate,
  quatSlerp,
  quatToAxisAngle,
  quatToEulerXYZ,
  quatToMat3,
} from './quat.ts';
import type { Mat3, Quat, Vec3 } from './types.ts';
import { v3Add, v3Cross, v3Dot, v3Length, v3Normalise, v3Scale } from './vec3.ts';

const S = Math.SQRT1_2;
const DEG = Math.PI / 180;

/** Rodrigues' rotation formula, an independent reference for rotating v about unit axis k. */
function rodrigues(k: Vec3, angle: number, v: Vec3): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return v3Add(v3Add(v3Scale(v, c), v3Scale(v3Cross(k, v), s)), v3Scale(k, v3Dot(k, v) * (1 - c)));
}

/** Textbook matrix Rx(a) Ry(b) Rz(c), row-major, written out element by element. */
function eulerMatrixXYZ(a: number, b: number, c: number): Mat3 {
  const [ca, sa, cb, sb, cc, sc] = [
    Math.cos(a),
    Math.sin(a),
    Math.cos(b),
    Math.sin(b),
    Math.cos(c),
    Math.sin(c),
  ];
  return [
    cb * cc,
    -cb * sc,
    sb,
    ca * sc + sa * sb * cc,
    ca * cc - sa * sb * sc,
    -sa * cb,
    sa * sc - ca * sb * cc,
    sa * cc + ca * sb * sc,
    ca * cb,
  ];
}

describe('quaternion basics', () => {
  it('a quarter turn about +z takes +x to +y and +y to -x (1e-15)', () => {
    const q = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    expect(maxAbsDiff(q, [0, 0, S, S])).toBeLessThanOrEqual(1e-15);
    expect(maxAbsDiff(quatRotate(q, [1, 0, 0]), [0, 1, 0])).toBeLessThanOrEqual(1e-15);
    expect(maxAbsDiff(quatRotate(q, [0, 1, 0]), [-1, 0, 0])).toBeLessThanOrEqual(1e-15);
    expect(maxAbsDiff(quatRotate(q, [0, 0, 1]), [0, 0, 1])).toBeLessThanOrEqual(1e-15);
  });

  it('rotation agrees with the Rodrigues formula for random axes, angles and vectors (1e-13)', () => {
    const rnd = testRandom(11);
    for (let i = 0; i < 500; i++) {
      const k = rnd.unitVec3();
      const angle = rnd.range(-2 * Math.PI, 2 * Math.PI);
      const v = rnd.vec3(5);
      const q = quatFromAxisAngle(v3Scale(k, rnd.range(0.1, 10)), angle);
      expect(maxAbsDiff(quatRotate(q, v), rodrigues(k, angle, v))).toBeLessThanOrEqual(1e-13);
    }
  });

  it('axis-angle quaternions are unit length (1e-15) and a zero angle is the identity', () => {
    const rnd = testRandom(12);
    for (let i = 0; i < 100; i++) {
      const q = quatFromAxisAngle(rnd.vec3(3), rnd.range(-7, 7));
      expect(Math.abs(quatLength(q) - 1)).toBeLessThanOrEqual(1e-15);
    }
    expect(quatFromAxisAngle([0, 0, 0], 0)).toEqual(QUAT_IDENTITY);
    expect(() => quatFromAxisAngle([0, 0, 0], 1)).toThrow(RangeError);
  });

  it('qx(90) * qy(90) is (0.5,0.5,0.5,0.5), a 120 degree turn about (1,1,1) (1e-15)', () => {
    // qx(90) * qy(90): apply the y turn first, then the x turn. x -> -z -> y; y -> y -> z; z -> x.
    const q = quatMul(
      quatFromAxisAngle([1, 0, 0], Math.PI / 2),
      quatFromAxisAngle([0, 1, 0], Math.PI / 2),
    );
    expect(maxAbsDiff(q, [0.5, 0.5, 0.5, 0.5])).toBeLessThanOrEqual(1e-15);
    expect(maxAbsDiff(quatRotate(q, [1, 0, 0]), [0, 1, 0])).toBeLessThanOrEqual(1e-15);
    expect(maxAbsDiff(quatRotate(q, [0, 1, 0]), [0, 0, 1])).toBeLessThanOrEqual(1e-15);
    expect(maxAbsDiff(quatRotate(q, [0, 0, 1]), [1, 0, 0])).toBeLessThanOrEqual(1e-15);
    const { axis, angle } = quatToAxisAngle(q);
    expect(angle).toBeCloseTo((2 * Math.PI) / 3, 14);
    expect(maxAbsDiff(axis, v3Normalise([1, 1, 1]))).toBeLessThanOrEqual(1e-15);
  });

  it('composition: rotate(a * b, v) = rotate(a, rotate(b, v)) (1e-13)', () => {
    const rnd = testRandom(13);
    for (let i = 0; i < 300; i++) {
      const a = rnd.unitQuat();
      const b = rnd.unitQuat();
      const v = rnd.vec3(4);
      const lhs = quatRotate(quatMul(a, b), v);
      const rhs = quatRotate(a, quatRotate(b, v));
      expect(maxAbsDiff(lhs, rhs)).toBeLessThanOrEqual(1e-13);
    }
  });

  it('the conjugate is the inverse: q * conj(q) = identity, and inverse-rotate undoes rotate (1e-14)', () => {
    const rnd = testRandom(14);
    for (let i = 0; i < 200; i++) {
      const q = rnd.unitQuat();
      const v = rnd.vec3(2);
      expect(maxAbsDiff(quatMul(q, quatConjugate(q)), QUAT_IDENTITY)).toBeLessThanOrEqual(1e-15);
      expect(maxAbsDiff(quatInverseRotate(q, quatRotate(q, v)), v)).toBeLessThanOrEqual(1e-14);
    }
  });

  it('rotation preserves length and dot products (1e-13)', () => {
    const rnd = testRandom(15);
    for (let i = 0; i < 200; i++) {
      const q = rnd.unitQuat();
      const a = rnd.vec3(3);
      const b = rnd.vec3(3);
      expect(Math.abs(v3Length(quatRotate(q, a)) - v3Length(a))).toBeLessThanOrEqual(1e-13);
      expect(Math.abs(v3Dot(quatRotate(q, a), quatRotate(q, b)) - v3Dot(a, b))).toBeLessThanOrEqual(
        1e-13,
      );
    }
  });

  it('normalise scales to unit length and rejects a quaternion with no direction', () => {
    expect(quatNormalise([0, 0, 0, 2])).toEqual(QUAT_IDENTITY);
    expect(maxAbsDiff(quatNormalise([1, 1, 1, 1]), [0.5, 0.5, 0.5, 0.5])).toBe(0);
    expect(() => quatNormalise([0, 0, 0, 0])).toThrow(RangeError);
    expect(() => quatNormalise([Number.NaN, 0, 0, 1])).toThrow(RangeError);
    expect(quatDot([1, 2, 3, 4], [5, 6, 7, 8])).toBe(70);
    expect(quatNeg([1, -2, 3, -4])).toEqual([-1, 2, -3, 4]);
    expect(quat(1, 2, 3, 4)).toEqual([1, 2, 3, 4]);
  });

  it('canonical form has the first non-zero of (w, x, y, z) positive and no negative zeros', () => {
    expect(quatCanonical([0.1, -0.2, 0.3, -0.9])).toEqual([-0.1, 0.2, -0.3, 0.9]);
    expect(quatCanonical([0.1, -0.2, 0.3, 0.9])).toEqual([0.1, -0.2, 0.3, 0.9]);
    // Half turns have w = 0; the sign is then fixed by x, then y, then z.
    expect(quatCanonical([-1, 0, 0, 0])).toEqual([1, 0, 0, 0]);
    expect(quatCanonical([0, -S, S, 0])).toEqual([0, S, -S, 0]);
    expect(quatCanonical([0, 0, -1, 0])).toEqual([0, 0, 1, 0]);
    for (const c of quatCanonical([-0, 0, -1, -0])) expect(Object.is(c, -0)).toBe(false);
    for (const c of quatCanonical([-0, -0, -0, 1])) expect(Object.is(c, -0)).toBe(false);
  });
});

describe('Euler angles (intrinsic X-Y-Z)', () => {
  it('equals qx * qy * qz built from axis-angle quaternions (1e-15)', () => {
    const rnd = testRandom(21);
    for (let i = 0; i < 300; i++) {
      const [a, b, c] = [rnd.range(-4, 4), rnd.range(-4, 4), rnd.range(-4, 4)];
      const composed = quatMul(
        quatMul(quatFromAxisAngle([1, 0, 0], a), quatFromAxisAngle([0, 1, 0], b)),
        quatFromAxisAngle([0, 0, 1], c),
      );
      expect(maxAbsDiff(quatFromEulerXYZ(a, b, c), composed)).toBeLessThanOrEqual(1e-15);
    }
  });

  it('gives the textbook matrix Rx(a) Ry(b) Rz(c) (1e-14)', () => {
    const rnd = testRandom(22);
    for (let i = 0; i < 300; i++) {
      const [a, b, c] = [rnd.range(-4, 4), rnd.range(-4, 4), rnd.range(-4, 4)];
      const m = quatToMat3(quatFromEulerXYZ(a, b, c));
      expect(maxAbsDiff(m, eulerMatrixXYZ(a, b, c))).toBeLessThanOrEqual(1e-14);
    }
  });

  it('is intrinsic: (90, 0, 90) degrees turns about x, then about the new z (1e-15)', () => {
    // After the x turn the body z axis points along -y. Turning about it takes body x to +z.
    const q = quatFromEulerXYZ(90 * DEG, 0, 90 * DEG);
    expect(maxAbsDiff(quatRotate(q, [0, 0, 1]), [0, -1, 0])).toBeLessThanOrEqual(1e-15);
    expect(maxAbsDiff(quatRotate(q, [1, 0, 0]), [0, 0, 1])).toBeLessThanOrEqual(1e-15);
  });

  it('the catalogue preset rot_xyz_deg = [180, 0, 0] inverts an item: +z to -z, +y to -y', () => {
    const q = quatFromEulerXYZ(180 * DEG, 0, 0);
    expect(maxAbsDiff(quatRotate(q, [0, 0, 1]), [0, 0, -1])).toBeLessThanOrEqual(2e-16);
    expect(maxAbsDiff(quatRotate(q, [0, 1, 0]), [0, -1, 0])).toBeLessThanOrEqual(2e-16);
    expect(maxAbsDiff(quatRotate(q, [1, 0, 0]), [1, 0, 0])).toBeLessThanOrEqual(2e-16);
  });

  it('round-trips through quatToEulerXYZ away from gimbal lock (1e-12 rad)', () => {
    const rnd = testRandom(23);
    for (let i = 0; i < 300; i++) {
      const angles: Vec3 = [rnd.range(-3.1, 3.1), rnd.range(-1.55, 1.55), rnd.range(-3.1, 3.1)];
      const back = quatToEulerXYZ(quatFromEulerXYZ(angles[0], angles[1], angles[2]));
      expect(maxAbsDiff(back, angles)).toBeLessThanOrEqual(1e-12);
    }
  });

  it('at gimbal lock returns angles that reproduce the same rotation (1e-7 rad)', () => {
    for (const ry of [90 * DEG, -90 * DEG]) {
      const q = quatFromEulerXYZ(0.3, ry, -1.1);
      const e = quatToEulerXYZ(q);
      expect(e[2]).toBe(0);
      expect(quatAngleBetween(q, quatFromEulerXYZ(e[0], e[1], e[2]))).toBeLessThanOrEqual(1e-7);
    }
  });
});

describe('rotation matrices', () => {
  it('a quarter turn about +z is [[0,-1,0],[1,0,0],[0,0,1]] (1e-15)', () => {
    const m = quatToMat3(quatFromAxisAngle([0, 0, 1], Math.PI / 2));
    expect(maxAbsDiff(m, [0, -1, 0, 1, 0, 0, 0, 0, 1])).toBeLessThanOrEqual(3e-16);
  });

  it('M v equals quatRotate(q, v) (1e-13)', () => {
    const rnd = testRandom(31);
    for (let i = 0; i < 200; i++) {
      const q = rnd.unitQuat();
      const v = rnd.vec3(3);
      const m = quatToMat3(q);
      const mv: Vec3 = [
        m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
        m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
        m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
      ];
      expect(maxAbsDiff(mv, quatRotate(q, v))).toBeLessThanOrEqual(1e-13);
    }
  });

  it('quatFromMat3 inverts quatToMat3 for random rotations, in canonical sign (1e-14 rad)', () => {
    const rnd = testRandom(32);
    for (let i = 0; i < 500; i++) {
      const q = rnd.unitQuat();
      const back = quatFromMat3(quatToMat3(q));
      expect(quatAngleBetween(q, back)).toBeLessThanOrEqual(1e-14);
      expect(back[3]).toBeGreaterThanOrEqual(0);
      expect(Math.abs(quatLength(back) - 1)).toBeLessThanOrEqual(1e-15);
    }
  });

  it('quatFromMat3 handles half turns, where the trace is -1 (every branch; 1e-15)', () => {
    const cases: Quat[] = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [S, S, 0, 0],
      [0, S, S, 0],
      [S, 0, S, 0],
      quatNormalise([0.2, 0.9, 0.3, 1e-9]),
      quatNormalise([0.2, 0.3, 0.9, -1e-9]),
    ];
    for (const q of cases) {
      const back = quatFromMat3(quatToMat3(q));
      expect(maxAbsDiff(back, quatCanonical(q))).toBeLessThanOrEqual(1e-15);
    }
  });
});

describe('slerp and angles', () => {
  it('angle between the identity and a quarter turn is pi/2; q and -q are the same rotation', () => {
    const q = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
    expect(quatAngleBetween(QUAT_IDENTITY, q)).toBeCloseTo(Math.PI / 2, 14);
    expect(quatAngleBetween(q, quatNeg(q))).toBeLessThanOrEqual(1e-15);
  });

  it('angle between two turns about the same axis is the difference of their angles (1e-13)', () => {
    const rnd = testRandom(41);
    for (let i = 0; i < 100; i++) {
      const k = rnd.unitVec3();
      const a = rnd.range(-1.5, 1.5);
      const b = rnd.range(-1.5, 1.5);
      const angle = quatAngleBetween(quatFromAxisAngle(k, a), quatFromAxisAngle(k, b));
      expect(Math.abs(angle - Math.abs(a - b))).toBeLessThanOrEqual(1e-13);
    }
  });

  it('slerp halfway from the identity to a quarter turn about z is an eighth turn (1e-15)', () => {
    const q = quatSlerp(QUAT_IDENTITY, quatFromAxisAngle([0, 0, 1], Math.PI / 2), 0.5);
    expect(maxAbsDiff(q, quatFromAxisAngle([0, 0, 1], Math.PI / 4))).toBeLessThanOrEqual(1e-15);
  });

  it('slerp returns the end points at t = 0 and t = 1 (1e-15)', () => {
    const rnd = testRandom(42);
    for (let i = 0; i < 50; i++) {
      const a = rnd.unitQuat();
      const b = rnd.unitQuat();
      expect(quatAngleBetween(quatSlerp(a, b, 0), a)).toBeLessThanOrEqual(1e-14);
      expect(quatAngleBetween(quatSlerp(a, b, 1), b)).toBeLessThanOrEqual(1e-14);
    }
  });

  it('slerp moves at constant angular speed: angle(a, slerp(a, b, t)) = t * angle(a, b) (1e-12)', () => {
    const rnd = testRandom(43);
    for (let i = 0; i < 200; i++) {
      const a = rnd.unitQuat();
      const b = rnd.unitQuat();
      const t = rnd.next();
      const q = quatSlerp(a, b, t);
      expect(Math.abs(quatLength(q) - 1)).toBeLessThanOrEqual(1e-15);
      expect(Math.abs(quatAngleBetween(a, q) - t * quatAngleBetween(a, b))).toBeLessThanOrEqual(
        1e-12,
      );
    }
  });

  it('slerp takes the shorter arc: replacing b by -b does not change the rotation (1e-14)', () => {
    const rnd = testRandom(44);
    for (let i = 0; i < 100; i++) {
      const a = rnd.unitQuat();
      const b = rnd.unitQuat();
      const t = rnd.next();
      expect(quatAngleBetween(quatSlerp(a, b, t), quatSlerp(a, quatNeg(b), t))).toBeLessThanOrEqual(
        1e-14,
      );
    }
  });

  it('slerp between nearly identical rotations stays finite and unit (1e-15)', () => {
    const a = quatFromAxisAngle([0, 0, 1], 0.3);
    const b = quatFromAxisAngle([0, 0, 1], 0.3 + 1e-9);
    const q = quatSlerp(a, b, 0.25);
    expect(Math.abs(quatLength(q) - 1)).toBeLessThanOrEqual(1e-15);
    expect(quatAngleBetween(a, q)).toBeLessThanOrEqual(1e-9);
  });

  it('axis-angle extraction inverts construction, with the angle in [0, pi] (1e-13)', () => {
    const rnd = testRandom(45);
    for (let i = 0; i < 200; i++) {
      const k = rnd.unitVec3();
      const angle = rnd.range(0.01, Math.PI - 0.01);
      const { axis, angle: back } = quatToAxisAngle(quatFromAxisAngle(k, angle));
      expect(Math.abs(back - angle)).toBeLessThanOrEqual(1e-13);
      expect(maxAbsDiff(axis, k)).toBeLessThanOrEqual(1e-13);
    }
    expect(quatToAxisAngle(QUAT_IDENTITY)).toEqual({ axis: [0, 0, 1], angle: 0 });
  });
});

describe('quatFromTo', () => {
  it('rotates the first direction onto the second (1e-14) by the smallest angle', () => {
    const rnd = testRandom(51);
    for (let i = 0; i < 300; i++) {
      const a = rnd.unitVec3();
      const b = rnd.unitVec3();
      const q = quatFromTo(v3Scale(a, rnd.range(0.1, 9)), v3Scale(b, rnd.range(0.1, 9)));
      expect(maxAbsDiff(quatRotate(q, a), b)).toBeLessThanOrEqual(1e-14);
      const expectedAngle = Math.atan2(v3Length(v3Cross(a, b)), v3Dot(a, b));
      expect(Math.abs(quatToAxisAngle(q).angle - expectedAngle)).toBeLessThanOrEqual(1e-13);
    }
  });

  it('is the identity for equal directions and a half turn for opposite ones (1e-15)', () => {
    expect(maxAbsDiff(quatFromTo([0, 0, 2], [0, 0, 5]), QUAT_IDENTITY)).toBeLessThanOrEqual(1e-15);
    for (const a of [[1, 0, 0], [0, 1, 0], [0, 0, 1], v3Normalise([1, -2, 3])] as Vec3[]) {
      const q = quatFromTo(a, v3Scale(a, -1));
      expect(Math.abs(quatLength(q) - 1)).toBeLessThanOrEqual(1e-15);
      expect(maxAbsDiff(quatRotate(q, a), v3Scale(a, -1))).toBeLessThanOrEqual(1e-15);
    }
    expect(() => quatFromTo([0, 0, 0], [1, 0, 0])).toThrow(RangeError);
  });
});
