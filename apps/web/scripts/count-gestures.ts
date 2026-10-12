/**
 * Counts what it takes a person to load the tutorial the way the careful reference load has
 * it: the clicks and key presses per piece, and to move a placed piece ten centimetres.
 *
 * The reference is `runPolicy(session, { policy: 'careful' })` of `@spotless/loader` on the
 * tutorial: every piece of the level, each with the basket, the place and the orientation the
 * careful loader gave it, and where it then came to rest.
 *
 * The page is played for real: for every piece the script clicks it in the list, presses R
 * until it stands as the reference has it, points at the place where the reference let it go
 * (a piece on edge: at the row the reference stood it in), turns it with Q and E where the
 * page did not already turn it, and clicks. It counts
 * its own clicks and key presses (moving the mouse is free), and reports where each piece then
 * stands against the reference. Changing a basket and choosing a view are the same clicks in
 * any version of the page and are not counted.
 *
 * Beside the played count it prints the count for the page as it was before the controls were
 * changed (11 October 2026), worked out from that page's own key table for the same load: a
 * click on the list, R or F to the preset from the first preset of the card, Q or E in 15
 * degree steps to the turn (to the nearest 15 degrees, as here), a click. That count is
 * arithmetic on the old bindings, not a play-through: the old page is no longer built.
 *
 *   tsx scripts/count-gestures.ts [--out <file.json>]
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allLevels, levelCard } from '@spotless/levels';
import { buildServer } from '@spotless/server';
import type { PlaceRequest, SetRackRequest } from '@spotless/session';
import { createSession, placeholderWashRunner } from '@spotless/session';
import type { Page } from 'puppeteer-core';
// The loader is not a dependency of the page: it is read where it lies, for this script only.
import { referenceSeed, runPolicy } from '../../../packages/loader/src/index.ts';
import { stancesOf } from '../src/stance.ts';
import type { DebugState } from './driver.ts';
import {
  caughtUp,
  debug,
  launchChrome,
  pixelOf,
  placedPose,
  pointAt,
  sleep,
  trayTab,
  view,
} from './driver.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const dist = join(here, '..', 'dist');
const outAt = process.argv.indexOf('--out');
const outFile = outAt >= 0 ? process.argv[outAt + 1] : undefined;

/** One step of the reference load. */
type Step =
  | { kind: 'rack'; request: SetRackRequest }
  | {
      kind: 'place';
      request: PlaceRequest;
      /** Where the piece stood at the end of the reference load, in its frame. */
      rest: readonly [number, number, number];
      location: string;
    };

/** The turn of a place request about the vertical, whole degrees. */
function yawOf(request: PlaceRequest): number {
  const orientation = request.orientation as { yaw_deg?: number };
  return orientation.yaw_deg ?? 0;
}

function presetOf(request: PlaceRequest): string {
  return (request.orientation as { preset?: string }).preset ?? '';
}

/** The fewest presses that turn by `yaw` to the nearest 15 degrees: quarter turns and 15 degree steps. */
function turnPresses(yaw: number): { quarters: number; fine: number } {
  const target = Math.round(yaw / 15) * 15;
  let best = { quarters: 0, fine: 0, cost: Infinity };
  for (let quarters = -2; quarters <= 2; quarters++) {
    for (const full of [0, 360, -360]) {
      const fine = (target + full - 90 * quarters) / 15;
      const cost = Math.abs(quarters) + Math.abs(fine);
      if (cost < best.cost) best = { quarters, fine, cost };
    }
  }
  return { quarters: best.quarters, fine: best.fine };
}

/** The page as it was: presses of Q or E in 15 degree steps to the nearest 15 degrees. */
function oldTurnPresses(yaw: number): number {
  const target = Math.abs(Math.round(yaw / 15) * 15) % 360;
  return Math.min(target, 360 - target) / 15;
}

async function reference(): Promise<{ steps: Step[]; presets: Map<string, string[]> }> {
  const level = allLevels().find((candidate) => candidate.id === 'tutorial');
  if (level === undefined) throw new Error('no tutorial level');
  const session = await createSession({ level, washRunner: placeholderWashRunner });
  runPolicy(session, { policy: 'careful', seed: referenceSeed(level, 1) });
  const log = session.actionLog();
  const state = session.peekState();
  const lastPlace = new Map<string, number>();
  for (const event of log) {
    if (event.name === 'place' && event.accepted) {
      lastPlace.set((event.args as unknown as PlaceRequest).item_id, event.seq);
    }
  }
  const steps: Step[] = [];
  for (const event of log) {
    if (!event.accepted) continue;
    if (event.name === 'set_rack') {
      steps.push({ kind: 'rack', request: event.args as unknown as SetRackRequest });
    } else if (event.name === 'place') {
      const request = event.args as unknown as PlaceRequest;
      if (lastPlace.get(request.item_id) !== event.seq) continue;
      const placed = state.placed.find((p) => p.item_id === request.item_id);
      if (placed === undefined) continue;
      steps.push({ kind: 'place', request, rest: placed.position_mm, location: placed.location });
    }
  }
  // What comes after the last piece (pushing the baskets in) is not part of loading it.
  while (steps.length > 0 && steps[steps.length - 1]?.kind === 'rack') steps.pop();
  session.dispose();
  const card = levelCard(level);
  return {
    steps,
    presets: new Map(
      card.items.map((item) => [item.item_id, item.orientation_presets.map((p) => p.name)]),
    ),
  };
}

interface Row {
  item: string;
  basket: string;
  preset: string;
  yaw: number;
  old_presses: number;
  new_clicks: number;
  new_keys: number;
  taken_up_row: boolean;
  /** True when the piece was put on a suggested spot (one query and one click more). */
  asked_spots: boolean;
  placed: boolean;
  same_basket: boolean;
  stable: boolean;
  from_reference_mm: number | null;
}

async function main(): Promise<number> {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('the client is not built: run "pnpm --filter @spotless/web build" first');
    return 2;
  }
  const { steps, presets } = await reference();
  const level = allLevels().find((candidate) => candidate.id === 'tutorial');
  const card = level === undefined ? null : levelCard(level);
  const dataDir = mkdtempSync(join(tmpdir(), 'spotless-count-'));
  const server = await buildServer({
    dataDir,
    staticDir: dist,
    washRunner: placeholderWashRunner,
    washRunnerVersion: 'placeholder',
  });
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const port = (server.app.server.address() as AddressInfo).port;
  const browser = await launchChrome();
  const page = await browser.newPage();
  const rows: Row[] = [];
  let move: { clicks: number; keys: number; moved_mm: number } | null = null;

  // Everything the script presses goes through these two, which count.
  let clicks = 0;
  let keys = 0;
  const click = async (x: number, y: number): Promise<void> => {
    clicks += 1;
    await page.mouse.click(x, y);
  };
  const clickOn = async (selector: string): Promise<void> => {
    clicks += 1;
    await page.click(selector);
  };
  const press = async (key: 'KeyR' | 'KeyQ' | 'KeyE', shift = false): Promise<void> => {
    keys += 1;
    if (shift) await page.keyboard.down('Shift');
    await page.keyboard.press(key);
    if (shift) await page.keyboard.up('Shift');
  };
  const rack = async (request: SetRackRequest): Promise<void> => {
    const selector = `button[data-rack="${request.rack}"][data-option="${request.option.name}"][data-value="${request.option.value}"]`;
    const button = await page.$(selector);
    if (button === null) return;
    // Already so: the button of the value a basket has is the active one (and disabled).
    if (await page.$eval(selector, (el) => el.classList.contains('active'))) return;
    // Disabled for the moment (the basket before it is still moving): wait for it. A step
    // that was skipped here left the knife shelf down under the reference's cups, and the
    // count then described another load.
    await page.waitForFunction(
      (sel: string) => {
        const el = document.querySelector(sel) as HTMLButtonElement | null;
        return el !== null && !el.disabled;
      },
      { timeout: 20_000 },
      selector,
    );
    await page.click(selector);
    await caughtUp(page);
    if (!(await page.$eval(selector, (el) => el.classList.contains('active')))) {
      throw new Error(
        `the basket setting ${request.rack} ${request.option.name}=${request.option.value} was not taken`,
      );
    }
  };
  const viewFor = (frame: string): string =>
    frame === 'upper_rack' ? 'iso_upper' : frame === 'cutlery_basket' ? 'top_cutlery' : 'iso_lower';

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
    await page.click('.level[data-level-id="tutorial"]');
    await page.waitForFunction(
      () =>
        (window as unknown as { spotless?: { debugState(): DebugState } }).spotless?.debugState()
          .thumbnails === 12,
      { timeout: 60_000 },
    );
    await caughtUp(page);
    let shown = '';
    for (const step of steps) {
      if (step.kind === 'rack') {
        await rack(step.request);
        continue;
      }
      const { request } = step;
      const item = request.item_id;
      const preset = presetOf(request);
      const yaw = yawOf(request);
      const wantedView = viewFor(request.frame);
      if (shown !== wantedView) {
        await view(page as Page, wantedView);
        shown = wantedView;
      }
      clicks = 0;
      keys = 0;
      await trayTab(page, 'counter');
      await clickOn(`.tray-item[data-item-id="${item}"]`);
      await page.waitForSelector('#place');
      // Which way up.
      for (let i = 0; i < 6 && (await debug(page)).held?.preset !== preset; i++) {
        await press('KeyR');
        await caughtUp(page);
      }
      // Where: the place the reference let it go at, at the height it is let go; a piece the
      // page stands in a row is pointed at where the reference has it standing.
      const [rx, ry] = request.position_mm;
      let at = await pointAt(page, request.frame, step.rest);
      if ((await debug(page)).hand?.snapped === null) {
        for (let i = 0; i < 8; i++) {
          const shown = (await debug(page)).hand?.shown_mm ?? null;
          at = await pointAt(page, request.frame, [rx, ry, shown?.[2] ?? step.rest[2]]);
          await sleep(300);
          await caughtUp(page);
          const held = (await debug(page)).held;
          if (
            held !== null &&
            Math.abs(held.position_mm[0] - rx) <= 1 &&
            Math.abs(held.position_mm[1] - ry) <= 1
          ) {
            break;
          }
        }
      }
      // Which way it faces, unless a row of tines has turned it already.
      let hand = await debug(page);
      const takenUp = hand.hand?.snapped !== null && hand.hand?.snapped !== undefined;
      const wanted = Math.round(yaw / 15) * 15;
      const off = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
      if (takenUp) {
        if (off(hand.held?.yaw_deg ?? 0, wanted) > 90) await press('KeyQ');
      } else {
        const turn = turnPresses(yaw);
        for (let i = 0; i < Math.abs(turn.quarters); i++) {
          await press(turn.quarters > 0 ? 'KeyQ' : 'KeyE');
        }
        for (let i = 0; i < Math.abs(turn.fine); i++) {
          await press(turn.fine > 0 ? 'KeyQ' : 'KeyE', true);
        }
      }
      await page.mouse.move(at.px + 1, at.py);
      await page.mouse.move(at.px, at.py);
      await sleep(400);
      await caughtUp(page);
      hand = await debug(page);
      let letGo = hand.hand?.shown_mm ?? null;
      let asked = false;
      if (takenUp && letGo !== null && (letGo[2] as number) > step.rest[2] + 120) {
        // The page shows the piece perched on its neighbour, far above where the reference
        // has it standing. What a person does then: ask the game for the spots (one query)
        // and click the mark of the place wanted.
        asked = true;
        await clickOn('#suggest-spots');
        await page.waitForSelector('#suggestions-note');
        await caughtUp(page);
        const marks = await page.evaluate(() =>
          (
            window as unknown as {
              spotless: { debugSpots(): { x: number; y: number; free: boolean }[] };
            }
          ).spotless.debugSpots(),
        );
        const wantedAt = await pixelOf(page, request.frame, request.position_mm);
        const nearest = marks
          .filter((mark) => mark.free)
          .sort(
            (a, b) =>
              Math.hypot(a.x - wantedAt.px, a.y - wantedAt.py) -
              Math.hypot(b.x - wantedAt.px, b.y - wantedAt.py),
          )[0];
        if (nearest !== undefined) {
          at = { px: nearest.x, py: nearest.y };
          await page.mouse.move(at.px - 30, at.py - 20);
          await page.mouse.move(at.px, at.py, { steps: 4 });
          await sleep(400);
          await caughtUp(page);
          hand = await debug(page);
          letGo = hand.hand?.shown_mm ?? null;
        }
      }
      const tint = hand.tint;
      await click(at.px, at.py);
      await caughtUp(page);
      const after = await debug(page);
      const said = await page.$eval('#feedback', (el) => el.textContent ?? '').catch(() => '');
      console.log(
        `  ${item}: asked ${request.position_mm.join(', ')}; held ${hand.held?.position_mm.join(', ')} (${tint}${asked ? ', a suggested spot' : ''}), shown let go at ${letGo?.map((v) => Math.round(v)).join(', ')}; ${said.slice(0, 200)}`,
      );
      if (after.held !== null) {
        // Refused where the reference has it: give the piece back, and say so.
        await page.keyboard.press('Backspace');
        await caughtUp(page);
      }
      const rest = await placedPose(page, item);
      const list = presets.get(item) ?? [];
      const index = Math.max(0, list.indexOf(preset));
      const oldPreset = Math.min(index, list.length - index);
      const record = card?.items.find((candidate) => candidate.item_id === item);
      rows.push({
        item,
        basket: request.frame,
        preset,
        yaw,
        old_presses: 2 + oldPreset + oldTurnPresses(yaw),
        new_clicks: clicks,
        new_keys: keys,
        taken_up_row: takenUp,
        asked_spots: asked,
        placed: rest !== null,
        same_basket: rest !== null && rest.location === step.location,
        stable: rest?.stable === true,
        from_reference_mm:
          rest === null || rest.frame !== request.frame
            ? null
            : Math.hypot(
                rest.position_mm[0] - step.rest[0],
                rest.position_mm[1] - step.rest[1],
                rest.position_mm[2] - step.rest[2],
              ),
      });
      const row = rows[rows.length - 1] as Row;
      console.log(
        `${item}: ${preset}${yaw === 0 ? '' : `, turned ${yaw}`} in ${request.frame}: before ${row.old_presses}, now ${row.new_clicks} clicks + ${row.new_keys} keys` +
          `${takenUp ? ' (took up a row)' : ''}${asked ? ' (asked for the spots: one query)' : ''}; ` +
          (rest === null
            ? 'NOT placed'
            : `${rest.location}${rest.stable ? ', stable' : ', not stable'}, ${row.from_reference_mm === null ? 'another frame' : `${row.from_reference_mm.toFixed(0)} mm from the reference`}`) +
          ` (first stance of the page: ${record === undefined ? '?' : (stancesOf(record.orientation_presets, record.bbox_mm)[0]?.preset ?? '?')})`,
      );
    }

    // Moving a placed piece ten centimetres: the mug, in the plan view, towards the middle of
    // the upper basket, where there is room (towards the wall, as it was until the upper
    // basket was corrected, the move is refused: the rest under the knife shelf is there).
    const mover =
      rows.find((row) => row.placed && row.item === 'mug_01') ??
      rows.filter((row) => row.placed && row.basket === 'upper_rack').at(-1);
    if (mover !== undefined) {
      await view(page, 'top_upper');
      const before = await placedPose(page, mover.item);
      if (before !== null) {
        clicks = 0;
        keys = 0;
        const from = await pixelOf(page, before.frame, before.position_mm);
        await page.mouse.move(from.px, from.py);
        await click(from.px, from.py);
        await caughtUp(page);
        console.log(`  moving ${mover.item}: in hand ${JSON.stringify((await debug(page)).hand)}`);
        // Ten centimetres to wherever the page shows the piece free: a person who sees the
        // piece red on one side moves it to the other.
        let to = from;
        for (const [dx, dy] of [
          [100, 0],
          [0, -100],
          [-100, 0],
          [0, 100],
        ] as const) {
          to = await pixelOf(page, before.frame, [
            before.position_mm[0] + dx,
            before.position_mm[1] + dy,
            before.position_mm[2],
          ]);
          await page.mouse.move(to.px, to.py, { steps: 6 });
          await sleep(400);
          await caughtUp(page);
          const tint = (await debug(page)).tint;
          console.log(
            `  moving ${mover.item}: by (${dx}, ${dy}) mm the page shows it ${tint} at ${JSON.stringify((await debug(page)).held?.position_mm)}`,
          );
          if (tint === 'clear' || tint === 'perched') break;
        }
        await click(to.px, to.py);
        await caughtUp(page);
        const after = await placedPose(page, mover.item);
        console.log(
          `  moving ${mover.item}: ${(await page.$eval('#feedback', (el) => el.textContent ?? '').catch(() => '')).slice(0, 240)}`,
        );
        move = {
          clicks,
          keys,
          moved_mm:
            after === null
              ? Number.NaN
              : Math.hypot(
                  after.position_mm[0] - before.position_mm[0],
                  after.position_mm[1] - before.position_mm[1],
                ),
        };
      }
    }
  } finally {
    await browser.close();
    await server.close();
    rmSync(dataDir, { recursive: true, force: true });
  }

  const total = (pick: (row: Row) => number): number =>
    rows.reduce((sum, row) => sum + pick(row), 0);
  console.log(`\nThe careful reference load of the tutorial, ${rows.length} pieces`);
  console.log(
    `before (from the old key table): ${total((row) => row.old_presses)} clicks and key presses, ` +
      `${(total((row) => row.old_presses) / rows.length).toFixed(1)} a piece`,
  );
  console.log(
    `now (played): ${total((row) => row.new_clicks + row.new_keys)} (${total((row) => row.new_clicks)} clicks, ${total((row) => row.new_keys)} key presses), ` +
      `${(total((row) => row.new_clicks + row.new_keys) / rows.length).toFixed(1)} a piece`,
  );
  console.log(
    `placed ${rows.filter((row) => row.placed).length}, in the basket of the reference ${rows.filter((row) => row.same_basket).length}, stable ${rows.filter((row) => row.stable).length}`,
  );
  // Before: click the piece (select), "Take out and hold as it stands", M to make it follow the
  // mouse again, click to drop.
  console.log(
    `moving a placed piece ten centimetres: before 4 (3 clicks and the M key), now ${move === null ? '?' : `${move.clicks + move.keys} (${move.clicks} clicks, ${move.keys} keys; it moved ${move.moved_mm.toFixed(0)} mm)`}`,
  );
  if (outFile !== undefined) {
    writeFileSync(outFile, `${JSON.stringify({ rows, move, move_before: 4 }, null, 2)}\n`);
  }
  // The move is part of what the script vouches for: a piece that was not moved (the move was
  // refused, or it came back to where it stood) fails it.
  const movedIt = move !== null && Number.isFinite(move.moved_mm) && move.moved_mm >= 50;
  if (!movedIt) {
    console.error(
      'FAILED: the placed piece was not moved (see the lines "moving ..." above): the count for moving a piece is not a count of a move',
    );
  }
  return rows.every((row) => row.placed) && movedIt ? 0 : 1;
}

process.exitCode = await main();
