/**
 * Conversion between the wire (millimetres, degrees, `quat_wxyz`, named frames, the item's
 * reference point) and the engine (SI, `[x, y, z, w]`, the tub frame, the item-frame origin),
 * with the quantisation of player input (docs/design/platform.md section 2). This is the only
 * place where the two meet.
 */

import type { Pose, Quat, Vec3 } from '@spotless/core';
import {
  degToRad,
  mmToM,
  poseRelative,
  quantiseAngleDeg,
  quantisePositionMm,
  quantiseQuatGrid,
  quatFromAxisAngle,
  quatFromWire,
  quatMul,
  quatRotate,
  quatToWire,
  roundToGrid,
  v3Add,
  v3Sub,
} from '@spotless/core';
import type { FrameId, Orientation, Vec3Mm, WirePose } from './types.ts';

/** True for an array of three finite numbers. */
export function isVec3(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((x) => typeof x === 'number' && Number.isFinite(x))
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** An orientation after quantisation. */
export interface ResolvedOrientation {
  /** The grid point that goes on the wire and into logs (components multiples of 1e-4). */
  readonly grid: Quat;
  /** The unit quaternion the engine uses: the grid point renormalised. */
  readonly unit: Quat;
}

function resolved(raw: Quat): ResolvedOrientation | null {
  const grid = quantiseQuatGrid(raw);
  if (grid === null) return null;
  const length = Math.hypot(grid[0], grid[1], grid[2], grid[3]);
  return {
    grid,
    unit: [grid[0] / length, grid[1] / length, grid[2] / length, grid[3] / length],
  };
}

/**
 * Resolves an orientation of a request: a quaternion (w, x, y, z), or a preset of the item
 * with yaw, pitch and roll in degrees, each rounded to a whole degree and applied about the
 * fixed axes of the placement frame as `q = q_z(yaw) q_y(pitch) q_x(roll) q_preset`. Returns
 * null for anything malformed: an unknown preset, a zero or non-finite quaternion, an angle
 * that is not a finite number.
 */
export function resolveOrientation(
  orientation: unknown,
  presets: ReadonlyMap<string, Quat>,
): ResolvedOrientation | null {
  if (typeof orientation !== 'object' || orientation === null) return null;
  const given = orientation as {
    quat_wxyz?: unknown;
    preset?: unknown;
    yaw_deg?: unknown;
    pitch_deg?: unknown;
    roll_deg?: unknown;
  };
  if (given.quat_wxyz !== undefined) {
    const q = given.quat_wxyz;
    if (given.preset !== undefined) return null;
    if (!Array.isArray(q) || q.length !== 4 || !q.every(isFiniteNumber)) return null;
    return resolved(quatFromWire(q as unknown as [number, number, number, number]));
  }
  if (typeof given.preset !== 'string') return null;
  const preset = presets.get(given.preset);
  if (preset === undefined) return null;
  const angles: number[] = [];
  for (const angle of [given.yaw_deg, given.pitch_deg, given.roll_deg]) {
    if (angle === undefined) angles.push(0);
    else if (isFiniteNumber(angle)) angles.push(quantiseAngleDeg(angle));
    else return null;
  }
  const [yaw, pitch, roll] = angles as [number, number, number];
  let q = preset;
  if (roll !== 0) q = quatMul(quatFromAxisAngle([1, 0, 0], degToRad(roll)), q);
  if (pitch !== 0) q = quatMul(quatFromAxisAngle([0, 1, 0], degToRad(pitch)), q);
  if (yaw !== 0) q = quatMul(quatFromAxisAngle([0, 0, 1], degToRad(yaw)), q);
  return resolved(q);
}

/** A requested position in whole millimetres, and the same in metres. */
export function quantisePosition(positionMm: Vec3Mm): { mm: Vec3; m: Vec3 } {
  const mm = quantisePositionMm([positionMm[0], positionMm[1], positionMm[2]]);
  return { mm, m: [mmToM(mm[0]), mmToM(mm[1]), mmToM(mm[2])] };
}

/**
 * A requested position on the fine grid of `mode: 'set'` (0.1 mm, the grid poses are reported
 * on), and the same in metres.
 */
export function finePosition(positionMm: Vec3Mm): { mm: Vec3; m: Vec3 } {
  const mm: Vec3 = [
    roundToGrid(positionMm[0], 10) + 0,
    roundToGrid(positionMm[1], 10) + 0,
    roundToGrid(positionMm[2], 10) + 0,
  ];
  return { mm, m: [mmToM(mm[0]), mmToM(mm[1]), mmToM(mm[2])] };
}

/**
 * The pose of an item's body (item-frame origin, tub frame) for a reference-point position and
 * an orientation given in a frame whose pose in the tub frame is `frame`.
 */
export function bodyPoseInTub(frame: Pose, position: Vec3, q: Quat, referencePoint: Vec3): Pose {
  const qTub = quatMul(frame.q, q);
  const reference = v3Add(frame.p, quatRotate(frame.q, position));
  return { p: v3Sub(reference, quatRotate(qTub, referencePoint)), q: qTub };
}

/** Position of an item's reference point for a body pose, tub frame, metres. */
export function referencePointOf(body: Pose, referencePoint: Vec3): Vec3 {
  return v3Add(body.p, quatRotate(body.q, referencePoint));
}

/**
 * A body pose as it goes on the wire: the reference point and orientation in the named frame,
 * the position rounded to 0.1 mm and the quaternion to its grid point.
 */
export function toWirePose(
  frameId: FrameId,
  frame: Pose,
  body: Pose,
  referencePoint: Vec3,
): WirePose {
  const relative = poseRelative(frame, body);
  const reference = referencePointOf(relative, referencePoint);
  const grid = quantiseQuatGrid(relative.q) ?? [0, 0, 0, 1];
  return {
    frame: frameId,
    position_mm: [
      roundToGrid(reference[0] * 1000, 10),
      roundToGrid(reference[1] * 1000, 10),
      roundToGrid(reference[2] * 1000, 10),
    ],
    quat_wxyz: quatToWire(grid),
  };
}

/** A requested (quantised) pose as it goes on the wire. */
export function requestedWirePose(frameId: FrameId, positionMm: Vec3, grid: Quat): WirePose {
  return {
    frame: frameId,
    position_mm: [positionMm[0], positionMm[1], positionMm[2]],
    quat_wxyz: quatToWire(grid),
  };
}
