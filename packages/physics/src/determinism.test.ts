// Determinism (docs/design/platform.md section 2): bit-identical state hashes across runs,
// across the order in which bodies are added, and through snapshot, restore and replay. The
// scene mixes bodies that never meet (plates in their slots) with bodies that interact through
// shared islands (nested bowls, cutlery crowded into basket cells).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { rackTravelDistances, travelRack } from './mechanics.ts';
import { LOADING_TIME_STEP, settleOptionsFor } from './settings.ts';
import type { AddOrder } from './test-replay.ts';
import { REPLAY_BLOCKS, addMixedScene, blockHashes, mixedScene } from './test-replay.ts';
import { RACK_TRAVEL_PROFILE } from './types.ts';
import type { TestWorldOptions } from './test-world.ts';
import { useWorlds } from './test-world.ts';
import type { JoltPhysicsWorld } from './world.ts';

const newWorld = useWorlds();
const SETTLE = settleOptionsFor(LOADING_TIME_STEP);

async function build(
  order: AddOrder,
  options: TestWorldOptions = {},
  carriers: 'static' | 'kinematic' = 'static',
): Promise<JoltPhysicsWorld> {
  const world = await newWorld(options);
  addMixedScene(world, order, carriers);
  return world;
}

const history = blockHashes;

describe('determinism', () => {
  it('gives the same hashes in two runs, and whatever order the bodies are added in', async () => {
    const reference = history(await build('sorted'), 6);
    // The scene is not trivial: the state changes from block to block until everything rests
    // (after 1.5 s; the later blocks repeat the resting state).
    expect(new Set(reference).size).toBeGreaterThanOrEqual(3);
    expect(history(await build('sorted'), 6)).toEqual(reference);
    expect(history(await build('reversed'), 6)).toEqual(reference);
    expect(history(await build('shuffled'), 6)).toEqual(reference);
  });

  it('replays identically after snapshot and restore, in the same world and in another', async () => {
    const world = await build('sorted');
    world.step(240);
    const snapshot = world.snapshot();
    const first = history(world, 4);
    const contacts = world.contacts();
    world.restore(snapshot);
    expect(history(world, 4)).toEqual(first);
    expect(world.contacts()).toEqual(contacts);
    // A different world instance, its bodies added in another order, takes the same snapshot.
    const other = await build('reversed');
    other.restore(snapshot);
    expect(history(other, 4)).toEqual(first);
    expect(other.contacts()).toEqual(contacts);
    expect(contacts.length).toBeGreaterThan(30);
  });

  it('is not perturbed by the contact listener that supplies friction and restitution', async () => {
    // With one pair of coefficients for every pair of materials, the pair table gives every
    // contact exactly what Jolt's own combine rule gives when every body carries those
    // coefficients (geometric mean of equal frictions, maximum of equal restitutions). Writing
    // them from the listener must therefore change nothing: identical hashes whether the
    // listener writes them or leaves them to the engine.
    const withListener = history(await build('sorted'), 4);
    const without = history(
      await build('sorted', { settings: { contactCoefficients: 'body-material' } }),
      4,
    );
    expect(without).toEqual(withListener);
  });

  it('is not perturbed by snapshots taken and restored every few steps, here or into another world', async () => {
    // Three worlds run the same half minute of action: the load settles, the racks travel
    // 0.3 m and stop, the load settles again. The first runs straight through. The second
    // takes a snapshot of itself and restores it every seventh step. The third, whose bodies
    // were added in the opposite order, is overwritten with the state of the second every
    // seventh step and steps by itself in between. Whatever the wrapper keeps beside the
    // engine's state (rest timers, averaged velocities, what holds a body at rest, the request
    // for fresh contacts) must be in the snapshot, or the hashes part.
    const racks = mixedScene().parts.map((part) => part.id);
    const straight = await build('sorted', {}, 'kinematic');
    const looped = await build('sorted', {}, 'kinematic');
    const other = await build('reversed', {}, 'kinematic');
    const start = new Map(racks.map((id) => [id, straight.getPose(id)]));
    const travel = rackTravelDistances(0.3, RACK_TRAVEL_PROFILE, LOADING_TIME_STEP);
    let compared = 0;
    for (let step = 1; step <= 1000; step++) {
      // (The load is asleep after 450 steps: a fork in the basket is the last to lie still.)
      const driven = travel[step - 501];
      for (const world of [straight, looped, other]) {
        if (driven === undefined) continue;
        for (const id of racks) {
          const from = start.get(id) as { p: readonly number[]; q: readonly number[] };
          world.setPose(id, {
            p: [from.p[0] as number, (from.p[1] as number) + driven, from.p[2] as number],
            q: from.q as [number, number, number, number],
          });
        }
      }
      straight.step(1);
      const round = step % 7 === 0;
      if (round) looped.restore(looped.snapshot());
      looped.step(1);
      if (round) other.restore(looped.snapshot());
      else other.step(1);
      // The comparison covers bodies in every state: asleep before the racks move, woken by
      // them, and coming to rest again.
      if (step === 500) expect(straight.stats().activeBodies).toBe(0);
      if (step === 520) expect(straight.stats().activeBodies).toBeGreaterThan(15);
      if (step % 10 !== 0) continue;
      compared++;
      expect(looped.stateHash(), `step ${step}`).toBe(straight.stateHash());
      expect(other.stateHash(), `step ${step}`).toBe(straight.stateHash());
    }
    expect(compared).toBe(100);
    expect(straight.stats().activeBodies).toBeLessThan(10);
  });

  it('carries a sleeping load on kinematic racks to the same state whatever the add order', async () => {
    // Everything that carries the load is driven 0.3 m along +y with the rack profile. The
    // driven bodies wake what sleeps on them through a broad-phase query, whose order follows
    // the order in which bodies entered the engine; the outcome must not.
    const scene = mixedScene();
    const riders = scene.bodies.map((body) => ({ id: body.id }));
    const racks = scene.parts.map((part) => part.id);
    const run = async (
      order: AddOrder,
    ): Promise<{ hash: string; moved: number; world: JoltPhysicsWorld }> => {
      const world = await build(order, {}, 'kinematic');
      expect(world.settle(SETTLE).atRest).toBe(true);
      expect(world.stats().activeBodies).toBe(0);
      const result = travelRack(world, {
        racks,
        travel: [0, 0.3, 0],
        riders,
      });
      return { hash: world.stateHash(), moved: result.moved.length, world };
    };
    const reference = await run('sorted');
    // The end stop does disturb this load: the comparison is not between two worlds at rest
    // in their starting poses.
    expect(reference.moved).toBeGreaterThanOrEqual(3);
    expect((await run('reversed')).hash).toBe(reference.hash);
    const shuffled = await run('shuffled');
    expect(shuffled.hash).toBe(reference.hash);
    // And from a snapshot of the settled load, in a world whose broad phase has since been
    // through a whole travel of its own.
    const again = await build('sorted', {}, 'kinematic');
    again.settle(SETTLE);
    const settled = again.snapshot();
    shuffled.world.restore(settled);
    travelRack(shuffled.world, { racks, travel: [0, 0.3, 0], riders });
    expect(shuffled.world.stateHash()).toBe(reference.hash);
  });

  it('gives the same hashes in another process', async () => {
    // The scripted run of test-replay.ts, executed by a second Node process (through tsx, the
    // repository's TypeScript runner) with its own engine instance.
    const script = fileURLToPath(new URL('./test-replay.ts', import.meta.url));
    const output = execFileSync(process.execPath, ['--import', 'tsx', script], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      timeout: 120_000,
    });
    const elsewhere = JSON.parse(output) as string[];
    expect(elsewhere).toHaveLength(REPLAY_BLOCKS);
    expect(elsewhere).toEqual(history(await build('sorted'), REPLAY_BLOCKS));
  });

  it('does not depend on what was simulated in the engine instance before', async () => {
    // A world that takes over a recycled engine instance from an unrelated, disposed world.
    const scratch = await build('shuffled');
    scratch.step(300);
    scratch.applyImpulse('plate_03', [0.1, 0.05, 0]);
    scratch.step(100);
    scratch.dispose();
    const reference = history(await build('sorted'), 3);
    const again = history(await build('sorted'), 3);
    expect(again).toEqual(reference);
  });
});
