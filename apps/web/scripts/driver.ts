/**
 * What the scripts that play the game through the page share: reading the page's own account
 * of itself, waiting until it has caught up, typing poses, picking up and dropping, moving
 * baskets, choosing views, and numbered screenshots with captions.
 *
 * A script drives the page with the mouse and the keyboard only; it reads
 * `window.spotless.debugState()` to know when the page has caught up and never calls the game's
 * API itself.
 */

import { join } from 'node:path';
import { chromeFlags, resolveChrome } from '@spotless/render/headless';
import type { Browser, Page } from 'puppeteer-core';
import { launch } from 'puppeteer-core';

/**
 * Starts headless Chrome with WebGL on the GPU, as the screenshots need it.
 *
 * The browser is the one the render service runs: the program the environment variable
 * `SPOTLESS_CHROME` names, or the first Chrome or Chromium in the usual places of macOS, Linux
 * and Windows; without one it throws an error that names the variable. The shared flags ask
 * for Metal on macOS only and mute the sound (the page has music, and a headless browser plays
 * it aloud on the machine it runs on). Run on macOS only so far: Linux and Windows are not
 * tested.
 */
export function launchChrome(): Promise<Browser> {
  return launch({
    executablePath: resolveChrome(),
    headless: true,
    args: ['--window-size=1680,1050', ...chromeFlags()],
    defaultViewport: { width: 1680, height: 1050, deviceScaleFactor: 1 },
  });
}

/** What the page tells a script about itself (`window.spotless.debugState()`). */
export interface DebugState {
  pending: number;
  animating: boolean;
  held: {
    frame: string;
    position_mm: [number, number, number];
    preset: string;
    yaw_deg?: number;
    quat_wxyz?: [number, number, number, number];
  } | null;
  /** How the piece in hand is held (pages with the pointing controls). */
  hand?: {
    exact: boolean;
    snapped: string | null;
    spot: number | null;
    fromMachine: boolean;
    shown_mm: number[] | null;
    /** True once the game has answered for the place under the cursor (newer pages). */
    settled?: boolean;
    /** Where it would be let go when the page judges that: 'seated', 'perched', 'on_rim'… */
    landing?: string | null;
  } | null;
  spots?: number;
  tint: string | null;
  phase: string | null;
  placed: number;
  thumbnails: number;
  hasReport: boolean;
  view: string;
  queries: number;
  items: { id: string; stable: boolean; location: string; z: number; touching: string[] }[];
  doorShut: boolean;
  wash: { status: string; progress: number; stage: string | null } | null;
  residuePainted: string[];
  inspecting: string | null;
}

export async function debug(page: Page): Promise<DebugState> {
  return page.evaluate(() =>
    (window as unknown as { spotless: { debugState(): DebugState } }).spotless.debugState(),
  );
}

/** Waits. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until no call is in flight and no animation is playing, then for two frames. */
export async function caughtUp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const s = (
        window as unknown as { spotless: { debugState(): DebugState } }
      ).spotless.debugState();
      return s.pending === 0 && !s.animating;
    },
    { timeout: 120_000, polling: 50 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** Unfolds the exact pose panel of the piece in hand, where the pose is typed. */
export async function openExact(page: Page): Promise<void> {
  const panel = await page.$('#exact-pose');
  if (panel === null) return;
  const open = await page.$eval('#exact-pose', (el) => (el as HTMLDetailsElement).open);
  if (!open) await page.click('#exact-pose > summary');
  await page.waitForFunction(
    () => (document.getElementById('exact-pose') as HTMLDetailsElement | null)?.open === true,
  );
}

/** Types a value into a field of the pose panel and commits it. */
export async function typeField(page: Page, id: string, value: number): Promise<void> {
  const selector = `#${id}`;
  // The panel may still be laying itself out after it was drawn again: click until the field
  // has the focus.
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.click(selector, { clickCount: 3 });
    if (await page.evaluate((id) => document.activeElement?.id === id, id)) break;
    await sleep(80);
  }
  await page.keyboard.type(String(value));
  await page.keyboard.press('Tab');
}

/** Sets the pose of the item in hand by typing into the panel. */
export async function typePose(
  page: Page,
  pose: {
    frame?: string;
    preset: string;
    x: number;
    y: number;
    z: number;
    yaw?: number;
    pitch?: number;
    roll?: number;
  },
): Promise<void> {
  await openExact(page);
  if (pose.frame !== undefined) await page.select('#pose-frame', pose.frame);
  await page.select('#pose-preset', pose.preset);
  await typeField(page, 'pose-x', pose.x);
  await typeField(page, 'pose-y', pose.y);
  await typeField(page, 'pose-z', pose.z);
  await typeField(page, 'pose-yaw', pose.yaw ?? 0);
  await typeField(page, 'pose-pitch', pose.pitch ?? 0);
  await typeField(page, 'pose-roll', pose.roll ?? 0);
}

/** Waits for the server's verdict on the pose of the ghost and returns the tint. */
export async function previewTint(page: Page): Promise<string | null> {
  await page.waitForFunction(
    () =>
      (window as unknown as { spotless: { debugState(): DebugState } }).spotless.debugState()
        .tint !== 'unknown',
    { timeout: 20_000, polling: 50 },
  );
  await caughtUp(page);
  return (await debug(page)).tint;
}

/**
 * Waits until the page has settled where the piece in hand would be let go for the place under
 * the cursor: its own `hand.settled`, or, for a page that does not say, a tint that is known
 * and a place that has stopped moving. Returns the milliseconds waited.
 */
export async function aimSettled(page: Page, max = 5000): Promise<number> {
  const t0 = Date.now();
  let last = '';
  let same = 0;
  while (Date.now() - t0 < max) {
    const s = await debug(page);
    if (s.hand === null || s.hand === undefined) break;
    if (s.hand.settled === true && s.pending === 0) break;
    if (s.hand.settled === undefined) {
      const signature = `${s.tint}${JSON.stringify(s.hand.shown_mm)}`;
      if (s.tint !== 'unknown' && s.pending === 0 && signature === last) {
        same += 1;
        if (same >= 4) break;
      } else same = 0;
      last = signature;
    }
    await sleep(50);
  }
  return Date.now() - t0;
}

/** Shows one of the two lists of the tray. */
export async function trayTab(page: Page, tab: 'counter' | 'machine'): Promise<void> {
  const button = await page.$(`button[data-tray-tab="${tab}"]`);
  if (button !== null) await button.click();
  await page.waitForSelector(`.tray-list[data-tray="${tab}"]`);
}

export async function pickUp(page: Page, itemId: string): Promise<void> {
  await trayTab(page, 'counter');
  await page.click(`.tray-item[data-item-id="${itemId}"]`);
  await page.waitForSelector('#place');
}

/** The counters a script keeps of what a person would have pressed. */
export interface Gestures {
  clicks: number;
  keys: number;
}

/**
 * Where a point of a frame (millimetres) is on the page, as the page draws it: for pointing
 * the mouse at a place of a basket.
 */
export async function pixelOf(
  page: Page,
  frame: string,
  point: readonly [number, number, number],
): Promise<{ px: number; py: number }> {
  return page.evaluate(
    (frame, point) => {
      const app = (
        window as unknown as {
          spotless: {
            shownParts: { [id: string]: { position_mm: number[]; quat_wxyz: number[] } };
            stage: { project(point: readonly number[]): [number, number] };
          };
        }
      ).spotless;
      const pose = app.shownParts[frame] ?? { position_mm: [0, 0, 0], quat_wxyz: [1, 0, 0, 0] };
      const [w, qx, qy, qz] = pose.quat_wxyz as [number, number, number, number];
      const [x, y, z] = point as [number, number, number];
      const cx = qy * z - qz * y + w * x;
      const cy = qz * x - qx * z + w * y;
      const cz = qx * y - qy * x + w * z;
      const [px, py] = app.stage.project([
        (pose.position_mm[0] as number) + x + 2 * (qy * cz - qz * cy),
        (pose.position_mm[1] as number) + y + 2 * (qz * cx - qx * cz),
        (pose.position_mm[2] as number) + z + 2 * (qx * cy - qy * cx),
      ]);
      return { px, py };
    },
    frame,
    point as [number, number, number],
  );
}

/** Where a piece in the machine stands: frame, position of its reference point, quaternion. */
export async function placedPose(
  page: Page,
  itemId: string,
): Promise<{
  frame: string;
  position_mm: [number, number, number];
  stable: boolean;
  location: string;
} | null> {
  return page.evaluate((itemId) => {
    const app = (
      window as unknown as {
        spotless: {
          view: {
            state: {
              placed: {
                item_id: string;
                frame: string;
                position_mm: [number, number, number];
                stable: boolean;
                location: string;
              }[];
            };
          };
        };
      }
    ).spotless;
    const placed = app.view.state.placed.find((p) => p.item_id === itemId);
    return placed === undefined
      ? null
      : {
          frame: placed.frame,
          position_mm: placed.position_mm,
          stable: placed.stable,
          location: placed.location,
        };
  }, itemId);
}

/**
 * Moves the mouse to a point of a frame the way a hand arrives there, and waits until the page
 * has asked the game where the piece would be let go.
 */
export async function pointAt(
  page: Page,
  frame: string,
  point: readonly [number, number, number],
): Promise<{ px: number; py: number }> {
  const at = await pixelOf(page, frame, point);
  await page.mouse.move(at.px - 50, at.py - 35);
  await page.mouse.move(at.px, at.py, { steps: 5 });
  await sleep(120);
  await aimSettled(page);
  await caughtUp(page);
  return at;
}

export async function view(page: Page, name: string): Promise<void> {
  await page.click(`button[data-view="${name}"]`);
  await caughtUp(page);
}

export async function canvasBox(
  page: Page,
): Promise<{ x: number; y: number; w: number; h: number }> {
  const box = await (await page.$('#view'))?.boundingBox();
  if (box === null || box === undefined) throw new Error('no canvas');
  return { x: box.x, y: box.y, w: box.width, h: box.height };
}

/**
 * Moves the mouse over the canvas until the ghost is at (x, y) of its frame, by looking at
 * where the ghost goes: three probes give the mapping from pixels to millimetres, which is
 * linear in a plan view, and two corrections take out what is left.
 */
export async function mouseGhostTo(
  page: Page,
  x: number,
  y: number,
): Promise<{ px: number; py: number }> {
  const box = await canvasBox(page);
  const at = async (px: number, py: number): Promise<[number, number]> => {
    await page.mouse.move(px, py);
    await sleep(40);
    const held = (await debug(page)).held;
    if (held === null) throw new Error('nothing in hand');
    return [held.position_mm[0], held.position_mm[1]];
  };
  let px = box.x + box.w / 2;
  let py = box.y + box.h / 2;
  const p0 = await at(px, py);
  const p1 = await at(px + 60, py);
  const p2 = await at(px, py + 60);
  // Millimetres per pixel along the two screen axes.
  const a = [(p1[0] - p0[0]) / 60, (p1[1] - p0[1]) / 60];
  const b = [(p2[0] - p0[0]) / 60, (p2[1] - p0[1]) / 60];
  const det = (a[0] as number) * (b[1] as number) - (b[0] as number) * (a[1] as number);
  let here = p0;
  for (let i = 0; i < 4; i++) {
    const dx = x - here[0];
    const dy = y - here[1];
    px += (dx * (b[1] as number) - dy * (b[0] as number)) / det;
    py += (dy * (a[0] as number) - dx * (a[1] as number)) / det;
    here = await at(px, py);
    if (Math.abs(here[0] - x) <= 1 && Math.abs(here[1] - y) <= 1) break;
  }
  return { px, py };
}

/** The checks and the screenshots of one run of a script. */
export interface Run {
  /** The checks that did not hold, in words. */
  readonly problems: string[];
  /** One line per screenshot: file name and what it shows. */
  readonly captions: string[];
  /** Records a check; a check that does not hold is printed and kept. */
  expect(condition: boolean, what: string): void;
  /** Saves a numbered screenshot of the page with a caption. */
  screenshot(page: Page, name: string, what: string): Promise<void>;
  /**
   * For a moment at which the page shows the same picture as the screenshot before: takes
   * none, adds `what` to that screenshot's caption and leaves its number out, so that the
   * numbers of the screenshots after it stay what they were.
   */
  sameAsLast(what: string): void;
  /** Clicks Drop and checks that the item in hand is now in the machine. */
  drop(page: Page): Promise<void>;
  /** Sets a rack option with its button and checks that it took. */
  setRack(page: Page, rack: string, option: string, value: string): Promise<void>;
}

/** A run that writes its screenshots into `outDir`. */
export function createRun(outDir: string): Run {
  const problems: string[] = [];
  const captions: string[] = [];
  let shot = 0;
  const expect = (condition: boolean, what: string): void => {
    if (!condition) {
      problems.push(what);
      console.error(`  FAILED: ${what}`);
    }
  };
  return {
    problems,
    captions,
    expect,
    async screenshot(page, name, what) {
      shot += 1;
      const file = `${String(shot).padStart(2, '0')}-${name}.png`;
      await page.screenshot({ path: join(outDir, file) as `${string}.png` });
      captions.push(`${file}: ${what}`);
      console.log(`${file}: ${what}`);
    },
    sameAsLast(what) {
      shot += 1;
      const last = captions.length - 1;
      if (last >= 0) captions[last] = `${captions[last]}${what}`;
      console.log(
        `(no screenshot ${String(shot).padStart(2, '0')}: the page shows the one before)${what}`,
      );
    },
    async drop(page) {
      const before = (await debug(page)).placed;
      await page.click('#place');
      await caughtUp(page);
      const after = await debug(page);
      expect(
        after.placed === before + 1,
        `the drop was accepted (placed ${before} -> ${after.placed})`,
      );
    },
    async setRack(page, rack, option, value) {
      const selector = `button[data-rack="${rack}"][data-option="${option}"][data-value="${value}"]`;
      await page.click(selector);
      await caughtUp(page);
      const active = await page.$eval(selector, (el) => el.classList.contains('active'));
      expect(active, `${rack} ${option} is now ${value}`);
    },
  };
}
