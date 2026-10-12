// What the session tells a player about where things go and how they came to rest: the
// suggestions of list_slots are tested with the test place applies, cutlery gets a drop that
// place accepts, preview names what is in the way, and a drop says how the item rests.
import { describe, expect, it } from 'vitest';
import { testLevel } from './test-level.ts';
import { mustPlace, useSessions } from './test-util.ts';
import type { SlotCard } from './types.ts';

const session = useSessions();

function slotsOf(
  result: ReturnType<Awaited<ReturnType<typeof session>>['listSlots']>,
): readonly SlotCard[] {
  if (!result.accepted) throw new Error(`list_slots was rejected: ${JSON.stringify(result)}`);
  return result.slots;
}

describe('list_slots with an item', () => {
  it('marks every suggested drop with the verdict place and preview give for it', async () => {
    const s = await session(testLevel());
    const slots = slotsOf(s.listSlots({ rack: 'lower_rack', item_id: 'dinner_plate_01' }));
    const suggested = slots.filter((slot) => slot.suggested_drop !== undefined);
    expect(suggested.length).toBeGreaterThan(20);
    for (const slot of suggested) {
      const drop = slot.suggested_drop as NonNullable<SlotCard['suggested_drop']>;
      const preview = s.preview({ item_id: 'dinner_plate_01', frame: 'lower_rack', ...drop });
      if (!preview.accepted) throw new Error('preview was rejected');
      expect(slot.drop_free, slot.id).toBe(preview.collision_free && preview.insertable);
      if (slot.drop_free === false)
        expect(slot.drop_blocked_by?.length, slot.id).toBeGreaterThan(0);
    }
    // In the empty basket every suggested pose is free: a seat is looked for clear of the walls
    // (the end slots used to be suggested where a dinner plate overlapped the wall). The one
    // exception is the cutlery basket, a loose part: the slots it stands over are marked and
    // carry no pose, and a slot where the seated plate would reach into it carries the seat and
    // is marked too (the plate is never offered upright or pushed along the rails instead).
    const blocked = suggested.filter((slot) => slot.drop_free !== true);
    for (const slot of blocked) expect(slot.drop_blocked_by, slot.id).toEqual(['cutlery_basket']);
    expect(suggested.length - blocked.length).toBeGreaterThan(20);
    const covered = slots.filter(
      (slot) => slot.drop_blocked_by?.includes('cutlery_basket') && !blocked.includes(slot),
    );
    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every((slot) => slot.drop_free === false)).toBe(true);
    expect(covered.every((slot) => slot.suggested_drop === undefined)).toBe(true);
  });

  it('marks a slot that has been taken, and says what took it', async () => {
    const s = await session(testLevel());
    const before = slotsOf(s.listSlots({ rack: 'lower_rack', item_id: 'dinner_plate_01' }));
    const slot = before.find((x) => x.id === 'tine_row_r1.slot_05') as SlotCard;
    expect(slot.drop_free).toBe(true);
    const drop = slot.suggested_drop as NonNullable<SlotCard['suggested_drop']>;
    mustPlace(s, { item_id: 'dinner_plate_01', frame: 'lower_rack', ...drop });
    const after = slotsOf(s.listSlots({ rack: 'lower_rack', item_id: 'dinner_plate_02' }));
    // The plate leans once it has settled, so it is the slots it leans over that are taken.
    const taken = after.filter(
      (x) => x.drop_free === false && x.drop_blocked_by?.includes('dinner_plate_01') === true,
    );
    expect(taken.length).toBeGreaterThan(0);
    const freeBefore = new Set(before.filter((x) => x.drop_free === true).map((x) => x.id));
    expect(taken.some((x) => freeBefore.has(x.id))).toBe(true);
  });

  it('says which way each slot leans where a row changes its lean, and calls the row mixed', async () => {
    const s = await session(testLevel());
    const result = s.listSlots({ rack: 'lower_rack' });
    if (!result.accepted) throw new Error('rejected');
    for (const row of result.tine_rows) {
      const leans = new Set(
        result.slots.filter((slot) => slot.tine_row === row.id).map((slot) => slot.lean_toward),
      );
      expect(leans.has(undefined)).toBe(false);
      expect(row.lean_toward).toBe(leans.size === 1 ? [...leans][0] : 'mixed');
    }
    expect(result.tine_rows.some((row) => row.lean_toward === 'mixed')).toBe(true);
  });

  it('gives no slot advice for an item that cannot stand on edge, and flags a bowl as perching', async () => {
    const s = await session(testLevel());
    const mug = slotsOf(s.listSlots({ rack: 'upper_rack', item_id: 'mug_01' }));
    for (const slot of mug) {
      expect(slot.suggested_drop).toBeUndefined();
      expect(slot.suggested_orientation).toBeUndefined();
    }
    const bowl = slotsOf(s.listSlots({ rack: 'lower_rack', item_id: 'bowl_01' }));
    const plate = slotsOf(s.listSlots({ rack: 'lower_rack', item_id: 'dinner_plate_01' }));
    const narrow = (slots: readonly SlotCard[]): SlotCard =>
      slots.find((x) => x.id === 'tine_row_r1.slot_05') as SlotCard;
    expect(narrow(bowl).drop_perches).toBe(true);
    expect(narrow(plate).drop_perches).toBeUndefined();
  });

  it('suggests a drop into every free cell of the cutlery basket that place accepts', async () => {
    const s = await session(testLevel());
    const cells = slotsOf(s.listSlots({ rack: 'cutlery_basket', item_id: 'fork_01' }));
    // Two rows of four cells.
    expect(cells).toHaveLength(8);
    const pieces = [
      'fork_01',
      'fork_02',
      'fork_03',
      'fork_04',
      'fork_05',
      'fork_06',
      'knife_01',
      'teaspoon_01',
    ];
    for (const [i, cell] of cells.entries()) {
      const piece = pieces[i] as string;
      // The suggestion is for the piece asked about: where its lower end goes.
      const forPiece = slotsOf(s.listSlots({ rack: 'cutlery_basket', item_id: piece }));
      const drop = forPiece.find((x) => x.id === cell.id)?.suggested_drop;
      expect(drop, cell.id).toBeDefined();
      if (drop === undefined) continue;
      const result = mustPlace(s, { item_id: piece, frame: 'cutlery_basket', ...drop });
      expect(result.fell_out, cell.id).toBe(false);
      expect(result.fell_through, cell.id).toBe(false);
      expect(result.resting?.on_base, cell.id).toBe(true);
      expect(result.stable, cell.id).toBe(true);
      // It stands in the cell it was let down into and touches nothing but the basket.
      expect(
        result.contacts.every((c) => c.with.startsWith('cutlery_basket')),
        cell.id,
      ).toBe(true);
      const size = cell.size_mm as readonly [number, number];
      expect(Math.abs(result.settled_pose.position_mm[0] - cell.centre_mm[0])).toBeLessThan(
        size[0] / 2 + 15,
      );
      expect(Math.abs(result.settled_pose.position_mm[1] - cell.centre_mm[1])).toBeLessThan(
        size[1] / 2 + 15,
      );
    }
    // A plate is not cutlery: no suggestion.
    const forPlate = slotsOf(s.listSlots({ rack: 'cutlery_basket', item_id: 'dinner_plate_01' }));
    expect(forPlate.every((cell) => cell.suggested_drop === undefined)).toBe(true);
  }, 120_000);
});

describe('preview', () => {
  it('names what blocks the way down to a free pose, as a refused place does', async () => {
    const s = await session(testLevel());
    // The upper basket pulled out hangs over the lower one.
    const out = s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'out' } });
    expect(out.accepted).toBe(true);
    // The first height over the middle of the lower basket at which the mug overlaps nothing.
    let found: {
      request: Parameters<typeof s.preview>[0];
      preview: ReturnType<typeof s.preview>;
    } | null = null;
    const preset = s.card.items.find((item) => item.item_id === 'mug_01')?.orientation_presets[0];
    const seen: string[] = [];
    for (let z = 60; z <= 260 && found === null; z += 10) {
      const candidate = {
        item_id: 'mug_01',
        frame: 'lower_rack' as const,
        position_mm: [250, 300, z] as [number, number, number],
        orientation: { preset: preset?.name ?? 'upright' },
      };
      const result = s.preview(candidate);
      seen.push(JSON.stringify(result.accepted ? result.colliding_with : result));
      if (result.accepted && result.collision_free) found = { request: candidate, preview: result };
    }
    if (found === null) throw new Error(`no free pose under the upper basket: ${seen.join(' ')}`);
    if (found === null) throw new Error('no free pose under the upper basket');
    const { request, preview } = found;
    if (!preview.accepted) throw new Error(`preview rejected: ${JSON.stringify(preview)}`);
    expect(preview.insertable).toBe(false);
    const place = s.place(request);
    expect(place.accepted).toBe(false);
    if (place.accepted) return;
    expect(place.reason).toBe('not_insertable');
    expect(preview.blocked_by).toBe(place.blocked_by);
    expect(preview.blocked_by).toBeDefined();
    expect(preview.blocked_above_mm).toBeGreaterThan(0);
  });
});

describe('the drop result', () => {
  it('says whether the item stands on the base of the basket or is held up', async () => {
    const s = await session(testLevel());
    const slots = slotsOf(s.listSlots({ rack: 'lower_rack', item_id: 'dinner_plate_01' }));
    const slot = slots.find((x) => x.id === 'tine_row_r1.slot_05') as SlotCard;
    const plate = mustPlace(s, {
      item_id: 'dinner_plate_01',
      frame: 'lower_rack',
      ...(slot.suggested_drop as NonNullable<SlotCard['suggested_drop']>),
    });
    expect(plate.resting?.on_base).toBe(true);
    expect(plate.resting?.lowest_point_mm).toBeLessThanOrEqual(10);
    expect(plate.resting?.force_over_weight).toBeGreaterThan(0.5);
    // A bowl dropped over the same narrow row sits on the tine tips.
    const forBowl = slotsOf(s.listSlots({ rack: 'lower_rack', item_id: 'bowl_01' }));
    const far = forBowl.find((x) => x.id === 'tine_row_r1.slot_17') as SlotCard;
    expect(far.drop_perches).toBe(true);
    const bowl = mustPlace(s, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      ...(far.suggested_drop as NonNullable<SlotCard['suggested_drop']>),
    });
    expect(bowl.resting?.on_base).toBe(false);
    expect(bowl.resting?.lowest_point_mm).toBeGreaterThan(10);
  }, 120_000);
});
