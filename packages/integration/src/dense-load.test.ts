// A full, dense load (144 catalogue items, a basket with 64 pieces of cutlery, stacks of eight
// nested bowls) and a stack of twelve dinner plates: the worlds that used to run into the
// engine's contact capacity. They must simulate without throwing and with room to spare, come to
// rest, and survive the rack being pushed in. The peak number of contact manifolds is asserted
// against the capacity here and printed, so that a change that brings it near again is seen.
import { instantiate } from '@spotless/catalogue';
import { STANDARD_GRAVITY } from '@spotless/core';
import { JOLT_SETTINGS, RACK_TRAVEL_PROFILE, travelRack } from '@spotless/physics';
import { afterEach, describe, expect, it } from 'vitest';
import { BOWL, DINNER_PLATE, RELEASE_GAP, loadDenseLoad, loadNestedBowls } from './loads.ts';
import { profileNestSpacing } from './nest.ts';
import { measureOverlap } from './overlap.ts';
import type { LoadingScene } from './scene.ts';
import {
  BASKET_ID,
  RACK_ID,
  TUB_FLOOR_ID,
  addItem,
  axisFromUpDeg,
  collisionPiecesOf,
  createLoadingScene,
  orientationOf,
  settleScene,
} from './scene.ts';
import { STAND_IN_RACK, buildStandInRack } from './stand-in-rack.ts';

const MM = 1e-3;
const CAPACITY = JOLT_SETTINGS.maxContactConstraints;

const scenes: LoadingScene[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.world.dispose();
});

describe('a full, dense load of 144 items', () => {
  it('is loaded, settles and travels with the rack without coming near the contact capacity', async () => {
    const scene = await createLoadingScene({ rackKind: 'kinematic' });
    scenes.push(scene);
    let peak = 0;
    const watch = (): void => {
      peak = Math.max(peak, scene.world.stats().manifolds);
    };
    const load = loadDenseLoad(scene, watch);
    expect(load.count).toBe(144);
    expect(load.cutlery).toHaveLength(64);
    expect(load.bowls).toHaveLength(8);
    expect(load.topBowls).toHaveLength(8);
    // For the record: some 8,500 collision pieces.
    expect(scene.items.reduce((sum, item) => sum + item.pieces.length, 0)).toBeGreaterThan(7000);

    // Everything that was just added (62 items on the two upper levels) falls its release gap
    // at once while the lower rack is already loaded: the busiest moment.
    for (let i = 0; i < 480; i++) {
      scene.world.step(1);
      watch();
    }
    const settled = settleScene(scene);
    expect(settled.atRest).toBe(true);
    expect(settled.penetrating).toEqual([]);
    const loadingPeak = Math.max(peak, scene.world.stats().peakManifolds);
    // Measured: 3,743 manifolds at the peak, a quarter of the capacity of 15,360 (the same load
    // could not be built before: two stacked plates alone held 5,103).
    expect(loadingPeak).toBeGreaterThan(1000);
    expect(loadingPeak).toBeLessThan(0.4 * CAPACITY);

    // Nothing sank into anything, nothing fell through to the tub floor.
    expect(measureOverlap(scene).deepest).toBeLessThan(0.2 * MM);
    expect(scene.world.contacts({ bodies: [TUB_FLOOR_ID] })).toEqual([]);
    // Both stacks of eight bowls are nested at the spacing of their profile, level.
    const stacks = [
      { bowls: load.bowls, typeId: BOWL, base: 0 },
      { bowls: load.topBowls, typeId: 'dessert_bowl_vitrelle_130', base: 0.6 },
    ];
    for (const { bowls, typeId, base } of stacks) {
      const nest = profileNestSpacing(instantiate(typeId).shape);
      bowls.forEach((bowl, k) => {
        const pose = scene.world.getPose(bowl.id);
        expect(axisFromUpDeg(pose.q), bowl.id).toBeLessThan(0.5);
        expect(Math.abs(pose.p[2] - base - k * nest), bowl.id).toBeLessThan((0.1 + 0.1 * k) * MM);
      });
    }
    // Every piece of cutlery is still inside the basket it was dropped into, in plan.
    for (const [pieces, z0] of [
      [load.cutlery, 0],
      [load.topCutlery, 0.6],
    ] as const) {
      for (const { item, cell } of pieces) {
        const p = scene.world.getPose(item.id).p;
        const xs = scene.rack.cells.flatMap((c) => [c.inner.min[0], c.inner.max[0]]);
        const ys = scene.rack.cells.flatMap((c) => [c.inner.min[1], c.inner.max[1]]);
        const basket = {
          min: [Math.min(...xs), Math.min(...ys)] as const,
          max: [Math.max(...xs), Math.max(...ys)] as const,
        };
        expect(p[0], item.id).toBeGreaterThan(basket.min[0] - 0.03);
        expect(p[0], item.id).toBeLessThan(basket.max[0] + 0.03);
        expect(p[1], item.id).toBeGreaterThan(basket.min[1] - 0.03);
        expect(p[1], item.id).toBeLessThan(basket.max[1] + 0.03);
        expect(p[2] - z0, item.id).toBeGreaterThan(cell.inner.min[2] - 0.01);
        expect(p[2] - z0, item.id).toBeLessThan(0.3);
      }
    }

    // The loaded lower rack is pushed in under the two static levels above it.
    const result = travelRack(scene.world, {
      racks: [RACK_ID, BASKET_ID],
      travel: [0, 0.4, 0],
      riders: load.lower.map((item) => ({ id: item.id, point: item.instance.referencePoint })),
      envelope: scene.rack.envelope,
      profile: RACK_TRAVEL_PROFILE,
    });
    expect(result.blockedBy).toBeUndefined();
    expect(result.fellOut).toEqual([]);
    expect(scene.world.getPose(RACK_ID).p[1]).toBeCloseTo(0.4, 6);
    const overallPeak = scene.world.stats().peakManifolds;
    expect(overallPeak).toBeLessThan(0.4 * CAPACITY);
    console.info(
      `[contacts] dense load: ${load.count} items, peak ${loadingPeak} manifolds while loading, ` +
        `${overallPeak} including rack travel, capacity ${CAPACITY}`,
    );
  }, 240_000);
});

/**
 * Twelve dinner plates one above the other on the middle of a rack with its tines out of the
 * way. `oneByOne`: each is released the release gap above the one before, which has had half a
 * second to come down. Otherwise all are released together, each the release gap plus `drop`
 * metres above its place on the one below. Then stepped for two seconds and settled.
 */
async function stackPlates(
  drop: number,
  oneByOne: boolean,
): Promise<{
  scene: LoadingScene;
  nest: number;
  fastest: number;
  centre: readonly [number, number];
}> {
  // Two tines per rail only, at the front: the middle of the grid is free for a 250 mm plate.
  const rack = buildStandInRack({
    ...STAND_IN_RACK,
    tines: { ...STAND_IN_RACK.tines, count: 2 },
  });
  const scene = await createLoadingScene({ basket: false, rack });
  scenes.push(scene);
  const instance = instantiate(DINNER_PLATE);
  const nest = profileNestSpacing(instance.shape);
  const q = orientationOf(instance, 'upright');
  const centre = [STAND_IN_RACK.widthMm / 2000, STAND_IN_RACK.depthMm / 2000] as const;
  for (let k = 0; k < 12; k++) {
    const z = oneByOne ? k * nest + RELEASE_GAP : RELEASE_GAP + k * (nest + RELEASE_GAP + drop);
    const pose = { p: [centre[0], centre[1], z], q } as const;
    expect(scene.world.penetration(collisionPiecesOf(instance.shape), pose).depth).toBe(0);
    addItem(scene, `plate_${k}`, DINNER_PLATE, pose);
    // One at a time: each plate has half a second to come down before the next is put on.
    if (oneByOne) scene.world.step(120);
  }
  let fastest = 0;
  for (let i = 0; i < 480; i++) {
    scene.world.step(1);
    for (const item of scene.items) {
      fastest = Math.max(fastest, Math.hypot(...scene.world.getVelocity(item.id).linear));
    }
  }
  expect(settleScene(scene).atRest).toBe(true);
  return { scene, nest, fastest, centre };
}

describe('twelve dinner plates stacked flat', () => {
  it('placed on each other one at a time they hold a small part of the contact capacity and stand as a stack', async () => {
    const { scene, nest, centre } = await stackPlates(0, true);
    const peak = scene.world.stats().peakManifolds;
    // Measured: 1,528 at the peak, while the last plate comes down, a tenth of the capacity.
    // Two plates alone used to hold 5,103 (every facet pair within reach of the speculative
    // distance), a third of it.
    expect(peak).toBeGreaterThan(100);
    expect(peak).toBeLessThan(CAPACITY / 6);
    scene.items.forEach((item, k) => {
      const pose = scene.world.getPose(item.id);
      expect(axisFromUpDeg(pose.q), item.id).toBeLessThan(0.05);
      expect(Math.abs(pose.p[2] - k * nest), item.id).toBeLessThan(0.02 * MM);
      expect(Math.hypot(pose.p[0] - centre[0], pose.p[1] - centre[1]), item.id).toBeLessThan(
        0.05 * MM,
      );
    });
    expect(measureOverlap(scene).deepest).toBeLessThan(0.05 * MM);
    console.info(
      `[contacts] twelve plates placed in a stack: peak ${peak} manifolds, capacity ${CAPACITY}`,
    );
  }, 120_000);

  it('dropped onto each other all at once they stay under the capacity guard and end as a stack', async () => {
    // Each plate starts 5 mm above its place on the one below: all twelve are in the air at once
    // and every pair of neighbours closes together, the most contacts this load can ask for.
    const drop = 5 * MM;
    const { scene, nest, fastest, centre } = await stackPlates(drop, false);
    const peak = scene.world.stats().peakManifolds;
    // Measured: 8,731 of 15,360; the guard that turns an overflow into an error is at 13,824.
    expect(peak).toBeLessThan(0.75 * CAPACITY);
    // No plate is ever faster than a free fall through the whole height it could drop.
    expect(fastest).toBeLessThan(Math.sqrt(2 * STANDARD_GRAVITY * 12 * drop) + 1e-6);
    // The upper plates land a few millimetres off centre and sit that much askew on the rim
    // of the one below (measured: up to 6.7 mm, 0.7 degrees, 1.0 mm high on one side).
    scene.items.forEach((item, k) => {
      const pose = scene.world.getPose(item.id);
      expect(axisFromUpDeg(pose.q), item.id).toBeLessThan(1.5);
      expect(Math.abs(pose.p[2] - k * nest), item.id).toBeLessThan(2 * MM);
      expect(Math.hypot(pose.p[0] - centre[0], pose.p[1] - centre[1]), item.id).toBeLessThan(
        15 * MM,
      );
    });
    expect(measureOverlap(scene).deepest).toBeLessThan(0.2 * MM);
    console.info(
      `[contacts] twelve plates dropped into a stack: peak ${peak} manifolds, capacity ${CAPACITY}`,
    );
  }, 120_000);
});

describe('tall stacks of nested bowls', () => {
  it('twelve come to rest at the nest spacing, for a heavy porcelain bowl and a light glass one', async () => {
    // A stack of eight used to tremble for ever (every pair of the stack was tested afresh in
    // every step in which a bowl stirred), which the old engine sleep hid.
    for (const typeId of [BOWL, 'dessert_bowl_vitrelle_130']) {
      const scene = await createLoadingScene({ basket: false });
      scenes.push(scene);
      const [x, y] = scene.rack.openPoint;
      const { items } = loadNestedBowls(scene, x, y, { count: 12, typeId });
      scene.world.step(240);
      const settled = settleScene(scene);
      expect(settled.atRest, typeId).toBe(true);
      expect(settled.time, typeId).toBeLessThan(3);
      const nest = profileNestSpacing(instantiate(typeId).shape);
      items.forEach((bowl, k) => {
        const pose = scene.world.getPose(bowl.id);
        expect(axisFromUpDeg(pose.q), bowl.id).toBeLessThan(0.5);
        expect(Math.abs(pose.p[2] - k * nest), bowl.id).toBeLessThan((0.1 + 0.1 * k) * MM);
      });
    }
  }, 120_000);
});
