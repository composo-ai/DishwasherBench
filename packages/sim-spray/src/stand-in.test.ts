// The stand-in of the secondary-water stage: a droplet shower over a floor against the closed
// form of a parabola, with and without something in the way.
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  buildWashScene,
  createParamSet,
  createRegistry,
  HYDRAULICS_PARAM_DEFS,
  JETS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  secondaryWaterStandIn,
  SHARED_PARAM_DEFS,
  SPRAY_PARAM_DEFS,
  TIER_FAST,
  type SceneItem,
  type SceneMaterial,
  type SprayState,
  type WashScene,
} from './index.ts';

const registry = createRegistry({
  contributions: [
    SHARED_PARAM_DEFS,
    SCENE_PARAM_DEFS,
    HYDRAULICS_PARAM_DEFS,
    JETS_PARAM_DEFS,
    SPRAY_PARAM_DEFS,
  ],
});
const params = createParamSet(registry, { 'spray.standInFlightStep': 0.005 });
const rho = bindSharedClosures(params).water(params.get('jets.solveTemperature')).rho;
const g = params.get('phys.gravity');

const steel: SceneMaterial = {
  id: 'steel',
  wettingClass: 'partially_wetting',
  advancing: [1, 0.8, 0.8],
  receding: [0.4, 0.3, 0.3],
};

function slab(itemId: string, half: number, z: number): SceneItem {
  return {
    itemId,
    typeId: 'slab',
    shape: {
      parts: [
        {
          id: 'body',
          prim: { kind: 'rbox', halfExtents: [half, half, 0.004], radius: 0.001 },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material: 'steel',
        },
      ],
      regions: [{ id: 'top', part: 'body', side: 'in' }],
    },
    pose: { p: [0, 0, z - 0.005], q: [0, 0, 0, 1] },
    soils: [],
  };
}

const height = 0.5;
const cone = (65 * Math.PI) / 180;
const speed = 2.5;
const flow = 1.5e-4;
const state: SprayState = {
  index: 0,
  id: 'r@3000',
  position: 'r',
  pumpRpm: 3000,
  headFactor: 1,
  flow,
  pumpPressure: 0,
  arms: [],
  jets: [],
  showers: [
    {
      level: 'roof',
      origin: [0, 0, height],
      axis: [0, 0, -1],
      coneHalfAngle: cone,
      dropletSpeed: speed,
      flow,
    },
  ],
  masterArm: -1,
  period: 2,
  duration: 60,
  key: 'test',
};

/** Horizontal distance a droplet leaving at `theta` from straight down has covered after falling `drop`. */
function reach(theta: number, drop: number): number {
  const w = speed * Math.cos(theta);
  const t = (-w + Math.sqrt(w * w + 2 * g * drop)) / g;
  return speed * Math.sin(theta) * t;
}

/** Share of the shower that leaves within `theta` of the axis: uniform over the solid angle. */
function shareWithin(theta: number): number {
  return (1 - Math.cos(Math.min(theta, cone))) / (1 - Math.cos(cone));
}

/** Mass rate onto the blocks of one instance within `radius` of the axis, kg/s. */
function rateWithin(
  scene: WashScene,
  out: ReturnType<typeof secondaryWaterStandIn>,
  itemId: string,
  radius: number,
): number {
  const instance = scene.itemInstance.get(itemId);
  let rate = 0;
  for (let i = 0; i < out.arrival.block.length; i++) {
    const b = out.arrival.block[i] as number;
    if (scene.blocks.instance[b] !== instance) continue;
    const r = Math.hypot(
      scene.blocks.centre[3 * b] as number,
      scene.blocks.centre[3 * b + 1] as number,
    );
    if (r <= radius) rate += (out.arrival.flux[i] as number) * (scene.blocks.area[b] as number);
  }
  return rate;
}

describe('stand-in shower over an open floor', () => {
  const scene = buildWashScene({
    items: [slab('floor', 0.6, 0)],
    machine: [],
    blockSize: 8e-3,
    materials: () => steel,
    params,
  });
  const out = secondaryWaterStandIn({
    scene,
    state,
    armLevels: [],
    params,
    tier: TIER_FAST,
    seed: 11,
  });

  it('lands every droplet and conserves the water of the shower', () => {
    // The widest droplet lands 0.52 m from the axis, inside the 0.6 m half-width of the floor.
    expect(reach(cone, height)).toBeLessThan(0.55);
    expect(out.stats.paths).toBe(4096);
    expect(out.stats.landed).toBe(4096);
    expect(out.stats.lostFlow).toBe(0);
    expect(rateWithin(scene, out, 'floor', 1) / (rho * flow)).toBeCloseTo(1, 5);
  });

  it('spreads it as parabolas from a cone that is uniform in solid angle', () => {
    // The water within radius R of the axis left within the angle whose parabola reaches R.
    // Tolerance: three standard deviations of 4,096 samples, plus one block of radius.
    for (const thetaDeg of [15, 30, 45, 60]) {
      const theta = (thetaDeg * Math.PI) / 180;
      const want = shareWithin(theta);
      const got = rateWithin(scene, out, 'floor', reach(theta, height)) / (rho * flow);
      expect(Math.abs(got - want)).toBeLessThan(3 * Math.sqrt((want * (1 - want)) / 4096) + 0.02);
    }
  });

  it('is the same on a repeat and differs with the seed', () => {
    const again = secondaryWaterStandIn({
      scene,
      state,
      armLevels: [],
      params,
      tier: TIER_FAST,
      seed: 11,
    });
    expect(again.arrival.block).toEqual(out.arrival.block);
    expect(again.arrival.flux).toEqual(out.arrival.flux);
    const other = secondaryWaterStandIn({
      scene,
      state,
      armLevels: [],
      params,
      tier: TIER_FAST,
      seed: 12,
    });
    expect(other.arrival.flux).not.toEqual(out.arrival.flux);
  });
});

describe('stand-in shower with a plate in the way', () => {
  const scene = buildWashScene({
    items: [slab('floor', 0.6, 0), slab('umbrella', 0.1, 0.3)],
    machine: [],
    blockSize: 8e-3,
    materials: () => steel,
    params,
  });
  const out = secondaryWaterStandIn({
    scene,
    state,
    armLevels: [],
    params,
    tier: TIER_FAST,
    seed: 11,
  });

  it('keeps the floor dry in the shadow and puts that water on the plate', () => {
    // Droplets that cross the height of the plate within its inscribed circle (0.1 m) land on
    // it. Find the launch angle that just reaches that circle, by bisection.
    let lo = 0;
    let hi = cone;
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi);
      if (reach(mid, height - 0.3) < 0.1) lo = mid;
      else hi = mid;
    }
    const shadow = reach(lo, height);
    expect(shadow).toBeGreaterThan(0.15);
    expect(rateWithin(scene, out, 'floor', 0.9 * shadow)).toBe(0);
    // The square plate catches at least the share of its inscribed circle.
    const caught = rateWithin(scene, out, 'umbrella', 1) / (rho * flow);
    expect(caught).toBeGreaterThan(shareWithin(lo) - 0.03);
    expect(caught).toBeLessThan(shareWithin(lo) * 1.6);
    expect(out.stats.lostFlow).toBe(0);
  });
});
