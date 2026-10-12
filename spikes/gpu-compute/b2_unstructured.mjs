// B2: unstructured finite-volume stencil on a triangle mesh with explicit neighbour indices.
// Per cell: state vec4f (16 B), neighbours vec4u (16 B: 3 ids + flags), geometry 2 x vec4f (32 B: 3 scaled edge normals, 1/area).
// Kernel: Rusanov-flux shallow-water update over the 3 edges (~130 flops, 4 reciprocals, 3 sqrt, 1 branch).
// Orderings: row-major (coherent), Morton (coherent), random shuffle.
// Usage: node b2_unstructured.mjs [quick]
import { getDevice, now, gpuDone, tstats, fmt, saveJSON, checkedPipeline, upload, mulberry32, readBuffer, benchLockStatus, foreignBenchProcs } from './lib.mjs';

const quick = process.argv.includes('quick');
const REPS = quick ? 3 : 5;
const TARGET_MS = quick ? 500 : 1000;
const { device } = await getDevice();

const WGSL = (wg) => /* wgsl */ `
struct Params { n: u32, row: u32, dt: f32, g: f32, alpha: f32, eps: f32, fric: f32, pad: f32 };
struct Geom { n01: vec4f, n2a: vec4f };   // (n0.xy, n1.xy), (n2.xy, invArea, pad)
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec4f>;
@group(0) @binding(3) var<storage, read> nbr: array<vec4u>;
@group(0) @binding(4) var<storage, read> geom: array<Geom>;
fn fluxN(U: vec4f, n: vec2f) -> vec4f {
  let ih = 1.0 / max(U.x, P.eps);
  let un = (U.y * n.x + U.z * n.y) * ih;
  let p = 0.5 * P.g * U.x * U.x;
  return vec4f(U.x * un, U.y * un + p * n.x, U.z * un + p * n.y, U.w * un);
}
fn edge(Uc: vec4f, Un: vec4f, n: vec2f) -> vec4f {
  return 0.5 * (fluxN(Uc, n) + fluxN(Un, n)) - 0.5 * P.alpha * length(n) * (Un - Uc);
}
@compute @workgroup_size(${wg})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y * P.row + gid.x;
  if (i >= P.n) { return; }
  let Uc = src[i];
  let nb = nbr[i];
  let G = geom[i];
  var acc = edge(Uc, src[nb.x], G.n01.xy);
  acc += edge(Uc, src[nb.y], G.n01.zw);
  acc += edge(Uc, src[nb.z], G.n2a.xy);
  var n = Uc - P.dt * G.n2a.z * acc;
  if (n.x < P.eps) {
    n = vec4f(max(n.x, 0.0), 0.0, 0.0, max(n.w, 0.0));
  } else {
    let s = n.x / (n.x + P.fric);
    n = vec4f(n.x, n.y * s, n.z * s, max(n.w, 0.0));
  }
  dst[i] = n;
}`;

function part1by1(v) { v &= 0xffff; v = (v | (v << 8)) & 0x00ff00ff; v = (v | (v << 4)) & 0x0f0f0f0f; v = (v | (v << 2)) & 0x33333333; v = (v | (v << 1)) & 0x55555555; return v; }

/** Build the mesh in row-major order: cell id = 2*(y*W+x)+t. */
function buildMesh(W, H) {
  const N = 2 * W * H;
  const state = new Float32Array(N * 4), nbr = new Uint32Array(N * 4), geom = new Float32Array(N * 8);
  const id = (x, y, t) => 2 * (y * W + x) + t;
  const kx = (2 * Math.PI * 3) / W, ky = (2 * Math.PI * 2) / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const hh = Math.max(0, 0.15 + 0.5 * Math.sin(x * kx) * Math.sin(y * ky) + 0.25 * Math.cos(x * kx * 3.7) * Math.cos(y * ky * 2.5));
    for (let t = 0; t < 2; t++) {
      const i = id(x, y, t), g = i * 8;
      state[i * 4] = hh; state[i * 4 + 1] = 0.1 * hh; state[i * 4 + 2] = -0.05 * hh; state[i * 4 + 3] = hh * 0.5;
      let n0, n1, n2;
      if (t === 0) { // verts (x,y),(x+1,y),(x,y+1): edges bottom (0,-1), hypotenuse (1,1), left (-1,0)
        n0 = y > 0 ? id(x, y - 1, 1) : i; n1 = id(x, y, 1); n2 = x > 0 ? id(x - 1, y, 1) : i;
        geom[g] = 0; geom[g + 1] = -1; geom[g + 2] = 1; geom[g + 3] = 1; geom[g + 4] = -1; geom[g + 5] = 0;
      } else { // verts (x+1,y),(x+1,y+1),(x,y+1): edges right (1,0), top (0,1), hypotenuse (-1,-1)
        n0 = x < W - 1 ? id(x + 1, y, 0) : i; n1 = y < H - 1 ? id(x, y + 1, 0) : i; n2 = id(x, y, 0);
        geom[g] = 1; geom[g + 1] = 0; geom[g + 2] = 0; geom[g + 3] = 1; geom[g + 4] = -1; geom[g + 5] = -1;
      }
      geom[g + 6] = 2.0;
      nbr[i * 4] = n0; nbr[i * 4 + 1] = n1; nbr[i * 4 + 2] = n2; nbr[i * 4 + 3] = t;
    }
  }
  return { N, W, H, state, nbr, geom };
}

/** Renumber cells: perm[old] = new. */
function permute(mesh, perm) {
  const { N } = mesh;
  const state = new Float32Array(N * 4), nbr = new Uint32Array(N * 4), geom = new Float32Array(N * 8);
  for (let i = 0; i < N; i++) {
    const j = perm[i];
    state[j * 4] = mesh.state[i * 4]; state[j * 4 + 1] = mesh.state[i * 4 + 1]; state[j * 4 + 2] = mesh.state[i * 4 + 2]; state[j * 4 + 3] = mesh.state[i * 4 + 3];
    nbr[j * 4] = perm[mesh.nbr[i * 4]]; nbr[j * 4 + 1] = perm[mesh.nbr[i * 4 + 1]]; nbr[j * 4 + 2] = perm[mesh.nbr[i * 4 + 2]]; nbr[j * 4 + 3] = mesh.nbr[i * 4 + 3];
    for (let k = 0; k < 8; k++) geom[j * 8 + k] = mesh.geom[i * 8 + k];
  }
  return { ...mesh, state, nbr, geom };
}
function randomPerm(N, seed = 1234) {
  const p = new Uint32Array(N); for (let i = 0; i < N; i++) p[i] = i;
  const rnd = mulberry32(seed);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  return p;
}
function mortonPerm(mesh) {
  const { N, W, H } = mesh;
  const keys = new Float64Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = (part1by1(x) | (part1by1(y) << 1)) >>> 0;
    keys[2 * (y * W + x)] = m * 2; keys[2 * (y * W + x) + 1] = m * 2 + 1;
  }
  const order = new Uint32Array(N); for (let i = 0; i < N; i++) order[i] = i;
  order.sort((a, b) => keys[a] - keys[b]);
  const perm = new Uint32Array(N); for (let r = 0; r < N; r++) perm[order[r]] = r;
  return perm;
}
/** Mean |i - neighbour| in cell ids: a coherence metric. */
function meanNbrDist(m) {
  let s = 0; const step = Math.max(1, Math.floor(m.N / 200000)); let c = 0;
  for (let i = 0; i < m.N; i += step) { for (let k = 0; k < 3; k++) s += Math.abs(m.nbr[i * 4 + k] - i); c += 3; }
  return s / c;
}

async function makeSim(mesh, wg = 64) {
  const { N } = mesh;
  const pipeline = await checkedPipeline(device, WGSL(wg), 'main', 'fv-unstructured');
  const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
  const bufs = [0, 1].map(() => device.createBuffer({ size: N * 16, usage }));
  const nbrB = device.createBuffer({ size: N * 16, usage });
  const geomB = device.createBuffer({ size: N * 32, usage });
  upload(device, bufs[0], mesh.state); upload(device, nbrB, mesh.nbr); upload(device, geomB, mesh.geom);
  const gxMax = 1024; const row = gxMax * wg;
  const gx = Math.min(gxMax, Math.ceil(N / wg)), gy = Math.ceil(N / row);
  const ab = new ArrayBuffer(32); const dv = new DataView(ab);
  dv.setUint32(0, N, true); dv.setUint32(4, row, true); dv.setFloat32(8, 0.05, true); dv.setFloat32(12, 1.0, true);
  dv.setFloat32(16, 1.5, true); dv.setFloat32(20, 1e-4, true); dv.setFloat32(24, 0.002, true);
  const ubo = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(ubo, 0, ab);
  const layout = pipeline.getBindGroupLayout(0);
  const bg = [0, 1].map((i) => device.createBindGroup({ layout, entries: [
    { binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: { buffer: bufs[i] } }, { binding: 2, resource: { buffer: bufs[1 - i] } },
    { binding: 3, resource: { buffer: nbrB } }, { binding: 4, resource: { buffer: geomB } }] }));
  const sim = {
    cells: N, cur: 0, bufs,
    encode(enc, k) { for (let i = 0; i < k; i++) { const p = enc.beginComputePass(); p.setPipeline(pipeline); p.setBindGroup(0, bg[sim.cur]); p.dispatchWorkgroups(gx, gy); p.end(); sim.cur ^= 1; } },
    destroy() { bufs.forEach((b) => b.destroy()); nbrB.destroy(); geomB.destroy(); ubo.destroy(); },
  };
  return sim;
}
async function runSteps(sim, total, k) {
  const t0 = now(); let done = 0;
  while (done < total) { const n = Math.min(k, total - done); const enc = device.createCommandEncoder(); sim.encode(enc, n); device.queue.submit([enc.finish()]); done += n; }
  await gpuDone(device);
  return (now() - t0);
}
async function measure(sim, k = 16) {
  await runSteps(sim, 8, 8);
  const cal = (await runSteps(sim, 16, 16)) / 16;
  const total = Math.max(k, Math.ceil(TARGET_MS / cal / k) * k);
  const v = [];
  for (let r = 0; r < REPS; r++) v.push(total / ((await runSteps(sim, total, k)) / 1000));
  const s = tstats(v);
  return { steps: total, stepsPerSec: s, cellUpdatesPerSec: { best: s.best * sim.cells, median: s.median * sim.cells } };
}

const out = { when: new Date().toISOString(), lock: benchLockStatus(), cases: [] };
for (const side of quick ? [1000] : [1000, 2000]) {
  const t0 = now();
  const base = buildMesh(side, side);
  console.log(`\n=== ${fmt(base.N)} triangle cells (${side}x${side} quads), mesh build ${(now() - t0).toFixed(0)} ms ===`);
  const orderings = [
    ['row-major', () => base],
    ['morton', () => permute(base, mortonPerm(base))],
    ['shuffled', () => permute(base, randomPerm(base.N))],
  ];
  for (const [name, mk] of orderings) {
    const mesh = mk();
    const dist = meanNbrDist(mesh);
    for (const wg of name === 'row-major' && !quick ? [64, 256] : [64]) {
      const sim = await makeSim(mesh, wg);
      const m = await measure(sim);
      const probe = await readBuffer(device, sim.bufs[sim.cur], 4096, 0, Float32Array);
      const finite = probe.every(Number.isFinite);
      out.cases.push({ cells: base.N, ordering: name, workgroup: wg, meanNeighbourIdDistance: dist, finite, ...m });
      console.log(`${name.padEnd(9)} wg=${String(wg).padStart(3)} mean|i-nbr|=${fmt(dist)}: ${m.stepsPerSec.best.toFixed(1)} best / ${m.stepsPerSec.median.toFixed(1)} med steps/s   ` +
        `${fmt(m.cellUpdatesPerSec.best)} best / ${fmt(m.cellUpdatesPerSec.median)} med cell-upd/s  spread ${m.stepsPerSec.spreadPct.toFixed(1)}%  finite=${finite}`);
      sim.destroy();
    }
  }
}
out.foreignAtEnd = foreignBenchProcs();
saveJSON(quick ? 'b2_unstructured_quick.json' : 'b2_unstructured.json', out);
process.exit(0);
