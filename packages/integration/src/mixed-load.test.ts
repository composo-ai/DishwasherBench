// A mixed load of sixty catalogue items on two stand-in racks, released together: nothing
// explodes, sinks or leaves its place, everything comes to rest inside the settle budget, and the
// run reproduces. Also where the step-time statistics of scenario b and of this load are taken.
import { instantiate } from '@spotless/catalogue';
import type { Vec3 } from '@spotless/core';
import { STANDARD_GRAVITY, poseRelative } from '@spotless/core';
import { JOLT_SETTINGS, placedCores } from '@spotless/physics';
import { afterEach, describe, expect, it } from 'vitest';
import { BOWL, DINNER_PLATE, loadMixedLoad, loadPlates } from './loads.ts';
import type { MixedLoad } from './loads.ts';
import { profileNestSpacing } from './nest.ts';
import { overlapMeter } from './overlap.ts';
import { maxLeanInSlot, slotFit } from './rack-geometry.ts';
import type { LoadingScene, SceneItem } from './scene.ts';
import {
  TUB_FLOOR_ID,
  axisFromUpDeg,
  bodyBounds,
  createLoadingScene,
  fastest,
  itemIds,
  settleScene,
} from './scene.ts';
import type { PlateSlot } from './stand-in-rack.ts';
import type { StepTimeStats } from './timing.ts';
import { formatStepTimes, summariseStepTimes, timeSteps } from './timing.ts';

const MM = 1e-3;
const DEG = Math.PI / 180;
const MAX_PENETRATION = 0.2 * MM;

const scenes: LoadingScene[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.world.dispose();
});

interface MixedRun {
  readonly scene: LoadingScene;
  readonly load: MixedLoad;
  readonly stats: StepTimeStats;
  readonly deepest: number;
  readonly fastestEver: number;
  readonly mostManifolds: number;
  readonly hash: string;
}

/** Releases the mixed load and steps it for four seconds, then settles it. */
async function runMixed(): Promise<MixedRun> {
  const scene = await createLoadingScene();
  scenes.push(scene);
  const load = loadMixedLoad(scene);
  const ids = itemIds(scene);
  const meter = overlapMeter(scene);
  let deepest = 0;
  let fastestEver = 0;
  let mostManifolds = 0;
  const times = timeSteps(scene.world, 960, (i) => {
    mostManifolds = Math.max(mostManifolds, scene.world.stats().manifolds);
    if (i % 4 === 0) fastestEver = Math.max(fastestEver, fastest(scene, ids).linear);
    if (i % 24 === 0) deepest = Math.max(deepest, meter().deepest);
  });
  expect(settleScene(scene).atRest).toBe(true);
  deepest = Math.max(deepest, meter().deepest);
  return {
    scene,
    load,
    stats: summariseStepTimes(times, scene.world.timeStep),
    deepest,
    fastestEver,
    mostManifolds,
    hash: scene.world.stateHash(),
  };
}

describe('a mixed load of sixty items on two racks', () => {
  it('comes to rest with everything in its place, and reproduces', async () => {
    const run = await runMixed();
    const { scene, load } = run;
    const rack = scene.rack;
    expect(load.count).toBe(60);
    expect(scene.items).toHaveLength(60);
    expect(load.plates).toHaveLength(12);
    expect(load.bowls).toHaveLength(4);
    expect(load.cutlery).toHaveLength(28);
    expect(load.sidePlates).toHaveLength(4);
    expect(load.overTines).toHaveLength(6);
    expect(load.onGrid).toHaveLength(6);
    // For the record: some 4,800 collision pieces on about 170 pieces of rack.
    expect(scene.items.reduce((sum, item) => sum + item.pieces.length, 0)).toBeGreaterThan(3000);

    // No explosion: the cutlery is dropped 20 mm, everything else half a millimetre. Nothing is
    // ever faster than a 20 mm fall, and no step comes near the contact capacity of the world.
    expect(run.fastestEver).toBeLessThanOrEqual(Math.sqrt(2 * STANDARD_GRAVITY * 0.02) + 1e-6);
    expect(run.mostManifolds).toBeLessThan(0.9 * JOLT_SETTINGS.maxContactConstraints);
    // No sinking: no two bodies ever overlap by 0.2 mm (sampled every 0.1 s and at rest).
    expect(run.deepest).toBeLessThan(MAX_PENETRATION);
    // Nothing has fallen onto the tub floor.
    expect(scene.world.contacts({ bodies: [TUB_FLOOR_ID] })).toEqual([]);

    // Lower rack. The plates lean in their slots as the geometry says.
    const plateShape = instantiate(DINNER_PLATE).shape;
    const plateLean = maxLeanInSlot(rack, rack.slots[0] as PlateSlot, plateShape);
    if (plateLean === null) throw new Error('the plate does not fit');
    load.plates.forEach((plate, k) => {
      const caught = slotFit(rack, rack.slots[k] as PlateSlot, plateShape, plateLean);
      const pose = scene.world.getPose(plate.id);
      expect(Math.abs(90 - axisFromUpDeg(pose.q) - plateLean / DEG), plate.id).toBeLessThan(1);
      expect(Math.abs(pose.p[1] - caught.yMin), plate.id).toBeLessThan(2 * MM);
      expect(Math.abs(pose.p[2] - caught.z), plate.id).toBeLessThan(1 * MM);
    });
    // The bowls are nested at the spacing of their profile, level.
    const nest = profileNestSpacing(instantiate(BOWL).shape);
    load.bowls.forEach((bowl, k) => {
      const pose = scene.world.getPose(bowl.id);
      expect(axisFromUpDeg(pose.q), bowl.id).toBeLessThan(0.5);
      expect(Math.abs(pose.p[2] - k * nest), bowl.id).toBeLessThan((0.1 + 0.3 * k) * MM);
    });
    // Every piece of cutlery stands in its own cell on the floor of the basket.
    const rim = (rack.cells[0] as { inner: { max: Vec3 } }).inner.max[2];
    for (const { item, cell } of load.cutlery) {
      let outside = 0;
      for (const core of placedCores({ pieces: item.pieces, pose: scene.world.getPose(item.id) })) {
        for (const loop of core.loops) {
          for (const point of loop) {
            outside = Math.max(outside, cell.inner.min[2] - (point[2] - core.radius));
            if (point[2] >= rim - 0.002) continue;
            outside = Math.max(
              outside,
              cell.inner.min[0] - (point[0] - core.radius),
              point[0] + core.radius - cell.inner.max[0],
              cell.inner.min[1] - (point[1] - core.radius),
              point[1] + core.radius - cell.inner.max[1],
            );
          }
        }
      }
      expect(outside, item.id).toBeLessThan(MAX_PENETRATION);
      // On the floor of the cell, or resting on a neighbour that is.
      expect(bodyBounds(scene, item).min[2] - cell.inner.min[2], item.id).toBeLessThan(0.03);
    }

    // Upper rack: positions in its own frame.
    const inUpper = (id: string): { p: Vec3; tilt: number; lowest: number } => {
      const pose = poseRelative(load.upperRackPose, scene.world.getPose(id));
      const item = scene.items.find((candidate) => candidate.id === id);
      if (item === undefined) throw new Error(`no item ${id}`);
      const lowest = bodyBounds(scene, item).min[2] - load.upperRackPose.p[2];
      return { p: pose.p, tilt: axisFromUpDeg(pose.q), lowest };
    };
    const sideShape = load.sidePlates[0]?.shape;
    if (sideShape === undefined) throw new Error('no side plate');
    const sideLean = maxLeanInSlot(rack, rack.slots[0] as PlateSlot, sideShape);
    if (sideLean === null) throw new Error('the side plate does not fit');
    load.sidePlates.forEach((plate, k) => {
      const caught = slotFit(rack, rack.slots[k] as PlateSlot, sideShape, sideLean);
      const at = inUpper(plate.id);
      expect(Math.abs(90 - at.tilt - sideLean / DEG), plate.id).toBeLessThan(1.5);
      expect(Math.abs(at.p[1] - caught.yMin), plate.id).toBeLessThan(2 * MM);
      expect(Math.abs(at.p[2] - caught.z), plate.id).toBeLessThan(1 * MM);
    });
    // How far an item has moved sideways from where it was released.
    const strayed = (item: SceneItem): number => {
      const pose = scene.world.getPose(item.id);
      return Math.hypot(pose.p[0] - item.released.p[0], pose.p[1] - item.released.p[1]);
    };
    // Mugs and tumblers upside down over their tines, rims on the grid, where they were put.
    for (const item of load.overTines) {
      const at = inUpper(item.id);
      expect(180 - at.tilt, item.id).toBeLessThan(0.5);
      expect(Math.abs(at.lowest), item.id).toBeLessThan(0.1 * MM);
      expect(strayed(item), item.id).toBeLessThan(1 * MM);
    }
    // Containers, beakers and wine glasses upside down on the grid: still mouth down, on the
    // wires (a round rim may sit up to a millimetre between two of them, and lean with it),
    // within a few millimetres of where they were put.
    for (const item of load.onGrid) {
      const at = inUpper(item.id);
      expect(180 - at.tilt, item.id).toBeLessThan(2);
      expect(at.lowest, item.id).toBeLessThan(0.05 * MM);
      expect(at.lowest, item.id).toBeGreaterThan(-1 * MM);
      expect(strayed(item), item.id).toBeLessThan(5 * MM);
    }

    // The same load released again gives the same state, bit for bit.
    const again = await runMixed();
    expect(again.hash).toBe(run.hash);
    expect(again.mostManifolds).toBe(run.mostManifolds);
  });
});

describe('step-time statistics', () => {
  // Wall-clock times depend on the machine; they are printed for the record and held only to a
  // ceiling generous enough for a loaded machine. Reference machine (Apple M3 Pro, Node 20): see
  // the package's scripts/step-times.ts, which prints the same statistics on their own.
  const CEILING_MEAN_MS = 100;

  it('scenario b: twelve plates, from release to rest', async () => {
    const scene = await createLoadingScene();
    scenes.push(scene);
    loadPlates(scene);
    const times = timeSteps(scene.world, 480);
    expect(settleScene(scene).atRest).toBe(true);
    const stats = summariseStepTimes(times, scene.world.timeStep);
    console.info(`[step-times] ${formatStepTimes('scenario b, 12 plates, first 2 s', stats)}`);
    expect(stats.steps).toBe(480);
    expect(stats.simulatedSeconds).toBeCloseTo(2, 12);
    expect(stats.medianMs).toBeLessThanOrEqual(stats.p95Ms);
    expect(stats.p95Ms).toBeLessThanOrEqual(stats.p99Ms);
    expect(stats.p99Ms).toBeLessThanOrEqual(stats.maxMs);
    expect(stats.meanMs).toBeLessThan(CEILING_MEAN_MS);
  });

  it('mixed load: sixty items, from release to rest', async () => {
    const run = await runMixed();
    console.info(`[step-times] ${formatStepTimes('mixed load, 60 items, first 4 s', run.stats)}`);
    expect(run.stats.steps).toBe(960);
    expect(run.stats.meanMs).toBeLessThan(CEILING_MEAN_MS);
    // The statistics are of what they say: the mean times the count is the total.
    expect(run.stats.meanMs * run.stats.steps).toBeCloseTo(run.stats.totalMs, 6);
  });
});
