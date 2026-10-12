// The whole catalogue through the chain: every item type becomes collision pieces the physics
// world accepts, falls as a free body should, weighs what the catalogue says once it rests, and
// stands in every pose the catalogue calls free-standing. And the catalogue's pair table answers
// for every pair of materials a world can ask about.
import {
  contactPairLookup,
  frictionPair,
  instantiate,
  listItemTypes,
  listMaterials,
} from '@spotless/catalogue';
import type { Pose } from '@spotless/core';
import { POSE_IDENTITY, STANDARD_GRAVITY, quatAngleBetween, v3Distance } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import type { JoltPhysicsWorld } from '@spotless/physics';
import {
  LOADING_GRAVITY,
  LOADING_TIME_STEP,
  NO_MASS,
  createPhysicsWorld,
  settleOptionsFor,
} from '@spotless/physics';
import { afterEach, describe, expect, it } from 'vitest';
import { collisionPiecesOf, poseOver } from './scene.ts';

const DT = LOADING_TIME_STEP;
const DEG = Math.PI / 180;
const MM = 1e-3;

const live: JoltPhysicsWorld[] = [];
afterEach(() => {
  for (const world of live.splice(0)) world.dispose();
});

async function newWorld(wet = false): Promise<JoltPhysicsWorld> {
  const world = await createPhysicsWorld({
    timeStep: DT,
    gravity: LOADING_GRAVITY,
    pairLookup: contactPairLookup(wet),
  });
  live.push(world);
  return world;
}

/** A flat slab of a catalogue material, 1.2 m square, its top on z = 0. */
function floorOf(material: string): Shape {
  return {
    parts: [
      {
        id: 'floor',
        prim: { kind: 'rbox', halfExtents: [0.6, 0.6, 0.01], radius: 0 },
        pose: { p: [0, 0, -0.01], q: [0, 0, 0, 1] },
        material,
      },
    ],
    regions: [],
  };
}

describe('every catalogue item type through the chain', () => {
  it('becomes a body the world accepts, placed where it was put, and falls freely', async () => {
    const world = await newWorld();
    const types = listItemTypes();
    expect(types.length).toBeGreaterThanOrEqual(100);
    // One of each, a metre apart in a row, each turned differently, in mid air.
    const start = new Map<string, Pose>();
    let pieces = 0;
    types.forEach((type, i) => {
      const instance = instantiate(type.id);
      const own = collisionPiecesOf(instance.shape);
      expect(own.length, type.id).toBeGreaterThan(0);
      // Every piece names a part of the shape and carries that part's material.
      const materials = new Map(instance.shape.parts.map((part) => [part.id, part.material]));
      for (const piece of own) expect(piece.material, type.id).toBe(materials.get(piece.part));
      pieces += own.length;
      const yaw = 0.37 * i;
      const pose: Pose = {
        p: [i, 0.5 * Math.sin(i), 2 + 0.1 * Math.cos(i)],
        q: [0, Math.sin(yaw / 2) * 0.6, Math.sin(yaw / 2) * 0.8, Math.cos(yaw / 2)],
      };
      start.set(type.id, pose);
      world.addBody(type.id, own, instance.mass, instance.contact, pose, 'dynamic');
    });
    expect(world.bodyIds()).toHaveLength(types.length);
    // The engine places a body by its centre of mass; the wrapper converts with the catalogue's
    // centre of mass. The item-frame pose that comes back is the one put in, to single precision
    // of the engine at up to 100 m from the origin (0.03 mm) and 1e-6 rad.
    for (const type of types) {
      const pose = world.getPose(type.id);
      const given = start.get(type.id) as Pose;
      expect(v3Distance(pose.p, given.p), type.id).toBeLessThan(0.03 * MM);
      expect(quatAngleBetween(pose.q, given.q), type.id).toBeLessThan(1e-5);
    }
    // Sixty steps of free fall: v = g n dt and z = z0 - g dt^2 n (n + 1) / 2 for every one of
    // them, whatever its shape and mass, without turning.
    const n = 60;
    world.step(n);
    for (const type of types) {
      const pose = world.getPose(type.id);
      const given = start.get(type.id) as Pose;
      const velocity = world.getVelocity(type.id);
      expect(Math.abs(velocity.linear[2] + STANDARD_GRAVITY * n * DT), type.id).toBeLessThan(1e-4);
      const fallen = (STANDARD_GRAVITY * DT * DT * n * (n + 1)) / 2;
      expect(Math.abs(given.p[2] - pose.p[2] - fallen), type.id).toBeLessThan(0.05 * MM);
      expect(Math.hypot(pose.p[0] - given.p[0], pose.p[1] - given.p[1]), type.id).toBeLessThan(
        0.05 * MM,
      );
      expect(quatAngleBetween(pose.q, given.q), type.id).toBeLessThan(1e-4);
      expect(Math.hypot(...velocity.angular), type.id).toBeLessThan(1e-4);
    }
    // For the record: the catalogue is some ten thousand collision pieces.
    expect(pieces).toBeGreaterThan(5000);
  });

  it('stands in every pose the catalogue calls free-standing, and weighs what the catalogue says', async () => {
    // Each pose in turn: released 0.3 mm above a flat steel floor, left for at least 1.5 s.
    // The catalogue's static analysis says these poses are stable equilibria; here the rigid-body
    // engine has its say on the collision pieces. And once the item rests, the floor carries
    // m g: the normal forces of its contacts add up to the catalogue's mass times gravity, which
    // is how a wrong mass or a mass replaced by the engine's own estimate would show.
    const world = await newWorld();
    const floor = floorOf('stainless_steel');
    world.addBody(
      'floor',
      collisionPiecesOf(floor),
      NO_MASS,
      { material: 'stainless_steel' },
      POSE_IDENTITY,
      'static',
    );
    // Left alone first (no disturbance: this is the catalogue's statics against the engine's),
    // then with the settle the game uses, which tilts gravity by a degree four ways.
    const settle = { ...settleOptionsFor(DT, false), minSteps: 360, maxSteps: 1200 };
    const disturbing = { ...settleOptionsFor(DT), maxSteps: 1200 };
    const gap = 0.0003;
    let poses = 0;
    let worstTurn = 0;
    let worstHeight = 0;
    let worstWeight = 0;
    const turned: string[] = [];
    const disturbed: string[] = [];
    let worstDisturbedSlide = 0;
    for (const type of listItemTypes()) {
      const instance = instantiate(type.id);
      for (const pose of instance.stablePoses) {
        if (!pose.freeStanding) continue;
        poses++;
        const label = `${type.id} / ${pose.name}`;
        const start = poseOver(instance.shape, pose.q, 0, 0, gap);
        world.addBody(
          'item',
          collisionPiecesOf(instance.shape),
          instance.mass,
          instance.contact,
          start,
          'dynamic',
        );
        expect(world.settle(settle).atRest, label).toBe(true);
        const end = world.getPose('item');
        const turn = quatAngleBetween(start.q, end.q) / DEG;
        if (turn > 1) turned.push(`${label}: ${turn.toFixed(1)} degrees`);
        else worstTurn = Math.max(worstTurn, turn);
        // It has come down by the gap it was released with and no further, and has not slid.
        const height = end.p[2] - (start.p[2] - gap);
        worstHeight = Math.max(worstHeight, Math.abs(height));
        expect(Math.abs(height), label).toBeLessThan(0.3 * MM);
        expect(Math.hypot(end.p[0] - start.p[0], end.p[1] - start.p[1]), label).toBeLessThan(
          0.3 * MM,
        );
        // On a level floor every contact normal is vertical: the forces add up to the weight.
        const contacts = world.contacts({ bodies: ['item'] });
        expect(contacts.length, label).toBeGreaterThan(0);
        const carried = contacts.reduce((sum, c) => sum + c.normalForceN, 0);
        const weight = instance.mass.mass * STANDARD_GRAVITY;
        worstWeight = Math.max(worstWeight, Math.abs(carried / weight - 1));
        expect(Math.abs(carried / weight - 1), label).toBeLessThan(0.01);
        // Woken and settled as the game settles: disturbed, and at rest again.
        world.applyImpulse('item', [0, 0, 0]);
        const again = world.settle(disturbing);
        expect(again.atRest, label).toBe(true);
        expect(again.disturbed, label).toBe(true);
        const after = world.getPose('item');
        const turnAfter = quatAngleBetween(end.q, after.q) / DEG;
        if (turnAfter > 1) disturbed.push(`${label}: ${turnAfter.toFixed(1)} degrees`);
        else {
          worstDisturbedSlide = Math.max(
            worstDisturbedSlide,
            Math.hypot(after.p[0] - end.p[0], after.p[1] - end.p[1]),
          );
        }
        world.removeBody('item');
      }
    }
    // Every item type has at least one such pose; the catalogue has 178 of them.
    expect(poses).toBeGreaterThanOrEqual(listItemTypes().length);
    // All stay within a tenth of a degree of the stated pose (0.03 degrees; 0.07 for the wooden
    // spoon lying flat). The spoon used to roll about its long axis by 5.4 degrees: its roll is
    // all but neutral over some 5 degrees either way (a round handle and a shallow bowl), and
    // the sectors of its bowl, each ending square to its own face, met the floor to one side of
    // the keel. With the sectors mitred (physics, `mitredPrism`) the bowl rests on its keel and
    // the spoon lies where the catalogue's static analysis says it does. Nothing may turn.
    expect(turned).toEqual([]);
    expect(worstTurn).toBeLessThan(0.1);
    // The disturbance of the game's settle finds the one pose of the catalogue that is all but
    // neutral: that wooden spoon lying flat rolls to the other end of its five degrees. Every
    // other free-standing pose is still within a degree of where it stood, and has slid or
    // rolled less than half a millimetre (the round ones roll a little on a level floor).
    expect(disturbed).toEqual(['wooden_spoon_305 / flat: 5.5 degrees']);
    expect(worstDisturbedSlide).toBeLessThan(0.5 * MM);
    // For the record (measured: 0.03 degrees, 0.16 mm, 0.2 %).
    expect(worstHeight).toBeLessThan(0.3 * MM);
    expect(worstWeight).toBeLessThan(0.01);
  });
});

describe('the catalogue pair table in a world', () => {
  it('answers for every pair of materials the world asks about, dry and wet', async () => {
    // One small ball of every catalogue material in one world. The world resolves a material
    // against every material already present, itself included, when a body brings it in, and
    // throws on an answer it cannot use. It must not throw, and it must have asked exactly once
    // for each of the n (n + 1) / 2 unordered pairs, ids in sorted order.
    const materials = listMaterials().map((m) => m.id);
    expect(materials.length).toBeGreaterThanOrEqual(30);
    for (const wet of [false, true]) {
      const asked: string[] = [];
      const lookup = contactPairLookup(wet);
      const world = await createPhysicsWorld({
        timeStep: DT,
        gravity: LOADING_GRAVITY,
        pairLookup: (a, b) => {
          asked.push(`${a}|${b}`);
          return lookup(a, b);
        },
      });
      live.push(world);
      materials.forEach((material, i) => {
        world.addBody(
          `ball_${material}`,
          [{ kind: 'capsule', part: 'ball', a: [0, 0, 0], b: [0, 0, 0], radius: 0.01 }],
          NO_MASS,
          { material },
          { p: [0.1 * i, 0, 0], q: [0, 0, 0, 1] },
          'static',
        );
      });
      world.step(1);
      const n = materials.length;
      expect(asked).toHaveLength((n * (n + 1)) / 2);
      expect(new Set(asked).size).toBe(asked.length);
      for (const pair of asked) {
        const [a, b] = pair.split('|') as [string, string];
        expect(a <= b, pair).toBe(true);
        const answer = frictionPair(a, b, wet);
        expect(answer.friction, pair).toBeGreaterThan(0);
        expect(Number.isFinite(answer.friction), pair).toBe(true);
        expect(answer.restitution, pair).toBeGreaterThanOrEqual(0);
        expect(answer.restitution, pair).toBeLessThanOrEqual(1);
        // Symmetric: the world only ever asks one way round.
        expect(frictionPair(b, a, wet).friction, pair).toBe(answer.friction);
        expect(frictionPair(b, a, wet).restitution, pair).toBe(answer.restitution);
      }
    }
  });

  it('is refused by the world when a material is not in the catalogue', async () => {
    const world = await newWorld();
    expect(() =>
      world.addBody(
        'ball',
        [{ kind: 'capsule', part: 'ball', a: [0, 0, 0], b: [0, 0, 0], radius: 0.01 }],
        NO_MASS,
        { material: 'unobtainium' },
        POSE_IDENTITY,
        'static',
      ),
    ).toThrow(/unknown material/);
    expect(world.bodyIds()).toEqual([]);
  });
});
