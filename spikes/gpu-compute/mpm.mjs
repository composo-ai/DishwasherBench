// B4 kernel set: MLS-MPM-style particle/grid step (weakly compressible fluid, quadratic B-splines, APIC affine matrix).
//   P2G   : every particle scatters mass + momentum to 27 grid nodes with atomics
//           mode 'fixed'  -> atomicAdd on i32 fixed-point (order-independent, hence reproducible)
//           mode 'floatcas' -> f32 accumulated through an atomicCompareExchangeWeak loop (order-dependent rounding)
//   GRID  : per cell: momentum -> velocity, gravity, wall boundary, clear the accumulators
//   G2P   : every particle gathers 27 nodes, updates velocity, affine matrix, J and position
// Particle = 80 bytes: pos.xyz, mass, vel.xyz, J, C0, C1, C2 (rows of the affine matrix).
import { checkedPipeline, upload, mulberry32 } from './lib.mjs';

const COMMON = /* wgsl */ `
struct Particle { pos: vec3f, mass: f32, vel: vec3f, J: f32, C0: vec4f, C1: vec4f, C2: vec4f };
struct SP { np: u32, row: u32, g: u32, pad: u32, dx: f32, invDx: f32, dt: f32, K: f32 };
@group(0) @binding(0) var<uniform> S: SP;
const FIX: f32 = 65536.0;
`;

const p2g = (mode, wg) => COMMON + /* wgsl */ `
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<storage, read_write> grid: array<${mode === 'fixed' ? 'atomic<i32>' : 'atomic<u32>'}>;
${mode === 'fixed' ? `
fn acc(i: u32, v: f32) { atomicAdd(&grid[i], i32(v * FIX)); }` : `
fn acc(i: u32, v: f32) {
  var old = atomicLoad(&grid[i]);
  loop {
    let r = atomicCompareExchangeWeak(&grid[i], old, bitcast<u32>(bitcast<f32>(old) + v));
    if (r.exchanged) { break; }
    old = r.old_value;
  }
}`}
@compute @workgroup_size(${wg})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y * S.row + gid.x;
  if (i >= S.np) { return; }
  let p = parts[i];
  let xp = p.pos * S.invDx;
  let base = vec3i(floor(xp - 0.5));
  let fx = xp - vec3f(base);
  var w: array<vec3f, 3>;
  w[0] = 0.5 * (1.5 - fx) * (1.5 - fx);
  w[1] = 0.75 - (fx - 1.0) * (fx - 1.0);
  w[2] = 0.5 * (fx - 0.5) * (fx - 0.5);
  let stress = -S.dt * 4.0 * S.invDx * S.invDx * S.K * (p.J - 1.0);
  let n = i32(S.g);
  for (var a = 0; a < 3; a++) {
    for (var b = 0; b < 3; b++) {
      for (var c = 0; c < 3; c++) {
        let off = vec3i(a, b, c);
        let dpos = (vec3f(off) - fx) * S.dx;
        let wt = w[a].x * w[b].y * w[c].z * p.mass;
        let aff = vec3f(dot(p.C0.xyz, dpos), dot(p.C1.xyz, dpos), dot(p.C2.xyz, dpos)) + stress * dpos;
        let mv = wt * (p.vel + aff);
        let cell = clamp(base + off, vec3i(0), vec3i(n - 1));
        let idx = 4u * (u32(cell.x) + S.g * (u32(cell.y) + S.g * u32(cell.z)));
        acc(idx, wt);
        acc(idx + 1u, mv.x);
        acc(idx + 2u, mv.y);
        acc(idx + 3u, mv.z);
      }
    }
  }
}`;

const gridUpdate = (mode) => COMMON + /* wgsl */ `
@group(0) @binding(1) var<storage, read_write> grid: array<${mode === 'fixed' ? 'atomic<i32>' : 'atomic<u32>'}>;
@group(0) @binding(2) var<storage, read_write> gridV: array<vec4f>;
@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= S.g || gid.y >= S.g || gid.z >= S.g) { return; }
  let c = gid.x + S.g * (gid.y + S.g * gid.z);
  let idx = 4u * c;
  let r0 = atomicLoad(&grid[idx]);
  let r1 = atomicLoad(&grid[idx + 1u]);
  let r2 = atomicLoad(&grid[idx + 2u]);
  let r3 = atomicLoad(&grid[idx + 3u]);
  var o = vec4f(0.0);
  ${mode === 'fixed' ? `
  let any_nz = (r0 | r1 | r2 | r3) != 0;
  let m = f32(r0) / FIX;
  let mom = vec3f(f32(r1), f32(r2), f32(r3)) / FIX;` : `
  let any_nz = (r0 | r1 | r2 | r3) != 0u;
  let m = bitcast<f32>(r0);
  let mom = vec3f(bitcast<f32>(r1), bitcast<f32>(r2), bitcast<f32>(r3));`}
  if (any_nz) {
    if (m > 0.0) {
      var v = mom / m;
      v.z -= 9.8 * S.dt;
      let gi = vec3i(gid);
      let n = i32(S.g);
      if ((gi.x < 3 && v.x < 0.0) || (gi.x > n - 4 && v.x > 0.0)) { v.x = 0.0; }
      if ((gi.y < 3 && v.y < 0.0) || (gi.y > n - 4 && v.y > 0.0)) { v.y = 0.0; }
      if ((gi.z < 3 && v.z < 0.0) || (gi.z > n - 4 && v.z > 0.0)) { v.z = 0.0; }
      o = vec4f(v, m);
    }
    atomicStore(&grid[idx], 0);
    atomicStore(&grid[idx + 1u], 0);
    atomicStore(&grid[idx + 2u], 0);
    atomicStore(&grid[idx + 3u], 0);
  }
  gridV[c] = o;
}`;

const g2p = (wg) => COMMON + /* wgsl */ `
@group(0) @binding(1) var<storage, read_write> parts: array<Particle>;
@group(0) @binding(2) var<storage, read> gridV: array<vec4f>;
@compute @workgroup_size(${wg})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y * S.row + gid.x;
  if (i >= S.np) { return; }
  var p = parts[i];
  let xp = p.pos * S.invDx;
  let base = vec3i(floor(xp - 0.5));
  let fx = xp - vec3f(base);
  var w: array<vec3f, 3>;
  w[0] = 0.5 * (1.5 - fx) * (1.5 - fx);
  w[1] = 0.75 - (fx - 1.0) * (fx - 1.0);
  w[2] = 0.5 * (fx - 0.5) * (fx - 0.5);
  let n = i32(S.g);
  var nv = vec3f(0.0);
  var B0 = vec3f(0.0);
  var B1 = vec3f(0.0);
  var B2 = vec3f(0.0);
  for (var a = 0; a < 3; a++) {
    for (var b = 0; b < 3; b++) {
      for (var c = 0; c < 3; c++) {
        let off = vec3i(a, b, c);
        let dpos = (vec3f(off) - fx) * S.dx;
        let wt = w[a].x * w[b].y * w[c].z;
        let cell = clamp(base + off, vec3i(0), vec3i(n - 1));
        let gv = gridV[u32(cell.x) + S.g * (u32(cell.y) + S.g * u32(cell.z))].xyz;
        nv += wt * gv;
        B0 += wt * gv.x * dpos;
        B1 += wt * gv.y * dpos;
        B2 += wt * gv.z * dpos;
      }
    }
  }
  let k = 4.0 * S.invDx * S.invDx;
  p.vel = nv;
  p.C0 = vec4f(B0 * k, 0.0);
  p.C1 = vec4f(B1 * k, 0.0);
  p.C2 = vec4f(B2 * k, 0.0);
  p.J = clamp(p.J * (1.0 + S.dt * (p.C0.x + p.C1.y + p.C2.z)), 0.2, 5.0);
  p.pos = clamp(p.pos + S.dt * nv, vec3f(2.0 * S.dx), vec3f(1.0 - 2.0 * S.dx));
  parts[i] = p;
}`;

/** Particle initial conditions. layout: 'block' (dense slab, 8 per cell) or 'dispersed' (uniform random in the domain).
 *  order: 'sorted' (by grid cell) or 'shuffled'. */
export function initParticles(np, G, layout = 'block', order = 'sorted', seed = 5) {
  const rnd = mulberry32(seed);
  const dx = 1 / G;
  const a = new Float32Array(np * 20);
  const key = new Uint32Array(np);
  const s = Math.ceil(Math.cbrt(np / 8));
  const ox = 0.5 - (s * dx) / 2, oz = 0.1;
  for (let i = 0; i < np; i++) {
    let x, y, z;
    if (layout === 'block') {
      const ci = i >> 3, sub = i & 7;
      const cx = ci % s, cy = Math.floor(ci / s) % s, cz = Math.floor(ci / (s * s));
      x = ox + (cx + 0.25 + 0.5 * (sub & 1) + 0.3 * (rnd() - 0.5)) * dx;
      y = ox + (cy + 0.25 + 0.5 * ((sub >> 1) & 1) + 0.3 * (rnd() - 0.5)) * dx;
      z = oz + (cz + 0.25 + 0.5 * ((sub >> 2) & 1) + 0.3 * (rnd() - 0.5)) * dx;
    } else {
      x = 0.05 + 0.9 * rnd(); y = 0.05 + 0.9 * rnd(); z = 0.05 + 0.9 * rnd();
    }
    const o = i * 20;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = 1.0;
    a[o + 4] = 0.3 * (rnd() - 0.5); a[o + 5] = 0.3 * (rnd() - 0.5); a[o + 6] = -1.0 + 0.3 * (rnd() - 0.5); a[o + 7] = 1.0;
    key[i] = Math.floor(x * G) + G * (Math.floor(y * G) + G * Math.floor(z * G));
  }
  let perm = null;
  if (order === 'shuffled') {
    perm = new Uint32Array(np); for (let i = 0; i < np; i++) perm[i] = i;
    for (let i = np - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  } else if (layout !== 'block') {
    perm = new Uint32Array(np); for (let i = 0; i < np; i++) perm[i] = i;
    perm.sort((p, q) => key[p] - key[q]);
  }
  if (!perm) return a;
  const b = new Float32Array(np * 20);
  for (let i = 0; i < np; i++) b.set(a.subarray(perm[i] * 20, perm[i] * 20 + 20), i * 20);
  return b;
}

export async function makeMPM(device, { np, G = 256, mode = 'fixed', wg = 64, particles }) {
  const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
  const pP2G = await checkedPipeline(device, p2g(mode, wg), 'main', 'p2g-' + mode);
  const pGrid = await checkedPipeline(device, gridUpdate(mode), 'main', 'grid-' + mode);
  const pG2P = await checkedPipeline(device, g2p(wg), 'main', 'g2p');
  const partB = device.createBuffer({ size: np * 80, usage });
  upload(device, partB, particles);
  const gridA = device.createBuffer({ size: G ** 3 * 16, usage });   // zero-initialised
  const gridV = device.createBuffer({ size: G ** 3 * 16, usage });
  const gxMax = 1024, row = gxMax * wg, gx = Math.min(gxMax, Math.ceil(np / wg)), gy = Math.ceil(np / row);
  const ab = new ArrayBuffer(32); const dv = new DataView(ab);
  dv.setUint32(0, np, true); dv.setUint32(4, row, true); dv.setUint32(8, G, true);
  dv.setFloat32(16, 1 / G, true); dv.setFloat32(20, G, true); dv.setFloat32(24, 2e-4, true); dv.setFloat32(28, 50, true);
  const ubo = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(ubo, 0, ab);
  const bg = (p, b1, b2) => device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: { buffer: b1 } }, { binding: 2, resource: { buffer: b2 } }] });
  const bP2G = bg(pP2G, partB, gridA), bGrid = bg(pGrid, gridA, gridV), bG2P = bg(pG2P, partB, gridV);
  const gg = Math.ceil(G / 4);
  const sim = {
    np, G, mode, partB, gridA, gridV,
    /** Encode k full steps; passDesc(i) may return a descriptor (timestampWrites) for pass i of the first step. */
    encode(enc, k, passDesc = () => undefined) {
      for (let s = 0; s < k; s++) {
        let p = enc.beginComputePass(s === 0 ? passDesc(0) : undefined); p.setPipeline(pP2G); p.setBindGroup(0, bP2G); p.dispatchWorkgroups(gx, gy); p.end();
        p = enc.beginComputePass(s === 0 ? passDesc(1) : undefined); p.setPipeline(pGrid); p.setBindGroup(0, bGrid); p.dispatchWorkgroups(gg, gg, gg); p.end();
        p = enc.beginComputePass(s === 0 ? passDesc(2) : undefined); p.setPipeline(pG2P); p.setBindGroup(0, bG2P); p.dispatchWorkgroups(gx, gy); p.end();
      }
    },
    /** Only the scatter + grid passes (used by the determinism test to hash the grid). */
    encodeScatter(enc) {
      let p = enc.beginComputePass(); p.setPipeline(pP2G); p.setBindGroup(0, bP2G); p.dispatchWorkgroups(gx, gy); p.end();
      p = enc.beginComputePass(); p.setPipeline(pGrid); p.setBindGroup(0, bGrid); p.dispatchWorkgroups(gg, gg, gg); p.end();
    },
    destroy() { partB.destroy(); gridA.destroy(); gridV.destroy(); ubo.destroy(); },
  };
  return sim;
}
