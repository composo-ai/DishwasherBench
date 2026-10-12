import type { Vec3 } from './types.ts';

/** The zero vector. */
export const V3_ZERO: Vec3 = [0, 0, 0];
/** Unit vector along +x. */
export const V3_X: Vec3 = [1, 0, 0];
/** Unit vector along +y. */
export const V3_Y: Vec3 = [0, 1, 0];
/** Unit vector along +z (up in every Spotless frame). */
export const V3_Z: Vec3 = [0, 0, 1];

/** Builds a vector from components (any consistent unit). */
export function v3(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

/** Component-wise sum `a + b`. */
export function v3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Component-wise difference `a - b`. */
export function v3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Vector scaled by the scalar `s`. */
export function v3Scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

/** `a + s * b`, the common "advance along a direction" step. */
export function v3AddScaled(a: Vec3, b: Vec3, s: number): Vec3 {
  return [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]];
}

/** Negation `-a`. */
export function v3Neg(a: Vec3): Vec3 {
  return [-a[0], -a[1], -a[2]];
}

/** Component-wise (Hadamard) product. */
export function v3Mul(a: Vec3, b: Vec3): Vec3 {
  return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
}

/** Dot product (units multiply). */
export function v3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Right-handed cross product `a x b`. */
export function v3Cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Squared Euclidean length. */
export function v3LengthSq(a: Vec3): number {
  return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
}

/** Euclidean length, computed without intermediate overflow or underflow. */
export function v3Length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

/** Euclidean distance between two points. */
export function v3Distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Unit vector in the direction of `a`. A vector whose length is zero or not finite has no
 * direction: `fallback` (the zero vector by default) is returned instead, so callers must either
 * pass a meaningful fallback or handle the zero result.
 */
export function v3Normalise(a: Vec3, fallback: Vec3 = V3_ZERO): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]);
  if (!(len > 0) || !Number.isFinite(len)) return fallback;
  return [a[0] / len, a[1] / len, a[2] / len];
}

/** Linear interpolation `a + t * (b - a)`; `t` is not clamped. */
export function v3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}

/** Component-wise minimum. */
export function v3Min(a: Vec3, b: Vec3): Vec3 {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
}

/** Component-wise maximum. */
export function v3Max(a: Vec3, b: Vec3): Vec3 {
  return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
}

/** True when every component of `a` is within `tolerance` (absolute, same unit) of `b`. */
export function v3ApproxEquals(a: Vec3, b: Vec3, tolerance: number): boolean {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance
  );
}

/** True when every component is a finite number. */
export function v3IsFinite(a: Vec3): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);
}

/**
 * A unit vector perpendicular to `a` (which need not be unit but must be non-zero). The choice is
 * deterministic: `a` is crossed with the coordinate axis along which it is smallest.
 */
export function v3AnyPerpendicular(a: Vec3): Vec3 {
  const ax = Math.abs(a[0]);
  const ay = Math.abs(a[1]);
  const az = Math.abs(a[2]);
  const axis: Vec3 = ax <= ay && ax <= az ? V3_X : ay <= az ? V3_Y : V3_Z;
  const perp = v3Normalise(v3Cross(a, axis));
  if (perp[0] === 0 && perp[1] === 0 && perp[2] === 0) {
    throw new RangeError('v3AnyPerpendicular: the zero vector has no perpendicular');
  }
  return perp;
}
