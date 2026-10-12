/**
 * Reproductions of what the loader found while packing the owner's machine physically: places
 * where a realistic placement is rejected, falls over or is misjudged, each as a few calls on a
 * fresh session with the result printed. Nothing here is a test; it is a record of behaviour
 * for the engineers who own the session layer, the loading physics, the machine geometry and
 * the catalogue.
 *
 *   pnpm --filter @spotless/loader exec tsx scripts/findings.ts
 */

import { findLevel } from '@spotless/levels';
import type { Level } from '@spotless/levels';
import type { DropResult, GameSession, PlaceRequest } from '@spotless/session';
import { createSession } from '@spotless/session';
import { iecLevel } from '../src/standard-levels.ts';

function unlimited(level: Level): Level {
  return { ...level, rules: { ...level.rules, actionsMax: 100000, queriesMax: 100000 } };
}

function show(result: DropResult): string {
  if (!result.accepted) {
    return `rejected: ${result.reason}${result.blocked_by === undefined ? '' : ` by ${result.blocked_by}`}${
      result.penetration_mm === undefined
        ? ''
        : `, ${result.penetration_mm} mm into ${(result.colliding_with ?? []).join(', ')}`
    }`;
  }
  return `settled at ${result.settled_pose.position_mm.map((v) => v.toFixed(0)).join(', ')} mm, turned ${result.rotation_deg} deg, moved ${result.displacement_mm} mm, stable ${result.stable}${
    result.fell_out ? ', fell_out' : ''
  }${result.fell_through ? ', fell_through' : ''}; touches ${result.contacts.map((c) => c.with).join(', ')}`;
}

async function fresh(level: Level): Promise<GameSession> {
  return createSession({ level: unlimited(level) });
}

function title(text: string): void {
  console.log(`\n== ${text}`);
}

const tutorial = findLevel('tutorial') as Level;
const iec = iecLevel();

// 1 ------------------------------------------------------------------------------------------
title('1. The pulled-out lower basket stops with its rear under the upper basket');
{
  const s = await fresh(tutorial);
  const card = s.card.machine.racks;
  const lower = card.find((r) => r.rack === 'lower_rack');
  const upper = card.find((r) => r.rack === 'upper_rack');
  console.log(
    `lower basket pulled out: y ${lower?.origin_out_mm[1]} to ${(lower?.origin_out_mm[1] ?? 0) + (lower?.envelope_mm[1] ?? 0)} mm; upper basket pushed in: front at y ${upper?.origin_in_mm[1]} mm`,
  );
  const at = (y: number): PlaceRequest => ({
    item_id: 'plate_01',
    frame: 'lower_rack',
    position_mm: [125, y, 250],
    orientation: { preset: 'on_edge', roll_deg: -15, yaw_deg: 90 },
  });
  console.log(
    `27 cm plate dropped on the middle of the rear rows (y 373): ${show(s.place(at(373)))}`,
  );
  console.log(`the same 18 mm further forward (y 355): ${show(s.place(at(355)))}`);
  s.dispose();
}

// 2 ------------------------------------------------------------------------------------------
title('2. No item can be lowered straight into a slot of the leaning rows');
{
  const s = await fresh(tutorial);
  const slots = s.listSlots({ rack: 'lower_rack', item_id: 'plate_01' });
  const slot = slots.accepted ? slots.slots.find((x) => x.id === 'tine_row_r1.slot_04') : undefined;
  if (slot !== undefined) {
    console.log(
      `slot ${slot.id}: centre x ${slot.centre_mm[0]}, clear width ${slot.width_mm} mm between tines that lean ${slot.lean_deg} deg: the tip of each tine hangs over the foot of the next, so every drop first touches a tine`,
    );
    // Held parallel to the tines, as the slot's plate_normal says a plate stands.
    const parallel = s.preview({
      item_id: 'plate_01',
      frame: 'lower_rack',
      position_mm: [slot.centre_mm[0] - 35, 355, 245],
      orientation: { preset: 'on_edge', roll_deg: -(slot.lean_deg ?? 0), yaw_deg: 90 },
    });
    if (parallel.accepted) {
      console.log(
        `27 cm plate held parallel to the tines: lowered to z ${parallel.lowered_pose?.position_mm[2]} mm, on the tine tips (seated on both rails its centre is at about 139 mm)`,
      );
    }
    if (slot.suggested_drop !== undefined) {
      const result = s.place({
        item_id: 'plate_01',
        frame: 'lower_rack',
        position_mm: slot.suggested_drop.position_mm,
        orientation: slot.suggested_drop.orientation,
      });
      console.log(
        `dropped as the session suggests (suggested_drop ${JSON.stringify(slot.suggested_drop)}): ${show(result)}`,
      );
    } else {
      console.log('this session offers no suggested_drop for the slot');
    }
  }
  s.dispose();
}

// 3 ------------------------------------------------------------------------------------------
title('3. Seated between the rails, a rimmed plate clears the tines only leaning the wrong way');
{
  const s = await fresh(iec);
  for (const [item, radius, depth] of [
    ['dinner_plate_01', 125, 24],
    ['soup_plate_01', 115, 40],
    ['dessert_plate_01', 95, 18],
  ] as const) {
    const line: string[] = [];
    for (const lean of [15, 10, 5, 0, -4, -8]) {
      let best = Infinity;
      for (let offset = -9; offset <= 9; offset++) {
        for (const dz of [1, 2, 3]) {
          const a = (lean * Math.PI) / 180;
          const half = depth / 2 - 3;
          const seat =
            13.2 +
            Math.sqrt(radius * radius - 49.5 * 49.5) * Math.cos(a) +
            Math.abs(half * Math.sin(a));
          const preview = s.preview({
            item_id: item,
            frame: 'lower_rack',
            position_mm: [
              173.1 + offset - radius * Math.sin(a) - half * Math.cos(a),
              373.5,
              seat + dz,
            ],
            orientation: { preset: 'on_edge', roll_deg: -lean, yaw_deg: 90 },
          });
          if (preview.accepted) best = Math.min(best, preview.penetration_mm);
        }
      }
      line.push(`${lean} deg: ${best.toFixed(1)} mm`);
    }
    console.log(
      `${item} (${2 * radius} mm, ${depth} mm deep), least penetration of a seated pose by lean with the tines: ${line.join('; ')}`,
    );
  }
  s.dispose();
}

// 4 ------------------------------------------------------------------------------------------
title('4. The cutlery basket: the partition of the long cells is not in list_slots');
{
  const s = await fresh(iec);
  const cells = s.listSlots({ rack: 'cutlery_basket' });
  const cell = cells.accepted ? cells.slots.find((x) => x.id === 'cell_c11') : undefined;
  if (cell !== undefined) {
    console.log(
      `cell ${cell.id}: centre ${cell.centre_mm.join(', ')}, size ${cell.size_mm?.join(' x ')} mm`,
    );
    const centre = s.place({
      item_id: 'knife_01',
      frame: 'cutlery_basket',
      position_mm: [cell.centre_mm[0], cell.centre_mm[1], 255],
      orientation: { preset: 'handle_down' },
    });
    console.log(`knife let down on the listed centre: ${show(centre)}`);
    const off = s.place({
      item_id: 'knife_02',
      frame: 'cutlery_basket',
      position_mm: [cell.centre_mm[0], cell.centre_mm[1] + 29, 255],
      orientation: { preset: 'handle_down' },
    });
    console.log(`knife let down 29 mm off the centre: ${show(off)}`);
  }
  s.dispose();
}

// 5 ------------------------------------------------------------------------------------------
title('5. Upper basket: the slots of the fixed rows do not hold a plate');
{
  const s = await fresh(iec);
  s.setRack({ rack: 'lower_rack', option: { name: 'position', value: 'in' } });
  s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'out' } });
  const slots = s.listSlots({ rack: 'upper_rack' });
  const row = slots.accepted ? slots.tine_rows.find((r) => r.id === 'tine_row_a2') : undefined;
  const slot = slots.accepted ? slots.slots.find((x) => x.id === 'tine_row_a2.slot_03') : undefined;
  if (row !== undefined && slot !== undefined && slot.suggested_orientation !== undefined) {
    console.log(
      `row ${row.id}: partner ${row.partner?.id} ${row.partner?.spacing_mm} mm away, rail z ${row.start_mm[2]} mm, tines ${row.height_mm} mm`,
    );
    const result = s.place({
      item_id: 'saucer_01',
      frame: 'upper_rack',
      position_mm: [162, slot.centre_mm[1], 200],
      orientation: slot.suggested_orientation,
    });
    console.log(`saucer dropped between the two rows at slot ${slot.id}: ${show(result)}`);
  }
  s.dispose();
}

// 6 ------------------------------------------------------------------------------------------
title(
  '6. A glass dropped over the rear of the pulled-out upper basket lands on the roof of the tub',
);
{
  const s = await fresh(iec);
  s.setRack({ rack: 'lower_rack', option: { name: 'position', value: 'in' } });
  s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'out' } });
  const result = s.place({
    item_id: 'glass_01',
    frame: 'upper_rack',
    position_mm: [300, 460, 330],
    orientation: { preset: 'inverted' },
  });
  console.log(
    `glass at y 460, z 330 of the upper basket's frame: ${show(result)} (before the session change of 2026-10-10 02:55 it was accepted, came to rest on the roof of the tub and was reported stable and carried by the upper basket)`,
  );
  const check = s.checkLoad();
  if (check.accepted) {
    console.log(
      `check_load: fell_out ${JSON.stringify(check.fell_out)}, protruding ${JSON.stringify(check.protruding)}, upper basket slides in ${check.racks.find((r) => r.rack === 'upper_rack')?.slides_in}`,
    );
  }
  s.dispose();
}

// 7 ------------------------------------------------------------------------------------------
title('7. The stability probe and things that stand loosely');
{
  const s = await fresh(iec);
  const fork = s.place({
    item_id: 'fork_01',
    frame: 'cutlery_basket',
    position_mm: [18, 17, 243],
    orientation: { preset: 'handle_down' },
  });
  console.log(`fork alone in a corner cell: ${show(fork)}`);
  const pushed = s.setRack({ rack: 'lower_rack', option: { name: 'position', value: 'in' } });
  if (pushed.accepted) {
    const state = pushed.state.placed.find((p) => p.item_id === 'fork_01');
    console.log(
      `after the basket was pushed in: moved ${JSON.stringify(pushed.moved_items)}, stable ${state?.stable}`,
    );
  }
  s.dispose();
}

// 8 ------------------------------------------------------------------------------------------
title('8. A long handle stood in the cutlery basket goes through its floor');
{
  const s = await fresh(iec);
  const ladle = s.place({
    item_id: 'gravy_ladle_01',
    frame: 'cutlery_basket',
    position_mm: [96, 202, 311 / 2 + 150],
    orientation: { preset: 'handle_down' },
  });
  console.log(`ladle (311 mm) handle down in a rear cell: ${show(ladle)}`);
  if (ladle.accepted) {
    console.log(
      `its lower end is ${(ladle.settled_pose.position_mm[2] - 311 / 2).toFixed(0)} mm above the floor of the cell (2 mm): on the wires of the lower basket, and where it comes down between two of them, in the path of the lower arm`,
    );
  }
  const check = s.checkLoad();
  if (check.accepted) console.log(`check_load arms: ${JSON.stringify(check.spray_arms)}`);
  s.dispose();
}

// 9 ------------------------------------------------------------------------------------------
title('9. Two heights for the upper basket');
{
  const s = await fresh(iec);
  const upper = s.card.machine.racks.find((r) => r.rack === 'upper_rack');
  console.log(
    `level card: the envelope of the upper basket is ${upper?.envelope_mm[2]} mm high (up to the roof sprayer, a small disc); the roof is ${s.card.machine.tub_max_mm[2] - (upper?.origin_in_mm[2] ?? 0)} mm above its base grid, and that is what check_load measures "protruding" against`,
  );
  s.dispose();
}

/** Opens the upper basket of a fresh session. */
function openUpper(s: GameSession): void {
  s.setRack({ rack: 'lower_rack', option: { name: 'position', value: 'in' } });
  s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'out' } });
}

/** `place` at the pose `list_slots` suggests for an item and a slot. */
function suggested(
  s: GameSession,
  rack: 'lower_rack' | 'upper_rack',
  itemId: string,
  slotId: string,
): DropResult {
  const slots = s.listSlots({ rack, item_id: itemId });
  const slot = slots.accepted ? slots.slots.find((x) => x.id === slotId) : undefined;
  if (slot?.suggested_drop === undefined) return { accepted: false, reason: 'invalid_argument' };
  return s.place({
    item_id: itemId,
    frame: rack,
    position_mm: slot.suggested_drop.position_mm,
    orientation: slot.suggested_drop.orientation,
  });
}

// 10 -----------------------------------------------------------------------------------------
title(
  '10. A plate between rows B and C of the upper basket rests on the arm feed tube and the basket then will not move',
);
{
  const s = await fresh(iec);
  openUpper(s);
  const plate = suggested(s, 'upper_rack', 'melamine_plate_01', 'tine_row_c_rear.slot_01');
  console.log(`melamine plate at the suggested drop of tine_row_c_rear.slot_01: ${show(plate)}`);
  const pushed = s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'in' } });
  console.log(
    `push the upper basket in: ${pushed.accepted ? 'accepted' : `${pushed.reason}, blocked by ${JSON.stringify(pushed.blocked_by)}`}`,
  );
  s.dispose();
}

// 11 -----------------------------------------------------------------------------------------
title(
  '11. Between the tall rows A and B a plate only balances upright; the short rows under the knife shelf are offered although the shelf is in the way',
);
{
  const s = await fresh(iec);
  openUpper(s);
  const under = suggested(s, 'upper_rack', 'saucer_01', 'tine_row_a2.slot_04');
  console.log(
    `saucer at the suggested drop of tine_row_a2.slot_04, knife shelf down (the default): ${show(under)}`,
  );
  s.setRack({ rack: 'upper_rack', option: { name: 'shelf_knife_shelf', value: 'up' } });
  const tall = suggested(s, 'upper_rack', 'melamine_plate_01', 'tine_row_a.slot_02');
  console.log(
    `melamine plate between the tall rows (tine_row_a.slot_02), knife shelf up: ${show(tall)}`,
  );
  const pushed = s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'in' } });
  if (pushed.accepted) {
    console.log(`after one push of the basket: moved ${JSON.stringify(pushed.moved_items)}`);
  }
  s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'out' } });
  const short = suggested(s, 'upper_rack', 'saucer_01', 'tine_row_a2.slot_04');
  console.log(`saucer in the short rows (tine_row_a2.slot_04), knife shelf up: ${show(short)}`);
  s.dispose();
}

// 12 -----------------------------------------------------------------------------------------
title('12. Deep plates come to rest leaning against the tines of every row');
{
  const s = await fresh(iec);
  for (const [item, slot] of [
    ['dinner_plate_01', 'tine_row_r1.slot_04'],
    ['soup_plate_01', 'tine_row_r1.slot_08'],
    ['soup_plate_02', 'tine_row_ml.slot_01'],
    ['soup_plate_03', 'tine_row_mr.slot_04'],
  ] as const) {
    const result = suggested(s, 'lower_rack', item, slot);
    if (!result.accepted) {
      console.log(`${item} in ${slot}: ${show(result)}`);
      continue;
    }
    const [w, x, y, z] = result.settled_pose.quat_wxyz;
    // The item's +z axis (its eating face) in the basket's frame.
    const face = [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
    const tilt = (Math.asin(face[2] as number) * 180) / Math.PI;
    console.log(
      `${item} in ${slot}: stable ${result.stable}, face tilted ${tilt.toFixed(1)} deg ${tilt >= 0 ? 'up (it leans back with the tines)' : 'down (it leans against the tines, towards the centre)'}`,
    );
  }
  const tutorialSession = await fresh(tutorial);
  const big = suggested(tutorialSession, 'lower_rack', 'plate_01', 'tine_row_r1.slot_04');
  if (big.accepted) {
    const [w, x, y] = big.settled_pose.quat_wxyz;
    const tilt = (Math.asin(1 - 2 * (x * x + y * y)) * 180) / Math.PI;
    console.log(
      `27 cm plate (30 mm deep) in tine_row_r1.slot_04: face tilted ${tilt.toFixed(1)} deg (w ${w.toFixed(2)})`,
    );
  }
  tutorialSession.dispose();
  s.dispose();
}

// 13 -----------------------------------------------------------------------------------------
title('13. One pull and push of a basket slides what stands in it');
{
  const s = await fresh(iec);
  openUpper(s);
  const glass = s.place({
    item_id: 'glass_01',
    frame: 'upper_rack',
    position_mm: [448, 198, 200],
    orientation: { preset: 'inverted' },
  });
  const mug = s.place({
    item_id: 'mug_01',
    frame: 'upper_rack',
    position_mm: [355, 162, 200],
    orientation: { preset: 'inverted', yaw_deg: 90 },
  });
  console.log(`glass mouth down: ${show(glass)}`);
  console.log(`mug mouth down: ${show(mug)}`);
  for (const value of ['in', 'out', 'in']) {
    const moved = s.setRack({ rack: 'upper_rack', option: { name: 'position', value } });
    console.log(
      `upper basket ${value}: ${moved.accepted ? JSON.stringify(moved.moved_items) : moved.reason}`,
    );
  }
  s.dispose();
}
