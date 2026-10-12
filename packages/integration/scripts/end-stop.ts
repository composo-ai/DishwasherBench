/**
 * What one item does when the rack it stands on reaches its end stop (docs/design/platform.md
 * section 5, "Rack travel"): the stand-in rack as a kinematic body is driven 0.4 m, up to the
 * given speed at the platform's acceleration, and stopped either at the platform's end-stop
 * deceleration or dead (within one step). Prints how far the item ends from where it stood on
 * the rack, how far it leans, and the closed form for a block of the same friction,
 * `v^2 (d - mu g) / (2 d mu g)` (dead stop: `v^2 / (2 mu g)`).
 *
 *   pnpm --filter @spotless/integration exec tsx scripts/end-stop.ts mug_ceramic_300 inverted
 */
import { frictionPair, instantiate } from '@spotless/catalogue';
import { STANDARD_GRAVITY, poseCompose, poseRelative } from '@spotless/core';
import { RACK_TRAVEL_PROFILE, rackTravelDistances } from '@spotless/physics';
import {
  RACK_ID,
  BASKET_ID,
  addItem,
  axisFromUpDeg,
  createLoadingScene,
  orientationOf,
  poseOver,
  settleScene,
} from '../src/scene.ts';
import { RACK_MATERIAL } from '../src/stand-in-rack.ts';

const typeId = process.argv[2] ?? 'mug_ceramic_300';
const poseName = process.argv[3] ?? 'inverted';
const speeds = [0.05, 0.15, 0.5];
const instance = instantiate(typeId);
const mu = frictionPair(instance.contact.material, RACK_MATERIAL, false).friction;
console.log(`${typeId}, ${poseName}, friction against the rack ${mu.toFixed(2)}`);

for (const stop of ['end stop of 5 m/s^2', 'dead stop'] as const) {
  for (const speed of speeds) {
    const scene = await createLoadingScene({ rackKind: 'kinematic' });
    const q = orientationOf(instance, poseName);
    const [x, y] = scene.rack.openPoint;
    // Half a millimetre above the grid of the rack, over its open part.
    addItem(
      scene,
      'item',
      typeId,
      poseCompose(scene.rackPose, poseOver(instance.shape, q, x, y, 0.0005)),
    );
    scene.world.step(240);
    settleScene(scene);
    const before = poseRelative(scene.world.getPose(RACK_ID), scene.world.getPose('item'));
    const leanBefore = axisFromUpDeg(scene.world.getPose('item').q);
    const profile = {
      peakSpeed: speed,
      acceleration: RACK_TRAVEL_PROFILE.acceleration,
      endStopDeceleration: stop === 'dead stop' ? 1e6 : RACK_TRAVEL_PROFILE.endStopDeceleration,
    };
    const rack0 = scene.world.getPose(RACK_ID);
    const basket0 = scene.world.getPose(BASKET_ID);
    let furthest = 0;
    for (const s of rackTravelDistances(0.4, profile, scene.world.timeStep)) {
      scene.world.setPose(RACK_ID, { p: [rack0.p[0], rack0.p[1] + s, rack0.p[2]], q: rack0.q });
      scene.world.setPose(BASKET_ID, {
        p: [basket0.p[0], basket0.p[1] + s, basket0.p[2]],
        q: basket0.q,
      });
      scene.world.step(1);
    }
    for (let i = 0; i < 480; i++) {
      scene.world.step(1);
      furthest = Math.max(
        furthest,
        Math.abs(axisFromUpDeg(scene.world.getPose('item').q) - leanBefore),
      );
    }
    const settled = settleScene(scene);
    const after = poseRelative(scene.world.getPose(RACK_ID), scene.world.getPose('item'));
    const slid = after.p[1] - before.p[1];
    const sideways = after.p[0] - before.p[0];
    const lean = axisFromUpDeg(scene.world.getPose('item').q) - leanBefore;
    const g = STANDARD_GRAVITY;
    const d = profile.endStopDeceleration;
    const block = d > mu * g ? (speed ** 2 * (d - mu * g)) / (2 * d * mu * g) : 0;
    console.log(
      `${stop}, from ${speed.toFixed(2)} m/s: slid ${(slid * 1000).toFixed(2)} mm along the travel ` +
        `(${(sideways * 1000).toFixed(2)} mm sideways), leans ${lean.toFixed(2)} degrees more than before ` +
        `(most on the way: ${furthest.toFixed(2)}), ${settled.atRest ? 'at rest' : 'not at rest'}; ` +
        `a block of the same friction: ${(block * 1000).toFixed(2)} mm`,
    );
    scene.world.dispose();
  }
}
