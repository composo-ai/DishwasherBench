// Every tool against the session contract: names, argument schemas, results that are the
// HTTP API's in the shape of this server, errors without side effects, and one episode per
// connection. What the shaped results are held to is in `results.test.ts`.
import type { EpisodeRecord, SessionSummary } from '@spotless/server';
import {
  LOADING_GUIDANCE,
  emptySchema,
  itemSchema,
  listSlotsSchema,
  placeSchema,
  previewSchema,
  renderSchema,
  setRackSchema,
  startCycleSchema,
} from '@spotless/server';
import type { LevelCard, ListSlotsResult, WireImage } from '@spotless/session';
import { ACTION_NAMES, QUERY_NAMES } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TOOL_TEXT } from './descriptions.ts';
import type { ToolName } from './schemas.ts';
import { INPUT_SCHEMAS, OUTPUT_SCHEMAS, TOOL_NAMES } from './schemas.ts';
import { RESOURCE_URIS, splitImages } from './server.ts';
import { shapeLevel } from './shape.ts';
import { ADMIN, callTool, useGames } from './test-util.ts';

const games = useGames();

/** The request schema of the HTTP endpoint of each tool. */
const HTTP_SCHEMAS: { readonly [name in ToolName]: z.ZodType } = {
  place: placeSchema,
  remove: itemSchema,
  reset: emptySchema,
  set_rack: setRackSchema,
  start_cycle: startCycleSchema,
  get_level: emptySchema,
  get_item: itemSchema,
  get_state: emptySchema,
  render: renderSchema,
  preview: previewSchema,
  list_slots: listSlotsSchema,
  check_load: emptySchema,
  get_report: emptySchema,
};

interface JsonSchema {
  type?: string;
  properties?: { [key: string]: JsonSchema };
  required?: string[];
  anyOf?: JsonSchema[];
  items?: JsonSchema;
}

/** The keys of a schema, recursively, with whether each is required: `a`, `a.b?`, `a|0.c`. */
function keysOf(schema: JsonSchema, prefix = ''): string[] {
  const out: string[] = [];
  if (schema.anyOf !== undefined) {
    schema.anyOf.forEach((option, i) => out.push(...keysOf(option, `${prefix}|${i}`)));
  }
  for (const [key, value] of Object.entries(schema.properties ?? {})) {
    const required = (schema.required ?? []).includes(key);
    const path = `${prefix}${prefix === '' ? '' : '.'}${key}${required ? '' : '?'}`;
    out.push(path, ...keysOf(value, path));
  }
  return out.sort();
}

const PLATE = {
  item_id: 'bowl_01',
  frame: 'lower_rack',
  position_mm: [420, 270, 200],
  orientation: { preset: 'inverted' },
};

/** A fixed 1 x 1 PNG, for a render service that draws nothing. */
const DOT =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const dot = (size: number): WireImage => ({
  mime_type: 'image/png',
  width_px: size,
  height_px: size,
  data_base64: DOT,
});

describe('the tools and the session contract', () => {
  it('offers one tool per action and query, by the names of the contract', async () => {
    const game = await games.game();
    const client = await games.connect(game, await game.episode());
    const listed = (await client.listTools()).tools;
    expect(listed.map((tool) => tool.name).sort()).toEqual(
      [...ACTION_NAMES, ...QUERY_NAMES].sort(),
    );
    expect(TOOL_NAMES).toHaveLength(13);
    for (const tool of listed) {
      // Enough to play from: a description of some length, and schemas for both directions.
      expect(tool.description?.length ?? 0, tool.name).toBeGreaterThan(120);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema?.type, tool.name).toBe('object');
      expect(tool.annotations?.readOnlyHint).toBe(
        !(ACTION_NAMES as readonly string[]).includes(tool.name),
      );
    }
    // Nothing reaches beyond the episode: no tool makes, lists or names a session.
    expect(JSON.stringify(listed)).not.toMatch(/session_id|create_session|list_sessions|admin/);
    expect(client.getInstructions()).toContain('start_cycle');
  });

  it('takes the arguments of the HTTP API: the same keys, required and optional alike', () => {
    for (const name of TOOL_NAMES) {
      const mine = keysOf(z.toJSONSchema(INPUT_SCHEMAS[name]) as JsonSchema);
      const theirs = keysOf(z.toJSONSchema(HTTP_SCHEMAS[name]) as JsonSchema);
      // The arguments the MCP server adds are its own and never reach the game: how long
      // get_report may wait, which part of the state or of a slot list is wanted.
      const own: { readonly [tool: string]: readonly string[] } = {
        get_report: ['wait_s?'],
        get_state: ['rack?', 'items?'],
        list_slots: ['offset?', 'limit?', 'row?'],
      };
      expect(
        mine.filter((key) => !(own[name] ?? []).includes(key)),
        name,
      ).toEqual(theirs);
    }
  });

  it('accepts and refuses requests as the HTTP API does', () => {
    const requests: readonly (readonly [ToolName, unknown, boolean])[] = [
      ['place', PLATE, true],
      ['place', { ...PLATE, mode: 'insert', insert_dir: [0, 1, 0] }, true],
      ['place', { ...PLATE, orientation: { quat_wxyz: [1, 0, 0, 0] } }, true],
      ['place', { ...PLATE, orientation: { preset: 'on_edge', yaw_deg: 90, roll_deg: -3 } }, true],
      ['place', { ...PLATE, position_mm: [1, 2] }, false],
      ['place', { ...PLATE, position_mm: ['1', 2, 3] }, false],
      ['place', { ...PLATE, speed: 3 }, false],
      ['place', { item_id: 'bowl_01' }, false],
      ['place', { ...PLATE, orientation: { preset: 'upright', quat_wxyz: [1, 0, 0, 0] } }, false],
      ['remove', { item_id: 'bowl_01' }, true],
      ['remove', {}, false],
      ['reset', {}, true],
      ['reset', { all: true }, false],
      ['set_rack', { rack: 'upper_rack', option: { name: 'position', value: 'out' } }, true],
      ['set_rack', { rack: 'upper_rack', option: { name: 'position' } }, false],
      ['start_cycle', {}, true],
      ['start_cycle', { programme: 'eco_50' }, true],
      ['start_cycle', { programme: 7 }, false],
      ['get_item', { item_id: 'mug_01' }, true],
      ['preview', PLATE, true],
      ['preview', { ...PLATE, mode: 'drop' }, false],
      ['list_slots', { rack: 'lower_rack' }, true],
      ['list_slots', { rack: 'lower_rack', item_id: 'plate_01' }, true],
      ['list_slots', {}, false],
      ['render', { view: 'top_lower' }, true],
      ['render', { view: 'top_lower', options: { labels: true, grid: true, size_px: 512 } }, true],
      ['render', { view: 'top_lower', options: { size_px: 4096 } }, false],
      [
        'render',
        {
          view: 'custom',
          options: {
            camera: {
              azimuth_deg: 0,
              elevation_deg: 30,
              target_mm: [0, 0, 200],
              distance_mm: 1500,
              fov_deg: 35,
            },
          },
        },
        true,
      ],
      ['render', { view: 'top_lower', options: { ghost: PLATE, highlight: ['mug_01'] } }, true],
      ['check_load', {}, true],
      ['get_state', {}, true],
      ['get_level', { verbose: true }, false],
    ];
    for (const [name, request, ok] of requests) {
      const label = `${name} ${JSON.stringify(request)}`;
      expect(INPUT_SCHEMAS[name].safeParse(request).success, label).toBe(ok);
      expect(HTTP_SCHEMAS[name].safeParse(request).success, label).toBe(ok);
    }
    // The server's own arguments: a part of the state, a part of a slot list.
    for (const [name, request, ok] of [
      ['get_state', { rack: 'upper_rack' }, true],
      ['get_state', { items: ['plate_01', 'mug_01'] }, true],
      ['get_state', { rack: 'kitchen' }, false],
      ['get_state', { session_id: 'x' }, false],
      ['list_slots', { rack: 'lower_rack', item_id: 'plate_01', offset: 12, limit: 30 }, true],
      ['list_slots', { rack: 'lower_rack', row: 'tine_row_r1' }, true],
      ['list_slots', { rack: 'lower_rack', limit: 31 }, false],
      ['list_slots', { rack: 'lower_rack', offset: -1 }, false],
    ] as const) {
      expect(INPUT_SCHEMAS[name].safeParse(request).success, JSON.stringify(request)).toBe(ok);
    }
    // Where the contract names the legal values, the tool says so and the HTTP API leaves
    // the refusal to the game: the tool is the stricter of the two, never the looser.
    expect(INPUT_SCHEMAS.place.safeParse({ ...PLATE, frame: 'kitchen' }).success).toBe(false);
    expect(INPUT_SCHEMAS.render.safeParse({ view: 'x_ray' }).success).toBe(false);
  });

  it('plays the game of the HTTP API, call for call', async () => {
    const game = await games.game({
      renderer: {
        render: (_session, request) => Promise.resolve(dot(request.options?.size_px ?? 768)),
        thumbnails: () => Promise.resolve([dot(256), dot(256), dot(256), dot(256)]),
      },
    });
    // Two episodes of the same level: one played through the tools, one over HTTP.
    const viaMcp = await game.episode();
    const viaHttp = await game.episode();
    const client = await games.connect(game, viaMcp);
    const slots = (
      await game.http('POST', `/api/sessions/${viaHttp}/list_slots`, {
        rack: 'lower_rack',
        item_id: 'plate_01',
      })
    ).body as ListSlotsResult;
    if (!slots.accepted) throw new Error('list_slots was refused');
    const drop = slots.slots.find((slot) => slot.id === 'tine_row_r1.slot_06')?.suggested_drop;
    if (drop === undefined) throw new Error('no suggested drop');
    const calls: readonly (readonly [ToolName, Record<string, unknown>])[] = [
      ['get_level', {}],
      ['get_state', {}],
      ['get_item', { item_id: 'mug_01' }],
      ['get_item', { item_id: 'nothing_01' }],
      ['preview', PLATE],
      ['place', PLATE],
      ['place', PLATE],
      ['place', { item_id: 'plate_01', frame: 'lower_rack', ...drop }],
      ['place', { ...PLATE, item_id: 'mug_01', frame: 'upper_rack' }],
      ['render', { view: 'top_lower', options: { labels: true, size_px: 256 } }],
      ['get_report', {}],
      ['check_load', {}],
      ['set_rack', { rack: 'lower_rack', option: { name: 'position', value: 'in' } }],
      ['set_rack', { rack: 'lower_rack', option: { name: 'wings', value: 'out' } }],
      ['remove', { item_id: 'plate_01' }],
      ['remove', { item_id: 'plate_01' }],
      ['get_state', {}],
      ['start_cycle', {}],
      ['preview', PLATE],
      ['reset', {}],
    ];
    // The list_slots above was one query of the HTTP episode only: even the budgets up.
    const advice = await callTool(client, 'list_slots', {
      rack: 'lower_rack',
      item_id: 'plate_01',
    });
    expect(OUTPUT_SCHEMAS.list_slots.safeParse(advice.structured).success).toBe(true);
    for (const [name, args] of calls) {
      const mine = await callTool(client, name, args);
      const theirs = await game.http('POST', `/api/sessions/${viaHttp}/${name}`, args);
      const expected = splitImages(theirs.body);
      const label = `${name} ${JSON.stringify(args)}`;
      // The text is the structured result, and the result is of this very call.
      expect(JSON.parse(mine.text), label).toEqual(mine.structured);
      const raw = expected.structured as { accepted?: boolean; reason?: string };
      if (raw.accepted !== undefined) expect(mine.structured['accepted'], label).toBe(raw.accepted);
      if (raw.reason !== undefined) expect(mine.structured['reason'], label).toBe(raw.reason);
      // Pictures come as image content, in order, byte for byte.
      expect(
        mine.images.map((image) => image.data),
        label,
      ).toEqual(expected.images.map((image) => image.data_base64));
      // A call the game refused is a tool error; an answer is not.
      const refused = (theirs.body as { accepted?: boolean }).accepted === false;
      expect(mine.isError, label).toBe(refused);
      // Every result satisfies the tool's declared output schema.
      expect(OUTPUT_SCHEMAS[name].safeParse(mine.structured).success, label).toBe(true);
    }
    // Both episodes went the same way: the same scene and the same budgets, and the same
    // events in the log (what this server asks beside the calls is free and not logged).
    const a = (await game.http('GET', `/api/sessions/${viaMcp}`)).body as SessionSummary;
    const b = (await game.http('GET', `/api/sessions/${viaHttp}`)).body as SessionSummary;
    expect(a.state_hash).toBe(b.state_hash);
    expect(a.budget).toEqual(b.budget);
    expect(a.events).toBe(b.events);
    const log = async (id: string): Promise<unknown[]> =>
      (
        (await (
          await fetch(`${game.url}/api/sessions/${id}/log`, {
            headers: { 'x-spotless-admin': ADMIN },
          })
        ).json()) as { log: { name: string; args: unknown; result_digest: string }[] }
      ).log.map((event) => [event.name, event.args, event.result_digest]);
    // The log a record replays from is the game's own, digests and all: shaping happens after.
    const mcpLog = await log(viaMcp);
    const httpLog = await log(viaHttp);
    expect(mcpLog.slice(1)).toEqual(httpLog.slice(1));
    expect(mcpLog[0]).toEqual(httpLog[0]);
  });

  it('returns pictures as image content and keeps them out of the structured result', async () => {
    const game = await games.game({
      renderer: {
        render: () => Promise.resolve(dot(128)),
        thumbnails: () => Promise.resolve([dot(256), dot(256), dot(256), dot(256)]),
      },
    });
    const client = await games.connect(game, await game.episode());
    const render = await callTool(client, 'render', {
      view: 'iso_lower',
      options: { size_px: 128 },
    });
    expect(render.isError).toBe(false);
    expect(render.images).toEqual([{ data: DOT, mimeType: 'image/png' }]);
    expect(render.structured).toEqual({
      accepted: true,
      view: 'iso_lower',
      image: { mime_type: 'image/png', width_px: 128, height_px: 128 },
      // A charged query says how many are used.
      budget: { queries: '1/300' },
    });
    const item = await callTool(client, 'get_item', { item_id: 'plate_01' });
    expect(item.images).toHaveLength(4);
    expect(
      (item.structured['item'] as { thumbnails: { view: string }[] }).thumbnails.map((t) => t.view),
    ).toEqual(['front_above', 'back_below', 'top', 'side']);
    expect(JSON.stringify(item.structured)).not.toContain(DOT);
  });
});

describe('errors and isolation', () => {
  it('a malformed or refused call is a tool error that changes nothing', async () => {
    const game = await games.game();
    const id = await game.episode();
    const client = await games.connect(game, id);
    const before = (await game.http('GET', `/api/sessions/${id}`)).body as SessionSummary;

    // Malformed: stopped by the tool's schema, never reaches the game, not even its log.
    const malformed = await callTool(client, 'place', { ...PLATE, position_mm: [420, 270] });
    expect(malformed.isError).toBe(true);
    expect(malformed.text).toMatch(/position_mm/);
    const unknownTool = await client.callTool({
      name: 'create_session',
      arguments: { level_id: 'tutorial' },
    });
    expect(unknownTool.isError).toBe(true);
    let after = (await game.http('GET', `/api/sessions/${id}`)).body as SessionSummary;
    expect(after).toEqual(before);

    // Refused by the game: logged as a refused call, nothing charged, nothing moved.
    const refused = await callTool(client, 'place', { ...PLATE, position_mm: [420, 270, -400] });
    expect(refused.isError).toBe(true);
    expect(refused.structured).toMatchObject({ accepted: false });
    expect(typeof refused.structured['reason']).toBe('string');
    const noReport = await callTool(client, 'get_report', {});
    expect(noReport.structured).toMatchObject({ accepted: false, reason: 'no_cycle_started' });
    after = (await game.http('GET', `/api/sessions/${id}`)).body as SessionSummary;
    expect(after.state_hash).toBe(before.state_hash);
    expect(after.budget).toEqual(before.budget);
    expect(after.events).toBe(before.events + 2);
  });

  it('a connection plays one episode and cannot reach another', async () => {
    const game = await games.game();
    const mine = await game.episode();
    const other = await game.episode();
    const client = await games.connect(game, mine);
    const otherBefore = (await game.http('GET', `/api/sessions/${other}`)).body as SessionSummary;

    const texts: string[] = [];
    for (const [name, args] of [
      ['get_level', {}],
      ['place', PLATE],
      ['get_state', {}],
      ['check_load', {}],
      ['start_cycle', {}],
      ['get_report', { wait_s: 20 }],
    ] as const) {
      texts.push((await callTool(client, name, args)).text);
    }
    // Nothing the agent is told names a session, its own included, or the admin token.
    const everything = texts.join('\n') + JSON.stringify(await client.listTools());
    expect(everything).not.toContain(mine);
    expect(everything).not.toContain(other);
    expect(everything).not.toContain(ADMIN);
    // An argument that tries to name another session is refused by the schema.
    const sneaky = await callTool(client, 'get_state', { session_id: other });
    expect(sneaky.isError).toBe(true);

    const otherAfter = (await game.http('GET', `/api/sessions/${other}`)).body as SessionSummary;
    expect(otherAfter).toEqual(otherBefore);
    const mineAfter = (await game.http('GET', `/api/sessions/${mine}`)).body as SessionSummary;
    expect(mineAfter.phase).toBe('finished');

    // The episode is on record under the player the harness named.
    const record = (await (
      await fetch(`${game.url}/api/sessions/${mine}/episode`, {
        headers: { 'x-spotless-admin': ADMIN },
      })
    ).json()) as EpisodeRecord;
    expect(record.player).toMatchObject({ kind: 'agent', name: 'test' });
    expect(record.events.map((event) => event.name)).toEqual([
      'get_level',
      'place',
      'get_state',
      'check_load',
      'start_cycle',
      'get_report',
    ]);
  });

  it('get_report waits for a running wash and then gives the report', async () => {
    let finish: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const game = await games.game({
      washRunner: async (manifest, onProgress) => {
        onProgress(0.4);
        await held;
        const { placeholderWashRunner } = await import('@spotless/session');
        return placeholderWashRunner(manifest, onProgress);
      },
    });
    const client = await games.connect(game, await game.episode());
    await callTool(client, 'place', PLATE);
    const started = await callTool(client, 'start_cycle', {});
    expect(started.structured).toMatchObject({ accepted: true });
    // At once: the wash is running, with its progress.
    const running = await callTool(client, 'get_report', {});
    expect(running.structured).toMatchObject({ accepted: true, status: 'running', progress: 0.4 });
    expect(running.isError).toBe(false);
    // A short wait comes back still running; a wait that sees the end comes back with the report.
    const t0 = performance.now();
    const still = await callTool(client, 'get_report', { wait_s: 0.3 });
    expect(performance.now() - t0).toBeGreaterThan(250);
    expect(still.structured).toMatchObject({ status: 'running' });
    setTimeout(finish, 200);
    const done = await callTool(client, 'get_report', { wait_s: 30 });
    expect(done.structured).toMatchObject({ accepted: true, status: 'done' });
    expect((done.structured['report'] as { items: unknown[] }).items).toHaveLength(12);
  });

  it('offers the manual of the level and the loading guidance as resources', async () => {
    const game = await games.game();
    const id = await game.episode();
    const client = await games.connect(game, id);
    const listed = (await client.listResources()).resources.map((resource) => resource.uri).sort();
    expect(listed).toEqual(Object.values(RESOURCE_URIS).sort());
    const text = async (uri: string): Promise<string> =>
      ((await client.readResource({ uri })).contents[0] as { text: string }).text;
    // The same guidance text the server gives the human client.
    expect(await text(RESOURCE_URIS.guidance)).toContain(LOADING_GUIDANCE);
    const manual = await text(RESOURCE_URIS.manual);
    const card = (await game.http('GET', `/api/sessions/${id}/card`)).body as LevelCard & {
      manual: string;
    };
    for (const part of [
      card.manual,
      card.rules.scoring,
      card.rules.clean_definition,
      card.rules.episode_end,
    ]) {
      expect(manual).toContain(part);
    }
    // The card of the resource is the card of get_level: the level's, in the shape of this server.
    expect(JSON.parse(await text(RESOURCE_URIS.card))).toEqual(
      JSON.parse(JSON.stringify(shapeLevel(card))),
    );
    // Reading resources is free: nothing was charged or logged.
    expect(((await game.http('GET', `/api/sessions/${id}`)).body as SessionSummary).events).toBe(0);
  });
});

describe('what the report says about itself', () => {
  it('explains every field of a report item in the schema and names each in the description', () => {
    // The fields of a washed item's entry (`WashReportItem` of the session contract). A field
    // returned without a word of explanation is a field a player has to guess at.
    const fields = [
      'loaded',
      'clean',
      'points_awarded',
      'graded_score',
      'score_iec',
      'reason',
      'visible_area_mm2',
      'specks',
      'residual_fraction_area',
      'residual_mass_fraction',
      'residue_regions',
      'residue_cells',
      'moved_during_wash',
      'likely_moved',
      'holds_water',
      'retained_water_ml',
      'surface_film_g',
    ];
    const report = OUTPUT_SCHEMAS.get_report.shape.report.unwrap();
    const item = report.shape.items.element.shape as {
      [key: string]: { description?: string };
    };
    for (const field of fields) {
      expect(item[field], field).toBeDefined();
      expect(item[field]?.description ?? '', field).not.toBe('');
      expect(TOOL_TEXT.get_report.description, field).toContain(field);
    }
    const region = (
      item['residue_regions'] as unknown as {
        unwrap(): { element: { shape: { [key: string]: { description?: string } } } };
      }
    ).unwrap().element.shape;
    for (const field of ['fraction', 'visible_area_mm2', 'soiled_area_mm2', 'specks']) {
      expect(region[field]?.description ?? '', field).not.toBe('');
      expect(TOOL_TEXT.get_report.description, field).toContain(field);
    }
    // What does not decide the points is said not to.
    expect(TOOL_TEXT.get_report.description).toMatch(/likely_moved[^.]*warning only/);
    expect(TOOL_TEXT.get_report.description).toMatch(/Reported and not counted: holds_water/);
    // The stable flag is described as what it is.
    expect(TOOL_TEXT.place.description).toMatch(/not a test of the basket being pushed in/);
    expect(TOOL_TEXT.preview.description).toContain('blocked_by');
    // A refused pose says what it met; the description says how to read that and what to try
    // (the first model played raised a shelf that was not the one in the way).
    expect(TOOL_TEXT.place.description).toMatch(/After collision_at_pose\./);
    // A refusal names the shelf itself since 11 October (results.test.ts holds the names).
    expect(TOOL_TEXT.place.description).toMatch(/_fittings\.shelf\.<id> and [^ ]* are the folding shelf/);
    expect(TOOL_TEXT.place.description).toMatch(/ask for a z some centimetres higher/);
    expect(TOOL_TEXT.render.description).toMatch(/names of the folding shelves/);
  });
});
