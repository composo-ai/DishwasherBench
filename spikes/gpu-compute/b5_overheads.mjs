// B5: API overheads. Tiny dispatches, submit cost, round-trip latency, readback (mapAsync) and upload throughput, shader compile time.
// Usage: node b5_overheads.mjs [quick]
import { getDevice, now, gpuDone, stats, tstats, fmt, saveJSON, checkedPipeline, readBuffer, benchLockStatus, foreignBenchProcs } from './lib.mjs';
import { wgslBuffer } from './stencil.mjs';

const quick = process.argv.includes('quick');
const REPS = quick ? 3 : 5;
const { device } = await getDevice();
const out = { when: new Date().toISOString(), lock: benchLockStatus() };

// ---------- (a) tiny compute passes ----------
const tiny = await checkedPipeline(device, /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> c: array<u32>;
@compute @workgroup_size(1) fn main() { c[0] = c[0] + 1u; }`, 'main', 'tiny');
const cnt = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
const tbg = device.createBindGroup({ layout: tiny.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: cnt } }] });
async function counter() { return (await readBuffer(device, cnt, 4, 0, Uint32Array))[0]; }

async function tinyCase(name, N, fn) {
  const rates = []; let ok = true;
  for (let r = 0; r < REPS + 1; r++) {
    device.queue.writeBuffer(cnt, 0, new Uint32Array([0])); await gpuDone(device);
    const t0 = now();
    await fn(N);
    await gpuDone(device);
    const dt = now() - t0;
    if ((await counter()) !== N) ok = false;
    if (r > 0) rates.push(N / (dt / 1000));
  }
  const s = tstats(rates);
  console.log(`${name.padEnd(62)}: ${fmt(s.best)} best / ${fmt(s.median)} med dispatches/s  (${(1e6 / s.median).toFixed(1)} us each, spread ${s.spreadPct.toFixed(0)}%)  all executed: ${ok}`);
  return { name, N, dispatchesPerSec: s, usEachMedian: 1e6 / s.median, allExecuted: ok };
}
out.tiny = [];
const N = quick ? 2000 : 10000;
out.tiny.push(await tinyCase('1 dispatch / pass / encoder / submit (await at end)', N, async (n) => {
  for (let i = 0; i < n; i++) { const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(tiny); p.setBindGroup(0, tbg); p.dispatchWorkgroups(1); p.end(); device.queue.submit([e.finish()]); }
}));
out.tiny.push(await tinyCase('N passes (1 dispatch each) in ONE encoder, one submit', N, async (n) => {
  const e = device.createCommandEncoder();
  for (let i = 0; i < n; i++) { const p = e.beginComputePass(); p.setPipeline(tiny); p.setBindGroup(0, tbg); p.dispatchWorkgroups(1); p.end(); }
  device.queue.submit([e.finish()]);
}));
out.tiny.push(await tinyCase('N dispatches in ONE pass (setBindGroup each), one submit', N, async (n) => {
  const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(tiny);
  for (let i = 0; i < n; i++) { p.setBindGroup(0, tbg); p.dispatchWorkgroups(1); }
  p.end(); device.queue.submit([e.finish()]);
}));
out.tiny.push(await tinyCase('N dispatches in ONE pass (no rebinding), one submit', N, async (n) => {
  const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(tiny); p.setBindGroup(0, tbg);
  for (let i = 0; i < n; i++) p.dispatchWorkgroups(1);
  p.end(); device.queue.submit([e.finish()]);
}));
out.tiny.push(await tinyCase('submit + await onSubmittedWorkDone after EVERY dispatch', quick ? 300 : 1000, async (n) => {
  for (let i = 0; i < n; i++) { const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(tiny); p.setBindGroup(0, tbg); p.dispatchWorkgroups(1); p.end(); device.queue.submit([e.finish()]); await gpuDone(device); }
}));
// tiny readback round trip (dispatch + copy 16 bytes + mapAsync): the cost of polling a scalar from the GPU
{
  const stg = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const ms = [];
  for (let i = 0; i < (quick ? 100 : 400); i++) {
    const t0 = now();
    const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(tiny); p.setBindGroup(0, tbg); p.dispatchWorkgroups(1); p.end();
    e.copyBufferToBuffer(cnt, 0, stg, 0, 16); device.queue.submit([e.finish()]);
    await stg.mapAsync(GPUMapMode.READ); new Uint32Array(stg.getMappedRange())[0]; stg.unmap();
    ms.push(now() - t0);
  }
  const s = stats(ms.slice(20));
  out.scalarRoundTripMs = s;
  console.log(`scalar round trip (dispatch + 16-byte copy + mapAsync, reused staging buffer): ${s.best.toFixed(3)} ms best / ${s.median.toFixed(3)} ms median / ${s.worst.toFixed(3)} worst`);
}

// ---------- (b) readback ----------
out.readback = [];
for (const mb of quick ? [4, 64] : [4, 64, 256]) {
  const size = mb << 20;
  const src = device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  // fill with a compute pass so the pages exist on the GPU side
  const fill = await checkedPipeline(device, /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> b: array<u32>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) g: vec3u) { let i = g.y * 262144u + g.x; if (i < arrayLength(&b)) { b[i] = i * 2654435761u; } }`, 'main', 'fill');
  { const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(fill);
    p.setBindGroup(0, device.createBindGroup({ layout: fill.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: src } }] }));
    p.dispatchWorkgroups(1024, Math.ceil(size / 4 / 262144)); p.end(); device.queue.submit([e.finish()]); await gpuDone(device); }
  const rows = { freshStaging: { copyMapMs: [], getRangeCopyMs: [], totalMs: [] }, reusedStaging: { copyMapMs: [], getRangeCopyMs: [], totalMs: [] }, viewOnly: [] };
  const reused = device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  let checksumOK = true;
  for (let r = 0; r < REPS + 1; r++) {
    for (const mode of ['freshStaging', 'reusedStaging']) {
      const t0 = now();
      const stg = mode === 'freshStaging' ? device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }) : reused;
      const e = device.createCommandEncoder(); e.copyBufferToBuffer(src, 0, stg, 0, size); device.queue.submit([e.finish()]);
      await stg.mapAsync(GPUMapMode.READ);
      const t1 = now();
      const range = stg.getMappedRange();
      const t1b = now();
      const copy = new Uint32Array(range.slice(0));   // copy out of the mapping into JS-owned memory
      const t2 = now();
      const last = copy.length - 1;
      // Math.imul: a plain JS multiply would exceed 2^53 here and give a wrong expected value
      if (copy[last] !== (Math.imul(last, 2654435761) >>> 0) || copy[12345] !== (Math.imul(12345, 2654435761) >>> 0) || copy[last >> 1] !== (Math.imul(last >> 1, 2654435761) >>> 0)) checksumOK = false;
      stg.unmap(); if (mode === 'freshStaging') stg.destroy();
      if (r > 0) { rows[mode].copyMapMs.push(t1 - t0); rows[mode].getRangeCopyMs.push(t2 - t1); rows[mode].totalMs.push(t2 - t0); if (mode === 'reusedStaging') rows.viewOnly.push(t1b - t0); }
    }
  }
  const res = { mb, checksumOK };
  for (const mode of ['freshStaging', 'reusedStaging']) {
    const a = stats(rows[mode].copyMapMs), b = stats(rows[mode].getRangeCopyMs), c = stats(rows[mode].totalMs);
    res[mode] = { copyAndMapMs: a, getMappedRangeAndSliceMs: b, totalMs: c, MBperSecMedian: mb / (c.median / 1000) };
    console.log(`readback ${String(mb).padStart(3)} MB ${mode.padEnd(13)}: GPU copy + mapAsync ${a.best.toFixed(1)}/${a.median.toFixed(1)} ms, getMappedRange + slice ${b.best.toFixed(1)}/${b.median.toFixed(1)} ms, total ${c.best.toFixed(1)}/${c.median.toFixed(1)} ms (best/median) => ${(mb / (c.median / 1000)).toFixed(0)} MB/s  data ok: ${checksumOK}`);
  }
  const v = stats(rows.viewOnly);
  res.zeroCopyViewMs = v;
  console.log(`readback ${String(mb).padStart(3)} MB zero-copy view  : copy + mapAsync + getMappedRange (no slice) ${v.best.toFixed(1)}/${v.median.toFixed(1)} ms => ${(mb / (v.median / 1000)).toFixed(0)} MB/s`);
  out.readback.push(res);
  reused.destroy(); src.destroy();
}

// ---------- (c) upload ----------
out.upload = [];
for (const mb of quick ? [4, 64] : [4, 64, 256]) {
  const size = mb << 20;
  const data = new Uint8Array(size); for (let i = 0; i < size; i += 4096) data[i] = i & 255;
  const dst = device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  const w = [], wCall = [], m = [];
  for (let r = 0; r < REPS + 1; r++) {
    let t0 = now();
    device.queue.writeBuffer(dst, 0, data);
    const tc = now();
    await gpuDone(device);
    if (r > 0) { w.push(now() - t0); wCall.push(tc - t0); }
    t0 = now();
    const b = device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, mappedAtCreation: true });
    new Uint8Array(b.getMappedRange()).set(data); b.unmap();
    await gpuDone(device);
    if (r > 0) m.push(now() - t0);
    b.destroy();
  }
  const sw = stats(w), sc = stats(wCall), sm = stats(m);
  out.upload.push({ mb, writeBufferMs: sw, writeBufferCallMs: sc, mappedAtCreationMs: sm, writeBufferMBps: mb / (sw.median / 1000), mappedAtCreationMBps: mb / (sm.median / 1000) });
  console.log(`upload ${String(mb).padStart(3)} MB: queue.writeBuffer ${sw.best.toFixed(1)}/${sw.median.toFixed(1)} ms (call itself ${sc.median.toFixed(1)} ms) => ${(mb / (sw.median / 1000)).toFixed(0)} MB/s;  ` +
    `mappedAtCreation + set + unmap ${sm.best.toFixed(1)}/${sm.median.toFixed(1)} ms => ${(mb / (sm.median / 1000)).toFixed(0)} MB/s`);
  dst.destroy();
}

// ---------- (d) shader compile / pipeline creation (cold: a numeric literal is perturbed so the generated MSL really differs) ----------
{
  const ms = [], first = [];
  for (let r = 0; r < REPS + 1; r++) {
    const code = wgslBuffer(8, 8).replace('0.125 *', `${(0.125 + (r + 1) * 1e-6 + Math.random() * 1e-7).toFixed(10)} *`);
    const t0 = now();
    const pipe = await checkedPipeline(device, code, 'main', 'compile-probe');
    const t1 = now();
    // first use: some backends compile lazily, so time the first dispatch through the new pipeline as well
    const ubo = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ubo, 0, new Uint32Array([8, 8, 0, 0, 0, 0, 0, 0]));
    const a = device.createBuffer({ size: 1024, usage: GPUBufferUsage.STORAGE }), b = device.createBuffer({ size: 1024, usage: GPUBufferUsage.STORAGE });
    const bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: { buffer: a } }, { binding: 2, resource: { buffer: b } }] });
    const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(pipe); p.setBindGroup(0, bg); p.dispatchWorkgroups(1, 1); p.end(); device.queue.submit([e.finish()]);
    await gpuDone(device);
    const t2 = now();
    if (r > 0) { ms.push(t1 - t0); first.push(t2 - t1); }
    a.destroy(); b.destroy(); ubo.destroy();
  }
  const s = stats(ms), f = stats(first);
  out.pipelineCreateMs = s; out.firstDispatchMs = f;
  console.log(`createShaderModule + createComputePipelineAsync (B1 stencil WGSL, cold): ${s.best.toFixed(1)} ms best / ${s.median.toFixed(1)} ms median; first dispatch through it: ${f.best.toFixed(1)} / ${f.median.toFixed(1)} ms`);
}
out.foreignAtEnd = foreignBenchProcs();
saveJSON(quick ? 'b5_overheads_quick.json' : 'b5_overheads.json', out);
process.exit(0);
