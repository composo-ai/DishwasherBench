// Benchmark: the scene of the owner's machine with a representative full load, at the block
// sizes of the official and the fast tier (scene brief, item 5 and the closing measurement).
//
//   pnpm --filter @spotless/sim-scene run bench:full-load [-- quick]
//
// Reports per block size: element counts, build time by stage, memory, and the rates of the
// GPU kernel and of the f64 reference tracer for coherent jet-like bundles and for short random
// segments. Writes bench/out/full-load.json with the stack string. The load is set on a lattice
// without the loading physics (src/testing/full-load.ts says exactly how).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashU32, u32ToUnitFloat } from '@spotless/core';
import { benchResult, measureGpu, stackKey, type BenchResult } from '@spotless/sim-gpu';
import { acquireBenchLock, createNodeGpuContext } from '@spotless/sim-gpu/node';
import { buildWashScene } from '../src/scene.ts';
import type { WashScene } from '../src/scene-types.ts';
import { fullLoad } from '../src/testing/full-load.ts';
import { RAY_WORDS } from '../src/trace-data.ts';
import { createGpuTracer } from '../src/trace-gpu.ts';

const quick = process.argv.includes('quick');
const unit = (seed: number, i: number, k: number): number => u32ToUnitFloat(hashU32(seed, i, k));

/** Jet-like bundles: 19 parallel sub-rays per jet from nozzle rings of the two arms. */
function jetRays(n: number, scene: WashScene): ArrayBuffer {
  const rays = new ArrayBuffer(4 * RAY_WORDS * n);
  const f = new Float32Array(rays);
  const u = new Uint32Array(rays);
  const arms = scene.instances.filter((instance) => instance.rotating);
  const perJet = 19;
  for (let i = 0; i < n; i++) {
    const jet = Math.floor(i / perJet);
    const sub = i % perJet;
    const arm = arms[jet % Math.max(1, arms.length)];
    const centre =
      arm === undefined ? [0, 0, 0.05] : [arm.pose.p[0], arm.pose.p[1], arm.box.max[2] + 0.002];
    // A nozzle at a radius on the arm, the arm at a phase; the jet leans up to 25 degrees.
    const radius = 0.04 + 0.19 * unit(1, jet, 0);
    const phase = 2 * Math.PI * unit(1, jet, 1);
    const tilt = 0.44 * unit(1, jet, 2);
    const turn = 2 * Math.PI * unit(1, jet, 3);
    const up = jet % 4 === 3 && arm !== undefined && arm.pose.p[2] > 0.2 ? -1 : 1;
    const d = [
      Math.sin(tilt) * Math.cos(turn),
      Math.sin(tilt) * Math.sin(turn),
      up * Math.cos(tilt),
    ];
    // Sub-rays fill a 2 mm jet: a centre ray and two rings.
    const ring = sub === 0 ? 0 : sub < 7 ? 0.0005 : 0.001;
    const angle =
      sub === 0 ? 0 : sub < 7 ? (2 * Math.PI * (sub - 1)) / 6 : (2 * Math.PI * (sub - 7)) / 12;
    const o = RAY_WORDS * i;
    f[o] = (centre[0] as number) + radius * Math.cos(phase) + ring * Math.cos(angle);
    f[o + 1] = (centre[1] as number) + radius * Math.sin(phase) + ring * Math.sin(angle);
    f[o + 2] = (centre[2] as number) - (up < 0 ? 0.04 : 0);
    f[o + 3] = 2;
    f[o + 4] = d[0] as number;
    f[o + 5] = d[1] as number;
    f[o + 6] = d[2] as number;
    u[o + 7] = i;
  }
  return rays;
}

/** Short segments: random points of the chamber, random directions, 10 mm long. */
function segmentRays(n: number): ArrayBuffer {
  const rays = new ArrayBuffer(4 * RAY_WORDS * n);
  const f = new Float32Array(rays);
  const u = new Uint32Array(rays);
  for (let i = 0; i < n; i++) {
    const cz = 2 * unit(2, i, 3) - 1;
    const s = Math.sqrt(1 - cz * cz);
    const phi = 2 * Math.PI * unit(2, i, 4);
    const o = RAY_WORDS * i;
    f[o] = -0.26 + 0.52 * unit(2, i, 0);
    f[o + 1] = -0.26 + 0.52 * unit(2, i, 1);
    f[o + 2] = 0.01 + 0.6 * unit(2, i, 2);
    f[o + 3] = 0.01;
    f[o + 4] = s * Math.cos(phi);
    f[o + 5] = s * Math.sin(phi);
    f[o + 6] = cz;
    u[o + 7] = i;
  }
  return rays;
}

const lock = await acquireBenchLock();
const gpu = await createNodeGpuContext();
const load = fullLoad();
const results: BenchResult[] = [];
const scenes: Record<string, unknown>[] = [];

for (const blockSize of quick ? [0.004] : [0.002, 0.004]) {
  const label = `${1000 * blockSize} mm`;
  const stages: [string, number][] = [];
  const heapBefore = process.memoryUsage();
  const scene = buildWashScene({
    ...load.input,
    blockSize,
    onStage: (stage) => stages.push([stage, performance.now()]),
  });
  const stageSeconds: Record<string, number> = {};
  for (let k = 0; k + 1 < stages.length; k++) {
    const [name, at] = stages[k] as [string, number];
    stageSeconds[name] = Math.round((stages[k + 1] as [string, number])[1] - at) / 1000;
  }
  const first = (stages[0] as [string, number])[1];
  const last = (stages[stages.length - 1] as [string, number])[1];
  const heapAfter = process.memoryUsage();
  const tracer = await createGpuTracer(gpu, scene.trace, `bench${1000 * blockSize}`);
  let soiledBlocks = 0;
  let area = 0;
  let itemArea = 0;
  for (let b = 0; b < scene.blocks.count; b++) {
    area += scene.blocks.area[b] as number;
    if ((scene.instances[scene.blocks.instance[b] as number] as { kind: string }).kind === 'item') {
      itemArea += scene.blocks.area[b] as number;
    }
    if ((scene.blocks.soilFirst[b] as number) !== 0xffffffff) soiledBlocks++;
  }
  const blockBytes = Object.values(scene.blocks).reduce(
    (sum: number, value) => sum + (ArrayBuffer.isView(value) ? value.byteLength : 0),
    0,
  );
  const summary = {
    blockSize_m: blockSize,
    counts: scene.counts,
    itemBlocks: scene.instances
      .filter((i) => i.kind === 'item')
      .reduce((sum, i) => sum + i.blockCount, 0),
    machineBlocks: scene.instances
      .filter((i) => i.kind === 'machine')
      .reduce((sum, i) => sum + i.blockCount, 0),
    soiledBlocks,
    blockArea_m2: Math.round(1e4 * area) / 1e4,
    itemBlockArea_m2: Math.round(1e4 * itemArea) / 1e4,
    basinVolume_L:
      Math.round(1e6 * scene.basins.reduce((sum, basin) => sum + basin.volume, 0)) / 1e3,
    buildSeconds: Math.round(last - first) / 1000,
    stageSeconds,
    gpuSceneBytes: tracer.sceneBytes,
    gpuLiveBytes: gpu.stats.liveBytes,
    cpuBlockArrayBytes: blockBytes,
    cpuGraphBytes:
      scene.graph.offsets.byteLength +
      scene.graph.neighbour.byteLength +
      scene.graph.length.byteLength +
      scene.graph.kind.byteLength,
    cpuTraceBytes:
      scene.trace.nodes.byteLength +
      scene.trace.triVerts.byteLength +
      scene.trace.triSurf.byteLength * 3 +
      scene.trace.cellBlock.byteLength,
    heapGrowthBytes:
      heapAfter.heapUsed + heapAfter.arrayBuffers - heapBefore.heapUsed - heapBefore.arrayBuffers,
    rssBytes: heapAfter.rss,
    unsupported: scene.unsupported,
  };
  scenes.push(summary);
  console.log(`\n=== full load at ${label} ===`);
  console.log(JSON.stringify(summary, null, 1));

  // Ray rates. The GPU timing covers the dispatch alone: rays are uploaded before the clock
  // starts and hits stay on the device.
  const sets: [string, (n: number) => ArrayBuffer][] = [
    ['jet-like bundles of 19 sub-rays', (n) => jetRays(n, scene)],
    ['random segments of 10 mm', segmentRays],
  ];
  for (const [name, make] of sets) {
    const n = quick ? 1 << 20 : 1 << 22;
    const rays = make(n);
    const buffers = tracer.createBatchBuffers(`bench.${1000 * blockSize}.${results.length}`, n);
    gpu.write(buffers.rays, rays);
    const time = await measureGpu(
      gpu,
      () => gpu.run(tracer.encode(buffers.rays, buffers.hits, n)),
      {
        repeats: quick ? 3 : 5,
      },
    );
    const hits = new Uint32Array(await gpu.read(buffers.hits));
    let struck = 0;
    for (let i = 0; i < n; i++) if (hits[8 * i + 3] !== 0xffffffff) struck++;
    const gpuResult = benchResult(
      `GPU, ${label} blocks, ${name}, ${n} rays, ${Math.round((100 * struck) / n)} % hit`,
      n,
      'rays',
      time,
    );
    results.push(gpuResult);
    console.log(
      `${gpuResult.name}: ${(gpuResult.rate.best / 1e6).toFixed(1)} M best, ${(gpuResult.rate.median / 1e6).toFixed(1)} M median rays/s`,
    );
    gpu.release(buffers.rays);
    gpu.release(buffers.hits);

    const cpuCount = quick ? 100_000 : 400_000;
    const samples: number[] = [];
    for (let repeat = 0; repeat < 3; repeat++) {
      const start = performance.now();
      scene.rays.traceBatch(rays, cpuCount);
      samples.push((performance.now() - start) / 1000);
    }
    samples.sort((a, b) => a - b);
    const cpuResult = benchResult(
      `CPU f64 reference, ${label} blocks, ${name}, ${cpuCount} rays`,
      cpuCount,
      'rays',
      {
        best: samples[0] as number,
        median: samples[1] as number,
        worst: samples[2] as number,
        samples,
      },
    );
    results.push(cpuResult);
    console.log(
      `${cpuResult.name}: ${(cpuResult.rate.best / 1e6).toFixed(2)} M best, ${(cpuResult.rate.median / 1e6).toFixed(2)} M median rays/s`,
    );
  }
  tracer.release();
}

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  'out',
  quick ? 'full-load-quick.json' : 'full-load.json',
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify(
    {
      benchmark: 'sim-scene full load',
      stack: gpu.stack,
      stackKey: stackKey(gpu.stack),
      finishedAt: new Date().toISOString(),
      lockWaited: lock.waited,
      machine: load.geometry.machineId,
      load: {
        items: load.input.items.length,
        itemTypes: load.itemTypes,
        placement: 'lattice, no loading physics',
      },
      scenes,
      results,
    },
    null,
    2,
  )}\n`,
);
console.log(`\nwrote ${out}`);
gpu.destroy();
lock.release();
process.exit(0);
