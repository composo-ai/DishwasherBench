/**
 * Pointing: which basket the cursor is over, and where in it the piece in hand goes so that
 * its middle, standing where it would be let go, is under the cursor.
 *
 * The piece is not carried on a plane high above the basket (from a view at an angle that
 * puts the landing nearer the camera than the cursor). The cursor's ray is met with the
 * horizontal plane at the height the middle of the piece has where it rests: on the floor of
 * the basket until the server's free preview has said where it would be let go, at that
 * height from then on. Pure functions; millimetres; the frames are those of `pose.ts`.
 */

import type { Vec3 } from '@spotless/core';
import type { FrameId, Vec3Mm } from '@spotless/session';
import type { DrawPose } from './pose.ts';
import { clampToEnvelope, directionInFrame, pointInFrame, quantiseMm } from './pose.ts';

/** A basket the cursor may point at. */
export interface AimTarget {
  readonly frame: FrameId;
  /** Where the frame is drawn. */
  readonly pose: DrawPose;
  /** Its plan (x and y from 0) and height, millimetres. */
  readonly envelope_mm: Vec3Mm;
  /** Height of the middle of the piece where it rests in this frame, millimetres. */
  readonly rest_z_mm: number;
  /**
   * True for a basket that stands inside another (the cutlery basket): the cursor points at it
   * when the ray passes through its opening, whatever lies behind.
   */
  readonly inner?: boolean;
  /** Height of the opening of such a basket (the rim of its cells); default the top of its envelope. */
  readonly opening_z_mm?: number;
}

/** A ray is taken to run along the baskets when it rises or falls less than this per unit. */
const LEVEL_RAY = 0.08;

/** Where a ray meets the horizontal plane at `zMm` of a frame, unrounded; null when it does not. */
export function rayAtHeight(
  pose: DrawPose,
  originMm: Vec3,
  direction: Vec3,
  zMm: number,
): readonly [number, number] | null {
  const o = pointInFrame(pose, originMm);
  const d = directionInFrame(pose, direction);
  if (Math.abs(d[2]) < 1e-9) return null;
  const t = (zMm - o[2]) / d[2];
  if (!(t > 0) || !Number.isFinite(t)) return null;
  return [o[0] + t * d[0], o[1] + t * d[1]];
}

function inPlan(xy: readonly [number, number], envelope: Vec3Mm, margin: number): boolean {
  return (
    xy[0] >= -margin &&
    xy[0] <= envelope[0] + margin &&
    xy[1] >= -margin &&
    xy[1] <= envelope[1] + margin
  );
}

/**
 * True when a ray passes through the box of a frame that stands on its plan from its floor up
 * to `topMm`: the cursor is somewhere over the picture of that box.
 */
export function rayThroughBox(
  pose: DrawPose,
  originMm: Vec3,
  direction: Vec3,
  planMm: Vec3Mm,
  topMm: number,
): boolean {
  const o = pointInFrame(pose, originMm);
  const d = directionInFrame(pose, direction);
  const max = [planMm[0], planMm[1], topMm] as const;
  let near = 0;
  let far = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const from = o[axis] as number;
    const step = d[axis] as number;
    const top = max[axis] as number;
    if (Math.abs(step) < 1e-12) {
      if (from < 0 || from > top) return false;
      continue;
    }
    const a = (0 - from) / step;
    const b = (top - from) / step;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  return true;
}

/**
 * The basket a ray points at, of the baskets that can be loaded now: the one in whose plan the
 * piece would rest under the cursor. A basket inside another (the cutlery basket, given only
 * for a piece that stands in its cells) wins whenever the cursor is over it: when the ray
 * passes through its box from its floor to the rim of its cells, from whichever side it is
 * seen. Of two baskets one above the other, the upper. Null when the ray points at none (the
 * player is over the door, the floor or a wall): the piece then stays with the basket it was
 * over.
 */
export function aimFrame(
  targets: readonly AimTarget[],
  originMm: Vec3,
  direction: Vec3,
  marginMm = 12,
): FrameId | null {
  let best: { frame: FrameId; height: number } | null = null;
  for (const target of targets) {
    if (target.inner === true) {
      const top = target.opening_z_mm ?? target.envelope_mm[2];
      if (rayThroughBox(target.pose, originMm, direction, target.envelope_mm, top)) {
        return target.frame;
      }
      continue;
    }
    const rest = rayAtHeight(target.pose, originMm, direction, target.rest_z_mm);
    if (rest === null || !inPlan(rest, target.envelope_mm, marginMm)) continue;
    const height = target.pose.position_mm[2];
    if (best === null || height > best.height) best = { frame: target.frame, height };
  }
  return best?.frame ?? null;
}

/**
 * Where the reference point of the piece goes in a basket for a ray: x and y on the 1 mm grid,
 * inside the plan of the basket. In a basket that stands inside another and has an opening
 * (the cutlery basket) it is the place under the point where the ray enters the opening. `current` is where it is now, used when the ray runs along
 * the basket (an elevation): the piece then keeps its depth and moves across the picture only.
 * Null when the ray names no place.
 */
export function aimPoint(
  target: AimTarget,
  originMm: Vec3,
  direction: Vec3,
  current: readonly [number, number] | null = null,
): readonly [number, number] | null {
  const d = directionInFrame(target.pose, direction);
  let xy: readonly [number, number] | null;
  if (Math.abs(d[2]) >= LEVEL_RAY) {
    // Into a basket of cells one looks through its opening: the cell is the one the ray
    // enters there. Seen through its side, the place is where the piece would stand.
    const opening =
      target.inner === true && target.opening_z_mm !== undefined
        ? rayAtHeight(target.pose, originMm, direction, target.opening_z_mm)
        : null;
    xy =
      opening !== null && inPlan(opening, target.envelope_mm, 0)
        ? opening
        : rayAtHeight(target.pose, originMm, direction, target.rest_z_mm);
  } else {
    // An elevation: the point of the line of sight at the depth the piece is at.
    const level = Math.hypot(d[0], d[1]);
    if (current === null || level < 1e-9) return null;
    const o = pointInFrame(target.pose, originMm);
    const t = ((current[0] - o[0]) * d[0] + (current[1] - o[1]) * d[1]) / (level * level);
    xy = [o[0] + t * d[0], o[1] + t * d[1]];
  }
  if (xy === null || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) return null;
  const [x, y] = quantiseMm([xy[0], xy[1], 0]);
  const clamped = clampToEnvelope([x, y, 0], target.envelope_mm);
  return [clamped[0], clamped[1]];
}

/**
 * How far the middle of a piece at a place of a frame is from the line of sight of a ray,
 * millimetres: what "the piece is under the cursor" means in numbers.
 */
export function missFromRay(
  pose: DrawPose,
  positionMm: Vec3Mm,
  originMm: Vec3,
  direction: Vec3,
): number {
  const o = pointInFrame(pose, originMm);
  const d = directionInFrame(pose, direction);
  const length = Math.hypot(d[0], d[1], d[2]);
  const v: Vec3 = [positionMm[0] - o[0], positionMm[1] - o[1], positionMm[2] - o[2]];
  const along = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / length;
  return Math.hypot(
    v[0] - (along * d[0]) / length,
    v[1] - (along * d[1]) / length,
    v[2] - (along * d[2]) / length,
  );
}
