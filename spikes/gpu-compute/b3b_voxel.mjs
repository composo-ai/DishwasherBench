// B3(ii): rays against a dense voxel grid (256^3 and 512^3).
//   - the grid is a signed-distance field of the same procedural scene, voxelised ON THE GPU (timed: this is what
//     "voxelise the loaded dishwasher" costs),
//   - kernels: DDA over bit-packed occupancy (storage buffer), sphere tracing with trilinear r32float 3D-texture sampling,
//     sphere tracing with nearest textureLoad, sphere tracing on a flat f32 storage buffer.
// Usage: node b3b_voxel.mjs [quick]
import { getDevice, now, gpuDone, tstats, fmt, saveJSON, checkedPipeline, upload, readBuffer, benchLockStatus, foreignBenchProcs } from './lib.mjs';
import { makeObjects, SDF_WGSL, raysCoherent, raysIncoherent, raysMixed, BOX } from './scene.mjs';

const quick = process.argv.includes('quick');
const REPS = quick ? 3 : 5;
const { device } = await getDevice();
const out = { when: new Date().toISOString(), lock: benchLockStatus(), grids: [], cases: [] };
const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;

const GEN = /* wgsl */ `
${SDF_WGSL}
struct GP { n: u32, nObj: u32, z0: u32, pad: u32, voxel: f32, p0: f32, p1: f32, p2: f32 };
@group(0) @binding(0) var<uniform> G: GP;
@group(0) @binding(1) var<storage, read> objs: array<Obj>;
@group(0) @binding(2) var sdfOut: texture_storage_3d<r32float, write>;
@compute @workgroup_size(8, 8, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let c = vec3u(gid.xy, gid.z + G.z0);
  if (c.x >= G.n || c.y >= G.n || c.z >= G.n) { return; }
  let p = (vec3f(c) + 0.5) * G.voxel;
  var d = 1e9;
  for (var i = 0u; i < G.nObj; i++) {
    let o = objs[i];
    if (length(p - o.c) - (o.R + o.r) < d) { d = min(d, sdObj(o, p)); }   // bounding-sphere early-out
  }
  textureStore(sdfOut, c, vec4f(d, 0.0, 0.0, 0.0));
}`;

// one invocation packs 32 voxels along x into one occupancy word
const PACK = /* wgsl */ `
struct GP { n: u32, nObj: u32, z0: u32, pad: u32, voxel: f32, p0: f32, p1: f32, p2: f32 };
@group(0) @binding(0) var<uniform> G: GP;
@group(0) @binding(1) var sdf: texture_3d<f32>;
@group(0) @binding(2) var<storage, read_write> bits: array<u32>;
@compute @workgroup_size(4, 8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let wpr = G.n / 32u;
  if (gid.x >= wpr || gid.y >= G.n || gid.z >= G.n) { return; }
  var w = 0u;
  for (var b = 0u; b < 32u; b++) {
    let d = textureLoad(sdf, vec3u(gid.x * 32u + b, gid.y, gid.z), 0).r;
    if (d < 0.5 * G.voxel) { w |= (1u << b); }
  }
  bits[(gid.z * G.n + gid.y) * wpr + gid.x] = w;
}`;

const RAY_COMMON = /* wgsl */ `
struct Ray { o: vec3f, tmin: f32, d: vec3f, tmax: f32 };
struct Hit { t: f32, steps: u32 };
struct RP { n: u32, row: u32, grid: u32, maxSteps: u32, voxel: f32, box: f32, p0: f32, p1: f32 };
@group(0) @binding(0) var<uniform> P: RP;
@group(0) @binding(1) var<storage, read> rays: array<Ray>;
@group(0) @binding(2) var<storage, read_write> hits: array<Hit>;
`;

const DDA = /* wgsl */ `
${RAY_COMMON}
@group(0) @binding(3) var<storage, read> bits: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y * P.row + gid.x;
  if (i >= P.n) { return; }
  let r = rays[i];
  let n = i32(P.grid);
  let inv = 1.0 / P.voxel;
  let p = r.o * inv;
  var c = clamp(vec3i(floor(p)), vec3i(0), vec3i(n - 1));
  let stp = vec3i(sign(r.d));
  let dsafe = select(r.d, vec3f(1e-20), abs(r.d) < vec3f(1e-20));
  let tDelta = abs(P.voxel / dsafe);
  var tMax = ((vec3f(c) + max(vec3f(stp), vec3f(0.0))) - p) * P.voxel / dsafe;
  var t = 0.0;
  var steps = 0u;
  var hit = -1.0;
  loop {
    if (steps >= P.maxSteps || t > r.tmax) { break; }
    if (c.x < 0 || c.y < 0 || c.z < 0 || c.x >= n || c.y >= n || c.z >= n) { break; }
    let idx = u32(c.x) + P.grid * (u32(c.y) + P.grid * u32(c.z));
    if (((bits[idx >> 5u] >> (idx & 31u)) & 1u) != 0u && t >= r.tmin) { hit = t; break; }
    steps++;
    if (tMax.x < tMax.y && tMax.x < tMax.z) { t = tMax.x; tMax.x += tDelta.x; c.x += stp.x; }
    else if (tMax.y < tMax.z) { t = tMax.y; tMax.y += tDelta.y; c.y += stp.y; }
    else { t = tMax.z; tMax.z += tDelta.z; c.z += stp.z; }
  }
  hits[i] = Hit(hit, steps);
}`;

const sphere = (mode) => /* wgsl */ `
${RAY_COMMON}
${mode === 'linear' ? '@group(0) @binding(3) var sdf: texture_3d<f32>;\n@group(0) @binding(4) var smp: sampler;'
    : mode === 'nearest' ? '@group(0) @binding(3) var sdf: texture_3d<f32>;'
      : '@group(0) @binding(3) var<storage, read> sdfB: array<f32>;'}
fn dist(p: vec3f) -> f32 {
  ${mode === 'linear' ? 'return textureSampleLevel(sdf, smp, p / P.box, 0.0).r;'
    : mode === 'nearest' ? 'let c = clamp(vec3i(p / P.voxel), vec3i(0), vec3i(i32(P.grid) - 1)); return textureLoad(sdf, c, 0).r;'
      : 'let c = vec3u(clamp(vec3i(p / P.voxel), vec3i(0), vec3i(i32(P.grid) - 1))); return sdfB[c.x + P.grid * (c.y + P.grid * c.z)];'}
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y * P.row + gid.x;
  if (i >= P.n) { return; }
  let r = rays[i];
  var t = r.tmin;
  var steps = 0u;
  var hit = -1.0;
  let eps = 0.5 * P.voxel;
  loop {
    if (steps >= P.maxSteps || t > r.tmax) { break; }
    let p = r.o + r.d * t;
    if (any(p < vec3f(0.0)) || any(p > vec3f(P.box))) { break; }
    let d = dist(p);
    if (d < eps) { hit = t; break; }
    t += max(d - 0.25 * P.voxel, 0.5 * P.voxel);
    steps++;
  }
  hits[i] = Hit(hit, steps);
}`;

const objs = makeObjects(quick ? 100 : 400);
const objB = device.createBuffer({ size: objs.data.byteLength, usage }); upload(device, objB, objs.data);
const genPipe = await checkedPipeline(device, GEN, 'main', 'sdf-gen');
const packPipe = await checkedPipeline(device, PACK, 'main', 'occ-pack');
const kernels = {
  'DDA / bit-packed occupancy buffer': { pipe: await checkedPipeline(device, DDA, 'main', 'dda'), kind: 'dda' },
  'sphere trace / r32float 3D texture, trilinear sampler': { pipe: await checkedPipeline(device, sphere('linear'), 'main', 'st-linear'), kind: 'linear' },
  'sphere trace / r32float 3D texture, textureLoad nearest': { pipe: await checkedPipeline(device, sphere('nearest'), 'main', 'st-nearest'), kind: 'nearest' },
  'sphere trace / f32 storage buffer, nearest': { pipe: await checkedPipeline(device, sphere('buffer'), 'main', 'st-buffer'), kind: 'buffer' },
};
const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge' });

for (const N of quick ? [256] : [256, 512]) {
  const voxel = BOX / N;
  console.log(`\n=== grid ${N}^3 (${fmt(N ** 3)} voxels, voxel ${(voxel * 1000).toFixed(2)} mm) ===`);
  const sdfTex = device.createTexture({ size: [N, N, N], dimension: '3d', format: 'r32float',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
  const gp = (z0) => { const ab = new ArrayBuffer(32); const dv = new DataView(ab); dv.setUint32(0, N, true); dv.setUint32(4, objs.count, true); dv.setUint32(8, z0, true); dv.setFloat32(16, voxel, true); return ab; };
  // --- voxelise: one submit per 16-slice slab, each with its own uniform buffer ---
  const SLAB = 16;
  let t0 = now();
  const view = sdfTex.createView();
  const tmpU = [];
  for (let z0 = 0; z0 < N; z0 += SLAB) {
    const ubo = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ubo, 0, gp(z0)); tmpU.push(ubo);
    const bg = device.createBindGroup({ layout: genPipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: { buffer: objB } }, { binding: 2, resource: view }] });
    const enc = device.createCommandEncoder(); const p = enc.beginComputePass();
    p.setPipeline(genPipe); p.setBindGroup(0, bg); p.dispatchWorkgroups(N / 8, N / 8, SLAB / 4); p.end();
    device.queue.submit([enc.finish()]);
  }
  await gpuDone(device);
  const genMs = now() - t0;
  tmpU.forEach((u) => u.destroy());
  // --- pack occupancy bits ---
  const bitsB = device.createBuffer({ size: (N ** 3) / 8, usage });
  const ubo0 = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); device.queue.writeBuffer(ubo0, 0, gp(0));
  t0 = now();
  {
    const bg = device.createBindGroup({ layout: packPipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: ubo0 } }, { binding: 1, resource: view }, { binding: 2, resource: { buffer: bitsB } }] });
    const enc = device.createCommandEncoder(); const p = enc.beginComputePass();
    p.setPipeline(packPipe); p.setBindGroup(0, bg); p.dispatchWorkgroups(Math.ceil(N / 32 / 4), N / 8, N / 8); p.end();
    device.queue.submit([enc.finish()]);
    await gpuDone(device);
  }
  const packMs = now() - t0;
  // --- SDF copy into a flat buffer ---
  const sdfB = device.createBuffer({ size: N ** 3 * 4, usage });
  t0 = now();
  { const enc = device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: sdfTex }, { buffer: sdfB, bytesPerRow: N * 4, rowsPerImage: N }, [N, N, N]); device.queue.submit([enc.finish()]); await gpuDone(device); }
  const copyMs = now() - t0;
  // occupancy statistics
  const bits = await readBuffer(device, bitsB, (N ** 3) / 8, 0, Uint32Array);
  let occ = 0; for (let i = 0; i < bits.length; i++) { let v = bits[i]; v = v - ((v >>> 1) & 0x55555555); v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); occ += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }
  const ginfo = { N, voxelMm: voxel * 1000, sdfVoxeliseMs: genMs, objects: objs.count, voxelObjectEvalsPerSec: N ** 3 * objs.count / (genMs / 1000), occupancyPackMs: packMs, texToBufferCopyMs: copyMs, occupiedFraction: occ / N ** 3 };
  out.grids.push(ginfo);
  console.log(`GPU voxelise SDF of ${objs.count} analytic objects: ${genMs.toFixed(0)} ms (${fmt(ginfo.voxelObjectEvalsPerSec)} voxel-object tests/s); pack occupancy ${packMs.toFixed(0)} ms; tex->buffer copy ${copyMs.toFixed(0)} ms; occupied ${(100 * occ / N ** 3).toFixed(2)}%`);

  for (const n of quick ? [1 << 20] : [1 << 20, 1 << 22]) {
    const sets = [['mixed 50/50', raysMixed(n)], ['coherent (16 jet cones)', raysCoherent(n)], ['incoherent (random o,d)', raysIncoherent(n)], ['mixed 50/50 short segments (tmax 1 cm)', raysMixed(n, 0.01)]];
    for (const [setName, rays] of sets) {
      const rayB = device.createBuffer({ size: n * 32, usage }); upload(device, rayB, rays);
      const hitB = device.createBuffer({ size: n * 8, usage });
      for (const [kname, k] of Object.entries(kernels)) {
        if (setName !== 'mixed 50/50' && !(k.kind === 'dda' || k.kind === 'linear')) continue;
        const wg = 64, gxMax = 1024, row = gxMax * wg, gx = Math.min(gxMax, Math.ceil(n / wg)), gy = Math.ceil(n / row);
        const ubo = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const ab = new ArrayBuffer(32); const dv = new DataView(ab);
        dv.setUint32(0, n, true); dv.setUint32(4, row, true); dv.setUint32(8, N, true); dv.setUint32(12, k.kind === 'dda' ? 3 * N : 512, true); dv.setFloat32(16, voxel, true); dv.setFloat32(20, BOX, true);
        device.queue.writeBuffer(ubo, 0, ab);
        const entries = [{ binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: { buffer: rayB } }, { binding: 2, resource: { buffer: hitB } }];
        if (k.kind === 'dda') entries.push({ binding: 3, resource: { buffer: bitsB } });
        else if (k.kind === 'buffer') entries.push({ binding: 3, resource: { buffer: sdfB } });
        else { entries.push({ binding: 3, resource: view }); if (k.kind === 'linear') entries.push({ binding: 4, resource: sampler }); }
        const bg = device.createBindGroup({ layout: k.pipe.getBindGroupLayout(0), entries });
        await gpuDone(device);
        const run = async () => {
          const t = now(); const enc = device.createCommandEncoder(); const p = enc.beginComputePass();
          p.setPipeline(k.pipe); p.setBindGroup(0, bg); p.dispatchWorkgroups(gx, gy); p.end();
          device.queue.submit([enc.finish()]); await gpuDone(device); return now() - t;
        };
        await run();
        const ms = []; for (let r = 0; r < REPS; r++) ms.push(await run());
        const hb = await readBuffer(device, hitB, n * 8, 0, Uint8Array);
        const hf = new Float32Array(hb.buffer), hu = new Uint32Array(hb.buffer);
        let hit = 0, steps = 0, tsum = 0;
        for (let i = 0; i < n; i++) { if (hf[i * 2] >= 0) { hit++; tsum += hf[i * 2]; } steps += hu[i * 2 + 1]; }
        const rps = tstats(ms.map((m) => n / (m / 1000)));
        out.cases.push({ grid: N, rays: n, set: setName, kernel: kname, raysPerSec: rps, msBest: Math.min(...ms), hitFraction: hit / n, meanSteps: steps / n, meanHitT: tsum / Math.max(1, hit) });
        console.log(`${fmt(n).padStart(6)} rays ${setName.padEnd(38)} ${kname.padEnd(56)}: ${fmt(rps.best)} best / ${fmt(rps.median)} med rays/s (${Math.min(...ms).toFixed(1)} ms, spread ${rps.spreadPct.toFixed(0)}%)  hit ${(100 * hit / n).toFixed(1)}%  steps/ray ${(steps / n).toFixed(1)}  mean t ${(tsum / Math.max(1, hit)).toFixed(4)}`);
        ubo.destroy();
      }
      rayB.destroy(); hitB.destroy();
    }
  }
  sdfTex.destroy(); bitsB.destroy(); sdfB.destroy(); ubo0.destroy();
}
out.foreignAtEnd = foreignBenchProcs();
saveJSON(quick ? 'b3b_voxel_quick.json' : 'b3b_voxel.json', out);
process.exit(0);
