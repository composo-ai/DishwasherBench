/**
 * Plays the tutorial twice through the user interface in headless Chrome, once loaded badly on
 * purpose and once loaded well, has each load washed by the real wash simulation at the fast
 * tier, and saves screenshots of the progress display, of the report, of the machine with the
 * residue painted on the load, and of single items seen close up from several sides, under
 * `apps/web/screenshots/wash/`.
 *
 * It also checks the residue painting in numbers and writes what it found to
 * `verification.json` beside the screenshots:
 *
 *  1. every tile the page draws for an item lies on that item's surface, measured in the page
 *     against the item's shape at the pose the page draws it at (within 1 mm);
 *  2. the tiles are where the simulation says the residue is: the load is washed once more in
 *     this process from the server's own manifest (the exposure comes from the cache on disk),
 *     the visibly soiled cells of the simulation's result are carried into the tub frame by
 *     the exact settled pose, and every tile must have its cell within 1 mm, one tile a cell.
 *
 * Run with `pnpm --filter @spotless/web wash-shots` (which builds the client first), or
 * `tsx scripts/play-wash.ts [--out <dir>] [--data <dir>] [--tier fast|official]`. `--data`
 * keeps the server's data directory (and with it the exposure cache) between runs.
 *
 * Exit code 0 when both loads were washed to a report and every check held.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { poseTransformPoint, quatRotate } from '@spotless/core';
import type { SpotlessServer } from '@spotless/server';
import { buildServer, WASH_RUNNER } from '@spotless/server';
import type { WashReport, WashTier } from '@spotless/session';
import type { Page } from 'puppeteer-core';
import type { DebugState } from './driver.ts';
import {
  canvasBox,
  caughtUp,
  createRun,
  debug,
  launchChrome,
  pickUp,
  previewTint,
  sleep,
  typePose,
  view,
} from './driver.ts';
import { runWash, TILE_LIFT_CHECK } from './wash-check.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const dist = join(here, '..', 'dist');
const flag = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const outDir = resolve(flag('--out') ?? join(here, '..', 'screenshots', 'wash'));
const keptData = flag('--data');
const tier: WashTier = flag('--tier') === 'official' ? 'official' : 'fast';

const run = createRun(outDir);
const { problems, captions, expect, screenshot, sameAsLast, drop, setRack } = run;

interface Placement {
  readonly item: string;
  readonly frame: 'lower_rack' | 'upper_rack' | 'cutlery_basket';
  readonly preset: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw?: number;
  readonly roll?: number;
}

/**
 * Seven of the twelve items of the tutorial loaded as nobody should: the plates lying on each other
 * face up, the bowl, the mug and the glass standing open side up, the cutlery thrown in flat.
 */
const BAD: { lower: Placement[]; upper: Placement[] } = {
  lower: [
    { item: 'plate_01', frame: 'lower_rack', preset: 'upright', x: 250, y: 260, z: 260 },
    { item: 'plate_02', frame: 'lower_rack', preset: 'upright', x: 250, y: 300, z: 300 },
    { item: 'bowl_01', frame: 'lower_rack', preset: 'upright', x: 430, y: 100, z: 200 },
    { item: 'fork_01', frame: 'lower_rack', preset: 'flat', x: 300, y: 100, z: 300 },
    { item: 'knife_01', frame: 'lower_rack', preset: 'flat', x: 250, y: 330, z: 300 },
  ],
  upper: [
    { item: 'mug_01', frame: 'upper_rack', preset: 'upright', x: 250, y: 380, z: 130 },
    { item: 'glass_01', frame: 'upper_rack', preset: 'upright', x: 194, y: 150, z: 130 },
  ],
};

/** The same items loaded as the tutorial teaches. */
const GOOD: { lower: Placement[]; upper: Placement[] } = {
  lower: [
    { item: 'plate_01', frame: 'lower_rack', preset: 'on_edge', x: 143, y: 368, z: 227, yaw: 90 },
    { item: 'plate_02', frame: 'lower_rack', preset: 'on_edge', x: 70, y: 368, z: 227, yaw: 90 },
    { item: 'bowl_01', frame: 'lower_rack', preset: 'inverted', x: 420, y: 270, z: 200 },
    {
      item: 'fork_01',
      frame: 'cutlery_basket',
      preset: 'handle_down',
      x: 20,
      y: 28,
      z: 240,
      roll: 5,
    },
    {
      item: 'knife_01',
      frame: 'cutlery_basket',
      preset: 'handle_down',
      x: 108,
      y: 28,
      z: 240,
      roll: 5,
    },
  ],
  upper: [
    { item: 'mug_01', frame: 'upper_rack', preset: 'inverted', x: 250, y: 380, z: 130 },
    { item: 'glass_01', frame: 'upper_rack', preset: 'inverted', x: 160, y: 440, z: 130 },
  ],
};

async function place(page: Page, placement: Placement): Promise<void> {
  await pickUp(page, placement.item);
  await typePose(page, {
    frame: placement.frame,
    preset: placement.preset,
    x: placement.x,
    y: placement.y,
    z: placement.z,
    yaw: placement.yaw ?? 0,
    roll: placement.roll ?? 0,
  });
  const tint = await previewTint(page);
  expect(tint === 'clear', `${placement.item} can be placed where the script asks (${tint})`);
  await drop(page);
}

async function load(page: Page, plan: { lower: Placement[]; upper: Placement[] }): Promise<void> {
  for (const placement of plan.lower) await place(page, placement);
  await setRack(page, 'lower_rack', 'position', 'in');
  await setRack(page, 'upper_rack', 'position', 'out');
  for (const placement of plan.upper) await place(page, placement);
  await page.keyboard.press('Escape');
  await setRack(page, 'upper_rack', 'position', 'in');
  await caughtUp(page);
}

/** The session the page is playing, from its address. */
async function sessionOf(page: Page): Promise<string> {
  return page.evaluate(() => location.hash.replace(/^#/, ''));
}

/** What the page says about the residue it painted on an item (`debugResidue`). */
interface PaintedResidue {
  tiles: number;
  cells: number[];
  positions_mm: number[];
  max_surface_distance_mm: number;
}

async function painted(page: Page, itemId: string): Promise<PaintedResidue | null> {
  return page.evaluate(
    (id) =>
      (
        window as unknown as { spotless: { debugResidue(id: string): PaintedResidue | null } }
      ).spotless.debugResidue(id),
    itemId,
  );
}

/** The report the page shows, read back through the server the page talks to. */
async function reportOf(server: SpotlessServer, sessionId: string): Promise<WashReport> {
  const response = await server.app.inject({
    method: 'GET',
    url: `/api/sessions/${sessionId}/get_report`,
  });
  const body = response.json<{ status?: string; report?: WashReport }>();
  if (body.status !== 'done' || body.report === undefined) throw new Error('no report');
  return body.report;
}

interface ItemCheck {
  item_id: string;
  clean: boolean;
  tiles: number;
  max_distance_to_surface_mm: number;
  /** Null when the wash could not be repeated on the same source for the comparison. */
  simulated_visible_cells: number | null;
  max_distance_to_simulated_cell_mm: number | null;
}

/** Why a comparison with the simulation could not be made, when it could not. */
const sourceNotes: string[] = [];

/** The washes that were repeated on unchanged source, with the two result hashes. */
const comparisons: {
  session: string;
  source: string;
  server_result: string;
  repeated_result: string;
}[] = [];

/**
 * Checks what the page painted against the item's surface and against the simulation: see the
 * file comment. Returns one line per item with residue painted.
 */
async function verify(
  page: Page,
  server: SpotlessServer,
  sessionId: string,
  report: WashReport,
  dataDir: string,
): Promise<ItemCheck[]> {
  const manifest = (await server.manager.get(sessionId)).session.washManifest();
  if (manifest === null) throw new Error('the session has no wash manifest');
  // The same wash again in this process, from the server's manifest and its exposure cache.
  // It is the same wash only if the simulation's source is what it was when the server washed:
  // while the simulation is being worked on, a file may change between the two (or be in a
  // state in which no wash runs at all), and then there is nothing to compare.
  const job = server.queue
    .jobs()
    .filter((candidate) => candidate.session_id === sessionId && candidate.status === 'done')
    .at(-1);
  // The version the wash was keyed by, and the one the worker found when it had washed.
  const keyedBy = job?.runner.version;
  const ranWith = job?.ran_with ?? keyedBy;
  const cacheRoot = join(dataDir, 'exposure-cache');
  const before = WASH_RUNNER.version;
  let outcome: Awaited<ReturnType<typeof runWash>> | null = null;
  try {
    outcome = await runWash(manifest, tier, cacheRoot);
  } catch (error) {
    sourceNotes.push(
      `the wash could not be repeated for the check (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const after = WASH_RUNNER.version;
  const versions = [keyedBy, ranWith, before, after];
  if (outcome !== null && new Set(versions).size !== 1) {
    sourceNotes.push(
      `the simulation's source changed between the server's wash and the check ` +
        `(keyed by ${keyedBy}, washed with ${ranWith}, checked with ${before} to ${after}): ` +
        "the tiles were checked against the item's surface only",
    );
    outcome = null;
  }
  if (outcome !== null) {
    comparisons.push({
      session: sessionId,
      source: after,
      server_result: report.job.result_hash ?? '',
      repeated_result: outcome.resultHash,
    });
    expect(
      outcome.resultHash === report.job.result_hash,
      `the wash repeated for the check gives the server's result (${outcome.resultHash} / ${report.job.result_hash})`,
    );
  }
  const checks: ItemCheck[] = [];
  for (const item of report.items) {
    if (!item.loaded || (item.residue_cells ?? 0) === 0) continue;
    const drawn = await painted(page, item.item_id);
    const pose = manifest.items.find((entry) => entry.item_id === item.item_id)?.pose;
    if (drawn === null || pose === undefined) {
      expect(
        (item.visible_area_mm2 ?? 0) === 0,
        `${item.item_id} has visible residue but nothing is painted on it`,
      );
      continue;
    }
    expect(
      drawn.max_surface_distance_mm < 1,
      `the tiles of ${item.item_id} lie on its surface as the page draws it (${drawn.max_surface_distance_mm.toFixed(3)} mm)`,
    );
    const simulated = outcome?.items.get(item.item_id);
    if (simulated === undefined) {
      checks.push({
        item_id: item.item_id,
        clean: item.clean,
        tiles: drawn.tiles,
        max_distance_to_surface_mm: Math.round(drawn.max_surface_distance_mm * 1000) / 1000,
        simulated_visible_cells: null,
        max_distance_to_simulated_cell_mm: null,
      });
      continue;
    }
    // The simulation's visibly soiled cells in the tub frame, at the exact settled pose, a
    // tile's lift off the surface.
    const expected: [number, number, number][] = [];
    for (let e = 0; e < simulated.count; e++) {
      if (simulated.visible[e] !== 1) continue;
      const centre: [number, number, number] = [
        simulated.centre[3 * e] as number,
        simulated.centre[3 * e + 1] as number,
        simulated.centre[3 * e + 2] as number,
      ];
      const normal = quatRotate(pose.q, [
        simulated.normal[3 * e] as number,
        simulated.normal[3 * e + 1] as number,
        simulated.normal[3 * e + 2] as number,
      ]);
      const world = poseTransformPoint(pose, centre);
      expected.push([
        (world[0] + normal[0] * TILE_LIFT_CHECK) * 1000,
        (world[1] + normal[1] * TILE_LIFT_CHECK) * 1000,
        (world[2] + normal[2] * TILE_LIFT_CHECK) * 1000,
      ]);
    }
    // One tile a cell: every tile is given the nearest cell that no tile has yet, so that two
    // cells at the same place (the simulation has some, of no area) take a tile each.
    let worst = 0;
    const used = new Set<number>();
    for (let t = 0; t < drawn.tiles; t++) {
      const x = drawn.positions_mm[3 * t] as number;
      const y = drawn.positions_mm[3 * t + 1] as number;
      const z = drawn.positions_mm[3 * t + 2] as number;
      let best = Infinity;
      let bestAt = -1;
      for (let e = 0; e < expected.length; e++) {
        if (used.has(e)) continue;
        const p = expected[e] as [number, number, number];
        const d = Math.hypot(p[0] - x, p[1] - y, p[2] - z);
        if (d < best) {
          best = d;
          bestAt = e;
        }
      }
      if (bestAt >= 0) used.add(bestAt);
      if (best > worst) worst = best;
    }
    const check: ItemCheck = {
      item_id: item.item_id,
      clean: item.clean,
      tiles: drawn.tiles,
      max_distance_to_surface_mm: Math.round(drawn.max_surface_distance_mm * 1000) / 1000,
      simulated_visible_cells: expected.length,
      max_distance_to_simulated_cell_mm: Math.round(worst * 1000) / 1000,
    };
    checks.push(check);
    expect(
      check.tiles === expected.length && used.size === expected.length,
      `${item.item_id} has one tile for each visibly soiled cell of the simulation (${check.tiles} tiles, ${expected.length} cells, ${used.size} matched)`,
    );
    expect(
      worst < 1,
      `the tiles of ${item.item_id} are where the simulation has the residue (${check.max_distance_to_simulated_cell_mm} mm)`,
    );
  }
  return checks;
}

/** Waits for a stage of the wash to show on the page and takes a screenshot of it. */
async function stageShot(page: Page, stage: string, name: string, what: string): Promise<boolean> {
  try {
    await page.waitForFunction(
      (wanted) =>
        document.getElementById('wash-phase')?.dataset['stage'] === wanted ||
        document.getElementById('report') !== null,
      { timeout: 600_000, polling: 50 },
      stage,
    );
  } catch {
    return false;
  }
  if ((await page.$('#report')) !== null) return false;
  const title = await page.$eval('#wash-phase', (el) => el.textContent ?? '');
  const step = await page.$eval('#wash-step', (el) => el.textContent ?? '').catch(() => '');
  const times = await page.$eval('#wash-times', (el) => el.textContent ?? '');
  await page.$eval('#cycle', (el) => el.scrollIntoView());
  await screenshot(page, name, `${what}: "${title}" (${step}); ${times}`);
  return true;
}

/** Starts the cycle, follows the wash through its stages and waits for the report. */
async function wash(page: Page, label: string): Promise<void> {
  await page.$eval('#start-cycle', (el) => el.scrollIntoView());
  await page.click('#start-cycle');
  await page.waitForSelector('#confirm-start');
  await page.click('#confirm-start');
  // A load washed before (a kept data directory) is answered from the cache at once.
  await page.waitForSelector('#wash-times, #report', { timeout: 60_000 });
  const seen: string[] = [];
  for (const [stage, what] of [
    ['scene', 'the wash has begun: the simulation is measuring the surfaces of the load'],
    ['exposure', 'the long stage: tracing the jets, the splashing and the run-off'],
    ['replay', 'the programme is run against the soil'],
  ] as const) {
    if (await stageShot(page, stage, `${label}-progress-${stage}`, what)) seen.push(stage);
  }
  // A wash answered from the cache shows no stages; a computed one shows at least the long one.
  console.log(`  stages seen on the page: ${seen.join(', ') || 'none (answered from the cache?)'}`);
  await page.waitForSelector('#report', { timeout: 1_800_000 });
  await caughtUp(page);
}

/** Opens the close-up of an item and takes it from several sides. */
async function closeUps(page: Page, label: string, itemId: string, sides: string[]): Promise<void> {
  await page.$eval(`button[data-inspect="${itemId}"]`, (el) => {
    el.scrollIntoView({ block: 'center' });
  });
  await page.click(`button[data-inspect="${itemId}"]`);
  await page.waitForSelector('#inspector-view', { timeout: 60_000 });
  await sleep(400);
  const verdict = await page.$eval('#inspector-verdict', (el) => el.textContent ?? '');
  const reason = await page
    .$eval('#inspector-reason', (el) => el.textContent ?? '')
    .catch(() => '');
  for (const side of sides) {
    await page.click(`.inspector-sides button[data-side="${side}"]`);
    await sleep(250);
    await screenshot(
      page,
      `${label}-${itemId}-${side}`,
      `${itemId} close up, ${side.replace('_', ' ')}: ${verdict}${reason === '' ? '' : ` ${reason}`}`,
    );
  }
  // Turned by hand as well: the camera goes all the way round.
  const box = await (await page.$('#inspector-view'))?.boundingBox();
  if (box !== null && box !== undefined) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 70, { steps: 8 });
    await page.mouse.up();
    await sleep(250);
    await screenshot(
      page,
      `${label}-${itemId}-turned`,
      `${itemId} close up, turned with the mouse`,
    );
  }
  await page.click('#close-inspector');
  expect((await debug(page)).inspecting === null, 'closing the close-up frees it');
}

async function newTutorial(page: Page): Promise<void> {
  await page.click('.level[data-level-id="tutorial"]');
  await page.waitForFunction(
    () => {
      const s = (
        window as unknown as { spotless?: { debugState(): DebugState } }
      ).spotless?.debugState();
      return s !== undefined && s.phase === 'loading' && s.placed === 0 && s.thumbnails === 12;
    },
    { timeout: 60_000 },
  );
  await caughtUp(page);
}

/** Plays one load to its report with all its pictures; returns the report and the checks. */
async function playLoad(
  page: Page,
  server: SpotlessServer,
  dataDir: string,
  label: 'bad' | 'good',
  plan: { lower: Placement[]; upper: Placement[] },
): Promise<{ report: WashReport; checks: ItemCheck[] }> {
  await load(page, plan);
  await view(page, 'iso_lower');
  await screenshot(
    page,
    `${label}-loaded`,
    label === 'bad'
      ? 'the tutorial loaded badly on purpose: plates lying on each other face up, bowl, mug and glass open side up, cutlery thrown in flat'
      : 'the same seven items (of the twelve of the level) loaded as the tutorial teaches: plates on edge between the tines, bowl, mug and glass upside down, cutlery in the cutlery basket',
  );
  await wash(page, label);
  const sessionId = await sessionOf(page);
  const report = await reportOf(server, sessionId);
  // Every item with residue to paint gets its tiles.
  const expected = report.items.filter(
    (item) => item.loaded && (item.residue_cells ?? 0) > 0,
  ).length;
  await page.waitForFunction(
    (count) => Number(document.body.dataset['residuePainted'] ?? '0') >= count,
    { timeout: 120_000 },
    expected,
  );
  await caughtUp(page);
  const total = await page.$eval('#report-total', (el) => el.textContent ?? '');
  const producedBy = await page.$eval('#report-tier', (el) => el.textContent ?? '');
  expect(
    producedBy.includes(tier === 'fast' ? 'as a quick preview' : 'as the full wash'),
    `the report says which tier produced it (${producedBy})`,
  );
  expect((await page.$('#not-simulated')) === null, 'the report is not marked as not simulated');
  const rows = await page.$$eval('#report tbody tr', (els) => els.length);
  expect(rows === 12, `the report lists all twelve items of the level (${rows})`);
  // A wash at the fast tier is labelled a preview on the page; an official one is not.
  const previewLabel = await page.$('#report-label');
  const labelText =
    previewLabel === null ? '' : await page.$eval('#report-label', (el) => el.textContent ?? '');
  expect(
    tier === 'fast' ? labelText.startsWith('Quick preview') : previewLabel === null,
    `a fast wash is labelled a preview, an official one is not (${labelText === '' ? 'no label' : labelText.slice(0, 40)})`,
  );
  const counting = await page.$eval('#report-counting', (el) => el.textContent ?? '');
  expect(
    counting.startsWith('Every item counts by the verdict given.'),
    `the report says how its points were counted (${counting.slice(0, 60)})`,
  );
  const reasons = await page.$$eval('#report .reason', (els) => els.map((el) => el.textContent));
  const notClean = report.items.filter((item) => item.loaded && !item.clean).length;
  expect(
    reasons.length === notClean,
    `every item that is not clean has its reason in the report (${reasons.length} of ${notClean})`,
  );
  console.log(`  ${label}: ${total}`);
  for (const item of report.items) {
    if (!item.loaded) continue;
    console.log(
      `    ${item.clean ? 'clean    ' : 'NOT CLEAN'} ${item.item_id.padEnd(10)} score ${item.score_iec} ` +
        `water ${item.retained_water_ml?.toFixed(1)} ml  ${item.reason ?? ''}`,
    );
  }
  await page.$eval('#cycle', (el) => el.scrollIntoView());
  await screenshot(
    page,
    `${label}-report`,
    `the report of the ${label} load: ${total.trim()}. ${producedBy} Every item with its result, score, points, reason and what it holds; the legend of the residue scale above the table`,
  );

  // The machine after the wash, with the residue of every item painted where it is. The page
  // is in the three-quarter view of the lower basket already, behind the report: a screenshot
  // of that view would be the one before (it was `NN-<label>-machine-iso-lower.png`, and the
  // number stays unused).
  await view(page, 'iso_lower');
  sameAsLast(
    '. Behind the report the machine in the three-quarter view of the lower basket: the items as they came out, residue painted where it remains (magenta tiles with a dark rim)',
  );
  for (const [name, what] of [
    ['top_lower', 'plan view of the lower basket'],
    ['iso_upper', 'three-quarter view of the upper basket'],
    ['top_upper', 'plan view of the upper basket'],
  ] as const) {
    await view(page, name);
    await screenshot(
      page,
      `${label}-machine-${name.replace('_', '-')}`,
      `the ${label} load after the wash, ${what}: the items as they came out, residue painted where it remains (magenta tiles with a dark rim)`,
    );
  }
  // Round to the back with the free camera: residue on faces that look away from the door.
  await view(page, 'orbit');
  const o = await canvasBox(page);
  await page.mouse.move(o.x + o.w * 0.5, o.y + o.h * 0.5);
  await page.mouse.down();
  await page.mouse.move(o.x + o.w * 0.5 - 420, o.y + o.h * 0.5 + 60, { steps: 10 });
  await page.mouse.up();
  await caughtUp(page);
  await screenshot(
    page,
    `${label}-machine-orbit`,
    `the ${label} load after the wash from the free camera, turned round to the side`,
  );

  // The traces that do not count, on request.
  await view(page, 'iso_lower');
  await page.$eval('#cycle', (el) => el.scrollIntoView());
  await page.click('#wash .show-traces');
  await caughtUp(page);
  await screenshot(
    page,
    `${label}-machine-traces`,
    `the ${label} load with the traces too faint to count shown as well (small dots in the lightest step)`,
  );
  await page.click('#wash .show-traces');
  await caughtUp(page);

  const checks = await verify(page, server, sessionId, report, dataDir);
  for (const check of checks) {
    console.log(
      `    painted ${check.item_id.padEnd(10)} ${String(check.tiles).padStart(5)} tiles, ` +
        `${check.max_distance_to_surface_mm} mm off the surface at most, ` +
        (check.max_distance_to_simulated_cell_mm === null
          ? 'not compared with the simulation'
          : `${check.max_distance_to_simulated_cell_mm} mm off the simulation's cells at most`),
    );
  }
  return { report, checks };
}

async function main(): Promise<number> {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`the client is not built: run "pnpm --filter @spotless/web build" first`);
    return 2;
  }
  mkdirSync(outDir, { recursive: true });
  // The pictures of an earlier run go: their numbers would not be those of this one.
  for (const name of readdirSync(outDir)) {
    if (/^(\d\d-.*|zz-failure)\.png$/.test(name)) rmSync(join(outDir, name));
  }
  const dataDir =
    keptData === undefined
      ? mkdtempSync(join(tmpdir(), 'spotless-wash-shots-'))
      : resolve(keptData);
  // The server's own runner: the wash simulation, in the wash worker process.
  const server = await buildServer({ dataDir, staticDir: dist, washTier: tier });
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const port = (server.app.server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/`;
  console.log(
    `server on ${url} (${server.queue.identity.module}, ${tier} tier), screenshots to ${outDir}`,
  );

  const browser = await launchChrome();
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  const results: { [label: string]: { report: WashReport; checks: ItemCheck[] } } = {};
  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.level[data-level-id="tutorial"]');
    await newTutorial(page);
    results['bad'] = await playLoad(page, server, dataDir, 'bad', BAD);

    // The item that came out worst, close up, from all sides.
    const bad = results['bad'].report;
    const worst = [...bad.items]
      .filter((item) => item.loaded)
      .sort((a, b) =>
        a.loaded && b.loaded ? (b.visible_area_mm2 ?? 0) - (a.visible_area_mm2 ?? 0) : 0,
      )[0];
    if (worst !== undefined) {
      await closeUps(page, 'bad', worst.item_id, [
        'three_quarter',
        'above',
        'below',
        'front',
        'back',
      ]);
    }
    for (const id of ['bowl_01', 'mug_01']) {
      if (id !== worst?.item_id)
        await closeUps(page, 'bad', id, ['three_quarter', 'above', 'below']);
    }

    await page.click('#levels');
    await newTutorial(page);
    results['good'] = await playLoad(page, server, dataDir, 'good', GOOD);
    const good = results['good'].report;
    const leastClean = [...good.items]
      .filter((item) => item.loaded)
      .sort((a, b) =>
        a.loaded && b.loaded ? (b.visible_area_mm2 ?? 0) - (a.visible_area_mm2 ?? 0) : 0,
      )[0];
    if (leastClean !== undefined) {
      await closeUps(page, 'good', leastClean.item_id, ['three_quarter', 'above', 'below']);
    }
    console.log(
      `points: bad load ${bad.score.points} of ${bad.score.points_available}, ` +
        `good load ${good.score.points} of ${good.score.points_available}`,
    );
  } catch (error) {
    problems.push(`the script stopped: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    await page
      .screenshot({ path: join(outDir, 'zz-failure.png') as `${string}.png` })
      .catch(() => {});
  } finally {
    await browser.close();
    await server.close();
    if (keptData === undefined) rmSync(dataDir, { recursive: true, force: true });
  }
  writeFileSync(join(outDir, 'captions.txt'), `${captions.join('\n')}\n`);
  writeFileSync(
    join(outDir, 'verification.json'),
    `${JSON.stringify(
      {
        tier,
        loads: Object.fromEntries(
          Object.entries(results).map(([label, result]) => [
            label,
            {
              points: result.report.score.points,
              points_available: result.report.score.points_available,
              result_hash: result.report.job.result_hash,
              sim_version: result.report.job.sim_version,
              runtime_s: result.report.job.runtime_s,
              items: result.report.items.flatMap((item) =>
                item.loaded
                  ? [
                      {
                        item_id: item.item_id,
                        clean: item.clean,
                        score_iec: item.score_iec,
                        reason: item.reason ?? null,
                        visible_area_mm2: item.visible_area_mm2,
                        retained_water_ml: item.retained_water_ml,
                      },
                    ]
                  : [],
              ),
              residue_painting: result.checks,
            },
          ]),
        ),
        repeated_washes: comparisons,
        notes: sourceNotes,
        problems,
      },
      null,
      2,
    )}\n`,
  );
  for (const note of sourceNotes) console.log(`note: ${note}`);
  for (const error of consoleErrors) console.error(`console error: ${error}`);
  expect(consoleErrors.length === 0, `no errors on the page's console (${consoleErrors.length})`);
  console.log(problems.length === 0 ? 'OK' : `${problems.length} problem(s)`);
  return problems.length === 0 ? 0 : 1;
}

const status = await main();
// The simulation's GPU bindings may keep the process alive after everything is closed.
process.exit(status);
