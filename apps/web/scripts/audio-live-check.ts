/**
 * Plays the sound of the page for real, in headless Chrome against a game server of its own,
 * with the mouse only, and checks what the page says about it.
 *
 *   pnpm --filter @spotless/web exec vite build
 *   pnpm --filter @spotless/web exec tsx scripts/audio-live-check.ts [--out <directory for pictures>]
 *
 * What it checks: nothing plays and no audio context exists before the first click; the first
 * click starts the opening piece; choosing a level changes to the music of play and the opening
 * piece's element is given back; the control stays at the right of the top bar through the
 * page's redraws; music off stops every element and on starts them again; the settings are
 * remembered over a reload; and what the audio costs the page's main thread over ten seconds.
 * It cannot hear: that the right sound comes out is the offline check's business
 * (`audio-mix-check.ts`).
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildServer } from '@spotless/server';
import { placeholderWashRunner } from '@spotless/session';
import type { Page } from 'puppeteer-core';
import type { AudioDebug } from '../src/audio/index.ts';
import { launchChrome, sleep } from './driver.ts';

const { values } = parseArgs({ options: { out: { type: 'string' } } });
const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = values.out ?? join(here, '..', 'screenshots', 'audio');
mkdirSync(outDir, { recursive: true });

type State = ReturnType<AudioDebug['state']>;
const state = (page: Page): Promise<State> =>
  page.evaluate(() => (window as unknown as { spotlessAudio: AudioDebug }).spotlessAudio.state());
const until = async (
  page: Page,
  what: string,
  test: (s: State) => boolean,
  ms = 20_000,
): Promise<State> => {
  for (let i = 0; i < ms / 250; i++) {
    const s = await state(page);
    if (test(s)) return s;
    await sleep(250);
  }
  throw new Error(
    `audio-live-check: timed out waiting until ${what}: ${JSON.stringify(await state(page))}`,
  );
};

let failed = false;
const check = (ok: boolean, text: string): void => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${text}`);
  if (!ok) failed = true;
};

const dataDir = mkdtempSync(join(tmpdir(), 'spotless-audio-'));
const server = await buildServer({
  dataDir,
  staticDir: join(here, '..', 'dist'),
  washRunner: placeholderWashRunner,
  washRunnerVersion: 'placeholder',
});
await server.app.listen({ port: 0, host: '127.0.0.1' });
const url = `http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}/`;
const browser = await launchChrome();
const errors: string[] = [];

try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#modal-root .level');
  await page.waitForSelector('#topbar #sound-control');
  await sleep(600);

  let s = await state(page);
  check(!s.unlocked && s.context === null, 'before any click there is no audio context');
  check(s.wanted === 'menu', `the list of levels asks for its own music (wanted: ${s.wanted})`);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/audio/')) requests.push(request.url().split('/audio/')[1] ?? '');
  });

  // The first click of the visit is on the sound button itself.
  await page.click('#sound-control');
  s = await until(
    page,
    'the opening piece plays',
    (x) => x.playing !== null && x.elements.some((e) => !e.paused && e.seconds > 0.3),
  );
  check(s.context === 'running', `the first click starts the audio (context ${s.context})`);
  check(
    s.scene === 'menu' && s.playing === 'first-light-particles',
    `the opening piece plays (${s.playing})`,
  );
  check(s.elements.length === 1, `one <audio> element is in use (${s.elements.length})`);
  check(
    requests.join(',') === 'first-light-particles.mp3',
    `only the opening piece has been fetched (${requests.join(', ')})`,
  );
  await sleep(1200);
  await page.screenshot({ path: join(outDir, '01-sound-panel.png') });
  await page.click('#sound-credits-open');
  await sleep(200);
  await page.screenshot({ path: join(outDir, '02-credits.png') });
  const credits = await page.$$eval('#sound-credits li', (items) => items.length);
  check(credits === 5, `the credits name every file (${credits} entries)`);
  await page.keyboard.press('Escape');

  // Into a level: the music of play takes over.
  await page.click('#modal-root .level');
  s = await until(page, 'the music of play plays', (x) => x.scene === 'play' && x.playing !== null);
  check(s.playing !== 'first-light-particles', `choosing a level changes the music (${s.playing})`);
  check(
    s.elements.length === 2,
    `while the scene changes two elements sound (${s.elements.length})`,
  );
  s = await until(page, 'the opening piece is given back', (x) => x.elements.length === 1);
  const before = s.elements[0]?.seconds ?? 0;
  await sleep(2000);
  s = await state(page);
  const moved = (s.elements[0]?.seconds ?? 0) - before;
  check(
    Math.abs(moved - 2) < 0.4,
    `the piece advances in real time (${moved.toFixed(2)} s in 2 s)`,
  );
  const last = await page.evaluate(
    () => document.getElementById('topbar')?.lastElementChild?.id ?? null,
  );
  check(last === 'sound-control', 'the control is still at the right of the redrawn top bar');
  // No picture of this moment: `03-in-play.png` is not among the published pictures, and the
  // number stays unused.

  // The panel says what plays, what comes next and when, and goes there at once when asked.
  await page.click('#sound-control');
  await page.waitForFunction(
    () => /^Next: .+ in \d+:\d\d$/.test(document.getElementById('sound-next')?.textContent ?? ''),
    { timeout: 20_000 },
  );
  const told = await page.evaluate(() => ({
    now: document.getElementById('sound-now')?.textContent ?? '',
    next: document.getElementById('sound-next')?.textContent ?? '',
  }));
  s = await until(page, 'the next change can be asked for', (x) => x.music?.canSkip === true);
  const promised = s.music?.next?.piece ?? null;
  const wasPlaying = s.playing;
  check(
    told.now.startsWith('Playing: ') && promised !== null && promised !== wasPlaying,
    `the panel says what plays and what comes next (${told.now}; ${told.next})`,
  );
  await page.screenshot({ path: join(outDir, '04-panel-next.png') });
  await page.click('#sound-skip');
  s = await until(page, 'the change is near', (x) => (x.music?.next?.seconds ?? 99) < 16, 5000);
  const disabled = await page.$eval('#sound-skip', (b) => (b as HTMLButtonElement).disabled);
  check(
    disabled && s.playing === wasPlaying && s.music?.next?.piece === promised,
    `"Go to next change" takes the piece to its ending: ${promised} in ${(s.music?.next?.seconds ?? 0).toFixed(0)} s, and the button waits`,
  );
  s = await until(
    page,
    'the next piece has come in',
    (x) => x.playing === promised && (x.music?.heard.length ?? 0) > 0,
    30_000,
  );
  check(
    s.music?.heard[0]?.from === wasPlaying && s.music?.heard[0]?.to === promised,
    `the promised piece comes in by the usual join and the change is listed (${JSON.stringify(s.music?.heard[0])})`,
  );
  const listed = await page.$$eval('#sound-heard li', (items) => items.map((i) => i.textContent));
  check(
    listed.length === 1 && /→/.test(listed[0] ?? ''),
    `the panel lists the change by name (${listed.join(' | ')})`,
  );
  await page.screenshot({ path: join(outDir, '05-panel-heard.png') });
  s = await until(page, 'the piece left is given back', (x) => x.elements.length === 1, 30_000);
  await page.keyboard.press('Escape');

  // What it costs the page's main thread.
  const cost = async (): Promise<{ task: number; frames: number }> => {
    const a = await page.metrics();
    // Given as text: a function with named helpers inside does not survive the trip to the page.
    const frames = (await page.evaluate(`new Promise((resolve) => {
      let count = 0;
      const end = performance.now() + 10000;
      const tick = () => {
        count++;
        if (performance.now() < end) requestAnimationFrame(tick);
        else resolve(count);
      };
      requestAnimationFrame(tick);
    })`)) as number;
    const b = await page.metrics();
    return { task: (b.TaskDuration ?? 0) - (a.TaskDuration ?? 0), frames };
  };
  const withMusic = await cost();

  // Music off, then on.
  await page.click('#sound-control');
  await page.click('#sound-music');
  s = await until(page, 'the music stops', (x) => x.elements.length === 0);
  check(s.scene === null && !s.settings.music, 'music off gives back every element');
  const without = await cost();
  console.log(
    `  main thread over 10 s: ${(withMusic.task * 1000).toFixed(0)} ms of tasks and ${withMusic.frames} frames with music, ${(without.task * 1000).toFixed(0)} ms and ${without.frames} frames without`,
  );
  check(
    withMusic.task - without.task < 0.15,
    `the music costs the main thread ${((withMusic.task - without.task) * 100).toFixed(1)} ms a second`,
  );
  await page.click('#sound-music');
  s = await until(page, 'the music is back', (x) => x.scene === 'play' && x.elements.length === 1);
  check(s.settings.music, 'music on starts it again');

  // Remembered over a reload.
  await page.click('#sound-sounds');
  await page.$eval('#sound-volume', (input) => {
    (input as HTMLInputElement).value = '0.3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#topbar #sound-control');
  s = await state(page);
  check(
    s.settings.sounds && s.settings.music && s.settings.volume === 0.3,
    `the settings are remembered (${JSON.stringify(s.settings)})`,
  );
  check(!s.unlocked, 'and after the reload nothing plays until the next click');
  check(errors.length === 0, `no errors on the page (${errors.slice(0, 3).join(' | ')})`);
} finally {
  await browser.close();
  await server.app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(failed ? '\nFAILED' : '\nall checks passed');
process.exit(failed ? 1 : 0);
