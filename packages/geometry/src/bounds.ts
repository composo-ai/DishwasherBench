/**
 * Exact axis-aligned bounding boxes (docs/design/platform.md section 4.2).
 *
 * The box of a shape is the union of the boxes of its parts; the extent of a part along an axis
 * is the support function of its primitive in that direction, which is known in closed form for
 * every primitive: end points plus radius for a capsule, the projected half extents plus radius
 * for a rounded box, the furthest vertex plus radius for a hull and, for a shell of revolution,
 * the extreme of the cross-section boundary (lines and arcs) revolved, stretched and restricted
 * to its azimuth range. The box is therefore tight for any pose, not the box of a rotated box.
 *
 * Units: metres.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { POSE_IDENTITY, poseCompose, quatToMat3 } from '@spotless/core';
import { preparePrimitive, type PreparedPrimitive, type PreparedSor } from './prepared.ts';
import { shapeRegionRules } from './regions.ts';
import { pieceSupport } from './sor-section.ts';
import type { Aabb, Primitive, Shape } from './types.ts';

const TWO_PI = 2 * Math.PI;

function sorSupport(s: PreparedSor, dx: number, dy: number, dz: number): number {
  // The support of a stretched solid in direction d is that of the solid in direction A d.
  const ax = s.sx * dx;
  const ay = s.sy * dy;
  let radial = Math.hypot(ax, ay);
  const arc = s.arc;
  if (arc !== null && radial > 0) {
    // Largest cos(phi - phi_d) over the azimuth range: 1 when the direction's azimuth is in it.
    let offset = (Math.atan2(ay, ax) - arc.mid) % TWO_PI;
    if (offset > Math.PI) offset -= TWO_PI;
    else if (offset < -Math.PI) offset += TWO_PI;
    const beyond = Math.abs(offset) - arc.halfSpan;
    if (beyond > 0) radial *= Math.cos(beyond);
  }
  let best = Number.NEGATIVE_INFINITY;
  for (const loop of s.section().loops) {
    for (const piece of loop.pieces) best = Math.max(best, pieceSupport(piece, radial, dz));
  }
  return best;
}

/** Largest value of `d . x` over a prepared primitive (part frame; `d` must be a unit vector). */
function preparedSupport(prep: PreparedPrimitive, dx: number, dy: number, dz: number): number {
  switch (prep.kind) {
    case 'sor':
      return sorSupport(prep, dx, dy, dz);
    case 'capsule':
      return (
        Math.max(
          prep.a[0] * dx + prep.a[1] * dy + prep.a[2] * dz,
          prep.b[0] * dx + prep.b[1] * dy + prep.b[2] * dz,
        ) + prep.radius
      );
    case 'rbox':
      return (
        Math.abs(dx) * prep.halfExtents[0] +
        Math.abs(dy) * prep.halfExtents[1] +
        Math.abs(dz) * prep.halfExtents[2] +
        prep.radius
      );
    case 'hull': {
      const core = prep.core;
      const points: readonly Vec3[] =
        core.dim === 0 ? [core.centre] : core.dim === 1 ? [core.a, core.b] : core.vertices;
      let best = Number.NEGATIVE_INFINITY;
      for (const p of points) best = Math.max(best, p[0] * dx + p[1] * dy + p[2] * dz);
      return best + prep.radius;
    }
  }
}

/**
 * Support function of a primitive: the largest value of `d . x` over its solid, for a unit
 * direction `d` in the part frame (metres).
 */
export function primitiveSupport(prim: Primitive, d: Vec3): number {
  return preparedSupport(preparePrimitive(prim), d[0], d[1], d[2]);
}

/**
 * `boundingBox(shape, pose?)`: the tight axis-aligned box of the shape in the item frame or, when
 * a pose (item frame to parent frame) is given, in the parent frame.
 */
export function boundingBox(shape: Shape, pose: Pose = POSE_IDENTITY): Aabb {
  shapeRegionRules(shape); // validates the shape
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const part of shape.parts) {
    const prep = preparePrimitive(part.prim);
    const total = poseCompose(pose, part.pose);
    const m = quatToMat3(total.q);
    for (let i = 0; i < 3; i++) {
      // Parent axis i expressed in the part frame is row i of the rotation matrix.
      const dx = m[3 * i] as number;
      const dy = m[3 * i + 1] as number;
      const dz = m[3 * i + 2] as number;
      const origin = total.p[i] as number;
      max[i] = Math.max(max[i] as number, origin + preparedSupport(prep, dx, dy, dz));
      min[i] = Math.min(min[i] as number, origin - preparedSupport(prep, -dx, -dy, -dz));
    }
  }
  return {
    min: [min[0] as number, min[1] as number, min[2] as number],
    max: [max[0] as number, max[1] as number, max[2] as number],
  };
}
