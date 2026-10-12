// The shape of the results, as pure functions: what an action changed, the state as a table,
// the level card with every kind named once, slot advice a screenful at a time, and a
// client's own copy of the load kept from the results alone.
import type {
  ItemRecord,
  LevelCard,
  PlacedItemState,
  SceneState,
  SlotCard,
} from '@spotless/session';
import { describe, expect, it } from 'vitest';
import {
  LoadTracker,
  PLACED_COLUMNS,
  SLOTS_DEFAULT_LIMIT,
  SLOTS_MAX_LIMIT,
  diffStates,
  itemOfRow,
  loadItem,
  loadSummary,
  placeName,
  rowOf,
  shapeAction,
  shapeItems,
  shapeLevel,
  shapeSlots,
  shapeState,
  tidyNumbers,
} from './shape.ts';

/** A small deterministic generator, so that the random scenes are the same every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const IDS = Array.from({ length: 24 }, (_, i) => `item_${String(i).padStart(2, '0')}`);

function placed(id: string, random: () => number): PlacedItemState {
  const rack = random() < 0.5 ? 'lower_rack' : 'upper_rack';
  return {
    item_id: id,
    frame: random() < 0.2 ? 'cutlery_basket' : rack,
    // Finer than the wire, to see that nothing finer than 0.1 mm and 1e-4 gets out.
    position_mm: [random() * 500, random() * 500, random() * 200 + 0.03333333333],
    quat_wxyz: [random(), random(), random(), random() / 3],
    stable: random() < 0.9,
    contacts: [
      { with: `${rack}.floor.x`, points: 1 + Math.floor(random() * 4) },
      ...(random() < 0.5
        ? [{ with: IDS[Math.floor(random() * IDS.length)] as string, points: 2 }]
        : []),
    ],
    location: random() < 0.05 ? 'tub_floor' : rack,
  };
}

function scene(items: readonly PlacedItemState[], random: () => number, n: number): SceneState {
  const inMachine = new Set(items.map((item) => item.item_id));
  return {
    state_hash: `sha256:${Math.floor(random() * 1e15)
      .toString(16)
      .padStart(16, '0')}${'0'.repeat(48)}`,
    phase: 'loading',
    racks: { lower_rack: random() < 0.5 ? 'in' : 'out', upper_rack: random() < 0.5 ? 'in' : 'out' },
    rack_options: {
      'upper_rack.height': String(1 + Math.floor(random() * 3)),
      'lower_rack.tine_row_r1': random() < 0.8 ? 'up' : 'folded',
    },
    placed: [...items].sort((a, b) => (a.item_id < b.item_id ? -1 : 1)),
    unplaced: IDS.filter((id) => !inMachine.has(id)),
    budget: {
      actions_max: 400,
      queries_max: 300,
      washes_max: 1,
      actions_used: n,
      queries_used: Math.floor(n / 3),
      washes_used: 0,
    },
  };
}

/** The next scene: some items placed, some taken out, some nudged, the rest left alone. */
function next(before: SceneState, random: () => number, n: number): SceneState {
  let items = before.placed.filter(() => random() > 0.1);
  items = items.map((item) => (random() < 0.2 ? { ...placed(item.item_id, random) } : item));
  for (const id of before.unplaced) if (random() < 0.3) items.push(placed(id, random));
  return scene(items, random, n);
}

const longFloat = /\d\.\d{5,}/;

describe('the scene state', () => {
  it('states an item at the precision of the page and no finer', () => {
    const random = rng(1);
    const item = loadItem(placed('item_00', random));
    expect(JSON.stringify(item)).not.toMatch(longFloat);
    for (const x of item.position_mm)
      expect(Math.abs(x * 10 - Math.round(x * 10))).toBeLessThan(1e-9);
    for (const x of item.quat_wxyz)
      expect(Math.abs(x * 1e4 - Math.round(x * 1e4))).toBeLessThan(1e-9);
    // A row of the table is the item, field for field.
    expect(itemOfRow(rowOf(item))).toEqual(item);
    expect(rowOf(item)).toHaveLength(PLACED_COLUMNS.length);
  });

  it('gives the whole state as a table, or the part asked for', () => {
    const random = rng(2);
    const state = next(next(scene([], random, 0), random, 1), random, 2);
    const whole = shapeState(state);
    expect(whole.placed.columns).toEqual(PLACED_COLUMNS);
    expect(whole.placed.rows.map((row) => row[0])).toEqual(state.placed.map((p) => p.item_id));
    expect(whole.placed_total).toBe(state.placed.length);
    expect(whole.unplaced).toEqual(state.unplaced);
    expect(whole.part).toBeUndefined();
    expect(whole.budget).toEqual({ actions: '2/400', queries: '0/300', washes: '0/1' });
    expect(whole.state_hash).toHaveLength(12);

    const upper = shapeState(state, { rack: 'upper_rack' });
    expect(upper.part).toEqual({ rack: 'upper_rack' });
    expect(upper.placed_total).toBe(state.placed.length);
    expect(upper.unplaced).toBeUndefined();
    const inUpper = state.placed.filter(
      (item) => item.location === 'upper_rack' || item.frame === 'upper_rack',
    );
    expect(upper.placed.rows.map((row) => row[0])).toEqual(inUpper.map((item) => item.item_id));
    expect(inUpper.length).toBeGreaterThan(0);
    expect(inUpper.length).toBeLessThan(state.placed.length);

    const one = state.placed[0] as PlacedItemState;
    const away = state.unplaced[0] as string;
    const named = shapeState(state, { items: [one.item_id, away, 'no_such_item'] });
    expect(named.placed.rows.map((row) => row[0])).toEqual([one.item_id]);
    expect(named.unplaced).toEqual([away]);
  });

  it('sums the load up in a few numbers', () => {
    const random = rng(3);
    const state = next(next(scene([], random, 0), random, 1), random, 2);
    const summary = loadSummary(state);
    expect(summary.placed).toBe(state.placed.length);
    expect(summary.unplaced).toBe(state.unplaced.length);
    expect(Object.values(summary.by_location).reduce((a, b) => a + b, 0)).toBe(state.placed.length);
    expect(summary.unstable ?? []).toEqual(
      state.placed.filter((item) => !item.stable).map((item) => item.item_id),
    );
    expect(summary.racks).toEqual(state.racks);
  });
});

describe('what an action changed', () => {
  it('names every item whose entry differs, with its whole new entry, and nothing else', () => {
    const random = rng(4);
    const before = next(next(scene([], random, 0), random, 1), random, 2);
    const after = next(before, random, 3);
    const changes = diffStates(before, after, [
      { item_id: after.placed[0]?.item_id ?? '', displacement_mm: 12.34567, rotation_deg: 46.789 },
    ]);
    const was = new Map(
      before.placed.map((item) => [item.item_id, JSON.stringify(loadItem(item))]),
    );
    const named = new Set((changes.items ?? []).map((item) => item.item_id));
    for (const item of after.placed) {
      const same = was.get(item.item_id) === JSON.stringify(loadItem(item));
      expect(named.has(item.item_id), item.item_id).toBe(!same);
    }
    expect(changes.to_counter ?? []).toEqual(
      before.placed
        .map((item) => item.item_id)
        .filter((id) => !after.placed.some((item) => item.item_id === id)),
    );
    expect(JSON.stringify(changes)).not.toMatch(longFloat);
    // Only what changed is there at all.
    expect(diffStates(after, after)).toEqual({});
  });

  it('lets a client that applies every change end with exactly what get_state returns', () => {
    for (const seed of [11, 12, 13, 14, 15]) {
      const random = rng(seed);
      let state = scene([], random, 0);
      const tracker = new LoadTracker();
      expect(tracker.complete).toBe(false);
      // The first action of a client not yet given the scene carries it whole; later ones their changes.
      let told: SceneState | null = null;
      for (let n = 1; n <= 60; n++) {
        const after = next(state, random, n);
        const result = shapeAction(
          'set_rack',
          {
            accepted: true,
            moved_items: [],
            returned: [],
            state_hash: after.state_hash,
            state: after,
          },
          told,
        ) as { state?: unknown; changes?: unknown };
        expect(result.state === undefined, `first result carries the state (${n})`).toBe(n !== 1);
        expect(result.changes === undefined).toBe(n === 1);
        tracker.apply('set_rack', JSON.parse(JSON.stringify(result)));
        told = after;
        state = after;
        expect(tracker.state(), `seed ${seed}, action ${n}`).toEqual(
          JSON.parse(JSON.stringify(shapeState(state))),
        );
      }
      expect(tracker.complete).toBe(true);
    }
  });

  it('keeps a client right through refusals, queries and parts of the state', () => {
    const random = rng(21);
    const first = next(scene([], random, 0), random, 1);
    const tracker = new LoadTracker();
    tracker.apply('get_state', JSON.parse(JSON.stringify(shapeState(first))));
    const before = JSON.stringify(tracker.state());
    // A refusal and a query that says nothing of the scene change nothing.
    tracker.apply('place', { accepted: false, reason: 'collision_at_pose' });
    tracker.apply('preview', { accepted: true, collision_free: true });
    expect(JSON.stringify(tracker.state())).toBe(before);
    // A charged query says how many queries are used.
    tracker.apply('render', { accepted: true, view: 'front', budget: { queries: '7/300' } });
    expect(tracker.state().budget.queries).toBe('7/300');
    // A part of a later state brings that part up to date, and only that part.
    const later = next(first, random, 2);
    tracker.apply(
      'get_state',
      JSON.parse(JSON.stringify(shapeState(later, { rack: 'upper_rack' }))),
    );
    const upper = (item: { location: string; frame: string }): boolean =>
      item.location === 'upper_rack' || item.frame === 'upper_rack';
    const mine = tracker.state().placed.rows.map(itemOfRow);
    expect(mine.filter(upper)).toEqual(later.placed.map(loadItem).filter(upper));
    // A copy does not follow the original.
    const copy = tracker.clone();
    tracker.apply('get_state', JSON.parse(JSON.stringify(shapeState(scene([], random, 9)))));
    expect(copy.state().placed.rows.length).toBe(mine.length);
    expect(tracker.state().placed.rows).toEqual([]);
  });

  it('shapes a placement as the feedback of the drop and the changes, not the scene', () => {
    const random = rng(31);
    const before = next(next(scene([], random, 0), random, 1), random, 2);
    const item = placed(before.unplaced[0] as string, random);
    const after: SceneState = {
      ...before,
      state_hash: `sha256:${'ab'.repeat(32)}`,
      placed: [...before.placed, item].sort((a, b) => (a.item_id < b.item_id ? -1 : 1)),
      unplaced: before.unplaced.slice(1),
    };
    const raw = {
      accepted: true,
      item_id: item.item_id,
      requested_pose: { frame: item.frame, position_mm: [1, 2, 3], quat_wxyz: [1, 0, 0, 0] },
      release_pose: { frame: item.frame, position_mm: [1, 2, 2.123456], quat_wxyz: [1, 0, 0, 0] },
      settled_pose: { frame: item.frame, position_mm: item.position_mm, quat_wxyz: item.quat_wxyz },
      displacement_mm: 6.123456789,
      rotation_deg: 2.987654321,
      settle_time_s: 1.0291234,
      stable: true,
      resting: { lowest_point_mm: 3.912345, on_base: true, force_over_weight: 1.0999 },
      fell_through: false,
      fell_out: false,
      returned: [],
      contacts: [{ with: 'lower_rack.tine_row_r1', points: 3, normal_force_N: 4.5412345 }],
      moved_items: [],
      state_hash: after.state_hash,
      state: after,
    };
    const result = shapeAction('place', raw, before) as { [key: string]: unknown };
    const text = JSON.stringify(result);
    expect(text).not.toMatch(longFloat);
    expect(result).toMatchObject({
      accepted: true,
      item_id: item.item_id,
      displacement_mm: 6.1,
      rotation_deg: 3,
      settle_time_s: 1,
      stable: true,
      resting: { lowest_point_mm: 3.9, on_base: true, force_over_weight: 1.1 },
      contact_forces_N: { 'lower_rack.tine_row_r1': 4.54 },
      changes: { items: [loadItem(item)] },
      budget: { actions: '2/400' },
      state_hash: 'abababababab',
    });
    // What does not apply is not said, and the scene is not repeated.
    for (const absent of ['fell_through', 'fell_out', 'returned', 'state', 'moved_items'])
      expect(result[absent], absent).toBeUndefined();
    expect(text.length).toBeLessThan(1200);
    // A refusal is the game's, rounded.
    expect(
      shapeAction(
        'place',
        { accepted: false, reason: 'collision_at_pose', penetration_mm: 7.5912 },
        before,
      ),
    ).toEqual({ accepted: false, reason: 'collision_at_pose', penetration_mm: 7.59 });
  });
});

describe('numbers', () => {
  it('rounds every number to what a player can use', () => {
    expect(
      tidyNumbers({
        surface_film_g: 0.123456789012345,
        retained_water_ml: 12.3456789,
        residual_mass_fraction: 0.000123456789,
        nested: [{ visible_area_mm2: 3.14159265 }, 2.000000001, -0.00000001],
        text: '0.123456789',
      }),
    ).toEqual({
      surface_film_g: 0.12,
      retained_water_ml: 12.3,
      residual_mass_fraction: 0.0001,
      nested: [{ visible_area_mm2: 3.1 }, 2, 0],
      text: '0.123456789',
    });
  });
});

function record(id: string, type: 'plate' | 'bowl' | 'fork', points: number): ItemRecord {
  const round = type !== 'fork';
  return {
    item_id: id,
    class: type === 'plate' ? 'dinner_plate' : type === 'bowl' ? 'cereal_bowl' : 'dinner_fork',
    display_name: type,
    material: round ? 'porcelain_glazed' : 'stainless_steel',
    mass_kg: 0.44041234,
    bbox_mm: round ? [270, 270, 28] : [185, 24, 7.1],
    reference_point_mm: [0, 0, 14],
    dims: round ? { diameter: 270 } : { length: 185 },
    orientation_presets: [
      { name: round ? 'upright' : 'flat', quat_wxyz: [1, 0, 0, 0], description: 'as on a table' },
      {
        name: 'on_edge',
        quat_wxyz: [0.7071, 0.7071, 0, 0],
        description: round ? 'on its edge between tines' : 'on its edge in a cutlery tray',
      },
    ],
    soils: [
      {
        description: `sauce on ${id}`,
        type: 'tomato_sauce',
        regions: [{ region: 'well', coverage: 0.4 }],
        amount_g: 2.5912,
        age_h: 2,
        heat_history: 'none',
      },
    ],
    points,
  } as unknown as ItemRecord;
}

describe('the level card', () => {
  const records = [
    record('plate_01', 'plate', 10),
    record('plate_02', 'plate', 10),
    record('plate_03', 'plate', 12),
    record('bowl_01', 'bowl', 8),
    record('fork_01', 'fork', 2),
    // A second kind of the same class.
    { ...record('plate_big_01', 'plate', 14), bbox_mm: [300, 300, 30], dims: { diameter: 300 } },
  ] as ItemRecord[];

  it('names every kind of piece once and every item with its kind, soil and points', () => {
    const shaped = shapeItems(records);
    expect(Object.keys(shaped.item_types)).toEqual([
      'dinner_plate',
      'cereal_bowl',
      'dinner_fork',
      'dinner_plate_2',
    ]);
    // Every item is in one entry; pieces that agree in kind, soil and points share theirs.
    const ids = (shaped.items as { item_ids: string[] }[]).flatMap((entry) => entry.item_ids);
    expect(ids).toEqual(records.map((entry) => entry.item_id));
    expect(shaped.items[2]).toMatchObject({
      item_ids: ['plate_03'],
      type: 'dinner_plate',
      points: 12,
    });
    expect(shaped.items[5]).toMatchObject({ item_ids: ['plate_big_01'], type: 'dinner_plate_2' });
    const twins = shapeItems(
      records.map((entry) => ({
        ...entry,
        soils: entry.soils.map((soil) => ({ ...soil, description: 'sauce' })),
      })),
    );
    expect(twins.items[0]).toMatchObject({ item_ids: ['plate_01', 'plate_02'], points: 10 });
    expect(twins.items).toHaveLength(records.length - 1);
    expect((shaped.items[0] as { soils: unknown[] }).soils[0]).toMatchObject({
      regions: { well: 0.4 },
      amount_g: 2.59,
    });
    // A preset is explained once; a kind that means something else by a name says so itself.
    expect(shaped.orientation_presets['on_edge']).toEqual({
      quat_wxyz: [0.7071, 0.7071, 0, 0],
      description: 'on its edge between tines',
    });
    expect(shaped.item_types['dinner_plate']?.orientation_presets).toEqual(['upright', 'on_edge']);
    expect(shaped.item_types['dinner_fork']?.orientation_presets).toEqual([
      'flat',
      {
        name: 'on_edge',
        quat_wxyz: [0.7071, 0.7071, 0, 0],
        description: 'on its edge in a cutlery tray',
      },
    ]);
  });

  it('loses nothing of an item: its record can be put together again from the card', () => {
    const shaped = shapeItems(records);
    for (const original of records) {
      const item = shaped.items.find((entry) =>
        (entry as { item_ids: string[] }).item_ids.includes(original.item_id),
      ) as { type: string; points: number; soils: { regions: { [r: string]: number } }[] };
      const kind = shaped.item_types[item.type];
      if (kind === undefined) throw new Error('no such kind');
      expect(kind.class).toBe(original.class);
      expect(kind.bbox_mm).toEqual(original.bbox_mm);
      expect(kind.dims).toEqual(original.dims);
      const presets = kind.orientation_presets.map((preset) =>
        typeof preset === 'string'
          ? { name: preset, ...shaped.orientation_presets[preset] }
          : preset,
      );
      expect(presets).toEqual(original.orientation_presets);
      expect(item.points).toBe(original.points);
      expect(Object.entries(item.soils[0]?.regions ?? {})).toEqual(
        original.soils[0]?.regions.map((entry) => [entry.region, entry.coverage]),
      );
    }
  });

  it('grows with the kinds of a level, not with its pieces', () => {
    const many = Array.from({ length: 100 }, (_, i) => record(`plate_${i}`, 'plate', 10));
    const card = { items: many, rules: {}, manual: 'm', level_id: 'x' } as unknown as LevelCard;
    const whole = JSON.stringify(many).length;
    const shaped = shapeLevel(card) as {
      item_types: object;
      items_total: number;
      points_total: number;
    };
    expect(Object.keys(shaped.item_types)).toHaveLength(1);
    expect(shaped).toMatchObject({ items_total: 100, points_total: 1000 });
    expect(JSON.stringify(shaped).length).toBeLessThan(whole / 2);
    // For a prompt that states the rules in words, the card comes without them.
    expect(shapeLevel(card, { rules: false })).not.toHaveProperty('manual');
  });
});

/** A basket of two paired rows of plate slots and some shelves, as `list_slots` answers. */
function basket(taken: readonly number[] = []): {
  accepted: true;
  rack: string;
  tine_rows: unknown[];
  slots: SlotCard[];
} {
  const slots: SlotCard[] = [];
  for (const row of ['tine_row_r1', 'tine_row_r2']) {
    for (let i = 0; i < 22; i++) {
      const free = !taken.includes(i);
      slots.push({
        id: `${row}.slot_${String(i).padStart(2, '0')}`,
        kind: 'plate_slot',
        centre_mm: [60 + i * 18.6, row === 'tine_row_r1' ? 423 : 324, 11],
        width_mm: 14.2,
        tine_row: row,
        suggested_drop: {
          position_mm: [60 + i * 18, 368, 143],
          orientation: { preset: 'on_edge', roll_deg: 5, yaw_deg: i < 11 ? 90 : -90 },
        },
        drop_free: free,
        ...(free ? {} : { drop_blocked_by: [`plate_${i}`] }),
        drop_seats: i % 7 !== 6,
      });
    }
  }
  for (let i = 0; i < 9; i++) {
    slots.push({
      id: `cup_shelf_${i}`,
      kind: 'cup_shelf',
      centre_mm: [i, 2, 3],
      width_mm: 80,
      size_mm: [80, 200],
    });
  }
  return {
    accepted: true,
    rack: 'lower_rack',
    tine_rows: ['tine_row_r1', 'tine_row_r2'].map((id, k) => ({
      id,
      start_mm: [54.5, k === 0 ? 423 : 324, 11],
      end_mm: [464.5, k === 0 ? 423 : 324, 11],
      count: 23,
      pitch_mm: 18.63636,
      height_mm: 77,
      lean_deg: 15,
      folded: false,
      runs: 'x',
      lean_toward: 'mixed',
      partner: { id: k === 0 ? 'tine_row_r2' : 'tine_row_r1', spacing_mm: 99 },
    })),
    slots,
  };
}

interface Places {
  places_total: number;
  free_seated: number;
  free_above_tines: number;
  not_free: number;
  offset: number;
  next_offset?: number;
  places: { columns: string[]; rows: [string, number[], { preset: string }, boolean, string][] };
}

describe('slot advice', () => {
  it('fits in a screen whatever the basket holds, and says how many places there are', () => {
    const raw = basket([3, 4, 12]);
    const whole = JSON.stringify(raw).length;
    const first = shapeSlots(raw, { item_id: 'plate_01' }) as Places;
    expect(first.places.rows).toHaveLength(SLOTS_DEFAULT_LIMIT);
    expect(first.places_total).toBe(22);
    expect(first.free_seated + first.free_above_tines + first.not_free).toBe(22);
    expect(first.not_free).toBe(3);
    expect(first.next_offset).toBe(SLOTS_DEFAULT_LIMIT);
    expect(JSON.stringify(first).length).toBeLessThan(2500);
    expect(JSON.stringify(first).length).toBeLessThan(whole / 5);
    // Most useful first: free and seating, then free above the tines, then taken.
    const order = first.places.rows.map((row) => (row[3] ? (row[4] === '' ? 0 : 1) : 2));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(first.places.rows[0]?.[4]).toBe('');
    // A place is ready to pass to place, and a pair of rows is one place naming both.
    expect(first.places.rows[0]?.[0]).toBe('tine_row_r1+tine_row_r2.slot_00');
    expect(first.places.rows[0]?.[1]).toEqual([60, 368, 143]);
    expect(first.places.rows[0]?.[2]).toEqual({ preset: 'on_edge', roll_deg: 5, yaw_deg: 90 });
  });

  it('gives the rest on request: by offset, with a larger limit, by row; never more than the cap', () => {
    const raw = basket([3, 4, 12]);
    const seen: string[] = [];
    let offset: number | undefined = 0;
    let pages = 0;
    while (offset !== undefined) {
      const page = shapeSlots(raw, { item_id: 'plate_01' }, { offset }) as Places;
      expect(page.places.rows.length).toBeLessThanOrEqual(SLOTS_DEFAULT_LIMIT);
      seen.push(...page.places.rows.map((row) => row[0]));
      offset = page.next_offset;
      pages += 1;
    }
    // Every place exactly once, the taken ones last, with what is in the way.
    expect(pages).toBe(2);
    expect(new Set(seen).size).toBe(22);
    expect(seen.slice(-3)).toEqual([
      'tine_row_r1+tine_row_r2.slot_03',
      'tine_row_r1+tine_row_r2.slot_04',
      'tine_row_r1+tine_row_r2.slot_12',
    ]);
    const last = shapeSlots(raw, { item_id: 'plate_01' }, { offset: 19 }) as Places;
    expect(last.places.rows.map((row) => [row[3], row[4]])).toEqual([
      [false, 'drop_blocked_by plate_3'],
      [false, 'drop_blocked_by plate_4'],
      [false, 'drop_blocked_by plate_12'],
    ]);
    const capped = shapeSlots(raw, { item_id: 'plate_01' }, { limit: 500 }) as Places;
    expect(capped.places.rows).toHaveLength(22);
    const big = {
      ...raw,
      slots: [
        ...raw.slots,
        ...basket().slots.map((slot, i) => ({
          ...slot,
          id: `x${i}.${slot.id}`,
          tine_row: `x${i}`,
          suggested_drop:
            slot.suggested_drop === undefined
              ? undefined
              : { ...slot.suggested_drop, position_mm: [i, i, i] },
        })),
      ],
    };
    const most = shapeSlots(big, { item_id: 'plate_01' }, { limit: 500 }) as Places;
    expect(most.places.rows).toHaveLength(SLOTS_MAX_LIMIT);
    expect(JSON.stringify(most).length).toBeLessThan(6000);
    const row = shapeSlots(
      raw,
      { item_id: 'plate_01' },
      { row: 'tine_row_r2', limit: 30 },
    ) as Places;
    expect(row.places_total).toBe(22);
    expect(shapeSlots(raw, { item_id: 'plate_01' }, { row: 'tine_row_zz' })).toMatchObject({
      places_total: 0,
    });
  });

  it('says so when a basket has no place for the item', () => {
    const raw = { ...basket(), slots: basket().slots.filter((slot) => slot.kind === 'cup_shelf') };
    expect(shapeSlots(raw, { item_id: 'glass_01' })).toMatchObject({
      places_total: 0,
      places: { rows: [] },
      note: expect.stringContaining('wherever a pose is free') as string,
    });
  });

  it('gives the basket as geometry when no item is named: rows as a table, slots a screenful', () => {
    const raw = basket();
    const shaped = shapeSlots(raw, {}) as {
      tine_rows: { columns: string[]; rows: unknown[][] };
      slots_total: number;
      slots_by_kind: { [kind: string]: number };
      slots: { rows: unknown[][] };
      next_offset?: number;
    };
    expect(shaped.tine_rows.rows).toEqual([
      [
        'tine_row_r1',
        [54.5, 423, 11],
        [464.5, 423, 11],
        23,
        18.6,
        77,
        15,
        'mixed',
        false,
        'tine_row_r2',
      ],
      [
        'tine_row_r2',
        [54.5, 324, 11],
        [464.5, 324, 11],
        23,
        18.6,
        77,
        15,
        'mixed',
        false,
        'tine_row_r1',
      ],
    ]);
    expect(shaped.tine_rows.columns).toHaveLength(10);
    expect(shaped.slots_total).toBe(53);
    expect(shaped.slots_by_kind).toEqual({ plate_slot: 44, cup_shelf: 9 });
    expect(shaped.slots.rows).toHaveLength(SLOTS_DEFAULT_LIMIT);
    expect(shaped.next_offset).toBe(SLOTS_DEFAULT_LIMIT);
    expect(JSON.stringify(shaped).length).toBeLessThan(2500);
    const shelves = shapeSlots(raw, {}, { offset: 44, limit: 30 }) as typeof shaped;
    expect(shelves.slots.rows).toHaveLength(9);
    expect(shelves.slots.rows[0]).toEqual(['cup_shelf_0', 'cup_shelf', [0, 2, 3], 80, [80, 200]]);
    expect(shelves.next_offset).toBeUndefined();
    // A refusal is the game's.
    expect(shapeSlots({ accepted: false, reason: 'unknown_rack' }, {})).toEqual({
      accepted: false,
      reason: 'unknown_rack',
    });
  });

  it('names a place by its slot, or by both rows of a pair', () => {
    expect(placeName(['tine_row_r1.slot_05'])).toBe('tine_row_r1.slot_05');
    expect(placeName(['tine_row_r1.slot_05', 'tine_row_r2.slot_05'])).toBe(
      'tine_row_r1+tine_row_r2.slot_05',
    );
    expect(placeName(['tine_row_mr.slot_05', 'tine_row_fr.slot_04'])).toBe(
      'tine_row_mr.slot_05+tine_row_fr.slot_04',
    );
    expect(placeName(['cell_c00'])).toBe('cell_c00');
  });
});
