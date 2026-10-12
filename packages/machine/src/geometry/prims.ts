/**
 * Small builders for the non-wire parts of the machine: slabs, pucks, tubes, and turning a
 * group of parts about a hinge. Everything in the frame of the shape being built, metres.
 */

import type { Pose, Quat, Vec3 } from '@spotless/core';
import {
  poseCompose,
  QUAT_IDENTITY,
  quatFromAxisAngle,
  quatFromTo,
  quatRotate,
  v3Sub,
} from '@spotless/core';
import type { Part, Shape, SorProfilePoint } from '@spotless/geometry';

/** An axis-aligned box given by two opposite corners. */
export interface Box {
  readonly min: Vec3;
  readonly max: Vec3;
}

/**
 * A slab filling the axis-aligned box from `min` to `max`, its edges rounded by `edge` (reduced
 * where the slab is thinner than twice that). `porosity` is the open fraction of a lattice.
 */
export function slabPart(
  id: string,
  min: Vec3,
  max: Vec3,
  material: string,
  edge = 0.001,
  porosity?: number,
): Part {
  const half: Vec3 = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
  if (!(half[0] > 0 && half[1] > 0 && half[2] > 0)) {
    throw new RangeError(`machine geometry: slab "${id}" has no volume`);
  }
  const radius = Math.min(edge, half[0] / 2, half[1] / 2, half[2] / 2);
  const part: Part = {
    id,
    prim: {
      kind: 'rbox',
      halfExtents: [half[0] - radius, half[1] - radius, half[2] - radius],
      radius,
    },
    pose: {
      p: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
      q: QUAT_IDENTITY,
    },
    material,
  };
  return porosity === undefined || porosity === 0 ? part : { ...part, porosity };
}

/** The rotation that takes +z to the unit vector `axis`. */
export function zTo(axis: Vec3): Quat {
  return quatFromTo([0, 0, 1], axis);
}

/**
 * A solid disc of the given outer radius and thickness with a rounded edge, centred on
 * `centre`, its axis along the unit vector `axis`.
 */
export function puckPart(
  id: string,
  centre: Vec3,
  axis: Vec3,
  radius: number,
  thickness: number,
  material: string,
): Part {
  const t = Math.min(thickness, 2 * radius * 0.999);
  const profile: SorProfilePoint[] = [
    { r: 0, z: 0, t },
    { r: radius - t / 2, z: 0, t },
  ];
  return { id, prim: { kind: 'sor', profile }, pose: { p: centre, q: zTo(axis) }, material };
}

/**
 * An upright tube open at both ends: wall thickness `wall` about the mid-surface radius
 * `radius`, from `z0` to `z1` on the vertical axis through (`x`, `y`). With `floor` true the
 * lower end is closed by a disc.
 */
export function tubePart(
  id: string,
  x: number,
  y: number,
  radius: number,
  z0: number,
  z1: number,
  wall: number,
  material: string,
  options: { readonly floor?: boolean; readonly porosity?: number } = {},
): Part {
  const profile: SorProfilePoint[] = [
    ...(options.floor === true ? [{ r: 0, z: z0, t: wall }] : []),
    { r: radius, z: z0, t: wall },
    { r: radius, z: z1, t: wall },
  ];
  const part: Part = {
    id,
    prim: { kind: 'sor', profile },
    pose: { p: [x, y, 0], q: QUAT_IDENTITY },
    material,
  };
  return options.porosity === undefined || options.porosity === 0
    ? part
    : { ...part, porosity: options.porosity };
}

/** The pose that turns by `angle` radians about the axis through `point` along the unit `axis`. */
export function rotationAbout(point: Vec3, axis: Vec3, angle: number): Pose {
  const q = quatFromAxisAngle(axis, angle);
  return { p: v3Sub(point, quatRotate(q, point)), q };
}

/** The parts moved rigidly by `move` (a pose in the frame of the shape). */
export function moveParts(parts: readonly Part[], move: Pose): Part[] {
  return parts.map((part) => ({ ...part, pose: poseCompose(move, part.pose) }));
}

/** A shape of the given parts with one region per id prefix: `[regionId, partSelector]`. */
export function shapeOf(
  parts: readonly Part[],
  regions: readonly (readonly [string, string])[],
): Shape {
  const used = regions.filter(([, selector]) =>
    parts.some((part) =>
      selector.endsWith('*') ? part.id.startsWith(selector.slice(0, -1)) : part.id === selector,
    ),
  );
  return { parts, regions: used.map(([id, part]) => ({ id, part })) };
}
