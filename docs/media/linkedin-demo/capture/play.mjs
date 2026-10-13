// Captures a load being put into the machine, live: the page is opened on a fresh session, its
// clock is frozen, and every action is sent through the server's API while the page is stepped
// frame by frame, so the physics of each piece settling and each basket sliding is filmed at an
// exact 30 fps. The camera glides between the page's own views and drifts slowly.
//
//   node play.mjs --plan good|bad|load:<saved load> --out <dir> [--every 1] [--hold 8] [--wash fast]
//                 [--upto N] [--size 1080x1350] [--follow 1|0]
// Prints the session id (keep it: the washed session is filmed later with shoot.mjs).
import { writeFileSync } from 'node:fs';
import { act, camAt, ease, getCam, manual, newSession, openPage, outDir, post, readLoad, loadActions, setCam, shoot, sleep, step, SERVER } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const plan = opt('plan', 'good');
const dir = outDir(opt('out', './clip'));
const every = Number(opt('every', 1)); // capture every n-th page frame (time-lapse)
const hold = Number(opt('hold', 8)); // frames held after each action settles
const [W, H] = opt('size', '1080x1350').split('x').map(Number);
const drift = Number(opt('drift', 0.04)); // degrees of azimuth per captured frame

// The bad and good loads of apps/web/scripts/play-wash.ts (the same seven tutorial items).
const P = (item, frame, preset, x, y, z, yaw = 0, roll = 0) => ({ kind: 'action', name: 'place', args: { item_id: item, frame, position_mm: [x, y, z], orientation: { preset, yaw_deg: yaw, roll_deg: roll } } });
const R = (rack, name, value) => ({ kind: 'action', name: 'set_rack', args: { rack, option: { name, value } } });
const PLANS = {
  bad: [
    P('plate_01', 'lower_rack', 'upright', 250, 260, 260),
    P('plate_02', 'lower_rack', 'upright', 250, 300, 300),
    P('bowl_01', 'lower_rack', 'upright', 430, 100, 200),
    P('fork_01', 'lower_rack', 'flat', 300, 100, 300),
    P('knife_01', 'lower_rack', 'flat', 250, 330, 300),
    R('lower_rack', 'position', 'in'), R('upper_rack', 'position', 'out'),
    P('mug_01', 'upper_rack', 'upright', 250, 380, 130),
    P('glass_01', 'upper_rack', 'upright', 194, 150, 130),
    R('upper_rack', 'position', 'in'),
  ],
  good: [
    P('plate_01', 'lower_rack', 'on_edge', 143, 368, 227, 90),
    P('plate_02', 'lower_rack', 'on_edge', 70, 368, 227, 90),
    P('bowl_01', 'lower_rack', 'inverted', 420, 270, 200),
    P('fork_01', 'cutlery_basket', 'handle_down', 20, 28, 240, 0, 5),
    P('knife_01', 'cutlery_basket', 'handle_down', 108, 28, 240, 0, 5),
    R('lower_rack', 'position', 'in'), R('upper_rack', 'position', 'out'),
    P('mug_01', 'upper_rack', 'inverted', 250, 380, 130),
    P('glass_01', 'upper_rack', 'inverted', 160, 440, 130),
    R('upper_rack', 'position', 'in'),
  ],
};

let level = 'tutorial';
let actions;
if (plan.startsWith('load:')) {
  const load = readLoad(plan.slice(5));
  level = load.level.id;
  actions = loadActions(load).filter((a) => !(a.name === 'remove'));
} else actions = PLANS[plan];
actions = actions.slice(0, Number(opt('upto', 1e9)));

const sid = await newSession(level);
console.log('session', sid);
const { browser, page } = await openPage({ sid, width: W, height: H });
await manual(page);

// The page's own views, as camera poses, to glide between.
const viewCam = async (v) => { await page.evaluate((v) => window.spotless.setView(v), v); return getCam(page); };
// Tighter than the page's views, so that the pieces read on a phone (zoom: distance factor;
// shift: target offset in metres).
const framing = JSON.parse(opt('framing', '{"lower":{"zoom":0.64,"shift":[-0.02,-0.12,-0.04]},"upper":{"zoom":0.74,"shift":[0,-0.2,-0.02]},"whole":{"zoom":0.92,"shift":[0,0,0]}}'));
const framed = (c, f) => ({ ...c, dist: c.dist * f.zoom, target: c.target.map((v, i) => v + f.shift[i]) });
const camLower = framed(await viewCam('iso_lower'), framing.lower);
const camUpper = framed(await viewCam('iso_upper'), framing.upper);
const camWhole = framed(await viewCam('orbit'), framing.whole);
await setCam(page, camLower);
let cam = { ...camLower };
let frame = 0;
const meta = [];

async function capture(note = '') {
  await step(page, every);
  await shoot(page, `${dir}/${String(frame).padStart(4, '0')}.jpg`);
  meta.push({ frame, note });
  frame++;
}
async function glide(to, frames) {
  const from = { ...cam };
  for (let i = 1; i <= frames; i++) {
    cam = camAt(from, to, ease(i / frames));
    await setCam(page, cam);
    await capture('glide');
  }
}
const busy = () => page.evaluate(() => window.spotless.debugState().animating);

for (let i = 0; i < 6; i++) { cam.az += drift; await setCam(page, cam); await capture('start'); }
for (const a of actions) {
  if (a.name === 'set_rack' && a.args.option.value === 'out' && a.args.rack === 'upper_rack') {
    await glide({ ...camUpper, az: camUpper.az }, 18);
  }
  // Follow a basket going in: frame the whole machine before it slides. (The bad-load clip of
  // the video was filmed without this: --follow 0 reproduces its frame numbers.)
  if (opt('follow', '1') === '1' && a.name === 'set_rack' && a.args.option.value === 'in' && a.args.rack === 'lower_rack') {
    await glide({ ...camWhole, az: cam.az }, 20);
  }
  const t = Date.now();
  await act(sid, a);
  await sleep(400); // the frames come over the websocket
  let n = 0;
  while ((await busy()) && n < 400) { cam.az += drift; await setCam(page, cam); await capture(a.name + ' ' + (a.args.item_id ?? a.args.rack)); n++; }
  for (let i = 0; i < hold; i++) { cam.az += drift; await setCam(page, cam); await capture('hold'); }
  console.log(`${a.name} ${a.args.item_id ?? a.args.rack + ' ' + a.args.option?.value}: ${n} frames, ${Math.round((Date.now() - t) / 1000)} s`);
}
await glide(camWhole, 24);
for (let i = 0; i < 20; i++) { cam.az += drift; await setCam(page, cam); await capture('end'); }
writeFileSync(`${dir}/meta.json`, JSON.stringify({ sid, plan, frames: frame, size: [W, H], meta }, null, 1));
await browser.close();

if (opt('wash')) {
  const r = await post(`/api/sessions/${sid}/start_cycle?wash_tier=${opt('wash')}`, {});
  console.log('wash started', r.job_id);
}
console.log('done', sid, frame, 'frames');
