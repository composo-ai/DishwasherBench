// The shaped results against the game: through a real episode on a real game server, a
// client that keeps its own copy of the scene from the results alone has, after every call,
// exactly what get_state would return; results do not grow with the load; slot advice fits
// in a screen and its further parts are free; and no number is finer than a player can use.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SessionSummary } from '@spotless/server';
import type { SceneState } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import type { ToolName } from './schemas.ts';
import { OUTPUT_SCHEMAS } from './schemas.ts';
import type { PlacedRow, ShapedState } from './shape.ts';
import { LoadTracker, SLOTS_DEFAULT_LIMIT, itemOfRow, shapeState } from './shape.ts';
import { callTool, useGames } from './test-util.ts';

const games = useGames();

/** The calls of the careful reference load of the tutorial: 72 of them, 20 accepted actions. */
const LOG = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../loader/loads/tutorial-careful.json', import.meta.url)),
      'utf8',
    ),
  ) as { action_log: { name: ToolName; args: Record<string, unknown>; accepted: boolean }[] }
).action_log;

const longFloat = /\d\.\d{5,}/;

describe('results against the state of the session', () => {
  it('a client that applies every change has, after every call, what get_state returns', async () => {
    const game = await games.game();
    const id = await game.episode();
    const client = await games.connect(game, id);
    /** The scene as the game holds it, read without a query (the route the page draws from). */
    const truth = async (): Promise<ShapedState> =>
      JSON.parse(
        JSON.stringify(
          shapeState(
            ((await game.http('GET', `/api/sessions/${id}/scene`)).body as { state: SceneState })
              .state,
          ),
        ),
      ) as ShapedState;

    // Two copies: one takes in every result, the other never a get_state (but for the first
    // whole scene a client is given), so that the changes alone have to carry it.
    const all = new LoadTracker();
    const changesOnly = new LoadTracker();
    let actions = 0;
    let largestAction = 0;
    let started = false;
    for (const [n, event] of LOG.entries()) {
      const label = `call ${n}: ${event.name} ${JSON.stringify(event.args)}`;
      const result = await callTool(client, event.name, event.args);
      if (event.name === 'start_cycle') {
        started = true;
        expect(result.structured, label).toMatchObject({ accepted: true, phase: 'washing' });
      }
      // The game went the way the recorded load went.
      expect(result.isError, label).toBe(!event.accepted);
      expect(OUTPUT_SCHEMAS[event.name].safeParse(result.structured).success, label).toBe(true);
      expect(result.text, label).not.toMatch(longFloat);
      all.apply(event.name, result.structured);
      if (event.name !== 'get_state' || !changesOnly.complete) {
        changesOnly.apply(event.name, result.structured);
      }
      if (!all.complete) continue;
      const scene = await truth();
      // Once the cycle has started the wash moves the phase on by itself (here at once: the
      // test server simulates nothing); everything else stays as start_cycle left it.
      const now = started ? { ...scene, phase: all.state().phase } : scene;
      expect(all.state(), label).toEqual(now);
      // Without the get_state results the copy is the same but for the queries counted
      // by the get_state calls it did not take in.
      const { budget: mine, ...copy } = changesOnly.state();
      const { budget: theirs, ...rest } = now;
      expect(copy, label).toEqual(rest);
      expect(mine.actions, label).toBe(theirs.actions);
      if (['place', 'remove', 'set_rack', 'reset'].includes(event.name) && event.accepted) {
        actions += 1;
        largestAction = Math.max(largestAction, result.text.length);
        // An action says what it changed and gives the budgets, and does not repeat the scene.
        expect(result.structured, label).toHaveProperty('load');
        expect(result.structured, label).toHaveProperty('budget.actions');
        const whole = result.structured['state'] !== undefined;
        expect(whole, label).toBe(actions === 1 && result.structured['changes'] === undefined);
      }
    }
    expect(actions).toBeGreaterThanOrEqual(20);
    expect(all.state().placed_total).toBe(12);
    // The largest result of an action of this episode: a basket travelling with eight items
    // in it, each of which shifted. The game's own result for it carries the whole scene.
    expect(largestAction).toBeLessThan(3000);
  });

  it('an action on a load of twelve says no more than an action on a load of one', async () => {
    const game = await games.game();
    const id = await game.episode();
    const client = await games.connect(game, id);
    const sizes: number[] = [];
    let placed = 0;
    for (const event of LOG) {
      if (event.name === 'preview' || event.name === 'list_slots' || event.name === 'get_level')
        continue;
      const result = await callTool(client, event.name, event.args);
      if (event.name !== 'place' || !event.accepted) continue;
      placed += 1;
      const changed = (
        (result.structured['changes'] as { items?: unknown[] } | undefined)?.items ?? []
      ).length;
      // Placements that moved nothing else: their size is the size of one item's entry.
      if (placed > 1 && changed === 1) sizes.push(result.text.length);
    }
    expect(sizes.length).toBeGreaterThan(8);
    expect(Math.max(...sizes)).toBeLessThan(1300);
    // No trend with the load: the last such placements are no larger than the first.
    const half = sizes.length >> 1;
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(sizes.slice(half))).toBeLessThan(mean(sizes.slice(0, half)) * 1.25);
  });

  it('get_state gives a part of the state for one query, and a client can take it in', async () => {
    const game = await games.game();
    const id = await game.episode();
    const client = await games.connect(game, id);
    // Up to the placing of the second glass, which the last assertion needs on the counter.
    for (const event of LOG.slice(0, 34)) {
      if (event.name === 'preview' || event.name === 'list_slots') continue;
      await callTool(client, event.name, event.args);
    }
    const before = (await game.http('GET', `/api/sessions/${id}`)).body as SessionSummary;
    const whole = (await callTool(client, 'get_state', {})).structured as unknown as ShapedState;
    const lower = (await callTool(client, 'get_state', { rack: 'cutlery_basket' }))
      .structured as unknown as ShapedState;
    const named = (
      await callTool(client, 'get_state', { items: ['plate_01', 'glass_02', 'nothing_01'] })
    ).structured as unknown as ShapedState;
    const after = (await game.http('GET', `/api/sessions/${id}`)).body as SessionSummary;
    // Whole or part, one query each, logged as the game logs get_state.
    expect(after.budget.queries_used).toBe(before.budget.queries_used + 3);
    expect(after.events).toBe(before.events + 3);
    const rows = (state: ShapedState): PlacedRow[] => [...state.placed.rows];
    expect(rows(whole).length).toBeGreaterThan(6);
    expect(rows(lower).length).toBeGreaterThan(2);
    expect(rows(lower).length).toBeLessThan(rows(whole).length);
    expect(rows(lower)).toEqual(rows(whole).filter((row) => row[1] === 'cutlery_basket'));
    expect(lower.part).toEqual({ rack: 'cutlery_basket' });
    expect(lower.placed_total).toBe(whole.placed_total);
    expect(lower.unplaced).toBeUndefined();
    expect(rows(named).map((row) => itemOfRow(row).item_id)).toEqual(['plate_01']);
    expect(named.unplaced).toEqual(['glass_02']);
    expect(JSON.stringify(lower).length).toBeLessThan(JSON.stringify(whole).length);
  });
});

describe('the whole scene for a client that has not been given it', () => {
  it('a part of the scene asked first is not the scene: the first action still carries it whole', async () => {
    const game = await games.game();
    const id = await game.episode();
    const client = await games.connect(game, id);
    const truth = async (): Promise<ShapedState> =>
      JSON.parse(
        JSON.stringify(
          shapeState(
            ((await game.http('GET', `/api/sessions/${id}/scene`)).body as { state: SceneState })
              .state,
          ),
        ),
      ) as ShapedState;
    const copy = new LoadTracker();
    const take = async (name: ToolName, args: Record<string, unknown>) => {
      const result = await callTool(client, name, args);
      copy.apply(name, result.structured);
      return result;
    };
    // Two looks at parts of the scene: neither is the whole of it.
    await take('get_state', { rack: 'lower_rack' });
    await take('get_state', { items: ['plate_01'] });
    expect(copy.complete).toBe(false);
    const actions = LOG.filter(
      (event) => event.accepted && ['place', 'set_rack', 'remove'].includes(event.name),
    ).slice(0, 6);
    for (const [n, event] of actions.entries()) {
      const result = await take(event.name, event.args);
      expect(result.isError).toBe(false);
      // The first action gives the whole scene, the later ones what they changed.
      expect(result.structured['state'] !== undefined, `action ${n}`).toBe(n === 0);
      expect(result.structured['changes'] !== undefined, `action ${n}`).toBe(n !== 0);
      expect(copy.complete).toBe(true);
      expect(copy.state()).toEqual(await truth());
    }
    // A part asked later does not disturb the copy, and the next action is stated against
    // the whole scene the client has.
    await take('get_state', { rack: 'upper_rack' });
    expect(copy.state()).toEqual(await truth());
    const next = LOG.filter(
      (event) => event.accepted && ['place', 'set_rack', 'remove'].includes(event.name),
    )[6];
    if (next === undefined) throw new Error('no seventh action');
    const result = await take(next.name, next.args);
    expect(result.structured['changes']).toBeDefined();
    expect(copy.state()).toEqual(await truth());
  });
});

interface Places {
  places_total: number;
  free_seated: number;
  not_free: number;
  next_offset?: number;
  repeat?: boolean;
  budget: { queries: string };
  places: { rows: [string, number[], { preset: string }, boolean, string][] };
}

describe('slot advice through the tools', () => {
  it('is a screenful, most useful first, and its further parts cost nothing', async () => {
    const game = await games.game();
    const id = await game.episode();
    const client = await games.connect(game, id);
    const events = async (): Promise<number> =>
      ((await game.http('GET', `/api/sessions/${id}`)).body as SessionSummary).events;

    const first = await callTool(client, 'list_slots', { rack: 'lower_rack', item_id: 'plate_01' });
    const page = first.structured as unknown as Places;
    // The game's own answer for this basket is some 28,000 characters.
    expect(first.text.length).toBeLessThan(2500);
    expect(first.text).not.toMatch(longFloat);
    expect(page.places.rows).toHaveLength(SLOTS_DEFAULT_LIMIT);
    expect(page.places_total).toBeGreaterThan(20);
    expect(page.repeat).toBeUndefined();
    expect(page.budget.queries).toBe('1/300');
    expect(await events()).toBe(1);

    // The rest of the same list: free, not logged, and all of it within reach.
    const seen = page.places.rows.map((row) => row[0]);
    let offset = page.next_offset;
    while (offset !== undefined) {
      const more = (
        await callTool(client, 'list_slots', {
          rack: 'lower_rack',
          item_id: 'plate_01',
          offset,
          limit: 30,
        })
      ).structured as unknown as Places;
      expect(more.repeat).toBe(true);
      expect(more.budget.queries).toBe('1/300');
      seen.push(...more.places.rows.map((row) => row[0]));
      offset = more.next_offset;
    }
    expect(seen).toHaveLength(page.places_total);
    expect(new Set(seen).size).toBe(page.places_total);
    expect(await events()).toBe(1);
    const row = (
      await callTool(client, 'list_slots', {
        rack: 'lower_rack',
        item_id: 'plate_01',
        row: 'tine_row_fl',
      })
    ).structured as unknown as Places;
    expect(row.repeat).toBe(true);
    expect(row.places.rows.every((entry) => entry[0].includes('tine_row_fl'))).toBe(true);
    expect(row.places.rows.length).toBeGreaterThan(0);

    // A suggested place is ready to pass to place, and what it says holds.
    const [slot, position, orientation, free] = page.places.rows[0] as Places['places']['rows'][0];
    expect(free).toBe(true);
    const placed = await callTool(client, 'place', {
      item_id: 'plate_01',
      frame: 'lower_rack',
      position_mm: position,
      orientation,
    });
    expect(placed.structured, slot).toMatchObject({ accepted: true, stable: true });
    expect(await events()).toBe(2);

    // The scene has changed: the list is asked of the game anew (one query), and the place
    // that was used is no longer among the free ones.
    const again = (
      await callTool(client, 'list_slots', { rack: 'lower_rack', item_id: 'plate_02' })
    ).structured as unknown as Places;
    expect(again.repeat).toBeUndefined();
    expect(again.budget.queries).toBe('2/300');
    expect(await events()).toBe(3);
    expect(again.free_seated).toBeLessThan(page.free_seated);
    expect(again.not_free).toBeGreaterThan(page.not_free);
    const taken = (
      await callTool(client, 'list_slots', {
        rack: 'lower_rack',
        item_id: 'plate_02',
        offset: again.places_total - again.not_free,
        limit: 30,
      })
    ).structured as unknown as Places;
    expect(taken.places.rows.every((entry) => entry[3] === false)).toBe(true);
    expect(taken.places.rows.some((entry) => entry[4].includes('plate_01'))).toBe(true);

    // The basket as geometry is bounded the same way.
    const geometry = await callTool(client, 'list_slots', { rack: 'lower_rack' });
    expect(geometry.text.length).toBeLessThan(2500);
    expect(geometry.structured).toMatchObject({
      slots_total: 66,
      next_offset: SLOTS_DEFAULT_LIMIT,
    });
    // An item that has no slots of its own is told so in a line.
    const glass = await callTool(client, 'list_slots', {
      rack: 'cutlery_basket',
      item_id: 'glass_01',
    });
    expect(glass.structured).toMatchObject({ places_total: 0 });
    expect(glass.text.length).toBeLessThan(500);
  });
});

describe('the slot list a client can read on', () => {
  it('is the one asked last, as the page keeps the list of its last "Suggest spots"', async () => {
    const game = await games.game();
    const id = await game.episode();
    const client = await games.connect(game, id);
    const queries = async (): Promise<number> =>
      ((await game.http('GET', `/api/sessions/${id}`)).body as SessionSummary).budget.queries_used;
    const ask = async (item: string, offset?: number): Promise<Places> =>
      (
        await callTool(client, 'list_slots', {
          rack: 'lower_rack',
          item_id: item,
          ...(offset === undefined ? {} : { offset }),
        })
      ).structured as unknown as Places;

    const plate = await ask('plate_01');
    expect(await queries()).toBe(1);
    // More of the list asked last: free.
    expect((await ask('plate_01', plate.next_offset)).repeat).toBe(true);
    expect(await queries()).toBe(1);
    // Another list takes its place ...
    expect((await ask('bowl_01')).repeat).toBeUndefined();
    expect(await queries()).toBe(2);
    expect((await ask('bowl_01')).repeat).toBe(true);
    // ... so the first is asked of the game again, for a query, on the same scene.
    const again = await ask('plate_01', plate.next_offset);
    expect(again.repeat).toBeUndefined();
    expect(await queries()).toBe(3);
    expect((await ask('plate_01')).repeat).toBe(true);
    expect(await queries()).toBe(3);
  });
});

describe('the level card through the tools', () => {
  it('names every kind of piece once, and carries the query counter', async () => {
    const game = await games.game();
    const client = await games.connect(game, await game.episode());
    const card = await callTool(client, 'get_level', {});
    expect(card.isError).toBe(false);
    const level = card.structured as {
      items: { item_ids: string[]; type: string }[];
      item_types: { [type: string]: { orientation_presets: unknown[] } };
      orientation_presets: { [name: string]: unknown };
      items_total: number;
      budget: { queries: string };
    };
    expect(level.items.flatMap((item) => item.item_ids)).toHaveLength(12);
    expect(level.items_total).toBe(12);
    // Two plates, two glasses, two forks, two spoons: fewer kinds than pieces.
    expect(Object.keys(level.item_types).length).toBeLessThan(12);
    for (const item of level.items) expect(level.item_types[item.type], item.type).toBeDefined();
    expect(level.orientation_presets['upright']).toBeDefined();
    expect(level.budget.queries).toBe('1/300');
    expect(card.text).not.toMatch(longFloat);
  });
});

describe('what the descriptions say against what the game answers', () => {
  it('a mug is offered the side rests, a lowered cup shelf adds a seat, and list_slots says so', async () => {
    const { TOOL_TEXT } = await import('./descriptions.ts');
    const game = await games.game();
    const client = await games.connect(game, await game.episode());
    const out = await callTool(client, 'set_rack', {
      rack: 'upper_rack',
      option: { name: 'position', value: 'out' },
    });
    expect(out.isError).toBe(false);
    const places = async (): Promise<string[]> =>
      (
        (await callTool(client, 'list_slots', { rack: 'upper_rack', item_id: 'mug_01' }))
          .structured as { places: { rows: [string, ...unknown[]][] } }
      ).places.rows.map((row) => row[0]);
    expect((await places()).sort()).toEqual(['rest_left', 'rest_right']);
    await callTool(client, 'set_rack', {
      rack: 'upper_rack',
      option: { name: 'shelf_cup_front', value: 'down' },
    });
    expect(await places()).toContain('shelf_cup_front');
    const geometry = (await callTool(client, 'list_slots', { rack: 'upper_rack' }))
      .structured as { slots_by_kind: { [kind: string]: number } };
    expect(geometry.slots_by_kind['cup_rest']).toBe(2);
    // Every kind the game answers with is named in the description of the tool.
    const text = TOOL_TEXT.list_slots.description;
    for (const kind of Object.keys(geometry.slots_by_kind)) expect(text, kind).toContain(kind);
    expect(text).toContain('rest_left');
    expect(text).not.toMatch(/have no places of their own/);
  });

  it('a pose through the roof is refused naming tub.roof, as the description of place reads it', async () => {
    const { TOOL_TEXT } = await import('./descriptions.ts');
    const game = await games.game();
    const client = await games.connect(game, await game.episode());
    await callTool(client, 'set_rack', {
      rack: 'upper_rack',
      option: { name: 'position', value: 'out' },
    });
    const collides = async (item: string, position: number[], preset: string): Promise<string[]> =>
      (
        (
          await callTool(client, 'preview', {
            item_id: item,
            frame: 'upper_rack',
            position_mm: position,
            orientation: { preset },
          })
        ).structured as { colliding_with?: string[] }
      ).colliding_with ?? [];
    // A tall glass standing upright at the back of the basket reaches through the roof.
    expect(await collides('glass_01', [250, 470, 200], 'upright')).toEqual(['tub.roof']);
    // A part of the machine is named by its part, as the description reads the names.
    expect(await collides('plate_01', [250, 300, 150], 'on_edge')).toEqual(['upper_rack.floor.y']);
    expect(await collides('glass_01', [50, 300, 150], 'inverted')).toEqual([
      'upper_rack_fittings.holder.knife_shelf.floor',
    ]);
    for (const name of ['_rack.floor.', '_fittings.holder.<id>', '_fittings.shelf.<id>']) {
      expect(TOOL_TEXT.place.description, name).toContain(name);
    }
    expect(TOOL_TEXT.place.description).toContain('tub.roof');
  });

  it('a fork that spins about its own length in its cell reads a large rotation and still stands', async () => {
    const { TOOL_TEXT } = await import('./descriptions.ts');
    const game = await games.game();
    const client = await games.connect(game, await game.episode());
    // The place list_slots gives for a fork in the rear right cell, as two models used it.
    const placed = (
      await callTool(client, 'place', {
        item_id: 'fork_02',
        frame: 'cutlery_basket',
        position_mm: [100, 203, 109],
        orientation: { preset: 'handle_down' },
      })
    ).structured as {
      accepted: boolean;
      rotation_deg: number;
      released_at: { quat_wxyz: number[] };
      state: { placed: { rows: unknown[][] } };
    };
    expect(placed.accepted).toBe(true);
    expect(placed.rotation_deg).toBeGreaterThan(45);
    // Its length (the x axis of the fork) after the settle, against the vertical it was let go in.
    const lengthOf = (q: number[]): number[] => {
      const [w, x, y, z] = q as [number, number, number, number];
      return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)];
    };
    const row = placed.state.placed.rows.find((entry) => entry[0] === 'fork_02') as unknown[];
    const before = lengthOf(placed.released_at.quat_wxyz);
    const after = lengthOf(row[3] as number[]);
    const cos = before.reduce((sum, value, i) => sum + value * (after[i] as number), 0);
    const lean = (Math.acos(Math.min(1, Math.abs(cos))) * 180) / Math.PI;
    expect(lean).toBeLessThan(30);
    expect(TOOL_TEXT.place.description).toContain('about its own length');
    expect(TOOL_TEXT.place.description).not.toContain('or more means it tipped over');
    expect(TOOL_TEXT.set_rack.description).toContain('about its own length');
  });

  it('a cell of the cutlery basket that holds a piece is offered again at a pose that is free', async () => {
    const { TOOL_TEXT } = await import('./descriptions.ts');
    const game = await games.game();
    const client = await games.connect(game, await game.episode());
    const cell = async (item: string): Promise<{ position: number[]; free: boolean }> => {
      const rows = (
        (await callTool(client, 'list_slots', { rack: 'cutlery_basket', item_id: item }))
          .structured as { places: { rows: [string, number[], unknown, boolean, string][] } }
      ).places.rows;
      const row = rows.find((entry) => entry[0] === 'cell_c00');
      if (row === undefined) throw new Error('cell_c00 is not offered');
      return { position: row[1], free: row[3] };
    };
    const put = async (item: string, position: number[]): Promise<boolean> =>
      (
        (
          await callTool(client, 'place', {
            item_id: item,
            frame: 'cutlery_basket',
            position_mm: position,
            orientation: { preset: 'handle_down' },
          })
        ).structured as { accepted: boolean }
      ).accepted;
    const first = await cell('fork_01');
    expect(await put('fork_01', first.position)).toBe(true);
    // The same pose again is taken; the list gives another in the same cell, and it is accepted.
    expect(await put('fork_02', first.position)).toBe(false);
    const second = await cell('fork_02');
    expect(second.free).toBe(true);
    expect(second.position).not.toEqual(first.position);
    expect(await put('fork_02', second.position)).toBe(true);
    expect(TOOL_TEXT.list_slots.description).toContain('takes several pieces');
  });

  it('no tool text offers another programme than the scored one', async () => {
    const { TOOL_TEXT, SERVER_INSTRUCTIONS } = await import('./descriptions.ts');
    const { INPUT_SCHEMAS, OUTPUT_SCHEMAS } = await import('./schemas.ts');
    const { z } = await import('zod');
    const all = [
      SERVER_INSTRUCTIONS,
      ...Object.values(TOOL_TEXT).map((tool) => tool.description),
      ...Object.values(INPUT_SCHEMAS).map((schema) => JSON.stringify(z.toJSONSchema(schema))),
      ...Object.values(OUTPUT_SCHEMAS).map((schema) => JSON.stringify(z.toJSONSchema(schema))),
    ].join('\n');
    expect(all).not.toMatch(/uncalibrated/i);
    expect(all).not.toMatch(/secondary programmes of the level card/);
  });
});
