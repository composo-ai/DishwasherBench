/**
 * From a point on the surface of a part to its cell and block, in closed form and without a ray
 * (docs/design/sim-core.md section 3.6, "from a hit to elements"): the map the tracers apply to
 * a corrected hit, written against the atlas of one shape so that it can also be used on its
 * own, for the contact links of the scene and for the tests of the tracers.
 *
 * Also here: the two functions that say where a point of a meridian plane lies on a piece of a
 * meridian (how far off it, how far along it), shared with the classification of triangles.
 *
 * Units: metres, radians. Frame: the item frame of the shape.
 */

import { affinePoint, affineTransposeVector, affineVector } from './affine.ts';
import { NO_INDEX, PATCH_KIND, type AtlasPatch } from './atlas-core.ts';
import type { PartGeometry, ShapeAtlasBuilt } from './atlas.ts';
import type { MeridianPiece, MeridianRun } from './meridian.ts';

const TWO_PI = 2 * Math.PI;

/** Angle of a meridian point from the start of an arc piece, unwrapped about the arc, radians. */
function arcAngle(p: MeridianPiece, r: number, z: number): number {
  const width = p.th1 - p.th0;
  let da = (Math.atan2(z - p.cz, r - p.cr) - p.th0) % TWO_PI;
  if (da < 0) da += TWO_PI;
  if (da > width + 0.5 * (TWO_PI - width)) da -= TWO_PI;
  return da;
}

/**
 * How far a meridian point with unit normal (mr, mz) is from a piece, metres: its distance from
 * the line or circle, how far it lies beyond the ends of the piece, and a small penalty for a
 * normal that disagrees (which separates two pieces that meet in a crease). A normal of zero
 * length carries no penalty (a point on the axis has no surface normal of its own).
 */
export function pieceMisfit(
  p: MeridianPiece,
  r: number,
  z: number,
  mr: number,
  mz: number,
): number {
  const known = mr !== 0 || mz !== 0;
  if (p.arc) {
    const dr = r - p.cr;
    const dz = z - p.cz;
    const q = Math.hypot(dr, dz);
    const da = arcAngle(p, r, z);
    const excess = p.rho * Math.max(0, -da, da - (p.th1 - p.th0));
    const agree = known && q > 0 ? (mr * dr + mz * dz) / q : 1;
    return Math.abs(q - p.rho) + excess + 1e-3 * (1 - agree);
  }
  const f = p.nr * (r - p.r0) + p.nz * (z - p.z0);
  const u = (r - p.r0) * -p.nz + (z - p.z0) * p.nr;
  const excess = Math.max(0, -u, u - p.length);
  return Math.abs(f) + excess + (known ? 1e-3 * (1 - (mr * p.nr + mz * p.nz)) : 0);
}

/** Arc length along the run of the foot of a meridian point on a piece (clamped to the piece). */
export function pieceArcLength(p: MeridianPiece, r: number, z: number): number {
  if (p.arc) {
    return p.s0 + p.rho * Math.min(p.th1 - p.th0, Math.max(0, arcAngle(p, r, z)));
  }
  const u = (r - p.r0) * -p.nz + (z - p.z0) * p.nr;
  return p.s0 + Math.min(p.length, Math.max(0, u));
}

/** Where a surface point lies on an atlas. */
export interface AtlasLocation {
  readonly patch: number;
  readonly cell: number;
  /** The block that stands for the cell, or {@link NO_INDEX}. */
  readonly block: number;
  /** Fractions of the way across the cell along its row axis and its column axis, 0 to 1. */
  readonly fa: number;
  readonly fb: number;
}

/**
 * The cell of a patch that holds the patch coordinates (a, b): arc length and azimuth on a
 * `rev` patch, (v, u) on a `cart` patch. Coordinates outside the grid are clamped to it.
 */
export function atlasCellAt(
  atlas: ShapeAtlasBuilt,
  patchIndex: number,
  a: number,
  b: number,
): AtlasLocation {
  const patch = atlas.patches[patchIndex] as AtlasPatch;
  const ra = (a - patch.a0) / patch.da;
  const row = Math.min(patch.rowCount - 1, Math.max(0, Math.floor(ra)));
  const first = atlas.rows[2 * (patch.rowStart + row)] as number;
  const cols = atlas.rows[2 * (patch.rowStart + row) + 1] as number;
  let cb: number;
  if (patch.kind === PATCH_KIND.rev) {
    let turn = (b - patch.b0) / TWO_PI;
    turn -= Math.floor(turn);
    const span = patch.db / TWO_PI;
    // Outside the window of a partial shell: the nearer end.
    const f = turn <= span ? turn / span : turn - span < 0.5 * (1 - span) ? 1 : 0;
    cb = f * cols;
  } else {
    cb = (b - patch.b0) / patch.db;
  }
  const col = Math.min(cols - 1, Math.max(0, Math.floor(cb)));
  const cell = first + col;
  return {
    patch: patchIndex,
    cell,
    block: atlas.cellBlock[cell] as number,
    fa: Math.min(1, Math.max(0, ra - row)),
    fb: Math.min(1, Math.max(0, cb - col)),
  };
}

function bestPiece(
  runs: readonly { readonly patch: number; readonly run: MeridianRun }[],
  r: number,
  z: number,
  mr: number,
  mz: number,
): { patch: number; s: number } | null {
  let best: { patch: number; s: number } | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const { patch, run } of runs) {
    for (const piece of run.pieces) {
      const score = pieceMisfit(piece, r, z, mr, mz);
      if (score < bestScore) {
        bestScore = score;
        best = { patch, s: pieceArcLength(piece, r, z) };
      }
    }
  }
  return best;
}

/**
 * The cell of the atlas that holds a point on the surface of part `part`. `p` is the point and
 * `n` the outward unit normal of the surface there, both in the item frame; the normal tells the
 * two faces of a thin wall apart and picks the face a rounded edge belongs to. Returns null for
 * a part the atlas does not represent.
 */
export function locateOnPart(
  atlas: ShapeAtlasBuilt,
  part: number,
  p: readonly number[],
  n: readonly number[],
): AtlasLocation | null {
  const g = atlas.partGeometry[part] as PartGeometry;
  const px = p[0] as number;
  const py = p[1] as number;
  const pz = p[2] as number;
  const nx = n[0] as number;
  const ny = n[1] as number;
  const nz = n[2] as number;
  if (g.kind === 'none') return null;
  if (g.kind === 'line') {
    const patch = atlas.patches[g.place.patch] as AtlasPatch;
    const q = affinePoint(patch.frame, px, py, pz);
    return atlasCellAt(
      atlas,
      g.place.patch,
      Math.min(patch.length, Math.max(0, q[2])),
      Math.atan2(q[1], q[0]),
    );
  }
  if (g.kind === 'capsule') {
    const patch = atlas.patches[g.place.patch] as AtlasPatch;
    const q = affinePoint(g.frame, px, py, pz);
    const m = affineVector(g.frame, nx, ny, nz);
    const r = Math.hypot(q[0], q[1]);
    const mr = r > 1e-9 ? (m[0] * q[0] + m[1] * q[1]) / r : 0;
    const found = bestPiece(
      [{ patch: g.place.patch, run: patch.run as MeridianRun }],
      r,
      q[2],
      mr,
      m[2],
    );
    return found === null ? null : atlasCellAt(atlas, found.patch, found.s, Math.atan2(q[1], q[0]));
  }
  if (g.kind === 'sor') {
    const q = affinePoint(g.frame, px, py, pz);
    // The gradient in the unscaled frame is the transpose of the stretch applied to the normal.
    const gu = affineTransposeVector(g.toItem, nx, ny, nz);
    const len = Math.hypot(gu[0], gu[1], gu[2]) || 1;
    const r = Math.hypot(q[0], q[1]);
    // On the axis there is no radial direction: a surface normal there is along the axis, and a
    // normal across it belongs to a flat end face.
    const radial = r > 1e-9 ? (gu[0] * q[0] + gu[1] * q[1]) / (r * len) : 0;
    const axial = gu[2] / len;
    const inPlane = Math.hypot(radial, axial);
    if (g.arc !== null && inPlane < 1e-3) {
      // A flat end face.
      const phi = Math.atan2(q[1], q[0]);
      const off = (a: number): number => {
        let d = (phi - a) % TWO_PI;
        if (d > Math.PI) d -= TWO_PI;
        if (d < -Math.PI) d += TWO_PI;
        return Math.abs(d);
      };
      const end = off(g.arc.phi0) <= off(g.arc.phi1) ? 0 : 1;
      const patchIndex = g.arc.endPatch[end];
      const uv = affinePoint((atlas.patches[patchIndex] as AtlasPatch).frame, px, py, pz);
      return atlasCellAt(atlas, patchIndex, uv[1], uv[0]);
    }
    const found = bestPiece(
      g.runs.map(({ place, run }) => ({ patch: place.patch, run })),
      r,
      q[2],
      radial / (inPlane || 1),
      axial / (inPlane || 1),
    );
    return found === null ? null : atlasCellAt(atlas, found.patch, found.s, Math.atan2(q[1], q[0]));
  }
  // A rounded polytope: the face the normal points along most nearly.
  const m = affineVector(g.itemToPart, nx, ny, nz);
  let face = 0;
  let bestDot = Number.NEGATIVE_INFINITY;
  g.core.faces.forEach((f, index) => {
    const d = m[0] * f.normal[0] + m[1] * f.normal[1] + m[2] * f.normal[2];
    if (d > bestDot) {
      bestDot = d;
      face = index;
    }
  });
  const patchIndex = g.place.facePatch[face] as number;
  const uv = affinePoint((atlas.patches[patchIndex] as AtlasPatch).frame, px, py, pz);
  return atlasCellAt(atlas, patchIndex, uv[1], uv[0]);
}
