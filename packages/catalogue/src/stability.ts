/**
 * Static stability of an item resting on a horizontal plane in a given orientation.
 *
 * The criterion is the potential energy: resting on the plane, the height of the centre of mass
 * is `E(q) = (R(q) com).z - min z of the item`. The item stands in orientation `q` if every
 * small tilt raises its centre of mass, that is if `E` has a strict minimum at `q`. This is the
 * usual "centre of mass above the support polygon" for an item on a flat base, and it also
 * covers items that rest on a curved surface (a spoon on the back of its bowl) and rules out
 * items that would roll (a glass on its side). The tilt at which `E` stops rising is the angle
 * the item can be tipped through before it falls over.
 *
 * The lowest point of the item is exact: it comes from the support functions of the geometry
 * kernel's primitives, not from a mesh.
 *
 * This is statics only, used to check that the named free-standing poses of the catalogue are
 * physically plausible and to report how easily an item tips. Whether an item stays put in a
 * rack is decided by the rigid-body simulation.
 *
 * Units: SI (metres, radians). Orientations map the item frame to a world frame with z up.
 */

import type { Quat, Vec3 } from '@spotless/core';
import { quatFromAxisAngle, quatInverseRotate, quatMul, quatRotate } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import { primitiveSupport } from '@spotless/geometry';

/** Tilt used to probe whether a pose is a minimum of the centre-of-mass height, radians. */
export const STABILITY_PROBE_TILT = (0.25 * Math.PI) / 180;
/** Number of horizontal directions the item is tilted towards (every 15 degrees). */
export const STABILITY_DIRECTIONS = 24;
/**
 * Rise of the centre of mass under the probe tilt below which a pose counts as neutral (the
 * item would roll), metres. One nanometre: far above rounding error, far below the rise of any
 * item that really stands.
 */
export const STABILITY_MIN_RISE = 1e-9;
/** Step of the scan for the tipping angle, radians (1 degree). */
const TIP_SCAN_STEP = Math.PI / 180;

/** Result of {@link staticStability}. */
export interface StaticStability {
  /** True when every small tilt raises the centre of mass. */
  readonly stable: boolean;
  /** Height of the centre of mass above the plane, metres. */
  readonly comHeight: number;
  /**
   * Smallest angle the item can be tilted through, in its weakest direction, before it falls
   * over, radians. Zero when not stable; `pi / 2` when the item rights itself from any tilt up
   * to a right angle (a shallow bowl). For an item on a flat base this is `atan(d / h)`, with
   * `d` the horizontal distance from the centre of mass to the nearest edge of the base and `h`
   * its height.
   */
  readonly tipAngle: number;
  /**
   * Azimuth of the horizontal direction in which the item tips most easily, radians from +x
   * towards +y in the world frame. For an unstable pose, the direction in which the centre of
   * mass falls fastest.
   */
  readonly weakestDirection: number;
  /** Smallest rise of the centre of mass under the probe tilt, metres (negative: it falls). */
  readonly probeRise: number;
}

/** Height of the lowest point of a shape in orientation `q`, metres (item origin at 0). */
export function lowestPoint(shape: Shape, q: Quat): number {
  let lowest = Number.POSITIVE_INFINITY;
  for (const part of shape.parts) {
    const total = quatMul(q, part.pose.q);
    // Direction of world -z in the part frame; the part's lowest world point is its support
    // point in that direction.
    const down = quatInverseRotate(total, [0, 0, -1]);
    const origin = quatRotate(q, part.pose.p);
    lowest = Math.min(lowest, origin[2] - primitiveSupport(part.prim, down));
  }
  return lowest;
}

/**
 * Height of the centre of mass above a horizontal plane the shape rests on in orientation `q`,
 * metres: the potential energy per unit weight.
 */
export function restingComHeight(shape: Shape, com: Vec3, q: Quat): number {
  return quatRotate(q, com)[2] - lowestPoint(shape, q);
}

/** `q` tilted by `angle` towards the horizontal direction at azimuth `phi` (world frame). */
function tilted(q: Quat, phi: number, angle: number): Quat {
  // Rotating about z x dir by a positive angle moves +z towards dir.
  return quatMul(quatFromAxisAngle([-Math.sin(phi), Math.cos(phi), 0], angle), q);
}

/** Golden-section search for the minimum of a unimodal function on `[lo, hi]`. */
function minimise(
  f: (x: number) => number,
  lo: number,
  hi: number,
  iterations: number,
): { readonly x: number; readonly value: number } {
  const ratio = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let x1 = b - ratio * (b - a);
  let x2 = a + ratio * (b - a);
  let f1 = f(x1);
  let f2 = f(x2);
  for (let i = 0; i < iterations; i++) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - ratio * (b - a);
      f1 = f(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + ratio * (b - a);
      f2 = f(x2);
    }
  }
  return f1 < f2 ? { x: x1, value: f1 } : { x: x2, value: f2 };
}

/**
 * Static stability of a shape with centre of mass `com` (item frame, metres) resting on a
 * horizontal plane in orientation `q` (item frame to a frame with z up).
 *
 * The item is tilted towards {@link STABILITY_DIRECTIONS} horizontal directions, and the
 * direction of least rise and of the smallest tipping angle are then refined between
 * neighbouring directions, since both have a sharp minimum for an item on a straight edge.
 */
export function staticStability(shape: Shape, com: Vec3, q: Quat): StaticStability {
  const comHeight = restingComHeight(shape, com, q);
  const sector = (2 * Math.PI) / STABILITY_DIRECTIONS;
  const riseAt = (phi: number): number =>
    restingComHeight(shape, com, tilted(q, phi, STABILITY_PROBE_TILT)) - comHeight;
  let coarseRise = Number.POSITIVE_INFINITY;
  let coarsePhi = 0;
  for (let k = 0; k < STABILITY_DIRECTIONS; k++) {
    const rise = riseAt(k * sector);
    if (rise < coarseRise) {
      coarseRise = rise;
      coarsePhi = k * sector;
    }
  }
  const refined = minimise(riseAt, coarsePhi - sector, coarsePhi + sector, 24);
  const probeRise = Math.min(coarseRise, refined.value);
  if (!(probeRise > STABILITY_MIN_RISE)) {
    return {
      stable: false,
      comHeight,
      tipAngle: 0,
      weakestDirection: refined.value < coarseRise ? refined.x : coarsePhi,
      probeRise,
    };
  }
  /**
   * Tipping angle towards azimuth `phi`: the tilt at which the centre of mass stops rising, or
   * `limit` if it is still rising there.
   */
  const tipTowards = (phi: number, limit: number): number => {
    const height = (angle: number): number => restingComHeight(shape, com, tilted(q, phi, angle));
    let previous = height(STABILITY_PROBE_TILT);
    let angle = STABILITY_PROBE_TILT;
    for (;;) {
      if (angle >= limit) return limit;
      const next = Math.min(angle + TIP_SCAN_STEP, Math.PI / 2);
      const h = height(next);
      if (h < previous) break;
      if (next >= Math.PI / 2) return Math.min(limit, Math.PI / 2);
      previous = h;
      angle = next;
    }
    // The maximum lies within one step either side of `angle`.
    const peak = minimise(
      (x) => -height(x),
      Math.max(0, angle - TIP_SCAN_STEP),
      Math.min(Math.PI / 2, angle + TIP_SCAN_STEP),
      40,
    );
    return Math.min(limit, peak.x);
  };
  // Coarse scan, each direction only as far as the smallest angle found so far.
  let tipAngle = Math.PI / 2;
  let weakest = coarsePhi;
  for (let k = 0; k < STABILITY_DIRECTIONS; k++) {
    const tip = tipTowards(k * sector, tipAngle);
    if (tip < tipAngle) {
      tipAngle = tip;
      weakest = k * sector;
    }
  }
  if (tipAngle < Math.PI / 2) {
    const best = minimise(
      (phi) => tipTowards(phi, Math.PI / 2),
      weakest - sector,
      weakest + sector,
      20,
    );
    if (best.value < tipAngle) {
      tipAngle = best.value;
      weakest = best.x;
    }
  }
  return { stable: true, comHeight, tipAngle, weakestDirection: weakest, probeRise };
}

/** Outcome of {@link settlePose}. */
export interface SettledPose {
  /** The orientation the item comes to rest in. */
  readonly q: Quat;
  /** Angle between the starting orientation and `q`, radians. */
  readonly rotation: number;
  /** By how much the centre of mass came down on the way, metres. */
  readonly drop: number;
  /**
   * False when the item was still coming down after turning by `limit`: it is not near a
   * resting pose at all.
   */
  readonly settled: boolean;
}

/**
 * Where an item released at rest in orientation `q` on a horizontal plane comes to rest, as far
 * as statics can tell: the orientation is tilted in whichever of {@link STABILITY_DIRECTIONS}
 * directions lowers the centre of mass most, in steps that start at `step` radians and halve
 * down to a millionth of a degree, until no tilt lowers it or the item has turned by `limit`.
 *
 * It answers what the strict test of {@link staticStability} cannot: that test asks whether an
 * orientation is itself a minimum of the height of the centre of mass, and says no to one a
 * hundredth of a degree up the side of a perfectly good resting pose, which is where the
 * platform's input quantisation (quaternion components to 1e-4) puts every pose that is not on
 * its grid.
 */
export function settlePose(
  shape: Shape,
  com: Vec3,
  q: Quat,
  limit: number = Math.PI / 180,
  step: number = (0.02 * Math.PI) / 180,
): SettledPose {
  const start = restingComHeight(shape, com, q);
  const sector = (2 * Math.PI) / STABILITY_DIRECTIONS;
  let current = q;
  let height = start;
  let size = step;
  const turned = (): number => {
    // Angle of the rotation from q to current: 2 acos(|q . current|).
    const dot = Math.abs(
      q[0] * current[0] + q[1] * current[1] + q[2] * current[2] + q[3] * current[3],
    );
    return 2 * Math.acos(Math.min(1, dot));
  };
  while (size > (1e-6 * Math.PI) / 180) {
    let best = current;
    let bestHeight = height;
    for (let k = 0; k < STABILITY_DIRECTIONS; k++) {
      const candidate = tilted(current, k * sector, size);
      const h = restingComHeight(shape, com, candidate);
      if (h < bestHeight) {
        best = candidate;
        bestHeight = h;
      }
    }
    if (bestHeight < height) {
      current = best;
      height = bestHeight;
      if (turned() > limit) {
        return { q: current, rotation: turned(), drop: start - height, settled: false };
      }
    } else {
      size /= 2;
    }
  }
  return { q: current, rotation: turned(), drop: start - height, settled: true };
}
