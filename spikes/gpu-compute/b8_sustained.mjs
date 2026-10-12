// B8a: sustained load. Runs the B1 kernel (2048x2048, storage buffers) flat-out and logs throughput every 10 s.
// Also logs process memory (leak check), macOS thermal state (pmset -g therm) and any device-lost / uncaptured error.
// Usage: node b8_sustained.mjs [seconds=400] [grid=2048] [tag]
import { execFileSync } from 'node:child_process';
import { getDevice, now, gpuDone, fmt, saveJSON, readBuffer, deviceLost, benchLockStatus, foreignBenchProcs } from './lib.mjs';
import { makeBufferSim } from './stencil.mjs';

const SECONDS = Number(process.argv[2] ?? 400), GRID = Number(process.argv[3] ?? 2048);
const { device, errors } = await getDevice();
const sim = await makeBufferSim(device, GRID, GRID, { wx: 8, wy: 8 });
const K = 32, AWAIT_EVERY = 2, WINDOW_MS = 10000;
const therm = () => {
  try {
    const t = execFileSync('pmset', ['-g', 'therm'], { encoding: 'utf8' });
    const g = (k) => { const m = t.match(new RegExp(k + '\\s*=\\s*(\\d+)')); return m ? Number(m[1]) : null; };
    return { cpuSpeedLimit: g('CPU_Speed_Limit'), schedulerLimit: g('CPU_Scheduler_Limit'), availableCpus: g('CPU_Available_CPUs'), warning: /No thermal warning level/.test(t) ? 'none' : (t.match(/thermal warning level[^\n]*/i)?.[0] ?? 'unknown') };
  } catch { return null; }
};
const power = () => { try { return execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' }).split('\n')[0]; } catch { return null; } };

const TAG = process.argv[4] ? '_' + process.argv[4] : '';
// other processes using > 30% of a core right now (the GPU shares memory bandwidth with the CPU on this machine)
const busy = () => {
  try {
    return execFileSync('ps', ['-axo', 'pid=,pcpu=,comm='], { encoding: 'utf8' }).split('\n').map((l) => l.trim().match(/^(\d+)\s+([\d.]+)\s+(.*)$/))
      .filter((m) => m && Number(m[1]) !== process.pid && Number(m[2]) > 30).map((m) => `${m[3].split('/').pop()}:${Math.round(Number(m[2]))}%`).join(' ');
  } catch { return ''; }
};
// GPU-side time per step from timestamp queries: separates "the GPU itself got slower" from "submission got delayed"
const qs = device.features.has('timestamp-query') ? device.createQuerySet({ type: 'timestamp', count: 2 }) : null;
const qbuf = qs ? device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }) : null;
async function gpuMsPerStep() {
  if (!qs) return null;
  const e = device.createCommandEncoder();
  sim.encode(e, 8, true, { timestampWrites: { querySet: qs, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } });
  e.resolveQuerySet(qs, 0, 2, qbuf, 0); device.queue.submit([e.finish()]);
  const t = await readBuffer(device, qbuf, 16, 0, BigUint64Array);
  return Number(t[1] - t[0]) / 1e6 / 8;
}
const out = { when: new Date().toISOString(), lock: benchLockStatus(), grid: GRID, cells: GRID * GRID, k: K, awaitEvery: AWAIT_EVERY, power: power(), samples: [] };
console.log(`sustained B1 ${GRID}x${GRID}, ${SECONDS} s, ${K} steps/submit, await every ${AWAIT_EVERY} submits; ${out.power}`);
// warm-up
{ const e = device.createCommandEncoder(); sim.encode(e, 16); device.queue.submit([e.finish()]); await gpuDone(device); }
const tStart = now();
let steps = 0, submits = 0, winSteps = 0, winStart = tStart, totalSteps = 0;
while (now() - tStart < SECONDS * 1000 && !deviceLost()) {
  const enc = device.createCommandEncoder();
  sim.encode(enc, K);
  device.queue.submit([enc.finish()]);
  winSteps += K; submits++;
  if (submits % AWAIT_EVERY === 0) {
    await gpuDone(device);
    const t = now();
    if (t - winStart >= WINDOW_MS) {
      const sps = winSteps / ((t - winStart) / 1000);
      const mu = process.memoryUsage();
      const th = therm();
      const gms = await gpuMsPerStep();
      const s = { tSec: (t - tStart) / 1000, stepsPerSec: sps, cellUpdatesPerSec: sps * sim.cells, gpuMsPerStep: gms, gpuOnlyCellUpdatesPerSec: gms ? sim.cells / (gms / 1000) : null, otherBusyProcesses: busy(), rssMB: mu.rss / 1048576, heapUsedMB: mu.heapUsed / 1048576, externalMB: mu.external / 1048576, therm: th, errors: errors.length };
      out.samples.push(s);
      console.log(`t=${s.tSec.toFixed(0).padStart(4)} s  ${sps.toFixed(1)} steps/s  ${fmt(s.cellUpdatesPerSec)} cell-upd/s  gpu-only ${gms?.toFixed(3)} ms/step  rss ${s.rssMB.toFixed(0)} MB  therm ${th?.warning}  errors ${errors.length}  busy: ${s.otherBusyProcesses}`);
      totalSteps += winSteps; winSteps = 0; winStart = now();
    }
  }
}
await gpuDone(device);
totalSteps += winSteps;
const probe = await readBuffer(device, sim.current(), 65536, 0, Float32Array);
const v = out.samples.map((s) => s.cellUpdatesPerSec);
out.summary = {
  totalSteps, totalCellUpdates: totalSteps * sim.cells, seconds: (now() - tStart) / 1000,
  first: v[0], last: v[v.length - 1], min: Math.min(...v), max: Math.max(...v), mean: v.reduce((a, b) => a + b, 0) / v.length,
  minOverFirstPct: 100 * Math.min(...v) / v[0], lastOverFirstPct: 100 * v[v.length - 1] / v[0],
  rssFirstMB: out.samples[0]?.rssMB, rssLastMB: out.samples[out.samples.length - 1]?.rssMB,
  stateFinite: probe.every(Number.isFinite), deviceLost: deviceLost(), uncapturedErrors: errors.length, foreignAtEnd: foreignBenchProcs(), powerAtEnd: power(),
};
console.log('summary', JSON.stringify(out.summary));
saveJSON(`b8_sustained_${GRID}${TAG}.json`, out);
process.exit(0);
