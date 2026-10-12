/**
 * Expansion of the `'box_shell'` item class: an open tray with a rounded-rectangle plan, standing
 * on z = 0 and centred on the z axis (oven dishes, trays, food containers, flat lids).
 *
 * The tray is the planar analogue of a shell of revolution. Its wall profile (floor, wall,
 * optional outward flange, all of thickness `wall`) is revolved through a quarter turn at each
 * corner (`corner.0` to `corner.3`, partial shells about the corner axes) and extruded along the
 * straight sides as rounded boxes of zero core thickness: `floor.0` to `floor.2`, `wall.0` to
 * `wall.3`, `flange.0` to `flange.3`. A lid lip adds `lip.0` to `lip.3` (straight runs) and
 * `lip.4` to `lip.7` (corners) under the floor and raises everything else by the lip height.
 *
 * With a `draft` the walls lean outward as they rise, as moulded containers do so that they
 * nest: the given length, width and corner radius are those at the top, the corner radius shrinks
 * towards the floor (the corner pieces become cones) and the straight walls are tilted boxes.
 *
 * The straight pieces are rounded all round, so they reach half a wall thickness into their
 * neighbours: a wall into the floor it stands on and into the corner pieces at its ends. That is
 * what joins them without notches, and the surface of the union is exact. Mass properties count
 * the overlaps twice: about 3.4 (wall / 2)^2 of cross-section along the straight part of the
 * perimeter where wall meets floor, which is 1 to 2 % of the mass of a thin-walled container or
 * tray and up to 6 % for a stoneware dish with 7 mm walls. Fit the wall thickness to a verified
 * mass with this kernel, as the items dossier does for every item, and the bias is absorbed.
 *
 * Every straight piece has its part frame turned so that +z points into the tray (up for the
 * floor and the flange), so the region side `'in'` means the food side on every part.
 *
 * Default surface regions, in priority order: `flange` (if any), `interior`, `exterior`, `lip`
 * (if any). The buried end faces of the straight pieces are in no region.
 *
 * Units: metres.
 */

import type { Pose, Quat, Vec3 } from '@spotless/core';
import { quatFromAxes, requireNonNegative, requirePositive } from './expand-util.ts';
import { prepareProfile } from './sor-section.ts';
import type { BoxShellDef, Part, Shape, SorProfilePoint, SurfaceRegion } from './types.ts';

/** Runs shorter than this are left to the corner pieces, metres. */
const MIN_RUN = 1e-7;
/** Largest draft angle accepted, radians. */
/** Slack allowed where a lid lip meets the edge of the floor, metres (a micrometre). */
const LIP_JOIN_TOLERANCE = 1e-6;
const MAX_DRAFT = 0.6;

/**
 * Part frames of the four walls (on the +y, -y, +x and -x sides): x along the wall, y up the
 * wall and z into the tray. A wall with a draft leans outward by `draft` radians as it rises.
 */
function wallFrames(draft: number): readonly Quat[] {
  const c = Math.cos(draft);
  const s = Math.sin(draft);
  return [
    quatFromAxes([1, 0, 0], [0, s, c], [0, -c, s]),
    quatFromAxes([-1, 0, 0], [0, -s, c], [0, c, s]),
    quatFromAxes([0, -1, 0], [s, 0, c], [-c, 0, s]),
    quatFromAxes([0, 1, 0], [-s, 0, c], [c, 0, s]),
  ];
}

/** Expands a box-shell definition (see the module comment for ids and regions). */
export function expandBoxShell(def: BoxShellDef): Shape {
  const { length, width, height, wall } = def;
  requirePositive(length, 'box_shell length');
  requirePositive(width, 'box_shell width');
  requirePositive(height, 'box_shell height');
  requirePositive(wall, 'box_shell wall thickness');
  requirePositive(def.cornerRadius, 'box_shell corner radius');
  const flange = def.flange ?? 0;
  requireNonNegative(flange, 'box_shell flange');
  if (def.porosity !== undefined) requireNonNegative(def.porosity, 'porosity');
  if (height < wall)
    throw new RangeError('geometry: box_shell height must be at least the wall thickness');
  if (def.cornerRadius < wall) {
    throw new RangeError('geometry: box_shell corner radius must be at least the wall thickness');
  }
  const a = length / 2 - def.cornerRadius; // half length of the straight runs along x
  const b = width / 2 - def.cornerRadius; // and along y
  if (a < 0 || b < 0) {
    throw new RangeError('geometry: box_shell corner radius exceeds half the length or width');
  }
  const lipHeight = def.lidLip?.height ?? 0;
  const lipInset = def.lidLip?.inset ?? 0;
  if (def.lidLip !== undefined) {
    requirePositive(lipHeight, 'lid lip height');
    requireNonNegative(lipInset, 'lid lip inset');
    if (def.cornerRadius - lipInset - wall / 2 < wall / 2) {
      throw new RangeError('geometry: lid lip inset leaves no room for the lip at the corners');
    }
  }
  const z0 = lipHeight; // everything but the lip is raised by the lip height
  const rho = wall / 2;
  const upright = height - wall; // height of the wall mid-line
  const hasWalls = upright > MIN_RUN;
  const draft = def.draft ?? 0;
  if (!(draft >= 0) || !(draft < MAX_DRAFT)) {
    throw new RangeError('geometry: box_shell draft must be between 0 and 0.6 rad');
  }
  // Mid-surface radius at the corners: at the top of the wall and, smaller by the draft, at the
  // floor. The straight runs keep their length; the walls lean.
  const rmTop = def.cornerRadius - rho;
  const rm = rmTop - upright * Math.tan(draft);
  if (rm < rho) {
    throw new RangeError('geometry: box_shell draft leaves no corner radius at the floor');
  }
  // The lid lip hangs under the floor. With a draft the floor is smaller than the top outline
  // the inset is measured from, and a lip set in too little would hang in the air beside it.
  if (def.lidLip !== undefined && def.cornerRadius - lipInset - rho > rm + LIP_JOIN_TOLERANCE) {
    throw new RangeError(
      'geometry: the lid lip lies outside the floor of the box_shell; set it in by at least ' +
        `${((def.cornerRadius - rho - rm) * 1000).toFixed(2)} mm, what the draft takes off the floor`,
    );
  }
  const material = def.material;
  const extra = def.porosity === undefined ? {} : { porosity: def.porosity };
  const parts: Part[] = [];
  const flat = (id: string, halfX: number, halfY: number, centre: Vec3): void => {
    parts.push({
      id,
      prim: { kind: 'rbox', halfExtents: [halfX, halfY, 0], radius: rho },
      pose: { p: centre, q: [0, 0, 0, 1] },
      material,
      ...extra,
    });
  };

  // Floor: a strip through the middle and one on either side of it between the corner pieces.
  const floorZ = z0 + rho;
  if (a > MIN_RUN) flat('floor.0', a, b + rm, [0, 0, floorZ]);
  if (b > MIN_RUN) {
    flat('floor.1', rm / 2, b, [a + rm / 2, 0, floorZ]);
    flat('floor.2', rm / 2, b, [-(a + rm / 2), 0, floorZ]);
  }

  // Upright walls.
  const frames = wallFrames(draft);
  const wallZ = z0 + height / 2;
  const rmMid = 0.5 * (rm + rmTop);
  const walls: [string, number, Vec3, Quat][] = [
    ['wall.0', a, [0, b + rmMid, wallZ], frames[0] as Quat],
    ['wall.1', a, [0, -(b + rmMid), wallZ], frames[1] as Quat],
    ['wall.2', b, [a + rmMid, 0, wallZ], frames[2] as Quat],
    ['wall.3', b, [-(a + rmMid), 0, wallZ], frames[3] as Quat],
  ];
  if (hasWalls) {
    for (const [id, run, p, q] of walls) {
      if (run <= MIN_RUN) continue;
      parts.push({
        id,
        prim: { kind: 'rbox', halfExtents: [run, upright / (2 * Math.cos(draft)), 0], radius: rho },
        pose: { p, q },
        material,
        ...extra,
      });
    }
  }

  // Flange: flat strips level with the top of the wall mid-line.
  const flangeZ = z0 + height - rho;
  if (flange > MIN_RUN) {
    if (a > MIN_RUN) {
      flat('flange.0', a, flange / 2, [0, b + rmTop + flange / 2, flangeZ]);
      flat('flange.1', a, flange / 2, [0, -(b + rmTop + flange / 2), flangeZ]);
    }
    if (b > MIN_RUN) {
      flat('flange.2', flange / 2, b, [a + rmTop + flange / 2, 0, flangeZ]);
      flat('flange.3', flange / 2, b, [-(a + rmTop + flange / 2), 0, flangeZ]);
    }
  }

  // Corner pieces: the wall profile revolved through a quarter turn about each corner axis.
  const profile: SorProfilePoint[] = [
    { r: 0, z: rho, t: wall },
    { r: rm, z: rho, t: wall },
  ];
  if (hasWalls) profile.push({ r: rmTop, z: height - rho, t: wall });
  if (flange > MIN_RUN) profile.push({ r: rmTop + flange, z: height - rho, t: wall });
  const corners: [number, number, number][] = [
    [a, b, 0],
    [-a, b, 1],
    [-a, -b, 2],
    [a, -b, 3],
  ];
  for (const [x, y, quadrant] of corners) {
    parts.push({
      id: `corner.${quadrant}`,
      prim: {
        kind: 'sor',
        profile,
        arc: [(quadrant * Math.PI) / 2, ((quadrant + 1) * Math.PI) / 2],
      },
      pose: { p: [x, y, z0], q: [0, 0, 0, 1] },
      material,
      ...extra,
    });
  }

  // Lid lip: a low wall under the floor, set in from the outer edge.
  if (def.lidLip !== undefined) {
    const rl = def.cornerRadius - lipInset - rho; // mid-surface radius of the lip at the corners
    const lipZ = rho + lipHeight / 2;
    const upFrames = wallFrames(0); // the lip is upright whatever the draft of the walls
    const lips: [number, Vec3, Quat][] = [
      [a, [0, b + rl, lipZ], upFrames[0] as Quat],
      [a, [0, -(b + rl), lipZ], upFrames[1] as Quat],
      [b, [a + rl, 0, lipZ], upFrames[2] as Quat],
      [b, [-(a + rl), 0, lipZ], upFrames[3] as Quat],
    ];
    lips.forEach(([run, p, q], i) => {
      if (run <= MIN_RUN) return;
      parts.push({
        id: `lip.${i}`,
        prim: { kind: 'rbox', halfExtents: [run, lipHeight / 2, 0], radius: rho },
        pose: { p, q },
        material,
        ...extra,
      });
    });
    const lipProfile: SorProfilePoint[] = [
      { r: rl, z: rho, t: wall },
      { r: rl, z: rho + lipHeight, t: wall },
    ];
    for (const [x, y, quadrant] of corners) {
      const pose: Pose = { p: [x, y, 0], q: [0, 0, 0, 1] };
      parts.push({
        id: `lip.${4 + quadrant}`,
        prim: {
          kind: 'sor',
          profile: lipProfile,
          arc: [(quadrant * Math.PI) / 2, ((quadrant + 1) * Math.PI) / 2],
        },
        pose,
        material,
        ...extra,
      });
    }
  }

  const regions: SurfaceRegion[] = [];
  if (flange > MIN_RUN) {
    // On the corner pieces the flange is the last profile segment.
    const prepared = prepareProfile(profile);
    const start = (prepared.vertexS[prepared.segmentCount - 1] as number) / prepared.totalLength;
    if (parts.some((p) => p.id.startsWith('flange')))
      regions.push({ id: 'flange', part: 'flange*' });
    regions.push({ id: 'flange', part: 'corner*', sRange: [start, 1] });
  }
  for (const [id, side] of [
    ['interior', 'in'],
    ['exterior', 'out'],
  ] as const) {
    for (const prefix of ['floor', 'wall', 'corner']) {
      if (parts.some((p) => p.id.startsWith(prefix)))
        regions.push({ id, part: `${prefix}*`, side });
    }
  }
  if (def.lidLip !== undefined) regions.push({ id: 'lip', part: 'lip*' });
  return { parts, regions: def.regions ?? regions };
}
