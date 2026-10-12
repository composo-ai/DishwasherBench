/**
 * Signed distance to primitives and shapes (docs/design/platform.md section 4.2,
 * docs/research/items.md section 5.4).
 *
 * Accuracy, per primitive (distance in metres, negative inside):
 *  - capsule, rbox, hull: exact everywhere.
 *  - sor, full turn, unscaled: exact outside and on the surface. Inside the wall the magnitude is
 *    the depth below the nearest ball of the wall, which is the exact depth except next to a
 *    concave crease of the surface, where it is a lower bound.
 *  - sor with `arc`: as above for points within the azimuth range; beyond it the value is the
 *    exact distance to the flat end face while the point is within a quarter turn of that face
 *    and a lower bound further round. Inside the solid the magnitude is a lower bound.
 *  - sor with `scaleXY = [sx, sy]`: the unscaled distance at the un-stretched point, times
 *    `min(sx, sy, 1)`. The sign and the zero level set are exact; the magnitude `m` satisfies
 *    `d * min(sx, sy, 1) / max(sx, sy, 1) <= m <= d` for the true distance `d`.
 *  - outside a stretched or partial shell the value is raised to the distance to a sphere that
 *    contains the solid wherever that is the larger (and still valid) lower bound.
 *  - a shape is the union of its parts: the minimum over parts, exact outside the shape and a
 *    lower bound on the depth inside it.
 * In every case the magnitude never exceeds the true distance, so the value is safe for sphere
 * tracing and for penetration tests. The gradient is the unit outward direction at the nearest
 * surface point (for scaled shells: the normal of the level set through the query point).
 *
 * Frames: the shape functions take points in the item frame; the primitive functions take points
 * in the part frame.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { quatToMat3 } from '@spotless/core';
import type { ConvexCore, Polytope, PolyFace } from './convex.ts';
import {
  preparePrimitive,
  type PreparedCapsule,
  type PreparedHull,
  type PreparedPrimitive,
  type PreparedRbox,
  type PreparedSor,
} from './prepared.ts';
import {
  createProfileHit,
  hitArcLength,
  profileClosest,
  profileDistance,
  SEGMENT_STRIDE,
} from './sor-section.ts';
import { shapeRegionRules, sideOfNormalZ, type PatchSide } from './regions.ts';
import type { Part, Primitive, Shape } from './types.ts';

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;

// ---------------------------------------------------------------------------------------------
// Shell of revolution
// ---------------------------------------------------------------------------------------------

/** Signed angular offset of `phi` from `mid`, wrapped to (-pi, pi]. */
function wrapAngle(phi: number, mid: number): number {
  let d = (phi - mid) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d <= -Math.PI) d += TWO_PI;
  return d;
}

function sorDistance(s: PreparedSor, x: number, y: number, z: number): number {
  const ux = x / s.sx;
  const uy = y / s.sy;
  const rho = Math.sqrt(ux * ux + uy * uy);
  let v: number;
  const arc = s.arc;
  if (arc === null) {
    v = profileDistance(s.profile, rho, z, 0);
  } else {
    const d = rho > 0 ? wrapAngle(Math.atan2(uy, ux), arc.mid) : 0;
    const excess = Math.abs(d) - arc.halfSpan;
    if (excess <= 0) {
      v = profileDistance(s.profile, rho, z, 0);
      if (v < 0) {
        // Inside: the flat end faces may be nearer than the wall surface.
        const e = -excess; // angle to the nearer end plane
        const toPlane = e < HALF_PI ? rho * Math.sin(e) : rho;
        if (toPlane < -v) v = -toPlane;
      }
    } else {
      // Beyond the range: the nearest point of the solid is on the end face.
      const inPlane = profileDistance(s.profile, rho * Math.cos(excess), z, 0);
      const h = rho * Math.sin(excess);
      v = inPlane > 0 ? Math.sqrt(h * h + inPlane * inPlane) : h;
    }
  }
  if (arc === null && s.sx === 1 && s.sy === 1) return v;
  // A stretched or partial shell: the value is a lower bound, and so is the distance to a sphere
  // that contains the solid; the larger of the two is the better bound. (It also keeps the value
  // of a part from undercutting its bounding volume, by which shapes skip far parts.)
  let out = Math.min(s.sx, s.sy, 1) * v;
  if (out > 0) {
    const dz = z - s.boundZ;
    const bound = Math.sqrt(x * x + y * y + dz * dz) - s.boundRadius;
    if (bound > out) out = bound;
  }
  return out;
}

const sorHit = createProfileHit();

function sorGradient(s: PreparedSor, x: number, y: number, z: number): Vec3 {
  const ux = x / s.sx;
  const uy = y / s.sy;
  const rho = Math.sqrt(ux * ux + uy * uy);
  const profile = s.profile;
  // Direction in the meridian plane from the centre of the nearest ball to the query point.
  const inPlaneNormal = (qr: number, qz: number): [number, number, number] => {
    const hit = profileClosest(profile, qr, qz, 0, sorHit);
    let nr = qr - hit.cr;
    let nz = qz - hit.cz;
    const len = Math.hypot(nr, nz);
    if (len > 1e-300) {
      nr /= len;
      nz /= len;
    } else {
      // On the mid-surface itself: use the left normal of the segment.
      const o = hit.segment * SEGMENT_STRIDE;
      nr = -(profile.data[o + 3] as number);
      nz = profile.data[o + 2] as number;
    }
    return [nr, nz, hit.value];
  };
  // Unit radial and tangential directions at the query azimuth (un-stretched frame).
  const cr = rho > 0 ? ux / rho : 1;
  const sr = rho > 0 ? uy / rho : 0;
  let gx: number;
  let gy: number;
  let gz: number;
  const arc = s.arc;
  const d = arc !== null && rho > 0 ? wrapAngle(Math.atan2(uy, ux), arc.mid) : 0;
  const excess = arc === null ? -1 : Math.abs(d) - arc.halfSpan;
  if (arc === null || excess <= 0) {
    const [nr, nz, value] = inPlaneNormal(rho, z);
    gx = nr * cr;
    gy = nr * sr;
    gz = nz;
    if (!(rho > 0)) {
      // On the axis the radial part cancels by symmetry.
      gx = 0;
      gy = 0;
      gz = nz >= 0 ? 1 : -1;
    }
    if (arc !== null && value < 0) {
      const e = -excess;
      const toPlane = e < HALF_PI ? rho * Math.sin(e) : rho;
      if (toPlane < -value) {
        // The nearer end face is the nearest surface: leave through it, along its normal.
        const end = d >= 0 ? arc.phi1 : arc.phi0;
        const sign = d >= 0 ? 1 : -1;
        gx = -sign * Math.sin(end);
        gy = sign * Math.cos(end);
        gz = 0;
      }
    }
  } else {
    const end = d >= 0 ? arc.phi1 : arc.phi0;
    const sign = d >= 0 ? 1 : -1;
    const er: Vec3 = [Math.cos(end), Math.sin(end), 0];
    const et: Vec3 = [-sign * Math.sin(end), sign * Math.cos(end), 0];
    const [nr, nz, value] = inPlaneNormal(rho * Math.cos(excess), z);
    const h = rho * Math.sin(excess);
    const along = value > 0 ? value : 0;
    const len = Math.hypot(h, along);
    if (len > 0) {
      gx = (along * nr * er[0] + h * et[0]) / len;
      gy = (along * nr * er[1] + h * et[1]) / len;
      gz = (along * nz) / len;
    } else {
      gx = et[0];
      gy = et[1];
      gz = 0;
    }
  }
  // Normal of the stretched level set: the inverse transpose of the stretch applied to it.
  gx /= s.sx;
  gy /= s.sy;
  const len = Math.hypot(gx, gy, gz);
  return len > 0 ? [gx / len, gy / len, gz / len] : [0, 0, 1];
}

// ---------------------------------------------------------------------------------------------
// Capsule and rounded box
// ---------------------------------------------------------------------------------------------

function capsuleClosest(c: PreparedCapsule, x: number, y: number, z: number): Vec3 {
  const a = c.a;
  const ex = c.b[0] - a[0];
  const ey = c.b[1] - a[1];
  const ez = c.b[2] - a[2];
  const len2 = ex * ex + ey * ey + ez * ez;
  let t = len2 > 0 ? ((x - a[0]) * ex + (y - a[1]) * ey + (z - a[2]) * ez) / len2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return [a[0] + t * ex, a[1] + t * ey, a[2] + t * ez];
}

function capsuleDistance(c: PreparedCapsule, x: number, y: number, z: number): number {
  const q = capsuleClosest(c, x, y, z);
  return Math.hypot(x - q[0], y - q[1], z - q[2]) - c.radius;
}

function capsuleGradient(c: PreparedCapsule, x: number, y: number, z: number): Vec3 {
  const q = capsuleClosest(c, x, y, z);
  const len = Math.hypot(x - q[0], y - q[1], z - q[2]);
  if (len > 1e-300) return [(x - q[0]) / len, (y - q[1]) / len, (z - q[2]) / len];
  // On the axis of the capsule: any direction perpendicular to it.
  const ex = c.b[0] - c.a[0];
  const ey = c.b[1] - c.a[1];
  const ez = c.b[2] - c.a[2];
  if (Math.abs(ex) <= Math.abs(ey) && Math.abs(ex) <= Math.abs(ez)) {
    const l = Math.hypot(ez, ey);
    return l > 0 ? [0, -ez / l, ey / l] : [0, 0, 1];
  }
  const l = Math.hypot(ey, ex);
  return l > 0 ? [-ey / l, ex / l, 0] : [0, 0, 1];
}

function rboxDistance(b: PreparedRbox, x: number, y: number, z: number): number {
  const qx = Math.abs(x) - b.halfExtents[0];
  const qy = Math.abs(y) - b.halfExtents[1];
  const qz = Math.abs(z) - b.halfExtents[2];
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  const oz = qz > 0 ? qz : 0;
  const outside = Math.sqrt(ox * ox + oy * oy + oz * oz);
  const inside = Math.min(Math.max(qx, qy, qz), 0);
  return outside + inside - b.radius;
}

function rboxGradient(b: PreparedRbox, x: number, y: number, z: number): Vec3 {
  const qx = Math.abs(x) - b.halfExtents[0];
  const qy = Math.abs(y) - b.halfExtents[1];
  const qz = Math.abs(z) - b.halfExtents[2];
  const sx = x < 0 ? -1 : 1;
  const sy = y < 0 ? -1 : 1;
  const sz = z < 0 ? -1 : 1;
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  const oz = qz > 0 ? qz : 0;
  const len = Math.hypot(ox, oy, oz);
  if (len > 1e-300) return [(sx * ox) / len, (sy * oy) / len, (sz * oz) / len];
  // Inside the inner box: towards the nearest face.
  if (qx >= qy && qx >= qz) return [sx, 0, 0];
  if (qy >= qz) return [0, sy, 0];
  return [0, 0, sz];
}

// ---------------------------------------------------------------------------------------------
// Rounded hull
// ---------------------------------------------------------------------------------------------

/** Scratch result of {@link polytopeCoreDistance}: the nearest point of the core, or a face. */
const closestScratch = { x: 0, y: 0, z: 0, face: -1 };

/**
 * Signed distance from a point to a polytope core without its rounding radius. Fills
 * `closestScratch` with the nearest point (outside) or the index of the nearest face (inside).
 */
function polytopeCoreDistance(core: Polytope, x: number, y: number, z: number): number {
  const planes = core.planes;
  const faceCount = core.faces.length;
  closestScratch.face = -1;
  if (core.dim === 3) {
    let m = Number.NEGATIVE_INFINITY;
    let mf = 0;
    for (let f = 0; f < faceCount; f++) {
      const s =
        (planes[4 * f] as number) * x +
        (planes[4 * f + 1] as number) * y +
        (planes[4 * f + 2] as number) * z -
        (planes[4 * f + 3] as number);
      if (s > m) {
        m = s;
        mf = f;
      }
    }
    if (m <= 0) {
      closestScratch.face = mf;
      return m;
    }
  }
  // Outside (or a flat core): a face whose plane projection of the point lands inside it holds
  // the nearest point; otherwise the nearest point is on an edge.
  const facesToTry = core.dim === 3 ? faceCount : 1;
  for (let f = 0; f < facesToTry; f++) {
    const nx = planes[4 * f] as number;
    const ny = planes[4 * f + 1] as number;
    const nz = planes[4 * f + 2] as number;
    const s = nx * x + ny * y + nz * z - (planes[4 * f + 3] as number);
    if (core.dim === 3 && s <= 0) continue;
    const px = x - s * nx;
    const py = y - s * ny;
    const pz = z - s * nz;
    const edges = core.faceEdges[f] as Float64Array;
    let inside = true;
    for (let i = 0; i < edges.length; i += 6) {
      const side =
        (px - (edges[i] as number)) * (edges[i + 3] as number) +
        (py - (edges[i + 1] as number)) * (edges[i + 4] as number) +
        (pz - (edges[i + 2] as number)) * (edges[i + 5] as number);
      if (side > 0) {
        inside = false;
        break;
      }
    }
    if (inside) {
      closestScratch.x = px;
      closestScratch.y = py;
      closestScratch.z = pz;
      return Math.abs(s);
    }
  }
  const seg = core.segments;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < seg.length; i += 7) {
    const ax = seg[i] as number;
    const ay = seg[i + 1] as number;
    const az = seg[i + 2] as number;
    const ex = seg[i + 3] as number;
    const ey = seg[i + 4] as number;
    const ez = seg[i + 5] as number;
    let t = ((x - ax) * ex + (y - ay) * ey + (z - az) * ez) * (seg[i + 6] as number);
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cx = ax + t * ex;
    const cy = ay + t * ey;
    const cz = az + t * ez;
    const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy) + (z - cz) * (z - cz);
    if (d2 < best) {
      best = d2;
      closestScratch.x = cx;
      closestScratch.y = cy;
      closestScratch.z = cz;
    }
  }
  return Math.sqrt(best);
}

function coreDistance(core: ConvexCore, x: number, y: number, z: number): number {
  if (core.dim === 0) {
    return Math.hypot(x - core.centre[0], y - core.centre[1], z - core.centre[2]);
  }
  if (core.dim === 1) {
    const a = core.a;
    const ex = core.b[0] - a[0];
    const ey = core.b[1] - a[1];
    const ez = core.b[2] - a[2];
    let t = ((x - a[0]) * ex + (y - a[1]) * ey + (z - a[2]) * ez) / (ex * ex + ey * ey + ez * ez);
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    return Math.hypot(x - a[0] - t * ex, y - a[1] - t * ey, z - a[2] - t * ez);
  }
  return polytopeCoreDistance(core, x, y, z);
}

function coreGradient(core: ConvexCore, x: number, y: number, z: number): Vec3 {
  if (core.dim === 0) {
    const len = Math.hypot(x - core.centre[0], y - core.centre[1], z - core.centre[2]);
    return len > 1e-300
      ? [(x - core.centre[0]) / len, (y - core.centre[1]) / len, (z - core.centre[2]) / len]
      : [0, 0, 1];
  }
  if (core.dim === 1) {
    return capsuleGradient(
      {
        kind: 'capsule',
        prim: { kind: 'capsule', a: core.a, b: core.b, radius: 1 },
        a: core.a,
        b: core.b,
        radius: 1,
        length: 0,
      },
      x,
      y,
      z,
    );
  }
  const d = polytopeCoreDistance(core, x, y, z);
  if (closestScratch.face >= 0) return (core.faces[closestScratch.face] as PolyFace).normal;
  if (d > 1e-300) {
    return [(x - closestScratch.x) / d, (y - closestScratch.y) / d, (z - closestScratch.z) / d];
  }
  // On a flat core (or exactly on the boundary of a solid one): the face normal.
  return (core.faces[0] as PolyFace).normal;
}

function hullDistance(h: PreparedHull, x: number, y: number, z: number): number {
  return coreDistance(h.core, x, y, z) - h.radius;
}

// ---------------------------------------------------------------------------------------------
// Primitives and shapes
// ---------------------------------------------------------------------------------------------

/** Signed distance to a prepared primitive at a point of its part frame, metres. */
export function preparedDistance(p: PreparedPrimitive, x: number, y: number, z: number): number {
  switch (p.kind) {
    case 'sor':
      return sorDistance(p, x, y, z);
    case 'capsule':
      return capsuleDistance(p, x, y, z);
    case 'rbox':
      return rboxDistance(p, x, y, z);
    case 'hull':
      return hullDistance(p, x, y, z);
  }
}

/** Unit outward gradient of the signed distance to a prepared primitive (part frame). */
export function preparedGradient(p: PreparedPrimitive, x: number, y: number, z: number): Vec3 {
  switch (p.kind) {
    case 'sor':
      return sorGradient(p, x, y, z);
    case 'capsule':
      return capsuleGradient(p, x, y, z);
    case 'rbox':
      return rboxGradient(p, x, y, z);
    case 'hull':
      return coreGradient(p.core, x, y, z);
  }
}

/**
 * Signed distance from the point `p` (part frame, metres) to one primitive: negative inside.
 * See the module comment for where it is exact and where it is a lower bound.
 */
export function primitiveSignedDistance(prim: Primitive, p: Vec3): number {
  return preparedDistance(preparePrimitive(prim), p[0], p[1], p[2]);
}

/** Unit outward direction of steepest increase of {@link primitiveSignedDistance} (part frame). */
export function primitiveSignedDistanceGradient(prim: Primitive, p: Vec3): Vec3 {
  return preparedGradient(preparePrimitive(prim), p[0], p[1], p[2]);
}

/** Centre (part frame) and radius of a sphere that contains a primitive, metres. */
export function primitiveBoundingSphere(prep: PreparedPrimitive): { centre: Vec3; radius: number } {
  switch (prep.kind) {
    case 'sor':
      return { centre: [0, 0, prep.boundZ], radius: prep.boundRadius };
    case 'capsule':
      return {
        centre: [
          0.5 * (prep.a[0] + prep.b[0]),
          0.5 * (prep.a[1] + prep.b[1]),
          0.5 * (prep.a[2] + prep.b[2]),
        ],
        radius: 0.5 * prep.length + prep.radius,
      };
    case 'rbox':
      return {
        centre: [0, 0, 0],
        radius:
          Math.hypot(prep.halfExtents[0], prep.halfExtents[1], prep.halfExtents[2]) + prep.radius,
      };
    case 'hull': {
      const core = prep.core;
      const points: readonly Vec3[] =
        core.dim === 0 ? [core.centre] : core.dim === 1 ? [core.a, core.b] : core.vertices;
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const p of points) {
        cx += p[0];
        cy += p[1];
        cz += p[2];
      }
      cx /= points.length;
      cy /= points.length;
      cz /= points.length;
      let r = 0;
      for (const p of points) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz));
      return { centre: [cx, cy, cz], radius: r + prep.radius };
    }
  }
}

interface CompiledPart {
  readonly prep: PreparedPrimitive;
  /** Rotation part frame -> item frame, row-major. */
  readonly m: readonly number[];
  readonly tx: number;
  readonly ty: number;
  readonly tz: number;
  /** Bounding sphere in the item frame. */
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly radius: number;
}

/**
 * A bounding-volume hierarchy over the parts of a shape with many parts (a rack is over a
 * thousand capsules): a binary tree of axis-aligned boxes around the parts' bounding spheres.
 */
interface PartTree {
  /** Per node: min x, y, z and max x, y, z of its box, metres (item frame). */
  readonly boxes: Float64Array;
  /** Per node: indices of its two children, or -1 for a leaf. */
  readonly left: Int32Array;
  readonly right: Int32Array;
  /** Per leaf node: first entry of `order` and number of entries. */
  readonly first: Int32Array;
  readonly count: Int32Array;
  /** Part indices, grouped by leaf. */
  readonly order: Int32Array;
}

interface CompiledShape {
  readonly parts: readonly CompiledPart[];
  /** `null` for shapes with few parts, which are scanned in order. */
  readonly tree: PartTree | null;
}

/** Shapes with more parts than this get a {@link PartTree}. */
const TREE_MIN_PARTS = 12;
/** Largest number of parts in a leaf of the tree. */
const TREE_LEAF_SIZE = 4;

const shapeCache = new WeakMap<Shape, CompiledShape>();

function compilePart(part: Part): CompiledPart {
  const prep = preparePrimitive(part.prim);
  const pose: Pose = part.pose;
  const m = quatToMat3(pose.q);
  const sphere = primitiveBoundingSphere(prep);
  const c = sphere.centre;
  return {
    prep,
    m,
    tx: pose.p[0],
    ty: pose.p[1],
    tz: pose.p[2],
    cx: pose.p[0] + m[0] * c[0] + m[1] * c[1] + m[2] * c[2],
    cy: pose.p[1] + m[3] * c[0] + m[4] * c[1] + m[5] * c[2],
    cz: pose.p[2] + m[6] * c[0] + m[7] * c[1] + m[8] * c[2],
    radius: sphere.radius,
  };
}

function buildTree(parts: readonly CompiledPart[]): PartTree {
  const n = parts.length;
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  const boxes: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  const first: number[] = [];
  const count: number[] = [];
  const centre = (i: number, axis: number): number => {
    const part = parts[i] as CompiledPart;
    return axis === 0 ? part.cx : axis === 1 ? part.cy : part.cz;
  };
  // Builds the node covering order[lo, hi) and returns its index.
  const build = (lo: number, hi: number): number => {
    const node = left.length;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const cmin = [Infinity, Infinity, Infinity];
    const cmax = [-Infinity, -Infinity, -Infinity];
    for (let k = lo; k < hi; k++) {
      const part = parts[order[k] as number] as CompiledPart;
      const c = [part.cx, part.cy, part.cz];
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a] as number, (c[a] as number) - part.radius);
        max[a] = Math.max(max[a] as number, (c[a] as number) + part.radius);
        cmin[a] = Math.min(cmin[a] as number, c[a] as number);
        cmax[a] = Math.max(cmax[a] as number, c[a] as number);
      }
    }
    boxes.push(...(min as number[]), ...(max as number[]));
    left.push(-1);
    right.push(-1);
    first.push(lo);
    count.push(hi - lo);
    if (hi - lo <= TREE_LEAF_SIZE) return node;
    // Split at the median along the axis on which the centres spread most; ties by part index,
    // so the tree is a function of the shape alone.
    let axis = 0;
    for (let a = 1; a < 3; a++) {
      if (
        (cmax[a] as number) - (cmin[a] as number) >
        (cmax[axis] as number) - (cmin[axis] as number)
      )
        axis = a;
    }
    const slice = Array.from(order.subarray(lo, hi)).sort(
      (i, j) => centre(i, axis) - centre(j, axis) || i - j,
    );
    order.set(slice, lo);
    const mid = lo + ((hi - lo) >> 1);
    left[node] = build(lo, mid);
    right[node] = build(mid, hi);
    return node;
  };
  build(0, n);
  return {
    boxes: Float64Array.from(boxes),
    left: Int32Array.from(left),
    right: Int32Array.from(right),
    first: Int32Array.from(first),
    count: Int32Array.from(count),
    order,
  };
}

function compileShape(shape: Shape): CompiledShape {
  let compiled = shapeCache.get(shape);
  if (compiled === undefined) {
    if (shape.parts.length === 0) throw new RangeError('geometry: a shape needs at least one part');
    const parts = shape.parts.map(compilePart);
    compiled = { parts, tree: parts.length > TREE_MIN_PARTS ? buildTree(parts) : null };
    shapeCache.set(shape, compiled);
  }
  return compiled;
}

/** Result of {@link sampleSignedDistance}. */
export interface SdfSample {
  /** Signed distance, metres (negative inside). */
  readonly distance: number;
  /** Unit outward gradient in the item frame. */
  readonly gradient: Vec3;
  /** Index into `shape.parts` of the part that is nearest. */
  readonly part: number;
}

/** Index of the nearest part found by the last call of {@link nearestPart}. */
let nearestIndex = 0;
/** Smallest distance found so far by the running query. */
let nearestBest = 0;

/** Evaluates one part and updates the running minimum; ties go to the lower part index. */
function visitPart(
  parts: readonly CompiledPart[],
  i: number,
  px: number,
  py: number,
  pz: number,
): void {
  const part = parts[i] as CompiledPart;
  const dx = px - part.cx;
  const dy = py - part.cy;
  const dz = pz - part.cz;
  // A part whose bounding sphere is further away than the best so far cannot be nearer.
  if (Math.sqrt(dx * dx + dy * dy + dz * dz) - part.radius > nearestBest) return;
  const m = part.m;
  const rx = px - part.tx;
  const ry = py - part.ty;
  const rz = pz - part.tz;
  // Item frame -> part frame: multiply by the transpose of the rotation.
  const d = preparedDistance(
    part.prep,
    (m[0] as number) * rx + (m[3] as number) * ry + (m[6] as number) * rz,
    (m[1] as number) * rx + (m[4] as number) * ry + (m[7] as number) * rz,
    (m[2] as number) * rx + (m[5] as number) * ry + (m[8] as number) * rz,
  );
  if (d < nearestBest || (d === nearestBest && i < nearestIndex)) {
    nearestBest = d;
    nearestIndex = i;
  }
}

/** Distance from a point to the box of a tree node (0 inside it). */
function boxDistance(
  boxes: Float64Array,
  node: number,
  px: number,
  py: number,
  pz: number,
): number {
  const o = 6 * node;
  const dx = Math.max((boxes[o] as number) - px, 0, px - (boxes[o + 3] as number));
  const dy = Math.max((boxes[o + 1] as number) - py, 0, py - (boxes[o + 4] as number));
  const dz = Math.max((boxes[o + 2] as number) - pz, 0, pz - (boxes[o + 5] as number));
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const treeStack = new Int32Array(128);

/** Smallest signed distance over the parts; leaves the index of that part in `nearestIndex`. */
function nearestPart(shape: CompiledShape, p: Vec3): number {
  const parts = shape.parts;
  const px = p[0];
  const py = p[1];
  const pz = p[2];
  nearestBest = Number.POSITIVE_INFINITY;
  nearestIndex = 0;
  const tree = shape.tree;
  if (tree === null) {
    for (let i = 0; i < parts.length; i++) visitPart(parts, i, px, py, pz);
    return nearestBest;
  }
  // Depth first, nearer child first. A part is at least as far as the box of a node that holds
  // it when the point is outside that box, so such a node holds nothing nearer once it is
  // further than the best so far. A box that contains the point says nothing: the point may be
  // deep inside one of its parts.
  let top = 0;
  treeStack[top++] = 0;
  while (top > 0) {
    const node = treeStack[--top] as number;
    const toBox = boxDistance(tree.boxes, node, px, py, pz);
    if (toBox > 0 && toBox > nearestBest) continue;
    const left = tree.left[node] as number;
    if (left < 0) {
      const start = tree.first[node] as number;
      const end = start + (tree.count[node] as number);
      for (let k = start; k < end; k++) visitPart(parts, tree.order[k] as number, px, py, pz);
      continue;
    }
    const right = tree.right[node] as number;
    const dl = boxDistance(tree.boxes, left, px, py, pz);
    const dr = boxDistance(tree.boxes, right, px, py, pz);
    if (dl <= dr) {
      treeStack[top++] = right;
      treeStack[top++] = left;
    } else {
      treeStack[top++] = left;
      treeStack[top++] = right;
    }
  }
  return nearestBest;
}

/**
 * `signedDistance(shape, p)`: distance in metres from the point `p` (item frame) to the surface
 * of the shape, negative inside. The union of the parts is the minimum over parts. See the
 * module comment for where the value is exact and where it is a lower bound.
 */
export function signedDistance(shape: Shape, p: Vec3): number {
  return nearestPart(compileShape(shape), p);
}

/** Signed distance, gradient and nearest part at a point of the item frame. */
export function sampleSignedDistance(shape: Shape, p: Vec3): SdfSample {
  const compiled = compileShape(shape);
  const distance = nearestPart(compiled, p);
  const index = nearestIndex;
  const part = compiled.parts[index] as CompiledPart;
  const m = part.m;
  const rx = p[0] - part.tx;
  const ry = p[1] - part.ty;
  const rz = p[2] - part.tz;
  const g = preparedGradient(
    part.prep,
    (m[0] as number) * rx + (m[3] as number) * ry + (m[6] as number) * rz,
    (m[1] as number) * rx + (m[4] as number) * ry + (m[7] as number) * rz,
    (m[2] as number) * rx + (m[5] as number) * ry + (m[8] as number) * rz,
  );
  return {
    distance,
    gradient: [
      (m[0] as number) * g[0] + (m[1] as number) * g[1] + (m[2] as number) * g[2],
      (m[3] as number) * g[0] + (m[4] as number) * g[1] + (m[5] as number) * g[2],
      (m[6] as number) * g[0] + (m[7] as number) * g[1] + (m[8] as number) * g[2],
    ],
    part: index,
  };
}

/**
 * `signedDistanceGradient(shape, p)`: unit outward direction of steepest distance increase at the
 * point `p` (item frame): the gradient of the nearest part.
 */
export function signedDistanceGradient(shape: Shape, p: Vec3): Vec3 {
  return sampleSignedDistance(shape, p).gradient;
}

/**
 * Side and arc length, in the sense of the region rules, of the surface of a shell of revolution
 * nearest to a point of its part frame. The flat end faces of a partial shell are on no side and
 * have no arc length.
 */
function sorPatchAt(
  s: PreparedSor,
  x: number,
  y: number,
  z: number,
): { side: PatchSide; arcLength: number | undefined } {
  const ux = x / s.sx;
  const uy = y / s.sy;
  const rho = Math.sqrt(ux * ux + uy * uy);
  const profile = s.profile;
  let qr = rho;
  const arc = s.arc;
  if (arc !== null) {
    const d = rho > 0 ? wrapAngle(Math.atan2(uy, ux), arc.mid) : 0;
    const excess = Math.abs(d) - arc.halfSpan;
    if (excess > 0) {
      // Beyond the azimuth range: over the end face unless the nearest point is on its outline.
      qr = rho * Math.cos(excess);
      if (profileDistance(profile, qr, z, 0) <= 0) return { side: 'none', arcLength: undefined };
    } else {
      const value = profileDistance(profile, rho, z, 0);
      const e = -excess;
      const toPlane = e < HALF_PI ? rho * Math.sin(e) : rho;
      if (value < 0 && toPlane < -value) return { side: 'none', arcLength: undefined };
    }
  }
  const hit = profileClosest(profile, qr, z, 0, sorHit);
  const data = profile.data;
  const o = hit.segment * SEGMENT_STRIDE;
  const length = data[o + 4] as number;
  // Left normals of the segments the centre of the nearest ball belongs to: one segment, or the
  // two that meet at a profile vertex.
  const first = length > 0 && hit.along <= 0 ? hit.segment - 1 : hit.segment;
  const last = length > 0 && hit.along >= length ? hit.segment + 1 : hit.segment;
  let nr = 0;
  let nz = 0;
  let count = 0;
  for (let seg = Math.max(0, first); seg <= Math.min(profile.segmentCount - 1, last); seg++) {
    nr += -(data[seg * SEGMENT_STRIDE + 3] as number);
    nz += data[seg * SEGMENT_STRIDE + 2] as number;
    count++;
  }
  let left = (qr - hit.cr) * nr + (z - hit.cz) * nz >= 0;
  if (count === 2 && Math.hypot(nr, nz) < 0.5) {
    // Nearly a U-turn of the profile: the round join is on the outside of the turn.
    const o0 = Math.max(0, first) * SEGMENT_STRIDE;
    const o1 = o0 + SEGMENT_STRIDE;
    left =
      (data[o0 + 2] as number) * (data[o1 + 3] as number) -
        (data[o0 + 3] as number) * (data[o1 + 2] as number) <
      0;
  }
  return { side: left ? 'in' : 'out', arcLength: hitArcLength(profile, hit) };
}

/**
 * The surface region of the part of the surface nearest to the point `p` (item frame): the index
 * into `shape.regions`, or -1 when that surface is in no region. On the surface itself this is
 * the region of that point, by the same rules that tag the triangles of the render mesh; next to
 * the surface it is the region one would reach by going straight to it.
 */
export function surfaceRegionAt(shape: Shape, p: Vec3): number {
  const rules = shapeRegionRules(shape);
  const compiled = compileShape(shape);
  nearestPart(compiled, p);
  const index = nearestIndex;
  const part = compiled.parts[index] as CompiledPart;
  const m = part.m;
  const rx = p[0] - part.tx;
  const ry = p[1] - part.ty;
  const rz = p[2] - part.tz;
  const x = (m[0] as number) * rx + (m[3] as number) * ry + (m[6] as number) * rz;
  const y = (m[1] as number) * rx + (m[4] as number) * ry + (m[7] as number) * rz;
  const z = (m[2] as number) * rx + (m[5] as number) * ry + (m[8] as number) * rz;
  const prep = part.prep;
  switch (prep.kind) {
    case 'sor': {
      const patch = sorPatchAt(prep, x, y, z);
      return rules.regionOf(index, patch.side, patch.arcLength);
    }
    case 'capsule':
      return rules.regionOf(index, 'none', undefined);
    case 'rbox':
      return rules.regionOf(index, sideOfNormalZ(rboxGradient(prep, x, y, z)[2]), undefined);
    case 'hull':
      if (prep.core.dim < 2) return rules.regionOf(index, 'none', undefined);
      return rules.regionOf(index, sideOfNormalZ(coreGradient(prep.core, x, y, z)[2]), undefined);
  }
}
