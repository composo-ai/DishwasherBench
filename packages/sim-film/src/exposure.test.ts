// The three real stages together on hand-built scenes: the water balance from nozzle to sump in
// whole units, a plate hidden behind another (wetted if and only if water has a path to it),
// the sensitivity to the number of droplets, and the two tracers against each other.
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  buildWashScene,
  createParamSet,
  createRegistry,
  HYDRAULICS_PARAM_DEFS,
  JET_FIELD,
  JET_FIELD_COUNT,
  JETS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  SPRAY_PARAM_DEFS,
  TIER_FAST,
  WATER_UNIT,
  type ExposureStageInput,
  type GpuContext,
  type ParamSet,
  type SprayState,
  type WashScene,
} from './index.ts';
import {
  computeExposureSet,
  decodeExposureSet,
  encodeExposureSet,
  EXPOSURE_SET_SCHEMA,
  EXPOSURE_STAGES,
  FILM_PARAM_DEFS,
  WATER_FIELD,
  WATER_FIELD_COUNT,
  type ExposureSet,
} from './index.ts';
import { createNodeGpuContext } from '../../sim-gpu/src/node/index.ts';
import {
  cup,
  fixtureMaterial,
  jetState,
  slab,
  SLAB_HALF_THICKNESS,
  wire,
} from '../../sim-jets/src/testing/fixtures.ts';

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
// Heavy parcels (about 17,000 for the busy scene below), so that the f64 reference tracer
// answers in a moment.
const params = createParamSet(registry, {
  'spray.parcelMass': [5e-6, 5e-6],
  'spray.showerParcelFactor': 1,
});
const rho = bindSharedClosures(params).water(50).rho;

function input(
  scene: WashScene,
  state: SprayState,
  set: ParamSet = params,
  gpu: GpuContext | null = null,
): ExposureStageInput {
  return { scene, state, armLevels: [], params: set, tier: TIER_FAST, seed: 9, gpu };
}

/** Time-mean wetted area of an item, m2, and whether any of its soil cells is in the jet table. */
function wetOf(scene: WashScene, set: ExposureSet, itemId: string): { area: number; jets: number } {
  const instance = scene.instances[scene.itemInstance.get(itemId) ?? -1];
  if (instance === undefined) throw new Error(`no item ${itemId}`);
  let area = 0;
  for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
    area +=
      (set.water.values[WATER_FIELD_COUNT * b + WATER_FIELD.wetFraction] as number) *
      (scene.blocks.area[b] as number);
  }
  let jets = 0;
  for (const cell of set.jets.cell) {
    if (scene.blocks.instance[scene.soilCells.block[cell] as number] === instance.index) jets++;
  }
  return { area, jets };
}

const tilt = (angle: number): [number, number, number, number] => [
  0,
  Math.sin(angle / 2),
  0,
  Math.cos(angle / 2),
];

// A jet turning at 50 mm about the z axis under a slab, a rack wire in its way for part of the
// revolution, a sprinkler above, and a cup beside the slab.
const shower = {
  level: 'roof',
  origin: [0.02, 0, 0.5] as [number, number, number],
  axis: [0, 0, -1] as [number, number, number],
  coneHalfAngle: 0.6,
  dropletSpeed: 2.5,
  flow: 5e-5,
};
const busy = jetState({
  origin: [0.05, 0, 0.05],
  direction: [0, 0, 1],
  speed: 6.65,
  diameter: 3e-3,
  omega: 4.4,
  showers: [shower],
});
const busyScene = buildWashScene({
  items: [
    slab('plate', 0.1, 0.1, { p: [0, 0, 0.2], q: tilt(0.4) }),
    cup('cup', 0.035, 0.08, { p: [0.19, 0, 0.1], q: [0, 0, 0, 1] }),
  ],
  machine: [wire('rack', [0.03, -0.15, 0.12], [0.03, 0.15, 0.12], 2e-3)],
  blockSize: 4e-3,
  materials: fixtureMaterial,
  params,
});

describe('the water of a spray state, from the nozzles to the sump', () => {
  let set: ExposureSet;

  it('is conserved exactly, in whole units, through jets, droplets and film', async () => {
    set = await computeExposureSet(input(busyScene, busy));
    expect(set.schema).toBe(EXPOSURE_SET_SCHEMA);
    expect(set.standIn).toBe(false);
    expect(set.stats.backend).toBe('cpu');
    const water = set.stats.water;
    const film = set.stats.film;
    if (water === undefined || film === undefined) throw new Error('no water balance');
    expect(water.unit).toBe(WATER_UNIT);
    for (const units of [
      water.nozzle,
      water.jets,
      water.showers,
      water.jetLost,
      water.handover,
      water.splatter,
      water.scatter,
      water.dropletsLanded,
      water.dropletsLost,
      water.filmFed,
      film.fed,
      film.primed,
      film.toSump,
      film.stored,
    ]) {
      expect(Number.isInteger(units)).toBe(true);
    }
    // Out of the nozzles: the jet and the sprinkler, as their flows over one revolution.
    expect(water.jets).toBe(
      Math.round((rho * (busy.jets[0]?.flow ?? 0) * busy.period) / WATER_UNIT),
    );
    expect(water.showers).toBe(Math.round((rho * shower.flow * busy.period) / WATER_UNIT));
    expect(water.nozzle).toBe(water.jets + water.showers);
    // The jet stage.
    expect(water.jets).toBe(water.jetLost + water.handover + water.splatter + water.scatter);
    // The droplets.
    expect(water.splatter + water.scatter + water.showers).toBe(
      water.dropletsLanded + water.dropletsLost,
    );
    // The film: what it is fed per revolution, and its whole march.
    expect(water.filmFed).toBe(water.handover + water.dropletsLanded);
    expect(film.fed + film.primed).toBe(film.toSump + film.stored);
    expect(water.closes).toBe(true);
    // Every unit out of a nozzle is lost in flight, or reaches the film.
    expect(water.nozzle).toBe(water.jetLost + water.dropletsLost + water.filmFed);
  });

  it('uses every mechanism of the scene', () => {
    const water = set.stats.water;
    if (water === undefined) throw new Error('no water balance');
    // The wire scatters part of the jet, the plate splatters part of the rest.
    expect(water.scatter).toBeGreaterThan(0);
    expect(water.splatter).toBeGreaterThan(0);
    expect(water.handover).toBeGreaterThan(water.splatter);
    expect(set.stats.jetHits).toBe(set.stats.jetRays);
    // Every droplet source is flown as its own mass over the mass of a parcel.
    expect(set.stats.secondaryPaths).toBeGreaterThan(12000);
    expect(set.stats.secondaryPaths).toBeLessThan(24000);
    const settled = set.stats.secondarySettled;
    expect(settled).toBeDefined();
    expect((settled?.pooledOpen ?? 0) + (settled?.pooledFaced ?? 0)).toBeGreaterThan(0.3);
    expect(set.stats.jetCells).toBeGreaterThan(1000);
  });

  it('reports the return to the sump, the water held and the wetted share', () => {
    const water = set.stats.water;
    const film = set.stats.film;
    if (water === undefined || film === undefined) throw new Error('no water balance');
    // In the periodic state what goes out comes back within a revolution.
    expect(film.converged).toBe(true);
    expect(Math.abs(film.storedChange)).toBeLessThan(0.02);
    expect(water.sumpReturnFraction).toBeGreaterThan(0.95);
    expect(water.sumpReturnFraction).toBeLessThan(1.03);
    // The cup stands in the sprinkler's cone: it takes in water and is counted as holding its fill.
    const basin = busyScene.basins[0];
    if (basin === undefined) throw new Error('no basin');
    expect(set.poolInflow[0]).toBeGreaterThan(0);
    expect(film.heldInBasins).toBeCloseTo(rho * basin.volume, 9);
    // Grams of film on the two items, and most of their surface wet at any moment.
    expect(film.heldOnItems).toBeGreaterThan(1e-4);
    expect(film.heldOnItems).toBeLessThan(0.1);
    expect(film.itemWetFraction).toBeGreaterThan(0.3);
    expect(film.itemWetFraction).toBeLessThanOrEqual(1);
    expect(film.retainedOnItems).toBeLessThan(film.heldOnItems);
    // The force of the jet on the plate it strikes is reported for the screening.
    const load = set.stats.itemLoads?.find((l) => l.itemId === 'plate');
    expect(load?.peakUp).toBeGreaterThan(0.1);
  });

  it('survives the cache encoding with its statistics and is the same on a repeat', async () => {
    const back = decodeExposureSet(encodeExposureSet(set));
    expect(back.stats).toEqual(set.stats);
    expect(back.jets.values).toEqual(set.jets.values);
    expect(back.jets.values.length).toBe(JET_FIELD_COUNT * back.jets.cell.length);
    expect(back.water.values).toEqual(set.water.values);
    const again = await computeExposureSet(input(busyScene, busy), EXPOSURE_STAGES);
    expect(encodeExposureSet(again)).toEqual(encodeExposureSet(set));
  });

  it('changes its wetted area by less than 5 % when the number of droplets is halved', async () => {
    // About 70,000 parcels against about 35,000. Where only a few droplets land (the walls of
    // the cup, wetted by splash alone) single items move more: within 15 %.
    const many = await computeExposureSet(
      input(busyScene, busy, params.with({ 'spray.parcelMass': [1.25e-6, 1.25e-6] })),
    );
    const half = await computeExposureSet(
      input(busyScene, busy, params.with({ 'spray.parcelMass': [2.5e-6, 2.5e-6] })),
    );
    let full = 0;
    let fewer = 0;
    for (const id of ['plate', 'cup']) {
      const a = wetOf(busyScene, many, id).area;
      const b = wetOf(busyScene, half, id).area;
      expect(Math.abs(b / a - 1), id).toBeLessThan(0.15);
      full += a;
      fewer += b;
    }
    expect(Math.abs(fewer / full - 1)).toBeLessThan(0.05);
    expect(Math.abs(half.stats.wetArea / many.stats.wetArea - 1)).toBeLessThan(0.05);
  });
});

describe('a plate hidden behind another', () => {
  // A jet turning at 50 mm strikes the underside of a slab that slopes down towards +x. A
  // second slab is hidden from the jet either above the first, where no water can reach it,
  // or beyond and below its low edge, under its run-off and the spray thrown off its underside.
  const state = jetState({
    origin: [0.05, 0, 0.05],
    direction: [0, 0, 1],
    speed: 8,
    diameter: 2e-3,
    omega: 4,
  });
  const front = slab('front', 0.1, 0.1, { p: [0, 0, 0.2], q: tilt(0.5) });
  const sceneOf = (hidden: [number, number, number]): WashScene =>
    buildWashScene({
      items: [front, slab('hidden', 0.06, 0.06, { p: hidden, q: tilt(0.5) })],
      machine: [],
      blockSize: 4e-3,
      materials: fixtureMaterial,
      params,
    });

  it('stays dry where no path leads to it', async () => {
    const scene = sceneOf([0, 0, 0.27]);
    const set = await computeExposureSet(input(scene, state));
    expect(wetOf(scene, set, 'front').jets).toBeGreaterThan(1000);
    expect(wetOf(scene, set, 'front').area).toBeGreaterThan(0.01);
    const hidden = wetOf(scene, set, 'hidden');
    expect(hidden.jets).toBe(0);
    expect(hidden.area).toBe(0);
  });

  it('is wetted by droplets and run-off where a path exists, without any direct jet', async () => {
    // Its high edge lies under the low edge of the front slab, 0.1 m beyond the jet's track.
    const lowEdge = 0.1 * Math.cos(0.5) - SLAB_HALF_THICKNESS * Math.sin(0.5);
    const scene = sceneOf([lowEdge + 0.04, 0, 0.09]);
    const set = await computeExposureSet(input(scene, state));
    const hidden = wetOf(scene, set, 'hidden');
    expect(hidden.jets).toBe(0);
    expect(hidden.area).toBeGreaterThan(2e-4);
    // No soil cell of it has any jet duty, yet its blocks carry a flux.
    const instance = scene.instances[scene.itemInstance.get('hidden') ?? -1];
    if (instance === undefined) throw new Error('no instance');
    let flux = 0;
    for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
      flux += set.water.values[WATER_FIELD_COUNT * b + WATER_FIELD.flux] as number;
    }
    expect(flux).toBeGreaterThan(0);
    for (let i = 0; i < set.jets.cell.length; i++) {
      expect(set.jets.values[JET_FIELD_COUNT * i + JET_FIELD.duty]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the two tracers', () => {
  it('give the same exposure but for rare grazing rays', async () => {
    let gpu: GpuContext;
    try {
      gpu = await createNodeGpuContext({ sim: 'exposure test' });
    } catch {
      console.warn('sim-film: no WebGPU adapter; the GPU comparison is SKIPPED');
      return;
    }
    try {
      const onCpu = await computeExposureSet(input(busyScene, busy));
      const onGpu = await computeExposureSet(input(busyScene, busy, params, gpu));
      expect(onGpu.stats.backend).toBe('gpu');
      expect(onGpu.stats.water?.nozzle).toBe(onCpu.stats.water?.nozzle);
      expect(onGpu.stats.water?.closes).toBe(true);
      expect(onGpu.stats.jetRays).toBe(onCpu.stats.jetRays);
      expect(onGpu.stats.jetCells / onCpu.stats.jetCells).toBeGreaterThan(0.99);
      expect(onGpu.stats.jetCells / onCpu.stats.jetCells).toBeLessThan(1.01);
      expect(onGpu.stats.wetArea / onCpu.stats.wetArea).toBeGreaterThan(0.97);
      expect(onGpu.stats.wetArea / onCpu.stats.wetArea).toBeLessThan(1.03);
      const handover = (set: ExposureSet): number => set.stats.water?.handover ?? 0;
      expect(handover(onGpu) / handover(onCpu)).toBeCloseTo(1, 2);
      // And the same device gives the same bytes twice.
      const again = await computeExposureSet(input(busyScene, busy, params, gpu));
      expect(encodeExposureSet(again)).toEqual(encodeExposureSet(onGpu));
    } finally {
      gpu.destroy();
    }
  });
});
