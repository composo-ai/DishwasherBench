// Slot advice: one ranked list for the page and for the MCP tool.
import type { SlotCard } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import { slotAdvice, slotAdviceLabel } from './slot-advice.ts';

/** A slot between tines with a suggested drop. */
function slot(
  id: string,
  x: number,
  flags: Partial<Pick<SlotCard, 'drop_free' | 'drop_seats' | 'drop_perches'>> & {
    blocked?: string[];
    yaw?: number;
  } = {},
): SlotCard {
  return {
    id,
    kind: 'plate_slot',
    centre_mm: [x, 400, 11],
    width_mm: 14,
    tine_row: id.split('.')[0] as string,
    suggested_drop: {
      position_mm: [x, 368, 143],
      orientation: { preset: 'on_edge', roll_deg: 5, yaw_deg: flags.yaw ?? 90, pitch_deg: 0 },
    },
    drop_free: flags.drop_free ?? true,
    ...(flags.blocked === undefined ? {} : { drop_blocked_by: flags.blocked }),
    drop_seats: flags.drop_seats ?? true,
    ...(flags.drop_perches === undefined ? {} : { drop_perches: flags.drop_perches }),
  };
}

describe('slotAdvice', () => {
  it('puts free seating places first, then free places above the tines, then the taken ones', () => {
    const advice = slotAdvice([
      slot('row_a.slot_00', 10, { drop_free: false, blocked: ['plate_01'] }),
      slot('row_a.slot_01', 30, { drop_seats: false, drop_perches: true }),
      slot('row_a.slot_02', 50),
      slot('row_a.slot_03', 70, { drop_free: false, blocked: ['cutlery_basket'] }),
      slot('row_a.slot_04', 90),
      slot('row_a.slot_05', 110, { drop_seats: false }),
    ]);
    expect(advice.places.map((place) => place.slots[0])).toEqual([
      'row_a.slot_02',
      'row_a.slot_04',
      'row_a.slot_01',
      'row_a.slot_05',
      'row_a.slot_00',
      'row_a.slot_03',
    ]);
    expect(advice).toMatchObject({ free_seated: 2, free_perching: 2, not_free: 2 });
    expect(advice.places[4]).toMatchObject({ free: false, blocked_by: ['plate_01'] });
    expect(advice.places[2]).toMatchObject({ free: true, seats: false, perches: true });
    // Within a group the order of the basket is kept.
    expect(advice.places.slice(0, 2).map((place) => place.position_mm[0])).toEqual([50, 90]);
  });

  it('makes one place of the two slots of a pair of rows that share a drop', () => {
    const advice = slotAdvice([
      slot('row_a.slot_00', 10),
      slot('row_a.slot_01', 30),
      slot('row_b.slot_00', 10),
      slot('row_b.slot_01', 30),
      // The same position in another orientation is another place.
      slot('row_c.slot_00', 10, { yaw: -90 }),
    ]);
    expect(advice.places.map((place) => place.slots)).toEqual([
      ['row_a.slot_00', 'row_b.slot_00'],
      ['row_a.slot_01', 'row_b.slot_01'],
      ['row_c.slot_00'],
    ]);
    expect(advice.places[0]?.rows).toEqual(['row_a', 'row_b']);
  });

  it('counts slots without a drop and leaves them out of the places', () => {
    const bare: SlotCard = {
      id: 'cup_shelf_1',
      kind: 'cup_shelf',
      centre_mm: [1, 2, 3],
      width_mm: 80,
    };
    const advice = slotAdvice([bare, slot('row_a.slot_00', 10), { ...bare, id: 'cup_shelf_2' }]);
    expect(advice.places).toHaveLength(1);
    expect(advice.slots_without_drop).toBe(2);
    expect(slotAdvice([bare]).places).toEqual([]);
  });

  it('writes an orientation without the offsets that are zero, ready to pass to place', () => {
    const [place] = slotAdvice([slot('row_a.slot_00', 10)]).places;
    expect(place?.orientation).toEqual({ preset: 'on_edge', roll_deg: 5, yaw_deg: 90 });
  });

  it('labels a place as the page lists it', () => {
    const advice = slotAdvice([
      slot('row_a.slot_00', 10),
      slot('row_a.slot_01', 30, { drop_free: false, blocked: ['plate_01', 'plate_02'] }),
      slot('row_a.slot_02', 50, { drop_seats: false, drop_perches: true }),
    ]);
    expect(advice.places.map(slotAdviceLabel)).toEqual([
      'row_a.slot_00',
      'row_a.slot_02 (too deep: would sit on the tine tips)',
      'row_a.slot_01 (not free now: plate_01, plate_02)',
    ]);
  });
});
