import { quatToMat3 } from './quat.ts';
import type { Mat3, Quat, Vec3 } from './types.ts';

/** The 3x3 identity matrix. */
export const MAT3_IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** The 3x3 zero matrix. */
export const MAT3_ZERO: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Builds a matrix from its three rows. */
export function mat3FromRows(r0: Vec3, r1: Vec3, r2: Vec3): Mat3 {
  return [r0[0], r0[1], r0[2], r1[0], r1[1], r1[2], r2[0], r2[1], r2[2]];
}

/** Builds a matrix from its three columns. */
export function mat3FromColumns(c0: Vec3, c1: Vec3, c2: Vec3): Mat3 {
  return [c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]];
}

/** Row `i` (0, 1 or 2) of a matrix. */
export function mat3Row(m: Mat3, i: 0 | 1 | 2): Vec3 {
  const o = 3 * i;
  return [m[o] as number, m[o + 1] as number, m[o + 2] as number];
}

/** Column `j` (0, 1 or 2) of a matrix. */
export function mat3Column(m: Mat3, j: 0 | 1 | 2): Vec3 {
  return [m[j] as number, m[3 + j] as number, m[6 + j] as number];
}

/** Diagonal matrix with the given diagonal entries. */
export function mat3FromDiagonal(d: Vec3): Mat3 {
  return [d[0], 0, 0, 0, d[1], 0, 0, 0, d[2]];
}

/** Transpose. */
export function mat3Transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** Element-wise sum. */
export function mat3Add(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
    a[3] + b[3],
    a[4] + b[4],
    a[5] + b[5],
    a[6] + b[6],
    a[7] + b[7],
    a[8] + b[8],
  ];
}

/** Element-wise difference `a - b`. */
export function mat3Sub(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
    a[3] - b[3],
    a[4] - b[4],
    a[5] - b[5],
    a[6] - b[6],
    a[7] - b[7],
    a[8] - b[8],
  ];
}

/** Matrix scaled by the scalar `s`. */
export function mat3Scale(m: Mat3, s: number): Mat3 {
  return [m[0] * s, m[1] * s, m[2] * s, m[3] * s, m[4] * s, m[5] * s, m[6] * s, m[7] * s, m[8] * s];
}

/** Matrix product `a b`. */
export function mat3Mul(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

/** Matrix-vector product `m v` (v as a column vector). */
export function mat3MulVec3(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Sum of the diagonal entries. */
export function mat3Trace(m: Mat3): number {
  return m[0] + m[4] + m[8];
}

/** Determinant. */
export function mat3Det(m: Mat3): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

/**
 * Inverse by the adjugate formula. Throws a RangeError when the determinant is zero or not
 * finite; callers that may hold a singular matrix should test `mat3Det` first.
 */
export function mat3Inverse(m: Mat3): Mat3 {
  const c00 = m[4] * m[8] - m[5] * m[7];
  const c01 = m[5] * m[6] - m[3] * m[8];
  const c02 = m[3] * m[7] - m[4] * m[6];
  const det = m[0] * c00 + m[1] * c01 + m[2] * c02;
  if (det === 0 || !Number.isFinite(det)) {
    throw new RangeError('mat3Inverse: matrix is singular or not finite');
  }
  const inv = 1 / det;
  return [
    c00 * inv,
    (m[2] * m[7] - m[1] * m[8]) * inv,
    (m[1] * m[5] - m[2] * m[4]) * inv,
    c01 * inv,
    (m[0] * m[8] - m[2] * m[6]) * inv,
    (m[2] * m[3] - m[0] * m[5]) * inv,
    c02 * inv,
    (m[1] * m[6] - m[0] * m[7]) * inv,
    (m[0] * m[4] - m[1] * m[3]) * inv,
  ];
}

/** Outer product `a b^T`. */
export function mat3Outer(a: Vec3, b: Vec3): Mat3 {
  return [
    a[0] * b[0],
    a[0] * b[1],
    a[0] * b[2],
    a[1] * b[0],
    a[1] * b[1],
    a[1] * b[2],
    a[2] * b[0],
    a[2] * b[1],
    a[2] * b[2],
  ];
}

/** Symmetric part `(m + m^T) / 2`; removes rounding asymmetry from a tensor. */
export function mat3Symmetrise(m: Mat3): Mat3 {
  const a01 = 0.5 * (m[1] + m[3]);
  const a02 = 0.5 * (m[2] + m[6]);
  const a12 = 0.5 * (m[5] + m[7]);
  return [m[0], a01, a02, a01, m[4], a12, a02, a12, m[8]];
}

/**
 * Change of basis of a second-order tensor: `r t r^T`. With `r` the rotation that maps frame-B
 * coordinates to frame-A coordinates and `t` a tensor (for example an inertia tensor) expressed
 * in frame B, the result is the same tensor expressed in frame A.
 */
export function mat3RotateTensor(r: Mat3, t: Mat3): Mat3 {
  return mat3Mul(mat3Mul(r, t), mat3Transpose(r));
}

/** Result of {@link symmetricEigen3}. */
export interface SymmetricEigen3 {
  /** Eigenvalues in ascending order. */
  readonly values: Vec3;
  /**
   * Proper rotation matrix (determinant +1) whose column `k` is the unit eigenvector for
   * `values[k]`, so that `m = vectors * diag(values) * vectors^T`. It maps principal-axis
   * coordinates to the coordinates `m` was given in.
   */
  readonly vectors: Mat3;
}

const JACOBI_MAX_SWEEPS = 32;

/**
 * Eigen-decomposition of a real symmetric 3x3 matrix by cyclic Jacobi rotations, accurate to
 * rounding error (relative to the largest eigenvalue) and deterministic. Only the symmetric part
 * of `m` is used. Eigenvector signs are fixed by a convention: in columns 0 and 1 the component of
 * largest magnitude is positive, and column 2 is their cross product, which makes the basis
 * right-handed. For repeated eigenvalues the eigenvectors are an arbitrary orthonormal basis of
 * the eigenspace. Used for principal moments and axes of inertia (kg m^2 in, kg m^2 out).
 *
 * The matrix is scaled by a power of two before the iteration (an exact operation), so the
 * result does not depend on the magnitude of the entries: the convergence test squares them,
 * which would otherwise underflow or overflow for entries beyond about 1e-160 and 1e150.
 */
export function symmetricEigen3(m: Mat3): SymmetricEigen3 {
  let largest = 0;
  for (const x of m) {
    if (!Number.isFinite(x)) throw new RangeError('symmetricEigen3: matrix is not finite');
    largest = Math.max(largest, Math.abs(x));
  }
  // 2^e with 2^e <= largest (to within the rounding of log2), kept inside the range of doubles.
  const scale =
    largest === 0 ? 1 : 2 ** Math.min(1023, Math.max(-1074, Math.floor(Math.log2(largest))));
  // a is the working symmetric matrix, v accumulates the rotations (both row-major).
  const a01 = 0.5 * (m[1] / scale + m[3] / scale);
  const a02 = 0.5 * (m[2] / scale + m[6] / scale);
  const a12 = 0.5 * (m[5] / scale + m[7] / scale);
  const a = [m[0] / scale, a01, a02, a01, m[4] / scale, a12, a02, a12, m[8] / scale];
  const v = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const at = (arr: number[], i: number, j: number): number => arr[3 * i + j] as number;

  for (let sweep = 0; sweep < JACOBI_MAX_SWEEPS; sweep++) {
    const off = at(a, 0, 1) ** 2 + at(a, 0, 2) ** 2 + at(a, 1, 2) ** 2;
    if (off === 0) break;
    const diag = at(a, 0, 0) ** 2 + at(a, 1, 1) ** 2 + at(a, 2, 2) ** 2;
    // Converged when the off-diagonal part is below rounding error of the diagonal part.
    if (off <= 1e-32 * diag) break;
    for (let p = 0; p < 2; p++) {
      for (let q = p + 1; q < 3; q++) {
        const apq = at(a, p, q);
        if (apq === 0) continue;
        const app = at(a, p, p);
        const aqq = at(a, q, q);
        const theta = (aqq - app) / (2 * apq);
        // Smaller root of t^2 + 2 theta t - 1 = 0, computed without cancellation.
        const t =
          Math.abs(theta) > 1e150
            ? 0.5 / theta
            : (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        a[3 * p + p] = app - t * apq;
        a[3 * q + q] = aqq + t * apq;
        a[3 * p + q] = 0;
        a[3 * q + p] = 0;
        const r = 3 - p - q; // the remaining index
        const arp = at(a, r, p);
        const arq = at(a, r, q);
        const nrp = c * arp - s * arq;
        const nrq = s * arp + c * arq;
        a[3 * r + p] = nrp;
        a[3 * p + r] = nrp;
        a[3 * r + q] = nrq;
        a[3 * q + r] = nrq;
        for (let k = 0; k < 3; k++) {
          const vkp = at(v, k, p);
          const vkq = at(v, k, q);
          v[3 * k + p] = c * vkp - s * vkq;
          v[3 * k + q] = s * vkp + c * vkq;
        }
      }
    }
  }

  // Sort ascending; ties keep their original column order so the result is deterministic.
  const order = [0, 1, 2].sort((i, j) => at(a, i, i) - at(a, j, j) || i - j) as [
    number,
    number,
    number,
  ];
  const column = (j: number): Vec3 => [at(v, 0, j), at(v, 1, j), at(v, 2, j)];
  const fixSign = (c: Vec3): Vec3 => {
    const ax = Math.abs(c[0]);
    const ay = Math.abs(c[1]);
    const az = Math.abs(c[2]);
    const lead = ax >= ay && ax >= az ? c[0] : ay >= az ? c[1] : c[2];
    return lead < 0 ? [-c[0] + 0, -c[1] + 0, -c[2] + 0] : c;
  };
  const c0 = fixSign(column(order[0]));
  const c1 = fixSign(column(order[1]));
  const c2: Vec3 = [
    c0[1] * c1[2] - c0[2] * c1[1],
    c0[2] * c1[0] - c0[0] * c1[2],
    c0[0] * c1[1] - c0[1] * c1[0],
  ];
  return {
    values: [
      at(a, order[0], order[0]) * scale,
      at(a, order[1], order[1]) * scale,
      at(a, order[2], order[2]) * scale,
    ],
    vectors: mat3FromColumns(c0, c1, c2),
  };
}

/**
 * Parallel-axis (Steiner) shift away from the centre of mass. Given the inertia tensor about the
 * centre of mass (kg m^2), the mass (kg) and the offset `d` (metres) from the centre of mass to a
 * new reference point, returns the inertia tensor about that point, in the same axes:
 * `I' = I + m (|d|^2 1 - d d^T)`. The sign of `d` does not matter.
 */
export function inertiaShiftFromCom(inertiaCom: Mat3, mass: number, d: Vec3): Mat3 {
  return mat3Add(inertiaCom, pointMassInertia(mass, d));
}

/**
 * Inverse of {@link inertiaShiftFromCom}: given the inertia tensor about a reference point that
 * is offset by `d` (metres) from the centre of mass, returns the tensor about the centre of mass:
 * `I_com = I - m (|d|^2 1 - d d^T)`.
 */
export function inertiaShiftToCom(inertia: Mat3, mass: number, d: Vec3): Mat3 {
  return mat3Sub(inertia, pointMassInertia(mass, d));
}

/**
 * Inertia tensor (kg m^2) about the origin of a point mass `mass` (kg) at position `d` (metres):
 * `m (|d|^2 1 - d d^T)`.
 */
export function pointMassInertia(mass: number, d: Vec3): Mat3 {
  const [x, y, z] = d;
  return [
    mass * (y * y + z * z),
    -mass * x * y,
    -mass * x * z,
    -mass * x * y,
    mass * (x * x + z * z),
    -mass * y * z,
    -mass * x * z,
    -mass * y * z,
    mass * (x * x + y * y),
  ];
}

/**
 * Re-expresses an inertia tensor in a rotated frame. `inertia` is given in a body (child) frame
 * and `q` is the unit quaternion that maps body-frame vectors to parent-frame vectors; the result
 * is the tensor in parent-frame axes, `R I R^T`, about the same point.
 */
export function inertiaRotate(inertia: Mat3, q: Quat): Mat3 {
  return mat3Symmetrise(mat3RotateTensor(quatToMat3(q), inertia));
}
