// A catalogue glass lying on its side on the stand-in rack: on a level rack it stays where it is
// put, on a rack tilted by three degrees it rolls downhill at the rate of a rolling cylinder
// with the catalogue's rolling resistance, until the frame stops it.
import { contactPairLookup, instantiate } from '@spotless/catalogue';
import type { Pose } from '@spotless/core';
import { STANDARD_GRAVITY, poseCompose, poseRelative, quatFromAxisAngle } from '@spotless/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { LoadingScene, SceneItem } from './scene.ts';
import { addItem, createLoadingScene, orientationOf, poseOver, settleScene } from './scene.ts';
import { RACK_MATERIAL } from './stand-in-rack.ts';

const MM = 1e-3;
const DEG = Math.PI / 180;
/** The glass: a nearly straight-sided highball, 65 mm across and 150 mm tall, 270 g. */
const GLASS = 'highball_350';

const scenes: LoadingScene[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.world.dispose();
});

/**
 * The glass laid on its side on the open part of the base grid of a rack tilted by `tilt`
 * radians about its x axis (the back of the rack rises), its axis along x, so that it lies
 * across the front-to-back grid wires and can roll along them towards the front.
 */
async function glassOnRack(tilt: number): Promise<{
  scene: LoadingScene;
  glass: SceneItem;
  rackPose: Pose;
}> {
  const rackPose: Pose = { p: [0, 0, 0], q: quatFromAxisAngle([1, 0, 0], tilt) };
  const scene = await createLoadingScene({ basket: false, rackPose });
  scenes.push(scene);
  const instance = instantiate(GLASS);
  const q = orientationOf(instance, 'on_side', Math.PI / 2);
  const x = (scene.rack.openZone.min[0] + scene.rack.openZone.max[0]) / 2;
  const local = poseOver(instance.shape, q, x, 0.25, 0.0005);
  const glass = addItem(scene, 'glass', GLASS, poseCompose(rackPose, local));
  return { scene, glass, rackPose };
}

describe('a glass on its side on the rack', () => {
  it('stays put on a level rack', async () => {
    const { scene, glass, rackPose } = await glassOnRack(0);
    const start = poseRelative(rackPose, scene.world.getPose(glass.id));
    const settled = settleScene(scene);
    expect(settled.atRest).toBe(true);
    scene.world.step(480);
    const end = poseRelative(rackPose, scene.world.getPose(glass.id));
    // It drops its release gap onto the wires and does not roll: under 0.1 mm along them.
    expect(Math.abs(end.p[1] - start.p[1])).toBeLessThan(0.1 * MM);
    expect(Math.abs(end.p[0] - start.p[0])).toBeLessThan(0.1 * MM);
    expect(scene.world.stats().activeBodies).toBe(0);
  });

  it('rolls down a rack tilted by three degrees at the rate of a rolling cylinder, and the frame stops it', async () => {
    const tilt = 3 * DEG;
    const { scene, glass, rackPose } = await glassOnRack(tilt);
    const { mass } = glass.instance;
    // Rolling without slipping on its side wall (radius r) with rolling resistance length c:
    // a = g (sin(tilt) - (c / r) cos(tilt)) / (1 + I / (m r^2)), I about the axis of the glass.
    // The side wall widens a little towards the rim (outer radius 31.1 mm at the heel, 32.5 mm
    // at the rim): r is its radius where the centre of mass is, 31.6 mm.
    const heel = { z: 0.012, r: 0.0295 + 0.00317 / 2 };
    const rim = { z: 0.14873, r: 0.03123 + 0.00254 / 2 };
    const r = heel.r + ((mass.com[2] - heel.z) / (rim.z - heel.z)) * (rim.r - heel.r);
    expect(r).toBeGreaterThan(0.0313);
    expect(r).toBeLessThan(0.0321);
    const axial = mass.inertia[8];
    const c = contactPairLookup(false)('glass_soda_lime', RACK_MATERIAL)
      .rollingResistance as number;
    expect(c).toBeGreaterThan(0);
    const a =
      (STANDARD_GRAVITY * (Math.sin(tilt) - (c / r) * Math.cos(tilt))) /
      (1 + axial / (mass.mass * r * r));
    expect(a).toBeGreaterThan(0.2);
    expect(a).toBeLessThan(0.3);

    const start = poseRelative(rackPose, scene.world.getPose(glass.id));
    scene.world.step(240);
    const after = poseRelative(rackPose, scene.world.getPose(glass.id));
    const rolled = start.p[1] - after.p[1];
    // After one second: a / 2, less the few milliseconds it takes to fall its release gap.
    expect(Math.abs(rolled / (a / 2) - 1), `rolled ${(rolled * 1000).toFixed(1)} mm`).toBeLessThan(
      0.05,
    );
    // It rolls, it does not slide: the rim speed equals the speed of the axis to 2 %.
    const v = scene.world.getVelocity(glass.id);
    expect(Math.abs((Math.hypot(...v.angular) * r) / Math.hypot(...v.linear) - 1)).toBeLessThan(
      0.02,
    );

    // It runs into the front of the frame and comes to rest there, still on the rack.
    expect(settleScene(scene).atRest).toBe(true);
    const end = poseRelative(rackPose, scene.world.getPose(glass.id));
    expect(start.p[1] - end.p[1]).toBeGreaterThan(0.15);
    expect(end.p[1]).toBeGreaterThan(0);
    expect(Math.abs(end.p[2] - after.p[2])).toBeLessThan(2 * MM);
  });
});
