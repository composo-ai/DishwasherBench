/**
 * Patches on planar faces (docs/design/sim-core.md section 3.3, "CART", simplified): a Cartesian
 * grid on every face of a rounded box or hull, and on the two flat ends of a partial shell of
 * revolution.
 *
 * A face of a polytope is a convex polygon: a cell is the part of its grid rectangle inside the
 * polygon, with the exact clipped area and centroid. The flat end of a partial shell has the
 * outline of the shell's cross-section, which is not convex: its cells are measured by
 * sub-sampling the cross-section and scaled so that their sum is the exact area.
 *
 * Rounded edges and corners of a polytope carry no cells of their own (the "seam" of section
 * 3.3 for every edge, however wide; a simplification). Their surface is recorded as small
 * pieces (`AtlasBuilder.addRound`), each credited to the point of a face that a ray hit on it
 * is mapped to: the half of an edge strip nearer a face to the foot of the piece on the outline
 * of that face, a piece of a corner to the corner of the face whose normal is nearest. `atlas.ts`
 * adds the area of a piece to the block and quarter of that point if the piece is exposed. The
 * cells of two faces that face each other across an edge are linked with the length of edge
 * they share.
 *
 * What this costs, measured over the catalogue at 2 mm blocks (bench/review-check.ts, section
 * 4): on a part that is mostly rounded edge (a handle modelled as a box of no thickness with a
 * large radius) a block stands for many grid cells. 32 polytope parts of the 102 item types have
 * a mean block area above three grid cells (12 mm2); the worst is the grip of the swivel peeler
 * (radius 11.5 mm) with 92 blocks of 96 mm2 on average and 528 mm2 at most; jug handles are at
 * 20 to 40 mm2, mug and cup handles at 18 to 27 mm2. A hit on such an edge is credited to a
 * block whose centre can be several millimetres away and whose stored normal is that of the
 * face, up to 90 degrees from the normal at the hit (the hit record carries the true normal).
 * A region made of edge surface is resolved no better: the hits on the rounded edge of a
 * chopping board go to blocks of its narrow edge faces and of its top and underside. The remedy
 * is a strip patch on every edge wider than a block (sim-core section 3.3); it is not built.
 *
 * Units: metres. Frames: item frame for what is stored; (u, v) in the plane of a face.
 */

import type { Vec3 } from '@spotless/core';
import { v3Cross, v3Dot, v3Normalise, v3Sub } from '@spotless/core';
import {
  affineIntoFrame,
  affineInverseRigid,
  affineMul,
  affinePoint,
  affineTransposeVector,
  affineVector,
  type Affine,
} from './affine.ts';
import { LINK_KIND, NO_INDEX, PATCH_KIND, SURF_KIND, type AtlasBuilder } from './atlas-core.ts';
import type { CorePolytope } from './polytope.ts';

/** Sub-samples per side used to measure a cell of a masked face. */
const MASK_SAMPLES = 6;

/** Most slices round half of a rounded edge, for its exposure and its share of area. */
const ROUND_MAX_SLICES = 16;
/** Fewest and most sample directions over the sphere for the rounded corners of a polytope. */
const ROUND_MIN_DIRECTIONS = 64;
const ROUND_MAX_DIRECTIONS = 4096;
/** The golden angle, radians (Fibonacci lattice on the sphere). */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** A face grid, as the seam pass needs it. */
export interface FaceGrid {
  readonly patch: number;
  readonly u0: number;
  readonly v0: number;
  readonly du: number;
  readonly dv: number;
  readonly cols: number;
  readonly rows: number;
  readonly cellStart: number;
}

/** What {@link addCartPatch} is given. */
export interface CartPatchOptions {
  readonly part: number;
  /** Item frame to face frame (u, v in the plane, z along the outward normal). */
  readonly frame: Affine;
  /** Face frame back to the item frame. */
  readonly toItem: Affine;
  /** Convex outline as (u, v) pairs, counter-clockwise; or null with `mask`. */
  readonly polygon: readonly number[] | null;
  readonly mask: ((u: number, v: number) => boolean) | null;
  /** Bounding rectangle of the face in (u, v): `[uMin, vMin, uMax, vMax]`. */
  readonly bounds: readonly [number, number, number, number];
  readonly blockSize: number;
  readonly region: number;
  /** Area fraction below which a cut cell joins its largest neighbour. */
  readonly cutMerge: number;
  readonly porosity: number;
  /** With `mask`: the exact area of the face, to which the sampled cell areas are scaled. */
  readonly exactArea?: number;
}

/** Area and centroid of a convex polygon (flat (x, y) pairs). */
function polygonAreaCentroid(p: readonly number[]): [number, number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const x0 = p[2 * i] as number;
    const y0 = p[2 * i + 1] as number;
    const x1 = p[2 * ((i + 1) % n)] as number;
    const y1 = p[2 * ((i + 1) % n) + 1] as number;
    const w = x0 * y1 - x1 * y0;
    a += w;
    cx += (x0 + x1) * w;
    cy += (y0 + y1) * w;
  }
  if (!(Math.abs(a) > 1e-30)) return [0, 0, 0];
  return [0.5 * a, cx / (3 * a), cy / (3 * a)];
}

/** Clips a convex polygon to the half-plane `nx x + ny y <= d` (Sutherland-Hodgman). */
function clipHalfPlane(p: readonly number[], nx: number, ny: number, d: number): number[] {
  const out: number[] = [];
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const x0 = p[2 * i] as number;
    const y0 = p[2 * i + 1] as number;
    const x1 = p[2 * ((i + 1) % n)] as number;
    const y1 = p[2 * ((i + 1) % n) + 1] as number;
    const s0 = nx * x0 + ny * y0 - d;
    const s1 = nx * x1 + ny * y1 - d;
    if (s0 <= 0) out.push(x0, y0);
    if ((s0 < 0 && s1 > 0) || (s0 > 0 && s1 < 0)) {
      const t = s0 / (s0 - s1);
      out.push(x0 + t * (x1 - x0), y0 + t * (y1 - y0));
    }
  }
  return out;
}

/** The outward edge half-planes of a convex counter-clockwise polygon: (nx, ny, d) triples. */
function edgePlanes(p: readonly number[]): number[] {
  const out: number[] = [];
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const x0 = p[2 * i] as number;
    const y0 = p[2 * i + 1] as number;
    const x1 = p[2 * ((i + 1) % n)] as number;
    const y1 = p[2 * ((i + 1) % n) + 1] as number;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (!(len > 0)) continue;
    const nx = (y1 - y0) / len;
    const ny = -(x1 - x0) / len;
    out.push(nx, ny, nx * x0 + ny * y0);
  }
  return out;
}

/** Length of the part of the segment (x0, y0) to (x1, y1) inside a convex polygon. */
function segmentInside(
  planes: readonly number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < planes.length; k += 3) {
    const nx = planes[k] as number;
    const ny = planes[k + 1] as number;
    const s0 = nx * x0 + ny * y0 - (planes[k + 2] as number);
    const s1 = nx * x1 + ny * y1 - (planes[k + 2] as number);
    if (s0 > 0 && s1 > 0) return 0;
    if (s0 > 0) t0 = Math.max(t0, s0 / (s0 - s1));
    else if (s1 > 0) t1 = Math.min(t1, s0 / (s0 - s1));
  }
  return t1 > t0 ? (t1 - t0) * Math.hypot(x1 - x0, y1 - y0) : 0;
}

/**
 * Area and centroid of the part of the rectangle [ua, ub] x [va, vb] inside a convex polygon
 * given as counter-clockwise (u, v) pairs: `[area, u, v]`, or zeros when they do not overlap.
 */
export function clipRectToPolygon(
  polygon: readonly number[],
  ua: number,
  va: number,
  ub: number,
  vb: number,
): [number, number, number] {
  let clipped = clipHalfPlane(polygon, -1, 0, -ua);
  if (clipped.length >= 6) clipped = clipHalfPlane(clipped, 1, 0, ub);
  if (clipped.length >= 6) clipped = clipHalfPlane(clipped, 0, -1, -va);
  if (clipped.length >= 6) clipped = clipHalfPlane(clipped, 0, 1, vb);
  if (clipped.length < 6) return [0, 0, 0];
  const [a, x, y] = polygonAreaCentroid(clipped);
  return a > 0 ? [a, x, y] : [0, 0, 0];
}

/** Adds the grid of one planar face. Cells are numbered row by row (v), columns along u. */
export function addCartPatch(b: AtlasBuilder, o: CartPatchOptions): FaceGrid {
  const patch = b.patches.length;
  const [uMin, vMin, uMax, vMax] = o.bounds;
  const cols = Math.max(1, Math.round((uMax - uMin) / o.blockSize));
  const rows = Math.max(1, Math.round((vMax - vMin) / o.blockSize));
  const du = (uMax - uMin) / cols;
  const dv = (vMax - vMin) / rows;
  const full = du * dv;
  const rowStart = b.rowRegion.length;
  const cellStart = b.cellPatch.length;
  const normal = affineTransposeVector(o.frame, 0, 0, 1);
  const planes = o.polygon === null ? null : edgePlanes(o.polygon);
  const inside = (u: number, v: number): boolean => {
    if (planes === null) return false;
    for (let k = 0; k < planes.length; k += 3) {
      if ((planes[k] as number) * u + (planes[k + 1] as number) * v > (planes[k + 2] as number)) {
        return false;
      }
    }
    return true;
  };

  let sampled = 0;
  for (let r = 0; r < rows; r++) {
    const row = b.addRow(cols, o.region);
    const va = vMin + r * dv;
    const vb = va + dv;
    for (let c = 0; c < cols; c++) {
      const ua = uMin + c * du;
      const ub = ua + du;
      let area = 0;
      let cu = 0.5 * (ua + ub);
      let cv = 0.5 * (va + vb);
      if (o.polygon !== null) {
        if (inside(ua, va) && inside(ub, va) && inside(ub, vb) && inside(ua, vb)) {
          area = full;
        } else {
          const [a, x, y] = clipRectToPolygon(o.polygon, ua, va, ub, vb);
          if (a > 1e-9 * full) {
            area = a;
            cu = x;
            cv = y;
          }
        }
      } else if (o.mask !== null) {
        let hits = 0;
        let su = 0;
        let sv = 0;
        for (let i = 0; i < MASK_SAMPLES; i++) {
          for (let j = 0; j < MASK_SAMPLES; j++) {
            const u = ua + ((i + 0.5) / MASK_SAMPLES) * du;
            const v = va + ((j + 0.5) / MASK_SAMPLES) * dv;
            if (o.mask(u, v)) {
              hits++;
              su += u;
              sv += v;
            }
          }
        }
        if (hits > 0) {
          area = (full * hits) / (MASK_SAMPLES * MASK_SAMPLES);
          cu = su / hits;
          cv = sv / hits;
          sampled += area;
          if (!o.mask(cu, cv)) {
            // The outline is not convex, so the mean of the samples may lie off the face: take the
            // sample on the face nearest to it.
            let best = Number.POSITIVE_INFINITY;
            const mu = cu;
            const mv = cv;
            for (let i = 0; i < MASK_SAMPLES; i++) {
              for (let j = 0; j < MASK_SAMPLES; j++) {
                const u = ua + ((i + 0.5) / MASK_SAMPLES) * du;
                const v = va + ((j + 0.5) / MASK_SAMPLES) * dv;
                const d = Math.hypot(u - mu, v - mv);
                if (d < best && o.mask(u, v)) {
                  best = d;
                  cu = u;
                  cv = v;
                }
              }
            }
          }
        }
      }
      const open = r === 0 || r === rows - 1 || c === 0 || c === cols - 1 || area < 0.999999 * full;
      b.addCell(patch, row, c, affinePoint(o.toItem, cu, cv, 0), normal, area, open);
    }
  }
  if (o.mask !== null && o.exactArea !== undefined && sampled > 0) {
    const k = o.exactArea / sampled;
    for (let i = cellStart; i < b.cellPatch.length; i++) {
      b.cellArea[i] = (b.cellArea[i] as number) * k;
    }
  }

  // Links between neighbours that both hold surface, with the length of grid line inside the face.
  const at = (r: number, c: number): number => cellStart + r * cols + c;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const self = at(r, c);
      if (!((b.cellArea[self] as number) > 0)) continue;
      const ub = uMin + (c + 1) * du;
      const va = vMin + r * dv;
      const vb = va + dv;
      const ua = ub - du;
      if (c + 1 < cols && (b.cellArea[at(r, c + 1)] as number) > 0) {
        const len = planes === null ? dv : segmentInside(planes, ub, va, ub, vb);
        if (len > 1e-9 * dv) b.link(self, at(r, c + 1), len, LINK_KIND.patch);
      }
      if (r + 1 < rows && (b.cellArea[at(r + 1, c)] as number) > 0) {
        const len = planes === null ? du : segmentInside(planes, ua, vb, ub, vb);
        if (len > 1e-9 * du) b.link(self, at(r + 1, c), len, LINK_KIND.patch);
      }
    }
  }

  // A cut cell below the merge fraction joins its largest neighbour that is not itself small.
  const small = o.cutMerge * full;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const self = at(r, c);
      const area = b.cellArea[self] as number;
      if (!(area > 0) || area >= small) continue;
      let best = -1;
      let bestArea = 0;
      for (const [rr, cc] of [
        [r, c - 1],
        [r, c + 1],
        [r - 1, c],
        [r + 1, c],
      ] as const) {
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        const other = b.cellArea[at(rr, cc)] as number;
        if (other >= small && other > bestArea) {
          bestArea = other;
          best = at(rr, cc);
        }
      }
      if (best >= 0) b.cellRep[self] = best;
    }
  }

  b.patches.push({
    kind: PATCH_KIND.cart,
    line: false,
    part: o.part,
    frame: o.frame,
    toItem: o.toItem,
    rowStart,
    rowCount: rows,
    a0: vMin,
    da: dv,
    b0: uMin,
    db: du,
    periodicRows: false,
    periodicCols: false,
    run: null,
    scale: [1, 1],
    radius: 0,
    length: 0,
    polygon: o.polygon,
    mask: o.mask,
    porosity: o.porosity,
    cellStart,
    cellCount: rows * cols,
  });
  return { patch, u0: uMin, v0: vMin, du, dv, cols, rows, cellStart };
}

/** The cell of a face grid that holds (u, v), or the nearest one that has surface; -1 if none is near. */
export function cellNear(b: AtlasBuilder, g: FaceGrid, u: number, v: number): number {
  const c0 = Math.min(g.cols - 1, Math.max(0, Math.floor((u - g.u0) / g.du)));
  const r0 = Math.min(g.rows - 1, Math.max(0, Math.floor((v - g.v0) / g.dv)));
  let best = -1;
  let bestD = Number.POSITIVE_INFINITY;
  for (let reach = 0; reach <= 2 && best < 0; reach++) {
    for (let r = Math.max(0, r0 - reach); r <= Math.min(g.rows - 1, r0 + reach); r++) {
      for (let c = Math.max(0, c0 - reach); c <= Math.min(g.cols - 1, c0 + reach); c++) {
        const cell = g.cellStart + r * g.cols + c;
        if (!((b.cellArea[cell] as number) > 0)) continue;
        const d = Math.hypot(g.u0 + (c + 0.5) * g.du - u, g.v0 + (r + 0.5) * g.dv - v);
        if (d < bestD) {
          bestD = d;
          best = cell;
        }
      }
    }
  }
  return best;
}

/** The stretches `[cell, t0, t1]` (t in metres from A) of the segment A to B on a face grid. */
function cellsAlong(
  b: AtlasBuilder,
  g: FaceGrid,
  ua: number,
  va: number,
  ub: number,
  vb: number,
): number[] {
  const out: number[] = [];
  const length = Math.hypot(ub - ua, vb - va);
  if (!(length > 0)) return out;
  const eps = 1e-9;
  const cLo = Math.max(0, Math.floor((Math.min(ua, ub) - g.u0) / g.du - eps));
  const cHi = Math.min(g.cols - 1, Math.floor((Math.max(ua, ub) - g.u0) / g.du + eps));
  const rLo = Math.max(0, Math.floor((Math.min(va, vb) - g.v0) / g.dv - eps));
  const rHi = Math.min(g.rows - 1, Math.floor((Math.max(va, vb) - g.v0) / g.dv + eps));
  const du = ub - ua;
  const dv = vb - va;
  for (let r = rLo; r <= rHi; r++) {
    for (let c = cLo; c <= cHi; c++) {
      const cell = g.cellStart + r * g.cols + c;
      if (!((b.cellArea[cell] as number) > 0)) continue;
      // Liang-Barsky against the cell rectangle.
      let t0 = 0;
      let t1 = 1;
      const x0 = g.u0 + c * g.du;
      const y0 = g.v0 + r * g.dv;
      const tests: readonly (readonly [number, number])[] = [
        [-du, ua - x0],
        [du, x0 + g.du - ua],
        [-dv, va - y0],
        [dv, y0 + g.dv - va],
      ];
      let ok = true;
      for (const [p, q] of tests) {
        if (Math.abs(p) < 1e-300) {
          if (q < -1e-12) ok = false;
        } else {
          const t = q / p;
          if (p < 0) t0 = Math.max(t0, t);
          else t1 = Math.min(t1, t);
        }
      }
      if (ok && (t1 - t0) * length > 1e-9) out.push(cell, t0 * length, t1 * length);
    }
  }
  return out;
}

/**
 * Where the segment A to B (length `length`, metres) on a face grid crosses the half-cell lines
 * of the grid: distances from A, ascending, starting with 0 and ending with `length`.
 */
function halfCellCuts(
  g: FaceGrid,
  ua: number,
  va: number,
  ub: number,
  vb: number,
  length: number,
): number[] {
  const cuts = [0, length];
  const add = (a: number, c: number, origin: number, step: number): void => {
    if (!(Math.abs(c - a) > 1e-12)) return;
    const lo = Math.ceil((Math.min(a, c) - origin) / step - 1e-9);
    const hi = Math.floor((Math.max(a, c) - origin) / step + 1e-9);
    for (let k = lo; k <= hi; k++) {
      const t = ((origin + k * step - a) / (c - a)) * length;
      if (t > 1e-9 && t < length - 1e-9) cuts.push(t);
    }
  };
  add(ua, ub, g.u0, 0.5 * g.du);
  add(va, vb, g.v0, 0.5 * g.dv);
  cuts.sort((p, q) => p - q);
  const out: number[] = [];
  for (const t of cuts) {
    if (out.length === 0 || t - (out[out.length - 1] as number) > 1e-9) out.push(t);
  }
  out[out.length - 1] = length;
  return out;
}

/** What {@link addPolytopePart} reports, for the classification of triangles. */
export interface PolytopePlacement {
  readonly facePatch: readonly number[];
  readonly faceSurf: readonly number[];
  /** Per edge: its surf, or {@link NO_INDEX} without rounding. */
  readonly edgeSurf: readonly number[];
  /** Per vertex: its surf, or {@link NO_INDEX} without rounding. */
  readonly vertexSurf: readonly number[];
}

/**
 * Adds a rounded polytope: one grid per face, the analytic pieces of its faces, edges and
 * corners, the area of the rounded edges and corners, and the seam links across its edges.
 * `partToItem` maps the part frame (in which `core` is given) to the item frame.
 */
export function addPolytopePart(
  b: AtlasBuilder,
  part: number,
  partToItem: Affine,
  core: CorePolytope,
  radius: number,
  blockSize: number,
  cutMerge: number,
  porosity: number,
  regionOfNormalZ: (nz: number) => number,
): PolytopePlacement {
  const itemToPart = affineInverseRigid(partToItem);
  const grids: FaceGrid[] = [];
  const faceFrames: { origin: Vec3; u: Vec3; v: Vec3 }[] = [];
  const faceSurf: number[] = [];

  core.faces.forEach((face) => {
    const pts = face.loop.map((i) => core.vertices[i] as Vec3);
    const n = face.normal;
    // u along the longest edge, so that boxes get grids aligned with their sides.
    let u: Vec3 = [1, 0, 0];
    let longest = -1;
    pts.forEach((p, i) => {
      const e = v3Sub(pts[(i + 1) % pts.length] as Vec3, p);
      const len = Math.hypot(e[0], e[1], e[2]);
      if (len > longest + 1e-12) {
        longest = len;
        u = v3Normalise(e);
      }
    });
    const v = v3Cross(n, u);
    const p0 = pts[0] as Vec3;
    const origin: Vec3 = [p0[0] + radius * n[0], p0[1] + radius * n[1], p0[2] + radius * n[2]];
    const partToFace = affineIntoFrame(origin, u, v, n);
    const frame = affineMul(partToFace, itemToPart);
    const toItem = affineMul(partToItem, {
      m: [u[0], v[0], n[0], u[1], v[1], n[1], u[2], v[2], n[2]],
      c: [origin[0], origin[1], origin[2]],
    });
    const polygon: number[] = [];
    let uMin = Number.POSITIVE_INFINITY;
    let vMin = Number.POSITIVE_INFINITY;
    let uMax = Number.NEGATIVE_INFINITY;
    let vMax = Number.NEGATIVE_INFINITY;
    for (const p of pts) {
      const rel = v3Sub(p, p0);
      const pu = v3Dot(rel, u);
      const pv = v3Dot(rel, v);
      polygon.push(pu, pv);
      uMin = Math.min(uMin, pu);
      uMax = Math.max(uMax, pu);
      vMin = Math.min(vMin, pv);
      vMax = Math.max(vMax, pv);
    }
    const grid = addCartPatch(b, {
      part,
      frame,
      toItem,
      polygon,
      mask: null,
      bounds: [uMin, vMin, uMax, vMax],
      blockSize,
      region: regionOfNormalZ(n[2]),
      cutMerge,
      porosity,
    });
    grids.push(grid);
    faceFrames.push({ origin: p0, u, v });
    faceSurf.push(b.surfs.length);
    b.surfs.push({
      kind: SURF_KIND.plane,
      frame,
      params: [],
      sBase: 0,
      sScale: 0,
      pMin: 0,
      pMax: 0,
      prev: NO_INDEX,
      next: NO_INDEX,
      patch: grid.patch,
      part,
    });
  });

  const uvOn = (f: number, p: Vec3): [number, number] => {
    const frame = faceFrames[f] as { origin: Vec3; u: Vec3; v: Vec3 };
    const rel = v3Sub(p, frame.origin);
    return [v3Dot(rel, frame.u), v3Dot(rel, frame.v)];
  };

  // Corners first, so that the cylinder of an edge can name the spheres at its two ends: a hit
  // that comes to rest beyond the end of an edge is on the corner there.
  const vertexSurf: number[] = [];
  core.vertices.forEach((p) => {
    if (radius > 0) {
      vertexSurf.push(b.surfs.length);
      b.surfs.push({
        kind: SURF_KIND.revArc,
        frame: affineMul(affineIntoFrame(p, [1, 0, 0], [0, 1, 0], [0, 0, 1]), itemToPart),
        params: [0, 0, radius, -Math.PI / 2],
        sBase: 0,
        sScale: 0,
        pMin: 0,
        pMax: Math.PI,
        prev: NO_INDEX,
        next: NO_INDEX,
        patch: NO_INDEX,
        part,
      });
    } else {
      vertexSurf.push(NO_INDEX);
    }
  });

  // Edges: seam links across them, their cylinders, and their strips as pieces of rounded
  // surface. A strip is cut along the edge where it crosses the half-cell lines of the face it
  // is credited to (so every piece lies in one quarter of one cell) and round the edge into
  // slices no wider than half a block; half of the strip goes to each face.
  const edgeSurf: number[] = [];
  const toItemPoint = (p: readonly number[]): [number, number, number] =>
    affinePoint(partToItem, p[0] as number, p[1] as number, p[2] as number);
  const toItemVector = (p: readonly number[]): [number, number, number] =>
    affineVector(partToItem, p[0] as number, p[1] as number, p[2] as number);
  core.edges.forEach((edge) => {
    const pa = core.vertices[edge.a] as Vec3;
    const pb = core.vertices[edge.b] as Vec3;
    const ends = [edge.face0, edge.face1].map((f) => {
      const [ua, va] = uvOn(f, pa);
      const [ub, vb] = uvOn(f, pb);
      return [ua, va, ub, vb] as const;
    });
    const lists = [edge.face0, edge.face1].map((f, k) => {
      const [ua, va, ub, vb] = ends[k] as readonly [number, number, number, number];
      return cellsAlong(b, grids[f] as FaceGrid, ua, va, ub, vb);
    });
    const [l0, l1] = lists as [number[], number[]];
    {
      // A seam holds only where the edge it crosses is surface of the whole shape: the edge of
      // a floor slab that a wall stands against joins nothing (water on the floor does not
      // run round it to the underside). The edge is probed at the middle of the shared
      // stretch, at the apex of its rounding, along the bisector of the two faces.
      const along = v3Normalise(v3Sub(pb, pa));
      const n0 = (core.faces[edge.face0] as { normal: Vec3 }).normal;
      const across = v3Cross(along, n0);
      const round = (share: number): Vec3 => {
        const phi = share * edge.angle;
        return [
          Math.cos(phi) * n0[0] + Math.sin(phi) * across[0],
          Math.cos(phi) * n0[1] + Math.sin(phi) * across[1],
          Math.cos(phi) * n0[2] + Math.sin(phi) * across[2],
        ];
      };
      const n1 = (core.faces[edge.face1] as { normal: Vec3 }).normal;
      // A quarter, a half and three quarters of the way round the edge, and just inside each
      // face from where its plane meets the rounding (a thin sheet has edges of half a turn,
      // of which a part standing on it buries one side).
      const around = [n0, round(0.25), round(0.5), round(0.75), n1];
      const directions = around.map((d) => toItemVector(d));
      const inset = Math.min(0.25 * blockSize, 1e-3);
      const zero = [0, 0, 0];
      const inward = [
        [-across[0] * inset, -across[1] * inset, -across[2] * inset],
        zero,
        zero,
        zero,
        v3Cross(along, n1).map((c) => c * inset),
      ] as const;
      for (let i = 0; i < l0.length; i += 3) {
        for (let j = 0; j < l1.length; j += 3) {
          const from = Math.max(l0[i + 1] as number, l1[j + 1] as number);
          const to = Math.min(l0[i + 2] as number, l1[j + 2] as number);
          const overlap = to - from;
          if (!(overlap > 1e-9)) continue;
          const tm = 0.5 * (from + to);
          const probes: number[] = [];
          around.forEach((d, q) => {
            const shift = inward[q] as readonly number[];
            const p = toItemPoint([
              pa[0] + tm * along[0] + radius * d[0] + (shift[0] as number),
              pa[1] + tm * along[1] + radius * d[1] + (shift[1] as number),
              pa[2] + tm * along[2] + radius * d[2] + (shift[2] as number),
            ]);
            const n = directions[q] as readonly number[];
            probes.push(p[0], p[1], p[2], n[0] as number, n[1] as number, n[2] as number);
          });
          b.linkAcross(l0[i] as number, l1[j] as number, overlap, LINK_KIND.seam, probes);
        }
      }
    }
    if (radius > 0) {
      const ez = v3Normalise(v3Sub(pb, pa));
      const ex = (core.faces[edge.face0] as { normal: Vec3 }).normal;
      // Across the edge from face0 towards face1: the normal turns from ex towards ey.
      const ey = v3Cross(ez, ex);
      edgeSurf.push(b.surfs.length);
      b.surfs.push({
        kind: SURF_KIND.revLine,
        frame: affineMul(affineIntoFrame(pa, ex, ey, ez), itemToPart),
        params: [1, 0, radius, radius, 0],
        sBase: 0,
        sScale: 0,
        pMin: 0,
        pMax: edge.length,
        prev: vertexSurf[edge.a] as number,
        next: vertexSurf[edge.b] as number,
        patch: NO_INDEX,
        part,
      });
      const halfAngle = 0.5 * edge.angle;
      const slices = Math.min(
        ROUND_MAX_SLICES,
        Math.max(1, Math.ceil((radius * halfAngle) / (0.5 * blockSize))),
      );
      [edge.face0, edge.face1].forEach((f, k) => {
        const grid = grids[f] as FaceGrid;
        const [ua, va, ub, vb] = ends[k] as readonly [number, number, number, number];
        const cuts = halfCellCuts(grid, ua, va, ub, vb, edge.length);
        for (let c = 0; c + 1 < cuts.length; c++) {
          const t0 = cuts[c] as number;
          const t1 = cuts[c + 1] as number;
          const tm = 0.5 * (t0 + t1);
          const w = tm / edge.length;
          const u = ua + w * (ub - ua);
          const v = va + w * (vb - va);
          for (let s = 0; s < slices; s++) {
            const phi = k * halfAngle + ((s + 0.5) / slices) * halfAngle;
            const cs = Math.cos(phi);
            const sn = Math.sin(phi);
            const dir: Vec3 = [
              cs * ex[0] + sn * ey[0],
              cs * ex[1] + sn * ey[1],
              cs * ex[2] + sn * ey[2],
            ];
            b.addRound(
              grid.patch,
              u,
              v,
              (radius * halfAngle * (t1 - t0)) / slices,
              toItemPoint([
                pa[0] + tm * ez[0] + radius * dir[0],
                pa[1] + tm * ez[1] + radius * dir[1],
                pa[2] + tm * ez[2] + radius * dir[2],
              ]),
              toItemVector(dir),
            );
          }
        }
      });
    } else {
      edgeSurf.push(NO_INDEX);
    }
  });

  // Corners: the sphere of directions is sampled evenly; a direction belongs to the corner whose
  // vertex is furthest along it (the cones of outward normals of the vertices tile the sphere),
  // and within the corner to the face whose normal it is nearest, which is how the triangles of
  // the corner are tied to faces. The samples of a corner share its exact area.
  if (radius > 0) {
    const total = Math.min(
      ROUND_MAX_DIRECTIONS,
      Math.max(
        ROUND_MIN_DIRECTIONS,
        Math.ceil((4 * Math.PI * radius * radius) / (0.25 * blockSize * blockSize)),
      ),
    );
    const perVertex: Vec3[][] = core.vertices.map(() => []);
    for (let j = 0; j < total; j++) {
      const z = 1 - (2 * j + 1) / total;
      const rho = Math.sqrt(Math.max(0, 1 - z * z));
      const phi = j * GOLDEN_ANGLE;
      const d: Vec3 = [rho * Math.cos(phi), rho * Math.sin(phi), z];
      let best = 0;
      let bestDot = Number.NEGATIVE_INFINITY;
      core.vertices.forEach((p, v) => {
        const dot = v3Dot(d, p);
        if (dot > bestDot) {
          bestDot = dot;
          best = v;
        }
      });
      (perVertex[best] as Vec3[]).push(d);
    }
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const p of core.vertices) {
      cx += p[0] / core.vertices.length;
      cy += p[1] / core.vertices.length;
      cz += p[2] / core.vertices.length;
    }
    core.vertices.forEach((p, v) => {
      const area = radius * radius * (core.vertexDefect[v] as number);
      const faces = core.vertexFaces[v] as readonly number[];
      if (!(area > 0) || faces.length === 0) return;
      let dirs = perVertex[v] as Vec3[];
      // A cone too narrow to catch a sample: one piece, pointing away from the middle.
      if (dirs.length === 0) dirs = [v3Normalise([p[0] - cx, p[1] - cy, p[2] - cz])];
      for (const d of dirs) {
        let face = faces[0] as number;
        let bestDot = Number.NEGATIVE_INFINITY;
        for (const f of faces) {
          const dot = v3Dot(d, (core.faces[f] as { normal: Vec3 }).normal);
          if (dot > bestDot) {
            bestDot = dot;
            face = f;
          }
        }
        const [pu, pv] = uvOn(face, p);
        b.addRound(
          (grids[face] as FaceGrid).patch,
          pu,
          pv,
          area / dirs.length,
          toItemPoint([p[0] + radius * d[0], p[1] + radius * d[1], p[2] + radius * d[2]]),
          toItemVector(d),
        );
      }
    });
  }

  return { facePatch: grids.map((g) => g.patch), faceSurf, edgeSurf, vertexSurf };
}
