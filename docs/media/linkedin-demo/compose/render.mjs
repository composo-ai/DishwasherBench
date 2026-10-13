// Renders engine/stage.html frame by frame in headless Chromium and encodes with ffmpeg.
//
//   node render.mjs [--out build/dishwasherbench-linkedin.mp4] [--fps 30] [--workers 3]
//                   [--from 0] [--to 10] [--mux build/music.wav]
//   node render.mjs --stills 0.5,3,7.2 [--stills-dir build/stills]      (PNG frames for review)
//
// Every frame is a pure function of time (engine/engine.js), so workers render ranges in parallel.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// puppeteer-core as the page's own scripts use it.
const require = createRequire(new URL('../../../../apps/web/package.json', import.meta.url));
const { launch } = await import(pathToFileURL(require.resolve('puppeteer-core')).href);

const HERE = dirname(fileURLToPath(import.meta.url));

/** The browser: SPOTLESS_CHROME, or Google Chrome where macOS installs it (the first place
 * packages/render/src/headless/chrome.ts looks). */
function chromePath() {
  const p = process.env.SPOTLESS_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!existsSync(p)) throw new Error(`no browser at ${p}: set SPOTLESS_CHROME to a Chrome or Chromium`);
  return p;
}
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
    return acc;
  }, []),
);
const FPS = Number(args.fps || 30);
const WORKERS = Number(args.workers || 3);
const timeline = args.timeline ? pathToFileURL(resolve(args.timeline)).href : '../timeline.js';

const browser = await launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--no-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars',
    '--allow-file-access-from-files', '--disable-web-security', '--mute-audio',
    // Several stages render at once; none of them may be throttled as a background page.
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 1 },
  protocolTimeout: 120000,
});

async function openStage() {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  // A request the page aborts itself (a stage reloaded or closed by a retry) is not a missing file.
  page.on('requestfailed', (r) => { if (r.failure()?.errorText === 'net::ERR_ABORTED') return; console.error('missing file:', r.url()); process.exitCode = 2; });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  const url = pathToFileURL(join(HERE, 'engine/stage.html')).href + '?timeline=' + encodeURIComponent(timeline);
  // Opening several stages at once occasionally leaves one that never becomes ready: retry.
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.ready === true, { timeout: 60000, polling: 200 });
      return page;
    } catch (e) {
      console.error(`stage not ready (attempt ${attempt}): ${e.message}`);
      if (attempt >= 4) throw e;
    }
  }
}

const shot = (page, type) =>
  page.screenshot({ type, ...(type === 'jpeg' ? { quality: 95 } : {}), clip: { x: 0, y: 0, width: 1080, height: 1350 }, optimizeForSpeed: true });

const within = (p, ms, what) => Promise.race([p, new Promise((_, j) => setTimeout(() => j(new Error(`${what} took over ${ms / 1000} s`)), ms))]);
class Missing extends Error {}
/**
 * Lays out frame f on the worker's stage and photographs it. A stage occasionally stops
 * answering in the middle of a render; since every frame is a pure function of time, the frame
 * is retried on a fresh stage. Images that will not load are an error at once.
 */
async function frameAt(stage, f) {
  for (let attempt = 1; ; attempt++) {
    try {
      await within(stage.page.evaluate((t) => window.seek(t), f / FPS), 60000, `frame ${f}`);
      const missing = await stage.page.evaluate(() => window.__missing);
      if (missing) throw new Missing(`frame ${f}: images that would not load: ${missing.slice(0, 3).join(', ')}`);
      return await within(shot(stage.page, 'jpeg'), 60000, `frame ${f} screenshot`);
    } catch (e) {
      if (e instanceof Missing || attempt >= 5) throw e;
      console.error(`${e.message}; reopening the stage (attempt ${attempt})`);
      stage.page.close().catch(() => {});
      stage.page = await openStage();
    }
  }
}

if (args.stills) {
  const dir = resolve(args['stills-dir'] || join(HERE, 'build/stills'));
  mkdirSync(dir, { recursive: true });
  const page = await openStage();
  for (const t of args.stills.split(',').map(Number)) {
    await page.evaluate((t) => window.seek(t), t);
    const buf = await shot(page, 'png');
    const f = join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
    writeFileSync(f, buf);
    console.log(f);
  }
  await browser.close();
  process.exit(0);
}

const probe = await openStage();
const total = await probe.evaluate(() => window.videoDuration);
await probe.close();
const from = Number(args.from || 0);
const to = Math.min(Number(args.to || total), total);
const first = Math.round(from * FPS);
const last = Math.round(to * FPS); // exclusive
const n = last - first;
const out = resolve(args.out || join(HERE, 'build/dishwasherbench-linkedin.mp4'));
const tmp = join(dirname(out), '.chunks-' + Date.now());
mkdirSync(tmp, { recursive: true });
console.log(`rendering ${n} frames (${from}s-${to}s of ${total}s) with ${WORKERS} workers`);

const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const t0 = Date.now();
let done = 0;
const per = Math.ceil(n / WORKERS);
const chunks = [];
await Promise.all(
  Array.from({ length: WORKERS }, async (_, w) => {
    const a = first + w * per;
    const b = Math.min(last, a + per);
    if (a >= b) return;
    const file = join(tmp, `chunk${w}.mp4`);
    chunks[w] = file;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p', ...BT709,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const finished = new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
    const stage = { page: await openStage() };
    for (let f = a; f < b; f++) {
      const buf = await frameAt(stage, f);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      done++;
      if (done % 60 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`${done}/${n} frames, ${(el / done).toFixed(3)} s/frame, eta ${Math.round((el / done) * (n - done))} s`);
      }
    }
    ff.stdin.end();
    await finished;
    await stage.page.close();
  }),
);
await browser.close();

const list = join(tmp, 'list.txt');
writeFileSync(list, chunks.filter(Boolean).map((c) => `file '${c}'`).join('\n'));
const dur = n / FPS;
const ffArgs = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (args.mux) {
  // A finished soundtrack (already mixed and levelled), cut to the rendered range.
  ffArgs.push('-ss', String(from), '-i', resolve(args.mux), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
} else if (args.audio) {
  const off = Number(args['audio-offset'] || 0) + from;
  const fo = Number(args['audio-fade-out'] || 3);
  const fi = Number(args['audio-fade-in'] || 0.6);
  ffArgs.push('-ss', String(off), '-i', resolve(args.audio));
  ffArgs.push('-filter_complex',
    `[1:a]atrim=0:${dur},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${fi},afade=t=out:st=${Math.max(0, dur - fo)}:d=${fo},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
    '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
}
ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 20), '-profile:v', 'high', '-level', '4.1',
  '-pix_fmt', 'yuv420p', ...BT709, '-r', String(FPS), '-map_metadata', '-1', '-movflags', '+faststart', '-t', String(dur), out);
await new Promise((r, j) => spawn('ffmpeg', ffArgs, { stdio: 'inherit' }).on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg final ' + c)))));
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out} in ${Math.round((Date.now() - t0) / 1000)} s`);
