import { describe, expect, it } from 'vitest';
import { maxAbsDiff, testRandom } from '../test-util.ts';
import {
  MAT3_IDENTITY,
  MAT3_ZERO,
  inertiaRotate,
  inertiaShiftFromCom,
  inertiaShiftToCom,
  mat3Add,
  mat3Column,
  mat3Det,
  mat3FromColumns,
  mat3FromDiagonal,
  mat3FromRows,
  mat3Inverse,
  mat3Mul,
  mat3MulVec3,
  mat3Outer,
  mat3RotateTensor,
  mat3Row,
  mat3Scale,
  mat3Sub,
  mat3Symmetrise,
  mat3Trace,
  mat3Transpose,
  pointMassInertia,
  symmetricEigen3,
} from './mat3.ts';
import { quatFromAxisAngle, quatFromMat3, quatRotate, quatToMat3 } from './quat.ts';
import type { Mat3, Vec3 } from './types.ts';
import { v3Cross, v3Dot, v3Length } from './vec3.ts';

const A: Mat3 = [1, 2, 3, 4, 5, 6, 7, 8, 10];

function randomSymmetric(rnd: ReturnType<typeof testRandom>, scale: number): Mat3 {
  const [a, b, c, d, e, f] = [
    rnd.range(-scale, scale),
    rnd.range(-scale, scale),
    rnd.range(-scale, scale),
    rnd.range(-scale, scale),
    rnd.range(-scale, scale),
    rnd.range(-scale, scale),
  ];
  return [a, b, c, b, d, e, c, e, f];
}

function frobenius(m: Mat3): number {
  return Math.hypot(...m);
}

describe('mat3 algebra', () => {
  it('builds from rows and columns and reads them back (exact)', () => {
    expect(mat3FromRows([1, 2, 3], [4, 5, 6], [7, 8, 10])).toEqual(A);
    expect(mat3FromColumns([1, 4, 7], [2, 5, 8], [3, 6, 10])).toEqual(A);
    expect(mat3Row(A, 1)).toEqual([4, 5, 6]);
    expect(mat3Column(A, 2)).toEqual([3, 6, 10]);
    expect(mat3Transpose(A)).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 10]);
    expect(mat3FromDiagonal([1, 2, 3])).toEqual([1, 0, 0, 0, 2, 0, 0, 0, 3]);
  });

  it('adds, subtracts, scales and takes the trace (exact)', () => {
    expect(mat3Add(A, MAT3_IDENTITY)).toEqual([2, 2, 3, 4, 6, 6, 7, 8, 11]);
    expect(mat3Sub(A, A)).toEqual(MAT3_ZERO);
    expect(mat3Scale(A, 2)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 20]);
    expect(mat3Trace(A)).toBe(16);
  });

  it('multiplies: hand-computed product and identity (exact)', () => {
    const b: Mat3 = [1, 0, 2, 0, 1, 0, 3, 0, 1];
    // Row i of A times column j of b, worked by hand.
    expect(mat3Mul(A, b)).toEqual([10, 2, 5, 22, 5, 14, 37, 8, 24]);
    expect(mat3Mul(A, MAT3_IDENTITY)).toEqual(A);
    expect(mat3Mul(MAT3_IDENTITY, A)).toEqual(A);
    expect(mat3MulVec3(A, [1, 0, -1])).toEqual([-2, -2, -3]);
  });

  it('determinant of [[1,2,3],[4,5,6],[7,8,10]] is -3 (exact)', () => {
    expect(mat3Det(A)).toBe(-3);
    expect(mat3Det(MAT3_IDENTITY)).toBe(1);
  });

  it('inverse of [[1,2,3],[4,5,6],[7,8,10]] matches the adjugate worked by hand (1e-15)', () => {
    const expected: Mat3 = [-2 / 3, -4 / 3, 1, -2 / 3, 11 / 3, -2, 1, -2, 1];
    expect(maxAbsDiff(mat3Inverse(A), expected)).toBeLessThanOrEqual(1e-15);
  });

  it('inverse times the matrix is the identity for random matrices (1e-10 relative)', () => {
    const rnd = testRandom(71);
    for (let i = 0; i < 200; i++) {
      const m: Mat3 = [
        rnd.range(-3, 3),
        rnd.range(-3, 3),
        rnd.range(-3, 3),
        rnd.range(-3, 3),
        rnd.range(-3, 3),
        rnd.range(-3, 3),
        rnd.range(-3, 3),
        rnd.range(-3, 3),
        rnd.range(-3, 3),
      ];
      if (Math.abs(mat3Det(m)) < 1e-2) continue;
      expect(maxAbsDiff(mat3Mul(mat3Inverse(m), m), MAT3_IDENTITY)).toBeLessThanOrEqual(1e-10);
    }
  });

  it('refuses to invert a singular matrix', () => {
    expect(() => mat3Inverse([1, 2, 3, 2, 4, 6, 0, 1, 0])).toThrow(RangeError);
    expect(() => mat3Inverse(MAT3_ZERO)).toThrow(RangeError);
  });

  it('outer product and symmetric part (exact)', () => {
    expect(mat3Outer([1, 2, 3], [4, 5, 6])).toEqual([4, 5, 6, 8, 10, 12, 12, 15, 18]);
    expect(mat3Symmetrise([1, 2, 4, 6, 5, 8, 0, 2, 9])).toEqual([1, 4, 2, 4, 5, 5, 2, 5, 9]);
  });
});

describe('symmetric eigen-decomposition', () => {
  it('sorts the eigenvalues of a diagonal matrix and returns axis-aligned vectors (exact)', () => {
    const { values, vectors } = symmetricEigen3(mat3FromDiagonal([3, 1, 2]));
    expect(values).toEqual([1, 2, 3]);
    // Eigenvector of 1 is y, of 2 is z, of 3 is x = y cross z.
    expect(vectors).toEqual(mat3FromColumns([0, 1, 0], [0, 0, 1], [1, 0, 0]));
  });

  it('[[2,1,0],[1,2,0],[0,0,3]] has eigenvalues 1, 3, 3 and eigenvector (1,-1,0)/sqrt2 (1e-15)', () => {
    const { values, vectors } = symmetricEigen3([2, 1, 0, 1, 2, 0, 0, 0, 3]);
    expect(maxAbsDiff(values, [1, 3, 3])).toBeLessThanOrEqual(1e-15);
    expect(
      maxAbsDiff(mat3Column(vectors, 0), [Math.SQRT1_2, -Math.SQRT1_2, 0]),
    ).toBeLessThanOrEqual(1e-15);
  });

  it('[[4,1,1],[1,4,1],[1,1,4]] has eigenvalues 3, 3, 6 with (1,1,1)/sqrt3 for 6 (1e-14)', () => {
    const { values, vectors } = symmetricEigen3([4, 1, 1, 1, 4, 1, 1, 1, 4]);
    expect(maxAbsDiff(values, [3, 3, 6])).toBeLessThanOrEqual(1e-14);
    const axis = mat3Column(vectors, 2);
    const s = 1 / Math.sqrt(3);
    expect(Math.abs(Math.abs(v3Dot(axis, [s, s, s])) - 1)).toBeLessThanOrEqual(1e-14);
  });

  it('[[2,0,0],[0,3,4],[0,4,9]] has eigenvalues 1, 2, 11 (roots of x^2 - 12x + 11) (1e-14)', () => {
    const { values } = symmetricEigen3([2, 0, 0, 0, 3, 4, 0, 4, 9]);
    expect(maxAbsDiff(values, [1, 2, 11])).toBeLessThanOrEqual(1e-14);
  });

  it('reconstructs random symmetric matrices: V D V^T = M, V orthonormal, det V = +1 (1e-13 relative)', () => {
    const rnd = testRandom(72);
    for (let i = 0; i < 500; i++) {
      const m = randomSymmetric(rnd, 10 ** rnd.range(-3, 3));
      const { values, vectors } = symmetricEigen3(m);
      const scale = frobenius(m);
      const rebuilt = mat3Mul(mat3Mul(vectors, mat3FromDiagonal(values)), mat3Transpose(vectors));
      expect(maxAbsDiff(rebuilt, m)).toBeLessThanOrEqual(1e-13 * scale);
      expect(
        maxAbsDiff(mat3Mul(mat3Transpose(vectors), vectors), MAT3_IDENTITY),
      ).toBeLessThanOrEqual(1e-14);
      expect(Math.abs(mat3Det(vectors) - 1)).toBeLessThanOrEqual(1e-14);
      expect(values[0]).toBeLessThanOrEqual(values[1]);
      expect(values[1]).toBeLessThanOrEqual(values[2]);
      // Invariants computed without the decomposition: trace and determinant.
      expect(Math.abs(values[0] + values[1] + values[2] - mat3Trace(m))).toBeLessThanOrEqual(
        1e-13 * scale,
      );
      expect(Math.abs(values[0] * values[1] * values[2] - mat3Det(m))).toBeLessThanOrEqual(
        1e-12 * scale ** 3,
      );
    }
  });

  it('each column is an eigenvector: M v = lambda v (1e-13 relative)', () => {
    const rnd = testRandom(73);
    for (let i = 0; i < 200; i++) {
      const m = randomSymmetric(rnd, 5);
      const { values, vectors } = symmetricEigen3(m);
      for (const k of [0, 1, 2] as const) {
        const v = mat3Column(vectors, k);
        const mv = mat3MulVec3(m, v);
        const lv: Vec3 = [values[k] * v[0], values[k] * v[1], values[k] * v[2]];
        expect(maxAbsDiff(mv, lv)).toBeLessThanOrEqual(1e-13 * frobenius(m));
      }
    }
  });

  it('recovers the principal moments and axes of a rotated cuboid inertia tensor (1e-12 relative)', () => {
    // Solid cuboid 0.3 x 0.2 x 0.02 m (a chopping board), 0.9 kg: I = m/12 (b^2 + c^2), ...
    const [m, a, b, c] = [0.9, 0.3, 0.2, 0.02];
    const principal: Vec3 = [
      (m / 12) * (b * b + c * c),
      (m / 12) * (a * a + c * c),
      (m / 12) * (a * a + b * b),
    ];
    const q = quatFromAxisAngle([1, 2, -0.5], 0.7);
    const rotated = inertiaRotate(mat3FromDiagonal(principal), q);
    const { values, vectors } = symmetricEigen3(rotated);
    expect(maxAbsDiff(values, principal)).toBeLessThanOrEqual(1e-12 * principal[2]);
    // Column k must be the image of body axis k, up to sign.
    const bodyAxes: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    for (const k of [0, 1, 2] as const) {
      const expected = quatRotate(q, bodyAxes[k] as Vec3);
      expect(Math.abs(Math.abs(v3Dot(mat3Column(vectors, k), expected)) - 1)).toBeLessThanOrEqual(
        1e-12,
      );
    }
    // The eigenvector matrix is a rotation, so it converts to a unit quaternion.
    expect(Math.abs(Math.hypot(...quatFromMat3(vectors)) - 1)).toBeLessThanOrEqual(1e-15);
  });

  it('keeps relative accuracy for a rod-like tensor with a 1000:1 spread of moments (1e-9)', () => {
    // Chopstick, docs/research/items.md section 5.6 [ESTIMATED]: axial 2.7e-8, transverse
    // 2.9e-5 kg m^2.
    const principal: Vec3 = [2.7e-8, 2.9e-5, 2.9e-5];
    const q = quatFromAxisAngle([0.3, -1, 0.4], 1.1);
    const { values } = symmetricEigen3(inertiaRotate(mat3FromDiagonal(principal), q));
    expect(Math.abs(values[0] - principal[0]) / principal[0]).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(values[1] - principal[1]) / principal[1]).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(values[2] - principal[2]) / principal[2]).toBeLessThanOrEqual(1e-12);
  });

  it('handles the identity, the zero matrix and a pure off-diagonal matrix', () => {
    expect(symmetricEigen3(MAT3_IDENTITY).values).toEqual([1, 1, 1]);
    expect(symmetricEigen3(MAT3_ZERO).values).toEqual([0, 0, 0]);
    // [[0,1,0],[1,0,0],[0,0,0]] has eigenvalues -1, 0, 1.
    expect(
      maxAbsDiff(symmetricEigen3([0, 1, 0, 1, 0, 0, 0, 0, 0]).values, [-1, 0, 1]),
    ).toBeLessThanOrEqual(1e-15);
    expect(() => symmetricEigen3([Number.NaN, 0, 0, 0, 1, 0, 0, 0, 1])).toThrow(RangeError);
  });

  it('is independent of scale: entries of 1e-200 or 1e200 give scaled eigenvalues (1e-14 relative)', () => {
    // [[2,0,0],[0,3,4],[0,4,9]] has eigenvalues 1, 2, 11. The convergence test squares the
    // entries, so without pre-scaling 1e-200 underflows (and 1e200 overflows) and the matrix
    // would be returned as if it were already diagonal: 2, 3, 9.
    const base: Mat3 = [2, 0, 0, 0, 3, 4, 0, 4, 9];
    for (const s of [5e-324, 1e-300, 1e-200, 1e-100, 1e-9, 1, 1e100, 1e200, 1e300]) {
      const scaled = base.map((x) => x * s) as unknown as Mat3;
      const { values, vectors } = symmetricEigen3(scaled);
      if (s === 5e-324) {
        // Subnormal entries carry too few bits for the 1e-14 bound; they must still be finite,
        // sorted and sum to the trace (14 quanta of 5e-324, exact in subnormal arithmetic).
        expect(values[0]).toBeLessThanOrEqual(values[1]);
        expect(values[1]).toBeLessThanOrEqual(values[2]);
        expect(values[0] + values[1] + values[2]).toBe(14 * 5e-324);
      } else {
        expect(
          maxAbsDiff([values[0] / s, values[1] / s, values[2] / s], [1, 2, 11]),
        ).toBeLessThanOrEqual(1e-14 * 11);
      }
      // The eigenvectors do not depend on the scale: (0, 2, -1)/sqrt5 for 1 and (0, 1, 2)/sqrt5 for 11.
      const r5 = Math.sqrt(5);
      expect(maxAbsDiff(mat3Column(vectors, 1), [1, 0, 0])).toBeLessThanOrEqual(1e-14);
      expect(maxAbsDiff(mat3Column(vectors, 0), [0, 2 / r5, -1 / r5])).toBeLessThanOrEqual(1e-14);
      expect(
        Math.abs(Math.abs(v3Dot(mat3Column(vectors, 2), [0, 1 / r5, 2 / r5])) - 1),
      ).toBeLessThanOrEqual(1e-14);
    }
  });

  it('pre-scaling is exact: a matrix scaled by a power of two gives bit-identical scaled results', () => {
    const rnd = testRandom(77);
    for (let i = 0; i < 200; i++) {
      const m = randomSymmetric(rnd, 3);
      const k = 2 ** Math.floor(rnd.range(-40, 40));
      const reference = symmetricEigen3(m);
      const scaled = symmetricEigen3(m.map((x) => x * k) as unknown as Mat3);
      expect(scaled.values).toEqual(reference.values.map((x) => x * k));
      expect(scaled.vectors).toEqual(reference.vectors);
    }
  });

  it('uses only the symmetric part of its argument (1e-15)', () => {
    const asym: Mat3 = [2, 3, 0, -1, 2, 0, 0, 0, 3]; // symmetric part [[2,1,0],[1,2,0],[0,0,3]]
    expect(maxAbsDiff(symmetricEigen3(asym).values, [1, 3, 3])).toBeLessThanOrEqual(1e-15);
  });
});

describe('inertia tensors', () => {
  it('parallel axis: solid sphere about a tangent point is 7/5 m r^2 (1e-15 relative)', () => {
    const [m, r] = [2, 0.1];
    const com = mat3FromDiagonal([0.4 * m * r * r, 0.4 * m * r * r, 0.4 * m * r * r]);
    const shifted = inertiaShiftFromCom(com, m, [r, 0, 0]);
    const expected = mat3FromDiagonal([0.4 * m * r * r, 1.4 * m * r * r, 1.4 * m * r * r]);
    expect(maxAbsDiff(shifted, expected)).toBeLessThanOrEqual(1e-15 * m * r * r);
  });

  it('parallel axis: thin rod about its end is m L^2 / 3 (1e-15 relative)', () => {
    const [m, len] = [0.02, 0.24];
    const t = (m * len * len) / 12;
    const shifted = inertiaShiftFromCom(mat3FromDiagonal([0, t, t]), m, [len / 2, 0, 0]);
    const end = (m * len * len) / 3;
    expect(maxAbsDiff(shifted, mat3FromDiagonal([0, end, end]))).toBeLessThanOrEqual(1e-15 * end);
  });

  it('a unit point mass at (1,1,0) has Ixx = Iyy = 1, Izz = 2, Ixy = -1 (exact)', () => {
    expect(pointMassInertia(1, [1, 1, 0])).toEqual([1, -1, -0, -1, 1, -0, -0, -0, 2]);
  });

  it('the shift does not depend on the sign of the offset, and shifting back restores (1e-15)', () => {
    const rnd = testRandom(74);
    for (let i = 0; i < 100; i++) {
      const inertia = mat3Add(randomSymmetric(rnd, 0.01), mat3FromDiagonal([1, 1, 1]));
      const mass = rnd.range(0.01, 4);
      const d = rnd.vec3(0.3);
      const there = inertiaShiftFromCom(inertia, mass, d);
      const mirrored = inertiaShiftFromCom(inertia, mass, [-d[0], -d[1], -d[2]]);
      expect(maxAbsDiff(there, mirrored)).toBe(0);
      expect(maxAbsDiff(inertiaShiftToCom(there, mass, d), inertia)).toBeLessThanOrEqual(1e-15);
    }
  });

  it('two point masses: composing with the parallel-axis theorem equals the direct sum (1e-15)', () => {
    // Masses 1 kg at (1,0,0) and 3 kg at (-1,2,0): centre of mass (-0.5, 1.5, 0).
    const direct = mat3Add(pointMassInertia(1, [1, 0, 0]), pointMassInertia(3, [-1, 2, 0]));
    const com: Vec3 = [-0.5, 1.5, 0];
    const aboutCom = mat3Add(
      pointMassInertia(1, [1 - com[0], 0 - com[1], 0]),
      pointMassInertia(3, [-1 - com[0], 2 - com[1], 0]),
    );
    expect(maxAbsDiff(inertiaShiftFromCom(aboutCom, 4, com), direct)).toBeLessThanOrEqual(1e-15);
  });

  it('rotation: a thin rod along x turned a quarter turn about z lies along y (1e-18)', () => {
    const t = (0.02 * 0.24 * 0.24) / 12;
    const rod = mat3FromDiagonal([0, t, t]);
    const turned = inertiaRotate(rod, quatFromAxisAngle([0, 0, 1], Math.PI / 2));
    expect(maxAbsDiff(turned, mat3FromDiagonal([t, 0, t]))).toBeLessThanOrEqual(1e-18);
  });

  it('rotation: the same rod turned 45 degrees has Ixx = Iyy = t/2 and Ixy = -t/2 (1e-18)', () => {
    // For a rod along unit vector u, I = t (1 - u u^T) with u = (1, 1, 0) / sqrt2.
    const t = (0.02 * 0.24 * 0.24) / 12;
    const turned = inertiaRotate(
      mat3FromDiagonal([0, t, t]),
      quatFromAxisAngle([0, 0, 1], Math.PI / 4),
    );
    const expected: Mat3 = [t / 2, -t / 2, 0, -t / 2, t / 2, 0, 0, 0, t];
    expect(maxAbsDiff(turned, expected)).toBeLessThanOrEqual(1e-18);
  });

  it('rotation leaves the angular momentum relation consistent: (R I R^T)(R w) = R (I w) (1e-13)', () => {
    const rnd = testRandom(75);
    for (let i = 0; i < 200; i++) {
      const inertia = mat3Add(randomSymmetric(rnd, 0.2), mat3FromDiagonal([1, 1, 1]));
      const q = rnd.unitQuat();
      const w = rnd.vec3(3);
      const lhs = mat3MulVec3(inertiaRotate(inertia, q), quatRotate(q, w));
      const rhs = quatRotate(q, mat3MulVec3(inertia, w));
      expect(maxAbsDiff(lhs, rhs)).toBeLessThanOrEqual(1e-13);
    }
  });

  it('rotation preserves the principal moments and returns an exactly symmetric tensor (1e-13)', () => {
    const rnd = testRandom(76);
    for (let i = 0; i < 100; i++) {
      const inertia = mat3Add(randomSymmetric(rnd, 0.2), mat3FromDiagonal([1, 1, 1]));
      const turned = inertiaRotate(inertia, rnd.unitQuat());
      expect(turned[1]).toBe(turned[3]);
      expect(turned[2]).toBe(turned[6]);
      expect(turned[5]).toBe(turned[7]);
      expect(
        maxAbsDiff(symmetricEigen3(turned).values, symmetricEigen3(inertia).values),
      ).toBeLessThanOrEqual(1e-13);
    }
  });

  it('mat3RotateTensor with a rotation matrix equals R T R^T written out (1e-14)', () => {
    const r = quatToMat3(quatFromAxisAngle([1, 1, 0], 0.4));
    const t: Mat3 = [2, 0.1, 0, 0.1, 3, 0.2, 0, 0.2, 4];
    const expected = mat3Mul(r, mat3Mul(t, mat3Transpose(r)));
    expect(maxAbsDiff(mat3RotateTensor(r, t), expected)).toBeLessThanOrEqual(1e-14);
    // Sanity of the helper vectors used above.
    expect(v3Length(v3Cross([1, 0, 0], [0, 1, 0]))).toBe(1);
  });
});
