// B7: bitwise reproducibility. B1 (200 steps) and B4 (atomics scatter), run-to-run, across batching/workgroup/format
// variations, across devices and processes, and against CPU references.
// Usage: node b7_determinism.mjs            (full)
//        node b7_determinism.mjs --child    (prints hashes only; used for the cross-process check)
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDevice, gpuDone, hashBytes, readBuffer, saveJSON, now, benchLockStatus, OUT } from './lib.mjs';
import { makeBufferSim, makeTextureSim, initState, jsStepF32 } from './stencil.mjs';
import { makeMPM, initParticles } from './mpm.mjs';

const child = process.argv.includes('--child');
const log = (...a) => { if (!child) console.log(...a); };
const { device } = await getDevice();
const same = (a, b) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
function diffStats(a, b) { // a, b Float32Array
  let n = 0, mx = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(Number.isNaN(a[i]) && Number.isNaN(b[i]))) { n++; const d = Math.abs(a[i] - b[i]); if (d > mx) mx = d; }
  return { differingFloats: n, ofFloats: a.length, maxAbsDiff: mx };
}

async function runB1(dev, w, h, steps, { k = 16, onePass = false, wx = 8, wy = 8, kind = 'buffer', init = null } = {}) {
  const sim = kind === 'buffer' ? await makeBufferSim(dev, w, h, { wx, wy, init }) : await makeTextureSim(dev, w, h, { wx, wy, readMode: kind, init });
  let done = 0;
  while (done < steps) { const n = Math.min(k, steps - done); const enc = dev.createCommandEncoder(); sim.encode(enc, n, onePass); dev.queue.submit([enc.finish()]); done += n; }
  let res;
  if (kind === 'buffer') res = await readBuffer(dev, sim.current(), w * h * 16, 0, Float32Array);
  else {
    const tmp = dev.createBuffer({ size: w * h * 16, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    const enc = dev.createCommandEncoder(); sim.copyToBuffer(enc, tmp); dev.queue.submit([enc.finish()]);
    res = await readBuffer(dev, tmp, w * h * 16, 0, Float32Array); tmp.destroy();
  }
  sim.destroy();
  return res;
}
async function runB4(dev, particles, np, { mode = 'fixed', steps = 20, wg = 64, scatterOnly = false } = {}) {
  const sim = await makeMPM(dev, { np, G: 256, mode, wg, particles });
  if (scatterOnly) {
    const enc = dev.createCommandEncoder(); sim.encodeScatter(enc); dev.queue.submit([enc.finish()]);
    const g = await readBuffer(dev, sim.gridV, 256 ** 3 * 16, 0, Float32Array); sim.destroy(); return g;
  }
  for (let s = 0; s < steps; s += 4) { const enc = dev.createCommandEncoder(); sim.encode(enc, Math.min(4, steps - s)); dev.queue.submit([enc.finish()]); }
  const p = await readBuffer(dev, sim.partB, np * 80, 0, Float32Array); sim.destroy(); return p;
}

const STEPS = 200;
const out = { when: new Date().toISOString(), lock: benchLockStatus(), b1: {}, b4: {} };

// ================= B1 =================
const W = 1024, H = 1024;
const base = await runB1(device, W, H, STEPS);
const baseHash = hashBytes(new Uint8Array(base.buffer));
const NP = 1 << 20;
const pDisp = initParticles(NP, 256, 'dispersed', 'shuffled');
const b4base = await runB4(device, pDisp, NP, { mode: 'fixed' });
const b4Hash = hashBytes(new Uint8Array(b4base.buffer));
if (child) { console.log(JSON.stringify({ b1: baseHash, b4: b4Hash })); process.exit(0); }

log(`B1 ${W}x${H}, ${STEPS} steps, storage buffers 8x8, k=16: hash ${baseHash}`);
const finite = base.every(Number.isFinite); let nonTrivial = 0; for (let i = 0; i < base.length; i += 4) if (base[i] !== base[0]) { nonTrivial = 1; break; }
out.b1.baseline = { w: W, h: H, steps: STEPS, hash: baseHash, finite, nonUniform: !!nonTrivial };
log(`  state finite: ${finite}, non-uniform: ${!!nonTrivial}`);
out.b1.checks = [];
const check = async (name, fn) => {
  const r = await fn();
  const identical = same(base, r);
  const d = identical ? null : diffStats(base, r);
  out.b1.checks.push({ name, identical, ...(d ?? {}) });
  log(`  ${name.padEnd(64)}: ${identical ? 'BITWISE IDENTICAL' : `DIFFERS (${d.differingFloats}/${d.ofFloats} floats, max |diff| ${d.maxAbsDiff.toExponential(2)})`}`);
};
await check('second run, same device, same settings', () => runB1(device, W, H, STEPS));
await check('third run', () => runB1(device, W, H, STEPS));
await check('1 dispatch per submit (k=1)', () => runB1(device, W, H, STEPS, { k: 1 }));
await check('all 200 dispatches in one pass / one submit', () => runB1(device, W, H, STEPS, { k: 200, onePass: true }));
await check('workgroup 16x16', () => runB1(device, W, H, STEPS, { wx: 16, wy: 16 }));
await check('workgroup 256x1', () => runB1(device, W, H, STEPS, { wx: 256, wy: 1 }));
await check('rgba32float texture formulation (sampled read)', () => runB1(device, W, H, STEPS, { kind: 'sampled' }));
await check('rgba32float texture formulation (storage read)', () => runB1(device, W, H, STEPS, { kind: 'storage' }));
{
  const { device: dev2 } = await getDevice();
  await check('a second GPUDevice in the same process', () => runB1(dev2, W, H, STEPS));
}
{ // CPU references
  let a = initState(W, H), b = new Float32Array(a.length);
  const t0 = now();
  for (let s = 0; s < STEPS; s++) { jsStepF32(a, b, W, H); [a, b] = [b, a]; }
  log(`  (JS f32 reference took ${((now() - t0) / 1000).toFixed(1)} s)`);
  await check('vs JS reference with Math.fround (strict f32, no FMA)', async () => a);
  // first step only: isolates per-step rounding differences from accumulated drift
  const g1 = await runB1(device, W, H, 1, { k: 1 });
  let a1 = initState(W, H), b1 = new Float32Array(a1.length); jsStepF32(a1, b1, W, H);
  const d1 = diffStats(g1, b1);
  out.b1.firstStepVsJS = d1;
  log(`  after ONE step, GPU vs JS f32 reference: ${d1.differingFloats}/${d1.ofFloats} floats differ, max |diff| ${d1.maxAbsDiff.toExponential(2)}`);
}
{ // C strict reference, if the binary and the init dump exist (2048x2048)
  const here = fileURLToPath(new URL('.', import.meta.url));
  const bin = here + 'b6_stencil_strict', bin2 = here + 'b6_stencil_default';
  if (existsSync(bin)) {
    const w2 = 1024, h2 = 1024;
    const initPath = `${OUT}/init_${w2}x${h2}.bin`;
    writeFileSync(initPath, new Uint8Array(initState(w2, h2).buffer));
    for (const [label, b] of [['C clang -O3 -ffp-contract=off (strict)', bin], ['C clang -O3 default (fp-contract=on, FMA allowed)', bin2]]) {
      if (!existsSync(b)) continue;
      const outPath = `${OUT}/c_result.bin`;
      execFileSync(b, [String(w2), String(h2), '1', '1', '1', initPath, outPath, String(STEPS)]);
      const c = new Float32Array(readFileSync(outPath).buffer.slice(0));
      await check(`vs ${label}`, async () => c);
    }
  }
}
// cross-process
{
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child'], { env: { ...process.env, BENCH_NOLOCK: '1' }, encoding: 'utf8' });
  let ch = null; try { ch = JSON.parse(r.stdout.trim().split('\n').pop()); } catch {}
  out.crossProcess = { childHashes: ch, b1Identical: ch?.b1 === baseHash, b4Identical: ch?.b4 === b4Hash };
  log(`  ${'a separate node process (new Dawn instance)'.padEnd(64)}: B1 ${ch?.b1 === baseHash ? 'BITWISE IDENTICAL' : 'DIFFERS'}, B4 ${ch?.b4 === b4Hash ? 'BITWISE IDENTICAL' : 'DIFFERS'}`);
}

// ================= B4 =================
log(`\nB4 MLS-MPM, 1M particles on 256^3, 20 steps: fixed-point atomicAdd hash ${b4Hash}`);
out.b4.baselineHash = b4Hash; out.b4.finite = b4base.every(Number.isFinite); out.b4.checks = [];
const check4 = async (name, ref, fn) => {
  const r = await fn();
  const identical = same(ref, r);
  const d = identical ? null : diffStats(ref, r);
  out.b4.checks.push({ name, identical, ...(d ?? {}) });
  log(`  ${name.padEnd(72)}: ${identical ? 'BITWISE IDENTICAL' : `DIFFERS (${d.differingFloats}/${d.ofFloats} floats, max |diff| ${d.maxAbsDiff.toExponential(2)})`}`);
  return r;
};
await check4('fixed-point i32 atomicAdd: second run (dispersed, shuffled)', b4base, () => runB4(device, pDisp, NP, { mode: 'fixed' }));
await check4('fixed-point i32 atomicAdd: third run', b4base, () => runB4(device, pDisp, NP, { mode: 'fixed' }));
await check4('fixed-point i32 atomicAdd: workgroup 256 instead of 64', b4base, () => runB4(device, pDisp, NP, { mode: 'fixed', wg: 256 }));
const pBlock = initParticles(NP, 256, 'block', 'sorted');
const blk = await runB4(device, pBlock, NP, { mode: 'fixed' });
await check4('fixed-point, dense block (8 particles/cell, heavy contention): 2nd run', blk, () => runB4(device, pBlock, NP, { mode: 'fixed' }));
// grid after one scatter must not depend on particle ORDER when accumulation is integer
const pBlockSh = initParticles(NP, 256, 'block', 'shuffled');
const gA = await runB4(device, pBlock, NP, { mode: 'fixed', scatterOnly: true });
await check4('fixed-point: grid after scatter, particles in shuffled order vs sorted order', gA, () => runB4(device, pBlockSh, NP, { mode: 'fixed', scatterOnly: true }));
// float CAS accumulation
const fA = await runB4(device, pBlock, NP, { mode: 'floatcas' });
await check4('f32 compare-exchange accumulation, dense block: second run', fA, () => runB4(device, pBlock, NP, { mode: 'floatcas' }));
const fD = await runB4(device, pDisp, NP, { mode: 'floatcas' });
await check4('f32 compare-exchange accumulation, dispersed: second run', fD, () => runB4(device, pDisp, NP, { mode: 'floatcas' }));
const gF = await runB4(device, pBlock, NP, { mode: 'floatcas', scatterOnly: true });
await check4('f32 CAS: grid after ONE scatter, second run', gF, () => runB4(device, pBlock, NP, { mode: 'floatcas', scatterOnly: true }));
await check4('f32 CAS: grid after scatter, shuffled vs sorted particle order', gF, () => runB4(device, pBlockSh, NP, { mode: 'floatcas', scatterOnly: true }));
saveJSON('b7_determinism.json', out);
process.exit(0);
