/**
 * Residue painted where it is: from the residue map of a washed item (the cells of its surface
 * that still carry soil, with position, normal, area and how much of each soil is left) to
 * what is drawn on the item. Pure functions, no Three.js; `residue-object.ts` makes the
 * objects.
 *
 * How a cell is drawn. A small rectangular tile in the tangent plane of the surface at the
 * cell's centre, as wide and as deep as the cell and turned as the grid of cells lies, facing
 * along the cell's outward normal, so that it is seen from the side of the wall it lies on and
 * not from the other. Its colour says how much of the soil that lay there is
 * left, in four steps of one hue (a magenta that no material and no soil of the catalogue
 * has), light for little and dark for much: `RESIDUE_STEPS`. Under the tiles at the edge of a
 * patch (those that lack a neighbour on some side) lies a second, slightly larger square in an
 * outline colour chosen against the material of the item (near black on light materials,
 * white on dark ones): it shows as a rim round every patch of residue. The rim is what makes
 * the scale read on every material: one hue cannot contrast with white porcelain, bright
 * steel and a black pan at once, a rim chosen per material can (`residueOutline`; the tests
 * check every catalogue material).
 *
 * Which cells are drawn. Those the inspection counts as visibly soiled, as tiles. The rest of
 * the map (traces too faint to count) only on request, as dots a third the size in the
 * lightest step, so that they are never mistaken for what cost the points.
 *
 * Frames. Everything is in the item frame of the item's shape, metres: the frame in which the
 * item's mesh is built and to which its draw pose applies. Nothing is mirrored or re-based.
 */

import type { Rgb } from './types.ts';

/**
 * A residue map as it comes over the wire: structurally the `ResidueMap` of the session
 * contract (packed little-endian integers in base64), which this package does not depend on.
 */
export interface ResidueMapInput {
  readonly item_id: string;
  readonly soils: readonly string[];
  readonly cells: number;
  readonly position_quantum_mm: number;
  readonly area_quantum_mm2: number;
  readonly positions: string;
  readonly normals: string;
  readonly areas: string;
  readonly fractions: string;
  readonly visible: string;
}

/** The cells of a residue map, unpacked. */
export interface ResidueCellData {
  /** Number of cells N. */
  readonly count: number;
  /** [N x 3] centres in the item frame, metres. */
  readonly centre: Float32Array;
  /** [N x 3] outward unit normals, item frame. */
  readonly normal: Float32Array;
  /** [N] areas, mm2. */
  readonly areaMm2: Float32Array;
  /** The soils of the columns of `fraction`. */
  readonly soils: readonly string[];
  /** [N x soils.length] share of each soil that is left on the cell, 0 to 1. */
  readonly fraction: Float32Array;
  /** [N] 1 where the cell counts as visibly soiled. */
  readonly visible: Uint8Array;
}

function bytesOf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Unpacks a residue map. Throws a RangeError for a map whose arrays do not fit its counts. */
export function decodeResidueMap(map: ResidueMapInput): ResidueCellData {
  const n = map.cells;
  const k = map.soils.length;
  const positions = bytesOf(map.positions);
  const normals = bytesOf(map.normals);
  const areas = bytesOf(map.areas);
  const fractions = bytesOf(map.fractions);
  const visible = bytesOf(map.visible);
  if (
    positions.length !== 6 * n ||
    normals.length !== 3 * n ||
    areas.length !== 2 * n ||
    fractions.length !== n * k ||
    visible.length !== n
  ) {
    throw new RangeError(`residue map of ${map.item_id}: the arrays do not fit its counts`);
  }
  const positionView = new DataView(positions.buffer);
  const normalView = new DataView(normals.buffer);
  const areaView = new DataView(areas.buffer);
  const centre = new Float32Array(3 * n);
  const normal = new Float32Array(3 * n);
  const areaMm2 = new Float32Array(n);
  const fraction = new Float32Array(n * k);
  for (let i = 0; i < 3 * n; i++) {
    centre[i] = (positionView.getInt16(2 * i, true) * map.position_quantum_mm) / 1000;
    normal[i] = normalView.getInt8(i) / 127;
  }
  for (let i = 0; i < n; i++) areaMm2[i] = areaView.getUint16(2 * i, true) * map.area_quantum_mm2;
  for (let i = 0; i < n * k; i++) fraction[i] = (fractions[i] as number) / 255;
  return { count: n, centre, normal, areaMm2, soils: [...map.soils], fraction, visible };
}

// ---------------------------------------------------------------------------------------------
// The colour scale
// ---------------------------------------------------------------------------------------------

/** One step of the residue scale. */
export interface ResidueStep {
  /** The step covers shares of the soil above `above` and up to `upTo`. */
  readonly above: number;
  readonly upTo: number;
  /** Colour of the step, sRGB. */
  readonly colour: Rgb;
  /** The same as a CSS colour, for legends. */
  readonly css: string;
  /** What the step means, for legends. */
  readonly label: string;
}

function hexRgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function step(above: number, upTo: number, css: string, label: string): ResidueStep {
  return { above, upTo, colour: hexRgb(css), css, label };
}

/**
 * The residue scale: how much of the soil that lay on a spot is still there, in four steps of
 * one hue from light (little) to dark (much). OKLCH lightness 0.73, 0.66, 0.58, 0.50 at hue
 * 345: monotone, 0.07 or more apart, and within the band in which a mark has a contrast of 2
 * or more against white porcelain and against a black pan alike.
 */
export const RESIDUE_STEPS: readonly ResidueStep[] = [
  step(0, 0.25, '#f077c0', 'up to a quarter left'),
  step(0.25, 0.5, '#e54eaf', 'up to half left'),
  step(0.5, 0.75, '#d2119a', 'up to three quarters left'),
  step(0.75, 1, '#b30080', 'nearly all left'),
];

/** The step of the scale for a share of soil left (0 to 1; anything else counts as 0). */
export function residueStep(fraction: number): ResidueStep {
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  for (const candidate of RESIDUE_STEPS) if (f <= candidate.upTo) return candidate;
  return RESIDUE_STEPS[RESIDUE_STEPS.length - 1] as ResidueStep;
}

/** Outline of residue on light materials, and on dark ones. */
export const RESIDUE_OUTLINE_DARK: Rgb = hexRgb('#1d1020');
export const RESIDUE_OUTLINE_LIGHT: Rgb = [1, 1, 1];

/** Relative luminance of an sRGB colour (WCAG). */
export function luminance(colour: Rgb): number {
  const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(colour[0]) + 0.7152 * linear(colour[1]) + 0.0722 * linear(colour[2]);
}

/** Contrast ratio of two sRGB colours (WCAG), 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The outline colour of residue on a material of the given base colour: the darker of the two
 * outlines on a light material, the lighter on a dark one, whichever contrasts more.
 */
export function residueOutline(materialColour: Rgb): Rgb {
  return contrastRatio(RESIDUE_OUTLINE_DARK, materialColour) >=
    contrastRatio(RESIDUE_OUTLINE_LIGHT, materialColour)
    ? RESIDUE_OUTLINE_DARK
    : RESIDUE_OUTLINE_LIGHT;
}

// ---------------------------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------------------------

/** How the cells of a map are turned into tiles. */
export interface ResidueTileOptions {
  /**
   * Which soil colours the tiles: an index into the map's `soils`, or null (the default) for
   * the soil of which most is left on each cell.
   */
  readonly soil?: number | null;
  /** Also draw the cells that carry a trace too faint to count, as small dots. Default false. */
  readonly traces?: boolean;
}

/**
 * A tile covers its cell and a little more, so that neighbours leave no gap between them. The
 * cells of an item are not square: on a body of revolution they are as wide as their ring is
 * divided and as long as the ring is deep. So a tile is a rectangle laid along the grid its
 * cell sits in, which is read off the cell's nearest neighbour (`layoutCells`).
 */
export const TILE_OVERLAP = 1.15;
/** Width of the rim the outline shows round a patch, metres. */
export const OUTLINE_WIDTH = 0.00045;
/**
 * How far the tiles and their outlines stand off the surface, metres: enough for the flat
 * rectangle of a tile to stay clear of a wall that curves towards it (the inside of a mug).
 */
export const TILE_LIFT = 0.00012;
export const OUTLINE_LIFT = 0.00008;
/** Side of the dot of a trace as a share of the side of a square of its cell's area. */
export const TRACE_DOT = 0.35;

/**
 * Rules of the layout, in sides of a square of the cell's area. A neighbour is looked for
 * within `NEIGHBOUR_SEARCH`; it is on the same face when it is within `NEIGHBOUR_PLANE` of the
 * cell's tangent plane (the far face of a thin wall is not); a cell is taken to be between
 * `EXTENT_MIN` and `EXTENT_MAX` wide; and a tile has a neighbour on a side when one lies
 * within `EDGE_REACH` cell widths that way.
 */
const NEIGHBOUR_SEARCH = 2.4;
const NEIGHBOUR_PLANE = 0.75;
const EXTENT_MIN = 0.4;
const EXTENT_MAX = 2.5;
const EDGE_REACH = 1.75;

/** The tiles of a residue map: per tile a 4 x 4 transform (column-major) and a colour. */
export interface ResidueTiles {
  /** Number of tiles. */
  readonly count: number;
  /** Index of the cell of each tile in the map. */
  readonly cell: Uint32Array;
  /** [count x 16] item-frame transforms of a unit square in the x-y plane facing +z. */
  readonly fill: Float32Array;
  /**
   * [count x 16] the same for the outline rectangles, which are larger and lie lower. A tile
   * without a rim has one of no size.
   */
  readonly outline: Float32Array;
  /** [count] 1 for a tile at the edge of a patch, which has a rim. */
  readonly rimmed: Uint8Array;
  /** [count x 3] sRGB colour of each tile. */
  readonly colour: Float32Array;
  /** [count] the share of soil left that the colour stands for. */
  readonly fraction: Float32Array;
}

/** The share of soil left on a cell by the chosen soil, or the largest over its soils. */
export function cellFraction(cells: ResidueCellData, cell: number, soil: number | null): number {
  const k = cells.soils.length;
  if (soil !== null) return soil >= 0 && soil < k ? (cells.fraction[cell * k + soil] as number) : 0;
  let most = 0;
  for (let s = 0; s < k; s++) most = Math.max(most, cells.fraction[cell * k + s] as number);
  return most;
}

/**
 * Two unit vectors that span the tangent plane at a point, the first along the circumference
 * about the item's z axis where there is one: the frame of a cell that has no neighbour to
 * show how its grid lies.
 */
function circumferentialFrame(
  px: number,
  py: number,
  nx: number,
  ny: number,
  nz: number,
): [number, number, number, number, number, number] {
  // Circumferential direction at the position, made perpendicular to the normal.
  let tx = -py;
  let ty = px;
  let tz = 0;
  let dot = tx * nx + ty * ny;
  tx -= dot * nx;
  ty -= dot * ny;
  tz -= dot * nz;
  let length = Math.hypot(tx, ty, tz);
  if (length < 1e-6) {
    // On the axis, or a normal along the circumference: any direction across the normal.
    const ax = Math.abs(nx) < 0.9 ? 1 : 0;
    const ay = ax === 1 ? 0 : 1;
    dot = ax * nx + ay * ny;
    tx = ax - dot * nx;
    ty = ay - dot * ny;
    tz = -dot * nz;
    length = Math.hypot(tx, ty, tz);
  }
  tx /= length;
  ty /= length;
  tz /= length;
  return [tx, ty, tz, ny * tz - nz * ty, nz * tx - nx * tz, nx * ty - ny * tx];
}

/** A grid of buckets over some cells of a map, for finding the cells near a point. */
class CellIndex {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly cells: ResidueCellData,
    members: Iterable<number>,
    private readonly pitch: number,
  ) {
    for (const cell of members) {
      const key = this.key(
        Math.floor((cells.centre[3 * cell] as number) / pitch),
        Math.floor((cells.centre[3 * cell + 1] as number) / pitch),
        Math.floor((cells.centre[3 * cell + 2] as number) / pitch),
      );
      const bucket = this.buckets.get(key);
      if (bucket === undefined) this.buckets.set(key, [cell]);
      else bucket.push(cell);
    }
  }

  private key(ix: number, iy: number, iz: number): string {
    return `${ix},${iy},${iz}`;
  }

  /** Calls `visit` with every member within one pitch of a cell (and some a little further). */
  near(cell: number, visit: (other: number, dx: number, dy: number, dz: number) => void): void {
    const { centre } = this.cells;
    const px = centre[3 * cell] as number;
    const py = centre[3 * cell + 1] as number;
    const pz = centre[3 * cell + 2] as number;
    const cx = Math.floor(px / this.pitch);
    const cy = Math.floor(py / this.pitch);
    const cz = Math.floor(pz / this.pitch);
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iy = cy - 1; iy <= cy + 1; iy++) {
        for (let iz = cz - 1; iz <= cz + 1; iz++) {
          for (const other of this.buckets.get(this.key(ix, iy, iz)) ?? []) {
            if (other === cell) continue;
            visit(
              other,
              (centre[3 * other] as number) - px,
              (centre[3 * other + 1] as number) - py,
              (centre[3 * other + 2] as number) - pz,
            );
          }
        }
      }
    }
  }
}

/** How the cells of a map lie: per cell its unit normal, two tangents and its two extents. */
interface CellLayout {
  /** [N x 3] unit normals. */
  readonly normal: Float32Array;
  /** [N x 6] the two unit tangents: along the grid, and across it. */
  readonly frame: Float32Array;
  /** [N x 2] extent of the cell along each tangent, metres; their product is its area. */
  readonly extent: Float32Array;
  /** Longest side of a square of a cell's area, metres. */
  readonly longest: number;
}

/**
 * Reads the grid off the cells themselves. The nearest neighbour of a cell on the same face
 * lies along the shorter side of the cell: the direction to it is the first tangent and the
 * distance the extent that way; the other extent follows from the area. A cell with no
 * neighbour in reach is a square turned along the circumference.
 */
function layoutCells(cells: ResidueCellData): CellLayout {
  const n = cells.count;
  const normal = new Float32Array(3 * n);
  const frame = new Float32Array(6 * n);
  const extent = new Float32Array(2 * n);
  let longest = 0;
  for (let i = 0; i < n; i++) {
    longest = Math.max(longest, Math.sqrt(Math.max(0, cells.areaMm2[i] as number)) / 1000);
    const nx = cells.normal[3 * i] as number;
    const ny = cells.normal[3 * i + 1] as number;
    const nz = cells.normal[3 * i + 2] as number;
    const length = Math.hypot(nx, ny, nz) || 1;
    normal.set([nx / length, ny / length, nz / length], 3 * i);
  }
  const all = Array.from({ length: n }, (_, i) => i);
  const index = new CellIndex(cells, all, Math.max(1e-6, longest * NEIGHBOUR_SEARCH));
  for (let i = 0; i < n; i++) {
    const nx = normal[3 * i] as number;
    const ny = normal[3 * i + 1] as number;
    const nz = normal[3 * i + 2] as number;
    const side = Math.sqrt(Math.max(0, cells.areaMm2[i] as number)) / 1000;
    let best = Infinity;
    let tx = 0;
    let ty = 0;
    let tz = 0;
    index.near(i, (_other, dx, dy, dz) => {
      const off = dx * nx + dy * ny + dz * nz;
      if (Math.abs(off) > NEIGHBOUR_PLANE * side) return;
      // The step to the neighbour within the tangent plane.
      const ux = dx - off * nx;
      const uy = dy - off * ny;
      const uz = dz - off * nz;
      const distance = Math.hypot(ux, uy, uz);
      if (distance < 0.2 * side || distance > NEIGHBOUR_SEARCH * side || distance >= best) return;
      best = distance;
      tx = ux / distance;
      ty = uy / distance;
      tz = uz / distance;
    });
    if (best === Infinity || !(side > 0)) {
      frame.set(
        circumferentialFrame(
          cells.centre[3 * i] as number,
          cells.centre[3 * i + 1] as number,
          nx,
          ny,
          nz,
        ),
        6 * i,
      );
      extent.set([side, side], 2 * i);
      continue;
    }
    const along = Math.max(EXTENT_MIN * side, Math.min(EXTENT_MAX * side, best));
    frame.set([tx, ty, tz, ny * tz - nz * ty, nz * tx - nx * tz, nx * ty - ny * tx], 6 * i);
    extent.set([along, (side * side) / along], 2 * i);
  }
  return { normal, frame, extent, longest };
}

function writeTransform(
  out: Float32Array,
  at: number,
  layout: CellLayout,
  cell: number,
  centre: Float32Array,
  width: number,
  depth: number,
  lift: number,
): void {
  const f = layout.frame;
  const nx = layout.normal[3 * cell] as number;
  const ny = layout.normal[3 * cell + 1] as number;
  const nz = layout.normal[3 * cell + 2] as number;
  out.set(
    [
      (f[6 * cell] as number) * width,
      (f[6 * cell + 1] as number) * width,
      (f[6 * cell + 2] as number) * width,
      0,
      (f[6 * cell + 3] as number) * depth,
      (f[6 * cell + 4] as number) * depth,
      (f[6 * cell + 5] as number) * depth,
      0,
      nx,
      ny,
      nz,
      0,
      (centre[3 * cell] as number) + nx * lift,
      (centre[3 * cell + 1] as number) + ny * lift,
      (centre[3 * cell + 2] as number) + nz * lift,
      1,
    ],
    at,
  );
}

/**
 * Which of some cells lie at the edge of a patch: a cell is inside one when it has a neighbour
 * among them on each of its four sides (along its two tangents and against them). Returns the
 * set of the cells at an edge.
 */
function patchEdges(
  cells: ResidueCellData,
  layout: CellLayout,
  members: readonly number[],
): Set<number> {
  const edges = new Set<number>();
  const index = new CellIndex(
    cells,
    members,
    Math.max(1e-6, layout.longest * EXTENT_MAX * EDGE_REACH),
  );
  for (const cell of members) {
    const f = layout.frame;
    const nx = layout.normal[3 * cell] as number;
    const ny = layout.normal[3 * cell + 1] as number;
    const nz = layout.normal[3 * cell + 2] as number;
    const width = layout.extent[2 * cell] as number;
    const depth = layout.extent[2 * cell + 1] as number;
    const plane = NEIGHBOUR_PLANE * Math.sqrt(width * depth);
    let sides = 0;
    index.near(cell, (_other, dx, dy, dz) => {
      if (sides === 15 || Math.abs(dx * nx + dy * ny + dz * nz) > plane) return;
      // Where the neighbour lies, in widths and depths of this cell.
      const u =
        (dx * (f[6 * cell] as number) +
          dy * (f[6 * cell + 1] as number) +
          dz * (f[6 * cell + 2] as number)) /
        width;
      const v =
        (dx * (f[6 * cell + 3] as number) +
          dy * (f[6 * cell + 4] as number) +
          dz * (f[6 * cell + 5] as number)) /
        depth;
      if (Math.abs(u) > EDGE_REACH || Math.abs(v) > EDGE_REACH) return;
      // The side the neighbour is on: the tangent it lies along more.
      if (Math.abs(u) >= Math.abs(v)) sides |= u > 0 ? 1 : 2;
      else sides |= v > 0 ? 4 : 8;
    });
    if (sides !== 15) edges.add(cell);
  }
  return edges;
}

/**
 * The tiles that draw a residue map: one per visibly soiled cell and, with `traces`, a dot per
 * fainter one. Cells of which the chosen soil has nothing left are not drawn.
 */
export function residueTiles(
  cells: ResidueCellData,
  options: ResidueTileOptions = {},
): ResidueTiles {
  const soil = options.soil ?? null;
  const drawn: number[] = [];
  for (let i = 0; i < cells.count; i++) {
    if (cells.visible[i] !== 1 && options.traces !== true) continue;
    if (!(cellFraction(cells, i, soil) > 0)) continue;
    drawn.push(i);
  }
  const count = drawn.length;
  const fill = new Float32Array(16 * count);
  const outline = new Float32Array(16 * count);
  const rimmed = new Uint8Array(count);
  const colour = new Float32Array(3 * count);
  const fraction = new Float32Array(count);
  // The grid is read off every cell of the map, drawn or not: a trace is still a cell of it.
  const layout = layoutCells(cells);
  // Rims go round patches of what counts: the visibly soiled cells among themselves.
  const edges = patchEdges(
    cells,
    layout,
    drawn.filter((cell) => cells.visible[cell] === 1),
  );
  drawn.forEach((cell, t) => {
    const seen = cells.visible[cell] === 1;
    const width = layout.extent[2 * cell] as number;
    const depth = layout.extent[2 * cell + 1] as number;
    const dot = Math.sqrt(width * depth) * TRACE_DOT;
    const share = cellFraction(cells, cell, soil);
    writeTransform(
      fill,
      16 * t,
      layout,
      cell,
      cells.centre,
      seen ? width * TILE_OVERLAP : dot,
      seen ? depth * TILE_OVERLAP : dot,
      TILE_LIFT,
    );
    // A rim only at the edge of a patch; and a trace has none: it is not what the item was
    // marked down for.
    const rim = seen && edges.has(cell);
    rimmed[t] = rim ? 1 : 0;
    writeTransform(
      outline,
      16 * t,
      layout,
      cell,
      cells.centre,
      rim ? width * TILE_OVERLAP + 2 * OUTLINE_WIDTH : 0,
      rim ? depth * TILE_OVERLAP + 2 * OUTLINE_WIDTH : 0,
      OUTLINE_LIFT,
    );
    // A trace is always the lightest step, whatever share of a thin film it is.
    const tint = seen ? residueStep(share).colour : (RESIDUE_STEPS[0] as ResidueStep).colour;
    colour.set(tint, 3 * t);
    fraction[t] = share;
  });
  return { count, cell: Uint32Array.from(drawn), fill, outline, rimmed, colour, fraction };
}

/** What a residue map holds, in numbers, for a legend or a caption. */
export interface ResidueSummary {
  /** Cells counted as visibly soiled, and their area, mm2. */
  readonly visibleCells: number;
  readonly visibleAreaMm2: number;
  /** Cells that carry only a trace. */
  readonly traceCells: number;
  /** Visibly soiled area per step of {@link RESIDUE_STEPS}, mm2. */
  readonly areaByStepMm2: readonly number[];
}

/** Sums a residue map for a legend. */
export function summariseResidue(
  cells: ResidueCellData,
  soil: number | null = null,
): ResidueSummary {
  const byStep = RESIDUE_STEPS.map(() => 0);
  let visibleCells = 0;
  let visibleArea = 0;
  let traces = 0;
  for (let i = 0; i < cells.count; i++) {
    const share = cellFraction(cells, i, soil);
    if (!(share > 0)) continue;
    if (cells.visible[i] !== 1) {
      traces += 1;
      continue;
    }
    visibleCells += 1;
    const area = cells.areaMm2[i] as number;
    visibleArea += area;
    const at = RESIDUE_STEPS.indexOf(residueStep(share));
    byStep[at] = (byStep[at] as number) + area;
  }
  return {
    visibleCells,
    visibleAreaMm2: visibleArea,
    traceCells: traces,
    areaByStepMm2: byStep,
  };
}
