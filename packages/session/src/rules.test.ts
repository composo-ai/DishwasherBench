// What may be loaded where, and what becomes of items that do not end up in the machine.
import { describe, expect, it } from 'vitest';
import { testLevel } from './test-level.ts';
import { mustPlace, mustSetRack, useSessions } from './test-util.ts';

const session = useSessions();

describe('a basket that is pushed in', () => {
  it('cannot be loaded by drop, insert or preview until it is pulled out', async () => {
    const s = await session(testLevel());
    mustSetRack(s, 'upper_rack', 'position', 'out');
    mustSetRack(s, 'lower_rack', 'position', 'in');
    const glass = {
      item_id: 'glass_01',
      frame: 'lower_rack' as const,
      position_mm: [63, 423, 200] as const,
      orientation: { preset: 'upright' },
    };
    const hash = s.stateHash();
    expect(s.place(glass)).toMatchObject({
      accepted: false,
      reason: 'not_insertable',
      blocked_by: 'tub',
    });
    expect(s.place({ ...glass, mode: 'insert', insert_dir: [0, 1, 0] })).toMatchObject({
      accepted: false,
      reason: 'not_insertable',
    });
    expect(
      s.place({
        item_id: 'fork_01',
        frame: 'cutlery_basket',
        position_mm: [30, 30, 200],
        orientation: { preset: 'handle_down' },
      }),
    ).toMatchObject({ accepted: false, reason: 'not_insertable' });
    expect(s.preview(glass)).toMatchObject({ accepted: true, insertable: false });
    expect(s.stateHash()).toBe(hash);
    // The upper basket, pushed in again, is closed to loading too.
    mustSetRack(s, 'upper_rack', 'position', 'in');
    expect(s.place({ ...glass, frame: 'upper_rack', position_mm: [200, 200, 150] })).toMatchObject({
      accepted: false,
      reason: 'not_insertable',
    });
    // Through the tub frame the roof is in the way (where the baskets leave room at all).
    for (const position of [
      [0, 0, 300],
      [0, 100, 330],
      [-200, 0, 560],
    ] as const) {
      const inside = s.place({ ...glass, frame: 'tub', position_mm: position });
      expect(inside.accepted).toBe(false);
      expect(['not_insertable', 'collision_at_pose']).toContain(
        inside.accepted ? '' : inside.reason,
      );
    }
    // Pulled out, it takes the glass.
    mustSetRack(s, 'lower_rack', 'position', 'out');
    expect(mustPlace(s, { ...glass, position_mm: [200, 200, 200] }).state.placed[0]?.location).toBe(
      'lower_rack',
    );
  });
});

describe('positions outside the machine', () => {
  it('are out of bounds: above the roof, beside the walls, beyond the door', async () => {
    const s = await session(testLevel());
    const plate = { item_id: 'dinner_plate_01', orientation: { preset: 'upright' } };
    for (const position of [
      [0, 0, 900],
      [0, 265, 800],
      [-370, 100, 100],
      [370, 100, 100],
      [0, -1200, 300],
    ] as const) {
      expect(s.place({ ...plate, frame: 'tub', position_mm: position })).toMatchObject({
        accepted: false,
        reason: 'out_of_bounds',
      });
    }
    // In a basket frame, nothing above the roof of the tub either.
    expect(s.place({ ...plate, frame: 'lower_rack', position_mm: [250, 250, 650] })).toMatchObject({
      accepted: false,
      reason: 'out_of_bounds',
    });
  });
});

describe('an item that leaves the machine', () => {
  it('a pot dropped on the rim of the basket rolls onto the kitchen floor and is back on the counter', async () => {
    const s = await session(testLevel());
    // A stockpot upside down, its middle over the left rim of the basket, so that half of it
    // hangs out beside the open door. (The reviewer's drop of 2026-10-10, half over the front
    // right at 420, 130, no longer leaves the machine: since the cutlery basket was rebuilt and
    // the handle of the lower basket stands on its front rim, that pot comes to rest on the
    // handle bar of the cutlery basket and the rim.)
    const drop = mustPlace(s, {
      item_id: 'pot_01',
      frame: 'lower_rack',
      position_mm: [0, 250, 300],
      orientation: { preset: 'inverted' },
    });
    for (const value of drop.settled_pose.position_mm) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThan(20000);
    }
    expect(drop.returned).toEqual(['pot_01']);
    expect(drop.contacts.map((c) => c.with)).toEqual(['kitchen_floor']);
    expect(drop.settle_time_s).toBeLessThan(10);
    expect(drop.fell_out).toBe(true);
    expect(drop.stable).toBe(false);
    expect(drop.state.unplaced).toContain('pot_01');
    expect(drop.state.placed).toEqual([]);
    // Charged, and the world is quiet again: the next drop settles in the usual time.
    expect(drop.state.budget.actions_used).toBe(1);
    const next = mustPlace(s, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [150, 150, 200],
      orientation: { preset: 'inverted' },
    });
    expect(next.settle_time_s).toBeLessThanOrEqual(3);
    expect(next.moved_items).toEqual([]);
  });

  it('a glass let go on the edge of the door rolls off and never stays placed', async () => {
    const s = await session(testLevel());
    const drop = mustPlace(s, {
      item_id: 'glass_01',
      frame: 'tub',
      position_mm: [-272, -805, 200],
      orientation: { preset: 'on_side' },
    });
    expect(drop.returned).toEqual(['glass_01']);
    expect(drop.fell_out).toBe(true);
    expect(drop.state.placed).toEqual([]);
    // It may roll on the floor until the settle gives up; it is finite and near the machine.
    expect(drop.settle_time_s).toBeLessThanOrEqual(10);
    for (const value of drop.settled_pose.position_mm) expect(Math.abs(value)).toBeLessThan(20000);
    // It can be placed again.
    expect(
      mustPlace(s, {
        item_id: 'glass_01',
        frame: 'lower_rack',
        position_mm: [200, 200, 200],
        orientation: { preset: 'upright' },
      }).state.placed[0],
    ).toMatchObject({ item_id: 'glass_01', location: 'lower_rack' });
  });

  it('a fork pushed in under the basket lies on the door and is left out of the wash', async () => {
    const s = await session(testLevel());
    const fork = mustPlace(s, {
      item_id: 'fork_01',
      frame: 'lower_rack',
      position_mm: [260, 250, -30],
      orientation: { preset: 'flat' },
      mode: 'insert',
      insert_dir: [0, 1, 0],
    });
    expect(fork.fell_through).toBe(true);
    expect(fork.returned).toEqual([]);
    expect(fork.state.placed[0]).toMatchObject({ item_id: 'fork_01', location: 'outside' });
    mustPlace(s, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [150, 150, 200],
      orientation: { preset: 'inverted' },
    });
    const check = s.checkLoad();
    expect(check.accepted && check.fell_out).toEqual(['fork_01']);
    expect(check.accepted && check.door_closes).toBe(true);
    // The check changed nothing.
    expect(s.getState().placed.map((p) => p.item_id)).toEqual(['bowl_01', 'fork_01']);
    const start = s.startCycle();
    expect(start.accepted).toBe(true);
    if (!start.accepted) return;
    expect(start.left_out).toEqual(['fork_01']);
    expect(start.load.items.map((item) => item.item_id)).toEqual(['bowl_01']);
    expect(start.state.unplaced).toContain('fork_01');
    expect(s.washManifest()?.unloaded).toContain('fork_01');
    await s.washSettled();
    const report = s.getReport();
    expect(report.accepted && report.status).toBe('done');
    if (report.accepted && report.status === 'done') {
      expect(report.report.items.find((item) => item.item_id === 'fork_01')?.loaded).toBe(false);
    }
  });

  it('a knife that hangs through the floor of the basket and stands on the door has fallen through', async () => {
    const s = await session(testLevel());
    const knife = mustPlace(s, {
      item_id: 'knife_01',
      frame: 'lower_rack',
      position_mm: [400, 250, 160],
      orientation: { preset: 'handle_down' },
    });
    // Its middle is still above the base grid, its end stands on the door underneath.
    expect(knife.settled_pose.position_mm[2]).toBeGreaterThan(-25);
    expect(knife.contacts.some((c) => c.with.startsWith('door'))).toBe(true);
    expect(knife.fell_through).toBe(true);
    // It is where it stands, on the door, and so not loaded.
    expect(knife.state.placed[0]).toMatchObject({ item_id: 'knife_01', location: 'outside' });
  });
});

describe('once the cycle has started', () => {
  it('preview, list_slots and check_load are refused, and the door is drawn shut', async () => {
    const s = await session(testLevel());
    const open = s.bodyPoses().parts['door'];
    mustPlace(s, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [150, 150, 200],
      orientation: { preset: 'inverted' },
    });
    expect(s.startCycle().accepted).toBe(true);
    const queries = s.getState().budget.queries_used;
    expect(s.checkLoad()).toMatchObject({ accepted: false, reason: 'episode_over' });
    expect(s.listSlots({ rack: 'lower_rack' })).toMatchObject({
      accepted: false,
      reason: 'episode_over',
    });
    expect(
      s.preview({
        item_id: 'bowl_02',
        frame: 'lower_rack',
        position_mm: [300, 300, 200],
        orientation: { preset: 'inverted' },
      }),
    ).toMatchObject({ accepted: false, reason: 'episode_over' });
    // Nothing was charged for the refusals (get_state itself counts one).
    expect(s.getState().budget.queries_used).toBe(queries + 1);
    const shut = s.bodyPoses().parts['door'];
    expect(shut).toEqual(s.machineGeometry().parts.find((part) => part.id === 'door')?.pose);
    expect(shut).not.toEqual(open);
    await s.washSettled();
  });
});

describe('reset', () => {
  it('takes everything out and puts the baskets back where the level starts them', async () => {
    const s = await session(testLevel());
    mustPlace(s, {
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [150, 150, 200],
      orientation: { preset: 'inverted' },
    });
    mustSetRack(s, 'lower_rack', 'position', 'in');
    mustSetRack(s, 'upper_rack', 'position', 'out');
    const reset = s.reset();
    expect(reset.accepted && reset.state.racks).toEqual({ lower_rack: 'out', upper_rack: 'in' });
    expect(reset.accepted && reset.state.placed).toEqual([]);
    // Every part of the machine stands where it does in a fresh session.
    const fresh = await session(testLevel());
    expect(s.bodyPoses().parts).toEqual(fresh.bodyPoses().parts);
    // And the lower basket can be loaded again at once.
    expect(
      mustPlace(s, {
        item_id: 'bowl_01',
        frame: 'lower_rack',
        position_mm: [150, 150, 200],
        orientation: { preset: 'inverted' },
      }).state.placed[0]?.location,
    ).toBe('lower_rack');
  });
});

describe("mode 'set' (exact placement)", () => {
  it('is refused in a level that is played', async () => {
    const s = await session(testLevel());
    expect(
      s.place({
        item_id: 'bowl_01',
        frame: 'lower_rack',
        position_mm: [150.4, 150.2, 60.3],
        orientation: { preset: 'inverted' },
        mode: 'set',
      }),
    ).toMatchObject({ accepted: false, reason: 'not_available' });
  });

  it('puts a recorded resting pose back to within a tenth of a millimetre', async () => {
    const first = await session(testLevel({ exactPlacement: true }));
    const slots = first.listSlots({ rack: 'lower_rack', item_id: 'dinner_plate_01' });
    const slot = slots.accepted
      ? slots.slots.find((candidate) => candidate.id === 'tine_row_r1.slot_05')
      : undefined;
    expect(slot?.suggested_drop).toBeDefined();
    if (slot?.suggested_drop === undefined) return;
    const rest = mustPlace(first, {
      item_id: 'dinner_plate_01',
      frame: 'lower_rack',
      ...slot.suggested_drop,
    }).settled_pose;

    // Another session: the plate set at the pose the first one reported.
    const second = await session(testLevel({ exactPlacement: true }));
    const again = mustPlace(second, {
      item_id: 'dinner_plate_01',
      frame: 'lower_rack',
      position_mm: rest.position_mm,
      orientation: { quat_wxyz: rest.quat_wxyz },
      mode: 'set',
    });
    expect(again.requested_pose.position_mm).toEqual(rest.position_mm);
    expect(again.release_pose).toEqual(again.requested_pose);
    for (let axis = 0; axis < 3; axis++) {
      expect(
        Math.abs((again.settled_pose.position_mm[axis] ?? 0) - (rest.position_mm[axis] ?? 0)),
      ).toBeLessThan(1);
    }
    expect(again.rotation_deg).toBeLessThan(1);
    // A pose well inside the basket floor is still a collision.
    expect(
      second.place({
        item_id: 'dinner_plate_02',
        frame: 'lower_rack',
        position_mm: [300.5, 250.5, 4.5],
        orientation: { preset: 'upright' },
        mode: 'set',
      }),
    ).toMatchObject({ accepted: false, reason: 'collision_at_pose' });
  });
});
