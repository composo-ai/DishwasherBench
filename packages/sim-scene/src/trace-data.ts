/**
 * The data of the ray queries of a scene (docs/design/sim-core.md section 3.5 in the form
 * docs/design/scope.md fixes for the first build: a triangle hierarchy with every hit corrected
 * to the exact analytic surface), shared by the f64 reference tracer and the GPU kernel.
 *
 * - **Roots.** Everything that does not move shares one hierarchy in the tub frame (the first
 *   root, when there is anything static). Every rotating part (a spray arm) has a hierarchy of
 *   its own in its part frame and is posed at trace time by transforming the ray, so turning an
 *   arm rebuilds nothing.
 * - **Triangles** in hierarchy order: three f32 vertices in the frame of their root (the very
 *   same numbers for a vertex two triangles share, which the watertight test relies on), the
 *   analytic surface piece (surf) the triangle approximates, the patch a hit is mapped on, and a
 *   word that says whether its part is porous.
 * - **Surfs**: an implicit function per piece (plane, revolved line, revolved arc, capsule) in a
 *   local frame; a hit is moved along the ray to its zero, and its gradient is the normal.
 * - **Patches, rows, cells**: the grids that turn the corrected hit into a block and a soil
 *   cell in closed form (section 3.6).
 *
 * The same numbers exist twice: in f64 for the reference and packed into 32-bit words for the
 * kernel ({@link packTraceTables}); the record layouts are the `TRACE_*_LAYOUT` constants.
 *
 * Units: metres, radians. Frames: the root frame (tub frame for root 0) unless stated.
 */

import type { RecordLayout } from '@spotless/sim-gpu';
import type { Affine } from './affine.ts';

/** Words per record of the packed tables. */
export const SURF_WORDS = 16;
export const FRAME_WORDS = 12;
export const PATCH_WORDS = 8;
export const TRIANGLE_WORDS = 12;
export const RAY_WORDS = 8;
export const HIT_WORDS = 8;

/** Most roots a tracer handles: the static scene and up to seven rotating parts. */
export const MAX_TRACE_ROOTS = 8;

/**
 * The numerical controls of the tracer. They are tolerances of the arithmetic, not physical
 * constants: none is a quantity a wash depends on within the accuracy the tracer states.
 */
export const TRACE_NUMERICS = {
  /**
   * A triangle is struck only from outside and not edge-on: twice its area as the ray sees it
   * must exceed this, m2.
   */
  detMin: 1e-14,
  /** Newton steps of the correction on the GPU (the f64 reference iterates to convergence). */
  newtonSteps: 12,
  /**
   * A correction step is at most this many chord errors long, and the corrected hit lies within
   * as much of the hit on the triangle.
   */
  maxStepChords: 64,
  /** Below this cosine of incidence against a piece the correction stops (a grazing ray). */
  minSlope: 1e-3,
  /** A hit this far outside the range of its piece is tried on the neighbouring piece, metres. */
  rangeSlack: 1e-6,
  /** Most changes of piece per hit. */
  maxSwitches: 2,
  /**
   * A corrected hit is accepted when the implicit function of its piece is within this of zero
   * there, metres; otherwise the hit on the triangle is reported.
   */
  acceptResidual: 2e-6,
} as const;

/** One root of the ray structure. */
export interface TraceRoot {
  /** Index of the root node of its hierarchy. */
  readonly node: number;
  /** Instance index of the rotating part, or -1 for the static root. */
  readonly instance: number;
  /**
   * For a rotating part: its frame in the tub frame at angle 0 and the hinge it turns about
   * (a point and a unit axis in the part frame). Null for the static root.
   */
  readonly rotating: {
    readonly pose: Affine;
    readonly point: readonly [number, number, number];
    readonly axis: readonly [number, number, number];
  } | null;
}

/** Everything the tracers read. */
export interface TraceData {
  /** Chord error of the triangles, metres. */
  readonly chordError: number;
  readonly roots: readonly TraceRoot[];
  /** Hierarchy nodes of all roots, 32 bytes each (`BVH_NODE_LAYOUT`). */
  readonly nodes: ArrayBuffer;
  readonly nodeCount: number;
  readonly triangleCount: number;
  /** Nine f32 per triangle: its vertices, counter-clockwise seen from outside. */
  readonly triVerts: Float32Array;
  readonly triSurf: Uint32Array;
  readonly triPatch: Uint32Array;
  /** 0 for a solid part; else the open fraction in 1/256 in the top byte and a part key below. */
  readonly triPorous: Uint32Array;
  readonly surfCount: number;
  readonly surfKind: Uint32Array;
  /** Per surf: index of its frame. */
  readonly surfFrame: Uint32Array;
  readonly surfPrev: Uint32Array;
  readonly surfNext: Uint32Array;
  /** Six numbers per surf: the parameters of `AtlasSurf.params` (padded with 0) and the range slack. */
  readonly surfParams: Float64Array;
  /** Four numbers per surf: sBase, sScale, pMin, pMax. */
  readonly surfMap: Float64Array;
  readonly frameCount: number;
  /** Twelve numbers per frame: the rows of the 3 x 4 matrix that maps the root frame into it. */
  readonly frames: Float64Array;
  readonly patchCount: number;
  readonly patchKind: Uint32Array;
  readonly patchFrame: Uint32Array;
  /** Index of the first row of a patch in `rows`, and its number of rows. */
  readonly patchRowStart: Uint32Array;
  readonly patchRowCount: Uint32Array;
  /** Four numbers per patch: a0, da, b0, db (see `AtlasPatch`). */
  readonly patchCoord: Float64Array;
  /** Two numbers per row: index of its first cell, number of columns. */
  readonly rows: Uint32Array;
  /** Per cell: block index, or 0xffffffff. */
  readonly cellBlock: Uint32Array;
  /** Per cell: the quarter codes of `ShapeAtlas.cellQuarter` (4 bits). */
  readonly cellQuarter: Uint8Array;
  /** Per block: index of its first soil cell, or 0xffffffff. */
  readonly blockSoil: Uint32Array;
}

/** The packed tables of a {@link TraceData} and where each part starts, in words. */
export interface PackedTraceTables {
  readonly words: Uint32Array;
  readonly surfBase: number;
  readonly frameBase: number;
  readonly patchBase: number;
  readonly rowBase: number;
  readonly cellBase: number;
  readonly soilBase: number;
  /** The quarter codes of the cells, eight cells per word (4 bits each, cell 0 lowest). */
  readonly quarterBase: number;
}

/**
 * Packs surfs, frames, patches, rows, the cell table, the soil table and the quarter codes into
 * one word array.
 */
export function packTraceTables(data: TraceData): PackedTraceTables {
  const surfBase = 0;
  const frameBase = surfBase + SURF_WORDS * data.surfCount;
  const patchBase = frameBase + FRAME_WORDS * data.frameCount;
  const rowBase = patchBase + PATCH_WORDS * data.patchCount;
  const cellBase = rowBase + data.rows.length;
  const soilBase = cellBase + data.cellBlock.length;
  const quarterBase = soilBase + data.blockSoil.length;
  const total = Math.max(1, quarterBase + Math.ceil(data.cellQuarter.length / 8));
  const words = new Uint32Array(total);
  const floats = new Float32Array(words.buffer);
  for (let s = 0; s < data.surfCount; s++) {
    const o = surfBase + SURF_WORDS * s;
    words[o] = data.surfKind[s] as number;
    words[o + 1] = frameBase + FRAME_WORDS * (data.surfFrame[s] as number);
    words[o + 2] = data.surfPrev[s] as number;
    words[o + 3] = data.surfNext[s] as number;
    for (let k = 0; k < 6; k++) floats[o + 4 + k] = data.surfParams[6 * s + k] as number;
    for (let k = 0; k < 4; k++) floats[o + 10 + k] = data.surfMap[4 * s + k] as number;
  }
  for (let k = 0; k < FRAME_WORDS * data.frameCount; k++) {
    floats[frameBase + k] = data.frames[k] as number;
  }
  for (let p = 0; p < data.patchCount; p++) {
    const o = patchBase + PATCH_WORDS * p;
    words[o] = data.patchKind[p] as number;
    words[o + 1] = frameBase + FRAME_WORDS * (data.patchFrame[p] as number);
    words[o + 2] = data.patchRowStart[p] as number;
    words[o + 3] = data.patchRowCount[p] as number;
    for (let k = 0; k < 4; k++) floats[o + 4 + k] = data.patchCoord[4 * p + k] as number;
  }
  words.set(data.rows, rowBase);
  words.set(data.cellBlock, cellBase);
  words.set(data.blockSoil, soilBase);
  for (let c = 0; c < data.cellQuarter.length; c++) {
    const code = (data.cellQuarter[c] as number) & 15;
    if (code !== 0) {
      const w = quarterBase + (c >> 3);
      words[w] = ((words[w] as number) | (code << (4 * (c & 7)))) >>> 0;
    }
  }
  return { words, surfBase, frameBase, patchBase, rowBase, cellBase, soilBase, quarterBase };
}

/** Packs the triangles as the kernel reads them: v0, surf, v1, patch, v2, porous. */
export function packTraceTriangles(data: TraceData): Uint32Array {
  const words = new Uint32Array(Math.max(1, data.triangleCount) * TRIANGLE_WORDS);
  const floats = new Float32Array(words.buffer);
  const v = data.triVerts;
  for (let t = 0; t < data.triangleCount; t++) {
    const o = TRIANGLE_WORDS * t;
    const b = 9 * t;
    floats[o] = v[b] as number;
    floats[o + 1] = v[b + 1] as number;
    floats[o + 2] = v[b + 2] as number;
    words[o + 3] = data.triSurf[t] as number;
    floats[o + 4] = v[b + 3] as number;
    floats[o + 5] = v[b + 4] as number;
    floats[o + 6] = v[b + 5] as number;
    words[o + 7] = data.triPatch[t] as number;
    floats[o + 8] = v[b + 6] as number;
    floats[o + 9] = v[b + 7] as number;
    floats[o + 10] = v[b + 8] as number;
    words[o + 11] = data.triPorous[t] as number;
  }
  return words;
}

/** One ray or segment as the tracers take it: 32 bytes. */
export const TRACE_RAY_LAYOUT = {
  name: 'TraceRay',
  section: 'scene first build (3.5)',
  owner: 'M3',
  per: 'ray or segment',
  byteSize: 32,
  fields: [
    {
      name: 'origin',
      type: 'f32',
      role: 'static',
      unit: 'm',
      offset: 0,
      count: 3,
      doc: 'Origin, tub frame.',
    },
    {
      name: 'tMax',
      type: 'f32',
      role: 'static',
      unit: 'm',
      offset: 12,
      doc: 'Length of the segment; a ray is a long segment.',
    },
    {
      name: 'dir',
      type: 'f32',
      role: 'static',
      unit: '1',
      offset: 16,
      count: 3,
      doc: 'Unit direction, tub frame.',
    },
    {
      name: 'key',
      type: 'u32',
      role: 'static',
      unit: '-',
      offset: 28,
      doc: 'Lineage key of the ray: with the seed and the part it decides whether the ray passes a porous part.',
    },
  ],
} as const satisfies RecordLayout;

/** One hit as the tracers return it: 32 bytes. A miss has `triangle` 0xffffffff and `t = tMax`. */
export const TRACE_HIT_LAYOUT = {
  name: 'TraceHit',
  section: 'scene first build (3.5, 3.6)',
  owner: 'M3',
  per: 'ray or segment',
  byteSize: 32,
  fields: [
    {
      name: 't',
      type: 'f32',
      role: 'statistic',
      unit: 'm',
      offset: 0,
      doc: 'Distance of the hit along the ray: on the analytic surface, or on the triangle where the correction was not accepted; tMax on a miss.',
    },
    {
      name: 'block',
      type: 'u32',
      role: 'statistic',
      unit: '-',
      offset: 4,
      doc: 'Block struck, or 0xffffffff (a miss, or a surface without a live block).',
    },
    {
      name: 'soilCell',
      type: 'u32',
      role: 'statistic',
      unit: '-',
      offset: 8,
      doc: 'Soil cell struck, or 0xffffffff where the block carries no soil.',
    },
    {
      name: 'triangle',
      type: 'u32',
      role: 'statistic',
      unit: '-',
      offset: 12,
      doc: 'Triangle of the hierarchy that was struck, or 0xffffffff on a miss.',
    },
    {
      name: 'normal',
      type: 'f32',
      role: 'statistic',
      unit: '1',
      offset: 16,
      count: 3,
      doc: 'Outward unit normal at the hit, tub frame: of the analytic surface, or of the triangle where the correction was not accepted.',
    },
    {
      name: 'cosInc',
      type: 'f32',
      role: 'statistic',
      unit: '1',
      offset: 28,
      doc: 'Cosine of the angle between the ray and the inward normal; never negative.',
    },
  ],
} as const satisfies RecordLayout;

/** One triangle of the hierarchy as the kernel reads it: 48 bytes. */
export const TRACE_TRIANGLE_LAYOUT = {
  name: 'TraceTriangle',
  section: 'scene first build (3.5)',
  owner: 'M3',
  per: 'triangle',
  byteSize: 48,
  fields: [
    {
      name: 'v0',
      type: 'f32',
      role: 'static',
      unit: 'm',
      offset: 0,
      count: 3,
      doc: 'First vertex, root frame.',
    },
    {
      name: 'surf',
      type: 'u32',
      role: 'static',
      unit: '-',
      offset: 12,
      doc: 'Analytic surface piece.',
    },
    {
      name: 'v1',
      type: 'f32',
      role: 'static',
      unit: 'm',
      offset: 16,
      count: 3,
      doc: 'Second vertex.',
    },
    {
      name: 'patch',
      type: 'u32',
      role: 'static',
      unit: '-',
      offset: 28,
      doc: 'Patch a hit is mapped on.',
    },
    {
      name: 'v2',
      type: 'f32',
      role: 'static',
      unit: 'm',
      offset: 32,
      count: 3,
      doc: 'Third vertex.',
    },
    {
      name: 'porous',
      type: 'u32',
      role: 'static',
      unit: '-',
      offset: 44,
      bits: [
        { name: 'partKey', lsb: 0, width: 24, doc: 'Key of the part in the scene.' },
        { name: 'open', lsb: 24, width: 8, doc: 'Open fraction of the part in 1/256; 0 solid.' },
      ],
      doc: 'Porosity word: 0 for a solid part.',
    },
  ],
} as const satisfies RecordLayout;
