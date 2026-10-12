// The seat `list_slots` offers a large plate must not depend on where the cutlery basket
// stands: a slot the basket is in the way of is marked not free, and every seat offered as
// free is the laid-back seat of the empty machine, in which the plate ends down on the rails
// and not leaning against its tines. (Review of 2026-10-10: with the basket at the front
// centre the 27 cm plate was offered upright in fourteen of the 22 rear slots, and ended 15
// degrees against the tines, 30 mm high on the basket's foot or fallen over.)
// `scripts/row-seats.ts` does the same for every plate, slot and position.
import { describe, expect, it } from 'vitest';
import { testLevel } from './test-level.ts';
import { itemAxisZ, mustSetRack, useSessions } from './test-util.ts';
import type { SlotCard } from './types.ts';

const session = useSessions();

const LEVEL = {
  ...testLevel(),
  id: 'seats',
  items: [{ id: 'p', itemType: 'dinner_plate_porcelain_270', points: 1, soils: [] }],
};

/** Lean of a settled plate from the vertical, degrees: positive with the tines of its slot. */
function leanOf(quat: readonly [number, number, number, number], slot: SlotCard): number {
  const face = itemAxisZ(quat);
  const sign = slot.lean_toward?.startsWith('-') === true ? -1 : 1;
  const along = slot.lean_toward?.endsWith('x') === true ? 0 : 1;
  return (Math.atan2(face[2], -sign * (face[along] as number)) * 180) / Math.PI;
}

async function rearSlots(position: string): Promise<readonly SlotCard[]> {
  const s = await session(LEVEL);
  if (position !== 'front_centre') mustSetRack(s, 'cutlery_basket', 'position', position);
  const listed = s.listSlots({ rack: 'lower_rack', item_id: 'p' });
  if (!listed.accepted) throw new Error('list_slots was rejected');
  return listed.slots.filter((slot) => slot.tine_row === 'tine_row_r1');
}

describe('the seat of a 27 cm plate in the rear rows', () => {
  it('is the same wherever the cutlery basket stands, and not free where the basket is in the way', async () => {
    const without = await rearSlots('out');
    expect(without.filter((slot) => slot.drop_free === true)).toHaveLength(22);
    for (const position of ['front_centre', 'front_right', 'front_left']) {
      const slots = await rearSlots(position);
      const blocked = slots.filter((slot) => slot.drop_free !== true);
      // The basket is about 150 mm wide: it is in the way of eight to ten of the 18 mm gaps.
      expect(blocked.length, position).toBeGreaterThanOrEqual(6);
      expect(blocked.length, position).toBeLessThanOrEqual(11);
      for (const slot of blocked) {
        expect(slot.drop_blocked_by, `${position} ${slot.id}`).toEqual(['cutlery_basket']);
      }
      for (const slot of slots) {
        // Never another pose than the seat of the empty machine (never upright instead).
        const same = without.find((other) => other.id === slot.id);
        expect(slot.suggested_drop, `${position} ${slot.id}`).toEqual(same?.suggested_drop);
      }
    }
  }, 60_000);

  it.each([
    ['front_centre', ['00', '06', '17', '20']],
    ['front_right', ['03', '08', '11', '12']],
  ] as const)(
    'holds the plate down on the rails, not against its tines, with the basket at %s',
    async (position, picks) => {
      const slots = await rearSlots(position);
      for (const pick of picks) {
        const slot = slots.find((candidate) => candidate.id.endsWith(`slot_${pick}`));
        expect(slot?.drop_free, pick).toBe(true);
        if (slot?.suggested_drop === undefined) continue;
        const s = await session(LEVEL);
        if (position !== 'front_centre') mustSetRack(s, 'cutlery_basket', 'position', position);
        const drop = s.place({ item_id: 'p', frame: 'lower_rack', ...slot.suggested_drop });
        expect(drop.accepted, pick).toBe(true);
        if (!drop.accepted) continue;
        // The catalogue's 27 cm plate is 30 mm deep and stands within 5 degrees of upright
        // (machine engineer, seated by a hand: -3.5 degrees); never the 15 of the tines against.
        expect(leanOf(drop.settled_pose.quat_wxyz, slot), pick).toBeGreaterThan(-6);
        expect(
          drop.settled_pose.position_mm[2] - slot.suggested_drop.position_mm[2],
          pick,
        ).toBeLessThan(5);
        expect(drop.stable, pick).toBe(true);
        expect(
          drop.contacts.some((c) => c.with.startsWith('cutlery_basket')),
          pick,
        ).toBe(false);
      }
    },
    120_000,
  );
});
