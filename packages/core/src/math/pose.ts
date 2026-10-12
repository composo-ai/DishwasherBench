import { QUAT_IDENTITY, quatConjugate, quatMul, quatRotate } from './quat.ts';
import type { Pose, Quat, Vec3 } from './types.ts';
import { V3_ZERO } from './vec3.ts';

/** The identity transform: child frame coincides with the parent frame. */
export const POSE_IDENTITY: Pose = { p: V3_ZERO, q: QUAT_IDENTITY };

/** Builds a pose from a position (metres, parent frame) and a unit quaternion. */
export function pose(p: Vec3, q: Quat = QUAT_IDENTITY): Pose {
  return { p, q };
}

/**
 * Composition `a . b`: if `b` maps frame C to frame B and `a` maps frame B to frame A, the result
 * maps frame C to frame A. `poseTransformPoint(poseCompose(a, b), x) =
 * poseTransformPoint(a, poseTransformPoint(b, x))`.
 */
export function poseCompose(a: Pose, b: Pose): Pose {
  const r = quatRotate(a.q, b.p);
  return {
    p: [a.p[0] + r[0], a.p[1] + r[1], a.p[2] + r[2]],
    q: quatMul(a.q, b.q),
  };
}

/** Inverse transform: maps parent-frame points back to the child frame. */
export function poseInverse(a: Pose): Pose {
  const qi = quatConjugate(a.q);
  const r = quatRotate(qi, a.p);
  return { p: [-r[0] + 0, -r[1] + 0, -r[2] + 0], q: qi };
}

/** Maps a point from the child frame to the parent frame: `p + rotate(q, x)`. Metres. */
export function poseTransformPoint(a: Pose, x: Vec3): Vec3 {
  const r = quatRotate(a.q, x);
  return [a.p[0] + r[0], a.p[1] + r[1], a.p[2] + r[2]];
}

/** Maps a point from the parent frame to the child frame, without building the inverse pose. */
export function poseInverseTransformPoint(a: Pose, x: Vec3): Vec3 {
  return quatRotate(quatConjugate(a.q), [x[0] - a.p[0], x[1] - a.p[1], x[2] - a.p[2]]);
}

/**
 * Maps a free vector (direction, velocity, force) from the child frame to the parent frame:
 * rotation only, no translation.
 */
export function poseTransformVector(a: Pose, v: Vec3): Vec3 {
  return quatRotate(a.q, v);
}

/** Maps a free vector from the parent frame to the child frame: inverse rotation only. */
export function poseInverseTransformVector(a: Pose, v: Vec3): Vec3 {
  return quatRotate(quatConjugate(a.q), v);
}

/**
 * The pose of frame B relative to frame A, given both relative to a common parent:
 * `poseCompose(a, poseRelative(a, b)) = b`.
 */
export function poseRelative(a: Pose, b: Pose): Pose {
  return poseCompose(poseInverse(a), b);
}
