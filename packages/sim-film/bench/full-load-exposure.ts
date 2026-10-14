/**
 * Benchmark: the exposure of a full load on the owner's machine (Bosch SMV4HAX40G, Eco 50),
 * state by state and stage by stage, at the official (2 mm) and fast (4 mm) block sizes.
 *
 *   pnpm --filter @spotless/sim-film exec tsx bench/full-load-exposure.ts [fast|official] [gpu|cpu] [key=value ...]
 *
 * The load is the 114-item lattice load of `@spotless/sim-scene` (no loading physics), with
 * soil cells on every region of every item, as the orchestrator builds its scenes. The script
 * takes the machine-wide benchmark lock, builds the scene, and for each of the four spray
 * states of the programme runs the jet stage, the secondary-water stage and the surface-water
 * stage, timing every step each announces. It reports the time per stage and state, the water
 * balance, the memory of the scene on the device, and the size of the exposure sets, and
 * writes the lot to `bench/out/full-load-exposure-<tier>.json`.
 *
 * This file reaches the catalogue, the machine and the Node entry point of sim-gpu by relative
 * paths (the dependency table gives this package none of them); nothing the package exports
 * imports it.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { instantiate } from '../../catalogue/src/index.ts';
import { acquireBenchLock, createNodeGpuContext } from '../../sim-gpu/src/node/index.ts';
import { fullLoad } from '../../sim-scene/src/testing/full-load.ts';
import {
  acquireTraceBackend,
  buildWashHydraulics,
  buildWashScene,
  computeExposureSet,
  createParamSet,
  createRegistry,
  encodeExposureSet,
  FILM_PARAM_DEFS,
  HYDRAULICS_PARAM_DEFS,
  JETS_PARAM_DEFS,
  PRIMARY_MACHINE,
  primaryProgramme,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  SPRAY_PARAM_DEFS,
  TIERS,
  type GpuContext,
  type SceneItem,
} from '../src/index.ts';

const tierId = process.argv[2] === 'official' ? 'official' : 'fast';
const useGpu = process.argv[3] !== 'cpu';
const tier = TIERS[tierId];

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
// Further arguments `key=value` override parameters (numbers, or comma-separated vectors).
const overrides: Record<string, number | number[]> = {};
for (const arg of process.argv.slice(4)) {
  const [key, value] = arg.split('=');
  if (key === undefined || value === undefined) continue;
  const numbers = value.split(',').map(Number);
  overrides[key] = numbers.length === 1 ? (numbers[0] as number) : numbers;
}
const params = createParamSet(registry, overrides);

const lock = await acquireBenchLock();
const gpu: GpuContext | null = useGpu
  ? await createNodeGpuContext({ sim: 'exposure bench' })
  : null;
const load = fullLoad();
// Soil cells on every region of every item, as the orchestrator builds its scenes.
const items: SceneItem[] = load.input.items.map((item) => ({
  ...item,
  soils: [
    {
      type: 'any',
      regions: [...new Set(item.shape.regions.map((r) => r.id))].map((region) => ({
        region,
        coverage: 1,
      })),
      amount_g: 0,
      age_h: 0,
      heat_history: 'none' as const,
    },
  ],
}));

let mark = performance.now();
const scene = buildWashScene({ ...load.input, items, blockSize: tier.block_m, params });
const sceneTime = performance.now() - mark;
const hydraulics = buildWashHydraulics({
  spec: PRIMARY_MACHINE,
  programme: primaryProgramme(PRIMARY_MACHINE),
  params,
});
const armLevels: string[] = [];
for (const root of scene.trace.roots) {
  if (root.rotating === null) continue;
  const part = load.geometry.parts.find((p) => p.id === scene.instances[root.instance]?.id);
  if (part?.arm === undefined) throw new Error('a rotating part of the scene is not a spray arm');
  armLevels.push(part.arm.levelId);
}
const itemMass = new Map(items.map((item) => [item.itemId, instantiate(item.typeId).mass.mass]));
let itemArea = 0;
for (const instance of scene.instances) {
  if (instance.kind !== 'item') continue;
  for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
    itemArea += scene.blocks.area[b] as number;
  }
}

console.log(
  `${tierId} tier, ${useGpu ? 'GPU' : 'CPU'} tracer: ${items.length} items, ${scene.blocks.count} blocks, ` +
    `${scene.soilCells.count} soil cells, ${scene.drips.count} drip sites, ${scene.contacts.count} contact links, ` +
    `${scene.basins.length} basins; item area ${itemArea.toFixed(2)} m2; scene built in ${(sceneTime / 1000).toFixed(1)} s`,
);

interface StateReport {
  readonly id: string;
  readonly duration_s: number;
  readonly period_s: number;
  readonly total_ms: number;
  readonly stages_ms: Record<string, number>;
  readonly jetRays: number;
  readonly jetCells: number;
  readonly parcels: number;
  readonly wetBlocks: number;
  readonly encodedBytes: number;
  readonly deflatedBytes: number;
  readonly water: unknown;
  readonly film: unknown;
  readonly liftRatios: readonly { itemId: string; peakUp_N: number; liftRatio: number }[];
}

const reports: StateReport[] = [];
for (const state of hydraulics.states) {
  const marks: [string, number][] = [];
  mark = performance.now();
  const set = await computeExposureSet({
    scene,
    state,
    armLevels,
    params,
    tier,
    seed: 3,
    gpu,
    itemMass,
    onStage: (stage) => marks.push([stage, performance.now()]),
  });
  const end = performance.now();
  const stages: Record<string, number> = {};
  marks.forEach(([name, at], i) => {
    stages[name] = Math.round((marks[i + 1]?.[1] ?? end) - at);
  });
  const bytes = encodeExposureSet(set);
  const loads = [...(set.stats.itemLoads ?? [])]
    .filter((l) => l.liftRatio !== undefined)
    .sort((a, b) => (b.liftRatio ?? 0) - (a.liftRatio ?? 0))
    .slice(0, 5)
    .map((l) => ({ itemId: l.itemId, peakUp_N: l.peakUp, liftRatio: l.liftRatio ?? 0 }));
  const report: StateReport = {
    id: state.id,
    duration_s: state.duration,
    period_s: state.period,
    total_ms: Math.round(end - mark),
    stages_ms: stages,
    jetRays: set.stats.jetRays,
    jetCells: set.stats.jetCells,
    parcels: set.stats.secondaryPaths,
    wetBlocks: set.stats.wetBlocks,
    encodedBytes: bytes.byteLength,
    deflatedBytes: deflateSync(bytes).byteLength,
    water: set.stats.water,
    film: set.stats.film,
    liftRatios: loads,
  };
  reports.push(report);
  const water = set.stats.water;
  const film = set.stats.film;
  const group = (prefix: string): number =>
    Object.entries(stages).reduce((sum, [k, v]) => (k.startsWith(prefix) ? sum + v : sum), 0);
  console.log(
    `${state.id}: ${(report.total_ms / 1000).toFixed(1)} s  (jets ${(group('jets') / 1000).toFixed(1)}, ` +
      `droplets ${(group('spray') / 1000).toFixed(1)}, film ${(group('film') / 1000).toFixed(1)})  ` +
      `${JSON.stringify(stages)}`,
  );
  console.log(
    `   rays ${report.jetRays}, jet cells ${report.jetCells}, parcels ${report.parcels}, set ${(report.encodedBytes / 1e6).toFixed(1)} MB ` +
      `(${(report.deflatedBytes / 1e6).toFixed(1)} MB deflated)`,
  );
  if (water !== undefined && film !== undefined) {
    const kg = (units: number): string => (units * water.unit).toFixed(4);
    console.log(
      `   per revolution, kg: nozzle ${kg(water.nozzle)} = jets ${kg(water.jets)} + sprinkler ${kg(water.showers)}; ` +
        `hand-over ${kg(water.handover)}, splatter ${kg(water.splatter)}, scatter ${kg(water.scatter)}, jets lost ${kg(water.jetLost)}; ` +
        `droplets landed ${kg(water.dropletsLanded)}, lost ${kg(water.dropletsLost)}; closes ${water.closes}`,
    );
    console.log(
      `   back in the sump within a revolution ${(100 * water.sumpReturnFraction).toFixed(1)} %; ` +
        `held on the load ${(1000 * film.heldOnItems).toFixed(0)} g, in basins ${(1000 * film.heldInBasins).toFixed(0)} g; ` +
        `wetted share of the load ${(100 * film.itemWetFraction).toFixed(1)} %; left after the drain-down ${(1000 * film.retainedOnItems).toFixed(0)} g; ` +
        `stored change ${(100 * film.storedChange).toFixed(2)} % per revolution, converged ${film.converged}`,
    );
  }
  console.log(
    `   most lifted: ${loads.map((l) => `${l.itemId} ${l.liftRatio.toFixed(2)} (${l.peakUp_N.toFixed(2)} N)`).join(', ')}`,
  );
}

const backend = await acquireTraceBackend(scene, gpu);
const memory = process.memoryUsage();
const summary = {
  tier: tierId,
  backend: backend.kind,
  overrides,
  stack: gpu?.stack ?? null,
  items: items.length,
  blocks: scene.blocks.count,
  soilCells: scene.soilCells.count,
  dripSites: scene.drips.count,
  contactLinks: scene.contacts.count,
  basins: scene.basins.length,
  itemArea_m2: itemArea,
  sceneBuild_ms: Math.round(sceneTime),
  gpuSceneBytes: backend.sceneBytes,
  gpuPeakBytes: gpu?.stats.peakBytes ?? 0,
  rssBytes: memory.rss,
  heapUsedBytes: memory.heapUsed,
  arrayBuffersBytes: memory.arrayBuffers,
  exposure_ms: reports.reduce((sum, r) => sum + r.total_ms, 0),
  encodedBytes: reports.reduce((sum, r) => sum + r.encodedBytes, 0),
  deflatedBytes: reports.reduce((sum, r) => sum + r.deflatedBytes, 0),
  states: reports,
};
console.log(
  `all four states: ${(summary.exposure_ms / 1000).toFixed(1)} s; scene on the device ${(summary.gpuSceneBytes / 1e6).toFixed(1)} MB ` +
    `(peak of all buffers ${(summary.gpuPeakBytes / 1e6).toFixed(1)} MB); exposure sets ${(summary.encodedBytes / 1e6).toFixed(1)} MB ` +
    `(${(summary.deflatedBytes / 1e6).toFixed(1)} MB deflated); process RSS ${(memory.rss / 1e9).toFixed(2)} GB`,
);
const out = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(out, { recursive: true });
writeFileSync(
  join(
    out,
    `full-load-exposure-${tierId}${useGpu ? '' : '-cpu'}${Object.keys(overrides).length > 0 ? '-variant' : ''}.json`,
  ),
  `${JSON.stringify(summary, null, 2)}\n`,
);
gpu?.destroy();
lock.release();
