/**
 * The atlas of one shape: its surface cut into patches of cells, in the item frame, before any
 * pose (docs/design/sim-core.md sections 3.1 to 3.3, simplified as the scene brief says).
 *
 * This file holds the types and the builder that the generators of the three patch kinds write
 * into (`atlas-rev.ts` for shells of revolution and capsules, `atlas-poly.ts` for the planar
 * faces of rounded boxes and hulls and for the flat ends of partial shells). `atlas.ts` runs
 * them over a shape and finishes the atlas.
 *
 * Vocabulary:
 * - a **patch** is one structured grid: rows of cells. On a shell of revolution (kind `rev`) a
 *   row is a band of the closed meridian and its cells are sectors in angle; a thin capsule is a
 *   `rev` patch with one cell per row (a line element that carries the whole circumference); on
 *   a planar face (kind `cart`) rows and columns are a Cartesian grid.
 * - a **cell** is one element of a patch grid, whether or not any surface is left in it;
 * - a **block** is a live cell: one that has area and is not buried in another part of the
 *   shape. Cells without a block map to the nearest block of their patch (of their part, or of
 *   the shape, when the patch has none), so that a ray hit anywhere on the surface finds a
 *   block.
 * - a **surf** is one analytic surface piece (a plane, a revolved line, a revolved arc, a
 *   capsule) on which a ray hit is corrected and from which its patch coordinates follow.
 *
 * Units: metres, radians, m2. Frame: the item frame of the shape unless a name says otherwise.
 */

import type { Shape } from '@spotless/geometry';
import type { Affine } from './affine.ts';
import type { MeridianRun } from './meridian.ts';

/** The value of a block, cell or surf index that means "none". */
export const NO_INDEX = 0xffffffff;

/** Kind of a patch grid. */
export const PATCH_KIND = { rev: 0, cart: 1 } as const;

/** Kind of an analytic surface piece. */
export const SURF_KIND = { plane: 0, revLine: 1, revArc: 2, capsule: 3 } as const;

/** Kind of a link of the cell graph. */
export const LINK_KIND = {
  /** Neighbours inside one patch. */
  patch: 0,
  /** Two faces of one rounded polytope joined through the rounded edge between them. */
  seam: 1,
  /** Two parts of one item joined where they meet. */
  stitch: 2,
} as const;

/** Bits of the per-block flag byte of an atlas. */
export const ATLAS_BLOCK_FLAG = {
  /** A line element: the centre is on the axis of a capsule and the block is its whole ring. */
  line: 1,
  /** The block lies on an open edge of its patch or next to a buried cell. */
  boundary: 2,
} as const;

/** The 2-bit codes of {@link ShapeAtlas.cellQuarter}. */
export const QUARTER_CODE = { byFraction: 0, low: 1, high: 2 } as const;

/**
 * The half (0 or 1) of a block along one axis that a point belongs to: `code` is the 2-bit code
 * of the point's cell for that axis and `fraction` how far across its own cell the point lies.
 */
export function quarterHalf(code: number, fraction: number): 0 | 1 {
  if (code === QUARTER_CODE.low) return 0;
  if (code === QUARTER_CODE.high) return 1;
  return fraction >= 0.5 ? 1 : 0;
}

/** One analytic surface piece, in the frame `frame` maps the item frame into. */
export interface AtlasSurf {
  /** One of {@link SURF_KIND}. */
  readonly kind: number;
  /** Item frame to the local frame of the piece (unscaled for a stretched shell). */
  readonly frame: Affine;
  /**
   * The parameters of the implicit function f, zero on the surface and positive outside:
   * - plane: none (f = z);
   * - revLine: `[nr, nz, c, r0, z0]`, f = nr r + nz z - c with r = hypot(x, y); the piece starts
   *   at (r0, z0) and runs along (-nz, nr);
   * - revArc: `[cr, cz, rho, th0]`, f = hypot(r - cr, z - cz) - rho;
   * - capsule: `[radius, length]`, f = distance to the segment from (0,0,0) to (0,0,length)
   *   minus the radius.
   */
  readonly params: readonly number[];
  /**
   * Patch coordinate along the rows from the parameter of the piece (distance along a line,
   * angle from th0 along an arc, clamped z of a capsule): `s = sBase + sScale * parameter`.
   */
  readonly sBase: number;
  readonly sScale: number;
  /** Range of the parameter on the piece. */
  readonly pMin: number;
  readonly pMax: number;
  /** The pieces before and after it along the meridian, or {@link NO_INDEX}. */
  readonly prev: number;
  readonly next: number;
  /** The patch whose grid the piece is mapped on, or {@link NO_INDEX} when triangles decide. */
  readonly patch: number;
  /** Index of the part. */
  readonly part: number;
}

/** One patch of an atlas. */
export interface AtlasPatch {
  /** One of {@link PATCH_KIND}. */
  readonly kind: number;
  /** True for a line patch: a thin capsule, one cell per row. */
  readonly line: boolean;
  /** Index into `shape.parts`. */
  readonly part: number;
  /**
   * Item frame to patch frame. `rev`: z along the axis, unscaled coordinates. `cart`: x and y in
   * the plane (u and v), z along the outward normal, the surface at z = 0.
   */
  readonly frame: Affine;
  /** Patch frame back to the item frame (with the stretch of a scaled shell). */
  readonly toItem: Affine;
  /** Index of the first row in the row table, and the number of rows. */
  readonly rowStart: number;
  readonly rowCount: number;
  /** Row coordinate: `row = floor((a - a0) / da)`. `rev`: a is arc length s; `cart`: a is v. */
  readonly a0: number;
  readonly da: number;
  /**
   * Column coordinate. `rev`: `b0` is the first azimuth and `db` the angular span of the patch,
   * so `col = floor(frac((theta - b0) / db) * columns of the row)`. `cart`: b is u and
   * `col = floor((u - b0) / db)`.
   */
  readonly b0: number;
  readonly db: number;
  /** `rev`: the rows close on themselves (a meridian that never meets the axis). */
  readonly periodicRows: boolean;
  /** `rev`: a full turn. */
  readonly periodicCols: boolean;
  /** `rev`: the meridian. */
  readonly run: MeridianRun | null;
  /** `rev`: stretch of the shell along x and y of the patch frame. */
  readonly scale: readonly [number, number];
  /** Radius of a capsule patch (line or gridded), metres; 0 otherwise. */
  readonly radius: number;
  /** Line patch: distance between the two centres of the capsule, metres; 0 otherwise. */
  readonly length: number;
  /** `cart`: the convex outline as (u, v) pairs, counter-clockwise; null for a masked face. */
  readonly polygon: readonly number[] | null;
  /** `cart` without an outline: true where (u, v) is on the face. */
  readonly mask: ((u: number, v: number) => boolean) | null;
  /** Open-area fraction of the part (0 solid). */
  readonly porosity: number;
  /** Index of the first cell and number of cells. */
  readonly cellStart: number;
  readonly cellCount: number;
}

/** The triangles of a shape for the ray hierarchy, each with the surf it lies on. */
export interface AtlasTriangles {
  /** Chord error they were tessellated with, metres. */
  readonly chordError: number;
  /** Number of triangles. */
  readonly count: number;
  /** Nine numbers per triangle: three vertices, counter-clockwise seen from outside. */
  readonly positions: Float64Array;
  /** Per triangle: the surf it approximates. */
  readonly surf: Uint32Array;
  /** Per triangle: the patch its hits are mapped on. */
  readonly patch: Uint32Array;
  /** Per triangle: index of its part. */
  readonly part: Uint32Array;
}

/** The finished atlas of one shape at one block size. */
export interface ShapeAtlas {
  readonly shape: Shape;
  /** Nominal block size, metres. */
  readonly blockSize: number;
  /** Length of a line element, metres. */
  readonly lineLength: number;
  readonly patches: readonly AtlasPatch[];
  /** Two numbers per row: index of its first cell, number of columns. */
  readonly rows: Uint32Array;
  /** Per row: index into `shape.regions` of the first region that holds it, or -1. */
  readonly rowRegion: Int16Array;
  /**
   * Per row: index into {@link regionSets} of the set of all regions that hold it (regions of a
   * shape may overlap; `rowRegion` is the first of the set).
   */
  readonly rowRegionSet: Uint16Array;
  /** The distinct sets of regions a row can belong to, each ascending; set 0 is empty. */
  readonly regionSets: readonly (readonly number[])[];
  readonly cellCount: number;
  /** Per cell: the block that stands for it, or {@link NO_INDEX}. */
  readonly cellBlock: Uint32Array;
  /**
   * Per cell: which quarter of its block a point of the cell belongs to, as two 2-bit codes
   * ({@link QUARTER_CODE}): bits 0-1 for the half along the rows, bits 2-3 for the half along
   * the columns. 0 for a cell that is its block's own (the halves follow from where the point
   * lies in the cell); a cell that was merged into, or is stood for by, a block beside it names
   * the half of that block it adjoins.
   */
  readonly cellQuarter: Uint8Array;
  readonly blockCount: number;
  /** Per block: its own cell, its patch, its row (index into the row table) and its column. */
  readonly blockCell: Uint32Array;
  readonly blockPatch: Uint32Array;
  readonly blockRow: Uint32Array;
  readonly blockCol: Uint32Array;
  /** Per block: bits of {@link ATLAS_BLOCK_FLAG}. */
  readonly blockFlags: Uint8Array;
  /** Per block: centre (on the surface; on the axis for a line element), three numbers. */
  readonly centre: Float64Array;
  /** Per block: outward unit normal (for a line element a direction across the axis). */
  readonly normal: Float64Array;
  /**
   * Per block: area, m2. On a rounded polytope this is the flat area of the block's cells plus
   * the rounded edge and corner surface that is credited to it and is exposed.
   */
  readonly area: Float64Array;
  /**
   * Per block of a planar face, four numbers: the area of each quarter (`2 * rowHalf + colHalf`),
   * m2, counted exactly as a ray hit is mapped to a quarter; they sum to `area`. Zero for the
   * blocks of other patches, whose quarters follow in closed form.
   */
  readonly quarterArea: Float64Array;
  /**
   * Per block of a planar face, eight numbers: (u, v) in the face frame of the area centroid of
   * each quarter (where the quarter has area).
   */
  readonly quarterCentre: Float64Array;
  /** The links of the cell graph, each once with `a < b`. */
  readonly linkA: Uint32Array;
  readonly linkB: Uint32Array;
  /** Per link: length of the shared edge, metres. */
  readonly linkLength: Float64Array;
  /** Per link: one of {@link LINK_KIND}. */
  readonly linkKind: Uint8Array;
  readonly surfs: readonly AtlasSurf[];
  /**
   * Per part: area of all its surface, buried or not, m2 (the analytic area of the primitive):
   * its cells and the rounded edges and corners of a polytope.
   */
  readonly partArea: Float64Array;
  /** Parts whose geometry the atlas could not represent, with the reason. */
  readonly unsupported: readonly string[];
}

/** A patch while it is being built. */
export type AtlasPatchDraft = { -readonly [K in keyof AtlasPatch]: AtlasPatch[K] };

/** Numbers per link in `AtlasBuilder.linkProbe`: five points with normals. */
export const LINK_PROBE_WORDS = 30;

/**
 * Collects patches, rows, cells, cell links and surfs while the generators run. Cells are
 * numbered in the order they are added, row by row, so the cells of a row are consecutive.
 */
export class AtlasBuilder {
  readonly patches: AtlasPatchDraft[] = [];
  readonly rows: number[] = [];
  readonly rowRegion: number[] = [];
  readonly surfs: AtlasSurf[] = [];
  readonly unsupported: string[] = [];

  // Per cell.
  readonly cellPatch: number[] = [];
  readonly cellRow: number[] = [];
  readonly cellCol: number[] = [];
  readonly cx: number[] = [];
  readonly cy: number[] = [];
  readonly cz: number[] = [];
  readonly nx: number[] = [];
  readonly ny: number[] = [];
  readonly nz: number[] = [];
  readonly cellArea: number[] = [];
  /** 1 where the cell lies on an open edge of its patch. */
  readonly cellOpen: number[] = [];
  /** The cell a cut cell was merged into; itself otherwise. */
  readonly cellRep: number[] = [];

  /**
   * Pieces of rounded edge and corner surface of polytopes, which have no cells of their own:
   * per piece the face patch it is credited to, the point (u, v) of that face a ray hit on the
   * piece is mapped to, its area, and a point and outward normal on it (item frame) at which
   * `atlas.ts` decides whether it is exposed.
   */
  readonly roundPatch: number[] = [];
  readonly roundU: number[] = [];
  readonly roundV: number[] = [];
  readonly roundArea: number[] = [];
  readonly roundPoint: number[] = [];
  readonly roundNormal: number[] = [];

  /** Adds a piece of rounded surface (see `roundPatch`). */
  addRound(
    patch: number,
    u: number,
    v: number,
    area: number,
    point: readonly number[],
    normal: readonly number[],
  ): void {
    if (!(area > 0)) return;
    this.roundPatch.push(patch);
    this.roundU.push(u);
    this.roundV.push(v);
    this.roundArea.push(area);
    this.roundPoint.push(point[0] as number, point[1] as number, point[2] as number);
    this.roundNormal.push(normal[0] as number, normal[1] as number, normal[2] as number);
  }

  // Cell links (undirected, may repeat; finished by `atlas.ts`).
  readonly linkA: number[] = [];
  readonly linkB: number[] = [];
  readonly linkLength: number[] = [];
  readonly linkKind: number[] = [];
  /**
   * Per link, `LINK_PROBE_WORDS` numbers: five points of the surface the link crosses, each
   * with its outward normal, item frame (NaN where the link crosses none: neighbours inside a
   * patch). A link one of whose points is not surface of the whole shape (the edge, or the
   * margin of a face beside it, is buried in or covered by another part) is dropped.
   */
  readonly linkProbe: number[] = [];

  /** Starts a row of `columns` cells in the patch being built; returns its row index. */
  addRow(columns: number, region: number): number {
    this.rows.push(this.cellPatch.length, columns);
    this.rowRegion.push(region);
    return this.rowRegion.length - 1;
  }

  /** Adds one cell to the current row; returns its index. */
  addCell(
    patch: number,
    row: number,
    col: number,
    centre: readonly number[],
    normal: readonly number[],
    area: number,
    open: boolean,
  ): number {
    const index = this.cellPatch.length;
    this.cellPatch.push(patch);
    this.cellRow.push(row);
    this.cellCol.push(col);
    this.cx.push(centre[0] as number);
    this.cy.push(centre[1] as number);
    this.cz.push(centre[2] as number);
    this.nx.push(normal[0] as number);
    this.ny.push(normal[1] as number);
    this.nz.push(normal[2] as number);
    this.cellArea.push(area);
    this.cellOpen.push(open ? 1 : 0);
    this.cellRep.push(index);
    return index;
  }

  /** Links two cells along a shared edge of the given length. */
  link(a: number, b: number, length: number, kind: number): void {
    if (a === b || !(length > 0)) return;
    this.linkA.push(a);
    this.linkB.push(b);
    this.linkLength.push(length);
    this.linkKind.push(kind);
    for (let k = 0; k < LINK_PROBE_WORDS; k++) this.linkProbe.push(NaN);
  }

  /**
   * Links two cells across an edge of the part. `probes` holds five surface points with
   * their outward normals (item frame, 30 numbers): the margin of either face beside the edge
   * and three points round the edge. The link holds only where all are surface of the whole
   * shape.
   */
  linkAcross(a: number, b: number, length: number, kind: number, probes: readonly number[]): void {
    if (a === b || !(length > 0)) return;
    this.linkA.push(a);
    this.linkB.push(b);
    this.linkLength.push(length);
    this.linkKind.push(kind);
    for (let k = 0; k < LINK_PROBE_WORDS; k++) this.linkProbe.push(probes[k] as number);
  }

  /** Index of the first cell of a row and its number of columns. */
  rowCells(row: number): [first: number, columns: number] {
    return [this.rows[2 * row] as number, this.rows[2 * row + 1] as number];
  }
}
