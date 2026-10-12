/**
 * Measures every distinct join of the music, since nobody who works on it can hear: renders
 * each one through the page's own mixer in headless Chrome (muted), writes it as a short clip,
 * and says in figures what happens in it. It does this for the joins as they were when the
 * changes from piece to piece were found rough (`FIRST_OPTIONS`) and as they are now
 * (`DEFAULT_OPTIONS`), with the same measurements, and ranks each set worst first.
 *
 *   pnpm --filter @spotless/web exec vite build
 *   pnpm --filter @spotless/web exec tsx scripts/audio-joins.ts [--out <directory>] [--only first|now]
 *
 * The clips (one WAV a join, 22.05 kHz mono) and `joins.json` go to `--out`, by default a folder
 * in the system's temporary directory.
 *
 * The joins:
 *   - every ordered pair of play pieces, from the first's exit to the second's beginning, and
 *     to the second's loop (the entry "straight at the middle");
 *   - each piece's repeat of its own middle;
 *   - the opening piece handing over to play when a level is chosen;
 *   - the drop when a wash starts and the return when the report arrives.
 *
 * The figures of a join (levels in dB re full scale, RMS over one second):
 *   before, after   the level over the six seconds before the outgoing voice begins to fade and
 *                   over the six after the join is over;
 *   dip             how far the quietest second of the join lies under the quieter of those two
 *                   (large: the music seems to stop);
 *   bump            how far the loudest second lies over the louder of the two (two full
 *                   textures on top of each other);
 *   agree           how alike the two sides are in harmony, 0 to 1: the cosine of their
 *                   pitch-class profiles over the ten seconds from the exit and from the entry,
 *                   read from the files themselves;
 *   together        the seconds during which both voices sound at once within 9 dB of each
 *                   other and above -45 dB, each rendered alone through the join with its fade
 *                   and its low-pass (so a voice that has been closed down to a bed counts for
 *                   what is left of it);
 *   clash           together x (1 - agree): seconds of two unrelated harmonies at like level.
 *                   This is the figure the ranking leads with;
 *   entry           whether the incoming side starts where the music breathes: the level of its
 *                   file over the 0.6 s before the entry point against the 0.6 s after;
 *   brightness      the spectral centroid of the mix over the three seconds before the join
 *                   and the three after, hertz.
 *
 * Exits 1 if a join of the present set breaks a limit (printed with the figures).
 */

import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CLASH, CLASH_LIMIT, OPENING, PLAY, type Piece } from '../src/audio/manifest.ts';
import type { RenderReport, RenderRequest } from '../src/audio/offline.ts';
import {
  DEFAULT_OPTIONS,
  FIRST_OPTIONS,
  joinFor,
  loopFadeOf,
  pieceFor,
  type SequencerOptions,
} from '../src/audio/sequencer.ts';
import { launchChrome } from './driver.ts';

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    only: { type: 'string' },
    // For trying a join out: out,delay,in,closeTo in place of the present one.
    join: { type: 'string' },
  },
});
const here = fileURLToPath(new URL('.', import.meta.url));
const dist = join(here, '..', 'dist');
const outDir = values.out ?? join(tmpdir(), 'spotless-audio-joins');
const SR = 22050;

if (!existsSync(join(dist, 'index.html'))) {
  console.error('audio-joins: build the page first (vite build)');
  process.exit(2);
}

// ---------------------------------------------------------------------------------------------
// Sound as numbers
// ---------------------------------------------------------------------------------------------

function decodeFile(file: string): Float32Array {
  const result = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'],
    { maxBuffer: 1 << 30 },
  );
  if (result.status !== 0) throw new Error(`ffmpeg: ${String(result.stderr)}`);
  const bytes = result.stdout as Buffer;
  return new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
}

function fromPcm(base64: string): Float32Array {
  const bytes = Buffer.from(base64, 'base64');
  const ints = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  return Float32Array.from(ints, (v) => v / 32767);
}

function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(
      Math.max(-32768, Math.min(32767, Math.round((samples[i] as number) * 32767))),
      i * 2,
    );
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(SR, 24);
  head.writeUInt32LE(SR * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

function levelDb(x: Float32Array, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from * SR));
  const b = Math.min(x.length, Math.floor(to * SR));
  let sum = 0;
  for (let i = a; i < b; i++) sum += (x[i] as number) ** 2;
  return 10 * Math.log10(Math.max(1e-12, sum / Math.max(1, b - a)));
}

const NFFT = 4096;
const WINDOW = Float32Array.from(
  { length: NFFT },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / NFFT),
);

/** The power spectrum of one frame (radix-2 FFT in place). */
function spectrum(x: Float32Array, start: number): Float32Array {
  const re = new Float32Array(NFFT);
  const im = new Float32Array(NFFT);
  for (let i = 0; i < NFFT; i++) re[i] = (x[start + i] ?? 0) * (WINDOW[i] as number);
  for (let i = 1, j = 0; i < NFFT; i++) {
    let bit = NFFT >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const t = re[i] as number;
      re[i] = re[j] as number;
      re[j] = t;
    }
  }
  for (let size = 2; size <= NFFT; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    for (let i = 0; i < NFFT; i += size) {
      for (let k = 0; k < size / 2; k++) {
        const wr = Math.cos(angle * k);
        const wi = Math.sin(angle * k);
        const a = i + k;
        const b = a + size / 2;
        const tr = (re[b] as number) * wr - (im[b] as number) * wi;
        const ti = (re[b] as number) * wi + (im[b] as number) * wr;
        re[b] = (re[a] as number) - tr;
        im[b] = (im[a] as number) - ti;
        re[a] = (re[a] as number) + tr;
        im[a] = (im[a] as number) + ti;
      }
    }
  }
  const power = new Float32Array(NFFT / 2);
  for (let i = 0; i < NFFT / 2; i++) power[i] = (re[i] as number) ** 2 + (im[i] as number) ** 2;
  return power;
}

/** The pitch-class profile of a stretch (12 numbers) and its spectral centroid. */
function profile(
  x: Float32Array,
  from: number,
  to: number,
): { chroma: number[]; centroid: number } {
  const chroma = new Array<number>(12).fill(0);
  let weighted = 0;
  let total = 0;
  const a = Math.max(0, Math.floor(from * SR));
  const b = Math.min(x.length - NFFT, Math.floor(to * SR) - NFFT);
  for (let start = a; start <= b; start += NFFT / 2) {
    const power = spectrum(x, start);
    for (let bin = 1; bin < power.length; bin++) {
      const hz = (bin * SR) / NFFT;
      const p = power[bin] as number;
      weighted += hz * p;
      total += p;
      if (hz < 55 || hz > 2000) continue;
      const pitch = Math.round(12 * Math.log2(hz / 440)) + 120;
      chroma[pitch % 12] = (chroma[pitch % 12] as number) + p;
    }
  }
  return { chroma, centroid: total > 0 ? weighted / total : 0 };
}

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < 12; i++) {
    dot += (a[i] as number) * (b[i] as number);
    aa += (a[i] as number) ** 2;
    bb += (b[i] as number) ** 2;
  }
  return aa > 0 && bb > 0 ? dot / Math.sqrt(aa * bb) : 0;
}

// ---------------------------------------------------------------------------------------------
// The joins
// ---------------------------------------------------------------------------------------------

interface Case {
  readonly name: string;
  readonly kind: 'change' | 'mid entry' | 'repeat' | 'scene' | 'wash';
  readonly from: Piece;
  readonly to: Piece;
  readonly atLoop: boolean;
}

interface Figures {
  readonly name: string;
  readonly kind: Case['kind'];
  readonly join: string;
  readonly beforeDb: number;
  readonly afterDb: number;
  readonly dip: number;
  readonly bump: number;
  readonly agree: number;
  readonly together: number;
  readonly clash: number;
  readonly entry: string;
  readonly brightness: readonly [number, number];
  readonly score: number;
}

const LEAD = 20;
const TAIL = 16;

const cases: Case[] = [];
for (const from of PLAY) {
  for (const to of PLAY) {
    if (from === to) continue;
    cases.push({ name: `${from.id}>${to.id}`, kind: 'change', from, to, atLoop: false });
    cases.push({ name: `${from.id}>${to.id}@loop`, kind: 'mid entry', from, to, atLoop: true });
  }
}
for (const piece of [...PLAY, OPENING]) {
  cases.push({ name: `${piece.id} repeats`, kind: 'repeat', from: piece, to: piece, atLoop: true });
}

const files = new Map<string, Float32Array>();
for (const piece of [OPENING, ...PLAY]) {
  files.set(piece.id, decodeFile(join(here, '..', 'public', 'audio', piece.file)));
}
const raw = (piece: Piece): Float32Array => files.get(piece.id) as Float32Array;

/** How alike the place a piece is left at and the place another is entered at are in harmony. */
function agreementOf(from: Piece, fromAt: number, to: Piece, toAt: number): number {
  return cosine(
    profile(raw(from), fromAt, fromAt + 10).chroma,
    profile(raw(to), toAt, toAt + 10).chroma,
  );
}

function entryWords(piece: Piece, at: number): string {
  if (at < 0.6) return 'the start of the file';
  const before = levelDb(raw(piece), at - 0.6, at);
  const after = levelDb(raw(piece), at, at + 0.6);
  const breath = before < -45 || before <= after - 6;
  return `${breath ? 'on a breath' : 'mid-phrase'} (${before.toFixed(0)} dB before, ${after.toFixed(0)} after)`;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.mp3': 'audio/mpeg',
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

  const designs: [string, SequencerOptions][] = [
    ['first', FIRST_OPTIONS],
    [
      'now',
      values.join === undefined
        ? DEFAULT_OPTIONS
        : (() => {
            const [out = 10, delay = 0, fade = 5, closeTo = 0] = values.join.split(',').map(Number);
            return { ...DEFAULT_OPTIONS, join: { out, delay, in: fade, closeTo } };
          })(),
    ],
  ];
  const all: { [design: string]: Figures[] } = {};
  for (const [design, options] of designs) {
    if (values.only !== undefined && values.only !== design) continue;
    const dir = join(outDir, design);
    mkdirSync(dir, { recursive: true });
    const figures: Figures[] = [];
    for (const drawn of cases) {
      // The pieces with the cue points of this set.
      const test = {
        ...drawn,
        from: pieceFor(drawn.from, options),
        to: pieceFor(drawn.to, options),
      };
      // An entry at the loop is measured where it is played: in the first set everywhere, in
      // the present one for the pieces that still allow it.
      if (test.kind === 'mid entry' && test.to.midEntry === false) continue;
      const repeat = test.kind === 'repeat';
      const leaveAt = repeat ? test.from.loopEnd : test.from.exit;
      const enterAt = repeat || test.atLoop ? test.to.loopStart : test.to.in;
      const jn = repeat
        ? {
            out: loopFadeOf(test.from, options),
            delay: 0,
            in: loopFadeOf(test.from, options),
            closeTo: 0,
          }
        : joinFor(test.from, test.to, test.atLoop, options);
      const fadeIn = repeat || test.atLoop ? jn.in : Math.min(jn.in, test.to.fadeIn ?? jn.in);
      const seconds = LEAD + Math.max(jn.out, jn.delay + fadeIn) + TAIL;
      const count = Math.floor(seconds * SR);
      let mix: Float32Array;
      let outgoing: Float32Array;
      let incoming: Float32Array;
      if (repeat) {
        // A piece into itself is an equal-power crossfade of two places of one file: the two
        // voices are made here from the file, as the mixer makes them (sine and cosine of a
        // quarter turn). The opening piece, which plays alone on its own deck, is joined the
        // same way.
        const file = raw(test.from);
        outgoing = new Float32Array(count);
        incoming = new Float32Array(count);
        const trim = test.from.gain ?? 1;
        for (let i = 0; i < count; i++) {
          const t = i / SR - LEAD;
          const part = Math.min(1, Math.max(0, t / jn.out));
          const angle = part * (Math.PI / 2);
          outgoing[i] = (file[Math.floor((leaveAt + t) * SR)] ?? 0) * Math.cos(angle) * trim;
          incoming[i] =
            t < 0 ? 0 : (file[Math.floor((enterAt + t) * SR)] ?? 0) * Math.sin(angle) * trim;
        }
        mix = Float32Array.from(outgoing, (v, i) => v + (incoming[i] as number));
      } else {
        const request = (solo?: string): RenderRequest => ({
          seconds,
          seed: 1,
          sampleRate: SR,
          tone: false,
          pcm: true,
          events: [{ at: 0, cue: { do: 'scene', scene: 'play' } }],
          options: {
            ...options,
            script: [
              { id: test.from.id, from: leaveAt - LEAD },
              { id: test.to.id, atLoop: test.atLoop },
            ],
            ...(solo === undefined ? {} : { solo }),
          },
        });
        mix = fromPcm((await render(request())).pcm ?? '');
        outgoing = fromPcm((await render(request(test.from.id))).pcm ?? '');
        incoming = fromPcm((await render(request(test.to.id))).pcm ?? '');
      }
      const fadeFrom = LEAD;
      const over = fadeFrom + Math.max(jn.out, jn.delay + fadeIn);
      const beforeDb = levelDb(mix, fadeFrom - 6, fadeFrom);
      const afterDb = levelDb(mix, over, over + 6);
      let minDb = Infinity;
      let maxDb = -Infinity;
      let together = 0;
      for (let t = fadeFrom; t + 1 <= over + 1e-9; t += 0.25) {
        const level = levelDb(mix, t, t + 1);
        minDb = Math.min(minDb, level);
        maxDb = Math.max(maxDb, level);
        const a = levelDb(outgoing, t, t + 1);
        const b = levelDb(incoming, t, t + 1);
        if (Math.min(a, b) > -45 && Math.abs(a - b) < 9) together += 0.25;
      }
      const agree = agreementOf(test.from, leaveAt, test.to, enterAt);
      const dip = Math.max(0, Math.min(beforeDb, afterDb) - minDb);
      const bump = Math.max(0, maxDb - Math.max(beforeDb, afterDb));
      const clash = together * (1 - agree);
      figures.push({
        name: test.name,
        kind: test.kind,
        join:
          jn.delay === 0 && jn.closeTo === 0
            ? `equal-power crossfade ${jn.out} s`
            : `recede ${jn.out} s to ${jn.closeTo} Hz, enter after ${jn.delay} s over ${fadeIn} s`,
        beforeDb,
        afterDb,
        dip,
        bump,
        agree,
        together,
        clash,
        entry: entryWords(test.to, enterAt),
        brightness: [
          profile(mix, fadeFrom - 3, fadeFrom).centroid,
          profile(mix, over, over + 3).centroid,
        ],
        score: clash + 0.25 * Math.max(0, dip - 4) + 0.5 * Math.max(0, bump - 1.5),
      });
      writeFileSync(
        join(
          dir,
          `${test.name.replaceAll('>', '_to_').replaceAll(' ', '_').replace('@', '_at_')}.wav`,
        ),
        wav(mix),
      );
    }

    // The opening piece handing over to play, and the wash.
    for (const [name, events, from, to] of [
      [
        'opening to play (a level is chosen)',
        [
          { at: 0, cue: { do: 'scene', scene: 'menu' } },
          { at: 30, cue: { do: 'scene', scene: 'play' } },
        ],
        24,
        36,
      ],
      [
        'the wash starts and the report arrives',
        [
          { at: 0, cue: { do: 'scene', scene: 'play' } },
          { at: 24, cue: { do: 'duck', on: true } },
          { at: 40, cue: { do: 'duck', on: false } },
        ],
        18,
        50,
      ],
    ] as const) {
      const report = await render({
        seconds: 56,
        seed: 1,
        sampleRate: SR,
        tone: false,
        pcm: true,
        events: events as unknown as RenderRequest['events'],
        options: { ...options, script: [{ id: (PLAY[0] as Piece).id, from: 60 }] },
      });
      const mix = fromPcm(report.pcm ?? '');
      const levels: string[] = [];
      for (let t = from; t < to; t += 2) levels.push(levelDb(mix, t, t + 2).toFixed(0));
      console.log(`[${design}] ${name}: level every 2 s from ${from} s: ${levels.join(' ')} dB`);
      writeFileSync(join(dir, `${name.replaceAll(' ', '_').replace(/[()]/g, '')}.wav`), wav(mix));
    }

    figures.sort((a, b) => b.score - a.score);
    all[design] = figures;
    console.log(`\n=== ${design}: ${figures.length} joins, worst first ===`);
    console.log(
      'score  clash  together  agree   dip  bump  before  after  bright      kind       join / name / entry',
    );
    for (const f of figures) {
      console.log(
        `${f.score.toFixed(2).padStart(5)}  ${f.clash.toFixed(2).padStart(5)}  ${f.together.toFixed(2).padStart(7)}  ${f.agree.toFixed(3)}  ${f.dip.toFixed(1).padStart(4)}  ${f.bump.toFixed(1).padStart(4)}  ${f.beforeDb.toFixed(1).padStart(6)}  ${f.afterDb.toFixed(1).padStart(5)}  ${String(Math.round(f.brightness[0])).padStart(4)}>${String(Math.round(f.brightness[1])).padEnd(4)}  ${f.kind.padEnd(9)}  ${f.name}  [${f.join}]  entry ${f.entry}`,
      );
    }
    const changes = figures.filter((f) => f.kind === 'change' || f.kind === 'mid entry');
    const mean = (pick: (f: Figures) => number, of: Figures[] = changes): number =>
      of.reduce((sum, f) => sum + pick(f), 0) / Math.max(1, of.length);
    console.log(
      `[${design}] changes of piece (${changes.length}): clash mean ${mean((f) => f.clash).toFixed(2)} s, worst ${Math.max(...changes.map((f) => f.clash)).toFixed(2)} s; together mean ${mean((f) => f.together).toFixed(1)} s; dip mean ${mean((f) => f.dip).toFixed(1)} dB, worst ${Math.max(...changes.map((f) => f.dip)).toFixed(1)} dB; bump worst ${Math.max(...changes.map((f) => f.bump)).toFixed(1)} dB`,
    );
    const repeats = figures.filter((f) => f.kind === 'repeat');
    console.log(
      `[${design}] repeats (${repeats.length}): together mean ${mean((f) => f.together, repeats).toFixed(1)} s; bump worst ${Math.max(...repeats.map((f) => f.bump)).toFixed(1)} dB; dip worst ${Math.max(...repeats.map((f) => f.dip)).toFixed(1)} dB`,
    );
    if (design === 'now') {
      const check = (ok: boolean, text: string): void => {
        console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${text}`);
        if (!ok) failed = true;
      };
      // A pair whose change cannot be made clean is not played back to back: the order of the
      // pieces leaves it out by the figures the manifest carries, which must be these.
      const played = changes.filter((f) => f.clash <= CLASH_LIMIT);
      const left = changes.filter((f) => f.clash > CLASH_LIMIT);
      const worst = (pick: (f: Figures) => number): Figures =>
        [...played].sort((a, b) => pick(b) - pick(a))[0] as Figures;
      const stale = changes.filter((f) => Math.abs((CLASH[f.name] ?? -1) - f.clash) > 0.3);
      check(
        stale.length === 0,
        `the manifest carries these figures for the order of the pieces (${stale.length === 0 ? 'all within 0.3 s' : stale.map((f) => `${f.name}: manifest ${CLASH[f.name] ?? '-'}, measured ${f.clash.toFixed(2)}`).join('; ')})`,
      );
      check(
        left.every((f) => (CLASH[f.name] ?? 0) > CLASH_LIMIT) && played.length >= 9,
        `the changes left with more than ${CLASH_LIMIT} s of clash are not played back to back: ${left.length === 0 ? 'none' : left.map((f) => `${f.name} (${f.clash.toFixed(2)} s)`).join(', ')}; ${played.length} of ${changes.length} ordered pairs are played`,
      );
      check(
        worst((f) => f.clash).clash <= CLASH_LIMIT,
        `no change of piece that is played holds two unrelated harmonies together for long: at worst ${worst((f) => f.clash).clash.toFixed(2)} s of clash (${worst((f) => f.name.length).name === '' ? '' : worst((f) => f.clash).name}; limit ${CLASH_LIMIT})`,
      );
      check(
        worst((f) => f.bump).bump <= 2,
        `no change of piece is louder than its two sides: at worst ${worst((f) => f.bump).bump.toFixed(1)} dB over (${worst((f) => f.bump).name}; limit 2)`,
      );
      check(
        worst((f) => f.dip).dip <= 9,
        `no change of piece reads as the music stopping: the quietest second is at worst ${worst((f) => f.dip).dip.toFixed(1)} dB under the quieter side (${worst((f) => f.dip).name}; limit 9)`,
      );
    }
  }
  writeFileSync(join(outDir, 'joins.json'), JSON.stringify(all, null, 1));

  const repeats = (all['now'] ?? []).filter((f) => f.kind === 'repeat');
  if (repeats.length > 0) {
    const worstDip = [...repeats].sort((a, b) => b.dip - a.dip)[0] as Figures;
    const ok = worstDip.dip <= 5;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  no repeat of a piece's middle sags: the quietest second is at worst ${worstDip.dip.toFixed(1)} dB under the quieter side (${worstDip.name}; limit 5)`,
    );
    if (!ok) failed = true;
  }

  // The table the manifest carries.
  console.log('\nAGREEMENT (for src/audio/manifest.ts):');
  for (const test of cases) {
    if (test.kind === 'repeat') continue;
    const value = agreementOf(
      test.from,
      test.from.exit,
      test.to,
      test.atLoop ? test.to.loopStart : test.to.in,
    );
    console.log(`  '${test.name}': ${value.toFixed(3)},`);
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
