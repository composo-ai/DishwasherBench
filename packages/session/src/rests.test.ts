// The sloped rests along the side walls of the Bosch's upper basket (IMG_9131: the floor falls
// 33 and 35 degrees from a ridge 150 mm either side of the middle to the low floor by each
// wall). `list_slots` offers each as a slot of kind `cup_rest`, and for a cup, a mug or a glass
// the pose to let it go at: mouth down, tilted towards the wall with the slope, a millimetre
// above where it touches. A seat that is offered must hold: let go there the vessel ends where
// it was put, leaning with the rest, stable, and it stays through the travel of the basket.
// Stemware, bottles and jugs are offered nothing there (a 200 mm wine glass leaning on a rest
// is carried off when the basket is pushed in).
import { describe, expect, it } from 'vitest';
import type { GameSession } from './session.ts';
import { testLevel } from './test-level.ts';
import { itemAxisZ, mustPlace, mustSetRack, useSessions } from './test-util.ts';
import type { SlotCard } from './types.ts';

const session = useSessions();

function levelOf(types: readonly string[]): ReturnType<typeof testLevel> {
  return {
    ...testLevel(),
    id: 'rests',
    items: types.map((itemType, i) => ({ id: `v${i}`, itemType, points: 1, soils: [] })),
  };
}

/** Lean of a settled vessel from mouth down, degrees, and how much of it is towards +x. */
function leanOf(quat: readonly [number, number, number, number]): { deg: number; x: number } {
  const axis = itemAxisZ(quat);
  return {
    deg: 180 - (Math.acos(Math.max(-1, Math.min(1, axis[2]))) * 180) / Math.PI,
    x: -axis[0],
  };
}

function rests(s: GameSession, itemId?: string): SlotCard[] {
  const listed = s.listSlots({
    rack: 'upper_rack',
    ...(itemId === undefined ? {} : { item_id: itemId }),
  });
  if (!listed.accepted) throw new Error('list_slots was rejected');
  return listed.slots.filter((slot) => slot.kind === 'cup_rest');
}

async function pulledOut(
  types: readonly string[],
  knifeShelf: 'up' | 'down',
): Promise<GameSession> {
  const s = await session(levelOf(types));
  mustSetRack(s, 'upper_rack', 'position', 'out');
  if (knifeShelf === 'up') mustSetRack(s, 'upper_rack', 'shelf_knife_shelf', 'up');
  return s;
}

describe('the side rests of the upper basket', () => {
  it('are listed as cup_rest slots with their slope and the wall they fall towards', async () => {
    const s = await pulledOut(['mug_ceramic_300'], 'down');
    const slots = rests(s);
    expect(slots.map((slot) => slot.id)).toEqual(['rest_left', 'rest_right']);
    const [left, right] = slots as [SlotCard, SlotCard];
    expect(left.lean_toward).toBe('-x');
    expect(right.lean_toward).toBe('+x');
    // 33.3 and 35.4 degrees (the machine data, from IMG_9131), to a tenth of a degree.
    expect(left.lean_deg).toBeCloseTo(33.3, 1);
    expect(right.lean_deg).toBeCloseTo(35.4, 1);
    // Wall to ridge: 86.6 mm on the left (5.1 to 91.7), 107.1 on the right (387.8 to 494.9).
    expect(left.width_mm).toBeCloseTo(86.6, 1);
    expect(right.width_mm).toBeCloseTo(107.1, 1);
    // Without an item, and for the lower basket, no pose is suggested.
    expect(left.suggested_drop).toBeUndefined();
    const lower = s.listSlots({ rack: 'lower_rack' });
    expect(lower.accepted && lower.slots.some((slot) => slot.kind === 'cup_rest')).toBe(false);
  });

  it.each([
    'mug_ceramic_300',
    'mug_porcelain_240',
    'tea_cup_porcelain_210',
    'espresso_cup_porcelain_80',
    'tumbler_250',
    'test_glass_borosilicate_250',
    'tumbler_360',
    'pint_glass_473',
  ])(
    'hold a %s where it is offered a seat, on either side',
    async (itemType) => {
      for (const id of ['rest_left', 'rest_right']) {
        const s = await pulledOut([itemType], 'up');
        const slot = rests(s, 'v0').find((candidate) => candidate.id === id);
        expect(slot?.drop_free, id).toBe(true);
        if (slot?.suggested_drop === undefined) continue;
        const drop = slot.suggested_drop;
        // Tilted towards the wall by no more than the slope, on the whole-degree grid.
        const roll = drop.orientation.roll_deg ?? 0;
        expect(Math.sign(roll), id).toBe(id === 'rest_left' ? -1 : 1);
        expect(Math.abs(roll), id).toBeLessThanOrEqual(36);
        const placed = mustPlace(s, {
          item_id: 'v0',
          frame: 'upper_rack',
          position_mm: drop.position_mm,
          orientation: drop.orientation,
        });
        // It was let go a millimetre or two above where it touches and has settled by little:
        // measured 0.2 to 10.5 mm over the catalogue's vessels.
        expect(placed.displacement_mm, id).toBeLessThan(16);
        expect(placed.stable, id).toBe(true);
        const lean = leanOf(placed.settled_pose.quat_wxyz);
        // Leaning towards its wall, by the slope at most and a little (measured 16 to 34).
        expect(lean.deg, id).toBeGreaterThan(10);
        expect(lean.deg, id).toBeLessThan(40);
        expect(Math.sign(lean.x), id).toBe(id === 'rest_left' ? -1 : 1);
        // Carried by the floor wires of the basket, and by a folded shelf at most besides.
        const touches = placed.contacts.map((contact) => contact.with);
        expect(
          touches.some((name) => name.startsWith('upper_rack.floor')),
          id,
        ).toBe(true);
        for (const name of touches) expect(name, id).toMatch(/^upper_rack(_fittings)?\./);
      }
    },
    60_000,
  );

  it.each(['mug_ceramic_300', 'tea_cup_porcelain_210', 'test_glass_borosilicate_250'])(
    'keep a %s through the travel of the basket, under the knife shelf folded down over it',
    async (itemType) => {
      const s = await pulledOut([itemType, itemType], 'up');
      const before: { [id: string]: readonly [number, number, number] } = {};
      for (const [itemId, id] of [
        ['v0', 'rest_left'],
        ['v1', 'rest_right'],
      ] as const) {
        const drop = rests(s, itemId).find((slot) => slot.id === id)?.suggested_drop;
        if (drop === undefined) throw new Error(`no seat on ${id}`);
        const placed = mustPlace(s, { item_id: itemId, frame: 'upper_rack', ...drop });
        before[itemId] = placed.settled_pose.position_mm;
      }
      // The knife shelf comes down over what stands on the left rest (its underside is
      // 149.5 mm above the floor wires).
      mustSetRack(s, 'upper_rack', 'shelf_knife_shelf', 'down');
      mustSetRack(s, 'upper_rack', 'position', 'in');
      mustSetRack(s, 'upper_rack', 'position', 'out');
      for (const item of s.getState().placed) {
        const was = before[item.item_id] as readonly [number, number, number];
        const moved = Math.hypot(
          item.position_mm[0] - was[0],
          item.position_mm[1] - was[1],
          item.position_mm[2] - was[2],
        );
        // Measured 0.2 to 6.1 mm over the catalogue's vessels.
        expect(moved, item.item_id).toBeLessThan(10);
        expect(item.stable, item.item_id).toBe(true);
        expect(leanOf(item.quat_wxyz).deg, item.item_id).toBeLessThan(40);
      }
      const check = s.checkLoad();
      expect(check.accepted && check.protruding).toEqual([]);
    },
    60_000,
  );

  it('offer nothing to stemware, bottles, jugs, bowls and plates', async () => {
    const types = [
      'wine_glass_generic_200',
      'champagne_flute_170',
      'water_bottle_generic_200',
      'measuring_jug_glass_500',
      'dessert_bowl_vitrelle_130',
      'saucer_porcelain_140',
    ];
    const s = await pulledOut(types, 'up');
    types.forEach((itemType, i) => {
      for (const slot of rests(s, `v${i}`)) {
        expect(slot.suggested_drop, `${itemType} ${slot.id}`).toBeUndefined();
        expect(slot.drop_free, `${itemType} ${slot.id}`).toBeUndefined();
      }
    });
  });

  it('name the shelf that is folded down over a seat, and give the seat all the same', async () => {
    // The knife shelf is down by default: it lies over the left rest from 105 mm behind the
    // front of the basket to the rear.
    const s = await pulledOut(['mug_ceramic_300'], 'down');
    const left = rests(s, 'v0').find((slot) => slot.id === 'rest_left');
    expect(left?.suggested_drop).toBeDefined();
    expect(left?.drop_free).toBe(false);
    expect(left?.drop_blocked_by).toEqual(['upper_rack_fittings.holder.knife_shelf.floor']);
    // `place` refuses the same pose and names the same part.
    if (left?.suggested_drop === undefined) return;
    const refused = s.place({ item_id: 'v0', frame: 'upper_rack', ...left.suggested_drop });
    expect(refused).toMatchObject({
      accepted: false,
      reason: 'not_insertable',
      blocked_by: 'upper_rack_fittings.holder.knife_shelf.floor',
    });
    // With the shelf folded up the same seat is free.
    mustSetRack(s, 'upper_rack', 'shelf_knife_shelf', 'up');
    const open = rests(s, 'v0').find((slot) => slot.id === 'rest_left');
    expect(open?.drop_free).toBe(true);
  });

  it('seat one vessel after another along a rest, from the rear forwards, clear of each other', async () => {
    const types = Array.from({ length: 6 }, () => 'mug_ceramic_300');
    const s = await pulledOut(types, 'up');
    const ys: number[] = [];
    for (let i = 0; i < types.length; i++) {
      const slot = rests(s, `v${i}`).find((candidate) => candidate.id === 'rest_right');
      if (slot?.drop_free !== true || slot.suggested_drop === undefined) break;
      const placed = mustPlace(s, {
        item_id: `v${i}`,
        frame: 'upper_rack',
        ...slot.suggested_drop,
      });
      // Nothing that stood there before is pushed about.
      expect(placed.moved_items, `mug ${i}`).toEqual([]);
      expect(placed.stable, `mug ${i}`).toBe(true);
      ys.push(placed.settled_pose.position_mm[1]);
    }
    // A mug with its handle along the rest is 110 mm long: four stand on the 488 mm of a rest.
    expect(ys).toHaveLength(4);
    for (let i = 1; i < ys.length; i++) {
      expect((ys[i - 1] as number) - (ys[i] as number), `mug ${i}`).toBeGreaterThan(110);
    }
    // A fifth is offered no seat: the rest is full.
    const full = rests(s, 'v4').find((candidate) => candidate.id === 'rest_right');
    expect(full?.drop_free).not.toBe(true);
  }, 60_000);

  it('gives heights a player can use directly on a rest, and names the floor when a pose is in it', async () => {
    // The lead's note of 2026-10-11: models asked for poses a few millimetres into the floor
    // of this basket and were told only `upper_rack`. On the sloped floor the height at which
    // a tilted cup touches is not something to work out by hand: `preview` gives it for any
    // pose (`lowered_pose`), `list_slots` for the seat, and a pose that is in the floor is
    // refused with the wires it is in.
    const s = await pulledOut(['tea_cup_porcelain_210'], 'up');
    const seat = rests(s, 'v0').find((slot) => slot.id === 'rest_left')?.suggested_drop;
    if (seat === undefined) throw new Error('no seat');
    const [x, y, z] = seat.position_mm;
    // Held 60 mm higher at the seat's own tilt: free, reachable, and `lowered_pose` comes down
    // to within the millimetre the seat is lifted by.
    const above = s.preview({
      item_id: 'v0',
      frame: 'upper_rack',
      position_mm: [x, y, z + 60],
      orientation: seat.orientation,
    });
    expect(above).toMatchObject({ accepted: true, collision_free: true, insertable: true });
    const lowered = above.accepted ? above.lowered_pose : null;
    expect(lowered).not.toBeNull();
    if (lowered === null) return;
    expect(z - lowered.position_mm[2]).toBeGreaterThanOrEqual(0);
    expect(z - lowered.position_mm[2]).toBeLessThan(2.5);
    // 4 mm lower than the seat it is in the floor wires: the refusal says which.
    const sunk = s.place({
      item_id: 'v0',
      frame: 'upper_rack',
      position_mm: [x, y, z - 4],
      orientation: seat.orientation,
    });
    expect(sunk).toMatchObject({ accepted: false, reason: 'collision_at_pose' });
    if (!sunk.accepted) {
      expect(sunk.colliding_with?.length).toBeGreaterThan(0);
      for (const name of sunk.colliding_with ?? [])
        expect(name).toMatch(/^upper_rack\.floor\.[xy]$/);
    }
    // At the height `preview` gave, rounded up to the millimetre, `place` takes it.
    const placed = mustPlace(s, {
      item_id: 'v0',
      frame: 'upper_rack',
      position_mm: [x, y, Math.ceil(lowered.position_mm[2])],
      orientation: seat.orientation,
    });
    expect(placed.stable).toBe(true);
  });
});
