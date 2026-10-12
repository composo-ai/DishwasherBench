// `stable` must be false for what only balances, even when the nudge leaves it standing
// (review of 2026-10-10: a chopping board let down on its long edge in the middle of the lower
// basket stayed exactly where it was, was reported stable, and one basket move then shifted it
// 22.6 mm and 10 degrees).
import { describe, expect, it } from 'vitest';
import { testLevel } from './test-level.ts';
import { mustPlace, mustSetRack, openUpperBasket, useSessions } from './test-util.ts';

const session = useSessions();

const LEVEL = {
  ...testLevel(),
  id: 'balance',
  items: [
    { id: 'board', itemType: 'chopping_board_pp_375', points: 1, soils: [] },
    { id: 'glass', itemType: 'tumbler_250', points: 1, soils: [] },
    { id: 'mug', itemType: 'mug_ceramic_300', points: 1, soils: [] },
    { id: 'plate', itemType: 'dinner_plate_porcelain_iec', points: 1, soils: [] },
  ],
};

describe('an item that only balances', () => {
  it('is not stable: a board on its long edge on the open floor of the lower basket', async () => {
    const s = await session(LEVEL);
    const board = mustPlace(s, {
      item_id: 'board',
      frame: 'lower_rack',
      position_mm: [260, 265, 220],
      orientation: { preset: 'on_long_edge' },
    });
    // Hand calculation: 8 mm thick, centre of mass 133.5 mm up: it tips beyond
    // atan(4 / 133.5) = 1.7 degrees, less than the 5 degrees asked of a base.
    expect((Math.atan(4 / 133.5) * 180) / Math.PI).toBeLessThan(5);
    expect(board.contacts.every((c) => c.with.startsWith('lower_rack.floor'))).toBe(true);
    // Whether the nudge fells it or leaves it standing on its edge, it is not called stable
    // while it stands there.
    if (board.rotation_deg < 45) expect(board.stable).toBe(false);
  });

  it('leaves what stands on a broad base or is held sideways stable', async () => {
    const s = await session(LEVEL);
    openUpperBasket(s);
    // A glass on its rim on the floor wires: base 60 mm across under a centre of mass about
    // 50 mm up, a margin of 30 degrees.
    const glass = mustPlace(s, {
      item_id: 'glass',
      frame: 'upper_rack',
      position_mm: [70, 60, 150],
      orientation: { preset: 'inverted' },
    });
    expect(glass.stable).toBe(true);
    // A mug leaning on a tine of row A, and a plate seated between tines: held sideways.
    const mug = mustPlace(s, {
      item_id: 'mug',
      frame: 'upper_rack',
      position_mm: [165, 390, 150],
      orientation: { preset: 'inverted' },
    });
    expect(mug.contacts.some((c) => c.with.includes('tine_row'))).toBe(true);
    expect(mug.stable).toBe(true);
    mustSetRack(s, 'upper_rack', 'position', 'in');
    mustSetRack(s, 'lower_rack', 'position', 'out');
    const listed = s.listSlots({ rack: 'lower_rack', item_id: 'plate' });
    if (!listed.accepted) throw new Error('list_slots was rejected');
    const slot = listed.slots.find((candidate) => candidate.id === 'tine_row_r1.slot_03');
    if (slot?.suggested_drop === undefined) throw new Error('no seat');
    const plate = mustPlace(s, { item_id: 'plate', frame: 'lower_rack', ...slot.suggested_drop });
    expect(plate.stable).toBe(true);
  });
});
