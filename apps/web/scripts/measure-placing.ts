/**
 * Measures how far a piece comes to rest from where the player pointed: for a small vessel and
 * for a plate, from each view in which the mouse places, at a grid of cursor positions over
 * each basket (points of its floor; of the cutlery basket, into which one looks from above,
 * points of its opening). The page is driven as a person drives it (click the piece in the list, move the
 * mouse, click); the script reads the page's own state to know where the piece then stands.
 *
 * For every drop it reports two distances, each on the screen (pixels at 1680 x 1050) and from
 * the line of sight through the cursor (millimetres):
 *
 *  - let go: to the middle of the piece where the game lets it go (its pose lowered to first
 *    contact, which the free preview reports). This is the pointing itself;
 *  - at rest: to the middle of the piece where it then comes to rest. This adds what the
 *    physics does with it after it is let go (a glass stood on tine tips topples, a plate
 *    slides down between the tines).
 *
 *   tsx scripts/measure-placing.ts [--static <built client>] [--label <name>] [--out <file.json>]
 *       [--stance <preset>] [--free] [--only <view>] [--basket <frame>] [--items a,b]
 *
 * `--static` lets the same script measure another build of the page (the one from before a
 * change). `--stance` picks a stance by its picture after the pick-up (pages that have them);
 * `--free` switches the snapping to tine rows off.
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer } from '@spotless/server';
import { placeholderWashRunner } from '@spotless/session';
import type { Page } from 'puppeteer-core';
import type { DebugState } from './driver.ts';
import { caughtUp, debug, launchChrome, sleep, trayTab, view } from './driver.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const flag = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const staticDir = flag('--static') ?? join(here, '..', 'dist');
const label = flag('--label') ?? 'page';
const outFile = flag('--out');
const stance = flag('--stance');
const free = process.argv.includes('--free');
const only = flag('--only');
const onlyBasket = flag('--basket');
const itemsFlag = flag('--items');

/** One drop. */
interface Drop {
  view: string;
  basket: string;
  item: string;
  target_mm: [number, number];
  /** 'held back': the page showed that the piece would fall out and did not let it go. */
  outcome: 'placed' | 'returned' | 'refused' | 'held back';
  /** At rest. */
  px?: number;
  mm?: number;
  /** Where it was let go. */
  let_px?: number;
  let_mm?: number;
}

interface Case {
  readonly view: string;
  readonly basket: string;
  readonly fractions: readonly number[];
  /** The baskets as they must stand: which one is pulled out. */
  readonly out: 'lower_rack' | 'upper_rack';
}

/**
 * The views in which the mouse places: the three-quarter views and the plans. In the three
 * elevations the line of sight runs along the baskets, and a point of the picture names no
 * place in them.
 */
const CASES: readonly Case[] = [
  { view: 'iso_lower', basket: 'lower_rack', fractions: [0.25, 0.5, 0.75], out: 'lower_rack' },
  { view: 'top_lower', basket: 'lower_rack', fractions: [0.25, 0.5, 0.75], out: 'lower_rack' },
  { view: 'iso_lower', basket: 'cutlery_basket', fractions: [0.3, 0.7], out: 'lower_rack' },
  { view: 'top_cutlery', basket: 'cutlery_basket', fractions: [0.3, 0.7], out: 'lower_rack' },
  { view: 'iso_upper', basket: 'upper_rack', fractions: [0.25, 0.5, 0.75], out: 'upper_rack' },
  { view: 'top_upper', basket: 'upper_rack', fractions: [0.25, 0.5, 0.75], out: 'upper_rack' },
];

const ITEMS: readonly string[] =
  itemsFlag === undefined ? ['glass_01', 'plate_01'] : itemsFlag.split(',');

/** What the script reads of the page's own objects (they are not minified away). */
interface PageInternals {
  held: {
    ghost: { frame: string; position_mm: number[] };
    preview: { accepted: boolean; lowered_pose?: { position_mm: number[] } | null } | null;
  } | null;
  card: { machine: { racks: { rack: string; envelope_mm: [number, number, number] }[] } };
  shownParts: { [id: string]: { position_mm: number[]; quat_wxyz: number[] } };
  view: { poses: { items: { [id: string]: { position_mm: number[]; quat_wxyz: number[] } } } };
  itemTypes: Map<string, string>;
  stage: {
    project(point: readonly number[]): [number, number];
    ray(x: number, y: number): { origin_mm: number[]; direction: number[] };
    scene: { factory: { bounds(type: string): { min: number[]; max: number[] } } };
  };
}

/** Where a point of a basket's floor (of the cutlery basket: of its opening) is on the page. */
async function floorPixel(
  page: Page,
  basket: string,
  fx: number,
  fy: number,
): Promise<{ px: number; py: number; x: number; y: number }> {
  return page.evaluate(
    (basket, fx, fy) => {
      const app = (window as unknown as { spotless: PageInternals }).spotless;
      const rack = app.card.machine.racks.find((r) => r.rack === basket);
      if (rack === undefined) throw new Error(`no basket ${basket}`);
      const frame = app.shownParts[basket] ?? {
        position_mm: [0, 0, 0],
        quat_wxyz: [1, 0, 0, 0],
      };
      const x = rack.envelope_mm[0] * fx;
      const y = rack.envelope_mm[1] * fy;
      // A basket one looks into from above (the cutlery basket) is pointed at by its opening.
      const z = basket === 'cutlery_basket' ? rack.envelope_mm[2] : 0;
      const [w, qx, qy, qz] = frame.quat_wxyz as [number, number, number, number];
      // v' = v + 2 q x (q x v + w v), for v = (x, y, z).
      const cx = qy * z - qz * y + w * x;
      const cy = qz * x - qx * z + w * y;
      const cz = qx * y - qy * x + w * z;
      const point = [
        (frame.position_mm[0] as number) + x + 2 * (qy * cz - qz * cy),
        (frame.position_mm[1] as number) + y + 2 * (qz * cx - qx * cz),
        (frame.position_mm[2] as number) + z + 2 * (qx * cy - qy * cx),
      ];
      const [px, py] = app.stage.project(point);
      return { px, py, x, y };
    },
    basket,
    fx,
    fy,
  );
}

/** How far the middle of a resting piece is from the cursor: pixels, and millimetres from the line of sight. */
async function miss(
  page: Page,
  itemId: string,
  px: number,
  py: number,
): Promise<{ px: number; mm: number } | null> {
  return page.evaluate(
    (itemId, px, py) => {
      const app = (window as unknown as { spotless: PageInternals }).spotless;
      const pose = app.view.poses.items[itemId];
      const type = app.itemTypes.get(itemId);
      if (pose === undefined || type === undefined) return null;
      const bounds = app.stage.scene.factory.bounds(type);
      const c = [0, 1, 2].map(
        (i) => (((bounds.min[i] as number) + (bounds.max[i] as number)) / 2) * 1000,
      ) as [number, number, number];
      const [w, qx, qy, qz] = pose.quat_wxyz as [number, number, number, number];
      const tx = qy * c[2] - qz * c[1] + w * c[0];
      const ty = qz * c[0] - qx * c[2] + w * c[1];
      const tz = qx * c[1] - qy * c[0] + w * c[2];
      const centre = [
        (pose.position_mm[0] as number) + c[0] + 2 * (qy * tz - qz * ty),
        (pose.position_mm[1] as number) + c[1] + 2 * (qz * tx - qx * tz),
        (pose.position_mm[2] as number) + c[2] + 2 * (qx * ty - qy * tx),
      ];
      const [sx, sy] = app.stage.project(centre);
      const ray = app.stage.ray(px, py);
      const d = [0, 1, 2].map((i) => (centre[i] as number) - (ray.origin_mm[i] as number));
      const along = d.reduce((sum, v, i) => sum + v * (ray.direction[i] as number), 0);
      const off = Math.hypot(...d.map((v, i) => v - along * (ray.direction[i] as number)));
      return { px: Math.hypot(sx - px, sy - py), mm: off };
    },
    itemId,
    px,
    py,
  );
}

/**
 * How far the piece in hand would be let go from the cursor: the place of its request, at the
 * height the preview lowered it to. Null while the game has not said where that is.
 */
async function letGoMiss(
  page: Page,
  px: number,
  py: number,
): Promise<{ px: number; mm: number } | null> {
  return page.evaluate(
    (px, py) => {
      const app = (window as unknown as { spotless: PageInternals }).spotless;
      const held = app.held;
      const lowered = held?.preview?.accepted === true ? held.preview.lowered_pose : null;
      if (held === null || lowered === null || lowered === undefined) return null;
      const frame = app.shownParts[held.ghost.frame] ?? {
        position_mm: [0, 0, 0],
        quat_wxyz: [1, 0, 0, 0],
      };
      // The frames of the baskets are parallel to the tub frame.
      const point = [0, 1, 2].map(
        (i) => (frame.position_mm[i] as number) + (lowered.position_mm[i] as number),
      );
      const [sx, sy] = app.stage.project(point);
      const ray = app.stage.ray(px, py);
      const d = [0, 1, 2].map((i) => (point[i] as number) - (ray.origin_mm[i] as number));
      const along = d.reduce((sum, v, i) => sum + v * (ray.direction[i] as number), 0);
      const off = Math.hypot(...d.map((v, i) => v - along * (ray.direction[i] as number)));
      return { px: Math.hypot(sx - px, sy - py), mm: off };
    },
    px,
    py,
  );
}

async function newSession(page: Page): Promise<void> {
  if ((await page.$('.level[data-level-id="tutorial"]')) === null) await page.click('#levels');
  await page.waitForSelector('.level[data-level-id="tutorial"]');
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

async function setRack(page: Page, rack: string, value: string): Promise<void> {
  const selector = `button[data-rack="${rack}"][data-option="position"][data-value="${value}"]`;
  const button = await page.$(selector);
  if (button === null) return;
  if (await page.$eval(selector, (el) => (el as HTMLButtonElement).disabled)) return;
  await page.click(selector);
  await caughtUp(page);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length === 0
    ? Number.NaN
    : sorted.length % 2 === 1
      ? (sorted[mid] as number)
      : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

const one = (value: number): string => (Number.isFinite(value) ? value.toFixed(1) : '-');

async function main(): Promise<number> {
  if (!existsSync(join(staticDir, 'index.html'))) {
    console.error(`no built client in ${staticDir}`);
    return 2;
  }
  const dataDir = mkdtempSync(join(tmpdir(), 'spotless-measure-'));
  const server = await buildServer({
    dataDir,
    staticDir,
    washRunner: placeholderWashRunner,
    washRunnerVersion: 'placeholder',
  });
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const port = (server.app.server.address() as AddressInfo).port;
  const browser = await launchChrome();
  const page = await browser.newPage();
  const drops: Drop[] = [];
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
    for (const test of CASES) {
      if (only !== undefined && only !== test.view) continue;
      if (onlyBasket !== undefined && onlyBasket !== test.basket) continue;
      await newSession(page);
      if (test.out === 'upper_rack') {
        await setRack(page, 'lower_rack', 'in');
        await setRack(page, 'upper_rack', 'out');
      }
      // The top bar is drawn again while the level opens: a click may meet a button just replaced.
      for (let attempt = 0; ; attempt++) {
        try {
          await view(page, test.view);
          break;
        } catch (error) {
          if (attempt >= 4) throw error;
          await sleep(200);
        }
      }
      for (const item of ITEMS) {
        for (const fx of test.fractions) {
          for (const fy of test.fractions) {
            await trayTab(page, 'counter');
            await page.click(`.tray-item[data-item-id="${item}"]`);
            await page.waitForFunction(
              () =>
                (
                  window as unknown as { spotless: { debugState(): DebugState } }
                ).spotless.debugState().held !== null,
            );
            if (stance !== undefined) {
              const picture = await page.$(`[data-stance="${stance}"]`);
              if (picture !== null) await picture.click();
            }
            if (free) {
              const snap = await page.$('#snap-rows');
              if (
                snap !== null &&
                (await page.$eval('#snap-rows', (el) => (el as HTMLInputElement).checked))
              ) {
                await snap.click();
              }
            }
            const target = await floorPixel(page, test.basket, fx, fy);
            // The way a hand arrives: from the middle of the picture, then a rest.
            await page.mouse.move(target.px - 60, target.py - 40);
            await page.mouse.move(target.px, target.py, { steps: 6 });
            await sleep(900);
            await caughtUp(page);
            const letGo = await letGoMiss(page, target.px, target.py);
            const shownAs = (await debug(page)).hand?.landing ?? null;
            await page.mouse.click(target.px, target.py);
            await caughtUp(page);
            const state = await debug(page);
            const drop: Drop = {
              view: test.view,
              basket: test.basket,
              item,
              target_mm: [Math.round(target.x), Math.round(target.y)],
              outcome: 'placed',
              ...(letGo === null ? {} : { let_px: letGo.px, let_mm: letGo.mm }),
            };
            if (state.held !== null) {
              drop.outcome =
                shownAs !== null && ['on_rim', 'outside', 'on_handle'].includes(shownAs)
                  ? 'held back'
                  : 'refused';
              await page.keyboard.press('Escape');
              await caughtUp(page);
            } else if (!state.items.some((placed) => placed.id === item)) {
              drop.outcome = 'returned';
            } else {
              const measured = await miss(page, item, target.px, target.py);
              if (measured !== null) {
                drop.px = measured.px;
                drop.mm = measured.mm;
              }
              // The piece is selected after its drop: take it out again.
              await page.keyboard.press('Backspace');
              await caughtUp(page);
              if ((await debug(page)).items.some((placed) => placed.id === item)) {
                await trayTab(page, 'machine');
                await page.click(`.tray-item[data-item-id="${item}"]`);
                await page.waitForSelector('#take-out');
                await page.click('#take-out');
                await caughtUp(page);
              }
              if ((await debug(page)).held !== null) {
                await page.keyboard.press('Backspace');
                await caughtUp(page);
              }
            }
            drops.push(drop);
            console.log(
              `${test.view} ${test.basket} ${item} (${drop.target_mm.join(', ')}): ${drop.outcome}` +
                (drop.let_px === undefined
                  ? ''
                  : ` let go ${one(drop.let_px)} px, ${one(drop.let_mm ?? NaN)} mm;`) +
                (drop.px === undefined
                  ? ''
                  : ` at rest ${one(drop.px)} px, ${one(drop.mm ?? NaN)} mm`),
            );
          }
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
    rmSync(dataDir, { recursive: true, force: true });
  }

  console.log(`\n${label}: from the cursor to the middle of the piece`);
  console.log(
    'view          basket          item      placed   let go: px median  max   mm median  max   at rest: px median  max   mm median  max',
  );
  const rows: unknown[] = [];
  const groups = new Map<string, Drop[]>();
  for (const drop of drops) {
    const key = `${drop.view}|${drop.basket}|${drop.item}`;
    groups.set(key, [...(groups.get(key) ?? []), drop]);
  }
  const line = (name: string[], of: Drop[]): void => {
    const placed = of.filter((drop) => drop.px !== undefined);
    const px = placed.map((drop) => drop.px as number);
    const mm = placed.map((drop) => drop.mm as number);
    // The pointing is measured on every drop the game gave a landing for, placed or not.
    const pointed = of.filter((drop) => drop.let_px !== undefined);
    const lpx = pointed.map((drop) => drop.let_px as number);
    const lmm = pointed.map((drop) => drop.let_mm as number);
    console.log(
      `${(name[0] ?? '').padEnd(13)} ${(name[1] ?? '').padEnd(15)} ${(name[2] ?? '').padEnd(9)} ` +
        `${`${placed.length}/${of.length}`.padEnd(7)} ` +
        `${one(median(lpx)).padStart(16)} ${one(Math.max(...lpx)).padStart(6)} ${one(median(lmm)).padStart(9)} ${one(Math.max(...lmm)).padStart(6)} ` +
        `${one(median(px)).padStart(18)} ${one(Math.max(...px)).padStart(6)} ${one(median(mm)).padStart(9)} ${one(Math.max(...mm)).padStart(6)}`,
    );
    rows.push({
      view: name[0],
      basket: name[1],
      item: name[2],
      drops: of.length,
      placed: placed.length,
      pointed: pointed.length,
      let_px_median: median(lpx),
      let_px_max: Math.max(...lpx),
      let_mm_median: median(lmm),
      let_mm_max: Math.max(...lmm),
      px_median: median(px),
      px_max: Math.max(...px),
      mm_median: median(mm),
      mm_max: Math.max(...mm),
    });
  };
  for (const [key, of] of groups) line(key.split('|'), of);
  for (const item of ITEMS)
    line(
      ['all', 'all', item],
      drops.filter((drop) => drop.item === item),
    );
  line(['all', 'all', 'both'], drops);
  const count = (outcome: Drop['outcome']): number =>
    drops.filter((drop) => drop.outcome === outcome).length;
  console.log(
    `outcomes of ${drops.length} drops: placed ${count('placed')}, fell out (returned to the counter, charged) ${count('returned')}, refused by the game ${count('refused')}, held back by the page (shown as falling out, nothing sent) ${count('held back')}`,
  );
  if (outFile !== undefined) {
    writeFileSync(outFile, `${JSON.stringify({ label, stance, free, rows, drops }, null, 2)}\n`);
  }
  return 0;
}

process.exitCode = await main();
