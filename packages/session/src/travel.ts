/**
 * How a basket is pulled out and pushed in: the motion a hand gives it, and the drive that
 * carries its load along (docs/design/platform.md section 6, "Basket travel").
 *
 * The motion has four numbers. The hand accelerates the basket to a peak speed, slows it again
 * before the end of the rails, and the basket meets its end stop with what speed is left and is
 * stopped there within one step of the simulation. What is held by friction rides along while
 * the hand's accelerations stay below `mu g`; the knock at the stop moves it by
 * `v^2 / (2 mu g)` whatever its friction, and tips what stands balanced.
 *
 * The drive is the rack travel of `@spotless/physics` (`travelRack`) taken apart: the same
 * blocking rule and the same closing-up to an obstacle, but along a list of distances instead
 * of the three-number profile of that package, and without the settle at the end, which the
 * session runs itself in order to judge what the move left unsteady. For a profile without a
 * speed at the stop the distances are those of `rackTravelDistances`, and drive plus settle is
 * `travelRack` to the bit (`travel.test.ts`).
 *
 * Units: SI. Deterministic: a fixed number of steps for given arguments.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { compareIds, v3Add, v3Dot, v3Length, v3Normalise } from '@spotless/core';
import type { PhysicsWorld } from '@spotless/physics';
import {
  RACK_BLOCK_FORCE,
  RACK_BLOCK_STEPS,
  RACK_CLOSE_UP_FORCE,
  RACK_CLOSE_UP_STEP,
  RACK_TRAVEL_PROFILE,
  rackTravelDistances,
} from '@spotless/physics';

/** The motion of a basket that is pulled out or pushed in by hand. */
export interface BasketTravelProfile {
  /** Speed the basket reaches, m/s. */
  readonly peakSpeed: number;
  /** Acceleration from rest, m/s^2. */
  readonly acceleration: number;
  /** Deceleration with which the hand slows the basket before the end of its travel, m/s^2. */
  readonly deceleration: number;
  /**
   * Speed with which the basket meets its end stop, m/s: it is stopped there within one step.
   * 0 for a basket brought to rest at the stop by the deceleration alone.
   */
  readonly endStopSpeed: number;
}

/**
 * The registered motions of a basket.
 *
 * `normal` is the pull and push of every `set_rack` and of the mechanical check: a loaded
 * basket moved by someone who has just loaded it. 1 m/s^2 is a tenth of gravity: below `mu g`
 * for every pair of the catalogue's friction table against coated wire except a PTFE coating
 * (0.10, which just slides), so that nothing that stands on its base, in a slot or on a rail is
 * moved by the hand. The basket meets its stop at 0.1 m/s, an audible knock: an item of
 * friction 0.2 to 0.25 slides 2.0 to 2.5 mm at it (`v^2 / (2 mu g)`), a tall thing balanced on
 * a narrow foot goes over, a thing held by a tine, a wall or a rail does not move at all.
 * Peak 0.35 m/s: a travel of 0.5 m then takes 1.9 s. [ESTIMATED: no measurement of the owner's
 * push exists; the three numbers are chosen from the closed forms of
 * `packages/physics/src/travel.test.ts` and the mug measured in
 * `packages/integration/scripts/end-stop.ts` (0.4 mm when stopped dead from 0.05 m/s, 4.3 mm
 * from 0.15 m/s). To be replaced by a film of the real basket.]
 *
 * `hard` is the careless shove, kept for studies: the profile registered in
 * `@spotless/physics` (`RACK_TRAVEL_PROFILE`: 0.5 m/s, 2 m/s^2, braked at 5 m/s^2 over the last
 * 25 mm), which is what every basket move was until 2026-10-10. Everything held by friction
 * below 0.51 slides at its stop: a mug 20 to 27 mm.
 */
export const BASKET_TRAVEL_PROFILES = {
  normal: { peakSpeed: 0.35, acceleration: 1, deceleration: 1, endStopSpeed: 0.1 },
  hard: {
    peakSpeed: RACK_TRAVEL_PROFILE.peakSpeed,
    acceleration: RACK_TRAVEL_PROFILE.acceleration,
    deceleration: RACK_TRAVEL_PROFILE.endStopDeceleration,
    endStopSpeed: 0,
  },
} as const satisfies { readonly [name: string]: BasketTravelProfile };

/** Name of a registered basket motion. */
export type BasketTravelName = keyof typeof BASKET_TRAVEL_PROFILES;

/**
 * The speeds a profile really reaches over a travel of `distance` metres: a short travel never
 * gets to the peak speed, and a very short one not even to the speed at the stop.
 */
export function basketTravelSpeeds(
  distance: number,
  profile: BasketTravelProfile,
): { readonly peak: number; readonly atStop: number } {
  const { acceleration: a, deceleration: d } = profile;
  // Accelerating all the way gives sqrt(2 a D) at the stop.
  const atStop = Math.min(profile.endStopSpeed, Math.sqrt(2 * a * distance));
  // v^2 / 2a + (v^2 - atStop^2) / 2d = D.
  const meeting = Math.sqrt((2 * a * d * distance + a * atStop * atStop) / (a + d));
  return { peak: Math.max(atStop, Math.min(profile.peakSpeed, meeting)), atStop };
}

/**
 * Distance travelled by a basket at the end of each fixed step of a travel of `distance`
 * metres: constant acceleration from rest to the peak speed, constant speed, constant
 * deceleration down to the speed at the end stop, which is reached exactly at `distance`. The
 * last entry is exactly `distance`; after it the basket stands (the stop). Empty when there is
 * nothing to travel. A profile with no speed at the stop gives the list of
 * `rackTravelDistances` of `@spotless/physics`.
 */
export function basketTravelDistances(
  distance: number,
  profile: BasketTravelProfile,
  timeStep: number,
): number[] {
  if (!(distance >= 0) || !Number.isFinite(distance)) {
    throw new Error(`session: invalid basket travel distance ${distance}`);
  }
  if (!(timeStep > 0)) throw new Error('session: the basket travel needs the time step');
  const { acceleration: a, deceleration: d } = profile;
  if (!(a > 0) || !(d > 0) || !(profile.peakSpeed > 0) || !(profile.endStopSpeed >= 0)) {
    throw new Error('session: the basket profile needs positive speed and accelerations');
  }
  if (profile.endStopSpeed === 0) {
    return rackTravelDistances(
      distance,
      { peakSpeed: profile.peakSpeed, acceleration: a, endStopDeceleration: d },
      timeStep,
    );
  }
  if (distance === 0) return [];
  const { peak, atStop } = basketTravelSpeeds(distance, profile);
  const tUp = peak / a;
  const tDown = (peak - atStop) / d;
  const sUp = (peak * peak) / (2 * a);
  const sDown = (peak * peak - atStop * atStop) / (2 * d);
  const tCruise = Math.max(0, distance - sUp - sDown) / peak;
  const total = tUp + tCruise + tDown;
  const at = (t: number): number => {
    if (t <= tUp) return 0.5 * a * t * t;
    if (t <= tUp + tCruise) return sUp + peak * (t - tUp);
    const left = Math.max(0, total - t);
    // Counting back from the stop, where the speed is `atStop`.
    return distance - atStop * left - 0.5 * d * left * left;
  };
  const steps = Math.max(1, Math.ceil(total / timeStep - 1e-9));
  const out: number[] = [];
  for (let k = 1; k < steps; k++) out.push(Math.min(distance, at(k * timeStep)));
  out.push(distance);
  return out;
}

/** Arguments of {@link driveBasket}. */
export interface BasketDriveOptions {
  /**
   * The kinematic bodies that travel together: the basket first, then whatever is fixed to it.
   */
  readonly racks: readonly string[];
  /** Displacement of the basket over the whole travel, metres, tub frame. */
  readonly travel: Vec3;
  /** Ids of the dynamic bodies loaded on the basket. */
  readonly riders: readonly string[];
  /**
   * Distance travelled at the end of each step, metres, ending at the length of `travel`
   * ({@link basketTravelDistances}).
   */
  readonly distances: readonly number[];
  /** See `RACK_BLOCK_FORCE` of `@spotless/physics`. */
  readonly blockForce?: number;
  /** See `RACK_BLOCK_STEPS` of `@spotless/physics`. */
  readonly blockSteps?: number;
}

/** A body that travelled, and a body that did not which it was pressed against on the way. */
export interface BasketPress {
  /** The travelling body (a rider or the basket) and its part in contact. */
  readonly carried: string;
  readonly carriedPart: string;
  /** The body that does not travel, and its part in contact. */
  readonly against: string;
  readonly againstPart: string;
}

function poseOffset(pose: Pose, by: Vec3): Pose {
  return { p: v3Add(pose.p, by), q: pose.q };
}

/**
 * Drives a basket along `travel` through the given distances, one per step, carrying its load
 * by contact and friction. The travel stops early when something that does not travel with the
 * basket holds a body back with more than `blockForce` for `blockSteps` steps in a row; the
 * world is then put back to the step in which that resistance began and the basket closes up to
 * the obstacle `RACK_CLOSE_UP_STEP` at a time, so that it stands where it met it with nothing
 * pressed into anything. Returns what blocked it, if anything: the rider that was held back or,
 * when the basket itself ran into something, that body.
 *
 * Also returns what the travelling bodies were pressed against on the way (`pressed`): every
 * pair of a body that travels and a body that does not which were in contact under a normal
 * force at the end of some step, with the parts in contact. A board that leans out over the
 * side of a basket and is pushed upright by the wall of the tub as the basket goes in is in
 * that list with the wall; one that passes clear of the wall is not. Bookkeeping only: the
 * motion is the same with or without it.
 *
 * The world is left as the last step leaves it, not settled: whatever the stop set sliding is
 * still sliding. The rule and its constants are those of `travelRack` of `@spotless/physics`.
 */
export function driveBasket(
  world: PhysicsWorld,
  options: BasketDriveOptions,
): { readonly blockedBy?: string; readonly pressed: readonly BasketPress[] } {
  const rackId = options.racks[0];
  if (rackId === undefined) throw new Error('session: a basket travel needs a basket');
  const blockForce = options.blockForce ?? RACK_BLOCK_FORCE;
  const blockSteps = options.blockSteps ?? RACK_BLOCK_STEPS;
  const racks = [...options.racks].sort(compareIds);
  const riders = [...options.riders].sort(compareIds);
  const direction = v3Length(options.travel) > 0 ? v3Normalise(options.travel) : [0, 0, 0];
  for (const id of racks) {
    const kind = world.getKind(id);
    if (kind !== 'kinematic') {
      throw new Error(`session: basket body '${id}' is ${kind}; only a kinematic body is driven`);
    }
  }
  const rackStart = new Map<string, Pose>();
  for (const id of racks) rackStart.set(id, world.getPose(id));

  // Whatever is neither basket nor rider can hold the load back: the tub, the door, the other
  // basket and what is in it.
  const travelling = new Set<string>([...racks, ...riders]);
  const riderIds = new Set(riders);
  const rackIds = new Set(racks);
  const others = world.bodyIds().filter((id) => !travelling.has(id));

  let blockedBy: string | undefined;
  const held = new Map<string, number>();
  const released = new Set<string>();
  const onset = new Map<string, { state: Uint8Array; travelled: number }>();
  const driveTo = (travelled: number): void => {
    const by: Vec3 = [
      (direction[0] as number) * travelled,
      (direction[1] as number) * travelled,
      (direction[2] as number) * travelled,
    ];
    for (const id of racks) world.setPose(id, poseOffset(rackStart.get(id) as Pose, by));
    world.step(1);
  };
  // Force, against the travel, with which the others hold the travelling bodies back in the
  // latest step: booked on the rider that is held or, for the basket itself, on what is in its
  // way.
  const pressed = new Map<string, BasketPress>();
  const opposingForces = (): Map<string, number> => {
    const opposing = new Map<string, number>();
    for (const contact of world.contacts({ bodies: others })) {
      const aTravels = riderIds.has(contact.a) || rackIds.has(contact.a);
      const bTravels = riderIds.has(contact.b) || rackIds.has(contact.b);
      if (aTravels === bTravels) continue;
      if (contact.normalForceN > 0) {
        const press: BasketPress = aTravels
          ? {
              carried: contact.a,
              carriedPart: contact.partA,
              against: contact.b,
              againstPart: contact.partB,
            }
          : {
              carried: contact.b,
              carriedPart: contact.partB,
              against: contact.a,
              againstPart: contact.partA,
            };
        pressed.set(
          `${press.carried}|${press.carriedPart}|${press.against}|${press.againstPart}`,
          press,
        );
      }
      const along = v3Dot(contact.normal, direction as Vec3);
      const [carried, other, force] = aTravels
        ? [contact.a, contact.b, contact.normalForceN * along]
        : [contact.b, contact.a, -contact.normalForceN * along];
      if (force <= 0) continue;
      const culprit = riderIds.has(carried) ? carried : other;
      opposing.set(culprit, (opposing.get(culprit) ?? 0) + force);
    }
    return opposing;
  };
  const pushingForce = (id: string): number => {
    let pushing = 0;
    for (const contact of world.contacts({ bodies: [id] })) {
      const other = contact.a === id ? contact.b : contact.a;
      if (!travelling.has(other)) continue;
      const along = v3Dot(contact.normal, direction as Vec3) * (contact.a === id ? -1 : 1);
      if (along > 0) pushing += contact.normalForceN * along;
    }
    return pushing;
  };
  const pinned = (id: string): boolean =>
    (opposingForces().get(id) ?? 0) > RACK_CLOSE_UP_FORCE &&
    (!riderIds.has(id) || pushingForce(id) > RACK_CLOSE_UP_FORCE);

  let previous = 0;
  for (const s of options.distances) {
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
    // One step without resistance does not end a hold (a body rebounds once before it is
    // pinned); two do.
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
  const presses = [...pressed.keys()]
    .sort(compareIds)
    .map((key) => pressed.get(key) as BasketPress);
  return blockedBy === undefined ? { pressed: presses } : { blockedBy, pressed: presses };
}
