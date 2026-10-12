/**
 * The f64 reference tracer of a scene (docs/design/sim-core.md section 3.5, `traceCpu`): closest
 * hit of a ray or a short segment against the triangle hierarchy, the hit corrected to the exact
 * analytic surface, and its block and soil cell in closed form (section 3.6).
 *
 * The GPU kernel (`trace.wgsl.ts`) does the same steps in f32; this file is their definition.
 *
 * 1. **Traversal.** Every root is traversed with the ray in the root's frame. A triangle is
 *    struck only from outside (back faces are not hits), so a ray that starts inside a solid
 *    leaves it unhindered; a triangle of a porous part is skipped when the counter-based hash of
 *    (seed, ray key, part key) falls below the part's open fraction, so a ray passes the whole
 *    part or none of it, and its passage through one part says nothing about the next. (A
 *    golden-ratio sequence in the ray key in place of the hash, which spreads the passage
 *    evenly over consecutive rays, was tried and taken out: the draws of one ray for two parts
 *    then differ by a constant, so what passes the floor of the cutlery basket passes its
 *    walls in a share that depends on the seed.)
 * 2. **Correction.** The triangle names the analytic piece it lies on. The hit is moved along
 *    the ray to the zero of that piece's implicit function by Newton steps (retreating first
 *    when a grazing ray met the triangle where the piece already faces away), never further
 *    than `maxStepChords` chord errors from the triangle hit; if it comes to rest outside the
 *    range of the piece, the neighbouring piece is tried (a concave crease, a rim that runs
 *    into a wall, the corner at the end of a rounded edge). The corrected hit is accepted when
 *    it lies on the piece (`acceptResidual`), within its range, and the piece faces the ray
 *    there; its normal is the gradient of the implicit function. Otherwise the hit is the one
 *    on the triangle: its point, and the normal of the triangle (`TraceHit.corrected` is
 *    false). So every hit lies within the chord error of the surface and has a cosine of
 *    incidence of 0 or more.
 * 3. **Mapping.** The hit gives patch coordinates, hence a row, a column, a cell, a block, and
 *    the soil cell from the quarter of the block that was struck. On a planar face a hit on a
 *    rounded edge is mapped to its foot on the axis of the edge and a hit on a rounded corner to
 *    the centre of the corner, which are points of the outline of the face.
 *
 * What the correction cannot do, stated so that calibration can judge it: which surface is
 * struck first, and whether a grazing ray strikes at all, is decided on the triangles, so
 * silhouettes are those of the mesh (within the chord error, `scene.rayChordError`). A ray that
 * passes within the chord error outside a concave surface can be reported as a hit on it, and a
 * ray that runs along a cylinder inside its radius (within about 2 degrees of a wire or of the
 * rounded edge of a handle) can meet the mesh tens of millimetres after it entered the true
 * surface; such hits stay on their triangle. A segment is a hit when it reaches the triangle,
 * and the corrected distance is clamped to the segment.
 *
 * Units: metres. Frame: tub frame for rays and normals.
 */

import { hashU32, quatFromAxisAngle, quatToMat3 } from '@spotless/core';
import { affineInverseRigid, affineMul, type Affine } from './affine.ts';
import { PATCH_KIND, quarterHalf, SURF_KIND } from './atlas-core.ts';
import { HIT_WORDS, RAY_WORDS, TRACE_NUMERICS, type TraceData } from './trace-data.ts';

const TWO_PI = 2 * Math.PI;
const NONE = 0xffffffff;

/** A hit of the reference tracer. */
export interface TraceHit {
  /** Distance along the ray, metres (the segment length on a miss). */
  t: number;
  /** Block struck, or 0xffffffff. */
  block: number;
  /** Soil cell struck, or 0xffffffff. */
  soilCell: number;
  /** Triangle struck (hierarchy order), or 0xffffffff on a miss. */
  triangle: number;
  /** Analytic piece the hit was corrected on. */
  surf: number;
  /** Outward unit normal at the hit, tub frame. */
  nx: number;
  ny: number;
  nz: number;
  /** Cosine of the angle between the ray and the inward normal; never negative. */
  cosInc: number;
  /**
   * Value of the implicit function of the piece at the hit, metres: within
   * `TRACE_NUMERICS.acceptResidual` of 0 for a corrected hit, up to the chord error otherwise.
   */
  residual: number;
  /**
   * True when the hit was corrected to the analytic surface; false when the correction did not
   * come to rest on the piece facing the ray, and the hit is the one on the triangle (its point,
   * the normal of the triangle).
   */
  corrected: boolean;
}

/** A fresh {@link TraceHit}. */
export function createTraceHit(): TraceHit {
  return {
    t: 0,
    block: NONE,
    soilCell: NONE,
    triangle: NONE,
    surf: NONE,
    nx: 0,
    ny: 0,
    nz: 0,
    cosInc: 0,
    residual: 0,
    corrected: false,
  };
}

/** The rows of the 3 x 4 matrix that maps the tub frame into the frame of a rotating root. */
export function rootTransform(
  rotating: NonNullable<TraceData['roots'][number]['rotating']>,
  angle: number,
): Affine {
  const m = quatToMat3(quatFromAxisAngle(rotating.axis, angle));
  const p = rotating.point;
  // Turning about the hinge in the part frame: x -> R (x - p) + p.
  const turn: Affine = {
    m: [...m],
    c: [
      p[0] - ((m[0] as number) * p[0] + (m[1] as number) * p[1] + (m[2] as number) * p[2]),
      p[1] - ((m[3] as number) * p[0] + (m[4] as number) * p[1] + (m[5] as number) * p[2]),
      p[2] - ((m[6] as number) * p[0] + (m[7] as number) * p[1] + (m[8] as number) * p[2]),
    ],
  };
  return affineInverseRigid(affineMul(rotating.pose, turn));
}

/** The f64 reference tracer over a {@link TraceData}. */
export class CpuTracer {
  readonly data: TraceData;
  private readonly nf: Float32Array;
  private readonly nu: Uint32Array;
  /** Twelve numbers per root: tub frame to root frame. */
  private readonly rootFrames: Float64Array;
  private readonly stack = new Uint32Array(64);
  // Scratch of the surface evaluation.
  private f = 0;
  private gx = 0;
  private gy = 0;
  private gz = 0;
  private param = 0;

  constructor(data: TraceData) {
    this.data = data;
    this.nf = new Float32Array(data.nodes);
    this.nu = new Uint32Array(data.nodes);
    this.rootFrames = new Float64Array(12 * data.roots.length);
    this.setAngles([]);
  }

  /**
   * Poses the rotating parts: one angle (radians about the hinge axis, 0 the reference pose) per
   * rotating root, in root order; missing angles are 0.
   */
  setAngles(angles: readonly number[]): void {
    let k = 0;
    this.data.roots.forEach((root, index) => {
      const a: Affine =
        root.rotating === null
          ? { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], c: [0, 0, 0] }
          : rootTransform(root.rotating, angles[k++] ?? 0);
      const o = 12 * index;
      for (let r = 0; r < 3; r++) {
        this.rootFrames[o + 4 * r] = a.m[3 * r] as number;
        this.rootFrames[o + 4 * r + 1] = a.m[3 * r + 1] as number;
        this.rootFrames[o + 4 * r + 2] = a.m[3 * r + 2] as number;
        this.rootFrames[o + 4 * r + 3] = a.c[r] as number;
      }
    });
  }

  /** The tub-to-root matrices as posed, twelve numbers per root. */
  get rootMatrices(): Float64Array {
    return this.rootFrames;
  }

  /**
   * Traces one segment from (ox, oy, oz) along the unit vector (dx, dy, dz) for at most `tMax`
   * metres. `key` and `seed` (u32) decide the passage through porous parts. Fills `out` and
   * returns true on a hit.
   */
  trace(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    tMax: number,
    key: number,
    seed: number,
    out: TraceHit,
  ): boolean {
    const data = this.data;
    const R = this.rootFrames;
    let best = tMax;
    let bestTri = -1;
    let bestRoot = 0;
    for (let k = 0; k < data.roots.length; k++) {
      const o = 12 * k;
      const rox =
        (R[o] as number) * ox +
        (R[o + 1] as number) * oy +
        (R[o + 2] as number) * oz +
        (R[o + 3] as number);
      const roy =
        (R[o + 4] as number) * ox +
        (R[o + 5] as number) * oy +
        (R[o + 6] as number) * oz +
        (R[o + 7] as number);
      const roz =
        (R[o + 8] as number) * ox +
        (R[o + 9] as number) * oy +
        (R[o + 10] as number) * oz +
        (R[o + 11] as number);
      const rdx = (R[o] as number) * dx + (R[o + 1] as number) * dy + (R[o + 2] as number) * dz;
      const rdy = (R[o + 4] as number) * dx + (R[o + 5] as number) * dy + (R[o + 6] as number) * dz;
      const rdz =
        (R[o + 8] as number) * dx + (R[o + 9] as number) * dy + (R[o + 10] as number) * dz;
      const tri = this.traverse(
        (data.roots[k] as { node: number }).node,
        rox,
        roy,
        roz,
        rdx,
        rdy,
        rdz,
        best,
        key,
        seed,
      );
      if (tri >= 0) {
        best = this.bestT;
        bestTri = tri;
        bestRoot = k;
      }
    }
    if (bestTri < 0) {
      out.t = tMax;
      out.block = NONE;
      out.soilCell = NONE;
      out.triangle = NONE;
      out.surf = NONE;
      out.nx = out.ny = out.nz = 0;
      out.cosInc = 0;
      out.residual = 0;
      out.corrected = false;
      return false;
    }
    this.shade(bestRoot, bestTri, best, ox, oy, oz, dx, dy, dz, tMax, out);
    return true;
  }

  /**
   * Traces `count` rays given as `TraceRay` records (32 bytes each) and returns `TraceHit`
   * records (32 bytes each). The key of ray `i` is its own `key` word plus `keyBase`.
   */
  traceBatch(rays: ArrayBuffer, count: number, seed = 0, keyBase = 0): ArrayBuffer {
    const rf = new Float32Array(rays);
    const ru = new Uint32Array(rays);
    const out = new ArrayBuffer(Math.max(1, count) * 4 * HIT_WORDS);
    const hf = new Float32Array(out);
    const hu = new Uint32Array(out);
    const hit = createTraceHit();
    for (let i = 0; i < count; i++) {
      const o = RAY_WORDS * i;
      this.trace(
        rf[o] as number,
        rf[o + 1] as number,
        rf[o + 2] as number,
        rf[o + 4] as number,
        rf[o + 5] as number,
        rf[o + 6] as number,
        rf[o + 3] as number,
        ((ru[o + 7] as number) + keyBase) >>> 0,
        seed,
        hit,
      );
      const h = HIT_WORDS * i;
      hf[h] = hit.t;
      hu[h + 1] = hit.block;
      hu[h + 2] = hit.soilCell;
      hu[h + 3] = hit.triangle;
      hf[h + 4] = hit.nx;
      hf[h + 5] = hit.ny;
      hf[h + 6] = hit.nz;
      hf[h + 7] = hit.cosInc;
    }
    return out;
  }

  private bestT = 0;

  /** Closest front-face triangle of one root within `tMax`; -1 if none. Leaves its t in `bestT`. */
  private traverse(
    root: number,
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    tMax: number,
    key: number,
    seed: number,
  ): number {
    const nf = this.nf;
    const nu = this.nu;
    const v = this.data.triVerts;
    const porous = this.data.triPorous;
    const tiny = 1e-30;
    const ix = 1 / (Math.abs(dx) < tiny ? (dx < 0 ? -tiny : tiny) : dx);
    const iy = 1 / (Math.abs(dy) < tiny ? (dy < 0 ? -tiny : tiny) : dy);
    const iz = 1 / (Math.abs(dz) < tiny ? (dz < 0 ? -tiny : tiny) : dz);
    // The ray in the sheared frame of the watertight triangle test: its largest direction
    // component becomes the axis kz, the other two (kx, ky, kz right-handed) are sheared away.
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const az = Math.abs(dz);
    const kz = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
    let kx = (kz + 1) % 3;
    let ky = (kz + 2) % 3;
    const dir = [dx, dy, dz];
    const org = [ox, oy, oz];
    if ((dir[kz] as number) < 0) {
      const swap = kx;
      kx = ky;
      ky = swap;
    }
    const shearX = (dir[kx] as number) / (dir[kz] as number);
    const shearY = (dir[ky] as number) / (dir[kz] as number);
    const shearZ = 1 / (dir[kz] as number);
    const okx = org[kx] as number;
    const oky = org[ky] as number;
    const okz = org[kz] as number;
    let best = tMax;
    let prim = -1;
    const slab = (n: number): number => {
      const o = n * 8;
      let t0 = ((nf[o] as number) - ox) * ix;
      let t1 = ((nf[o + 4] as number) - ox) * ix;
      let tn = Math.min(t0, t1);
      let tf = Math.max(t0, t1);
      t0 = ((nf[o + 1] as number) - oy) * iy;
      t1 = ((nf[o + 5] as number) - oy) * iy;
      tn = Math.max(tn, Math.min(t0, t1));
      tf = Math.min(tf, Math.max(t0, t1));
      t0 = ((nf[o + 2] as number) - oz) * iz;
      t1 = ((nf[o + 6] as number) - oz) * iz;
      tn = Math.max(tn, Math.min(t0, t1));
      tf = Math.min(tf, Math.max(t0, t1));
      tn = Math.max(tn, 0);
      tf = Math.min(tf, best);
      return tn <= tf ? tn : 1e30;
    };
    const stack = this.stack;
    let sp = 0;
    let node = root;
    if (slab(root) === 1e30) {
      this.bestT = best;
      return -1;
    }
    const { detMin } = TRACE_NUMERICS;
    for (;;) {
      const o = node * 8;
      const count = nu[o + 7] as number;
      const lf = nu[o + 3] as number;
      if (count > 0) {
        for (let k = lf; k < lf + count; k++) {
          const q = k * 9;
          // Watertight test (Woop, Benthin and Wald 2013): the vertices relative to the origin,
          // sheared so that the ray runs along kz; the edge functions U, V, W of the projected
          // triangle have one sign where the ray passes inside it, and a vertex shared by two
          // triangles is sheared to the same point for both, so no ray slips between them.
          const azz = (v[q + kz] as number) - okz;
          const bzz = (v[q + 3 + kz] as number) - okz;
          const czz = (v[q + 6 + kz] as number) - okz;
          const axx = (v[q + kx] as number) - okx - shearX * azz;
          const ayy = (v[q + ky] as number) - oky - shearY * azz;
          const bxx = (v[q + 3 + kx] as number) - okx - shearX * bzz;
          const byy = (v[q + 3 + ky] as number) - oky - shearY * bzz;
          const cxx = (v[q + 6 + kx] as number) - okx - shearX * czz;
          const cyy = (v[q + 6 + ky] as number) - oky - shearY * czz;
          const U = cxx * byy - cyy * bxx;
          const V = axx * cyy - ayy * cxx;
          const W = bxx * ayy - byy * axx;
          // Struck from outside only: a triangle seen from its front has all three positive.
          if (U < 0 || V < 0 || W < 0) continue;
          const det = U + V + W;
          if (!(det > detMin)) continue;
          const t = (shearZ * (U * azz + V * bzz + W * czz)) / det;
          if (!(t >= 0 && t < best)) continue;
          const word = porous[k] as number;
          if (word !== 0 && hashU32(seed, key, word & 0xffffff) >>> 24 < word >>> 24) continue;
          best = t;
          prim = k;
        }
        if (sp === 0) break;
        node = stack[--sp] as number;
      } else {
        const d1 = slab(lf);
        const d2 = slab(lf + 1);
        let near = lf;
        let far = lf + 1;
        let dn = d1;
        let df = d2;
        if (d2 < d1) {
          near = lf + 1;
          far = lf;
          dn = d2;
          df = d1;
        }
        if (dn === 1e30) {
          if (sp === 0) break;
          node = stack[--sp] as number;
        } else {
          node = near;
          if (df !== 1e30) stack[sp++] = far;
        }
      }
    }
    this.bestT = best;
    return prim;
  }

  /** Implicit function, gradient and parameter of a surf at a point of its local frame. */
  private evaluate(surf: number, x: number, y: number, z: number): void {
    const data = this.data;
    const p = data.surfParams;
    const o = 6 * surf;
    const kind = data.surfKind[surf] as number;
    if (kind === SURF_KIND.plane) {
      this.f = z;
      this.gx = 0;
      this.gy = 0;
      this.gz = 1;
      this.param = 0;
      return;
    }
    if (kind === SURF_KIND.capsule) {
      const zc = Math.min(Math.max(z, 0), p[o + 1] as number);
      const q = Math.hypot(x, y, z - zc);
      this.f = q - (p[o] as number);
      const inv = q > 0 ? 1 / q : 0;
      this.gx = x * inv;
      this.gy = y * inv;
      this.gz = (z - zc) * inv;
      this.param = zc;
      return;
    }
    const r = Math.hypot(x, y);
    const cx = r > 0 ? x / r : 1;
    const cy = r > 0 ? y / r : 0;
    if (kind === SURF_KIND.revLine) {
      const nr = p[o] as number;
      const nz = p[o + 1] as number;
      this.f = nr * r + nz * z - (p[o + 2] as number);
      this.gx = nr * cx;
      this.gy = nr * cy;
      this.gz = nz;
      this.param = (r - (p[o + 3] as number)) * -nz + (z - (p[o + 4] as number)) * nr;
      return;
    }
    // Revolved arc.
    const dr = r - (p[o] as number);
    const dzz = z - (p[o + 1] as number);
    const q = Math.hypot(dr, dzz);
    this.f = q - (p[o + 2] as number);
    const inv = q > 0 ? 1 / q : 0;
    this.gx = dr * inv * cx;
    this.gy = dr * inv * cy;
    this.gz = dzz * inv;
    const width = (data.surfMap[4 * surf + 3] as number) - (data.surfMap[4 * surf + 2] as number);
    let da = (Math.atan2(dzz, dr) - (p[o + 3] as number)) % TWO_PI;
    if (da < 0) da += TWO_PI;
    if (da > width + 0.5 * (TWO_PI - width)) da -= TWO_PI;
    this.param = da;
  }

  /** Corrects a triangle hit to its analytic piece and maps it to a block and a soil cell. */
  private shade(
    root: number,
    tri: number,
    t0: number,
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    tMax: number,
    out: TraceHit,
  ): void {
    const data = this.data;
    const R = this.rootFrames;
    const ro = 12 * root;
    // The ray in the root frame.
    const rox =
      (R[ro] as number) * ox +
      (R[ro + 1] as number) * oy +
      (R[ro + 2] as number) * oz +
      (R[ro + 3] as number);
    const roy =
      (R[ro + 4] as number) * ox +
      (R[ro + 5] as number) * oy +
      (R[ro + 6] as number) * oz +
      (R[ro + 7] as number);
    const roz =
      (R[ro + 8] as number) * ox +
      (R[ro + 9] as number) * oy +
      (R[ro + 10] as number) * oz +
      (R[ro + 11] as number);
    const rdx = (R[ro] as number) * dx + (R[ro + 1] as number) * dy + (R[ro + 2] as number) * dz;
    const rdy =
      (R[ro + 4] as number) * dx + (R[ro + 5] as number) * dy + (R[ro + 6] as number) * dz;
    const rdz =
      (R[ro + 8] as number) * dx + (R[ro + 9] as number) * dy + (R[ro + 10] as number) * dz;

    const F = data.frames;
    const maxStep = TRACE_NUMERICS.maxStepChords * data.chordError;
    // The correction never leaves this window about the triangle hit.
    const tLo = t0 - maxStep;
    const tHi = t0 + maxStep;
    const surf0 = data.triSurf[tri] as number;
    let surf = surf0;
    let t = t0;
    let fo = 0;
    let dlx = 0;
    let dly = 0;
    let dlz = 0;
    let olx = 0;
    let oly = 0;
    let olz = 0;
    const toLocal = (s: number): void => {
      fo = 12 * (data.surfFrame[s] as number);
      olx =
        (F[fo] as number) * rox +
        (F[fo + 1] as number) * roy +
        (F[fo + 2] as number) * roz +
        (F[fo + 3] as number);
      oly =
        (F[fo + 4] as number) * rox +
        (F[fo + 5] as number) * roy +
        (F[fo + 6] as number) * roz +
        (F[fo + 7] as number);
      olz =
        (F[fo + 8] as number) * rox +
        (F[fo + 9] as number) * roy +
        (F[fo + 10] as number) * roz +
        (F[fo + 11] as number);
      dlx = (F[fo] as number) * rdx + (F[fo + 1] as number) * rdy + (F[fo + 2] as number) * rdz;
      dly = (F[fo + 4] as number) * rdx + (F[fo + 5] as number) * rdy + (F[fo + 6] as number) * rdz;
      dlz =
        (F[fo + 8] as number) * rdx + (F[fo + 9] as number) * rdy + (F[fo + 10] as number) * rdz;
    };
    let inRange = true;
    for (let switches = 0; ; switches++) {
      toLocal(surf);
      const slope = -TRACE_NUMERICS.minSlope * Math.hypot(dlx, dly, dlz);
      // The reference takes four times the steps of the kernel; both stop when a step is nil.
      let back = data.chordError;
      for (let it = 0; it < 4 * TRACE_NUMERICS.newtonSteps; it++) {
        this.evaluate(surf, olx + t * dlx, oly + t * dly, olz + t * dlz);
        const denom = this.gx * dlx + this.gy * dly + this.gz * dlz;
        let step: number;
        if (denom < slope) {
          step = Math.min(maxStep, Math.max(-maxStep, -this.f / denom));
        } else if (this.f < 0) {
          // Inside the solid where the surface no longer faces the ray: a grazing ray met the
          // triangle beyond the middle of its chord through the solid. Retreat, further each
          // time, but never out of the window.
          step = -back;
          back *= 2;
        } else {
          break;
        }
        const next = Math.min(tHi, Math.max(tLo, t + step));
        if (Math.abs(next - t) < 1e-13) break;
        t = next;
      }
      this.evaluate(surf, olx + t * dlx, oly + t * dly, olz + t * dlz);
      const slack = data.surfParams[6 * surf + 5] as number;
      const prev = data.surfPrev[surf] as number;
      const next = data.surfNext[surf] as number;
      const below = this.param < (data.surfMap[4 * surf + 2] as number) - slack && prev !== NONE;
      const above = this.param > (data.surfMap[4 * surf + 3] as number) + slack && next !== NONE;
      inRange = !below && !above;
      if (inRange || switches >= TRACE_NUMERICS.maxSwitches) break;
      surf = below ? prev : next;
    }
    // The corrected hit stands only if it is on the piece, within its range and facing the ray.
    // Otherwise (a ray that grazes past the analytic surface but meets the mesh, a ray along a
    // wire that enters the mesh far from where it enters the surface) the hit is the one on the
    // triangle: its point and the normal of the triangle.
    const corrected =
      inRange &&
      Math.abs(this.f) <= TRACE_NUMERICS.acceptResidual &&
      this.gx * dlx + this.gy * dly + this.gz * dlz < 0;
    let grx: number;
    let gry: number;
    let grz: number;
    if (corrected) {
      // The gradient carried back to the root frame.
      grx =
        (F[fo] as number) * this.gx +
        (F[fo + 4] as number) * this.gy +
        (F[fo + 8] as number) * this.gz;
      gry =
        (F[fo + 1] as number) * this.gx +
        (F[fo + 5] as number) * this.gy +
        (F[fo + 9] as number) * this.gz;
      grz =
        (F[fo + 2] as number) * this.gx +
        (F[fo + 6] as number) * this.gy +
        (F[fo + 10] as number) * this.gz;
    } else {
      surf = surf0;
      t = t0;
      toLocal(surf);
      this.evaluate(surf, olx + t * dlx, oly + t * dly, olz + t * dlz);
      const v = data.triVerts;
      const q = 9 * tri;
      const e1x = (v[q + 3] as number) - (v[q] as number);
      const e1y = (v[q + 4] as number) - (v[q + 1] as number);
      const e1z = (v[q + 5] as number) - (v[q + 2] as number);
      const e2x = (v[q + 6] as number) - (v[q] as number);
      const e2y = (v[q + 7] as number) - (v[q + 1] as number);
      const e2z = (v[q + 8] as number) - (v[q + 2] as number);
      grx = e1y * e2z - e1z * e2y;
      gry = e1z * e2x - e1x * e2z;
      grz = e1x * e2y - e1y * e2x;
    }
    t = Math.min(tMax, Math.max(0, t));
    const lx = olx + t * dlx;
    const ly = oly + t * dly;
    const lz = olz + t * dlz;

    // Normal: from the root frame to the tub frame.
    let nx = (R[ro] as number) * grx + (R[ro + 4] as number) * gry + (R[ro + 8] as number) * grz;
    let ny =
      (R[ro + 1] as number) * grx + (R[ro + 5] as number) * gry + (R[ro + 9] as number) * grz;
    let nz =
      (R[ro + 2] as number) * grx + (R[ro + 6] as number) * gry + (R[ro + 10] as number) * grz;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    // Patch coordinates.
    const patch = data.triPatch[tri] as number;
    const coord = data.patchCoord;
    let a: number;
    let cb: number;
    const rowCount = data.patchRowCount[patch] as number;
    const kind = data.patchKind[patch] as number;
    let u = 0;
    let turn = 0;
    if (kind === PATCH_KIND.rev) {
      a = (data.surfMap[4 * surf] as number) + (data.surfMap[4 * surf + 1] as number) * this.param;
      turn = (Math.atan2(ly, lx) - (coord[4 * patch + 2] as number)) / TWO_PI;
      turn -= Math.floor(turn);
    } else {
      // A planar face. A hit on the face itself is mapped where it is; a hit on a rounded edge
      // of the face to its foot on the axis of the edge, a hit on a rounded corner to the centre
      // of the corner: the nearest point of the outline of the face, where the area of the edge
      // and of the corner is counted (`atlas-poly.ts`).
      let hx = rox + t * rdx;
      let hy = roy + t * rdy;
      let hz = roz + t * rdz;
      const surfKind = data.surfKind[surf] as number;
      if (surfKind !== SURF_KIND.plane) {
        const along =
          surfKind === SURF_KIND.revLine
            ? Math.min(data.surfMap[4 * surf + 3] as number, Math.max(0, lz))
            : 0;
        const px = -(F[fo + 3] as number);
        const py = -(F[fo + 7] as number);
        const pz = along - (F[fo + 11] as number);
        hx = (F[fo] as number) * px + (F[fo + 4] as number) * py + (F[fo + 8] as number) * pz;
        hy = (F[fo + 1] as number) * px + (F[fo + 5] as number) * py + (F[fo + 9] as number) * pz;
        hz = (F[fo + 2] as number) * px + (F[fo + 6] as number) * py + (F[fo + 10] as number) * pz;
      }
      const po = 12 * (data.patchFrame[patch] as number);
      u =
        (F[po] as number) * hx +
        (F[po + 1] as number) * hy +
        (F[po + 2] as number) * hz +
        (F[po + 3] as number);
      a =
        (F[po + 4] as number) * hx +
        (F[po + 5] as number) * hy +
        (F[po + 6] as number) * hz +
        (F[po + 7] as number);
    }
    const ra = (a - (coord[4 * patch] as number)) / (coord[4 * patch + 1] as number);
    const row = Math.min(rowCount - 1, Math.max(0, Math.floor(ra)));
    const rowIndex = 2 * ((data.patchRowStart[patch] as number) + row);
    const first = data.rows[rowIndex] as number;
    const cols = data.rows[rowIndex + 1] as number;
    if (kind === PATCH_KIND.rev) {
      const span = (coord[4 * patch + 3] as number) / TWO_PI;
      const f = turn <= span ? turn / span : turn - span < 0.5 * (1 - span) ? 1 : 0;
      cb = f * cols;
    } else {
      cb = (u - (coord[4 * patch + 2] as number)) / (coord[4 * patch + 3] as number);
    }
    const col = Math.min(cols - 1, Math.max(0, Math.floor(cb)));
    const block = data.cellBlock[first + col] as number;
    let soil = NONE;
    if (block !== NONE) {
      const base = data.blockSoil[block] as number;
      if (base !== NONE) {
        const code = data.cellQuarter[first + col] as number;
        const ha = quarterHalf(code & 3, Math.min(1, Math.max(0, ra - row)));
        const hb = quarterHalf((code >> 2) & 3, Math.min(1, Math.max(0, cb - col)));
        soil = base + 2 * ha + hb;
      }
    }
    const cosInc = -(dx * nx + dy * ny + dz * nz);
    out.t = t;
    out.block = block;
    out.soilCell = soil;
    out.triangle = tri;
    out.surf = surf;
    out.nx = nx;
    out.ny = ny;
    out.nz = nz;
    out.cosInc = Math.max(0, cosInc);
    out.residual = Math.abs(this.f);
    out.corrected = corrected;
  }
}
