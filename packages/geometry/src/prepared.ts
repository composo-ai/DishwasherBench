/**
 * Validated, pre-processed primitives shared by every derived product.
 *
 * Shapes are immutable plain data, so the work that only depends on a primitive (checking it,
 * packing a profile, building a cross-section boundary or a convex hull) is done once and cached
 * against the primitive object in a WeakMap. The public functions of the kernel stay pure
 * functions of `Shape`; the cache only makes repeated calls cheap.
 *
 * Units: metres and radians, part frame.
 */

import type { Vec3 } from '@spotless/core';
import { boxCorners, buildConvexCore, type ConvexCore } from './convex.ts';
import {
  buildSection,
  prepareProfile,
  type PreparedProfile,
  type SorSection,
} from './sor-section.ts';
import type {
  CapsulePrimitive,
  HullPrimitive,
  Primitive,
  RboxPrimitive,
  SorPrimitive,
} from './types.ts';

const TWO_PI = 2 * Math.PI;

/** The azimuth range of a partial shell of revolution. */
export interface ArcRange {
  /** Start and end azimuth, radians from +x towards +y, with `phi0 < phi1 < phi0 + 2 pi`. */
  readonly phi0: number;
  readonly phi1: number;
  /** Middle azimuth and half the angular span. */
  readonly mid: number;
  readonly halfSpan: number;
}

/** A checked shell of revolution. */
export interface PreparedSor {
  readonly kind: 'sor';
  readonly prim: SorPrimitive;
  readonly profile: PreparedProfile;
  /** Stretch along x and y. */
  readonly sx: number;
  readonly sy: number;
  /** `null` for a full turn. */
  readonly arc: ArcRange | null;
  /**
   * A sphere that contains the solid: centred on the axis at height `boundZ`, of radius
   * `boundRadius` (metres, part frame).
   */
  readonly boundZ: number;
  readonly boundRadius: number;
  /** The cross-section boundary, built on first use. */
  section(): SorSection;
}

/** A checked capsule. */
export interface PreparedCapsule {
  readonly kind: 'capsule';
  readonly prim: CapsulePrimitive;
  readonly a: Vec3;
  readonly b: Vec3;
  readonly radius: number;
  /** Distance between the two centres, metres. */
  readonly length: number;
}

/** A checked rounded box, with the hull of its inner box. */
export interface PreparedRbox {
  readonly kind: 'rbox';
  readonly prim: RboxPrimitive;
  readonly halfExtents: Vec3;
  readonly radius: number;
  core(): ConvexCore;
}

/** A checked rounded hull. */
export interface PreparedHull {
  readonly kind: 'hull';
  readonly prim: HullPrimitive;
  readonly radius: number;
  readonly core: ConvexCore;
}

/** A checked primitive. */
export type PreparedPrimitive = PreparedSor | PreparedCapsule | PreparedRbox | PreparedHull;

const cache = new WeakMap<Primitive, PreparedPrimitive>();

function finite3(v: Vec3): boolean {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

function prepareSor(prim: SorPrimitive): PreparedSor {
  const profile = prepareProfile(prim.profile);
  const sx = prim.scaleXY?.[0] ?? 1;
  const sy = prim.scaleXY?.[1] ?? 1;
  if (!(sx > 0) || !(sy > 0) || !Number.isFinite(sx) || !Number.isFinite(sy)) {
    throw new RangeError('geometry: sor scaleXY must be two finite numbers above zero');
  }
  let arc: ArcRange | null = null;
  if (prim.arc !== undefined) {
    const [phi0, phi1] = prim.arc;
    if (!Number.isFinite(phi0) || !Number.isFinite(phi1) || !(phi1 > phi0)) {
      throw new RangeError('geometry: sor arc must be [phi0, phi1] with phi1 > phi0');
    }
    if (phi1 - phi0 < TWO_PI - 1e-12) {
      arc = { phi0, phi1, mid: 0.5 * (phi0 + phi1), halfSpan: 0.5 * (phi1 - phi0) };
    }
  }
  let zMin = Number.POSITIVE_INFINITY;
  let zMax = Number.NEGATIVE_INFINITY;
  for (const p of prim.profile) {
    zMin = Math.min(zMin, p.z - p.t / 2);
    zMax = Math.max(zMax, p.z + p.t / 2);
  }
  const rOuter = (profile.rMax + profile.rhoMax) * Math.max(sx, sy);
  let section: SorSection | undefined;
  return {
    kind: 'sor',
    prim,
    profile,
    sx,
    sy,
    arc,
    boundZ: 0.5 * (zMin + zMax),
    boundRadius: Math.hypot(rOuter, 0.5 * (zMax - zMin)),
    section: () => {
      section ??= buildSection(profile);
      return section;
    },
  };
}

function prepareCapsule(prim: CapsulePrimitive): PreparedCapsule {
  if (!finite3(prim.a) || !finite3(prim.b)) {
    throw new RangeError('geometry: capsule end point is not finite');
  }
  if (!(prim.radius > 0) || !Number.isFinite(prim.radius)) {
    throw new RangeError('geometry: a capsule needs a finite radius above zero');
  }
  const length = Math.hypot(prim.b[0] - prim.a[0], prim.b[1] - prim.a[1], prim.b[2] - prim.a[2]);
  return { kind: 'capsule', prim, a: prim.a, b: prim.b, radius: prim.radius, length };
}

function prepareRbox(prim: RboxPrimitive): PreparedRbox {
  const h = prim.halfExtents;
  if (!finite3(h) || h[0] < 0 || h[1] < 0 || h[2] < 0) {
    throw new RangeError('geometry: rbox half extents must be finite and not negative');
  }
  if (!(prim.radius >= 0) || !Number.isFinite(prim.radius)) {
    throw new RangeError('geometry: rbox radius must be finite and not negative');
  }
  if (prim.radius === 0 && Math.min(h[0], h[1], h[2]) === 0) {
    throw new RangeError('geometry: an rbox without rounding needs three half extents above zero');
  }
  let core: ConvexCore | undefined;
  return {
    kind: 'rbox',
    prim,
    halfExtents: h,
    radius: prim.radius,
    core: () => {
      core ??= buildConvexCore(boxCorners(h));
      return core;
    },
  };
}

function prepareHull(prim: HullPrimitive): PreparedHull {
  if (!(prim.radius >= 0) || !Number.isFinite(prim.radius)) {
    throw new RangeError('geometry: hull radius must be finite and not negative');
  }
  const core = buildConvexCore(prim.points);
  if (core.dim < 3 && prim.radius === 0) {
    throw new RangeError('geometry: a hull of coplanar points needs a radius above zero');
  }
  return { kind: 'hull', prim, radius: prim.radius, core };
}

/**
 * Checks a primitive and returns its prepared form (cached per primitive object). Throws a
 * RangeError when the primitive is malformed: these are data or programmer errors, never player
 * errors.
 */
export function preparePrimitive(prim: Primitive): PreparedPrimitive {
  let prepared = cache.get(prim);
  if (prepared === undefined) {
    switch (prim.kind) {
      case 'sor':
        prepared = prepareSor(prim);
        break;
      case 'capsule':
        prepared = prepareCapsule(prim);
        break;
      case 'rbox':
        prepared = prepareRbox(prim);
        break;
      case 'hull':
        prepared = prepareHull(prim);
        break;
    }
    cache.set(prim, prepared);
  }
  return prepared;
}

/**
 * Number of angular sectors per full turn for a circle of radius `radius` (metres) at chord error
 * `chordError` (metres): `max(minSectors, ceil(pi / acos(1 - chordError / radius)))`, the rule of
 * docs/design/platform.md section 4.2. A radius no larger than the chord error needs only the
 * minimum.
 */
export function sectorCount(radius: number, chordError: number, minSectors: number): number {
  if (!(chordError > 0) || !Number.isFinite(chordError)) {
    throw new RangeError('geometry: chordError must be a finite number above zero');
  }
  if (!(minSectors >= 3) || !Number.isInteger(minSectors)) {
    throw new RangeError('geometry: minSectors must be an integer of at least 3');
  }
  if (!(radius > chordError)) return minSectors;
  return Math.max(minSectors, Math.ceil(Math.PI / Math.acos(1 - chordError / radius)));
}

/**
 * Largest angular step (radians) with which an arc of radius `radius` may be faceted for the
 * chord to stay within `chordError` of it, capped at `cap`.
 */
export function arcStep(radius: number, chordError: number, cap: number): number {
  if (!(radius > chordError)) return cap;
  return Math.min(cap, 2 * Math.acos(1 - chordError / radius));
}
