// Rest, sleep and contact capacity. A body counts as at rest by the platform criterion alone
// (docs/design/platform.md section 5: below 5 mm/s and 0.05 rad/s for 0.5 s), groups of bodies in
// contact sleep together, contacts are only created where two pieces can meet within the step,
// and a step that still needs more contacts than the engine holds is undone and reported.
import type { Pose, Vec3 } from '@spotless/core';
import {
  STANDARD_GRAVITY,
  quatAngleBetween,
  quatFromAxisAngle,
  quatRotate,
  v3Distance,
  v3Length,
} from '@spotless/core';
import type {
  CollisionBox,
  CollisionCapsule,
  CollisionPiece,
  MassProperties,
} from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { measurePenetration } from './measure.ts';
import { JOLT_SETTINGS, LOADING_TIME_STEP, settleOptionsFor } from './settings.ts';
import { addMixedScene, mixedScene } from './test-replay.ts';
import { makeChopstick } from './test-shapes.ts';
import { AT_ORIGIN, NO_MASS, useWorlds } from './test-world.ts';
import type { ContactPairLookup } from './types.ts';
import { ContactCapacityError, REST_CRITERION, UNRESOLVED_PENETRATION } from './types.ts';

const DT = LOADING_TIME_STEP;
const G = STANDARD_GRAVITY;
const DEG = Math.PI / 180;
const MM = 1e-3;
const SETTLE = settleOptionsFor(DT);
const SURFACE = { material: 'steel' };
const at = (x: number, y: number, z: number): Pose => ({ p: [x, y, z], q: [0, 0, 0, 1] });

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
function ball(radius: number): CollisionCapsule {
  return { kind: 'capsule', part: 'ball', a: [0, 0, 0], b: [0, 0, 0], radius };
}
function ballMass(mass: number, radius: number): MassProperties {
  const i = 0.4 * mass * radius * radius;
  return { mass, com: [0, 0, 0], inertia: [i, 0, 0, 0, i, 0, 0, 0, i] };
}
/** A floor slab of the given half width whose top surface is the plane z = 0. */
const floor = (half: number): CollisionPiece[] => [box('floor', [half, half, 0.01], [0, 0, -0.01])];
/** Gravity of magnitude g tilted by `slope` radians so that +y is downhill. */
const tilted = (slope: number): Vec3 => [0, G * Math.sin(slope), -G * Math.cos(slope)];
/** One pair of coefficients for every pair of materials. */
const pair =
  (rollingResistance: number, spinResistance = 0): ContactPairLookup =>
  () => ({ friction: 0.4, restitution: 0.1, rollingResistance, spinResistance });

const newWorld = useWorlds();

describe('rest by the platform criterion', () => {
  // A round rod like a chopstick: 6 mm thick, 240 mm long, 6 g, a solid cylinder about its axis.
  const radius = 0.003;
  const half = 0.117;
  const mass = 0.006;
  const rod: CollisionCapsule = {
    kind: 'capsule',
    part: 'rod',
    a: [-half, 0, 0],
    b: [half, 0, 0],
    radius,
  };
  const transverse = (mass * (2 * half + 2 * radius) ** 2) / 12;
  const rodMass: MassProperties = {
    mass,
    com: [0, 0, 0],
    inertia: [(mass * radius * radius) / 2, 0, 0, 0, transverse, 0, 0, 0, transverse],
  };

  it('never reports a rod that rolls down an incline as at rest, however slowly it starts', async () => {
    // Rolling resistance 0.05 mm on a 3 mm radius stalls the rod below atan(0.05 / 3) = 0.95
    // degrees. On 3 degrees it rolls off from rest, gaining 0.97 mm/s per step: it is below the
    // rest speeds for its first five steps and moves 2.5 mm in its first 0.15 s, which is the
    // case the engine's own distance-based sleep test used to freeze in mid-motion.
    const slope = 3 * DEG;
    const length = 5e-5;
    const world = await newWorld({ gravity: tilted(slope), pairLookup: pair(length) });
    world.addBody('floor', floor(2), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('rod', [rod], rodMass, SURFACE, at(0, -1.5, radius), 'dynamic');
    const result = world.settle({ ...SETTLE, maxSteps: 480 });
    expect(result.atRest).toBe(false);
    expect(result.moving).toEqual(['rod']);
    expect(world.isActive('rod')).toBe(true);
    // A solid cylinder rolling without slipping against the resisting moment c N:
    // a = g (sin(slope) - (c / r) cos(slope)) / 1.5, so 0.5 a t^2 after t = 2 s.
    const a = (G * (Math.sin(slope) - (length / radius) * Math.cos(slope))) / 1.5;
    const travelled = world.getPose('rod').p[1] + 1.5;
    expect(Math.abs(travelled / (0.5 * a * 4) - 1)).toBeLessThan(0.03);
    // It turns at 155 rad/s by then, three times the engine's default limit on angular speed.
    expect(v3Length(world.getVelocity('rod').angular)).toBeGreaterThan(140);
  });

  it('reports the same rod at rest on a slope below its stall angle', async () => {
    const world = await newWorld({ gravity: tilted(0.4 * DEG), pairLookup: pair(5e-5) });
    world.addBody('floor', floor(2), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('rod', [rod], rodMass, SURFACE, at(0, 0, radius), 'dynamic');
    // Left alone it does not move at all...
    const result = world.settle(settleOptionsFor(DT, false));
    expect(result.atRest).toBe(true);
    expect(result.moving).toEqual([]);
    expect(Math.abs(world.getPose('rod').p[1])).toBeLessThan(0.1 * MM);
    expect(world.isActive('rod')).toBe(false);
    // ...and the disturbance of the standard settle, whose one degree is more than the half
    // degree its rolling resistance holds, rolls it a fraction of a millimetre and no further.
    world.applyImpulse('rod', [0, 0, 0]);
    const disturbed = world.settle(SETTLE);
    expect(disturbed.atRest).toBe(true);
    expect(disturbed.disturbed).toBe(true);
    expect(Math.abs(world.getPose('rod').p[1])).toBeLessThan(0.5 * MM);
    expect(world.isActive('rod')).toBe(false);
  });

  it('knocks over, during the settle, what stands balanced: a chopstick on its end', async () => {
    const world = await newWorld();
    world.addBody('floor', floor(1), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    const stick = makeChopstick();
    // On its rounded end, exactly upright: an equilibrium, but not one that survives a touch.
    const standing: Pose = {
      p: [0, 0.003, 0.12 + 0.0001],
      q: quatFromAxisAngle([1, 0, 0], 90 * DEG),
    };
    world.addBody('stick', stick.pieces, stick.mass, SURFACE, standing, 'dynamic');
    // How far its axis (y in its own frame) is from the vertical, degrees.
    const lean = (): number =>
      Math.acos(Math.min(1, Math.abs(quatRotate(world.getPose('stick').q, [0, 1, 0])[2]))) / DEG;
    // Left alone it stands, and is reported at rest.
    const alone = world.settle(settleOptionsFor(DT, false));
    expect(alone.atRest).toBe(true);
    expect(alone.disturbed).toBe(false);
    expect(lean()).toBeLessThan(0.1);
    // The standard settle tilts gravity by one degree: it falls flat (0.22 s for a rod of
    // 240 mm from one degree, by the pendulum equation) and is at rest on the floor.
    world.applyImpulse('stick', [0, 0, 0]);
    const settled = world.settle(SETTLE);
    expect(settled.atRest).toBe(true);
    expect(settled.disturbed).toBe(true);
    expect(lean()).toBeGreaterThan(89);
    // Its origin is on its surface: within its 6 mm of the floor.
    expect(world.getPose('stick').p[2]).toBeLessThan(6.5 * MM);
  });

  it('disturbs what lies still although something else has not stopped yet', async () => {
    // The chopstick on its end again, and a ball rolling past a quarter of a metre away for
    // two seconds: rolling resistance of 0.2 mm slows a ball of 10 mm radius by
    // (5 / 7) g c / r = 0.14 m/s^2, from 0.3 m/s. The chopstick has met the rest criterion
    // long before; it may not go to sleep without having been disturbed (it once did, and
    // stood until the next thing touched it).
    const r = 0.01;
    const world = await newWorld({ pairLookup: pair(2e-4) });
    world.addBody('floor', floor(1), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    const stick = makeChopstick();
    const standing: Pose = {
      p: [0, 0.003, 0.12 + 0.0001],
      q: quatFromAxisAngle([1, 0, 0], 90 * DEG),
    };
    world.addBody('stick', stick.pieces, stick.mass, SURFACE, standing, 'dynamic');
    world.addBody('ball', [ball(r)], ballMass(0.03, r), SURFACE, at(-0.3, 0.25, r), 'dynamic');
    world.setVelocity('ball', [0.3, 0, 0], [0, 0.3 / r, 0]);
    const settled = world.settle(SETTLE);
    expect(settled.atRest).toBe(true);
    expect(settled.disturbed).toBe(true);
    // The ball rolled for about two seconds...
    expect(settled.time).toBeGreaterThan(1.8);
    expect(world.getPose('ball').p[0] + 0.3).toBeGreaterThan(0.25);
    // ...and the chopstick lies flat.
    const axis = quatRotate(world.getPose('stick').q, [0, 1, 0]);
    expect(Math.acos(Math.min(1, Math.abs(axis[2]))) / DEG).toBeGreaterThan(89);
    expect(world.stats().activeBodies).toBe(0);
  });

  it('rolls a round rod at g sin(slope) / 1.5 when nothing resists', async () => {
    // The true inertia about the long axis (m r^2 / 2) and no limit on the angular speed below
    // 300 rad/s: after 1 s on 2 degrees the rod has covered 114 mm and turns at 76 rad/s.
    const slope = 2 * DEG;
    const world = await newWorld({ gravity: tilted(slope), pairLookup: pair(0) });
    world.addBody('floor', floor(2), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('rod', [rod], rodMass, SURFACE, at(0, -1, radius), 'dynamic');
    world.step(240);
    const a = (G * Math.sin(slope)) / 1.5;
    expect(Math.abs((world.getPose('rod').p[1] + 1) / (0.5 * a) - 1)).toBeLessThan(0.03);
    expect(Math.abs(world.getVelocity('rod').linear[1] / a - 1)).toBeLessThan(0.03);
    expect(Math.abs(v3Length(world.getVelocity('rod').angular) / (a / radius) - 1)).toBeLessThan(
      0.03,
    );
    expect(JOLT_SETTINGS.maxAngularVelocity).toBeGreaterThanOrEqual(300);
    expect(JOLT_SETTINGS.minPrincipalInertiaRatio).toBe(0);
  });

  it('puts a body to sleep only after it has moved slower than the rest speeds for the hold time', async () => {
    // Twelve plates in a rack, eight pieces of cutlery in a basket and three bowls dropped into
    // each other. Every body is watched from outside, by its poses alone: when it stops being
    // simulated, it must have travelled and turned slower than the rest speeds over every
    // twentieth of a second of the half second before (the world compares the rest speeds with
    // the velocity averaged over 50 ms, so that the chatter the contact solver leaves in a
    // resting body does not count as motion while any real travel does).
    const world = await newWorld();
    addMixedScene(world, 'sorted');
    const ids = mixedScene().bodies.map((body) => body.id);
    const window = Math.round(0.05 / DT);
    const history = new Map<string, Pose[]>(ids.map((id) => [id, [world.getPose(id)]]));
    const asleep = new Set<string>();
    let slowest = 0;
    for (let step = 0; step < SETTLE.maxSteps && asleep.size < ids.length; step++) {
      world.step(1);
      for (const id of ids) {
        if (asleep.has(id)) {
          // Nothing disturbs this scene: once asleep, a body stays asleep.
          expect(world.isActive(id), id).toBe(false);
          continue;
        }
        const poses = history.get(id) as Pose[];
        poses.push(world.getPose(id));
        if (world.isActive(id)) continue;
        asleep.add(id);
        // It was simulated for at least the hold time...
        expect(poses.length, id).toBeGreaterThan(SETTLE.restHoldSteps);
        // ...and in its last half second it was slow throughout.
        for (let k = poses.length - 1; k - window >= poses.length - 1 - SETTLE.restHoldSteps; k--) {
          const now = poses[k] as Pose;
          const before = poses[k - window] as Pose;
          const linear = v3Distance(now.p, before.p) / (window * DT);
          const angular = quatAngleBetween(now.q, before.q) / (window * DT);
          slowest = Math.max(slowest, linear / REST_CRITERION.linearSpeed);
          slowest = Math.max(slowest, angular / REST_CRITERION.angularSpeed);
          expect(linear, id).toBeLessThan(1.2 * REST_CRITERION.linearSpeed);
          expect(angular, id).toBeLessThan(1.2 * REST_CRITERION.angularSpeed);
        }
      }
    }
    expect(asleep.size).toBe(ids.length);
    // (Measured: no body moved faster than a hundredth of the rest speeds in its last half
    // second. The engine's own sleep test used to stop a knife at 20 mm/s and 2.3 rad/s.)
    expect(slowest).toBeLessThan(1);
  });

  it('leaves a settled load where it is when the load is merely woken', async () => {
    // What told a frozen load from a resting one: wake every body with a zero impulse and
    // settle again. A dinner knife frozen in mid-fall then moved 7.6 mm and 80 degrees. And a
    // knife that stood on a corner of its handle against the top of a basket wall, held by
    // contact forces the solver had arrived at and did not find again from nothing, slid
    // 4.2 mm when woken (the engine keeps no contact forces for a body that sleeps): hence the
    // step solved afresh in the disturbance of the settle (`SETTLE_DISTURBANCE.coldStart`),
    // after which it lies where waking leaves it.
    const world = await newWorld();
    addMixedScene(world, 'sorted');
    const ids = mixedScene().bodies.map((body) => body.id);
    expect(world.settle(SETTLE).atRest).toBe(true);
    const settled = new Map(ids.map((id) => [id, world.getPose(id)]));
    for (const id of ids) world.applyImpulse(id, [0, 0, 0]);
    expect(world.stats().activeBodies).toBe(ids.length);
    const again = world.settle(SETTLE);
    expect(again.atRest).toBe(true);
    expect(again.penetrating).toEqual([]);
    for (const id of ids) {
      const before = settled.get(id) as Pose;
      const after = world.getPose(id);
      // The platform's own tolerance for "has not moved": 1 mm and 1 degree (measured: 0.1 mm,
      // and 0.85 degrees for one spoon that turns about its handle in its basket cell).
      expect(v3Distance(before.p, after.p), id).toBeLessThan(1 * MM);
      expect(quatAngleBetween(before.q, after.q) / DEG, id).toBeLessThan(1);
    }
  });

  it('keeps a body awake while something it touches still moves, and stops a spin by c N / I', async () => {
    // A ball spinning on a slab that lies on the floor. Spin friction of length c takes the
    // angular momentum I w of the ball away at the rate c m g, so it stops after
    // w I / (c m g) = 5 * 0.4 r^2 / (c g) = 1.02 s for r = 10 mm and c = 0.02 mm. The slab
    // never moves, but the two are in contact, so it may not sleep before the ball does.
    // (Rolling resistance of 0.2 mm keeps the ball where it is: a slab at rest within the
    // penetration slop is level only to a thousandth of a radian.)
    const r = 0.01;
    const c = 2e-5;
    const world = await newWorld({ pairLookup: pair(2e-4, c) });
    const slab: Vec3 = [0.05, 0.05, 0.01];
    world.addBody('floor', floor(0.3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'slab',
      [box('slab', slab)],
      boxMass(0.5, slab),
      SURFACE,
      at(0, 0, 0.01),
      'dynamic',
    );
    world.addBody('ball', [ball(r)], ballMass(0.03, r), SURFACE, at(0, 0, 0.02 + r), 'dynamic');
    world.step(24);
    world.setVelocity('ball', [0, 0, 0], [0, 0, 5]);
    const expected = (5 * 0.4 * r * r) / (c * G);
    let stopped = -1;
    for (let step = 1; step <= 480; step++) {
      world.step(1);
      const spin = Math.abs(world.getVelocity('ball').angular[2]);
      if (stopped < 0 && spin === 0) stopped = step * DT;
      if (step * DT < 0.9 * expected) {
        expect(spin).toBeGreaterThan(REST_CRITERION.angularSpeed);
        expect(world.isActive('slab')).toBe(true);
        expect(v3Length(world.getVelocity('slab').linear)).toBeLessThan(1e-4);
      }
    }
    expect(Math.abs(stopped / expected - 1)).toBeLessThan(0.05);
    // Half a second after the ball has stopped, both are asleep.
    expect(world.isActive('ball')).toBe(false);
    expect(world.isActive('slab')).toBe(false);
    // The spin did not move the ball along the slab.
    expect(Math.hypot(world.getPose('ball').p[0], world.getPose('ball').p[1])).toBeLessThan(
      0.05 * MM,
    );
  });

  it('judges a sleeping body afresh when a settle call asks for more than the platform criterion', async () => {
    const world = await newWorld();
    const half: Vec3 = [0.02, 0.02, 0.01];
    world.addBody('floor', floor(0.3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'block',
      [box('b', half)],
      boxMass(0.2, half),
      SURFACE,
      at(0, 0, 0.0101),
      'dynamic',
    );
    expect(world.settle(SETTLE).atRest).toBe(true);
    expect(world.isActive('block')).toBe(false);
    // A threshold nothing can meet (a speed below zero): the sleeping block is woken and named.
    const impossible = world.settle({ ...SETTLE, maxSteps: 240, restLinearSpeed: 0 });
    expect(impossible.atRest).toBe(false);
    expect(impossible.moving).toEqual(['block']);
    expect(world.isActive('block')).toBe(true);
    // A stricter one it does meet, with a hold of a whole second: at rest, and held awake for it.
    const strict = world.settle({
      ...SETTLE,
      minSteps: 24,
      restLinearSpeed: 1e-4,
      restAngularSpeed: 1e-3,
      restHoldSteps: 240,
    });
    expect(strict.atRest).toBe(true);
    expect(strict.steps).toBeGreaterThanOrEqual(240);
  });
});

describe('contacts ahead of contact', () => {
  // A slab on two rails, its underside 1 mm above the floor: a resting neighbour of the floor.
  const slab: Vec3 = [0.05, 0.05, 0.005];
  const rails: CollisionPiece[] = [
    box('rail', [0.002, 0.06, 0.0005], [-0.04, 0, 0.0005]),
    box('rail', [0.002, 0.06, 0.0005], [0.04, 0, 0.0005]),
  ];
  const build = async (
    restingContactDistance: number,
  ): Promise<Awaited<ReturnType<typeof newWorld>>> => {
    const world = await newWorld({ settings: { restingContactDistance, allowSleeping: false } });
    world.addBody('floor', floor(0.3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody('rails', rails, NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'slab',
      [box('slab', slab)],
      boxMass(0.3, slab),
      SURFACE,
      at(0, 0, 0.0061),
      'dynamic',
    );
    world.step(240);
    return world;
  };

  it('holds none between resting neighbours a millimetre apart, and rests at the same height', async () => {
    expect(JOLT_SETTINGS.restingContactDistance).toBe(0.0003);
    const world = await build(JOLT_SETTINGS.restingContactDistance);
    const between = (a: string, b: string): number =>
      world.contactPoints().filter((point) => point.a === a && point.b === b).length;
    expect(between('rails', 'slab')).toBeGreaterThan(0);
    expect(between('floor', 'slab')).toBe(0);
    // With the resting margin as wide as the speculative distance (every pair within 5 mm gets
    // a contact, as the engine does by itself) the slab and the floor hold contact points that
    // never touch; the slab rests at the same height either way.
    const wide = await build(JOLT_SETTINGS.speculativeContactDistance);
    expect(wide.contactPoints().filter((p) => p.a === 'floor' && p.b === 'slab').length).toBe(4);
    expect(Math.abs(world.getPose('slab').p[2] - wide.getPose('slab').p[2])).toBeLessThan(1e-6);
    expect(world.getPose('slab').p[2]).toBeGreaterThan(0.006 - JOLT_SETTINGS.penetrationSlop);
  });

  it.each([0.3, 1, 1.2])(
    'creates them in time for a ball arriving at %d m/s, without the sweep',
    async (speed) => {
      // The contact must exist before the surfaces meet: the ball travels up to 5 mm per step
      // and nothing but its speculative contact stops it (continuous collision detection off).
      const r = 0.01;
      const world = await newWorld({ settings: { linearCast: false, allowSleeping: false } });
      world.addBody('floor', floor(0.3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
      world.addBody('ball', [ball(r)], ballMass(0.05, r), SURFACE, at(0, 0, r + 0.0307), 'dynamic');
      world.setVelocity('ball', [0, 0, -speed], [0, 0, 0]);
      let lowest = Infinity;
      for (let step = 0; step < 120; step++) {
        world.step(1);
        lowest = Math.min(lowest, world.getPose('ball').p[2] - r);
      }
      // Never deeper into the floor than the slop the solver leaves in a resting contact.
      expect(lowest).toBeGreaterThan(-1.5 * JOLT_SETTINGS.penetrationSlop);
    },
  );
});

describe('contact capacity', () => {
  const h: Vec3 = [0.01, 0.01, 0.01];
  /** A world with room for 64 contact manifolds and a floor. */
  const small = async (): Promise<Awaited<ReturnType<typeof newWorld>>> => {
    const world = await newWorld({ settings: { maxContactConstraints: 64 } });
    world.addBody('floor', floor(0.3), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    return world;
  };
  const addRaft = (world: Awaited<ReturnType<typeof newWorld>>, columns: number): string[] => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < columns; j++) {
        const id = `box_${i}_${j}`;
        world.addBody(
          id,
          [box('b', h)],
          boxMass(0.05, h),
          SURFACE,
          at(-0.2 + 0.04 * i, -0.2 + 0.04 * j, 0.0101),
          'dynamic',
        );
        ids.push(id);
      }
    }
    return ids;
  };

  it('undoes the step that would overflow it and says so with a typed error', async () => {
    // Four rows of ten boxes rest on the floor (40 manifolds of 64); six more rows make 100.
    const world = await small();
    addRaft(world, 4);
    world.step(30);
    expect(world.stats().manifolds).toBe(40);
    const extra: string[] = [];
    for (let i = 0; i < 10; i++) {
      for (let j = 4; j < 10; j++) {
        const id = `late_${i}_${j}`;
        world.addBody(
          id,
          [box('b', h)],
          boxMass(0.05, h),
          SURFACE,
          at(-0.2 + 0.04 * i, -0.2 + 0.04 * j, 0.0101),
          'dynamic',
        );
        extra.push(id);
      }
    }
    const before = world.stateHash();
    const contacts = world.contacts();
    let caught: unknown;
    try {
      world.settle(SETTLE);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContactCapacityError);
    const error = caught as ContactCapacityError;
    expect(error.name).toBe('ContactCapacityError');
    expect(error.manifolds).toBe(100);
    expect(error.capacity).toBe(64);
    expect(error.restored).toBe(true);
    // The world is as it was before the step that failed: same state, same contacts, usable.
    expect(world.stateHash()).toBe(before);
    expect(world.contacts()).toEqual(contacts);
    // The caller refuses the action that overloaded the world, and carries on.
    for (const id of extra) world.removeBody(id);
    const result = world.settle(SETTLE);
    expect(result.atRest).toBe(true);
    expect(world.stats().peakManifolds).toBe(100);
  });

  it('reports an overflow that comes out of the blue too, with the world as that step left it', async () => {
    // Ten rows of boxes in free fall from 20 mm reach the floor in the same step: from no
    // contact at all to 100 manifolds. The state is only saved before a step when the count is
    // already high or the world has just been changed from outside (saving costs half a step),
    // so this step cannot be undone, and the error says so.
    const world = await small();
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        world.addBody(
          `box_${i}_${j}`,
          [box('b', h)],
          boxMass(0.05, h),
          SURFACE,
          at(-0.2 + 0.04 * i, -0.2 + 0.04 * j, 0.0101 + 0.02),
          'dynamic',
        );
      }
    }
    let caught: unknown;
    try {
      world.step(240);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ContactCapacityError);
    const error = caught as ContactCapacityError;
    expect(error.manifolds).toBe(100);
    expect(error.restored).toBe(false);
    // The steps of the call up to and including the failing one stand: the boxes fell for
    // sqrt(2 * 20 mm / g) = 64 ms, 15 or 16 steps, and have reached the floor.
    expect(world.stats().steps).toBeGreaterThanOrEqual(14);
    expect(world.stats().steps).toBeLessThanOrEqual(17);
    // (The contacts are created up to 5 mm ahead of the floor.)
    expect(world.getPose('box_0_0').p[2]).toBeLessThan(0.0101 + 0.005);
    expect(world.getPose('box_0_0').p[2]).toBeGreaterThan(0.0101 - 0.001);
    // The world is still a world: bodies can be taken out and the rest simulated.
    for (let i = 0; i < 10; i++) for (let j = 5; j < 10; j++) world.removeBody(`box_${i}_${j}`);
    expect(world.settle(SETTLE).atRest).toBe(true);
  });
});

describe('bodies released inside each other', () => {
  it('are pushed apart when they can be, without being thrown', async () => {
    // Two blocks released 5 mm inside each other on a floor.
    const half: Vec3 = [0.03, 0.03, 0.02];
    const world = await newWorld();
    world.addBody('floor', floor(0.5), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    const pieces = [box('b', half)];
    world.addBody('left', pieces, boxMass(0.4, half), SURFACE, at(-0.0275, 0, 0.0201), 'dynamic');
    world.addBody('right', pieces, boxMass(0.4, half), SURFACE, at(0.0275, 0, 0.0201), 'dynamic');
    let fastest = 0;
    for (let step = 0; step < 240; step++) {
      world.step(1);
      for (const id of ['left', 'right']) {
        fastest = Math.max(fastest, v3Length(world.getVelocity(id).linear));
      }
    }
    const result = world.settle(SETTLE);
    expect(result.atRest).toBe(true);
    expect(result.penetrating).toEqual([]);
    const overlap = measurePenetration(
      { pieces, pose: world.getPose('left') },
      { pieces, pose: world.getPose('right') },
    ).depth;
    expect(overlap).toBeLessThan(UNRESOLVED_PENETRATION);
    // Pushed apart, not launched (and never beyond the limit on linear speed).
    expect(fastest).toBeLessThan(0.5);
    expect(JOLT_SETTINGS.maxLinearVelocity).toBe(10);
  });

  it('are reported when they cannot be', async () => {
    // A block 40 mm wide released in a slot 36 mm wide: 2 mm inside each wall, for good.
    expect(UNRESOLVED_PENETRATION).toBe(0.0005);
    const half: Vec3 = [0.02, 0.03, 0.02];
    const world = await newWorld();
    world.addBody('floor', floor(0.5), NO_MASS, SURFACE, AT_ORIGIN, 'static');
    world.addBody(
      'slot',
      [
        box('wall', [0.01, 0.05, 0.03], [-0.028, 0, 0.03]),
        box('wall', [0.01, 0.05, 0.03], [0.028, 0, 0.03]),
      ],
      NO_MASS,
      SURFACE,
      AT_ORIGIN,
      'static',
    );
    world.addBody(
      'wedged',
      [box('b', half)],
      boxMass(0.4, half),
      SURFACE,
      at(0, 0, 0.0201),
      'dynamic',
    );
    world.addBody(
      'free',
      [box('b', half)],
      boxMass(0.4, half),
      SURFACE,
      at(0.2, 0, 0.0201),
      'dynamic',
    );
    let fastest = 0;
    for (let step = 0; step < 480; step++) {
      world.step(1);
      fastest = Math.max(fastest, v3Length(world.getVelocity('wedged').linear));
    }
    const result = world.settle(SETTLE);
    expect(result.penetrating).toEqual(['wedged']);
    expect(fastest).toBeLessThan(JOLT_SETTINGS.maxLinearVelocity);
  });
});
