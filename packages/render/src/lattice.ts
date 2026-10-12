/**
 * How the open parts of the machine are drawn. The machine's geometry gives a lattice (a wall
 * of the cutlery basket, a folding shelf, the slotted floor of the tablet tray) as one closed
 * slab that carries the open fraction of the lattice as `Part.porosity`: closed for collision,
 * open by that share for the water of the wash. Drawn as the slab it would look closed, and a
 * player would take it that no water gets through. Here the slab is turned into what it stands
 * for: bars with openings between them, or, where the holes are too fine for bars (the
 * perforated sheet of the filter), a sheet with a pattern of dots.
 *
 * Only the drawing is made here. The shape, and with it collision and the wash, is not touched.
 *
 * The size and direction of the openings are those of the owner's machine, by part; the width
 * of the bars is then whatever gives the open fraction the part carries, so that the share of
 * a lattice one can see through is exactly the share of the water the wash lets through.
 *
 * Pure arithmetic, no Three.js.
 */

import type { Vec3 } from '@spotless/core';
import type { Part } from '@spotless/geometry';

/** An axis of a part's own frame. */
export type Axis = 0 | 1 | 2;

/** The openings of a lattice of bars. */
export interface BarPattern {
  readonly kind: 'bars';
  /** Short and long side of an opening, metres. */
  readonly opening: readonly [short: number, long: number];
  /**
   * The axis of the part frame the long side of an opening runs along. When that is the axis
   * the slab is thinnest along, the long side runs along the longer side of the slab.
   */
  readonly long: Axis;
}

/** Round holes in a sheet, too small to be drawn one by one: a staggered pattern of dots. */
export interface DotPattern {
  readonly kind: 'dots';
  /**
   * Distance between the centres of neighbouring holes, metres. The holes are drawn as large
   * as gives the open fraction the part carries (for the flat plate of the filter that is its
   * real 0.85 mm; the sump cover is perforated over part of its face only, and its holes come
   * out smaller than the real 1.25 mm for it).
   */
  readonly pitch: number;
}

export type LatticePattern = BarPattern | DotPattern;

const mm = (value: number): number => value / 1000;

/**
 * The openings of the lattices of the owner's machine, by machine part and sub-part: the first
 * rule that matches applies. Sizes from the machine's specification where it has them (the
 * cutlery basket, the filter), otherwise read off the owner's photographs.
 */
const PATTERNS: readonly (readonly [part: RegExp, subPart: RegExp, LatticePattern])[] = [
  // Cutlery basket (specification: wall openings 7 by 16 mm, floor slots 3.5 by 14 mm, lid
  // grids 9 mm holes and 26 mm slots). IMG_9080: the openings of the walls stand upright.
  [/^cutlery_basket$/, /^foot\.\d+\.floor$/, { kind: 'bars', opening: [mm(3.5), mm(14)], long: 0 }],
  [/^cutlery_basket$/, /^lid\./, { kind: 'bars', opening: [mm(9), mm(26)], long: 1 }],
  [/^cutlery_basket$/, /./, { kind: 'bars', opening: [mm(7), mm(16)], long: 2 }],
  // Folding cup shelves and the knife shelf (IMG_9083, IMG_9131: near-square openings).
  [/_fittings$/, /^(shelf|holder)\./, { kind: 'bars', opening: [mm(14), mm(14)], long: 1 }],
  // Tablet collecting tray: short slots running front to back (IMG_9083).
  [/tablet_tray$/, /^floor$/, { kind: 'bars', opening: [mm(4), mm(20)], long: 1 }],
  // Filter (specification: 0.85 mm holes at 1.47 mm, 1.25 mm holes at 2.1 mm).
  [/^filter$/, /^flat_plate$/, { kind: 'dots', pitch: mm(1.47) }],
  [/^filter$/, /^sump_cover$/, { kind: 'dots', pitch: mm(2.1) }],
];

/** Drawn for an open part no rule knows: square openings 8 mm wide. */
export const FALLBACK_PATTERN: BarPattern = { kind: 'bars', opening: [mm(8), mm(8)], long: 2 };

/** Openings narrower than this are not drawn as bars, metres. */
export const FINEST_BAR_OPENING = 0.002;

/**
 * How an open part is drawn, or null when it is drawn as the solid it is: a part with no open
 * fraction, or one that is not a slab.
 */
export function latticePattern(machinePartId: string, part: Part): LatticePattern | null {
  const porosity = part.porosity ?? 0;
  if (!(porosity > 0) || part.prim.kind !== 'rbox') return null;
  for (const [partRule, subPartRule, pattern] of PATTERNS) {
    if (partRule.test(machinePartId) && subPartRule.test(part.id)) return pattern;
  }
  return FALLBACK_PATTERN;
}

/**
 * Width of the bars of a lattice of rectangular openings that has the open fraction
 * `openFraction`: the `b` for which `w h / ((w + b)(h + b))` is that fraction.
 */
export function barWidth(opening: readonly [number, number], openFraction: number): number {
  const [w, h] = opening;
  const sum = w + h;
  return (-sum + Math.sqrt(sum * sum + 4 * w * h * (1 / openFraction - 1))) / 2;
}

/** The bars of a slab along one of its sides: `count` openings between `count + 1` bars. */
interface Run {
  readonly axis: Axis;
  /** Length of the slab along the axis, metres. */
  readonly length: number;
  /** Number of openings along the axis. */
  readonly count: number;
  /** Distance from bar to bar, metres. */
  readonly pitch: number;
}

/** A slab as a lattice: where its bars are. Part frame, metres. */
export interface BarLayout {
  /** The axis the slab is thinnest along; every bar goes through the slab along it. */
  readonly through: Axis;
  /** Full size of the slab along the three axes. */
  readonly size: Vec3;
  /** Width of a bar. */
  readonly bar: number;
  /** The two sides of the slab: the first is the one the short side of an opening lies along. */
  readonly runs: readonly [Run, Run];
  /** Size of an opening as drawn, along the axes of `runs`. */
  readonly opening: readonly [number, number];
  /** Share of the face of the slab that is open as drawn, 0 to 1. */
  readonly openFraction: number;
}

/** How many openings of about the wanted size fit along a side, with a bar at each end. */
function openings(length: number, opening: number, bar: number): number {
  return Math.max(1, Math.round((length - bar) / (opening + bar)));
}

/**
 * Lays the bars of a pattern out on a slab: a frame round the edge and bars across both ways.
 * A whole number of openings must fit, so the openings are stretched or squeezed a little; the
 * bars are then made as wide as leaves exactly the open fraction the part carries (a little
 * narrower than between openings without end, since the frame is bar too). Null when the part
 * is not a slab or is too small to have an opening.
 */
export function barLayout(part: Part, pattern: BarPattern): BarLayout | null {
  if (part.prim.kind !== 'rbox') return null;
  const porosity = part.porosity ?? 0;
  if (!(porosity > 0 && porosity < 1)) return null;
  const { halfExtents, radius } = part.prim;
  const size: Vec3 = [
    2 * (halfExtents[0] + radius),
    2 * (halfExtents[1] + radius),
    2 * (halfExtents[2] + radius),
  ];
  const through = ([0, 1, 2] as const).reduce<Axis>((a, b) => (size[b] < size[a] ? b : a), 0);
  const sides = ([0, 1, 2] as const).filter((axis) => axis !== through) as [Axis, Axis];
  const longer = size[sides[0]] >= size[sides[1]] ? sides[0] : sides[1];
  const longAxis = pattern.long === through ? longer : pattern.long;
  const shortAxis = sides[0] === longAxis ? sides[1] : sides[0];
  const nominal = barWidth(pattern.opening, porosity);
  if (size[shortAxis] <= 2.5 * nominal || size[longAxis] <= 2.5 * nominal) return null;
  const counts: [number, number] = [
    openings(size[shortAxis], pattern.opening[0], nominal),
    openings(size[longAxis], pattern.opening[1], nominal),
  ];
  // (1 - alpha b)(1 - beta b) = open fraction, alpha and beta the bars per metre of each side.
  const alpha = (counts[0] + 1) / size[shortAxis];
  const beta = (counts[1] + 1) / size[longAxis];
  const bar =
    (alpha + beta - Math.sqrt((alpha + beta) ** 2 - 4 * alpha * beta * (1 - porosity))) /
    (2 * alpha * beta);
  const runs: [Run, Run] = [
    {
      axis: shortAxis,
      length: size[shortAxis],
      count: counts[0],
      pitch: (size[shortAxis] - bar) / counts[0],
    },
    {
      axis: longAxis,
      length: size[longAxis],
      count: counts[1],
      pitch: (size[longAxis] - bar) / counts[1],
    },
  ];
  const opening: [number, number] = [runs[0].pitch - bar, runs[1].pitch - bar];
  return {
    through,
    size,
    bar,
    runs,
    opening,
    openFraction:
      (runs[0].count * opening[0] * runs[1].count * opening[1]) / (runs[0].length * runs[1].length),
  };
}

/** An axis-aligned box in a part's frame, by its centre and half its size. */
export interface BarBox {
  readonly centre: Vec3;
  readonly half: Vec3;
}

/** The bars of a layout as boxes in the part frame: each runs the whole length of the slab. */
export function barBoxes(layout: BarLayout): BarBox[] {
  const boxes: BarBox[] = [];
  const [a, b] = layout.runs;
  for (const [across, along] of [
    [a, b],
    [b, a],
  ] as const) {
    for (let i = 0; i <= across.count; i++) {
      const centre: [number, number, number] = [0, 0, 0];
      const half: [number, number, number] = [0, 0, 0];
      centre[across.axis] = -across.length / 2 + layout.bar / 2 + i * across.pitch;
      half[across.axis] = layout.bar / 2;
      half[along.axis] = along.length / 2;
      half[layout.through] = layout.size[layout.through] / 2;
      boxes.push({ centre, half });
    }
  }
  return boxes;
}

/** Triangles of a drawing: three vertices each, unindexed, with a normal per vertex. */
export interface TriangleSoup {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
}

// The six faces of a box: the axis of the normal, its sign, and the corners counter-clockwise
// seen from outside as signs along the two other axes (in cyclic order after the normal's).
const FACE_CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function rotate(q: readonly [number, number, number, number], v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  // v + 2 w (u x v) + 2 u x (u x v), u = (x, y, z)
  const cx = y * v[2] - z * v[1];
  const cy = z * v[0] - x * v[2];
  const cz = x * v[1] - y * v[0];
  return [
    v[0] + 2 * (w * cx + y * cz - z * cy),
    v[1] + 2 * (w * cy + z * cx - x * cz),
    v[2] + 2 * (w * cz + x * cy - y * cx),
  ];
}

/**
 * The bars of several parts of one shape as triangles in the frame of the shape (each part's
 * boxes taken through the part's pose): twelve triangles a bar, flat faces.
 */
export function barTriangles(
  bars: readonly { readonly part: Part; readonly boxes: readonly BarBox[] }[],
): TriangleSoup {
  let count = 0;
  for (const entry of bars) count += entry.boxes.length;
  const positions = new Float32Array(count * 108);
  const normals = new Float32Array(count * 108);
  let at = 0;
  for (const { part, boxes } of bars) {
    const { p, q } = part.pose;
    for (const box of boxes) {
      for (let axis = 0; axis < 3; axis++) {
        const u = (axis + 1) % 3;
        const v = (axis + 2) % 3;
        for (const sign of [-1, 1]) {
          const local: [number, number, number] = [0, 0, 0];
          local[axis] = sign;
          const normal = rotate(q, local);
          const corners = FACE_CORNERS.map(([su, sv]) => {
            const corner: [number, number, number] = [0, 0, 0];
            corner[axis] = (box.centre[axis] as number) + sign * (box.half[axis] as number);
            // Mirrored for the face on the negative side, so that it too is seen from outside.
            corner[u] = (box.centre[u] as number) + sign * su * (box.half[u] as number);
            corner[v] = (box.centre[v] as number) + sv * (box.half[v] as number);
            const turned = rotate(q, corner);
            return [turned[0] + p[0], turned[1] + p[1], turned[2] + p[2]] as const;
          });
          for (const index of [0, 1, 2, 0, 2, 3]) {
            positions.set(corners[index] as readonly number[], at);
            normals.set(normal, at);
            at += 3;
          }
        }
      }
    }
  }
  return { positions, normals };
}

/** A tile of a dot pattern: a picture that repeats, and the size it covers. */
export interface DotTile {
  /** Side of the square picture, pixels. */
  readonly pixels: number;
  /** RGBA bytes, row by row: the sheet white (it takes the colour of the material), holes dark. */
  readonly data: Uint8Array;
  /** What the tile covers along the two sides of the sheet, metres: one pitch by a staggered pair of rows. */
  readonly size: readonly [number, number];
  /** Share of the tile that is hole, 0 to 1. */
  readonly openFraction: number;
}

/** Brightness of a hole against the sheet round it (the dark under the sheet shows through). */
export const HOLE_SHADE = 0.1;

/**
 * The tile of a staggered pattern of round holes: a hole at each corner and one in the middle
 * of a tile one pitch wide and the square root of three pitches high, the holes of the size
 * that makes `openFraction` of the sheet hole. The edge of a hole is softened over a pixel, so
 * that the pattern does not flicker.
 */
export function dotTile(pattern: DotPattern, openFraction: number, pixels = 32): DotTile {
  const size: [number, number] = [pattern.pitch, pattern.pitch * Math.sqrt(3)];
  const data = new Uint8Array(pixels * pixels * 4);
  // Two holes to a tile of pitch by sqrt(3) pitch.
  const radius =
    pattern.pitch *
    Math.sqrt((Math.min(Math.max(openFraction, 0), 0.9) * Math.sqrt(3)) / (2 * Math.PI));
  const centres: readonly (readonly [number, number])[] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0.5, 0.5],
  ];
  const edge = size[0] / pixels;
  let open = 0;
  for (let j = 0; j < pixels; j++) {
    for (let i = 0; i < pixels; i++) {
      const x = ((i + 0.5) / pixels) * size[0];
      const y = ((j + 0.5) / pixels) * size[1];
      let nearest = Infinity;
      for (const [cx, cy] of centres) {
        nearest = Math.min(nearest, Math.hypot(x - cx * size[0], y - cy * size[1]));
      }
      const hole = Math.min(1, Math.max(0, (radius - nearest) / edge + 0.5));
      open += hole;
      const value = Math.round(255 * (1 - hole * (1 - HOLE_SHADE)));
      data.set([value, value, value, 255], 4 * (j * pixels + i));
    }
  }
  return { pixels, data, size, openFraction: open / (pixels * pixels) };
}
