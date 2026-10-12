// The dynamics of a load on a moving basket, each against its closed form: a block of known
// friction on a level grid of wires that is driven through a prescribed motion. Whether items
// slide when a basket is pushed is decided by the motion the session prescribes; what is
// checked here is that, for a given motion, the engine and the wrapper do what Coulomb friction
// and Newton's law of restitution say:
//
// - a block stays put while the grid accelerates by less than mu g, and slides by the closed
//   form when it accelerates, brakes or stops dead by more;
// - the friction of a block does not depend on how many wires carry it, nor on whether it
//   slides along them or across them (no contact is merged away, and the long wires are cut
//   into lengths for the engine, see `MAX_CAPSULE_LEAF_LENGTH`);
// - the velocity a driven (kinematic) body is given is the velocity its contacts work with;
// - a block that runs into the end of the grid leaves it with the pair's restitution, and so
//   does a block the end of a moving grid runs into.
import type { Pose, Vec3 } from '@spotless/core';
import { STANDARD_GRAVITY } from '@spotless/core';
import type { CollisionBox, CollisionPiece, MassProperties } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { rackTravelDistances } from './mechanics.ts';
import { JOLT_SETTINGS, LOADING_TIME_STEP } from './settings.ts';
import { MAX_CAPSULE_LEAF_LENGTH } from './shapes.ts';
import { NO_MASS, useWorlds } from './test-world.ts';
import type { ContactPairLookup } from './types.ts';
import type { JoltPhysicsWorld } from './world.ts';

const DT = LOADING_TIME_STEP;
const G = STANDARD_GRAVITY;
const MM = 1e-3;
/** Radius of the wires of the grid, metres. */
const WIRE = 0.002;
/** Half extents of the block: 100 x 100 x 20 mm, 0.4 kg. */
const HALF: Vec3 = [0.05, 0.05, 0.01];
const MASS = 0.4;
/** Height of the block's centre when it lies on the wires. */
const ON_WIRES = 2 * WIRE + HALF[2];

const newWorld = useWorlds();

function boxMass(mass: number, h: Vec3): MassProperties {
  return {
    mass,
    com: [0, 0, 0],
    inertia: [
      (mass * (h[1] ** 2 + h[2] ** 2)) / 3,
      0,
      0,
      0,
      (mass * (h[0] ** 2 + h[2] ** 2)) / 3,
      0,
      0,
      0,
      (mass * (h[0] ** 2 + h[1] ** 2)) / 3,
    ],
  };
}

const BLOCK: CollisionBox = {
  kind: 'box',
  part: 'block',
  halfExtents: HALF,
  radius: 0,
  pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
};

/**
 * A level grid of `count` parallel wires, 1.2 m long, spread evenly under the block (the outer
 * two 80 mm apart), running along the direction of travel (y) or across it (x). Their tops are
 * at z = 2 WIRE. Wires across the travel are laid every `80 / (count - 1)` mm over the whole
 * length the block can slide.
 */
function grid(count: number, runs: 'along' | 'across'): CollisionPiece[] {
  const wires: CollisionPiece[] = [];
  const pitch = 0.08 / (count - 1);
  if (runs === 'along') {
    for (let i = 0; i < count; i++) {
      const x = -0.04 + i * pitch;
      wires.push({
        kind: 'capsule',
        part: 'wire',
        a: [x, -0.6, WIRE],
        b: [x, 0.6, WIRE],
        radius: WIRE,
      });
    }
  } else {
    for (let y = -0.3; y <= 0.3 + 1e-9; y += pitch) {
      wires.push({
        kind: 'capsule',
        part: 'wire',
        a: [-0.1, y, WIRE],
        b: [0.1, y, WIRE],
        radius: WIRE,
      });
    }
  }
  return wires;
}

const pairOf =
  (friction: number, restitution = 0): ContactPairLookup =>
  () => ({ friction, restitution });

const at = (x: number, y: number, z: number): Pose => ({ p: [x, y, z], q: [0, 0, 0, 1] });

/** A world with the grid as a kinematic body at the origin and the block at rest on it. */
async function onGrid(
  wires: readonly CollisionPiece[],
  friction: number,
  restitution = 0,
): Promise<JoltPhysicsWorld> {
  const world = await newWorld({ pairLookup: pairOf(friction, restitution) });
  world.addBody('grid', wires, NO_MASS, { material: 'wire' }, at(0, 0, 0), 'kinematic');
  world.addBody(
    'block',
    [BLOCK],
    boxMass(MASS, HALF),
    { material: 'block' },
    at(0, 0, ON_WIRES + 1e-4),
    'dynamic',
  );
  world.step(120);
  return world;
}

/** A world with the grid as a kinematic body at the origin and the block at rest on it. */
async function onGridWith(
  wires: readonly CollisionPiece[],
  friction: number,
  settings: Partial<typeof JOLT_SETTINGS>,
): Promise<JoltPhysicsWorld> {
  const world = await newWorld({ pairLookup: pairOf(friction), settings });
  world.addBody('grid', wires, NO_MASS, { material: 'wire' }, at(0, 0, 0), 'kinematic');
  world.addBody(
    'block',
    [BLOCK],
    boxMass(MASS, HALF),
    { material: 'block' },
    at(0, 0, ON_WIRES + 1e-4),
    'dynamic',
  );
  world.step(120);
  return world;
}

/** Drives the grid to the given distances along +y, one per step, then lets `rest` steps pass. */
function drive(world: JoltPhysicsWorld, distances: readonly number[], rest: number): void {
  for (const s of distances) {
    world.setPose('grid', at(0, s, 0));
    world.step(1);
  }
  world.step(rest);
}

/** Where the block is on the grid, along the travel, metres. */
function onGridAt(world: JoltPhysicsWorld): number {
  return world.getPose('block').p[1] - world.getPose('grid').p[1];
}

describe('a block on a level grid of wires that is driven', () => {
  it('is carried at a steady speed without slipping: the contacts work with the velocity the grid is given', async () => {
    // Up to 0.5 m/s at 1 m/s^2 (mu g = 2.9 m/s^2 holds that), then 0.6 m at the steady 0.5 m/s.
    const world = await onGrid(grid(3, 'along'), 0.3);
    const up = rackTravelDistances(
      0.25,
      { peakSpeed: 0.5, acceleration: 1, endStopDeceleration: 1 },
      DT,
    );
    // Only the first half of that profile: the acceleration to 0.5 m/s over 0.125 m.
    const accelerating = up.filter((s) => s <= 0.125 + 1e-12);
    const cruise: number[] = [];
    const s0 = accelerating[accelerating.length - 1] as number;
    for (let k = 1; k <= 288; k++) cruise.push(s0 + 0.5 * DT * k);
    for (const s of accelerating) {
      world.setPose('grid', at(0, s, 0));
      world.step(1);
    }
    const slipSpeedingUp = onGridAt(world);
    for (const s of cruise) {
      world.setPose('grid', at(0, s, 0));
      world.step(1);
    }
    // While it is carried the block has the velocity of the grid, exactly as far as single
    // precision goes, and has not moved on it: 0.6 m travelled, under 0.02 mm of slip.
    expect(Math.abs(world.getVelocity('block').linear[1] - 0.5)).toBeLessThan(1e-4);
    expect(Math.abs(slipSpeedingUp)).toBeLessThan(0.05 * MM);
    expect(Math.abs(onGridAt(world) - slipSpeedingUp)).toBeLessThan(0.02 * MM);
    expect(world.getPose('grid').p[1]).toBeGreaterThan(0.72);
  });

  it.each([
    [2, 'along'],
    [3, 'along'],
    [5, 'along'],
    [9, 'along'],
    [3, 'across'],
    [9, 'across'],
  ] as const)(
    'on %d wires running %s the travel, slides at the end stop by v^2 (d - mu g) / (2 d mu g)',
    async (count, runs) => {
      // The platform's profile with a start gentle enough to hold: 1 m/s^2 up to 0.5 m/s, then
      // an end stop of 5 m/s^2, against mu g = 2.94 m/s^2. While the grid brakes the block gains
      // on it at d - mu g; when the grid stands the block has (d - mu g) v / d left and stops
      // against friction alone. In all 17.5 mm, whatever the number of wires that carry it.
      const mu = 0.3;
      const profile = { peakSpeed: 0.5, acceleration: 1, endStopDeceleration: 5 };
      const world = await onGrid(grid(count, runs), mu);
      drive(world, rackTravelDistances(0.4, profile, DT), 240);
      const muG = mu * G;
      const expected = (0.5 ** 2 * (5 - muG)) / (2 * 5 * muG);
      expect(expected).toBeCloseTo(0.0175, 4);
      const slid = onGridAt(world);
      // To 6 %: the profile is applied in whole steps of 4 ms (the end stop lasts 24 of them).
      // Measured: 16.76 mm (4.2 % short) on 2, 3, 5 and 9 wires along the travel and on 3
      // across it, 16.57 mm (5.3 % short) on 9 across it, where the leading edge of the block
      // climbs each of the wires it slides onto.
      expect(Math.abs(slid / expected - 1), `slid ${(slid * 1000).toFixed(2)} mm`).toBeLessThan(
        0.06,
      );
      // The same on any number of wires, either way: nothing of the friction is lost or added.
      expect(Math.abs(slid - 0.01676), `slid ${(slid * 1000).toFixed(2)} mm`).toBeLessThan(0.0002);
      // It has not turned or left its line, and lies on the wires.
      expect(Math.abs(world.getPose('block').p[0])).toBeLessThan(0.1 * MM);
      expect(Math.abs(world.getPose('block').p[2] - ON_WIRES)).toBeLessThan(0.15 * MM);
      expect(Math.hypot(...world.getVelocity('block').linear)).toBeLessThan(1e-4);
    },
  );

  it('stays where it is when neither the start nor the end stop exceeds mu g', async () => {
    // 2 m/s^2 either way against mu g = 2.94 m/s^2: carried 0.4 m without a tenth of a
    // millimetre of slip, along the wires and across them.
    for (const runs of ['along', 'across'] as const) {
      const world = await onGrid(grid(5, runs), 0.3);
      drive(
        world,
        rackTravelDistances(0.4, { peakSpeed: 0.5, acceleration: 2, endStopDeceleration: 2 }, DT),
        120,
      );
      expect(Math.abs(onGridAt(world)), runs).toBeLessThan(0.1 * MM);
      expect(world.getPose('grid').p[1]).toBeCloseTo(0.4, 6);
    }
  });

  it('falls behind a start that is too hard by the closed form, and slides on from a grid that stops dead by v^2 / (2 mu g)', async () => {
    const mu = 0.3;
    const muG = mu * G;
    // Start at 6 m/s^2 up to 0.3 m/s (0.05 s): the block follows at mu g, 0.153 m/s behind in
    // speed and 3.8 mm in place when the grid has its speed, and loses another
    // 0.153^2 / (2 mu g) = 4.0 mm before it has caught up. Then the grid runs on steadily.
    const world = await onGrid(grid(5, 'along'), mu);
    const v = 0.3;
    const a = 6;
    const tUp = v / a;
    const distances: number[] = [];
    for (let k = 1; k <= 240; k++) {
      const t = k * DT;
      distances.push(t <= tUp ? 0.5 * a * t * t : 0.5 * a * tUp * tUp + v * (t - tUp));
    }
    for (const s of distances) {
      world.setPose('grid', at(0, s, 0));
      world.step(1);
    }
    const lagSpeed = (a - muG) * tUp;
    const behind = 0.5 * (a - muG) * tUp * tUp + lagSpeed ** 2 / (2 * muG);
    expect(behind).toBeCloseTo(0.0078, 4);
    const lag = -onGridAt(world);
    // To 10 % (measured 7.2 mm): the start lasts twelve steps.
    expect(Math.abs(lag / behind - 1), `fell ${(lag * 1000).toFixed(2)} mm behind`).toBeLessThan(
      0.1,
    );
    expect(Math.abs(world.getVelocity('block').linear[1] - v)).toBeLessThan(1e-4);

    // The grid is not driven again: it stands from one step to the next (no end stop to brake
    // it). The block slides on by v^2 / (2 mu g) = 15.3 mm.
    world.step(240);
    const on = -lag + (v * v) / (2 * muG);
    expect((v * v) / (2 * muG)).toBeCloseTo(0.0153, 4);
    expect(Math.abs((onGridAt(world) - -lag) / ((v * v) / (2 * muG)) - 1)).toBeLessThan(0.05);
    expect(Math.abs(onGridAt(world) - on)).toBeLessThan(1 * MM);
  });

  it('holds on a slope below atan(mu) and slides down one above it at g (sin - mu cos), on two wires as on nine', async () => {
    // Friction as a force: the grid tilted (gravity turned about x), the block on wires that
    // run down the slope. mu = 0.3 holds 16.7 degrees.
    const mu = 0.3;
    for (const count of [2, 9]) {
      for (const [degrees, holds] of [
        [15, true],
        [20, false],
      ] as const) {
        const slope = (degrees * Math.PI) / 180;
        const world = await newWorld({
          pairLookup: pairOf(mu),
          gravity: [0, G * Math.sin(slope), -G * Math.cos(slope)],
        });
        world.addBody(
          'grid',
          grid(count, 'along'),
          NO_MASS,
          { material: 'wire' },
          at(0, 0, 0),
          'static',
        );
        world.addBody(
          'block',
          [BLOCK],
          boxMass(MASS, HALF),
          { material: 'block' },
          at(0, -0.4, ON_WIRES),
          'dynamic',
        );
        world.step(240);
        const moved = world.getPose('block').p[1] + 0.4;
        const label = `${count} wires, ${degrees} degrees`;
        if (holds) {
          expect(Math.abs(moved), label).toBeLessThan(0.05 * MM);
        } else {
          // 0.5 a t^2 with a = g (sin - mu cos) = 0.59 m/s^2: 295 mm in the second.
          const a = G * (Math.sin(slope) - mu * Math.cos(slope));
          expect(Math.abs(moved / (0.5 * a) - 1), label).toBeLessThan(0.03);
        }
      }
    }
  });

  it("is stopped short by every wire it slides onto when contacts are made the engine's way", async () => {
    // Why a contact between a wire and a piece that is still apart from it is only made where
    // the two will meet (`JoltWorldSettings.predictRoundContacts`). The engine's own contact
    // holds the leading edge of the block to the line between it and the next wire, level
    // with the tops of the wires it lies on: the wire is a wall for a step. The same end stop
    // as above on 9 wires across the travel, with the rule and without.
    const mu = 0.3;
    const profile = { peakSpeed: 0.5, acceleration: 1, endStopDeceleration: 5 };
    const slide = async (predictRoundContacts: boolean): Promise<number> => {
      const world = await onGridWith(grid(9, 'across'), mu, { predictRoundContacts });
      drive(world, rackTravelDistances(0.4, profile, DT), 240);
      return onGridAt(world);
    };
    const expected = (0.5 ** 2 * (5 - mu * G)) / (2 * 5 * mu * G);
    const withRule = await slide(true);
    const without = await slide(false);
    expect(Math.abs(withRule / expected - 1)).toBeLessThan(0.06);
    // Without it the block stops at least 15 % short (measured before the rule existed, on 3
    // and 9 wires: 23 to 29 % short of the slide along the wires).
    expect(without).toBeLessThan(0.85 * expected);
    expect(without).toBeGreaterThan(0.5 * expected);
  });

  it('cuts the wires into lengths for the engine without a seam the block can feel', async () => {
    // The 1.2 m wires above go to the engine as lengths of at most 40 mm; the block has slid
    // over a dozen joints in the tests above. Here it slides 0.3 m along two wires at a steady
    // deceleration: its speed falls by mu g t all the way, to 1 %, and it neither rises nor
    // dips by more than 0.05 mm (measured 0.027 mm).
    expect(MAX_CAPSULE_LEAF_LENGTH).toBeLessThan(0.1);
    const mu = 0.1;
    const world = await newWorld({ pairLookup: pairOf(mu) });
    world.addBody('grid', grid(2, 'along'), NO_MASS, { material: 'wire' }, at(0, 0, 0), 'static');
    world.addBody(
      'block',
      [BLOCK],
      boxMass(MASS, HALF),
      { material: 'block' },
      at(0, -0.4, ON_WIRES + 1e-4),
      'dynamic',
    );
    world.step(120);
    world.setVelocity('block', [0, 0.8, 0], [0, 0, 0]);
    let lowest = Infinity;
    let highest = -Infinity;
    let worst = 0;
    for (let k = 1; k <= 168; k++) {
      world.step(1);
      const z = world.getPose('block').p[2];
      lowest = Math.min(lowest, z);
      highest = Math.max(highest, z);
      const expected = 0.8 - mu * G * k * DT;
      worst = Math.max(worst, Math.abs(world.getVelocity('block').linear[1] - expected));
    }
    expect(worst).toBeLessThan(0.008);
    expect(highest - lowest).toBeLessThan(0.05 * MM);
    // 0.7 s at a mean of 0.457 m/s: 320 mm, over eight joints of each wire.
    expect(world.getPose('block').p[1] + 0.4).toBeGreaterThan(0.3);
  });
});

describe('restitution at the end of a basket', () => {
  /** The grid with a wall across its far end, its face at y = 0.2. */
  const walled = (): CollisionPiece[] => [
    ...grid(3, 'along'),
    {
      kind: 'box',
      part: 'end',
      halfExtents: [0.1, 0.01, 0.03],
      radius: 0,
      pose: at(0, 0.21, 0.03),
    },
  ];

  it.each([0.5, 0.1])(
    'a block that runs into it at 0.5 m/s leaves at e times that; below the restitution speed it stops (e = %d)',
    async (e) => {
      // No friction, so that the block arrives with the speed it was given.
      const world = await onGrid(walled(), 0, e);
      world.setVelocity('block', [0, 0.5, 0], [0, 0, 0]);
      let back = 0;
      for (let k = 0; k < 120; k++) {
        world.step(1);
        back = Math.min(back, world.getVelocity('block').linear[1]);
      }
      expect(Math.abs(-back / 0.5 - e), `left at ${(-back).toFixed(3)} m/s`).toBeLessThan(0.02);
      // Under the restitution speed (0.2 m/s) a contact does not bounce at all.
      expect(JOLT_SETTINGS.minVelocityForRestitution).toBe(0.2);
      const slow = await onGrid(walled(), 0, e);
      slow.setVelocity('block', [0, 0.15, 0], [0, 0, 0]);
      let slowBack = 0;
      for (let k = 0; k < 480; k++) {
        slow.step(1);
        slowBack = Math.min(slowBack, slow.getVelocity('block').linear[1]);
      }
      expect(-slowBack).toBeLessThan(0.002);
      expect(slow.getPose('block').p[1]).toBeGreaterThan(0.2 - HALF[1] - 0.2 * MM);
    },
  );

  it('a block the end of a moving grid runs into leaves at (1 + e) times the speed of the grid', async () => {
    // The grid is driven at a steady 0.5 m/s towards -y under a block that lies still on it
    // without friction; its end wall reaches the block after 0.15 m.
    const e = 0.5;
    const world = await onGrid(walled(), 0, e);
    let fastest = 0;
    for (let k = 1; k <= 120; k++) {
      world.setPose('grid', at(0, -0.5 * DT * k, 0));
      world.step(1);
      fastest = Math.min(fastest, world.getVelocity('block').linear[1]);
    }
    expect(Math.abs(-fastest / 0.5 - (1 + e)), `left at ${(-fastest).toFixed(3)} m/s`).toBeLessThan(
      0.03,
    );
  });
});
