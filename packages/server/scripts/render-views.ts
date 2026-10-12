/**
 * Draws every view of the `render` query for a level, with and without grid and labels,
 * writes the PNGs to a directory and prints what each took: the start of Chrome and the page
 * (cold), the first picture of a scene, a picture of a changed scene (warm), and a repeat
 * (from the cache). Also checks that a repeat with the cache set aside gives the same bytes.
 *
 *   pnpm --filter @spotless/server exec tsx scripts/render-views.ts [--level tutorial]
 *        [--out <dir>] [--size 768] [--load] [--repeat 5]
 *
 * `--load` plays a few placements first (tutorial only), so that there is something to label.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { GetItemResult, ListSlotsResult, RenderResult } from '@spotless/session';
import { buildServer } from '../src/app.ts';
import { createRenderService } from '../src/render-service.ts';

const { values } = parseArgs({
  options: {
    level: { type: 'string', default: 'tutorial' },
    out: { type: 'string' },
    size: { type: 'string', default: '768' },
    load: { type: 'boolean' },
    repeat: { type: 'string', default: '5' },
  },
});
const size = Number(values.size);
const out = resolve(values.out ?? join(tmpdir(), 'spotless-render-views'));
mkdirSync(out, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), 'spotless-render-'));

const sha = (base64: string): string =>
  createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex').slice(0, 16);

const renderer = createRenderService();
const server = await buildServer({
  dataDir,
  staticDir: null,
  renderer,
  washRunner: {
    module: '@spotless/session',
    exportName: 'placeholderWashRunner',
    version: 'placeholder_not_simulated-1',
  },
});
await server.app.ready();

async function call<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
  const response = await server.app.inject({
    method,
    url,
    ...(body === undefined ? {} : { payload: body as object }),
  });
  return response.json<T>();
}

const created = await call<{ session_id: string }>('POST', '/api/sessions', {
  level_id: values.level,
});
const base = `/api/sessions/${created.session_id}`;

async function shot(
  name: string,
  request: unknown,
): Promise<{ ms: number; bytes: number; sha: string }> {
  const started = performance.now();
  const result = await call<RenderResult>('POST', `${base}/render`, request);
  const ms = performance.now() - started;
  if (!result.accepted) throw new Error(`${name}: ${JSON.stringify(result)}`);
  const png = Buffer.from(result.image.data_base64, 'base64');
  writeFileSync(join(out, `${name}.png`), png);
  return { ms, bytes: png.length, sha: sha(result.image.data_base64) };
}

const rows: string[] = [];
const note = (line: string): void => {
  rows.push(line);
  console.log(line);
};

// Cold: the first picture starts Chrome, builds or finds the page script and builds the scene.
const cold = await shot('01-iso_lower-cold', { view: 'iso_lower', options: { size_px: size } });
const stats0 = renderer.stats();
note(
  `cold start: ${cold.ms.toFixed(0)} ms in all (page script ${stats0.start?.bundleMs.toFixed(0)} ms` +
    `${stats0.start?.bundleBuilt === true ? ', built' : ', found on disk'}; Chrome ${stats0.start?.chromeMs.toFixed(0)} ms; ` +
    `page ${stats0.start?.pageMs.toFixed(0)} ms; scene and first picture ${stats0.draw_ms[0]?.toFixed(0)} ms)`,
);
note(`gpu: ${stats0.gpu}`);

if (values.load === true && values.level === 'tutorial') {
  const slots = await call<ListSlotsResult>(
    'GET',
    `${base}/list_slots?rack=lower_rack&item_id=plate_01`,
  );
  if (slots.accepted) {
    const drop = slots.slots.find((slot) => slot.id === 'tine_row_r1.slot_06')?.suggested_drop;
    if (drop !== undefined) {
      await call('POST', `${base}/place`, { item_id: 'plate_01', frame: 'lower_rack', ...drop });
    }
  }
  await call('POST', `${base}/place`, {
    item_id: 'bowl_01',
    frame: 'lower_rack',
    position_mm: [420, 270, 200],
    orientation: { preset: 'inverted' },
  });
  await call('POST', `${base}/place`, {
    item_id: 'fork_01',
    frame: 'cutlery_basket',
    position_mm: [20, 60, 150],
    orientation: { preset: 'handle_down' },
  });
}

const VIEWS: readonly (readonly [string, unknown])[] = [
  ['iso_lower', {}],
  ['iso_lower-labels-grid', { labels: true, grid: true }],
  ['iso_upper', { racks: 'out' }],
  ['top_lower', {}],
  ['top_lower-labels-grid', { labels: true, grid: true }],
  ['top_upper-labels-grid', { labels: true, grid: true, racks: 'out' }],
  ['top_cutlery-labels-grid', { labels: true, grid: true }],
  ['front-labels-grid', { labels: true, grid: true }],
  ['left-labels-grid', { labels: true, grid: true }],
  ['right-labels-grid', { labels: true, grid: true }],
  [
    'custom',
    {
      labels: true,
      camera: {
        azimuth_deg: -30,
        elevation_deg: 25,
        target_mm: [0, -300, 200],
        distance_mm: 1400,
        fov_deg: 35,
      },
    },
  ],
  ['item', { item_id: 'bowl_01' }],
  ['item-fork', { item_id: 'fork_01' }],
  ['items', {}],
  [
    'top_lower-ghost',
    {
      grid: true,
      ghost: {
        item_id: 'plate_02',
        frame: 'lower_rack',
        position_mm: [250, 250, 200],
        orientation: { preset: 'on_edge' },
      },
      highlight: ['bowl_01'],
    },
  ],
];

const warm: number[] = [];
let n = 2;
for (const [name, options] of VIEWS) {
  const view = name.split('-')[0] as string;
  const result = await shot(`${String(n++).padStart(2, '0')}-${name}`, {
    view,
    options: { size_px: size, ...(options as object) },
  });
  warm.push(result.ms);
  note(
    `${name.padEnd(28)} ${result.ms.toFixed(0).padStart(5)} ms  ${(result.bytes / 1024).toFixed(0).padStart(4)} kB  ${result.sha}`,
  );
}

// A repeat is answered from the cache.
const cachedTimes: number[] = [];
for (let i = 0; i < Number(values.repeat); i++) {
  const again = await shot('repeat', { view: 'top_lower', options: { size_px: size } });
  cachedTimes.push(again.ms);
}

// Thumbnails of one item.
const t0 = performance.now();
const item = await call<GetItemResult>('GET', `${base}/get_item?item_id=bowl_01`);
const thumbMs = performance.now() - t0;
if (item.accepted) {
  (item.item.thumbnails ?? []).forEach((image, i) => {
    writeFileSync(join(out, `thumb-bowl_01-${i}.png`), Buffer.from(image.data_base64, 'base64'));
  });
  note(
    `get_item thumbnails: ${item.item.thumbnails?.length ?? 0} pictures in ${thumbMs.toFixed(0)} ms`,
  );
}

// Determinism: a second service (its own Chrome, its own page, nothing cached) draws the same bytes.
const first = await call<RenderResult>('POST', `${base}/render`, {
  view: 'top_lower',
  options: { size_px: size, labels: true, grid: true },
});
const other = createRenderService();
const entry = await server.manager.get(created.session_id);
const second = await other.render(entry.session, {
  view: 'top_lower',
  options: { size_px: size, labels: true, grid: true },
});
await other.close();
const same = first.accepted && first.image.data_base64 === second.data_base64;
note(`same bytes from a second Chrome: ${same ? 'yes' : 'NO'}`);

const median = (xs: readonly number[]): number =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
note(
  `warm picture: median ${median(warm).toFixed(0)} ms, max ${Math.max(...warm).toFixed(0)} ms over ${warm.length} views at ${size} px; ` +
    `from the cache: median ${median(cachedTimes).toFixed(1)} ms`,
);
writeFileSync(join(out, 'timings.txt'), `${rows.join('\n')}\n`);
console.log(`pictures in ${out}`);

await server.close();
rmSync(dataDir, { recursive: true, force: true });
process.exit(same ? 0 : 1);
