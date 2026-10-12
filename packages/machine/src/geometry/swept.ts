/**
 * Swept volumes and the clearance of shapes from them.
 *
 * The volume a spray arm passes through in one turn is a stack of rings about its vertical
 * axis (`ArmSweptVolume`). Because a ring is a solid of revolution, the distance from a point
 * to it is the distance in the (r, z) half-plane to the rectangle `[rMin, rMax] x [zMin, zMax]`.
 * Tub frame, metres.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { poseCompose, POSE_IDENTITY, poseTransformPoint } from '@spotless/core';
import type { Part, Shape } from '@spotless/geometry';
import { boundingBox } from '@spotless/geometry';
import type { ArmSweptVolume, SweptRing } from './types.ts';

/** Spacing of the points a capsule's centre line is sampled at, metres. */
const SAMPLE_SPACING = 0.002;

/** Distance from the point (r, z) of the half-plane to a ring's rectangle; 0 inside it. */
export function ringDistance(ring: SweptRing, r: number, z: number): number {
  const dr = Math.max(ring.rMin - r, 0, r - ring.rMax);
  const dz = Math.max(ring.zMin - z, 0, z - ring.zMax);
  return Math.hypot(dr, dz);
}

/** Distance from a tub-frame point to the nearest ring of a swept volume; 0 inside it. */
export function sweptDistance(sweep: ArmSweptVolume, point: Vec3): number {
  const r = Math.hypot(point[0] - sweep.axis[0], point[1] - sweep.axis[1]);
  let least = Number.POSITIVE_INFINITY;
  for (const ring of sweep.rings) least = Math.min(least, ringDistance(ring, r, point[2]));
  return least;
}

/**
 * How far a tub-frame point is inside a swept volume, metres: its distance to the nearest face
 * of the ring it is deepest in, 0 outside every ring and on a boundary.
 */
export function sweptPenetration(sweep: ArmSweptVolume, point: Vec3): number {
  const r = Math.hypot(point[0] - sweep.axis[0], point[1] - sweep.axis[1]);
  const z = point[2];
  let deepest = 0;
  for (const ring of sweep.rings) {
    if (r < ring.rMin || r > ring.rMax || z < ring.zMin || z > ring.zMax) continue;
    const inner = ring.rMin > 0 ? r - ring.rMin : Number.POSITIVE_INFINITY;
    deepest = Math.max(deepest, Math.min(inner, ring.rMax - r, z - ring.zMin, ring.zMax - z));
  }
  return deepest;
}

/** The clearance of one part from a swept volume and what is nearest. */
export interface SweptClearance {
  /**
   * Smallest gap between the swept volume and the shape, metres: positive when they are apart,
   * zero or negative when the shape reaches into the volume (the value is then minus the radius
   * of the capsule that reaches furthest in, or 0 for another primitive).
   */
  readonly gap: number;
  /** Id of the part of the shape that is nearest, or null for an empty shape. */
  readonly part: string | null;
  /** Id of the ring it is nearest to. */
  readonly ring: string | null;
}

function partClearance(
  sweep: ArmSweptVolume,
  part: Part,
  pose: Pose,
): { gap: number; ring: string | null } {
  let gap = Number.POSITIVE_INFINITY;
  let nearest: string | null = null;
  const whole = poseCompose(pose, part.pose);
  if (part.prim.kind === 'capsule') {
    const a = poseTransformPoint(whole, part.prim.a);
    const b = poseTransformPoint(whole, part.prim.b);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const steps = Math.max(1, Math.ceil(length / SAMPLE_SPACING));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a[0] + (b[0] - a[0]) * t - sweep.axis[0];
      const y = a[1] + (b[1] - a[1]) * t - sweep.axis[1];
      const z = a[2] + (b[2] - a[2]) * t;
      const r = Math.hypot(x, y);
      for (const ring of sweep.rings) {
        const d = ringDistance(ring, r, z) - part.prim.radius;
        if (d < gap) {
          gap = d;
          nearest = ring.id;
        }
      }
    }
    return { gap, ring: nearest };
  }
  // Any other primitive: its bounding box, which contains it, so the gap is a lower bound.
  const box = boundingBox({ parts: [{ ...part, pose: POSE_IDENTITY }], regions: [] }, whole);
  const x0 = box.min[0] - sweep.axis[0];
  const x1 = box.max[0] - sweep.axis[0];
  const y0 = box.min[1] - sweep.axis[1];
  const y1 = box.max[1] - sweep.axis[1];
  const nearX = x0 > 0 ? x0 : x1 < 0 ? -x1 : 0;
  const nearY = y0 > 0 ? y0 : y1 < 0 ? -y1 : 0;
  const rNear = Math.hypot(nearX, nearY);
  const rFar = Math.hypot(
    Math.max(Math.abs(x0), Math.abs(x1)),
    Math.max(Math.abs(y0), Math.abs(y1)),
  );
  for (const ring of sweep.rings) {
    const dr = Math.max(ring.rMin - rFar, 0, rNear - ring.rMax);
    const dz = Math.max(ring.zMin - box.max[2], 0, box.min[2] - ring.zMax);
    const d = Math.hypot(dr, dz);
    if (d < gap) {
      gap = d;
      nearest = ring.id;
    }
  }
  return { gap, ring: nearest };
}

/**
 * The smallest gap between a swept volume and a shape posed in the tub frame. Capsules are
 * measured along their centre lines (sampled every 2 mm); every other primitive by its bounding
 * box, so that the result never overstates the gap.
 */
export function sweptClearance(sweep: ArmSweptVolume, shape: Shape, pose: Pose): SweptClearance {
  let best: SweptClearance = { gap: Number.POSITIVE_INFINITY, part: null, ring: null };
  for (const part of shape.parts) {
    const c = partClearance(sweep, part, pose);
    if (c.gap < best.gap) best = { gap: c.gap, part: part.id, ring: c.ring };
  }
  return best;
}
