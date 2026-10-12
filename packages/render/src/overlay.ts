/**
 * What is drawn over a picture of the machine so that it can be acted on: a millimetre grid
 * with axis labels in the frame the `place` action uses, and labels with item ids. Both are
 * computed here as plain marks (lines, dots, texts in image pixels) from a projection of
 * tub-frame points onto the image, and drawn with a 2D canvas by `drawOverlay`. The headless
 * render service and the web client use the same code, so a model and a person are offered
 * the same grid and the same labels.
 *
 * Everything here is a pure function of its arguments: no clock, no randomness, no measuring
 * of text (widths are estimated from the number of characters), so the same scene and view
 * give the same marks.
 */

import type { Mm3 } from './types.ts';

/** A straight line of the overlay, image pixels. */
export interface OverlayLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** CSS colour. */
  readonly colour: string;
  readonly width: number;
}

/** A filled dot of the overlay, image pixels. */
export interface OverlayDot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly colour: string;
}

/** A text of the overlay, image pixels. */
export interface OverlayText {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  /** Font size, pixels. */
  readonly size: number;
  readonly colour: string;
  readonly align: 'left' | 'center' | 'right';
  readonly baseline: 'top' | 'middle' | 'bottom';
  readonly bold?: boolean;
  /** A filled box behind the text (item labels). */
  readonly box?: { readonly fill: string; readonly stroke: string };
  /** A soft outline round the glyphs, so that the text reads on any background. */
  readonly halo?: string;
}

/** Everything drawn over a picture, in drawing order: lines, dots, texts. */
export interface OverlayMarks {
  readonly lines: readonly OverlayLine[];
  readonly dots: readonly OverlayDot[];
  readonly texts: readonly OverlayText[];
}

/**
 * Where a tub-frame point (millimetres) is on the image, in pixels from the top-left corner;
 * null for a point behind a perspective camera.
 */
export type Projector = (point: Mm3) => readonly [x: number, y: number] | null;

/** A frame poses can be given in, as it stands now: axes parallel to the tub frame. */
export interface GridFrame {
  /** `lower_rack`, `upper_rack`, `cutlery_basket` or `tub`. */
  readonly frame: string;
  /** Origin of the frame in the tub frame, millimetres. */
  readonly origin_mm: Mm3;
  /** Extent of the frame's loading envelope along its axes from the origin, millimetres. */
  readonly size_mm: Mm3;
}

/** The font of every text of the overlay. */
export const OVERLAY_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/** Colour of the grid and labels of each frame: told apart where two frames share a picture. */
export function frameColour(frame: string): string {
  switch (frame) {
    case 'lower_rack':
      return '#b83a00';
    case 'upper_rack':
      return '#1a4fd6';
    case 'cutlery_basket':
      return '#0f7a3d';
    default:
      return '#2b2f36';
  }
}

function withAlpha(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Spacing of grid lines and of labelled lines, millimetres, for a picture that shows
 * `pxPerMm` pixels per millimetre: lines at least 26 pixels apart, labels at least 52.
 */
export function gridSteps(pxPerMm: number): { readonly line: number; readonly label: number } {
  const table: readonly (readonly [number, number])[] = [
    [5, 10],
    [10, 20],
    [10, 50],
    [25, 50],
    [50, 100],
    [100, 200],
    [100, 500],
  ];
  for (const [line, label] of table) {
    if (line * pxPerMm >= 26 && label * pxPerMm >= 52) return { line, label };
  }
  return { line: 500, label: 1000 };
}

/** Pixels per millimetre of a projection near a point, measured along a tub-frame axis. */
export function pixelsPerMm(project: Projector, at: Mm3, axis: 0 | 1 | 2): number {
  const other: [number, number, number] = [at[0], at[1], at[2]];
  other[axis] += 100;
  const a = project(at);
  const b = project(other);
  if (a === null || b === null) return 0;
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / 100;
}

function multiples(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.ceil((from - 1e-9) / step);
  const last = Math.floor((to + 1e-9) / step);
  for (let k = first; k <= last; k++) out.push(k * step + 0);
  return out;
}

function lineStyle(value: number, steps: { line: number; label: number }, colour: string) {
  if (value % 100 === 0) return { colour: withAlpha(colour, 0.62), width: 1.4 };
  if (value % steps.label === 0) return { colour: withAlpha(colour, 0.45), width: 1 };
  return { colour: withAlpha(colour, 0.24), width: 0.8 };
}

function push(
  lines: OverlayLine[],
  project: Projector,
  a: Mm3,
  b: Mm3,
  style: { colour: string; width: number },
): { a: readonly [number, number]; b: readonly [number, number] } | null {
  const pa = project(a);
  const pb = project(b);
  if (pa === null || pb === null) return null;
  lines.push({ x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1], ...style });
  return { a: pa, b: pb };
}

const LABEL_SIZE = 12;
const HALO = 'rgba(255, 255, 255, 0.92)';

/**
 * The grid of a basket (or of the tub floor) in its own frame, on the plane of the frame's
 * z = 0: lines along x and y every few millimetres across the loading envelope, the
 * envelope's outline, and the x and y of the labelled lines in millimetres of that frame,
 * written just outside the front and the left edge. For the plan views, where it is exact for
 * every height (the view is straight down), and for the three-quarter views, where it lies on
 * the base grid of the basket.
 */
export function planGridMarks(frame: GridFrame, project: Projector): OverlayMarks {
  const lines: OverlayLine[] = [];
  const texts: OverlayText[] = [];
  const [ox, oy, oz] = frame.origin_mm;
  const [sx, sy] = frame.size_mm;
  const colour = frameColour(frame.frame);
  const centre: Mm3 = [ox + sx / 2, oy + sy / 2, oz];
  const scale = Math.min(pixelsPerMm(project, centre, 0), pixelsPerMm(project, centre, 1));
  if (!(scale > 0)) return { lines, dots: [], texts };
  const steps = gridSteps(scale);
  const at = (x: number, y: number): Mm3 => [ox + x, oy + y, oz];

  // Which way "outside the front edge" and "outside the left edge" are on the image.
  const origin = project(at(0, 0));
  const alongX = project(at(sx, 0));
  const alongY = project(at(0, sy));
  if (origin === null || alongX === null || alongY === null) return { lines, dots: [], texts };
  const unit = (from: readonly [number, number], to: readonly [number, number]) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [(to[0] - from[0]) / length, (to[1] - from[1]) / length] as const;
  };
  const ux = unit(origin, alongX);
  const uy = unit(origin, alongY);

  for (const x of multiples(0, sx, steps.line)) {
    const ends = push(lines, project, at(x, 0), at(x, sy), lineStyle(x, steps, colour));
    if (ends !== null && x % steps.label === 0) {
      texts.push({
        x: ends.a[0] - uy[0] * 9,
        y: ends.a[1] - uy[1] * 9,
        text: String(x),
        size: LABEL_SIZE,
        colour,
        align: 'center',
        baseline: 'middle',
        bold: true,
        halo: HALO,
      });
    }
  }
  for (const y of multiples(0, sy, steps.line)) {
    const ends = push(lines, project, at(0, y), at(sx, y), lineStyle(y, steps, colour));
    if (ends !== null && y % steps.label === 0 && y !== 0) {
      texts.push({
        x: ends.a[0] - ux[0] * 7,
        y: ends.a[1] - ux[1] * 7,
        text: String(y),
        size: LABEL_SIZE,
        colour,
        align: ux[0] >= 0 ? 'right' : 'left',
        baseline: 'middle',
        bold: true,
        halo: HALO,
      });
    }
  }
  // The outline of the loading envelope.
  const outline = { colour: withAlpha(colour, 0.8), width: 1.6 };
  push(lines, project, at(0, 0), at(sx, 0), outline);
  push(lines, project, at(sx, 0), at(sx, sy), outline);
  push(lines, project, at(sx, sy), at(0, sy), outline);
  push(lines, project, at(0, sy), at(0, 0), outline);
  // Axis names at the far ends of the two labelled edges.
  // The x title goes under the last value of the front edge and the y title beside the far
  // end of the left edge, just outside the envelope: neither runs off the picture when the
  // basket fills it.
  texts.push({
    x: alongX[0] - uy[0] * 24,
    y: alongX[1] - uy[1] * 24,
    text: 'x mm',
    size: LABEL_SIZE,
    colour,
    align: ux[0] >= 0 ? 'right' : 'left',
    baseline: 'middle',
    bold: true,
    halo: HALO,
  });
  texts.push({
    x: alongY[0] + uy[0] * 10 + ux[0] * 6,
    y: alongY[1] + uy[1] * 10 + ux[1] * 6,
    text: 'y mm',
    size: LABEL_SIZE,
    colour,
    align: ux[0] >= 0 ? 'left' : 'right',
    baseline: 'middle',
    bold: true,
    halo: HALO,
  });
  return { lines, dots: [], texts };
}

/** What an elevation grid is drawn for. */
export interface ElevationGrid {
  /** The tub-frame axis that runs across the picture: 0 (x) for the front view, 1 (y) for a side view. */
  readonly axis: 0 | 1;
  /** Extent of the picture's subject along that axis and along z, tub frame, millimetres. */
  readonly across_mm: readonly [number, number];
  readonly z_mm: readonly [number, number];
  /** Coordinate along the viewing axis at which the grid is drawn (any value: the view is orthographic). */
  readonly depth_mm: number;
  /** The baskets whose own rulers are drawn (their frames as they stand now). */
  readonly frames: readonly GridFrame[];
}

/**
 * The grid of a front or side elevation: lines of the tub frame every few millimetres, with
 * their values written at the left and the bottom of the picture, and for every basket a
 * ruler along its base grid and one up its side in the basket's own frame (z = 0 on top of
 * the base grid), in the basket's colour. Heights and clearances are read from it.
 */
export function elevationGridMarks(grid: ElevationGrid, project: Projector): OverlayMarks {
  const lines: OverlayLine[] = [];
  const texts: OverlayText[] = [];
  const colour = frameColour('tub');
  const point = (across: number, z: number): Mm3 =>
    grid.axis === 0 ? [across, grid.depth_mm, z] : [grid.depth_mm, across, z];
  const mid = point((grid.across_mm[0] + grid.across_mm[1]) / 2, (grid.z_mm[0] + grid.z_mm[1]) / 2);
  const scale = pixelsPerMm(project, mid, 2);
  if (!(scale > 0)) return { lines, dots: [], texts };
  const steps = gridSteps(scale);
  const axisName = grid.axis === 0 ? 'x' : 'y';

  for (const z of multiples(grid.z_mm[0], grid.z_mm[1], steps.line)) {
    const ends = push(
      lines,
      project,
      point(grid.across_mm[0], z),
      point(grid.across_mm[1], z),
      lineStyle(z, steps, colour),
    );
    if (ends !== null && z % steps.label === 0) {
      const left = ends.a[0] <= ends.b[0] ? ends.a : ends.b;
      texts.push({
        x: left[0] - 6,
        y: left[1],
        text: String(z),
        size: LABEL_SIZE,
        colour,
        align: 'right',
        baseline: 'middle',
        bold: true,
        halo: HALO,
      });
    }
  }
  let bottomRight: readonly [number, number] | null = null;
  for (const across of multiples(grid.across_mm[0], grid.across_mm[1], steps.line)) {
    const ends = push(
      lines,
      project,
      point(across, grid.z_mm[0]),
      point(across, grid.z_mm[1]),
      lineStyle(across, steps, colour),
    );
    if (ends === null) continue;
    const bottom = ends.a[1] >= ends.b[1] ? ends.a : ends.b;
    if (bottomRight === null || bottom[0] > bottomRight[0]) bottomRight = bottom;
    if (across % steps.label === 0) {
      texts.push({
        x: bottom[0],
        y: bottom[1] + 5,
        text: String(across),
        size: LABEL_SIZE,
        colour,
        align: 'center',
        baseline: 'top',
        bold: true,
        halo: HALO,
      });
    }
  }
  const corner = project(point(grid.across_mm[0], grid.z_mm[1]));
  const other = project(point(grid.across_mm[1], grid.z_mm[1]));
  if (corner !== null && other !== null) {
    const left = corner[0] <= other[0] ? corner : other;
    texts.push({
      x: left[0] - 6,
      y: left[1] - 14,
      text: 'z mm (tub)',
      size: LABEL_SIZE,
      colour,
      align: 'left',
      baseline: 'middle',
      bold: true,
      halo: HALO,
    });
  }
  if (bottomRight !== null) {
    texts.push({
      x: bottomRight[0],
      y: bottomRight[1] + 21,
      text: `${axisName} mm (tub)`,
      size: LABEL_SIZE,
      colour,
      align: 'right',
      baseline: 'top',
      bold: true,
      halo: HALO,
    });
  }

  // Each basket's own rulers.
  for (const frame of grid.frames) {
    const rackColour = frameColour(frame.frame);
    const o = frame.origin_mm;
    const across0 = o[grid.axis];
    const length = frame.size_mm[grid.axis];
    const style = { colour: withAlpha(rackColour, 0.95), width: 1.8 };
    const base = push(lines, project, point(across0, o[2]), point(across0 + length, o[2]), style);
    if (base === null) continue;
    for (const value of multiples(0, length, steps.line)) {
      const p = project(point(across0 + value, o[2]));
      if (p === null) continue;
      const labelled = value % steps.label === 0;
      lines.push({
        x1: p[0],
        y1: p[1],
        x2: p[0],
        y2: p[1] + (labelled ? 7 : 4),
        colour: rackColour,
        width: 1.4,
      });
      if (labelled) {
        texts.push({
          x: p[0],
          y: p[1] + 9,
          text: String(value),
          size: 11,
          colour: rackColour,
          align: 'center',
          baseline: 'top',
          bold: true,
          halo: HALO,
        });
      }
    }
    // The ruler up the side of the basket that is to the left on the picture.
    const leftAcross = base.a[0] <= base.b[0] ? across0 : across0 + length;
    const side = push(
      lines,
      project,
      point(leftAcross, o[2]),
      point(leftAcross, o[2] + frame.size_mm[2]),
      style,
    );
    if (side === null) continue;
    for (const value of multiples(0, frame.size_mm[2], steps.line)) {
      const p = project(point(leftAcross, o[2] + value));
      if (p === null) continue;
      const labelled = value % steps.label === 0;
      lines.push({
        x1: p[0] - (labelled ? 7 : 4),
        y1: p[1],
        x2: p[0],
        y2: p[1],
        colour: rackColour,
        width: 1.4,
      });
      if (labelled && value !== 0) {
        texts.push({
          x: p[0] - 9,
          y: p[1],
          text: String(value),
          size: 11,
          colour: rackColour,
          align: 'right',
          baseline: 'middle',
          bold: true,
          halo: HALO,
        });
      }
    }
    const top = project(point(leftAcross, o[2] + frame.size_mm[2]));
    if (top !== null) {
      texts.push({
        x: top[0] + 5,
        y: top[1] - 8,
        text: `${frame.frame}: ${axisName}, z mm`,
        size: 11,
        colour: rackColour,
        align: 'left',
        baseline: 'middle',
        bold: true,
        halo: HALO,
      });
    }
  }
  return { lines, dots: [], texts };
}

/** Width of a label's box for a text, pixels (estimated: 0.62 of the font size a character). */
export function labelWidth(text: string, size: number): number {
  return Math.ceil(text.length * size * 0.62) + 8;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Something to label: its text and where it is on the image, pixels. */
export interface LabelAnchor {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Labels for points of the picture (item ids at the items): each a small box with the text,
 * a dot on the point and a line from the dot to the box. A label is put above its point when
 * there is room, otherwise below, beside or further off, wherever it covers the labels placed
 * before it least; anchors outside the picture get none. The order of the anchors decides
 * who gets the nearest place, so pass them sorted.
 */
export function labelMarks(
  anchors: readonly LabelAnchor[],
  width: number,
  height: number,
  size = 12,
): OverlayMarks {
  const lines: OverlayLine[] = [];
  const dots: OverlayDot[] = [];
  const texts: OverlayText[] = [];
  const placed: Box[] = [];
  const h = size + 6;
  for (const anchor of anchors) {
    if (anchor.x < 0 || anchor.y < 0 || anchor.x > width || anchor.y > height) continue;
    const w = labelWidth(anchor.text, size);
    let best: Box | null = null;
    let bestCost = Infinity;
    for (let ring = 1; ring <= 4 && bestCost > 0; ring++) {
      const dy = ring * (h + 3);
      const dx = ring * (w / 2 + 10);
      const offsets: readonly (readonly [number, number])[] = [
        [0, -dy],
        [0, dy],
        [dx, 0],
        [-dx, 0],
        [dx, -dy],
        [-dx, -dy],
        [dx, dy],
        [-dx, dy],
      ];
      for (const [ox, oy] of offsets) {
        const box: Box = {
          x: Math.max(1, Math.min(width - w - 1, anchor.x + ox - w / 2)),
          y: Math.max(1, Math.min(height - h - 1, anchor.y + oy - h / 2)),
          w,
          h,
        };
        let cost = 0;
        for (const other of placed) cost += overlap(box, other);
        if (cost < bestCost) {
          best = box;
          bestCost = cost;
          if (cost === 0) break;
        }
      }
    }
    if (best === null) continue;
    placed.push(best);
    const cx = best.x + best.w / 2;
    const cy = best.y + best.h / 2;
    lines.push({
      x1: anchor.x,
      y1: anchor.y,
      x2: cx,
      y2: cy,
      colour: 'rgba(20, 20, 20, 0.85)',
      width: 1.2,
    });
    dots.push({ x: anchor.x, y: anchor.y, r: 3, colour: '#111111' });
    texts.push({
      x: cx,
      y: cy,
      text: anchor.text,
      size,
      colour: '#111111',
      align: 'center',
      baseline: 'middle',
      bold: true,
      box: { fill: 'rgba(255, 244, 179, 0.96)', stroke: '#111111' },
    });
  }
  return { lines, dots, texts };
}

/**
 * A line of text in a box: what the picture is and how to read its grid. It goes in the
 * top-left corner of the picture unless a place is given (the top-left corner of the box).
 */
export function captionMarks(
  caption: string,
  width: number,
  at: { readonly x: number; readonly y: number } = { x: 6, y: 4 },
): OverlayMarks {
  const room = Math.max(4, Math.floor((width - 16) / 6.9));
  return {
    lines: [],
    dots: [],
    texts: [
      {
        x: at.x,
        y: at.y,
        text: caption.length > room ? caption.slice(0, room) : caption,
        size: 11,
        colour: '#111111',
        align: 'left',
        baseline: 'top',
        bold: false,
        box: { fill: 'rgba(255, 255, 255, 0.86)', stroke: 'rgba(0, 0, 0, 0.35)' },
      },
    ],
  };
}

/** Several sets of marks as one, drawn in the order given. */
export function mergeMarks(...sets: readonly OverlayMarks[]): OverlayMarks {
  return {
    lines: sets.flatMap((set) => set.lines),
    dots: sets.flatMap((set) => set.dots),
    texts: sets.flatMap((set) => set.texts),
  };
}

/** The part of a 2D canvas context that drawing the overlay needs. */
export interface OverlayContext {
  font: string;
  textAlign: string;
  textBaseline: string;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineJoin: string;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  arc(x: number, y: number, r: number, from: number, to: number): void;
  fill(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
}

/** Draws marks on a 2D canvas whose pixels are the image's pixels. */
export function drawOverlay(context: OverlayContext, marks: OverlayMarks): void {
  for (const line of marks.lines) {
    context.strokeStyle = line.colour;
    context.lineWidth = line.width;
    context.beginPath();
    context.moveTo(line.x1, line.y1);
    context.lineTo(line.x2, line.y2);
    context.stroke();
  }
  for (const dot of marks.dots) {
    context.fillStyle = dot.colour;
    context.beginPath();
    context.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
    context.fill();
  }
  for (const text of marks.texts) {
    context.font = `${text.bold === true ? 'bold ' : ''}${text.size}px ${OVERLAY_FONT}`;
    context.textAlign = text.align;
    context.textBaseline = text.baseline;
    if (text.box !== undefined) {
      const w = labelWidth(text.text, text.size);
      const h = text.size + 6;
      const x =
        text.align === 'center' ? text.x - w / 2 : text.align === 'right' ? text.x - w : text.x;
      const y =
        text.baseline === 'middle'
          ? text.y - h / 2
          : text.baseline === 'bottom'
            ? text.y - h
            : text.y;
      context.fillStyle = text.box.fill;
      context.fillRect(x, y, w, h);
      context.strokeStyle = text.box.stroke;
      context.lineWidth = 1;
      context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      context.fillStyle = text.colour;
      const tx =
        text.align === 'center' ? text.x : text.align === 'right' ? text.x - 4 : text.x + 4;
      const ty =
        text.baseline === 'top' ? text.y + 3 : text.baseline === 'bottom' ? text.y - 3 : text.y;
      context.fillText(text.text, tx, ty);
      continue;
    }
    if (text.halo !== undefined) {
      context.strokeStyle = text.halo;
      context.lineWidth = 3;
      context.lineJoin = 'round';
      context.strokeText(text.text, text.x, text.y);
    }
    context.fillStyle = text.colour;
    context.fillText(text.text, text.x, text.y);
  }
}
