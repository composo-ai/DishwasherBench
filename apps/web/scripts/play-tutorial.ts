/**
 * Plays the tutorial level through the user interface in headless Chrome and saves a
 * screenshot of every step under `apps/web/screenshots/`. This is the integration test of the
 * client: it starts a real game server on a free port serving the built client, and drives the
 * page with the mouse and the keyboard only (it reads `window.spotless.debugState()` to know
 * when the page has caught up, and never calls the API itself).
 *
 * It plays the way a person does: pieces are picked up from the list or dragged in, pointed at
 * a place, stood another way up with R, turned with Q and E, put down with a click, picked up
 * again in the machine with a click and put back with Escape. The exact pose panel is used
 * where the script needs a pose to the millimetre (a collision, a fork that falls through).
 *
 * Run with `pnpm --filter @spotless/web screenshots` (which builds the client first), or
 * `tsx scripts/play-tutorial.ts [--out <dir>] [--keep-open]`.
 *
 * Exit code 0 when the level was played to a report and every check on the way held.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer } from '@spotless/server';
import type { WashRunner, WashTier } from '@spotless/session';
import { placeholderWashRunner } from '@spotless/session';
import type { DebugState } from './driver.ts';
import {
  aimSettled,
  canvasBox,
  caughtUp,
  createRun,
  debug,
  launchChrome,
  openExact,
  pickUp,
  pixelOf,
  placedPose,
  pointAt,
  previewTint,
  sleep,
  trayTab,
  typePose,
  view,
} from './driver.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const dist = join(here, '..', 'dist');
const outFlag = process.argv.indexOf('--out');
const outDir =
  outFlag >= 0 && process.argv[outFlag + 1] !== undefined
    ? (process.argv[outFlag + 1] as string)
    : join(here, '..', 'screenshots');

const run = createRun(outDir);
const { problems, captions, expect, screenshot, sameAsLast, drop, setRack } = run;

/**
 * The server's placeholder wash, slowed down so that the progress display can be seen: it
 * reports progress in twelve steps over about four seconds and then returns the placeholder's
 * report (nothing is simulated either way). The tiers asked for are noted, and a wash asked
 * for at the fast tier is reported as one, so that the page shows it as a preview and offers
 * the full wash: this is how the script plays the choice of wash without washing anything.
 */
const tiersAsked: (WashTier | undefined)[] = [];
const slowPlaceholder = (async (
  manifest: Parameters<WashRunner>[0],
  onProgress: Parameters<WashRunner>[1],
  context?: { readonly tier?: WashTier },
) => {
  tiersAsked.push(context?.tier);
  for (let step = 1; step <= 12; step++) {
    await sleep(context?.tier === 'fast' ? 60 : 350);
    onProgress(step / 12);
  }
  const report = await placeholderWashRunner(manifest, onProgress);
  return context?.tier === 'fast'
    ? { ...report, job: { ...report.job, fidelity: 'fast' } }
    : report;
}) as WashRunner;

async function main(): Promise<number> {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`the client is not built: run "pnpm --filter @spotless/web build" first`);
    return 2;
  }
  mkdirSync(outDir, { recursive: true });
  // The pictures of an earlier run go: their numbers and names change with the script.
  for (const name of readdirSync(outDir)) {
    if (/^(\d\d-.*|zz-failure)\.png$/.test(name)) rmSync(join(outDir, name));
  }
  const dataDir = mkdtempSync(join(tmpdir(), 'spotless-shots-'));
  const server = await buildServer({
    dataDir,
    staticDir: dist,
    washRunner: slowPlaceholder,
    washRunnerVersion: 'slow-placeholder-2',
  });
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const port = (server.app.server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/`;
  console.log(`server on ${url}, screenshots to ${outDir}`);

  const browser = await launchChrome();
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  /** Everything a player can read on the page right now. */
  const pageText = (): Promise<string> => page.evaluate(() => document.body.innerText);
  const noOtherProgramme = async (where: string): Promise<void> => {
    const text = await pageText();
    expect(!/uncalibrated|secondary programme/i.test(text), `${where} offers no other programme`);
  };
  const started = async (): Promise<void> => {
    await page.waitForFunction(
      () =>
        (window as unknown as { spotless?: { debugState(): DebugState } }).spotless?.debugState()
          .thumbnails === 12,
      { timeout: 60_000 },
    );
    await caughtUp(page);
  };

  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.level[data-level-id="tutorial"]');
    const numbers = await page.$$eval('.level', (els) =>
      els.map(
        (el) => `${el.getAttribute('data-level-number')}:${el.getAttribute('data-level-id')}`,
      ),
    );
    expect(
      numbers[0] === '1:tutorial' && numbers.every((n, i) => n.startsWith(`${i + 1}:`)),
      `the levels are numbered in the order the server gives them, the tutorial first (${numbers.slice(0, 3).join(', ')})`,
    );
    await noOtherProgramme('the list of levels');
    await screenshot(
      page,
      'level-picker',
      'the level picker shown when the page opens: the loads numbered in order, the tutorial first',
    );

    await page.click('.modal .buttons button');
    await page.waitForSelector('.how-to');
    await noOtherProgramme('How to play');
    await screenshot(
      page,
      'how-to-play',
      'the how-to-play panel: the game in eight steps and the mouse and key table of the new controls',
    );
    await page.click('#close-how-to');

    await page.click('.level[data-level-id="tutorial"]');
    await started();
    await screenshot(
      page,
      'tutorial-start',
      'the tutorial as it opens: tray with thumbnails and soil, lower basket pulled out over the open door, upper basket in',
    );

    // --- A plate: picked up on edge, shown where it would land, taking up a row of tines ------
    await pickUp(page, 'plate_01');
    const box = await canvasBox(page);
    let hand = await debug(page);
    expect(hand.held?.preset === 'on_edge', `a plate is picked up on edge (${hand.held?.preset})`);
    // Over the open floor of the basket, away from the plate rows: held freely.
    await pointAt(page, 'lower_rack', [330, 150, 135]);
    hand = await debug(page);
    expect(
      hand.hand?.snapped === null,
      `away from the rows the plate is held freely (${hand.hand?.snapped})`,
    );
    // Near the hinged rear rows: it takes up the row.
    const overRow = await pointAt(page, 'lower_rack', [140, 370, 140]);
    hand = await debug(page);
    expect(
      hand.hand?.snapped !== null && hand.hand?.snapped !== undefined && hand.held?.yaw_deg === 90,
      `near a row the plate stands across it over a gap (${hand.hand?.snapped}, yaw ${hand.held?.yaw_deg})`,
    );
    const rowTint = await previewTint(page);
    expect(rowTint === 'clear', `the place in the row is free (${rowTint})`);
    const shown = (await debug(page)).hand?.shown_mm ?? null;
    expect(
      shown !== null && (shown[2] as number) < 215,
      `the plate is drawn where it would be let go, down between the tines, not carried above the basket (z ${shown?.[2]})`,
    );
    await screenshot(
      page,
      'plate-in-hand',
      `plate_01 in hand: picked up on edge, drawn where it would be let go, standing across ${hand.hand?.snapped ?? 'a row'}; its stances as pictures on the right`,
    );
    // Which way up: R steps through the stances and comes round.
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('KeyR');
      await caughtUp(page);
      seen.push((await debug(page)).held?.preset ?? '');
    }
    expect(
      seen.join(',') === 'inverted,upright,on_edge',
      `R steps through the three stances of a plate (${seen.join(', ')})`,
    );
    // Which way it faces: over a row a turn turns it round; held freely it is a quarter turn.
    await page.keyboard.press('KeyQ');
    await caughtUp(page);
    expect(
      (await debug(page)).held?.yaw_deg === -90,
      `Q turns a plate in a row to face the other way (${(await debug(page)).held?.yaw_deg})`,
    );
    await page.keyboard.press('KeyE');
    await caughtUp(page);
    expect((await debug(page)).held?.yaw_deg === 90, 'E turns it back');
    await page.keyboard.down('Alt');
    await page.mouse.move(overRow.px + 1, overRow.py);
    await caughtUp(page);
    expect((await debug(page)).hand?.snapped === null, 'with Alt held the plate is placed freely');
    await page.keyboard.up('Alt');
    await page.mouse.move(overRow.px, overRow.py);
    await sleep(350);
    await caughtUp(page);
    expect((await debug(page)).queries === 0, 'pointing costs no queries');
    // One click puts it down.
    await page.mouse.click(overRow.px, overRow.py);
    await caughtUp(page);
    const firstPlate = (await debug(page)).items.find((item) => item.id === 'plate_01');
    expect(
      firstPlate !== undefined &&
        firstPlate.stable &&
        firstPlate.z < 150 &&
        firstPlate.location === 'lower_rack' &&
        firstPlate.touching.some((part) => part.includes('tine_row')),
      `one click stood the plate between the tines on the floor of the basket, stable (${JSON.stringify(firstPlate)})`,
    );
    await screenshot(
      page,
      'plate-settled',
      'plate_01 after the click: standing between the tines of rows R1 and R2, leaning on them by itself; feedback on the right',
    );

    // --- The same by dragging from the list ---------------------------------------------------
    await trayTab(page, 'counter');
    const second = await (await page.$('.tray-item[data-item-id="plate_02"]'))?.boundingBox();
    if (second === null || second === undefined) throw new Error('plate_02 is not in the list');
    const target = await pixelOf(page, 'lower_rack', [67, 370, 140]);
    await page.mouse.move(second.x + 40, second.y + 20);
    await page.mouse.down();
    await page.mouse.move(second.x + 120, second.y + 30, { steps: 3 });
    await page.mouse.move(target.px - 30, target.py - 20, { steps: 6 });
    await page.mouse.move(target.px, target.py, { steps: 4 });
    await sleep(350);
    await caughtUp(page);
    const dragged = await debug(page);
    expect(
      dragged.held !== null && dragged.hand?.snapped !== null,
      `a piece dragged from the list follows the cursor into the machine (${dragged.hand?.snapped})`,
    );
    await screenshot(
      page,
      'drag-from-list',
      'plate_02 dragged from the list into the machine with the button held: over a gap of the same rows',
    );
    await page.mouse.up();
    await caughtUp(page);
    const secondPlate = (await debug(page)).items.find((item) => item.id === 'plate_02');
    expect(
      secondPlate !== undefined && secondPlate.stable && secondPlate.z < 150,
      `letting go put the second plate down like the first (${JSON.stringify(secondPlate)})`,
    );

    // --- A bowl in the plan view: it lands where the cursor is --------------------------------
    await view(page, 'top_lower');
    await pickUp(page, 'bowl_01');
    expect((await debug(page)).held?.preset === 'inverted', 'a bowl is picked up upside down');
    const bowlAt = await pointAt(page, 'lower_rack', [420, 270, 0]);
    const bowlGhost = (await debug(page)).held;
    expect(
      bowlGhost !== null &&
        Math.abs(bowlGhost.position_mm[0] - 420) <= 1 &&
        Math.abs(bowlGhost.position_mm[1] - 270) <= 1,
      `in the plan view the piece is under the cursor (${bowlGhost?.position_mm.join(', ')})`,
    );
    const bowlTint = await previewTint(page);
    await screenshot(
      page,
      'top-view-bowl',
      `plan view of the lower basket with both plates in their gaps and bowl_01 upside down under the cursor at (420, 270) mm (${bowlTint})`,
    );
    const beforeBowl = (await debug(page)).placed;
    await page.mouse.click(bowlAt.px, bowlAt.py);
    await caughtUp(page);
    expect(
      (await debug(page)).placed === beforeBowl + 1,
      'a click on the canvas put the bowl down',
    );

    // --- Reloading the page comes back to the same session ----------------------------------
    await page.reload({ waitUntil: 'networkidle0' });
    await started();
    expect((await debug(page)).placed === 3, 'a reload resumes the session with its three items');

    // --- A collision, shown and refused: a pose typed in the exact panel -----------------------
    await view(page, 'iso_lower');
    await pickUp(page, 'glass_01');
    expect((await debug(page)).held?.preset === 'inverted', 'a glass is picked up upside down');
    const bowlPose = await placedPose(page, 'bowl_01');
    await typePose(page, {
      preset: 'upright',
      x: Math.round(bowlPose?.position_mm[0] ?? 420),
      y: Math.round(bowlPose?.position_mm[1] ?? 270),
      z: Math.round(bowlPose?.position_mm[2] ?? 60),
    });
    expect((await debug(page)).hand?.exact === true, 'a typed pose holds the piece exactly');
    const collideTint = await previewTint(page);
    expect(
      collideTint === 'collision',
      `a pose inside the bowl is tinted as a collision (${collideTint})`,
    );
    await page.click('#place');
    await caughtUp(page);
    await page.$eval('#hand', (el) => el.scrollIntoView());
    await screenshot(
      page,
      'collision-refused',
      'glass_01 held by a typed pose where the bowl already is (the exact pose panel unfolded): red, the preview names what it overlaps, and the drop is refused at no cost',
    );
    await page.keyboard.press('Escape');
    expect(
      (await debug(page)).held === null,
      'Escape puts a piece from the counter back on the counter',
    );

    // --- The rim: shown amber, not put down, nothing charged ----------------------------------
    await pickUp(page, 'glass_02');
    const rim = await pointAt(page, 'lower_rack', [505, 110, 40]);
    await aimSettled(page);
    let onRim = await debug(page);
    expect(
      onRim.tint === 'unreachable' &&
        ['on_rim', 'outside', 'on_handle'].includes(onRim.hand?.landing ?? ''),
      `pointed at the right-hand rim the glass is amber: it would fall out (${onRim.tint}, ${onRim.hand?.landing}, shown ${JSON.stringify(onRim.hand?.shown_mm)})`,
    );
    const actionsBefore = await page.$eval('#topbar', (el) => el.textContent ?? '');
    await page.$eval('#hand', (el) => el.scrollIntoView());
    await screenshot(
      page,
      'rim-not-put-down',
      'glass_02 pointed at the right-hand rim of the lower basket: amber, the panel says it would be let go on the rim and fall out',
    );
    await page.mouse.click(rim.px, rim.py);
    await caughtUp(page);
    onRim = await debug(page);
    expect(
      onRim.held !== null &&
        onRim.placed === 3 &&
        (await page.$eval('#topbar', (el) => el.textContent ?? '')) === actionsBefore,
      'a click there does not put it down, and no action is charged',
    );
    expect(
      /still in your hand/.test(await page.$eval('#feedback', (el) => el.textContent ?? '')),
      'the page says the piece is still in the hand, and why',
    );
    // Over tine tips or another piece it is yellow: free, but let go above the floor of the
    // basket. (The plate above was green in its row.) A click still puts it down.
    let perchedSeen: readonly [number, number, number] | null = null;
    for (const at of [
      [470, 280, 40],
      [420, 400, 40],
      [110, 400, 40],
    ] as const) {
      await pointAt(page, 'lower_rack', at);
      await aimSettled(page);
      const there = await debug(page);
      if (there.tint === 'perched' && there.hand?.landing === 'perched') {
        perchedSeen = at;
        break;
      }
    }
    expect(
      perchedSeen !== null,
      `over tine tips or another piece the glass is yellow (${JSON.stringify(perchedSeen)})`,
    );
    await page.$eval('#hand', (el) => el.scrollIntoView());
    await screenshot(
      page,
      'perched-yellow',
      'glass_02 over the upturned bowl in the lower basket: yellow, free but let go above the floor of the basket, where it may tip; a click still puts it down',
    );
    const putAt = await pointAt(page, 'lower_rack', perchedSeen ?? [470, 280, 40]);
    await aimSettled(page);
    await page.mouse.click(putAt.px, putAt.py);
    await caughtUp(page);
    expect((await debug(page)).placed === 4, 'a click puts the glass down there all the same');
    // Z takes the piece put down last back into the hand, held as it was.
    await page.keyboard.press('KeyZ');
    await caughtUp(page);
    const back = await debug(page);
    expect(
      back.placed === 3 && back.held !== null && back.held.preset === 'inverted',
      `Z takes the piece put down last back into the hand as it was held (${back.placed} placed, ${back.held?.preset})`,
    );
    await page.keyboard.press('Backspace');
    await caughtUp(page);
    expect((await debug(page)).held === null, 'Backspace sends it to the counter');

    // --- Cutlery: a fork pointed into a cell, a knife by the insert gesture --------------------
    await view(page, 'top_cutlery');
    await pickUp(page, 'fork_01');
    expect((await debug(page)).held?.preset === 'handle_down', 'a fork is picked up handle down');
    const cell = await pointAt(page, 'cutlery_basket', [25, 34, 100]);
    expect(
      (await debug(page)).held?.frame === 'cutlery_basket',
      `over the cutlery basket the piece is in the cutlery basket (${(await debug(page)).held?.frame})`,
    );
    await previewTint(page);
    const beforeFork = (await debug(page)).placed;
    await page.mouse.click(cell.px, cell.py);
    await caughtUp(page);
    const fork = await placedPose(page, 'fork_01');
    expect(
      (await debug(page)).placed === beforeFork + 1 &&
        fork !== null &&
        fork.location === 'lower_rack' &&
        fork.stable,
      `a click stood the fork in a cell of the cutlery basket (${JSON.stringify(fork)})`,
    );

    await view(page, 'iso_lower');
    await pickUp(page, 'knife_01');
    await typePose(page, {
      frame: 'cutlery_basket',
      preset: 'handle_down',
      x: 108,
      y: 28,
      z: 240,
      roll: 5,
    });
    await previewTint(page);
    const beforeKnife = (await debug(page)).placed;
    const c = await canvasBox(page);
    await page.mouse.move(c.x + c.w * 0.5, c.y + c.h * 0.3);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(c.x + c.w * 0.5, c.y + c.h * 0.3 + 90, { steps: 6 });
    await caughtUp(page);
    await screenshot(
      page,
      'insert-arrow',
      'the insert gesture: knife_01 held handle down over the cutlery basket, right button dragged downwards, blue arrow along the push',
    );
    await page.mouse.up({ button: 'right' });
    await caughtUp(page);
    expect((await debug(page)).placed === beforeKnife + 1, 'the insert gesture placed the knife');
    await screenshot(
      page,
      'cutlery-placed',
      'fork and knife standing in cells of the cutlery basket',
    );

    // --- Moving a placed piece: one click picks it up as it stands, one puts it down -----------
    await view(page, 'top_lower');
    const bowlBefore = await placedPose(page, 'bowl_01');
    if (bowlBefore === null) throw new Error('the bowl is not in the machine');
    const grab = await pixelOf(page, 'lower_rack', bowlBefore.position_mm);
    const beforePick = await debug(page);
    await page.mouse.move(grab.px, grab.py);
    await page.mouse.click(grab.px, grab.py);
    await caughtUp(page);
    const inHand = await debug(page);
    expect(
      inHand.placed === beforePick.placed - 1 &&
        inHand.held !== null &&
        inHand.hand?.fromMachine === true,
      'one click on a piece in the machine picks it up',
    );
    expect(
      inHand.held?.quat_wxyz !== undefined &&
        inHand.held !== null &&
        Math.abs(inHand.held.position_mm[0] - bowlBefore.position_mm[0]) <= 1 &&
        Math.abs(inHand.held.position_mm[1] - bowlBefore.position_mm[1]) <= 1,
      `it is held as it stood, where it was (${inHand.held?.position_mm.join(', ')} of ${bowlBefore.position_mm.join(', ')})`,
    );
    // It follows the cursor at once: ten centimetres towards the back.
    const moved = await pixelOf(page, 'lower_rack', [
      bowlBefore.position_mm[0],
      bowlBefore.position_mm[1] + 100,
      bowlBefore.position_mm[2],
    ]);
    await page.mouse.move(moved.px, moved.py, { steps: 6 });
    await sleep(350);
    await caughtUp(page);
    const carried = (await debug(page)).held;
    expect(
      carried !== null && Math.abs(carried.position_mm[1] - (bowlBefore.position_mm[1] + 100)) <= 3,
      `it follows the cursor from where it was (y ${carried?.position_mm[1]} for ${Math.round(bowlBefore.position_mm[1] + 100)})`,
    );
    await screenshot(
      page,
      'held-as-it-stood',
      'bowl_01 picked up in the machine with one click and carried ten centimetres towards the back: held as it stood, drawn where it would be let go',
    );
    // Escape puts it back where it was.
    await page.keyboard.press('Escape');
    await caughtUp(page);
    const bowlBack = await placedPose(page, 'bowl_01');
    expect(
      bowlBack !== null &&
        Math.hypot(
          bowlBack.position_mm[0] - bowlBefore.position_mm[0],
          bowlBack.position_mm[1] - bowlBefore.position_mm[1],
        ) <= 5 &&
        (await debug(page)).held === null,
      `Escape puts it back where it was (${bowlBack?.position_mm.map((v) => Math.round(v)).join(', ')} of ${bowlBefore.position_mm.map((v) => Math.round(v)).join(', ')})`,
    );
    // Picked up again and put down ten centimetres away: two clicks.
    const again = await pixelOf(page, 'lower_rack', (bowlBack ?? bowlBefore).position_mm);
    await page.mouse.click(again.px, again.py);
    await caughtUp(page);
    const there = await pixelOf(page, 'lower_rack', [
      (bowlBack ?? bowlBefore).position_mm[0],
      (bowlBack ?? bowlBefore).position_mm[1] + 100,
      (bowlBack ?? bowlBefore).position_mm[2],
    ]);
    await page.mouse.move(there.px, there.py, { steps: 6 });
    await sleep(350);
    await caughtUp(page);
    await page.mouse.click(there.px, there.py);
    await caughtUp(page);
    const bowlMoved = await placedPose(page, 'bowl_01');
    const travelled =
      bowlMoved === null ? NaN : bowlMoved.position_mm[1] - (bowlBack ?? bowlBefore).position_mm[1];
    expect(
      bowlMoved !== null && travelled > 70 && travelled < 130,
      `two clicks moved the bowl ten centimetres (${Math.round(travelled)} mm; ${JSON.stringify((await debug(page)).held)} ${await page.$eval('#hand-status', (el) => el.textContent ?? '').catch(() => '')} ${await page.$eval('#feedback', (el) => el.textContent ?? '').catch(() => '')})`,
    );
    // Backspace sends the piece in hand to the counter.
    const forBackspace = await pixelOf(page, 'lower_rack', bowlMoved?.position_mm ?? [0, 0, 0]);
    await page.mouse.click(forBackspace.px, forBackspace.py);
    await caughtUp(page);
    const placedWithout = (await debug(page)).placed;
    await page.keyboard.press('Backspace');
    await caughtUp(page);
    expect(
      (await debug(page)).held === null && (await debug(page)).placed === placedWithout,
      'Backspace sends the piece in hand back to the counter',
    );

    // So does a click on the counter.
    await pickUp(page, 'spoon_01');
    await page.click('#to-counter');
    await caughtUp(page);
    expect((await debug(page)).held === null, 'a click on the counter puts the piece in hand back');

    // --- Selecting without picking up; the pose as numbers ------------------------------------
    await view(page, 'iso_lower');
    await trayTab(page, 'machine');
    await page.click('.tray-item[data-item-id="plate_02"]');
    await page.waitForSelector('#take-out');
    await screenshot(
      page,
      'selected-item',
      'plate_02 selected from the list: highlighted in the machine, with its settled pose in the basket frame, stability and contacts',
    );
    const restingQuat = await page.$eval('#selected-pose', (el) => el.textContent ?? '');
    await page.click('#take-out-hold');
    await caughtUp(page);
    const asItStood = await debug(page);
    expect(
      asItStood.held?.quat_wxyz !== undefined &&
        restingQuat.includes(asItStood.held.quat_wxyz.map((q) => q.toFixed(4)).join(', ')),
      `the plate is held in the orientation it rested in (${JSON.stringify(asItStood.held?.quat_wxyz)} of "${restingQuat}")`,
    );
    // A quaternion can be typed, and choosing a stance afterwards goes back to preset and angles.
    await openExact(page);
    await page.click('#pose-quat', { clickCount: 3 });
    await page.keyboard.type('0.5, 0.5, 0.5, 0.5');
    await page.keyboard.press('Tab');
    await caughtUp(page);
    expect(
      JSON.stringify((await debug(page)).held?.quat_wxyz) === '[0.5,0.5,0.5,0.5]',
      `a typed quaternion is the orientation of the item in hand (${JSON.stringify((await debug(page)).held?.quat_wxyz)})`,
    );
    await page.$eval('#hand', (el) => el.scrollIntoView());
    await screenshot(
      page,
      'exact-pose',
      'the exact pose panel unfolded: frame, position, preset, angles, quaternion and release, as a program types them',
    );
    await page.click('#follow-mouse');
    await page.click('[data-stance="on_edge"]');
    await caughtUp(page);
    expect(
      (await debug(page)).held?.quat_wxyz === undefined &&
        (await debug(page)).hand?.exact === false,
      'ticking "follows the cursor" and choosing a stance gives the piece back to the hand',
    );

    // --- Suggested spots, marked in the machine ------------------------------------------------
    await pointAt(page, 'lower_rack', [330, 150, 135]);
    const queriesBefore = (await debug(page)).queries;
    await page.click('#suggest-spots');
    await page.waitForSelector('#suggestions-note');
    await caughtUp(page);
    const spots = await page.evaluate(() =>
      (
        window as unknown as {
          spotless: {
            debugSpots(): { index: number; x: number; y: number; free: boolean; label: string }[];
          };
        }
      ).spotless.debugSpots(),
    );
    expect(
      (await debug(page)).queries === queriesBefore + 1 && spots.length > 0,
      `"Suggest spots" costs one query and marks its places in the machine (${spots.length} marks)`,
    );
    const firstFree = spots.find((spot) => spot.free);
    if (firstFree === undefined) throw new Error('no free suggested spot');
    await page.mouse.move(firstFree.x - 40, firstFree.y - 30);
    await page.mouse.move(firstFree.x, firstFree.y, { steps: 5 });
    await sleep(350);
    await caughtUp(page);
    expect(
      (await debug(page)).hand?.spot === firstFree.index,
      `the piece takes up the spot under the cursor (${(await debug(page)).hand?.spot})`,
    );
    await screenshot(
      page,
      'suggested-spots',
      `"Suggest spots" for plate_02: ${spots.length} places marked in the lower basket, numbered best first, the plate held at spot ${firstFree.index + 1} under the cursor`,
    );
    const beforeSpot = (await debug(page)).placed;
    await page.mouse.click(firstFree.x, firstFree.y);
    await caughtUp(page);
    const spotted = (await debug(page)).items.find((item) => item.id === 'plate_02');
    expect(
      (await debug(page)).placed === beforeSpot + 1 && spotted !== undefined && spotted.stable,
      `a click on a mark put the plate there (${JSON.stringify(spotted)})`,
    );

    // --- Baskets ---------------------------------------------------------------------------------
    await setRack(page, 'lower_rack', 'position', 'in');
    await setRack(page, 'upper_rack', 'position', 'out');
    await view(page, 'iso_upper');
    await screenshot(
      page,
      'upper-basket-out',
      'lower basket pushed in with its load, upper basket pulled out',
    );
    await setRack(page, 'upper_rack', 'tine_row_c_front', 'folded');
    await setRack(page, 'upper_rack', 'shelf_cup_front', 'down');
    await view(page, 'top_upper');
    await screenshot(
      page,
      'upper-basket-options',
      'plan view of the upper basket with the front half of tine row C folded flat and the front cup shelf down',
    );
    await setRack(page, 'upper_rack', 'tine_row_c_front', 'up');
    await setRack(page, 'upper_rack', 'shelf_cup_front', 'up');

    // A mug and a glass, upside down, by pointing in the three-quarter view.
    await view(page, 'iso_upper');
    for (const [item, x, y] of [
      ['mug_01', 250, 380],
      ['glass_01', 160, 440],
    ] as const) {
      await pickUp(page, item);
      const at = await pointAt(page, 'upper_rack', [x, y, 50]);
      const held = (await debug(page)).held;
      expect(
        held?.frame === 'upper_rack' && held.preset === 'inverted',
        `${item} is over the upper basket, upside down (${held?.frame}, ${held?.preset})`,
      );
      await previewTint(page);
      // What is pointed at is where the piece is let go: its middle is under the cursor.
      const shownAt = (await debug(page)).hand?.shown_mm ?? null;
      const shownPx =
        shownAt === null
          ? null
          : await pixelOf(page, 'upper_rack', shownAt as unknown as [number, number, number]);
      const off = shownPx === null ? NaN : Math.hypot(shownPx.px - at.px, shownPx.py - at.py);
      expect(
        off < 12,
        `${item} is shown, and will be let go, under the cursor (${off.toFixed(1)} px away)`,
      );
      const before = (await debug(page)).placed;
      await page.mouse.click(at.px, at.py);
      await caughtUp(page);
      const rest = await placedPose(page, item);
      expect(
        (await debug(page)).placed === before + 1 &&
          rest !== null &&
          rest.location === 'upper_rack',
        `${item} was put down in the upper basket (${JSON.stringify(rest)})`,
      );
      console.log(
        `  ${item} let go at ${shownAt?.map((v) => Math.round(v)).join(', ')}, at rest at ${rest?.position_mm.map((v) => Math.round(v)).join(', ')} mm`,
      );
    }
    await page.keyboard.press('Escape');
    await caughtUp(page);
    await screenshot(
      page,
      'upper-basket-loaded',
      'mug and glass upside down in the upper basket, each put down with two clicks',
    );
    await setRack(page, 'upper_rack', 'height', '2');
    await setRack(page, 'upper_rack', 'position', 'in');

    // --- Elevations and the free camera ---------------------------------------------------------
    await view(page, 'front');
    await screenshot(
      page,
      'front-elevation',
      'front elevation, both baskets in, upper basket lowered to height 2',
    );
    await view(page, 'right');
    await screenshot(
      page,
      'side-elevation',
      'side elevation from the right with the near wall cut away',
    );
    await view(page, 'orbit');
    const o = await canvasBox(page);
    await page.mouse.move(o.x + o.w * 0.5, o.y + o.h * 0.5);
    await page.mouse.down();
    await page.mouse.move(o.x + o.w * 0.5 - 220, o.y + o.h * 0.5 - 40, { steps: 8 });
    await page.mouse.up();
    await caughtUp(page);
    expect(
      (await debug(page)).held === null,
      'dragging the empty stage turns the camera and picks nothing up',
    );
    await screenshot(
      page,
      'free-orbit',
      'free orbit camera dragged round to the left of the machine',
    );

    // --- Mechanical check: once with the upper basket lowered, once with it back up -------------
    await view(page, 'iso_lower');
    await page.click('#run-check');
    await caughtUp(page);
    await page.waitForSelector('#check-result');
    const lowBad = await page.$$eval('#check-result .line.bad', (els) =>
      els.map((el) => el.textContent ?? ''),
    );
    await page.$eval('#check', (el) => el.scrollIntoView());
    await screenshot(
      page,
      'mechanical-check-lowered',
      `the mechanical check with the upper basket at height 2 (${lowBad.length === 0 ? 'no problem found' : lowBad.join(' ')})`,
    );
    await setRack(page, 'upper_rack', 'height', '1');
    await page.click('#run-check');
    await caughtUp(page);
    const checkBad = await page.$$eval('#check-result:not(.stale) .line.bad', (els) =>
      els.map((el) => el.textContent ?? ''),
    );
    expect(
      checkBad.length === 0,
      `the mechanical check reports no problem (${checkBad.join(' ')})`,
    );
    await page.$eval('#check', (el) => el.scrollIntoView());
    await screenshot(
      page,
      'mechanical-check',
      'the mechanical check with the upper basket back at height 1, and the budgets at the top',
    );

    // --- The wash: Eco 50 only, and a choice between a quick preview and the full wash ---------
    const loadedNow = (await debug(page)).placed;
    expect(loadedNow === 6, `six of the twelve items are in the machine (${loadedNow})`);
    await page.$eval('#start-cycle', (el) => el.scrollIntoView());
    await page.click('#start-cycle');
    await page.waitForSelector('#confirm-start');
    const summary = await page.$eval('#start-summary', (el) => el.textContent ?? '');
    expect(
      summary.startsWith('6 of 12 items are in the machine'),
      `the confirmation counts what is loaded (${summary})`,
    );
    const title = await page.$eval('.modal h1', (el) => el.textContent ?? '');
    expect(title.includes('Eco 50'), `the wash is Eco 50 (${title})`);
    expect((await page.$('#programme-choice')) === null, 'no list of programmes is offered');
    await noOtherProgramme('the start of the wash');
    const washes = await page.$$eval('#wash-choice label.wash-option', (els) =>
      els.map((el) => ({
        tier: el.getAttribute('data-tier'),
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        checked: el.querySelector('input')?.checked === true,
      })),
    );
    expect(
      washes.length === 2 &&
        washes[0]?.tier === 'fast' &&
        /Quick preview, (under a minute|about a minute|a minute or so)/.test(washes[0].text) &&
        washes[1]?.tier === 'official' &&
        /Full wash, (about \d+ minutes|several minutes; not yet timed on this machine)/.test(
          washes[1].text,
        ) &&
        washes[1].text.includes('scored result'),
      `the player chooses between a quick preview and the full wash, each with its time (${washes.map((w) => w.text.slice(0, 60)).join(' | ')})`,
    );
    expect(washes[1]?.checked === true, 'the full wash is chosen unless the player says otherwise');
    await screenshot(
      page,
      'confirm-start',
      'the confirmation before the wash: what is loaded, and the choice between a quick preview and the full wash, in plain words with the expected time; Eco 50 is the only programme',
    );
    await page.click('#confirm-start');
    await page.waitForSelector('#wash-times', { timeout: 60_000 });
    await page.waitForFunction(
      () => /simulating for/.test(document.getElementById('wash-times')?.textContent ?? ''),
      { timeout: 60_000 },
    );
    const phase = await page.$eval('#wash-phase', (el) => el.textContent ?? '');
    const times = await page.$eval('#wash-times', (el) => el.textContent ?? '');
    // The placeholder reports a fraction and no stages: the page shows that and no more.
    expect(phase === 'Washing', `the wash is shown as running (${phase})`);
    expect(
      /simulating for \d+:\d\d/.test(times),
      `the wash shows the time it has taken (${times})`,
    );
    await noOtherProgramme('the wash in progress');
    await screenshot(
      page,
      'washing',
      `the wash in progress with a runner that reports no stages (${phase}; ${times}): the placeholder, slowed down by this script. The real wash is played by scripts/play-wash.ts`,
    );
    await page.waitForSelector('#report', { timeout: 120_000 });
    await caughtUp(page);
    expect(
      tiersAsked.at(-1) === 'official',
      `the server washed at the tier the page asked for (${tiersAsked.at(-1)})`,
    );
    await page.$eval('#cycle', (el) => el.scrollIntoView());
    const notice = await page.$('#not-simulated');
    const total = await page.$eval('#report-total', (el) => el.textContent ?? '');
    const rows = await page.$$eval('#report tbody tr', (els) => els.length);
    expect(rows === 12, `the report lists all twelve items of the level (${rows})`);
    expect(
      (await page.$('#run-full-wash')) === null,
      'after the full wash no further wash is offered',
    );
    await noOtherProgramme('the report');
    console.log(`report total: ${total}${notice === null ? '' : ' [marked as not simulated]'}`);
    await screenshot(
      page,
      'report',
      'the report: every item with its result and points, the total, and (with the placeholder runner) the notice that nothing was simulated',
    );
    expect((await debug(page)).phase === 'finished', 'the episode is finished');
    expect((await debug(page)).doorShut, 'the door is drawn shut once the cycle has started');
    await view(page, 'iso_lower');
    // No screenshot of its own: the report still covers the page, so the picture would be the
    // one before, byte for byte (it was `28-after-the-wash.png`, and the number stays unused).
    sameAsLast(
      '; behind it the machine after the cycle: door shut (cut away from the front), baskets in; with the placeholder runner the items keep the soil they had',
    );

    // --- A second go: a quick preview, then the full wash on the same load ---------------------
    await page.click('#levels');
    await page.click('.level[data-level-id="tutorial"]');
    await page.waitForFunction(
      () => {
        const s = (
          window as unknown as { spotless: { debugState(): DebugState } }
        ).spotless.debugState();
        return s.phase === 'loading' && s.placed === 0 && s.thumbnails === 12;
      },
      { timeout: 60_000 },
    );
    await caughtUp(page);
    await view(page, 'top_lower');
    await pickUp(page, 'bowl_01');
    const bowl2 = await pointAt(page, 'lower_rack', [420, 270, 0]);
    await previewTint(page);
    await page.mouse.click(bowl2.px, bowl2.py);
    await caughtUp(page);
    expect(
      (await debug(page)).placed === 1,
      'a new session of the same level starts empty, and a first bowl is placed',
    );
    await view(page, 'iso_lower');
    await screenshot(
      page,
      'new-session',
      'a new session of the same level from the Levels menu: empty machine again, and a first bowl placed',
    );

    // --- An item that falls through the basket onto the door is not loaded -------------------
    await pickUp(page, 'fork_01');
    await typePose(page, { frame: 'lower_rack', preset: 'handle_down', x: 130, y: 250, z: 100 });
    await previewTint(page);
    await drop(page);
    const fallen = (await debug(page)).items.find((item) => item.id === 'fork_01');
    expect(
      fallen?.location === 'outside' && fallen.touching.includes('door.liner'),
      `a fork dropped handle first falls through the basket onto the door (${JSON.stringify(fallen)})`,
    );
    await trayTab(page, 'machine');
    const label = await page.$eval(
      '.tray-item[data-item-id="fork_01"] .where',
      (el) => el.textContent ?? '',
    );
    expect(
      /will not be washed/.test(label),
      `the tray says the fork will not be washed (${label})`,
    );
    const trayText = await page.$eval('.tray-summary', (el) => el.textContent ?? '');
    expect(
      /1 in the machine \(8 of 64 points\), 1 on the door/.test(trayText),
      `the fork's points are not counted as loaded (${trayText})`,
    );
    await page.$eval('#start-cycle', (el) => el.scrollIntoView());
    await page.click('#start-cycle');
    await page.waitForSelector('#start-outside');
    const warning = await page.$eval('#start-outside', (el) => el.textContent ?? '');
    expect(
      warning.includes('fork_01') && warning.includes('left out of the wash'),
      `the confirmation names what will be left out (${warning})`,
    );
    await screenshot(
      page,
      'on-the-door',
      'a fork that fell through the basket onto the door: labelled in the tray as not going to be washed, left out of the points in the machine, and named in the confirmation before the start',
    );
    // The quick preview.
    await page.click('#wash-choice label.wash-option[data-tier="fast"] input');
    const startText = await page.$eval('#confirm-start', (el) => el.textContent ?? '');
    expect(
      startText === 'Start the preview',
      `choosing the preview says so on the button (${startText})`,
    );
    const previewed = (await page.evaluate(() => location.hash)).slice(1);
    await page.click('#confirm-start');
    await page.waitForSelector('#report', { timeout: 120_000 });
    await caughtUp(page);
    expect(
      tiersAsked.at(-1) === 'fast',
      `the server ran the preview the page asked for (${tiersAsked.at(-1)})`,
    );
    await page.$eval('#cycle', (el) => el.scrollIntoView());
    const previewLabel = await page.$eval('#report-label', (el) => el.textContent ?? '');
    expect(
      previewLabel.startsWith('Quick preview') && previewLabel.includes('not the scored result'),
      `the report of a preview says what it is (${previewLabel.slice(0, 90)})`,
    );
    const offer = await page.$eval('#run-full-wash', (el) => el.textContent ?? '');
    expect(
      /^Run the full wash on this load \((about (a minute|\d+ minutes)|several minutes; not yet timed on this machine)\)$/.test(
        offer,
      ),
      `and offers the full wash on the same load with its time (${offer})`,
    );
    await screenshot(
      page,
      'preview-report',
      'the report of a quick preview: labelled as one, with the button that runs the full wash on the same load (with the placeholder runner: the notice says that nothing was simulated)',
    );
    const previewedItems = (await debug(page)).placed;
    const hashBefore = await page.evaluate(
      () =>
        (window as unknown as { spotless: { view: { state: { state_hash: string } } } }).spotless
          .view.state.state_hash,
    );
    await page.click('#run-full-wash');
    await page.waitForFunction(
      (old) => location.hash.slice(1) !== old && location.hash.length > 10,
      { timeout: 120_000 },
      previewed,
    );
    await page.waitForSelector('#report', { timeout: 120_000 });
    await caughtUp(page);
    const full = await debug(page);
    const hashAfter = await page.evaluate(
      () =>
        (window as unknown as { spotless: { view: { state: { state_hash: string } } } }).spotless
          .view.state.state_hash,
    );
    expect(
      tiersAsked.at(-1) === 'official',
      `the full wash ran at the official tier (${tiersAsked.at(-1)})`,
    );
    expect(
      full.hasReport && full.placed === previewedItems && hashAfter === hashBefore,
      `on the same load: the same scene, in a session of its own (${full.placed} items, hash ${hashAfter === hashBefore ? 'equal' : 'different'})`,
    );
    expect(
      (await page.$('#report-label')) === null,
      'the report of the full wash is not labelled a preview',
    );
    await page.$eval('#cycle', (el) => el.scrollIntoView());
    await screenshot(
      page,
      'full-wash-report',
      'the report of the full wash that followed the preview: the same load, set up again by the same moves in a new game of the level (with the placeholder runner: the notice says that nothing was simulated)',
    );
  } catch (error) {
    problems.push(`the script stopped: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    await page
      .screenshot({ path: join(outDir, 'zz-failure.png') as `${string}.png` })
      .catch(() => {});
  } finally {
    if (!process.argv.includes('--keep-open')) await browser.close();
    await server.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
  writeFileSync(join(outDir, 'captions.txt'), `${captions.join('\n')}\n`);
  for (const error of consoleErrors) console.error(`console error: ${error}`);
  expect(consoleErrors.length === 0, `no errors on the page's console (${consoleErrors.length})`);
  console.log(problems.length === 0 ? 'OK' : `${problems.length} problem(s)`);
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = await main();
