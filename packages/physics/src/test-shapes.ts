/**
 * Shapes and scenes for this package's tests and benchmark only (not exported from the package
 * entry point). Everything is built directly as collision pieces, independently of
 * `@spotless/geometry`, from the dimensions used in the rigid-body bake-off
 * (docs/research/spike-rigid-body.md): a 260 mm plate, a 160 mm bowl, a 70 mm tumbler, a mug,
 * cutlery, a 0.5 m wire rack with 4 mm wires and 63 mm tines, and a cutlery basket.
 *
 * Units: SI. Frames: z up. Items follow the item-frame convention of the platform (z = 0 is the
 * plane an upright item rests on, shells of revolution have their axis along +z). The rack is
 * given in a rack frame whose origin is at the centre of the base grid at the level of its top
 * surface, x to the right, y to the back.
 */

import type { Mat3, Pose, Quat, Vec3 } from '@spotless/core';
import {
  inertiaShiftFromCom,
  inertiaShiftToCom,
  mat3Add,
  mat3FromDiagonal,
  quatFromAxisAngle,
  quatMul,
  quatRotate,
  v3Add,
  v3Scale,
} from '@spotless/core';
import type {
  CollisionBox,
  CollisionCapsule,
  CollisionHull,
  CollisionPiece,
  MassProperties,
} from '@spotless/geometry';
import type { ContactPairLookup } from './types.ts';

/** One vertex of a mid-surface profile: radius, height and wall thickness, metres. */
export interface ProfilePoint {
  readonly r: number;
  readonly z: number;
  readonly t: number;
}

/** An item for the tests: its collision pieces and mass properties in the item frame. */
export interface TestItem {
  readonly name: string;
  readonly pieces: readonly CollisionPiece[];
  readonly mass: MassProperties;
  /** Largest radius about the z axis, metres (shells of revolution). */
  readonly radius: number;
  /** Height above z = 0, metres. */
  readonly height: number;
}

const DEG = Math.PI / 180;

/** Catalogue-style material ids used by the test scenes. */
export const TEST_MATERIALS = {
  ceramic: 'porcelain_glazed',
  glass: 'glass_soda_lime',
  steel: 'stainless_steel',
  wire: 'rack_wire_pa11',
  plastic: 'polypropylene',
} as const;

/**
 * Pair coefficients of the bake-off: friction 0.4 and restitution 0.1 for every pair
 * (docs/research/spike-rigid-body.md), with the rolling and spin resistance lengths the
 * catalogue gives an item on coated wire (docs/research/items.md section 3.6: 0.2 mm and
 * 1.5 mm). The resistance is what brings a rocking piece of cutlery to rest.
 */
export const BAKE_OFF_PAIR: ContactPairLookup = () => ({
  friction: 0.4,
  restitution: 0.1,
  rollingResistance: 2e-4,
  spinResistance: 1.5e-3,
});

/**
 * Rounded convex quads of a shell of revolution about +z: one piece per profile segment and
 * angular sector, with the four mid-surface corners as points and half the mean wall thickness
 * as radius (three points where the segment starts on the axis).
 */
export function sorPieces(
  profile: readonly ProfilePoint[],
  sectors: number,
  part: string,
  phase = 0,
): CollisionHull[] {
  const out: CollisionHull[] = [];
  const at = (p: ProfilePoint, phi: number): Vec3 => [
    p.r * Math.cos(phi),
    p.r * Math.sin(phi),
    p.z,
  ];
  for (let k = 0; k + 1 < profile.length; k++) {
    const a = profile[k] as ProfilePoint;
    const b = profile[k + 1] as ProfilePoint;
    for (let j = 0; j < sectors; j++) {
      const phi0 = phase + (2 * Math.PI * j) / sectors;
      const phi1 = phase + (2 * Math.PI * (j + 1)) / sectors;
      const points: Vec3[] = [];
      if (a.r > 0) points.push(at(a, phi0), at(a, phi1));
      else points.push([0, 0, a.z]);
      if (b.r > 0) points.push(at(b, phi1), at(b, phi0));
      else points.push([0, 0, b.z]);
      out.push({ kind: 'hull', part, points, radius: (a.t + b.t) / 4 });
    }
  }
  return out;
}

/**
 * Thin-shell mass properties of one or more shells of revolution of uniform material: every
 * profile segment is a conical band of area density proportional to its mean thickness. The
 * integrals are evaluated with Simpson's rule, which is exact for these cubic integrands. The
 * result is scaled to `mass` (kg); the inertia is about the centre of mass, kg m^2.
 */
export function shellMassProperties(
  profiles: readonly (readonly ProfilePoint[])[],
  mass: number,
): MassProperties {
  let m0 = 0;
  let mz = 0;
  let izz = 0;
  let ixx = 0;
  const simpson = (f: (s: number) => number): number => (f(0) + 4 * f(0.5) + f(1)) / 6;
  for (const profile of profiles) {
    for (let k = 0; k + 1 < profile.length; k++) {
      const a = profile[k] as ProfilePoint;
      const b = profile[k + 1] as ProfilePoint;
      const length = Math.hypot(b.r - a.r, b.z - a.z);
      const weight = 2 * Math.PI * length * ((a.t + b.t) / 2);
      const r = (s: number): number => a.r + (b.r - a.r) * s;
      const z = (s: number): number => a.z + (b.z - a.z) * s;
      m0 += weight * simpson((s) => r(s));
      mz += weight * simpson((s) => r(s) * z(s));
      izz += weight * simpson((s) => r(s) ** 3);
      ixx += weight * simpson((s) => r(s) * (r(s) ** 2 / 2 + z(s) ** 2));
    }
  }
  const scale = mass / m0;
  const zc = mz / m0;
  const transverse = scale * ixx - mass * zc * zc;
  return {
    mass,
    com: [0, 0, zc],
    inertia: mat3FromDiagonal([transverse, transverse, scale * izz]),
  };
}

/** A solid box of uniform density as a point of a composite body. */
export interface MassBox {
  readonly centre: Vec3;
  readonly halfExtents: Vec3;
  readonly mass: number;
}

/** Mass properties of a set of axis-aligned solid boxes (parallel-axis theorem), about their COM. */
export function boxesMassProperties(boxes: readonly MassBox[]): MassProperties {
  let mass = 0;
  let com: Vec3 = [0, 0, 0];
  for (const box of boxes) {
    mass += box.mass;
    com = v3Add(com, v3Scale(box.centre, box.mass));
  }
  com = v3Scale(com, 1 / mass);
  let aboutOrigin: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const box of boxes) {
    const [hx, hy, hz] = box.halfExtents;
    const own = mat3FromDiagonal([
      (box.mass * (hy * hy + hz * hz)) / 3,
      (box.mass * (hx * hx + hz * hz)) / 3,
      (box.mass * (hx * hx + hy * hy)) / 3,
    ]);
    aboutOrigin = mat3Add(aboutOrigin, inertiaShiftFromCom(own, box.mass, box.centre));
  }
  return { mass, com, inertia: inertiaShiftToCom(aboutOrigin, mass, com) };
}

// ---------------------------------------------------------------------------------------------
// Tableware
// ---------------------------------------------------------------------------------------------

/** Mid-surface profile of the 260 mm dinner plate: flat well, cavetto, sloped lip. */
export const PLATE_PROFILE: readonly ProfilePoint[] = [
  { r: 0, z: 0.0055, t: 0.005 },
  { r: 0.085, z: 0.0055, t: 0.005 },
  { r: 0.1, z: 0.0145, t: 0.005 },
  { r: 0.128, z: 0.022, t: 0.004 },
];
/** Foot ring of the plate: a 3 mm wide ring standing on z = 0. */
export const PLATE_FOOT: readonly ProfilePoint[] = [
  { r: 0.079, z: 0.0015, t: 0.003 },
  { r: 0.079, z: 0.0035, t: 0.003 },
];

/** Dinner plate, 260 mm, 0.65 kg, with `sectors` angular sectors (36 in the bake-off's best). */
export function makePlate(sectors = 36): TestItem {
  return {
    name: `plate${sectors}`,
    pieces: [
      ...sorPieces(PLATE_PROFILE, sectors, 'body'),
      ...sorPieces(PLATE_FOOT, sectors, 'foot'),
    ],
    mass: shellMassProperties([PLATE_PROFILE, PLATE_FOOT], 0.65),
    radius: 0.13,
    height: 0.024,
  };
}

/** Parameters of the soup bowl: elliptic wall from the base radius to the rim, 4 mm thick. */
export const BOWL = {
  baseRadius: 0.038,
  baseZ: 0.003,
  rimRadius: 0.08,
  rimZ: 0.065,
  thetaMax: 75 * DEG,
  thickness: 0.004,
} as const;

/** Mid-surface profile of the bowl with `wallSegments` segments along the wall. */
export function bowlProfile(wallSegments = 5): ProfilePoint[] {
  const { baseRadius, baseZ, rimRadius, rimZ, thetaMax, thickness } = BOWL;
  const a = (rimRadius - baseRadius) / Math.sin(thetaMax);
  const b = (rimZ - baseZ) / (1 - Math.cos(thetaMax));
  const out: ProfilePoint[] = [{ r: 0, z: baseZ + thickness / 2, t: thickness }];
  for (let i = 0; i <= wallSegments; i++) {
    const theta = (thetaMax * i) / wallSegments;
    // Point of the outer surface and the inward normal there; the mid-surface is half a wall in.
    const outer = [baseRadius + a * Math.sin(theta), baseZ + b * (1 - Math.cos(theta))] as const;
    const tangent = [a * Math.cos(theta), b * Math.sin(theta)] as const;
    const length = Math.hypot(tangent[0], tangent[1]);
    out.push({
      r: outer[0] - (tangent[1] / length) * (thickness / 2),
      z: outer[1] + (tangent[0] / length) * (thickness / 2),
      t: thickness,
    });
  }
  return out;
}
/** Foot ring of the bowl. */
export const BOWL_FOOT: readonly ProfilePoint[] = [
  { r: 0.033, z: 0.0015, t: 0.003 },
  { r: 0.033, z: 0.0035, t: 0.003 },
];

/** Soup bowl, 160 mm, 0.35 kg. */
export function makeBowl(sectors = 24, wallSegments = 5, phase = 0): TestItem {
  const profile = bowlProfile(wallSegments);
  const top = profile[profile.length - 1] as ProfilePoint;
  return {
    name: `bowl${sectors}x${wallSegments}`,
    pieces: [
      ...sorPieces(profile, sectors, 'body', phase),
      ...sorPieces(BOWL_FOOT, sectors, 'foot', phase),
    ],
    mass: shellMassProperties([profile, BOWL_FOOT], 0.35),
    radius: top.r + top.t / 2,
    height: top.z + top.t / 2,
  };
}

/** Distance between two segments of the (r, z) half-plane, each `a` to `b`. */
function segmentDistance2(
  a0: readonly [number, number],
  a1: readonly [number, number],
  b0: readonly [number, number],
  b1: readonly [number, number],
): number {
  const pointSegment = (
    p: readonly [number, number],
    s0: readonly [number, number],
    s1: readonly [number, number],
  ): number => {
    const dx = s1[0] - s0[0];
    const dy = s1[1] - s0[1];
    const l2 = dx * dx + dy * dy;
    const u =
      l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - s0[0]) * dx + (p[1] - s0[1]) * dy) / l2));
    return Math.hypot(p[0] - s0[0] - u * dx, p[1] - s0[1] - u * dy);
  };
  const cross = (
    o: readonly [number, number],
    p: readonly [number, number],
    q: readonly [number, number],
  ): number => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(a0, a1, b0);
  const d2 = cross(a0, a1, b1);
  const d3 = cross(b0, b1, a0);
  const d4 = cross(b0, b1, a1);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(
    pointSegment(a0, b0, b1),
    pointSegment(a1, b0, b1),
    pointSegment(b0, a0, a1),
    pointSegment(b1, a0, a1),
  );
}

/**
 * Gap between two coaxial copies of a shell of revolution, the second raised by `lift`: the
 * smallest distance between their thick profiles in a meridian plane (negative when they
 * overlap). For coaxial solids of revolution the closest points lie in a common meridian plane.
 */
export function nestGap(profiles: readonly (readonly ProfilePoint[])[], lift: number): number {
  let gap = Infinity;
  for (const lower of profiles) {
    for (const upper of profiles) {
      for (let i = 0; i + 1 < lower.length; i++) {
        const a0 = lower[i] as ProfilePoint;
        const a1 = lower[i + 1] as ProfilePoint;
        for (let j = 0; j + 1 < upper.length; j++) {
          const b0 = upper[j] as ProfilePoint;
          const b1 = upper[j + 1] as ProfilePoint;
          const d = segmentDistance2(
            [a0.r, a0.z],
            [a1.r, a1.z],
            [b0.r, b0.z + lift],
            [b1.r, b1.z + lift],
          );
          gap = Math.min(gap, d - (a0.t + a1.t) / 4 - (b0.t + b1.t) / 4);
        }
      }
    }
  }
  return gap;
}

/**
 * Geometric nest spacing of two identical coaxial shells of revolution: the smallest lift at
 * which the upper one no longer overlaps the lower one, found by bisection to 1e-9 m.
 */
export function idealNestSpacing(profiles: readonly (readonly ProfilePoint[])[]): number {
  let lo = 0;
  let hi = 0.2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (nestGap(profiles, mid) < 0) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Mid-surface profile of the tumbler: 5 mm base, 2 mm wall, 70 mm across, 130 mm tall. */
export const TUMBLER_PROFILE: readonly ProfilePoint[] = [
  { r: 0, z: 0.0025, t: 0.005 },
  { r: 0.034, z: 0.0025, t: 0.005 },
];
/** Wall of the tumbler. */
export const TUMBLER_WALL: readonly ProfilePoint[] = [
  { r: 0.034, z: 0.001, t: 0.002 },
  { r: 0.034, z: 0.129, t: 0.002 },
];

/** Tumbler, 70 mm across and 130 mm tall, 0.15 kg. */
export function makeTumbler(sectors = 16): TestItem {
  return {
    name: `tumbler${sectors}`,
    pieces: [
      ...sorPieces(TUMBLER_PROFILE, sectors, 'base'),
      ...sorPieces(TUMBLER_WALL, sectors, 'wall'),
    ],
    mass: shellMassProperties([TUMBLER_PROFILE, TUMBLER_WALL], 0.15),
    radius: 0.035,
    height: 0.13,
  };
}

/** Mug, 82 mm across and 95 mm tall with a C-shaped handle of three capsules, 0.32 kg. */
export function makeMug(sectors = 16): TestItem {
  const base: ProfilePoint[] = [
    { r: 0, z: 0.003, t: 0.006 },
    { r: 0.039, z: 0.003, t: 0.006 },
  ];
  const wall: ProfilePoint[] = [
    { r: 0.039, z: 0.002, t: 0.004 },
    { r: 0.039, z: 0.093, t: 0.004 },
  ];
  const handle: CollisionCapsule[] = [
    { kind: 'capsule', part: 'handle', a: [0.04, 0, 0.022], b: [0.064, 0, 0.022], radius: 0.005 },
    { kind: 'capsule', part: 'handle', a: [0.064, 0, 0.022], b: [0.064, 0, 0.072], radius: 0.005 },
    { kind: 'capsule', part: 'handle', a: [0.064, 0, 0.072], b: [0.04, 0, 0.072], radius: 0.005 },
  ];
  return {
    name: `mug${sectors}`,
    pieces: [
      ...sorPieces(base, sectors, 'base'),
      ...sorPieces(wall, sectors, 'wall', Math.PI / sectors),
      ...handle,
    ],
    // The handle is a few per cent of the mass; the shell alone sets the mass properties here.
    mass: shellMassProperties([base, wall], 0.32),
    radius: 0.041,
    height: 0.095,
  };
}

// ---------------------------------------------------------------------------------------------
// Cutlery. Item frame: long axis +y (handle end at negative y), width x, thickness z, lying on
// z = 0.
// ---------------------------------------------------------------------------------------------

function slab(
  part: string,
  y0: number,
  w0: number,
  y1: number,
  w1: number,
  thickness: number,
  x0 = 0,
  x1 = 0,
  z0 = 0,
  z1 = 0,
): CollisionHull {
  // A flat rounded quad: the mid-plane outline as core, half the thickness as radius.
  const r = thickness / 2;
  return {
    kind: 'hull',
    part,
    radius: r,
    points: [
      [x0 - w0 / 2 + r, y0 + r, z0 + r],
      [x0 + w0 / 2 - r, y0 + r, z0 + r],
      [x1 + w1 / 2 - r, y1 - r, z1 + r],
      [x1 - w1 / 2 + r, y1 - r, z1 + r],
    ],
  };
}

/**
 * Table knife, 220 mm, 80 g: a rounded-box handle and a wedge blade whose cutting edge (at -x)
 * is 0.5 mm thick and whose spine is 2 mm thick.
 */
export function makeKnife(): TestItem {
  const handle: CollisionBox = {
    kind: 'box',
    part: 'handle',
    halfExtents: [0.007, 0.049, 0.003],
    radius: 0.001,
    pose: { p: [0, -0.06, 0.004], q: [0, 0, 0, 1] },
  };
  // Blade core: the wedge shrunk by the 0.2 mm rounding radius.
  const r = 0.0002;
  const edge = 0.00025 - r;
  const spine = 0.001 - r;
  const zc = 0.004;
  const loop = (y: number, xEdge: number, xSpine: number, taper = 1): Vec3[] => [
    [xEdge + r, y, zc - edge * taper],
    [xEdge + r, y, zc + edge * taper],
    [xSpine - r, y, zc - spine * taper],
    [xSpine - r, y, zc + spine * taper],
  ];
  const blade: CollisionHull = {
    kind: 'hull',
    part: 'blade',
    radius: r,
    points: [...loop(-0.01, -0.01, 0.01), ...loop(0.08, -0.01, 0.01)],
  };
  const tip: CollisionHull = {
    kind: 'hull',
    part: 'blade',
    radius: r,
    points: [...loop(0.08, -0.01, 0.01), ...loop(0.11 - r, 0.004, 0.01)],
  };
  return {
    name: 'knife',
    pieces: [handle, blade, tip],
    mass: boxesMassProperties([
      { centre: [0, -0.06, 0.004], halfExtents: [0.008, 0.05, 0.004], mass: 0.05 },
      { centre: [0, 0.05, 0.004], halfExtents: [0.01, 0.06, 0.0007], mass: 0.03 },
    ]),
    radius: 0.11,
    height: 0.008,
  };
}

/** Table fork, 200 mm, 45 g: handle, neck, shoulder and four separate tines. */
export function makeFork(): TestItem {
  const pieces: CollisionPiece[] = [
    slab('handle', -0.1, 0.012, -0.02, 0.009, 0.003),
    slab('neck', -0.02, 0.009, 0.025, 0.007, 0.003, 0, 0, 0, 0.002),
    slab('shoulder', 0.025, 0.007, 0.05, 0.024, 0.0024, 0, 0, 0.002, 0.004),
  ];
  const tineWidth = 0.004;
  const gap = (0.024 - 4 * tineWidth) / 3;
  for (let i = 0; i < 4; i++) {
    const x = -0.012 + tineWidth / 2 + i * (tineWidth + gap);
    pieces.push({
      kind: 'capsule',
      part: 'tines',
      a: [x, 0.05, 0.005],
      b: [x, 0.099, 0.0095],
      radius: 0.001,
    });
  }
  return {
    name: 'fork',
    pieces,
    mass: boxesMassProperties([
      { centre: [0, -0.06, 0.0015], halfExtents: [0.0055, 0.04, 0.0015], mass: 0.022 },
      { centre: [0, 0.0025, 0.0025], halfExtents: [0.004, 0.0225, 0.0015], mass: 0.008 },
      { centre: [0, 0.0625, 0.006], halfExtents: [0.012, 0.0375, 0.0012], mass: 0.015 },
    ]),
    radius: 0.1,
    height: 0.0105,
  };
}

/** Table spoon, 190 mm, 45 g: handle, neck and a dished bowl of a flat centre and 8 rim panels. */
export function makeSpoon(): TestItem {
  const pieces: CollisionPiece[] = [
    slab('handle', -0.095, 0.012, -0.02, 0.009, 0.003),
    slab('neck', -0.02, 0.009, 0.03, 0.007, 0.003, 0, 0, 0, 0.003),
  ];
  const cy = 0.06;
  const panels = 8;
  const r = 0.0008;
  const ring = (fx: number, fy: number, z: number): Vec3[] => {
    const out: Vec3[] = [];
    for (let i = 0; i < panels; i++) {
      const phi = (2 * Math.PI * (i + 0.5)) / panels;
      out.push([fx * Math.cos(phi), cy + fy * Math.sin(phi), z]);
    }
    return out;
  };
  const inner = ring(0.0112, 0.016, r);
  const outer = ring(0.0202, 0.0292, 0.008 + r);
  pieces.push({ kind: 'hull', part: 'bowl', points: inner, radius: r });
  for (let i = 0; i < panels; i++) {
    const j = (i + 1) % panels;
    pieces.push({
      kind: 'hull',
      part: 'bowl',
      radius: r,
      points: [inner[i] as Vec3, inner[j] as Vec3, outer[j] as Vec3, outer[i] as Vec3],
    });
  }
  return {
    name: 'spoon',
    pieces,
    mass: boxesMassProperties([
      { centre: [0, -0.0575, 0.0015], halfExtents: [0.0055, 0.0375, 0.0015], mass: 0.022 },
      { centre: [0, 0.005, 0.003], halfExtents: [0.004, 0.025, 0.0015], mass: 0.008 },
      { centre: [0, 0.06, 0.005], halfExtents: [0.02, 0.03, 0.004], mass: 0.015 },
    ]),
    radius: 0.095,
    height: 0.0096,
  };
}

/** Chopstick, 240 mm long and 6 mm across, 6 g: the rod-like body of the items dossier. */
export function makeChopstick(): TestItem {
  const radius = 0.003;
  const half = 0.117;
  const mass = 0.006;
  const axial = (mass * radius * radius) / 2;
  const transverse = (mass * (2 * half + 2 * radius) ** 2) / 12;
  return {
    name: 'chopstick',
    pieces: [{ kind: 'capsule', part: 'rod', a: [0, -half, radius], b: [0, half, radius], radius }],
    mass: { mass, com: [0, 0, radius], inertia: mat3FromDiagonal([transverse, axial, transverse]) },
    radius: half + radius,
    height: 2 * radius,
  };
}

// ---------------------------------------------------------------------------------------------
// Rack, shelf and basket (static)
// ---------------------------------------------------------------------------------------------

/** Dimensions of the test rack, metres. */
export const RACK = {
  /** Half of the 0.5 m square footprint. */
  half: 0.25,
  /** Radius of the 4 mm coated wires. */
  wireRadius: 0.002,
  frameRadius: 0.003,
  /** Pitch in x of the upper base wires, which run along y. */
  baseWirePitch: 0.032,
  /** Pitch in y of the tine rows (and of the lower base wires that carry them). */
  rowPitch: 0.04,
  /** Pitch in x of the tines of one row. */
  tinePitch: 0.032,
  /** Height of the tine tips above the top of the base grid. */
  tineHeight: 0.063,
  /** y of the first tine row. */
  firstRowY: -0.24,
  rows: 13,
  tinesPerRow: 15,
} as const;

/** Options of {@link makeRack}. */
export interface RackOptions {
  /** Include tines (default true). */
  readonly tines?: boolean;
  /** Keeps only the tines for which it returns true (x of the tine, index of its row). */
  readonly tineFilter?: (x: number, row: number) => boolean;
  /** Number of collinear capsules each long wire is cut into (default 1). */
  readonly segments?: number;
  /** Translation applied to everything, metres. */
  readonly origin?: Vec3;
}

/**
 * The wire rack as capsules: sixteen upper wires along y, thirteen lower wires along x each
 * carrying a row of fifteen tines, and a perimeter frame with a flared upper rail. Parts are
 * named `base_y`, `base_x`, `tine_row_<k>` and `frame`.
 */
export function makeRack(options: RackOptions = {}): CollisionCapsule[] {
  const { tines = true, tineFilter, segments = 1, origin = [0, 0, 0] } = options;
  const out: CollisionCapsule[] = [];
  const R = RACK;
  const upperZ = -R.wireRadius;
  const lowerZ = -3 * R.wireRadius;
  const capsule = (a: Vec3, b: Vec3, radius: number, part: string): void => {
    out.push({ kind: 'capsule', part, a: v3Add(a, origin), b: v3Add(b, origin), radius });
  };
  const wire = (a: Vec3, b: Vec3, radius: number, part: string): void => {
    for (let i = 0; i < segments; i++) {
      const f0 = i / segments;
      const f1 = (i + 1) / segments;
      const at = (f: number): Vec3 => [
        a[0] + (b[0] - a[0]) * f,
        a[1] + (b[1] - a[1]) * f,
        a[2] + (b[2] - a[2]) * f,
      ];
      capsule(at(f0), at(f1), radius, part);
    }
  };
  for (let i = 0; i < 16; i++) {
    const x = (i - 7.5) * R.baseWirePitch;
    wire([x, -R.half, upperZ], [x, R.half, upperZ], R.wireRadius, 'base_y');
  }
  for (let k = 0; k < R.rows; k++) {
    const y = R.firstRowY + k * R.rowPitch;
    wire([-R.half, y, lowerZ], [R.half, y, lowerZ], R.wireRadius, 'base_x');
    if (!tines) continue;
    for (let j = 0; j < R.tinesPerRow; j++) {
      const x = -0.224 + j * R.tinePitch;
      if (tineFilter !== undefined && !tineFilter(x, k)) continue;
      capsule([x, y, lowerZ], [x, y, R.tineHeight - R.wireRadius], R.wireRadius, `tine_row_${k}`);
    }
  }
  for (const [z, h] of [
    [lowerZ, R.half],
    [0.088, R.half + 0.02],
  ] as const) {
    capsule([-h, -h, z], [h, -h, z], R.frameRadius, 'frame');
    capsule([-h, h, z], [h, h, z], R.frameRadius, 'frame');
    capsule([-h, -h, z], [-h, h, z], R.frameRadius, 'frame');
    capsule([h, -h, z], [h, h, z], R.frameRadius, 'frame');
  }
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    capsule(
      [sx * R.half, sy * R.half, lowerZ],
      [sx * (R.half + 0.02), sy * (R.half + 0.02), 0.088],
      R.frameRadius,
      'frame',
    );
  }
  return out;
}

/** Dimensions of the cutlery basket, metres. */
export const BASKET = { cell: 0.04, wall: 0.002, depth: 0.12, nx: 5, ny: 2 } as const;

/** A cell of the cutlery basket. */
export interface BasketCell {
  /** Centre of the cell in x and y, metres. */
  readonly cx: number;
  readonly cy: number;
  /** Half of the clear width of the cell, metres. */
  readonly half: number;
}

/** The cutlery basket: its static pieces and where its cells are. */
export interface Basket {
  readonly pieces: CollisionBox[];
  readonly cells: BasketCell[];
  /** Height of the top of the floor, metres. */
  readonly floorZ: number;
  /** Height of the rim, metres. */
  readonly rimZ: number;
}

/**
 * Cutlery basket of 5 x 2 cells, each 40 x 40 x 120 mm, with 2 mm walls and floor (sharp boxes).
 * The top of the floor is at the z of `origin`.
 */
export function makeBasket(origin: Vec3 = [0, 0, 0]): Basket {
  const { cell, wall, depth, nx, ny } = BASKET;
  const width = nx * cell + (nx + 1) * wall;
  const length = ny * cell + (ny + 1) * wall;
  const pieces: CollisionBox[] = [];
  const box = (centre: Vec3, halfExtents: Vec3, part: string): void => {
    pieces.push({
      kind: 'box',
      part,
      halfExtents,
      radius: 0,
      pose: { p: v3Add(centre, origin), q: [0, 0, 0, 1] },
    });
  };
  box([0, 0, -wall / 2], [width / 2, length / 2, wall / 2], 'floor');
  for (let i = 0; i <= nx; i++) {
    const x = -width / 2 + wall / 2 + i * (cell + wall);
    box([x, 0, depth / 2], [wall / 2, length / 2, depth / 2], 'wall');
  }
  for (let k = 0; k <= ny; k++) {
    const y = -length / 2 + wall / 2 + k * (cell + wall);
    box([0, y, depth / 2], [width / 2, wall / 2, depth / 2], 'wall');
  }
  const cells: BasketCell[] = [];
  for (let k = 0; k < ny; k++) {
    for (let i = 0; i < nx; i++) {
      cells.push({
        cx: origin[0] - width / 2 + wall + cell / 2 + i * (cell + wall),
        cy: origin[1] - length / 2 + wall + cell / 2 + k * (cell + wall),
        half: cell / 2,
      });
    }
  }
  return { pieces, cells, floorZ: origin[2], rimZ: origin[2] + depth };
}

// ---------------------------------------------------------------------------------------------
// Placement helpers
// ---------------------------------------------------------------------------------------------

/** Every core point of a set of pieces with its rounding radius, in the item frame. */
export function piecePoints(pieces: readonly CollisionPiece[]): { p: Vec3; radius: number }[] {
  const out: { p: Vec3; radius: number }[] = [];
  for (const piece of pieces) {
    if (piece.kind === 'round') continue;
    if (piece.kind === 'hull') {
      for (const p of piece.points) out.push({ p, radius: piece.radius });
    } else if (piece.kind === 'capsule') {
      out.push({ p: piece.a, radius: piece.radius }, { p: piece.b, radius: piece.radius });
    } else {
      const h = piece.halfExtents;
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const local = quatRotate(piece.pose.q, [sx * h[0], sy * h[1], sz * h[2]]);
            out.push({ p: v3Add(piece.pose.p, local), radius: piece.radius });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Extent of a set of pieces turned by `q` along the direction `dir` (unit): the smallest and
 * largest coordinate of its surface, metres. `filter` restricts the points considered, by their
 * turned position.
 */
export function extentAlong(
  pieces: readonly CollisionPiece[],
  q: Quat,
  dir: Vec3,
  filter?: (p: Vec3) => boolean,
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const { p, radius } of piecePoints(pieces)) {
    const w = quatRotate(q, p);
    if (filter !== undefined && !filter(w)) continue;
    const d = w[0] * dir[0] + w[1] * dir[1] + w[2] * dir[2];
    min = Math.min(min, d - radius);
    max = Math.max(max, d + radius);
  }
  return { min, max };
}

/**
 * Pose of a plate standing in the slot between tine rows `slot` and `slot + 1` of
 * {@link makeRack}, its axis along +y and tilted up by `tiltDeg`, with its lowest point `gap`
 * above the base grid and shifted sideways by `x`. The part of the plate that is inside the
 * tine zone is centred in the slot.
 */
export function plateInSlot(
  plate: TestItem,
  slot: number,
  options: { tiltDeg?: number; x?: number; gap?: number; origin?: Vec3 } = {},
): Pose {
  const { tiltDeg = 10, x = 0.005, gap = 0.02, origin = [0, 0, 0] } = options;
  const q = quatFromAxisAngle([1, 0, 0], -(90 - tiltDeg) * DEG);
  const vertical = extentAlong(plate.pieces, q, [0, 0, 1]);
  const lowZone = vertical.min + (RACK.tineHeight - gap) + 0.002;
  const along = extentAlong(plate.pieces, q, [0, 1, 0], (p) => p[2] < lowZone);
  const slotCentre = RACK.firstRowY + slot * RACK.rowPitch + RACK.rowPitch / 2;
  return {
    p: v3Add([x, slotCentre - (along.min + along.max) / 2, gap - vertical.min], origin),
    q,
  };
}

/** Pose of an item standing upright (axis +z) turned by `yaw` radians about z. */
export function uprightPose(p: Vec3, yaw = 0): Pose {
  return { p, q: quatFromAxisAngle([0, 0, 1], yaw) };
}

/**
 * Pose of a shell of revolution inverted (axis -z, mouth down), tilted by `tiltDeg` about x,
 * with its mouth centre above the point `over` and its lowest point at height `z`.
 */
export function invertedPose(item: TestItem, over: Vec3, z: number, tiltDeg = 0): Pose {
  const q = quatMul(
    quatFromAxisAngle([1, 0, 0], tiltDeg * DEG),
    quatFromAxisAngle([1, 0, 0], Math.PI),
  );
  const vertical = extentAlong(item.pieces, q, [0, 0, 1]);
  const mouth = quatRotate(q, [0, 0, item.height]);
  return { p: [over[0] - mouth[0], over[1] - mouth[1], z - vertical.min], q };
}

/** Angle in degrees between a body's item z axis and the vertical, in [0, 90]. */
export function axisFromVerticalDeg(q: Quat): number {
  const axis = quatRotate(q, [0, 0, 1]);
  return Math.acos(Math.min(1, Math.abs(axis[2]))) / DEG;
}

/** Mulberry32: a deterministic source of test inputs, uniform in [0, 1). */
export function testRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// Scenes of the bake-off
// ---------------------------------------------------------------------------------------------

/** A dynamic body of a test scene. */
export interface SceneBody {
  readonly id: string;
  readonly item: TestItem;
  readonly pose: Pose;
  readonly material: string;
}

/** A test scene: one static body made of `statics`, and the dynamic bodies. */
export interface TestScene {
  readonly statics: CollisionPiece[];
  readonly bodies: SceneBody[];
}

/** Two-digit suffix, so that ids sort in numeric order. */
function index2(i: number): string {
  return i < 10 ? `0${i}` : `${i}`;
}

/**
 * Twelve plates in adjacent slots of one rack, each 20 mm above the base grid, leaning 6.5 to
 * 9.5 degrees and shifted sideways by up to 6 mm (the bake-off's T2; tilts are kept below the
 * 10.8 degrees at which a plate wedges in a 36 mm slot).
 */
export function twelvePlates(sectors = 24, seed = 12345, origin: Vec3 = [0, 0, 0]): SceneBody[] {
  const plate = makePlate(sectors);
  const random = testRandom(seed);
  const out: SceneBody[] = [];
  for (let k = 0; k < 12; k++) {
    const tiltDeg = 6.5 + 3 * random();
    const x = (random() - 0.5) * 0.012;
    out.push({
      id: `plate_${index2(k)}`,
      item: plate,
      pose: plateInSlot(plate, k, { tiltDeg, x, origin }),
      material: TEST_MATERIALS.ceramic,
    });
  }
  return out;
}

/**
 * Twenty pieces of cutlery above the ten cells of a basket, two per cell with their handles
 * down: the first 30 mm above the floor and 7 mm off the cell centre, the second 110 mm above
 * the floor on the other side, with up to 10 degrees of yaw and 2 degrees of tilt (the bake-off's
 * T5), moved where necessary so that no piece is released inside a cell wall. `owner[i]` is the
 * index of the cell piece `i` belongs to.
 */
export function cutleryInBasket(
  basket: Basket,
  seed = 777,
  prefix = 'cutlery',
  salt = 0,
): { bodies: SceneBody[]; owner: number[] } {
  const kinds = [makeFork(), makeSpoon(), makeKnife()];
  const random = testRandom(seed);
  const bodies: SceneBody[] = [];
  const owner: number[] = [];
  const standUp = quatFromAxisAngle([1, 0, 0], Math.PI / 2);
  for (let c = 0; c < basket.cells.length; c++) {
    const cell = basket.cells[c] as BasketCell;
    for (let j = 0; j < 2; j++) {
      const item = kinds[(c + j * 2 + (c >> 1) + salt) % 3] as TestItem;
      const yaw = (j === 0 ? 225 : 45) * DEG + (random() - 0.5) * 20 * DEG;
      const tilt = quatMul(
        quatFromAxisAngle([0, 1, 0], (random() - 0.5) * 4 * DEG),
        quatFromAxisAngle([1, 0, 0], (random() - 0.5) * 4 * DEG),
      );
      const q = quatMul(tilt, quatMul(quatFromAxisAngle([0, 0, 1], yaw), standUp));
      const vertical = extentAlong(item.pieces, q, [0, 0, 1]);
      const offset = j === 0 ? -0.007 : 0.007;
      const drop = j === 0 ? 0.03 : 0.11;
      const z = basket.floorZ + drop - vertical.min;
      // Released clear of the cell walls: whatever is inside the cell (or within 20 mm of its
      // rim) is kept 0.5 mm from them, which moves a tilted handle by up to 3 mm.
      const inCell = (w: Vec3): boolean => w[2] + z < basket.rimZ + 0.02;
      const clear = cell.half - 0.0005;
      const place = (centre: number, dir: Vec3): number => {
        const extent = extentAlong(item.pieces, q, dir, inCell);
        if (extent.max - extent.min > 2 * clear) return centre - (extent.min + extent.max) / 2;
        return Math.min(
          centre + clear - extent.max,
          Math.max(centre - clear - extent.min, centre + offset),
        );
      };
      bodies.push({
        id: `${prefix}_${index2(bodies.length)}_${item.name}`,
        item,
        pose: { p: [place(cell.cx, [1, 0, 0]), place(cell.cy, [0, 1, 0]), z], q },
        material: TEST_MATERIALS.steel,
      });
      owner.push(c);
    }
  }
  return { bodies, owner };
}

/** True for the tine rows kept in the glass zone: every other row, so that a 70 mm glass fits. */
export const GLASS_ZONE = (_x: number, row: number): boolean => row % 2 === 0;

/**
 * The full load of the bake-off's scaling measurement: four racks (two with twelve plates each,
 * one without tines carrying four stacks of three bowls and six inverted mugs, one glass rack
 * with twenty tumblers inverted over tines) and three cutlery baskets with twenty pieces each.
 * 122 dynamic bodies; the static geometry is 1355 capsules and 30 boxes.
 */
export function makeFullLoad(seed = 4245): TestScene {
  const statics: CollisionPiece[] = [];
  const bodies: SceneBody[] = [];
  const segments = 7;
  const originA: Vec3 = [0, 0, 0];
  const originB: Vec3 = [0, 0, 0.4];
  const originC: Vec3 = [0.6, 0, 0];
  const originD: Vec3 = [0.6, 0, 0.4];
  statics.push(
    ...makeRack({ origin: originA, segments }),
    ...makeRack({ origin: originB, segments, tines: false }),
    ...makeRack({ origin: originC, segments }),
    ...makeRack({ origin: originD, segments, tineFilter: GLASS_ZONE }),
  );
  const random = testRandom(seed);

  const plate = makePlate(16);
  for (const [tag, origin] of [
    ['a', originA],
    ['c', originC],
  ] as const) {
    for (let k = 0; k < 12; k++) {
      const tiltDeg = 6.5 + 3 * random();
      const x = (random() - 0.5) * 0.012;
      bodies.push({
        id: `plate_${tag}${index2(k)}`,
        item: plate,
        pose: plateInSlot(plate, k, { tiltDeg, x, origin }),
        material: TEST_MATERIALS.ceramic,
      });
    }
  }

  const bowl = makeBowl(16, 4);
  const spacing = idealNestSpacing([bowlProfile(4), BOWL_FOOT]);
  let n = 0;
  for (const [bx, by] of [
    [-0.15, -0.15],
    [0.15, -0.15],
    [-0.15, 0.15],
    [0.15, 0.15],
  ] as const) {
    for (let i = 0; i < 3; i++) {
      const p: Vec3 = [
        bx + (random() - 0.5) * 0.003,
        by + (random() - 0.5) * 0.003,
        0.002 + i * (spacing + 0.025),
      ];
      bodies.push({
        id: `bowl_${index2(n++)}`,
        item: bowl,
        pose: uprightPose(v3Add(p, originB), random() * 2 * Math.PI),
        material: TEST_MATERIALS.ceramic,
      });
    }
  }

  const mug = makeMug(16);
  n = 0;
  for (const [mx, my, turn] of [
    [-0.19, 0, 0],
    [-0.06, 0, 0],
    [0.07, 0, 0],
    [0.2, 0.03, Math.PI],
    [0, -0.17, Math.PI / 2],
    [0, 0.17, -Math.PI / 2],
  ] as const) {
    const pose = invertedPose(mug, [mx, my, 0], 0.003);
    bodies.push({
      id: `mug_${index2(n++)}`,
      item: mug,
      pose: {
        p: v3Add(pose.p, originB),
        q: quatMul(quatFromAxisAngle([0, 0, 1], turn), pose.q),
      },
      material: TEST_MATERIALS.ceramic,
    });
  }

  const tumbler = makeTumbler(16);
  n = 0;
  for (let iy = 0; iy < 4; iy++) {
    for (let ix = 0; ix < 5; ix++) {
      const pose = invertedPose(tumbler, [-0.176 + ix * 0.096, -0.16 + iy * 0.08, 0], 0.01, 15);
      bodies.push({
        id: `tumbler_${index2(n++)}`,
        item: tumbler,
        pose: { p: v3Add(pose.p, originD), q: pose.q },
        material: TEST_MATERIALS.glass,
      });
    }
  }

  for (let b = 0; b < 3; b++) {
    const basket = makeBasket([-0.5, -0.2 + b * 0.2, 0]);
    statics.push(...basket.pieces);
    bodies.push(...cutleryInBasket(basket, seed + 17 * (b + 1), `cutlery_${b}`, b).bodies);
  }
  return { statics, bodies };
}

/** Number of collision pieces of the dynamic bodies of a scene. */
export function scenePieceCount(scene: TestScene): number {
  let pieces = 0;
  for (const body of scene.bodies) pieces += body.item.pieces.length;
  return pieces;
}
