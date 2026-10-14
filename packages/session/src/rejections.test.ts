// Every reason a call can be rejected for, that a rejection is free and changes nothing, and
// the budgets.
import { describe, expect, it } from 'vitest';
import type { GameSession } from './session.ts';
import { testLevel } from './test-level.ts';
import { mustPlace, mustSetRack, useSessions } from './test-util.ts';
import type { PlaceRequest } from './types.ts';

const session = useSessions();

const BOWL: PlaceRequest = {
  item_id: 'bowl_01',
  frame: 'lower_rack',
  position_mm: [420, 270, 200],
  orientation: { preset: 'inverted' },
};

/** Runs a call that must be rejected for `reason`, free of charge and without any effect. */
function rejected(
  s: GameSession,
  reason: string,
  call: () => { readonly accepted: boolean; readonly reason?: string },
): void {
  const hash = s.stateHash();
  const logged = s.actionLog().length;
  const budget = s.actionLog()[logged - 1]?.budget;
  const result = call();
  expect(result).toMatchObject({ accepted: false, reason });
  expect(s.stateHash()).toBe(hash);
  const event = s.actionLog()[logged];
  expect(event).toMatchObject({ accepted: false, state_hash: hash });
  if (budget !== undefined) expect(event?.budget).toEqual(budget);
}

describe('place', () => {
  it('rejects malformed requests as invalid_argument', async () => {
    const s = await session(testLevel());
    s.getState();
    const bad: unknown[] = [
      null,
      { ...BOWL, item_id: 7 },
      { ...BOWL, frame: 'third_rack' },
      { ...BOWL, frame: 'sink' },
      { ...BOWL, position_mm: [1, 2] },
      { ...BOWL, position_mm: [1, 2, Number.NaN] },
      { ...BOWL, orientation: { preset: 'sideways' } },
      { ...BOWL, orientation: { quat_wxyz: [0, 0, 0, 0] } },
      { ...BOWL, orientation: { preset: 'inverted', yaw_deg: 'ninety' } },
      { ...BOWL, orientation: {} },
      { ...BOWL, mode: 'throw' },
      { ...BOWL, mode: 'insert', insert_dir: [0, 0, 0] },
    ];
    for (const request of bad) {
      rejected(s, 'invalid_argument', () => s.place(request as PlaceRequest));
    }
  });

  it('rejects unknown_item, already_placed, out_of_bounds, collision_at_pose, not_insertable', async () => {
    const s = await session(testLevel());
    s.getState();
    rejected(s, 'unknown_item', () => s.place({ ...BOWL, item_id: 'kettle_01' }));
    rejected(s, 'out_of_bounds', () => s.place({ ...BOWL, position_mm: [-40, 270, 200] }));
    rejected(s, 'out_of_bounds', () => s.place({ ...BOWL, position_mm: [420, 270, 900] }));
    rejected(s, 'out_of_bounds', () =>
      s.place({ ...BOWL, frame: 'cutlery_basket', position_mm: [200, 20, 100] }),
    );
    rejected(s, 'out_of_bounds', () =>
      s.place({ ...BOWL, frame: 'tub', position_mm: [0, 500, 300] }),
    );

    // Half-way into the floor of the basket.
    const sunk = s.place({ ...BOWL, position_mm: [420, 270, 10] });
    expect(sunk).toMatchObject({ accepted: false, reason: 'collision_at_pose' });
    if (!sunk.accepted) {
      expect(sunk.penetration_mm).toBeGreaterThan(0.5);
      // The part of the machine that is in the way is named as a contact names it (the lead's
      // note of 2026-10-11: a model that was told only `upper_rack_fittings` folded the wrong
      // shelf five times running).
      const parts = sunk.colliding_with ?? [];
      expect(parts.length).toBeGreaterThan(0);
      for (const name of parts) expect(name).toMatch(/^lower_rack\.(floor|tine_row)/);
    }
    rejected(s, 'collision_at_pose', () => s.place({ ...BOWL, position_mm: [420, 270, 10] }));

    const first = mustPlace(s, BOWL);
    rejected(s, 'already_placed', () => s.place(BOWL));
    // Into the bowl that is there.
    rejected(s, 'collision_at_pose', () =>
      s.place({
        ...BOWL,
        item_id: 'bowl_02',
        position_mm: [
          first.settled_pose.position_mm[0],
          first.settled_pose.position_mm[1],
          first.settled_pose.position_mm[2],
        ],
        orientation: { quat_wxyz: first.settled_pose.quat_wxyz },
      }),
    );
    // Under the bowl that is there: free, but nothing can come straight down to it.
    rejected(s, 'not_insertable', () =>
      s.place({
        item_id: 'teaspoon_01',
        frame: 'lower_rack',
        position_mm: [
          first.settled_pose.position_mm[0],
          first.settled_pose.position_mm[1],
          first.settled_pose.position_mm[2] - 15,
        ],
        orientation: { preset: 'flat' },
      }),
    );
    expect(s.getState().budget.actions_used).toBe(1);
  });

  // Review of the loading, 2026-10-11: the roof of the tub is a sheet 2 mm thick, the stem of
  // a glass passed through it within the tolerance of `place`, and the glass came to hang by
  // its foot on the roof, its rim 27 mm above the floor of the basket.
  it('refuses a pose that reaches through the roof of the tub, and names the roof', async () => {
    const s = await session({
      ...testLevel(),
      id: 'through-the-roof',
      items: [{ id: 'stem_01', itemType: 'wine_glass_generic_200', points: 1, soils: [] }],
    });
    mustSetRack(s, 'upper_rack', 'position', 'out');
    // The rear of the pulled-out upper basket is still under the roof.
    for (const [x, z] of [
      [425, 190],
      [425, 150],
      [200, 190],
    ] as const) {
      rejected(s, 'collision_at_pose', () => {
        const result = s.place({
          item_id: 'stem_01',
          frame: 'upper_rack',
          position_mm: [x, 415, z],
          orientation: { preset: 'inverted' },
        });
        expect(result).toMatchObject({ colliding_with: ['tub.roof'] });
        if (!result.accepted) expect(result.penetration_mm).toBeGreaterThan(5);
        return result;
      });
    }
    // In front of the opening the same glass is let down and stands in the basket.
    const placed = mustPlace(s, {
      item_id: 'stem_01',
      frame: 'upper_rack',
      position_mm: [200, 250, 215],
      orientation: { preset: 'inverted' },
    });
    expect(placed.contacts.map((c) => c.with).some((name) => name.startsWith('tub.'))).toBe(false);
  });

  it('accepts a pose in the tub frame and reports it in the tub frame', async () => {
    const s = await session(testLevel());
    const card = s.getLevel();
    const lower = card.machine.racks.find((r) => r.rack === 'lower_rack');
    const origin = lower?.origin_out_mm ?? [0, 0, 0];
    const inRack = s.preview(BOWL);
    const inTub = s.preview({
      ...BOWL,
      frame: 'tub',
      position_mm: [origin[0] + 420, origin[1] + 270, origin[2] + 200],
    });
    expect(inRack.accepted && inTub.accepted).toBe(true);
    if (!inRack.accepted || !inTub.accepted) return;
    // The origin of the card is rounded to 0.1 mm and the request to 1 mm.
    const a = inRack.lowered_pose?.position_mm ?? [0, 0, 0];
    const b = inTub.lowered_pose?.position_mm ?? [0, 0, 0];
    expect(inTub.lowered_pose?.frame).toBe('tub');
    expect(Math.abs(b[0] - origin[0] - a[0])).toBeLessThanOrEqual(0.6);
    expect(Math.abs(b[1] - origin[1] - a[1])).toBeLessThanOrEqual(0.6);
    expect(Math.abs(b[2] - origin[2] - a[2])).toBeLessThan(1.5);
  });

  it('quantises positions to 1 mm and angles to 1 degree', async () => {
    const s = await session(testLevel());
    const a = s.preview({
      ...BOWL,
      position_mm: [420.4, 269.6, 200.49],
      orientation: { preset: 'inverted', yaw_deg: 29.6 },
    });
    const b = s.preview({
      ...BOWL,
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted', yaw_deg: 30 },
    });
    expect(a.accepted && b.accepted).toBe(true);
    if (!a.accepted || !b.accepted) return;
    expect(a.requested_pose).toEqual(b.requested_pose);
    expect(a.requested_pose.position_mm).toEqual([420, 270, 200]);
    expect(a.lowered_pose).toEqual(b.lowered_pose);
    // A reported orientation sent back denotes the same orientation.
    const again = s.preview({ ...BOWL, orientation: { quat_wxyz: a.requested_pose.quat_wxyz } });
    expect(again.accepted && again.requested_pose).toEqual(a.requested_pose);
  });

  it('turns a contact-capacity failure of the engine into a free rejection', async () => {
    // An engine with room for two contact manifolds cannot hold a bowl on a basket.
    const s = await session(testLevel(), { physics: { maxContactConstraints: 2 } });
    s.getState();
    rejected(s, 'physics_limit', () => s.place(BOWL));
    const state = s.getState();
    expect(state.placed).toEqual([]);
    expect(state.unplaced).toContain('bowl_01');
    expect(state.budget.actions_used).toBe(0);
  });
});

describe('remove, reset and set_rack', () => {
  it('reject unknown_item, not_placed, unknown_option and invalid arguments', async () => {
    const s = await session(testLevel());
    s.getState();
    rejected(s, 'unknown_item', () => s.remove({ item_id: 'kettle_01' }));
    rejected(s, 'not_placed', () => s.remove({ item_id: 'bowl_01' }));
    rejected(s, 'invalid_argument', () => s.remove({} as { item_id: string }));
    rejected(s, 'unknown_option', () =>
      s.setRack({ rack: 'third_rack', option: { name: 'position', value: 'out' } }),
    );
    // The cutlery basket has one option, where it stands, and only the places of the machine.
    rejected(s, 'unknown_option', () =>
      s.setRack({ rack: 'cutlery_basket', option: { name: 'position', value: 'rear_left' } }),
    );
    rejected(s, 'unknown_option', () =>
      s.setRack({ rack: 'cutlery_basket', option: { name: 'height', value: '2' } }),
    );
    rejected(s, 'unknown_option', () =>
      s.setRack({ rack: 'lower_rack', option: { name: 'height', value: '2' } }),
    );
    rejected(s, 'unknown_option', () =>
      s.setRack({ rack: 'upper_rack', option: { name: 'height', value: '9' } }),
    );
    rejected(s, 'unknown_option', () =>
      s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'half' } }),
    );
    rejected(s, 'unknown_option', () =>
      s.setRack({ rack: 'lower_rack', option: { name: 'tine_row_ml', value: 'folded' } }),
    );
    rejected(s, 'invalid_argument', () =>
      s.setRack({ rack: 'lower_rack', option: { name: 'position', value: 'out' } }),
    );
    rejected(s, 'invalid_argument', () => s.setRack({ rack: 'lower_rack' } as never));
  });

  it('reset takes everything out and keeps the racks as they are', async () => {
    const s = await session(testLevel());
    mustSetRack(s, 'lower_rack', 'tine_row_r1', 'folded');
    mustPlace(s, BOWL);
    mustPlace(s, {
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      position_mm: [32, 28, 120],
      orientation: { preset: 'handle_down' },
    });
    const empty = s.reset();
    expect(empty.accepted).toBe(true);
    if (!empty.accepted) return;
    expect(empty.removed).toEqual(['bowl_01', 'fork_01']);
    expect(empty.state.placed).toEqual([]);
    expect(empty.state.rack_options['lower_rack.tine_row_r1']).toBe('folded');
    expect(empty.state.budget.actions_used).toBe(4);
    // The same pose is free again.
    expect(s.place(BOWL).accepted).toBe(true);
  });

  it('a basket that is held back by the load stays where it is', async () => {
    const s = await session(testLevel());
    // A frying pan stood handle up in the lower basket reaches higher than the underside of
    // the upper one.
    mustPlace(s, {
      item_id: 'pan_01',
      frame: 'lower_rack',
      position_mm: [110, 120, 330],
      orientation: { preset: 'on_edge_handle_up', yaw_deg: 90 },
    });
    const hash = s.stateHash();
    const pulled = s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'out' } });
    if (pulled.accepted) {
      // The basket came out and knocked the pan about.
      expect(pulled.moved_items.map((m) => m.item_id)).toEqual(['pan_01']);
    } else {
      expect(pulled).toMatchObject({ reason: 'blocked', blocked_by: ['pan_01'] });
      expect(s.stateHash()).toBe(hash);
      expect(s.getState().racks.upper_rack).toBe('in');
    }
  });
});

describe('budgets', () => {
  it('stop actions at the cap but never the start of the cycle', async () => {
    const s = await session(testLevel({ actionsMax: 2 }));
    mustPlace(s, BOWL);
    // Rejected calls are free.
    rejected(s, 'already_placed', () => s.place(BOWL));
    expect(s.remove({ item_id: 'bowl_01' }).accepted).toBe(true);
    expect(s.getState().budget).toMatchObject({ actions_used: 2, actions_max: 2 });
    rejected(s, 'budget_exhausted', () => s.place(BOWL));
    rejected(s, 'budget_exhausted', () => s.reset());
    rejected(s, 'budget_exhausted', () =>
      s.setRack({ rack: 'upper_rack', option: { name: 'height', value: '2' } }),
    );
    rejected(s, 'budget_exhausted', () =>
      s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'out' } }),
    );
    const started = s.startCycle();
    expect(started.accepted).toBe(true);
    expect(started.accepted && started.state.budget).toMatchObject({
      actions_used: 2,
      washes_used: 1,
    });
    await s.washSettled();
  });

  it('stop queries at the cap, except the three that are always answered', async () => {
    const s = await session(testLevel({ queriesMax: 3 }));
    // A preview is answered and logged but never counted: a rejected place says the same.
    expect(s.preview(BOWL).accepted).toBe(true);
    expect(s.getItem({ item_id: 'bowl_01' }).accepted).toBe(true);
    expect(s.listSlots({ rack: 'upper_rack' }).accepted).toBe(true);
    // A refused query is not counted.
    rejected(s, 'unknown_item', () => s.getItem({ item_id: 'kettle_01' }));
    rejected(s, 'unknown_rack', () => s.listSlots({ rack: 'third_rack' }));
    rejected(s, 'invalid_argument', () => s.preview({ ...BOWL, position_mm: [0, 0] as never }));
    expect(s.chargeQuery('render', { view: 'iso_lower' })).toEqual({ accepted: true });
    expect(s.getState().budget.queries_used).toBe(3);
    expect(s.preview(BOWL).accepted).toBe(true);
    rejected(s, 'query_budget_exhausted', () => s.getItem({ item_id: 'bowl_01' }));
    rejected(s, 'query_budget_exhausted', () => s.listSlots({ rack: 'lower_rack' }));
    rejected(s, 'query_budget_exhausted', () => s.checkLoad());
    rejected(s, 'query_budget_exhausted', () => s.chargeQuery('render', { view: 'iso_lower' }));
    // Still answered, and not counted beyond the cap.
    expect(s.getLevel().level_id).toBe('test-level');
    expect(s.getState().budget.queries_used).toBe(3);
    expect(s.chargeQuery('get_report', {})).toEqual({ accepted: true });
    expect(s.getReport()).toMatchObject({ accepted: false, reason: 'no_cycle_started' });
    // Actions do not need the query budget.
    expect(s.place(BOWL).accepted).toBe(true);
  });

  it('preview refuses an item that is in the machine, check_load a level without checks', async () => {
    const s = await session(testLevel({ mechanicalChecks: false }));
    mustPlace(s, BOWL);
    rejected(s, 'already_placed', () => s.preview(BOWL));
    rejected(s, 'not_available', () => s.checkLoad());
    expect(s.getLevel().rules.mechanical_checks).toBe(false);
  });
});

describe('start_cycle', () => {
  it('takes the programme of the level, and no other, and washes on it', async () => {
    const s = await session(testLevel({ washesMax: 2 }));
    s.getState();
    // The card names the scored programme and nothing beside it.
    const card = s.getLevel();
    expect(card.programme.programme_id).toBe('eco_50');
    expect(card.programme.status).toBe('scored');
    expect(card.secondary_programmes).toEqual([]);
    const refused = s.startCycle({ programme: 'no_such_programme' });
    expect(refused.accepted).toBe(false);
    if (!refused.accepted) {
      expect(refused.reason).toBe('unknown_programme');
      expect(refused.detail).toBe("this level is scored on 'eco_50'");
    }
    rejected(s, 'invalid_argument', () => s.startCycle({ programme: 7 } as never));
    const started = s.startCycle({ programme: 'eco_50' });
    expect(started.accepted).toBe(true);
    if (!started.accepted) return;
    expect(started.programme).toBe('eco_50');
    expect(started.load.programme_id).toBe('eco_50');
    expect(s.washManifest()?.programme_id).toBe('eco_50');
  });

  it('rejects unknown_programme, then no_washes_left and episode_over', async () => {
    const s = await session(testLevel({ washesMax: 2 }));
    s.getState();
    rejected(s, 'unknown_programme', () => s.startCycle({ programme: 'no_such_programme' }));
    rejected(s, 'invalid_argument', () => s.startCycle(null as never));
    expect(s.startCycle({ programme: 'eco_50' }).accepted).toBe(true);
    // While the wash runs the load is frozen.
    rejected(s, 'episode_over', () => s.startCycle());
    rejected(s, 'episode_over', () => s.place(BOWL));
    rejected(s, 'episode_over', () => s.reset());
    rejected(s, 'episode_over', () =>
      s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'out' } }),
    );
    await s.washSettled();
    // Two washes are allowed in this level: loading goes on, with the baskets pushed in.
    expect(s.phase()).toBe('loading');
    expect(s.getState().racks).toEqual({ lower_rack: 'in', upper_rack: 'in' });
    expect(s.startCycle().accepted).toBe(true);
    await s.washSettled();
    expect(s.phase()).toBe('finished');
    rejected(s, 'episode_over', () => s.startCycle());
  });

  it('rejects no_washes_left when a level allows none', async () => {
    // A level cannot ask for zero washes, so use one up and then give the wash back by failing.
    let fail = true;
    const s = await session(testLevel(), {
      washRunner: async (manifest, onProgress) => {
        if (fail) throw new Error('down');
        const { placeholderWashRunner } = await import('./wash.ts');
        return placeholderWashRunner(manifest, onProgress);
      },
    });
    expect(s.startCycle().accepted).toBe(true);
    await s.washSettled();
    expect(s.getReport()).toMatchObject({ status: 'failed' });
    fail = false;
    expect(s.startCycle().accepted).toBe(true);
    await s.washSettled();
    expect(s.getState()).toMatchObject({
      phase: 'finished',
      budget: { washes_used: 1, washes_max: 1 },
    });
  });
});

describe('the session object', () => {
  it('throws when used after dispose, which is a programmer error', async () => {
    const s = await session(testLevel());
    s.dispose();
    s.dispose();
    expect(() => s.getState()).toThrow(/dispose/);
    expect(() => s.place(BOWL)).toThrow(/dispose/);
  });
});
