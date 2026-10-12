// The loading world against analytic mechanics: integration, contact forces, mass properties,
// per-pair friction and restitution, kinematic bodies, settling and the body bookkeeping.
import type { Mat3, Pose, Vec3 } from '@spotless/core';
import {
  STANDARD_GRAVITY,
  inertiaRotate,
  mat3Inverse,
  mat3MulVec3,
  quatAngleBetween,
  quatFromAxisAngle,
  quatFromEulerXYZ,
  quatRotate,
  symmetricEigen3,
  v3Add,
  v3Cross,
  v3Distance,
  v3Length,
  v3Scale,
  v3Sub,
} from '@spotless/core';
import type {
  CollisionBox,
  CollisionCapsule,
  CollisionPiece,
  MassProperties,
} from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { JOLT_SETTINGS, LOADING_TIME_STEP, settleOptionsFor } from './settings.ts';
import { AT_ORIGIN, NO_MASS, useWorlds } from './test-world.ts';
import type { ContactPairLookup } from './types.ts';
import { REST_CRITERION } from './types.ts';
import type { JoltModule } from './jolt-module.ts';
import { fastJoltCallbackCount } from './jolt-module.ts';
import { conditionInertia, segmentDistance } from './world.ts';

const DT = LOADING_TIME_STEP;
/** Gravity of the loading world, m/s^2 (`LOADING_GRAVITY` is standard gravity along -z). */
const G = STANDARD_GRAVITY;
const DEG = Math.PI / 180;
const at = (x: number, y: number, z: number): Pose => ({ p: [x, y, z], q: [0, 0, 0, 1] });

function box(part: string, half: Vec3, centre: Vec3 = [0, 0, 0], radius = 0): CollisionBox {
  return { kind: 'box', part, halfExtents: half, radius, pose: { p: centre, q: [0, 0, 0, 1] } };
}
function ball(radius: number, part = 'ball'): CollisionCapsule {
  return { kind: 'capsule', part, a: [0, 0, 0], b: [0, 0, 0], radius };
}
/** Mass properties of a solid box of half extents `h` centred on the item origin. */
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
function ballMass(mass: number, radius: number): MassProperties {
  const i = 0.4 * mass * radius * radius;
  return { mass, com: [0, 0, 0], inertia: [i, 0, 0, 0, i, 0, 0, 0, i] };
}
/** A 0.6 m square floor slab whose top surface is the plane z = 0. */
const FLOOR: CollisionPiece[] = [box('floor', [0.3, 0.3, 0.01], [0, 0, -0.01])];
const SURFACE = { material: 'steel' };

const newWorld = useWorlds();

describe('integration', () => {
  it('lets a body fall as the semi-implicit Euler scheme prescribes', async () => {
    const world = await newWorld();
    world.addBody('ball', [ball(0.01)], ballMass(0.1, 0.01), SURFACE, at(0, 0, 1), 'dynamic');
    const n = 240;
    world.step(n);
    // v_n = -g n dt and z_n = z_0 - g dt^2 n (n + 1) / 2 (velocity is advanced before position).
    // Tolerances: single-precision accumulation over 240 steps at 100 engine units.
    const v = world.getVelocity('ball');
    expect(v.linear[2]).toBeCloseTo(-G * n * DT, 4);
    expect(world.getPose('ball').p[2]).toBeCloseTo(1 - (G * DT * DT * n * (n + 1)) / 2, 5);
    expect(Math.hypot(v.linear[0], v.linear[1])).toBe(0);
    expect(v3Length(v.angular)).toBe(0);
  });

  it('takes gravity from the options, in any direction', async () => {
    const world = await newWorld({ gravity: [1.5, 0, 0] });
    world.addBody('ball', [ball(0.01)], ballMass(0.1, 0.01), SURFACE, AT_ORIGIN, 'dynamic');
    world.step(120);
    expect(world.getVelocity('ball').linear[0]).toBeCloseTo(1.5 * 120 * DT, 5);
    expect(world.getVelocity('ball').linear[2]).toBe(0);
  });
});

describe('resting contact', () => {
  it('reports contacts whose normal forces add up to the weight', async () => {
    const world = await newWorld();
    const half: Vec3 = [0.05, 0.03, 0.02];
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'block',
      [box('base', half)],
      boxMass(0.7, half),
      SURFACE,
      at(0, 0, 0.0205),
      'dynamic',
    );
    world.step(120);
    const contacts = world.contacts();
    expect(contacts).toHaveLength(1);
    const contact = contacts[0];
    expect(contact).toMatchObject({
      a: 'block',
      b: 'floor',
      partA: 'base',
      partB: 'floor',
      points: 4,
    });
    // m g = 0.7 x 9.80665 = 6.865 N, to 0.5 %.
    expect(contact?.normalForceN).toBeCloseTo(0.7 * G, 1);
    expect(Math.abs((contact?.normalForceN ?? 0) / (0.7 * G) - 1)).toBeLessThan(0.005);
    // From the block down into the floor, at the middle of the block's underside.
    expect(contact?.normal[2]).toBeCloseTo(-1, 6);
    expect(v3Length(contact?.position ?? [1, 1, 1])).toBeLessThan(1e-4);
    // No deeper than the penetration slop (0.1 mm) plus rounding.
    expect(contact?.maxPenetration).toBeLessThan(JOLT_SETTINGS.penetrationSlop + 1e-6);
    // The block sits on the plane z = 0 to within the slop.
    expect(Math.abs(world.getPose('block').p[2] - half[2])).toBeLessThan(1.1e-4);
  });

  it('keeps the contacts and forces of a body after it has fallen asleep', async () => {
    const world = await newWorld();
    const half: Vec3 = [0.03, 0.03, 0.01];
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'block',
      [box('base', half)],
      boxMass(0.4, half),
      SURFACE,
      at(0, 0, 0.0101),
      'dynamic',
    );
    world.step(60);
    expect(world.isActive('block')).toBe(true);
    const awake = world.contacts();
    world.step(480);
    expect(world.isActive('block')).toBe(false);
    // The engine drops the contacts of sleeping bodies; the world must not.
    const asleep = world.contacts();
    expect(asleep).toHaveLength(1);
    expect(asleep[0]?.points).toBe(4);
    expect(Math.abs((asleep[0]?.normalForceN ?? 0) / (0.4 * G) - 1)).toBeLessThan(0.005);
    expect(asleep[0]?.a).toBe(awake[0]?.a);
    // Stepping a sleeping world changes nothing.
    world.step(240);
    expect(world.contacts()).toEqual(asleep);
  });

  it('does not report the points the engine tracks ahead of contact', async () => {
    const world = await newWorld({ gravity: [0, 0, 0] });
    const half: Vec3 = [0.03, 0.03, 0.01];
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    // Hovering 0.2 mm above the floor without gravity: inside the 0.3 mm within which two
    // pieces get a contact however slowly they approach.
    world.addBody(
      'block',
      [box('base', half)],
      boxMass(0.4, half),
      SURFACE,
      at(0, 0, 0.0102),
      'dynamic',
    );
    world.step(2);
    expect(world.contacts()).toEqual([]);
    const points = world.contactPoints();
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(point.touching).toBe(false);
      expect(point.gap).toBeCloseTo(0.0002, 6);
      expect(point.normalForceN).toBe(0);
    }
  });

  it('restricts contacts to the bodies asked for', async () => {
    const world = await newWorld();
    const half: Vec3 = [0.02, 0.02, 0.01];
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'a',
      [box('base', half)],
      boxMass(0.2, half),
      SURFACE,
      at(-0.1, 0, 0.0101),
      'dynamic',
    );
    world.addBody(
      'b',
      [box('base', half)],
      boxMass(0.2, half),
      SURFACE,
      at(0.1, 0, 0.0101),
      'dynamic',
    );
    world.step(60);
    expect(world.contacts().map((c) => c.a)).toEqual(['a', 'b']);
    expect(world.contacts({ bodies: ['b'] }).map((c) => c.a)).toEqual(['b']);
    expect(world.contacts({ bodies: [] })).toEqual([]);
  });
});

describe('mass properties', () => {
  // A tensor with all six components different, about a centre of mass well away from the
  // centroid of the collision proxy (a box centred on the origin).
  const inertia: Mat3 = [4.0e-4, 0.6e-4, -0.3e-4, 0.6e-4, 5.5e-4, 0.8e-4, -0.3e-4, 0.8e-4, 3.2e-4];
  const mass: MassProperties = { mass: 1.3, com: [0.012, -0.02, 0.006], inertia };
  const pieces = [box('body', [0.05, 0.04, 0.03])];
  const pose: Pose = { p: [0.2, -0.1, 0.4], q: quatFromEulerXYZ(0.4, -0.7, 1.1) };

  it('responds to an impulse with the supplied mass, centre of mass and inertia tensor', async () => {
    const world = await newWorld({ gravity: [0, 0, 0] });
    world.addBody('body', pieces, mass, SURFACE, pose, 'dynamic');
    const impulse: Vec3 = [0.03, -0.05, 0.02];
    const point: Vec3 = [0.23, -0.07, 0.43];
    world.applyImpulse('body', impulse, point);
    const v = world.getVelocity('body');
    // dv = J / m; dw = I^-1 (r x J) with I in tub axes and r from the supplied centre of mass.
    const comWorld = v3Add(pose.p, quatRotate(pose.q, mass.com));
    const expectedLinear = v3Scale(impulse, 1 / mass.mass);
    const expectedAngular = mat3MulVec3(
      mat3Inverse(inertiaRotate(inertia, pose.q)),
      v3Cross(v3Sub(point, comWorld), impulse),
    );
    // Single-precision engine: 1e-5 relative.
    for (let i = 0; i < 3; i++) {
      expect(v.linear[i]).toBeCloseTo(expectedLinear[i] as number, 6);
      expect(Math.abs((v.angular[i] as number) - (expectedAngular[i] as number))).toBeLessThan(
        1e-5 * v3Length(expectedAngular),
      );
    }
    expect(v3Length(expectedAngular)).toBeGreaterThan(1);
  });

  it('does not turn when pushed through the supplied centre of mass', async () => {
    const world = await newWorld({ gravity: [0, 0, 0] });
    world.addBody('body', pieces, mass, SURFACE, pose, 'dynamic');
    world.applyImpulse('body', [0.2, 0.1, -0.3], v3Add(pose.p, quatRotate(pose.q, mass.com)));
    expect(v3Length(world.getVelocity('body').angular)).toBeLessThan(1e-4);
    // The same push through the centroid of the proxy (the item origin) does turn it.
    world.setPose('body', pose);
    world.applyImpulse('body', [0.2, 0.1, -0.3], pose.p);
    expect(v3Length(world.getVelocity('body').angular)).toBeGreaterThan(1);
  });

  it('applies an impulse without a point at the centre of mass', async () => {
    const world = await newWorld({ gravity: [0, 0, 0] });
    world.addBody('body', pieces, mass, SURFACE, pose, 'dynamic');
    world.applyImpulse('body', [0.13, 0, 0]);
    expect(world.getVelocity('body').linear[0]).toBeCloseTo(0.1, 6);
    expect(v3Length(world.getVelocity('body').angular)).toBe(0);
  });

  it('reports the pose a body was given, whatever its centre of mass', async () => {
    const world = await newWorld({ gravity: [0, 0, 0] });
    world.addBody('body', pieces, mass, SURFACE, pose, 'dynamic');
    world.addBody('fixed', pieces, NO_MASS, SURFACE, pose, 'static');
    for (const id of ['body', 'fixed']) {
      const got = world.getPose(id);
      // Single precision at 40 engine units: a few micrometres at most.
      expect(v3Distance(got.p, pose.p)).toBeLessThan(5e-6);
      expect(quatAngleBetween(got.q, pose.q)).toBeLessThan(1e-6);
    }
    const moved: Pose = { p: [-0.3, 0.2, 0.1], q: quatFromEulerXYZ(-1.2, 0.3, 2.0) };
    world.setVelocity('body', [1, 2, 3], [4, 5, 6]);
    world.setPose('body', moved);
    expect(v3Distance(world.getPose('body').p, moved.p)).toBeLessThan(5e-6);
    expect(quatAngleBetween(world.getPose('body').q, moved.q)).toBeLessThan(1e-6);
    // A teleport releases the body at rest.
    expect(world.getVelocity('body')).toEqual({ linear: [0, 0, 0], angular: [0, 0, 0] });
  });

  it('raises the smallest principal moments of a rod and nothing else', () => {
    // Principal moments 1, 1 and 0.001 about axes turned away from the item axes.
    const q = quatFromEulerXYZ(0.3, 0.5, -0.2);
    const rod = inertiaRotate([1e-4, 0, 0, 0, 1e-4, 0, 0, 0, 1e-7], q);
    const conditioned = symmetricEigen3(conditionInertia(rod, 1 / 50));
    expect(conditioned.values[0]).toBeCloseTo(1e-4 / 50, 12);
    expect(conditioned.values[1]).toBeCloseTo(1e-4, 12);
    expect(conditioned.values[2]).toBeCloseTo(1e-4, 12);
    // The thin axis is still the rod's own axis.
    const axis = quatRotate(q, [0, 0, 1]);
    const thin: Vec3 = [conditioned.vectors[0], conditioned.vectors[3], conditioned.vectors[6]];
    expect(Math.abs(thin[0] * axis[0] + thin[1] * axis[1] + thin[2] * axis[2])).toBeCloseTo(1, 9);
    // A tensor already within the ratio is returned unchanged; one that is not positive
    // definite is refused.
    expect(conditionInertia(inertia, 1 / 50)).toEqual(inertia);
    expect(() => conditionInertia([1, 0, 0, 0, 1, 0, 0, 0, -1], 1 / 50)).toThrow(
      /positive definite/,
    );
  });
});

describe('contact coefficients from the pair table', () => {
  const lookup: ContactPairLookup = (a, b) => {
    const pair = [a, b].sort().join('+');
    if (pair === 'glass+ramp') return { friction: 0.15, restitution: 0 };
    if (pair === 'ramp+wood') return { friction: 0.5, restitution: 0 };
    if (pair === 'floor+rubber') return { friction: 0.5, restitution: 0.5 };
    if (pair === 'clay+floor') return { friction: 0.5, restitution: 0 };
    return { friction: 0.3, restitution: 0 };
  };
  const slope = 15 * DEG;
  const tilt = quatFromAxisAngle([1, 0, 0], slope);
  /** Pose of a block of half height `h` resting on the ramp, `x` across it. */
  const onRamp = (x: number, h: number): Pose => ({
    p: v3Add([x, 0, 0], quatRotate(tilt, [0, 0, h])),
    q: tilt,
  });

  it('holds a block where tan(slope) < mu and lets it slide at g (sin - mu cos) where not', async () => {
    const world = await newWorld({ pairLookup: lookup });
    const half: Vec3 = [0.01, 0.01, 0.005];
    world.addBody(
      'ramp',
      FLOOR,
      NO_MASS,
      { material: 'ramp' },
      { p: [0, 0, 0], q: tilt },
      'static',
    );
    world.addBody(
      'wood',
      [box('b', half)],
      boxMass(0.05, half),
      { material: 'wood' },
      onRamp(-0.1, half[2]),
      'dynamic',
    );
    world.addBody(
      'glass',
      [box('b', half)],
      boxMass(0.05, half),
      { material: 'glass' },
      onRamp(0.1, half[2]),
      'dynamic',
    );
    // A wooden block whose one piece says it is glass: the piece's material wins.
    const glassPiece: CollisionBox = { ...box('b', half), material: 'glass' };
    world.addBody(
      'veneer',
      [glassPiece],
      boxMass(0.05, half),
      { material: 'wood' },
      onRamp(0, half[2]),
      'dynamic',
    );
    const start = new Map(['wood', 'glass', 'veneer'].map((id) => [id, world.getPose(id).p]));
    const n = 72;
    world.step(n);
    const slid = (id: string): number => v3Distance(world.getPose(id).p, start.get(id) as Vec3);
    // tan(15 deg) = 0.268 < 0.5: the wooden block stays (well under 0.1 mm).
    expect(slid('wood')).toBeLessThan(5e-5);
    // mu = 0.15: a = g (sin 15 - 0.15 cos 15) = 1.117 m/s^2, s = a dt^2 n (n + 1) / 2 = 51 mm.
    const a = G * (Math.sin(slope) - 0.15 * Math.cos(slope));
    const expected = (a * DT * DT * n * (n + 1)) / 2;
    expect(Math.abs(slid('glass') / expected - 1)).toBeLessThan(0.02);
    expect(Math.abs(slid('veneer') / expected - 1)).toBeLessThan(0.02);
    // Straight down the slope, not sideways.
    expect(Math.abs(world.getPose('glass').p[0] - 0.1)).toBeLessThan(1e-5);
  });

  it('bounces a ball with the restitution of its pair and not at all below the threshold', async () => {
    const world = await newWorld({ pairLookup: lookup });
    const r = 0.01;
    world.addBody('floor', FLOOR, NO_MASS, { material: 'floor' }, AT_ORIGIN, 'static');
    const drop = 0.1;
    world.addBody(
      'rubber',
      [ball(r)],
      ballMass(0.02, r),
      { material: 'rubber' },
      at(-0.1, 0, r + drop),
      'dynamic',
    );
    world.addBody(
      'clay',
      [ball(r)],
      ballMass(0.02, r),
      { material: 'clay' },
      at(0.1, 0, r + drop),
      'dynamic',
    );
    // Speed just before the impact and the largest upward speed after it.
    const down = { rubber: 0, clay: 0 };
    const up = { rubber: 0, clay: 0 };
    for (let i = 0; i < 120; i++) {
      world.step(1);
      for (const id of ['rubber', 'clay'] as const) {
        const vz = world.getVelocity(id).linear[2];
        if (up[id] === 0 && vz < 0) down[id] = Math.max(down[id], -vz);
        if (vz > 0) up[id] = Math.max(up[id], vz);
      }
    }
    // Dropped 100 mm: 1.4 m/s at the floor.
    expect(down.rubber).toBeGreaterThan(1.3);
    // e = 0.5 sends it back at half the speed it came with. The step in which it lands adds up
    // to g dt = 0.04 m/s of fall that is not reflected: 4 % of the tolerance below.
    expect(Math.abs(up.rubber / down.rubber - 0.5)).toBeLessThan(0.03);
    // e = 0 does not bounce.
    expect(up.clay).toBeLessThan(0.01);
  });

  it('ignores restitution below the threshold speed', async () => {
    const world = await newWorld({ pairLookup: lookup });
    const r = 0.01;
    world.addBody('floor', FLOOR, NO_MASS, { material: 'floor' }, AT_ORIGIN, 'static');
    // Dropped 1 mm: it lands at 0.14 m/s, below the 0.2 m/s threshold.
    world.addBody(
      'rubber',
      [ball(r)],
      ballMass(0.02, r),
      { material: 'rubber' },
      at(0, 0, r + 0.001),
      'dynamic',
    );
    let highest = 0;
    for (let i = 0; i < 120; i++) {
      world.step(1);
      if (i > 6) highest = Math.max(highest, world.getPose('rubber').p[2] - r);
    }
    expect(highest).toBeLessThan(1e-4);
  });

  it('asks for every pair once, in canonical order, and refuses bad coefficients', async () => {
    const asked: string[] = [];
    const world = await newWorld({
      pairLookup: (a, b) => {
        asked.push(`${a}|${b}`);
        if (a === 'bad' || b === 'bad') return { friction: -1, restitution: 0 };
        return { friction: 0.3, restitution: 0.1 };
      },
    });
    world.addBody('one', [ball(0.01)], NO_MASS, { material: 'zinc' }, AT_ORIGIN, 'static');
    world.addBody('two', [ball(0.01)], NO_MASS, { material: 'brass' }, at(1, 0, 0), 'static');
    world.addBody('three', [ball(0.01)], NO_MASS, { material: 'zinc' }, at(2, 0, 0), 'static');
    expect(asked).toEqual(['zinc|zinc', 'brass|zinc', 'brass|brass']);
    expect(() =>
      world.addBody('four', [ball(0.01)], NO_MASS, { material: 'bad' }, at(3, 0, 0), 'static'),
    ).toThrow(/invalid contact coefficients/);
    expect(world.bodyIds()).toEqual(['one', 'three', 'two']);
  });
});

describe('settle', () => {
  it('stops at a block boundary once every body has been still for the hold time', async () => {
    const world = await newWorld();
    const half: Vec3 = [0.03, 0.03, 0.01];
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'block',
      [box('base', half)],
      boxMass(0.4, half),
      SURFACE,
      at(0, 0, 0.03),
      'dynamic',
    );
    const options = {
      ...settleOptionsFor(DT, false),
      minSteps: 48,
      blockSteps: 24,
      maxSteps: 2400,
    };
    const result = world.settle(options);
    expect(result.atRest).toBe(true);
    expect(result.disturbed).toBe(false);
    expect(result.moving).toEqual([]);
    expect((result.steps - 48) % 24).toBe(0);
    expect(result.time).toBeCloseTo(result.steps * DT, 12);
    // It fell 20 mm (64 ms) and then had to be still for 0.5 s: between 0.56 s and 1 s in all.
    expect(result.time).toBeGreaterThan(0.56);
    expect(result.time).toBeLessThan(1.0);
    const v = world.getVelocity('block');
    expect(v3Length(v.linear)).toBeLessThan(REST_CRITERION.linearSpeed);
    expect(v3Length(v.angular)).toBeLessThan(REST_CRITERION.angularSpeed);
  });

  it('gives up at the cap and names what is still moving', async () => {
    const world = await newWorld();
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'still',
      [box('b', [0.02, 0.02, 0.01])],
      boxMass(0.2, [0.02, 0.02, 0.01]),
      SURFACE,
      at(0.1, 0, 0.0101),
      'dynamic',
    );
    world.addBody('falling', [ball(0.01)], ballMass(0.1, 0.01), SURFACE, at(2, 0, 5), 'dynamic');
    // 1 s in all, with a hold of 0.1 s: the box on the floor qualifies, the ball does not.
    const result = world.settle({
      ...settleOptionsFor(DT),
      minSteps: 24,
      blockSteps: 24,
      maxSteps: 240,
      restHoldSteps: 24,
    });
    expect(result).toMatchObject({ steps: 240, atRest: false, moving: ['falling'] });
  });

  it('runs the minimum number of steps even when nothing moves', async () => {
    const world = await newWorld();
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    const result = world.settle({
      ...settleOptionsFor(DT),
      minSteps: 36,
      blockSteps: 12,
      maxSteps: 240,
    });
    expect(result).toMatchObject({ steps: 36, atRest: true, moving: [] });
  });

  it('refuses malformed options', async () => {
    const world = await newWorld();
    const good = settleOptionsFor(DT);
    expect(() => world.settle({ ...good, blockSteps: 0 })).toThrow(/blockSteps/);
    expect(() => world.settle({ ...good, minSteps: 1.5 })).toThrow(/minSteps/);
    expect(() => world.settle({ ...good, restLinearSpeed: -1 })).toThrow(/rest speeds/);
    expect(() => world.step(-1)).toThrow(/number of steps/);
  });

  it('derives the settle options of the platform from the time step', () => {
    // No minimum, rest looked for after every step, 10 s cap, 5 mm/s, 0.05 rad/s, 0.5 s hold;
    // the disturbance: one degree, four ways of 0.05 s, after 0.05 s of calm, begun with a
    // step solved afresh. At 240 steps per second.
    expect(settleOptionsFor(1 / 240)).toEqual({
      minSteps: 0,
      blockSteps: 1,
      maxSteps: 2400,
      restLinearSpeed: 0.005,
      restAngularSpeed: 0.05,
      restHoldSteps: 120,
      disturbance: {
        tilt: Math.PI / 180,
        directions: 4,
        directionSteps: 12,
        calmSteps: 12,
        coldStart: true,
      },
    });
    const still = settleOptionsFor(1 / 240, false);
    expect(still.disturbance).toBeUndefined();
    expect(still.maxSteps).toBe(2400);
  });

  it('ends at the step in which the last body has been still for the hold time, having disturbed it once', async () => {
    const world = await newWorld();
    const half: Vec3 = [0.03, 0.03, 0.01];
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'block',
      [box('base', half)],
      boxMass(0.4, half),
      SURFACE,
      at(0, 0, 0.03),
      'dynamic',
    );
    const options = settleOptionsFor(DT);
    const result = world.settle(options);
    expect(result.atRest).toBe(true);
    expect(result.disturbed).toBe(true);
    // It fell 20 mm (64 ms, 16 steps), was calm for 12 steps, was tilted for 48 and then had
    // to be still for 120: 196 steps, and some fifty more for its velocity averaged over
    // 0.05 s to come down from the 0.6 m/s of the landing to the rest speed.
    expect(result.steps).toBeGreaterThanOrEqual(16 + 12 + 48 + 120);
    expect(result.steps).toBeLessThan(16 + 12 + 48 + 120 + 72);
    // A flat block does not slide on one degree (friction 0.3 holds 16.7): it is where it fell.
    expect(Math.hypot(world.getPose('block').p[0], world.getPose('block').p[1])).toBeLessThan(1e-5);
    expect(world.isActive('block')).toBe(false);
    // Everything asleep: a second settle has nothing to do and takes no step.
    const again = world.settle(options);
    expect(again).toEqual({
      steps: 0,
      time: 0,
      atRest: true,
      disturbed: false,
      moving: [],
      penetrating: [],
    });
  });
});

describe('kinematic bodies', () => {
  const tray: CollisionPiece[] = [box('tray', [0.2, 0.2, 0.005], [0, 0, -0.005])];
  const half: Vec3 = [0.02, 0.02, 0.01];
  const mu = 0.5;
  const pair: ContactPairLookup = () => ({ friction: mu, restitution: 0 });

  it('arrives where it is sent, carries what rests on it by friction, and stops when left alone', async () => {
    const world = await newWorld({ pairLookup: pair });
    world.addBody('tray', tray, NO_MASS, SURFACE, AT_ORIGIN, 'kinematic');
    world.addBody(
      'box',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0, 0, half[2]),
      'dynamic',
    );
    world.step(60);
    const speed = 0.1;
    for (let k = 1; k <= 120; k++) {
      world.setPose('tray', at(speed * k * DT, 0, 0));
      world.step(1);
      // The tray is exactly where it was sent (single precision: under a micrometre).
      expect(Math.abs(world.getPose('tray').p[0] - speed * k * DT)).toBeLessThan(1e-6);
    }
    // The tray started at full speed, so the box slipped back v^2 / (2 mu g) = 1.02 mm before
    // friction had brought it up to speed; after that it rides along.
    const slip = (speed * speed) / (2 * mu * G);
    const lag = world.getPose('tray').p[0] - world.getPose('box').p[0];
    expect(Math.abs(lag - slip)).toBeLessThan(0.25e-3);
    expect(world.getVelocity('box').linear[0]).toBeCloseTo(speed, 3);
    // Not driven any more: the tray stops at once and the box slides the same distance forward.
    world.step(120);
    expect(world.getVelocity('tray').linear).toEqual([0, 0, 0]);
    expect(Math.abs(world.getPose('tray').p[0] - speed * 120 * DT)).toBeLessThan(1e-6);
    expect(Math.abs(world.getPose('tray').p[0] - world.getPose('box').p[0])).toBeLessThan(0.25e-3);
    expect(v3Length(world.getVelocity('box').linear)).toBeLessThan(1e-4);
  });

  it('wakes what sleeps on it when it starts to move', async () => {
    const world = await newWorld({ pairLookup: pair });
    world.addBody('tray', tray, NO_MASS, SURFACE, AT_ORIGIN, 'kinematic');
    world.addBody(
      'box',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0, 0, half[2]),
      'dynamic',
    );
    world.step(480);
    expect(world.isActive('box')).toBe(false);
    for (let k = 1; k <= 48; k++) {
      world.setPose('tray', at(0, 0.05 * k * DT, 0));
      world.step(1);
    }
    expect(world.isActive('box')).toBe(true);
    expect(world.getPose('box').p[1]).toBeGreaterThan(0.008);
  });

  it.each([100, 110, 119, 120, 121, 480])(
    'carries a body from the first step of its move, %d steps after the body was set down',
    async (restedSteps) => {
      // The tray accelerates at 2 m/s^2, which friction (mu g = 4.9 m/s^2) can transmit in full:
      // the box must stay where it is on the tray. The engine alone gets this wrong in two ways
      // that depend on how long the box has been resting: a sleeping box (480 steps) is woken by
      // the contact one step late and has no friction in that step, and a box whose sleep timer
      // runs out during the first 2.5 mm of the ride (110 to 120 steps: the timer is 0.5 s) is
      // put to sleep and stopped while the tray carries on, 2.6 mm of slip at 110 steps.
      const world = await newWorld({ pairLookup: pair });
      world.addBody('tray', tray, NO_MASS, SURFACE, AT_ORIGIN, 'kinematic');
      world.addBody(
        'box',
        [box('b', half)],
        boxMass(0.3, half),
        SURFACE,
        at(0, 0, half[2]),
        'dynamic',
      );
      world.step(restedSteps);
      let worstLag = 0;
      for (let k = 1; k <= 60; k++) {
        const t = k * DT;
        world.setPose('tray', at(0, 0.5 * 2 * t * t, 0));
        world.step(1);
        // The speed of the tray during a step is its mean over the step, a (k - 1/2) dt, and the
        // box has it from the first step on.
        expect(world.getVelocity('box').linear[1]).toBeCloseTo(2 * (k - 0.5) * DT, 4);
        worstLag = Math.max(
          worstLag,
          Math.abs(world.getPose('tray').p[1] - world.getPose('box').p[1]),
        );
      }
      // 20 micrometres at most between the box and its place on the tray.
      expect(worstLag).toBeLessThan(20e-6);
      expect(world.isActive('box')).toBe(true);
    },
  );

  it('teleports without carrying anything', async () => {
    const world = await newWorld({ pairLookup: pair });
    world.addBody('tray', tray, NO_MASS, SURFACE, AT_ORIGIN, 'kinematic');
    world.addBody(
      'box',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0, 0, half[2]),
      'dynamic',
    );
    world.step(480);
    world.teleport('tray', at(1, 0, 0));
    expect(world.getPose('tray').p[0]).toBeCloseTo(1, 6);
    expect(world.getPose('box').p[0]).toBeCloseTo(0, 6);
    // The box has lost its support: it wakes and falls.
    world.step(24);
    expect(world.getPose('box').p[2]).toBeLessThan(half[2] - 0.02);
  });
});

describe('bodies', () => {
  const half: Vec3 = [0.02, 0.02, 0.01];

  it('wakes what rested on a body that is removed', async () => {
    const world = await newWorld();
    world.addBody('shelf', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'box',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0, 0, half[2]),
      'dynamic',
    );
    world.step(480);
    expect(world.isActive('box')).toBe(false);
    world.removeBody('shelf');
    expect(world.bodyIds()).toEqual(['box']);
    expect(world.contacts()).toEqual([]);
    const n = 48;
    world.step(n);
    // Free fall from rest for n steps.
    expect(world.getPose('box').p[2]).toBeCloseTo(half[2] - (G * DT * DT * n * (n + 1)) / 2, 4);
  });

  it('wakes what rested on a static body that is moved away', async () => {
    const world = await newWorld();
    world.addBody('shelf', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'box',
      [box('b', half)],
      boxMass(0.3, half),
      SURFACE,
      at(0, 0, half[2]),
      'dynamic',
    );
    world.step(480);
    world.setPose('shelf', at(5, 0, 0));
    world.step(48);
    expect(world.getPose('box').p[2]).toBeLessThan(half[2] - 0.05);
  });

  it('knows the kind of each body and lists ids in canonical order', async () => {
    const world = await newWorld();
    world.addBody('zeta', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('Alpha', [ball(0.01)], ballMass(0.1, 0.01), SURFACE, at(0, 0, 1), 'dynamic');
    world.addBody('mid', [ball(0.01)], NO_MASS, SURFACE, at(0, 0, 2), 'kinematic');
    world.addBody('alpha', [ball(0.01)], ballMass(0.1, 0.01), SURFACE, at(0, 0, 3), 'dynamic');
    // UTF-16 code unit order: upper case sorts before lower case.
    expect(world.bodyIds()).toEqual(['Alpha', 'alpha', 'mid', 'zeta']);
    expect(world.getKind('zeta')).toBe('static');
    expect(world.getKind('mid')).toBe('kinematic');
    expect(world.getKind('alpha')).toBe('dynamic');
    expect(world.stats().bodies).toBe(4);
  });

  it('treats misuse as a programmer error', async () => {
    const world = await newWorld();
    const good = (): void =>
      world.addBody('a', [ball(0.01)], ballMass(0.1, 0.01), SURFACE, AT_ORIGIN, 'dynamic');
    good();
    expect(good).toThrow(/duplicate body id 'a'/);
    expect(() => world.getPose('nobody')).toThrow(/unknown body 'nobody'/);
    expect(() => world.removeBody('nobody')).toThrow(/unknown body/);
    expect(() => world.addBody('', [ball(0.01)], NO_MASS, SURFACE, AT_ORIGIN, 'static')).toThrow(
      /body id/,
    );
    expect(() => world.addBody('b', [], NO_MASS, SURFACE, AT_ORIGIN, 'static')).toThrow(
      /at least one collision piece/,
    );
    expect(() =>
      world.addBody(
        'c',
        [ball(0.01)],
        { ...ballMass(0.1, 0.01), mass: 0 },
        SURFACE,
        AT_ORIGIN,
        'dynamic',
      ),
    ).toThrow(/mass above zero/);
    expect(() =>
      world.addBody(
        'd',
        [ball(0.01)],
        ballMass(0.1, 0.01),
        SURFACE,
        { p: [0, Number.NaN, 0], q: [0, 0, 0, 1] },
        'dynamic',
      ),
    ).toThrow(/not finite/);
    expect(() => world.addBody('e', [ball(0)], NO_MASS, SURFACE, AT_ORIGIN, 'static')).toThrow(
      /radius above zero/,
    );
    // A flat hull without a radius has no volume.
    expect(() =>
      world.addBody(
        'f',
        [
          {
            kind: 'hull',
            part: 'flat',
            radius: 0,
            points: [
              [0, 0, 0],
              [1, 0, 0],
              [0, 1, 0],
            ],
          },
        ],
        NO_MASS,
        SURFACE,
        AT_ORIGIN,
        'static',
      ),
    ).toThrow(/no volume/);
    world.addBody('fixed', [ball(0.01)], NO_MASS, SURFACE, at(1, 0, 0), 'static');
    expect(() => world.applyImpulse('fixed', [1, 0, 0])).toThrow(/only a dynamic body/);
    expect(() => world.setVelocity('fixed', [1, 0, 0], [0, 0, 0])).toThrow(/only a dynamic body/);
    // None of the refused bodies exists.
    expect(world.bodyIds()).toEqual(['a', 'fixed']);
    world.dispose();
    expect(() => world.step(1)).toThrow(/disposed/);
    // Disposing twice is harmless.
    world.dispose();
  });

  it('forgets a body that is removed before it was ever simulated', async () => {
    const world = await newWorld();
    world.addBody('a', [ball(0.01)], ballMass(0.1, 0.01), SURFACE, AT_ORIGIN, 'dynamic');
    world.removeBody('a');
    expect(world.bodyIds()).toEqual([]);
    world.addBody('a', [ball(0.02)], ballMass(0.1, 0.02), SURFACE, at(0, 0, 1), 'dynamic');
    expect(world.getPose('a').p[2]).toBeCloseTo(1, 6);
  });

  it('refuses to step when a step would overflow the contact capacity', async () => {
    // Room for 64 contact manifolds; a 10 x 10 raft of boxes on the floor needs 100.
    const world = await newWorld({ settings: { maxContactConstraints: 64 } });
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    const h: Vec3 = [0.01, 0.01, 0.01];
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        world.addBody(
          `box_${i}_${j}`,
          [box('b', h)],
          boxMass(0.05, h),
          SURFACE,
          at(-0.2 + 0.04 * i, -0.2 + 0.04 * j, 0.0101),
          'dynamic',
        );
      }
    }
    expect(() => world.step(1)).toThrow(
      /contact manifolds in one step is too close to the capacity/,
    );
  });
});

describe('helpers of the contact rule for round pieces', () => {
  it('measures the distance between two segments', () => {
    // Parallel, side by side, 3 apart.
    expect(segmentDistance(0, 0, 0, 1, 0, 0, 0, 3, 0, 1, 3, 0)).toBeCloseTo(3, 12);
    // Crossing at right angles, one 2 above the other: their common perpendicular.
    expect(segmentDistance(-1, 0, 0, 1, 0, 0, 0, -1, 2, 0, 1, 2)).toBeCloseTo(2, 12);
    // In line with a gap: from the end (1, 0, 0) to the end (3, 4, 0), 2 and 4 away.
    expect(segmentDistance(0, 0, 0, 1, 0, 0, 3, 4, 0, 5, 4, 0)).toBeCloseTo(Math.hypot(2, 4), 12);
    // Skew, the nearest points an end and an inner point: (0, 0, 0)-(1, 0, 0) and the
    // vertical through (2, 1, .): from (1, 0, 0) to (2, 1, 0).
    expect(segmentDistance(0, 0, 0, 1, 0, 0, 2, 1, -1, 2, 1, 1)).toBeCloseTo(Math.SQRT2, 12);
    // Without length: a point and a segment, and two points.
    expect(segmentDistance(0.5, 2, 0, 0.5, 2, 0, 0, 0, 0, 1, 0, 0)).toBeCloseTo(2, 12);
    expect(segmentDistance(1, 2, 3, 1, 2, 3, 4, 6, 3, 4, 6, 3)).toBeCloseTo(5, 12);
    // Crossing each other: nothing between them.
    expect(segmentDistance(-1, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0)).toBeCloseTo(0, 12);
  });

  it('calls the callbacks of a step directly once the engine has used them, and forgets them with the world', async () => {
    // The engine calls back into this package for every pair of pieces it considers. Through
    // the bindings that is a string comparison and a table lookup per call; each callback is
    // recognised at its first call and called directly from then on. The results are the
    // same (every other test runs with it); here: that it happens, and ends with the world.
    const world = await newWorld();
    const jolt = (world as unknown as { jolt: JoltModule }).jolt;
    const before = fastJoltCallbackCount(jolt);
    world.addBody('floor', FLOOR, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    const half: Vec3 = [0.02, 0.02, 0.01];
    world.addBody(
      'block',
      [box('b', half)],
      boxMass(0.2, half),
      SURFACE,
      at(0, 0, 0.011),
      'dynamic',
    );
    world.step(30);
    expect(fastJoltCallbackCount(jolt)).toBeGreaterThan(before);
    expect(Math.abs(world.getPose('block').p[2] - 0.01)).toBeLessThan(2e-4);
    world.dispose();
    expect(fastJoltCallbackCount(jolt)).toBe(0);
  });
});
