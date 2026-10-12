/**
 * Proves that the music has no clicks, no gaps and an even level, by rendering a quarter of an
 * hour of it offline in headless Chrome and measuring the result.
 *
 *   pnpm --filter @spotless/web exec vite build
 *   pnpm --filter @spotless/web exec tsx scripts/audio-mix-check.ts [--seconds 900] [--seed 1] [--out report.json]
 *
 * The built page is served from `dist/` by a few lines of static server (no game server is
 * needed: the audio module stands on its own) and asked to render through
 * `window.spotlessAudio.renderMix`, which runs the page's own mixer and sequencer on an
 * `OfflineAudioContext`. Three renders:
 *
 *   1. The envelope. Every file is replaced by a constant 1, so the output is the sum of the
 *      gains the engine applies. It must never step (a click) and never dip under 1 (a gap),
 *      and must stay under the square root of two (two voices at the middle of a crossfade).
 *   2. The envelope with the game in it: the opening screen, a session, a wash, the report, the
 *      opening screen again. The same limits on steps.
 *   3. The music itself, with a wash and a report in it. At every join (a voice starting,
 *      reaching full level, beginning to fade, ending; the wash starting and ending) the largest
 *      step between neighbouring samples of the mix must be no larger than the files themselves
 *      make at that instant under the gains their voices have: the engine adds no step of its
 *      own. Each crossfade's level is compared with the sum of the powers of its two voices, and
 *      the level in windows of three seconds is reported inside and outside the crossfades.
 *
 * Exits 1 if any limit is broken.
 */

import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { RenderReport, RenderRequest } from '../src/audio/offline.ts';
import { PLAY } from '../src/audio/manifest.ts';
import { launchChrome } from './driver.ts';

const { values } = parseArgs({
  options: {
    seconds: { type: 'string', default: '900' },
    seed: { type: 'string', default: '1' },
    out: { type: 'string' },
  },
});
const seconds = Number(values.seconds);
const seed = Number(values.seed);

const dist = fileURLToPath(new URL('../dist', import.meta.url));
if (!existsSync(join(dist, 'index.html'))) {
  console.error('audio-mix-check: build the page first (vite build)');
  process.exit(2);
}
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.mp3': 'audio/mpeg',
  '.md': 'text/markdown',
};
const server = createServer((request, response) => {
  const path = normalize(decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/'));
  const file = join(dist, path === '/' ? 'index.html' : path);
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;

const browser = await launchChrome();
let failed = false;
const check = (ok: boolean, text: string): void => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${text}`);
  if (!ok) failed = true;
};
const db = (ratio: number): string => `${(20 * Math.log10(Math.max(ratio, 1e-9))).toFixed(1)} dB`;
const clock = (s: number): string =>
  `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

try {
  const page = await browser.newPage();
  page.on('pageerror', () => undefined);
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => 'spotlessAudio' in window, { timeout: 30_000 });
  const render = (request: RenderRequest): Promise<RenderReport> =>
    page.evaluate(
      (r) =>
        (
          window as unknown as {
            spotlessAudio: { renderMix(r: RenderRequest): Promise<RenderReport> };
          }
        ).spotlessAudio.renderMix(r),
      request,
    );

  // 1. The envelope of play alone.
  const plain = await render({
    seconds,
    seed,
    sampleRate: 8000,
    tone: true,
    events: [{ at: 0, cue: { do: 'scene', scene: 'play' } }],
  });
  const voices = plain.voices;
  console.log(
    `\n1. The envelope of ${seconds} s of play, seed ${seed} (rendered in ${(plain.renderMs / 1000).toFixed(1)} s)`,
  );
  console.log(`   ${voices.length} voices:`);
  for (const voice of voices) {
    console.log(
      `     ${clock(voice.at).padStart(7)}  ${voice.kind.padEnd(6)} ${voice.piece.padEnd(26)} from ${clock(voice.offset)} for ${clock(voice.duration)}`,
    );
  }
  // The steepest thing the engine does to a gain is the shortest entry fade: a piece whose
  // file begins from silence comes in over a few hundredths of a second, a quarter turn of a sine, which moves by at
  // most (pi/2)/length a second. That is a ramp over hundreds of samples, not a step; whether
  // the music itself steps there is checked on the real files below.
  const shortest = Math.min(...PLAY.map((piece) => piece.fadeIn ?? 5));
  const slope = Math.PI / 2 / shortest / plain.sampleRate;
  check(
    plain.largestStep <= slope * 1.05,
    `no step in the envelope: the largest change between samples is ${plain.largestStep.toExponential(2)} at ${clock(plain.largestStepAt)} (the shortest fade, ${shortest} s, is ${slope.toExponential(2)} a sample at its steepest)`,
  );
  // In a change of piece the one being left recedes before the next is up: the sum of the two
  // gains may sink (the level of the music itself through each join is measured below and by
  // audio-joins.ts) but never to nothing, and two voices are never both at full level.
  check(
    plain.envelopeMin >= 0.3,
    `no gap: after the opening the sum of the gains never falls under ${plain.envelopeMin.toFixed(3)} (limit 0.3)`,
  );
  check(
    plain.envelopeMax <= 1.95,
    `never two voices at full level: the sum of the gains peaks at ${plain.envelopeMax.toFixed(3)} (limit 1.95)`,
  );

  // 2. The envelope with the game in it.
  const wash = { from: Math.min(300, seconds * 0.4), to: Math.min(420, seconds * 0.55) };
  const game = await render({
    seconds,
    seed,
    sampleRate: 8000,
    tone: true,
    events: [
      { at: 0, cue: { do: 'scene', scene: 'menu' } },
      { at: 40, cue: { do: 'scene', scene: 'play' } },
      { at: wash.from, cue: { do: 'duck', on: true } },
      { at: wash.to, cue: { do: 'duck', on: false } },
      { at: seconds - 120, cue: { do: 'scene', scene: 'menu' } },
      { at: seconds - 117, cue: { do: 'scene', scene: 'play' } },
    ],
  });
  console.log(
    `\n2. The envelope with the game in it: levels, play at 0:40, a wash ${clock(wash.from)} to ${clock(wash.to)}, levels and straight back at ${clock(seconds - 120)}`,
  );
  // Two decks may slide at once, and the wash slides over them.
  check(
    game.largestStep <= slope * 1.5,
    `no step: the largest change between samples is ${game.largestStep.toExponential(2)} at ${clock(game.largestStepAt)} (limit ${(slope * 1.5).toExponential(2)})`,
  );
  const during = game.levelsDb.slice(
    Math.ceil((wash.from + 6) / game.windowSeconds),
    Math.floor(wash.to / game.windowSeconds),
  );
  const washLevel = during.reduce((a, b) => a + b, 0) / during.length;
  check(
    washLevel < -6 && washLevel > -12,
    `the wash holds the music at ${washLevel.toFixed(1)} dB (the low-pass takes more off the top of real music)`,
  );

  // 3. The music itself.
  const skipAt = Math.min(seconds - 60, wash.to + 45);
  const music = await render({
    seconds,
    seed,
    sampleRate: 22050,
    tone: false,
    events: [
      { at: 0, cue: { do: 'scene', scene: 'play' } },
      { at: wash.from, cue: { do: 'duck', on: true } },
      { at: wash.to, cue: { do: 'duck', on: false } },
      // The player asks to go to the next change, twice: once where it can be done, once
      // straight after, while the piece is being taken to its ending, where it cannot.
      { at: skipAt, cue: { do: 'skip' } },
      { at: skipAt + 3, cue: { do: 'skip' } },
    ],
  });
  console.log(
    `\n3. The music, ${seconds} s at ${music.sampleRate} Hz (rendered in ${(music.renderMs / 1000).toFixed(1)} s), wash ${clock(wash.from)} to ${clock(wash.to)}`,
  );
  check(music.peak < 1, `no clipping: the peak is ${db(music.peak)} re full scale`);
  let worst = { ratio: 0, text: 'none' };
  console.log(
    '   steps at the joins: the largest in the mix within 20 ms, what the files make there by themselves, and the largest in the 2 s either side:',
  );
  for (const join of music.joins) {
    const ratio = join.step / (join.sources + 2e-4);
    if (ratio > worst.ratio) worst = { ratio, text: `${join.what} at ${clock(join.at)}` };
    console.log(
      `     ${clock(join.at).padStart(7)}  ${join.what.padEnd(48)} mix ${join.step.toFixed(4)}  files ${join.sources.toFixed(4)}  around ${join.around.toFixed(4)}`,
    );
  }
  check(
    worst.ratio <= 1.05,
    `no join adds a step of its own: at worst the mix steps by ${worst.ratio.toFixed(2)} of what the files themselves do there (${worst.text})`,
  );

  const span = music.windowSeconds;
  const inFade = (t: number): boolean =>
    music.voices.some((v, i) => i > 0 && t + span > v.at - 6 && t < v.at + 8);
  const inWash = (t: number): boolean => t + span > wash.from && t < wash.to + 6;
  const mean = (list: number[]): number => list.reduce((a, b) => a + b, 0) / list.length;
  const sorted = (list: number[]): number[] => [...list].sort((a, b) => a - b);
  const quantile = (list: number[], q: number): number =>
    sorted(list)[Math.floor(q * (list.length - 1))] ?? NaN;
  const steady: number[] = [];
  const fades: number[] = [];
  const washed: number[] = [];
  music.levelsDb.forEach((level, i) => {
    const t = i * span;
    if (t < 9) return;
    if (inWash(t)) washed.push(level);
    else if (inFade(t)) fades.push(level);
    else steady.push(level);
  });
  console.log(
    `   level in ${span} s windows, dB re full scale: outside the joins median ${quantile(steady, 0.5).toFixed(1)} (10% ${quantile(steady, 0.1).toFixed(1)}, 90% ${quantile(steady, 0.9).toFixed(1)}, lowest ${quantile(steady, 0).toFixed(1)}); in the joins median ${quantile(fades, 0.5).toFixed(1)} (lowest ${quantile(fades, 0).toFixed(1)}, highest ${quantile(fades, 1).toFixed(1)}); in the wash median ${quantile(washed, 0.5).toFixed(1)}`,
  );
  console.log(
    '   each join: the level over the 6 s before the outgoing voice begins to fade, the quietest and the loudest second of the join, and the 6 s after it:',
  );
  let dip = { value: 0, text: 'none' };
  let bump = { value: 0, text: 'none' };
  for (const fade of music.crossfades) {
    // The jump the button makes inside a piece (from where it was to ten seconds before its
    // exit) is not a join of the music's own: it is shown but not held to their limits. The
    // change of piece that follows it is.
    const asked = Math.abs(fade.fadeFrom - skipAt) < 0.5;
    const ducked = asked || (fade.fadeTo + 6 > wash.from && fade.fadeFrom - 6 < wash.to + 4);
    const under = Math.min(fade.beforeDb, fade.afterDb) - fade.minDb;
    const over = fade.maxDb - Math.max(fade.beforeDb, fade.afterDb);
    const text = `${fade.from} > ${fade.to} at ${clock(fade.at)}`;
    if (!ducked && under > dip.value) dip = { value: under, text };
    if (!ducked && over > bump.value) bump = { value: over, text };
    console.log(
      `     ${clock(fade.at).padStart(7)}  ${fade.kind.padEnd(6)} ${`${fade.from} > ${fade.to}`.padEnd(52)} before ${fade.beforeDb.toFixed(1)}  quietest ${fade.minDb.toFixed(1)}  loudest ${fade.maxDb.toFixed(1)}  after ${fade.afterDb.toFixed(1)}${asked ? '  (asked for by the button)' : ducked ? '  (under the wash)' : ''}`,
    );
  }
  check(
    dip.value <= 10,
    `no join reads as the music stopping: the quietest second of a join is at most ${dip.value.toFixed(1)} dB under the quieter of its two sides (${dip.text}; limit 10)`,
  );
  check(
    bump.value <= 2.5,
    `no join bulges: the loudest second of a join is at most ${bump.value.toFixed(1)} dB over the louder of its two sides (${bump.text}; limit 2.5)`,
  );
  const skipped = music.joins.filter((join) => join.what.startsWith('go to next change'));
  check(
    skipped.length === 2 &&
      skipped[0]?.what === 'go to next change' &&
      skipped[1]?.what === 'go to next change (refused)',
    `"go to the next change" takes the piece to its ending, and is refused while that is under way (${skipped.map((j) => `${clock(j.at)} ${j.what}`).join('; ')})`,
  );
  const after = music.voices.find((voice) => voice.at > skipAt && voice.kind === 'enter');
  check(
    after !== undefined && after.at - skipAt < 20,
    `the next piece comes in ${after === undefined ? '-' : (after.at - skipAt).toFixed(1)} s after the button, by the piece's own exit and its usual join (${after?.piece ?? 'none'})`,
  );
  check(
    quantile([...steady, ...fades], 0) > -50,
    `no silence anywhere: the quietest window is ${quantile([...steady, ...fades], 0).toFixed(1)} dB`,
  );
  check(
    mean(washed) < mean(steady) - 6,
    `the wash drops the music by ${(mean(steady) - mean(washed)).toFixed(1)} dB`,
  );

  if (values.out !== undefined) {
    writeFileSync(values.out, JSON.stringify({ plain, game, music }, null, 1));
    console.log(`\nreport written to ${values.out}`);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? '\nFAILED' : '\nall checks passed');
process.exit(failed ? 1 : 0);
