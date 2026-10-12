/**
 * Checks what the page promises at the edges of a basket: a piece drawn green ("Free") and let
 * go must end in the machine. The cursor is put over points of the floor of the lower basket in
 * the default three-quarter view, the strips along its rim and under the handle of the cutlery
 * basket among them; for each the script notes where the piece is drawn, its tint and the
 * status line, clicks, and reads where the piece ended.
 *
 *   vite build && tsx scripts/check-edges.ts [--static <built client>] [--out <file.json>]
 *       [--view iso_lower] [--items glass_01,bowl_01,plate_01] [--level tutorial]
 *
 * It fails (exit 1) when a drop that was drawn green ended outside the machine. Mouse and
 * keyboard only; the scene is cleared between drops with the page's own "start again".
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
import { aimSettled, caughtUp, debug, launchChrome, pixelOf, trayTab, view } from './driver.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const flag = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const staticDir = flag('--static') ?? join(here, '..', 'dist');
const outFile = flag('--out');
const viewName = flag('--view') ?? 'iso_lower';
const level = flag('--level') ?? 'tutorial';
const items = (flag('--items') ?? 'glass_01,bowl_01,plate_01').split(',');

interface Drop {
  item: string;
  aim_mm: [number, number];
  shown_mm: number[] | null;
  tint: string | null;
  status: string;
  clicked: boolean;
  outcome: 'placed' | 'unstable' | 'door' | 'fell out' | 'refused' | 'not let go';
}

/** Points of the floor of the lower basket: its middle, and the strips along each side. */
const XS = [20, 60, 110, 260, 420, 470, 510];
const YS = [15, 60, 160, 280, 400, 480];

async function clear(page: Page): Promise<void> {
  // The page's own way of emptying the machine; it asks first.
  await page.evaluate(() => {
    const app = (window as unknown as { spotless: { resetAll(): Promise<void> } }).spotless;
    return app.resetAll();
  });
  await caughtUp(page);
}

async function main(): Promise<number> {
  if (!existsSync(join(staticDir, 'index.html'))) {
    console.error(`no built client in ${staticDir}`);
    return 2;
  }
  const dataDir = mkdtempSync(join(tmpdir(), 'spotless-edges-'));
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
    await page.waitForSelector(`.level[data-level-id="${level}"]`);
    await page.click(`.level[data-level-id="${level}"]`);
    await page.waitForFunction(
      () =>
        (window as unknown as { spotless?: { debugState(): DebugState } }).spotless?.debugState()
          .phase === 'loading',
      { timeout: 60_000 },
    );
    await caughtUp(page);
    await view(page, viewName);
    for (const item of items) {
      for (const x of XS) {
        for (const y of YS) {
          await trayTab(page, 'counter');
          await page.click(`.tray-item[data-item-id="${item}"]`);
          await page.waitForSelector('#place');
          const at = await pixelOf(page, 'lower_rack', [x, y, 40]);
          await page.mouse.move(at.px - 40, at.py - 30);
          await page.mouse.move(at.px, at.py, { steps: 6 });
          await aimSettled(page);
          const before = await debug(page);
          const status = await page.evaluate(
            () => document.getElementById('hand-status')?.textContent ?? '',
          );
          await page.mouse.click(at.px, at.py);
          await caughtUp(page);
          const after = await debug(page);
          const rest = after.items.find((entry) => entry.id === item);
          const last = await page.evaluate(
            () => document.getElementById('feedback')?.textContent ?? '',
          );
          const outcome: Drop['outcome'] =
            after.held !== null
              ? /Could not place/.test(last)
                ? 'refused'
                : 'not let go'
              : rest === undefined
                ? 'fell out'
                : rest.location === 'outside' || rest.location === 'tub_floor'
                  ? 'door'
                  : rest.stable
                    ? 'placed'
                    : 'unstable';
          drops.push({
            item,
            aim_mm: [x, y],
            shown_mm: before.hand?.shown_mm?.map((v) => Math.round(v)) ?? null,
            tint: before.tint,
            status: status.slice(0, 90),
            clicked: true,
            outcome,
          });
          const d = drops[drops.length - 1] as Drop;
          if (!process.argv.includes('--quiet'))
            console.log(
              `${item} aim(${x},${y}) shown ${JSON.stringify(d.shown_mm)} ${d.tint} -> ${d.outcome}   ${d.status}`,
            );
          if (after.held !== null) await page.keyboard.press('Escape');
          if (after.placed > 0) await clear(page);
        }
      }
    }
  } finally {
    await browser.close();
    await server.app.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
  const green = drops.filter((d) => d.tint === 'clear');
  const lost = green.filter((d) => d.outcome === 'fell out' || d.outcome === 'door');
  const count = (o: Drop['outcome']): number => drops.filter((d) => d.outcome === o).length;
  console.log(
    `\n${drops.length} drops in ${viewName}: placed ${count('placed')}, unstable ${count('unstable')}, on the door ${count('door')}, fell out ${count('fell out')}, refused ${count('refused')}, not let go ${count('not let go')}`,
  );
  console.log(
    `drawn green: ${green.length}; of those ended outside the machine: ${lost.length}; ended unstable: ${green.filter((d) => d.outcome === 'unstable').length}`,
  );
  const byTint = new Map<string, number>();
  for (const d of drops) byTint.set(d.tint ?? 'none', (byTint.get(d.tint ?? 'none') ?? 0) + 1);
  console.log(`tints: ${[...byTint].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (outFile !== undefined) writeFileSync(outFile, JSON.stringify(drops, null, 1));
  return lost.length === 0 ? 0 : 1;
}

process.exitCode = await main();
