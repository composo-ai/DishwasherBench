// Films a session as it stands (typically after its wash, with the residue painted):
//
//   node shoot.mjs --sid <id> --mode orbit --out <dir> --frames 150
//        --path '[{"view":"orbit","zoom":0.9,"az":-70,"el":30},{"view":"orbit","zoom":0.6,"az":-30,"el":38,"shift":[0,0,0]}]'
//   node shoot.mjs --sid <id> --mode inspect --item mug_01 --out <dir> --frames 120 --turn 360 [--el 25] [--bg '#efd3b0']
//   node shoot.mjs --sid <id> --mode ui --out <file.png> [--size 1680x1050] [--view iso_lower]
//
// Camera keyframes are relative to one of the page's views (iso_lower, iso_upper, orbit, ...):
// az/el in degrees replace the view's, zoom scales its distance, shift moves its target (metres).
// Keyframes are spread evenly over the frames and eased.
import { writeFileSync } from 'node:fs';
import { camAt, ease, getCam, manual, openPage, outDir, setCam, shoot, sleep, step, track } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const sid = opt('sid');
const mode = opt('mode', 'orbit');
const frames = Number(opt('frames', 120));
const [W, H] = opt('size', mode === 'ui' ? '1680x1050' : '1080x1350').split('x').map(Number);

const { browser, page } = await openPage({ sid, width: W, height: H, bleed: mode === 'orbit', ui: mode === 'ui' });
// The report and the residue arrive after the scene: wait until the page has painted it.
await page.waitForFunction(() => { const s = window.spotless.debugState(); return s.pending === 0 && !s.animating; }, { timeout: 180000, polling: 250 });
await sleep(1500);
// The marks an agent's pictures carry (item ids, millimetre grid), drawn on the page's overlay.
if (opt('marks')) {
  const marks = opt('marks').split(',');
  await page.evaluate((m) => {
    const app = window.spotless;
    app.showLabels = m.includes('labels');
    app.showGrid = m.includes('grid');
    app.updateMarks();
  }, marks);
}
const state = await page.evaluate(() => window.spotless.debugState());
console.log('phase', state.phase, 'report', state.hasReport, 'painted', state.residuePainted);

if (mode === 'ui') {
  if (opt('view')) await page.evaluate((v) => window.spotless.setView(v), opt('view'));
  await sleep(800);
  await shoot(page, opt('out'));
} else if (mode === 'orbit') {
  const dir = outDir(opt('out'));
  await manual(page);
  const base = {};
  for (const k of JSON.parse(opt('path'))) {
    if (!base[k.view]) { await page.evaluate((v) => window.spotless.setView(v), k.view); base[k.view] = await getCam(page); }
  }
  const keys = JSON.parse(opt('path')).map((k) => {
    const b = base[k.view];
    return { az: k.az ?? b.az, el: k.el ?? b.el, dist: b.dist * (k.zoom ?? 1), fov: b.fov, target: b.target.map((v, i) => v + (k.shift?.[i] ?? 0)) };
  });
  // The scene does not move: draw the shadows once.
  await setCam(page, keys[0]);
  await step(page, 1);
  await page.evaluate(() => { window.spotless.stage.renderer.shadowMap.autoUpdate = false; });
  const t0 = Date.now();
  const tracks = [];
  for (let f = 0; f < frames; f++) {
    const u = frames === 1 ? 0 : f / (frames - 1);
    const seg = Math.min(keys.length - 2, Math.floor(u * (keys.length - 1)));
    const local = u * (keys.length - 1) - seg;
    const k = keys.length === 1 ? keys[0] : camAt(keys[seg], keys[seg + 1], opt('ease', 'whole') === 'segment' ? ease(local) : local);
    await setCam(page, k);
    await step(page, 1);
    await shoot(page, `${dir}/${String(f).padStart(4, '0')}.jpg`);
    if (opt('track')) tracks.push(await track(page, opt('track').split(',')));
    if (f % 20 === 0) console.log(`frame ${f}/${frames} ${((Date.now() - t0) / 1000 / (f + 1)).toFixed(2)} s/frame`);
  }
  writeFileSync(`${dir}/meta.json`, JSON.stringify({ sid, mode, frames, keys, tracks }));
} else if (mode === 'inspect') {
  const dir = outDir(opt('out'));
  const item = opt('item');
  await page.evaluate((id) => window.spotless.inspect(id), item);
  await page.waitForFunction(() => document.getElementById('inspector-view') && window.spotless.inspector, { timeout: 60000 });
  await sleep(1500);
  // The inspector's canvas lives in a dialog: take it out and let it fill the window.
  await page.evaluate(() => {
    const cv = document.getElementById('inspector-view');
    document.body.appendChild(cv);
    document.getElementById('app').style.display = 'none';
    for (const id of ['sound-panel', 'sound-credits']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '99999', borderRadius: '0', margin: '0' });
  });
  const bg = opt('bg');
  const turn = Number(opt('turn', 360));
  const el0 = Number(opt('el', 22));
  const el1 = Number(opt('el-end', el0));
  const zoom = Number(opt('zoom', 1));
  const az0 = Number(opt('az', -60));
  await page.evaluate((bg) => {
    const ins = window.spotless.inspector;
    ins.resize();
    if (bg) ins.scene.background.set(bg);
    ins.lookFrom('three_quarter');
  }, bg);
  await sleep(500);
  const r = await page.evaluate(() => { const ins = window.spotless.inspector; return { d: ins.camera.position.distanceTo(ins.controls.target), c: ins.controls.target.toArray() }; });
  for (let f = 0; f < frames; f++) {
    const u = f / frames;
    await page.evaluate(({ az, el, d, c }) => {
      const ins = window.spotless.inspector;
      const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
      ins.camera.position.set(c[0] + d * Math.cos(e) * Math.cos(a), c[1] + d * Math.cos(e) * Math.sin(a), c[2] + d * Math.sin(e));
      ins.controls.target.set(c[0], c[1], c[2]);
      ins.controls.update();
      ins.render();
    }, { az: az0 + turn * u, el: el0 + (el1 - el0) * ease(u), d: r.d * zoom, c: r.c });
    await shoot(page, `${dir}/${String(f).padStart(4, '0')}.jpg`);
  }
  writeFileSync(`${dir}/meta.json`, JSON.stringify({ sid, mode, item, frames, turn }, null, 1));
}
await browser.close();
console.log('done');
