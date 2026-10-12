// The cup shelves of the Bosch's upper basket, folded down. `list_slots` gives each as a slot
// of kind `cup_shelf`, and for a cup, a mug or a small glass the pose to let it go at: mouth
// down and level in the middle of the shelf, its handle along the shelf, the rearmost place
// that is free. A seat that is offered must hold: the vessel stands level on the shelf and
// stays through the travel of the basket. (Review of the loading, 2026-10-11: with the shelves
// lowered, cups and mugs were offered no pose at all, although cups set there by hand stood.)
//
// The height of a lowered shelf (93.5 and 97.5 mm) is inferred from the folded shelf in
// IMG_9131, +12 -6 mm: these tests say that a cup stands on the shelf as it is drawn, not that
// the shelf is at that height.
import { describe, expect, it } from 'vitest';
import type { GameSession } from './session.ts';
import { testLevel } from './test-level.ts';
import { itemAxisZ, mustPlace, mustSetRack, useSessions } from './test-util.ts';
import type { SlotCard } from './types.ts';

const session = useSessions();

async function shelvesDown(itemType: string, count: number): Promise<GameSession> {
  const s = await session({
    ...testLevel(),
    id: 'shelves',
    items: Array.from({ length: count }, (_, i) => ({
      id: `v${i}`,
      itemType,
      points: 1,
      soils: [],
    })),
  });
  mustSetRack(s, 'upper_rack', 'position', 'out');
  mustSetRack(s, 'upper_rack', 'shelf_cup_front', 'down');
  mustSetRack(s, 'upper_rack', 'shelf_cup_rear', 'down');
  return s;
}

function shelves(s: GameSession, itemId: string): SlotCard[] {
  const listed = s.listSlots({ rack: 'upper_rack', item_id: itemId });
  if (!listed.accepted) throw new Error('list_slots was rejected');
  return listed.slots.filter((slot) => slot.kind === 'cup_shelf');
}

/** Lean of a settled vessel from mouth down, degrees. */
function leanOf(quat: readonly [number, number, number, number]): number {
  return 180 - (Math.acos(Math.max(-1, Math.min(1, itemAxisZ(quat)[2]))) * 180) / Math.PI;
}

describe('the cup shelves of the upper basket, folded down', () => {
  it.each([
    ['tea_cup_porcelain_210', 3],
    ['mug_ceramic_300', 3],
    ['espresso_cup_porcelain_80', 4],
  ] as const)(
    'seat %s: %i on the two shelves, level, and they stay through the travel of the basket',
    async (itemType, count) => {
      const s = await shelvesDown(itemType, count + 1);
      for (let i = 0; i < count; i++) {
        const seat = shelves(s, `v${i}`).find((slot) => slot.drop_free === true);
        if (seat?.suggested_drop === undefined) throw new Error(`no seat for vessel ${i}`);
        const placed = mustPlace(s, {
          item_id: `v${i}`,
          frame: 'upper_rack',
          ...seat.suggested_drop,
        });
        expect(placed.stable, `v${i}`).toBe(true);
        expect(placed.displacement_mm, `v${i}`).toBeLessThan(3);
        expect(placed.moved_items, `v${i}`).toEqual([]);
        expect(
          placed.contacts.map((c) => c.with),
          `v${i}`,
        ).toEqual([`upper_rack_fittings.shelf.${seat.id.replace('shelf_', '')}`]);
      }
      // The shelves are full: the next one is offered no free seat on them.
      expect(shelves(s, `v${count}`).some((slot) => slot.drop_free === true)).toBe(false);
      const before = new Map(s.getState().placed.map((p) => [p.item_id, p.position_mm]));
      mustSetRack(s, 'upper_rack', 'position', 'in');
      mustSetRack(s, 'upper_rack', 'position', 'out');
      for (const item of s.getState().placed) {
        const was = before.get(item.item_id) as readonly [number, number, number];
        const moved = Math.hypot(
          item.position_mm[0] - was[0],
          item.position_mm[1] - was[1],
          item.position_mm[2] - was[2],
        );
        expect(moved, item.item_id).toBeLessThan(1);
        expect(leanOf(item.quat_wxyz), item.item_id).toBeLessThan(3);
        expect(item.stable, item.item_id).toBe(true);
      }
    },
    60_000,
  );

  it('offer nothing to what would be knocked off when the basket goes in, or to a plate', async () => {
    // A 200 mm wine glass on a shelf 94 mm up stands 73 mm through the roof.
    const glass = await shelvesDown('wine_glass_generic_200', 1);
    for (const slot of shelves(glass, 'v0')) expect(slot.suggested_drop).toBeUndefined();
    const plate = await shelvesDown('saucer_porcelain_140', 1);
    for (const slot of shelves(plate, 'v0')) expect(slot.suggested_drop).toBeUndefined();
  });

  it('are listed without a pose while they are folded up', async () => {
    const s = await session({
      ...testLevel(),
      id: 'shelves-up',
      items: [{ id: 'v0', itemType: 'tea_cup_porcelain_210', points: 1, soils: [] }],
    });
    mustSetRack(s, 'upper_rack', 'position', 'out');
    expect(shelves(s, 'v0')).toEqual([]);
  });
});
