import { describe, expect, it } from 'vitest';
import { testRandom } from '../test-util.ts';
import {
  V3_X,
  V3_Y,
  V3_Z,
  V3_ZERO,
  v3,
  v3Add,
  v3AddScaled,
  v3AnyPerpendicular,
  v3ApproxEquals,
  v3Cross,
  v3Distance,
  v3Dot,
  v3IsFinite,
  v3Length,
  v3LengthSq,
  v3Lerp,
  v3Max,
  v3Min,
  v3Mul,
  v3Neg,
  v3Normalise,
  v3Scale,
  v3Sub,
} from './vec3.ts';

describe('vec3 arithmetic', () => {
  it('adds, subtracts, scales and negates component-wise (exact in small integers)', () => {
    expect(v3Add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(v3Sub([1, 2, 3], [4, 5, 6])).toEqual([-3, -3, -3]);
    expect(v3Scale([1, -2, 3], 2)).toEqual([2, -4, 6]);
    expect(v3Neg([1, -2, 3])).toEqual([-1, 2, -3]);
    expect(v3Mul([1, 2, 3], [4, 5, 6])).toEqual([4, 10, 18]);
    expect(v3AddScaled([1, 2, 3], [4, 5, 6], 2)).toEqual([9, 12, 15]);
    expect(v3(7, 8, 9)).toEqual([7, 8, 9]);
  });

  it('dot product of (1,2,3) and (4,5,6) is 32', () => {
    expect(v3Dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('cross product is right-handed: x cross y = z, y cross z = x, z cross x = y', () => {
    expect(v3Cross(V3_X, V3_Y)).toEqual(V3_Z);
    expect(v3Cross(V3_Y, V3_Z)).toEqual(V3_X);
    expect(v3Cross(V3_Z, V3_X)).toEqual(V3_Y);
  });

  it('cross product of (1,2,3) and (4,5,6) is (-3,6,-3), and is anti-commutative', () => {
    expect(v3Cross([1, 2, 3], [4, 5, 6])).toEqual([-3, 6, -3]);
    expect(v3Cross([4, 5, 6], [1, 2, 3])).toEqual([3, -6, 3]);
  });

  it('satisfies the Lagrange identity |a x b|^2 = |a|^2 |b|^2 - (a.b)^2 to 1e-12 relative', () => {
    const rnd = testRandom(1);
    for (let i = 0; i < 200; i++) {
      const a = rnd.vec3(10);
      const b = rnd.vec3(10);
      const lhs = v3LengthSq(v3Cross(a, b));
      const rhs = v3LengthSq(a) * v3LengthSq(b) - v3Dot(a, b) ** 2;
      expect(Math.abs(lhs - rhs)).toBeLessThanOrEqual(1e-12 * v3LengthSq(a) * v3LengthSq(b));
    }
  });
});

describe('vec3 lengths', () => {
  it('length of the Pythagorean quadruple (3,4,12) is exactly 13', () => {
    expect(v3Length([3, 4, 12])).toBe(13);
    expect(v3LengthSq([3, 4, 12])).toBe(169);
    expect(v3Distance([1, 1, 1], [4, 5, 13])).toBe(13);
  });

  it('length does not overflow or underflow for extreme magnitudes (1e-12 relative)', () => {
    expect(v3Length([1e200, 1e200, 0]) / (Math.SQRT2 * 1e200)).toBeCloseTo(1, 12);
    expect(v3Length([3e-200, 4e-200, 0]) / 5e-200).toBeCloseTo(1, 12);
  });

  it('normalises (3,4,0) to (0.6,0.8,0) within 1e-15', () => {
    const n = v3Normalise([3, 4, 0]);
    expect(v3ApproxEquals(n, [0.6, 0.8, 0], 1e-15)).toBe(true);
  });

  it('normalised random vectors have unit length within 1e-15', () => {
    const rnd = testRandom(2);
    for (let i = 0; i < 200; i++) {
      expect(Math.abs(v3Length(v3Normalise(rnd.vec3(1e3))) - 1)).toBeLessThanOrEqual(1e-15);
    }
  });

  it('returns the fallback for a vector with no direction', () => {
    expect(v3Normalise([0, 0, 0])).toEqual(V3_ZERO);
    expect(v3Normalise([0, 0, 0], V3_Z)).toEqual(V3_Z);
    expect(v3Normalise([Number.NaN, 0, 0], V3_X)).toEqual(V3_X);
    expect(v3Normalise([Number.POSITIVE_INFINITY, 0, 0], V3_X)).toEqual(V3_X);
  });
});

describe('vec3 helpers', () => {
  it('lerp hits the end points exactly and the midpoint analytically', () => {
    expect(v3Lerp([1, 2, 3], [5, 10, -1], 0)).toEqual([1, 2, 3]);
    expect(v3Lerp([1, 2, 3], [5, 10, -1], 1)).toEqual([5, 10, -1]);
    expect(v3Lerp([1, 2, 3], [5, 10, -1], 0.5)).toEqual([3, 6, 1]);
  });

  it('min and max are component-wise', () => {
    expect(v3Min([1, 5, -3], [2, 4, -4])).toEqual([1, 4, -4]);
    expect(v3Max([1, 5, -3], [2, 4, -4])).toEqual([2, 5, -3]);
  });

  it('approximate equality uses an absolute per-component tolerance', () => {
    expect(v3ApproxEquals([1, 2, 3], [1.0005, 2, 3], 1e-3)).toBe(true);
    expect(v3ApproxEquals([1, 2, 3], [1.002, 2, 3], 1e-3)).toBe(false);
  });

  it('detects non-finite components', () => {
    expect(v3IsFinite([1, 2, 3])).toBe(true);
    expect(v3IsFinite([1, Number.NaN, 3])).toBe(false);
    expect(v3IsFinite([1, 2, Number.NEGATIVE_INFINITY])).toBe(false);
  });

  it('any-perpendicular is unit and orthogonal within 1e-15, including for axis-aligned input', () => {
    const rnd = testRandom(3);
    const inputs = [V3_X, V3_Y, V3_Z, v3(0, 0, -5), v3(1, 1, 1)];
    for (let i = 0; i < 100; i++) inputs.push(rnd.vec3(7));
    for (const a of inputs) {
      const p = v3AnyPerpendicular(a);
      expect(Math.abs(v3Length(p) - 1)).toBeLessThanOrEqual(1e-15);
      expect(Math.abs(v3Dot(p, a)) / v3Length(a)).toBeLessThanOrEqual(1e-15);
    }
    expect(() => v3AnyPerpendicular([0, 0, 0])).toThrow(RangeError);
  });
});
