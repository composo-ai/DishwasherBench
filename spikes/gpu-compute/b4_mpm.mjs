// B4: particle-grid method (MLS-MPM-style) throughput: P2G scatter with atomics, grid update, G2P gather.
// Usage: node b4_mpm.mjs [quick]
import { getDevice, now, gpuDone, tstats, fmt, saveJSON, readBuffer, benchLockStatus, foreignBenchProcs } from './lib.mjs';
import { makeMPM, initParticles } from './mpm.mjs';

const quick = process.argv.includes('quick');
const REPS = quick ? 3 : 5;
const { device } = await getDevice();
const G = 256;
const out = { when: new Date().toISOString(), lock: benchLockStatus(), grid: G, cases: [] };

async function runSteps(sim, total, k) {
  const t0 = now(); let done = 0;
  while (done < total) { const n = Math.min(k, total - done); const enc = device.createCommandEncoder(); sim.encode(enc, n); device.queue.submit([enc.finish()]); done += n; }
  await gpuDone(device);
  return now() - t0;
}
/** GPU time of each of the three passes of one step (timestamp queries), averaged over `reps` single-step submits. */
async function breakdown(sim, reps = 6) {
  if (!device.features.has('timestamp-query')) return null;
  const qs = device.createQuerySet({ type: 'timestamp', count: 6 });
  const resolve = device.createBuffer({ size: 48, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const acc = [[], [], []];
  for (let r = 0; r < reps; r++) {
    const enc = device.createCommandEncoder();
    sim.encode(enc, 1, (i) => ({ timestampWrites: { querySet: qs, beginningOfPassWriteIndex: 2 * i, endOfPassWriteIndex: 2 * i + 1 } }));
    enc.resolveQuerySet(qs, 0, 6, resolve, 0);
    device.queue.submit([enc.finish()]);
    const t = await readBuffer(device, resolve, 48, 0, BigUint64Array);
    if (r > 0) for (let i = 0; i < 3; i++) acc[i].push(Number(t[2 * i + 1] - t[2 * i]) / 1e6);
  }
  qs.destroy(); resolve.destroy();
  const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  return { p2gMs: med(acc[0]), gridMs: med(acc[1]), g2pMs: med(acc[2]) };
}

const configs = [];
for (const np of quick ? [1 << 20] : [1 << 20, 1 << 22]) {
  for (const [layout, order] of [['block', 'sorted'], ['block', 'shuffled'], ['dispersed', 'sorted'], ['dispersed', 'shuffled']]) {
    configs.push({ np, layout, order, mode: 'fixed' });
  }
  configs.push({ np, layout: 'block', order: 'sorted', mode: 'floatcas' });
  configs.push({ np, layout: 'dispersed', order: 'shuffled', mode: 'floatcas' });
}
for (const cfg of configs) {
  const t0 = now();
  const particles = initParticles(cfg.np, G, cfg.layout, cfg.order);
  const initMs = now() - t0;
  const sim = await makeMPM(device, { ...cfg, G, particles });
  await runSteps(sim, 2, 1); // warm-up
  const cal = (await runSteps(sim, 4, 2)) / 4;
  const k = 4, total = Math.max(k, Math.ceil((quick ? 400 : 1000) / cal / k) * k);
  const ms = []; for (let r = 0; r < REPS; r++) ms.push((await runSteps(sim, total, k)) / total);
  const bd = await breakdown(sim);
  const probe = await readBuffer(device, sim.partB, 80 * 4096, 0, Float32Array);
  const finite = probe.every(Number.isFinite);
  const pps = tstats(ms.map((m) => cfg.np / (m / 1000)));
  const best = Math.min(...ms), med = [...ms].sort((a, b) => a - b)[ms.length >> 1];
  out.cases.push({ ...cfg, steps: total, msPerStepBest: best, msPerStepMedian: med, particleStepsPerSec: pps, breakdown: bd, finite, jsInitMs: initMs });
  console.log(`${fmt(cfg.np).padStart(6)} particles ${cfg.layout.padEnd(9)} ${cfg.order.padEnd(8)} ${cfg.mode.padEnd(8)}: step ${best.toFixed(2)} ms best / ${med.toFixed(2)} med  ` +
    `=> ${fmt(pps.best)} best / ${fmt(pps.median)} med particle-steps/s (spread ${pps.spreadPct.toFixed(0)}%)` +
    (bd ? `   [P2G ${bd.p2gMs.toFixed(2)} | grid ${bd.gridMs.toFixed(2)} | G2P ${bd.g2pMs.toFixed(2)} ms]` : '') + `  finite=${finite}`);
  sim.destroy();
  await gpuDone(device);
}
out.foreignAtEnd = foreignBenchProcs();
saveJSON(quick ? 'b4_mpm_quick.json' : 'b4_mpm.json', out);
process.exit(0);
