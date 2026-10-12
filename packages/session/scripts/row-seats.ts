/**
 * Seats every plate of the catalogue in every free slot of the lower basket's rows, with the
 * cutlery basket at each of its positions, the way a player following `list_slots` does: a
 * fresh session per slot, the suggested drop handed to `place`. Fails when a plate that was
 * offered a free seat ends more than 16 mm above the seat's height or leans more than the
 * allowed angle AGAINST the tines of its slot.
 *
 *   pnpm --filter @spotless/session exec tsx scripts/row-seats.ts
 *   ... row-seats.ts dinner_plate_porcelain_270        one kind only
 *
 * Allowed against the tines: 6 degrees (the catalogue's 27 cm plates, 30 mm deep, stand 3.5 to
 * 5.5 degrees against them, also when seated by a hand in a world with the basket alone), and
 * 15 for the 40 mm soup plate, which the tines of the rear rows reach below its rim and tip
 * forward (packages/machine/src/geometry/plate-rows.test.ts: 12.7 degrees seated by a hand; no
 * photograph settles it). About 700
 * placements, a few minutes: a script, not a unit test (`src/seats.test.ts` holds a sample).
 */

import type { Level } from '@spotless/levels';
import { createSession } from '../src/index.ts';
import type { SlotCard } from '../src/index.ts';
import { testLevel } from '../src/test-level.ts';
import { itemAxisZ } from '../src/test-util.ts';

const PLATES = [
  'dinner_plate_porcelain_270',
  'dinner_plate_stoneware_270',
  'dinner_plate_porcelain_iec',
  'dinner_plate_vitrelle_260',
  'melamine_plate_230',
  'soup_plate_porcelain_230',
  'dessert_plate_porcelain_190',
];
const POSITIONS = ['front_centre', 'front_right', 'front_left', 'out'];

function levelOf(itemType: string): Level {
  return { ...testLevel(), id: 'row-seats', items: [{ id: 'p', itemType, points: 1, soils: [] }] };
}

/** Lean of a settled plate from the vertical, degrees: positive with the tines of its slot. */
function leanOf(quat: readonly [number, number, number, number], slot: SlotCard): number {
  const face = itemAxisZ(quat);
  const sign = slot.lean_toward?.startsWith('-') === true ? -1 : 1;
  const along = slot.lean_toward?.endsWith('x') === true ? 0 : 1;
  return (Math.atan2(face[2], -sign * (face[along] as number)) * 180) / Math.PI;
}

const only = process.argv[2];
let failures = 0;
for (const itemType of PLATES.filter((t) => only === undefined || t === only)) {
  const against = itemType.startsWith('soup') ? 15 : 6;
  for (const position of POSITIONS) {
    const open = async () => {
      const s = await createSession({ level: levelOf(itemType) });
      if (position !== 'front_centre') {
        const moved = s.setRack({
          rack: 'cutlery_basket',
          option: { name: 'position', value: position },
        });
        if (!moved.accepted) throw new Error(`cutlery basket to ${position}: ${moved.reason}`);
      }
      return s;
    };
    const first = await open();
    const listed = first.listSlots({ rack: 'lower_rack', item_id: 'p' });
    first.dispose();
    if (!listed.accepted) throw new Error('list_slots was rejected');
    let free = 0;
    let blocked = 0;
    const leans: number[] = [];
    const bad: string[] = [];
    for (const slot of listed.slots) {
      if (slot.suggested_drop === undefined || slot.drop_seats !== true) continue;
      if (slot.drop_free !== true) {
        blocked += 1;
        continue;
      }
      free += 1;
      const s = await open();
      const drop = s.place({ item_id: 'p', frame: 'lower_rack', ...slot.suggested_drop });
      if (!drop.accepted) {
        bad.push(`${slot.id}: refused (${drop.reason})`);
      } else {
        const lean = leanOf(drop.settled_pose.quat_wxyz, slot);
        const rise = drop.settled_pose.position_mm[2] - slot.suggested_drop.position_mm[2];
        leans.push(lean);
        // The V-shaped gap where the lean of a row changes holds a plate upright either way.
        const limit = slot.kind === 'wide_slot' ? 16 : against;
        if (lean < -limit || rise > 16 || !drop.stable || drop.fell_out) {
          bad.push(
            `${slot.id}: lean ${lean.toFixed(1)}, ${rise.toFixed(0)} mm above the seat, stable ${String(drop.stable)}`,
          );
        }
      }
      s.dispose();
    }
    failures += bad.length;
    console.log(
      `${itemType} | cutlery basket ${position}: ${free} free seats, ${blocked} not free, lean ${Math.min(...leans).toFixed(1)} to ${Math.max(...leans).toFixed(1)} deg${bad.length === 0 ? '' : `\n  ${bad.join('\n  ')}`}`,
    );
  }
}
console.log(failures === 0 ? 'OK' : `${failures} seats failed`);
process.exit(failures === 0 ? 0 : 1);
