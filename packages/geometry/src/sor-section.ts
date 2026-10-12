/**
 * Meridian cross-section of a shell of revolution, in the (r, z) half-plane of its part frame.
 *
 * The solid of a `'sor'` primitive is the union of all balls of radius `t / 2` centred on the
 * revolved mid-surface, with `t` interpolated linearly along each profile segment. In the
 * meridian half-plane that is a chain of "tapered capsules": the union of the discs of radius
 * `t(s) / 2` centred on the points of one profile segment (the convex hull of its two end discs).
 * With constant thickness this is exactly "all points within t / 2 of the polyline".
 *
 * This module provides, for that planar region:
 *  - the signed distance (exact outside; inside, a lower bound on the depth, exact unless the
 *    nearest surface point belongs to a concave crease);
 *  - the exact boundary as straight lines and circular arcs, clipped to r >= 0 and chained into
 *    closed counter-clockwise loops, each piece tagged with its side of the mid-surface and its
 *    normalised mid-surface arc length;
 *  - closed-form integrals over the region (Green's theorem) from which the volume, centre of
 *    mass, inertia and surface area of the revolved solid follow.
 *
 * Units: metres and radians. `r` is the distance from the axis, `z` the height along it.
 */

import type { SorProfilePoint } from './types.ts';

/** Number of float64 values stored per profile segment in {@link PreparedProfile.data}. */
export const SEGMENT_STRIDE = 9;

/** Two boundary end points closer than this are the same point, metres. */
export const SECTION_JOIN_TOLERANCE = 1e-8;
/** Boundary pieces shorter than this are dropped, metres. */
const MIN_PIECE_LENGTH = 1e-10;
/** A boundary piece deeper than this inside another capsule is not on the boundary, metres. */
const INSIDE_TOLERANCE = 1e-12;
/** A point with |r| below this is on the axis, metres. */
const AXIS_TOLERANCE = 1e-9;
/** Shortest profile segment accepted, metres. */
export const MIN_SEGMENT_LENGTH = 1e-9;

const TWO_PI = 2 * Math.PI;

/**
 * A profile prepared for fast evaluation. `data` holds, per segment, the values
 * `[ar, az, ur, uz, length, rhoA, k, kt, s0]`: start point (metres), unit direction, length
 * (metres), half thickness at the start (metres), slope `k` of the half thickness along the
 * segment (dimensionless), `kt = k / sqrt(1 - k^2)` and the mid-surface arc length at the start
 * (metres). A segment whose thicker end disc contains its thinner one (`|k| >= 1`) is stored as a
 * zero-length segment at the thicker end.
 */
export interface PreparedProfile {
  /** The profile vertices as given (metres). */
  readonly points: readonly SorProfilePoint[];
  /** Packed segment data, {@link SEGMENT_STRIDE} values per segment. */
  readonly data: Float64Array;
  /** Number of segments (`points.length - 1`). */
  readonly segmentCount: number;
  /** Mid-surface arc length at each profile vertex, metres. */
  readonly vertexS: Float64Array;
  /** Total mid-surface arc length, metres. */
  readonly totalLength: number;
  /** Largest mid-surface radius, metres. */
  readonly rMax: number;
  /** Largest half thickness, metres. */
  readonly rhoMax: number;
}

/**
 * Checks a profile and prepares it for evaluation. Throws a RangeError (a programmer or data
 * error, never a player error) when the profile has fewer than two vertices, a non-finite value,
 * a negative radius, a thickness that is not positive, or two consecutive coincident vertices.
 */
export function prepareProfile(points: readonly SorProfilePoint[]): PreparedProfile {
  if (points.length < 2) {
    throw new RangeError('geometry: a sor profile needs at least two vertices');
  }
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as SorProfilePoint;
    if (!Number.isFinite(p.r) || !Number.isFinite(p.z) || !Number.isFinite(p.t)) {
      throw new RangeError(`geometry: sor profile vertex ${i} is not finite`);
    }
    if (p.r < 0) throw new RangeError(`geometry: sor profile vertex ${i} has a negative radius`);
    if (!(p.t > 0)) {
      throw new RangeError(`geometry: sor profile vertex ${i} needs a thickness above zero`);
    }
  }
  const n = points.length - 1;
  const data = new Float64Array(n * SEGMENT_STRIDE);
  const vertexS = new Float64Array(points.length);
  let s = 0;
  let rMax = 0;
  let rhoMax = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i] as SorProfilePoint;
    const b = points[i + 1] as SorProfilePoint;
    const dr = b.r - a.r;
    const dz = b.z - a.z;
    const length = Math.hypot(dr, dz);
    if (!(length >= MIN_SEGMENT_LENGTH)) {
      throw new RangeError(`geometry: sor profile vertices ${i} and ${i + 1} coincide`);
    }
    const rhoA = a.t / 2;
    const rhoB = b.t / 2;
    const k = (rhoB - rhoA) / length;
    const o = i * SEGMENT_STRIDE;
    data[o + 2] = dr / length;
    data[o + 3] = dz / length;
    if (Math.abs(k) < 1) {
      data[o] = a.r;
      data[o + 1] = a.z;
      data[o + 4] = length;
      data[o + 5] = rhoA;
      data[o + 6] = k;
      data[o + 7] = k / Math.sqrt(1 - k * k);
      data[o + 8] = s;
    } else {
      // One end disc contains the other: the capsule is just the larger disc.
      const big = k > 0 ? b : a;
      data[o] = big.r;
      data[o + 1] = big.z;
      data[o + 4] = 0;
      data[o + 5] = big.t / 2;
      data[o + 6] = 0;
      data[o + 7] = 0;
      data[o + 8] = k > 0 ? s + length : s;
    }
    vertexS[i] = s;
    s += length;
    rMax = Math.max(rMax, a.r, b.r);
    rhoMax = Math.max(rhoMax, rhoA, rhoB);
  }
  vertexS[n] = s;
  return { points, data, segmentCount: n, vertexS, totalLength: s, rMax, rhoMax };
}

/**
 * Signed distance from the point `(qr, qz)` of a meridian plane, lifted `sqrt(h2)` out of that
 * plane, to the planar region of the profile (metres; negative inside). With `h2 = 0` this is
 * the in-plane distance. `qr` may be negative (a point beyond the axis in the same plane).
 */
export function profileDistance(
  profile: PreparedProfile,
  qr: number,
  qz: number,
  h2: number,
): number {
  const d = profile.data;
  let best = Number.POSITIVE_INFINITY;
  for (let o = 0; o < d.length; o += SEGMENT_STRIDE) {
    const dx = qr - (d[o] as number);
    const dz = qz - (d[o + 1] as number);
    const ur = d[o + 2] as number;
    const uz = d[o + 3] as number;
    const x = dx * ur + dz * uz;
    const cross = dx * uz - dz * ur;
    const y2 = cross * cross + h2;
    let s = x + (d[o + 7] as number) * Math.sqrt(y2);
    const length = d[o + 4] as number;
    if (s < 0) s = 0;
    else if (s > length) s = length;
    const ex = x - s;
    const v = Math.sqrt(ex * ex + y2) - ((d[o + 5] as number) + (d[o + 6] as number) * s);
    if (v < best) best = v;
  }
  return best;
}

/** Result of {@link profileClosest}; reused between calls to avoid allocation. */
export interface ProfileHit {
  /** Signed distance, metres. */
  value: number;
  /** Index of the segment holding the centre of the nearest ball. */
  segment: number;
  /** Position of that centre along the segment, metres from its start. */
  along: number;
  /** The centre itself, in the meridian plane (metres). */
  cr: number;
  cz: number;
}

/** Creates an empty {@link ProfileHit}. */
export function createProfileHit(): ProfileHit {
  return { value: Number.POSITIVE_INFINITY, segment: 0, along: 0, cr: 0, cz: 0 };
}

/**
 * As {@link profileDistance}, also reporting the centre of the ball that realises the distance
 * (the foot of the distance on the mid-surface, in the weighted sense that accounts for the
 * thickness gradient).
 */
export function profileClosest(
  profile: PreparedProfile,
  qr: number,
  qz: number,
  h2: number,
  out: ProfileHit,
): ProfileHit {
  const d = profile.data;
  let best = Number.POSITIVE_INFINITY;
  let bestO = 0;
  let bestS = 0;
  for (let o = 0; o < d.length; o += SEGMENT_STRIDE) {
    const dx = qr - (d[o] as number);
    const dz = qz - (d[o + 1] as number);
    const ur = d[o + 2] as number;
    const uz = d[o + 3] as number;
    const x = dx * ur + dz * uz;
    const cross = dx * uz - dz * ur;
    const y2 = cross * cross + h2;
    let s = x + (d[o + 7] as number) * Math.sqrt(y2);
    const length = d[o + 4] as number;
    if (s < 0) s = 0;
    else if (s > length) s = length;
    const ex = x - s;
    const v = Math.sqrt(ex * ex + y2) - ((d[o + 5] as number) + (d[o + 6] as number) * s);
    if (v < best) {
      best = v;
      bestO = o;
      bestS = s;
    }
  }
  out.value = best;
  out.segment = bestO / SEGMENT_STRIDE;
  out.along = bestS;
  out.cr = (d[bestO] as number) + bestS * (d[bestO + 2] as number);
  out.cz = (d[bestO + 1] as number) + bestS * (d[bestO + 3] as number);
  return out;
}

/**
 * Normalised mid-surface arc length (0 at the axis end, 1 at the rim end) of the centre reported
 * by a {@link ProfileHit}.
 */
export function hitArcLength(profile: PreparedProfile, hit: ProfileHit): number {
  const o = hit.segment * SEGMENT_STRIDE;
  const length = profile.data[o + 4] as number;
  // A collapsed segment (see PreparedProfile) stores the arc length of its thicker end.
  const s = (profile.data[o + 8] as number) + (length > 0 ? hit.along : 0);
  return s / profile.totalLength;
}

/** Value of the capsule of one segment at a point of the meridian plane (metres). */
function segmentValue(d: Float64Array, o: number, qr: number, qz: number): number {
  const dx = qr - (d[o] as number);
  const dz = qz - (d[o + 1] as number);
  const ur = d[o + 2] as number;
  const uz = d[o + 3] as number;
  const x = dx * ur + dz * uz;
  const y = Math.abs(dx * uz - dz * ur);
  let s = x + (d[o + 7] as number) * y;
  const length = d[o + 4] as number;
  if (s < 0) s = 0;
  else if (s > length) s = length;
  return Math.hypot(x - s, y) - ((d[o + 5] as number) + (d[o + 6] as number) * s);
}

// ---------------------------------------------------------------------------------------------
// Boundary
// ---------------------------------------------------------------------------------------------

/**
 * Side of the mid-surface a boundary piece lies on: `'in'` is the side of the profile's left
 * normal when walking from the axis end to the rim end (the food side of a plate or bowl).
 */
export type SectionSide = 'in' | 'out';

/** A straight piece of the section boundary (a cone or a flat annulus once revolved). */
export interface SectionLine {
  readonly kind: 'line';
  /** Start and end in the direction of travel (solid on the left), metres. */
  readonly r0: number;
  readonly z0: number;
  readonly r1: number;
  readonly z1: number;
  /** Outward unit normal in the (r, z) plane. */
  readonly nr: number;
  readonly nz: number;
  readonly side: SectionSide;
  /** Normalised mid-surface arc length at the start and at the end. */
  readonly s0: number;
  readonly s1: number;
  /** Index of the profile segment the piece belongs to. */
  readonly segment: number;
}

/** A circular piece of the section boundary (a torus patch once revolved): a rim or a round join. */
export interface SectionArc {
  readonly kind: 'arc';
  /** Centre (a profile vertex) and radius, metres. */
  readonly cr: number;
  readonly cz: number;
  readonly rho: number;
  /** Start and end angle, radians from +r towards +z; `th1 > th0` (counter-clockwise). */
  readonly th0: number;
  readonly th1: number;
  readonly side: SectionSide;
  /** Normalised mid-surface arc length of the vertex (the same at both ends). */
  readonly s0: number;
  readonly s1: number;
  /** Index of the profile vertex the arc is centred on. */
  readonly vertex: number;
}

/** One piece of the section boundary. */
export type SectionPiece = SectionLine | SectionArc;

/**
 * A closed boundary loop: pieces head to tail with the solid on the left (counter-clockwise for
 * the outer boundary, clockwise for the boundary of an enclosed void). Where one piece ends on
 * the axis (r = 0) and the next starts on it at a different height, the loop runs along the axis
 * between them; that stretch bounds no surface.
 */
export interface SectionLoop {
  readonly pieces: readonly SectionPiece[];
}

/** The exact cross-section of a shell of revolution in its meridian half-plane. */
export interface SorSection {
  readonly profile: PreparedProfile;
  readonly loops: readonly SectionLoop[];
  /** Largest radius reached by the boundary, metres. */
  readonly rMax: number;
  /** Lowest and highest boundary points, metres. */
  readonly zMin: number;
  readonly zMax: number;
}

/** Start point of a piece. */
export function pieceStart(p: SectionPiece): [number, number] {
  return p.kind === 'line'
    ? [p.r0, p.z0]
    : [p.cr + p.rho * Math.cos(p.th0), p.cz + p.rho * Math.sin(p.th0)];
}

/** End point of a piece. */
export function pieceEnd(p: SectionPiece): [number, number] {
  return p.kind === 'line'
    ? [p.r1, p.z1]
    : [p.cr + p.rho * Math.cos(p.th1), p.cz + p.rho * Math.sin(p.th1)];
}

/** Length of a piece in the meridian plane, metres. */
export function pieceLength(p: SectionPiece): number {
  return p.kind === 'line' ? Math.hypot(p.r1 - p.r0, p.z1 - p.z0) : p.rho * (p.th1 - p.th0);
}

interface Curve {
  readonly line: boolean;
  // Line: start and end in the direction of travel.
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly segment: number;
  readonly left: boolean;
  // Circle.
  readonly cx: number;
  readonly cy: number;
  readonly rho: number;
  readonly vertex: number;
  readonly splits: number[];
}

function normaliseAngle(a: number): number {
  let x = a % TWO_PI;
  if (x < 0) x += TWO_PI;
  return x >= TWO_PI ? 0 : x;
}

function addLineSplit(c: Curve, lambda: number): void {
  if (lambda > -1e-12 && lambda < 1 + 1e-12) c.splits.push(Math.min(1, Math.max(0, lambda)));
}

function addCircleSplit(c: Curve, x: number, y: number): void {
  c.splits.push(normaliseAngle(Math.atan2(y - c.cy, x - c.cx)));
}

function intersectLineLine(a: Curve, b: Curve): void {
  const d1x = a.x1 - a.x0;
  const d1y = a.y1 - a.y0;
  const d2x = b.x1 - b.x0;
  const d2y = b.y1 - b.y0;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) <= 1e-14 * Math.hypot(d1x, d1y) * Math.hypot(d2x, d2y)) return;
  const wx = b.x0 - a.x0;
  const wy = b.y0 - a.y0;
  const lambda = (wx * d2y - wy * d2x) / denom;
  const mu = (wx * d1y - wy * d1x) / denom;
  if (lambda < -1e-12 || lambda > 1 + 1e-12 || mu < -1e-12 || mu > 1 + 1e-12) return;
  addLineSplit(a, lambda);
  addLineSplit(b, mu);
}

function intersectLineCircle(l: Curve, c: Curve): void {
  const dx = l.x1 - l.x0;
  const dy = l.y1 - l.y0;
  const fx = l.x0 - c.cx;
  const fy = l.y0 - c.cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - c.rho * c.rho;
  const disc = b * b - 4 * a * cc;
  if (!(disc >= 0)) return;
  const sq = Math.sqrt(disc);
  for (const lambda of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
    if (lambda < -1e-12 || lambda > 1 + 1e-12) continue;
    addLineSplit(l, lambda);
    addCircleSplit(c, l.x0 + lambda * dx, l.y0 + lambda * dy);
  }
}

function intersectCircleCircle(a: Curve, b: Curve): void {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const d = Math.hypot(dx, dy);
  if (d < 1e-15 || d > a.rho + b.rho || d < Math.abs(a.rho - b.rho)) return;
  const along = (d * d + a.rho * a.rho - b.rho * b.rho) / (2 * d);
  const h = Math.sqrt(Math.max(0, a.rho * a.rho - along * along));
  const bx = a.cx + (along * dx) / d;
  const by = a.cy + (along * dy) / d;
  for (const sign of [-1, 1]) {
    const x = bx - (sign * h * dy) / d;
    const y = by + (sign * h * dx) / d;
    addCircleSplit(a, x, y);
    addCircleSplit(b, x, y);
  }
}

interface RawPiece {
  piece: SectionPiece;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
}

/**
 * Builds the exact boundary of the meridian cross-section of a profile. Throws an Error when the
 * boundary pieces cannot be chained into closed loops, which only happens for degenerate input
 * (for example two stretches of wall whose surfaces coincide exactly).
 */
export function buildSection(profile: PreparedProfile): SorSection {
  const d = profile.data;
  const points = profile.points;
  const nSeg = profile.segmentCount;
  const total = profile.totalLength;
  const curves: Curve[] = [];
  const noLine = { x0: 0, y0: 0, x1: 0, y1: 0, segment: -1, left: false };
  const noCircle = { cx: 0, cy: 0, rho: 0, vertex: -1 };
  // Per segment: unit normals of the two tangent lines (left then right), or null if collapsed.
  const tangents: ([number, number, number, number] | null)[] = [];

  for (let i = 0; i < nSeg; i++) {
    const o = i * SEGMENT_STRIDE;
    const length = d[o + 4] as number;
    if (!(length > 0)) {
      tangents.push(null);
      continue;
    }
    const a = points[i] as SorProfilePoint;
    const b = points[i + 1] as SorProfilePoint;
    const ur = d[o + 2] as number;
    const uz = d[o + 3] as number;
    const k = d[o + 6] as number;
    const cb = Math.sqrt(1 - k * k);
    // Left normal of the direction of travel is (-uz, ur).
    const mlr = -k * ur - cb * uz;
    const mlz = -k * uz + cb * ur;
    const mrr = -k * ur + cb * uz;
    const mrz = -k * uz - cb * ur;
    tangents.push([mlr, mlz, mrr, mrz]);
    const rhoA = a.t / 2;
    const rhoB = b.t / 2;
    // Right-hand tangent line, travelled from the axis end to the rim end.
    curves.push({
      ...noCircle,
      line: true,
      x0: a.r + rhoA * mrr,
      y0: a.z + rhoA * mrz,
      x1: b.r + rhoB * mrr,
      y1: b.z + rhoB * mrz,
      segment: i,
      left: false,
      splits: [],
    });
    // Left-hand tangent line, travelled back from the rim end to the axis end.
    curves.push({
      ...noCircle,
      line: true,
      x0: b.r + rhoB * mlr,
      y0: b.z + rhoB * mlz,
      x1: a.r + rhoA * mlr,
      y1: a.z + rhoA * mlz,
      segment: i,
      left: true,
      splits: [],
    });
  }
  for (let v = 0; v < points.length; v++) {
    const p = points[v] as SorProfilePoint;
    const circle: Curve = {
      ...noLine,
      line: false,
      cx: p.r,
      cy: p.z,
      rho: p.t / 2,
      vertex: v,
      splits: [],
    };
    // Tangent points of the lines of the two adjacent segments.
    for (const seg of [v - 1, v]) {
      const t = seg >= 0 && seg < nSeg ? tangents[seg] : undefined;
      if (t === undefined || t === null) continue;
      circle.splits.push(normaliseAngle(Math.atan2(t[1], t[0])));
      circle.splits.push(normaliseAngle(Math.atan2(t[3], t[2])));
    }
    // The apex of an end cap separates its 'in' half from its 'out' half.
    if (v === 0 && tangents[0] !== null && tangents[0] !== undefined) {
      circle.splits.push(normaliseAngle(Math.atan2(-(d[3] as number), -(d[2] as number))));
    }
    if (v === nSeg && tangents[nSeg - 1] !== null && tangents[nSeg - 1] !== undefined) {
      const o = (nSeg - 1) * SEGMENT_STRIDE;
      circle.splits.push(normaliseAngle(Math.atan2(d[o + 3] as number, d[o + 2] as number)));
    }
    curves.push(circle);
  }

  // Pairwise intersections.
  for (let i = 0; i < curves.length; i++) {
    const a = curves[i] as Curve;
    for (let j = i + 1; j < curves.length; j++) {
      const b = curves[j] as Curve;
      if (a.line && b.line) {
        if (a.segment !== b.segment) intersectLineLine(a, b);
      } else if (a.line && !b.line) {
        // A line only touches the circles at its own two ends.
        if (b.vertex !== a.segment && b.vertex !== a.segment + 1) intersectLineCircle(a, b);
      } else if (!a.line && !b.line) {
        intersectCircleCircle(a, b);
      }
    }
  }
  // Crossings of the axis.
  for (const c of curves) {
    if (c.line) {
      if (c.x0 > 0 !== c.x1 > 0) addLineSplit(c, c.x0 / (c.x0 - c.x1));
    } else if (Math.abs(c.cx) < c.rho) {
      const th = Math.acos(-c.cx / c.rho);
      c.splits.push(normaliseAngle(th), normaliseAngle(-th));
    }
  }

  const insideOther = (x: number, y: number, skipA: number, skipB: number): boolean => {
    for (let s = 0; s < nSeg; s++) {
      if (s === skipA || s === skipB) continue;
      if (segmentValue(d, s * SEGMENT_STRIDE, x, y) < -INSIDE_TOLERANCE) return true;
    }
    return false;
  };

  const raw: RawPiece[] = [];
  for (let ci = 0; ci < curves.length; ci++) {
    const c = curves[ci] as Curve;
    if (c.line) {
      const cuts = [0, 1, ...c.splits].sort((p, q) => p - q);
      const o = c.segment * SEGMENT_STRIDE;
      const segLength = d[o + 4] as number;
      const segS0 = d[o + 8] as number;
      const dx = c.x1 - c.x0;
      const dy = c.y1 - c.y0;
      const len = Math.hypot(dx, dy);
      // Outward normal: to the right of the direction of travel.
      const nr = dy / len;
      const nz = -dx / len;
      for (let q = 0; q + 1 < cuts.length; q++) {
        const l0 = cuts[q] as number;
        const l1 = cuts[q + 1] as number;
        if ((l1 - l0) * len < MIN_PIECE_LENGTH) continue;
        const lm = 0.5 * (l0 + l1);
        const mx = c.x0 + lm * dx;
        const my = c.y0 + lm * dy;
        if (mx <= AXIS_TOLERANCE) continue;
        if (insideOther(mx, my, c.segment, -1)) continue;
        const sAt = (l: number): number => (segS0 + (c.left ? 1 - l : l) * segLength) / total;
        const piece: SectionLine = {
          kind: 'line',
          r0: c.x0 + l0 * dx,
          z0: c.y0 + l0 * dy,
          r1: c.x0 + l1 * dx,
          z1: c.y0 + l1 * dy,
          nr,
          nz,
          side: c.left ? 'in' : 'out',
          s0: sAt(l0),
          s1: sAt(l1),
          segment: c.segment,
        };
        raw.push({ piece, sx: piece.r0, sy: piece.z0, ex: piece.r1, ey: piece.z1 });
      }
      continue;
    }
    const v = c.vertex;
    const sorted = [...c.splits].sort((p, q) => p - q);
    const cuts: number[] = [];
    for (const a of sorted) {
      if (cuts.length === 0 || a - (cuts[cuts.length - 1] as number) > 1e-13) cuts.push(a);
    }
    if (cuts.length === 0) cuts.push(0);
    cuts.push((cuts[0] as number) + TWO_PI);
    const before = v - 1 >= 0 ? tangents[v - 1] : undefined;
    const after = v < nSeg ? tangents[v] : undefined;
    for (let q = 0; q + 1 < cuts.length; q++) {
      const t0 = cuts[q] as number;
      const t1 = cuts[q + 1] as number;
      if ((t1 - t0) * c.rho < MIN_PIECE_LENGTH) continue;
      const tm = 0.5 * (t0 + t1);
      const dr = Math.cos(tm);
      const dz = Math.sin(tm);
      const mx = c.cx + c.rho * dr;
      const my = c.cy + c.rho * dz;
      if (mx <= AXIS_TOLERANCE) continue;
      // Inside the capsule that ends here unless beyond its tangent points.
      let skipA = -1;
      let skipB = -1;
      if (before !== undefined && before !== null) {
        const o = (v - 1) * SEGMENT_STRIDE;
        if (dr * (d[o + 2] as number) + dz * (d[o + 3] as number) < -(d[o + 6] as number)) continue;
        skipA = v - 1;
      }
      if (after !== undefined && after !== null) {
        const o = v * SEGMENT_STRIDE;
        if (dr * (d[o + 2] as number) + dz * (d[o + 3] as number) > -(d[o + 6] as number)) continue;
        skipB = v;
      }
      if (insideOther(mx, my, skipA, skipB)) continue;
      // Side: by the left normals of the adjacent segments.
      let nlr = 0;
      let nlz = 0;
      for (const seg of [v - 1, v]) {
        if (seg < 0 || seg >= nSeg) continue;
        nlr += -(d[seg * SEGMENT_STRIDE + 3] as number);
        nlz += d[seg * SEGMENT_STRIDE + 2] as number;
      }
      let left = dr * nlr + dz * nlz > 0;
      if (v > 0 && v < nSeg && Math.hypot(nlr, nlz) < 0.5) {
        // Nearly a U-turn: the round join is on the outside of the turn.
        const o0 = (v - 1) * SEGMENT_STRIDE;
        const o1 = v * SEGMENT_STRIDE;
        const turn =
          (d[o0 + 2] as number) * (d[o1 + 3] as number) -
          (d[o0 + 3] as number) * (d[o1 + 2] as number);
        left = turn < 0;
      }
      const s = (profile.vertexS[v] as number) / total;
      const piece: SectionArc = {
        kind: 'arc',
        cr: c.cx,
        cz: c.cy,
        rho: c.rho,
        th0: t0,
        th1: t1,
        side: left ? 'in' : 'out',
        s0: s,
        s1: s,
        vertex: v,
      };
      const [sx, sy] = pieceStart(piece);
      const [ex, ey] = pieceEnd(piece);
      raw.push({ piece, sx, sy, ex, ey });
    }
  }

  // Chain the pieces into closed loops.
  const used = new Array<boolean>(raw.length).fill(false);
  const loops: SectionLoop[] = [];
  const fail = (why: string): never => {
    throw new Error(`geometry: cannot build the cross-section of a sor profile (${why})`);
  };
  for (let first = 0; first < raw.length; first++) {
    if (used[first]) continue;
    const pieces: SectionPiece[] = [];
    let cur = first;
    for (let guard = 0; guard <= raw.length; guard++) {
      used[cur] = true;
      const here = raw[cur] as RawPiece;
      pieces.push(here.piece);
      const onAxis = Math.abs(here.ex) <= AXIS_TOLERANCE;
      let next = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let j = 0; j < raw.length; j++) {
        const cand = raw[j] as RawPiece;
        if (used[j] && j !== first) continue;
        let score: number;
        if (onAxis) {
          if (Math.abs(cand.sx) > AXIS_TOLERANCE) continue;
          // Along the axis the loop runs downwards to the next start.
          score = here.ey - cand.sy;
          if (score < -SECTION_JOIN_TOLERANCE) continue;
        } else {
          score = Math.hypot(cand.sx - here.ex, cand.sy - here.ey);
          if (score > SECTION_JOIN_TOLERANCE) continue;
        }
        if (score < bestScore) {
          bestScore = score;
          next = j;
        }
      }
      if (next < 0) fail('open boundary');
      if (next === first) break;
      cur = next;
      if (guard === raw.length) fail('boundary does not close');
    }
    loops.push({ pieces });
  }
  if (loops.length === 0) fail('empty boundary');

  let rMax = 0;
  let zMin = Number.POSITIVE_INFINITY;
  let zMax = Number.NEGATIVE_INFINITY;
  for (const loop of loops) {
    for (const p of loop.pieces) {
      const e = pieceExtent(p);
      rMax = Math.max(rMax, e.rMax);
      zMin = Math.min(zMin, e.zMin);
      zMax = Math.max(zMax, e.zMax);
    }
  }
  return { profile, loops, rMax, zMin, zMax };
}

/** Extent of one boundary piece in the meridian plane. */
export function pieceExtent(p: SectionPiece): {
  rMin: number;
  rMax: number;
  zMin: number;
  zMax: number;
} {
  if (p.kind === 'line') {
    return {
      rMin: Math.min(p.r0, p.r1),
      rMax: Math.max(p.r0, p.r1),
      zMin: Math.min(p.z0, p.z1),
      zMax: Math.max(p.z0, p.z1),
    };
  }
  const support = (dr: number, dz: number): number => pieceSupport(p, dr, dz);
  return {
    rMin: -support(-1, 0),
    rMax: support(1, 0),
    zMin: -support(0, -1),
    zMax: support(0, 1),
  };
}

/**
 * Largest value of `dr * r + dz * z` over a boundary piece (its support function in the
 * meridian plane). The direction need not be unit length.
 */
export function pieceSupport(p: SectionPiece, dr: number, dz: number): number {
  if (p.kind === 'line') return Math.max(dr * p.r0 + dz * p.z0, dr * p.r1 + dz * p.z1);
  const len = Math.hypot(dr, dz);
  let best = Math.max(
    dr * (p.cr + p.rho * Math.cos(p.th0)) + dz * (p.cz + p.rho * Math.sin(p.th0)),
    dr * (p.cr + p.rho * Math.cos(p.th1)) + dz * (p.cz + p.rho * Math.sin(p.th1)),
  );
  if (len > 0) {
    // The extreme point of the full circle counts when its angle lies within the arc.
    let a = Math.atan2(dz, dr);
    while (a < p.th0) a += TWO_PI;
    if (a <= p.th1) best = Math.max(best, dr * p.cr + dz * p.cz + p.rho * len);
  }
  return best;
}

/**
 * Splits the line pieces of a section wherever their normalised mid-surface arc length crosses
 * one of `cuts`, so that every resulting piece lies within one interval between consecutive
 * cuts. Used to make surface-region boundaries coincide with piece boundaries.
 */
export function splitLoopAtArcLengths(loop: SectionLoop, cuts: readonly number[]): SectionLoop {
  if (cuts.length === 0) return loop;
  const pieces: SectionPiece[] = [];
  for (const p of loop.pieces) {
    if (p.kind !== 'line' || p.s0 === p.s1) {
      pieces.push(p);
      continue;
    }
    const lambdas: number[] = [];
    for (const c of cuts) {
      const l = (c - p.s0) / (p.s1 - p.s0);
      if (l > 1e-9 && l < 1 - 1e-9) lambdas.push(l);
    }
    if (lambdas.length === 0) {
      pieces.push(p);
      continue;
    }
    lambdas.sort((a, b) => a - b);
    let l0 = 0;
    let r0 = p.r0;
    let z0 = p.z0;
    let s0 = p.s0;
    for (const l of [...lambdas, 1]) {
      if (l - l0 < 1e-9) continue;
      const last = l === 1;
      const r1 = last ? p.r1 : p.r0 + l * (p.r1 - p.r0);
      const z1 = last ? p.z1 : p.z0 + l * (p.z1 - p.z0);
      const s1 = last ? p.s1 : p.s0 + l * (p.s1 - p.s0);
      pieces.push({ ...p, r0, z0, r1, z1, s0, s1 });
      l0 = l;
      r0 = r1;
      z0 = z1;
      s0 = s1;
    }
  }
  return { pieces };
}

// ---------------------------------------------------------------------------------------------
// Integrals over the region
// ---------------------------------------------------------------------------------------------

/** Antiderivative of `sin^n(theta)` for n = 0, 1, 2. */
function sinPowerIntegral(n: number, theta: number): number {
  if (n === 0) return theta;
  if (n === 1) return -Math.cos(theta);
  return 0.5 * theta - 0.5 * Math.sin(theta) * Math.cos(theta);
}

/** Antiderivative of `cos^m(theta) sin^n(theta)` for m >= 0 and n in {0, 1, 2}. */
function trigIntegral(m: number, n: number, theta: number): number {
  if (m === 0) return sinPowerIntegral(n, theta);
  const s = Math.sin(theta);
  if (m === 1) return s ** (n + 1) / (n + 1);
  const c = Math.cos(theta);
  return (
    (c ** (m - 1) * s ** (n + 1)) / (m + n) + ((m - 1) / (m + n)) * trigIntegral(m - 2, n, theta)
  );
}

const BINOMIAL: readonly (readonly number[])[] = [
  [1],
  [1, 1],
  [1, 2, 1],
  [1, 3, 3, 1],
  [1, 4, 6, 4, 1],
];

// Three-point Gauss-Legendre rule on [0, 1]: exact for polynomials up to degree 5.
const GAUSS3_X: readonly number[] = [0.5 - Math.sqrt(0.15), 0.5, 0.5 + Math.sqrt(0.15)];
const GAUSS3_W: readonly number[] = [5 / 18, 8 / 18, 5 / 18];

/**
 * The integral of `r^a z^b` over the planar region bounded by the loops (m^(a+b+2)), for
 * `a` in 0..3 and `b` in 0..2 with `a + b <= 3`. Computed in closed form by Green's theorem:
 * the integral equals the boundary integral of `r^(a+1) z^b / (a+1) dz`, to which the stretches
 * along the axis contribute nothing.
 */
export function sectionMoment(loops: readonly SectionLoop[], a: number, b: number): number {
  let sum = 0;
  for (const loop of loops) {
    for (const p of loop.pieces) {
      if (p.kind === 'line') {
        const dr = p.r1 - p.r0;
        const dz = p.z1 - p.z0;
        if (dz === 0) continue;
        let acc = 0;
        for (let g = 0; g < 3; g++) {
          const l = GAUSS3_X[g] as number;
          const r = p.r0 + l * dr;
          const z = p.z0 + l * dz;
          acc += (GAUSS3_W[g] as number) * r ** (a + 1) * z ** b;
        }
        sum += (acc * dz) / (a + 1);
      } else {
        // r = cr + rho cos(theta), z = cz + rho sin(theta), dz = rho cos(theta) dtheta.
        let acc = 0;
        const bi = BINOMIAL[a + 1] as readonly number[];
        const bj = BINOMIAL[b] as readonly number[];
        for (let i = 0; i <= a + 1; i++) {
          for (let j = 0; j <= b; j++) {
            const coeff =
              (bi[i] as number) *
              (bj[j] as number) *
              p.cr ** (a + 1 - i) *
              p.cz ** (b - j) *
              p.rho ** (i + j + 1);
            if (coeff === 0) continue;
            acc += coeff * (trigIntegral(i + 1, j, p.th1) - trigIntegral(i + 1, j, p.th0));
          }
        }
        sum += acc / (a + 1);
      }
    }
  }
  return sum;
}

/**
 * The integral of `r` along one boundary piece (m^2): `2 pi` times it is the area the piece
 * sweeps in a full turn (Pappus).
 */
export function pieceRadiusIntegral(p: SectionPiece): number {
  if (p.kind === 'line') return 0.5 * (p.r0 + p.r1) * Math.hypot(p.r1 - p.r0, p.z1 - p.z0);
  return p.rho * (p.cr * (p.th1 - p.th0) + p.rho * (Math.sin(p.th1) - Math.sin(p.th0)));
}
