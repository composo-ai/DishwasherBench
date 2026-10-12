// B8c: what really happens with storage buffers at and beyond 4 GiB (the adapter advertises maxBufferSize = 9 GiB).
// For each size: create, bind whole as array<u32>, (a) report arrayLength() as seen by the shader, (b) write b[i] = i for
// i < n where n comes from a uniform (so the test does not depend on arrayLength), (c) read back probes.
// Also: bind a 256 MB window at a >4 GiB offset of a large buffer.
// Usage: node b8_bigbuffer.mjs
import { getDevice, now, gpuDone, saveJSON, checkedPipeline, readBuffer, deviceLost, benchLockStatus, sleep } from './lib.mjs';
const { device, errors } = await getDevice();
const GiB = 2 ** 30;
const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
const FILL = /* wgsl */ `
struct U { n: u32, base: u32, pad0: u32, pad1: u32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> b: array<u32>;
@group(0) @binding(2) var<storage, read_write> info: array<u32>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) g: vec3u) {
  let i = g.y * 262144u + g.x;
  if (i == 0u) { info[0] = arrayLength(&b); }
  if (i < u.n) { b[i] = i + u.base; }
}`;
const pipe = await checkedPipeline(device, FILL, 'main', 'bigfill');
const infoB = device.createBuffer({ size: 16, usage });
async function fill(buffer, words, base = 0, offset = undefined, size = undefined) {
  const ubo = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(ubo, 0, new Uint32Array([words, base, 0, 0]));
  device.pushErrorScope('validation');
  const res = offset === undefined ? { buffer } : { buffer, offset, size };
  const bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: res }, { binding: 2, resource: { buffer: infoB } }] });
  const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(pipe); p.setBindGroup(0, bg); p.dispatchWorkgroups(1024, Math.ceil(words / 262144)); p.end();
  const t0 = now(); device.queue.submit([e.finish()]); await gpuDone(device);
  const err = await device.popErrorScope();
  ubo.destroy();
  return { ms: now() - t0, error: err?.message?.slice(0, 200) ?? null, arrayLengthSeen: (await readBuffer(device, infoB, 4, 0, Uint32Array))[0] };
}
const out = { when: new Date().toISOString(), lock: benchLockStatus(), cases: [] };
for (const [label, size] of [['3.5 GiB', 3.5 * GiB], ['4 GiB - 4 KiB', 4 * GiB - 4096], ['4 GiB exactly', 4 * GiB], ['4 GiB + 4 KiB', 4 * GiB + 4096], ['4.5 GiB', 4.5 * GiB]]) {
  const words = size / 4;
  const rec = { label, bytes: size, words };
  device.pushErrorScope('out-of-memory'); device.pushErrorScope('validation');
  const b = device.createBuffer({ size, usage });
  const v = await device.popErrorScope(), o = await device.popErrorScope();
  if (v || o) { rec.createError = (v ?? o).message.slice(0, 200); out.cases.push(rec); console.log(label, 'create failed:', rec.createError); continue; }
  const f = await fill(b, Math.min(words, 0xffffffff));
  Object.assign(rec, { fillMs: f.ms, fillError: f.error, arrayLengthSeen: f.arrayLengthSeen, arrayLengthExpected: words });
  rec.probes = [];
  for (const i of [0, 1, (2 ** 29) - 1, 2 ** 29, Math.floor(words / 2), words - 2, words - 1]) {
    if (i >= words) continue;
    const got = (await readBuffer(device, b, 4, i * 4, Uint32Array))[0];
    rec.probes.push({ index: i, byteOffsetGiB: (i * 4 / GiB).toFixed(3), got, ok: got === (i >>> 0) });
  }
  rec.allOk = rec.probes.every((p) => p.ok);
  console.log(`${label.padEnd(14)} (${size} bytes): arrayLength seen ${rec.arrayLengthSeen} expected ${words}  fill ${f.ms.toFixed(0)} ms  error ${f.error}  probes ok: ${rec.allOk}` +
    (rec.allOk ? '' : '  bad: ' + rec.probes.filter((p) => !p.ok).map((p) => `[${p.index} @${p.byteOffsetGiB} GiB got ${p.got}]`).join(' ')));
  if (size > 4 * GiB) {
    // window binding beyond 4 GiB: 256 MB at offset 4 GiB + 4 KiB... offset must be a multiple of 256
    const off = 4 * GiB + 65536, wsize = 64 * 2 ** 20, wwords = wsize / 4;
    if (off + wsize <= size) {
      const w = await fill(b, wwords, 0x10000000, off, wsize);
      const a = (await readBuffer(device, b, 4, off, Uint32Array))[0], z = (await readBuffer(device, b, 4, off + wsize - 4, Uint32Array))[0];
      const low = (await readBuffer(device, b, 4, off - 4 * GiB, Uint32Array))[0];   // where a 32-bit-wrapped offset would land
      rec.window = { offset: off, size: wsize, error: w.error, arrayLengthSeen: w.arrayLengthSeen, arrayLengthExpected: wwords, first: a, last: z, ok: a === 0x10000000 && z === ((0x10000000 + wwords - 1) >>> 0), valueAtWrappedOffset: low, wrappedOffsetWasOverwritten: low === 0x10000000 };
      console.log(`   64 MB window bound at offset 4 GiB + 64 KiB: arrayLength seen ${w.arrayLengthSeen} (expected ${wwords}), error ${w.error}, contents ok: ${rec.window.ok}, write landed at wrapped (low) offset instead: ${rec.window.wrappedOffsetWasOverwritten}`);
    }
  }
  rec.deviceLost = deviceLost(); rec.uncapturedErrors = errors.length;
  out.cases.push(rec);
  b.destroy(); await gpuDone(device); await sleep(800);
}
saveJSON('b8_bigbuffer.json', out);
process.exit(0);
