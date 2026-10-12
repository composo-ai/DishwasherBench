/**
 * Affine maps `x' = M x + c` between frames, in f64, for the scene builder: poses, their
 * inverses, and the stretch of a scaled shell of revolution.
 *
 * `m` is the 3 x 3 matrix in row-major order, `c` the translation, metres. A map built from a
 * `Pose` is rigid; composing it with a diagonal stretch gives the general maps used here.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { quatToMat3 } from '@spotless/core';

/** An affine map `x' = m x + c` (row-major `m`, translation `c` in metres). */
export interface Affine {
  readonly m: readonly number[];
  readonly c: readonly number[];
}

/** The identity map. */
export const AFFINE_IDENTITY: Affine = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], c: [0, 0, 0] };

/** The map of a pose: local frame to parent frame, `x_parent = R x + p`. */
export function affineFromPose(pose: Pose): Affine {
  return { m: [...quatToMat3(pose.q)], c: [pose.p[0], pose.p[1], pose.p[2]] };
}

/** The inverse of a rigid map (`m` orthonormal): `x = m^T (x' - c)`. */
export function affineInverseRigid(a: Affine): Affine {
  const m = a.m as number[];
  const c = a.c as number[];
  const t = [
    m[0] as number,
    m[3] as number,
    m[6] as number,
    m[1] as number,
    m[4] as number,
    m[7] as number,
    m[2] as number,
    m[5] as number,
    m[8] as number,
  ];
  const cx = c[0] as number;
  const cy = c[1] as number;
  const cz = c[2] as number;
  return {
    m: t,
    c: [
      -((t[0] as number) * cx + (t[1] as number) * cy + (t[2] as number) * cz),
      -((t[3] as number) * cx + (t[4] as number) * cy + (t[5] as number) * cz),
      -((t[6] as number) * cx + (t[7] as number) * cy + (t[8] as number) * cz),
    ],
  };
}

/** The composition `a after b`: `x -> a(b(x))`. */
export function affineMul(a: Affine, b: Affine): Affine {
  const p = a.m as number[];
  const q = b.m as number[];
  const m = new Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      m[3 * i + j] =
        (p[3 * i] as number) * (q[j] as number) +
        (p[3 * i + 1] as number) * (q[3 + j] as number) +
        (p[3 * i + 2] as number) * (q[6 + j] as number);
    }
  }
  const c = affinePoint(a, b.c[0] as number, b.c[1] as number, b.c[2] as number);
  return { m, c: [c[0], c[1], c[2]] };
}

/** A map followed by a diagonal stretch: `x -> diag(s) (m x + c)`. */
export function affineScaleAfter(a: Affine, s: Vec3): Affine {
  const m = a.m as number[];
  return {
    m: [
      s[0] * (m[0] as number),
      s[0] * (m[1] as number),
      s[0] * (m[2] as number),
      s[1] * (m[3] as number),
      s[1] * (m[4] as number),
      s[1] * (m[5] as number),
      s[2] * (m[6] as number),
      s[2] * (m[7] as number),
      s[2] * (m[8] as number),
    ],
    c: [s[0] * (a.c[0] as number), s[1] * (a.c[1] as number), s[2] * (a.c[2] as number)],
  };
}

/** A diagonal stretch followed by a map: `x -> m (diag(s) x) + c`. */
export function affineScaleBefore(a: Affine, s: Vec3): Affine {
  const m = a.m as number[];
  return {
    m: [
      s[0] * (m[0] as number),
      s[1] * (m[1] as number),
      s[2] * (m[2] as number),
      s[0] * (m[3] as number),
      s[1] * (m[4] as number),
      s[2] * (m[5] as number),
      s[0] * (m[6] as number),
      s[1] * (m[7] as number),
      s[2] * (m[8] as number),
    ],
    c: [a.c[0] as number, a.c[1] as number, a.c[2] as number],
  };
}

/** The image of a point. */
export function affinePoint(a: Affine, x: number, y: number, z: number): [number, number, number] {
  const m = a.m as number[];
  return [
    (m[0] as number) * x + (m[1] as number) * y + (m[2] as number) * z + (a.c[0] as number),
    (m[3] as number) * x + (m[4] as number) * y + (m[5] as number) * z + (a.c[1] as number),
    (m[6] as number) * x + (m[7] as number) * y + (m[8] as number) * z + (a.c[2] as number),
  ];
}

/** The image of a direction (no translation). */
export function affineVector(a: Affine, x: number, y: number, z: number): [number, number, number] {
  const m = a.m as number[];
  return [
    (m[0] as number) * x + (m[1] as number) * y + (m[2] as number) * z,
    (m[3] as number) * x + (m[4] as number) * y + (m[5] as number) * z,
    (m[6] as number) * x + (m[7] as number) * y + (m[8] as number) * z,
  ];
}

/**
 * The image of a gradient under the transpose: if `x' = m x + c` and `f(x) = F(x')`, then
 * `grad f = m^T grad F`. Used to carry a normal from a local frame back to the frame the map
 * starts from.
 */
export function affineTransposeVector(
  a: Affine,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const m = a.m as number[];
  return [
    (m[0] as number) * x + (m[3] as number) * y + (m[6] as number) * z,
    (m[1] as number) * x + (m[4] as number) * y + (m[7] as number) * z,
    (m[2] as number) * x + (m[5] as number) * y + (m[8] as number) * z,
  ];
}

/** A rigid map from an orthonormal frame given by its origin and axes: `x' = [ex; ey; ez] (x - o)`. */
export function affineIntoFrame(o: Vec3, ex: Vec3, ey: Vec3, ez: Vec3): Affine {
  return {
    m: [ex[0], ex[1], ex[2], ey[0], ey[1], ey[2], ez[0], ez[1], ez[2]],
    c: [
      -(ex[0] * o[0] + ex[1] * o[1] + ex[2] * o[2]),
      -(ey[0] * o[0] + ey[1] * o[1] + ey[2] * o[2]),
      -(ez[0] * o[0] + ez[1] * o[1] + ez[2] * o[2]),
    ],
  };
}
