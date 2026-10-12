// B1 extras: is the stencil limited by arithmetic or by memory traffic?
//   baseline      : vec4f storage buffers (16 B/cell)
//   double-math   : same buffers, the update evaluated twice per cell (2x flops, same bytes)
//   f16 buffers   : array<vec4<f16>> (8 B/cell), arithmetic still in f32 (needs shader-f16)
//   rgba16float   : storage textures at 8 B/cell
//   rgba32float   : storage textures at 16 B/cell (reference)
// Usage: node b1x_extras.mjs            (DAWN_FLAGS="enable-dawn-features=disable_robustness" to test without bounds clamps)
import { getDevice, now, gpuDone, tstats, fmt, saveJSON, checkedPipeline, upload, readBuffer, benchLockStatus, foreignBenchProcs } from './lib.mjs';
import { wgslBuffer, wgslTexture, initState, paramsBuffer } from './stencil.mjs';

const { device } = await getDevice();
const REPS = 5, K = 32;
const tag = process.env.DAWN_FLAGS ? ` [${process.env.DAWN_FLAGS}]` : '';
const out = { when: new Date().toISOString(), lock: benchLockStatus(), dawnFlags: process.env.DAWN_FLAGS ?? null, cases: [] };

const base = wgslBuffer(8, 8);
const STORE = 'dst[gid.y * P.w + gid.x] = update(at(x, y), at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1));';
if (!base.includes(STORE)) throw new Error('stencil source changed; update b1x_extras.mjs');
const doubleMath = base.replace(STORE, `let a = update(at(x, y), at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1));
  let b = update(at(x, y), at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1));
  dst[gid.y * P.w + gid.x] = 0.5 * (a + b);`);
const f16 = 'enable f16;\n' + base
  .replace('var<storage, read> src: array<vec4f>;', 'var<storage, read> src: array<vec4<f16>>;')
  .replace('var<storage, read_write> dst: array<vec4f>;', 'var<storage, read_write> dst: array<vec4<f16>>;')
  .replace('return src[yc * P.w + xc];', 'return vec4f(src[yc * P.w + xc]);')
  .replace(STORE, 'dst[gid.y * P.w + gid.x] = vec4<f16>(update(at(x, y), at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)));');
const tex32 = wgslTexture(8, 8, 'sampled');
const tex16 = tex32.replaceAll('rgba32float', 'rgba16float');

const TO16BUF = /* wgsl */ `enable f16;
@group(0) @binding(0) var<storage, read> a: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> b: array<vec4<f16>>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) g: vec3u) { let i = g.y * 262144u + g.x; if (i < arrayLength(&b)) { b[i] = vec4<f16>(a[i]); } }`;
const TOTEX = (fmtName) => /* wgsl */ `
@group(0) @binding(0) var<storage, read> a: array<vec4f>;
@group(0) @binding(1) var t: texture_storage_2d<${fmtName}, write>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) g: vec3u) { let d = textureDimensions(t); if (g.x < d.x && g.y < d.y) { textureStore(t, vec2i(g.xy), a[g.y * d.x + g.x]); } }`;

async function run(name, w, h, code, storage, bytesPerCell) {
  const pipe = await checkedPipeline(device, code, 'main', name);
  const init = initState(w, h);
  const srcF32 = device.createBuffer({ size: w * h * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  upload(device, srcF32, init);
  const ubo = paramsBuffer(device, w, h);
  let res, views;
  if (storage === 'buf32') {
    res = [srcF32, device.createBuffer({ size: w * h * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC })];
    views = res.map((b) => ({ buffer: b }));
  } else if (storage === 'buf16') {
    res = [0, 1].map(() => device.createBuffer({ size: w * h * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }));
    const cp = await checkedPipeline(device, TO16BUF, 'main', 'to16');
    const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(cp);
    p.setBindGroup(0, device.createBindGroup({ layout: cp.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: srcF32 } }, { binding: 1, resource: { buffer: res[0] } }] }));
    p.dispatchWorkgroups(1024, Math.ceil(w * h / 262144)); p.end(); device.queue.submit([e.finish()]);
    views = res.map((b) => ({ buffer: b }));
  } else {
    const format = storage;
    res = [0, 1].map(() => device.createTexture({ size: [w, h], format, usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC }));
    const cp = await checkedPipeline(device, TOTEX(format), 'main', 'totex');
    const e = device.createCommandEncoder(); const p = e.beginComputePass(); p.setPipeline(cp);
    p.setBindGroup(0, device.createBindGroup({ layout: cp.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: srcF32 } }, { binding: 1, resource: res[0].createView() }] }));
    p.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8)); p.end(); device.queue.submit([e.finish()]);
    views = res.map((t) => t.createView());
  }
  const bg = [0, 1].map((i) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: views[i] }, { binding: 2, resource: views[1 - i] }] }));
  let cur = 0;
  const steps = async (total) => {
    const t0 = now();
    for (let d = 0; d < total; d += K) {
      const e = device.createCommandEncoder();
      for (let i = 0; i < K; i++) { const p = e.beginComputePass(); p.setPipeline(pipe); p.setBindGroup(0, bg[cur]); p.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8)); p.end(); cur ^= 1; }
      device.queue.submit([e.finish()]);
    }
    await gpuDone(device);
    return now() - t0;
  };
  await steps(K);
  const cal = (await steps(K)) / K;
  const total = Math.max(K, Math.ceil(1000 / cal / K) * K);
  const v = []; for (let r = 0; r < REPS; r++) v.push(total * w * h / ((await steps(total)) / 1000));
  const s = tstats(v);
  out.cases.push({ name, w, h, bytesPerCell, cellUpdatesPerSec: s, trafficGBps: s.median * bytesPerCell * 2 / 1e9 });
  console.log(`${(w + 'x' + h).padEnd(10)} ${name.padEnd(46)}: ${fmt(s.best)} best / ${fmt(s.median)} med cell-upd/s  (spread ${s.spreadPct.toFixed(1)}%)  net traffic ~${(s.median * bytesPerCell * 2 / 1e9).toFixed(0)} GB/s${tag}`);
  for (const r of res) r.destroy(); if (storage !== 'buf32') srcF32.destroy(); ubo.destroy();
}

for (const [w, h] of [[2048, 2048], [4096, 4096]]) {
  await run('vec4f buffers (baseline, 16 B/cell)', w, h, base, 'buf32', 16);
  await run('vec4f buffers, update evaluated twice (2x flops)', w, h, doubleMath, 'buf32', 16);
  if (device.features.has('shader-f16')) await run('vec4<f16> buffers (8 B/cell), f32 arithmetic', w, h, f16, 'buf16', 8);
  await run('rgba32float textures (16 B/cell)', w, h, tex32, 'rgba32float', 16);
  await run('rgba16float textures (8 B/cell)', w, h, tex16, 'rgba16float', 8);
}
out.foreignAtEnd = foreignBenchProcs();
saveJSON(process.env.DAWN_FLAGS ? 'b1x_extras_flags.json' : 'b1x_extras.json', out);
process.exit(0);
