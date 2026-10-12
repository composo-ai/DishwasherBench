/**
 * Patches on bodies of revolution (docs/design/sim-core.md section 3.2, simplified): one grid in
 * (arc length along the closed meridian, angle) that covers the outer face, the rim and the
 * inner face of a shell, and line elements along thin capsules.
 *
 * Rows are bands of equal meridian length. Each row has its own number of columns, chosen so
 * that its cells are about as wide as they are long, so rows are ragged and a cell may have two
 * or three neighbours in the next row. The area of a band is exact (Pappus, from the integral of
 * r along the meridian); the centre and the normal of a cell are those of the analytic surface
 * at the middle of the cell.
 *
 * Simplifications against section 3.2: column counts are not powers of two, so tiers are not
 * nested; there is no special pole cell (the row at a pole is three or more sectors that meet at
 * the pole); a stretched shell uses the same grid in its unscaled coordinates, with the area of
 * each cell integrated by a 3 x 3 Gauss rule and its centre and normal taken at its middle.
 *
 * Units: metres, radians. Frame: item frame for what is stored, patch frame inside.
 */

import { affinePoint, affineTransposeVector, type Affine } from './affine.ts';
import { LINK_KIND, NO_INDEX, PATCH_KIND, SURF_KIND, type AtlasBuilder } from './atlas-core.ts';
import {
  createMeridianPoint,
  meridianArea,
  meridianAt,
  type MeridianPoint,
  type MeridianRun,
  type MeridianSide,
} from './meridian.ts';

const TWO_PI = 2 * Math.PI;

// Three-point Gauss-Legendre rule on [0, 1].
const GAUSS_X: readonly number[] = [0.5 - Math.sqrt(0.15), 0.5, 0.5 + Math.sqrt(0.15)];
const GAUSS_W: readonly number[] = [5 / 18, 8 / 18, 5 / 18];

/** Fewest columns of a row of a full turn: sectors that are distinct neighbours of each other. */
export const MIN_FULL_TURN_COLUMNS = 3;

/** What {@link addRevPatch} is given. */
export interface RevPatchOptions {
  /** Index of the part. */
  readonly part: number;
  /** Item frame to the unscaled local frame (z along the axis). */
  readonly frame: Affine;
  /** Unscaled local frame back to the item frame, stretch included. */
  readonly toItem: Affine;
  readonly run: MeridianRun;
  /** First azimuth and angular span, radians; `full` for a whole turn. */
  readonly theta0: number;
  readonly span: number;
  readonly full: boolean;
  /** Stretch along the local x and y axes. */
  readonly scale: readonly [number, number];
  /** Target size of a cell, metres. */
  readonly blockSize: number;
  /** Region index of a row from the side and mid-surface arc length at its centre. */
  readonly region: (side: MeridianSide, mid: number) => number;
  readonly porosity: number;
  /** Radius when the body is a capsule, else 0. */
  readonly radius: number;
}

/** Where a generator put a patch and its surfs. */
export interface PatchPlacement {
  readonly patch: number;
  readonly surfStart: number;
  readonly surfCount: number;
}

function unit(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 1];
}

/** Adds the grid of one meridian run and the analytic pieces of its surface. */
export function addRevPatch(b: AtlasBuilder, o: RevPatchOptions): PatchPlacement {
  const patch = b.patches.length;
  const run = o.run;
  const rowCount = Math.max(1, Math.round(run.length / o.blockSize));
  const ds = run.length / rowCount;
  const [sx, sy] = o.scale;
  const stretch = 0.5 * (sx + sy);
  const rowStart = b.rowRegion.length;
  const cellStart = b.cellPatch.length;
  const pt = createMeridianPoint();

  const stretched = sx !== 1 || sy !== 1;
  const gauss = [createMeridianPoint(), createMeridianPoint(), createMeridianPoint()];
  for (let i = 0; i < rowCount; i++) {
    const sa = i * ds;
    const integral = meridianArea(run, sa + ds) - meridianArea(run, sa);
    meridianAt(run, sa + 0.5 * ds, pt);
    if (stretched)
      GAUSS_X.forEach((x, g) => meridianAt(run, sa + x * ds, gauss[g] as MeridianPoint));
    const want = (o.span * (integral / ds) * stretch) / o.blockSize;
    const cols = o.full
      ? Math.max(MIN_FULL_TURN_COLUMNS, Math.round(want))
      : Math.max(1, Math.round(want));
    const row = b.addRow(cols, o.region(pt.side, pt.mid));
    const dTheta = o.span / cols;
    for (let j = 0; j < cols; j++) {
      const th = o.theta0 + (j + 0.5) * dTheta;
      const c = Math.cos(th);
      const s = Math.sin(th);
      let area = integral * dTheta;
      if (stretched) {
        // A surface element of the round shell with unit normal n maps under the stretch to one
        // det(S) |S^-1 n| times as large: integrated over the cell by a 3 x 3 Gauss rule.
        area = 0;
        for (let g = 0; g < 3; g++) {
          const q = gauss[g] as MeridianPoint;
          for (let k = 0; k < 3; k++) {
            const a = o.theta0 + (j + (GAUSS_X[k] as number)) * dTheta;
            area +=
              (GAUSS_W[g] as number) *
              (GAUSS_W[k] as number) *
              q.r *
              sx *
              sy *
              Math.hypot((q.nr * Math.cos(a)) / sx, (q.nr * Math.sin(a)) / sy, q.nz);
          }
        }
        area *= ds * dTheta;
      }
      b.addCell(
        patch,
        row,
        j,
        affinePoint(o.toItem, pt.r * c, pt.r * s, pt.z),
        unit(affineTransposeVector(o.frame, pt.nr * c, pt.nr * s, pt.nz)),
        area,
        !o.full && (j === 0 || j === cols - 1),
      );
    }
  }

  // Links inside the patch.
  for (let i = 0; i < rowCount; i++) {
    const [first, cols] = b.rowCells(rowStart + i);
    // Along the row.
    for (let j = 0; j + 1 < cols; j++) b.link(first + j, first + j + 1, ds, LINK_KIND.patch);
    if (o.full && cols > 1) b.link(first + cols - 1, first, ds, LINK_KIND.patch);
    // To the next row (and from the last to the first on a closed meridian).
    const nextRow = i + 1 < rowCount ? i + 1 : run.periodic && rowCount > 1 ? 0 : -1;
    if (nextRow < 0) continue;
    meridianAt(run, (i + 1) * ds >= run.length ? 0 : (i + 1) * ds, pt);
    const edgeRadius = pt.r * stretch;
    if (!(edgeRadius > 0)) continue;
    const [nextFirst, nextCols] = b.rowCells(rowStart + nextRow);
    for (let a = 0; a < cols; a++) {
      const lo = Math.floor((a * nextCols) / cols);
      const hi = Math.min(nextCols - 1, Math.ceil(((a + 1) * nextCols) / cols) - 1);
      for (let c = lo; c <= hi; c++) {
        const overlap =
          Math.min((a + 1) / cols, (c + 1) / nextCols) - Math.max(a / cols, c / nextCols);
        if (overlap > 1e-12) {
          b.link(first + a, nextFirst + c, overlap * o.span * edgeRadius, LINK_KIND.patch);
        }
      }
    }
  }

  // One analytic piece per piece of the meridian.
  const surfStart = b.surfs.length;
  const count = run.pieces.length;
  run.pieces.forEach((p, k) => {
    const prev = k > 0 ? surfStart + k - 1 : run.periodic ? surfStart + count - 1 : NO_INDEX;
    const next = k + 1 < count ? surfStart + k + 1 : run.periodic ? surfStart : NO_INDEX;
    if (p.arc) {
      b.surfs.push({
        kind: SURF_KIND.revArc,
        frame: o.frame,
        params: [p.cr, p.cz, p.rho, p.th0],
        sBase: p.s0,
        sScale: p.rho,
        pMin: 0,
        pMax: p.th1 - p.th0,
        prev,
        next,
        patch,
        part: o.part,
      });
    } else {
      b.surfs.push({
        kind: SURF_KIND.revLine,
        frame: o.frame,
        params: [p.nr, p.nz, p.nr * p.r0 + p.nz * p.z0, p.r0, p.z0],
        sBase: p.s0,
        sScale: 1,
        pMin: 0,
        pMax: p.length,
        prev,
        next,
        patch,
        part: o.part,
      });
    }
  });

  b.patches.push({
    kind: PATCH_KIND.rev,
    line: false,
    part: o.part,
    frame: o.frame,
    toItem: o.toItem,
    rowStart,
    rowCount,
    a0: 0,
    da: ds,
    b0: o.theta0,
    db: o.full ? TWO_PI : o.span,
    periodicRows: run.periodic,
    periodicCols: o.full,
    run,
    scale: [sx, sy],
    radius: o.radius,
    length: 0,
    polygon: null,
    mask: null,
    porosity: o.porosity,
    cellStart,
    cellCount: b.cellPatch.length - cellStart,
  });
  return { patch, surfStart, surfCount: count };
}

/** What {@link addLinePatch} is given. */
export interface LinePatchOptions {
  readonly part: number;
  /** Item frame to the axis frame: the axis runs from z = 0 to z = `length`. */
  readonly frame: Affine;
  readonly toItem: Affine;
  readonly radius: number;
  /** Distance between the two centres of the capsule, metres (0 for a ball). */
  readonly length: number;
  /** Target length of a line element, metres. */
  readonly elementLength: number;
  readonly region: number;
  readonly porosity: number;
}

/**
 * Adds a thin capsule as line elements: one cell per row along the axis, each carrying the
 * whole circumference; the two hemispherical ends are added to the end elements. The centre of a
 * cell is on the axis. Its normal is set later, from the pose (the direction across the axis
 * that points most nearly upward); here it is the x axis of the axis frame.
 */
export function addLinePatch(b: AtlasBuilder, o: LinePatchOptions): PatchPlacement {
  const patch = b.patches.length;
  const rowCount = Math.max(1, Math.round(o.length / o.elementLength));
  const ds = o.length / rowCount;
  const rowStart = b.rowRegion.length;
  const cellStart = b.cellPatch.length;
  const across = unit(affineTransposeVector(o.frame, 1, 0, 0));
  const cap = TWO_PI * o.radius * o.radius;
  for (let i = 0; i < rowCount; i++) {
    const row = b.addRow(1, o.region);
    const area = TWO_PI * o.radius * ds + (i === 0 ? cap : 0) + (i === rowCount - 1 ? cap : 0);
    b.addCell(
      patch,
      row,
      0,
      affinePoint(o.toItem, 0, 0, (i + 0.5) * ds),
      across,
      area,
      i === 0 || i === rowCount - 1,
    );
    if (i > 0) b.link(cellStart + i - 1, cellStart + i, TWO_PI * o.radius, LINK_KIND.patch);
  }
  const surfStart = b.surfs.length;
  b.surfs.push({
    kind: SURF_KIND.capsule,
    frame: o.frame,
    params: [o.radius, o.length],
    sBase: 0,
    sScale: 1,
    pMin: 0,
    pMax: o.length,
    prev: NO_INDEX,
    next: NO_INDEX,
    patch,
    part: o.part,
  });
  b.patches.push({
    kind: PATCH_KIND.rev,
    line: true,
    part: o.part,
    frame: o.frame,
    toItem: o.toItem,
    rowStart,
    rowCount,
    a0: 0,
    // A ball has no length: any positive step puts every hit in its one row.
    da: ds > 0 ? ds : 1,
    b0: 0,
    db: TWO_PI,
    periodicRows: false,
    periodicCols: true,
    run: null,
    scale: [1, 1],
    radius: o.radius,
    length: o.length,
    polygon: null,
    mask: null,
    porosity: o.porosity,
    cellStart,
    cellCount: rowCount,
  });
  return { patch, surfStart, surfCount: 1 };
}
