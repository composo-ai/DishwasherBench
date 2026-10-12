/**
 * Slot advice: the suggested drops of a `list_slots` answer as one ranked list of places, the
 * same for every player. The page's "Suggest spots" list and the MCP tool's answer are both
 * this list, in this order, so that a person and an agent are given the same advice.
 *
 * Pure and free of Node: the web client imports this file on its own
 * (`@spotless/server/slot-advice`).
 *
 * The order is mechanical and says nothing about how anything washes:
 *
 *  1. places whose suggested drop is free now and seats the item (its lower edge down between
 *     the tines, or in a cell of the cutlery basket);
 *  2. places that are free now where the item would only stand above the tine tips;
 *  3. places that are not free now (taken, covered or out of reach), with what is in the way.
 *
 * Within each group the places keep the order of the basket (row by row, along each row).
 * Slots of two paired rows that are one place (the same suggested drop) are one entry naming
 * both. Slots without a suggested drop are no place for the item and are only counted.
 */

import type { PresetOrientation, SlotCard, Vec3Mm } from '@spotless/session';

/** One place of the advice. */
export interface SlotAdvicePlace {
  /** The slots that are this place: one, or the two of a pair of rows. */
  readonly slots: readonly string[];
  /** The tine rows of those slots (empty for a cell of the cutlery basket or a shelf). */
  readonly rows: readonly string[];
  /** The position to pass to `place`, millimetres in the frame of the basket. */
  readonly position_mm: Vec3Mm;
  /** The orientation to pass to `place`. */
  readonly orientation: PresetOrientation;
  /** Whether the suggested drop passes the test of `place` in the scene as it is now. */
  readonly free: boolean;
  /** With `free` false: what the pose overlaps or what blocks the way down. */
  readonly blocked_by: readonly string[];
  /** False when the item would only stand above the tine tips there. */
  readonly seats: boolean;
  /** True when the item is too deep to come down between the tines of the slot. */
  readonly perches: boolean;
}

/** The advice for one item in one basket. */
export interface SlotAdvice {
  /** Every place, most useful first. */
  readonly places: readonly SlotAdvicePlace[];
  /** Places that are free now and seat the item. */
  readonly free_seated: number;
  /** Places that are free now where the item would only stand above the tine tips. */
  readonly free_perching: number;
  /** Places that are not free now. */
  readonly not_free: number;
  /** Slots of the basket that offer the item no drop at all. */
  readonly slots_without_drop: number;
}

function sameDrop(a: SlotCard, b: SlotCard): boolean {
  const da = a.suggested_drop;
  const db = b.suggested_drop;
  if (da === undefined || db === undefined) return false;
  return (
    da.position_mm[0] === db.position_mm[0] &&
    da.position_mm[1] === db.position_mm[1] &&
    da.position_mm[2] === db.position_mm[2] &&
    da.orientation.preset === db.orientation.preset &&
    (da.orientation.yaw_deg ?? 0) === (db.orientation.yaw_deg ?? 0) &&
    (da.orientation.pitch_deg ?? 0) === (db.orientation.pitch_deg ?? 0) &&
    (da.orientation.roll_deg ?? 0) === (db.orientation.roll_deg ?? 0) &&
    a.drop_free === b.drop_free
  );
}

function group(place: SlotAdvicePlace): number {
  if (!place.free) return 2;
  return place.seats ? 0 : 1;
}

/** The orientation without the offsets that are zero. */
function tidyOrientation(orientation: PresetOrientation): PresetOrientation {
  return {
    preset: orientation.preset,
    ...((orientation.roll_deg ?? 0) === 0 ? {} : { roll_deg: orientation.roll_deg as number }),
    ...((orientation.pitch_deg ?? 0) === 0 ? {} : { pitch_deg: orientation.pitch_deg as number }),
    ...((orientation.yaw_deg ?? 0) === 0 ? {} : { yaw_deg: orientation.yaw_deg as number }),
  };
}

/**
 * The slot advice of a `list_slots` answer that was asked for with an item: its slots with a
 * suggested drop, ranked. Asked for without an item, an answer has no drops and the advice
 * is empty.
 */
export function slotAdvice(slots: readonly SlotCard[]): SlotAdvice {
  const places: SlotAdvicePlace[] = [];
  let without = 0;
  for (const slot of slots) {
    const drop = slot.suggested_drop;
    if (drop === undefined) {
      without += 1;
      continue;
    }
    // Two paired rows hold a plate together: their slots of the same number are one place.
    const twin = places.findIndex((place) => {
      const first = slots.find((candidate) => candidate.id === place.slots[0]);
      return first !== undefined && first.tine_row !== slot.tine_row && sameDrop(first, slot);
    });
    if (twin >= 0) {
      const known = places[twin] as SlotAdvicePlace;
      places[twin] = {
        ...known,
        slots: [...known.slots, slot.id],
        rows: slot.tine_row === undefined ? known.rows : [...known.rows, slot.tine_row],
        blocked_by: [...new Set([...known.blocked_by, ...(slot.drop_blocked_by ?? [])])].sort(),
      };
      continue;
    }
    places.push({
      slots: [slot.id],
      rows: slot.tine_row === undefined ? [] : [slot.tine_row],
      position_mm: drop.position_mm,
      orientation: tidyOrientation(drop.orientation),
      free: slot.drop_free !== false,
      blocked_by: slot.drop_free === false ? [...(slot.drop_blocked_by ?? [])] : [],
      seats: slot.drop_seats !== false && slot.drop_perches !== true,
      perches: slot.drop_perches === true,
    });
  }
  // A stable sort: within a group the places stay in the order of the basket.
  const ranked = places
    .map((place, index) => ({ place, index }))
    .sort((a, b) => group(a.place) - group(b.place) || a.index - b.index)
    .map((entry) => entry.place);
  return {
    places: ranked,
    free_seated: ranked.filter((place) => group(place) === 0).length,
    free_perching: ranked.filter((place) => group(place) === 1).length,
    not_free: ranked.filter((place) => group(place) === 2).length,
    slots_without_drop: without,
  };
}

/** What the page writes for a place in its list, and what a reader of a transcript sees. */
export function slotAdviceLabel(place: SlotAdvicePlace): string {
  const name = place.slots.join(' + ');
  if (!place.free) {
    return `${name} (not free now${place.blocked_by.length === 0 ? '' : `: ${place.blocked_by.join(', ')}`})`;
  }
  if (place.perches) return `${name} (too deep: would sit on the tine tips)`;
  if (!place.seats) return `${name} (would stand above the tine tips)`;
  return name;
}
