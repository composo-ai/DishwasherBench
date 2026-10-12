/**
 * Expansion of the `'sor'` item class: a shell of revolution with an optional foot ring and
 * add-ons (handle loop, handle bar, stem and foot, knob, base disc, spout).
 *
 * Part ids: `body`; `foot` (foot ring, or the foot disc of stemware); `stem`; `knob`; `base`
 * (base disc); `spout`; handles are chains `handle.0`, `handle.1`, ... (a second handle is
 * `handle2.0`, ...). A loop handle is a lower arm, a quarter bend, a spine, a quarter bend and
 * an upper arm, in that order (an arm or the spine is left out when it has no length).
 *
 * Default surface regions, in priority order:
 *  - plate-like bodies (height under a fifth of the diameter): `rim` (food side of the last
 *    profile segment), `well` (the rest of the food side), `underside`;
 *  - other bodies: `rim` (both sides within 10 mm of the rim end, at most 15 % of the profile),
 *    `interior`, `exterior`;
 *  - then, for the parts that exist: `foot` (foot ring); `stem` and `foot`, `knob`, `base` and
 *    `spout` in the order of the add-ons; and `handle` last.
 *
 * Units: metres and radians.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { linkPart, quatFromAxes, requireNonNegative, requirePositive } from './expand-util.ts';
import { prepareProfile } from './sor-section.ts';
import type {
  BaseDiscAddon,
  HandleBarAddon,
  HandleLoopAddon,
  KnobAddon,
  Part,
  Shape,
  SorDef,
  SorProfilePoint,
  SpoutAddon,
  StemFootAddon,
  SurfaceRegion,
} from './types.ts';

const IDENTITY: Pose = { p: [0, 0, 0], q: [0, 0, 0, 1] };
/** A body is plate-like when its height is below this share of its diameter. */
const PLATE_ASPECT = 0.2;
/** Width of the default rim band of a deep body, metres, and its largest share of the profile. */
const RIM_BAND = 0.01;
const RIM_BAND_MAX_FRACTION = 0.15;

/** The wall of a profile where it crosses a given height. */
interface WallCrossing {
  /** Mid-surface radius, metres. */
  readonly r: number;
  /** Wall thickness, metres. */
  readonly t: number;
  /** Cosine of the wall's lean from the vertical there (1 for an upright wall). */
  readonly upright: number;
}

/** The outermost crossing of a profile with the height `z`. */
function wallAt(profile: readonly SorProfilePoint[], z: number, what: string): WallCrossing {
  let best: WallCrossing | undefined;
  for (let i = 0; i + 1 < profile.length; i++) {
    const a = profile[i] as SorProfilePoint;
    const b = profile[i + 1] as SorProfilePoint;
    if ((z < a.z && z < b.z) || (z > a.z && z > b.z)) continue;
    const l = a.z === b.z ? 0 : (z - a.z) / (b.z - a.z);
    const r = a.z === b.z ? Math.max(a.r, b.r) : a.r + l * (b.r - a.r);
    const t = a.t + l * (b.t - a.t);
    const upright = Math.abs(b.z - a.z) / Math.hypot(b.r - a.r, b.z - a.z);
    if (best === undefined || r > best.r) best = { r, t, upright };
  }
  if (best === undefined) {
    throw new RangeError(`geometry: ${what} is outside the height range of the body profile`);
  }
  if (best.upright < 0.2) {
    throw new RangeError(`geometry: ${what} meets the body where its wall is nearly level`);
  }
  return best;
}

/** Radial stretch of the body along the azimuth `phi` (1 for a round body). */
function stretchAlong(scale: readonly [number, number] | undefined, phi: number): number {
  if (scale === undefined) return 1;
  // Radius of the ellipse (sx cos(u), sy sin(u)) in the direction phi.
  return 1 / Math.hypot(Math.cos(phi) / scale[0], Math.sin(phi) / scale[1]);
}

/** Slack allowed where a foot ring meets the wall of the body, metres (a micrometre). */
const FOOT_RING_JOIN_TOLERANCE = 1e-6;

/**
 * Heights of the lower and the upper face of the body's wall at the radius `r`, measured
 * vertically, on the first stretch of the profile (from the axis outwards) that spans the
 * radius; null when none does or when that stretch is upright.
 */
function wallAbove(
  profile: readonly SorProfilePoint[],
  r: number,
): { under: number; over: number } | null {
  for (let i = 0; i + 1 < profile.length; i++) {
    const a = profile[i] as SorProfilePoint;
    const b = profile[i + 1] as SorProfilePoint;
    const lo = Math.min(a.r, b.r);
    const hi = Math.max(a.r, b.r);
    if (r < lo || r > hi || hi - lo < 1e-12) continue;
    const u = (r - a.r) / (b.r - a.r);
    const z = a.z + u * (b.z - a.z);
    const t = a.t + u * (b.t - a.t);
    // Half the thickness, measured vertically through a wall that slopes.
    const half = (t / 2) * (Math.hypot(b.r - a.r, b.z - a.z) / Math.abs(b.r - a.r));
    return { under: z - half, over: z + half };
  }
  return null;
}

/**
 * The foot ring: an annulus of the given mean radius, width and height standing on z = 0, with
 * its edges rounded all round (a stadium cross-section). Where its upper part lies inside the
 * base, the mass of that part is counted on top of the base's, which is how the estimator of
 * docs/research/items.md section 2.3 counts a foot ring (and what its fitted profiles assume).
 */
function footRingPart(def: SorDef): Part {
  const ring = def.footRing;
  if (ring === undefined) throw new Error('geometry: no foot ring');
  requirePositive(ring.r, 'foot ring radius');
  requirePositive(ring.width, 'foot ring width');
  requirePositive(ring.height, 'foot ring height');
  if (ring.r - ring.width / 2 < 0) {
    throw new RangeError('geometry: the foot ring is wider than its diameter');
  }
  // The ring stands on z = 0 and must end inside the wall of the body above it: one that
  // stops short of the underside is not attached, one that passes the upper face shows
  // through on the food side.
  const base = wallAbove(def.profile, ring.r);
  if (base !== null) {
    if (ring.height < base.under - FOOT_RING_JOIN_TOLERANCE) {
      throw new RangeError(
        `geometry: the foot ring is ${(ring.height * 1000).toFixed(2)} mm high and does not ` +
          `reach the underside of the body, ${(base.under * 1000).toFixed(2)} mm up at its radius`,
      );
    }
    if (ring.height > base.over + FOOT_RING_JOIN_TOLERANCE) {
      throw new RangeError(
        `geometry: the foot ring is ${(ring.height * 1000).toFixed(2)} mm high and comes ` +
          `through the body, whose upper face is ${(base.over * 1000).toFixed(2)} mm up at its radius`,
      );
    }
  }
  let profile: SorProfilePoint[];
  if (ring.height > ring.width + 1e-6) {
    // Taller than wide: a short wall with a rounded lower edge standing on z = 0.
    profile = [
      { r: ring.r, z: ring.width / 2, t: ring.width },
      { r: ring.r, z: ring.height - ring.width / 2, t: ring.width },
    ];
  } else {
    // Wider than tall: a flat annulus of the ring's height with rounded edges.
    const half = Math.max(5e-7, (ring.width - ring.height) / 2);
    profile = [
      { r: ring.r - half, z: ring.height / 2, t: ring.height },
      { r: ring.r + half, z: ring.height / 2, t: ring.height },
    ];
  }
  return {
    id: 'foot',
    prim:
      def.scaleXY === undefined
        ? { kind: 'sor', profile }
        : { kind: 'sor', profile, scaleXY: def.scaleXY },
    pose: IDENTITY,
    material: ring.material ?? def.material,
  };
}

/** Point of the meridian plane at azimuth `phi`: distance `rho` from the axis, height `z`. */
function meridianPoint(phi: number, rho: number, z: number): Vec3 {
  return [rho * Math.cos(phi), rho * Math.sin(phi), z];
}

/**
 * Where a handle of the given cross-section meets the wall at height `z`: the distance from the
 * axis of the end of its centreline, and of the outer wall surface. The end is sunk into the wall
 * as far as it can go without its rounded tip (radius `tipRadius`) showing on the inside: its
 * centre is kept `tipRadius` away from the inner surface, measured square to the wall.
 */
function attachment(
  def: SorDef,
  phi: number,
  z: number,
  tipRadius: number,
  what: string,
): { rho: number; outer: number } {
  const wall = wallAt(def.profile, z, what);
  const stretch = stretchAlong(def.scaleXY, phi);
  return {
    rho: (wall.r + Math.max(0, tipRadius - wall.t / 2) / wall.upright) * stretch,
    outer: (wall.r + wall.t / 2 / wall.upright) * stretch,
  };
}

function handleLoopParts(def: SorDef, addon: HandleLoopAddon, prefix: string): Part[] {
  const [z0, z1] = addon.attachZ;
  const [width, thickness] = addon.section;
  requirePositive(width, 'handle width');
  requirePositive(thickness, 'handle thickness');
  requirePositive(addon.reach, 'handle reach');
  if (!(z1 > z0)) throw new RangeError('geometry: handle_loop attachZ must be [lower, upper]');
  const phi = addon.azimuth ?? 0;
  const tip = Math.min(width, thickness) / 2;
  const lower = attachment(def, phi, z0, tip, 'handle_loop attachZ[0]');
  const upper = attachment(def, phi, z1, tip, 'handle_loop attachZ[1]');
  // The outer face of the handle is `reach` beyond the outer wall; its centreline half a
  // thickness inside that.
  const outerWall = Math.max(lower.outer, upper.outer);
  const rhoMax = outerWall + addon.reach - thickness / 2;
  const clearRadial = addon.reach - thickness;
  const clearVertical = z1 - z0 - thickness;
  if (!(clearRadial > 0) || !(clearVertical > 0)) {
    throw new RangeError(
      'geometry: handle_loop leaves no opening: reach and the attachZ span must both exceed the radial thickness',
    );
  }
  // A C with rounded corners: two level arms, a spine, and between them two quarter bends of
  // centreline radius c. The bends are partial shells of revolution about the axis through the
  // centre of the bend, across the handle, so they are true torus quarters with the handle's own
  // cross-section and meet the straight pieces flush.
  const limit = Math.min((z1 - z0) / 2, rhoMax - Math.max(lower.rho, upper.rho));
  const c = Math.min(limit, Math.max(0.8 * limit, thickness / 2));
  const radial: Vec3 = [Math.cos(phi), Math.sin(phi), 0];
  const tangential: Vec3 = [-Math.sin(phi), Math.cos(phi), 0];
  const across: Vec3 = [Math.sin(phi), -Math.cos(phi), 0]; // radial x up
  const section = { width, thickness };
  const material = addon.material ?? def.material;
  const parts: Part[] = [];
  const straight = (from: [number, number], to: [number, number]): void => {
    if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 1e-6) return;
    parts.push(
      linkPart(
        `${prefix}.${parts.length}`,
        material,
        meridianPoint(phi, from[0], from[1]),
        meridianPoint(phi, to[0], to[1]),
        tangential,
        section,
        section,
      ),
    );
  };
  // Cross-section of a bend in its own meridian plane (r from the bend axis, z across the
  // handle): a wall of the handle's thickness as long as the handle is wide, or, for a handle
  // that is thicker than wide, a flat ring of the handle's width.
  const bendProfile: SorProfilePoint[] =
    width >= thickness
      ? [
          { r: c, z: -Math.max(5e-7, (width - thickness) / 2), t: thickness },
          { r: c, z: Math.max(5e-7, (width - thickness) / 2), t: thickness },
        ]
      : [
          { r: c - (thickness - width) / 2, z: 0, t: width },
          { r: c + (thickness - width) / 2, z: 0, t: width },
        ];
  const bend = (zCentre: number, from: number, to: number): void => {
    parts.push({
      id: `${prefix}.${parts.length}`,
      prim: { kind: 'sor', profile: bendProfile, arc: [from, to] },
      // Part frame: x radially outward, y up, z across the handle; azimuth 0 is outward.
      pose: {
        p: meridianPoint(phi, rhoMax - c, zCentre),
        q: quatFromAxes(radial, [0, 0, 1], across),
      },
      material,
    });
  };
  straight([lower.rho, z0], [rhoMax - c, z0]);
  bend(z0 + c, -Math.PI / 2, 0);
  straight([rhoMax, z0 + c], [rhoMax, z1 - c]);
  bend(z1 - c, 0, Math.PI / 2);
  straight([rhoMax - c, z1], [upper.rho, z1]);
  return parts;
}

function handleBarParts(def: SorDef, addon: HandleBarAddon, prefix: string): Part[] {
  const [width, thickness] = addon.section;
  requirePositive(addon.length, 'handle length');
  const phi = addon.azimuth ?? 0;
  const elevation = addon.elevation ?? 0;
  const at = attachment(
    def,
    phi,
    addon.attachZ,
    Math.min(width, thickness) / 2,
    'handle_bar attachZ',
  );
  const from = meridianPoint(phi, at.rho, addon.attachZ);
  const to = meridianPoint(
    phi,
    at.outer + addon.length * Math.cos(elevation),
    addon.attachZ + addon.length * Math.sin(elevation),
  );
  const tangential: Vec3 = [-Math.sin(phi), Math.cos(phi), 0];
  const section = { width, thickness };
  return [
    linkPart(`${prefix}.0`, addon.material ?? def.material, from, to, tangential, section, section),
  ];
}

function stemFootParts(def: SorDef, addon: StemFootAddon): Part[] {
  requirePositive(addon.stemRadius, 'stem radius');
  requirePositive(addon.footRadius, 'foot radius');
  requirePositive(addon.footThickness, 'foot thickness');
  const material = addon.material ?? def.material;
  const start = def.profile[0] as SorProfilePoint;
  const top = start.z;
  if (!(top >= 2 * addon.stemRadius)) {
    throw new RangeError(
      'geometry: the bowl of a stemmed item must start at least a stem diameter above the foot',
    );
  }
  if (start.r !== 0) throw new Error('geometry: the bowl of a stemmed item is not closed');
  if (!(addon.footRadius > addon.footThickness / 2)) {
    throw new RangeError('geometry: the foot of a stem must be wider than it is thick');
  }
  const h = addon.footThickness;
  return [
    {
      id: 'stem',
      // The lower sphere rests on z = 0 inside the foot; the upper one ends on the mid-surface
      // of the floor of the bowl (see `closedForStem`), inside its thickness.
      prim: {
        kind: 'capsule',
        a: [0, 0, addon.stemRadius],
        b: [0, 0, top - addon.stemRadius],
        radius: addon.stemRadius,
      },
      pose: IDENTITY,
      material,
    },
    {
      id: 'foot',
      prim: {
        kind: 'sor',
        profile: [
          { r: 0, z: h / 2, t: h },
          { r: addon.footRadius - h / 2, z: h / 2, t: h },
        ],
      },
      pose: IDENTITY,
      material,
    },
  ];
}

function knobPart(def: SorDef, addon: KnobAddon): Part {
  requirePositive(addon.radius, 'knob radius');
  requirePositive(addon.height, 'knob height');
  const material = addon.material ?? def.material;
  if (addon.height >= 2 * addon.radius) {
    return {
      id: 'knob',
      prim: {
        kind: 'capsule',
        a: [0, 0, addon.z + addon.radius],
        b: [0, 0, addon.z + addon.height - addon.radius],
        radius: addon.radius,
      },
      pose: IDENTITY,
      material,
    };
  }
  // Lower than it is wide: a puck with a rounded edge.
  const mid = addon.z + addon.height / 2;
  return {
    id: 'knob',
    prim: {
      kind: 'sor',
      profile: [
        { r: 0, z: mid, t: addon.height },
        { r: addon.radius - addon.height / 2, z: mid, t: addon.height },
      ],
    },
    pose: IDENTITY,
    material,
  };
}

/**
 * The base disc: a puck with a rounded edge standing on z = 0 under the body, stretched with an
 * oval body like a foot ring.
 */
function baseDiscPart(def: SorDef, addon: BaseDiscAddon): Part {
  requirePositive(addon.radius, 'base disc radius');
  requirePositive(addon.thickness, 'base disc thickness');
  if (!(addon.radius > addon.thickness / 2)) {
    throw new RangeError('geometry: a base disc must be wider than it is thick');
  }
  const h = addon.thickness;
  const profile: SorProfilePoint[] = [
    { r: 0, z: h / 2, t: h },
    { r: addon.radius - h / 2, z: h / 2, t: h },
  ];
  return {
    id: 'base',
    prim:
      def.scaleXY === undefined
        ? { kind: 'sor', profile }
        : { kind: 'sor', profile, scaleXY: def.scaleXY },
    pose: IDENTITY,
    material: addon.material ?? def.material,
  };
}

function spoutPart(def: SorDef, addon: SpoutAddon): Part {
  requirePositive(addon.width, 'spout width');
  requirePositive(addon.reach, 'spout reach');
  const rim = def.profile[def.profile.length - 1] as SorProfilePoint;
  if (!(rim.r > 0)) throw new RangeError('geometry: a spout needs a rim away from the axis');
  // A lip in the plane of the rim: two points on the rim circle and a tip beyond it.
  const half = Math.min(Math.PI / 3, addon.width / (2 * rim.r));
  const [sx, sy] = def.scaleXY ?? [1, 1];
  const at = (phi: number, rho: number): Vec3 => [
    sx * rho * Math.cos(phi),
    sy * rho * Math.sin(phi),
    rim.z,
  ];
  return {
    id: 'spout',
    prim: {
      kind: 'hull',
      points: [
        at(addon.azimuth - half, rim.r),
        at(addon.azimuth + half, rim.r),
        at(addon.azimuth, rim.r + addon.reach),
      ],
      radius: rim.t / 2,
    },
    pose: IDENTITY,
    material: def.material,
  };
}

function defaultBodyRegions(def: SorDef): SurfaceRegion[] {
  const profile = prepareProfile(def.profile);
  let zMin = Number.POSITIVE_INFINITY;
  let zMax = Number.NEGATIVE_INFINITY;
  for (const p of def.profile) {
    zMin = Math.min(zMin, p.z);
    zMax = Math.max(zMax, p.z);
  }
  const plateLike = zMax - zMin < PLATE_ASPECT * 2 * profile.rMax;
  if (plateLike) {
    // The lip of a plate is its last profile segment.
    let lip = (profile.vertexS[profile.segmentCount - 1] as number) / profile.totalLength;
    if (!(lip > 0.05 && lip < 0.95)) lip = 1 - RIM_BAND_MAX_FRACTION;
    return [
      { id: 'rim', part: 'body', side: 'in', sRange: [lip, 1] },
      { id: 'well', part: 'body', side: 'in', sRange: [0, lip] },
      { id: 'underside', part: 'body', side: 'out' },
    ];
  }
  const band = Math.min(RIM_BAND, RIM_BAND_MAX_FRACTION * profile.totalLength);
  const start = 1 - band / profile.totalLength;
  return [
    { id: 'rim', part: 'body', sRange: [start, 1] },
    { id: 'interior', part: 'body', side: 'in', sRange: [0, start] },
    { id: 'exterior', part: 'body', side: 'out', sRange: [0, start] },
  ];
}

/** Expands a shell-of-revolution definition (see the module comment for ids and regions). */
/**
 * The definition with the bowl of a stemmed item closed: a profile that starts off the axis
 * (the dossier's stemware profiles start at the stem radius) is continued inwards to the axis
 * at its starting height and thickness, so that the bowl has a floor of its own material and
 * its own regions. (The top of the stem used to be what closed it: a dome of the stem's
 * radius, tagged 'stem', exactly where the wine pools.)
 */
function closedForStem(def: SorDef): SorDef {
  if (!(def.addons ?? []).some((addon) => addon.type === 'stem_foot')) return def;
  const start = def.profile[0];
  if (start === undefined || !(start.r > 0)) return def;
  return { ...def, profile: [{ r: 0, z: start.z, t: start.t }, ...def.profile] };
}

export function expandSor(given: SorDef): Shape {
  prepareProfile(given.profile); // validates the profile
  const def = closedForStem(given);
  if (def.porosity !== undefined) requireNonNegative(def.porosity, 'porosity');
  const body: Part = {
    id: 'body',
    prim:
      def.scaleXY === undefined
        ? { kind: 'sor', profile: def.profile }
        : { kind: 'sor', profile: def.profile, scaleXY: def.scaleXY },
    pose: IDENTITY,
    material: def.material,
    ...(def.porosity === undefined ? {} : { porosity: def.porosity }),
  };
  const parts: Part[] = [body];
  const regions: SurfaceRegion[] = defaultBodyRegions(def);
  const addons = def.addons ?? [];
  const hasStem = addons.some((a) => a.type === 'stem_foot');
  const hasBaseDisc = addons.some((a) => a.type === 'base_disc');
  if (def.footRing !== undefined) {
    if (hasStem)
      throw new RangeError('geometry: an item cannot have both a foot ring and a stem foot');
    if (hasBaseDisc)
      throw new RangeError('geometry: an item cannot have both a foot ring and a base disc');
    parts.push(footRingPart(def));
    regions.push({ id: 'foot', part: 'foot' });
  }
  if (hasStem && hasBaseDisc) {
    throw new RangeError('geometry: an item cannot have both a stem foot and a base disc');
  }
  let handles = 0;
  const single = new Set<string>();
  const once = (type: string): void => {
    if (single.has(type)) throw new RangeError(`geometry: at most one ${type} add-on is supported`);
    single.add(type);
  };
  for (const addon of addons) {
    switch (addon.type) {
      case 'handle_loop':
      case 'handle_bar': {
        handles++;
        const prefix = handles === 1 ? 'handle' : `handle${handles}`;
        parts.push(
          ...(addon.type === 'handle_loop'
            ? handleLoopParts(def, addon, prefix)
            : handleBarParts(def, addon, prefix)),
        );
        break;
      }
      case 'stem_foot':
        once('stem_foot');
        parts.push(...stemFootParts(def, addon));
        regions.push({ id: 'stem', part: 'stem' }, { id: 'foot', part: 'foot' });
        break;
      case 'knob':
        once('knob');
        parts.push(knobPart(def, addon));
        regions.push({ id: 'knob', part: 'knob' });
        break;
      case 'base_disc':
        once('base_disc');
        parts.push(baseDiscPart(def, addon));
        regions.push({ id: 'base', part: 'base' });
        break;
      case 'spout':
        once('spout');
        parts.push(spoutPart(def, addon));
        regions.push({ id: 'spout', part: 'spout' });
        break;
    }
  }
  if (handles > 0) regions.push({ id: 'handle', part: 'handle*' });
  return { parts, regions: def.regions ?? regions };
}
