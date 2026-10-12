// A player who follows `list_slots` for the plates of the standard load ends with correctly
// loaded rows: every plate down in its slot on the floor of the basket, leaning the way the
// machine engineer established for its kind (docs: packages/machine/src/geometry/
// plate-rows.test.ts, seated by a hand in a world with the basket alone), none touching its
// neighbour, in any order of filling, and still so after the basket has been pushed in and
// pulled out.
import type { Level } from '@spotless/levels';
import { describe, expect, it } from 'vitest';
import type { GameSession } from './session.ts';
import { testLevel } from './test-level.ts';
import { itemAxisZ, mustPlace, mustSetRack, useSessions } from './test-util.ts';
import type { DropAccepted, SlotCard } from './types.ts';

const session = useSessions();

function levelOf(types: readonly (readonly [string, number])[]): Level {
  const items = types.flatMap(([itemType, count]) =>
    Array.from({ length: count }, (_, i) => ({
      id: `${itemType.split('_')[0]}_${String(i + 1).padStart(2, '0')}`,
      itemType,
      points: 1,
      soils: [],
    })),
  );
  return { ...testLevel(), id: 'rows', items };
}

/** Lean of a settled plate from the vertical, degrees: positive with the tines of its slot. */
function leanOf(drop: DropAccepted, slot: SlotCard): number {
  const face = itemAxisZ(drop.settled_pose.quat_wxyz);
  const sign = slot.lean_toward?.startsWith('-') === true ? -1 : 1;
  const along = slot.lean_toward?.endsWith('x') === true ? 0 : 1;
  return (Math.atan2(face[2], -sign * (face[along] as number)) * 180) / Math.PI;
}

/** Seats an item in the free seat of the given rows that `pick` likes best. */
function seat(
  s: GameSession,
  itemId: string,
  rows: readonly string[],
  pick: (slot: SlotCard) => number,
): { drop: DropAccepted; slot: SlotCard } {
  const listed = s.listSlots({ rack: 'lower_rack', item_id: itemId });
  if (!listed.accepted) throw new Error('list_slots was rejected');
  const free = listed.slots
    .filter(
      (slot) =>
        rows.includes(slot.tine_row ?? '') && slot.drop_free === true && slot.drop_seats === true,
    )
    .sort((a, b) => pick(a) - pick(b) || (a.id < b.id ? -1 : 1));
  const slot = free[0];
  if (slot?.suggested_drop === undefined) throw new Error(`no free seat for ${itemId}`);
  return {
    drop: mustPlace(s, { item_id: itemId, frame: 'lower_rack', ...slot.suggested_drop }),
    slot,
  };
}

describe('plates seated where list_slots suggests', () => {
  it.each([
    [
      'from the walls inwards',
      (slot: SlotCard) => Math.min(slot.centre_mm[0], 525 - slot.centre_mm[0]),
    ],
    ['from the middle outwards', (slot: SlotCard) => Math.abs(slot.centre_mm[0] - 262)],
    [
      'every second gap first',
      (slot: SlotCard) => (Number(slot.id.slice(-2)) % 2) * 1000 + slot.centre_mm[0],
    ],
  ] as const)(
    'thirteen dinner plates stand in thirteen gaps of the rear rows, filled %s',
    async (_name, pick) => {
      const s = await session(levelOf([['dinner_plate_porcelain_iec', 13]]));
      const leans: number[] = [];
      for (let i = 1; i <= 13; i++) {
        const { drop, slot } = seat(
          s,
          `dinner_${String(i).padStart(2, '0')}`,
          ['tine_row_r1'],
          pick,
        );
        expect(drop.stable, slot.id).toBe(true);
        expect(drop.resting?.on_base, slot.id).toBe(true);
        expect(drop.moved_items, slot.id).toEqual([]);
        // On the rails and the tines of its rows, and on nothing else.
        expect(drop.contacts.map((c) => c.with).sort(), slot.id).toEqual([
          'lower_rack.tine_row_r1',
          'lower_rack.tine_row_r2',
        ]);
        // Let go within a few millimetres of where it comes to rest (in the gap where the row
        // changes its lean, where no tine leans, it lies back further: 14 mm).
        expect(drop.displacement_mm, slot.id).toBeLessThan(slot.kind === 'wide_slot' ? 16 : 8);
        leans.push(leanOf(drop, slot));
      }
      // With the tines, as the machine engineer measured (4.2 degrees in the narrow gaps, more
      // in the wide gap at the right end and upright in the gap where the row changes its lean).
      for (const lean of leans) {
        expect(lean).toBeGreaterThan(2);
        expect(lean).toBeLessThan(14);
      }
      expect(leans.filter((lean) => Math.abs(lean - 4.2) < 0.6).length).toBeGreaterThanOrEqual(11);
      // The basket goes in and comes out again and nothing has moved by more than the knock.
      for (const position of ['in', 'out'] as const) {
        const moved = mustSetRack(s, 'lower_rack', 'position', position);
        for (const item of moved.moved_items) expect(item.displacement_mm).toBeLessThan(3);
        expect(moved.state.placed.every((p) => p.stable)).toBe(true);
        for (const placed of moved.state.placed) {
          expect(placed.contacts.every((c) => c.with.startsWith('lower_rack'))).toBe(true);
        }
      }
    },
    240_000,
  );

  it('soup plates stand upright in the side rows, dessert plates and saucers lie back with the tines', async () => {
    const s = await session(
      levelOf([
        ['soup_plate_porcelain_230', 4],
        ['dessert_plate_porcelain_190', 4],
        ['saucer_porcelain_140', 3],
        ['melamine_dessert_plate_iec_195', 3],
      ]),
    );
    const wall = (slot: SlotCard): number => Math.min(slot.centre_mm[0], 525 - slot.centre_mm[0]);
    // Soup plates (40 mm deep) in the wide gaps of the side rows: within 5 degrees of upright.
    for (let i = 1; i <= 4; i++) {
      const { drop, slot } = seat(
        s,
        `soup_${String(i).padStart(2, '0')}`,
        ['tine_row_ml', 'tine_row_mr'],
        wall,
      );
      expect(drop.stable, slot.id).toBe(true);
      expect(drop.resting?.on_base, slot.id).toBe(true);
      expect(Math.abs(leanOf(drop, slot)), slot.id).toBeLessThan(5);
      expect(
        drop.contacts.every((c) => c.with.startsWith('lower_rack')),
        slot.id,
      ).toBe(true);
    }
    // The shallow plates in the rear rows: with the tines, 8 to 21 degrees (10.3, 11.2 and
    // 18.7 in the narrow gaps; a dessert plate lies back to 18 in the wide gap at the end).
    for (const [prefix, count, low, high] of [
      ['dessert', 4, 8, 19],
      ['melamine', 3, 9, 19],
      ['saucer', 3, 16, 21],
    ] as const) {
      for (let i = 1; i <= count; i++) {
        const { drop, slot } = seat(
          s,
          `${prefix}_${String(i).padStart(2, '0')}`,
          ['tine_row_r1'],
          wall,
        );
        expect(drop.stable, slot.id).toBe(true);
        const lean = leanOf(drop, slot);
        expect(lean, `${prefix} in ${slot.id}`).toBeGreaterThan(low);
        expect(lean, `${prefix} in ${slot.id}`).toBeLessThan(high);
        expect(
          drop.contacts.every((c) => c.with.startsWith('lower_rack')),
          slot.id,
        ).toBe(true);
        expect(drop.moved_items, slot.id).toEqual([]);
      }
    }
  }, 240_000);

  it('says that a deep plate does not come down in a slot where it does not, and names who took a seat', async () => {
    const s = await session(
      levelOf([
        ['dinner_plate_porcelain_iec', 2],
        ['cereal_bowl_porcelain_160', 1],
      ]),
    );
    const bowl = s.listSlots({ rack: 'lower_rack', item_id: 'cereal_01' });
    if (!bowl.accepted) throw new Error('rejected');
    const narrow = bowl.slots.find((slot) => slot.id === 'tine_row_r1.slot_05');
    expect(narrow?.drop_perches).toBe(true);
    expect(narrow?.drop_seats).toBe(false);
    const { slot } = seat(s, 'dinner_01', ['tine_row_r1'], (x) => Math.abs(x.centre_mm[0] - 150));
    const after = s.listSlots({ rack: 'lower_rack', item_id: 'dinner_02' });
    if (!after.accepted) throw new Error('rejected');
    const taken = after.slots.find((x) => x.id === slot.id);
    expect(taken?.drop_free).toBe(false);
    expect(taken?.drop_blocked_by).toEqual(['dinner_01']);
    // The same seat seen from the partner row.
    const twin = after.slots.find((x) => x.id === slot.id.replace('r1', 'r2'));
    expect(twin?.drop_free).toBe(false);
    // Its neighbours on both sides are still free.
    const index = Number(slot.id.slice(-2));
    for (const beside of [index - 1, index + 1]) {
      const id = `tine_row_r1.slot_${String(beside).padStart(2, '0')}`;
      expect(after.slots.find((x) => x.id === id)?.drop_free, id).toBe(true);
    }
  }, 120_000);
});
