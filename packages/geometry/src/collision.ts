/**
 * Collision pieces of a shape (docs/design/platform.md section 4.2, docs/research/items.md
 * section 5.3).
 *
 *  - capsule -> capsule; rbox -> box with a convex radius; hull -> rounded hull (a hull of
 *    coincident or collinear points is a sphere or a capsule and is emitted as a capsule).
 *  - sor -> rounded convex quads. For profile ring k and sector j of N the mid-surface point is
 *    `P(k, j) = (r_k cos(phi_j), r_k sin(phi_j), z_k)` with `phi_j = 2 pi j / N`; the quad
 *    `{P(k, j), P(k, j+1), P(k+1, j+1), P(k+1, j)}` is a planar isosceles trapezoid (a triangle
 *    where the profile touches the axis) and gets a convex radius of half the wall thickness, so
 *    the union has the true wall thickness and a rounded rim. `N` is the platform rule,
 *    `max(minSectors, ceil(pi / acos(1 - chordError / R)))`, with R the largest mid-surface
 *    radius; a partial shell gets `ceil(N * span / 2 pi)` sectors over its span. A flat stretch
 *    that reaches the axis (the floor of a plate, a glass or a pot) is convex as a whole and is
 *    one piece, the rounded N-gon of its outer ring: the same solid as its N sectors, in one
 *    piece instead of N, so that two stacked plates meet in one pair of floors instead of in
 *    every pair of overlapping sectors.
 *
 * Accuracy of the sor pieces against the exact solid:
 *  - Around the axis the facets are inscribed: the surface of the union is within the sagitta
 *    `R (1 - cos(pi / N)) <= chordError` of the true surface, inside the solid on convex faces
 *    and proud of it on concave ones.
 *  - Along a profile segment of constant thickness the pieces are exact. A piece has one radius,
 *    so a segment whose thickness varies is cut into rows (see {@link sorCollisionLayout}), each
 *    with the half thickness at its middle: the wall is reproduced within `chordError / 2`
 *    ({@link COLLISION_TAPER_FRACTION}). In such a segment the two errors add, to at most
 *    `1.5 * chordError`.
 *  - A stretched shell (`scaleXY`) uses the stretched mid-surface and, per piece, the half
 *    thickness measured along the stretched wall normal. The wall is right to first order; the
 *    rim is rounded with a circle instead of the stretched ellipse, an error of up to
 *    `t / 2 * |s - 1|`.
 *  - The pieces at the two ends of a partial shell are rounded like every other piece, so they
 *    reach up to `t / 2` beyond the flat end faces of the exact solid. Box shells rely on this
 *    overlap to join their corner fillets to their walls.
 *
 *  - A full, unstretched shell also gets its round rolling surfaces (`round` pieces, see
 *    {@link roundSurfacesOf}): one-sided surfaces of revolution on the outer side of the wall,
 *    which add nothing to the solid described by the other pieces.
 *
 * Every piece is expressed in the item frame, carries the id and the material of its part, and
 * the order of the result is deterministic (parts in shape order; for a shell: profile segments
 * from the axis outwards, then rows, then sectors by increasing azimuth, then the round
 * surfaces in the order of the cross-section boundary).
 *
 * Units: metres.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { poseTransformPoint } from '@spotless/core';
import { resolveTessellation } from './mesh.ts';
import { preparePrimitive, sectorCount, type PreparedSor } from './prepared.ts';
import { shapeRegionRules } from './regions.ts';
import { SEGMENT_STRIDE } from './sor-section.ts';
import { ROUND_SURFACE_DEFICIT } from './types.ts';
import type {
  CollisionPiece,
  CollisionRound,
  CollisionSolid,
  Part,
  Shape,
  SorPrimitive,
  SorProfilePoint,
  TessellationOptions,
} from './types.ts';

/**
 * Share of the chord error allowed for replacing a wall of varying thickness by rows of constant
 * thickness.
 */
export const COLLISION_TAPER_FRACTION = 0.5;

const TWO_PI = 2 * Math.PI;
/** A mid-surface point closer to the axis than this is on it, metres. */
const AXIS_TOLERANCE = 1e-9;

/** How one profile segment of a shell is cut into rows of collision pieces. */
export interface SorCollisionRow {
  /** Index of the profile segment. */
  readonly segment: number;
  /** Mid-surface end points of the row in the meridian plane, metres. */
  readonly r0: number;
  readonly z0: number;
  readonly r1: number;
  readonly z1: number;
  /** Convex radius of the pieces of the row before any stretch correction, metres. */
  readonly radius: number;
}

/** The layout of the collision pieces of a shell of revolution. */
export interface SorCollisionLayout {
  /** Sectors per full turn (the platform rule). */
  readonly sectorsPerTurn: number;
  /** Sectors actually generated: `sectorsPerTurn`, or fewer for a partial shell. */
  readonly sectors: number;
  /** Rows from the axis end to the rim end. */
  readonly rows: readonly SorCollisionRow[];
  /**
   * Number of solid pieces: one per row and sector, but one for a row on the axis (a capsule)
   * and one for a flat row that reaches the axis (a disc).
   */
  readonly pieces: number;
}

/** A row on the axis: a single capsule. */
function rowIsAxial(row: SorCollisionRow): boolean {
  return row.r0 <= AXIS_TOLERANCE && row.r1 <= AXIS_TOLERANCE;
}

/**
 * A flat row with one end on the axis: a disc (or, for a partial shell of at most half a turn,
 * a sector of one), which is convex and emitted as one piece.
 */
function rowIsDisc(row: SorCollisionRow, span: number): boolean {
  const axis0 = row.r0 <= AXIS_TOLERANCE;
  const axis1 = row.r1 <= AXIS_TOLERANCE;
  return axis0 !== axis1 && row.z0 === row.z1 && (span >= TWO_PI || span <= Math.PI);
}

function layoutOf(prep: PreparedSor, options: Required<TessellationOptions>): SorCollisionLayout {
  const profile = prep.profile;
  const stretch = Math.max(prep.sx, prep.sy);
  const sectorsPerTurn = sectorCount(
    profile.rMax * stretch,
    options.chordError,
    options.minSectors,
  );
  const sectors =
    prep.arc === null
      ? sectorsPerTurn
      : Math.max(1, Math.ceil((sectorsPerTurn * (prep.arc.phi1 - prep.arc.phi0)) / TWO_PI - 1e-9));
  const tolerance = COLLISION_TAPER_FRACTION * options.chordError;
  const rows: SorCollisionRow[] = [];
  for (let i = 0; i < profile.segmentCount; i++) {
    const a = profile.points[i] as SorProfilePoint;
    const b = profile.points[i + 1] as SorProfilePoint;
    const rhoA = a.t / 2;
    const rhoB = b.t / 2;
    const length = profile.data[i * SEGMENT_STRIDE + 4] as number;
    if (!(length > 0)) {
      // The thicker end disc contains the thinner one: the solid is a torus about the thick end.
      const big = rhoA >= rhoB ? a : b;
      rows.push({ segment: i, r0: big.r, z0: big.z, r1: big.r, z1: big.z, radius: big.t / 2 });
      continue;
    }
    // The solid of the segment is the union of the balls of radius rho(s) centred on it; a row
    // is the union of balls of one radius on its stretch. Two such unions whose radii differ by
    // at most d are within d of each other, so rows whose radius is within the tolerance of
    // rho(s) all along them reproduce the wall within the tolerance.
    const count = Math.max(1, Math.ceil(Math.abs(rhoB - rhoA) / (2 * tolerance) - 1e-9));
    for (let q = 0; q < count; q++) {
      const l0 = q / count;
      const l1 = (q + 1) / count;
      const radius =
        count === 1 && rhoA === rhoB ? rhoA : rhoA + ((q + 0.5) / count) * (rhoB - rhoA);
      rows.push({
        segment: i,
        r0: a.r + l0 * (b.r - a.r),
        z0: a.z + l0 * (b.z - a.z),
        r1: q + 1 === count ? b.r : a.r + l1 * (b.r - a.r),
        z1: q + 1 === count ? b.z : a.z + l1 * (b.z - a.z),
        radius,
      });
    }
  }
  const span = prep.arc === null ? TWO_PI : prep.arc.phi1 - prep.arc.phi0;
  let pieces = 0;
  for (const row of rows) pieces += rowIsAxial(row) || rowIsDisc(row, span) ? 1 : sectors;
  return { sectorsPerTurn, sectors, rows, pieces };
}

/**
 * The sector count and the rows `buildCollisionPieces` uses for a shell of revolution. Every row
 * yields one piece per sector, except a row that lies on the axis, which yields a single
 * capsule, and a flat row that reaches the axis, which yields a single disc.
 * A segment of constant thickness is one row; a segment whose half thickness changes by `d` is
 * `ceil(d / (2 * COLLISION_TAPER_FRACTION * chordError))` rows of equal length.
 */
export function sorCollisionLayout(
  prim: SorPrimitive,
  options: TessellationOptions,
): SorCollisionLayout {
  const prep = preparePrimitive(prim);
  if (prep.kind !== 'sor') throw new RangeError('geometry: not a sor primitive');
  return layoutOf(prep, resolveTessellation(options));
}

function sorPieces(
  out: CollisionPiece[],
  part: Part,
  prep: PreparedSor,
  options: Required<TessellationOptions>,
): void {
  const layout = layoutOf(prep, options);
  const { sx, sy } = prep;
  const phi0 = prep.arc?.phi0 ?? 0;
  const span = prep.arc === null ? TWO_PI : prep.arc.phi1 - prep.arc.phi0;
  const full = prep.arc === null;
  const cosines: number[] = [];
  const sines: number[] = [];
  for (let j = 0; j <= layout.sectors; j++) {
    // The last direction of a full turn is the first one again, exactly.
    const phi = full && j === layout.sectors ? phi0 : phi0 + (span * j) / layout.sectors;
    cosines.push(Math.cos(phi));
    sines.push(Math.sin(phi));
  }
  const at = (r: number, z: number, j: number): Vec3 =>
    poseTransformPoint(part.pose, [
      sx * r * (cosines[j] as number),
      sy * r * (sines[j] as number),
      z,
    ]);
  const base = { part: part.id, material: part.material };
  for (const row of layout.rows) {
    const axis0 = row.r0 <= AXIS_TOLERANCE;
    const axis1 = row.r1 <= AXIS_TOLERANCE;
    if (axis0 && axis1) {
      // A stretch of wall along the axis: one capsule (a sphere if it has no length).
      out.push({
        ...base,
        kind: 'capsule',
        a: at(0, row.z0, 0),
        b: at(0, row.z1, 0),
        radius: row.radius,
      });
      continue;
    }
    if (rowIsDisc(row, span)) {
      // A flat floor out to the ring of the row: the hull of the ring (with the axis point for
      // a partial shell). Its wall normal is along the axis, which a stretch leaves alone.
      const r = Math.max(row.r0, row.r1);
      const points: Vec3[] = [];
      if (!full) points.push(at(0, row.z0, 0));
      for (let j = 0; j < (full ? layout.sectors : layout.sectors + 1); j++) {
        points.push(at(r, row.z0, j));
      }
      out.push({ ...base, kind: 'hull', points, radius: row.radius });
      continue;
    }
    // Meridian normal of the row (left normal of its direction), for the stretch correction.
    const dr = row.r1 - row.r0;
    const dz = row.z1 - row.z0;
    const len = Math.hypot(dr, dz);
    const nr = len > 0 ? -dz / len : 1;
    const nz = len > 0 ? dr / len : 0;
    for (let j = 0; j < layout.sectors; j++) {
      let radius = row.radius;
      if (sx !== 1 || sy !== 1) {
        // Half thickness along the normal of the stretched wall: rho / |A^-1 n|.
        const mid = phi0 + (span * (j + 0.5)) / layout.sectors;
        radius /= Math.hypot((nr * Math.cos(mid)) / sx, (nr * Math.sin(mid)) / sy, nz);
      }
      const points: Vec3[] = [];
      if (axis0) points.push(at(0, row.z0, j));
      else points.push(at(row.r0, row.z0, j), at(row.r0, row.z0, j + 1));
      if (len > 0) {
        if (axis1) points.push(at(0, row.z1, j));
        else points.push(at(row.r1, row.z1, j + 1), at(row.r1, row.z1, j));
      }
      if (points.length === 2) {
        // A row without length off the axis: a ring of capsules.
        out.push({ ...base, kind: 'capsule', a: points[0] as Vec3, b: points[1] as Vec3, radius });
      } else {
        out.push({ ...base, kind: 'hull', points, radius });
      }
    }
  }
}

/**
 * Smallest radial component of the outward normal for which a stretch of the outer surface gets
 * a round rolling surface: 0.5, a surface within 60 degrees of facing straight away from the
 * axis. Flatter cones (the underside of a plate's rim, the bottom of a bowl) are what an item
 * stands or lies flat on, not what it rolls on, and stay facets.
 */
export const ROUND_SURFACE_MIN_RADIAL = 0.5;
/** Largest turn of the surface normal across one chord of a rim or round join, radians. */
export const ROUND_SURFACE_MAX_TURN = Math.PI / 4;
/** Shortest round surface along the axis, metres; shorter stretches are left to the facets. */
export const ROUND_SURFACE_MIN_HEIGHT = 0.00005;
/** Thinnest wall that gets round surfaces, metres. */
export const ROUND_SURFACE_MIN_WALL = 0.0003;

/**
 * The round rolling surfaces of a shell of revolution (see `CollisionRound`), from the exact
 * boundary of its meridian cross-section: every straight stretch of the boundary whose outward
 * normal has a radial component of at least {@link ROUND_SURFACE_MIN_RADIAL} becomes one
 * surface (a cylinder or a cone frustum, exactly on the true surface), and every such stretch
 * of a rim or round join is followed by chords that stay within `ROUND_SURFACE_DEFICIT` of it
 * and turn by at most {@link ROUND_SURFACE_MAX_TURN} each. Stretched and partial shells have no
 * surface of revolution and get none; nor do walls thinner than {@link ROUND_SURFACE_MIN_WALL}.
 * `a` is always the end at the lower height of the part frame.
 */
export function roundSurfacesOf(part: Part): CollisionRound[] {
  const prep = preparePrimitive(part.prim);
  const out: CollisionRound[] = [];
  if (prep.kind !== 'sor' || prep.arc !== null || prep.sx !== 1 || prep.sy !== 1) return out;
  const points = prep.profile.points;
  const emit = (r0: number, z0: number, r1: number, z1: number, wall: number): void => {
    if (!(wall >= ROUND_SURFACE_MIN_WALL)) return;
    const [ra, za, rb, zb] = z0 <= z1 ? [r0, z0, r1, z1] : [r1, z1, r0, z0];
    if (!(zb - za >= ROUND_SURFACE_MIN_HEIGHT) || !(ra >= 0) || !(rb >= 0)) return;
    out.push({
      part: part.id,
      material: part.material,
      kind: 'round',
      a: poseTransformPoint(part.pose, [0, 0, za]),
      b: poseTransformPoint(part.pose, [0, 0, zb]),
      radiusA: ra,
      radiusB: rb,
      wallThickness: wall,
    });
  };
  const reach = Math.acos(ROUND_SURFACE_MIN_RADIAL);
  for (const loop of prep.section().loops) {
    for (const piece of loop.pieces) {
      if (piece.kind === 'line') {
        if (piece.nr < ROUND_SURFACE_MIN_RADIAL) continue;
        const wall = Math.min(
          (points[piece.segment] as SorProfilePoint).t,
          (points[piece.segment + 1] as SorProfilePoint).t,
        );
        emit(piece.r0, piece.z0, piece.r1, piece.z1, wall);
        continue;
      }
      // The outward normal of an arc at the angle th is (cos th, sin th): keep the part of it
      // within `reach` of the radial direction, whichever turn of the angle it is on.
      if (!(piece.rho > 0)) continue;
      const first = Math.floor((piece.th0 + reach) / TWO_PI);
      const last = Math.ceil((piece.th1 - reach) / TWO_PI);
      for (let turn = first; turn <= last; turn++) {
        const lo = Math.max(piece.th0, turn * TWO_PI - reach);
        const hi = Math.min(piece.th1, turn * TWO_PI + reach);
        if (!(hi > lo)) continue;
        // A chord over the angle 2h lies rho (1 - cos h) inside the arc.
        const half = Math.min(
          ROUND_SURFACE_MAX_TURN / 2,
          Math.acos(Math.max(0, 1 - ROUND_SURFACE_DEFICIT / piece.rho)),
        );
        const chords = Math.max(1, Math.ceil((hi - lo) / (2 * half) - 1e-9));
        for (let k = 0; k < chords; k++) {
          const t0 = lo + ((hi - lo) * k) / chords;
          const t1 = lo + ((hi - lo) * (k + 1)) / chords;
          emit(
            piece.cr + piece.rho * Math.cos(t0),
            piece.cz + piece.rho * Math.sin(t0),
            piece.cr + piece.rho * Math.cos(t1),
            piece.cz + piece.rho * Math.sin(t1),
            2 * piece.rho,
          );
        }
      }
    }
  }
  return out;
}

/**
 * The pieces that make up the solid: every piece but the round rolling surfaces, which are
 * one-sided surfaces on top of it. For consumers that measure volume, distance or overlap.
 */
export function collisionSolids(pieces: readonly CollisionPiece[]): CollisionSolid[] {
  const out: CollisionSolid[] = [];
  for (const piece of pieces) if (piece.kind !== 'round') out.push(piece);
  return out;
}

/**
 * `buildCollisionPieces(shape, { chordError })`: the convex pieces whose union is the collision
 * geometry of the shape, in the item frame, and the round rolling surfaces of its shells of
 * revolution. See the module comment for the mapping, the accuracy and the order.
 */
export function buildCollisionPieces(shape: Shape, options: TessellationOptions): CollisionPiece[] {
  shapeRegionRules(shape); // validates the shape
  const resolved = resolveTessellation(options);
  const out: CollisionPiece[] = [];
  for (const part of shape.parts) {
    const prep = preparePrimitive(part.prim);
    const base = { part: part.id, material: part.material };
    const pose: Pose = part.pose;
    switch (prep.kind) {
      case 'sor':
        sorPieces(out, part, prep, resolved);
        if (resolved.roundSurfaces) for (const round of roundSurfacesOf(part)) out.push(round);
        break;
      case 'capsule':
        out.push({
          ...base,
          kind: 'capsule',
          a: poseTransformPoint(pose, prep.a),
          b: poseTransformPoint(pose, prep.b),
          radius: prep.radius,
        });
        break;
      case 'rbox':
        out.push({
          ...base,
          kind: 'box',
          halfExtents: prep.halfExtents,
          radius: prep.radius,
          pose,
        });
        break;
      case 'hull': {
        const core = prep.core;
        if (core.dim === 0) {
          const c = poseTransformPoint(pose, core.centre);
          out.push({ ...base, kind: 'capsule', a: c, b: c, radius: prep.radius });
        } else if (core.dim === 1) {
          out.push({
            ...base,
            kind: 'capsule',
            a: poseTransformPoint(pose, core.a),
            b: poseTransformPoint(pose, core.b),
            radius: prep.radius,
          });
        } else {
          out.push({
            ...base,
            kind: 'hull',
            points: core.vertices.map((v) => poseTransformPoint(pose, v)),
            radius: prep.radius,
          });
        }
        break;
      }
    }
  }
  return out;
}
