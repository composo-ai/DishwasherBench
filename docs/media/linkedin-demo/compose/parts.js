// The video's own components, following the storyboard's style guide.
import { el, ease, prog, clamp, lerp, kf } from './engine/engine.js';
import { C as K, CLIPS, MANIFEST, MONO } from './kit.js';
import { Crop, Seq } from './engine/engine.js';

export const C = {
  ...K,
  ink: '#1c2430', muted: '#5f6b7a', cream: '#fbf6ef', peach: '#ecd0ad', peachInsp: '#eccfad', peachDp: '#efd2b2', peachRender: '#edd0af',
  blue: '#1560d4', green: '#1f8a4c', red: '#c62828', magenta: '#b30080', amber: '#b26a00', amberBg: '#fff4e0', terracotta: '#b3593a', paper: '#efebe2',
};
export const DISPLAY = "'Inter Display', 'Inter', sans-serif";
export const TEXT = "'Inter', sans-serif";
const F = 1 / 30;

const accent = (node) => node.querySelectorAll('[data-c]').forEach((e) => { e.style.color = C[e.dataset.c] || e.dataset.c; });

/**
 * Caption card: white 94 %, radius 28, at the top (y 56) or bottom. lines: [{ html, size?, weight?, at? }]
 * (at: seconds after the card appears; such a line grows in). overline: small blue caps above.
 * inMode: 'settle' (on screen at once, 1.04 -> 1), 'rise' (24 px rise + fade, 6 frames), 'cut'.
 */
export function card(root, lines, { y = 56, bottom = null, size = 66, weight = 800, overline = null, inMode = 'rise', outMode = 'cut', w = 984, x = 48 } = {}) {
  const box = el('div', null, root, {
    position: 'absolute', left: x + 'px', width: w + 'px', boxSizing: 'border-box', padding: '28px 36px',
    background: 'rgba(255,255,255,0.94)', borderRadius: '28px', boxShadow: '0 8px 28px rgba(28,36,48,.18)', color: C.ink,
    ...(bottom !== null ? { bottom: bottom + 'px' } : { top: y + 'px' }), transformOrigin: '50% 0%',
  });
  if (overline) {
    const o = el('div', null, box, { font: `700 34px/1 ${TEXT}`, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.blue, marginBottom: '14px' });
    o.innerHTML = overline;
  }
  const rows = lines.map((l) => {
    const L = typeof l === 'string' ? { html: l } : l;
    const s = L.size ?? size;
    const wrap = el('div', null, box, { overflow: 'hidden' });
    const inner = el('div', null, wrap, { font: `${L.weight ?? weight} ${s}px/1.08 ${DISPLAY}`, letterSpacing: '-0.022em', whiteSpace: 'nowrap', paddingBottom: '0.04em' });
    inner.innerHTML = L.html;
    accent(inner);
    return { wrap, inner, at: L.at ?? 0, h: s * 1.08 + s * 0.04, s, fitted: false };
  });
  return {
    box,
    at(lt, inAt = 0, outAt = 1e9) {
      const on = lt >= inAt && lt < outAt;
      box.style.display = on ? 'block' : 'none';
      if (!on) return;
      const k = lt - inAt;
      let o = 1, ty = 0, sc = 1;
      if (inMode === 'rise') { const p = prog(k, 0, 6 * F, ease.out); o = p; ty = (1 - p) * 24; }
      if (inMode === 'settle') { const p = prog(k, 0, 6 * F, ease.out); sc = 1.04 - 0.04 * p; }
      if (outMode === 'fade') o *= 1 - prog(lt, outAt - 4 * F, outAt, ease.linear);
      box.style.opacity = String(o);
      box.style.transform = `translateY(${ty}px) scale(${sc})`;
      for (const r of rows) {
        if (!r.fitted) {
          const room = box.clientWidth - 72;
          if (r.inner.scrollWidth > room) {
            const s2 = Math.floor(r.s * room / r.inner.scrollWidth);
            r.inner.style.fontSize = s2 + 'px';
            r.h = s2 * 1.12;
            console.error('caption shrunk to fit: ' + r.inner.textContent);
          }
          r.fitted = true;
        }
        if (r.at <= 0) { r.wrap.style.height = 'auto'; r.inner.style.opacity = '1'; r.inner.style.transform = 'none'; continue; }
        const p = prog(k, r.at, r.at + 6 * F, ease.out);
        r.wrap.style.height = r.h * p + 'px';
        r.inner.style.opacity = String(p);
        r.inner.style.transform = `translateY(${(1 - p) * 24}px)`;
      }
    },
  };
}

/** Stage-wide SVG layer for leader lines and rings. */
export function svgLayer(root) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '1080'); svg.setAttribute('height', '1350');
  Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' });
  root.appendChild(svg);
  const make = (tag, attrs) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); svg.appendChild(e); return e; };
  return { svg, make };
}

const popScale = (k) => {
  // 4-frame scale-pop 0.6 -> 1.06 -> 1.0
  if (k <= 0) return 0.6;
  if (k < 3 * F) return lerp(0.6, 1.06, k / (3 * F));
  if (k < 5 * F) return lerp(1.06, 1.0, (k - 3 * F) / (2 * F));
  return 1;
};

/**
 * Annotation pill with a leader line to a target point: white, 3 px border and text in `color`,
 * Inter Bold 38 px; the leader ends in a 10 px dot. target() returns the point in stage px.
 */
export function annot(root, svg, label, { x, y, color = C.red }) {
  const box = el('div', null, root, {
    position: 'absolute', left: x + 'px', top: y + 'px', height: '56px', boxSizing: 'border-box', padding: '0 22px',
    display: 'flex', alignItems: 'center', background: '#fff', border: `3px solid ${color}`, borderRadius: '999px',
    color, font: `700 38px/1 ${TEXT}`, letterSpacing: '-0.01em', whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(28,36,48,.16)',
  });
  box.innerHTML = label;
  const halo = svg.make('line', { stroke: '#fff', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-opacity': 0.85 });
  const line = svg.make('line', { stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round' });
  const dot = svg.make('circle', { r: 8, fill: color, stroke: '#fff', 'stroke-width': 3 });
  let wpx = null;
  return {
    box,
    at(lt, inAt, outAt, target, outFade = 4 * F) {
      const on = lt >= inAt && lt < outAt;
      for (const e of [box, halo, line, dot]) e.style.display = on ? '' : 'none';
      if (!on) return;
      if (wpx === null) wpx = box.offsetWidth;
      const k = lt - inAt;
      const s = popScale(k);
      const o = Math.min(clamp(k / (2 * F)), 1 - prog(lt, outAt - outFade, outAt, ease.linear));
      box.style.transform = `scale(${s})`;
      box.style.opacity = String(o);
      const [tx, ty] = target;
      const cx = x + wpx / 2, cy = y + 28;
      let sx, sy;
      if (tx > x + wpx) { sx = x + wpx; sy = cy; } else if (tx < x) { sx = x; sy = cy; } else { sx = cx; sy = ty > cy ? y + 56 : y; }
      const lp = clamp((k - 2 * F) / (4 * F));
      for (const l of [halo, line]) {
        l.setAttribute('x1', sx); l.setAttribute('y1', sy);
        l.setAttribute('x2', sx + (tx - sx) * lp); l.setAttribute('y2', sy + (ty - sy) * lp);
        l.style.opacity = String(o);
      }
      dot.setAttribute('cx', tx); dot.setAttribute('cy', ty);
      dot.style.opacity = String(o * (lp >= 1 ? 1 : 0));
    },
  };
}

/** A verdict / label pill (filled or outlined) for panels. */
export function label(root, text, { x, y, color, filled = false, size = 34, center = false }) {
  const t = el('div', null, root, {
    position: 'absolute', top: y + 'px', height: size * 1.6 + 'px', boxSizing: 'border-box', padding: '0 18px', display: 'flex', alignItems: 'center',
    background: filled ? color : '#fff', color: filled ? '#fff' : color, border: `3px solid ${color}`, borderRadius: '999px',
    font: `800 ${size}px/1 ${TEXT}`, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(28,36,48,.14)',
    ...(center ? { left: x + 'px', transform: 'translateX(-50%)' } : { left: x + 'px' }),
  });
  t.innerHTML = text;
  const base = center ? 'translateX(-50%) ' : '';
  return {
    t,
    at(lt, inAt = 0, outAt = 1e9) {
      const on = lt >= inAt && lt < outAt;
      t.style.display = on ? 'flex' : 'none';
      if (!on) return;
      t.style.transform = base + `scale(${popScale(lt - inAt)})`;
      t.style.opacity = String(clamp((lt - inAt) / (2 * F)));
    },
  };
}

/**
 * Live footage with retiming and a digital zoom anchored at a source point.
 * segs: [[srcFrom, srcTo, speed], ...] played back to back; returns the source frame at lt.
 * Use whole speeds (or halves, which hold each frame twice): footage is shown frame by frame.
 */
export function retime(segs) {
  const parts = [];
  let t = 0;
  for (const [a, b, sp, hold] of segs) {
    const d = hold ?? Math.abs(b - a) / 30 / sp; // [f, f, 1, seconds] holds frame f
    parts.push({ a, b, t0: t, d });
    t += d;
  }
  const fn = (lt) => {
    for (const p of parts) if (lt < p.t0 + p.d) return p.a + Math.sign(p.b - p.a) * clamp((lt - p.t0) / Math.max(1e-6, p.d)) * Math.abs(p.b - p.a);
    const last = parts[parts.length - 1];
    return last.b;
  };
  fn.duration = t;
  fn.parts = parts;
  return fn;
}

/** The crop rect of a zoom z anchored at source point (ax, ay) of a 1080x1350 frame. */
export const zoomRect = (z, ax, ay, w = 1080, h = 1350) => [ax - ax / z, ay - ay / z, w / z, h / z];

export function footage(root, id, box = [0, 0, 1080, 1350], opts = {}) {
  const count = MANIFEST[id];
  if (!count) throw new Error('no clip ' + id + ' (run manifest.py on the clips)');
  const s = new Seq(root, { pattern: CLIPS + id + '/%04d.jpg', count, size: [1080, 1350], box, radius: opts.radius ?? 0, shadow: opts.shadow ?? false, blend: opts.blend ?? false });
  const api = {
    s, box,
    rect: [0, 0, 1080, 1350],
    show(frame, rect = [0, 0, 1080, 1350], opacity = 1) {
      api.rect = rect;
      s.frame(frame);
      s.set(rect, box, opacity);
    },
    /** Maps a source point to the stage through the current rect and box. */
    map([px, py]) {
      const [cx, cy, cw, ch] = api.rect;
      const [bx, by, bw, bh] = box;
      const sc = Math.max(bw / cw, bh / ch);
      return [bx + (px - cx) * sc + (bw - cw * sc) / 2, by + (py - cy) * sc + (bh - ch * sc) / 2];
    },
  };
  return api;
}

export function stillImg(root, src, size, box, opts = {}) {
  const c = new Crop(root, { src, size, box, radius: opts.radius ?? 0, shadow: opts.shadow ?? false, bg: opts.bg ?? null });
  return {
    c,
    show(rect, opacity = 1) { c.set(rect, box, opacity); },
  };
}

export { MONO };
