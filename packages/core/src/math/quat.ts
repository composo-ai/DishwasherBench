import type { Mat3, Quat, Vec3 } from './types.ts';
import { v3AnyPerpendicular, v3Cross, v3Dot, v3Length } from './vec3.ts';

/** The identity rotation `[0, 0, 0, 1]`. */
export const QUAT_IDENTITY: Quat = [0, 0, 0, 1];

/** Builds a quaternion from components in internal order (x, y, z, w). Not normalised. */
export function quat(x: number, y: number, z: number, w: number): Quat {
  return [x, y, z, w];
}

/** Four-dimensional dot product of two quaternions. */
export function quatDot(a: Quat, b: Quat): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

/** Euclidean norm of a quaternion (1 for a rotation). */
export function quatLength(q: Quat): number {
  return Math.hypot(q[0], q[1], q[2], q[3]);
}

/** Component-wise negation. `-q` represents the same rotation as `q`. */
export function quatNeg(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], -q[3]];
}

/**
 * Hamilton product `a * b`. As rotations, `a * b` applies `b` first and then `a`:
 * `quatRotate(quatMul(a, b), v) = quatRotate(a, quatRotate(b, v))`.
 */
export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Conjugate `[-x, -y, -z, w]`; for a unit quaternion this is the inverse rotation. */
export function quatConjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

/**
 * Scales a quaternion to unit norm. Throws a RangeError when the norm is zero or not finite,
 * because such a value cannot represent a rotation (a programmer error, not a player error).
 */
export function quatNormalise(q: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!(len > 0) || !Number.isFinite(len)) {
    throw new RangeError(`quatNormalise: quaternion [${q.join(', ')}] has no direction`);
  }
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

/**
 * The representative of the pair `{q, -q}` whose first non-zero component in the order
 * w, x, y, z is positive. In almost every case this just means `w >= 0`; the tie-break keeps the
 * choice unique for half-turn rotations where `w` is exactly zero. Negative zeros become `+0`.
 */
export function quatCanonical(q: Quat): Quat {
  const [x, y, z, w] = q;
  const lead = w !== 0 ? w : x !== 0 ? x : y !== 0 ? y : z;
  const s = lead < 0 ? -1 : 1;
  // Adding 0 turns -0 into +0 so that canonical values serialise and hash identically.
  return [s * x + 0, s * y + 0, s * z + 0, s * w + 0];
}

/**
 * Rotation by `angle` radians about `axis` (right-hand rule). The axis need not be unit length.
 * Throws a RangeError for a zero axis unless the angle is exactly zero.
 */
export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  if (angle === 0) return QUAT_IDENTITY;
  const len = v3Length(axis);
  if (!(len > 0) || !Number.isFinite(len)) {
    throw new RangeError('quatFromAxisAngle: the axis must be a finite non-zero vector');
  }
  const half = 0.5 * angle;
  const s = Math.sin(half) / len;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

/**
 * Axis and angle of a unit quaternion, with the angle in [0, pi] radians and a unit axis. The
 * identity rotation has no axis; +z is returned for it.
 */
export function quatToAxisAngle(q: Quat): { axis: Vec3; angle: number } {
  const c = quatCanonical(q);
  const s = Math.hypot(c[0], c[1], c[2]);
  if (s === 0) return { axis: [0, 0, 1], angle: 0 };
  return { axis: [c[0] / s, c[1] / s, c[2] / s], angle: 2 * Math.atan2(s, c[3]) };
}

/**
 * Rotation from intrinsic X-Y-Z Euler angles in radians: rotate by `rx` about the body x axis,
 * then by `ry` about the new y axis, then by `rz` about the newest z axis. Equivalently
 * `q = qx(rx) * qy(ry) * qz(rz)`, the matrix `Rx(rx) Ry(ry) Rz(rz)`, and the extrinsic sequence
 * z, then y, then x about fixed axes. This is the convention of Three.js `Euler` order `'XYZ'`
 * and of the catalogue's `rot_xyz_deg` fields (after converting degrees to radians).
 */
export function quatFromEulerXYZ(rx: number, ry: number, rz: number): Quat {
  const c1 = Math.cos(0.5 * rx);
  const s1 = Math.sin(0.5 * rx);
  const c2 = Math.cos(0.5 * ry);
  const s2 = Math.sin(0.5 * ry);
  const c3 = Math.cos(0.5 * rz);
  const s3 = Math.sin(0.5 * rz);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

/**
 * Intrinsic X-Y-Z Euler angles `[rx, ry, rz]` in radians of a unit quaternion, the inverse of
 * {@link quatFromEulerXYZ}. `ry` is in [-pi/2, pi/2]; `rx` and `rz` are in (-pi, pi]. At gimbal
 * lock (`ry` = +-pi/2) only a combination of `rx` and `rz` is defined, and `rz` is returned as 0.
 */
export function quatToEulerXYZ(q: Quat): Vec3 {
  const m = quatToMat3(q);
  const sy = Math.min(1, Math.max(-1, m[2]));
  const ry = Math.asin(sy);
  if (Math.abs(sy) < 1 - 1e-12) {
    return [Math.atan2(-m[5], m[8]), ry, Math.atan2(-m[1], m[0])];
  }
  return [Math.atan2(m[7], m[4]), ry, 0];
}

/** Rotation matrix (row-major) of a unit quaternion: `quatRotate(q, v) = M v`. */
export function quatToMat3(q: Quat): Mat3 {
  const [x, y, z, w] = q;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    1 - 2 * (yy + zz),
    2 * (xy - wz),
    2 * (xz + wy),
    2 * (xy + wz),
    1 - 2 * (xx + zz),
    2 * (yz - wx),
    2 * (xz - wy),
    2 * (yz + wx),
    1 - 2 * (xx + yy),
  ];
}

/**
 * Unit quaternion of a proper rotation matrix (row-major, orthonormal, determinant +1), by
 * Shepperd's method, which stays accurate for every rotation angle. The result is in canonical
 * form (see {@link quatCanonical}). The input is not checked for orthonormality.
 */
export function quatFromMat3(m: Mat3): Quat {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m;
  const trace = m00 + m11 + m22;
  let x: number;
  let y: number;
  let z: number;
  let w: number;
  if (trace > 0) {
    const s = 2 * Math.sqrt(trace + 1);
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return quatCanonical(quatNormalise([x, y, z, w]));
}

/** Rotates the vector `v` by the unit quaternion `q`. */
export function quatRotate(q: Quat, v: Vec3): Vec3 {
  const [qx, qy, qz, qw] = q;
  // t = 2 * (q.xyz x v);  v' = v + w * t + q.xyz x t
  const tx = 2 * (qy * v[2] - qz * v[1]);
  const ty = 2 * (qz * v[0] - qx * v[2]);
  const tz = 2 * (qx * v[1] - qy * v[0]);
  return [
    v[0] + qw * tx + (qy * tz - qz * ty),
    v[1] + qw * ty + (qz * tx - qx * tz),
    v[2] + qw * tz + (qx * ty - qy * tx),
  ];
}

/** Rotates the vector `v` by the inverse of the unit quaternion `q`. */
export function quatInverseRotate(q: Quat, v: Vec3): Vec3 {
  return quatRotate([-q[0], -q[1], -q[2], q[3]], v);
}

/**
 * Spherical linear interpolation between two unit quaternions along the shorter great arc.
 * `t = 0` gives `a`, `t = 1` gives `b` (or `-b`, the same rotation); `t` is not clamped. The
 * result is unit length.
 */
export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let d = quatDot(a, b);
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];
  if (d < 0) {
    d = -d;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let wa: number;
  let wb: number;
  if (d > 1 - 1e-10) {
    // The arc is too short for the sine formula; linear interpolation is exact to rounding here.
    wa = 1 - t;
    wb = t;
  } else {
    const theta = Math.acos(d);
    const sinTheta = Math.sin(theta);
    wa = Math.sin((1 - t) * theta) / sinTheta;
    wb = Math.sin(t * theta) / sinTheta;
  }
  return quatNormalise([
    wa * a[0] + wb * bx,
    wa * a[1] + wb * by,
    wa * a[2] + wb * bz,
    wa * a[3] + wb * bw,
  ]);
}

/**
 * Angle in radians, in [0, pi], of the rotation that takes orientation `a` to orientation `b`
 * (both unit quaternions). Zero when they represent the same rotation, including `b = -a`.
 */
export function quatAngleBetween(a: Quat, b: Quat): number {
  const rel = quatMul(quatConjugate(a), b);
  return 2 * Math.atan2(Math.hypot(rel[0], rel[1], rel[2]), Math.abs(rel[3]));
}

/**
 * The shortest rotation taking direction `from` to direction `to` (neither need be unit length;
 * both must be non-zero). For exactly opposite directions the half-turn axis is not unique and a
 * deterministic perpendicular is used.
 */
export function quatFromTo(from: Vec3, to: Vec3): Quat {
  const lf = v3Length(from);
  const lt = v3Length(to);
  if (!(lf > 0) || !(lt > 0) || !Number.isFinite(lf) || !Number.isFinite(lt)) {
    throw new RangeError('quatFromTo: both directions must be finite non-zero vectors');
  }
  const a: Vec3 = [from[0] / lf, from[1] / lf, from[2] / lf];
  const b: Vec3 = [to[0] / lt, to[1] / lt, to[2] / lt];
  const d = v3Dot(a, b);
  if (d < -1 + 1e-12) {
    const axis = v3AnyPerpendicular(a);
    return [axis[0], axis[1], axis[2], 0];
  }
  const c = v3Cross(a, b);
  return quatNormalise([c[0], c[1], c[2], 1 + d]);
}
