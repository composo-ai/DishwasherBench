// Rolling. A shell of revolution reaches the engine as flat facets, on which it cannot roll; its
// round rolling surfaces (`CollisionRound` pieces of the geometry kernel) give whatever it
// rolls on a truly round surface, and the rolling resistance of docs/research/items.md section
// 3.6 decides where it stops. Everything is compared with the closed forms for a rigid body
// rolling without slipping.
import type { Pose, Vec3 } from '@spotless/core';
import { STANDARD_GRAVITY, quatFromAxisAngle, quatMul, quatRotate } from '@spotless/core';
import type { CollisionCapsule, CollisionPiece, MassProperties, Shape } from '@spotless/geometry';
import {
  COLLISION_CHORD_ERROR,
  buildCollisionPieces,
  computeMassProperties,
  sorCollisionLayout,
} from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { JOLT_SETTINGS, LOADING_TIME_STEP, settleOptionsFor } from './settings.ts';
import { AT_ORIGIN, NO_MASS, useWorlds } from './test-world.ts';
import type { ContactPairLookup } from './types.ts';
import type { JoltPhysicsWorld } from './world.ts';

const DT = LOADING_TIME_STEP;
const G = STANDARD_GRAVITY;
const DEG = Math.PI / 180;
const MM = 1e-3;
/**
 * These tests measure where a round body stops and how fast it rolls, to a few micrometres.
 * The disturbance of the game's settle (`SETTLE_DISTURBANCE`), which rolls such a body a
 * fraction of a millimetre, is left out; the last test of the first group says what it does.
 */
const SETTLE = settleOptionsFor(DT, false);
const SURFACE = { material: 'steel' };
const GLASS = { material: 'glass' };

const newWorld = useWorlds();

/** One pair of coefficients for every pair of materials. */
const pair =
  (rollingResistance: number): ContactPairLookup =>
  () => ({ friction: 0.4, restitution: 0.1, rollingResistance, spinResistance: 0 });
/** Gravity of magnitude g tilted by `slope` radians so that +y is downhill. */
const tilted = (slope: number): Vec3 => [0, G * Math.sin(slope), -G * Math.cos(slope)];
const floor = (half: number): CollisionPiece[] => [
  {
    kind: 'box',
    part: 'floor',
    halfExtents: [half, half, 0.01],
    radius: 0,
    pose: { p: [0, 0, -0.01], q: [0, 0, 0, 1] },
  },
];

// A straight glass: 3 mm wall and base, 70 mm across the mid-surface, 100 mm tall, 2500 kg/m^3.
const R_MID = 0.035;
const WALL = 0.003;
const HEIGHT = 0.1;
/** Radius it rolls on: the outer face of the wall. */
const R_OUT = R_MID + WALL / 2;
const glassShape: Shape = {
  parts: [
    {
      id: 'body',
      prim: {
        kind: 'sor',
        profile: [
          { r: 0, z: WALL / 2, t: WALL },
          { r: R_MID, z: WALL / 2, t: WALL },
          { r: R_MID, z: HEIGHT, t: WALL },
        ],
      },
      pose: AT_ORIGIN,
      material: 'glass',
    },
  ],
  regions: [],
};
const glassPieces = buildCollisionPieces(glassShape, { chordError: COLLISION_CHORD_ERROR });
const facetedPieces = buildCollisionPieces(glassShape, {
  chordError: COLLISION_CHORD_ERROR,
  roundSurfaces: false,
});
const glassMass: MassProperties = computeMassProperties(glassShape, () => 2500);
/** Moment of inertia about the axis over m r^2: what divides the acceleration of the roll. */
const K = (glassMass.inertia[8] as number) / (glassMass.mass * R_OUT * R_OUT);
const SECTORS = sorCollisionLayout(glassShape.parts[0]?.prim as never, {
  chordError: COLLISION_CHORD_ERROR,
}).sectors;
/** Half the angle of one facet of the wall. */
const HALF_FACET = Math.PI / SECTORS;
/**
 * Lying on its side, axis along x, turned about its axis by `turn`; +y is where it rolls to.
 * Without a turn an edge between two facets of the wall points straight down.
 */
const onSide = (y: number, turn = 0, lift = 0.0001): Pose => ({
  p: [0, y, R_OUT + lift],
  q: quatMul(quatFromAxisAngle([1, 0, 0], turn), quatFromAxisAngle([0, 1, 0], Math.PI / 2)),
});

/** A world with a floor and the glass on its side at y. */
async function rollingWorld(
  slope: number,
  rollingResistance: number,
  pieces: readonly CollisionPiece[] = glassPieces,
  turn = 0,
  y = 0,
): Promise<JoltPhysicsWorld> {
  const world = await newWorld({ gravity: tilted(slope), pairLookup: pair(rollingResistance) });
  world.addBody('floor', floor(3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
  world.addBody('glass', pieces, glassMass, GLASS, onSide(y, turn), 'dynamic');
  return world;
}

describe('a glass on its side', () => {
  it('is a 19-sided prism to the engine without its round surfaces, and has seven of them', () => {
    // ceil(pi / acos(1 - 0.5 / 35)) sectors: the platform rule at 0.5 mm chord error.
    expect(SECTORS).toBe(19);
    expect(glassPieces.filter((piece) => piece.kind === 'round')).toHaveLength(
      glassPieces.length - facetedPieces.length,
    );
    expect(glassPieces.length - facetedPieces.length).toBe(7);
    // Thin-walled: nearly all its mass at the radius it rolls on.
    expect(K).toBeGreaterThan(0.8);
    expect(K).toBeLessThan(1);
  });

  it.each([
    ['balanced on an edge between two facets', 0],
    ['resting on a facet', HALF_FACET],
  ])('rolls down 3 degrees at g sin(slope) / (1 + I / m r^2), %s', async (_name, turn) => {
    const slope = 3 * DEG;
    const world = await rollingWorld(slope, 0, glassPieces, turn, -1);
    let lowest = Infinity;
    let highest = -Infinity;
    for (let step = 0; step < 240; step++) {
      world.step(1);
      if (step < 24) continue;
      const z = world.getPose('glass').p[2];
      lowest = Math.min(lowest, z);
      highest = Math.max(highest, z);
    }
    const a = (G * Math.sin(slope)) / (1 + K);
    // 138.5 mm in the first second, 277 mm/s at its end.
    expect(Math.abs((world.getPose('glass').p[1] + 1) / (0.5 * a) - 1)).toBeLessThan(0.02);
    expect(Math.abs(world.getVelocity('glass').linear[1] / a - 1)).toBeLessThan(0.02);
    // On a round surface: the axis stays at one height (a 19-sided prism of this size would
    // bob by 0.5 mm), 0.1 mm above the true radius (see `roundSurfaceProud`). Measured: 0.009 mm
    // (0.003 mm before the wall facets under the round surface were given to the engine in
    // groups of their own; they are still clear of the floor).
    expect(highest - lowest).toBeLessThan(0.02 * MM);
    expect(lowest - R_OUT).toBeGreaterThan(0);
    expect(highest - R_OUT).toBeLessThan(JOLT_SETTINGS.roundSurfaceProud);
  });

  it('stays on its facet on that slope without the round surfaces', async () => {
    // Why they exist: the prism only tips over an edge beyond pi / 19 = 9.5 degrees.
    const world = await rollingWorld(3 * DEG, 0, facetedPieces, HALF_FACET);
    world.step(480);
    expect(Math.abs(world.getPose('glass').p[1])).toBeLessThan(1 * MM);
    const steeper = await rollingWorld(12 * DEG, 0, facetedPieces, HALF_FACET);
    steeper.step(480);
    expect(steeper.getPose('glass').p[1]).toBeGreaterThan(0.2);
  });

  it('stalls below atan(c / r) and rolls above it, at the closed-form rate', async () => {
    // Rolling resistance of length c = 0.2 mm (items.md 3.6, on coated wire) holds the glass
    // up to a slope of atan(c / r) = 0.314 degrees; beyond it
    // a = g (sin(slope) - (c / r) cos(slope)) / (1 + I / m r^2).
    const c = 2e-4;
    const stall = Math.atan(c / R_OUT);
    expect(stall / DEG).toBeCloseTo(0.314, 3);
    for (const fraction of [0.25, 0.8]) {
      const world = await rollingWorld(fraction * stall, c);
      const result = world.settle(SETTLE);
      expect(result.atRest).toBe(true);
      // Held from the first step: it does not creep while it waits to fall asleep.
      expect(Math.abs(world.getPose('glass').p[1])).toBeLessThan(0.005 * MM);
    }
    for (const fraction of [1.2, 2, 4]) {
      const slope = fraction * stall;
      const world = await rollingWorld(slope, c);
      world.step(720);
      const a = (G * (Math.sin(slope) - (c / R_OUT) * Math.cos(slope))) / (1 + K);
      // 26 mm, 131 mm and 392 mm after 3 s.
      expect(Math.abs(world.getPose('glass').p[1] / (0.5 * a * 9) - 1)).toBeLessThan(0.06);
    }
  });

  it.each([0.03, 0.1])(
    'set rolling at %d m/s on a level floor, stops after v^2 (1 + I / m r^2) r / (2 c g)',
    async (speed) => {
      // Hard on hard, c = 0.05 mm: 62 mm from 30 mm/s and 690 mm from 100 mm/s. Without any
      // resistance it would roll for ever.
      const c = 5e-5;
      const world = await rollingWorld(0, c, glassPieces, 0, -0.5);
      world.step(60);
      const start = world.getPose('glass').p[1];
      world.setVelocity('glass', [0, speed, 0], [-speed / R_OUT, 0, 0]);
      const result = world.settle({ ...SETTLE, maxSteps: 20 * 240 });
      expect(result.atRest).toBe(true);
      const expected = (speed * speed * (1 + K) * R_OUT) / (2 * c * G);
      expect(Math.abs((world.getPose('glass').p[1] - start) / expected - 1)).toBeLessThan(0.04);
    },
  );

  it('is rolled a fraction of a millimetre by the disturbance of the standard settle, and rests again', async () => {
    // Held on a level floor by a rolling resistance of 0.2 mm (0.314 degrees for this glass),
    // it starts to roll under the one degree of the disturbance, which lasts a twentieth of a
    // second each way and cancels: a free body would go 0.2 mm out and come back.
    const world = await rollingWorld(0, 2e-4);
    const result = world.settle(settleOptionsFor(DT));
    expect(result.atRest).toBe(true);
    expect(result.disturbed).toBe(true);
    const moved = Math.hypot(world.getPose('glass').p[0], world.getPose('glass').p[1]);
    expect(moved).toBeGreaterThan(0.01 * MM);
    expect(moved).toBeLessThan(0.5 * MM);
    expect(world.isActive('glass')).toBe(false);
  });

  it('lies still across two level wires and rolls along them when they slope by 3 degrees', async () => {
    // Two rack wires (4.2 mm) 60 mm apart along +y, the glass lying across them.
    const wires: CollisionCapsule[] = [-0.03, 0.03].map((x) => ({
      kind: 'capsule',
      part: 'wire',
      a: [x + 0.04, -1, 0],
      b: [x + 0.04, 1, 0],
      radius: 0.0021,
    }));
    const lying: Pose = { p: [0, 0, 0.0021 + R_OUT + 0.0002], q: onSide(0).q };
    const build = async (slope: number): Promise<JoltPhysicsWorld> => {
      const world = await newWorld({ gravity: tilted(slope), pairLookup: pair(2e-4) });
      world.addBody('wires', wires, NO_MASS, { material: 'wire' }, AT_ORIGIN, 'static');
      world.addBody('glass', glassPieces, glassMass, GLASS, lying, 'dynamic');
      return world;
    };
    const level = await build(0);
    const still = level.settle(SETTLE);
    expect(still.atRest).toBe(true);
    expect(Math.hypot(level.getPose('glass').p[0], level.getPose('glass').p[1])).toBeLessThan(
      0.05 * MM,
    );
    // It rests on the wires with its outer surface: the axis one wire radius and one glass
    // radius above the wire centres, within the 0.15 mm the round surface stands proud.
    const height = level.getPose('glass').p[2] - 0.0021 - R_OUT;
    expect(height).toBeGreaterThan(-0.05 * MM);
    expect(height).toBeLessThan(JOLT_SETTINGS.roundSurfaceProud);

    const sloping = await build(3 * DEG);
    sloping.step(240);
    const a = (G * (Math.sin(3 * DEG) - (2e-4 / R_OUT) * Math.cos(3 * DEG))) / (1 + K);
    expect(Math.abs(sloping.getPose('glass').p[1] / (0.5 * a) - 1)).toBeLessThan(0.05);
    expect(Math.abs(sloping.getPose('glass').p[0])).toBeLessThan(1 * MM);
  });
});

describe('the cavity behind a round surface', () => {
  const upright: Pose = { p: [0, 0, 0.0002], q: [0, 0, 0, 1] };
  /** Upside down over the origin, its rim on the floor. */
  const inverted = (x: number): Pose => ({
    p: [x, 0, HEIGHT + WALL / 2 + 0.0002],
    q: quatFromAxisAngle([1, 0, 0], Math.PI),
  });
  /** A rack tine: 4.2 mm thick, 60 mm tall, standing on the floor at the origin. */
  const tine: CollisionCapsule = {
    kind: 'capsule',
    part: 'tine',
    a: [0, 0, 0.0021],
    b: [0, 0, 0.06],
    radius: 0.0021,
  };

  it('is open to a tine: a glass upside down over one stands on its rim as if it were not there', async () => {
    const heights: number[] = [];
    for (const withTine of [false, true]) {
      const world = await newWorld();
      world.addBody('floor', floor(0.3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
      if (withTine) world.addBody('tine', [tine], NO_MASS, SURFACE, AT_ORIGIN, 'static');
      world.addBody('glass', glassPieces, glassMass, GLASS, inverted(0.01), 'dynamic');
      expect(world.settle(SETTLE).atRest).toBe(true);
      heights.push(world.getPose('glass').p[2]);
      expect(Math.abs(world.getPose('glass').p[0] - 0.01)).toBeLessThan(0.05 * MM);
      expect(world.contacts({ bodies: ['glass'] }).every((contact) => contact.a !== 'tine')).toBe(
        true,
      );
    }
    // The rim (rounded, half a wall beyond the last profile point) on the floor.
    expect(Math.abs((heights[0] as number) - (HEIGHT + WALL / 2))).toBeLessThan(0.1 * MM);
    expect(Math.abs((heights[1] as number) - (heights[0] as number))).toBeLessThan(0.001 * MM);
  });

  it('still has its inner wall: pushed sideways, the glass is stopped by the tine inside it', async () => {
    const world = await newWorld({ pairLookup: () => ({ friction: 0.1, restitution: 0 }) });
    world.addBody('floor', floor(0.3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('tine', [tine], NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('glass', glassPieces, glassMass, GLASS, inverted(0), 'dynamic');
    world.step(60);
    // 0.3 m/s along +x: it slides until its inner wall, 33.5 mm from the axis, meets the tine.
    world.applyImpulse('glass', [0.3 * glassMass.mass, 0, 0]);
    let furthest = 0;
    for (let step = 0; step < 480; step++) {
      world.step(1);
      furthest = Math.max(furthest, world.getPose('glass').p[0]);
    }
    const reach = R_MID - WALL / 2 - 0.0021;
    // Inside the faceted wall by at most the chord error of its 20 facets, never through it.
    expect(furthest).toBeGreaterThan(reach - COLLISION_CHORD_ERROR - 0.1 * MM);
    expect(furthest).toBeLessThan(reach + 0.2 * MM);
  });

  it('is open to other items: a ball dropped into an upright glass lands on its base', async () => {
    const r = 0.01;
    const world = await newWorld();
    world.addBody('floor', floor(0.3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('glass', glassPieces, glassMass, GLASS, upright, 'dynamic');
    world.addBody(
      'ball',
      [{ kind: 'capsule', part: 'ball', a: [0, 0, 0], b: [0, 0, 0], radius: r }],
      { mass: 0.03, com: [0, 0, 0], inertia: [1.2e-6, 0, 0, 0, 1.2e-6, 0, 0, 0, 1.2e-6] },
      SURFACE,
      { p: [0.005, 0, HEIGHT + 0.02], q: [0, 0, 0, 1] },
      'dynamic',
    );
    expect(world.settle(SETTLE).atRest).toBe(true);
    // On the base, whose inner face is one wall thickness above the floor.
    expect(Math.abs(world.getPose('ball').p[2] - (WALL + r))).toBeLessThan(0.2 * MM);
  });

  it('is not part of the solid that queries ask about', async () => {
    const world = await newWorld();
    world.addBody('floor', floor(0.3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('glass', glassPieces, glassMass, GLASS, upright, 'dynamic');
    world.step(120);
    const probe: CollisionPiece[] = [
      { kind: 'capsule', part: 'probe', a: [0, 0, 0], b: [0, 0, 0], radius: 0.005 },
    ];
    const at = (x: number, z: number): Pose => ({ p: [x, 0, z], q: [0, 0, 0, 1] });
    // In the middle of the cavity: nothing there.
    expect(world.penetration(probe, at(0, 0.05))).toEqual({ depth: 0, with: [], parts: [] });
    // Half inside the wall from the inside: the wall, by about the sphere's radius.
    const inWall = world.penetration(probe, at(R_MID - WALL / 2, 0.05));
    expect(inWall.with).toEqual(['glass']);
    expect(inWall.depth).toBeGreaterThan(0.004);
    expect(inWall.depth).toBeLessThan(0.0065);
    // Swept down the axis from above the mouth, it reaches the base, not a lid.
    const sweep = world.sweep(probe, at(0, 0.15), at(0, -0.05));
    expect(sweep.with).toBe('glass');
    const hitHeight = 0.15 - sweep.fraction * 0.2;
    expect(Math.abs(hitHeight - (WALL + 0.005))).toBeLessThan(0.2 * MM);
    // A probe glass set down over the first one, mouth to mouth and coaxial, overlaps nothing
    // until the rims meet: its own round surfaces are left out of the probe as well.
    const over: Pose = {
      p: [0, 0, 2 * HEIGHT + WALL + 0.0012],
      q: quatFromAxisAngle([1, 0, 0], Math.PI),
    };
    expect(world.penetration(glassPieces, over).depth).toBe(0);
    expect(quatRotate(over.q, [0, 0, 1])[2]).toBeCloseTo(-1, 12);
  });
});
