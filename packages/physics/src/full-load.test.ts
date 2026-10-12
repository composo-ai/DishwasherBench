// The full load of the bake-off's scaling measurement (docs/research/spike-rigid-body.md,
// "Scaling"): four racks and three cutlery baskets holding 122 dynamic bodies. It checks that a
// load of the size the platform budgets for settles sanely, and it measures the step time.
//
// The step time printed by this test is indicative only (other test files run at the same time);
// the figures quoted in the package report were taken with this scene in a process of its own.
import type { Vec3 } from '@spotless/core';
import { v3Distance } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { JOLT_SETTINGS, LOADING_TIME_STEP } from './settings.ts';
import type { SceneBody, TestScene } from './test-shapes.ts';
import { makeFullLoad, scenePieceCount } from './test-shapes.ts';
import type { StaticPart } from './test-world.ts';
import { addScene, fastest, penetrationMeter, useWorlds } from './test-world.ts';
import { REST_CRITERION } from './types.ts';
import type { JoltPhysicsWorld } from './world.ts';

const DT = LOADING_TIME_STEP;
const MM = 1e-3;

const newWorld = useWorlds();

function machineOf(scene: TestScene): StaticPart {
  return { id: 'machine', pieces: scene.statics };
}

async function build(scene: TestScene, reversed = false): Promise<JoltPhysicsWorld> {
  const world = await newWorld();
  const bodies: SceneBody[] = reversed ? [...scene.bodies].reverse() : [...scene.bodies];
  if (reversed) {
    addScene(world, [], bodies);
    addScene(world, [machineOf(scene)], []);
  } else {
    addScene(world, [machineOf(scene)], bodies);
  }
  return world;
}

function summary(samples: readonly number[]): { mean: number; p99: number; max: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, x) => sum + x, 0) / sorted.length;
  return {
    mean,
    p99: sorted[Math.floor(0.99 * sorted.length)] as number,
    max: sorted[sorted.length - 1] as number,
  };
}

describe('full load', () => {
  const scene = makeFullLoad();

  it('is the size the platform budgets for: about 120 bodies, 3000 pieces, 1300 static capsules', () => {
    expect(scene.bodies).toHaveLength(122);
    expect(scenePieceCount(scene)).toBeGreaterThanOrEqual(3000);
    expect(scene.statics.filter((piece) => piece.kind === 'capsule').length).toBeGreaterThanOrEqual(
      1300,
    );
  });

  it('settles within 3 s with every contact resolved, and steps in a few milliseconds', async () => {
    const world = await build(scene);
    const ids = scene.bodies.map((body) => body.id);
    const meter = penetrationMeter(world, [machineOf(scene)], scene.bodies);
    // Everything starts clear of everything else.
    const initial = meter();
    expect(initial.withStatics).toBe(0);
    expect(initial.betweenBodies).toBe(0);

    const times: number[] = [];
    let mostManifolds = 0;
    let lastUnrest = 0;
    let fastestEver = 0;
    let deepest = 0;
    for (let i = 0; i < 4 * 240; i++) {
      const before = performance.now();
      world.step(1);
      times.push(performance.now() - before);
      mostManifolds = Math.max(mostManifolds, world.stats().manifolds);
      if (i % 8 === 7) {
        const speed = fastest(world, ids);
        fastestEver = Math.max(fastestEver, speed.linear);
        if (
          speed.linear > REST_CRITERION.linearSpeed ||
          speed.angular > REST_CRITERION.angularSpeed
        ) {
          lastUnrest = (i + 1) * DT;
        }
      }
      // True overlap of the rounded shapes, every 0.25 s (the measurement takes 0.1 s).
      if (i % 60 === 59) {
        const reading = meter();
        deepest = Math.max(deepest, reading.withStatics, reading.betweenBodies);
      }
    }

    // Everything is at rest well inside the settle budget (measured: 2.0 s) and asleep.
    expect(lastUnrest).toBeLessThan(3);
    expect(world.stats().activeBodies).toBe(0);
    // Nothing was thrown about: the items were released at most 25 mm above their seats, which
    // free fall turns into 0.7 m/s.
    expect(fastestEver).toBeLessThan(1.5);
    // Nothing left its rack or basket: every body is within 150 mm of where it was released
    // (cutlery drops about 115 mm into its basket) and above the lowest rack.
    for (const body of scene.bodies) {
      const p: Vec3 = world.getPose(body.id).p;
      expect(v3Distance(p, body.pose.p)).toBeLessThan(0.15);
      expect(p[2]).toBeGreaterThan(0);
    }
    // No pair of true shapes overlaps by 0.2 mm at any sampled time (measured: 0.10 mm).
    expect(deepest).toBeLessThan(0.2 * MM);
    // The contact capacity is not approached (measured: about 6200 of 10240 manifolds).
    expect(mostManifolds).toBeLessThan(0.8 * JOLT_SETTINGS.maxContactConstraints);
    expect(mostManifolds).toBeGreaterThan(1000);

    const all = summary(times);
    const firstSecond = summary(times.slice(0, 240));
    console.info(
      `full load: ${scene.bodies.length} bodies, ${scenePieceCount(scene)} pieces, ` +
        `${scene.statics.length} static pieces; step time mean ${all.mean.toFixed(2)} ms ` +
        `(first second ${firstSecond.mean.toFixed(2)} ms), p99 ${all.p99.toFixed(1)} ms, ` +
        `max ${all.max.toFixed(1)} ms; at rest after ${lastUnrest.toFixed(2)} s; ` +
        `most manifolds ${mostManifolds}; deepest true overlap ${(deepest / MM).toFixed(3)} mm`,
    );
    // A generous bound, ten times what was measured on the development machine alone, so that
    // only an order-of-magnitude regression fails here.
    expect(all.mean).toBeLessThan(40);
  });

  it('gives the same state after a second of simulation whatever order its bodies were added in', async () => {
    const forward = await build(scene);
    const backward = await build(scene, true);
    forward.step(240);
    backward.step(240);
    expect(backward.stateHash()).toBe(forward.stateHash());
    // Not a comparison of two worlds at rest: most of the load is still awake.
    expect(forward.stats().activeBodies).toBeGreaterThan(30);
  });
});
