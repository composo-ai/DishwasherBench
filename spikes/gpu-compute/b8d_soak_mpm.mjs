// B8d: long soak on a multi-pass pipeline. Runs the B4 MLS-MPM step (atomics scatter + 256^3 grid pass + gather,
// ~620 MB of GPU buffers at 1M particles) flat-out and logs every 30 s. Purpose: robustness of a realistic pipeline over
// many minutes (errors, device loss, memory growth, throughput drift), complementing the B1 sustained run.
// Usage: node b8d_soak_mpm.mjs [seconds=900] [particles=1048576]
import { execFileSync } from 'node:child_process';
import { getDevice, now, gpuDone, fmt, saveJSON, readBuffer, deviceLost, benchLockStatus } from './lib.mjs';
import { makeMPM, initParticles } from './mpm.mjs';

const SECONDS = Number(process.argv[2] ?? 900), NP = Number(process.argv[3] ?? 1 << 20);
const { device, errors } = await getDevice();
const sim = await makeMPM(device, { np: NP, G: 256, mode: 'fixed', particles: initParticles(NP, 256, 'dispersed', 'shuffled') });
const busy = () => {
  try {
    return execFileSync('ps', ['-axo', 'pid=,pcpu=,comm='], { encoding: 'utf8' }).split('\n').map((l) => l.trim().match(/^(\d+)\s+([\d.]+)\s+(.*)$/))
      .filter((m) => m && Number(m[1]) !== process.pid && Number(m[2]) > 30).map((m) => `${m[3].split('/').pop()}:${Math.round(Number(m[2]))}%`).join(' ');
  } catch { return ''; }
};
const power = () => { try { return execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' }).split('\n')[0]; } catch { return null; } };
const out = { when: new Date().toISOString(), lock: benchLockStatus(), particles: NP, grid: 256, power: power(), samples: [] };
console.log(`MPM soak: ${fmt(NP)} particles, 256^3 grid, ${SECONDS} s; ${out.power}`);
const K = 4, WINDOW_MS = 30000;
{ const e = device.createCommandEncoder(); sim.encode(e, 2); device.queue.submit([e.finish()]); await gpuDone(device); }
const tStart = now();
let winSteps = 0, winStart = tStart, total = 0, submits = 0;
while (now() - tStart < SECONDS * 1000 && !deviceLost()) {
  const enc = device.createCommandEncoder(); sim.encode(enc, K); device.queue.submit([enc.finish()]);
  winSteps += K; submits++;
  if (submits % 2 === 0) {
    await gpuDone(device);
    const t = now();
    if (t - winStart >= WINDOW_MS) {
      const sps = winSteps / ((t - winStart) / 1000);
      const probe = await readBuffer(device, sim.partB, 80 * 1024, 0, Float32Array);
      let zsum = 0; for (let i = 0; i < 1024; i++) zsum += probe[i * 20 + 2];
      const s = { tSec: (t - tStart) / 1000, stepsPerSec: sps, particleStepsPerSec: sps * NP, rssMB: process.memoryUsage().rss / 1048576, finite: probe.every(Number.isFinite), meanZ: zsum / 1024, errors: errors.length, otherBusyProcesses: busy() };
      out.samples.push(s);
      console.log(`t=${s.tSec.toFixed(0).padStart(4)} s  ${sps.toFixed(1)} steps/s  ${fmt(s.particleStepsPerSec)} particle-steps/s  rss ${s.rssMB.toFixed(0)} MB  finite ${s.finite}  mean z ${s.meanZ.toFixed(3)}  errors ${errors.length}  busy: ${s.otherBusyProcesses}`);
      total += winSteps; winSteps = 0; winStart = now();
    }
  }
}
await gpuDone(device); total += winSteps;
const v = out.samples.map((s) => s.particleStepsPerSec);
out.summary = { seconds: (now() - tStart) / 1000, totalSteps: total, totalParticleSteps: total * NP, first: v[0], last: v[v.length - 1], min: Math.min(...v), max: Math.max(...v), mean: v.reduce((a, b) => a + b, 0) / v.length,
  rssFirstMB: out.samples[0]?.rssMB, rssLastMB: out.samples[out.samples.length - 1]?.rssMB, allFinite: out.samples.every((s) => s.finite), deviceLost: deviceLost(), uncapturedErrors: errors.length, powerAtEnd: power() };
console.log('summary', JSON.stringify(out.summary));
saveJSON('b8d_soak_mpm.json', out);
process.exit(0);
