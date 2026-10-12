// B3(i): closest-hit ray tracing against a BVH over ~1M triangles (stack-based traversal in WGSL, BVH built on the CPU in JS).
// Usage: node b3a_bvh.mjs [quick]
import { getDevice, now, gpuDone, tstats, fmt, saveJSON, checkedPipeline, upload, readBuffer, benchLockStatus, foreignBenchProcs } from './lib.mjs';
import { makeObjects, tessellate, raysCoherent, raysIncoherent, raysMixed } from './scene.mjs';
import { buildBVH, traceJS } from './bvh.mjs';

const quick = process.argv.includes('quick');
const REPS = quick ? 3 : 5;

const WGSL = (wg, stackSize) => /* wgsl */ `
struct Node { mn: vec3f, leftFirst: u32, mx: vec3f, count: u32 };
struct Tri { v0: vec3f, id: u32, e1: vec3f, p1: u32, e2: vec3f, p2: u32 };
struct Ray { o: vec3f, tmin: f32, d: vec3f, tmax: f32 };
struct Hit { t: f32, prim: u32, steps: u32, tris: u32 };
struct Params { n: u32, row: u32, pad0: u32, pad1: u32 };
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;
@group(0) @binding(2) var<storage, read> tris: array<Tri>;
@group(0) @binding(3) var<storage, read> rays: array<Ray>;
@group(0) @binding(4) var<storage, read_write> hits: array<Hit>;

fn slab(i: u32, o: vec3f, inv: vec3f, tmin: f32, tmax: f32) -> f32 {
  let t0 = (nodes[i].mn - o) * inv;
  let t1 = (nodes[i].mx - o) * inv;
  let a = min(t0, t1);
  let b = max(t0, t1);
  let tn = max(max(a.x, a.y), max(a.z, tmin));
  let tf = min(min(b.x, b.y), min(b.z, tmax));
  return select(1e30, tn, tn <= tf);
}

@compute @workgroup_size(${wg})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y * P.row + gid.x;
  if (i >= P.n) { return; }
  let r = rays[i];
  let inv = 1.0 / r.d;
  var best = r.tmax;
  var prim = 0xffffffffu;
  var steps = 0u;
  var ntri = 0u;
  var stack: array<u32, ${stackSize}>;
  var sp = 0u;
  var node = 0u;
  if (slab(0u, r.o, inv, r.tmin, best) < 1e30) {
    loop {
      steps++;
      let cnt = nodes[node].count;
      let lf = nodes[node].leftFirst;
      if (cnt > 0u) {
        for (var k = lf; k < lf + cnt; k++) {
          let T = tris[k];
          ntri++;
          let p = cross(r.d, T.e2);
          let det = dot(T.e1, p);
          if (abs(det) >= 1e-20) {
            let idet = 1.0 / det;
            let s = r.o - T.v0;
            let u = dot(s, p) * idet;
            let q = cross(s, T.e1);
            let v = dot(r.d, q) * idet;
            let t = dot(T.e2, q) * idet;
            if (u >= 0.0 && v >= 0.0 && u + v <= 1.0 && t > r.tmin && t < best) { best = t; prim = T.id; }
          }
        }
        if (sp == 0u) { break; }
        sp--; node = stack[sp];
      } else {
        let d1 = slab(lf, r.o, inv, r.tmin, best);
        let d2 = slab(lf + 1u, r.o, inv, r.tmin, best);
        var near = lf; var far = lf + 1u; var dn = d1; var df = d2;
        if (d2 < d1) { near = lf + 1u; far = lf; dn = d2; df = d1; }
        if (dn >= 1e30) {
          if (sp == 0u) { break; }
          sp--; node = stack[sp];
        } else {
          node = near;
          if (df < 1e30) { stack[sp] = far; sp++; }
        }
      }
    }
  }
  hits[i] = Hit(best, prim, steps, ntri);
}`;

// ---------- scene + BVH ----------
const out = { when: new Date().toISOString(), lock: null, scene: {}, cases: [] };
let t0 = now();
const objs = makeObjects(quick ? 100 : 400);
const mesh = tessellate(objs);
const tessMs = now() - t0;
const builds = [];
let bvh;
for (let r = 0; r < (quick ? 1 : 3); r++) { bvh = buildBVH(mesh.verts, mesh.nTri); builds.push(bvh.buildMs); }
builds.sort((a, b) => a - b);
out.scene = { objects: objs.count, triangles: mesh.nTri, tessellateMs: tessMs, bvhBuildMsBest: builds[0], bvhBuildMsMedian: builds[builds.length >> 1],
  nodes: bvh.nodeCount, leaves: bvh.leaves, maxDepth: bvh.maxDepth, nodeBytes: bvh.nodes.byteLength, triBytes: bvh.tris.byteLength };
console.log(`scene: ${objs.count} objects, ${fmt(mesh.nTri)} triangles (tessellate ${tessMs.toFixed(0)} ms)`);
console.log(`BVH build (JS, 1 thread, binned SAH): best ${builds[0].toFixed(0)} ms, median ${builds[builds.length >> 1].toFixed(0)} ms; ${fmt(bvh.nodeCount)} nodes, ${fmt(bvh.leaves)} leaves, depth ${bvh.maxDepth}; ` +
  `${(bvh.nodes.byteLength / 1e6).toFixed(1)} MB nodes + ${(bvh.tris.byteLength / 1e6).toFixed(1)} MB triangles`);
if (bvh.maxDepth > 60) throw new Error('BVH too deep for the fixed traversal stack');

const { device } = await getDevice();
out.lock = benchLockStatus();
const STACK = 64;
const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
const nodeB = device.createBuffer({ size: bvh.nodes.byteLength, usage }); upload(device, nodeB, bvh.nodes);
const triB = device.createBuffer({ size: bvh.tris.byteLength, usage }); upload(device, triB, bvh.tris);

async function makeTracer(wg) {
  const pipeline = await checkedPipeline(device, WGSL(wg, STACK), 'main', 'bvh-trace');
  return { pipeline, wg };
}
const tracers = { 64: await makeTracer(64) };
if (!quick) tracers[256] = await makeTracer(256);

async function trace(tr, rays, n) {
  const { pipeline, wg } = tr;
  const rayB = device.createBuffer({ size: n * 32, usage }); upload(device, rayB, rays);
  const hitB = device.createBuffer({ size: n * 16, usage });
  const gxMax = 1024, row = gxMax * wg, gx = Math.min(gxMax, Math.ceil(n / wg)), gy = Math.ceil(n / row);
  const ubo = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(ubo, 0, new Uint32Array([n, row, 0, 0]));
  const bg = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: { buffer: nodeB } }, { binding: 2, resource: { buffer: triB } },
    { binding: 3, resource: { buffer: rayB } }, { binding: 4, resource: { buffer: hitB } }] });
  await gpuDone(device); // uploads complete before timing
  const run = async () => {
    const t = now();
    const enc = device.createCommandEncoder();
    const p = enc.beginComputePass(); p.setPipeline(pipeline); p.setBindGroup(0, bg); p.dispatchWorkgroups(gx, gy); p.end();
    device.queue.submit([enc.finish()]);
    await gpuDone(device);
    return now() - t;
  };
  await run(); // warm-up
  const ms = []; for (let r = 0; r < REPS; r++) ms.push(await run());
  const hits = await readBuffer(device, hitB, n * 16, 0, Uint8Array);
  rayB.destroy(); hitB.destroy(); ubo.destroy();
  return { ms, hitsF: new Float32Array(hits.buffer), hitsU: new Uint32Array(hits.buffer) };
}

function mortonSortRays(rays, n) {
  const key = new Uint32Array(n);
  const p3 = (v) => { v &= 1023; v = (v | (v << 16)) & 0x030000ff; v = (v | (v << 8)) & 0x0300f00f; v = (v | (v << 4)) & 0x030c30c3; v = (v | (v << 2)) & 0x09249249; return v; };
  for (let i = 0; i < n; i++) key[i] = (p3(rays[i * 8] * 2047) | (p3(rays[i * 8 + 1] * 2047) << 1) | (p3(rays[i * 8 + 2] * 2047) << 2)) >>> 0;
  const order = new Uint32Array(n); for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => key[a] - key[b]);
  const o = new Float32Array(n * 8);
  for (let i = 0; i < n; i++) o.set(rays.subarray(order[i] * 8, order[i] * 8 + 8), i * 8);
  return o;
}

function validate(rays, n, res, samples = 1500) {
  let bad = 0, primMismatch = 0, maxErr = 0;
  const step = Math.max(1, Math.floor(n / samples));
  let c = 0;
  for (let i = 0; i < n; i += step) {
    const [t, prim] = traceJS(bvh, rays[i * 8], rays[i * 8 + 1], rays[i * 8 + 2], rays[i * 8 + 4], rays[i * 8 + 5], rays[i * 8 + 6], rays[i * 8 + 3], rays[i * 8 + 7]);
    const tg = res.hitsF[i * 4], pg = res.hitsU[i * 4 + 1];
    const hitJ = prim !== 0xffffffff, hitG = pg !== 0xffffffff;
    if (hitJ !== hitG) bad++;
    else if (hitJ) { const e = Math.abs(t - tg) / Math.max(1e-6, t); if (e > maxErr) maxErr = e; if (e > 1e-3) bad++; if (prim !== pg) primMismatch++; }
    c++;
  }
  return { sampled: c, disagreements: bad, primMismatch, maxRelErrT: maxErr };
}

for (const n of quick ? [1 << 20] : [1 << 20, 1 << 22]) {
  console.log(`\n=== ${fmt(n)} rays ===`);
  const sets = [
    ['coherent (16 jet cones)', () => raysCoherent(n)],
    ['incoherent (random o,d)', () => raysIncoherent(n)],
    ['mixed 50/50', () => raysMixed(n)],
    ['incoherent, Morton-sorted by origin', () => mortonSortRays(raysIncoherent(n), n)],
    ['incoherent short segments (tmax 1 cm)', () => raysIncoherent(n, undefined, 0, 0.01)],
    ['mixed 50/50 short segments (tmax 1 cm)', () => raysMixed(n, 0.01)],
  ];
  for (const [name, mk] of sets) {
    const rays = mk();
    for (const wg of name.startsWith('mixed 50/50') && !quick && !name.includes('short') ? [64, 256] : [64]) {
      const res = await trace(tracers[wg], rays, n);
      const rps = tstats(res.ms.map((m) => n / (m / 1000)));
      let hit = 0, steps = 0, tris = 0;
      for (let i = 0; i < n; i++) { if (res.hitsU[i * 4 + 1] !== 0xffffffff) hit++; steps += res.hitsU[i * 4 + 2]; tris += res.hitsU[i * 4 + 3]; }
      const val = wg === 64 ? validate(rays, n, res) : null;
      out.cases.push({ rays: n, set: name, workgroup: wg, raysPerSec: rps, msBest: Math.min(...res.ms), hitFraction: hit / n, meanNodeVisits: steps / n, meanTriTests: tris / n, validation: val });
      console.log(`${name.padEnd(40)} wg=${String(wg).padStart(3)}: ${fmt(rps.best)} best / ${fmt(rps.median)} med rays/s (${Math.min(...res.ms).toFixed(1)} ms, spread ${rps.spreadPct.toFixed(0)}%)  ` +
        `hit ${(100 * hit / n).toFixed(1)}%  nodes/ray ${(steps / n).toFixed(1)}  tris/ray ${(tris / n).toFixed(1)}` +
        (val ? `  check vs JS: ${val.disagreements}/${val.sampled} disagree, ${val.primMismatch} prim-id diffs, max rel err ${val.maxRelErrT.toExponential(1)}` : ''));
    }
  }
}
out.foreignAtEnd = foreignBenchProcs();
saveJSON(quick ? 'b3a_bvh_quick.json' : 'b3a_bvh.json', out);
process.exit(0);
