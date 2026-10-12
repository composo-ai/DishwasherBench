// B1: structured stencil throughput. Usage: node b1_stencil.mjs [quick]
import { getDevice, now, gpuDone, tstats, fmt, saveJSON, readBuffer, benchLockStatus, foreignBenchProcs } from './lib.mjs';
import { makeBufferSim, makeTextureSim } from './stencil.mjs';

const quick = process.argv.includes('quick');
const { device } = await getDevice();
const TARGET_MS = quick ? 500 : 1000;
const REPS = quick ? 3 : 5;

/** Run `total` steps, k dispatches per submitted command buffer. Clock stops only after the GPU has finished. */
async function runSteps(sim, total, k, { onePass = false, awaitEvery = 0 } = {}) {
  const t0 = now();
  let done = 0, submits = 0;
  while (done < total) {
    const n = Math.min(k, total - done);
    const enc = device.createCommandEncoder();
    sim.encode(enc, n, onePass);
    device.queue.submit([enc.finish()]);
    done += n; submits++;
    if (awaitEvery && submits % awaitEvery === 0) await gpuDone(device);
  }
  const tSub = now();
  await gpuDone(device);
  const t1 = now();
  return { ms: t1 - t0, submitMs: tSub - t0, steps: done };
}

async function calibrate(sim) {
  await runSteps(sim, 8, 8); // warm-up (pipeline, first touch of memory)
  const r = await runSteps(sim, 32, 16);
  return r.ms / 32; // ms per step
}

async function measure(sim, k, opts = {}) {
  const msPerStep = sim._msPerStep ??= await calibrate(sim);
  const total = Math.max(k, Math.ceil(TARGET_MS / msPerStep / k) * k);
  const sps = [];
  let subFrac = 0;
  for (let r = 0; r < REPS; r++) {
    const res = await runSteps(sim, total, k, opts);
    sps.push(res.steps / (res.ms / 1000));
    subFrac += res.submitMs / res.ms / REPS;
  }
  const s = tstats(sps);
  return { k, ...opts, steps: total, stepsPerSec: s, cellUpdatesPerSec: { best: s.best * sim.cells, median: s.median * sim.cells }, submitFrac: subFrac };
}

/** GPU-side time for k steps in one pass using timestamp queries. */
async function gpuTime(sim, k) {
  if (!device.features.has('timestamp-query')) return null;
  const qs = device.createQuerySet({ type: 'timestamp', count: 2 });
  const resolve = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const samples = [];
  for (let r = 0; r < REPS + 1; r++) {
    const enc = device.createCommandEncoder();
    sim.encode(enc, k, true, { timestampWrites: { querySet: qs, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } });
    enc.resolveQuerySet(qs, 0, 2, resolve, 0);
    device.queue.submit([enc.finish()]);
    const t = await readBuffer(device, resolve, 16, 0, BigUint64Array);
    if (r > 0) samples.push(Number(t[1] - t[0]) / 1e6 / k); // ms per step
  }
  qs.destroy(); resolve.destroy();
  samples.sort((a, b) => a - b);
  return { msPerStepBest: samples[0], msPerStepMedian: samples[samples.length >> 1], cellUpdatesPerSecBest: sim.cells / (samples[0] / 1000) };
}

const out = { when: new Date().toISOString(), lock: benchLockStatus(), grids: [] };
const grids = quick ? [[1024, 1024], [2048, 2048]] : [[1024, 1024], [2048, 2048], [4096, 4096]];
for (const [w, h] of grids) {
  const g = { w, h, cells: w * h, sweep: [], variants: [] };
  console.log(`\n=== grid ${w}x${h} (${fmt(w * h)} cells) ===`);
  let sim = await makeBufferSim(device, w, h, { wx: 8, wy: 8 });
  // --- dispatches-per-submit sweep (storage buffers, 8x8 workgroups) ---
  const ks = quick ? [1, 4, 16, 64] : [1, 2, 4, 8, 16, 32, 64, 128, 256];
  for (const k of ks) {
    for (const onePass of [false, true]) {
      if (onePass && (k === 1 || (!quick && ![4, 16, 64, 256].includes(k)))) continue;
      const m = await measure(sim, k, { onePass });
      g.sweep.push(m);
      console.log(`buffer 8x8  k=${String(k).padStart(3)} ${onePass ? 'one-pass ' : 'multipass'}: ${m.stepsPerSec.best.toFixed(1)} best / ${m.stepsPerSec.median.toFixed(1)} med steps/s  ` +
        `${fmt(m.cellUpdatesPerSec.best)} best / ${fmt(m.cellUpdatesPerSec.median)} med cell-upd/s  spread ${m.stepsPerSec.spreadPct.toFixed(1)}%  submit-frac ${(m.submitFrac * 100).toFixed(0)}%`);
    }
  }
  const bestK = g.sweep.reduce((a, b) => (b.stepsPerSec.median > a.stepsPerSec.median ? b : a));
  g.bestK = { k: bestK.k, onePass: bestK.onePass };
  console.log(`best: k=${bestK.k} onePass=${bestK.onePass}`);
  // await policy: block on the GPU after every submit / every 4 submits (bounded queue depth)
  for (const [k, awaitEvery] of [[1, 1], [16, 1], [16, 4]]) {
    const m = await measure(sim, k, { onePass: false, awaitEvery });
    g.variants.push({ name: `buffer 8x8 k=${k} awaitEvery=${awaitEvery}`, ...m });
    console.log(`buffer 8x8  k=${k} await-every-${awaitEvery}-submits: ${m.stepsPerSec.best.toFixed(1)} / ${m.stepsPerSec.median.toFixed(1)} steps/s  ${fmt(m.cellUpdatesPerSec.best)} / ${fmt(m.cellUpdatesPerSec.median)} cell-upd/s`);
  }
  const gt = await gpuTime(sim, 16);
  g.gpuTimestamp = gt;
  if (gt) console.log(`timestamp-query GPU time: ${gt.msPerStepBest.toFixed(3)} ms/step best (${gt.msPerStepMedian.toFixed(3)} med) => ${fmt(gt.cellUpdatesPerSecBest)} cell-upd/s`);
  sim.destroy();

  // --- workgroup-size variants ---
  const K = 32;
  for (const [wx, wy] of quick ? [[16, 16]] : [[16, 16], [32, 8], [32, 32], [64, 4], [4, 4], [256, 1]]) {
    sim = await makeBufferSim(device, w, h, { wx, wy });
    const m = await measure(sim, K, { onePass: false });
    g.variants.push({ name: `buffer ${wx}x${wy} k=${K}`, ...m });
    console.log(`buffer ${wx}x${wy} k=${K}: ${m.stepsPerSec.best.toFixed(1)} / ${m.stepsPerSec.median.toFixed(1)} steps/s   ${fmt(m.cellUpdatesPerSec.best)} / ${fmt(m.cellUpdatesPerSec.median)} cell-upd/s`);
    sim.destroy();
  }
  // --- storage-texture formulation ---
  for (const readMode of ['sampled', 'storage']) {
    for (const [wx, wy] of [[8, 8], [16, 16]]) {
      try {
        sim = await makeTextureSim(device, w, h, { wx, wy, readMode });
        const m = await measure(sim, K, { onePass: false });
        g.variants.push({ name: `texture(${readMode}) ${wx}x${wy} k=${K}`, ...m });
        console.log(`texture(${readMode}) ${wx}x${wy} k=${K}: ${m.stepsPerSec.best.toFixed(1)} / ${m.stepsPerSec.median.toFixed(1)} steps/s   ${fmt(m.cellUpdatesPerSec.best)} / ${fmt(m.cellUpdatesPerSec.median)} cell-upd/s`);
        if (wx === 8) {
          const gt2 = await gpuTime(sim, 16);
          if (gt2) { g.variants.push({ name: `texture(${readMode}) ${wx}x${wy} timestamp`, ...gt2 }); console.log(`   timestamp-query: ${gt2.msPerStepBest.toFixed(3)} ms/step => ${fmt(gt2.cellUpdatesPerSecBest)} cell-upd/s`); }
        }
        sim.destroy();
      } catch (e) {
        console.log(`texture(${readMode}) ${wx}x${wy}: FAILED ${String(e.message).slice(0, 300)}`);
        g.variants.push({ name: `texture(${readMode}) ${wx}x${wy}`, error: String(e.message).slice(0, 300) });
      }
    }
  }
  out.grids.push(g);
}
out.foreignAtEnd = foreignBenchProcs();
if (out.foreignAtEnd.length) console.log('WARNING: lock-unaware benchmark processes were running at the end:', JSON.stringify(out.foreignAtEnd));
saveJSON(quick ? 'b1_stencil_quick.json' : 'b1_stencil.json', out);
process.exit(0);
