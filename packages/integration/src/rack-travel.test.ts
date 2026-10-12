// Rack travel with catalogue items: the stand-in rack as a kinematic body, driven by the physics
// package's `travelRack` with the platform's push-in profile. What happens at the end stop is a
// sliding-block problem with the catalogue's friction: a load that the tines hold stays, a load
// that only friction holds slides by v^2 (d - mu g) / (2 d mu g).
import { frictionPair } from '@spotless/catalogue';
import { STANDARD_GRAVITY, poseRelative } from '@spotless/core';
import type { RackProfile } from '@spotless/physics';
import { MOVED_DISTANCE, RACK_TRAVEL_PROFILE, travelRack } from '@spotless/physics';
import { afterEach, describe, expect, it } from 'vitest';
import { loadNestedBowls, loadPlates } from './loads.ts';
import { measureOverlap } from './overlap.ts';
import type { LoadingScene, SceneItem } from './scene.ts';
import { BASKET_ID, RACK_ID, axisFromUpDeg, createLoadingScene, settleScene } from './scene.ts';
import { RACK_MATERIAL } from './stand-in-rack.ts';

const MM = 1e-3;
const scenes: LoadingScene[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.world.dispose();
});

/**
 * Twelve plates in the slots and four nested bowls on the open grid of a kinematic rack, settled;
 * then the rack is pushed 0.4 m towards the back with the given profile.
 */
async function push(profile: RackProfile): Promise<{
  scene: LoadingScene;
  plates: SceneItem[];
  bowls: SceneItem[];
  result: ReturnType<typeof travelRack>;
  slid: Map<string, number>;
}> {
  const scene = await createLoadingScene({ rackKind: 'kinematic' });
  scenes.push(scene);
  const plates = loadPlates(scene);
  const bowls = loadNestedBowls(scene, scene.rack.openPoint[0], scene.rack.openPoint[1]).items;
  scene.world.step(480);
  expect(settleScene(scene).atRest).toBe(true);
  const before = new Map(
    scene.items.map((item) => [
      item.id,
      poseRelative(scene.world.getPose(RACK_ID), scene.world.getPose(item.id)),
    ]),
  );
  const result = travelRack(scene.world, {
    racks: [RACK_ID, BASKET_ID],
    travel: [0, 0.4, 0],
    riders: scene.items.map((item) => ({ id: item.id, point: item.instance.referencePoint })),
    envelope: scene.rack.envelope,
    profile,
  });
  // How far each item has moved along the travel, relative to the rack (negative: it lags).
  const slid = new Map<string, number>();
  for (const item of scene.items) {
    const after = poseRelative(scene.world.getPose(RACK_ID), scene.world.getPose(item.id));
    slid.set(item.id, after.p[1] - (before.get(item.id) as { p: readonly number[] }).p[1]!);
  }
  return { scene, plates, bowls, result, slid };
}

describe('rack travel with a catalogue load', () => {
  it('pushed in gently, the rack carries plates and bowls with it and nothing moves on it', async () => {
    // An end stop of 1.2 m/s^2 is well under mu g for every contact in this load (the lowest is
    // glazed porcelain on coated wire, 0.25 x 9.81 = 2.5 m/s^2), and so is the 2 m/s^2 start.
    const gentle = { ...RACK_TRAVEL_PROFILE, endStopDeceleration: 1.2 };
    const { scene, result, slid } = await push(gentle);
    expect(result.blockedBy).toBeUndefined();
    expect(result.fellOut).toEqual([]);
    expect(result.moved).toEqual([]);
    // The rack and its basket are 0.4 m further back, and so is everything on them.
    expect(scene.world.getPose(RACK_ID).p[1]).toBeCloseTo(0.4, 6);
    expect(scene.world.getPose(BASKET_ID).p[1]).toBeCloseTo(0.4, 6);
    for (const item of scene.items) {
      expect(Math.abs(slid.get(item.id) as number), item.id).toBeLessThan(MOVED_DISTANCE);
      expect(scene.world.getPose(item.id).p[1] - item.released.p[1], item.id).toBeGreaterThan(0.39);
    }
    expect(measureOverlap(scene).deepest).toBeLessThan(0.2 * MM);
  });

  it('at the default end stop the bowls slide on as far as their friction on the wires lets them, and the plates stay in their slots', async () => {
    const { scene, plates, bowls, result, slid } = await push(RACK_TRAVEL_PROFILE);
    expect(result.blockedBy).toBeUndefined();
    expect(result.fellOut).toEqual([]);
    // The stack stands on the unglazed foot ring of the bottom bowl. The rack stops from v at a
    // deceleration d that is more than mu g, so the stack slides on: while the rack brakes it
    // gains (d - mu g) v / d on the rack, and then stops against friction alone. In all
    // s = v^2 (d - mu g) / (2 d mu g): 5.3 mm for mu = 0.42.
    const mu = frictionPair('porcelain_unglazed', RACK_MATERIAL, false).friction;
    const { peakSpeed: v, endStopDeceleration: d, acceleration } = RACK_TRAVEL_PROFILE;
    const muG = mu * STANDARD_GRAVITY;
    expect(d).toBeGreaterThan(muG);
    // (Starting off it does not slip: the rack accelerates at less than mu g.)
    expect(acceleration).toBeLessThan(muG);
    const expected = (v * v * (d - muG)) / (2 * d * muG);
    expect(expected).toBeGreaterThan(4 * MM);
    for (const bowl of bowls) {
      const moved = slid.get(bowl.id) as number;
      // Forwards, in the direction of travel, by the closed form to 10 %; still nested and level.
      expect(
        Math.abs(moved / expected - 1),
        `${bowl.id} slid ${(moved * 1000).toFixed(2)} mm`,
      ).toBeLessThan(0.1);
      expect(axisFromUpDeg(scene.world.getPose(bowl.id).q), bowl.id).toBeLessThan(0.5);
    }
    expect(result.moved.map((m) => m.id)).toEqual(bowls.map((bowl) => bowl.id));
    // The plates lean against the tines behind them, in the direction of travel: the end stop
    // presses them on. The start (2 m/s^2, more than g tan of their 8.5 degree lean) rocks them
    // forward off those tines and they drop back; they end where they were to half a
    // millimetre (measured: 0.3 mm), which the platform does not count as moved.
    for (const plate of plates) {
      expect(Math.abs(slid.get(plate.id) as number), plate.id).toBeLessThan(0.5 * MM);
      expect(Math.abs(slid.get(plate.id) as number), plate.id).toBeLessThan(MOVED_DISTANCE);
    }
    expect(measureOverlap(scene).deepest).toBeLessThan(0.2 * MM);
  });
});
