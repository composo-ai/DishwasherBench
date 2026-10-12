/**
 * The mistakes of the careless policy, and what each of them means for a settled load.
 *
 * A mistake is never recorded for what was intended: it is recorded for what the physics left.
 * {@link mistakeHolds} reads one recorded mistake against the settled scene (the pose of the
 * item, what it touches, the mechanical check) and says whether it is still true. The careless
 * policy asks it after the baskets are in, relabels what turned into another mistake and drops
 * what turned into none; `check-loads` asks it again for every saved load.
 */

import type { Vec3 } from '@spotless/core';
import type { LoadCheck, PlacedItemState, WirePose } from '@spotless/session';
import type { ItemView } from './families.ts';
import { angleDeg, axisAt } from './player.ts';

/** The mistakes the careless policy can make (standards.md section 9, by phenomenon). */
export const MISTAKE_KINDS = [
  /** P02: a plate with its eating face turned away from the centre. */
  'plate_facing_away',
  /** P03: plates crowded two to a slot. */
  'plates_two_to_a_slot',
  /** P04: bowls nested in each other. */
  'bowls_nested',
  /** P04/P05: a bowl, a jug or a box lying face down flat on the tines. */
  'bowl_face_down_flat',
  /** P01: a cup, mug or glass standing mouth up. */
  'cup_upright',
  /** P01: a cup, mug or glass lying on its side. */
  'cup_on_side',
  /** P25: something in the path of the detergent tablet or of the dispenser lid. */
  'tablet_tray_blocked',
  /** P05: a flat item lying over the items below it. */
  'item_over_others',
  /** P15: spoons of a kind nested in one cell of the cutlery basket. */
  'spoons_nested',
  /** P15/P19: pieces of cutlery of a kind stood together in one cell (forks with forks). */
  'cutlery_bunched',
  /** P06: an item that stops a spray arm. */
  'tall_item_under_arm',
  /** P19/P40: an item pushed in where there was no room, resting against its neighbour. */
  'packed_tight',
] as const;

/** One kind of careless mistake. */
export type MistakeKind = (typeof MISTAKE_KINDS)[number];

/**
 * The mistakes that act on the whole machine and not on the item they are made with: a tablet
 * that cannot fall leaves the whole wash without detergent, an arm that cannot turn leaves a
 * whole basket short of water.
 */
export const MACHINE_MISTAKE_KINDS: readonly MistakeKind[] = [
  'tablet_tray_blocked',
  'tall_item_under_arm',
];

/**
 * The mistakes the careless policy makes when it is not told which: every kind that is made
 * with an item and costs that item or its neighbour. The two that act on the whole machine
 * ({@link MACHINE_MISTAKE_KINDS}) are left to whoever names them: one of them in a load drowns
 * what every other mistake costs (a wash without detergent leaves the protein and the starch
 * of the whole load on) and puts a careless load, which holds every item of the careful one,
 * below a random pile of a third of them. A reference policy that is to stand between the
 * careful and the random one makes the mistakes of the hand, not the two that stop the machine;
 * those are measured one at a time (`packages/bench/scripts/mistake-study.ts`).
 */
export const CARELESS_DEFAULT_MISTAKES: readonly MistakeKind[] = MISTAKE_KINDS.filter(
  (kind) => !MACHINE_MISTAKE_KINDS.includes(kind),
);

/** A mistake that is in the load, as measured on the settled load. */
export interface MistakeMade {
  readonly kind: MistakeKind;
  readonly item_id: string;
  /** What the settled pose shows, in words. */
  readonly note: string;
  /** The other item of a mistake that takes two (the bowl nested in, the plate shared with). */
  readonly with?: string;
}

/** Angle of an item's `+z` axis (its opening, its eating face) from straight up, degrees. */
export function mouthUpDeg(pose: WirePose): number {
  return angleDeg(axisAt(pose, [0, 0, 1]), [0, 0, 1]);
}

/** How a hollow item lies: mouth up (it fills), on its side, or mouth down (it drains). */
export type HollowAttitude = 'mouth_up' | 'on_side' | 'mouth_down' | 'tilted_up' | 'tilted_down';

/** Mouth up within this of the vertical counts as standing mouth up, degrees. */
export const MOUTH_UP_LIMIT = 30;
/** An axis within this of the horizontal counts as lying on its side, degrees. */
export const ON_SIDE_LIMIT = 30;
/** Mouth down within this of the vertical counts as lying face down flat, degrees. */
export const FACE_DOWN_LIMIT = 20;
/** Two axes within this of each other count as nested, degrees. */
export const NESTED_AXIS_LIMIT = 35;
/**
 * Two pieces of cutlery within this of each other in plan stand in one cell, millimetres (the
 * cells of the owner's cutlery basket are about 60 by 55 mm; neighbours in one cell stand
 * closer than the centres of two cells).
 */
export const BUNCHED_LIMIT_MM = 50;

/** Reads the attitude of a hollow item from its settled pose. */
export function hollowAttitude(pose: WirePose): HollowAttitude {
  const up = mouthUpDeg(pose);
  if (up <= MOUTH_UP_LIMIT) return 'mouth_up';
  if (up >= 180 - MOUTH_UP_LIMIT) return 'mouth_down';
  if (Math.abs(up - 90) <= ON_SIDE_LIMIT) return 'on_side';
  return up < 90 ? 'tilted_up' : 'tilted_down';
}

/** What {@link mistakeHolds} needs to know about the settled load. */
export interface SettledLoad {
  /** The placed items by id, as the scene state gives them (pose and contacts). */
  readonly placed: ReadonlyMap<string, PlacedItemState>;
  /** The items of the level by id. */
  readonly views: ReadonlyMap<string, ItemView>;
  /** Size of the envelope of each basket by frame, millimetres. */
  readonly envelopes: ReadonlyMap<string, readonly [number, number, number]>;
  /** The mechanical check of the load with both baskets in, if there is one. */
  readonly check: LoadCheck | null;
}

function touches(item: PlacedItemState, other: string): boolean {
  return item.contacts.some((contact) => contact.with === other);
}

/** The other items an item touches. */
export function neighboursOf(item: PlacedItemState, load: SettledLoad): string[] {
  return item.contacts.map((contact) => contact.with).filter((id) => load.placed.has(id));
}

/**
 * Whether a plate on edge has its eating face turned away from the middle of its basket: its
 * face normal points, across the row it stands in, towards the nearer wall.
 */
export function facesAway(
  pose: WirePose,
  envelope: readonly [number, number, number] | undefined,
): boolean {
  if (envelope === undefined) return false;
  const face = axisAt(pose, [0, 0, 1]);
  if (Math.abs(face[2]) > 0.75) return false;
  const along: 0 | 1 = Math.abs(face[0]) >= Math.abs(face[1]) ? 0 : 1;
  const toCentre = envelope[along] / 2 - pose.position_mm[along];
  // In the middle of the basket there is no "away".
  if (Math.abs(toCentre) < 25) return false;
  return face[along] * toCentre < 0;
}

/**
 * Reads one recorded mistake against the settled load. Returns null when the mistake is there,
 * otherwise why it is not.
 */
export function mistakeHolds(mistake: MistakeMade, load: SettledLoad): string | null {
  const item = load.placed.get(mistake.item_id);
  if (item === undefined) return 'the item is not in the machine';
  const view = load.views.get(mistake.item_id);
  const up = mouthUpDeg(item);
  const partner = mistake.with === undefined ? undefined : load.placed.get(mistake.with);
  const needsPartner = (): string | null => {
    if (mistake.with === undefined) return 'no other item is named';
    if (partner === undefined) return `${mistake.with} is not in the machine`;
    if (!touches(item, mistake.with)) return `it does not touch ${mistake.with}`;
    return null;
  };
  switch (mistake.kind) {
    case 'cup_upright':
      return up <= MOUTH_UP_LIMIT
        ? null
        : `its mouth is ${Math.round(up)} degrees from straight up`;
    case 'cup_on_side':
      return Math.abs(up - 90) <= ON_SIDE_LIMIT
        ? null
        : `its axis is ${Math.round(Math.abs(up - 90))} degrees from horizontal`;
    case 'bowl_face_down_flat':
      return up >= 180 - FACE_DOWN_LIMIT
        ? null
        : `its mouth is ${Math.round(180 - up)} degrees from straight down`;
    case 'plate_facing_away':
      return facesAway(item, load.envelopes.get(item.frame))
        ? null
        : 'its face does not look away from the middle of the basket';
    case 'bowls_nested':
    case 'spoons_nested': {
      const missing = needsPartner();
      if (missing !== null || partner === undefined) return missing;
      const axis: Vec3 = mistake.kind === 'bowls_nested' ? [0, 0, 1] : [1, 0, 0];
      const between = angleDeg(axisAt(item, axis), axisAt(partner, axis));
      if (between > NESTED_AXIS_LIMIT) {
        return `it lies ${Math.round(between)} degrees across ${mistake.with}`;
      }
      if (mistake.kind === 'spoons_nested') {
        const faces = angleDeg(axisAt(item, [0, 0, 1]), axisAt(partner, [0, 0, 1]));
        if (faces > 2 * NESTED_AXIS_LIMIT)
          return `its bowl faces away from that of ${mistake.with}`;
      }
      return null;
    }
    case 'cutlery_bunched': {
      if (mistake.with === undefined) return 'no other item is named';
      if (partner === undefined) return `${mistake.with} is not in the machine`;
      if (item.frame !== 'cutlery_basket' || partner.frame !== 'cutlery_basket') {
        return 'it is not in the cutlery basket';
      }
      const apart = Math.hypot(
        item.position_mm[0] - partner.position_mm[0],
        item.position_mm[1] - partner.position_mm[1],
      );
      return apart <= BUNCHED_LIMIT_MM
        ? null
        : `it stands ${Math.round(apart)} mm from ${mistake.with}`;
    }
    case 'plates_two_to_a_slot': {
      const missing = needsPartner();
      if (missing !== null || partner === undefined) return missing;
      if (Math.abs(axisAt(item, [0, 0, 1])[2]) > 0.75) return 'it does not stand on edge';
      return null;
    }
    case 'packed_tight':
      return needsPartner();
    case 'item_over_others': {
      const face = Math.abs(axisAt(item, [0, 0, 1])[2]);
      if (view !== undefined && view.family !== 'utensil' && face < 0.8) {
        return 'it does not lie flat';
      }
      return neighboursOf(item, load).length > 0 ? null : 'it lies on no other item';
    }
    case 'tablet_tray_blocked': {
      const check = load.check;
      if (check === null) return 'there is no mechanical check';
      return check.tablet_blocked_by.includes(mistake.item_id) ||
        check.dispenser_blocked_by.includes(mistake.item_id)
        ? null
        : 'check_load does not find it in the way of the tablet or the dispenser lid';
    }
    case 'tall_item_under_arm': {
      const check = load.check;
      if (check === null) return 'there is no mechanical check';
      return check.spray_arms.some(
        (arm) => !arm.full_rotation && arm.blocked_by === mistake.item_id,
      )
        ? null
        : 'check_load does not find an arm stopped by it';
    }
  }
}

/**
 * What a hollow item that was meant as one mistake has become, if it settled as another: a cup
 * stood mouth up that fell onto its side is a cup on its side. Null when it is neither.
 */
export function hollowMistakeOf(pose: WirePose): 'cup_upright' | 'cup_on_side' | null {
  const attitude = hollowAttitude(pose);
  if (attitude === 'mouth_up') return 'cup_upright';
  if (attitude === 'on_side') return 'cup_on_side';
  return null;
}
