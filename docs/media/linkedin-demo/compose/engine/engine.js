// A tiny deterministic motion-graphics engine: every frame is a pure function of time.
// window.seek(t) lays out the stage for time t (seconds) and resolves once every visible
// image is decoded, so a renderer can screenshot frame after frame in any order.

export const W = 1080;
export const H = 1350;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/** Progress of t through [a, b], eased, clamped to 0..1. */
export const prog = (t, a, b, e = ease.inOut) => e(clamp((t - a) / Math.max(1e-6, b - a)));

/** Interpolates keyframes [[time, value], ...] (value: number or array of numbers). */
export function kf(frames, t, e = ease.inOut) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, v0] = frames[i];
    const [t1, v1] = frames[i + 1];
    if (t <= t1) {
      const p = e(clamp((t - t0) / Math.max(1e-6, t1 - t0)));
      return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], p)) : lerp(v0, v1, p);
    }
  }
  return frames[frames.length - 1][1];
}

/** Opacity envelope for something visible over [a, b] with fade-in fi and fade-out fo. */
export function envelope(t, a, b, fi = 0.4, fo = 0.4) {
  if (t < a || t > b) return 0;
  const i = fi > 0 ? clamp((t - a) / fi) : 1;
  const o = fo > 0 ? clamp((b - t) / fo) : 1;
  return Math.min(ease.inOut(i), ease.inOut(o));
}

export function el(tag, cls, parent, style) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  if (parent) parent.appendChild(e);
  return e;
}

// ---------------------------------------------------------------- images

const pending = new Set();

/** Sets an <img> src and tracks its decode so seek() can wait for it. */
function setSrc(img, src) {
  if (img.dataset.src === src) return;
  img.dataset.src = src;
  img.src = src;
  const p = img.decode().catch(() => { window.__missing = (window.__missing || []).concat(src); }).finally(() => pending.delete(p));
  pending.add(p);
}

/**
 * A cropped view of an image: `rect` [x, y, w, h] in source pixels is fitted (cover) into
 * the box [bx, by, bw, bh] in stage pixels. Animate rect for pans and zooms.
 */
export class Crop {
  constructor(parent, { src, size, box, radius = 0, shadow = false, bg = null, border = null }) {
    this.size = size;
    this.box = box;
    this.wrap = el('div', 'crop', parent, {
      position: 'absolute',
      overflow: 'hidden',
      borderRadius: radius + 'px',
      boxShadow: shadow ? '0 24px 60px rgba(40,30,20,.28), 0 4px 14px rgba(40,30,20,.18)' : 'none',
      background: bg || 'transparent',
      border: border || 'none',
    });
    this.img = el('img', null, this.wrap, { position: 'absolute', left: 0, top: 0, maxWidth: 'none' });
    if (src) setSrc(this.img, src);
  }
  src(s, size) {
    if (size) this.size = size;
    setSrc(this.img, s);
  }
  set(rect, box = this.box, opacity = 1, extra = {}) {
    const [bx, by, bw, bh] = box;
    const [cx, cy, cw, ch] = rect;
    const s = Math.max(bw / cw, bh / ch);
    const [sw, sh] = this.size;
    Object.assign(this.wrap.style, {
      left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px',
      opacity: String(opacity), display: opacity <= 0.001 ? 'none' : 'block',
      transform: extra.transform || 'none',
    });
    const geo = {
      width: sw * s + 'px',
      height: sh * s + 'px',
      left: -cx * s + (bw - cw * s) / 2 + 'px',
      top: -cy * s + (bh - ch * s) / 2 + 'px',
    };
    Object.assign(this.img.style, geo);
    if (this.next) Object.assign(this.next.style, geo);
  }
}

/**
 * An image sequence (live footage) shown through a Crop. A fractional frame position shows the
 * nearest frame; with `blend`, it cross-fades the two frames either side instead, which reads as
 * motion blur on a slow camera move but as a double exposure on anything that falls.
 */
export class Seq extends Crop {
  constructor(parent, { pattern, count, size, box, fps = 30, radius = 0, shadow = false, bg = null, blend = false }) {
    super(parent, { src: null, size, box, radius, shadow, bg });
    this.pattern = pattern;
    this.count = count;
    this.fps = fps;
    this.blend = blend;
    this.next = el('img', null, this.wrap, { position: 'absolute', left: 0, top: 0, maxWidth: 'none', opacity: '0' });
  }
  name(n) {
    return this.pattern.replace(/%0(\d)d/, (_, w) => String(n).padStart(Number(w), '0'));
  }
  frame(i) {
    const x = Math.max(0, Math.min(this.count - 1, this.blend ? i : Math.round(i)));
    const n = Math.floor(x + 1e-6);
    const f = x - n;
    // Whole frames (within a hair) show one image; others blend towards the next.
    const blend = f > 0.02 && f < 0.98 && n + 1 < this.count;
    this.src(this.name(f >= 0.98 ? Math.min(this.count - 1, n + 1) : n));
    if (blend) setSrc(this.next, this.name(n + 1));
    this.next.style.opacity = blend ? String(f) : '0';
  }
  at(localT, speed = 1) {
    this.frame(localT * this.fps * speed);
  }
}

// ---------------------------------------------------------------- timeline

const scenes = [];

/**
 * Registers a scene active over [start, end] (seconds). build(root) creates its elements once
 * and returns update(lt, dur, t) which lays them out for local time lt.
 * fadeIn / fadeOut: whole-scene opacity ramps (cross-fades when scenes overlap).
 */
export function scene({ start, end, z = 0, fadeIn = 0, fadeOut = 0, build }) {
  scenes.push({ start, end, z, fadeIn, fadeOut, build, root: null, update: null });
}

let stage;
export function mount() {
  stage = document.getElementById('stage');
  for (const s of scenes) {
    s.root = el('div', 'scene', stage, { position: 'absolute', inset: '0', zIndex: String(s.z) });
    s.update = s.build(s.root, s);
    s.root.style.display = 'none';
  }
}

export async function seek(t) {
  for (const s of scenes) {
    const on = t >= s.start && t <= s.end;
    if (!on) {
      s.root.style.display = 'none';
      continue;
    }
    s.root.style.display = 'block';
    s.root.style.opacity = String(envelope(t, s.start, s.end, s.fadeIn, s.fadeOut));
    s.update(t - s.start, s.end - s.start, t);
  }
  // Wait for images set during this frame, then for layout + paint.
  while (pending.size) await Promise.all([...pending]);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

export function duration() {
  return Math.max(...scenes.map((s) => s.end));
}
