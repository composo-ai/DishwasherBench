// The STAND-IN of the surface-water stage and the exposure set: water run downhill over a
// tilted slab and dripped on to a level one, a cup that pools, and the round trip of the cache
// encoding.
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  BLOCK_FLAG,
  buildWashScene,
  computeExposureSet,
  createParamSet,
  createRegistry,
  decodeExposureSet,
  encodeExposureSet,
  EXPOSURE_SET_SCHEMA,
  exposureSetHash,
  FILM_PARAM_DEFS,
  HYDRAULICS_PARAM_DEFS,
  JET_FIELD_COUNT,
  JETS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  SPRAY_PARAM_DEFS,
  STAND_IN_EXPOSURE_STAGES,
  surfaceWaterStandIn,
  TIER_FAST,
  WATER_FIELD,
  WATER_FIELD_COUNT,
  type ExposureStageInput,
  type SceneItem,
  type SceneMaterial,
  type SprayState,
  type WashScene,
  type WaterArrival,
} from './index.ts';

const registry = createRegistry({
  contributions: [
    SHARED_PARAM_DEFS,
    SCENE_PARAM_DEFS,
    HYDRAULICS_PARAM_DEFS,
    JETS_PARAM_DEFS,
    SPRAY_PARAM_DEFS,
    FILM_PARAM_DEFS,
  ],
});
const params = createParamSet(registry);
const rho = bindSharedClosures(params).water(params.get('jets.solveTemperature')).rho;
const g = params.get('phys.gravity');

const glaze: SceneMaterial = {
  id: 'glaze',
  wettingClass: 'continuous_film',
  advancing: [0.4, 0.2, 0.2],
  receding: [0.1, 0.05, 0.05],
};

const idle: SprayState = {
  index: 0,
  id: 'none@0',
  position: 'none',
  pumpRpm: 0,
  headFactor: 1,
  flow: 0,
  pumpPressure: 0,
  arms: [],
  jets: [],
  showers: [],
  masterArm: -1,
  period: 2,
  duration: 0,
  key: 'idle',
};

function stageInput(scene: WashScene, state: SprayState = idle): ExposureStageInput {
  return { scene, state, armLevels: [], params, tier: TIER_FAST, seed: 3 };
}

function slab(itemId: string, half: [number, number], pose: SceneItem['pose']): SceneItem {
  return {
    itemId,
    typeId: 'slab',
    shape: {
      parts: [
        {
          id: 'body',
          prim: { kind: 'rbox', halfExtents: [half[0], half[1], 0.003], radius: 0.001 },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material: 'glaze',
        },
      ],
      regions: [
        { id: 'top', part: 'body', side: 'in' },
        { id: 'underside', part: 'body', side: 'out' },
      ],
    },
    pose,
    soils: [],
  };
}

/** The block of an instance whose centre is nearest a point. */
function nearestBlock(scene: WashScene, itemId: string, p: [number, number, number]): number {
  const instance = scene.instances[scene.itemInstance.get(itemId) ?? -1];
  if (instance === undefined) throw new Error(`no ${itemId}`);
  let best = -1;
  let bestD = Infinity;
  for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
    const d = Math.hypot(
      (scene.blocks.centre[3 * b] as number) - p[0],
      (scene.blocks.centre[3 * b + 1] as number) - p[1],
      (scene.blocks.centre[3 * b + 2] as number) - p[2],
    );
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function oneBlock(scene: WashScene, block: number, flux: number): WaterArrival {
  return {
    blockCount: scene.blocks.count,
    block: Uint32Array.of(block),
    flux: Float32Array.of(flux),
  };
}

describe('stand-in surface water: a tilted slab over a level one', () => {
  // The upper slab is turned 30 degrees about x, so its top face slopes down towards -y and
  // its rows are level. The lower slab lies flat underneath its lower edge.
  const tilt = Math.PI / 6;
  const scene = buildWashScene({
    items: [
      slab('a_tilted', [0.05, 0.05], {
        p: [0, 0, 0.2],
        q: [Math.sin(tilt / 2), 0, 0, Math.cos(tilt / 2)],
      }),
      slab('b_level', [0.08, 0.08], { p: [0, -0.04, 0.1], q: [0, 0, 0, 1] }),
    ],
    machine: [],
    blockSize: 2e-3,
    materials: () => glaze,
    params,
  });
  // A point on the top face of the tilted slab, 30 mm up the slope from its centre.
  const up: [number, number, number] = [
    0.011,
    0.03 * Math.cos(tilt) - 0.004 * Math.sin(tilt),
    0.2 + 0.03 * Math.sin(tilt) + 0.004 * Math.cos(tilt),
  ];
  const seed = nearestBlock(scene, 'a_tilted', up);
  const out = surfaceWaterStandIn(stageInput(scene), oneBlock(scene, seed, 0.5));
  const wet = (b: number): number =>
    out.water.values[WATER_FIELD_COUNT * b + WATER_FIELD.wetFraction] as number;
  const a = scene.instances[scene.itemInstance.get('a_tilted') ?? -1];
  const lower = scene.instances[scene.itemInstance.get('b_level') ?? -1];
  if (a === undefined || lower === undefined) throw new Error('missing instance');
  const seedX = scene.blocks.centre[3 * seed] as number;
  const seedZ = scene.blocks.centre[3 * seed + 2] as number;
  const isTop = (b: number): boolean => (scene.blocks.normal[3 * b + 2] as number) > 0.5;

  it('runs straight down the slope from where the water lands, and nowhere uphill', () => {
    expect(isTop(seed)).toBe(true);
    let strip = 0;
    for (let b = a.firstBlock; b < a.firstBlock + a.blockCount; b++) {
      const x = scene.blocks.centre[3 * b] as number;
      const z = scene.blocks.centre[3 * b + 2] as number;
      if (wet(b) > 0) expect(z).toBeLessThanOrEqual(seedZ + 1e-9);
      if (!isTop(b)) continue;
      const sameColumn = Math.abs(x - seedX) < 0.5e-3;
      if (sameColumn && z <= seedZ) {
        expect(wet(b)).toBe(1);
        strip++;
      } else {
        // Rows are level, so the water does not spread sideways on the face.
        expect(wet(b)).toBe(0);
      }
    }
    // 30 mm up the slope from the centre of a 100 mm face: 80 mm of 2 mm blocks below it.
    expect(strip).toBeGreaterThanOrEqual(38);
    expect(strip).toBeLessThanOrEqual(42);
  });

  it('drips from the lower edge on to the slab below and floods its level top', () => {
    const dripSites = [];
    for (let b = a.firstBlock; b < a.firstBlock + a.blockCount; b++) {
      if (wet(b) > 0 && ((scene.blocks.flags[b] as number) & BLOCK_FLAG.dripSite) !== 0)
        dripSites.push(b);
    }
    expect(dripSites.length).toBeGreaterThan(0);
    let top = 0;
    let wetTop = 0;
    for (let b = lower.firstBlock; b < lower.firstBlock + lower.blockCount; b++) {
      if (!isTop(b)) continue;
      top++;
      if (wet(b) > 0) wetTop++;
    }
    expect(top).toBeGreaterThan(5000);
    // All of it but the four corner blocks, which only border blocks of the edge rows (those
    // have a lower neighbour over the edge and pass water down, not sideways).
    expect(wetTop).toBeGreaterThanOrEqual(top - 4);
  });

  it('writes the nominal film of the stand-in on every wet block', () => {
    const h = params.get('film.standInThickness');
    const o = WATER_FIELD_COUNT * seed;
    // Wall shear of a film of thickness h on a 30 degree slope: rho g sin(30) h = 0.48 Pa.
    expect(out.water.values[o + WATER_FIELD.shear]).toBeCloseTo(rho * g * Math.sin(tilt) * h, 3);
    expect(out.water.values[o + WATER_FIELD.thickness]).toBeCloseTo(h, 9);
    expect(out.water.values[o + WATER_FIELD.retained]).toBeCloseTo(
      rho * params.get('film.standInResidual'),
      6,
    );
    expect(out.water.values[o + WATER_FIELD.holdTime]).toBe(params.get('film.standInHoldTime'));
    // The mean flux is the arriving water over the wet area; the renewal follows from it.
    const rate = 0.5 * (scene.blocks.area[seed] as number);
    expect(out.stats.arrivalRate).toBeCloseTo(rate, 9);
    const flux = out.water.values[o + WATER_FIELD.flux] as number;
    expect(flux * out.stats.wetArea).toBeCloseTo(rate, 9);
    expect(out.water.values[o + WATER_FIELD.renewal]).toBeCloseTo(flux / (rho * h), 6);
    // A level face carries no gravity shear.
    const flat = nearestBlock(scene, 'b_level', [0, -0.04, 0.104]);
    expect(wet(flat)).toBe(1);
    expect(out.water.values[WATER_FIELD_COUNT * flat + WATER_FIELD.shear]).toBeCloseTo(0, 6);
    // Dry blocks are all zero.
    let dry = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      if (wet(b) > 0) continue;
      dry++;
      for (let f = 0; f < WATER_FIELD_COUNT; f++)
        expect(out.water.values[WATER_FIELD_COUNT * b + f]).toBe(0);
    }
    expect(dry + out.stats.wetBlocks).toBe(scene.blocks.count);
  });
});

describe('stand-in surface water: a cup', () => {
  const cup = (itemId: string, pose: SceneItem['pose']): SceneItem => ({
    itemId,
    typeId: 'cup',
    shape: {
      parts: [
        {
          id: 'body',
          prim: {
            kind: 'sor',
            profile: [
              { r: 0, z: 0.002, t: 0.004 },
              { r: 0.03, z: 0.002, t: 0.004 },
              { r: 0.035, z: 0.07, t: 0.003 },
            ],
          },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material: 'glaze',
        },
      ],
      regions: [
        { id: 'interior', part: 'body', side: 'in' },
        { id: 'exterior', part: 'body', side: 'out' },
      ],
    },
    pose,
    soils: [],
  });
  const scene = buildWashScene({
    items: [
      cup('a_upright', { p: [0, 0, 0], q: [0, 0, 0, 1] }),
      cup('b_inverted', { p: [0.2, 0, 0.08], q: [1, 0, 0, 0] }),
    ],
    machine: [],
    blockSize: 2e-3,
    materials: () => glaze,
    params,
  });

  it('pools water in the upright cup and none in the inverted one', () => {
    const upright = scene.itemInstance.get('a_upright');
    const basin = scene.basins.findIndex((b) => b.instance === upright && b.volume > 50e-6);
    expect(basin).toBeGreaterThanOrEqual(0);
    // Water lands on the inside wall of the upright cup and on the base of the inverted one.
    const inside = nearestBlock(scene, 'a_upright', [0.031, 0, 0.05]);
    const base = nearestBlock(scene, 'b_inverted', [0.2, 0, 0.081]);
    const arrival: WaterArrival = {
      blockCount: scene.blocks.count,
      block: Uint32Array.of(...[inside, base].sort((p, q) => p - q)),
      flux: Float32Array.of(0.2, 0.2),
    };
    const out = surfaceWaterStandIn(stageInput(scene), arrival);
    expect(out.poolInflow).toHaveLength(scene.basins.length);
    expect(out.poolInflow[basin]).toBeGreaterThan(0);
    const filled = scene.basins[basin];
    if (filled === undefined) throw new Error('no basin');
    // Every block of the basin carries its depth under the full pool; the deepest is the floor.
    let deepest = 0;
    filled.blocks.forEach((b, i) => {
      const depth = out.water.values[WATER_FIELD_COUNT * b + WATER_FIELD.poolDepth] as number;
      expect(depth).toBeCloseTo(filled.depth[i] as number, 6);
      deepest = Math.max(deepest, depth);
    });
    expect(deepest).toBeCloseTo(filled.spillLevel - filled.floorLevel, 2);
    // The inverted cup holds water at most in the recess of its base, never in its bowl.
    scene.basins.forEach((other, index) => {
      if (other.instance !== scene.itemInstance.get('b_inverted')) return;
      expect(other.volume).toBeLessThan(10e-6);
      expect(out.poolInflow[index]).toBeGreaterThanOrEqual(0);
    });
    // Its inside faces, which no water reaches, carry no pool depth and stay dry.
    const hidden = nearestBlock(scene, 'b_inverted', [0.2 + 0.031, 0, 0.04]);
    expect(out.water.values[WATER_FIELD_COUNT * hidden + WATER_FIELD.wetFraction]).toBe(0);
    expect(out.water.values[WATER_FIELD_COUNT * hidden + WATER_FIELD.poolDepth]).toBe(0);
  });
});

describe('exposure set', () => {
  const scene = buildWashScene({
    items: [
      {
        ...slab('a_plate', [0.1, 0.1], { p: [0, 0, 0.2], q: [0, 0, 0, 1] }),
        soils: [
          {
            type: 'any',
            regions: [{ region: 'underside', coverage: 1 }],
            amount_g: 1,
            age_h: 1,
            heat_history: 'none',
          },
        ],
      },
    ],
    machine: [],
    blockSize: 4e-3,
    materials: () => glaze,
    params,
  });
  const speed = 6;
  const diameter = 3e-3;
  const flow = (Math.PI * diameter * diameter * speed) / 4;
  const state: SprayState = {
    index: 0,
    id: 'l@3000',
    position: 'l',
    pumpRpm: 3000,
    headFactor: 1,
    flow: 2 * flow,
    pumpPressure: 2e4,
    arms: [
      {
        level: 'lower',
        axis: [0, 0],
        senseSign: -1,
        omega: 4,
        period: Math.PI / 2,
        stalled: false,
        stallAngle: 0,
        armPressure: 2e4,
      },
    ],
    jets: [
      {
        level: 'lower',
        nozzle: 'n1',
        subJet: 0,
        subJets: 1,
        arm: 0,
        origin: [0.05, 0, 0.05],
        direction: [0, 0, 1],
        flow,
        speed,
        diameter,
      },
    ],
    showers: [
      {
        level: 'roof',
        origin: [0, 0, 0.5],
        axis: [0, 0, -1],
        coneHalfAngle: 0.2,
        dropletSpeed: 2.5,
        flow,
      },
    ],
    masterArm: 0,
    period: Math.PI / 2,
    duration: 100,
    key: 'sha256:test',
  };

  it('runs jets, secondary water and surface water in order', async () => {
    const set = await computeExposureSet(stageInput(scene, state), STAND_IN_EXPOSURE_STAGES);
    expect(set.schema).toBe(EXPOSURE_SET_SCHEMA);
    expect(set.stateId).toBe('l@3000');
    expect(set.stateKey).toBe('sha256:test');
    expect(set.standIn).toBe(true);
    expect(set.stats.jetRays).toBe(params.get('jets.standInPhases'));
    expect(set.stats.jetHits).toBe(set.stats.jetRays);
    expect(set.jets.cell.length).toBe(set.stats.jetCells);
    expect(set.jets.cell.length).toBeGreaterThan(0);
    expect(set.stats.secondaryLanded).toBe(params.get('spray.standInShowerRays'));
    // The jet's water and the shower's both arrive: together twice the flow of one.
    expect(set.stats.arrivalRate / (rho * 2 * flow)).toBeCloseTo(1, 4);
    // Wet from below (the jet) and from above (the shower).
    const under = nearestBlock(scene, 'a_plate', [0.05, 0, 0.196]);
    const over = nearestBlock(scene, 'a_plate', [0, 0, 0.204]);
    expect(set.water.values[WATER_FIELD_COUNT * under + WATER_FIELD.wetFraction]).toBe(1);
    expect(set.water.values[WATER_FIELD_COUNT * over + WATER_FIELD.wetFraction]).toBe(1);
  });

  it('survives the cache encoding bit for bit and hashes the same on a repeat', async () => {
    const set = await computeExposureSet(stageInput(scene, state));
    const bytes = encodeExposureSet(set);
    const back = decodeExposureSet(bytes);
    expect(back.jets.cell).toEqual(set.jets.cell);
    expect(back.jets.values).toEqual(set.jets.values);
    expect(back.jets.values.length).toBe(JET_FIELD_COUNT * back.jets.cell.length);
    expect(back.water.values).toEqual(set.water.values);
    expect(back.poolInflow).toEqual(set.poolInflow);
    expect(back.stats).toEqual(set.stats);
    expect(back.stateKey).toBe(set.stateKey);
    expect(encodeExposureSet(back)).toEqual(bytes);
    const again = await computeExposureSet(stageInput(scene, state));
    expect(exposureSetHash(again)).toBe(exposureSetHash(set));
    expect(exposureSetHash(set)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('rejects bytes that are not an exposure set', () => {
    expect(() => decodeExposureSet(new Uint8Array(16))).toThrow(RangeError);
    expect(() => decodeExposureSet(new Uint8Array(3))).toThrow(RangeError);
  });
});
