// Live-footage capture from the Spotless page in headless Chromium (SwiftShader WebGL).
//
// The page is opened on a session (URL hash), its clock and requestAnimationFrame are taken
// over so that every captured frame is exactly 1/fps of page time after the last (the physics
// playback, basket slides and camera all advance deterministically), the 3D canvas can be made
// to fill the whole viewport ("bleed"), and the camera is set directly through
// window.spotless.stage (OrbitControls; z is up, units are metres).
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The root of the repository, and puppeteer-core as the page's scripts use it. */
export const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const require = createRequire(REPO + 'apps/web/package.json');
const { launch } = await import(pathToFileURL(require.resolve('puppeteer-core')).href);
/** The Chrome or Chromium to film with: SPOTLESS_CHROME, or Google Chrome where macOS installs it
 * (the first place packages/render/src/headless/chrome.ts looks). */
export const CHROME = process.env.SPOTLESS_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/** Where clips are written unless --out says otherwise (git ignores .spotless/). */
export const CLIPS_DIR = process.env.SPOTLESS_VIDEO_CLIPS || REPO + '.spotless/video/clips';

export const SERVER = process.env.SPOTLESS_SERVER || 'http://127.0.0.1:8787';
export const LOADS = REPO + 'packages/loader/loads';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function post(path, body) {
  const r = await fetch(SERVER + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

export function readLoad(name) {
  return JSON.parse(readFileSync(`${LOADS}/${name}.json`, 'utf8'));
}

/** The actions of a saved load that change the scene (no queries, no wash). */
export function loadActions(load) {
  return load.action_log.filter((a) => a.kind === 'action' && a.name !== 'start_cycle');
}

export async function newSession(levelId) {
  return (await post('/api/sessions', { level_id: levelId })).session_id;
}

/** Sends one action. The server answers a refused action with 200 and accepted: false; a refused
 * action would film a different load from the one named, so it stops the capture. */
export async function act(sid, a) {
  const j = await post(`/api/sessions/${sid}/${a.name}`, a.args);
  if (j.accepted === false) throw new Error(`${a.name} ${a.args.item_id ?? a.args.rack ?? ''} refused: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

/** Replays a saved load (optionally only its first `upto` actions) into a new session. */
export async function replay(name, upto = Infinity) {
  const load = readLoad(name);
  const sid = await newSession(load.level.id);
  const actions = loadActions(load).slice(0, upto);
  for (const a of actions) await act(sid, a);
  return { sid, load, actions };
}

// Runs in the page before its own scripts: a clock and a frame loop the capture controls.
const MANUAL_TIME = `
(() => {
  const realNow = performance.now.bind(performance);
  const realRAF = window.requestAnimationFrame.bind(window);
  window.__manual = false;
  window.__clock = 0;
  let queued = [];
  performance.now = () => (window.__manual ? window.__clock : realNow());
  window.requestAnimationFrame = (cb) => {
    if (window.__manual) { queued.push(cb); return queued.length; }
    return realRAF(cb);
  };
  window.__enterManual = () => { window.__clock = realNow(); window.__manual = true; };
  window.__step = (ms) => {
    window.__clock += ms;
    const run = queued; queued = [];
    for (const cb of run) cb(window.__clock);
  };
  window.__queued = () => queued.length;
})();
`;

/**
 * Opens the page on a session. bleed: the 3D canvas fills the viewport and the UI is hidden.
 */
export async function openPage({ sid, width = 1080, height = 1350, dpr = 1, bleed = true, ui = false }) {
  if (!existsSync(CHROME)) throw new Error(`no browser at ${CHROME}: set SPOTLESS_CHROME to a Chrome or Chromium`);
  const browser = await launch({
    executablePath: CHROME,
    headless: true,
    args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--mute-audio', '--no-sandbox', `--window-size=${width},${height}`],
    defaultViewport: { width, height, deviceScaleFactor: dpr },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.evaluateOnNewDocument(MANUAL_TIME);
  await page.goto(`${SERVER}/#${sid}`, { waitUntil: 'networkidle0', timeout: 180000 });
  await page.waitForFunction(() => window.spotless && window.spotless.debugState().pending === 0 && window.spotless.stage, { timeout: 180000, polling: 200 });
  await sleep(500);
  if (bleed && !ui) await page.addStyleTag({ content: `
    #app > :not(#stage) { display: none !important; }
    #stage { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; margin: 0 !important; }
    #stage > :not(canvas) { display: none !important; }
    #stage > canvas { position: absolute !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; }
    #sound-panel, #sound-credits { display: none !important; }
  ` });
  await page.evaluate(() => { window.spotless.stage.resize(); window.spotless.setView('iso_lower'); });
  await sleep(300);
  return { browser, page };
}

export async function manual(page) {
  await page.evaluate(() => window.__enterManual());
}

/** Advances page time by n frames of 1/fps each (runs the page's frame loop once per frame). */
export async function step(page, n = 1, fps = 30) {
  await page.evaluate((n, ms) => { for (let i = 0; i < n; i++) window.__step(ms); }, n, 1000 / fps);
}

/** Camera from spherical coordinates about a target (degrees, metres; z up). */
export async function setCam(page, { az, el, dist, target, fov }) {
  await page.evaluate(({ az, el, dist, target, fov }) => {
    const st = window.spotless.stage;
    const cam = st.cameras.active;
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    st.controls.target.set(target[0], target[1], target[2]);
    cam.position.set(target[0] + dist * Math.cos(e) * Math.cos(a), target[1] + dist * Math.cos(e) * Math.sin(a), target[2] + dist * Math.sin(e));
    if (fov !== undefined && cam.fov !== undefined) { cam.fov = fov; cam.updateProjectionMatrix(); }
    st.controls.update();
  }, { az, el, dist, target, fov });
}

export async function getCam(page) {
  return page.evaluate(() => {
    const st = window.spotless.stage;
    const cam = st.cameras.active;
    const t = st.controls.target;
    const d = cam.position.clone().sub(t);
    const dist = d.length();
    return {
      az: (Math.atan2(d.y, d.x) * 180) / Math.PI,
      el: (Math.asin(d.z / dist) * 180) / Math.PI,
      dist, target: t.toArray(), fov: cam.fov,
    };
  });
}

export async function shoot(page, file) {
  await page.screenshot({ path: file, type: file.endsWith('.jpg') ? 'jpeg' : 'png', ...(file.endsWith('.jpg') ? { quality: 95 } : {}) });
}

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Interpolates two camera poses. */
export function camAt(a, b, t) {
  return {
    az: lerp(a.az, b.az, t), el: lerp(a.el, b.el, t), dist: lerp(a.dist, b.dist, t),
    target: a.target.map((v, i) => lerp(v, b.target[i], t)),
    fov: a.fov !== undefined && b.fov !== undefined ? lerp(a.fov, b.fov, t) : a.fov,
  };
}

export function outDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Screen position (CSS px) of the centre of each item, for labels that follow items in the edit. */
export async function track(page, ids) {
  return page.evaluate((ids) => {
    const st = window.spotless.stage;
    const cam = st.cameras.active;
    const w = st.canvas.clientWidth, h = st.canvas.clientHeight;
    const out = {};
    for (const id of ids) {
      const e = st.scene.items.get(id);
      if (!e) continue;
      const b = st.scene.factory.bounds(e.itemType);
      const v = cam.position.clone().set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
      e.object.updateMatrixWorld(true);
      e.object.localToWorld(v);
      v.project(cam);
      out[id] = [Math.round(((v.x + 1) / 2) * w), Math.round(((1 - v.y) / 2) * h), v.z < 1 ? 1 : 0];
    }
    return out;
  }, ids);
}
