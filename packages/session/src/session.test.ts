// Scripted episodes on the owner's machine with real catalogue items: what the loading physics
// does with them, and what the session reports.
import { starterLevels } from '@spotless/levels';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_FIDELITY } from './index.ts';
import { testLevel } from './test-level.ts';
import {
  itemAxisZ,
  mustPlace,
  mustSetRack,
  openUpperBasket,
  slotDrop,
  slotOf,
  useSessions,
} from './test-util.ts';

const session = useSessions();

describe('a new session', () => {
  it('starts with the lower basket out, the upper in and everything on the counter', async () => {
    const s = await session(testLevel());
    const state = s.getState();
    expect(state.phase).toBe('loading');
    expect(state.racks).toEqual({ lower_rack: 'out', upper_rack: 'in' });
    expect(state.placed).toEqual([]);
    expect(state.unplaced).toEqual([...state.unplaced].sort());
    expect(state.unplaced).toHaveLength(testLevel().items.length);
    expect(state.rack_options).toMatchObject({
      'upper_rack.height': '1',
      'lower_rack.tine_row_r1': 'up',
      'upper_rack.shelf_cup_front': 'up',
    });
    expect(state.state_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(state.budget).toMatchObject({ actions_used: 0, queries_used: 1, washes_used: 0 });
  });

  it('serves the level card and item records without anything about the outcome', async () => {
    const s = await session(testLevel());
    const card = s.getLevel();
    expect(card.level_id).toBe('test-level');
    expect(card.machine.racks.map((r) => r.rack)).toEqual([
      'lower_rack',
      'cutlery_basket',
      'upper_rack',
    ]);
    const upper = card.machine.racks.find((r) => r.rack === 'upper_rack');
    expect(upper?.options.map((o) => o.name)).toEqual(
      expect.arrayContaining(['position', 'height', 'shelf_cup_front']),
    );
    // Pulled out, a basket's origin is further to the front (smaller y).
    expect(upper?.origin_out_mm[1]).toBeLessThan(upper?.origin_in_mm[1] ?? 0);
    const item = s.getItem({ item_id: 'soup_plate_01' });
    expect(item.accepted && item.item.class).toBe('soup_plate');
    const text = JSON.stringify(card) + JSON.stringify(item);
    for (const hidden of ['seed', 'difficulty', 'adhesion', 'coverage_map', 'expected']) {
      expect(text).not.toContain(hidden);
    }
  });
});

describe('plates in the hinged rear rows', () => {
  it('stand between the tines and lean the way the tines lean', async () => {
    const s = await session(testLevel());
    const rows = s.listSlots({ rack: 'lower_rack' });
    expect(rows.accepted).toBe(true);
    if (!rows.accepted) return;
    const r1 = rows.tine_rows.find((row) => row.id === 'tine_row_r1');
    // The two halves of the row lean opposite ways: the row says so and each slot its own.
    expect(r1).toMatchObject({ runs: 'x', lean_toward: 'mixed', folded: false });
    expect(r1?.lean_deg).toBeGreaterThan(5);
    const leans = rows.slots
      .filter((slot) => slot.tine_row === 'tine_row_r1')
      .map((slot) => slot.lean_toward);
    expect(leans[0]).toBe('-x');
    expect(leans[leans.length - 1]).toBe('+x');

    // In any order: each plate is seated where list_slots suggests for it, in the scene as it
    // is. (Until 2026-10-10 a plate was dropped upright from above the tine tips and the row
    // had to be filled from the side the plates lean to; now it is seated the way a hand does
    // it, a millimetre or two above the rails, laid back as far as it goes.)
    const placed = ['04', '10', '07'].map((slotIndex, i) => {
      const slotId = `tine_row_r1.slot_${slotIndex}`;
      expect(slotOf(s, 'lower_rack', slotId).suggested_orientation).toMatchObject({
        preset: 'on_edge',
        roll_deg: 0,
        yaw_deg: 90,
      });
      return mustPlace(s, {
        item_id: `dessert_plate_0${i + 1}`,
        frame: 'lower_rack',
        ...slotDrop(s, 'lower_rack', slotId, `dessert_plate_0${i + 1}`),
      });
    });
    for (const drop of placed) {
      // The request was quantised to whole millimetres; the plate is let go no higher than
      // asked and comes to rest within a few millimetres of there.
      expect(Number.isInteger(drop.requested_pose.position_mm[0])).toBe(true);
      expect(drop.release_pose.position_mm[2]).toBeLessThanOrEqual(
        drop.requested_pose.position_mm[2],
      );
      expect(drop.displacement_mm).toBeLessThan(6);
      expect(drop.fell_through).toBe(false);
      expect(drop.fell_out).toBe(false);
      expect(drop.stable).toBe(true);
      expect(drop.resting?.on_base).toBe(true);
      // Held by the rails and tines of the two rear rows, and by nothing else.
      expect(drop.contacts.map((c) => c.with)).toEqual([
        'lower_rack.tine_row_r1',
        'lower_rack.tine_row_r2',
      ]);
      for (const contact of drop.contacts) expect(contact.normal_force_N).toBeGreaterThanOrEqual(0);
      // The face of the plate looks along the row, to the middle of the basket (+x in the left
      // half) and tipped up: the plate lies back with the tines, which lean to -x, by about 10
      // degrees (a dessert plate of 190 mm; the machine engineer's 10.3), its centre 95 mm up.
      const face = itemAxisZ(drop.settled_pose.quat_wxyz);
      const lean = (Math.atan2(face[2], face[0]) * 180) / Math.PI;
      expect(Math.abs(face[1])).toBeLessThan(0.1);
      expect(lean).toBeGreaterThan(8);
      expect(lean).toBeLessThan(13);
      expect(drop.settled_pose.position_mm[2]).toBeLessThan(100);
    }
    const state = s.getState();
    expect(state.placed.map((p) => p.item_id)).toEqual([
      'dessert_plate_01',
      'dessert_plate_02',
      'dessert_plate_03',
    ]);
    expect(state.placed.every((p) => p.location === 'lower_rack')).toBe(true);
    expect(state.placed.every((p) => p.frame === 'lower_rack' && p.stable)).toBe(true);
    expect(state.budget.actions_used).toBe(3);
  });

  it('do not fold down under a plate that stands in them, nor come up under one that lies on them', async () => {
    const s = await session(testLevel());
    mustPlace(s, {
      item_id: 'soup_plate_01',
      frame: 'lower_rack',
      ...slotDrop(s, 'lower_rack', 'tine_row_r1.slot_07', 'soup_plate_01'),
    });
    // The plate stands with its edge between two tines: they cannot lie down through it.
    const standing = s.stateHash();
    expect(
      s.setRack({ rack: 'lower_rack', option: { name: 'tine_row_r1', value: 'folded' } }),
    ).toMatchObject({ accepted: false, reason: 'blocked', blocked_by: ['soup_plate_01'] });
    expect(s.stateHash()).toBe(standing);
    expect(s.remove({ item_id: 'soup_plate_01' }).accepted).toBe(true);
    const folded = mustSetRack(s, 'lower_rack', 'tine_row_r1', 'folded');
    expect(folded.state.rack_options['lower_rack.tine_row_r1']).toBe('folded');
    mustSetRack(s, 'lower_rack', 'tine_row_r2', 'folded');
    mustPlace(s, {
      item_id: 'soup_plate_01',
      frame: 'lower_rack',
      position_mm: [200, 373, 100],
      orientation: { preset: 'upright' },
    });
    // Now the plate lies on the folded rows, which cannot come up through it.
    const before = s.stateHash();
    expect(
      s.setRack({ rack: 'lower_rack', option: { name: 'tine_row_r1', value: 'up' } }),
    ).toMatchObject({ accepted: false, reason: 'blocked', blocked_by: ['soup_plate_01'] });
    expect(s.stateHash()).toBe(before);
    expect(s.getState().rack_options['lower_rack.tine_row_r1']).toBe('folded');
  });
});

describe('bowls', () => {
  it('nest on the folded rear rows, and the upper one drops when the lower is taken away', async () => {
    const s = await session(testLevel());
    mustSetRack(s, 'lower_rack', 'tine_row_r1', 'folded');
    mustSetRack(s, 'lower_rack', 'tine_row_r2', 'folded');
    expect(s.getState().rack_options).toMatchObject({
      'lower_rack.tine_row_r1': 'folded',
      'lower_rack.tine_row_r2': 'folded',
    });
    const rows = s.listSlots({ rack: 'lower_rack' });
    expect(rows.accepted && rows.tine_rows.find((r) => r.id === 'tine_row_r1')?.folded).toBe(true);
    expect(rows.accepted && rows.slots.some((x) => x.tine_row === 'tine_row_r1')).toBe(false);

    const lower = mustPlace(s, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [150, 373, 80],
      orientation: { preset: 'inverted' },
    });
    expect(lower.stable).toBe(true);
    const upper = mustPlace(s, {
      item_id: 'bowl_02',
      frame: 'lower_rack',
      position_mm: [150, 373, 150],
      orientation: { preset: 'inverted' },
    });
    // The second bowl sits over the first: it touches nothing but that bowl, a wall thickness
    // or two higher.
    expect(upper.contacts.map((c) => c.with)).toEqual(['bowl_01']);
    expect(upper.stable).toBe(true);
    const gap = upper.settled_pose.position_mm[2] - lower.settled_pose.position_mm[2];
    expect(gap).toBeGreaterThan(5);
    expect(gap).toBeLessThan(45);

    // The rows cannot come up under the bowls.
    expect(
      s.setRack({ rack: 'lower_rack', option: { name: 'tine_row_r1', value: 'up' } }),
    ).toMatchObject({
      accepted: false,
      reason: 'blocked',
    });

    const removed = s.remove({ item_id: 'bowl_01' });
    expect(removed.accepted).toBe(true);
    if (!removed.accepted) return;
    expect(removed.moved_items.map((m) => m.item_id)).toEqual(['bowl_02']);
    expect(removed.moved_items[0]?.displacement_mm).toBeGreaterThan(10);
    expect(removed.state.unplaced).toContain('bowl_01');
    const dropped = removed.state.placed.find((p) => p.item_id === 'bowl_02');
    expect(dropped?.position_mm[2]).toBeCloseTo(lower.settled_pose.position_mm[2], 0);
    expect(dropped?.contacts.some((c) => c.with.startsWith('lower_rack'))).toBe(true);
  });
});

describe('the upper basket', () => {
  it('is in the way of the lower basket when both are pulled out', async () => {
    const s = await session(testLevel());
    mustSetRack(s, 'upper_rack', 'position', 'out');
    const blocked = s.place({
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    });
    expect(blocked).toMatchObject({ accepted: false, reason: 'not_insertable' });
    // The wires of the upper basket or one of its fittings, whichever the bowl meets first.
    expect(!blocked.accepted && blocked.blocked_by).toMatch(/^upper_rack/);
    const preview = s.preview({
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    });
    expect(preview).toMatchObject({
      accepted: true,
      collision_free: true,
      insertable: false,
      lowered_pose: null,
    });
  });

  it('takes mugs and glasses mouth down, and carries them to another height', async () => {
    const s = await session(testLevel());
    openUpperBasket(s);
    const mug = mustPlace(s, {
      item_id: 'mug_01',
      frame: 'upper_rack',
      position_mm: [250, 380, 130],
      orientation: { preset: 'inverted' },
    });
    const glass = mustPlace(s, {
      item_id: 'glass_01',
      frame: 'upper_rack',
      position_mm: [160, 440, 130],
      orientation: { preset: 'inverted' },
    });
    for (const drop of [mug, glass]) {
      expect(drop.fell_through).toBe(false);
      expect(drop.fell_out).toBe(false);
      expect(drop.stable).toBe(true);
      expect(drop.contacts.every((c) => c.with.startsWith('upper_rack'))).toBe(true);
      // Still mouth down: the item's own up axis points down, within 25 degrees.
      expect(itemAxisZ(drop.settled_pose.quat_wxyz)[2]).toBeLessThan(-0.9);
    }

    const tubBefore = s.bodyPoses();
    const lowered = mustSetRack(s, 'upper_rack', 'height', '3');
    expect(lowered.state.rack_options['upper_rack.height']).toBe('3');
    // In the basket's own frame nothing moved ...
    expect(lowered.moved_items).toEqual([]);
    const tubAfter = s.bodyPoses();
    // ... and in the tub frame the basket and its load are 50 mm lower.
    const dropOf = (id: string, kind: 'items' | 'parts'): number =>
      ((tubBefore[kind][id]?.p[2] ?? 0) - (tubAfter[kind][id]?.p[2] ?? 0)) * 1000;
    expect(dropOf('upper_rack', 'parts')).toBeCloseTo(50, 3);
    expect(dropOf('upper_rack_fittings', 'parts')).toBeCloseTo(50, 3);
    expect(dropOf('upper_arm', 'parts')).toBeCloseTo(50, 3);
    expect(dropOf('lower_rack', 'parts')).toBeCloseTo(0, 6);
    expect(dropOf('mug_01', 'items')).toBeCloseTo(50, 0);
    expect(dropOf('glass_01', 'items')).toBeCloseTo(50, 0);
    expect(mustSetRack(s, 'upper_rack', 'height', '1').moved_items).toEqual([]);

    // Pushed in, they ride along.
    const pushed = mustSetRack(s, 'upper_rack', 'position', 'in');
    expect(pushed.state.racks).toEqual({ lower_rack: 'in', upper_rack: 'in' });
    expect(pushed.state.placed.every((p) => p.frame === 'upper_rack')).toBe(true);
    const mugNow = pushed.state.placed.find((p) => p.item_id === 'mug_01');
    expect(Math.abs((mugNow?.position_mm[1] ?? 0) - mug.settled_pose.position_mm[1])).toBeLessThan(
      40,
    );
  });

  it('does not let a cup shelf come down onto a glass', async () => {
    const s = await session(testLevel());
    openUpperBasket(s);
    // The glass stands on the rest along the right wall, at the rear, where `list_slots` says
    // to let it go: leaning towards the wall against the rear shelf, which is folded up. (The
    // folded shelves stand 27 mm inside the wall from 48.5 mm up, IMG_9131: mouth down and
    // upright at x = 430 the glass would be 6 mm inside the shelf.)
    const listed = s.listSlots({ rack: 'upper_rack', item_id: 'glass_01' });
    const rest = listed.accepted
      ? listed.slots.find((slot) => slot.id === 'rest_right')
      : undefined;
    expect(rest?.drop_free).toBe(true);
    if (rest?.suggested_drop === undefined) return;
    const glass = mustPlace(s, {
      item_id: 'glass_01',
      frame: 'upper_rack',
      ...rest.suggested_drop,
    });
    expect(glass.contacts.map((c) => c.with)).toContain('upper_rack_fittings.shelf.cup_rear');
    expect(
      s.setRack({ rack: 'upper_rack', option: { name: 'shelf_cup_rear', value: 'down' } }),
    ).toMatchObject({ accepted: false, reason: 'blocked', blocked_by: ['glass_01'] });
    // A pose inside the folded shelf is refused, and the refusal names the shelf.
    expect(
      s.place({
        item_id: 'glass_02',
        frame: 'upper_rack',
        position_mm: [430, 150, 130],
        orientation: { preset: 'inverted' },
      }),
    ).toMatchObject({
      accepted: false,
      reason: 'collision_at_pose',
      colliding_with: ['upper_rack_fittings.shelf.cup_front'],
    });
    // The front shelf has nothing under it and comes down, offering a surface and notches.
    mustSetRack(s, 'upper_rack', 'shelf_cup_front', 'down');
    const slots = s.listSlots({ rack: 'upper_rack' });
    expect(slots.accepted && slots.slots.map((x) => x.kind)).toEqual(
      expect.arrayContaining(['cup_shelf', 'stemware_notch', 'knife_shelf']),
    );
  });
});

describe('the cutlery basket', () => {
  it('holds a fork that leans in its cell, and a knife let go balanced on end falls over at the nudge', async () => {
    const s = await session(testLevel());
    const cells = s.listSlots({ rack: 'cutlery_basket' });
    // Two rows of four cells (the machine engineer's count from IMG_9081, 2026-10-10).
    expect(cells.accepted && cells.slots).toHaveLength(8);
    const fork = mustPlace(s, {
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      position_mm: [32, 28, 120],
      orientation: { preset: 'handle_down' },
    });
    expect(fork.fell_out).toBe(false);
    expect(fork.fell_through).toBe(false);
    expect(fork.contacts.every((c) => c.with.startsWith('cutlery_basket'))).toBe(true);
    expect(fork.contacts.length).toBeGreaterThanOrEqual(2);
    expect(fork.stable).toBe(true);
    // It stands in the cell: its middle is well above the floor of the basket.
    expect(fork.settled_pose.position_mm[2]).toBeGreaterThan(60);

    // Let go exactly upright on the flat end of its handle, touching nothing but the floor. It
    // used to stay standing there and was reported not stable; the nudge that now ends every
    // action tips it over in the action that put it there: it is reported where it leans
    // against the wall of its cell, and it stays there under the next nudge.
    const knife = mustPlace(s, {
      item_id: 'knife_01',
      frame: 'cutlery_basket',
      position_mm: [96, 28, 130],
      orientation: { preset: 'handle_down' },
    });
    expect(knife.rotation_deg).toBeGreaterThan(5);
    expect(knife.displacement_mm).toBeGreaterThan(10);
    expect(knife.contacts.length).toBeGreaterThanOrEqual(2);
    expect(knife.contacts.every((c) => c.with.startsWith('cutlery_basket'))).toBe(true);
    expect(knife.stable).toBe(true);
    expect(s.getState().placed.find((p) => p.item_id === 'knife_01')?.stable).toBe(true);
  });
});

describe('things that go wrong', () => {
  it('a teaspoon dropped handle first falls through the floor of the lower basket', async () => {
    const s = await session(testLevel());
    const spoon = mustPlace(s, {
      item_id: 'teaspoon_01',
      frame: 'lower_rack',
      position_mm: [130, 250, 100],
      orientation: { preset: 'handle_down' },
    });
    expect(spoon.fell_through).toBe(true);
    expect(spoon.fell_out).toBe(false);
    expect(spoon.settled_pose.position_mm[2]).toBeLessThan(-30);
    // It lies on the open door under the basket.
    expect(spoon.contacts.map((c) => c.with)).toEqual(['door.liner']);
    const check = s.checkLoad();
    expect(check.accepted && check.fell_out).toEqual(['teaspoon_01']);
  });

  it('a frying pan stood handle up is too tall to go under the upper basket', async () => {
    const s = await session(testLevel());
    const pan = mustPlace(s, {
      item_id: 'pan_01',
      frame: 'lower_rack',
      position_mm: [110, 120, 330],
      orientation: { preset: 'on_edge_handle_up', yaw_deg: 90 },
    });
    // With the basket pulled out there is nothing above it: the pan stands.
    expect(pan.fell_out).toBe(false);
    expect(pan.settled_pose.position_mm[2]).toBeGreaterThan(250);

    const before = s.getState();
    const check = s.checkLoad();
    expect(check.accepted).toBe(true);
    if (!check.accepted) return;
    // Pushing the basket in knocks the pan against the upper basket: either the basket stops,
    // or the pan is thrown over; either way the load is not as it was and the door is blocked.
    const lower = check.racks.find((r) => r.rack === 'lower_rack');
    const knocked = check.shifted.find((m) => m.item_id === 'pan_01');
    expect(lower?.slides_in === false || (knocked?.rotation_deg ?? 0) > 20).toBe(true);
    expect(check.door_closes).toBe(false);
    // The check changed nothing.
    const after = s.getState();
    expect(after.state_hash).toBe(before.state_hash);
    expect(after.racks).toEqual(before.racks);
    expect(after.placed).toEqual(before.placed);

    // The cycle cannot be started on it, and that costs nothing.
    const refused = s.startCycle();
    expect(refused).toMatchObject({ accepted: false, reason: 'door_blocked' });
    expect(s.stateHash()).toBe(before.state_hash);
    expect(s.phase()).toBe('loading');
    expect(s.getState().budget.washes_used).toBe(0);
  });

  it('a baking tray on its long edge stops the upper spray arm', async () => {
    const s = await session(testLevel());
    mustPlace(s, {
      item_id: 'tray_01',
      frame: 'lower_rack',
      position_mm: [150, 256, 300],
      orientation: { preset: 'on_long_edge', yaw_deg: 90 },
    });
    const check = s.checkLoad();
    expect(check.accepted).toBe(true);
    if (!check.accepted) return;
    expect(check.racks).toEqual([
      { rack: 'lower_rack', slides_in: true },
      { rack: 'upper_rack', slides_in: true },
    ]);
    expect(check.spray_arms.find((a) => a.arm === 'lower_arm')).toEqual({
      arm: 'lower_arm',
      full_rotation: true,
    });
    const upper = check.spray_arms.find((a) => a.arm === 'upper_arm');
    expect(upper).toMatchObject({ full_rotation: false, blocked_by: 'tray_01' });
    expect(upper?.first_contact_angle_deg).toBeGreaterThanOrEqual(0);
    // It stands 328 mm high under the circle the arm sweeps (313 mm): that is the arm's
    // finding. It is not reported as sticking out of the basket for its height: the envelope
    // reaches to the floor of the upper basket, 340 mm up.
    expect(check.protruding.filter((p) => p.beyond_mm > 2).map((p) => p.item_id)).toEqual([]);
    // Mechanical facts only.
    expect(Object.keys(check).sort()).toEqual(
      [
        'accepted',
        'dispenser_blocked_by',
        'dispenser_opens',
        'door_blocked_by',
        'door_closes',
        'fell_out',
        'on_tub_floor',
        'protruding',
        'racks',
        'shifted',
        'spray_arms',
        'tablet_blocked_by',
        'tablet_path_clear',
      ].sort(),
    );
  });
});

describe('insert', () => {
  it('slides a plate in along a slanted line, and not through the machine', async () => {
    const s = await session(testLevel());
    mustSetRack(s, 'lower_rack', 'tine_row_r1', 'folded');
    mustSetRack(s, 'lower_rack', 'tine_row_r2', 'folded');
    const plate = mustPlace(s, {
      item_id: 'dessert_plate_01',
      frame: 'lower_rack',
      position_mm: [420, 373, 60],
      orientation: { preset: 'upright' },
      mode: 'insert',
      insert_dir: [0, 1, -1],
    });
    // Let go at the pose asked for (nothing was in the way), then it settles onto the rows.
    expect(plate.release_pose.position_mm[0]).toBeCloseTo(420, 0);
    expect(plate.release_pose.position_mm[1]).toBeCloseTo(373, 0);
    expect(plate.release_pose.position_mm[2]).toBeCloseTo(60, 0);
    expect(plate.settled_pose.position_mm[2]).toBeLessThan(40);
    expect(plate.contacts.some((c) => c.with.startsWith('lower_rack'))).toBe(true);

    // From below, the floor of the basket is in the way.
    const through = s.place({
      item_id: 'dessert_plate_02',
      frame: 'lower_rack',
      position_mm: [150, 373, 60],
      orientation: { preset: 'upright' },
      mode: 'insert',
      insert_dir: [0, 0, 1],
    });
    expect(through).toMatchObject({ accepted: false, reason: 'not_insertable' });
  });

  it('pushes against a neighbour with a limited force', async () => {
    const s = await session(testLevel());
    mustSetRack(s, 'lower_rack', 'tine_row_r1', 'folded');
    mustSetRack(s, 'lower_rack', 'tine_row_r2', 'folded');
    const first = mustPlace(s, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [200, 373, 80],
      orientation: { preset: 'inverted' },
    });
    // A drop onto the same spot from the side is refused: the pose overlaps the first bowl.
    const overlapping = {
      item_id: 'bowl_02',
      frame: 'lower_rack' as const,
      position_mm: [290, 373, first.settled_pose.position_mm[2] + 3] as const,
      orientation: { preset: 'inverted' },
    };
    expect(s.place(overlapping)).toMatchObject({
      accepted: false,
      reason: 'collision_at_pose',
      colliding_with: ['bowl_01'],
    });
    // Brought in steeply from above and the right with a limited force, it meets the first
    // bowl, shoves it a little and is let go where it stalls: leaning on its neighbour.
    const pushed = mustPlace(s, { ...overlapping, mode: 'insert', insert_dir: [-1, 0, -2] });
    expect(pushed.moved_items.map((m) => m.item_id)).toEqual(['bowl_01']);
    expect(pushed.moved_items[0]?.displacement_mm).toBeGreaterThan(2);
    expect(pushed.moved_items[0]?.displacement_mm).toBeLessThan(60);
    // It did not get to the pose asked for.
    expect(pushed.release_pose.position_mm[0]).toBeGreaterThan(overlapping.position_mm[0] + 5);
    expect(pushed.contacts.map((c) => c.with)).toContain('bowl_01');
    const state = s.getState();
    const a = state.placed.find((p) => p.item_id === 'bowl_01');
    const b = state.placed.find((p) => p.item_id === 'bowl_02');
    // The first bowl went away from the second (towards -x), and they are not inside each
    // other: centres most of a diameter apart.
    expect(a?.position_mm[0]).toBeLessThan(first.settled_pose.position_mm[0]);
    expect((b?.position_mm[0] ?? 0) - (a?.position_mm[0] ?? 0)).toBeGreaterThan(120);
  });
});

describe('start_cycle', () => {
  it('pushes the baskets in, freezes the load and hands a manifest to the wash runner', async () => {
    const seen: { seed: number; items: number; progress: number[] } = {
      seed: -1,
      items: 0,
      progress: [],
    };
    const s = await session(testLevel(), {
      washRunner: async (manifest, onProgress) => {
        seen.seed = manifest.seed;
        seen.items = manifest.items.length;
        onProgress(0.5);
        seen.progress.push(0.5);
        const { placeholderWashRunner } = await import('./wash.ts');
        return placeholderWashRunner(manifest, () => undefined);
      },
    });
    expect(s.getReport()).toMatchObject({ accepted: false, reason: 'no_cycle_started' });
    mustPlace(s, {
      item_id: 'soup_plate_01',
      frame: 'lower_rack',
      ...slotDrop(s, 'lower_rack', 'tine_row_r1.slot_07', 'soup_plate_01'),
    });
    mustPlace(s, {
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      position_mm: [32, 28, 120],
      orientation: { preset: 'handle_down' },
    });
    const started = s.startCycle();
    expect(started.accepted).toBe(true);
    if (!started.accepted) return;
    expect(started.programme).toBe('eco_50');
    expect(started.state.racks).toEqual({ lower_rack: 'in', upper_rack: 'in' });
    expect(started.state.phase).toBe('washing');
    expect(started.prechecks.door_closes).toBe(true);
    expect(started.prechecks.racks.every((r) => r.slides_in)).toBe(true);
    expect(started.load.items.map((i) => i.item_id)).toEqual(['fork_01', 'soup_plate_01']);
    expect(started.load.items.every((i) => i.frame === 'tub')).toBe(true);
    expect(started.load.state_hash).toBe(started.state_hash);
    // The player's copy of the manifest has no seed; the runner's has.
    expect(JSON.stringify(started)).not.toContain('seed');
    // In the tub frame the plate is now inside the tub, behind the door plane.
    const plate = started.load.items.find((i) => i.item_id === 'soup_plate_01');
    expect(plate?.position_mm[1]).toBeGreaterThan(-100);
    // The load is frozen.
    expect(
      s.place({
        item_id: 'mug_01',
        frame: 'upper_rack',
        position_mm: [250, 380, 130],
        orientation: { preset: 'inverted' },
      }),
    ).toMatchObject({ accepted: false, reason: 'episode_over' });
    expect(s.remove({ item_id: 'fork_01' })).toMatchObject({
      accepted: false,
      reason: 'episode_over',
    });

    await s.washSettled();
    expect(seen).toEqual({ seed: 7, items: 2, progress: [0.5] });
    expect(s.phase()).toBe('finished');
    const manifest = s.washManifest();
    expect(manifest?.machine_config.basketHeights).toEqual({ upper: '1' });
    expect(manifest?.items[1]?.soils[0]?.type).toBe('tomato_sauce');
    expect(manifest?.unloaded).toContain('mug_01');
    const report = s.getReport();
    expect(report.accepted && report.status).toBe('done');
    if (!report.accepted || report.status !== 'done') return;
    // The placeholder runner simulates nothing and says so.
    expect(report.report.job.fidelity).toBe(PLACEHOLDER_FIDELITY);
    expect(report.report.state_hash).toBe(started.state_hash);
    expect(report.report.items).toHaveLength(testLevel().items.length);
    expect(report.report.items.find((i) => i.item_id === 'fork_01')).toMatchObject({
      loaded: true,
      simulated: false,
      clean: false,
      points_awarded: 0,
    });
    expect(report.report.items.find((i) => i.item_id === 'mug_01')).toEqual({
      item_id: 'mug_01',
      loaded: false,
    });
    expect(report.report.score.points_available).toBe(testLevel().items.length * 5);
  });

  it('reports a failing wash runner as a failed job and gives the wash back', async () => {
    const s = await session(testLevel(), {
      washRunner: () => Promise.reject(new Error('the GPU went away')),
    });
    expect(s.startCycle().accepted).toBe(true);
    await s.washSettled();
    expect(s.getReport()).toMatchObject({
      accepted: true,
      status: 'failed',
      error: 'the GPU went away',
    });
    expect(s.phase()).toBe('loading');
    expect(s.getState().budget.washes_used).toBe(0);
  });
});

describe('the starter levels', () => {
  it('all open as sessions, and the tutorial can be played to the end', async () => {
    for (const level of starterLevels()) {
      const s = await session(level);
      expect(s.card.items).toHaveLength(level.items.length);
      expect(s.getState().unplaced).toHaveLength(level.items.length);
    }
    const tutorial = starterLevels()[0];
    if (tutorial === undefined) throw new Error('no tutorial');
    const s = await session(tutorial);
    const first = mustPlace(s, {
      item_id: 'plate_01',
      frame: 'lower_rack',
      ...slotDrop(s, 'lower_rack', 'tine_row_r1.slot_06', 'plate_01'),
    });
    const second = mustPlace(s, {
      item_id: 'plate_02',
      frame: 'lower_rack',
      ...slotDrop(s, 'lower_rack', 'tine_row_r1.slot_02', 'plate_02'),
    });
    // The first thing a new player does: both plates stand on the floor of the basket (a
    // 270 mm plate: its centre about 135 mm up), stable, and clear of the rear rim.
    for (const plate of [first, second]) {
      expect(plate.stable).toBe(true);
      expect(plate.settled_pose.position_mm[2]).toBeLessThan(150);
      expect(plate.contacts.map((c) => c.with)).not.toContain('lower_rack.rim');
    }
    mustPlace(s, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    });
    mustPlace(s, {
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      position_mm: [20, 28, 240],
      orientation: { preset: 'handle_down', roll_deg: 5 },
    });
    mustPlace(s, {
      item_id: 'knife_01',
      frame: 'cutlery_basket',
      position_mm: [108, 28, 240],
      orientation: { preset: 'handle_down', roll_deg: 5 },
    });
    openUpperBasket(s);
    mustPlace(s, {
      item_id: 'mug_01',
      frame: 'upper_rack',
      position_mm: [250, 380, 130],
      orientation: { preset: 'inverted' },
    });
    mustPlace(s, {
      item_id: 'glass_01',
      frame: 'upper_rack',
      position_mm: [160, 440, 130],
      orientation: { preset: 'inverted' },
    });
    const state = s.getState();
    // Seven of the tutorial's twelve items; the others stay on the counter.
    expect(state.unplaced).toEqual([
      'fork_02',
      'glass_02',
      'soup_plate_01',
      'spoon_01',
      'spoon_02',
    ]);
    expect(state.budget.actions_used).toBe(9);
    const check = s.checkLoad();
    expect(check).toMatchObject({
      accepted: true,
      fell_out: [],
      on_tub_floor: [],
      door_closes: true,
      dispenser_opens: true,
      tablet_path_clear: true,
    });
    expect(check.accepted && check.spray_arms.every((a) => a.full_rotation)).toBe(true);
    const started = s.startCycle();
    expect(started.accepted).toBe(true);
    expect(started.accepted && started.load.items).toHaveLength(7);
    await s.washSettled();
    const report = s.getReport();
    expect(
      report.accepted &&
        report.status === 'done' &&
        report.report.items.filter((i) => i.loaded).length,
    ).toBe(7);
    expect(
      report.accepted && report.status === 'done' && report.report.score.points_available,
    ).toBe(64);
  });
});
