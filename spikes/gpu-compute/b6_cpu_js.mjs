// B6 (i)+(ii): the B1 stencil on the CPU in JavaScript. Single thread and worker_threads + SharedArrayBuffer.
// Usage: node b6_cpu_js.mjs [quick]     (takes the benchmark lock so it does not overlap GPU runs)
import { Worker } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import { acquireBenchLock, benchLockStatus } from './benchlock.mjs';
import { initState, jsStepF32, jsStepF64 } from './stencil_js.mjs';

await acquireBenchLock();
const quick = process.argv.includes('quick');
const W = 2048, H = 2048, CELLS = W * H;
const REPS = quick ? 3 : 5, STEPS = quick ? 3 : 6;
const now = () => performance.now();
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const fmt = (x) => (x / 1e6).toFixed(1) + 'M';
const out = { when: new Date().toISOString(), lock: benchLockStatus(), w: W, h: H, cases: [] };
const checksum = (a) => { let s = 0; for (let i = 0; i < a.length; i += 97) s += a[i]; return s; };

const init = initState(W, H);
// also dump the initial state so the C baseline and the determinism test start from identical bits
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL(`./out/init_${W}x${H}.bin`, import.meta.url), new Uint8Array(init.buffer));

// ---- single thread ----
const ref = {};
for (const [name, step] of [['f64 intermediates (idiomatic)', jsStepF64], ['f32 via Math.fround (bit-faithful)', jsStepF32]]) {
  let a = Float32Array.from(init), b = new Float32Array(a.length);
  for (let s = 0; s < 4; s++) { step(a, b, W, H); [a, b] = [b, a]; } // JIT warm-up
  const rates = [];
  for (let r = 0; r < REPS; r++) {
    const t0 = now();
    for (let s = 0; s < STEPS; s++) { step(a, b, W, H); [a, b] = [b, a]; }
    rates.push(CELLS * STEPS / ((now() - t0) / 1000));
  }
  const best = Math.max(...rates), m = med(rates);
  out.cases.push({ impl: 'JS single thread', variant: name, threads: 1, cellUpdatesPerSec: { best, median: m }, spreadPct: 100 * (best - Math.min(...rates)) / m });
  console.log(`JS 1 thread, ${name.padEnd(34)}: ${fmt(best)} best / ${fmt(m)} med cell-updates/s`);
  // reference result for the worker correctness check: 4 + REPS*STEPS steps from init
  ref[name.startsWith('f64') ? 'f64' : 'f32'] = { steps: 4 + REPS * STEPS, sum: checksum(a) };
}

// ---- worker_threads + SharedArrayBuffer ----
async function runWorkers(T, variant) {
  const sabA = new SharedArrayBuffer(CELLS * 16), sabB = new SharedArrayBuffer(CELLS * 16), sabCtl = new SharedArrayBuffer(16);
  const a = new Float32Array(sabA), ctl = new Int32Array(sabCtl);
  a.set(init);
  const workers = [];
  for (let t = 0; t < T; t++) {
    const y0 = Math.floor((H * t) / T), y1 = Math.floor((H * (t + 1)) / T);
    workers.push(new Worker(new URL('./b6_worker.mjs', import.meta.url), { workerData: { sabA, sabB, sabCtl, w: W, h: H, y0, y1, variant } }));
  }
  await Promise.all(workers.map((w) => new Promise((res) => w.once('online', res))));
  await new Promise((r) => setTimeout(r, 300)); // let every worker reach Atomics.wait
  let nSteps = 0;
  const stepAll = () => {
    Atomics.store(ctl, 1, 0);
    Atomics.add(ctl, 0, 1);
    Atomics.notify(ctl, 0);
    for (;;) { const d = Atomics.load(ctl, 1); if (d >= T) break; Atomics.wait(ctl, 1, d, 2000); }
    nSteps++;
  };
  for (let s = 0; s < 4; s++) stepAll(); // warm-up (JIT in every worker)
  const rates = [];
  for (let r = 0; r < REPS; r++) {
    const t0 = now();
    for (let s = 0; s < STEPS; s++) stepAll();
    rates.push(CELLS * STEPS / ((now() - t0) / 1000));
  }
  // nSteps is even or odd: result lives in b when odd
  const res = nSteps & 1 ? new Float32Array(sabB) : a;
  const sum = checksum(res);
  Atomics.store(ctl, 2, 1); Atomics.add(ctl, 0, 1); Atomics.notify(ctl, 0);
  await Promise.all(workers.map((w) => new Promise((res2) => w.once('exit', res2))));
  return { rates, sum, nSteps };
}
for (const variant of ['f64', 'f32']) {
  for (const T of quick ? [5] : [2, 5, 8, 11]) {
    const { rates, sum, nSteps } = await runWorkers(T, variant);
    const best = Math.max(...rates), m = med(rates);
    const matches = nSteps === ref[variant].steps ? sum === ref[variant].sum : null;
    out.cases.push({ impl: 'JS worker_threads + SharedArrayBuffer', variant, threads: T, cellUpdatesPerSec: { best, median: m }, spreadPct: 100 * (best - Math.min(...rates)) / m, matchesSingleThread: matches });
    console.log(`JS ${String(T).padStart(2)} workers (${variant}): ${fmt(best)} best / ${fmt(m)} med cell-updates/s   spread ${(100 * (best - Math.min(...rates)) / m).toFixed(0)}%  identical to 1-thread result: ${matches}`);
  }
}
writeFileSync(new URL(`./out/${quick ? 'b6_cpu_js_quick' : 'b6_cpu_js'}.json`, import.meta.url), JSON.stringify(out, null, 2));
process.exit(0);
