// The loose cutlery basket: `set_rack` stands it at one of the named places of the machine or
// takes it out, only while it is empty and where nothing is in its way; the slots it stands
// over are marked; and a long piece let down by its lower end stands in its cell.
import type { Level } from '@spotless/levels';
import { describe, expect, it } from 'vitest';
import { testLevel } from './test-level.ts';
import { mustPlace, useSessions } from './test-util.ts';
import type { SlotCard } from './types.ts';

const session = useSessions();

function blockedSlots(slots: readonly SlotCard[]): string[] {
  return slots
    .filter((slot) => slot.drop_blocked_by?.includes('cutlery_basket') === true)
    .map((slot) => slot.id)
    .sort();
}

describe('where the cutlery basket stands', () => {
  it('is an option of the cutlery basket on the level card and in the scene state', async () => {
    const s = await session(testLevel());
    const card = s.getLevel().machine.racks.find((r) => r.rack === 'cutlery_basket');
    const option = card?.options.find((o) => o.name === 'position');
    expect(option?.values).toEqual(['front_centre', 'front_right', 'front_left', 'out']);
    // The lower basket does not list it among its own.
    const lower = s.getLevel().machine.racks.find((r) => r.rack === 'lower_rack');
    expect(lower?.options.map((o) => o.name)).toEqual(['position', 'tine_row_r1', 'tine_row_r2']);
    expect(s.getState().rack_options['cutlery_basket.position']).toBe('front_centre');
  });

  it('moves to the front right, where the owner stands it, and frees and covers other slots', async () => {
    const s = await session(testLevel());
    const before = s.listSlots({ rack: 'lower_rack', item_id: 'dessert_plate_01' });
    if (!before.accepted) throw new Error('rejected');
    expect(blockedSlots(before.slots)).toEqual([
      'tine_row_fr.slot_00',
      'tine_row_ml.slot_05',
      'tine_row_mr.slot_00',
    ]);
    const hashBefore = s.getState().state_hash;
    const xBefore = s.bodyPoses().parts['cutlery_basket']?.p[0] as number;
    const moved = s.setRack({
      rack: 'cutlery_basket',
      option: { name: 'position', value: 'front_right' },
    });
    expect(moved.accepted).toBe(true);
    if (!moved.accepted) return;
    expect(moved.state.rack_options['cutlery_basket.position']).toBe('front_right');
    expect(moved.state_hash).not.toBe(hashBefore);
    expect(moved.state.budget.actions_used).toBe(1);
    // 102 mm to the right of the front centre: its centre at x 372.5 mm of the rack frame, the
    // machine engineer's reading of the owner's loaded photograph (110 +-12 mm right of the
    // middle of the basket).
    const xAfter = s.bodyPoses().parts['cutlery_basket']?.p[0] as number;
    expect((xAfter - xBefore) * 1000).toBeCloseTo(102, 3);
    const after = s.listSlots({ rack: 'lower_rack', item_id: 'dessert_plate_01' });
    if (!after.accepted) throw new Error('rejected');
    const covered = blockedSlots(after.slots);
    expect(covered).not.toContain('tine_row_ml.slot_05');
    expect(covered.length).toBeGreaterThanOrEqual(3);
    expect(
      covered.every((id) => id.startsWith('tine_row_mr') || id.startsWith('tine_row_fr')),
    ).toBe(true);
    // A plate now goes into the slot the basket stood over, and cutlery into the basket.
    const freed = after.slots.find((slot) => slot.id === 'tine_row_ml.slot_05');
    expect(freed?.drop_free).toBe(true);
    const plate = mustPlace(s, {
      item_id: 'dessert_plate_01',
      frame: 'lower_rack',
      ...(freed?.suggested_drop as NonNullable<SlotCard['suggested_drop']>),
    });
    expect(plate.stable).toBe(true);
    expect(plate.contacts.every((c) => c.with.startsWith('lower_rack'))).toBe(true);
    const cells = s.listSlots({ rack: 'cutlery_basket', item_id: 'fork_01' });
    if (!cells.accepted) throw new Error('rejected');
    const fork = mustPlace(s, {
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      ...(cells.slots[0]?.suggested_drop as NonNullable<SlotCard['suggested_drop']>),
    });
    expect(fork.contacts.every((c) => c.with.startsWith('cutlery_basket'))).toBe(true);
    expect(fork.fell_out).toBe(false);

    // With a fork in it, it stays where it is.
    const loaded = s.setRack({
      rack: 'cutlery_basket',
      option: { name: 'position', value: 'front_left' },
    });
    expect(loaded).toMatchObject({ accepted: false, reason: 'blocked', blocked_by: ['fork_01'] });
    // And it does not go back to where the plate now stands.
    expect(s.remove({ item_id: 'fork_01' }).accepted).toBe(true);
    const back = s.setRack({
      rack: 'cutlery_basket',
      option: { name: 'position', value: 'front_centre' },
    });
    expect(back).toMatchObject({
      accepted: false,
      reason: 'blocked',
      blocked_by: ['dessert_plate_01'],
    });
    expect(s.getState().rack_options['cutlery_basket.position']).toBe('front_right');
  }, 120_000);

  it('can be taken out and put back; without it the machine has no cutlery frame', async () => {
    const s = await session(testLevel());
    const out = s.setRack({ rack: 'cutlery_basket', option: { name: 'position', value: 'out' } });
    expect(out.accepted).toBe(true);
    expect(s.getState().rack_options['cutlery_basket.position']).toBe('out');
    expect(s.bodyPoses().parts['cutlery_basket']).toBeUndefined();
    const fork = s.place({
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      position_mm: [25, 34, 109],
      orientation: { preset: 'handle_down' },
    });
    expect(fork).toMatchObject({ accepted: false, reason: 'invalid_argument' });
    expect(s.listSlots({ rack: 'cutlery_basket' })).toMatchObject({
      accepted: false,
      reason: 'unknown_rack',
    });
    // Every slot of the side rows is free again.
    const slots = s.listSlots({ rack: 'lower_rack', item_id: 'dessert_plate_01' });
    if (!slots.accepted) throw new Error('rejected');
    expect(blockedSlots(slots.slots)).toEqual([]);
    const again = s.setRack({
      rack: 'cutlery_basket',
      option: { name: 'position', value: 'front_left' },
    });
    expect(again.accepted).toBe(true);
    expect(s.getState().rack_options['cutlery_basket.position']).toBe('front_left');
    // Same value again is refused like for any option, an unknown one too.
    expect(
      s.setRack({ rack: 'cutlery_basket', option: { name: 'position', value: 'front_left' } }),
    ).toMatchObject({ accepted: false, reason: 'invalid_argument' });
  }, 60_000);

  it('the wash manifest carries where it stood', async () => {
    const s = await session(testLevel());
    expect(
      s.setRack({ rack: 'cutlery_basket', option: { name: 'position', value: 'front_right' } })
        .accepted,
    ).toBe(true);
    const started = s.startCycle();
    expect(started.accepted).toBe(true);
    if (!started.accepted) return;
    expect(started.load.rack_options['cutlery_basket.position']).toBe('front_right');
    const centre = s.washManifest()?.machine_config.cutleryBasket?.centre;
    expect(centre?.[0]).toBeCloseTo(0.3725, 6);
    await s.washSettled();
  }, 60_000);
});

describe('long cutlery let down by its lower end', () => {
  it('a ladle and a serving spoon stand in their cells, not beside the basket or through its floor', async () => {
    const level: Level = {
      ...testLevel(),
      id: 'ladle',
      items: [
        { id: 'ladle_01', itemType: 'ladle_steel_311', points: 1, soils: [] },
        { id: 'serving_spoon_01', itemType: 'serving_spoon_216', points: 1, soils: [] },
        { id: 'soup_spoon_01', itemType: 'soup_spoon_190', points: 1, soils: [] },
      ],
    };
    const s = await session(level);
    for (const [id, cellId] of [
      ['ladle_01', 'cell_c01'],
      ['serving_spoon_01', 'cell_c12'],
      ['soup_spoon_01', 'cell_c03'],
    ] as const) {
      const cells = s.listSlots({ rack: 'cutlery_basket', item_id: id });
      if (!cells.accepted) throw new Error('rejected');
      const cell = cells.slots.find((slot) => slot.id === cellId) as SlotCard;
      expect(cell.suggested_drop, `${id} in ${cellId}`).toBeDefined();
      const drop = mustPlace(s, {
        item_id: id,
        frame: 'cutlery_basket',
        ...(cell.suggested_drop as NonNullable<SlotCard['suggested_drop']>),
      });
      expect(drop.fell_out, id).toBe(false);
      expect(drop.fell_through, id).toBe(false);
      // Its lowest point is on the floor of the cell, 6 mm above the feet of the basket.
      expect(drop.resting?.lowest_point_mm, id).toBeGreaterThan(4);
      expect(drop.resting?.lowest_point_mm, id).toBeLessThan(12);
      expect(
        drop.contacts.every((c) => c.with.startsWith('cutlery_basket')),
        id,
      ).toBe(true);
      expect(drop.stable, id).toBe(true);
    }
    // And the baskets go in with them: nothing hangs into the arm's path.
    const check = s.checkLoad();
    if (!check.accepted) throw new Error('rejected');
    expect(check.spray_arms.every((arm) => arm.full_rotation)).toBe(true);
    expect(check.racks.every((rack) => rack.slides_in)).toBe(true);
    expect(check.fell_out).toEqual([]);
  }, 120_000);
});
