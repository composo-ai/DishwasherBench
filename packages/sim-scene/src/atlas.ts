/**
 * `buildShapeAtlas`: the surface of one shape as patches of blocks, in the item frame
 * (docs/design/sim-core.md sections 3.1 to 3.3 and 3.6, in the first-build form of the scene
 * brief). Everything here depends on the shape and the block size only, never on a pose, so the
 * atlas of an item type is built once and shared by every item of that type in a load.
 *
 * What it does, in order:
 * 1. every part becomes patches of cells, generated from its analytic primitive (never from a
 *    mesh): a shell of revolution a grid on its closed meridian, a thin capsule line elements,
 *    a thick capsule a grid round its axis, a rounded box or hull a grid per planar face, the
 *    flat ends of a partial shell a masked grid;
 * 2. cells that are not surface of the whole shape are dead: buried in another part (the
 *    geometry kernel's signed distance of the shape at the cell centre below minus
 *    `buriedDepth`, a few micrometres), covered by one (the point `deadDepth` off the surface is
 *    inside the shape: two parts lying face to face), or doubled (flush with the same-facing
 *    surface of an earlier part, which then carries that surface alone);
 * 3. the live cells are the blocks; a cut cell merged into a neighbour adds its area to it; a
 *    cell without a block maps to the nearest block of its patch, or, where a whole patch has
 *    none, to the nearest block of its part or of the shape;
 * 3a. the rounded edges and corners of a polytope, which have no cells, are tested piece by
 *    piece in the same way, and the exposed pieces add their area to the block and to the
 *    quarter of the block that a ray hit on them is mapped to; the quarters of every block of a
 *    planar face are counted by that same map, so that the area of a soil cell is the area of
 *    the surface whose hits name it;
 * 4. links: neighbours inside a patch with the length of the shared edge, seams across the
 *    rounded edges of a polytope, and stitches where parts meet (boundary blocks within
 *    `stitchReach` blocks of another part, and wires whose surfaces touch).
 *
 * Units: metres, m2. Frame: item frame.
 */

import type { Vec3 } from '@spotless/core';
import { quatToMat3, v3AnyPerpendicular, v3Cross } from '@spotless/core';
import {
  buildSection,
  prepareProfile,
  primitiveSignedDistance,
  primitiveSignedDistanceGradient,
  primitiveSupport,
  profileDistance,
  signedDistance,
  type Part,
  type Shape,
  type SorSection,
} from '@spotless/geometry';
import {
  affineFromPose,
  affineIntoFrame,
  affineInverseRigid,
  affineMul,
  affinePoint,
  affineScaleAfter,
  affineScaleBefore,
  affineVector,
  type Affine,
} from './affine.ts';
import {
  ATLAS_BLOCK_FLAG,
  AtlasBuilder,
  LINK_KIND,
  LINK_PROBE_WORDS,
  NO_INDEX,
  PATCH_KIND,
  QUARTER_CODE,
  quarterHalf,
  SURF_KIND,
  type AtlasPatch,
  type ShapeAtlas,
} from './atlas-core.ts';
import {
  addCartPatch,
  addPolytopePart,
  cellNear,
  clipRectToPolygon,
  type FaceGrid,
  type PolytopePlacement,
} from './atlas-poly.ts';
import { addLinePatch, addRevPatch, type PatchPlacement } from './atlas-rev.ts';
import { locateOnPart } from './locate.ts';
import {
  capsuleRun,
  createMeridianPoint,
  meridianAt,
  runsOfSection,
  sectionArea,
  type MeridianRun,
} from './meridian.ts';
import { NearestPoints } from './nearest.ts';
import { boxCorners, convexCore, type CorePolytope } from './polytope.ts';
import { regionSetResolver, sideOfNormalZ } from './region-rules.ts';

const TWO_PI = 2 * Math.PI;

/** Two surfaces closer than this are the same surface, metres. */
const COINCIDENT = 2e-6;

/**
 * Stitches between parts (numerical rules, cosines): two blocks whose normals oppose by more
 * than the first are the two sides of a sheet; a block lies behind the face of another when
 * the direction to it makes less than minus the first with that face's normal, and in front
 * when more than the second.
 */
const STITCH_OPPOSED = 0.5;
const STITCH_LEVEL = 0.02;
/** Two blocks neither of which lies further than this (a cosine) behind the other's face are on one plane or at an inner corner. */
const STITCH_ROUND = 0.3;
/** Points tested on each leg of the way round an outer edge, and candidates tried. */
const STITCH_PROBES = 4;
const STITCH_TRIES = 4;

/**
 * Default of {@link AtlasOptions.buriedDepth}, metres (the default of the registered parameter
 * `scene.buriedDepth`, for callers that build an atlas without the registry).
 */
export const DEFAULT_BURIED_DEPTH = 5e-6;

/** Sub-samples per side of a quarter of a cell on a masked face. */
const QUARTER_MASK_SAMPLES = 6;

/** The numbers an atlas is built with. Lengths in metres. */
export interface AtlasOptions {
  /** Nominal block size. */
  readonly blockSize: number;
  /** Length of a line element. */
  readonly lineLength: number;
  /** Capsules up to this radius are line elements. */
  readonly lineMaxRadius: number;
  /** Area fraction below which a cut cell joins its largest neighbour. */
  readonly cutMerge: number;
  /**
   * The space this far off a cell, along its normal, must be free: a cell whose probe point lies
   * inside the shape is covered by another part lying on it, and dead.
   */
  readonly deadDepth: number;
  /**
   * A cell (or a piece of rounded edge) whose centre lies deeper than this inside another part
   * is buried, and dead. Default {@link DEFAULT_BURIED_DEPTH}.
   */
  readonly buriedDepth?: number;
  /** Reach of a stitch between parts, in blocks. */
  readonly stitchReach: number;
  /** Two wires are joined where their surfaces come within this distance. */
  readonly wireTouchGap: number;
}

/** How one part was laid out, for the classification of its triangles. */
export type PartGeometry =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'sor';
      /** Item frame to the unscaled part frame, and back (with the stretch). */
      readonly frame: Affine;
      readonly toItem: Affine;
      readonly runs: readonly { readonly place: PatchPlacement; readonly run: MeridianRun }[];
      readonly arc: {
        readonly phi0: number;
        readonly phi1: number;
        readonly endPatch: readonly [number, number];
        readonly endSurf: readonly [number, number];
      } | null;
    }
  | { readonly kind: 'line'; readonly place: PatchPlacement }
  | {
      readonly kind: 'capsule';
      /** Item frame to the axis frame. */
      readonly frame: Affine;
      readonly place: PatchPlacement;
      readonly length: number;
    }
  | {
      readonly kind: 'poly';
      readonly itemToPart: Affine;
      readonly core: CorePolytope;
      readonly radius: number;
      readonly place: PolytopePlacement;
    };

/** An atlas with the layout of its parts, as the triangle classifier needs it. */
export interface ShapeAtlasBuilt extends ShapeAtlas {
  readonly partGeometry: readonly PartGeometry[];
  /** Per block: index of its part. */
  readonly blockPart: Uint32Array;
}

function columnFrame(ex: Vec3, ey: Vec3, ez: Vec3, origin: Vec3): Affine {
  return {
    m: [ex[0], ey[0], ez[0], ex[1], ey[1], ez[1], ex[2], ey[2], ez[2]],
    c: [origin[0], origin[1], origin[2]],
  };
}

/** Closest approach of two segments: the distance and the parameters (0 to 1) on each. */
function segmentSegment(
  p1: readonly number[],
  q1: readonly number[],
  p2: readonly number[],
  q2: readonly number[],
): [distance: number, s: number, t: number] {
  const d1 = [0, 1, 2].map((i) => (q1[i] as number) - (p1[i] as number));
  const d2 = [0, 1, 2].map((i) => (q2[i] as number) - (p2[i] as number));
  const r = [0, 1, 2].map((i) => (p1[i] as number) - (p2[i] as number));
  const dot = (a: readonly number[], b: readonly number[]): number =>
    (a[0] as number) * (b[0] as number) +
    (a[1] as number) * (b[1] as number) +
    (a[2] as number) * (b[2] as number);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s = 0;
  let t = 0;
  const tiny = 1e-18;
  if (a <= tiny && e <= tiny) {
    s = 0;
    t = 0;
  } else if (a <= tiny) {
    t = Math.min(1, Math.max(0, f / e));
  } else {
    const c = dot(d1, r);
    if (e <= tiny) {
      s = Math.min(1, Math.max(0, -c / a));
    } else {
      const bb = dot(d1, d2);
      const denom = a * e - bb * bb;
      s = denom > tiny * a * e ? Math.min(1, Math.max(0, (bb * f - c * e) / denom)) : 0;
      t = (bb * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(1, Math.max(0, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.min(1, Math.max(0, (bb - c) / a));
      }
    }
  }
  const dx = (p1[0] as number) + s * (d1[0] as number) - (p2[0] as number) - t * (d2[0] as number);
  const dy = (p1[1] as number) + s * (d1[1] as number) - (p2[1] as number) - t * (d2[1] as number);
  const dz = (p1[2] as number) + s * (d1[2] as number) - (p2[2] as number) - t * (d2[2] as number);
  return [Math.hypot(dx, dy, dz), s, t];
}

/** Builds the atlas of a shape. Pure: the same shape and options give the same atlas. */
export function buildShapeAtlas(shape: Shape, options: AtlasOptions): ShapeAtlasBuilt {
  const b = new AtlasBuilder();
  const regionSets = regionSetResolver(shape);
  // While the atlas is built a row carries the index of its set of regions.
  const regionOf = regionSets.resolve;
  const buriedDepth = options.buriedDepth ?? DEFAULT_BURIED_DEPTH;
  const partGeometry: PartGeometry[] = [];
  const D = options.blockSize;

  const addCapsule = (pi: number, part: Part, a: Vec3, bb: Vec3, radius: number): void => {
    const partToItem = affineFromPose(part.pose);
    const itemToPart = affineInverseRigid(partToItem);
    const length = Math.hypot(bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]);
    const ez: Vec3 =
      length > 1e-12
        ? [(bb[0] - a[0]) / length, (bb[1] - a[1]) / length, (bb[2] - a[2]) / length]
        : [0, 0, 1];
    const ex = v3AnyPerpendicular(ez);
    const ey = v3Cross(ez, ex);
    const frame = affineMul(affineIntoFrame(a, ex, ey, ez), itemToPart);
    const toItem = affineMul(partToItem, columnFrame(ex, ey, ez, a));
    const region = regionOf(pi, 'none', undefined);
    const porosity = part.porosity ?? 0;
    if (radius <= options.lineMaxRadius) {
      const place = addLinePatch(b, {
        part: pi,
        frame,
        toItem,
        radius,
        length,
        elementLength: options.lineLength,
        region,
        porosity,
      });
      partGeometry.push({ kind: 'line', place });
    } else {
      const place = addRevPatch(b, {
        part: pi,
        frame,
        toItem,
        run: capsuleRun(radius, length),
        theta0: 0,
        span: TWO_PI,
        full: true,
        scale: [1, 1],
        blockSize: D,
        region: () => region,
        porosity,
        radius,
      });
      partGeometry.push({ kind: 'capsule', frame, place, length });
    }
  };

  const addPolytope = (pi: number, part: Part, points: readonly Vec3[], radius: number): void => {
    const core = convexCore(points);
    if (core.dim === 0) {
      addCapsule(pi, part, core.centre, core.centre, radius);
    } else if (core.dim === 1) {
      addCapsule(pi, part, core.a, core.b, radius);
    } else {
      const partToItem = affineFromPose(part.pose);
      const place = addPolytopePart(
        b,
        pi,
        partToItem,
        core,
        radius,
        D,
        options.cutMerge,
        part.porosity ?? 0,
        (nz) => regionOf(pi, sideOfNormalZ(nz), undefined),
      );
      partGeometry.push({
        kind: 'poly',
        itemToPart: affineInverseRigid(partToItem),
        core,
        radius,
        place,
      });
    }
  };

  shape.parts.forEach((part, pi) => {
    const prim = part.prim;
    if (prim.kind === 'capsule') {
      addCapsule(pi, part, prim.a, prim.b, prim.radius);
      return;
    }
    if (prim.kind === 'rbox') {
      addPolytope(pi, part, boxCorners(prim.halfExtents), prim.radius);
      return;
    }
    if (prim.kind === 'hull') {
      addPolytope(pi, part, prim.points, prim.radius);
      return;
    }
    // Shell of revolution.
    const profile = prepareProfile(prim.profile);
    let section: SorSection;
    try {
      section = buildSection(profile);
    } catch (error) {
      b.unsupported.push(`part '${part.id}': ${(error as Error).message}`);
      partGeometry.push({ kind: 'none' });
      return;
    }
    const sx = prim.scaleXY?.[0] ?? 1;
    const sy = prim.scaleXY?.[1] ?? 1;
    const arc =
      prim.arc !== undefined && prim.arc[1] - prim.arc[0] < TWO_PI - 1e-12 ? prim.arc : null;
    const partToItem = affineFromPose(part.pose);
    const itemToPart = affineInverseRigid(partToItem);
    const frame = affineScaleAfter(itemToPart, [1 / sx, 1 / sy, 1]);
    const toItem = affineScaleBefore(partToItem, [sx, sy, 1]);
    const porosity = part.porosity ?? 0;
    const runs = runsOfSection(section).map((run) => ({
      run,
      place: addRevPatch(b, {
        part: pi,
        frame,
        toItem,
        run,
        theta0: arc === null ? 0 : arc[0],
        span: arc === null ? TWO_PI : arc[1] - arc[0],
        full: arc === null,
        scale: [sx, sy],
        blockSize: D,
        region: (side, mid) => regionOf(pi, side === 1 ? 'in' : 'out', mid),
        porosity,
        radius: 0,
      }),
    }));
    let arcInfo: Extract<PartGeometry, { kind: 'sor' }>['arc'] = null;
    if (arc !== null) {
      const endPatch: number[] = [];
      const endSurf: number[] = [];
      const endGrids: FaceGrid[] = [];
      const area = sectionArea(section);
      [arc[0], arc[1]].forEach((phi, end) => {
        const c = Math.cos(phi);
        const s = Math.sin(phi);
        const k = Math.hypot(sx * c, sy * s);
        const sign = end === 0 ? 1 : -1;
        const u: Vec3 = [(sign * sx * c) / k, (sign * sy * s) / k, 0];
        const v: Vec3 = [0, 0, 1];
        const n = v3Cross(u, v);
        const faceFrame = affineMul(affineIntoFrame([0, 0, 0], u, v, n), itemToPart);
        const grid = addCartPatch(b, {
          part: pi,
          frame: faceFrame,
          toItem: affineMul(partToItem, columnFrame(u, v, n, [0, 0, 0])),
          polygon: null,
          mask: (uu, vv) => profileDistance(profile, Math.abs(uu) / k, vv, 0) <= 0,
          bounds:
            end === 0
              ? [0, section.zMin, k * section.rMax, section.zMax]
              : [-k * section.rMax, section.zMin, 0, section.zMax],
          blockSize: D,
          region: regionOf(pi, 'none', undefined),
          cutMerge: 0,
          porosity,
          exactArea: k * area,
        });
        endPatch.push(grid.patch);
        endGrids.push(grid);
        endSurf.push(b.surfs.length);
        b.surfs.push({
          kind: SURF_KIND.plane,
          frame: faceFrame,
          params: [],
          sBase: 0,
          sScale: 0,
          pMin: 0,
          pMax: 0,
          prev: NO_INDEX,
          next: NO_INDEX,
          patch: grid.patch,
          part: pi,
        });
      });
      // The revolved surface meets each end face along its outline: the end cells of every row
      // are linked to the face cell beside them.
      const pt = createMeridianPoint();
      for (const { run, place } of runs) {
        const patch = b.patches[place.patch] as AtlasPatch;
        for (let i = 0; i < patch.rowCount; i++) {
          meridianAt(run, (i + 0.5) * patch.da, pt);
          const [first, cols] = b.rowCells(patch.rowStart + i);
          endGrids.forEach((grid, end) => {
            const phi = arc[end] as number;
            const k = Math.hypot(sx * Math.cos(phi), sy * Math.sin(phi));
            const cell = cellNear(b, grid, (end === 0 ? 1 : -1) * k * pt.r, pt.z);
            if (cell >= 0)
              b.link(end === 0 ? first : first + cols - 1, cell, patch.da, LINK_KIND.seam);
          });
        }
      }
      arcInfo = {
        phi0: arc[0],
        phi1: arc[1],
        endPatch: [endPatch[0] as number, endPatch[1] as number],
        endSurf: [endSurf[0] as number, endSurf[1] as number],
      };
    }
    partGeometry.push({ kind: 'sor', frame, toItem, runs, arc: arcInfo });
  });

  // ---- which cells are buried in another part
  const cellCount = b.cellPatch.length;
  const patches = b.patches as readonly AtlasPatch[];
  const buried = new Uint8Array(cellCount);
  /** Per doubled cell: the earlier part that carries its surface. */
  const doubledBy = new Map<number, number>();
  const partArea = new Float64Array(shape.parts.length);
  for (let i = 0; i < cellCount; i++) {
    const patch = patches[b.cellPatch[i] as number] as AtlasPatch;
    partArea[patch.part] = (partArea[patch.part] as number) + (b.cellArea[i] as number);
  }
  const partBox = shape.parts.map((part) => {
    const m = quatToMat3(part.pose.q);
    const min = [0, 0, 0];
    const max = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const d: Vec3 = [m[3 * i] as number, m[3 * i + 1] as number, m[3 * i + 2] as number];
      max[i] = (part.pose.p[i] as number) + primitiveSupport(part.prim, d);
      min[i] = (part.pose.p[i] as number) - primitiveSupport(part.prim, [-d[0], -d[1], -d[2]]);
    }
    return { min, max };
  });
  const partFrames = shape.parts.map((part) => {
    const toItem = affineFromPose(part.pose);
    return { toItem, toPart: affineInverseRigid(toItem) };
  });
  for (let k = 0; k < b.roundArea.length; k++) {
    const part = (patches[b.roundPatch[k] as number] as AtlasPatch).part;
    partArea[part] = (partArea[part] as number) + (b.roundArea[k] as number);
  }
  /**
   * Whether a piece of the surface of part `part` at (cx, cy, cz) with outward normal n is not
   * surface of the whole shape: -1 exposed, -2 buried or covered, else the index of the earlier
   * part that carries the same surface (doubled). `own` is the radius of a line element (whose
   * centre is on its axis), 0 otherwise.
   */
  const deadAt = (
    part: number,
    line: boolean,
    own: number,
    cx: number,
    cy: number,
    cz: number,
    nx: number,
    ny: number,
    nz: number,
  ): number => {
    // Clear of the boxes of all other parts: nothing can bury or cover it (a part does not
    // cover its own surface).
    const reach = own + options.deadDepth + COINCIDENT;
    let near = false;
    for (let other = 0; other < partBox.length && !near; other++) {
      if (other === part) continue;
      const box = partBox[other] as { min: number[]; max: number[] };
      near =
        cx >= (box.min[0] as number) - reach &&
        cx <= (box.max[0] as number) + reach &&
        cy >= (box.min[1] as number) - reach &&
        cy <= (box.max[1] as number) + reach &&
        cz >= (box.min[2] as number) - reach &&
        cz <= (box.max[2] as number) + reach;
    }
    if (!near) return -1;
    // Buried: inside another part.
    if (signedDistance(shape, [cx, cy, cz]) < -(own + buriedDepth)) return -2;
    if (line) return -1;
    // Covered: the space just off the surface is solid (two parts lying face to face).
    const ox = cx + options.deadDepth * nx;
    const oy = cy + options.deadDepth * ny;
    const oz = cz + options.deadDepth * nz;
    if (signedDistance(shape, [ox, oy, oz]) < -COINCIDENT) return -2;
    // Doubled: flush with the same-facing surface of an earlier part, which carries it.
    for (let other = 0; other < part; other++) {
      const box = partBox[other] as { min: number[]; max: number[] };
      if (
        cx < (box.min[0] as number) - COINCIDENT ||
        cx > (box.max[0] as number) + COINCIDENT ||
        cy < (box.min[1] as number) - COINCIDENT ||
        cy > (box.max[1] as number) + COINCIDENT ||
        cz < (box.min[2] as number) - COINCIDENT ||
        cz > (box.max[2] as number) + COINCIDENT
      ) {
        continue;
      }
      const frames = partFrames[other] as { toItem: Affine; toPart: Affine };
      const prim = (shape.parts[other] as Part).prim;
      if (
        Math.abs(primitiveSignedDistance(prim, affinePoint(frames.toPart, cx, cy, cz))) > COINCIDENT
      ) {
        continue;
      }
      const g = primitiveSignedDistanceGradient(prim, affinePoint(frames.toPart, ox, oy, oz));
      const gi = affineVector(frames.toItem, g[0], g[1], g[2]);
      if (gi[0] * nx + gi[1] * ny + gi[2] * nz > 0.99) return other;
    }
    return -1;
  };
  if (shape.parts.length > 1) {
    for (let i = 0; i < cellCount; i++) {
      if (!((b.cellArea[i] as number) > 0)) continue;
      const patch = patches[b.cellPatch[i] as number] as AtlasPatch;
      const dead = deadAt(
        patch.part,
        patch.line,
        patch.line ? patch.radius : 0,
        b.cx[i] as number,
        b.cy[i] as number,
        b.cz[i] as number,
        b.nx[i] as number,
        b.ny[i] as number,
        b.nz[i] as number,
      );
      if (dead === -1) continue;
      buried[i] = 1;
      if (dead >= 0) doubledBy.set(i, dead);
    }
  }

  // ---- blocks: live cells that stand for themselves
  const ownBlock = new Uint32Array(cellCount).fill(NO_INDEX);
  let blockCount = 0;
  for (let i = 0; i < cellCount; i++) {
    if (b.cellRep[i] === i && (b.cellArea[i] as number) > 0 && buried[i] === 0) {
      ownBlock[i] = blockCount++;
    }
  }
  // A merged cell belongs to the block of the cell it joined (if that one is alive).
  for (let i = 0; i < cellCount; i++) {
    const rep = b.cellRep[i] as number;
    if (rep !== i && (b.cellArea[i] as number) > 0) ownBlock[i] = ownBlock[rep] as number;
  }
  const blockCell = new Uint32Array(blockCount);
  const blockPatch = new Uint32Array(blockCount);
  const blockPart = new Uint32Array(blockCount);
  const blockRow = new Uint32Array(blockCount);
  const blockCol = new Uint32Array(blockCount);
  const blockFlags = new Uint8Array(blockCount);
  const centre = new Float64Array(3 * blockCount);
  const normal = new Float64Array(3 * blockCount);
  const area = new Float64Array(blockCount);
  for (let i = 0; i < cellCount; i++) {
    const block = ownBlock[i] as number;
    if (block === NO_INDEX) continue;
    area[block] = (area[block] as number) + (b.cellArea[i] as number);
    if (b.cellRep[i] !== i) continue;
    const patch = patches[b.cellPatch[i] as number] as AtlasPatch;
    blockCell[block] = i;
    blockPatch[block] = b.cellPatch[i] as number;
    blockPart[block] = patch.part;
    blockRow[block] = b.cellRow[i] as number;
    blockCol[block] = b.cellCol[i] as number;
    blockFlags[block] =
      (patch.line ? ATLAS_BLOCK_FLAG.line : 0) |
      (b.cellOpen[i] === 1 ? ATLAS_BLOCK_FLAG.boundary : 0);
    centre[3 * block] = b.cx[i] as number;
    centre[3 * block + 1] = b.cy[i] as number;
    centre[3 * block + 2] = b.cz[i] as number;
    normal[3 * block] = b.nx[i] as number;
    normal[3 * block + 1] = b.ny[i] as number;
    normal[3 * block + 2] = b.nz[i] as number;
  }

  // ---- a doubled cell maps to the block of the part that carries its surface
  const cellBlock = Uint32Array.from(ownBlock);
  const rows = Uint32Array.from(b.rows);
  if (doubledBy.size > 0) {
    const partial = {
      shape,
      patches,
      rows,
      cellBlock: ownBlock,
      partGeometry,
    } as unknown as ShapeAtlasBuilt;
    for (let i = 0; i < cellCount; i++) {
      const other = doubledBy.get(i);
      if (other === undefined) continue;
      const where = locateOnPart(
        partial,
        other,
        [b.cx[i] as number, b.cy[i] as number, b.cz[i] as number],
        [b.nx[i] as number, b.ny[i] as number, b.nz[i] as number],
      );
      if (where !== null) cellBlock[i] = where.block;
    }
  }

  // ---- every other cell maps to the nearest block of its patch (breadth first over the grid)
  for (const patch of patches) {
    const queue: number[] = [];
    for (let i = patch.cellStart; i < patch.cellStart + patch.cellCount; i++) {
      if (cellBlock[i] !== NO_INDEX) queue.push(i);
    }
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head] as number;
      const row = b.cellRow[cell] as number;
      const col = b.cellCol[cell] as number;
      const cols = rows[2 * row + 1] as number;
      const visit = (other: number): void => {
        if (cellBlock[other] === NO_INDEX) {
          cellBlock[other] = cellBlock[cell] as number;
          queue.push(other);
        }
      };
      const first = rows[2 * row] as number;
      if (col + 1 < cols) visit(first + col + 1);
      else if (patch.periodicCols && cols > 1) visit(first);
      if (col > 0) visit(first + col - 1);
      else if (patch.periodicCols && cols > 1) visit(first + cols - 1);
      for (const step of [-1, 1]) {
        let other = row - patch.rowStart + step;
        if (other < 0 || other >= patch.rowCount) {
          if (!patch.periodicRows || patch.rowCount < 2) continue;
          other = (other + patch.rowCount) % patch.rowCount;
        }
        const otherRow = patch.rowStart + other;
        const otherCols = rows[2 * otherRow + 1] as number;
        const otherCol = Math.min(otherCols - 1, Math.floor(((col + 0.5) * otherCols) / cols));
        visit((rows[2 * otherRow] as number) + otherCol);
      }
    }
  }

  // ---- a patch without any block (every cell centre dead, though part of it may be exposed):
  // its cells go to the nearest block of the same part or, failing that, of the shape, so that a
  // ray that strikes it still names a block.
  if (blockCount > 0) {
    let finder: NearestPoints | null = null;
    for (let i = 0; i < cellCount; i++) {
      if (cellBlock[i] !== NO_INDEX) continue;
      finder ??= new NearestPoints(
        centre,
        Uint32Array.from({ length: blockCount }, (_, k) => k),
        4 * Math.max(D, options.lineLength),
      );
      const part = (patches[b.cellPatch[i] as number] as AtlasPatch).part;
      const x = b.cx[i] as number;
      const y = b.cy[i] as number;
      const z = b.cz[i] as number;
      let found = finder.nearest(x, y, z, (k) => blockPart[k] === part);
      if (found < 0) found = finder.nearest(x, y, z);
      if (found >= 0) cellBlock[i] = found;
    }
  }

  // ---- which quarter of its block a cell that is not the block's own belongs to
  const cellQuarter = new Uint8Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    const block = cellBlock[i] as number;
    if (block === NO_INDEX || blockCell[block] === i) continue;
    const p = b.cellPatch[i] as number;
    if (blockPatch[block] !== p || (patches[p] as AtlasPatch).kind !== PATCH_KIND.cart) continue;
    const dr = (b.cellRow[i] as number) - (blockRow[block] as number);
    const dc = (b.cellCol[i] as number) - (blockCol[block] as number);
    const code = (d: number): number =>
      d < 0 ? QUARTER_CODE.low : d > 0 ? QUARTER_CODE.high : QUARTER_CODE.byFraction;
    cellQuarter[i] = code(dr) | (code(dc) << 2);
  }

  // ---- quarters of the blocks of planar faces, counted as a ray hit is mapped to them
  const quarterArea = new Float64Array(4 * blockCount);
  const quarterCentre = new Float64Array(8 * blockCount);
  /** The block and quarter a point (u, v) of a planar patch is mapped to; -1 without a block. */
  const quarterAt = (p: number, u: number, v: number): number => {
    const patch = patches[p] as AtlasPatch;
    const ra = (v - patch.a0) / patch.da;
    const row = Math.min(patch.rowCount - 1, Math.max(0, Math.floor(ra)));
    const first = rows[2 * (patch.rowStart + row)] as number;
    const cols = rows[2 * (patch.rowStart + row) + 1] as number;
    const cb = (u - patch.b0) / patch.db;
    const col = Math.min(cols - 1, Math.max(0, Math.floor(cb)));
    const cell = first + col;
    const block = cellBlock[cell] as number;
    if (block === NO_INDEX) return -1;
    const code = cellQuarter[cell] as number;
    const ha = quarterHalf(code & 3, Math.min(1, Math.max(0, ra - row)));
    const hb = quarterHalf((code >> 2) & 3, Math.min(1, Math.max(0, cb - col)));
    return 4 * block + 2 * ha + hb;
  };
  const credit = (slot: number, a: number, u: number, v: number): void => {
    quarterArea[slot] = (quarterArea[slot] as number) + a;
    quarterCentre[2 * slot] = (quarterCentre[2 * slot] as number) + a * u;
    quarterCentre[2 * slot + 1] = (quarterCentre[2 * slot + 1] as number) + a * v;
  };
  {
    const qa = [0, 0, 0, 0];
    const qu = [0, 0, 0, 0];
    const qv = [0, 0, 0, 0];
    for (let i = 0; i < cellCount; i++) {
      const block = ownBlock[i] as number;
      if (block === NO_INDEX) continue;
      const p = b.cellPatch[i] as number;
      const patch = patches[p] as AtlasPatch;
      if (patch.kind !== PATCH_KIND.cart) continue;
      const ua = patch.b0 + (b.cellCol[i] as number) * patch.db;
      const va = patch.a0 + ((b.cellRow[i] as number) - patch.rowStart) * patch.da;
      let total = 0;
      // A cell that lies wholly on a polygonal face needs no clipping.
      const whole =
        patch.polygon !== null && (b.cellArea[i] as number) >= 0.999999 * patch.db * patch.da;
      for (let q = 0; q < 4; q++) {
        const u0 = ua + 0.5 * (q & 1) * patch.db;
        const v0 = va + 0.5 * (q >> 1) * patch.da;
        qa[q] = 0;
        qu[q] = u0 + 0.25 * patch.db;
        qv[q] = v0 + 0.25 * patch.da;
        if (whole) {
          qa[q] = 0.25 * patch.db * patch.da;
        } else if (patch.polygon !== null) {
          const [a, x, y] = clipRectToPolygon(
            patch.polygon,
            u0,
            v0,
            u0 + 0.5 * patch.db,
            v0 + 0.5 * patch.da,
          );
          if (a > 0) {
            qa[q] = a;
            qu[q] = x;
            qv[q] = y;
          }
        } else if (patch.mask !== null) {
          let hits = 0;
          let su = 0;
          let sv = 0;
          const n = QUARTER_MASK_SAMPLES;
          for (let k = 0; k < n * n; k++) {
            const u = u0 + ((Math.floor(k / n) + 0.5) / n) * 0.5 * patch.db;
            const v = v0 + (((k % n) + 0.5) / n) * 0.5 * patch.da;
            if (!patch.mask(u, v)) continue;
            hits++;
            su += u;
            sv += v;
          }
          // The outline of a masked face is not known in closed form: a quarter the samples miss
          // may still hold a sliver that a ray can strike, so it is never left without area.
          qa[q] = Math.max(hits, 0.25);
          if (hits > 0) {
            qu[q] = su / hits;
            qv[q] = sv / hits;
          }
        }
        total += qa[q] as number;
      }
      const scale = total > 0 ? (b.cellArea[i] as number) / total : 0;
      // A point of the cell is mapped to the cell's block: to the quarter it lies in when the
      // cell is the block's own, else to the quarter the cell adjoins.
      const code = cellQuarter[i] as number;
      for (let q = 0; q < 4; q++) {
        if (!((qa[q] as number) > 0)) continue;
        const ha = quarterHalf(code & 3, q >> 1 === 1 ? 0.75 : 0.25);
        const hb = quarterHalf((code >> 2) & 3, (q & 1) === 1 ? 0.75 : 0.25);
        credit(
          4 * block + 2 * ha + hb,
          scale * (qa[q] as number),
          qu[q] as number,
          qv[q] as number,
        );
      }
    }
  }

  // ---- rounded edges and corners of polytopes: the exposed pieces go to the block and quarter
  // their hits are mapped to
  for (let k = 0; k < b.roundArea.length; k++) {
    const p = b.roundPatch[k] as number;
    const slot = quarterAt(p, b.roundU[k] as number, b.roundV[k] as number);
    if (slot < 0) continue;
    if (
      shape.parts.length > 1 &&
      deadAt(
        (patches[p] as AtlasPatch).part,
        false,
        0,
        b.roundPoint[3 * k] as number,
        b.roundPoint[3 * k + 1] as number,
        b.roundPoint[3 * k + 2] as number,
        b.roundNormal[3 * k] as number,
        b.roundNormal[3 * k + 1] as number,
        b.roundNormal[3 * k + 2] as number,
      ) !== -1
    ) {
      continue;
    }
    const block = slot >> 2;
    area[block] = (area[block] as number) + (b.roundArea[k] as number);
    credit(slot, b.roundArea[k] as number, b.roundU[k] as number, b.roundV[k] as number);
  }
  for (let slot = 0; slot < 4 * blockCount; slot++) {
    const a = quarterArea[slot] as number;
    if (!(a > 0)) continue;
    quarterCentre[2 * slot] = (quarterCentre[2 * slot] as number) / a;
    quarterCentre[2 * slot + 1] = (quarterCentre[2 * slot + 1] as number) / a;
  }

  // ---- links between blocks
  const links = new Map<number, { length: number; kind: number }>();
  const addLink = (a: number, c: number, length: number, kind: number): void => {
    if (a === c) return;
    const lo = Math.min(a, c);
    const hi = Math.max(a, c);
    const key = lo * blockCount + hi;
    const existing = links.get(key);
    if (existing === undefined) links.set(key, { length, kind });
    else if (kind === LINK_KIND.stitch && existing.kind === LINK_KIND.stitch) {
      existing.length = Math.max(existing.length, length);
    } else if (kind !== LINK_KIND.stitch) {
      if (existing.kind === LINK_KIND.stitch) {
        existing.length = length;
        existing.kind = kind;
      } else {
        existing.length += length;
        existing.kind = Math.min(existing.kind, kind);
      }
    }
  };
  for (let k = 0; k < b.linkA.length; k++) {
    const ca = b.linkA[k] as number;
    const cb = b.linkB[k] as number;
    const ba = ownBlock[ca] as number;
    const bc = ownBlock[cb] as number;
    let severed = false;
    if (ba !== NO_INDEX && bc !== NO_INDEX) {
      const part = (patches[b.cellPatch[ca] as number] as AtlasPatch).part;
      for (let q = 0; q < LINK_PROBE_WORDS && !severed; q += 6) {
        const o = LINK_PROBE_WORDS * k + q;
        const px = b.linkProbe[o] as number;
        if (px !== px) break;
        severed =
          deadAt(
            part,
            false,
            0,
            px,
            b.linkProbe[o + 1] as number,
            b.linkProbe[o + 2] as number,
            b.linkProbe[o + 3] as number,
            b.linkProbe[o + 4] as number,
            b.linkProbe[o + 5] as number,
          ) !== -1;
      }
    }
    if (severed) {
      // The edge between the two cells is not surface of the shape: no seam; both blocks are
      // on the boundary of their part and may be stitched to the part that covers the edge.
      blockFlags[ba] = (blockFlags[ba] as number) | ATLAS_BLOCK_FLAG.boundary;
      blockFlags[bc] = (blockFlags[bc] as number) | ATLAS_BLOCK_FLAG.boundary;
    } else if (ba !== NO_INDEX && bc !== NO_INDEX) {
      addLink(ba, bc, b.linkLength[k] as number, b.linkKind[k] as number);
    } else if (ba !== NO_INDEX) {
      blockFlags[ba] = (blockFlags[ba] as number) | ATLAS_BLOCK_FLAG.boundary;
    } else if (bc !== NO_INDEX) {
      blockFlags[bc] = (blockFlags[bc] as number) | ATLAS_BLOCK_FLAG.boundary;
    }
  }

  // ---- stitches between parts
  if (shape.parts.length > 1 && blockCount > 0) {
    // Wires whose surfaces touch (welds, crossings, consecutive runs of one wire).
    const lines = patches
      .map((patch, index) => ({ patch, index }))
      .filter(({ patch }) => patch.line);
    const ends = lines.map(({ patch }) => ({
      p: affinePoint(patch.toItem, 0, 0, 0),
      q: affinePoint(patch.toItem, 0, 0, patch.length),
      length: patch.length,
    }));
    const rowBlock = (patch: AtlasPatch, fraction: number): number => {
      const row = Math.min(patch.rowCount - 1, Math.max(0, Math.floor(fraction * patch.rowCount)));
      return ownBlock[rows[2 * (patch.rowStart + row)] as number] as number;
    };
    for (let i = 0; i < lines.length; i++) {
      const pi = (lines[i] as (typeof lines)[number]).patch;
      const ei = ends[i] as (typeof ends)[number];
      for (let j = i + 1; j < lines.length; j++) {
        const pj = (lines[j] as (typeof lines)[number]).patch;
        if (pi.part === pj.part) continue;
        const ej = ends[j] as (typeof ends)[number];
        const reach = pi.radius + pj.radius + options.wireTouchGap;
        // Cheap rejection by the bounding spheres of the two segments.
        const mx = 0.5 * (ei.p[0] + ei.q[0] - ej.p[0] - ej.q[0]);
        const my = 0.5 * (ei.p[1] + ei.q[1] - ej.p[1] - ej.q[1]);
        const mz = 0.5 * (ei.p[2] + ei.q[2] - ej.p[2] - ej.q[2]);
        if (Math.hypot(mx, my, mz) > 0.5 * (ei.length + ej.length) + reach) continue;
        const [distance, s, t] = segmentSegment(ei.p, ei.q, ej.p, ej.q);
        if (distance > reach) continue;
        const ba = rowBlock(pi, s);
        const bc = rowBlock(pj, t);
        if (ba !== NO_INDEX && bc !== NO_INDEX) {
          addLink(ba, bc, Math.PI * Math.min(pi.radius, pj.radius), LINK_KIND.stitch);
        }
      }
    }

    // Boundary blocks next to another part.
    const partIsLine = partGeometry.map((g) => g.kind === 'line');
    const radiusOfBlock = (block: number): number =>
      ((blockFlags[block] as number) & ATLAS_BLOCK_FLAG.line) !== 0
        ? (patches[blockPatch[block] as number] as AtlasPatch).radius
        : 0;
    let maxRadius = 0;
    for (const { patch } of lines) maxRadius = Math.max(maxRadius, patch.radius);
    const search = 2.5 * Math.max(D, options.lineLength) + maxRadius;
    const h = search;
    const keyOf = (x: number, y: number, z: number): number =>
      (Math.floor(x / h) + 2048) * 16777216 +
      (Math.floor(y / h) + 2048) * 4096 +
      (Math.floor(z / h) + 2048);
    const hash = new Map<number, number[]>();
    for (let block = 0; block < blockCount; block++) {
      const key = keyOf(
        centre[3 * block] as number,
        centre[3 * block + 1] as number,
        centre[3 * block + 2] as number,
      );
      const list = hash.get(key);
      if (list === undefined) hash.set(key, [block]);
      else list.push(block);
    }
    const reach = options.stitchReach * D;
    /**
     * Whether a film on block `a` can run on to block `c` of another part (0 no, 1 straight
     * on, 2 round an outer edge): not when they are
     * the two faces of one thin sheet (opposite normals), and not when one lies behind the
     * face of the other while the other does not (the far side of a wall that stands on a
     * floor). Two faces that meet at an outer edge each lie behind the other, at an inner
     * corner each in front of the other, on one plane neither.
     */
    const facesAlong = (a: number, c: number): number => {
      if (((blockFlags[c] as number) & ATLAS_BLOCK_FLAG.line) !== 0) return 1;
      const ax = normal[3 * a] as number;
      const ay = normal[3 * a + 1] as number;
      const az = normal[3 * a + 2] as number;
      const bx = normal[3 * c] as number;
      const by = normal[3 * c + 1] as number;
      const bz = normal[3 * c + 2] as number;
      if (ax * bx + ay * by + az * bz < -STITCH_OPPOSED) return 0;
      const dx = (centre[3 * c] as number) - (centre[3 * a] as number);
      const dy = (centre[3 * c + 1] as number) - (centre[3 * a + 1] as number);
      const dz = (centre[3 * c + 2] as number) - (centre[3 * a + 2] as number);
      const d = Math.hypot(dx, dy, dz);
      if (!(d > 0)) return 1;
      const front = (dx * ax + dy * ay + dz * az) / d;
      const back = -(dx * bx + dy * by + dz * bz) / d;
      if (
        (front < -STITCH_OPPOSED && back > STITCH_LEVEL) ||
        (back < -STITCH_OPPOSED && front > STITCH_LEVEL)
      ) {
        return 0;
      }
      // On one plane or at an inner corner: the film runs straight on. Round an outer edge
      // (each behind the other) it does so only where the other part offers nothing nearer.
      return front > -STITCH_ROUND && back > -STITCH_ROUND ? 1 : 2;
    };
    /**
     * Whether the way from block `a` round an outer edge to block `c` is open: along the
     * plane of `a` to where it meets the plane of `c`, then along that to `c`, no point just
     * off those planes lies inside the shape. The far side of a wall that stands on a floor
     * lies behind the floor's face as the side of a table does, but the way to it goes
     * through the wall.
     */
    const roundOpen = (a: number, c: number): boolean => {
      const pa = [
        centre[3 * a] as number,
        centre[3 * a + 1] as number,
        centre[3 * a + 2] as number,
      ];
      const pc = [
        centre[3 * c] as number,
        centre[3 * c + 1] as number,
        centre[3 * c + 2] as number,
      ];
      const na = [
        normal[3 * a] as number,
        normal[3 * a + 1] as number,
        normal[3 * a + 2] as number,
      ];
      const nc = [
        normal[3 * c] as number,
        normal[3 * c + 1] as number,
        normal[3 * c + 2] as number,
      ];
      const d = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!];
      const along = d[0]! * na[0]! + d[1]! * na[1]! + d[2]! * na[2]!;
      // Direction in the plane of `a` towards `c`, and how far along it the planes meet.
      const v = [d[0]! - along * na[0]!, d[1]! - along * na[1]!, d[2]! - along * na[2]!];
      const length = Math.hypot(v[0]!, v[1]!, v[2]!);
      if (!(length > 0)) return true;
      const slope = (v[0]! * nc[0]! + v[1]! * nc[1]! + v[2]! * nc[2]!) / length;
      if (Math.abs(slope) < STITCH_LEVEL) return true;
      const reachEdge = (d[0]! * nc[0]! + d[1]! * nc[1]! + d[2]! * nc[2]!) / slope;
      const edge = [
        pa[0]! + (reachEdge * v[0]!) / length,
        pa[1]! + (reachEdge * v[1]!) / length,
        pa[2]! + (reachEdge * v[2]!) / length,
      ];
      for (let leg = 0; leg < 2; leg++) {
        const from = leg === 0 ? pa : edge;
        const to = leg === 0 ? edge : pc;
        const off = leg === 0 ? na : nc;
        for (let k = 1; k <= STITCH_PROBES; k++) {
          const t = k / (STITCH_PROBES + 1);
          const inside = signedDistance(shape, [
            from[0]! + t * (to[0]! - from[0]!) + options.deadDepth * off[0]!,
            from[1]! + t * (to[1]! - from[1]!) + options.deadDepth * off[1]!,
            from[2]! + t * (to[2]! - from[2]!) + options.deadDepth * off[2]!,
          ]);
          if (inside < -COINCIDENT) return false;
        }
      }
      return true;
    };
    for (let block = 0; block < blockCount; block++) {
      if (((blockFlags[block] as number) & ATLAS_BLOCK_FLAG.boundary) === 0) continue;
      const cx = centre[3 * block] as number;
      const cy = centre[3 * block + 1] as number;
      const cz = centre[3 * block + 2] as number;
      const own = radiusOfBlock(block);
      const isLine = ((blockFlags[block] as number) & ATLAS_BLOCK_FLAG.line) !== 0;
      for (let other = 0; other < shape.parts.length; other++) {
        if (other === blockPart[block]) continue;
        if (isLine && partIsLine[other] === true) continue;
        const box = partBox[other] as { min: number[]; max: number[] };
        const margin = reach + own;
        if (
          cx < (box.min[0] as number) - margin ||
          cx > (box.max[0] as number) + margin ||
          cy < (box.min[1] as number) - margin ||
          cy > (box.max[1] as number) + margin ||
          cz < (box.min[2] as number) - margin ||
          cz > (box.max[2] as number) + margin
        ) {
          continue;
        }
        const frames = partFrames[other] as { toItem: Affine; toPart: Affine };
        const local = affinePoint(frames.toPart, cx, cy, cz);
        const prim = (shape.parts[other] as Part).prim;
        const d = primitiveSignedDistance(prim, local);
        if (d - own > reach) continue;
        const g = primitiveSignedDistanceGradient(prim, local);
        const gi = affineVector(frames.toItem, g[0], g[1], g[2]);
        // The foot of the distance on the other part.
        const fx = cx - d * gi[0];
        const fy = cy - d * gi[1];
        const fz = cz - d * gi[2];
        let best = NO_INDEX;
        let bestD = 2.5 * Math.max(D, options.lineLength);
        // Candidates round an outer edge, nearest first once sorted: (distance, block) pairs.
        const round: number[] = [];
        const ix = Math.floor(fx / h);
        const iy = Math.floor(fy / h);
        const iz = Math.floor(fz / h);
        for (let ax = ix - 1; ax <= ix + 1; ax++) {
          for (let ay = iy - 1; ay <= iy + 1; ay++) {
            for (let az = iz - 1; az <= iz + 1; az++) {
              const list = hash.get((ax + 2048) * 16777216 + (ay + 2048) * 4096 + (az + 2048));
              if (list === undefined) continue;
              for (const candidate of list) {
                if (blockPart[candidate] !== other) continue;
                const way = isLine ? 1 : facesAlong(block, candidate);
                if (way === 0) continue;
                const dist =
                  Math.hypot(
                    (centre[3 * candidate] as number) - fx,
                    (centre[3 * candidate + 1] as number) - fy,
                    (centre[3 * candidate + 2] as number) - fz,
                  ) - radiusOfBlock(candidate);
                if (way === 2) {
                  if (dist < bestD) round.push(dist, candidate);
                } else if (dist < bestD || (dist === bestD && candidate < best)) {
                  bestD = dist;
                  best = candidate;
                }
              }
            }
          }
        }
        if (best === NO_INDEX && round.length > 0) {
          // The nearest of them the way to which is open (a few are tried, nearest first).
          const order = Array.from({ length: round.length / 2 }, (_, k) => k).sort(
            (p, q) =>
              (round[2 * p] as number) - (round[2 * q] as number) ||
              (round[2 * p + 1] as number) - (round[2 * q + 1] as number),
          );
          for (let k = 0; k < order.length && k < STITCH_TRIES && best === NO_INDEX; k++) {
            const candidate = round[2 * (order[k] as number) + 1] as number;
            if (roundOpen(block, candidate)) best = candidate;
          }
        }
        if (best !== NO_INDEX) {
          addLink(
            block,
            best,
            Math.min(Math.sqrt(area[block] as number), Math.sqrt(area[best] as number)),
            LINK_KIND.stitch,
          );
        }
      }
    }
  }

  // ---- links as sorted arrays
  const keys = [...links.keys()].sort((p, q) => p - q);
  const linkA = new Uint32Array(keys.length);
  const linkB = new Uint32Array(keys.length);
  const linkLength = new Float64Array(keys.length);
  const linkKind = new Uint8Array(keys.length);
  keys.forEach((key, k) => {
    const entry = links.get(key) as { length: number; kind: number };
    linkA[k] = Math.floor(key / blockCount);
    linkB[k] = key % blockCount;
    linkLength[k] = entry.length;
    linkKind[k] = entry.kind;
  });

  return {
    shape,
    blockSize: D,
    lineLength: options.lineLength,
    patches,
    rows,
    rowRegion: Int16Array.from(
      b.rowRegion,
      (set) => (regionSets.sets[set] as readonly number[])[0] ?? -1,
    ),
    rowRegionSet: Uint16Array.from(b.rowRegion),
    regionSets: regionSets.sets,
    cellCount,
    cellBlock,
    cellQuarter,
    blockCount,
    blockCell,
    blockPatch,
    blockPart,
    blockRow,
    blockCol,
    blockFlags,
    centre,
    normal,
    area,
    quarterArea,
    quarterCentre,
    linkA,
    linkB,
    linkLength,
    linkKind,
    surfs: b.surfs,
    partArea,
    unsupported: b.unsupported,
    partGeometry,
  };
}
