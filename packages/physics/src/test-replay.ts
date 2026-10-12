/**
 * Test-only (not exported from the package entry point): the mixed scene of the determinism
 * tests, and a scripted run of it that prints its state hashes when this file is executed as a
 * program. The determinism tests run it in a second process and compare.
 *
 * The scene mixes bodies that never meet (plates in their slots) with bodies that interact
 * through shared islands (nested bowls, cutlery crowded into basket cells). Units: SI.
 */

import { pathToFileURL } from 'node:url';
import type { Pose } from '@spotless/core';
import type { CollisionPiece, MassProperties } from '@spotless/geometry';
import { JOLT_SETTINGS, LOADING_GRAVITY, LOADING_TIME_STEP } from './settings.ts';
import type { SceneBody } from './test-shapes.ts';
import {
  BAKE_OFF_PAIR,
  BOWL_FOOT,
  TEST_MATERIALS,
  bowlProfile,
  cutleryInBasket,
  idealNestSpacing,
  makeBasket,
  makeBowl,
  makeRack,
  testRandom,
  twelvePlates,
  uprightPose,
} from './test-shapes.ts';
import type { BodyKind, PhysicsWorld } from './types.ts';
import { createPhysicsWorld } from './world.ts';

/** A fixed part of the mixed scene: a rack, a basket or a floor, at the identity pose. */
export interface MixedPart {
  readonly id: string;
  readonly pieces: readonly CollisionPiece[];
  readonly material: string;
}

/** Order in which the bodies of the mixed scene are added to a world. */
export type AddOrder = 'sorted' | 'reversed' | 'shuffled';

const NO_MASS: MassProperties = { mass: 0, com: [0, 0, 0], inertia: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
const AT_ORIGIN: Pose = { p: [0, 0, 0], q: [0, 0, 0, 1] };

/**
 * The mixed scene: a rack with twelve plates, a basket with eight pieces of cutlery in four
 * cells, and three bowls dropped into each other on a floor. 23 dynamic bodies.
 */
export function mixedScene(): { parts: MixedPart[]; bodies: SceneBody[] } {
  const basket = makeBasket([0.6, 0, 0]);
  const ideal = idealNestSpacing([bowlProfile(4), BOWL_FOOT]);
  const bowl = makeBowl(16, 4);
  const bowls: SceneBody[] = [0, 1, 2].map((i) => ({
    id: `bowl_${i}`,
    item: bowl,
    pose: uprightPose([0.9 + 0.002 * i, 0.001 * i, 0.002 + i * (ideal + 0.02)], 0.3 * i),
    material: TEST_MATERIALS.ceramic,
  }));
  return {
    parts: [
      { id: 'rack', pieces: makeRack(), material: TEST_MATERIALS.wire },
      { id: 'basket', pieces: basket.pieces, material: TEST_MATERIALS.plastic },
      {
        id: 'floor',
        pieces: [
          {
            kind: 'box',
            part: 'floor',
            halfExtents: [0.2, 0.2, 0.01],
            radius: 0,
            pose: { p: [0.9, 0, -0.01], q: [0, 0, 0, 1] },
          },
        ],
        material: TEST_MATERIALS.wire,
      },
    ],
    bodies: [...twelvePlates(16), ...bowls, ...cutleryInBasket(basket).bodies.slice(0, 8)],
  };
}

/**
 * Adds the mixed scene to a world in the given order; its racks, basket and floor are bodies of
 * kind `carriers`.
 */
export function addMixedScene(
  world: PhysicsWorld,
  order: AddOrder,
  carriers: BodyKind = 'static',
): void {
  const scene = mixedScene();
  const adds: (() => void)[] = [];
  for (const part of scene.parts) {
    adds.push(() =>
      world.addBody(
        part.id,
        part.pieces,
        NO_MASS,
        { material: part.material },
        AT_ORIGIN,
        carriers,
      ),
    );
  }
  for (const body of scene.bodies) {
    adds.push(() =>
      world.addBody(
        body.id,
        body.item.pieces,
        body.item.mass,
        { material: body.material },
        body.pose,
        'dynamic',
      ),
    );
  }
  if (order === 'reversed') adds.reverse();
  if (order === 'shuffled') {
    const random = testRandom(99);
    for (let i = adds.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [adds[i], adds[j]] = [adds[j] as () => void, adds[i] as () => void];
    }
  }
  for (const add of adds) add();
}

/** State hashes of a world after each of `blocks` blocks of 120 steps (0.5 s at 1/240 s). */
export function blockHashes(world: PhysicsWorld, blocks: number): string[] {
  const hashes: string[] = [];
  for (let i = 0; i < blocks; i++) {
    world.step(120);
    hashes.push(world.stateHash());
  }
  return hashes;
}

/** Number of blocks of the scripted run that the second process prints. */
export const REPLAY_BLOCKS = 4;

// Executed as a program: print the hashes of the scripted run as JSON and nothing else.
const program = process.argv[1];
if (program !== undefined && import.meta.url === pathToFileURL(program).href) {
  const world = await createPhysicsWorld(
    { timeStep: LOADING_TIME_STEP, gravity: LOADING_GRAVITY, pairLookup: BAKE_OFF_PAIR },
    JOLT_SETTINGS,
  );
  addMixedScene(world, 'sorted');
  process.stdout.write(JSON.stringify(blockHashes(world, REPLAY_BLOCKS)));
  world.dispose();
}
