/**
 * The machine as bodies of the loading world (docs/design/platform.md sections 4.4 and 5).
 *
 * `buildMachineGeometry` gives the machine as named parts; here each part that takes part in
 * loading becomes one body:
 *  - the tub, the filter, the dispenser, the feed duct and a fixed sprayer are static;
 *  - the door, with the dispenser in it, is static and stands open while the machine is loaded
 *    (its closed position is tested as a query when the load is checked);
 *  - a basket and everything it carries (fittings, tablet tray, cutlery basket, the feed of the
 *    arm under it) are kinematic bodies that travel together: a rack assembly;
 *  - the spray arms are not bodies. They are swept as query probes when the load is checked: an
 *    arm driven by water does not push the load, and one standing still at an arbitrary angle
 *    would hold up items that in the real machine hang into its path (platform.md section 5);
 *  - a floor under and in front of the machine catches what falls off the open door.
 *
 * Units: SI. Poses map a part frame to the tub frame.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { POSE_IDENTITY, canonicalJson, v3Add, v3Scale } from '@spotless/core';
import type { CollisionPiece, Shape } from '@spotless/geometry';
import { COLLISION_CHORD_ERROR, buildCollisionPieces } from '@spotless/geometry';
import type { RackId } from '@spotless/levels';
import type { MachineGeometry, MachinePart, MachineSpec } from '@spotless/machine';
import type { BodyKind } from '@spotless/physics';
import { turnedPose } from '@spotless/physics';

/** Body id of the door while it is being closed on the load during a mechanical check. */
export const DOOR_CLOSING_ID = 'door_closing';
/** Body id of the floor in front of and under the machine. */
export const KITCHEN_FLOOR_ID = 'kitchen_floor';
/** Height of the kitchen floor in the tub frame, metres [ESTIMATED: a plinth of about 0.1 m]. */
export const KITCHEN_FLOOR_Z = -0.1;
/** Material of the kitchen floor (any hard surface; nothing is scored on it). */
export const KITCHEN_FLOOR_MATERIAL = 'stainless_steel';

/** One body the machine contributes to the loading world. */
export interface MachineBody {
  readonly id: string;
  readonly part: MachinePart;
  readonly pieces: readonly CollisionPiece[];
  readonly kind: BodyKind;
  /** Id of the basket whose assembly the body belongs to, or null for a fixed body. */
  readonly basketId: string | null;
  /** Pose with the basket pushed in (for a fixed body: its pose). */
  readonly poseIn: Pose;
  /** Canonical text of the part's shape: equal texts are the same geometry. */
  readonly shapeKey: string;
}

/** A basket with everything that travels with it. */
export interface RackAssembly {
  /** Basket id of the machine specification (`lower`, `upper`). */
  readonly basketId: string;
  /** The rack frame of the basket, which is also the id of its wire body. */
  readonly rack: RackId;
  /** Ids of the kinematic bodies that travel together, the wire body first. */
  readonly bodies: readonly string[];
  /** Displacement from pushed in to pulled out, metres, tub frame. */
  readonly travel: Vec3;
  /** Plan size of the basket (x, y), metres. */
  readonly outline: readonly [number, number];
  /** Height of the basket's loading envelope above its base grid, metres. */
  readonly height: number;
}

/** A spray arm as a query probe. */
export interface ArmProbe {
  readonly id: string;
  readonly part: MachinePart;
  readonly pieces: readonly CollisionPiece[];
  /** Id of the basket the arm hangs under, or null for an arm fixed to the tub. */
  readonly basketId: string | null;
}

/** The machine in one configuration, ready for the loading world. */
export interface MachineScene {
  readonly geometry: MachineGeometry;
  /** Bodies in the order of the geometry's parts. */
  readonly bodies: readonly MachineBody[];
  readonly assemblies: readonly RackAssembly[];
  readonly arms: readonly ArmProbe[];
  /** The door's pieces, material and closed pose, for the door-closing test. */
  readonly door: {
    readonly pieces: readonly CollisionPiece[];
    readonly closed: Pose;
    readonly material: string;
  } | null;
}

const pieceCache = new WeakMap<Shape, readonly CollisionPiece[]>();

/** Collision pieces of a shape at the platform's chord error, cached per shape object. */
export function collisionPiecesOf(shape: Shape): readonly CollisionPiece[] {
  let pieces = pieceCache.get(shape);
  if (pieces === undefined) {
    pieces = buildCollisionPieces(shape, { chordError: COLLISION_CHORD_ERROR });
    pieceCache.set(shape, pieces);
  }
  return pieces;
}

/** Id of the basket a part travels with, or null. */
function basketOfPart(geometry: MachineGeometry, part: MachinePart): string | null {
  if (part.carriedBy !== null) return part.carriedBy;
  if (part.component !== 'basket_wires') return null;
  return geometry.affordances.baskets.find((b) => b.frame === part.frame)?.basketId ?? null;
}

/**
 * The open position of a part of the door (the door itself, or the dispenser mounted in it):
 * turned about the door's hinge to the end of its range. Both are written in the tub frame.
 */
function openDoorPose(part: MachinePart, door: MachinePart): Pose {
  if (door.motion.kind !== 'revolute' || door.motion.range === null) return part.pose;
  return turnedPose(
    part.pose,
    { point: door.motion.point, axis: door.motion.axis },
    door.motion.sense * door.motion.range[1],
  );
}

/** The bodies, rack assemblies and arm probes of a machine geometry. */
export function buildMachineScene(spec: MachineSpec, geometry: MachineGeometry): MachineScene {
  const bodies: MachineBody[] = [];
  const arms: ArmProbe[] = [];
  let door: MachineScene['door'] = null;
  const doorPart = geometry.parts.find((part) => part.component === 'door');
  for (const part of geometry.parts) {
    const pieces = collisionPiecesOf(part.shape);
    const basketId = basketOfPart(geometry, part);
    if (part.role === 'arm') {
      arms.push({ id: part.id, part, pieces, basketId });
      continue;
    }
    const isDoor = part.component === 'door';
    if (isDoor) door = { pieces, closed: part.pose, material: part.material };
    const onDoor = doorPart !== undefined && (isDoor || part.component === 'dispenser');
    bodies.push({
      id: part.id,
      part,
      pieces,
      kind: basketId === null ? 'static' : 'kinematic',
      basketId,
      poseIn: onDoor ? openDoorPose(part, doorPart) : part.pose,
      shapeKey: canonicalJson(part.shape),
    });
  }
  const assemblies: RackAssembly[] = [];
  for (const envelope of geometry.affordances.baskets) {
    const basket = spec.baskets.find((b) => b.id === envelope.basketId);
    if (basket === undefined) continue;
    const members = bodies.filter((b) => b.basketId === envelope.basketId).map((b) => b.id);
    const wires = envelope.frame;
    assemblies.push({
      basketId: envelope.basketId,
      rack: envelope.frame,
      bodies: [wires, ...members.filter((id) => id !== wires)],
      travel: v3Scale(envelope.travel.direction, envelope.travel.distance),
      outline: [basket.outline.size[0], basket.outline.size[1]],
      height: envelope.interior.max[2],
    });
  }
  return { geometry, bodies, assemblies, arms, door };
}

/** A pose moved by a displacement. */
export function poseShifted(pose: Pose, by: Vec3): Pose {
  return { p: v3Add(pose.p, by), q: pose.q };
}

/** Half the side of the square kitchen floor, metres. */
export const KITCHEN_FLOOR_HALF_SIZE = 50;

/**
 * The kitchen floor: one slab whose top is at {@link KITCHEN_FLOOR_Z}, far larger than anything
 * can roll in the ten seconds a settle may last, so that nothing ever falls past its edge. (An
 * item that reaches the floor goes back to the counter as soon as the action ends.)
 */
export function kitchenFloorPieces(): { pieces: CollisionPiece[]; pose: Pose } {
  const thickness = 0.05;
  return {
    pieces: [
      {
        kind: 'box',
        part: 'floor',
        halfExtents: [KITCHEN_FLOOR_HALF_SIZE, KITCHEN_FLOOR_HALF_SIZE, thickness / 2 - 0.001],
        radius: 0.001,
        pose: { p: [0, -0.5, KITCHEN_FLOOR_Z - thickness / 2], q: [0, 0, 0, 1] },
      },
    ],
    pose: POSE_IDENTITY,
  };
}

/** An axis-aligned box as one collision piece (tub frame), for swept-volume tests. */
export function boxPiece(min: Vec3, max: Vec3, part: string): CollisionPiece {
  const radius = 0.0005;
  return {
    kind: 'box',
    part,
    halfExtents: [
      Math.max((max[0] - min[0]) / 2 - radius, radius),
      Math.max((max[1] - min[1]) / 2 - radius, radius),
      Math.max((max[2] - min[2]) / 2 - radius, radius),
    ],
    radius,
    pose: {
      p: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
      q: [0, 0, 0, 1],
    },
  };
}

/**
 * How a contact with a machine body is named for players: the body and the group of the part,
 * for example `lower_rack.tine_row_r1`, `lower_rack.rim`, `cutlery_basket.foot.0.floor`.
 * Trailing numbers (the index of a wire or a tine) are dropped.
 */
export function machineContactName(bodyId: string, part: string): string {
  const segments = part.split('.');
  if (segments[0] === 'row' && segments[1] !== undefined)
    return `${bodyId}.tine_row_${segments[1]}`;
  while (segments.length > 1 && /^\d+$/.test(segments[segments.length - 1] as string))
    segments.pop();
  const group = segments.join('.');
  return /^\d+$/.test(group) || group === '' ? bodyId : `${bodyId}.${group}`;
}
