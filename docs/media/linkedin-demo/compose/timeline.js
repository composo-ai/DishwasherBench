// DishwasherBench: "Who loaded the dishwasher like this?" (1080x1350, 30 fps).
//
// One story: the problem, then three chapters named above every caption (what we built, how it
// works, the AI test), then the invitation. Pacing rule: one new piece of text at a time;
// each stays readable for R(words) = max(3 s, 1.2 s + 0.4 s a word) before the next arrives
// (a chapter's first card counts its overline), and the last one until the middle of the
// cross-fade. Scenes cross-fade over XF seconds. Footage plays frame by frame at whole speeds
// (or holds); only camera moves on still scenes are blended. Every on-screen claim and its source
// is listed in ../README.md.
import { scene, el, ease, prog, clamp, lerp } from './engine/engine.js';
import { C, DISPLAY, TEXT, MONO, card, svgLayer, annot, label, retime, zoomRect, footage, stillImg } from './parts.js';
import { REPO } from './kit.js';

const F = 1 / 30;
const XF = 0.33;
// Written by prep.py.
const ASSETS = new URL('./build/assets/', import.meta.url).href;
const fill = (root, color) => el('div', null, root, { position: 'absolute', inset: '0', background: color });

// Reading time of n words, and when text that appears at `at` has been read.
const R = (n) => Math.max(3.0, 1.2 + 0.4 * n);
const read = (at, n) => at + 0.1 + R(n);
const TAIL = 0.17; // text is readable until the middle of the cross-fade out

// Chapters, as the caption card's overline (3 words each).
const CH = { built: 'What we built', how: 'How it works', ai: 'The AI test' };

// The scenes in order with their durations; each starts as the last one ends and fades in over XF.
// `need` is the pacing rule's minimum for the scene; a shorter duration is reported.
let clock = 0;
const SCENES = [];
function shot(name, d, need, build) {
  if (d + 1e-6 < need) console.error(`pacing: ${name} is ${d} s, needs ${need.toFixed(2)} s`);
  const start = clock;
  clock += d;
  SCENES.push({ name, start, d });
  scene({
    start: start === 0 ? 0 : start - XF,
    end: start + d,
    fadeIn: start === 0 ? 0 : XF,
    z: SCENES.length,
    build(root) {
      const update = build(root, d);
      // local time from the scene's own start (negative while it fades in)
      return (lt) => update(lt - (start === 0 ? 0 : XF));
    },
  });
}
const at0 = (t) => Math.max(0, t);
// Plays a clip of n frames forward then back at 1x from local time t0 (an orbit swings back).
const swing = (t, n, t0 = 0) => { const k = Math.max(0, t - t0) * 30, p = n - 1; const m = k % (2 * p); return m <= p ? m : 2 * p - m; };

// ======================================================= THE PROBLEM
// A plate dropped face up onto another, the bowl in mouth up; then the mug goes in mouth up.
const HOOK = { plates: retime([[35, 35, 1, 0.4], [35, 48, 0.5], [48, 110, 1]]) };
HOOK.mugAt = HOOK.plates.duration + 0.45; // the mug has landed by then (bad-load 350-353)
shot('hook', 7.1, read(Math.max(HOOK.mugAt, read(0, 6)), 3) + TAIL, (root) => {
  fill(root, C.peach);
  const B = footage(root, 'bad-load'); // the mug going in, under
  const A = footage(root, 'bad-load'); // the plates, dissolving away
  const svg = svgLayer(root);
  const T2 = HOOK.plates.duration;
  const mug = annot(root, svg, 'mug: mouth up', { x: 560, y: 440 });
  const c = card(root, ['Who loaded the', 'dishwasher <span data-c="red">like this?</span>'], { size: 80, inMode: 'settle' });
  return (t) => {
    const tt = at0(t);
    const k = tt - T2;
    const bo = clamp(k / (6 * F));
    B.show(Math.min(432, 344 + Math.max(0, k) * 30), zoomRect(lerp(1.0, 1.06, ease.inOut(clamp(k / 3.8))), 540, 800), k < 0 ? 0 : 1);
    A.show(HOOK.plates(Math.min(tt, T2)), zoomRect(lerp(1.12, 1.2, ease.inOut(clamp(tt / T2))), 680, 640), 1 - bo);
    mug.at(t, Math.max(HOOK.mugAt, read(0, 6)), 99, B.map([435, 700]));
    c.at(t, 0);
  };
});

// The upper basket goes in with the mug; the argument, and what we did about it.
shot('opinion', 6.3, Math.max(read(0, 12), read(1.2, 8)) + TAIL, (root) => {
  fill(root, C.peach);
  const v = footage(root, 'bad-load');
  const c = card(root, ['Everyone has an opinion.', { html: 'So we built a game to <span data-c="blue">score it.</span>', at: 1.2 }]);
  return (t) => {
    v.show(Math.min(611, 432 + at0(t) * 30), zoomRect(lerp(1.06, 1.0, ease.inOut(clamp(t / 6.3))), 540, 800));
    c.at(t, 0);
  };
});

// ======================================================= WHAT WE BUILT
// The hero shot of the game takes up the slack that puts the cut to the test wash and 'The AI
// test' on the music's two entries, 54.45 s apart (mix_audio.sh).
const SIM_D = 6.05;
shot('real', 4.7, read(0, 5 + 3) + TAIL, (root) => {
  fill(root, '#222');
  const p = stillImg(root, ASSETS + 'tape.jpg', [1188, 1485], [0, 0, 1080, 1350]);
  const c = card(root, ['One real dishwasher,', 'photographed, measured…'], { overline: CH.built });
  return (t) => {
    const z = lerp(1.0, 1.07, ease.inOut(clamp((t + XF) / (4.7 + XF))));
    const ax = 120 * 1.1, ay = 600 * 1.1;
    p.show([ax - ax / z, ay - ay / z, 1188 / z, 1485 / z]);
    c.at(t, 0);
  };
});

// The real test wash: an egg-yolk plate before, and after (a little egg left at the top right).
shot('realwash', 4.6, read(0, 5) + TAIL, (root, d) => {
  fill(root, '#222');
  const before = stillImg(root, ASSETS + 'egg-before.jpg', [1134, 1418], [0, 0, 1080, 1350]);
  const afterWrap = el('div', null, root, { position: 'absolute', inset: '0', WebkitMaskImage: 'linear-gradient(90deg, #000 0, #000 calc(var(--w) - 40px), transparent var(--w))', maskImage: 'linear-gradient(90deg, #000 0, #000 calc(var(--w) - 40px), transparent var(--w))' });
  const after = stillImg(afterWrap, ASSETS + 'egg-after.jpg', [1134, 1418], [0, 0, 1080, 1350]);
  const c = card(root, ['…test-washed with egg yolk…'], { overline: CH.built, bottom: 120 });
  const zr = (z, W, H) => { const cx = W / 2, cy = H / 2; return [cx - W / z / 2, cy - H / z / 2, W / z, H / z]; };
  return (t) => {
    const W = 1134, H = 1418, base = 1134 / 1080;
    before.show(zr(base * lerp(1.0, 1.04, clamp((t + XF) / 2.0)), W, H));
    const wp = clamp((t - 1.6) / (14 * F));
    afterWrap.style.setProperty('--w', `${wp * 1120}px`);
    afterWrap.style.display = wp > 0 ? 'block' : 'none';
    after.show(zr(base * lerp(1.0, 1.04, clamp((t - 1.6) / (d - 1.6))), W, H));
    c.at(t, 0);
  };
});

// The hardest level in the game, loaded by the scripted careful player (a slow camera move).
shot('sim', SIM_D, read(0, 10) + TAIL, (root, d) => {
  fill(root, C.peachDp);
  const v = footage(root, 'dp-hero', [0, 160, 1080, 1350], { blend: true });
  const c = card(root, ['…rebuilt as <span data-c="blue">DishwasherBench</span>:', 'a physics game for you and AI.'], { overline: CH.built });
  return (t) => {
    v.show(45 + (t + XF) * (164 - 45) / (d + XF));
    c.at(t, 0);
  };
});

// ======================================================= HOW IT WORKS
const LOAD = { src: retime([[6, 51, 1], [62, 92, 1], [98, 122, 1], [184, 264, 2], [293, 338, 2], [345, 384, 1]]), words: 2 + 6 + 2 + 3 };
LOAD.dissolve = [0, 6, 6, 0, 0, 6]; // frames of dissolve into each part; none where the framing jumps
shot('load', 9.8, read(read(0, LOAD.words), 3) + TAIL, (root, d) => {
  fill(root, C.peach);
  const B = footage(root, 'good-load'); // under: the outgoing frame of a dissolve
  const A = footage(root, 'good-load');
  const svg = svgLayer(root);
  const src = LOAD.src;
  const cutAt = src.parts.map((p) => p.t0);
  const mug = annot(root, svg, 'mug: mouth down', { x: 560, y: 500, color: C.green });
  const c = card(root, [{ html: 'Load it.', size: 120, weight: 900 }, 'The 7 dishes from the start,', 'loaded well.'], { overline: CH.how });
  return (t) => {
    const end = src.duration;
    const tt = at0(t);
    let rect = [0, 0, 1080, 1350];
    if (tt > end) rect = zoomRect(lerp(1.0, 1.06, ease.inOut(clamp((tt - end) / (d - end)))), 440, 740);
    A.show(src(Math.min(tt, end - 1e-6)), rect);
    let bo = 0;
    for (let i = 1; i < src.parts.length; i++) {
      const k = tt - cutAt[i];
      const n = LOAD.dissolve[i];
      if (n && k >= 0 && k < n * F) { bo = 1 - k / (n * F); B.show(src.parts[i - 1].b, rect, 1); break; }
    }
    A.s.wrap.style.opacity = String(bo > 0 ? 1 - bo : 1);
    B.s.wrap.style.display = bo > 0 ? 'block' : 'none';
    mug.at(t, read(0, LOAD.words), 99, A.map([435, 735]));
    c.at(t, 0);
  };
});

// Both loads go into the wash (the game's quick wash, said in the caption).
shot('wash', 4.6, read(0, 6) + TAIL, (root, d) => {
  fill(root, C.peach);
  const mk = (id, frame, x, ring) => {
    const wrap = el('div', null, root, { position: 'absolute', left: x + 'px', top: '400px', width: '508px', height: '600px', overflow: 'hidden', borderRadius: '18px', boxShadow: `0 0 0 6px ${ring}, 0 14px 36px rgba(60,40,20,.22)` });
    const v = footage(wrap, id, [0, 0, 508, 600]);
    return { wrap, v, frame };
  };
  const L = mk('bad-load', 611, 24, C.red);
  const Rr = mk('good-load', 492, 548, C.green);
  const box = el('div', null, root, { position: 'absolute', left: '48px', top: '1040px', width: '984px', height: '64px', boxSizing: 'border-box', padding: '0 32px', display: 'flex', alignItems: 'center', background: '#fff', borderRadius: '20px', boxShadow: '0 8px 28px rgba(28,36,48,.12)' });
  const track = el('div', null, box, { position: 'relative', flex: '1', height: '14px', borderRadius: '7px', background: '#e3e8ef', overflow: 'hidden' });
  const bar = el('div', null, track, { height: '14px', background: C.blue, borderRadius: '7px' });
  const c = card(root, [{ html: 'Wash it.', size: 120, weight: 900 }, 'Eco 50, quick simulation.'], { overline: CH.how });
  return (t) => {
    const sl = ease.out(clamp((t + XF) / 0.6));
    for (const [P, dir] of [[L, -1], [Rr, 1]]) {
      const z = lerp(1.0, 1.1, ease.inOut(clamp(t / d)));
      const r = [370, 200, 640, 756];
      const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
      P.v.show(P.frame, [cx - r[2] / z / 2, cy - r[3] / z / 2, r[2] / z, r[3] / z]);
      P.wrap.style.transform = `translateX(${(1 - sl) * dir * 560}px)`;
    }
    box.style.opacity = String(clamp((t - 0.5) / (8 * F)));
    bar.style.width = lerp(3, 100, ease.inOut(clamp((t - 0.6) / (d - 1.0)))) + '%';
    c.at(t, 0);
  };
});

// The mouth-up mug, close up: soil left behind and the water that stood in it; then the same
// mug loaded mouth down beside it, and both verdicts.
const SCORE = { ml: read(0, 6) };
SCORE.split = read(SCORE.ml, 7);
SCORE.verdicts = read(SCORE.split, 7);
shot('score', 17.8, read(SCORE.verdicts, 6 + 5) + TAIL, (root) => {
  fill(root, C.peachInsp);
  const { ml, split, verdicts } = SCORE;
  const big = [48, 230, 864, 1080], left = [24, 330, 508, 635], right = [548, 330, 508, 635];
  const full = [0, 0, 1080, 1350], close = [130, 170, 820, 1025];
  const panel = () => el('div', null, root, { position: 'absolute', overflow: 'hidden', background: C.peachInsp });
  const PL = panel(), PR = panel();
  const Lf = footage(PL, 'mug-turntable-slow'), Rf = footage(PR, 'good-mug-turntable');
  const place = (P, f, b, rect, frame) => {
    const [x, y, w, h] = b;
    Object.assign(P.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    f.s.frame(frame);
    f.s.set(rect, [0, 0, w, h], 1);
  };
  const mix = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));
  const num = el('div', null, root, { position: 'absolute', left: '72px', top: '1190px', transform: 'translateY(-100%)', font: `900 110px/1 ${DISPLAY}`, letterSpacing: '-0.03em', color: C.magenta });
  num.textContent = '319 ml';
  const sub = el('div', null, root, { position: 'absolute', left: '436px', top: '1180px', transform: 'translateY(-100%)', font: `700 44px/1 ${DISPLAY}`, color: C.ink, whiteSpace: 'nowrap' });
  sub.textContent = 'of water stood in it.';
  // The mug as it was loaded, ringed: first beside the close-up, then in each panel.
  const thumb = (parent, id, frame, box, color) => {
    const f = footage(parent, id, box, { radius: box[2] / 2 });
    f.s.wrap.style.boxShadow = `0 0 0 6px ${color}, 0 8px 20px rgba(28,36,48,.25)`;
    f.show(frame, [285, 585, 300, 300]);
    return f;
  };
  const inset = thumb(root, 'bad-load', 363, [870, 380, 170, 170], C.red);
  const il = thumb(PL, 'bad-load', 363, [342, 469, 150, 150], C.red);
  const ir = thumb(PR, 'good-load', 362, [342, 469, 150, 150], C.green);
  const vl = label(root, 'Not clean · 0 of 6 pts', { x: 278, y: 985, color: C.red, center: true });
  const vr = label(root, 'Clean · 6 of 6 pts', { x: 802, y: 985, color: C.green, center: true });
  const c1 = card(root, [{ html: 'Score it.', size: 120, weight: 900 }, '<span data-c="magenta">Magenta</span> = soil left behind.'], { overline: CH.how });
  const c2 = card(root, ['The same mug, loaded', 'mouth down: <span data-c="green">clean.</span>'], { overline: CH.how });
  return (t) => {
    const tt = at0(t);
    const p = ease.inOut(clamp((tt - split) / 0.6));
    const lf = tt < split ? Math.min(215, tt * 30) : Math.max(0, 215 - (tt - split) * 30);
    place(PL, Lf, mix(big, left, p), mix(full, close, p), lf);
    PL.style.borderRadius = 18 * p + 'px';
    PL.style.boxShadow = p > 0 ? `0 14px 36px rgba(60,40,20,${0.2 * p})` : 'none';
    PR.style.display = p > 0 ? 'block' : 'none';
    place(PR, Rf, right, close, Math.min(149, Math.max(0, tt - split) * 30));
    Object.assign(PR.style, { borderRadius: '18px', boxShadow: '0 14px 36px rgba(60,40,20,.2)', opacity: String(p), transform: `translateX(${(1 - p) * 560}px)` });
    inset.s.wrap.style.opacity = String(Math.min(clamp((tt - 1.0) / (8 * F)), 1 - clamp((tt - split) / (6 * F))));
    for (const f of [il, ir]) f.s.wrap.style.opacity = String(clamp((tt - split - 0.6) / (6 * F)));
    if (!sub.dataset.placed) { sub.style.left = 72 + num.offsetWidth + 22 + 'px'; sub.dataset.placed = '1'; }
    const pn = Math.min(ease.out(clamp((tt - ml) / (8 * F))), 1 - clamp((tt - split) / (6 * F)));
    num.style.opacity = String(pn); sub.style.opacity = String(pn);
    num.style.transform = sub.style.transform = `translateY(calc(-100% + ${(1 - pn) * 20}px))`;
    vl.at(t, verdicts); vr.at(t, verdicts);
    c1.at(t, 0, split); c2.at(t, split);
  };
});

const TOTALS = { block: read(0, 11) };
shot('totals', 11.6, read(TOTALS.block, 4 + 2 + 5) + TAIL, (root) => {
  fill(root, C.cream);
  const B0 = TOTALS.block;
  const col = (cx, id, frame, ring, name) => {
    const circ = el('div', null, root, { position: 'absolute', left: cx - 140 + 'px', top: '400px', width: '280px', height: '280px', borderRadius: '50%', overflow: 'hidden', boxShadow: `0 0 0 6px ${ring}, 0 12px 30px rgba(60,40,20,.2)` });
    const v = footage(circ, id, [0, 0, 280, 280]);
    v.show(frame, [285, 585, 300, 300]);
    const n = el('div', null, root, { position: 'absolute', left: cx - 200 + 'px', width: '400px', top: '700px', textAlign: 'center', font: `700 44px/1.1 ${DISPLAY}`, color: ring });
    n.textContent = name;
    const num = el('div', null, root, { position: 'absolute', left: cx - 250 + 'px', width: '500px', top: '770px', textAlign: 'center', font: `900 220px/0.95 ${DISPLAY}`, letterSpacing: '-0.05em', color: C.ink });
    return { circ, n, num };
  };
  const Lc = col(290, 'bad-load', 363, C.red, 'Bad load');
  const Rc = col(790, 'good-load', 362, C.green, 'Good load');
  Lc.num.textContent = '14'; Rc.num.textContent = '34';
  const arrow = el('div', null, root, { position: 'absolute', left: '540px', top: '880px', transform: 'translate(-50%,-50%)', font: `900 96px/1 ${DISPLAY}`, color: C.blue });
  arrow.textContent = '→';
  const pts = el('div', null, root, { position: 'absolute', left: '0', width: '1080px', top: '1005px', textAlign: 'center', font: `600 42px/1.1 ${TEXT}`, color: C.ink });
  pts.textContent = 'points, of 44 in play';
  const c = card(root, ['Same 7 dishes, with the mug,', 'bowl and glass mouth down:'], { overline: CH.how });
  return (t) => {
    const rise = (k) => { const p = ease.out(clamp(k / (8 * F))); return [p, (1 - p) * 40]; };
    const [cl, cyl] = rise(t - 0.4), [cr, cyr] = rise(t - 0.7);
    const [pl, yl] = rise(t - B0), [pr, yr] = rise(t - B0 - 0.4);
    for (const [cc, q, cy, p, y] of [[Lc, cl, cyl, pl, yl], [Rc, cr, cyr, pr, yr]]) {
      cc.circ.style.opacity = String(q); cc.circ.style.transform = `translateY(${cy}px)`;
      for (const e of [cc.n, cc.num]) { e.style.opacity = String(p); e.style.transform = `translateY(${y}px)`; }
    }
    arrow.style.opacity = String(clamp((t - B0 - 0.6) / (6 * F)));
    pts.style.opacity = String(clamp((t - B0 - 0.8) / (6 * F)));
    c.at(t, 0);
  };
});

// ======================================================= THE AI TEST
// One model's own pictures: its load from above, then a labelled three-quarter view.
const MODELS = { c2: read(0, 6 + 3) };
shot('models', 10.4, read(MODELS.c2, 10) + TAIL, (root, d) => {
  fill(root, C.peach);
  const B2 = MODELS.c2;
  const frame = el('div', null, root, { position: 'absolute', left: '60px', top: '330px', width: '960px', height: '960px', overflow: 'hidden', borderRadius: '16px', boxShadow: '0 16px 44px rgba(60,40,20,.25)', background: '#fff', isolation: 'isolate' });
  const imgs = ['0091', '0052'].map((n) => {
    const i = el('img', null, frame, { position: 'absolute', left: '0', top: '0', width: '960px', height: '960px', transformOrigin: '50% 55%' });
    i.src = REPO + `docs/benchmark/first-runs/course/astra-dinner-party/images/${n}-render.png`;
    return i;
  });
  el('div', null, frame, { position: 'absolute', left: '0', top: '0', width: '960px', height: Math.ceil(24 * 960 / 768) + 'px', background: C.peach, zIndex: '5' });
  const c1 = card(root, ['Then we let AI models play.'], { overline: CH.ai });
  const c2 = card(root, ['They ask for labelled pictures,', 'then act through 13 tools.'], { overline: CH.ai });
  return (t) => {
    imgs[1].style.opacity = String(clamp((t - B2) / (12 * F)));
    imgs[0].style.transform = `scale(${lerp(1.0, 1.08, ease.inOut(clamp((t + XF) / (B2 + XF))))})`;
    imgs[1].style.transform = `scale(${lerp(1.0, 1.1, ease.inOut(clamp((t - B2) / (d - B2))))})`;
    c1.at(t, 0, B2);
    c2.at(t, B2);
  };
});

// The frying pan (level 4; record seq 25-27, then 64-67).
const PAN = { c2: read(0, 11) };
PAN.reply = read(PAN.c2, 7);
PAN.c3 = read(PAN.reply, 6);
PAN.punch = read(PAN.c3, 6);
shot('pan', 20.6, read(PAN.punch, 1) + TAIL, (root, d) => {
  fill(root, C.peach);
  const { c2: B2, reply: RP, c3: B3, punch } = PAN;
  const stage = el('div', null, root, { position: 'absolute', inset: '0', transformOrigin: '379px 847px' });
  const imgs = ['0027', '0064'].map((n) => {
    const i = el('img', null, stage, { position: 'absolute', left: '41px', top: '262px', width: '998px', height: '998px' });
    i.src = REPO + `docs/benchmark/first-runs/course/sol-breakfast/images/${n}-render.png`;
    return i;
  });
  el('div', null, stage, { position: 'absolute', left: '41px', top: '262px', width: '998px', height: Math.ceil(24 * 998 / 768) + 'px', background: C.peach });
  const svg = svgLayer(stage);
  const ring = svg.make('ellipse', { cx: 379, cy: 847, rx: 135, ry: 115, fill: 'none', 'stroke-width': 7 });
  const perim = Math.PI * (3 * (135 + 115) - Math.sqrt((3 * 135 + 115) * (135 + 3 * 115)));
  const cross = el('div', null, stage, { position: 'absolute', left: '379px', top: '847px', transform: 'translate(-50%,-50%)', font: `900 150px/1 ${DISPLAY}`, color: C.red, textShadow: '0 0 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff, 2px 0 0 #fff, -2px 0 0 #fff' });
  cross.textContent = '✕';
  const chip = el('div', null, root, { position: 'absolute', left: '150px', top: '1010px', width: '780px', height: '138px', boxSizing: 'border-box', padding: '16px 28px', background: '#fff', border: `3px solid ${C.red}`, borderRadius: '16px', boxShadow: '0 10px 28px rgba(28,36,48,.18)' });
  chip.innerHTML = `<div style="font:700 32px/1 ${TEXT};color:${C.muted};letter-spacing:.04em">THE GAME’S REPLY</div><div style="font:500 38px/1.6 ${MONO};color:${C.red};white-space:nowrap">"blocked_by":["frying_pan_01"]</div>`;
  const c1 = card(root, ['One model took out the', 'cutlery basket to fit a pan.'], { overline: CH.ai });
  const c2 = card(root, ['Then the basket', 'wouldn’t go back in.'], { overline: CH.ai });
  const c3 = card(root, ['So it took the pan out.', { html: '<span data-c="blue">Relatable.</span>', at: punch - B3 }], { overline: CH.ai });
  return (t) => {
    stage.style.transform = `scale(${lerp(1.0, 1.12, ease.inOut(clamp(t / d)))})`;
    imgs[1].style.opacity = String(clamp((t - B3) / (10 * F)));
    const dr = clamp((t - 1.6) / (12 * F));
    ring.setAttribute('stroke', t >= RP ? C.red : C.blue);
    if (t < B3) { ring.setAttribute('stroke-dasharray', `${perim * dr} ${perim}`); ring.style.opacity = dr > 0 ? '1' : '0'; }
    else { ring.setAttribute('stroke-dasharray', '18 14'); ring.style.opacity = String(1 - clamp((t - B3) / (12 * F))); }
    const ci = ease.out(clamp((t - RP) / (8 * F)));
    const shake = t >= RP + 0.1 && t < RP + 0.1 + 4 * F ? (Math.round((t - RP - 0.1) / F) % 2 ? 3 : -3) : 0;
    chip.style.display = t < RP ? 'none' : 'block';
    chip.style.opacity = String(Math.min(ci, 1 - clamp((t - B3) / (8 * F))));
    chip.style.transform = `translate(${shake}px, ${(1 - ci) * 60}px)`;
    const xk = t - B3 - 0.3;
    cross.style.display = xk < 0 ? 'none' : 'block';
    cross.style.opacity = String(clamp(xk / (3 * F)));
    cross.style.transform = `translate(-50%,-50%) scale(${lerp(1.4, 1.0, ease.out(clamp(xk / (5 * F))))})`;
    c1.at(t, 0, B2); c2.at(t, B2, B3); c3.at(t, B3);
  };
});

// Callback: the mistake of the opening is the one the models never made.
shot('callback', 5.4, read(0, 9) + TAIL, (root, d) => {
  fill(root, C.peachRender);
  const O = [550, 580];
  const stage = el('div', null, root, { position: 'absolute', inset: '0', transformOrigin: `${O[0]}px ${O[1]}px` });
  const img = el('img', null, stage, { position: 'absolute', left: '41px', top: '292px', width: '998px', height: '998px' });
  img.src = REPO + 'docs/benchmark/first-runs/course/sol-tutorial/images/0029-render.png';
  el('div', null, stage, { position: 'absolute', left: '41px', top: '292px', width: '998px', height: Math.ceil(24 * 998 / 768) + 'px', background: C.peachRender });
  const rings = svgLayer(stage);
  const r1 = rings.make('circle', { cx: 431, cy: 557, r: 78, fill: 'none', stroke: C.green, 'stroke-width': 7 });
  const r2 = rings.make('circle', { cx: 669, cy: 609, r: 95, fill: 'none', stroke: C.green, 'stroke-width': 7 });
  const c = card(root, ['Two models, six games:', 'no mug or bowl mouth up.'], { overline: CH.ai });
  return (t) => {
    stage.style.transform = `scale(${lerp(1.0, 1.1, ease.inOut(clamp(t / d)))})`;
    for (const [r, a, Rr] of [[r1, 2.8, 78], [r2, 3.1, 95]]) {
      const p = ease.outBack(clamp((t - a) / (8 * F)));
      r.setAttribute('r', String(Rr * Math.max(0.01, p)));
      r.style.opacity = t < a ? '0' : '1';
    }
    c.at(t, 0);
  };
});

// Results on the biggest level, against the scripted players; the chart then has time of its own.
shot('results', 9.0, read(0, 10) + 3.0 + TAIL, (root) => {
  fill(root, C.cream);
  const scale = 840 / 367;
  const rows = [
    { y: 560, name: 'Careful (scripted)', v: 250, color: 'rgba(28,36,48,.65)' },
    { y: 710, name: '2 AI models', v: 260, v2: 274, color: C.blue, ai: true },
  ];
  const axis = el('div', null, root, { position: 'absolute', left: '72px', top: '540px', width: '3px', height: '0px', background: 'rgba(28,36,48,.35)' });
  const els = rows.map((r) => {
    const lab = el('div', null, root, { position: 'absolute', left: '90px', top: r.y + 'px', font: `600 38px/1 ${TEXT}`, color: r.ai ? C.blue : C.ink });
    lab.textContent = r.name;
    const bar = el('div', null, root, { position: 'absolute', left: '72px', top: r.y + 48 + 'px', height: '56px', width: '0px', background: r.color, borderRadius: '0 10px 10px 0' });
    const ext = r.ai ? el('div', null, root, { position: 'absolute', top: r.y + 48 + 'px', height: '56px', width: '0px', background: 'rgba(21,96,212,.45)', borderRadius: '0 10px 10px 0' }) : null;
    const val = el('div', null, root, { position: 'absolute', top: r.y + 54 + 'px', font: `700 44px/1 ${DISPLAY}`, color: r.ai ? C.blue : C.ink, whiteSpace: 'nowrap' });
    val.textContent = r.ai ? '260 · 274' : String(r.v);
    return { r, lab, bar, ext, val };
  });
  const note = el('div', null, root, { position: 'absolute', left: '90px', top: '860px', font: `600 38px/1 ${TEXT}`, color: 'rgba(28,36,48,.8)' });
  note.textContent = 'points, of 367';
  const c = card(root, ['On the biggest level, both beat', 'our scripted ‘careful’ player.'], { overline: CH.ai });
  return (t) => {
    axis.style.height = 290 * ease.out(clamp((t - 0.3) / (8 * F))) + 'px';
    els.forEach((e) => {
      const a = e.r.ai ? 1.4 : 0.6;
      const p = ease.out(clamp((t - a) / 0.8));
      const w = e.r.v * scale * p;
      e.bar.style.width = w + 'px';
      let end = 72 + w;
      if (e.ext) {
        const w2 = (e.r.v2 - e.r.v) * scale * ease.out(clamp((t - 2.2) / 0.4));
        e.ext.style.left = 72 + w + 'px'; e.ext.style.width = w2 + 'px'; end += w2; e.bar.style.borderRadius = '0';
      }
      e.val.style.left = end + 16 + 'px';
      e.val.style.opacity = String(clamp((t - a - (e.r.ai ? 1.25 : 0.7)) / (5 * F)));
      e.lab.style.opacity = String(clamp((t - a + 0.2) / 0.3));
    });
    note.style.opacity = String(clamp((t - 2.8) / (6 * F)));
    c.at(t, 0);
  };
});

// Two beats: the invitation, then where to find it (with the page's disclaimer verbatim).
const END = { cta: read(0, 1 + 4 + 4) };
shot('end', 13.8, read(END.cta, 12 + 1 + 6), (root) => {
  fill(root, C.cream);
  const mugBox = el('div', null, root, { position: 'absolute', left: '410px', top: '44px', width: '260px', height: '325px', overflow: 'hidden', borderRadius: '26px', background: C.peachInsp, boxShadow: '0 12px 30px rgba(60,40,20,.18)' });
  const mug = footage(mugBox, 'mug-turntable-slow', [0, 0, 260, 325]);
  const items = [];
  const line = (html, top, font, color, at, extra = {}) => {
    const e = el('div', null, root, { position: 'absolute', left: '72px', width: '936px', top: top + 'px', textAlign: 'center', font, color, ...extra });
    e.innerHTML = html;
    items.push({ e, at });
    return e;
  };
  const B = END.cta;
  line('DishwasherBench', 404, `900 96px/1 ${DISPLAY}`, C.ink, 0, { letterSpacing: '-0.035em' });
  line('No human baseline yet.', 520, `800 60px/1.1 ${DISPLAY}`, C.ink, 0.15, { letterSpacing: '-0.022em' });
  line('Fancy being the first?', 586, `800 60px/1.1 ${DISPLAY}`, C.blue, 0.3, { letterSpacing: '-0.022em' });
  line('Clone it and play in a browser,<br>or plug in your agent:', 690, `600 40px/1.2 ${TEXT}`, C.muted, B);
  line('github.com/composo-ai/DishwasherBench', 800, `700 46px/1.2 ${TEXT}`, '#9c4a2f', B + 0.15, { letterSpacing: '-0.01em', whiteSpace: 'nowrap' });
  line('v0.1.0 · open source (MIT) · by Composo', 874, `600 38px/1.2 ${TEXT}`, C.ink, B + 0.3);
  line('A simulation of one machine, with many estimated parameters. Not affiliated with or endorsed by the makers of the products named; a verdict here says nothing about a real product.', 958, `400 31px/1.35 ${TEXT}`, 'rgba(28,36,48,.8)', B + 1.0);
  line('Music: Yoiyami (CC0)', 1140, `400 31px/1.2 ${TEXT}`, 'rgba(28,36,48,.8)', B + 1.0);
  return (t) => {
    mug.show(swing(t, 216), [130, 170, 820, 1025]);
    mugBox.style.opacity = String(clamp((t + XF) / (8 * F)));
    for (const { e, at } of items) {
      const p = ease.out(clamp((t - at) / (10 * F)));
      e.style.opacity = String(p);
      e.style.transform = `translateY(${(1 - p) * 12}px)`;
    }
  };
});

export const DURATION = clock;
export const SHOTS = SCENES;
