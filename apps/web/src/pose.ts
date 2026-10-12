/**
 * Pose arithmetic of the item in hand (the ghost): the same quantisation and the same
 * composition of preset, roll, pitch and yaw as the session applies to a `place` request, so
 * that the ghost is drawn exactly where the server will take the item to be.
 *
 * Wire units throughout: millimetres, whole degrees, `quat_wxyz`. Pure functions.
 */

import type { Quat, Vec3 } from '@spotless/core';
import {
  degToRad,
  quantiseAngleDeg,
  quantisePositionMm,
  quantiseQuatGrid,
  quatConjugate,
  quatFromAxisAngle,
  quatFromWire,
  quatMul,
  quatRotate,
  quatToWire,
  roundToGrid,
  v3Add,
  v3Sub,
} from '@spotless/core';
import type {
  FrameId,
  Orientation,
  OrientationPresetCard,
  PlaceMode,
  PlaceRequest,
  PresetOrientation,
  PreviewRequest,
  Vec3Mm,
  WirePose,
} from '@spotless/session';

/** A draw pose: the pose of a body's own frame in the tub frame (millimetres, `quat_wxyz`). */
export interface DrawPose {
  readonly position_mm: Vec3Mm;
  readonly quat_wxyz: readonly [number, number, number, number];
}

/** The pose of the item in hand as the player sets it. */
export interface GhostPose {
  readonly frame: FrameId;
  /** Position of the item's reference point in `frame`, whole millimetres. */
  readonly position_mm: Vec3Mm;
  /** Name of one of the item's orientation presets. */
  readonly preset: string;
  /** Offsets to the preset, whole degrees, each in (-180, 180]. */
  readonly yaw_deg: number;
  readonly pitch_deg: number;
  readonly roll_deg: number;
  /**
   * The orientation as a quaternion (w, x, y, z) in `frame`, on the 1e-4 grid. When present it
   * is the orientation and the preset and its offsets are not used: this is how a pose read
   * from the machine (a settled pose) is put back exactly.
   */
  readonly quat_wxyz?: readonly [number, number, number, number];
  /**
   * True when the position is on the 0.1 mm grid of `mode: 'set'` (exact placement in a
   * calibration level) and not on the 1 mm grid of the game.
   */
  readonly fine?: boolean;
}

/** An angle in whole degrees wrapped into (-180, 180]. */
export function wrapAngleDeg(angleDeg: number): number {
  const whole = quantiseAngleDeg(angleDeg);
  const wrapped = ((((whole + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped + 0;
}

/** An angle moved by a number of steps of a size, quantised and wrapped. */
export function stepAngleDeg(angleDeg: number, steps: number, stepDeg: number): number {
  return wrapAngleDeg(angleDeg + steps * stepDeg);
}

/** A position on the 1 mm input grid, exactly as the session quantises a request. */
export function quantiseMm(positionMm: readonly [number, number, number]): Vec3Mm {
  const q = quantisePositionMm([positionMm[0], positionMm[1], positionMm[2]]);
  return [q[0], q[1], q[2]];
}

/** A position on the 0.1 mm grid of `mode: 'set'`, exactly as the session takes it. */
export function quantiseFineMm(positionMm: readonly [number, number, number]): Vec3Mm {
  return [
    roundToGrid(positionMm[0], 10) + 0,
    roundToGrid(positionMm[1], 10) + 0,
    roundToGrid(positionMm[2], 10) + 0,
  ];
}

/**
 * A quaternion (w, x, y, z) on the wire grid (1e-4 per component, `w >= 0`), as the session
 * quantises one; null for a zero or non-finite quaternion.
 */
export function quantiseQuatWire(
  quatWxyz: readonly [number, number, number, number],
): readonly [number, number, number, number] | null {
  if (!quatWxyz.every((c) => Number.isFinite(c))) return null;
  const grid = quantiseQuatGrid(quatFromWire(quatWxyz));
  return grid === null ? null : quatToWire(grid);
}

/** A ghost pose with every number on its input grid. */
export function quantiseGhost(ghost: GhostPose): GhostPose {
  const quat = ghost.quat_wxyz === undefined ? null : quantiseQuatWire(ghost.quat_wxyz);
  return {
    frame: ghost.frame,
    position_mm:
      ghost.fine === true ? quantiseFineMm(ghost.position_mm) : quantiseMm(ghost.position_mm),
    preset: ghost.preset,
    yaw_deg: wrapAngleDeg(ghost.yaw_deg),
    pitch_deg: wrapAngleDeg(ghost.pitch_deg),
    roll_deg: wrapAngleDeg(ghost.roll_deg),
    ...(quat === null ? {} : { quat_wxyz: quat }),
    ...(ghost.fine === true ? { fine: true } : {}),
  };
}

/**
 * The orientation of a ghost as it is sent: its quaternion when it has one, else the preset
 * and the offsets that are not zero.
 */
export function ghostOrientation(ghost: GhostPose): Orientation {
  const g = quantiseGhost(ghost);
  if (g.quat_wxyz !== undefined) return { quat_wxyz: g.quat_wxyz };
  return presetOrientation(g);
}

function presetOrientation(g: GhostPose): PresetOrientation {
  return {
    preset: g.preset,
    ...(g.yaw_deg === 0 ? {} : { yaw_deg: g.yaw_deg }),
    ...(g.pitch_deg === 0 ? {} : { pitch_deg: g.pitch_deg }),
    ...(g.roll_deg === 0 ? {} : { roll_deg: g.roll_deg }),
  };
}

/** The `preview` request of a ghost. */
export function previewRequest(itemId: string, ghost: GhostPose): PreviewRequest {
  const g = quantiseGhost(ghost);
  return {
    item_id: itemId,
    frame: g.frame,
    position_mm: g.position_mm,
    orientation: ghostOrientation(g),
  };
}

/**
 * The `place` request of a ghost: a drop, an insert along a direction of the frame, or (in a
 * level that allows exact placement) a set at exactly this pose.
 */
export function placeRequest(
  itemId: string,
  ghost: GhostPose,
  mode: PlaceMode = 'drop',
  insertDir?: readonly [number, number, number],
): PlaceRequest {
  return {
    ...previewRequest(itemId, ghost),
    ...(mode === 'drop' ? {} : { mode }),
    ...(mode === 'insert' && insertDir !== undefined ? { insert_dir: insertDir } : {}),
  };
}

/**
 * The orientation a ghost stands for, in its frame: `q_z(yaw) q_y(pitch) q_x(roll) q_preset`,
 * quantised to the 1e-4 grid and renormalised, which is what the session does with the same
 * request. Null when the item has no preset of that name.
 *
 * The preset is taken from the item record, where its components are rounded to 1e-4; the
 * session composes with the unrounded preset, so the two can differ by about 1e-4 per
 * component. That is far below what can be seen and does not affect what is placed: the
 * request names the preset, it does not carry this quaternion.
 */
export function ghostQuat(
  ghost: GhostPose,
  presets: readonly OrientationPresetCard[],
): Quat | null {
  const g = quantiseGhost(ghost);
  if (g.quat_wxyz !== undefined) return unit(quatFromWire(g.quat_wxyz));
  const preset = presets.find((p) => p.name === ghost.preset);
  if (preset === undefined) return null;
  let q: Quat = quatFromWire(preset.quat_wxyz);
  if (g.roll_deg !== 0) q = quatMul(quatFromAxisAngle([1, 0, 0], degToRad(g.roll_deg)), q);
  if (g.pitch_deg !== 0) q = quatMul(quatFromAxisAngle([0, 1, 0], degToRad(g.pitch_deg)), q);
  if (g.yaw_deg !== 0) q = quatMul(quatFromAxisAngle([0, 0, 1], degToRad(g.yaw_deg)), q);
  const grid = quantiseQuatGrid(q);
  if (grid === null) return null;
  const length = Math.hypot(grid[0], grid[1], grid[2], grid[3]);
  return [grid[0] / length, grid[1] / length, grid[2] / length, grid[3] / length];
}

function unit(q: Quat): Quat {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  return length > 0 ? [q[0] / length, q[1] / length, q[2] / length, q[3] / length] : [0, 0, 0, 1];
}

/**
 * Where to draw a body whose reference point is at `positionMm` with orientation `q`, both in
 * a frame drawn at `frame`: the pose of the item-frame origin in the tub frame.
 */
export function bodyDrawPose(
  frame: DrawPose,
  positionMm: Vec3Mm,
  q: Quat,
  referencePointMm: Vec3Mm,
): DrawPose {
  const frameQ = unit(quatFromWire(frame.quat_wxyz));
  const qTub = quatMul(frameQ, q);
  const reference = v3Add(
    [frame.position_mm[0], frame.position_mm[1], frame.position_mm[2]],
    quatRotate(frameQ, [positionMm[0], positionMm[1], positionMm[2]]),
  );
  const origin = v3Sub(
    reference,
    quatRotate(qTub, [referencePointMm[0], referencePointMm[1], referencePointMm[2]]),
  );
  return { position_mm: [origin[0], origin[1], origin[2]], quat_wxyz: quatToWire(qTub) };
}

/** Where to draw the ghost; null when its preset is unknown. */
export function ghostDrawPose(
  frame: DrawPose,
  ghost: GhostPose,
  presets: readonly OrientationPresetCard[],
  referencePointMm: Vec3Mm,
): DrawPose | null {
  const q = ghostQuat(ghost, presets);
  if (q === null) return null;
  return bodyDrawPose(frame, quantiseGhost(ghost).position_mm, q, referencePointMm);
}

/** Where to draw a body from a wire pose (a lowered, release or settled pose). */
export function wirePoseDrawPose(
  frame: DrawPose,
  pose: WirePose,
  referencePointMm: Vec3Mm,
): DrawPose {
  return bodyDrawPose(
    frame,
    pose.position_mm,
    unit(quatFromWire(pose.quat_wxyz)),
    referencePointMm,
  );
}

/** A point of the tub frame (millimetres) in the coordinates of a frame drawn at `frame`. */
export function pointInFrame(frame: DrawPose, pointMm: Vec3): Vec3 {
  const frameQ = unit(quatFromWire(frame.quat_wxyz));
  return quatRotate(
    quatConjugate(frameQ),
    v3Sub(pointMm, [frame.position_mm[0], frame.position_mm[1], frame.position_mm[2]]),
  );
}

/** A direction of the tub frame in the coordinates of a frame drawn at `frame`. */
export function directionInFrame(frame: DrawPose, direction: Vec3): Vec3 {
  return quatRotate(quatConjugate(unit(quatFromWire(frame.quat_wxyz))), direction);
}

/** A point of a frame drawn at `frame` (millimetres) in the tub frame. */
export function pointFromFrame(frame: DrawPose, pointMm: Vec3): Vec3 {
  const frameQ = unit(quatFromWire(frame.quat_wxyz));
  return v3Add(
    [frame.position_mm[0], frame.position_mm[1], frame.position_mm[2]],
    quatRotate(frameQ, pointMm),
  );
}

/**
 * Where a ray from the camera (origin and direction in the tub frame, millimetres) meets the
 * horizontal plane of the frame at height `zMm`, on the 1 mm grid. Null when the ray runs
 * along the plane or meets it behind the camera. The piece in hand is aimed with `aim.ts`,
 * which meets the ray with the plane at the height the piece rests at; this is the bare
 * intersection.
 */
export function rayOnFramePlane(
  frame: DrawPose,
  originMm: Vec3,
  direction: Vec3,
  zMm: number,
): readonly [number, number] | null {
  const o = pointInFrame(frame, originMm);
  const d = directionInFrame(frame, direction);
  if (Math.abs(d[2]) < 1e-9) return null;
  const t = (zMm - o[2]) / d[2];
  if (!(t > 0) || !Number.isFinite(t)) return null;
  const [x, y] = quantisePositionMm([o[0] + t * d[0], o[1] + t * d[1], 0]);
  return [x, y];
}

/** A position kept inside the plan of a frame's envelope (the session refuses anything outside). */
export function clampToEnvelope(positionMm: Vec3Mm, envelopeMm: Vec3Mm): Vec3Mm {
  const clamp = (x: number, max: number): number => Math.max(0, Math.min(Math.floor(max), x));
  return [clamp(positionMm[0], envelopeMm[0]), clamp(positionMm[1], envelopeMm[1]), positionMm[2]];
}

/**
 * How far an item reaches below its reference point at an orientation, millimetres, taking its
 * bounding box as centred on the reference point (which it is unless the item type says
 * otherwise; then this is an estimate).
 */
export function reachBelowMm(bboxMm: Vec3Mm, q: Quat): number {
  // Third row of the rotation matrix: how much each item axis points along frame z.
  const zx = Math.abs(quatRotate(q, [1, 0, 0])[2]);
  const zy = Math.abs(quatRotate(q, [0, 1, 0])[2]);
  const zz = Math.abs(quatRotate(q, [0, 0, 1])[2]);
  return (zx * bboxMm[0] + zy * bboxMm[1] + zz * bboxMm[2]) / 2;
}

/**
 * The height at which a newly picked-up item is held: its lowest point `clearanceMm` above the
 * top of the basket's wires, so that it can be moved over the basket freely and dropped from
 * there. On the 1 mm grid.
 */
export function holdHeightMm(rackTopMm: number, bboxMm: Vec3Mm, q: Quat, clearanceMm = 15): number {
  return Math.ceil(rackTopMm + clearanceMm + reachBelowMm(bboxMm, q));
}

/**
 * How far an item reaches from its reference point along a horizontal axis of its frame (0 for
 * x, 1 for y) at an orientation, millimetres; the same estimate as {@link reachBelowMm}.
 */
export function reachAlongMm(bboxMm: Vec3Mm, q: Quat, axis: 0 | 1): number {
  const ax = Math.abs(quatRotate(q, [1, 0, 0])[axis]);
  const ay = Math.abs(quatRotate(q, [0, 1, 0])[axis]);
  const az = Math.abs(quatRotate(q, [0, 0, 1])[axis]);
  return (ax * bboxMm[0] + ay * bboxMm[1] + az * bboxMm[2]) / 2;
}

/**
 * The holding height of an item kept under a ceiling: `wantedMm`, lowered as far as needed for
 * the top of the item to stay `clearanceMm` below `ceilingMm` (both heights of the reference
 * point's frame). Used where part of the item is under the roof of the tub or under the upper
 * basket: held at the usual height it would be inside them. On the 1 mm grid.
 */
export function heightUnderMm(
  wantedMm: number,
  ceilingMm: number,
  bboxMm: Vec3Mm,
  q: Quat,
  clearanceMm = 8,
  reachAboveMm?: number,
): number {
  // How far the item reaches above its reference point: as given (from its shape), else half
  // its bounding box, which is right only for an item whose reference point is at its middle
  // (a mug's is not: held mouth down it reaches some 10 mm further up than half its height,
  // and was held that far into the roof of the tub).
  const above = reachAboveMm ?? reachBelowMm(bboxMm, q);
  return Math.min(wantedMm, Math.floor(ceilingMm - clearanceMm - above));
}

/**
 * The quaternion (w, x, y, z) typed into the pose panel: four numbers separated by commas or
 * spaces, not all zero; null for anything else.
 */
export function parseQuat(text: string): readonly [number, number, number, number] | null {
  const parts = text
    .trim()
    .replace(/^[([]|[)\]]$/g, '')
    .split(/[\s,;]+/)
    .filter((part) => part !== '')
    .map(Number);
  if (parts.length !== 4 || !parts.every((c) => Number.isFinite(c))) return null;
  return quantiseQuatWire(parts as unknown as [number, number, number, number]);
}

/** The six directions of a frame an insert can be made along, and their names. */
export const INSERT_DIRECTIONS: readonly {
  readonly name: string;
  readonly dir: readonly [number, number, number];
}[] = [
  { name: 'down (-z)', dir: [0, 0, -1] },
  { name: 'to the back (+y)', dir: [0, 1, 0] },
  { name: 'to the front (-y)', dir: [0, -1, 0] },
  { name: 'to the right (+x)', dir: [1, 0, 0] },
  { name: 'to the left (-x)', dir: [-1, 0, 0] },
  { name: 'up (+z)', dir: [0, 0, 1] },
];

/**
 * The insert direction a drag of the mouse stands for: of the candidate directions, given as
 * they appear on the screen (the pixels a step of 100 mm along each covers, y down), the one
 * the drag follows most closely. Null for a drag too short to mean anything (under `minPixels`) or one that follows
 * no candidate (every candidate points at the viewer or is more than 60 degrees off).
 */
export function insertDirectionFromDrag(
  drag: readonly [number, number],
  candidatesOnScreen: readonly (readonly [number, number])[],
  minPixels = 12,
): number | null {
  const length = Math.hypot(drag[0], drag[1]);
  if (length < minPixels) return null;
  let best: number | null = null;
  let bestCos = 0.5;
  candidatesOnScreen.forEach((candidate, index) => {
    const size = Math.hypot(candidate[0], candidate[1]);
    // A direction seen end on has no direction on the screen.
    if (size < 3) return;
    const cos = (drag[0] * candidate[0] + drag[1] * candidate[1]) / (length * size);
    if (cos > bestCos) {
      bestCos = cos;
      best = index;
    }
  });
  return best;
}

/** Reads a number typed into a pose field: a finite number, or null. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
