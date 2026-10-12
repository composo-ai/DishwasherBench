/**
 * Mechanics built on the loading world and used by the session (docs/design/platform.md
 * section 5): the stability probe, rack travel, the spray-arm sweep and the dispenser-lid test.
 *
 * Every function here uses only the `PhysicsWorld` contract, so it works with any implementation
 * of it. Units: SI. Poses are in the tub frame unless stated otherwise. All of them are
 * deterministic: a fixed number of steps or queries for given arguments.
 */

import type { Pose, Quat, Vec3 } from '@spotless/core';
import {
  compareIds,
  poseRelative,
  quatAngleBetween,
  quatFromAxisAngle,
  quatMul,
  quatRotate,
  v3Add,
  v3Cross,
  v3Distance,
  v3Dot,
  v3Length,
  v3Normalise,
  v3Sub,
} from '@spotless/core';
import type { Aabb, CollisionPiece } from '@spotless/geometry';
import { settleOptionsFor } from './settings.ts';
import type {
  ArmSweepResult,
  BodyMotion,
  LidSweepResult,
  PhysicsWorld,
  RackTravelResult,
  SettleOptions,
  StabilityProbeResult,
} from './types.ts';
import { RACK_TRAVEL_PROFILE, STABILITY_PROBE } from './types.ts';

/** Distance beyond which a body counts as moved by a rack travel, metres (platform.md 5). */
export const MOVED_DISTANCE = 0.001;
/** Rotation beyond which a body counts as moved by a rack travel, radians (1 degree). */
export const MOVED_ANGLE = Math.PI / 180;
/**
 * Force along the direction of travel with which something that does not travel with the rack
 * must hold a body back for the rack to count as blocked, newtons. [ESTIMATED] the hand-force
 * limit of docs/research/items.md section 13 (insert force limit 15 N); calibrate on a real rack.
 */
export const RACK_BLOCK_FORCE = 15;
/** Number of consecutive steps the blocking force must persist (about 20 ms at 1/240 s). */
export const RACK_BLOCK_STEPS = 5;
/**
 * Distance a blocked rack advances per step while it closes up to the obstacle again, metres:
 * 0.1 mm, the penetration slop of the loading world, so that it ends within that of where the
 * resistance begins.
 */
export const RACK_CLOSE_UP_STEP = 0.0001;
/**
 * Force against the direction of travel at which a rack that is closing up to its obstacle
 * stops, newtons: any resistance at all. At 0.1 mm per step the rack moves at 24 mm/s, and a
 * body pinned at that speed is held with its mass times that speed over one step, 0.17 N for a
 * 30 g teaspoon; the 15 N of {@link RACK_BLOCK_FORCE} belong to a rack at full speed.
 */
export const RACK_CLOSE_UP_FORCE = 0.01;
/** Distance the tip of a spray arm travels between two samples of its sweep, metres. */
export const ARM_SWEEP_ARC_STEP = 0.001;
/** Resolution to which the first contact angle of an arm is refined, radians (0.01 degree). */
export const ARM_SWEEP_ANGLE_RESOLUTION = Math.PI / 18000;

/** How far a body moved between two poses: distance of its origin and angle of the rotation. */
export function bodyMotion(id: string, before: Pose, after: Pose): BodyMotion {
  return {
    id,
    displacement: v3Distance(before.p, after.p),
    rotation: quatAngleBetween(before.q, after.q),
  };
}

// ---------------------------------------------------------------------------------------------
// Stability probe
// ---------------------------------------------------------------------------------------------

/** A dynamic body to be kicked by the stability probe. */
export interface ProbeBody {
  readonly id: string;
  /** Mass of the body, kilograms (the kick is a velocity, the world takes an impulse). */
  readonly mass: number;
}

/** Parameters of the stability probe; see {@link STABILITY_PROBE} for their meaning. */
export interface StabilityProbeParameters {
  readonly kickSpeed: number;
  readonly directions: number;
  readonly settleTime: number;
  readonly positionTolerance: number;
  readonly angleTolerance: number;
}

/** Arguments of {@link probeStability}. */
export interface StabilityProbeOptions {
  /** The bodies to kick (normally the item just placed and what it rests against). */
  readonly bodies: readonly ProbeBody[];
  /** Further bodies whose return is checked although they are not kicked. */
  readonly watch?: readonly string[];
  /** Probe parameters; defaults to {@link STABILITY_PROBE}. */
  readonly probe?: StabilityProbeParameters;
}

/**
 * Stability probe (platform.md section 5, docs/research/items.md section 5.6): the listed bodies
 * are given a horizontal velocity of `kickSpeed` in `directions` directions in turn (the first
 * along +x, the others at equal angles about +z), each time from the same starting state, and
 * the world is simulated for `settleTime` (rounded to whole steps of the world's time step). A
 * body is unstable when, after any of the kicks, it ends more than `positionTolerance` or
 * `angleTolerance` from where it started. The world is left exactly as it was found.
 */
export function probeStability(
  world: PhysicsWorld,
  options: StabilityProbeOptions,
): StabilityProbeResult {
  const probe = options.probe ?? STABILITY_PROBE;
  if (!Number.isInteger(probe.directions) || probe.directions < 1) {
    throw new Error('physics: the probe needs a positive whole number of directions');
  }
  const watched = new Set<string>();
  for (const body of options.bodies) {
    if (!(body.mass > 0)) throw new Error(`physics: probe body '${body.id}' needs its mass`);
    watched.add(body.id);
  }
  for (const id of options.watch ?? []) watched.add(id);
  const ids = [...watched].sort(compareIds);
  const kicked = [...options.bodies].sort((a, b) => compareIds(a.id, b.id));
  const steps = Math.max(1, Math.round(probe.settleTime / world.timeStep));

  const start = world.snapshot();
  const before = new Map<string, Pose>();
  for (const id of ids) before.set(id, world.getPose(id));
  const worst = new Map<string, { displacement: number; rotation: number }>();
  for (let k = 0; k < probe.directions; k++) {
    if (k > 0) world.restore(start);
    const angle = (2 * Math.PI * k) / probe.directions;
    const direction: Vec3 = [Math.cos(angle), Math.sin(angle), 0];
    for (const body of kicked) {
      const impulse = body.mass * probe.kickSpeed;
      world.applyImpulse(body.id, [
        direction[0] * impulse,
        direction[1] * impulse,
        direction[2] * impulse,
      ]);
    }
    world.step(steps);
    for (const id of ids) {
      const motion = bodyMotion(id, before.get(id) as Pose, world.getPose(id));
      const seen = worst.get(id);
      worst.set(id, {
        displacement: Math.max(seen?.displacement ?? 0, motion.displacement),
        rotation: Math.max(seen?.rotation ?? 0, motion.rotation),
      });
    }
  }
  world.restore(start);

  const unstable: BodyMotion[] = [];
  for (const id of ids) {
    const motion = worst.get(id) as { displacement: number; rotation: number };
    if (motion.displacement > probe.positionTolerance || motion.rotation > probe.angleTolerance) {
      unstable.push({ id, displacement: motion.displacement, rotation: motion.rotation });
    }
  }
  return { stable: unstable.length === 0, unstable };
}

// ---------------------------------------------------------------------------------------------
// Rack travel
// ---------------------------------------------------------------------------------------------

/** Motion profile of a rack; see {@link RACK_TRAVEL_PROFILE}. */
export interface RackProfile {
  /** Speed the rack reaches, m/s. */
  readonly peakSpeed: number;
  /** Acceleration from rest, m/s^2. */
  readonly acceleration: number;
  /** Deceleration at the end stop, m/s^2. */
  readonly endStopDeceleration: number;
}

/**
 * Distance travelled by a rack at the end of each fixed step of a travel of `distance` metres:
 * constant acceleration from rest to the peak speed, constant speed, and constant deceleration
 * to rest at the end stop (a shorter travel never reaches the peak speed). The last entry is
 * exactly `distance`; the list is empty when there is nothing to travel.
 */
export function rackTravelDistances(
  distance: number,
  profile: RackProfile,
  timeStep: number,
): number[] {
  if (!(distance >= 0) || !Number.isFinite(distance)) {
    throw new Error(`physics: invalid rack travel distance ${distance}`);
  }
  if (!(timeStep > 0)) throw new Error('physics: the rack travel needs the time step');
  const { acceleration: a, endStopDeceleration: d } = profile;
  if (!(a > 0) || !(d > 0) || !(profile.peakSpeed > 0)) {
    throw new Error('physics: the rack profile needs positive speed and accelerations');
  }
  if (distance === 0) return [];
  // The speed reached when accelerating and braking meet without a stretch at constant speed.
  const peak = Math.min(profile.peakSpeed, Math.sqrt((2 * distance * a * d) / (a + d)));
  const tUp = peak / a;
  const tDown = peak / d;
  const sUp = (peak * peak) / (2 * a);
  const sDown = (peak * peak) / (2 * d);
  const tCruise = Math.max(0, distance - sUp - sDown) / peak;
  const total = tUp + tCruise + tDown;
  const at = (t: number): number => {
    if (t <= tUp) return 0.5 * a * t * t;
    if (t <= tUp + tCruise) return sUp + peak * (t - tUp);
    const left = Math.max(0, total - t);
    return distance - 0.5 * d * left * left;
  };
  const steps = Math.max(1, Math.ceil(total / timeStep - 1e-9));
  const out: number[] = [];
  for (let k = 1; k < steps; k++) out.push(Math.min(distance, at(k * timeStep)));
  out.push(distance);
  return out;
}

/** A body riding on a rack. */
export interface Rider {
  readonly id: string;
  /**
   * Point of the body, in its item frame, that must stay inside the rack envelope (the item's
   * reference point); defaults to the item-frame origin.
   */
  readonly point?: Vec3;
}

/** Arguments of {@link travelRack}. */
export interface RackTravelOptions {
  /**
   * The kinematic bodies that travel together: the rack first, then whatever is fixed to it
   * (a cutlery basket, a cup shelf).
   */
  readonly racks: readonly string[];
  /** Displacement of the rack over the whole travel, metres, tub frame. */
  readonly travel: Vec3;
  /** The dynamic bodies loaded on the rack. */
  readonly riders: readonly Rider[];
  /**
   * The rack envelope in the frame of the first rack body, metres. A rider whose point is
   * outside it after the travel fell out. Without an envelope nothing is reported as fallen.
   */
  readonly envelope?: Aabb;
  /** Motion profile; defaults to {@link RACK_TRAVEL_PROFILE}. */
  readonly profile?: RackProfile;
  /** How the load settles afterwards; defaults to `settleOptionsFor(world.timeStep)`. */
  readonly settle?: SettleOptions;
  /** See {@link RACK_BLOCK_FORCE}. */
  readonly blockForce?: number;
  /** See {@link RACK_BLOCK_STEPS}. */
  readonly blockSteps?: number;
}

function poseOffset(pose: Pose, by: Vec3): Pose {
  return { p: v3Add(pose.p, by), q: pose.q };
}

function insideAabb(p: Vec3, box: Aabb): boolean {
  return (
    p[0] >= box.min[0] &&
    p[0] <= box.max[0] &&
    p[1] >= box.min[1] &&
    p[1] <= box.max[1] &&
    p[2] >= box.min[2] &&
    p[2] <= box.max[2]
  );
}

/**
 * Rack travel (platform.md section 5, docs/research/benchmark.md section 4.7): the rack bodies,
 * which must have been added as `'kinematic'` bodies (a static or a dynamic rack would be
 * teleported, leaving its load behind; the function throws for one), are driven
 * along `travel` with the given motion profile, so that their contents
 * are carried by contact and friction and feel the acceleration at the start and the jolt of
 * the end stop; then the load settles. The travel stops early when something that does not
 * travel with the rack holds a body back with more than `blockForce` for `blockSteps` steps in
 * a row; the world is then put back to the step in which that resistance began, the rack
 * returns to where it was before that step and closes up again {@link RACK_CLOSE_UP_STEP} at a
 * time until the resistance is back, so that it stops where it met the obstacle with nothing
 * pressed into anything.
 *
 * Reports the riders that ended more than 1 mm or 1 degree from where they started relative to
 * the rack, the riders that left the envelope, and what blocked the rack: the rider that was
 * held back or, when the rack itself ran into something, that body. The world is left as the
 * travel leaves it: take a snapshot first if it is only a check.
 */
export function travelRack(world: PhysicsWorld, options: RackTravelOptions): RackTravelResult {
  const rackId = options.racks[0];
  if (rackId === undefined) throw new Error('physics: a rack travel needs a rack');
  const profile = options.profile ?? RACK_TRAVEL_PROFILE;
  const blockForce = options.blockForce ?? RACK_BLOCK_FORCE;
  const blockSteps = options.blockSteps ?? RACK_BLOCK_STEPS;
  const racks = [...options.racks].sort(compareIds);
  const riders = [...options.riders].sort((a, b) => compareIds(a.id, b.id));
  const length = v3Length(options.travel);
  const direction = v3Normalise(options.travel);

  for (const id of racks) {
    const kind = world.getKind(id);
    if (kind !== 'kinematic') {
      throw new Error(
        `physics: rack body '${id}' is ${kind}; a rack travel needs kinematic rack bodies, ` +
          'which carry their load',
      );
    }
  }
  const rackStart = new Map<string, Pose>();
  for (const id of racks) rackStart.set(id, world.getPose(id));
  const relativeBefore = new Map<string, Pose>();
  const frameBefore = rackStart.get(rackId) as Pose;
  for (const rider of riders) {
    relativeBefore.set(rider.id, poseRelative(frameBefore, world.getPose(rider.id)));
  }

  // Whatever is neither rack nor rider can hold the load back: the tub, the door, another rack.
  const travelling = new Set<string>([...racks, ...riders.map((rider) => rider.id)]);
  const riderIds = new Set(riders.map((rider) => rider.id));
  const rackIds = new Set(racks);
  const others = world.bodyIds().filter((id) => !travelling.has(id));

  let blockedBy: string | undefined;
  const held = new Map<string, number>();
  // Held bodies that met no resistance in the latest step.
  const released = new Set<string>();
  // For each held body: the state of the world after the step in which it first met
  // resistance, and how far the rack had travelled before that step.
  const onset = new Map<string, { state: Uint8Array; travelled: number }>();
  const driveTo = (travelled: number): void => {
    const by: Vec3 = [direction[0] * travelled, direction[1] * travelled, direction[2] * travelled];
    for (const id of racks) world.setPose(id, poseOffset(rackStart.get(id) as Pose, by));
    world.step(1);
  };
  /**
   * Force, against the direction of travel, with which the others hold the travelling bodies
   * back in the latest step, newtons. It is booked on the rider that is held or, when it is a
   * rack itself that runs into something, on the thing in its way.
   */
  const opposingForces = (): Map<string, number> => {
    const opposing = new Map<string, number>();
    for (const contact of world.contacts({ bodies: others })) {
      const aTravels = riderIds.has(contact.a) || rackIds.has(contact.a);
      const bTravels = riderIds.has(contact.b) || rackIds.has(contact.b);
      if (aTravels === bTravels) continue;
      // The normal points from a to b; the force on a is along minus the normal.
      const along = v3Dot(contact.normal, direction);
      const [carried, other, force] = aTravels
        ? [contact.a, contact.b, contact.normalForceN * along]
        : [contact.b, contact.a, -contact.normalForceN * along];
      if (force <= 0) continue;
      const culprit = riderIds.has(carried) ? carried : other;
      opposing.set(culprit, (opposing.get(culprit) ?? 0) + force);
    }
    return opposing;
  };
  /**
   * Force along the direction of travel with which the bodies travelling with the rack push a
   * rider forward in the latest step, newtons (normal forces only).
   */
  const pushingForce = (id: string): number => {
    let pushing = 0;
    for (const contact of world.contacts({ bodies: [id] })) {
      const other = contact.a === id ? contact.b : contact.a;
      if (!travelling.has(other)) continue;
      // The normal points from a to b: the force on b is along it, on a against it.
      const along = v3Dot(contact.normal, direction) * (contact.a === id ? -1 : 1);
      if (along > 0) pushing += contact.normalForceN * along;
    }
    return pushing;
  };
  /**
   * True when, in the latest step, the body that blocks the rack is pinned again: held back
   * by something that does not travel and, if it is a rider, pushed on from behind as well (a
   * rider merely leaning on the obstacle is not pinned).
   */
  const pinned = (id: string): boolean =>
    (opposingForces().get(id) ?? 0) > RACK_CLOSE_UP_FORCE &&
    (!riderIds.has(id) || pushingForce(id) > RACK_CLOSE_UP_FORCE);
  let previous = 0;
  for (const s of rackTravelDistances(length, profile, world.timeStep)) {
    const before = previous;
    previous = s;
    driveTo(s);
    if (others.length === 0) continue;

    const opposing = opposingForces();
    let worst: string | undefined;
    let state: Uint8Array | undefined;
    for (const id of [...opposing.keys()].sort(compareIds)) {
      const force = opposing.get(id) as number;
      if (force <= blockForce) continue;
      const count = (held.get(id) ?? 0) + 1;
      held.set(id, count);
      if (count === 1) {
        state ??= world.snapshot();
        onset.set(id, { state, travelled: before });
      }
      if (count >= blockSteps && worst === undefined) worst = id;
    }
    // A body that meets its obstacle at speed rebounds for a step before it is pinned, so one
    // step without resistance does not end a hold; two do (a knock that sends the body on its
    // way is not a hold).
    for (const id of [...held.keys()]) {
      if ((opposing.get(id) ?? 0) > blockForce) {
        released.delete(id);
      } else if (released.has(id)) {
        held.delete(id);
        onset.delete(id);
        released.delete(id);
      } else {
        released.add(id);
      }
    }
    if (worst !== undefined) {
      // The rack is driven with unlimited force and has by now pressed the body `blockSteps`
      // steps deep into the obstacle; a hand stops where the resistance begins. So the world
      // goes back to the step in which it began, and the rack gives back that one step, in
      // which it may already have pinned the body. Whether it had depends on where in that
      // step the body met the obstacle, so the rack then closes up again slowly, by no more
      // than the step it gave back, and stops for good one notch short of where the
      // resistance returns.
      blockedBy = worst;
      const began = onset.get(worst) as { state: Uint8Array; travelled: number };
      world.restore(began.state);
      driveTo(began.travelled);
      let reached = began.travelled;
      while (reached < s) {
        const next = Math.min(s, reached + RACK_CLOSE_UP_STEP);
        driveTo(next);
        if (pinned(worst)) {
          driveTo(reached);
          break;
        }
        reached = next;
      }
      break;
    }
  }
  world.settle(options.settle ?? settleOptionsFor(world.timeStep));

  const frameAfter = world.getPose(rackId);
  const moved: BodyMotion[] = [];
  const fellOut: string[] = [];
  for (const rider of riders) {
    const relative = poseRelative(frameAfter, world.getPose(rider.id));
    const motion = bodyMotion(rider.id, relativeBefore.get(rider.id) as Pose, relative);
    if (motion.displacement > MOVED_DISTANCE || motion.rotation > MOVED_ANGLE) moved.push(motion);
    if (options.envelope !== undefined) {
      const point = v3Add(relative.p, quatRotate(relative.q, rider.point ?? [0, 0, 0]));
      if (!insideAabb(point, options.envelope)) fellOut.push(rider.id);
    }
  }
  return blockedBy === undefined ? { moved, fellOut } : { moved, fellOut, blockedBy };
}

// ---------------------------------------------------------------------------------------------
// Spray-arm sweep and dispenser lid
// ---------------------------------------------------------------------------------------------

/** A hinge: an axis through a point, both in the frame of the part that turns about it. */
export interface Hinge {
  /** A point on the axis, metres. */
  readonly point: Vec3;
  /** Direction of the axis (need not be unit length). */
  readonly axis: Vec3;
}

/**
 * The pose of a part turned by `angle` radians (right-hand rule) about a hinge given in its own
 * frame, when `pose` is its pose (part frame to tub frame) at angle zero.
 */
export function turnedPose(pose: Pose, hinge: Hinge, angle: number): Pose {
  const turn: Quat = quatFromAxisAngle(hinge.axis, angle);
  // x_tub = p + R (c + T (x - c)), with c the hinge point and T the turn.
  const local = v3Sub(hinge.point, quatRotate(turn, hinge.point));
  return { p: v3Add(pose.p, quatRotate(pose.q, local)), q: quatMul(pose.q, turn) };
}

/**
 * Largest distance from a hinge axis reached by any point of a set of collision pieces (both
 * in the same frame), metres, including their rounding radii.
 */
export function reachFromAxis(pieces: readonly CollisionPiece[], hinge: Hinge): number {
  const axis = v3Normalise(hinge.axis);
  if (v3Length(axis) === 0) throw new Error('physics: a hinge needs an axis');
  let reach = 0;
  const visit = (p: Vec3, radius: number): void => {
    reach = Math.max(reach, v3Length(v3Cross(v3Sub(p, hinge.point), axis)) + radius);
  };
  for (const piece of pieces) {
    // A round rolling surface lies on the hulls of its wall and adds no reach.
    if (piece.kind === 'round') continue;
    if (piece.kind === 'hull') {
      for (const p of piece.points) visit(p, piece.radius);
    } else if (piece.kind === 'capsule') {
      visit(piece.a, piece.radius);
      visit(piece.b, piece.radius);
    } else {
      const h = piece.halfExtents;
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const corner = quatRotate(piece.pose.q, [sx * h[0], sy * h[1], sz * h[2]]);
            visit(v3Add(piece.pose.p, corner), piece.radius);
          }
        }
      }
    }
  }
  return reach;
}

/** Arguments of {@link sweepArm}. */
export interface ArmSweepOptions {
  /** Spray-arm id from the machine specification; a body with this id is not swept against. */
  readonly arm: string;
  /** The arm's collision pieces in the arm frame. */
  readonly pieces: readonly CollisionPiece[];
  /** Arm frame to tub frame at the arm's reference position. */
  readonly pose: Pose;
  /** The axis the arm turns about, in the arm frame; defaults to +z through the origin. */
  readonly hinge?: Hinge;
  /** Sense of rotation about the axis: 1 (the default) is the right-hand rule, -1 its reverse. */
  readonly direction?: 1 | -1;
  /** Further bodies the arm cannot be blocked by (the rack that carries it, for example). */
  readonly ignore?: readonly string[];
  /** Tip travel between samples, metres; defaults to {@link ARM_SWEEP_ARC_STEP}. */
  readonly arcStep?: number;
}

/**
 * Spray-arm sweep (platform.md section 5): the arm is turned through a full turn about its axis
 * in steps of at most `arcStep` of tip travel and tested for contact with the world at each;
 * the first contact is then located to {@link ARM_SWEEP_ANGLE_RESOLUTION} by bisection. The arm
 * is a probe, not a body of the world, so the load is not disturbed: an arm driven by water has
 * next to no torque and simply stops where it first touches something. When several bodies are
 * met at once the first in id order is reported.
 */
export function sweepArm(world: PhysicsWorld, options: ArmSweepOptions): ArmSweepResult {
  const hinge = options.hinge ?? { point: [0, 0, 0], axis: [0, 0, 1] };
  const sense = options.direction ?? 1;
  const arcStep = options.arcStep ?? ARM_SWEEP_ARC_STEP;
  if (!(arcStep > 0)) throw new Error('physics: the arm sweep needs a positive arc step');
  const ignore = [options.arm, ...(options.ignore ?? [])];
  const reach = reachFromAxis(options.pieces, hinge);
  const samples = Math.max(8, Math.ceil((2 * Math.PI * reach) / arcStep));
  const touching = (angle: number): readonly string[] =>
    world.penetration(options.pieces, turnedPose(options.pose, hinge, sense * angle), ignore).with;

  for (let k = 0; k < samples; k++) {
    const angle = (2 * Math.PI * k) / samples;
    let hit = touching(angle);
    if (hit.length === 0) continue;
    if (k === 0)
      return { arm: options.arm, free: false, firstContactAngle: 0, blockedBy: hit[0] as string };
    // Free at the previous sample, touching at this one: close in on the first contact.
    let lo = (2 * Math.PI * (k - 1)) / samples;
    let hi = angle;
    while (hi - lo > ARM_SWEEP_ANGLE_RESOLUTION) {
      const mid = (lo + hi) / 2;
      const at = touching(mid);
      if (at.length === 0) lo = mid;
      else {
        hi = mid;
        hit = at;
      }
    }
    return { arm: options.arm, free: false, firstContactAngle: hi, blockedBy: hit[0] as string };
  }
  return { arm: options.arm, free: true };
}

/** Arguments of {@link sweepLid}. */
export interface LidSweepOptions {
  /**
   * Without `hinge`: the volume swept by the lid as it opens. With `hinge`: the lid itself in
   * its closed position. Collision pieces in the lid frame.
   */
  readonly pieces: readonly CollisionPiece[];
  /** Lid frame to tub frame. */
  readonly pose: Pose;
  /** The hinge the lid swings about and the angle it opens by, radians (right-hand rule). */
  readonly hinge?: Hinge & { readonly angle: number };
  /** Bodies the lid cannot be blocked by (the door it is mounted in). */
  readonly ignore?: readonly string[];
  /** Travel of the lid's far edge between samples, metres; defaults to 1 mm. */
  readonly arcStep?: number;
}

/**
 * Dispenser lid (platform.md section 5): tests the volume swept by the opening lid against the
 * settled load and reports every body in it. The swept volume is either given directly or, with
 * a hinge, sampled by swinging the lid from closed to open in steps of at most `arcStep`.
 * The world is not changed.
 */
export function sweepLid(world: PhysicsWorld, options: LidSweepOptions): LidSweepResult {
  const blocked = new Set<string>();
  const hinge = options.hinge;
  if (hinge === undefined) {
    for (const id of world.penetration(options.pieces, options.pose, options.ignore).with) {
      blocked.add(id);
    }
  } else {
    const arcStep = options.arcStep ?? ARM_SWEEP_ARC_STEP;
    if (!(arcStep > 0)) throw new Error('physics: the lid sweep needs a positive arc step');
    const reach = reachFromAxis(options.pieces, hinge);
    const samples = Math.max(1, Math.ceil((Math.abs(hinge.angle) * reach) / arcStep));
    for (let k = 0; k <= samples; k++) {
      const pose = turnedPose(options.pose, hinge, (hinge.angle * k) / samples);
      for (const id of world.penetration(options.pieces, pose, options.ignore).with) {
        blocked.add(id);
      }
    }
  }
  const blockedBy = [...blocked].sort(compareIds);
  return { free: blockedBy.length === 0, blockedBy };
}
