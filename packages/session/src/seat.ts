/**
 * Geometry behind the slot advice of `list_slots` (docs/design/platform.md section 6, "Slot
 * suggestions"): where the lowest part of an item is at an orientation, and how an item is held
 * to be slid down between two tines of a row by a hand.
 *
 * Pure functions of collision pieces and orientations; the session does the collision tests.
 * Units: SI and radians unless a name says otherwise.
 */

import type { Quat, Vec3 } from '@spotless/core';
import { quatRotate, v3Add } from '@spotless/core';
import type { CollisionPiece } from '@spotless/geometry';

/** The corner points of the solid pieces of an item with the rounding radius of each. */
function supportPoints(pieces: readonly CollisionPiece[]): { p: Vec3; radius: number }[] {
  const out: { p: Vec3; radius: number }[] = [];
  for (const piece of pieces) {
    if (piece.kind === 'round') continue;
    if (piece.kind === 'hull') {
      for (const p of piece.points) out.push({ p, radius: piece.radius });
    } else if (piece.kind === 'capsule') {
      out.push({ p: piece.a, radius: piece.radius }, { p: piece.b, radius: piece.radius });
    } else {
      const h = piece.halfExtents;
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            out.push({
              p: v3Add(piece.pose.p, quatRotate(piece.pose.q, [sx * h[0], sy * h[1], sz * h[2]])),
              radius: piece.radius,
            });
          }
        }
      }
    }
  }
  return out;
}

/** The lower end of an item at an orientation, relative to its item-frame origin. */
export interface LowerEnd {
  /** Height of the lowest point of the item (negative: below the origin), metres. */
  readonly z: number;
  /** Plan position of the middle of what lies within `band` of the lowest point, metres. */
  readonly centre: readonly [number, number];
}

/**
 * The lower end of an item held at orientation `q`: its lowest point, and the middle in plan of
 * everything within `band` metres above it. With a small band this is where the item touches
 * down (the lowest stretch of a plate's rim); with a band of a few centimetres it is the end of
 * a piece of cutlery that goes into a cell first, which for a spoon or a ladle is far from the
 * middle of its bounding box.
 */
export function lowerEndOf(pieces: readonly CollisionPiece[], q: Quat, band: number): LowerEnd {
  const points = supportPoints(pieces).map(({ p, radius }) => ({ p: quatRotate(q, p), radius }));
  let lowest = Infinity;
  for (const { p, radius } of points) lowest = Math.min(lowest, p[2] - radius);
  if (!Number.isFinite(lowest)) return { z: 0, centre: [0, 0] };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { p, radius } of points) {
    if (p[2] - radius > lowest + band) continue;
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  return { z: lowest, centre: [(minX + maxX) / 2, (minY + maxY) / 2] };
}

/**
 * The offsets to an item's `on_edge` preset that stand it in a slot of a tine row leaning by
 * `leanDeg` degrees: its face (item +z, which `on_edge` turns to -y) towards `face`, a
 * horizontal unit vector of the placement frame, and tipped up by the lean, so that its top
 * goes the other way. Whole degrees, as the wire takes them.
 */
export function edgeOrientation(
  face: readonly [number, number],
  leanDeg: number,
  preset = 'on_edge',
): { readonly preset: string; readonly roll_deg: number; readonly yaw_deg: number } {
  const yaw = Math.round((Math.atan2(face[0], -face[1]) * 180) / Math.PI) + 0;
  return { preset, roll_deg: -Math.round(leanDeg) + 0, yaw_deg: yaw === -180 ? 180 : yaw };
}
