// The render query drawn for real: headless Chrome, the scene of @spotless/render, PNG out.
// Skipped on a machine without Chrome.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CHROME_PATH } from '@spotless/render/headless';
import type { GetItemResult, RenderResult, WashRunner } from '@spotless/session';
import { placeholderWashRunner } from '@spotless/session';
import { afterAll, describe, expect, it } from 'vitest';
import type { SpotlessServer } from './app.ts';
import type { RenderService } from './render-service.ts';
import { createRenderService, shelfNotes } from './render-service.ts';
import {
  call,
  loadLowerBasket,
  mustPlace,
  newSession,
  reportWhenEnded,
  useServers,
} from './test-util.ts';
import type { RestoreSummary, SessionSummary } from './types.ts';

const chrome = process.env['SPOTLESS_CHROME'] ?? DEFAULT_CHROME_PATH;
const servers = useServers();

// One Chrome for the file. The servers get a view of it without `close`, so that closing a
// server after a test leaves it running.
let shared: RenderService | null = null;
const service = (): RenderService => (shared ??= createRenderService());
afterAll(async () => {
  await shared?.close();
});
const renderer = () => {
  const s = service();
  return { check: s.check, render: s.render, thumbnails: s.thumbnails };
};

/** Width and height in the header of a PNG. */
function pngSize(base64: string): [number, number] {
  const bytes = Buffer.from(base64, 'base64');
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

async function render(
  server: SpotlessServer,
  id: string,
  view: string,
  options: Record<string, unknown> = {},
): Promise<RenderResult> {
  return (
    await call<RenderResult>(server, 'POST', `/api/sessions/${id}/render`, {
      view,
      options: { size_px: 256, ...options },
    })
  ).body;
}

function image(result: RenderResult): string {
  if (!result.accepted) throw new Error(`render was refused: ${JSON.stringify(result)}`);
  return result.image.data_base64;
}

describe.skipIf(!existsSync(chrome))('the render service', () => {
  it('draws every view as a PNG of the size asked for and charges one query each', async () => {
    const server = await servers.server({ renderer: renderer() });
    const id = await newSession(server);
    await loadLowerBasket(server, id);
    const views: readonly (readonly [string, Record<string, unknown>])[] = [
      ['iso_lower', {}],
      ['iso_upper', {}],
      ['top_lower', {}],
      ['top_upper', {}],
      ['top_cutlery', {}],
      ['front', {}],
      ['left', {}],
      ['right', {}],
      [
        'custom',
        {
          camera: {
            azimuth_deg: -40,
            elevation_deg: 20,
            target_mm: [0, -300, 200],
            distance_mm: 1500,
            fov_deg: 35,
          },
        },
      ],
      ['item', { item_id: 'plate_01' }],
      [
        'item',
        {
          item_id: 'plate_01',
          camera: {
            azimuth_deg: 10,
            elevation_deg: 60,
            target_mm: [0, 0, 0],
            distance_mm: 1,
            fov_deg: 30,
          },
        },
      ],
    ];
    const seen = new Set<string>();
    for (const [view, options] of views) {
      const result = await render(server, id, view, options);
      expect(result, view).toMatchObject({
        accepted: true,
        view,
        image: { mime_type: 'image/png', width_px: 256, height_px: 256 },
      });
      expect(pngSize(image(result)), view).toEqual([256, 256]);
      seen.add(image(result));
    }
    // Eleven different pictures.
    expect(seen.size).toBe(views.length);
    const large = await render(server, id, 'top_lower', { size_px: 1024 });
    expect(pngSize(image(large))).toEqual([1024, 1024]);
    const summary = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    // Two list_slots of the loading, then one query a picture.
    expect(summary.body.budget.queries_used).toBe(2 + views.length + 1);
  });

  it('gives the same bytes for the same state and view, from the cache and from a second Chrome', async () => {
    const server = await servers.server({ renderer: renderer() });
    const id = await newSession(server);
    const before = service().stats();
    const first = image(await render(server, id, 'top_lower', { labels: true, grid: true }));
    const again = image(await render(server, id, 'top_lower', { labels: true, grid: true }));
    expect(again).toBe(first);
    let stats = service().stats();
    expect(stats.drawn - before.drawn).toBe(1);
    expect(stats.cache_hits - before.cache_hits).toBe(1);
    // The same request spelt with its defaults is the same picture, not a new drawing.
    const spelt = image(
      await render(server, id, 'top_lower', {
        labels: true,
        grid: true,
        highlight: [],
        after_wash: false,
      }),
    );
    expect(spelt).toBe(first);
    expect(service().stats().drawn - before.drawn).toBe(1);

    // Another state is another picture; back in the first state the first picture is in the cache.
    const bowl = {
      item_id: 'bowl_01',
      frame: 'lower_rack' as const,
      position_mm: [420, 270, 200] as const,
      orientation: { preset: 'inverted' },
    };
    await mustPlace(server, id, bowl);
    const loaded = image(await render(server, id, 'top_lower', { labels: true, grid: true }));
    expect(loaded).not.toBe(first);

    // A second episode that goes through the same actions reaches the same state: its picture
    // is the first episode's, without drawing.
    const twin = await newSession(server);
    await mustPlace(server, twin, bowl);
    stats = service().stats();
    const twinPicture = image(
      await render(server, twin, 'top_lower', { labels: true, grid: true }),
    );
    expect(twinPicture).toBe(loaded);
    expect(service().stats().drawn).toBe(stats.drawn);

    // A service of its own, with its own Chrome and nothing cached, draws the same bytes.
    const other = createRenderService();
    try {
      const entry = await server.manager.get(id);
      const independent = await other.render(entry.session, {
        view: 'top_lower',
        options: { size_px: 256, labels: true, grid: true },
      });
      expect(other.stats().drawn).toBe(1);
      expect(independent.data_base64).toBe(loaded);
    } finally {
      await other.close();
    }
  });

  it('draws labels, grid, a ghost, a highlight and moved baskets when asked', async () => {
    const server = await servers.server({ renderer: renderer() });
    const id = await newSession(server);
    await loadLowerBasket(server, id);
    const plain = image(await render(server, id, 'top_lower'));
    const variants = [
      { labels: true },
      { grid: true },
      { highlight: ['bowl_01'] },
      {
        ghost: {
          item_id: 'mug_01',
          frame: 'lower_rack',
          position_mm: [150, 120, 150],
          orientation: { preset: 'inverted', yaw_deg: 30 },
        },
      },
      { racks: 'in' },
    ];
    const pictures = new Set([plain]);
    for (const options of variants)
      pictures.add(image(await render(server, id, 'top_lower', options)));
    expect(pictures.size).toBe(variants.length + 1);
    // Drawing a ghost placed nothing.
    const state = await call<{ unplaced: string[] }>(
      server,
      'GET',
      `/api/sessions/${id}/get_state`,
    );
    expect(state.body.unplaced).toContain('mug_01');
  });

  it('refuses what cannot be drawn without charging or logging anything', async () => {
    const server = await servers.server({ renderer: renderer() });
    const id = await newSession(server);
    const refusals: readonly (readonly [string, Record<string, unknown>, string])[] = [
      ['x_ray', {}, 'invalid_argument'],
      ['custom', {}, 'invalid_argument'],
      ['item', {}, 'invalid_argument'],
      ['item', { item_id: 'teapot_09' }, 'unknown_item'],
      ['item', { item_id: 'plate_01', after_wash: true }, 'no_report'],
      ['top_lower', { highlight: ['teapot_09'] }, 'unknown_item'],
      [
        'top_lower',
        {
          ghost: {
            item_id: 'plate_01',
            frame: 'lower_rack',
            position_mm: [1, 2, 3],
            orientation: { preset: 'sideways' },
          },
        },
        'invalid_argument',
      ],
      ['top_lower', { size_px: 32 }, 'invalid_argument'],
      ['height_lower', {}, 'not_available'],
    ];
    for (const [view, options, reason] of refusals) {
      expect(
        await render(server, id, view, options),
        `${view} ${JSON.stringify(options)}`,
      ).toMatchObject({
        accepted: false,
        reason,
      });
    }
    const summary = await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`);
    expect(summary.body.budget.queries_used).toBe(0);
    expect(summary.body.events).toBe(0);
  });

  it('adds four pictures to get_item, and a session with pictures still restores from its log', async () => {
    const dataDir = servers.dataDir();
    const server = await servers.server({
      dataDir,
      renderer: renderer(),
      washRunner: placeholderWashRunner,
    });
    const id = await newSession(server);
    const item = await call<GetItemResult>(
      server,
      'GET',
      `/api/sessions/${id}/get_item?item_id=bowl_01`,
    );
    if (!item.body.accepted) throw new Error('get_item was refused');
    const thumbnails = item.body.item.thumbnails ?? [];
    expect(thumbnails).toHaveLength(4);
    for (const thumbnail of thumbnails) expect(pngSize(thumbnail.data_base64)).toEqual([256, 256]);
    expect(new Set(thumbnails.map((t) => t.data_base64)).size).toBe(4);
    // The same pictures the second time, without drawing.
    const drawn = service().stats().drawn;
    const again = await call<GetItemResult>(
      server,
      'GET',
      `/api/sessions/${id}/get_item?item_id=bowl_01`,
    );
    expect(again.body).toEqual(item.body);
    expect(service().stats().drawn).toBe(drawn);

    await loadLowerBasket(server, id);
    await render(server, id, 'iso_lower');
    // After the wash an item can be asked for as it came out.
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`, {});
    expect(await reportWhenEnded(server, id)).toMatchObject({ status: 'done' });
    const after = await render(server, id, 'item', { item_id: 'bowl_01', after_wash: true });
    expect(after).toMatchObject({ accepted: true });
    // Pictures are no part of the log's digests: the stored log replays exactly.
    const restored = await call<RestoreSummary>(server, 'POST', `/api/sessions/${id}/restore`);
    expect(restored.body).toMatchObject({ verified: true, digest_mismatches: 0 });
  });

  it('paints what the report says after a wash whose result the cache does not hold', async () => {
    // The fault this guards against: the picture of a washed item was taken from the result
    // cache, which does not hold a wash whose source changed under it. The item was then
    // drawn as it went in, under a caption saying it had been washed.
    const dataDir = servers.dataDir();
    const washed: WashRunner = async (manifest, onProgress) => {
      const report = await placeholderWashRunner(manifest, onProgress);
      return {
        ...report,
        job: { ...report.job, fidelity: 'fast', result_hash: 'sha256:test-result' },
        items: report.items.map((item) =>
          item.loaded
            ? { ...item, simulated: true, clean: true, points_awarded: 1, residue_cells: 0 }
            : item,
        ),
      };
    };
    const server = await servers.server({ dataDir, renderer: renderer(), washRunner: washed });
    const id = await newSession(server);
    await loadLowerBasket(server, id);
    const before = image(await render(server, id, 'item', { item_id: 'plate_01' }));
    const sceneBefore = image(await render(server, id, 'iso_lower'));
    // Before any wash there is nothing to show as washed.
    expect(
      await render(server, id, 'item', { item_id: 'plate_01', after_wash: true }),
    ).toMatchObject({ accepted: false, reason: 'no_report' });
    await call(server, 'POST', `/api/sessions/${id}/start_cycle`, {});
    expect(await reportWhenEnded(server, id)).toMatchObject({ status: 'done' });
    // The result cache loses the wash, as when it was never kept.
    const washes = join(dataDir, 'washes');
    for (const name of readdirSync(washes)) rmSync(join(washes, name));
    expect(readdirSync(washes)).toHaveLength(0);

    // The report came out clean, so the washed plate is drawn bare: not the soiled picture.
    const after = image(
      await render(server, id, 'item', { item_id: 'plate_01', after_wash: true }),
    );
    expect(after).not.toBe(before);
    const again = image(await render(server, id, 'item', { item_id: 'plate_01' }));
    expect(pngSize(again)).toEqual([256, 256]);
    // The machine view shows the washed load too, and says so.
    const sceneAfter = image(await render(server, id, 'iso_lower', { racks: 'out' }));
    expect(sceneAfter).not.toBe(sceneBefore);
    // The faint traces are a different picture state only when asked for; both are drawn.
    expect(
      await render(server, id, 'item', { item_id: 'plate_01', after_wash: true, traces: true }),
    ).toMatchObject({ accepted: true });

    // The same after the server has gone and come back with an empty result cache: the
    // report kept with the session is what the picture is drawn from.
    await server.close();
    const second = await servers.server({ dataDir, renderer: renderer(), washRunner: washed });
    const restored = image(
      await render(second, id, 'item', { item_id: 'plate_01', after_wash: true }),
    );
    expect(restored).toBe(after);
  });

  it('draws every item of the level on one sheet for one query', async () => {
    const server = await servers.server({ renderer: renderer() });
    const id = await newSession(server);
    const before = (await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`)).body.budget;
    const sheet = await render(server, id, 'items', { size_px: 512 });
    expect(pngSize(image(sheet))).toEqual([512, 512]);
    const after = (await call<SessionSummary>(server, 'GET', `/api/sessions/${id}`)).body.budget;
    expect(after.queries_used).toBe(before.queries_used + 1);
    // It is not a picture of one item.
    const one = image(await render(server, id, 'item', { item_id: 'plate_01', size_px: 512 }));
    expect(image(sheet)).not.toBe(one);
  });
});

describe('the names written in a plan view', () => {
  it('names every folding shelf as set_rack names it, with its state, where it is now', () => {
    const notes = shelfNotes(
      {
        baskets: [
          { basketId: 'upper', frame: 'upper_rack' },
          { basketId: 'lower', frame: 'lower_rack' },
        ],
        cupShelves: [
          {
            basketId: 'upper',
            shelfId: 'cup_front',
            state: 'up',
            box: { min: [0.48, 0.04, 0.0], max: [0.5, 0.24, 0.12] },
          },
        ],
        holders: [
          {
            basketId: 'upper',
            holderId: 'knife_shelf',
            state: 'down',
            box: { min: [0, 0.11, 0.07], max: [0.11, 0.5, 0.08] },
          },
          // A basket the picture has no frame for gets no name.
          {
            basketId: 'third',
            holderId: 'clip',
            state: 'down',
            box: { min: [0, 0, 0], max: [0.1, 0.1, 0.1] },
          },
        ],
      },
      [{ frame: 'upper_rack', origin_mm: [-244, -698, 420] }],
    );
    expect(notes.map((note) => [note.text, note.frame])).toEqual([
      ['shelf_cup_front (up)', 'upper_rack'],
      ['shelf_knife_shelf (down)', 'upper_rack'],
    ]);
    // Tub frame, millimetres: the origin of the basket as it stands plus the middle of the shelf.
    const at = notes[0]?.at_mm ?? [];
    expect(at[0]).toBeCloseTo(-244 + 490, 6);
    expect(at[1]).toBeCloseTo(-698 + 140, 6);
    expect(at[2]).toBeCloseTo(420 + 120, 6);
  });
});
