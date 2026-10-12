// The seats `list_slots` offers small plates in the rows of the Bosch's upper basket, on the
// floor of IMG_9131. A seat is a slot with `drop_free` and `drop_seats` both true, and a seat
// that is offered must hold: let go there the plate ends on edge between the tines of that
// row, stable, and stays through the travel of the basket.
//
// Two things were wrong before 2026-10-11 (loading report 4: "dessert plates and bowls find no
// seat in the upper rows; in the front half of row C such a drop falls over while listed free"):
// - Row C stands on the ramp of the floor, with the centre ridge between it and its partner
//   row B. A plate held midway between the two rails, where a seat was looked for, stands on
//   the ridge 31 mm above both rails and has no seat; let go above the tine tips there it
//   rolled down the ramp or fell over. Its seat is where the floor cradles it: down the ramp
//   against the inner face of the right ridge, 35 to 55 mm right of the rail of row C, between
//   the same two tines.
// - The tines of rows A' and B' are 57 mm high (IMG_9131; 45 before) and 18 to 20 mm apart. A
//   190 mm plate tipped forward between them wedges 3 to 4 mm above the rails, where it
//   stands, and was not counted as down in its slot.
import { describe, expect, it } from 'vitest';
import type { GameSession } from './session.ts';
import { testLevel } from './test-level.ts';
import { itemAxisZ, mustPlace, mustSetRack, useSessions } from './test-util.ts';
import type { SlotCard } from './types.ts';

const session = useSessions();

function levelOf(itemType: string): ReturnType<typeof testLevel> {
  return {
    ...testLevel(),
    id: 'upper-rows',
    items: [{ id: 'p', itemType, points: 1, soils: [] }],
  };
}

async function opened(itemType: string, knifeShelf: 'up' | 'down'): Promise<GameSession> {
  const s = await session(levelOf(itemType));
  mustSetRack(s, 'upper_rack', 'position', 'out');
  if (knifeShelf === 'up') mustSetRack(s, 'upper_rack', 'shelf_knife_shelf', 'up');
  return s;
}

function rowSlots(s: GameSession, row: string): SlotCard[] {
  const listed = s.listSlots({ rack: 'upper_rack', item_id: 'p' });
  if (!listed.accepted) throw new Error('list_slots was rejected');
  return listed.slots.filter((slot) => slot.tine_row === `tine_row_${row}`);
}

const isSeat = (slot: SlotCard): boolean => slot.drop_free === true && slot.drop_seats === true;

/** How far the face of a plate is from vertical, degrees (0: it stands upright on edge). */
function leanOf(quat: readonly [number, number, number, number]): number {
  return (Math.asin(Math.min(1, Math.abs(itemAxisZ(quat)[2]))) * 180) / Math.PI;
}

describe('small plates in the rows of the upper basket', () => {
  it.each([
    ['saucer_porcelain_140', 'a2', 8, ['00', '03', '07']],
    ['saucer_porcelain_140', 'a', 5, ['00', '04']],
    ['saucer_porcelain_140', 'c_rear', 5, ['00', '02', '04']],
    ['saucer_porcelain_140', 'c_front', 4, ['00', '03']],
    ['dessert_plate_porcelain_190', 'a2', 8, ['00', '04', '07']],
    ['dessert_plate_porcelain_190', 'a', 5, ['02']],
    ['dessert_plate_porcelain_190', 'c_rear', 5, ['01', '03']],
    ['dessert_plate_porcelain_190', 'c_front', 4, ['00', '02']],
    ['melamine_dessert_plate_iec_195', 'a2', 8, ['02', '06']],
    ['melamine_dessert_plate_iec_195', 'c_rear', 5, ['00', '04']],
  ] as const)(
    'a %s has a seat in every slot of row %s, and stands where it is seated',
    async (itemType, row, count, picks) => {
      const slots = rowSlots(await opened(itemType, 'up'), row);
      expect(slots.filter(isSeat)).toHaveLength(count);
      for (const pick of picks) {
        const slot = slots.find((candidate) => candidate.id.endsWith(`slot_${pick}`));
        if (slot?.suggested_drop === undefined) throw new Error(`no drop for slot ${pick}`);
        const s = await opened(itemType, 'up');
        const placed = mustPlace(s, { item_id: 'p', frame: 'upper_rack', ...slot.suggested_drop });
        expect(placed.stable, pick).toBe(true);
        // On edge, leaning in the gap between its tines: 2 to 21 degrees measured (the gaps
        // of rows A, B and C are 33 to 35 mm wide, a saucer 20 mm thick leans 19 in them).
        expect(leanOf(placed.settled_pose.quat_wxyz), pick).toBeLessThan(26);
        // Held by the tines of the row it was seated in, standing on the basket.
        const touches = placed.contacts.map((contact) => contact.with);
        expect(touches, pick).toContain(`upper_rack.tine_row_${row}`);
        for (const name of touches) expect(name, pick).toMatch(/^upper_rack\./);
        // Where it was put: it leans over by up to 24 mm at its middle and comes down by up
        // to 13 mm as it does (measured), no further.
        const [x, y, z] = placed.settled_pose.position_mm;
        const [ax, ay, az] = slot.suggested_drop.position_mm;
        expect(Math.hypot(x - ax, y - ay), pick).toBeLessThan(30);
        expect(az - z, pick).toBeLessThan(16);
        expect(az - z, pick).toBeGreaterThan(-2);
        // And it stays there when the basket is pushed in and pulled out.
        mustSetRack(s, 'upper_rack', 'position', 'in');
        mustSetRack(s, 'upper_rack', 'position', 'out');
        const after = s.getState().placed.find((item) => item.item_id === 'p');
        expect(after?.stable, pick).toBe(true);
        if (after === undefined) continue;
        expect(
          Math.hypot(after.position_mm[0] - x, after.position_mm[1] - y, after.position_mm[2] - z),
          pick,
        ).toBeLessThan(5);
        expect(leanOf(after.quat_wxyz), pick).toBeLessThan(26);
      }
    },
    120_000,
  );

  it('seats a plate of row C down the ramp from its rail, not on the ridge between the rails', async () => {
    const slots = rowSlots(await opened('saucer_porcelain_140', 'up'), 'c_rear');
    for (const slot of slots) {
      // The rail of row C is at x = 304 mm, that of its partner row B at 192, the centre
      // ridge at 234 to 244; the foot of the right ridge is at 382.
      expect(slot.centre_mm[0]).toBeCloseTo(304, 6);
      const x = slot.suggested_drop?.position_mm[0] ?? 0;
      expect(x, slot.id).toBeGreaterThanOrEqual(334);
      expect(x, slot.id).toBeLessThanOrEqual(362);
    }
  });

  it('offers a 190 mm plate no seat under the knife shelf when it is down, and says what is in the way', async () => {
    // The shelf lies 149.5 mm above the floor over x = 2 to 101 mm; the plate stands 190 mm
    // high across rows A and B, from x = 67 to 257.
    const slots = rowSlots(await opened('dessert_plate_porcelain_190', 'down'), 'a');
    expect(slots).toHaveLength(5);
    expect(slots.filter(isSeat)).toHaveLength(0);
    // In row C, clear of the shelf, it has its seats all the same.
    const clear = rowSlots(await opened('dessert_plate_porcelain_190', 'down'), 'c_rear');
    expect(clear.filter(isSeat)).toHaveLength(5);
  }, 60_000);

  it('offers a small bowl its seats in rows A and B, and elsewhere only a pose that is marked as no seat', async () => {
    const s = await opened('dessert_bowl_vitrelle_130', 'up');
    expect(rowSlots(s, 'a').filter(isSeat)).toHaveLength(5);
    for (const row of ['a2', 'b2', 'c_rear', 'c_front']) {
      for (const slot of rowSlots(s, row)) {
        // It does not come down between these tines: the pose is above their tips, and
        // `drop_seats` says so (let go there the bowl falls over: measured in all 25 slots).
        expect(slot.drop_seats, slot.id).toBe(false);
      }
    }
  }, 60_000);
  // Review of the loading, 2026-10-11: a 170 mm plate seated on the floor beside the rail of
  // row C leans with its lower edge 0.7 mm beyond the foot of the far tine, the slot was not
  // seen as taken, and three plates were let into one slot, where they ended touching.
  it.each([
    ['bread_plate_vitrelle_170', 'c_front', '02'],
    ['saucer_porcelain_140', 'c_rear', '01'],
  ] as const)(
    'does not offer the slot of a %s in row %s again once one is seated in it',
    async (itemType, row, pick) => {
      const s = await session({
        ...testLevel(),
        id: 'upper-rows-twice',
        items: ['p', 'q'].map((id) => ({ id, itemType, points: 1, soils: [] })),
      });
      mustSetRack(s, 'upper_rack', 'position', 'out');
      mustSetRack(s, 'upper_rack', 'shelf_knife_shelf', 'up');
      const first = rowSlots(s, row).find((slot) => slot.id.endsWith(`slot_${pick}`));
      if (first?.suggested_drop === undefined || !isSeat(first)) throw new Error('no seat');
      mustPlace(s, { item_id: 'p', frame: 'upper_rack', ...first.suggested_drop });
      const listed = s.listSlots({ rack: 'upper_rack', item_id: 'q' });
      if (!listed.accepted) throw new Error('list_slots was rejected');
      const again = listed.slots.find((slot) => slot.id === first.id);
      expect(again?.drop_free).toBe(false);
      expect(again?.drop_blocked_by).toEqual(['p']);
      // The row is not closed by it: another of its slots is still a seat.
      expect(
        listed.slots.filter((slot) => slot.tine_row === `tine_row_${row}` && isSeat(slot)).length,
      ).toBeGreaterThan(0);
    },
    60_000,
  );
});
