// The mechanics built on the world: stability probe, rack travel, spray-arm sweep, dispenser
// lid. Each is checked against a value worked out by hand from the scene.
import type { Pose, Vec3 } from '@spotless/core';
import {
  STANDARD_GRAVITY,
  poseTransformPoint,
  quatFromAxisAngle,
  quatRotate,
  v3Distance,
} from '@spotless/core';
import type { CollisionBox, CollisionPiece, MassProperties } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import type { RackProfile } from './mechanics.ts';
import {
  ARM_SWEEP_ANGLE_RESOLUTION,
  bodyMotion,
  probeStability,
  rackTravelDistances,
  reachFromAxis,
  sweepArm,
  sweepLid,
  travelRack,
  turnedPose,
} from './mechanics.ts';
import { LOADING_TIME_STEP, settleOptionsFor } from './settings.ts';
import {
  TEST_MATERIALS,
  axisFromVerticalDeg,
  makeChopstick,
  makePlate,
  makeRack,
  makeTumbler,
  plateInSlot,
  twelvePlates,
  uprightPose,
} from './test-shapes.ts';
import { AT_ORIGIN, NO_MASS, useWorlds } from './test-world.ts';
import type { ContactPairLookup } from './types.ts';
import { RACK_TRAVEL_PROFILE } from './types.ts';
import type { JoltPhysicsWorld } from './world.ts';

const DT = LOADING_TIME_STEP;
const SETTLE = settleOptionsFor(DT);
/** Gravity of the loading world, m/s^2 (`LOADING_GRAVITY` is standard gravity along -z). */
const G = STANDARD_GRAVITY;
const DEG = Math.PI / 180;
const MM = 1e-3;
const at = (x: number, y: number, z: number): Pose => ({ p: [x, y, z], q: [0, 0, 0, 1] });
const SURFACE = { material: 'steel' };

function box(part: string, half: Vec3, centre: Vec3 = [0, 0, 0]): CollisionBox {
  return { kind: 'box', part, halfExtents: half, radius: 0, pose: { p: centre, q: [0, 0, 0, 1] } };
}
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

const newWorld = useWorlds();

describe('bodyMotion', () => {
  it('is the distance of the origins and the angle of the relative rotation', () => {
    const before: Pose = { p: [0, 0, 0], q: quatFromAxisAngle([0, 0, 1], 0.2) };
    const after: Pose = { p: [0.003, 0.004, 0], q: quatFromAxisAngle([0, 0, 1], 0.5) };
    const motion = bodyMotion('x', before, after);
    expect(motion.id).toBe('x');
    expect(motion.displacement).toBeCloseTo(0.005, 12);
    expect(motion.rotation).toBeCloseTo(0.3, 12);
  });
});

describe('rackTravelDistances', () => {
  it('follows acceleration, constant speed and end-stop deceleration', () => {
    // 0.4 m at 0.5 m/s, 2 m/s^2 and 5 m/s^2: 0.25 s and 62.5 mm speeding up, 0.1 s and 25 mm
    // braking, 312.5 mm at speed taking 0.625 s: 0.975 s in all, 234 steps of 1/240 s.
    const s = rackTravelDistances(0.4, RACK_TRAVEL_PROFILE, DT);
    expect(s).toHaveLength(234);
    expect(s[s.length - 1]).toBe(0.4);
    // During the acceleration s = a t^2 / 2; at step 30 (0.125 s) that is 15.625 mm.
    expect(s[29]).toBeCloseTo(0.5 * 2 * 0.125 ** 2, 12);
    // In the middle of the cruise (step 120, t = 0.5 s): 62.5 mm + 0.5 m/s x 0.25 s.
    expect(s[119]).toBeCloseTo(0.0625 + 0.5 * 0.25, 12);
    // 0.05 s before the end: 5 x 0.05^2 / 2 = 6.25 mm to go.
    expect(s[233 - 12]).toBeCloseTo(0.4 - 0.5 * 5 * 0.05 ** 2, 12);
    // Never backwards, never faster than the peak speed, never accelerating harder than given.
    let previous = 0;
    let previousSpeed = 0;
    for (const x of s) {
      const speed = (x - previous) / DT;
      expect(speed).toBeGreaterThanOrEqual(0);
      expect(speed).toBeLessThanOrEqual(0.5 + 1e-9);
      expect((speed - previousSpeed) / DT).toBeLessThanOrEqual(2 + 1e-6);
      expect((previousSpeed - speed) / DT).toBeLessThanOrEqual(5 + 1e-6);
      previous = x;
      previousSpeed = speed;
    }
  });

  it('never reaches the peak speed on a travel that is too short for it', () => {
    // 20 mm: the speeds meet at sqrt(2 s a d / (a + d)) = 0.239 m/s after 0.1195 s, and
    // braking takes another 0.0478 s: 0.1673 s, 41 steps.
    const profile: RackProfile = RACK_TRAVEL_PROFILE;
    const s = rackTravelDistances(0.02, profile, DT);
    const peak = Math.sqrt((2 * 0.02 * 2 * 5) / 7);
    expect(s).toHaveLength(Math.ceil((peak / 2 + peak / 5) / DT));
    expect(s[s.length - 1]).toBe(0.02);
    let fastest = 0;
    let previous = 0;
    for (const x of s) {
      fastest = Math.max(fastest, (x - previous) / DT);
      previous = x;
    }
    expect(fastest).toBeLessThanOrEqual(peak + 1e-9);
    expect(fastest).toBeGreaterThan(0.9 * peak);
    expect(rackTravelDistances(0, profile, DT)).toEqual([]);
    expect(() => rackTravelDistances(-1, profile, DT)).toThrow(/invalid rack travel/);
  });
});

describe('turnedPose and reachFromAxis', () => {
  it('turns a part about a hinge that is not at its origin', () => {
    // A quarter turn about a vertical hinge through (1, 0, 0) of the part frame, the part
    // sitting at (10, 20, 30) in the tub: the part origin goes to hinge + R(-1, 0, 0).
    const pose: Pose = at(10, 20, 30);
    const turned = turnedPose(pose, { point: [1, 0, 0], axis: [0, 0, 2] }, Math.PI / 2);
    const origin = poseTransformPoint(turned, [0, 0, 0]);
    expect(v3Distance(origin, [11, 19, 30])).toBeLessThan(1e-12);
    // The hinge point itself does not move, and a point 1 beyond it swings to +y.
    expect(v3Distance(poseTransformPoint(turned, [1, 0, 0]), [11, 20, 30])).toBeLessThan(1e-12);
    expect(v3Distance(poseTransformPoint(turned, [2, 0, 0]), [11, 21, 30])).toBeLessThan(1e-12);
    // No turn, no change.
    expect(turnedPose(pose, { point: [1, 0, 0], axis: [0, 0, 1] }, 0)).toEqual(pose);
  });

  it('finds how far pieces reach from an axis, radii included', () => {
    const pieces: CollisionPiece[] = [
      { kind: 'capsule', part: 'blade', a: [-0.2, 0, 0], b: [0.25, 0, 0.03], radius: 0.01 },
      {
        kind: 'hull',
        part: 'tip',
        points: [
          [0, 0.3, 0],
          [0, 0, 0.5],
        ],
        radius: 0.002,
      },
      box('hub', [0.03, 0.04, 0.01], [0, 0, 0]),
    ];
    // About +z through the origin: the hull point at y = 0.3 plus its 2 mm radius.
    expect(reachFromAxis(pieces, { point: [0, 0, 0], axis: [0, 0, 1] })).toBeCloseTo(0.302, 12);
    // Without the hull: the capsule end at x = 0.25 plus 10 mm.
    expect(
      reachFromAxis(
        pieces.filter((p) => p.kind !== 'hull'),
        { point: [0, 0, 0], axis: [0, 0, 1] },
      ),
    ).toBeCloseTo(0.26, 12);
    // The hub alone: its corner at hypot(30, 40) = 50 mm.
    expect(
      reachFromAxis([pieces[2] as CollisionPiece], { point: [0, 0, 0], axis: [0, 0, 1] }),
    ).toBeCloseTo(0.05, 12);
  });
});

describe('probeStability', () => {
  it('passes a plate in its slot and an upright glass, and leaves the world as it was', async () => {
    const world = await newWorld();
    world.addBody(
      'rack',
      makeRack(),
      NO_MASS,
      { material: TEST_MATERIALS.wire },
      AT_ORIGIN,
      'static',
    );
    world.addBody(
      'floor',
      [box('floor', [0.2, 0.2, 0.01], [0.6, 0, -0.01])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    const plate = makePlate(36);
    const tumbler = makeTumbler(16);
    world.addBody(
      'plate',
      plate.pieces,
      plate.mass,
      { material: TEST_MATERIALS.ceramic },
      plateInSlot(plate, 3),
      'dynamic',
    );
    world.addBody(
      'tumbler',
      tumbler.pieces,
      tumbler.mass,
      { material: TEST_MATERIALS.glass },
      uprightPose([0.6, 0, 0.0002]),
      'dynamic',
    );
    expect(world.settle(SETTLE).atRest).toBe(true);
    const hash = world.stateHash();
    const contacts = world.contacts();
    const result = probeStability(world, {
      bodies: [
        { id: 'plate', mass: plate.mass.mass },
        { id: 'tumbler', mass: tumbler.mass.mass },
      ],
    });
    expect(result).toEqual({ stable: true, unstable: [] });
    // A 10 mm/s kick slides the glass v^2 / (2 mu g) = 0.013 mm: far inside the 1 mm tolerance.
    expect(world.stateHash()).toBe(hash);
    expect(world.contacts()).toEqual(contacts);
    expect(world.stats().activeBodies).toBe(0);
  });

  it('flags a chopstick balanced on its end although it had come to rest', async () => {
    const world = await newWorld();
    world.addBody(
      'floor',
      [box('floor', [0.2, 0.2, 0.01], [0, 0, -0.01])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    const stick = makeChopstick();
    const plate = makePlate(24);
    // Standing on its rounded end, exactly upright: an equilibrium, but not a stable one.
    const standing: Pose = {
      p: [0, 0.003, 0.12 + 0.0001],
      q: quatFromAxisAngle([1, 0, 0], Math.PI / 2),
    };
    world.addBody(
      'stick',
      stick.pieces,
      stick.mass,
      { material: TEST_MATERIALS.plastic },
      standing,
      'dynamic',
    );
    // A plate lying flat beside it, its rim 30 mm from the stick, is watched but not kicked.
    world.addBody(
      'plate',
      plate.pieces,
      plate.mass,
      { material: TEST_MATERIALS.ceramic },
      uprightPose([0.02, -0.16, 0.0002]),
      'dynamic',
    );
    // Settled without the disturbance of the standard settle, which is there to topple
    // exactly this (see rest.test.ts): the probe has to find it out on its own.
    const settled = world.settle(settleOptionsFor(DT, false));
    // The rest criterion is satisfied: nothing moves, the stick still stands.
    expect(settled.atRest).toBe(true);
    // (its long axis, item y, is within 0.1 degree of the vertical)
    expect(Math.abs(quatRotate(world.getPose('stick').q, [0, 1, 0])[2])).toBeGreaterThan(
      Math.cos(0.1 * DEG),
    );
    const hash = world.stateHash();
    const result = probeStability(world, {
      bodies: [{ id: 'stick', mass: stick.mass.mass }],
      watch: ['plate'],
    });
    expect(result.stable).toBe(false);
    expect(result.unstable.map((m) => m.id)).toEqual(['stick']);
    // Half a second after a 10 mm/s kick at 0.12 m height it has toppled by more than 5
    // degrees (the tolerance is 1 degree).
    expect(result.unstable[0]?.rotation).toBeGreaterThan(5 * DEG);
    expect(world.stateHash()).toBe(hash);
  });

  it('kicks along +x first, then in the other directions, and reports the largest excursion', async () => {
    // A puck on a frictionless floor with a fixed stop 2 mm from its +x face. A kick of 20 mm/s
    // for 0.25 s would carry it 5 mm: along +x it is stopped after 2 mm, any other way it is
    // free. One direction is therefore +x alone (2 mm); two directions add -x (5 mm).
    const world = await newWorld({ pairLookup: () => ({ friction: 0, restitution: 0 }) });
    const half: Vec3 = [0.02, 0.02, 0.01];
    world.addBody(
      'floor',
      [box('floor', [0.3, 0.3, 0.01], [0, 0, -0.01])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    world.addBody(
      'stop',
      [box('stop', [0.005, 0.03, 0.01], [0.027, 0, 0.01])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    world.addBody('puck', [box('b', half)], boxMass(0.2, half), SURFACE, at(0, 0, 0.01), 'dynamic');
    world.step(240);
    const probe = {
      kickSpeed: 0.02,
      settleTime: 0.25,
      positionTolerance: 0.001,
      angleTolerance: DEG,
    };
    const one = probeStability(world, {
      bodies: [{ id: 'puck', mass: 0.2 }],
      probe: { ...probe, directions: 1 },
    });
    expect(one.stable).toBe(false);
    // 2 mm to the stop, give or take the 0.1 mm of penetration the solver tolerates.
    expect(Math.abs((one.unstable[0]?.displacement ?? 0) - 0.002)).toBeLessThan(0.00015);
    const two = probeStability(world, {
      bodies: [{ id: 'puck', mass: 0.2 }],
      probe: { ...probe, directions: 2 },
    });
    expect(two.unstable[0]?.displacement).toBeCloseTo(0.005, 5);
    expect(two.unstable[0]?.rotation).toBeLessThan(1e-6);
    expect(() => probeStability(world, { bodies: [{ id: 'puck', mass: 0 }] })).toThrow(
      /needs its mass/,
    );
    expect(() =>
      probeStability(world, {
        bodies: [{ id: 'puck', mass: 0.2 }],
        probe: { ...probe, directions: 0 },
      }),
    ).toThrow(/directions/);
  });
});

describe('travelRack', () => {
  const half: Vec3 = [0.02, 0.02, 0.01];
  const trayPieces: CollisionPiece[] = [box('tray', [0.15, 0.3, 0.004], [0, 0, -0.004])];
  const start = at(0, -0.4, 0);

  it.each(['static', 'dynamic'] as const)(
    'refuses a %s rack, which would leave its load behind, and leaves the world alone',
    async (kind) => {
      // A rack that is not kinematic is teleported step by step: the box on it would stay where
      // it is and fall off the back, and the result would look like any other.
      const world = await newWorld();
      world.addBody(
        'floor',
        [box('floor', [1, 1, 0.01], [0, 0, -0.05])],
        NO_MASS,
        SURFACE,
        AT_ORIGIN,
        'static',
      );
      world.addBody('tray', trayPieces, boxMass(1, [0.15, 0.3, 0.004]), SURFACE, start, kind);
      world.addBody('basket', trayPieces, NO_MASS, SURFACE, at(0.5, -0.4, 0), 'kinematic');
      world.addBody(
        'box',
        [box('b', half)],
        boxMass(0.3, half),
        SURFACE,
        at(0, -0.4, half[2]),
        'dynamic',
      );
      expect(world.getKind('tray')).toBe(kind);
      const before = world.stateHash();
      // Wherever it stands in the list of rack bodies.
      for (const racks of [['tray'], ['basket', 'tray']]) {
        expect(() =>
          travelRack(world, { racks, travel: [0, 0.4, 0], riders: [{ id: 'box' }] }),
        ).toThrow(new RegExp(`rack body 'tray' is ${kind}`));
      }
      expect(world.stateHash()).toBe(before);
    },
  );

  it('makes a loose box slide by what the acceleration pulses and friction dictate', async () => {
    const mu = 0.15;
    const pair: ContactPairLookup = () => ({ friction: mu, restitution: 0 });
    const world = await newWorld({ pairLookup: pair });
    world.addBody('tray', trayPieces, NO_MASS, SURFACE, start, 'kinematic');
    world.addBody(
      'box',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0, -0.4, half[2]),
      'dynamic',
    );
    world.step(120);
    const result = travelRack(world, {
      racks: ['tray'],
      travel: [0, 0.4, 0],
      riders: [{ id: 'box' }],
    });
    // The tray is home, to a micrometre.
    expect(v3Distance(world.getPose('tray').p, [0, 0, 0])).toBeLessThan(1e-6);
    // mu g = 1.47 m/s^2 is less than both pulses, so the box slips twice.
    // Speeding up (2 m/s^2 for 0.25 s): it falls behind at 0.53 m/s^2, reaching 0.132 m/s and
    // 16.5 mm, then catches up in 0.09 s while losing another 5.9 mm: 22.4 mm behind.
    // Braking (5 m/s^2 for 0.1 s): it runs ahead at 3.53 m/s^2, reaching 0.353 m/s and 17.6 mm,
    // then slides 0.353^2 / (2 mu g) = 42.3 mm more: 59.9 mm ahead. Net 37.5 mm forward.
    const a = mu * G;
    const lagSpeed = (2 - a) * 0.25;
    const behind = 0.5 * (2 - a) * 0.25 ** 2 + lagSpeed ** 2 / (2 * a);
    const leadSpeed = (5 - a) * 0.1;
    const ahead = 0.5 * (5 - a) * 0.1 ** 2 + leadSpeed ** 2 / (2 * a);
    const expected = ahead - behind;
    expect(expected).toBeCloseTo(0.0375, 3);
    expect(result.moved).toHaveLength(1);
    expect(result.moved[0]?.id).toBe('box');
    // To 5 %: the pulses are applied in whole steps of 4 ms.
    expect(Math.abs((result.moved[0]?.displacement ?? 0) / expected - 1)).toBeLessThan(0.05);
    expect(world.getPose('box').p[1]).toBeCloseTo(expected, 2);
    expect(result.moved[0]?.rotation).toBeLessThan(1e-3);
    expect(result.fellOut).toEqual([]);
    expect(result.blockedBy).toBeUndefined();
    // It has settled.
    expect(world.settle({ ...SETTLE, minSteps: 0 }).atRest).toBe(true);
  });

  it('does not move a box that friction can hold through both pulses', async () => {
    // mu g = 5.9 m/s^2 exceeds the 5 m/s^2 of the end stop.
    const world = await newWorld({ pairLookup: () => ({ friction: 0.6, restitution: 0 }) });
    world.addBody('tray', trayPieces, NO_MASS, SURFACE, start, 'kinematic');
    world.addBody(
      'box',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0, -0.4, half[2]),
      'dynamic',
    );
    world.step(120);
    const result = travelRack(world, {
      racks: ['tray'],
      travel: [0, 0.4, 0],
      riders: [{ id: 'box' }],
    });
    expect(result.moved).toEqual([]);
    // Within 0.2 mm of where it stood on the tray.
    expect(Math.abs(world.getPose('box').p[1])).toBeLessThan(0.2 * MM);
  });

  it('displaces a loose item but not a slotted plate', async () => {
    // A rack pushed in firmly but not slammed: 0.4 m/s, reached at 0.4 m/s^2 and stopped at
    // 1.2 m/s^2. That is less than the friction of the plate holds (0.4 g) and far below what
    // tips it out of its lean (g d / h = 3 m/s^2 with its centre of mass 39 mm behind and
    // 125 mm above the foot of its rim), but more than a slippery box on the shelf beside it
    // can follow (0.05 g = 0.49 m/s^2).
    const pair: ContactPairLookup = (a, b) => ({
      friction: a === 'slippery' || b === 'slippery' ? 0.05 : 0.4,
      restitution: 0,
    });
    const world = await newWorld({ pairLookup: pair });
    world.addBody(
      'rack',
      makeRack(),
      NO_MASS,
      { material: TEST_MATERIALS.wire },
      start,
      'kinematic',
    );
    world.addBody(
      'shelf',
      [box('shelf', [0.1, 0.2, 0.004], [0.45, 0, -0.004])],
      NO_MASS,
      { material: TEST_MATERIALS.wire },
      start,
      'kinematic',
    );
    const plate = makePlate(36);
    world.addBody(
      'plate',
      plate.pieces,
      plate.mass,
      { material: TEST_MATERIALS.ceramic },
      plateInSlot(plate, 3, { origin: start.p }),
      'dynamic',
    );
    world.addBody(
      'box',
      [box('b', half)],
      boxMass(0.3, half),
      { material: 'slippery' },
      at(0.45, -0.4, half[2]),
      'dynamic',
    );
    expect(world.settle(SETTLE).atRest).toBe(true);
    const lean = 90 - axisFromVerticalDeg(world.getPose('plate').q);
    expect(lean).toBeGreaterThan(12);
    expect(lean).toBeLessThan(13.5);
    const plateBefore = world.getPose('plate');
    const profile: RackProfile = { peakSpeed: 0.4, acceleration: 0.4, endStopDeceleration: 1.2 };
    const result = travelRack(world, {
      racks: ['rack', 'shelf'],
      travel: [0, 0.4, 0],
      riders: [{ id: 'plate' }, { id: 'box' }],
      profile,
    });
    // The box runs on while the rack brakes for 0.4 / 1.2 = 0.333 s, then slides to rest:
    // (1.2 - mu g) t^2 / 2 + ((1.2 - mu g) t)^2 / (2 mu g) = 96.4 mm.
    const a = 0.05 * G;
    const t = 0.4 / 1.2;
    const expected = 0.5 * (1.2 - a) * t * t + ((1.2 - a) * t) ** 2 / (2 * a);
    expect(expected).toBeCloseTo(0.0964, 3);
    expect(result.moved.map((m) => m.id)).toEqual(['box']);
    // To 3 %: the time step cuts the braking into 80 pieces.
    expect(Math.abs((result.moved[0]?.displacement ?? 0) / expected - 1)).toBeLessThan(0.03);
    // The plate is where it was on the rack, to 0.2 mm and 0.1 degrees.
    const carried: Pose = {
      p: [plateBefore.p[0], plateBefore.p[1] + 0.4, plateBefore.p[2]],
      q: plateBefore.q,
    };
    const plateMotion = bodyMotion('plate', carried, world.getPose('plate'));
    expect(plateMotion.displacement).toBeLessThan(0.2 * MM);
    expect(plateMotion.rotation).toBeLessThan(0.1 * DEG);
  });

  it('slides a loose glass at the default end stop and rattles the slotted plate without unseating it', async () => {
    const world = await newWorld();
    // The rack with its tines, and a flat shelf fixed to it carrying an upright glass.
    world.addBody(
      'rack',
      makeRack(),
      NO_MASS,
      { material: TEST_MATERIALS.wire },
      start,
      'kinematic',
    );
    world.addBody(
      'shelf',
      [box('shelf', [0.1, 0.2, 0.004], [0.45, 0, -0.004])],
      NO_MASS,
      { material: TEST_MATERIALS.wire },
      start,
      'kinematic',
    );
    const plate = makePlate(36);
    const tumbler = makeTumbler(16);
    world.addBody(
      'plate',
      plate.pieces,
      plate.mass,
      { material: TEST_MATERIALS.ceramic },
      plateInSlot(plate, 3, { origin: start.p }),
      'dynamic',
    );
    world.addBody(
      'glass',
      tumbler.pieces,
      tumbler.mass,
      { material: TEST_MATERIALS.glass },
      uprightPose([0.45, -0.4, 0.0003]),
      'dynamic',
    );
    expect(world.settle(SETTLE).atRest).toBe(true);
    const plateBefore = world.getPose('plate');
    const leanBefore = 90 - axisFromVerticalDeg(plateBefore.q);
    const result = travelRack(world, {
      racks: ['rack', 'shelf'],
      travel: [0, 0.4, 0],
      riders: [{ id: 'plate' }, { id: 'glass' }],
      envelope: { min: [-0.3, -0.3, -0.05], max: [0.6, 0.3, 0.4] },
    });
    expect(result.blockedBy).toBeUndefined();
    expect(result.fellOut).toEqual([]);
    // The glass (mu = 0.4, so it holds through the 2 m/s^2 start) slides forward at the end
    // stop: (5 - mu g) 0.1^2 / 2 + ((5 - mu g) 0.1)^2 / (2 mu g) = 6.9 mm.
    const a = 0.4 * G;
    const expected = 0.5 * (5 - a) * 0.01 + ((5 - a) * 0.1) ** 2 / (2 * a);
    const glass = result.moved.find((m) => m.id === 'glass');
    expect(glass).toBeDefined();
    expect(Math.abs((glass?.displacement ?? 0) / expected - 1)).toBeLessThan(0.1);
    // The plate is held by the tines on both sides. It rattles (a 5 m/s^2 stop is more than the
    // 3 m/s^2 that lifts it off the tines it leans on) but ends in its slot: within 4 mm and
    // 2 degrees of where it stood, carried along with the rack; the slots are 40 mm apart.
    const carried: Pose = {
      p: [plateBefore.p[0], plateBefore.p[1] + 0.4, plateBefore.p[2]],
      q: plateBefore.q,
    };
    const plateMotion = bodyMotion('plate', carried, world.getPose('plate'));
    expect(plateMotion.displacement).toBeLessThan(4 * MM);
    expect(plateMotion.rotation).toBeLessThan(2 * DEG);
    const leanAfter = 90 - axisFromVerticalDeg(world.getPose('plate').q);
    expect(Math.abs(leanAfter - leanBefore)).toBeLessThan(2);
    // What the function reports for the plate is that same motion, measured in the rack's frame.
    const reported = result.moved.find((m) => m.id === 'plate');
    if (plateMotion.displacement > 1 * MM || plateMotion.rotation > 1 * DEG) {
      expect(reported?.displacement).toBeCloseTo(plateMotion.displacement, 6);
      expect(reported?.rotation).toBeCloseTo(plateMotion.rotation, 6);
    } else {
      expect(reported).toBeUndefined();
    }
    expect(glass?.displacement).toBeGreaterThan(2 * plateMotion.displacement);
  });

  it('carries twelve slotted plates at a steady 0.5 m/s without disturbing them', async () => {
    // The engine's sweep of fast bodies misreads a moving kinematic body: with it active the
    // plates were thrown up to 42 mm and 21 degrees from their places during this steady run.
    const world = await newWorld();
    world.addBody(
      'rack',
      makeRack(),
      NO_MASS,
      { material: TEST_MATERIALS.wire },
      start,
      'kinematic',
    );
    const plates = twelvePlates(24, 12345, start.p);
    for (const body of plates) {
      world.addBody(
        body.id,
        body.item.pieces,
        body.item.mass,
        { material: body.material },
        body.pose,
        'dynamic',
      );
    }
    expect(world.settle(SETTLE).atRest).toBe(true);
    const before = plates.map((body) => world.getPose(body.id));
    // 0.25 s at 2 m/s^2, then 150 steps at 0.5 m/s.
    let travelled = 0;
    for (let k = 1; k <= 210; k++) {
      const t = k * DT;
      travelled = t <= 0.25 ? 0.5 * 2 * t * t : 0.0625 + 0.5 * (t - 0.25);
      world.setPose('rack', at(0, -0.4 + travelled, 0));
      world.step(1);
    }
    plates.forEach((body, k) => {
      const was = before[k] as Pose;
      const carried: Pose = { p: [was.p[0], was.p[1] + travelled, was.p[2]], q: was.q };
      const motion = bodyMotion(body.id, carried, world.getPose(body.id));
      // Measured: 0.09 mm and 0.04 degrees at most.
      expect(motion.displacement).toBeLessThan(0.3 * MM);
      expect(motion.rotation).toBeLessThan(0.15 * DEG);
      expect(world.getVelocity(body.id).linear[1]).toBeCloseTo(0.5, 2);
    });
  });

  it('ends in the same state from the same state, whatever order the bodies were added in', async () => {
    const plate = makePlate(24);
    const tumbler = makeTumbler(12);
    const build = async (reversed: boolean): Promise<JoltPhysicsWorld> => {
      const world = await newWorld();
      const adds = [
        (): void =>
          world.addBody(
            'rack',
            makeRack(),
            NO_MASS,
            { material: TEST_MATERIALS.wire },
            start,
            'kinematic',
          ),
        (): void =>
          world.addBody(
            'shelf',
            [box('shelf', [0.1, 0.2, 0.004], [0.45, 0, -0.004])],
            NO_MASS,
            { material: TEST_MATERIALS.wire },
            start,
            'kinematic',
          ),
        (): void =>
          world.addBody(
            'plate',
            plate.pieces,
            plate.mass,
            { material: TEST_MATERIALS.ceramic },
            plateInSlot(plate, 3, { origin: start.p }),
            'dynamic',
          ),
        (): void =>
          world.addBody(
            'glass',
            tumbler.pieces,
            tumbler.mass,
            { material: TEST_MATERIALS.glass },
            uprightPose([0.45, -0.4, 0.0003]),
            'dynamic',
          ),
      ];
      if (reversed) adds.reverse();
      for (const add of adds) add();
      world.settle(SETTLE);
      return world;
    };
    const options = {
      racks: ['rack', 'shelf'],
      travel: [0, 0.4, 0] as Vec3,
      riders: [{ id: 'glass' }, { id: 'plate' }],
    };
    const world = await build(false);
    const before = world.snapshot();
    const first = travelRack(world, options);
    const hash = world.stateHash();
    // Something happened: the glass slid (previous test).
    expect(first.moved.map((m) => m.id)).toContain('glass');
    world.restore(before);
    expect(travelRack(world, options)).toEqual(first);
    expect(world.stateHash()).toBe(hash);
    const other = await build(true);
    expect(
      travelRack(other, {
        ...options,
        riders: [{ id: 'plate' }, { id: 'glass' }],
        racks: ['rack', 'shelf'],
      }),
    ).toEqual(first);
    expect(other.stateHash()).toBe(hash);
  });

  it('reports a rider that slides off the rack as fallen out', async () => {
    const world = await newWorld({ pairLookup: () => ({ friction: 0.15, restitution: 0 }) });
    // A short tray: the box starts with its centre 15 mm from the front edge and slides 37.5 mm
    // forward (see the first test), so it ends with all of its 40 mm length beyond the edge.
    world.addBody(
      'tray',
      [box('tray', [0.15, 0.1, 0.004], [0, 0, -0.004])],
      NO_MASS,
      SURFACE,
      start,
      'kinematic',
    );
    world.addBody(
      'box',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0, -0.4 + 0.085, half[2]),
      'dynamic',
    );
    world.addBody(
      'stays',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0.08, -0.4 - 0.05, half[2]),
      'dynamic',
    );
    // A third box that stays on the tray too, but is judged by a point 200 mm above its origin
    // (as a tall item would be by its reference point): that is above the envelope.
    world.addBody(
      'tall',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(-0.08, -0.4 - 0.05, half[2]),
      'dynamic',
    );
    world.step(120);
    const result = travelRack(world, {
      racks: ['tray'],
      travel: [0, 0.4, 0],
      riders: [{ id: 'box' }, { id: 'stays' }, { id: 'tall', point: [0, 0, 0.2] }],
      // The tray itself, and 100 mm above it, in the tray's own frame.
      envelope: { min: [-0.15, -0.1, -0.01], max: [0.15, 0.1, 0.1] },
      settle: { ...SETTLE, maxSteps: 480 },
    });
    expect(result.fellOut).toEqual(['box', 'tall']);
    expect(result.moved.map((m) => m.id)).toEqual(['box', 'stays', 'tall']);
    // The two that stayed slid the same 37.5 mm on the tray (5 %).
    for (const id of ['stays', 'tall']) {
      const slid = result.moved.find((m) => m.id === id)?.displacement ?? 0;
      expect(Math.abs(slid / 0.0375 - 1)).toBeLessThan(0.05);
    }
    // It fell off the front and is on its way down or gone.
    expect(world.getPose('box').p[2]).toBeLessThan(-0.05);
  });

  it('stops when a rider is caught between the rack and something fixed, and names it', async () => {
    const world = await newWorld();
    // A tray with a lip behind the rider, so that the tray cannot simply slide out from under
    // it, and a fixed wall 200 mm along the way.
    const lipped: CollisionPiece[] = [
      box('tray', [0.15, 0.3, 0.004], [0, 0, -0.004]),
      box('lip', [0.15, 0.004, 0.02], [0, -0.034, 0.02]),
    ];
    world.addBody('tray', lipped, NO_MASS, SURFACE, start, 'kinematic');
    const tall: Vec3 = [0.02, 0.03, 0.05];
    world.addBody(
      'pan',
      [box('b', tall)],
      boxMass(0.8, tall),
      SURFACE,
      at(0, -0.4, tall[2]),
      'dynamic',
    );
    world.addBody(
      'free',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0.1, -0.4, half[2]),
      'dynamic',
    );
    // The wall hangs above the tray: only the tall rider reaches it.
    world.addBody(
      'wall',
      [box('wall', [0.3, 0.01, 0.03], [0, -0.16, 0.07])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    world.step(120);
    const result = travelRack(world, {
      racks: ['tray'],
      travel: [0, 0.4, 0],
      riders: [{ id: 'free' }, { id: 'pan' }],
    });
    expect(result.blockedBy).toBe('pan');
    // The pan's front face (30 mm ahead of its centre) meets the wall's face at y = -0.17 when
    // the tray has travelled 200 mm. The rack stops there, to the 2.1 mm it travels in a step,
    // and not 10 mm further on where the five steps of persistent resistance were complete.
    const travelled = world.getPose('tray').p[1] + 0.4;
    expect(travelled).toBeGreaterThan(0.2 - 0.0023);
    expect(travelled).toBeLessThan(0.2 + 0.0002);
    // The pan stands as it stood, between the lip and the wall: not pressed into either (its
    // faces are 60 mm apart, and so are the lip and the wall now, to a step of travel), not
    // knocked over, and not even counted as moved on the tray.
    expect(axisFromVerticalDeg(world.getPose('pan').q)).toBeLessThan(0.5);
    expect(world.getPose('pan').p[1] + 0.03).toBeLessThan(-0.17 + 0.0001);
    expect(result.moved.map((m) => m.id)).toEqual(['free']);
    // The rack stopped dead from 0.5 m/s, so the free box slid on by v^2 / (2 mu g) = 31.9 mm.
    const free = result.moved.find((m) => m.id === 'free');
    expect(Math.abs((free?.displacement ?? 0) / (0.25 / (2 * 0.4 * G)) - 1)).toBeLessThan(0.05);
  });
});

describe('travelRack, blocked by something in the way of the rack itself', () => {
  it('names the loose thing the rack runs into, and is not fooled by the first knock', async () => {
    // A block lies on the tub floor in the path of the tray, 100 mm short of a fixed wall. The
    // tray strikes it at 0.5 m/s (0.15 N s on a 0.3 kg block: 36 N if it took one step, but
    // gone within a few), shoves it along the floor (1.2 N of friction) and only then, when the
    // block is against the wall, meets resistance that lasts.
    const world = await newWorld({ pairLookup: () => ({ friction: 0.4, restitution: 0 }) });
    const start = at(0, -0.4, 0);
    world.addBody(
      'tray',
      [box('tray', [0.15, 0.3, 0.004], [0, 0, -0.004])],
      NO_MASS,
      SURFACE,
      start,
      'kinematic',
    );
    world.addBody(
      'tub_floor',
      [box('floor', [0.4, 0.8, 0.01], [0, 0, -0.02])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    // The wall's face is at y = 0.12; the block is 40 mm long, so it is pinned when the tray's
    // front edge (at y = -0.1 to begin with) reaches y = 0.08: after 180 mm of travel.
    world.addBody(
      'tub_wall',
      [box('wall', [0.4, 0.01, 0.05], [0, 0.13, 0.04])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    const half: Vec3 = [0.02, 0.02, 0.01];
    world.addBody('block', [box('b', half)], boxMass(0.3, half), SURFACE, at(0, 0, 0), 'dynamic');
    world.addBody(
      'rider',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0.08, -0.5, half[2]),
      'dynamic',
    );
    world.step(120);
    const result = travelRack(world, {
      racks: ['tray'],
      travel: [0, 0.4, 0],
      riders: [{ id: 'rider' }],
    });
    expect(result.blockedBy).toBe('block');
    const travelled = world.getPose('tray').p[1] + 0.4;
    // 180 mm, less at most the 2.1 mm the tray travels in a step.
    expect(travelled).toBeGreaterThan(0.18 - 0.0023);
    expect(travelled).toBeLessThan(0.18 + 0.0002);
    // The block lies at the wall, not in it: its front face within a step of travel of
    // y = 0.12 and not beyond it; and the tray is not in the block either.
    const front = world.getPose('block').p[1] + 0.02;
    expect(front).toBeGreaterThan(0.12 - 0.0023);
    expect(front).toBeLessThan(0.12 + 0.0001);
    expect(world.getPose('tray').p[1] + 0.3).toBeLessThan(front - 0.04 + 0.0001);
  });
});

describe('sweepArm', () => {
  // A spray arm 440 mm long and 20 mm thick, turning about +z through its middle, 30 mm below
  // the rack's base grid.
  const arm: CollisionPiece[] = [
    { kind: 'capsule', part: 'arm', a: [-0.22, 0, 0], b: [0.22, 0, 0], radius: 0.01 },
  ];
  const armPose = at(0, 0, -0.03);

  it('turns freely under a rack that nothing hangs through', async () => {
    const world = await newWorld();
    world.addBody(
      'rack',
      makeRack(),
      NO_MASS,
      { material: TEST_MATERIALS.wire },
      AT_ORIGIN,
      'static',
    );
    const plate = makePlate(24);
    world.addBody(
      'plate',
      plate.pieces,
      plate.mass,
      { material: TEST_MATERIALS.ceramic },
      plateInSlot(plate, 5),
      'dynamic',
    );
    world.settle(SETTLE);
    const hash = world.stateHash();
    expect(sweepArm(world, { arm: 'lower_arm', pieces: arm, pose: armPose })).toEqual({
      arm: 'lower_arm',
      free: true,
    });
    expect(world.stateHash()).toBe(hash);
  });

  it('finds the angle at which it first meets an item hanging through the rack', async () => {
    const world = await newWorld();
    world.addBody(
      'rack',
      makeRack(),
      NO_MASS,
      { material: TEST_MATERIALS.wire },
      AT_ORIGIN,
      'static',
    );
    // A ladle-like item: a crossbar resting across two base wires and a stem hanging 60 mm down
    // between them.
    const ladle: CollisionPiece[] = [
      { kind: 'capsule', part: 'bar', a: [-0.03, 0, 0], b: [0.03, 0, 0], radius: 0.004 },
      { kind: 'capsule', part: 'stem', a: [0, 0, 0], b: [0, 0, -0.06], radius: 0.003 },
    ];
    const mass: MassProperties = {
      mass: 0.08,
      com: [0, 0, -0.015],
      inertia: [4e-5, 0, 0, 0, 5e-5, 0, 0, 0, 2e-5],
    };
    // Over the gap between the wires at x = 16 and 48 mm, between the tine rows at y = 80 and
    // 120 mm.
    world.addBody(
      'ladle',
      ladle,
      mass,
      { material: TEST_MATERIALS.steel },
      at(0.032, 0.1, 0.006),
      'dynamic',
    );
    expect(world.settle(SETTLE).atRest).toBe(true);
    const pose = world.getPose('ladle');
    // It hangs: the stem reaches below the arm's plane (30 mm under the wires).
    const tip = poseTransformPoint(pose, [0, 0, -0.06]);
    expect(tip[2]).toBeLessThan(-0.045);
    const top = poseTransformPoint(pose, [0, 0, 0]);
    // The stem is (nearly) a vertical line through the arm's plane at:
    const t = (armPose.p[2] - top[2]) / (tip[2] - top[2]);
    const cross: Vec3 = [
      top[0] + t * (tip[0] - top[0]),
      top[1] + t * (tip[1] - top[1]),
      armPose.p[2],
    ];
    const rho = Math.hypot(cross[0], cross[1]);
    const phi = Math.atan2(cross[1], cross[0]);
    // Turning anticlockwise from along x, the arm's +x half meets the stem when the stem is
    // (arm radius + stem radius) = 13 mm from the arm's axis: at phi - asin(13 mm / rho).
    const expected = phi - Math.asin(0.013 / rho);
    const result = sweepArm(world, { arm: 'lower_arm', pieces: arm, pose: armPose });
    expect(result.free).toBe(false);
    expect(result.blockedBy).toBe('ladle');
    // To twice the resolution of the search, 0.02 degrees (65.14 degrees here).
    expect(Math.abs((result.firstContactAngle ?? 0) - expected)).toBeLessThan(
      2 * ARM_SWEEP_ANGLE_RESOLUTION,
    );
    expect(expected).toBeGreaterThan(60 * DEG);
    // Turning the other way it is the -x half that arrives first, after 180 - phi - asin(...).
    const reverse = sweepArm(world, {
      arm: 'lower_arm',
      pieces: arm,
      pose: armPose,
      direction: -1,
    });
    expect(
      Math.abs((reverse.firstContactAngle ?? 0) - (Math.PI - phi - Math.asin(0.013 / rho))),
    ).toBeLessThan(2 * ARM_SWEEP_ANGLE_RESOLUTION);
    // With the ladle ignored, or with a shorter arm that does not reach it, the arm is free.
    expect(
      sweepArm(world, { arm: 'lower_arm', pieces: arm, pose: armPose, ignore: ['ladle'] }).free,
    ).toBe(true);
    const short: CollisionPiece[] = [
      { kind: 'capsule', part: 'arm', a: [-0.08, 0, 0], b: [0.08, 0, 0], radius: 0.01 },
    ];
    expect(rho).toBeGreaterThan(0.095);
    expect(sweepArm(world, { arm: 'lower_arm', pieces: short, pose: armPose }).free).toBe(true);
  });

  it('locates first contact to the stated resolution against an analytic obstacle', async () => {
    const world = await newWorld();
    // A fixed ball of 5 mm radius in the arm's plane, 150 mm out at 100 degrees.
    const phi = 100 * DEG;
    const rho = 0.15;
    world.addBody(
      'ball',
      [{ kind: 'capsule', part: 'ball', a: [0, 0, 0], b: [0, 0, 0], radius: 0.005 }],
      NO_MASS,
      SURFACE,
      at(rho * Math.cos(phi), rho * Math.sin(phi), -0.03),
      'static',
    );
    const result = sweepArm(world, { arm: 'a', pieces: arm, pose: armPose });
    // 15 mm between the axes at contact: 100 deg - asin(0.1) = 94.261 deg.
    const expected = phi - Math.asin(0.015 / rho);
    expect(Math.abs((result.firstContactAngle ?? 0) - expected)).toBeLessThan(
      2 * ARM_SWEEP_ANGLE_RESOLUTION,
    );
    // An arm that starts in contact reports angle zero.
    const blocked = sweepArm(world, {
      arm: 'a',
      pieces: arm,
      pose: { p: armPose.p, q: quatFromAxisAngle([0, 0, 1], phi) },
    });
    expect(blocked).toEqual({ arm: 'a', free: false, firstContactAngle: 0, blockedBy: 'ball' });
    // A body carrying the arm's own id is never what blocks it.
    world.addBody('a', arm, NO_MASS, SURFACE, armPose, 'kinematic');
    expect(sweepArm(world, { arm: 'a', pieces: arm, pose: armPose }).blockedBy).toBe('ball');
  });
});

describe('sweepLid', () => {
  // The dispenser lid: a 100 x 60 mm flap, 3 mm thick, hinged along its lower edge (the x axis
  // of its frame), closed against the door at y = -0.27 and swinging 90 degrees into the tub.
  const lid: CollisionPiece[] = [box('lid', [0.05, 0.0015, 0.03], [0, 0, 0.03])];
  const lidPose = at(0, -0.27, 0.15);
  const hinge = { point: [0, 0, 0] as Vec3, axis: [1, 0, 0] as Vec3, angle: -Math.PI / 2 };

  it('is free in an empty tub and blocked by what stands in its swing', async () => {
    const world = await newWorld();
    world.addBody(
      'floor',
      [box('floor', [0.3, 0.3, 0.01], [0, 0, -0.01])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    expect(sweepLid(world, { pieces: lid, pose: lidPose, hinge, ignore: ['floor'] })).toEqual({
      free: true,
      blockedBy: [],
    });
    // Two tall boards near the door. Open, the lid lies flat at z = 150 mm reaching to
    // y = -0.21; its swing passes through everything within 60 mm of the hinge line.
    const board = (y: number): CollisionPiece[] => [box('board', [0.05, 0.005, 0.1], [0, y, 0.1])];
    world.addBody('board_near', board(-0.23), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('board_far', board(-0.19), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    // The near board (its face at y = -0.235, 35 mm from the hinge) is in the swing; the far one
    // (face at -0.195, 75 mm away) is not.
    const result = sweepLid(world, { pieces: lid, pose: lidPose, hinge });
    expect(result).toEqual({ free: false, blockedBy: ['board_near'] });
    // Both boards short enough to stay below the hinge line (top at z = 140 mm): free.
    world.removeBody('board_near');
    world.removeBody('board_far');
    world.addBody(
      'low',
      [box('board', [0.05, 0.005, 0.07], [0, -0.23, 0.07])],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    expect(sweepLid(world, { pieces: lid, pose: lidPose, hinge }).free).toBe(true);
  });

  it('reaches exactly as far as the lid is long', async () => {
    // The fully open lid reaches 60 mm from the hinge line: a board whose face is 59.5 mm away
    // is in its way, one at 60.5 mm is not.
    for (const [distance, free] of [
      [0.0595, false],
      [0.0605, true],
    ] as const) {
      const world = await newWorld();
      const face = -0.27 + distance;
      world.addBody(
        'board',
        [box('board', [0.05, 0.005, 0.1], [0, face + 0.005, 0.1])],
        NO_MASS,
        SURFACE,
        AT_ORIGIN,
        'static',
      );
      expect(sweepLid(world, { pieces: lid, pose: lidPose, hinge }).free).toBe(free);
    }
  });

  it('accepts the swept volume itself in place of a hinge', async () => {
    const world = await newWorld();
    // The quarter cylinder swept by the flap, approximated by a box of its bounding size.
    const swept: CollisionPiece[] = [box('swept', [0.05, 0.03, 0.03], [0, 0.03, 0.03])];
    world.addBody(
      'b_item',
      [box('b', [0.01, 0.01, 0.01])],
      NO_MASS,
      SURFACE,
      at(0.02, -0.24, 0.16),
      'static',
    );
    world.addBody(
      'a_item',
      [box('b', [0.01, 0.01, 0.01])],
      NO_MASS,
      SURFACE,
      at(-0.02, -0.25, 0.17),
      'static',
    );
    world.addBody(
      'outside',
      [box('b', [0.01, 0.01, 0.01])],
      NO_MASS,
      SURFACE,
      at(0, -0.15, 0.17),
      'static',
    );
    expect(sweepLid(world, { pieces: swept, pose: lidPose })).toEqual({
      free: false,
      blockedBy: ['a_item', 'b_item'],
    });
    expect(sweepLid(world, { pieces: swept, pose: lidPose, ignore: ['a_item', 'b_item'] })).toEqual(
      { free: true, blockedBy: [] },
    );
  });
});
