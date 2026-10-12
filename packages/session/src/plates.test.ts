// Plates dropped where `list_slots` suggests must come to stand in the slot, on the floor of the
// basket: not hung on the tine tips, not jammed between tines, not fallen over.
import { instantiate } from '@spotless/catalogue';
import { describe, expect, it } from 'vitest';
import { testLevel } from './test-level.ts';
import { itemAxisZ, useSessions } from './test-util.ts';

const session = useSessions();

/** The plates of the catalogue that the lower basket's rows are made for. */
const PLATES = [
  'dinner_plate_porcelain_270',
  'dinner_plate_porcelain_iec',
  'dinner_plate_vitrelle_260',
  'dinner_plate_stoneware_270',
  'soup_plate_porcelain_230',
  'dessert_plate_porcelain_190',
  'melamine_plate_230',
];

/** One slot of each kind of row: rear left-leaning, rear right-leaning, front left, front right. */
const SLOTS = [
  'tine_row_r1.slot_03',
  'tine_row_r1.slot_08',
  'tine_row_r2.slot_18',
  'tine_row_ml.slot_02',
  'tine_row_fr.slot_02',
];

function plateLevel(itemType: string) {
  const base = testLevel();
  return {
    ...base,
    id: 'plate-slots',
    items: SLOTS.map((_, i) => ({ id: `plate_${i}`, itemType, points: 1, soils: [] })),
  };
}

describe('a plate dropped where list_slots suggests', () => {
  it.each(PLATES)('%s comes to stand in the slot on the floor of the basket', async (itemType) => {
    const radius = instantiate(itemType).bbox.max[0] * 1000;
    const weight = instantiate(itemType).mass.mass * 9.81;
    let seated = 0;
    const failures: string[] = [];
    for (const [i, slotId] of SLOTS.entries()) {
      // A fresh basket for every drop: each slot is judged on its own.
      const s = await session(plateLevel(itemType));
      const slots = s.listSlots({ rack: 'lower_rack', item_id: `plate_${i}` });
      expect(slots.accepted).toBe(true);
      if (!slots.accepted) return;
      const slot = slots.slots.find((candidate) => candidate.id === slotId);
      expect(slot?.suggested_drop, slotId).toBeDefined();
      if (slot?.suggested_drop === undefined) return;
      if (slot.drop_free === false) {
        // Only the 27 cm plates, behind the cutlery basket at the front centre: the seated
        // plate would reach 4 mm into it, and the slot says so.
        expect(itemType, slotId).toMatch(/_270$/);
        expect(slot.drop_blocked_by, slotId).toEqual(['cutlery_basket']);
        seated += 1;
        continue;
      }
      const drop = s.place({ item_id: `plate_${i}`, frame: 'lower_rack', ...slot.suggested_drop });
      expect(drop.accepted, `${slotId}: ${JSON.stringify(drop)}`).toBe(true);
      if (!drop.accepted) return;
      const face = itemAxisZ(drop.settled_pose.quat_wxyz);
      const tilt = Math.asin(Math.max(-1, Math.min(1, face[2])));
      const lowest = drop.settled_pose.position_mm[2] - radius * Math.cos(tilt);
      const force = Math.max(0, ...drop.contacts.map((c) => c.normal_force_N ?? 0));
      const fromSlot = Math.abs(drop.settled_pose.position_mm[0] - slot.centre_mm[0]);
      const ok =
        lowest < 16 && // its lower edge is down between the floor wires (the rail top is at 11 mm)
        Math.abs(tilt) < (35 * Math.PI) / 180 && // standing, leaning on the tines
        force < 3.5 * weight && // resting, not jammed
        fromSlot < 45 && // in or beside the slot it was dropped over
        drop.stable &&
        !drop.fell_out &&
        !drop.fell_through;
      if (ok) seated += 1;
      else
        failures.push(
          `${slotId}: lowest ${lowest.toFixed(0)} mm, tilt ${((tilt * 180) / Math.PI).toFixed(0)} deg, ` +
            `force ${(force / weight).toFixed(1)} W, ${fromSlot.toFixed(0)} mm from the slot, stable ${drop.stable}`,
        );
    }
    expect(failures, failures.join('; ')).toEqual([]);
    expect(seated).toBe(SLOTS.length);
  });
});
