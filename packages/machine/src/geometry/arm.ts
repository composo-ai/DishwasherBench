/**
 * Spray arms as kinematic shapes about their axes, with hub, stem and feed.
 *
 * Arm frame `arm:<level id>`: origin on the rotation axis in the plane of the top face of the
 * blades, +x along the "+" blade, +z up; metres. At arm angle 0 its axes are parallel to the
 * tub frame, and at arm angle phi the frame is turned by phi about +z (the angle convention of
 * `kinematics.ts`: the azimuth of the "+" blade from +x towards +y, whatever the rotation
 * sense). A nozzle of radius R on the "+" blade is therefore at (R, 0) in this frame and one on
 * the "-" blade at (-R, 0), which is where `nozzleState` puts them.
 *
 * Simplifications: a blade is a straight tapered bar on the radial line through its nozzles
 * (the S-shape and bow of the real blades, a few millimetres, are not drawn; the tip sweep of
 * the specification is not applied, because the nozzle table places every nozzle on the radial
 * line); nozzle rings and hoods are bosses from the blade face to the nozzle exit plane.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { quatFromAxisAngle } from '@spotless/core';
import type { Part, Shape } from '@spotless/geometry';
import { sprayLevelDatumZ } from '../config.ts';
import type { MachineConfig, MachineSpec, SprayArmSpec } from '../types.ts';
import { floorRiseAt } from '../outline.ts';
import { ARM_EDGE_RADIUS, ARM_FEED_CLEARANCE, NOZZLE_BOSS_RADIUS } from './assumptions.ts';
import { puckPart, shapeOf, tubePart } from './prims.ts';
import type { SweptRing } from './types.ts';
import { capsulePart } from './wire.ts';

/** Material of the spray arms and their feeds (marked >PP-TD20< on the Bosch). */
const ARM_MATERIAL = 'polypropylene';

/** How far the root of a nozzle boss reaches into the blade beyond its own radius, metres. */
const BOSS_ROOT = 0.002;

/** Width of a blade when the specification gives none, metres. */
const DEFAULT_BLADE_WIDTH = 0.03;

/** Tub-frame z of the origin of an arm's frame: the top face of its blades. */
export function armFrameZ(spec: MachineSpec, arm: SprayArmSpec, config: MachineConfig): number {
  return sprayLevelDatumZ(spec, arm, config.basketHeights) + arm.topFaceZ;
}

/** Pose of an arm's frame in the tub frame at arm angle `angle` (radians, see the file comment). */
export function armPoseAt(
  spec: MachineSpec,
  arm: SprayArmSpec,
  config: MachineConfig,
  angle: number,
): Pose {
  return {
    p: [arm.axis[0], arm.axis[1], armFrameZ(spec, arm, config)],
    q: quatFromAxisAngle([0, 0, 1], angle),
  };
}

/** Azimuth of blade `k` of `blades` in the arm frame: the "+" blade is blade 0. */
function bladeAzimuth(k: number, blades: number): number {
  return (2 * Math.PI * k) / blades;
}

/** A spray arm in its own frame, with the rings it sweeps (heights in the arm frame). */
export interface ArmBuild {
  readonly shape: Shape;
  /** Rings swept in one turn; `zMin` and `zMax` are in the arm frame here. */
  readonly rings: readonly SweptRing[];
}

/**
 * The arm as a shape in its own frame: blades, hub, stem (for an arm standing on the tub floor
 * or hanging from the roof) and one boss per nozzle.
 */
export function buildSprayArm(spec: MachineSpec, arm: SprayArmSpec): ArmBuild {
  const parts: Part[] = [];
  const e = Math.min(ARM_EDGE_RADIUS, arm.shape.bladeThickness / 2 - 1e-4);
  const top = 0;
  const under = arm.bladeUndersideZ - arm.topFaceZ;
  const [widthHub, widthTip] = arm.shape.bladeWidth ?? [DEFAULT_BLADE_WIDTH, DEFAULT_BLADE_WIDTH];
  const hubRadius = (arm.shape.hubDiameter ?? widthHub) / 2;
  const blades = Math.max(1, arm.shape.blades);

  let bladeRadius = 0;
  for (let k = 0; k < blades; k++) {
    const az = bladeAzimuth(k, blades);
    const c = Math.cos(az);
    const s = Math.sin(az);
    const points: Vec3[] = [];
    const tipX = arm.tipRadius - e;
    for (const [r, half] of [
      [0, widthHub / 2 - e],
      [tipX, widthTip / 2 - e],
    ] as const) {
      for (const side of [-1, 1]) {
        for (const z of [top - e, under + e]) {
          points.push([r * c - side * half * s, r * s + side * half * c, z]);
        }
      }
    }
    bladeRadius = Math.max(bladeRadius, Math.hypot(tipX, widthTip / 2 - e) + e);
    parts.push({
      id: `blade.${k}`,
      prim: { kind: 'hull', points, radius: e },
      pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
      material: ARM_MATERIAL,
    });
  }

  // Hub: from the lowest point of the arm up by the hub's height.
  const hubBottom = arm.hubUndersideZ - arm.topFaceZ;
  const hubHeight = arm.shape.hubHeight ?? top - hubBottom;
  const hubTop = Math.max(hubBottom + hubHeight, hubBottom + 1e-3);
  parts.push(
    puckPart(
      'hub',
      [0, 0, (hubBottom + hubTop) / 2],
      [0, 0, 1],
      hubRadius,
      hubTop - hubBottom,
      ARM_MATERIAL,
    ),
  );

  const rings: SweptRing[] = [];
  // Stem of an arm fixed to the tub: down to the floor, or up to the roof for a hanging arm.
  let stem: { r: number; z0: number; z1: number } | null = null;
  if (arm.mount.kind === 'tub' && arm.shape.stemDiameter !== null) {
    const r = arm.shape.stemDiameter / 2;
    const wall = Math.max(
      0.0015,
      Math.min(r * 0.6, (arm.shape.stemDiameter - arm.bearing.hubBore) / 2),
    );
    const midHeight = (spec.tub.z[0] + spec.tub.z[1]) / 2;
    const standing = arm.topFaceZ < midHeight;
    stem = standing
      ? { r, z0: spec.tub.z[0] - arm.topFaceZ, z1: hubBottom }
      : { r, z0: hubTop, z1: spec.tub.z[1] - arm.topFaceZ };
    if (stem.z1 - stem.z0 > wall + 1e-3) {
      // The ends of a tube are rounded by half its wall: the mid-surface stops that far short.
      parts.push(
        tubePart(
          'stem',
          0,
          0,
          r - wall / 2,
          stem.z0 + wall / 2,
          stem.z1 - wall / 2,
          wall,
          ARM_MATERIAL,
        ),
      );
    } else {
      stem = null;
    }
  }

  // Nozzle bosses, from inside the blade to the nozzle exit plane.
  let nozzleTop = top;
  let nozzleBottom = under;
  let nozzleRadius = 0;
  const boss = NOZZLE_BOSS_RADIUS;
  for (const nozzle of arm.nozzles) {
    const az = nozzle.blade === '-' ? Math.PI : 0;
    const r = nozzle.blade === 'axis' ? 0 : nozzle.radius;
    const x = r * Math.cos(az);
    const y = r * Math.sin(az);
    if (nozzle.face === 'top') {
      const exit = (arm.nozzleUpZ ?? arm.topFaceZ) - arm.topFaceZ;
      parts.push(
        capsulePart(
          `nozzle.${nozzle.id}`,
          [x, y, Math.min(top, exit) - boss - BOSS_ROOT],
          [x, y, exit - boss],
          boss,
          ARM_MATERIAL,
        ),
      );
      nozzleTop = Math.max(nozzleTop, exit);
    } else {
      const exit = (arm.nozzleDownZ ?? arm.bladeUndersideZ) - arm.topFaceZ;
      parts.push(
        capsulePart(
          `nozzle.${nozzle.id}`,
          [x, y, Math.max(under, exit) + boss + BOSS_ROOT],
          [x, y, exit + boss],
          boss,
          ARM_MATERIAL,
        ),
      );
      nozzleBottom = Math.min(nozzleBottom, exit);
    }
    nozzleRadius = Math.max(nozzleRadius, r + boss);
  }

  rings.push({
    id: 'blades',
    rMin: 0,
    rMax: Math.max(bladeRadius, nozzleRadius),
    zMin: nozzleBottom,
    zMax: nozzleTop,
  });
  rings.push({ id: 'hub', rMin: 0, rMax: hubRadius, zMin: hubBottom, zMax: hubTop });
  if (stem !== null)
    rings.push({ id: 'stem', rMin: 0, rMax: stem.r, zMin: stem.z0, zMax: stem.z1 });

  return {
    shape: shapeOf(parts, [
      ['nozzles', 'nozzle.*'],
      ['blades', 'blade.*'],
      ['hub', 'hub'],
      ['stem', 'stem'],
    ]),
    rings,
  };
}

/**
 * The feed of a basket-mounted arm, in the rack frame of the basket that carries it: the tube
 * from above the hub to the back of the basket, clipped at the docking block of the feed duct.
 * The elbow into the hub is not drawn: it is the arm's bearing. Null for an arm without a feed
 * tube.
 *
 * The tube is drawn just above the arm, `ARM_FEED_CLEARANCE` above its nozzle exit plane, under
 * the floor wires that pass over it (on a floor with a relief these are the wires of the ridge
 * the tube runs under). Where the room between the nozzle plane and those wires is less than
 * the tube's diameter the tube is drawn thinner, so that it enters neither; `squeezed` then
 * says by how much the diameter was reduced.
 */
export function buildArmFeed(
  spec: MachineSpec,
  arm: SprayArmSpec,
): { readonly shape: Shape; readonly diameter: number; readonly squeezed: number } | null {
  if (arm.feedTube === null || arm.mount.kind !== 'basket') return null;
  const carrier = arm.mount.basketId;
  const basket = spec.baskets.find((b) => b.id === carrier);
  if (basket === undefined) return null;
  const floorRadius = basket.wires.floor.coated / 2;
  // Rack-frame plan position of the axis.
  const ax = arm.axis[0] - basket.pose.originXY[0];
  const ay = arm.axis[1] - basket.pose.originXY[1];
  // The underside of the floor wires over the strip the tube runs in (it runs along y at x =
  // ax): the wires along x at their lowest across the strip, and any wire along y inside it.
  const half = arm.feedTube.diameter / 2;
  const across = [ax - half, ax, ax + half];
  if (basket.floor.relief?.axis === 'x') {
    for (const p of basket.floor.relief.points) {
      if (p.at > ax - half && p.at < ax + half) across.push(p.at);
    }
  }
  let floorUnderside =
    basket.floor.alongX.z + Math.min(...across.map((x) => floorRiseAt(basket.floor, x, ay)));
  for (const x of basket.floor.alongY.positions) {
    if (Math.abs(x - ax) < half + floorRadius) {
      floorUnderside = Math.min(
        floorUnderside,
        basket.floor.alongY.z + floorRiseAt(basket.floor, x, ay),
      );
    }
  }
  floorUnderside -= floorRadius;
  const nozzlePlane = arm.nozzleUpZ ?? arm.topFaceZ;
  const bottom = nozzlePlane + ARM_FEED_CLEARANCE;
  const room = floorUnderside - bottom;
  const diameter = Math.max(0.004, Math.min(arm.feedTube.diameter, room));
  const radius = diameter / 2;
  const z = bottom + radius;
  let endY = ay + arm.feedTube.length;
  if (spec.feedDuct !== null) {
    const dock = spec.tub.y[1] - spec.feedDuct.portBlockProud - basket.pose.originXY[1];
    endY = Math.min(endY, dock - radius);
  }
  const parts: Part[] = [
    capsulePart('tube', [ax, ay, z], [ax, Math.max(endY, ay), z], radius, ARM_MATERIAL),
  ];
  return {
    shape: shapeOf(parts, [['feed', 'tube']]),
    diameter,
    squeezed: arm.feedTube.diameter - diameter,
  };
}
