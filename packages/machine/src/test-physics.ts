/**
 * Catalogue items let down into the machine's baskets in the loading physics: the experiments
 * behind the plate rows and the cutlery basket, for this package's tests and scripts.
 *
 * NOT exported from the package entry point, and for tests and scripts only. It needs the
 * loading physics and the catalogue, which both stand above this package in the workspace:
 * `@spotless/physics` depends on `@spotless/machine`. Naming them as (development) dependencies
 * would close a cycle in the workspace graph, which `sim-verify`'s dependency test forbids, so
 * they are imported here by path, from source, and from nowhere else in this package. The
 * tests that use this file (`geometry/plate-rows.test.ts`, `geometry/cutlery-basket.test.ts`)
 * are integration tests of machine, catalogue and physics that are kept beside the geometry
 * they judge; their natural home is `@spotless/integration`.
 *
 * Units: SI. Frames: the tub frame of the machine geometry, baskets pushed in.
 */

import type { ItemInstance } from '../../catalogue/src/index.ts';
import { contactPairLookup, instantiate } from '../../catalogue/src/index.ts';
import type { Pose, Quat, Vec3 } from '@spotless/core';
import { poseTransformPoint, quatFromTo, quatRotate, v3Add } from '@spotless/core';
import type { CollisionPiece, Shape } from '@spotless/geometry';
import { COLLISION_CHORD_ERROR, boundingBox, buildCollisionPieces } from '@spotless/geometry';
import type { Contact, JoltPhysicsWorld } from '../../physics/src/index.ts';
import {
  LOADING_GRAVITY,
  LOADING_TIME_STEP,
  NO_MASS,
  createPhysicsWorld,
  settleOptionsFor,
} from '../../physics/src/index.ts';
import type { MachineGeometry, TineRowAffordance } from './geometry/types.ts';

const pieceCache = new WeakMap<Shape, readonly CollisionPiece[]>();

/** Collision pieces of a shape at the platform's chord error, cached per shape object. */
export function piecesOf(shape: Shape): readonly CollisionPiece[] {
  let pieces = pieceCache.get(shape);
  if (pieces === undefined) {
    pieces = buildCollisionPieces(shape, { chordError: COLLISION_CHORD_ERROR });
    pieceCache.set(shape, pieces);
  }
  return pieces;
}

/**
 * A loading world holding the parts of a machine geometry whose ids pass `keep` (default: the
 * baskets and what they carry), as static bodies in their reference poses. Dry friction from
 * the catalogue's pair table, as while loading.
 */
export async function machineWorld(
  geometry: MachineGeometry,
  keep: (partId: string) => boolean = (id) => /rack|cutlery_basket/.test(id),
): Promise<JoltPhysicsWorld> {
  const world = await createPhysicsWorld({
    timeStep: LOADING_TIME_STEP,
    gravity: LOADING_GRAVITY,
    pairLookup: contactPairLookup(false),
  });
  for (const part of geometry.parts) {
    if (part.role === 'arm' || !keep(part.id)) continue;
    world.addBody(
      part.id,
      piecesOf(part.shape),
      NO_MASS,
      { material: part.material },
      part.pose,
      'static',
    );
  }
  return world;
}

/** Outcome of {@link releaseItem}. */
export interface ReleasedItem {
  /** Whether the world came to rest within the settle budget. */
  readonly atRest: boolean;
  /** The pose it rests at (item frame to tub frame). */
  readonly pose: Pose;
  /** Its lowest and highest point at rest, tub-frame z, metres. */
  readonly bottomZ: number;
  readonly topZ: number;
  /** Its contacts at rest. */
  readonly contacts: readonly Contact[];
}

/**
 * Adds an item to a world at a pose, at rest, and settles the world with the platform's settle
 * budget: an item let go by a hand.
 */
export function releaseItem(
  world: JoltPhysicsWorld,
  id: string,
  instance: ItemInstance,
  pose: Pose,
): ReleasedItem {
  world.addBody(id, piecesOf(instance.shape), instance.mass, instance.contact, pose, 'dynamic');
  const settled = world.settle(settleOptionsFor(world.timeStep));
  const rest = world.getPose(id);
  const box = boundingBox(instance.shape, rest);
  return {
    atRest: settled.atRest,
    pose: rest,
    bottomZ: box.min[2],
    topZ: box.max[2],
    contacts: world.contacts({ bodies: [id] }),
  };
}

/** Outcome of {@link seatPlateByHand}. */
export interface SeatedPlate {
  /** Whether the world came to rest within the settle budget. */
  readonly atRest: boolean;
  /**
   * Lean of the plate at rest, degrees from the vertical: positive when its top has gone the
   * way the tines of the slot lean (it lies back on the tine behind it, eating face tipped up),
   * negative when it has tipped the other way, onto the tine in front of its face.
   */
  readonly leanDeg: number;
  /** The lean it was let go at, same sign. */
  readonly startLeanDeg: number;
  /**
   * True when the hand could put its lower edge down on the rails between the two tines; false
   * when the plate is too deep for the gap at every lean and was let down from above it.
   */
  readonly reachedRails: boolean;
  /** How far its axis has turned out of the plane across the rail, degrees (0: square in the slot). */
  readonly yawDeg: number;
  /** Position of its lowest rim point along the rail relative to the slot centre, mm. */
  readonly edgeFromSlotMm: number;
  /** Height of its lowest point above the rack-frame origin (top of the base grid), mm. */
  readonly lowestMm: number;
  /** Groups of basket parts it touches at rest, sorted (`rail`, `tine`, `floor`, `wall`, `rim`). */
  readonly restsOn: readonly string[];
  /** Largest normal force of a contact over the plate's weight. */
  readonly forceOverWeight: number;
  /** The pose it rests at (item frame to tub frame). */
  readonly pose: Pose;
}

/** What a contact part of the basket wires is, for a report. */
function groupOf(part: string): string {
  if (/^row\..*\.rail/.test(part)) return 'rail';
  if (part.startsWith('row.')) return 'tine';
  if (part.startsWith('floor')) return 'floor';
  if (part.startsWith('rim')) return 'rim';
  return 'wall';
}

/** Options of {@link seatPlateByHand}. */
export interface SeatOptions {
  /** A world to use (the plate is added to it and left in it); default: a fresh one, disposed. */
  readonly world?: JoltPhysicsWorld;
  /** Id of the body; default `plate`. */
  readonly bodyId?: string;
  /**
   * Where in the gap the hand puts the lip down: `front` against the tine in front of the
   * eating face, `back` against the tine behind it; by default wherever between the two the
   * plate can be laid back furthest.
   */
  readonly lip?: 'front' | 'back';
}

/**
 * Seats a plate in a slot of a tine row the way a hand does, and lets it go.
 *
 * The hand's motion: the plate is held on edge, its eating face away from the side the tines
 * lean to, across the rail and midway to the partner row (kept clear of the basket's walls).
 * Its lower edge is put down on the rails between the two tines of the slot, and the plate is
 * laid back towards the tine behind it as far as it goes without touching, at most to the lean
 * of the tines, the edge being slid in the gap to where that is furthest. Where the plate is
 * too deep to stand upright in the gap it is held tipped forward just enough to be clear; where
 * no lean lets its edge down to the rails it is let down upright from just above. Then it is
 * let go at rest and the world is settled.
 *
 * `item` is a catalogue item type id or an item instance; it must be a body of revolution about
 * its z axis with its eating face up. Throws a RangeError for a row or slot the geometry does
 * not have.
 */
export async function seatPlateByHand(
  geometry: MachineGeometry,
  basketId: string,
  rowId: string,
  slotIndex: number,
  item: string | ItemInstance,
  options: SeatOptions = {},
): Promise<SeatedPlate> {
  const row = geometry.affordances.tineRows.find(
    (r) => r.basketId === basketId && r.rowId === rowId,
  );
  const slot = row?.slots[slotIndex];
  const envelope = geometry.affordances.baskets.find((b) => b.basketId === basketId);
  if (row === undefined || slot === undefined || envelope === undefined) {
    throw new RangeError(`seatPlateByHand: no slot ${slotIndex} in row "${basketId}.${rowId}"`);
  }
  const instance = typeof item === 'string' ? instantiate(item) : item;
  const pieces = piecesOf(instance.shape);
  const radius = instance.bbox.max[1];
  const origin = envelope.originTub;
  const own = options.world === undefined;
  const world = options.world ?? (await machineWorld(geometry, (id) => id === envelope.frame));
  const id = options.bodyId ?? 'plate';

  // `sign` is the sense along the rail in which the tines lean.
  const along: 0 | 1 = row.runs === 'x' ? 0 : 1;
  const across: 0 | 1 = along === 0 ? 1 : 0;
  const sign = slot.leanToward.startsWith('-') ? -1 : 1;
  const partner = partnerRow(geometry, row);
  // Midway to the partner row, kept 3 mm clear of the walls of the basket.
  const midway =
    partner === null
      ? (slot.centre[across] as number)
      : ((slot.centre[across] as number) + (partner.rail[0][across] as number)) / 2;
  const acrossAt = Math.min(
    Math.max(midway, (envelope.interior.min[across] as number) + radius + 0.003),
    (envelope.interior.max[across] as number) - radius - 0.003,
  );
  // The tine behind the plate is the one on the side the tines lean to.
  const tineBehind = row.tines[sign < 0 ? slotIndex : slotIndex + 1];
  const tineFront = row.tines[sign < 0 ? slotIndex + 1 : slotIndex];
  if (tineFront === undefined || tineBehind === undefined) {
    throw new RangeError(`seatPlateByHand: slot ${slotIndex} of "${rowId}" has no two tines`);
  }

  /**
   * Pose with the plate leaning back by `lean` (radians), the face of its lip at `lipAlong`
   * along the rail and its lowest rim point `lift` above the rack-frame origin. The vectors are
   * filled in by axis index, so they are built as plain arrays.
   */
  const poseAt = (lean: number, lipAlong: number, lift: number): Pose => {
    // The eating face (item +z) looks away from the side the tines lean to, tipped up.
    const facing = [0, 0, 0];
    facing[along] = -sign * Math.cos(lean);
    facing[2] = Math.sin(lean);
    const q: Quat = quatFromTo([0, 0, 1], [facing[0] ?? 0, facing[1] ?? 0, facing[2] ?? 0]);
    // In-plane up direction of the plate.
    const up = [0, 0, 0];
    up[along] = sign * Math.sin(lean);
    up[2] = Math.cos(lean);
    // The lowest point of the rim circle at the lip (item z = height, radius `radius`).
    const lipCentre = quatRotate(q, [0, 0, instance.bbox.max[2]]);
    const lowest = [0, 0, 0];
    lowest[along] = lipAlong;
    lowest[across] = acrossAt;
    lowest[2] = lift;
    const p: Vec3 = [
      origin[0] + (lowest[0] ?? 0) - lipCentre[0] + radius * (up[0] ?? 0),
      origin[1] + (lowest[1] ?? 0) - lipCentre[1] + radius * (up[1] ?? 0),
      origin[2] + (lowest[2] ?? 0) - lipCentre[2] + radius * (up[2] ?? 0),
    ];
    return { p, q };
  };

  // Where the face of the lip can go: from 1 mm short of the tine in front of it back to where
  // the lip's own thickness and 1 mm of air are left before the tine behind.
  const wire = slot.pitch - slot.clearWidth;
  const lipThickness = lipThicknessOf(instance);
  const front = (tineFront.base[along] as number) + sign * (wire / 2 + 0.001);
  const back = (tineBehind.base[along] as number) - sign * (wire / 2 + 0.001 + lipThickness);
  const room = Math.max(0, (front - back) * -sign);
  const lipPositions: number[] = [];
  if (options.lip === 'back') lipPositions.push(back);
  else if (options.lip === 'front') lipPositions.push(front);
  else for (let d = 0; d <= room + 1e-9; d += 0.001) lipPositions.push(front + sign * d);
  // Height of the lowest rim point when the plate sits on both rails: the rail top less the
  // sagitta of the rim over half the rail spacing.
  const half =
    partner === null
      ? 0
      : Math.abs((partner.rail[0][across] as number) - (slot.centre[across] as number)) / 2;
  const sagitta = half < radius ? radius - Math.sqrt(radius * radius - half * half) : 0;
  const seatZ = row.railTopZ - sagitta;

  // Lay it back as far as it goes: for each place of the lip, from the lean of the tines down
  // in half degrees, then forward, until the pose is clear of the basket; of the places, the
  // one that lets it lie back furthest, and of equals the one nearest the tine in front.
  let start: { pose: Pose; lean: number } | null = null;
  const maxLean = Math.round((Math.max(slot.lean, 0) * 180) / Math.PI);
  for (const lipAlong of lipPositions) {
    for (let deg = maxLean; deg >= -45; deg -= 0.5) {
      const lean = (deg * Math.PI) / 180;
      if (start !== null && lean <= start.lean) break;
      let found: Pose | null = null;
      for (const lift of [0.001, 0.004, 0.01]) {
        const pose = poseAt(lean, lipAlong, seatZ * Math.cos(lean) + lift);
        if (world.penetration(pieces, pose).depth <= 1e-5) {
          found = pose;
          break;
        }
      }
      if (found !== null) {
        start = { pose: found, lean };
        break;
      }
    }
  }
  // Too deep to reach the rails between these two tines at any lean: it is let down upright,
  // lip over the middle of the gap, from the lowest height at which it is clear, and wedges or
  // tips.
  const seated = start !== null;
  const middle = (front + back) / 2;
  for (let lift = 0.002; lift <= 0.12 && start === null; lift += 0.002) {
    const pose = poseAt(0, middle, seatZ + lift);
    if (world.penetration(pieces, pose).depth <= 1e-5) start = { pose, lean: 0 };
  }
  if (start === null) {
    if (own) world.dispose();
    throw new RangeError(
      `seatPlateByHand: ${instance.type.id} finds no clear pose in ${rowId}.${slotIndex}`,
    );
  }
  const released = releaseItem(world, id, instance, start.pose);
  const pose = released.pose;
  const axis = quatRotate(pose.q, [0, 0, 1]);
  // Lean: the tilt of the plate's plane from the vertical, signed by where its top has gone.
  const lean = Math.atan2(axis[2], -sign * (axis[along] as number));
  const yaw = Math.asin(Math.max(-1, Math.min(1, axis[across] as number)));
  // The lowest point of the rim circle at the lip.
  const lipCentre = poseTransformPoint(pose, [0, 0, instance.bbox.max[2]]);
  const down = lowestRimPoint(lipCentre, axis, radius);
  const weight = instance.mass.mass * Math.abs(LOADING_GRAVITY[2]);
  const result: SeatedPlate = {
    atRest: released.atRest,
    leanDeg: (lean * 180) / Math.PI,
    startLeanDeg: (start.lean * 180) / Math.PI,
    reachedRails: seated,
    yawDeg: (yaw * 180) / Math.PI,
    edgeFromSlotMm:
      ((down[along] as number) - (origin[along] as number) - (slot.centre[along] as number)) * 1000,
    lowestMm: (released.bottomZ - origin[2]) * 1000,
    restsOn: [
      ...new Set(released.contacts.map((c) => groupOf(c.a === id ? c.partB : c.partA))),
    ].sort(),
    forceOverWeight: Math.max(0, ...released.contacts.map((c) => c.normalForceN)) / weight,
    pose,
  };
  if (own) world.dispose();
  return result;
}

/** Thickness of a plate at its lip: that of the last point of its body's profile, metres. */
function lipThicknessOf(instance: ItemInstance): number {
  for (const part of instance.shape.parts) {
    if (part.prim.kind !== 'sor') continue;
    const last = part.prim.profile[part.prim.profile.length - 1];
    if (last !== undefined && last.r > instance.bbox.max[1] * 0.9) return last.t;
  }
  return 0.005;
}

/** The lowest point of a circle of the given radius about `centre` in the plane normal to `axis`. */
function lowestRimPoint(centre: Vec3, axis: Vec3, radius: number): Vec3 {
  // The in-plane direction of steepest descent: -z with its component along the axis removed.
  const d: Vec3 = [axis[2] * axis[0], axis[2] * axis[1], axis[2] * axis[2] - 1];
  const length = Math.hypot(d[0], d[1], d[2]);
  if (length < 1e-9) return centre;
  return v3Add(centre, [
    (d[0] / length) * radius,
    (d[1] / length) * radius,
    (d[2] / length) * radius,
  ]);
}

/** The partner row of a row, or null. */
function partnerRow(geometry: MachineGeometry, row: TineRowAffordance): TineRowAffordance | null {
  if (row.partner === null) return null;
  return (
    geometry.affordances.tineRows.find(
      (r) => r.basketId === row.basketId && r.rowId === row.partner?.rowId,
    ) ?? null
  );
}
