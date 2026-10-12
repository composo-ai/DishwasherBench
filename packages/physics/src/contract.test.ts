// What the rest of the platform relies on without looking inside: the numbers fixed by the design
// documents, the entry point, the engine behind it and the life cycle of a world.
import { createRequire } from 'node:module';
import { RESTITUTION_VELOCITY_THRESHOLD } from '@spotless/catalogue';
import { STANDARD_GRAVITY, quatFromAxisAngle, quatRotate } from '@spotless/core';
import type { CollisionPiece } from '@spotless/geometry';
import initJolt from 'jolt-physics';
import { describe, expect, it } from 'vitest';
import * as physics from './index.ts';
import {
  acquireJoltModule,
  idleJoltModuleCount,
  joltWrapperCount,
  releaseJoltModule,
} from './jolt-module.ts';

const DEG = Math.PI / 180;
const NO_MASS = physics.NO_MASS;
const AT_ORIGIN = { p: [0, 0, 0], q: [0, 0, 0, 1] } as const;

describe('numbers fixed by the design documents', () => {
  it('carries the rest criterion and stability probe of platform.md section 5', () => {
    // 5 mm/s, 0.05 rad/s, 0.5 s; 10 mm/s kicks in four directions, 0.5 s, 1 mm and 1 degree.
    expect(physics.REST_CRITERION).toEqual({
      linearSpeed: 0.005,
      angularSpeed: 0.05,
      holdTime: 0.5,
    });
    expect(physics.STABILITY_PROBE.kickSpeed).toBe(0.01);
    expect(physics.STABILITY_PROBE.directions).toBe(4);
    expect(physics.STABILITY_PROBE.settleTime).toBe(0.5);
    expect(physics.STABILITY_PROBE.positionTolerance).toBe(0.001);
    expect(physics.STABILITY_PROBE.angleTolerance / DEG).toBeCloseTo(1, 12);
    // The thresholds of "moved" in a rack travel are the same 1 mm and 1 degree.
    expect(physics.MOVED_DISTANCE).toBe(0.001);
    expect(physics.MOVED_ANGLE / DEG).toBeCloseTo(1, 12);
  });

  it('carries the rack profile of benchmark.md section 4.7 and the solver summary of items.md 11.4', () => {
    // Peak 0.5 m/s, 2 m/s^2 from rest, 5 m/s^2 at the end stop.
    expect(physics.RACK_TRAVEL_PROFILE).toEqual({
      peakSpeed: 0.5,
      acceleration: 2,
      endStopDeceleration: 5,
    });
    // Standard gravity down: one value for loading and for the wash (sim-core.md section 1),
    // which items.md 11.4 writes rounded as 9.81 m/s^2. Settle budget: no minimum (items.md
    // 11.4 proposed 2 s in blocks of 0.5 s; rest is now looked for after every step, see
    // SETTLE_BUDGET), at most 10 s.
    expect(physics.LOADING_GRAVITY).toEqual([0, 0, -STANDARD_GRAVITY]);
    expect(STANDARD_GRAVITY).toBe(9.80665);
    expect(Math.abs(-physics.LOADING_GRAVITY[2] / 9.81 - 1)).toBeLessThan(5e-4);
    expect(physics.SETTLE_BUDGET).toEqual({ minTime: 0, blockTime: 0, maxTime: 10 });
    // The standard disturbance of a settle: one degree, four ways, a twentieth of a second
    // each, once everything has been calm for a twentieth of a second, the first step of it
    // solved without the contact forces of the step before (as for a body just woken).
    expect(physics.SETTLE_DISTURBANCE).toEqual({
      tilt: Math.PI / 180,
      directions: 4,
      directionTime: 0.05,
      calmTime: 0.05,
      coldStart: true,
    });
  });

  it('keeps the engine configuration the bake-off found necessary (spike-rigid-body.md)', () => {
    const s = physics.JOLT_SETTINGS;
    // 1/240 s: at 1/120 s a knife passed through a wire even when swept.
    expect(physics.LOADING_TIME_STEP).toBe(1 / 240);
    expect(s.collisionSteps).toBe(1);
    // Manifold reduction off: on, bowls overlapped by up to 16.7 mm.
    expect(s.useManifoldReduction).toBe(false);
    expect(s.speculativeContactDistance).toBe(0.005);
    expect(s.penetrationSlop).toBe(0.0001);
    expect(s.linearCast).toBe(true);
    // 20 velocity iterations, twice the bake-off's 10: with 10 a knife standing on its handle
    // end never met the rest speeds (see settings.ts).
    expect([s.numVelocitySteps, s.numPositionSteps]).toEqual([20, 4]);
    expect(s.minConvexRadius).toBe(0.0002);
    expect(s.hullTolerance).toBe(0.00001);
    // Rest is the platform criterion, applied by the wrapper; the engine never sleeps a body.
    expect([s.restLinearSpeed, s.restAngularSpeed, s.restHoldTime]).toEqual([
      physics.REST_CRITERION.linearSpeed,
      physics.REST_CRITERION.angularSpeed,
      physics.REST_CRITERION.holdTime,
    ]);
    // One number for the engine and the catalogue.
    expect(s.minVelocityForRestitution).toBe(0.2);
    expect(s.minVelocityForRestitution).toBe(RESTITUTION_VELOCITY_THRESHOLD);
    expect([s.linearDamping, s.angularDamping]).toEqual([0, 0]);
    // No more contact constraints than the build's fixed 10 MB scratch allocator can hold.
    expect(s.maxContactConstraints).toBeLessThanOrEqual(16000);
    // Determinism (platform.md section 2) and the per-pair material table (section 5).
    expect(s.deterministicSimulation).toBe(true);
    expect(s.contactCoefficients).toBe('pair-table');
  });

  it('is written against the engine that is installed', () => {
    // The wrapper parses the engine's saved contact state and writes into its contact settings
    // at probed offsets; both belong to one engine version.
    const installed = createRequire(import.meta.url)('jolt-physics/package.json') as {
      version: string;
    };
    expect(installed.version).toBe(physics.JOLT_PACKAGE_VERSION);
    expect(physics.JOLT_ENGINE_VERSION).toBe('5.6.0');
  });
});

describe('entry point', () => {
  it('exports the world factory and the mechanics of platform.md section 5', () => {
    for (const name of [
      'createPhysicsWorld',
      'settleOptionsFor',
      'probeStability',
      'travelRack',
      'rackTravelDistances',
      'sweepArm',
      'sweepLid',
      'turnedPose',
      'measurePenetration',
    ] as const) {
      expect(typeof physics[name]).toBe('function');
    }
  });
});

describe('the engine', () => {
  it('uses the conventions of @spotless/core: right-handed, quaternions as (x, y, z, w)', async () => {
    const Jolt = await initJolt();
    const v = new Jolt.Vec3(1, 2, 3);
    // |(1, 2, 3)| = sqrt(14); Jolt computes in f32, so the tolerance is a few f32 ulps.
    expect(v.Length()).toBeCloseTo(Math.sqrt(14), 6);
    // A quarter turn about +z takes +x to +y, in Jolt and in the core alike.
    const axis = new Jolt.Vec3(0, 0, 1);
    const q = Jolt.Quat.prototype.sRotation(axis, Math.PI / 2);
    const x = new Jolt.Vec3(1, 0, 0);
    const r = q.MulVec3(x);
    const core = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    const expected = quatRotate(core, [1, 0, 0]);
    expect(r.GetX()).toBeCloseTo(expected[0], 6);
    expect(r.GetY()).toBeCloseTo(expected[1], 6);
    expect(r.GetZ()).toBeCloseTo(expected[2], 6);
    expect(r.GetY()).toBeCloseTo(1, 6);
    expect(
      [q.GetX(), q.GetY(), q.GetZ(), q.GetW()]
        .map((c, i) => c - (core[i] as number))
        .every((d) => Math.abs(d) < 1e-6),
    ).toBe(true);
    for (const obj of [v, axis, x]) Jolt.destroy(obj);
  });
});

describe('life cycle of a world', () => {
  const floor: CollisionPiece[] = [
    {
      kind: 'box',
      part: 'floor',
      halfExtents: [0.3, 0.3, 0.01],
      radius: 0,
      pose: { p: [0, 0, -0.01], q: [0, 0, 0, 1] },
    },
  ];
  const ball: CollisionPiece[] = [
    { kind: 'capsule', part: 'ball', a: [0, 0, 0], b: [0, 0, 0], radius: 0.01 },
  ];
  const ballMass = {
    mass: 0.1,
    com: [0, 0, 0],
    inertia: [4e-6, 0, 0, 0, 4e-6, 0, 0, 0, 4e-6],
  } as const;
  const create = (): Promise<physics.JoltPhysicsWorld> =>
    physics.createPhysicsWorld({
      timeStep: physics.LOADING_TIME_STEP,
      gravity: physics.LOADING_GRAVITY,
      pairLookup: () => ({ friction: 0.4, restitution: 0.1 }),
    });
  const populate = (world: physics.JoltPhysicsWorld): void => {
    world.addBody('floor', floor, NO_MASS, { material: 'steel' }, AT_ORIGIN, 'static');
    for (let i = 0; i < 40; i++) {
      world.addBody(
        `ball_${i}`,
        ball,
        ballMass,
        { material: 'steel' },
        { p: [0.025 * (i % 8), 0.025 * (i >> 3), 0.011], q: [0, 0, 0, 1] },
        'dynamic',
      );
    }
    world.step(30);
  };

  it('hands its engine instance to the next world, and ten worlds in a row leak nothing', async () => {
    const first = await create();
    const emptyHeap = first.stats().freeMemory;
    populate(first);
    // The bodies, their shapes and their contacts take room on the fixed heap...
    expect(first.stats().freeMemory).toBeLessThan(emptyHeap - 20_000);
    const idleBefore = idleJoltModuleCount();
    first.dispose();
    expect(idleJoltModuleCount()).toBe(idleBefore + 1);
    // ...and a disposed world can no longer be used, though disposing it twice is harmless.
    expect(() => first.step(1)).toThrow(/disposed/);
    expect(() => first.dispose()).not.toThrow();

    let world = await create();
    // The next world took the instance over instead of instantiating another 128 MB heap.
    expect(idleJoltModuleCount()).toBe(idleBefore);
    for (let cycle = 0; cycle < 10; cycle++) {
      populate(world);
      world.dispose();
      world = await create();
    }
    // A fresh world on the recycled instance has the heap of the very first, to 64 kB of 128 MB.
    expect(Math.abs(world.stats().freeMemory - emptyHeap)).toBeLessThan(65_536);
    expect(idleJoltModuleCount()).toBe(idleBefore);
    world.dispose();
  });

  it('leaves no JavaScript object of a disposed world behind in the engine bindings', async () => {
    // The bindings keep every object they hand out in a table per class until it is destroyed
    // explicitly, which objects freed by reference count (shapes, their settings, bodies)
    // never are: a world of 40 bodies left 80 to 1200 of them behind, for the life of the
    // process, and the WebAssembly heap measured above cannot see it. The count is taken on
    // the instance itself, between worlds.
    const module = await acquireJoltModule();
    releaseJoltModule(module);
    expect(joltWrapperCount(module)).toBe(0);
    const counts: number[] = [];
    for (let cycle = 0; cycle < 30; cycle++) {
      const world = await create();
      populate(world);
      // One and the same instance, recycled; while the world lives, its objects are counted.
      if (cycle === 0) expect(joltWrapperCount(module)).toBeGreaterThan(80);
      // Churn inside one world: bodies and probe shapes come and go.
      for (let i = 0; i < 10; i++) world.removeBody(`ball_${i}`);
      world.penetration(ball, { p: [0, 0, 0.011], q: [0, 0, 0, 1] });
      world.step(5);
      world.dispose();
      counts.push(joltWrapperCount(module));
    }
    expect(counts.every((count) => count === 0)).toBe(true);

    // And inside one long-lived world: 300 bodies come and go, each with pieces of its own (so
    // each with an engine shape of its own). The table is swept every 16 bodies, so it holds a
    // few dozen objects at any time and not the 1700 that 300 bodies used to leave.
    const world = await create();
    world.addBody('floor', floor, NO_MASS, { material: 'steel' }, AT_ORIGIN, 'static');
    let most = 0;
    for (let cycle = 0; cycle < 300; cycle++) {
      const own: CollisionPiece[] = [{ ...(ball[0] as CollisionPiece) }];
      world.addBody(
        'visitor',
        own,
        ballMass,
        { material: 'steel' },
        { p: [0, 0, 0.011], q: [0, 0, 0, 1] },
        'dynamic',
      );
      world.step(2);
      world.removeBody('visitor');
      world.step(1);
      if (cycle >= 100) most = Math.max(most, joltWrapperCount(module));
    }
    expect(most).toBeLessThan(150);
    world.dispose();
    expect(joltWrapperCount(module)).toBe(0);
  });

  it('carries its time step on the contract, and the mechanics take it from there', async () => {
    // A puck on a frictionless floor, kicked at 20 mm/s and followed for 0.25 s, travels 5 mm
    // whatever the step of the world it lives in. The probe is told no time step: if it assumed
    // one, the world stepping twice as finely would report half the distance.
    const half = [0.02, 0.02, 0.01] as const;
    const puck: CollisionPiece[] = [
      { kind: 'box', part: 'puck', halfExtents: half, radius: 0, pose: AT_ORIGIN },
    ];
    const puckMass = {
      mass: 0.2,
      com: [0, 0, 0],
      inertia: [
        (0.2 / 3) * (half[1] ** 2 + half[2] ** 2),
        0,
        0,
        0,
        (0.2 / 3) * (half[0] ** 2 + half[2] ** 2),
        0,
        0,
        0,
        (0.2 / 3) * (half[0] ** 2 + half[1] ** 2),
      ],
    } as const;
    for (const timeStep of [1 / 240, 1 / 480]) {
      const world: physics.PhysicsWorld = await physics.createPhysicsWorld({
        timeStep,
        gravity: physics.LOADING_GRAVITY,
        pairLookup: () => ({ friction: 0, restitution: 0 }),
      });
      try {
        expect(world.timeStep).toBe(timeStep);
        world.addBody('floor', floor, NO_MASS, { material: 'steel' }, AT_ORIGIN, 'static');
        world.addBody(
          'puck',
          puck,
          puckMass,
          { material: 'steel' },
          { p: [0, 0, half[2]], q: [0, 0, 0, 1] },
          'dynamic',
        );
        // Settled and asleep, so that it starts from rest. (While still awake it creeps on a
        // frictionless floor, by 0.1 mm/s after half a second: the engine's contact normal is
        // vertical to 2.4e-5 rad, single precision. Any friction at all holds it.)
        expect(world.settle(physics.settleOptionsFor(timeStep)).atRest).toBe(true);
        expect(world.getVelocity('puck').linear).toEqual([0, 0, 0]);
        const result = physics.probeStability(world, {
          bodies: [{ id: 'puck', mass: puckMass.mass }],
          probe: {
            kickSpeed: 0.02,
            directions: 1,
            settleTime: 0.25,
            positionTolerance: 0.001,
            angleTolerance: DEG,
          },
        });
        expect(result.stable).toBe(false);
        expect(Math.abs((result.unstable[0]?.displacement ?? 0) - 0.005)).toBeLessThan(2e-6);
        // The settle budget in steps follows from the same number: the cap of 10 s is 2400 or
        // 4800 steps, the hold of 0.5 s is 120 or 240, each way of the disturbance 12 or 24.
        const options = physics.settleOptionsFor(world.timeStep);
        expect(options.maxSteps).toBe(Math.round(10 / timeStep));
        expect(options.restHoldSteps).toBe(Math.round(0.5 / timeStep));
        expect(options.disturbance?.directionSteps).toBe(Math.round(0.05 / timeStep));
      } finally {
        world.dispose();
      }
    }
  });

  it('teleports any body through the contract: a kinematic tray leaves its load behind', async () => {
    // setPose drives a kinematic body through the next step and carries what rests on it;
    // teleport is the move that does not. Both are on the platform contract.
    const world: physics.PhysicsWorld = await create();
    try {
      const half = [0.02, 0.02, 0.01] as const;
      const tray: CollisionPiece[] = [
        {
          kind: 'box',
          part: 'tray',
          halfExtents: [0.1, 0.1, 0.005],
          radius: 0,
          pose: { p: [0, 0, -0.005], q: [0, 0, 0, 1] },
        },
      ];
      const box: CollisionPiece[] = [
        { kind: 'box', part: 'box', halfExtents: half, radius: 0, pose: AT_ORIGIN },
      ];
      const m = 0.3;
      const inertia = [
        (m / 3) * (half[1] ** 2 + half[2] ** 2),
        0,
        0,
        0,
        (m / 3) * (half[0] ** 2 + half[2] ** 2),
        0,
        0,
        0,
        (m / 3) * (half[0] ** 2 + half[1] ** 2),
      ] as const;
      world.addBody('tray', tray, NO_MASS, { material: 'steel' }, AT_ORIGIN, 'kinematic');
      world.addBody(
        'box',
        box,
        { mass: m, com: [0, 0, 0], inertia },
        { material: 'steel' },
        { p: [0, 0, half[2]], q: [0, 0, 0, 1] },
        'dynamic',
      );
      world.step(240);
      // Driven 2 mm in one step (0.48 m/s): the tray is there after the step, and friction 0.4
      // has begun to drag the box along (a = mu g, so 0.4 x 9.81 / 240^2 = 0.07 mm at least).
      world.setPose('tray', { p: [0.002, 0, 0], q: [0, 0, 0, 1] });
      expect(world.getPose('tray').p[0]).toBe(0);
      world.step(1);
      expect(world.getPose('tray').p[0]).toBeCloseTo(0.002, 6);
      expect(world.getPose('box').p[0]).toBeGreaterThan(0.00005);
      const carried = world.getPose('box').p[0];
      // Teleported 0.5 m: the tray is there at once, at rest, and the box has not followed.
      world.teleport('tray', { p: [0.5, 0, 0], q: [0, 0, 0, 1] });
      expect(world.getPose('tray').p[0]).toBeCloseTo(0.5, 6);
      expect(world.getVelocity('tray').linear).toEqual([0, 0, 0]);
      expect(world.getPose('box').p[0]).toBeCloseTo(carried, 9);
      // With nothing under it the box falls: 0.1 s of free fall is 49 mm.
      world.step(24);
      expect(world.getPose('box').p[2]).toBeLessThan(half[2] - 0.04);
    } finally {
      world.dispose();
    }
  });

  it('refuses a time step or gravity that is not a finite number', async () => {
    const options = {
      gravity: physics.LOADING_GRAVITY,
      pairLookup: () => ({ friction: 0.4, restitution: 0.1 }),
    };
    await expect(physics.createPhysicsWorld({ ...options, timeStep: 0 })).rejects.toThrow();
    await expect(
      physics.createPhysicsWorld({ ...options, timeStep: Number.NaN }),
    ).rejects.toThrow();
    await expect(
      physics.createPhysicsWorld({ ...options, timeStep: 1 / 240, gravity: [0, 0, Number.NaN] }),
    ).rejects.toThrow();
  });
});
