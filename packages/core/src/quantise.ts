/**
 * Quantisation of player inputs and conversion between internal and wire quaternion order.
 *
 * Player inputs are quantised before they reach the engine: positions to 1 mm, angles to
 * 1 degree, raw quaternions to 1e-4 per component and then renormalised. Humans and agents get
 * the same quanta (docs/design/platform.md section 2; the quanta themselves are [ESTIMATED]
 * calibration parameters delta_p and delta_theta of docs/research/benchmark.md section 11).
 *
 * Quantise in wire units (millimetres, degrees) and convert to SI afterwards with `mmToM` /
 * `degToRad`: `212 mm -> 212 / 1000 m` is the same double everywhere, whereas rounding a value
 * that is already in metres depends on how it was computed.
 */

import { quatCanonical } from './math/quat.ts';
import type { Quat, QuatWxyz, Vec3 } from './math/types.ts';

/** Position quantum on the wire, millimetres. [ESTIMATED] benchmark.md section 11 (delta_p). */
export const POSITION_QUANTUM_MM = 1;
/** Angle quantum on the wire, degrees. [ESTIMATED] benchmark.md section 11 (delta_theta). */
export const ANGLE_QUANTUM_DEG = 1;
/** Quaternion component quantum (dimensionless). platform.md section 2. */
export const QUAT_QUANTUM = 1e-4;

const QUAT_STEPS = 10000;
// A unit quaternion scaled by 10^4 and rounded component-wise lies within 1 of the sphere of
// radius 10^4, so its squared norm is in [(10^4 - 1)^2, (10^4 + 1)^2].
const QUAT_NORM2_MIN = (QUAT_STEPS - 1) * (QUAT_STEPS - 1);
const QUAT_NORM2_MAX = (QUAT_STEPS + 1) * (QUAT_STEPS + 1);

/**
 * Rounds to the nearest integer with ties away from zero, so that mirrored inputs give mirrored
 * outputs (`Math.round` sends -0.5 to -0 but 0.5 to 1). Never returns negative zero.
 */
export function roundHalfAwayFromZero(x: number): number {
  return (x < 0 ? -Math.round(-x) : Math.round(x)) + 0;
}

/**
 * Rounds `x` to the nearest multiple of `1 / stepsPerUnit`, ties away from zero, returning
 * `round(x * stepsPerUnit) / stepsPerUnit`. Use an integer `stepsPerUnit` (10 for 0.1 mm when `x`
 * is in millimetres, 10000 for 1e-4): the division then yields the correctly rounded decimal.
 */
export function roundToGrid(x: number, stepsPerUnit: number): number {
  return roundHalfAwayFromZero(x * stepsPerUnit) / stepsPerUnit;
}

/** A position in millimetres rounded to whole millimetres (the wire position quantum). */
export function quantisePositionMm(positionMm: Vec3): Vec3 {
  return [
    roundHalfAwayFromZero(positionMm[0]),
    roundHalfAwayFromZero(positionMm[1]),
    roundHalfAwayFromZero(positionMm[2]),
  ];
}

/**
 * A position in metres snapped to the 1 mm grid, returned in metres as `k / 1000` with integer
 * `k`. Prefer {@link quantisePositionMm} on wire values; this is for values already in SI.
 */
export function quantisePosition(position: Vec3): Vec3 {
  return [
    roundHalfAwayFromZero(position[0] * 1000) / 1000,
    roundHalfAwayFromZero(position[1] * 1000) / 1000,
    roundHalfAwayFromZero(position[2] * 1000) / 1000,
  ];
}

/** An angle in degrees rounded to a whole degree (the wire angle quantum). No wrapping. */
export function quantiseAngleDeg(angleDeg: number): number {
  return roundHalfAwayFromZero(angleDeg);
}

/**
 * An angle in radians snapped to the 1 degree grid, returned in radians as `k * (pi / 180)` with
 * integer `k` (the same expression `degToRad` uses). No wrapping.
 */
export function quantiseAngle(angle: number): number {
  return roundHalfAwayFromZero(angle * (180 / Math.PI)) * (Math.PI / 180);
}

/** Rounds each component times 10^4 to an integer, or returns null if that is not finite. */
function quatToSteps(q: Quat): [number, number, number, number] | null {
  const k: [number, number, number, number] = [
    roundHalfAwayFromZero(q[0] * QUAT_STEPS),
    roundHalfAwayFromZero(q[1] * QUAT_STEPS),
    roundHalfAwayFromZero(q[2] * QUAT_STEPS),
    roundHalfAwayFromZero(q[3] * QUAT_STEPS),
  ];
  return k.every(Number.isFinite) ? k : null;
}

/**
 * Quantises a raw quaternion (internal order x, y, z, w; need not be unit) to the 1e-4 grid and
 * returns the grid point itself: four multiples of 1e-4 in canonical sign (first non-zero of
 * w, x, y, z positive, so `w >= 0`). The grid point's norm is within 1e-4 of 1 but not exactly 1;
 * it is the canonical form for wire payloads and cache keys. Use {@link quantiseQuat} for the
 * unit quaternion handed to the engine.
 *
 * Input whose components, rounded directly, already lie within 1e-4 of unit norm is rounded as
 * it is, which makes the function idempotent: feeding a grid point back returns the same grid
 * point. Any other input is normalised first and then rounded, so sending a long quaternion
 * such as (10000, 1, 0, 0) cannot buy angular resolution finer than the quantum.
 *
 * Returns null when the input has a non-finite component or zero norm (a player error to be
 * reported as a value, not thrown).
 */
export function quantiseQuatGrid(raw: Quat): Quat | null {
  if (!raw.every(Number.isFinite)) return null;
  let k = quatToSteps(raw);
  const norm2 = k === null ? Number.NaN : k[0] * k[0] + k[1] * k[1] + k[2] * k[2] + k[3] * k[3];
  if (k === null || !(norm2 >= QUAT_NORM2_MIN && norm2 <= QUAT_NORM2_MAX)) {
    const len = Math.hypot(raw[0], raw[1], raw[2], raw[3]);
    if (!(len > 0) || !Number.isFinite(len)) return null;
    k = quatToSteps([raw[0] / len, raw[1] / len, raw[2] / len, raw[3] / len]);
    if (k === null) return null;
  }
  const c = quatCanonical(k);
  return [c[0] / QUAT_STEPS, c[1] / QUAT_STEPS, c[2] / QUAT_STEPS, c[3] / QUAT_STEPS];
}

/**
 * Quantises a raw quaternion (internal order x, y, z, w) and returns the unit quaternion the
 * engine should use: the grid point of {@link quantiseQuatGrid}, renormalised. Deterministic,
 * canonical sign (`w >= 0`), and `quantiseQuat(quantiseQuatGrid(q)) = quantiseQuat(q)`.
 * Returns null for a non-finite or zero-norm input.
 *
 * The result is NOT a fixed point of this function: renormalising moves each component by up to
 * 1e-4 of itself, so quantising the returned unit quaternion again lands on a neighbouring grid
 * point for about 1.5% of orientations (never more than one quantum away per component). Put
 * the grid point of {@link quantiseQuatGrid} on the wire and in logs, never this unit
 * quaternion; a player who sends a reported orientation back then gets exactly the same one.
 */
export function quantiseQuat(raw: Quat): Quat | null {
  const g = quantiseQuatGrid(raw);
  if (g === null) return null;
  const len = Math.hypot(g[0], g[1], g[2], g[3]);
  return [g[0] / len, g[1] / len, g[2] / len, g[3] / len];
}

/** Reorders an internal quaternion `[x, y, z, w]` to wire order `[w, x, y, z]`. */
export function quatToWire(q: Quat): QuatWxyz {
  return [q[3], q[0], q[1], q[2]];
}

/** Reorders a wire quaternion `[w, x, y, z]` (a `quat_wxyz` field) to internal `[x, y, z, w]`. */
export function quatFromWire(wxyz: QuatWxyz): Quat {
  return [wxyz[1], wxyz[2], wxyz[3], wxyz[0]];
}
