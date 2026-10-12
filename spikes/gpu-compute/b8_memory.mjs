// B8b: how much GPU buffer memory can be allocated AND USED before failure or heavy slowdown.
// Part 1: a growing set of 512 MB storage buffers (totals 1, 2, 4, 6, 8 GB). Every stage touches every byte: a compute
//         "ring" pass reads buffer j and writes buffer j+1 (LCG on each u32), so memory is really committed, and the
//         result is verified against the CPU. Throughput is reported in GB/s of buffer traffic (read + written).
// Part 2: single large buffers (2, 4.5, 8 GB) bound whole as array<u32>: fill + verify the last element (checks >4 GB offsets).
// Stops escalating when: out-of-memory error, device lost, throughput < 40% of the first stage, or swap grows by > 2 GB.
// Usage: node b8_memory.mjs [maxGB=8] [single-only]
import { execFileSync } from 'node:child_process';
import { getDevice, now, gpuDone, saveJSON, checkedPipeline, readBuffer, deviceLost, benchLockStatus, sleep } from './lib.mjs';

const MAX_GB = Number(process.argv[2] ?? 8);
const { device, errors } = await getDevice();
const GB = 1 << 30, CHUNK = 512 << 20, WORDS = CHUNK / 4;
const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;

function mem() {
  const r = { rssMB: process.memoryUsage().rss / 1048576 };
  try {
    const v = execFileSync('vm_stat', { encoding: 'utf8' });
    const g = (k) => Number((v.match(new RegExp(k + ':\\s+(\\d+)')) ?? [0, 0])[1]) * 16384 / GB;
    r.freeGB = g('Pages free'); r.inactiveGB = g('Pages inactive'); r.wiredGB = g('Pages wired down'); r.compressorGB = g('Pages occupied by compressor');
    r.availableGB = r.freeGB + r.inactiveGB + g('Pages speculative') + g('Pages purgeable');
    const s = execFileSync('sysctl', ['-n', 'vm.swapusage'], { encoding: 'utf8' });
    r.swapUsedGB = Number((s.match(/used = ([\d.]+)M/) ?? [0, 0])[1]) / 1024;
    const p = execFileSync('memory_pressure', ['-Q'], { encoding: 'utf8' });
    r.freePct = Number((p.match(/free percentage: (\d+)%/) ?? [0, 0])[1]);
  } catch {}
  return r;
}
const fmtMem = (m) => `rss ${m.rssMB.toFixed(0)} MB, avail ${m.availableGB?.toFixed(1)} GB, wired ${m.wiredGB?.toFixed(1)} GB, swap ${m.swapUsedGB?.toFixed(2)} GB, sys-free ${m.freePct}%`;

const FILL = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> b: array<u32>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) g: vec3u) {
  let i = g.y * 262144u + g.x;
  if (i < arrayLength(&b)) { b[i] = i; }
}`;
const RING = /* wgsl */ `
@group(0) @binding(0) var<storage, read> src: array<u32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) g: vec3u) {
  let i = g.y * 262144u + g.x;
  if (i < arrayLength(&dst)) { dst[i] = src[i] * 1664525u + 1013904223u; }
}`;
const fill = await checkedPipeline(device, FILL, 'main', 'fill');
const ring = await checkedPipeline(device, RING, 'main', 'ring');
const lcg = (x, n) => { for (let k = 0; k < n; k++) x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x; };

async function createChecked(size) {
  device.pushErrorScope('out-of-memory'); device.pushErrorScope('validation');
  const t0 = now();
  const b = device.createBuffer({ size, usage });
  const v = await device.popErrorScope(), o = await device.popErrorScope();
  if (v || o) { try { b.destroy(); } catch {} return { error: (o ? 'out-of-memory: ' + o.message : 'validation: ' + v.message).slice(0, 300) }; }
  return { buffer: b, createMs: now() - t0 };
}
async function dispatch(pipe, entries, words) {
  const bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries });
  const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(pipe); p.setBindGroup(0, bg);
  p.dispatchWorkgroups(1024, Math.ceil(words / 262144)); p.end(); device.queue.submit([e.finish()]);
}

const out = { when: new Date().toISOString(), lock: benchLockStatus(), start: mem(), stages: [], single: [] };
console.log('start:', fmtMem(out.start));
const bufs = [];
let ops = 0; // number of LCG applications that have produced the current content of bufs[0]
let baseline = null, stop = null;
const SINGLE_ONLY = process.argv.includes('single-only');   // skip part 1 (e.g. after part 1 stopped on swap growth)
for (const total of SINGLE_ONLY ? [] : [1, 2, 4, 6, 8].filter((g) => g <= MAX_GB)) {
  const need = total * GB / CHUNK;
  const st = { totalGB: total, buffers: need };
  const m0 = mem();
  // allocate + first-touch the new buffers
  let t0 = now();
  while (bufs.length < need) {
    const c = await createChecked(CHUNK);
    if (c.error) { st.error = c.error; break; }
    bufs.push(c.buffer);
    await dispatch(fill, [{ binding: 0, resource: { buffer: c.buffer } }], WORDS);
    await gpuDone(device);
  }
  st.allocAndFirstTouchMs = now() - t0;
  if (st.error || deviceLost()) { st.deviceLost = deviceLost(); out.stages.push(st); stop = st.error ?? 'device lost'; console.log(`${total} GB: STOP ${stop}`); break; }
  // new buffers hold i; make the whole ring consistent: restart from bufs[0] = i
  await dispatch(fill, [{ binding: 0, resource: { buffer: bufs[0] } }], WORDS); ops = 0;
  const passes = [];
  for (let r = 0; r < 3; r++) {
    t0 = now();
    for (let j = 0; j < bufs.length; j++) {
      await dispatch(ring, [{ binding: 0, resource: { buffer: bufs[j] } }, { binding: 1, resource: { buffer: bufs[(j + 1) % bufs.length] } }], WORDS);
      if (j % 4 === 3) await gpuDone(device);
    }
    await gpuDone(device);
    ops += bufs.length;
    passes.push(now() - t0);
  }
  // verify three words of bufs[0]
  let ok = true;
  for (const i of [0, WORDS >> 1, WORDS - 1]) { const v = (await readBuffer(device, bufs[0], 4, i * 4, Uint32Array))[0]; if (v !== lcg(i, ops)) ok = false; }
  const gbps = passes.map((ms) => 2 * total / (ms / 1000));
  const m1 = mem();
  Object.assign(st, { ringPassMs: passes, trafficGBps: gbps, steadyGBps: Math.max(...gbps.slice(1)), verified: ok, memBefore: m0, memAfter: m1, deviceLost: deviceLost(), uncapturedErrors: errors.length });
  out.stages.push(st);
  console.log(`${String(total).padStart(2)} GB in ${need} x 512 MB: alloc+first touch ${st.allocAndFirstTouchMs.toFixed(0)} ms; ring passes ${passes.map((p) => p.toFixed(0)).join(' / ')} ms => ${gbps.map((g) => g.toFixed(1)).join(' / ')} GB/s traffic; verified ${ok}; ${fmtMem(m1)}`);
  baseline ??= st.steadyGBps;
  if (!ok) { stop = 'verification failed'; break; }
  if (st.steadyGBps < 0.4 * baseline) { stop = `heavy slowdown (${st.steadyGBps.toFixed(1)} vs ${baseline.toFixed(1)} GB/s)`; break; }
  if (m1.swapUsedGB - out.start.swapUsedGB > 2) { stop = `swap grew by ${(m1.swapUsedGB - out.start.swapUsedGB).toFixed(1)} GB`; break; }
}
out.stoppedBecause = stop;
if (stop) console.log('stopped escalating:', stop);
bufs.forEach((b) => b.destroy()); bufs.length = 0;
await gpuDone(device); await sleep(1500);
console.log('after freeing:', fmtMem(mem()));

// ---- Part 2: single large buffers ----
if (!stop && !deviceLost()) {
  for (const gb of [2, 4.5, 8].filter((g) => g <= MAX_GB)) {
    const size = Math.floor(gb * GB / 4096) * 4096, words = size / 4;
    const rec = { sizeGB: gb, bytes: size };
    const c = await createChecked(size);
    if (c.error) { rec.error = c.error; out.single.push(rec); console.log(`single ${gb} GB buffer: ${c.error}`); break; }
    try {
      const t0 = now();
      await dispatch(fill, [{ binding: 0, resource: { buffer: c.buffer } }], words);
      await gpuDone(device);
      rec.fillMs = now() - t0; rec.fillGBps = gb / (rec.fillMs / 1000);
      const t1 = now();
      await dispatch(fill, [{ binding: 0, resource: { buffer: c.buffer } }], words);
      await gpuDone(device);
      rec.refillMs = now() - t1; rec.refillGBps = gb / (rec.refillMs / 1000);
      let ok = true; const probes = [0, 1, Math.floor(words / 2), words - 2, words - 1];
      for (const i of probes) { const v = (await readBuffer(device, c.buffer, 4, i * 4, Uint32Array))[0]; if (v !== (i >>> 0)) { ok = false; rec.firstBad = { index: i, got: v }; break; } }
      rec.verified = ok; rec.mem = mem(); rec.deviceLost = deviceLost(); rec.uncapturedErrors = errors.length;
      console.log(`single ${gb} GB buffer: first fill ${rec.fillMs.toFixed(0)} ms (${rec.fillGBps.toFixed(1)} GB/s), refill ${rec.refillMs.toFixed(0)} ms (${rec.refillGBps.toFixed(1)} GB/s), last-element check ${ok}; ${fmtMem(rec.mem)}`);
    } catch (e) { rec.error = String(e.message).slice(0, 300); console.log(`single ${gb} GB buffer: FAILED ${rec.error}`); }
    c.buffer.destroy(); await gpuDone(device).catch(() => {}); await sleep(1000);
    out.single.push(rec);
    if (rec.error || rec.deviceLost || rec.mem?.swapUsedGB - out.start.swapUsedGB > 2) break;
  }
}
out.end = mem(); out.deviceLost = deviceLost(); out.uncapturedErrors = errors;
console.log('end:', fmtMem(out.end), ' device lost:', JSON.stringify(deviceLost()), ' uncaptured errors:', errors.length);
saveJSON(SINGLE_ONLY ? 'b8_memory_single.json' : 'b8_memory.json', out);
process.exit(0);
