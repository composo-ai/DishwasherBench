/**
 * Meridians of bodies of revolution as runs of straight lines and circular arcs in the (r, z)
 * half-plane, parametrised by arc length (docs/design/sim-core.md section 3.2).
 *
 * A run is the stretch of a closed section boundary between two points on the axis (two poles),
 * or the whole boundary when it never touches the axis (then it is periodic). Runs come from the
 * exact cross-section of a shell of revolution (`buildSection` of `@spotless/geometry`) or are
 * written down for a capsule. Travelling along a run the solid is on the left and the outward
 * normal on the right.
 *
 * Everything a surface grid needs follows in closed form: the point and normal at an arc length,
 * and the integral of r along the run, which by Pappus gives the exact area of any band.
 *
 * Units: metres and radians.
 */

import type { SectionLoop, SectionPiece, SorSection } from '@spotless/geometry';

/** A point with |r| below this is on the axis, metres. */
export const MERIDIAN_AXIS_TOLERANCE = 1e-9;

/** Side of the mid-surface a piece lies on: 0 out, 1 in, 2 neither (a capsule has no sides). */
export type MeridianSide = 0 | 1 | 2;

/** One straight or circular piece of a run. */
export interface MeridianPiece {
  /** True for a circular arc, false for a straight line. */
  readonly arc: boolean;
  /** Start and end point, metres. */
  readonly r0: number;
  readonly z0: number;
  readonly r1: number;
  readonly z1: number;
  /** Line: the outward unit normal. Arc: unused (0). */
  readonly nr: number;
  readonly nz: number;
  /** Arc: centre, radius and the start and end angle (from +r towards +z, `th1 > th0`). */
  readonly cr: number;
  readonly cz: number;
  readonly rho: number;
  readonly th0: number;
  readonly th1: number;
  /** Length in the meridian plane, metres. */
  readonly length: number;
  /** Arc length of the start of the piece from the start of the run, metres. */
  readonly s0: number;
  /** The integral of r ds from the start of the run to the start of the piece, m2. */
  readonly area0: number;
  /** Side of the mid-surface. */
  readonly side: MeridianSide;
  /** Normalised mid-surface arc length at the start and at the end (NaN when it has none). */
  readonly mid0: number;
  readonly mid1: number;
}

/** A run of pieces, head to tail. */
export interface MeridianRun {
  readonly pieces: readonly MeridianPiece[];
  /** Total length, metres. */
  readonly length: number;
  /** The integral of r ds over the whole run, m2: 2 pi times it is the area of a full turn. */
  readonly area: number;
  /** True when the run closes on itself without touching the axis. */
  readonly periodic: boolean;
}

/** What {@link meridianAt} reports. */
export interface MeridianPoint {
  r: number;
  z: number;
  /** Outward unit normal in the meridian plane. */
  nr: number;
  nz: number;
  /** Index of the piece. */
  piece: number;
  /** Side of the mid-surface. */
  side: MeridianSide;
  /** Normalised mid-surface arc length (NaN when it has none). */
  mid: number;
}

/** A piece before its place in a run is known. */
export interface MeridianPieceInput {
  readonly arc: boolean;
  readonly r0: number;
  readonly z0: number;
  readonly r1: number;
  readonly z1: number;
  readonly cr: number;
  readonly cz: number;
  readonly rho: number;
  readonly th0: number;
  readonly th1: number;
  readonly side: MeridianSide;
  readonly mid0: number;
  readonly mid1: number;
}

/** A straight piece from (r0, z0) to (r1, z1). */
export function meridianLine(
  r0: number,
  z0: number,
  r1: number,
  z1: number,
  side: MeridianSide = 2,
  mid0 = Number.NaN,
  mid1 = Number.NaN,
): MeridianPieceInput {
  return { arc: false, r0, z0, r1, z1, cr: 0, cz: 0, rho: 0, th0: 0, th1: 0, side, mid0, mid1 };
}

/** A counter-clockwise arc about (cr, cz) from angle th0 to th1. */
export function meridianArc(
  cr: number,
  cz: number,
  rho: number,
  th0: number,
  th1: number,
  side: MeridianSide = 2,
  mid = Number.NaN,
): MeridianPieceInput {
  return {
    arc: true,
    r0: cr + rho * Math.cos(th0),
    z0: cz + rho * Math.sin(th0),
    r1: cr + rho * Math.cos(th1),
    z1: cz + rho * Math.sin(th1),
    cr,
    cz,
    rho,
    th0,
    th1,
    side,
    mid0: mid,
    mid1: mid,
  };
}

/** The integral of r ds over the first `u` metres of a piece, m2. */
function pieceArea(p: MeridianPiece | MeridianPieceInput, length: number, u: number): number {
  if (p.arc) {
    const th = p.th0 + u / p.rho;
    return p.rho * (p.cr * (th - p.th0) + p.rho * (Math.sin(th) - Math.sin(p.th0)));
  }
  if (!(length > 0)) return 0;
  return p.r0 * u + ((p.r1 - p.r0) * u * u) / (2 * length);
}

/** Assembles a run from its pieces, in order. Pieces of no length are dropped. */
export function meridianRun(inputs: readonly MeridianPieceInput[], periodic: boolean): MeridianRun {
  const pieces: MeridianPiece[] = [];
  let s = 0;
  let area = 0;
  for (const p of inputs) {
    const length = p.arc ? p.rho * (p.th1 - p.th0) : Math.hypot(p.r1 - p.r0, p.z1 - p.z0);
    if (!(length > 1e-12)) continue;
    const nr = p.arc ? 0 : (p.z1 - p.z0) / length;
    const nz = p.arc ? 0 : -(p.r1 - p.r0) / length;
    pieces.push({ ...p, nr, nz, length, s0: s, area0: area });
    area += pieceArea(p, length, length);
    s += length;
  }
  return { pieces, length: s, area, periodic };
}

function convertPiece(p: SectionPiece): MeridianPieceInput {
  const side: MeridianSide = p.side === 'in' ? 1 : 0;
  if (p.kind === 'line') return meridianLine(p.r0, p.z0, p.r1, p.z1, side, p.s0, p.s1);
  return meridianArc(p.cr, p.cz, p.rho, p.th0, p.th1, side, p.s0);
}

/** The runs of one closed loop of a cross-section: split wherever the boundary meets the axis. */
export function runsOfLoop(loop: SectionLoop): MeridianRun[] {
  const n = loop.pieces.length;
  const inputs = loop.pieces.map(convertPiece);
  // Junction j lies between piece j and piece j + 1 (cyclically); it is a pole when on the axis.
  const breaks: number[] = [];
  for (let j = 0; j < n; j++) {
    if (Math.abs((inputs[j] as MeridianPieceInput).r1) <= MERIDIAN_AXIS_TOLERANCE) breaks.push(j);
  }
  if (breaks.length === 0) return [meridianRun(inputs, true)];
  const runs: MeridianRun[] = [];
  for (let b = 0; b < breaks.length; b++) {
    const from = ((breaks[b] as number) + 1) % n;
    const to = breaks[(b + 1) % breaks.length] as number;
    const list: MeridianPieceInput[] = [];
    for (let k = from; ; k = (k + 1) % n) {
      list.push(inputs[k] as MeridianPieceInput);
      if (k === to) break;
    }
    const run = meridianRun(list, false);
    if (run.length > 0) runs.push(run);
  }
  return runs;
}

/** Every run of the cross-section of a shell of revolution, in the order of its loops. */
export function runsOfSection(section: SorSection): MeridianRun[] {
  return section.loops.flatMap(runsOfLoop);
}

/**
 * The meridian of a capsule of the given radius whose axis runs from z = 0 to z = `length`: a
 * quarter circle, a straight line and a quarter circle, from pole to pole. A sphere
 * (`length` 0) is the two quarter circles.
 */
export function capsuleRun(radius: number, length: number): MeridianRun {
  return meridianRun(
    [
      meridianArc(0, 0, radius, -Math.PI / 2, 0),
      meridianLine(radius, 0, radius, length),
      meridianArc(0, length, radius, 0, Math.PI / 2),
    ],
    false,
  );
}

/** Index of the piece that holds arc length `s` (clamped to the run). */
export function meridianPieceAt(run: MeridianRun, s: number): number {
  const pieces = run.pieces;
  let lo = 0;
  let hi = pieces.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((pieces[mid] as MeridianPiece).s0 <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Point, outward normal, side and mid-surface arc length at arc length `s` of a run. */
export function meridianAt(run: MeridianRun, s: number, out: MeridianPoint): MeridianPoint {
  const index = meridianPieceAt(run, s);
  const p = run.pieces[index] as MeridianPiece;
  const u = Math.min(Math.max(s - p.s0, 0), p.length);
  const f = u / p.length;
  if (p.arc) {
    const th = p.th0 + u / p.rho;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    out.r = p.cr + p.rho * c;
    out.z = p.cz + p.rho * sn;
    out.nr = c;
    out.nz = sn;
  } else {
    out.r = p.r0 + f * (p.r1 - p.r0);
    out.z = p.z0 + f * (p.z1 - p.z0);
    out.nr = p.nr;
    out.nz = p.nz;
  }
  if (out.r < 0) out.r = 0;
  out.piece = index;
  out.side = p.side;
  out.mid = p.mid0 + f * (p.mid1 - p.mid0);
  return out;
}

/** The integral of r ds from the start of a run to arc length `s`, m2. */
export function meridianArea(run: MeridianRun, s: number): number {
  if (s <= 0) return 0;
  if (s >= run.length) return run.area;
  const p = run.pieces[meridianPieceAt(run, s)] as MeridianPiece;
  return p.area0 + pieceArea(p, p.length, Math.min(Math.max(s - p.s0, 0), p.length));
}

/** A fresh {@link MeridianPoint}. */
export function createMeridianPoint(): MeridianPoint {
  return { r: 0, z: 0, nr: 0, nz: 0, piece: 0, side: 2, mid: Number.NaN };
}

/**
 * Area of the planar region the loops of a cross-section enclose, m2, by Green's theorem (the
 * boundary integral of r dz; stretches along the axis contribute nothing). This is the area of
 * each flat end face of a partial shell.
 */
export function sectionArea(section: SorSection): number {
  let sum = 0;
  for (const loop of section.loops) {
    for (const p of loop.pieces) {
      if (p.kind === 'line') {
        sum += 0.5 * (p.r0 + p.r1) * (p.z1 - p.z0);
      } else {
        sum +=
          p.rho * p.cr * (Math.sin(p.th1) - Math.sin(p.th0)) +
          p.rho *
            p.rho *
            (0.5 * (p.th1 - p.th0) + 0.25 * (Math.sin(2 * p.th1) - Math.sin(2 * p.th0)));
      }
    }
  }
  return sum;
}
