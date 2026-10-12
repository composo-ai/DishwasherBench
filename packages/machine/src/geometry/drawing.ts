/**
 * Scale drawings of the machine geometry as SVG, for checking against photographs and
 * measurements. Every mark is the orthographic projection of a primitive of a `Shape`: nothing
 * is drawn that is not in the geometry the simulation uses.
 *
 * Views (tub frame, or the frame the shapes are posed in):
 * - `top`: seen from above, +x to the right and +y (the back) up the page;
 * - `front`: seen from the door, +x to the right and +z up the page;
 * - `side`: seen from the left, +y (the back) to the right and +z up the page.
 * Drawing units are millimetres; one SVG user unit is one millimetre.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { poseCompose, poseTransformPoint, quatRotate } from '@spotless/core';
import type { Part, Shape } from '@spotless/geometry';

/** Which way a drawing looks. */
export type DrawingView = 'top' | 'front' | 'side';

/** A point of a drawing, millimetres: `u` to the right, `v` down the page. */
export type DrawingPoint = readonly [u: number, v: number];

/** One mark of a drawing: the projection of one primitive. */
export type DrawingMark =
  | {
      readonly kind: 'line';
      readonly part: string;
      readonly a: DrawingPoint;
      readonly b: DrawingPoint;
      readonly width: number;
    }
  | { readonly kind: 'circle'; readonly part: string; readonly c: DrawingPoint; readonly r: number }
  | { readonly kind: 'polygon'; readonly part: string; readonly points: readonly DrawingPoint[] };

/** Projects a point (metres, in the drawing's frame) to drawing millimetres. */
export function projectPoint(p: Vec3, view: DrawingView): DrawingPoint {
  if (view === 'top') return [p[0] * 1000, -p[1] * 1000];
  if (view === 'front') return [p[0] * 1000, -p[2] * 1000];
  return [p[1] * 1000, -p[2] * 1000];
}

/** Convex hull of points in the plane (Andrew's monotone chain), counter-clockwise. */
export function convexHull2(points: readonly DrawingPoint[]): DrawingPoint[] {
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: DrawingPoint, a: DrawingPoint, b: DrawingPoint): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: DrawingPoint[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2] as DrawingPoint, lower[lower.length - 1] as DrawingPoint, p) <=
        0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: DrawingPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i] as DrawingPoint;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2] as DrawingPoint, upper[upper.length - 1] as DrawingPoint, p) <=
        0
    )
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** Points on the surface of a part (part frame, metres) whose hull is its silhouette. */
function silhouettePoints(part: Part): Vec3[] {
  const prim = part.prim;
  const points: Vec3[] = [];
  if (prim.kind === 'rbox') {
    const h = prim.halfExtents;
    const r = prim.radius;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          points.push([sx * (h[0] + r), sy * (h[1] + r), sz * (h[2] + r)]);
        }
  } else if (prim.kind === 'hull') {
    const r = prim.radius;
    for (const p of prim.points) {
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1]) {
            points.push([
              p[0] + (sx * r) / Math.SQRT2,
              p[1] + (sy * r) / Math.SQRT2,
              p[2] + sz * r,
            ]);
          }
    }
  } else if (prim.kind === 'sor') {
    const [phi0, phi1] = prim.arc ?? [0, 2 * Math.PI];
    const steps = Math.max(6, Math.ceil(((phi1 - phi0) / (2 * Math.PI)) * 48));
    const [sx, sy] = prim.scaleXY ?? [1, 1];
    for (const v of prim.profile) {
      for (let i = 0; i <= steps; i++) {
        const phi = phi0 + ((phi1 - phi0) * i) / steps;
        // The wall is a ball of radius t / 2 about the profile vertex: eight points round it.
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          const r = Math.max(0, v.r + (v.t / 2) * Math.cos(a));
          points.push([
            r * Math.cos(phi) * sx,
            r * Math.sin(phi) * sy,
            v.z + (v.t / 2) * Math.sin(a),
          ]);
        }
      }
    }
  }
  return points;
}

/** The marks of a shape posed by `pose` (shape frame to drawing frame) in one view. */
export function shapeMarks(shape: Shape, pose: Pose, view: DrawingView): DrawingMark[] {
  const marks: DrawingMark[] = [];
  for (const part of shape.parts) {
    const whole = poseCompose(pose, part.pose);
    if (part.prim.kind === 'capsule') {
      const a = projectPoint(poseTransformPoint(whole, part.prim.a), view);
      const b = projectPoint(poseTransformPoint(whole, part.prim.b), view);
      const width = part.prim.radius * 2000;
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6)
        marks.push({ kind: 'circle', part: part.id, c: a, r: width / 2 });
      else marks.push({ kind: 'line', part: part.id, a, b, width });
      continue;
    }
    const points = silhouettePoints(part).map((p) =>
      projectPoint(poseTransformPoint(whole, p), view),
    );
    marks.push({ kind: 'polygon', part: part.id, points: convexHull2(points) });
  }
  return marks;
}

/** How the marks of one layer are drawn. */
export interface DrawingStyle {
  /** Stroke colour of lines and outlines. */
  readonly stroke: string;
  /** Fill of polygons and of circles; `none` for outlines only. */
  readonly fill?: string;
  /** Opacity of the whole layer, 0 to 1. */
  readonly opacity?: number;
  /** Outline width of polygons, millimetres. */
  readonly outline?: number;
}

/** One group of marks with its style and an id for the SVG group. */
export interface DrawingLayer {
  readonly id: string;
  readonly marks: readonly DrawingMark[];
  readonly style: DrawingStyle;
}

/** A piece of text. `at` is in drawing millimetres. */
export interface DrawingLabel {
  readonly at: DrawingPoint;
  readonly text: string;
  /** Height of the text, millimetres; default 9. */
  readonly size?: number;
  readonly anchor?: 'start' | 'middle' | 'end';
  readonly colour?: string;
  /** With `leaderTo`, a thin line is drawn from the text to that point. */
  readonly leaderTo?: DrawingPoint;
}

/** A height or a position marked by a line across the drawing with a caption in the margin. */
export interface DrawingLevel {
  /** `h`: a horizontal line at `value` of the vertical axis; `v`: a vertical line. Millimetres in the drawing's frame (not flipped). */
  readonly axis: 'h' | 'v';
  readonly value: number;
  readonly text: string;
  readonly colour?: string;
}

/** Everything that goes into one drawing. */
export interface Drawing {
  readonly title: string;
  readonly subtitle?: string;
  readonly view: DrawingView;
  readonly layers: readonly DrawingLayer[];
  readonly labels?: readonly DrawingLabel[];
  readonly levels?: readonly DrawingLevel[];
  /** Spacing of the ruler ticks along the frame, millimetres; default 50. */
  readonly tick?: number;
  /** Pixels per millimetre of the SVG's nominal size; default 2. */
  readonly pixelsPerMm?: number;
  /** Where the origin of the ruler is, drawing frame millimetres `[horizontal, vertical]` (not flipped); default 0, 0. */
  readonly rulerOrigin?: readonly [number, number];
  /** Names of the ruler axes, for the captions. */
  readonly axes?: readonly [string, string];
  /** Width of the right margin that the level captions are written in, millimetres; default 20. */
  readonly captionMargin?: number;
  /** Extra room round the marks for labels: `[left, top, right, bottom]`, millimetres. */
  readonly pad?: readonly [number, number, number, number];
}

function f(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Bounding box of the marks of some layers: `[uMin, vMin, uMax, vMax]`, millimetres. */
export function marksBounds(layers: readonly DrawingLayer[]): [number, number, number, number] {
  let u0 = Infinity;
  let v0 = Infinity;
  let u1 = -Infinity;
  let v1 = -Infinity;
  const grow = (p: DrawingPoint, r: number): void => {
    u0 = Math.min(u0, p[0] - r);
    v0 = Math.min(v0, p[1] - r);
    u1 = Math.max(u1, p[0] + r);
    v1 = Math.max(v1, p[1] + r);
  };
  for (const layer of layers) {
    for (const mark of layer.marks) {
      if (mark.kind === 'line') {
        grow(mark.a, mark.width / 2);
        grow(mark.b, mark.width / 2);
      } else if (mark.kind === 'circle') grow(mark.c, mark.r);
      else for (const p of mark.points) grow(p, 0);
    }
  }
  if (!Number.isFinite(u0)) return [0, 0, 1, 1];
  return [u0, v0, u1, v1];
}

/** The drawing as the text of an SVG document. */
export function renderSvg(drawing: Drawing): string {
  const bounds = marksBounds(drawing.layers);
  const pad = drawing.pad ?? [0, 0, 0, 0];
  const [u0, v0, u1, v1] = [
    bounds[0] - pad[0],
    bounds[1] - pad[1],
    bounds[2] + pad[2],
    bounds[3] + pad[3],
  ];
  const tick = drawing.tick ?? 50;
  const scale = drawing.pixelsPerMm ?? 2;
  const margin = 28;
  const captionMargin = drawing.captionMargin ?? 20;
  const header = drawing.subtitle === undefined ? 22 : 36;
  const left = u0 - margin;
  const top = v0 - margin - header;
  const width = u1 - u0 + 2 * margin + captionMargin;
  const height = v1 - v0 + 2 * margin + header;
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(left)} ${f(top)} ${f(width)} ${f(height)}" width="${f(width * scale)}" height="${f(height * scale)}" font-family="Helvetica, Arial, sans-serif">`,
  );
  out.push(
    `<rect x="${f(left)}" y="${f(top)}" width="${f(width)}" height="${f(height)}" fill="#ffffff"/>`,
  );
  out.push(
    `<text x="${f(u0 - margin + 4)}" y="${f(top + 13)}" font-size="11" font-weight="bold" fill="#111">${escapeXml(drawing.title)}</text>`,
  );
  if (drawing.subtitle !== undefined) {
    out.push(
      `<text x="${f(u0 - margin + 4)}" y="${f(top + 26)}" font-size="7.5" fill="#444">${escapeXml(drawing.subtitle)}</text>`,
    );
  }

  // Ruler: a frame with ticks every `tick` mm, numbered in the drawing's own coordinates.
  const [ox, oy] = drawing.rulerOrigin ?? [0, 0];
  const frame = { x0: u0 - 12, y0: v0 - 12, x1: u1 + 12, y1: v1 + 12 };
  out.push(`<g id="ruler" stroke="#999" stroke-width="0.4" fill="none" font-size="6" >`);
  out.push(
    `<rect x="${f(frame.x0)}" y="${f(frame.y0)}" width="${f(frame.x1 - frame.x0)}" height="${f(frame.y1 - frame.y0)}"/>`,
  );
  for (let k = Math.ceil((frame.x0 - ox) / tick); ox + k * tick <= frame.x1; k++) {
    const x = ox + k * tick;
    out.push(`<line x1="${f(x)}" y1="${f(frame.y1)}" x2="${f(x)}" y2="${f(frame.y1 + 4)}"/>`);
    out.push(
      `<line x1="${f(x)}" y1="${f(frame.y0)}" x2="${f(x)}" y2="${f(frame.y1)}" stroke="#e4e4e4" stroke-width="0.25"/>`,
    );
    out.push(
      `<text x="${f(x)}" y="${f(frame.y1 + 10)}" text-anchor="middle" stroke="none" fill="#666">${k * tick}</text>`,
    );
  }
  // The vertical axis of the drawing's frame points up the page: v = -(value).
  for (let k = Math.ceil((-frame.y1 - oy) / tick); oy + k * tick <= -frame.y0; k++) {
    const y = -(oy + k * tick);
    out.push(`<line x1="${f(frame.x0 - 4)}" y1="${f(y)}" x2="${f(frame.x0)}" y2="${f(y)}"/>`);
    out.push(
      `<line x1="${f(frame.x0)}" y1="${f(y)}" x2="${f(frame.x1)}" y2="${f(y)}" stroke="#e4e4e4" stroke-width="0.25"/>`,
    );
    out.push(
      `<text x="${f(frame.x0 - 5)}" y="${f(y + 2)}" text-anchor="end" stroke="none" fill="#666">${k * tick}</text>`,
    );
  }
  if (drawing.axes !== undefined) {
    out.push(
      `<text x="${f(frame.x1)}" y="${f(frame.y1 + 18)}" text-anchor="end" stroke="none" fill="#666">${escapeXml(drawing.axes[0])} (mm)</text>`,
    );
    out.push(
      `<text x="${f(frame.x0 - 5)}" y="${f(frame.y0 - 3)}" text-anchor="end" stroke="none" fill="#666">${escapeXml(drawing.axes[1])}</text>`,
    );
  }
  out.push(`</g>`);

  for (const layer of drawing.layers) {
    const s = layer.style;
    const fill = s.fill ?? 'none';
    out.push(
      `<g id="${escapeXml(layer.id)}" stroke="${s.stroke}" fill="${fill}" opacity="${f(s.opacity ?? 1)}" stroke-linecap="round" stroke-linejoin="round">`,
    );
    for (const mark of layer.marks) {
      if (mark.kind === 'line') {
        out.push(
          `<line data-part="${escapeXml(mark.part)}" x1="${f(mark.a[0])}" y1="${f(mark.a[1])}" x2="${f(mark.b[0])}" y2="${f(mark.b[1])}" stroke-width="${f(mark.width)}"/>`,
        );
      } else if (mark.kind === 'circle') {
        out.push(
          `<circle data-part="${escapeXml(mark.part)}" cx="${f(mark.c[0])}" cy="${f(mark.c[1])}" r="${f(mark.r)}" fill="${s.stroke}" stroke="none"/>`,
        );
      } else if (mark.points.length > 0) {
        out.push(
          `<polygon data-part="${escapeXml(mark.part)}" points="${mark.points.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" stroke-width="${f(s.outline ?? 0.5)}"/>`,
        );
      }
    }
    out.push(`</g>`);
  }

  out.push(`<g id="levels" font-size="6.5">`);
  for (const level of drawing.levels ?? []) {
    const colour = level.colour ?? '#c0392b';
    if (level.axis === 'h') {
      const y = -level.value;
      out.push(
        `<line x1="${f(frame.x0)}" y1="${f(y)}" x2="${f(frame.x1 + 3)}" y2="${f(y)}" stroke="${colour}" stroke-width="0.35" stroke-dasharray="3 2"/>`,
      );
      out.push(
        `<text x="${f(frame.x1 + 5)}" y="${f(y + 2.2)}" fill="${colour}">${escapeXml(level.text)}</text>`,
      );
    } else {
      const x = level.value;
      out.push(
        `<line x1="${f(x)}" y1="${f(frame.y0 - 3)}" x2="${f(x)}" y2="${f(frame.y1)}" stroke="${colour}" stroke-width="0.35" stroke-dasharray="3 2"/>`,
      );
      out.push(
        `<text x="${f(x)}" y="${f(frame.y0 - 5)}" fill="${colour}" text-anchor="middle">${escapeXml(level.text)}</text>`,
      );
    }
  }
  out.push(`</g>`);

  out.push(`<g id="labels">`);
  for (const label of drawing.labels ?? []) {
    const size = label.size ?? 9;
    const colour = label.colour ?? '#111';
    if (label.leaderTo !== undefined) {
      out.push(
        `<line x1="${f(label.at[0])}" y1="${f(label.at[1] - size * 0.3)}" x2="${f(label.leaderTo[0])}" y2="${f(label.leaderTo[1])}" stroke="${colour}" stroke-width="0.3"/>`,
      );
    }
    out.push(
      `<text x="${f(label.at[0])}" y="${f(label.at[1])}" font-size="${f(size)}" text-anchor="${label.anchor ?? 'start'}" fill="${colour}" stroke="#ffffff" stroke-width="${f(size * 0.22)}" paint-order="stroke">${escapeXml(label.text)}</text>`,
    );
  }
  out.push(`</g>`);
  out.push(`</svg>`);
  return out.join('\n');
}

/** The marks of a shape whose part id passes `keep`, as one layer. */
export function layerOf(
  id: string,
  shape: Shape,
  pose: Pose,
  view: DrawingView,
  style: DrawingStyle,
  keep: (partId: string) => boolean = () => true,
): DrawingLayer {
  return { id, marks: shapeMarks(shape, pose, view).filter((m) => keep(m.part)), style };
}

/** A direction (drawing frame, metres) as a drawing vector in millimetres per metre. */
export function projectDirection(d: Vec3, view: DrawingView): DrawingPoint {
  return projectPoint(d, view);
}

/** Rotates a vector by a pose's rotation (no translation). */
export function rotateBy(pose: Pose, v: Vec3): Vec3 {
  return quatRotate(pose.q, v);
}
