/**
 * Where the tines of a row stand, upright or folded. Shared by the shape generator and the
 * affordances, so that both describe the same tines. Rack frame, metres.
 */

import type { Vec3 } from '@spotless/core';
import { quatFromAxisAngle, quatRotate, v3AddScaled } from '@spotless/core';
import { directionVector } from '../outline.ts';
import type { TineRowSpec } from '../types.ts';

/** The centre line of one tine. */
export interface TineLine {
  /** Where it stands on the rail centre line. */
  readonly base: Vec3;
  /** Its far end: the outermost point of its tip. */
  readonly end: Vec3;
  /** Unit vector from base to end. */
  readonly direction: Vec3;
  /** Length from base to end, metres. */
  readonly length: number;
}

/** Unit vector along the rail of a row, in the direction of increasing tine position. */
export function railDirection(row: TineRowSpec): Vec3 {
  return row.runs === 'x' ? [1, 0, 0] : [0, 1, 0];
}

/** The point of the rail centre line at position `along` of the run. */
export function railPoint(row: TineRowSpec, along: number): Vec3 {
  return row.runs === 'x' ? [along, row.railAt, row.railZ] : [row.railAt, along, row.railZ];
}

/**
 * Centre line of tine `index` of a row. Upright, it ends at
 * `base + (height / cos(lean)) (sin(lean) d + cos(lean) z)` (see `TineRowSpec`). Folded, the
 * whole row is turned about its rail by the hinge's fold angle, tips towards `foldsToward`.
 * Throws a RangeError for an index the row does not have.
 */
export function tineLine(row: TineRowSpec, index: number, folded: boolean): TineLine {
  const position = row.tinePositions[index];
  const toward = row.leanToward[index];
  if (position === undefined || toward === undefined) {
    throw new RangeError(`machine geometry: tine row "${row.id}" has no tine ${index}`);
  }
  const base = railPoint(row, position);
  const d = directionVector(toward);
  const sin = Math.sin(row.lean);
  const cos = Math.cos(row.lean);
  let direction: Vec3 = [sin * d[0], sin * d[1], cos];
  if (folded && row.hinge !== null) {
    // Turning +z towards the horizontal unit vector f is a rotation about z x f.
    const f = directionVector(row.hinge.foldsToward);
    const q = quatFromAxisAngle([-f[1], f[0], 0], row.hinge.foldAngle);
    direction = quatRotate(q, direction);
  }
  const length = row.height / cos;
  return { base, end: v3AddScaled(base, direction, length), direction, length };
}

/** True when the tines of a row lean along its rail (plates then lean with them). */
export function leansAlongRail(row: TineRowSpec): boolean {
  if (row.lean === 0) return false;
  return row.leanToward.every((toward) => toward.endsWith(row.runs));
}
