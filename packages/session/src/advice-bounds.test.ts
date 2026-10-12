// A place that `list_slots` marks `drop_free` is one `place` accepts: the contract of the slot
// advice. (Review of the measurement, 2026-10-11: on an empty machine 7 of the first 12
// suggestions for a frying pan that were flagged free were refused as `out_of_bounds`: the
// pan held on edge over an end slot has its middle beyond the side of the basket, and over a
// tall row of the upper basket it is above the roof of the tub. The search for a seat tested
// collisions and the way down, not the frame `place` holds a position to.)
import { describe, expect, it } from 'vitest';
import { testLevel } from './test-level.ts';
import { mustSetRack, useSessions } from './test-util.ts';

const session = useSessions();

const PIECES = [
  ['pan', 'skillet_steel_270'],
  ['frying', 'frying_pan_clad_254'],
  ['saucepan', 'saucepan_clad_2qt'],
  ['plate', 'dinner_plate_porcelain_270'],
  ['bowl', 'cereal_bowl_porcelain_160'],
  ['mug', 'mug_ceramic_300'],
] as const;

describe('a suggested place flagged free', () => {
  it.each(PIECES)(
    'is inside its frame, collides with nothing and can be reached, for the %s (%s)',
    async (id, itemType) => {
      const s = await session({
        ...testLevel(),
        id: 'advice-bounds',
        items: [{ id, itemType, points: 1, soils: [] }],
      });
      // The lower basket starts pulled out.
      let free = 0;
      for (const rack of ['lower_rack', 'upper_rack'] as const) {
        if (rack === 'upper_rack') {
          mustSetRack(s, 'lower_rack', 'position', 'in');
          mustSetRack(s, 'upper_rack', 'position', 'out');
        }
        const listed = s.listSlots({ rack, item_id: id });
        if (!listed.accepted) throw new Error(`list_slots was rejected: ${JSON.stringify(listed)}`);
        for (const slot of listed.slots) {
          if (slot.drop_free !== true || slot.suggested_drop === undefined) continue;
          free += 1;
          const tried = s.preview({ item_id: id, frame: rack, ...slot.suggested_drop });
          if (!tried.accepted) throw new Error(`preview was rejected: ${JSON.stringify(tried)}`);
          expect(
            {
              in_bounds: tried.in_bounds,
              collision_free: tried.collision_free,
              insertable: tried.insertable,
            },
            `${rack} ${slot.id} at ${JSON.stringify(slot.suggested_drop.position_mm)}`,
          ).toEqual({ in_bounds: true, collision_free: true, insertable: true });
        }
      }
      // Every piece here has somewhere to go on an empty machine.
      expect(free).toBeGreaterThan(0);
    },
    120_000,
  );

  it('is not given to a frying pan over an end slot it would stand outside the basket in', async () => {
    const s = await session({
      ...testLevel(),
      id: 'advice-bounds',
      items: [{ id: 'pan', itemType: 'skillet_steel_270', points: 1, soils: [] }],
    });
    const listed = s.listSlots({ rack: 'lower_rack', item_id: 'pan' });
    if (!listed.accepted) throw new Error('list_slots was rejected');
    const outside = listed.slots.filter(
      (slot) =>
        slot.suggested_drop !== undefined &&
        (slot.suggested_drop.position_mm[0] < 0 || slot.suggested_drop.position_mm[1] < 0),
    );
    expect(outside.length).toBeGreaterThan(0);
    for (const slot of outside) {
      expect(slot.drop_free, slot.id).toBe(false);
      expect(slot.drop_blocked_by, slot.id).toEqual(['lower_rack.wall']);
    }
  }, 120_000);
});
