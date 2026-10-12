/**
 * Helpers for this package's tests and benchmark only (not exported from the package entry
 * point): creating worlds that are disposed after each test, putting test scenes into them and
 * measuring true penetration with the engine-independent measurer.
 */

import type { Pose } from '@spotless/core';
import type { CollisionPiece } from '@spotless/geometry';
import { afterEach } from 'vitest';
import type { ConvexCore } from './measure.ts';
import { coresPenetration, placedCores } from './measure.ts';
import type { JoltWorldSettings } from './settings.ts';
import { JOLT_SETTINGS, LOADING_GRAVITY, LOADING_TIME_STEP } from './settings.ts';
import type { SceneBody } from './test-shapes.ts';
import { BAKE_OFF_PAIR, TEST_MATERIALS } from './test-shapes.ts';
import type { ContactPairLookup } from './types.ts';
import { NO_MASS } from './types.ts';
import type { JoltPhysicsWorld } from './world.ts';
import { createPhysicsWorld } from './world.ts';

export { NO_MASS };

/** The identity pose. */
export const AT_ORIGIN: Pose = { p: [0, 0, 0], q: [0, 0, 0, 1] };

/** Options of the world factory returned by {@link useWorlds}. */
export interface TestWorldOptions {
  /** Engine settings to change from {@link JOLT_SETTINGS}. */
  readonly settings?: Partial<JoltWorldSettings>;
  /** Pair coefficients; defaults to the bake-off's (0.4, 0.1) for every pair. */
  readonly pairLookup?: ContactPairLookup;
  /** Gravity, m/s^2; defaults to {@link LOADING_GRAVITY}. */
  readonly gravity?: readonly [number, number, number];
  /** Time step, seconds; defaults to {@link LOADING_TIME_STEP}. */
  readonly timeStep?: number;
}

/**
 * Registers an `afterEach` hook that disposes every world made by the returned factory, and
 * returns the factory. Call it once at the top of a `describe` block or test file.
 */
export function useWorlds(): (options?: TestWorldOptions) => Promise<JoltPhysicsWorld> {
  const live: JoltPhysicsWorld[] = [];
  afterEach(() => {
    for (const world of live.splice(0)) world.dispose();
  });
  return async (options: TestWorldOptions = {}) => {
    const world = await createPhysicsWorld(
      {
        timeStep: options.timeStep ?? LOADING_TIME_STEP,
        gravity: options.gravity ?? LOADING_GRAVITY,
        pairLookup: options.pairLookup ?? BAKE_OFF_PAIR,
      },
      { ...JOLT_SETTINGS, ...options.settings },
    );
    live.push(world);
    return world;
  };
}

/** A static body of a test scene. */
export interface StaticPart {
  readonly id: string;
  readonly pieces: readonly CollisionPiece[];
  readonly material?: string;
}

/** Adds static parts (at the identity pose) and dynamic bodies to a world. */
export function addScene(
  world: JoltPhysicsWorld,
  statics: readonly StaticPart[],
  bodies: readonly SceneBody[],
): void {
  for (const part of statics) {
    world.addBody(
      part.id,
      part.pieces,
      NO_MASS,
      { material: part.material ?? TEST_MATERIALS.wire },
      AT_ORIGIN,
      'static',
    );
  }
  for (const body of bodies) {
    world.addBody(
      body.id,
      body.item.pieces,
      body.item.mass,
      { material: body.material },
      body.pose,
      'dynamic',
    );
  }
}

/** Deepest true overlaps of a scene, metres. */
export interface PenetrationReading {
  /** Between any dynamic body and any static part. */
  readonly withStatics: number;
  /** Between any two dynamic bodies. */
  readonly betweenBodies: number;
}

/**
 * Returns a function that measures, at the bodies' current poses, the deepest overlap of the
 * true rounded shapes (not of the engine's proxies) with the float64 measurer.
 */
export function penetrationMeter(
  world: JoltPhysicsWorld,
  statics: readonly StaticPart[],
  bodies: readonly SceneBody[],
): () => PenetrationReading {
  const fixed = statics.map((part) => placedCores({ pieces: part.pieces, pose: AT_ORIGIN }));
  return () => {
    const cores: ConvexCore[][] = bodies.map((body) =>
      placedCores({ pieces: body.item.pieces, pose: world.getPose(body.id) }),
    );
    let withStatics = 0;
    let betweenBodies = 0;
    for (let i = 0; i < cores.length; i++) {
      const own = cores[i] as ConvexCore[];
      for (const other of fixed) {
        withStatics = Math.max(withStatics, coresPenetration(own, other).depth);
      }
      for (let j = i + 1; j < cores.length; j++) {
        betweenBodies = Math.max(
          betweenBodies,
          coresPenetration(own, cores[j] as ConvexCore[]).depth,
        );
      }
    }
    return { withStatics, betweenBodies };
  };
}

/** Largest linear (m/s) and angular (rad/s) speed among the given bodies. */
export function fastest(
  world: JoltPhysicsWorld,
  ids: readonly string[],
): { linear: number; angular: number } {
  let linear = 0;
  let angular = 0;
  for (const id of ids) {
    const v = world.getVelocity(id);
    linear = Math.max(linear, Math.hypot(v.linear[0], v.linear[1], v.linear[2]));
    angular = Math.max(angular, Math.hypot(v.angular[0], v.angular[1], v.angular[2]));
  }
  return { linear, angular };
}
