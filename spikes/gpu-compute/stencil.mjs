// B1 kernel: structured 5-point stencil, 4 x f32 per cell (h, hu, hv, hc), a "lazy" Lax-Friedrichs shallow-water
// step with a wet/dry branch and friction. ~80 flops, 2 divisions (in flux reciprocals: 4) and one branch per cell.
// The WGSL is environment-neutral (Node/Dawn and browsers); the JS reference below mirrors it op-for-op.
import { checkedPipeline, upload } from './lib.mjs';

export const PARAMS = { lam: 0.2, g: 1.0, fric: 0.002, eps: 1e-4, decay: 1e-4 };

const COMMON = /* wgsl */ `
struct Params { w: u32, h: u32, lam: f32, g: f32, fric: f32, eps: f32, decay: f32, pad: f32 };
@group(0) @binding(0) var<uniform> P: Params;
fn fluxX(U: vec4f) -> vec4f {
  let ih = 1.0 / max(U.x, P.eps);
  let u = U.y * ih;
  return vec4f(U.y, U.y * u + 0.5 * P.g * U.x * U.x, U.z * u, U.w * u);
}
fn fluxY(U: vec4f) -> vec4f {
  let ih = 1.0 / max(U.x, P.eps);
  let v = U.z * ih;
  return vec4f(U.z, U.y * v, U.z * v + 0.5 * P.g * U.x * U.x, U.w * v);
}
fn update(C: vec4f, L: vec4f, R: vec4f, D: vec4f, U: vec4f) -> vec4f {
  var n = 0.5 * C + 0.125 * (L + R + D + U) - 0.5 * P.lam * (fluxX(R) - fluxX(L) + fluxY(U) - fluxY(D));
  if (n.x < P.eps) {
    n = vec4f(max(n.x, 0.0), 0.0, 0.0, max(n.w, 0.0));
  } else {
    let s = n.x / (n.x + P.fric);
    n = vec4f(n.x, n.y * s, n.z * s, max(n.w - P.decay * C.w, 0.0));
  }
  return n;
}
`;

export function wgslBuffer(wx = 8, wy = 8) {
  return COMMON + /* wgsl */ `
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec4f>;
fn at(x: i32, y: i32) -> vec4f {
  let xc = u32(clamp(x, 0, i32(P.w) - 1));
  let yc = u32(clamp(y, 0, i32(P.h) - 1));
  return src[yc * P.w + xc];
}
@compute @workgroup_size(${wx}, ${wy})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let x = i32(gid.x); let y = i32(gid.y);
  dst[gid.y * P.w + gid.x] = update(at(x, y), at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1));
}`;
}

export function wgslTexture(wx = 8, wy = 8, readMode = 'sampled') {
  const srcDecl = readMode === 'sampled'
    ? '@group(0) @binding(1) var src: texture_2d<f32>;'
    : '@group(0) @binding(1) var src: texture_storage_2d<rgba32float, read>;';
  const load = readMode === 'sampled' ? 'textureLoad(src, c, 0)' : 'textureLoad(src, c)';
  return COMMON + /* wgsl */ `
${srcDecl}
@group(0) @binding(2) var dst: texture_storage_2d<rgba32float, write>;
fn at(x: i32, y: i32) -> vec4f {
  let c = vec2i(clamp(x, 0, i32(P.w) - 1), clamp(y, 0, i32(P.h) - 1));
  return ${load};
}
@compute @workgroup_size(${wx}, ${wy})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let x = i32(gid.x); let y = i32(gid.y);
  textureStore(dst, vec2i(x, y), update(at(x, y), at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)));
}`;
}

/** Deterministic initial state with wet and dry regions. */
export function initState(w, h) {
  const a = new Float32Array(w * h * 4);
  const kx = (2 * Math.PI * 3) / w, ky = (2 * Math.PI * 2) / h;
  for (let y = 0; y < h; y++) {
    const sy = Math.sin(y * ky), cy = Math.cos(y * ky * 2.5);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // integer hash noise in [0,1)
      let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n = (n ^ (n >>> 16)) >>> 0;
      const r = n / 4294967296;
      const hh = Math.max(0, 0.35 + 0.5 * Math.sin(x * kx) * sy + 0.25 * Math.cos(x * kx * 3.7) * cy + 0.05 * r - 0.2);
      a[i] = hh;
      a[i + 1] = 0.1 * hh * cy;
      a[i + 2] = -0.1 * hh * sy;
      a[i + 3] = hh * r;
    }
  }
  return a;
}

export function paramsBuffer(device, w, h) {
  const ab = new ArrayBuffer(32);
  const dv = new DataView(ab);
  dv.setUint32(0, w, true); dv.setUint32(4, h, true);
  dv.setFloat32(8, PARAMS.lam, true); dv.setFloat32(12, PARAMS.g, true); dv.setFloat32(16, PARAMS.fric, true);
  dv.setFloat32(20, PARAMS.eps, true); dv.setFloat32(24, PARAMS.decay, true);
  const buf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(buf, 0, ab);
  return buf;
}

/** Storage-buffer formulation. */
export async function makeBufferSim(device, w, h, { wx = 8, wy = 8, init = null } = {}) {
  const pipeline = await checkedPipeline(device, wgslBuffer(wx, wy), 'main', `stencil-buf-${wx}x${wy}`);
  const size = w * h * 16;
  const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
  const bufs = [device.createBuffer({ size, usage }), device.createBuffer({ size, usage })];
  const state = init ?? initState(w, h);
  upload(device, bufs[0], state);
  const ubo = paramsBuffer(device, w, h);
  const layout = pipeline.getBindGroupLayout(0);
  const bg = [0, 1].map((i) => device.createBindGroup({
    layout, entries: [
      { binding: 0, resource: { buffer: ubo } },
      { binding: 1, resource: { buffer: bufs[i] } },
      { binding: 2, resource: { buffer: bufs[1 - i] } }],
  }));
  const gx = Math.ceil(w / wx), gy = Math.ceil(h / wy);
  const sim = {
    kind: 'buffer', w, h, cells: w * h, bufs, cur: 0, pipeline, bg, gx, gy,
    /** Encode k steps. onePass: all dispatches share a single compute pass. */
    encode(enc, k, onePass = false, passDesc = undefined) {
      if (onePass) {
        const pass = enc.beginComputePass(passDesc);
        pass.setPipeline(pipeline);
        for (let i = 0; i < k; i++) { pass.setBindGroup(0, bg[sim.cur]); pass.dispatchWorkgroups(gx, gy); sim.cur ^= 1; }
        pass.end();
      } else {
        for (let i = 0; i < k; i++) {
          const pass = enc.beginComputePass(i === 0 ? passDesc : undefined);
          pass.setPipeline(pipeline); pass.setBindGroup(0, bg[sim.cur]); pass.dispatchWorkgroups(gx, gy); pass.end();
          sim.cur ^= 1;
        }
      }
    },
    current() { return bufs[sim.cur]; },
    reset(stateArr = state) { upload(device, bufs[0], stateArr); sim.cur = 0; },
    destroy() { bufs.forEach((b) => b.destroy()); ubo.destroy(); },
  };
  return sim;
}

/** Storage-texture formulation (rgba32float). readMode: 'sampled' (texture_2d + textureLoad) or 'storage' (read-only storage texture). */
export async function makeTextureSim(device, w, h, { wx = 8, wy = 8, readMode = 'sampled', init = null } = {}) {
  const pipeline = await checkedPipeline(device, wgslTexture(wx, wy, readMode), 'main', `stencil-tex-${readMode}-${wx}x${wy}`);
  const usage = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST;
  const tex = [0, 1].map(() => device.createTexture({ size: [w, h], format: 'rgba32float', usage }));
  const state = init ?? initState(w, h);
  const writeTex = (arr) => {
    // upload in horizontal bands to keep individual writes modest
    const rows = Math.max(1, Math.floor((64 << 20) / (w * 16)));
    for (let y = 0; y < h; y += rows) {
      const n = Math.min(rows, h - y);
      device.queue.writeTexture({ texture: tex[0], origin: [0, y, 0] }, arr, { offset: y * w * 16, bytesPerRow: w * 16, rowsPerImage: n }, [w, n, 1]);
    }
  };
  writeTex(state);
  const ubo = paramsBuffer(device, w, h);
  const layout = pipeline.getBindGroupLayout(0);
  const views = tex.map((t) => t.createView());
  const bg = [0, 1].map((i) => device.createBindGroup({
    layout, entries: [
      { binding: 0, resource: { buffer: ubo } },
      { binding: 1, resource: views[i] },
      { binding: 2, resource: views[1 - i] }],
  }));
  const gx = Math.ceil(w / wx), gy = Math.ceil(h / wy);
  const sim = {
    kind: 'texture-' + readMode, w, h, cells: w * h, tex, cur: 0, pipeline, bg, gx, gy,
    encode(enc, k, onePass = false, passDesc = undefined) {
      // Textures cannot be both sampled and storage-written inside ONE pass across dispatches? They can: usage scopes
      // are per dispatch in compute passes. Keep the same structure as the buffer sim.
      if (onePass) {
        const pass = enc.beginComputePass(passDesc);
        pass.setPipeline(pipeline);
        for (let i = 0; i < k; i++) { pass.setBindGroup(0, bg[sim.cur]); pass.dispatchWorkgroups(gx, gy); sim.cur ^= 1; }
        pass.end();
      } else {
        for (let i = 0; i < k; i++) {
          const pass = enc.beginComputePass(i === 0 ? passDesc : undefined);
          pass.setPipeline(pipeline); pass.setBindGroup(0, bg[sim.cur]); pass.dispatchWorkgroups(gx, gy); pass.end();
          sim.cur ^= 1;
        }
      }
    },
    current() { return tex[sim.cur]; },
    reset(stateArr = state) { writeTex(stateArr); sim.cur = 0; },
    destroy() { tex.forEach((t) => t.destroy()); ubo.destroy(); },
    /** Copy current texture into a buffer (for readback / hashing). */
    copyToBuffer(enc, buffer) {
      enc.copyTextureToBuffer({ texture: tex[sim.cur] }, { buffer, bytesPerRow: w * 16, rowsPerImage: h }, [w, h, 1]);
    },
  };
  return sim;
}

// ---- JS reference (float32 semantics via Math.fround, same operation order as the WGSL, no FMA) ----
export function jsStepF32(src, dst, w, h, y0 = 0, y1 = h, P = PARAMS) {
  const f = Math.fround;
  const lam = f(P.lam), g = f(P.g), fric = f(P.fric), eps = f(P.eps), decay = f(P.decay);
  const halfLam = f(f(0.5) * lam), halfG = f(f(0.5) * g);
  for (let y = y0; y < y1; y++) {
    const yd = (y > 0 ? y - 1 : 0) * w, yu = (y < h - 1 ? y + 1 : h - 1) * w, yc = y * w;
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : 0, xr = x < w - 1 ? x + 1 : w - 1;
      const c = (yc + x) * 4, l = (yc + xl) * 4, r = (yc + xr) * 4, d = (yd + x) * 4, u = (yu + x) * 4;
      // fluxX(R), fluxX(L)
      let ih = f(1 / Math.max(src[r], eps)); let vel = f(src[r + 1] * ih);
      const fr0 = src[r + 1], fr1 = f(f(src[r + 1] * vel) + f(f(halfG * src[r]) * src[r])), fr2 = f(src[r + 2] * vel), fr3 = f(src[r + 3] * vel);
      ih = f(1 / Math.max(src[l], eps)); vel = f(src[l + 1] * ih);
      const fl0 = src[l + 1], fl1 = f(f(src[l + 1] * vel) + f(f(halfG * src[l]) * src[l])), fl2 = f(src[l + 2] * vel), fl3 = f(src[l + 3] * vel);
      // fluxY(U), fluxY(D)
      ih = f(1 / Math.max(src[u], eps)); vel = f(src[u + 2] * ih);
      const gu0 = src[u + 2], gu1 = f(src[u + 1] * vel), gu2 = f(f(src[u + 2] * vel) + f(f(halfG * src[u]) * src[u])), gu3 = f(src[u + 3] * vel);
      ih = f(1 / Math.max(src[d], eps)); vel = f(src[d + 2] * ih);
      const gd0 = src[d + 2], gd1 = f(src[d + 1] * vel), gd2 = f(f(src[d + 2] * vel) + f(f(halfG * src[d]) * src[d])), gd3 = f(src[d + 3] * vel);
      let n0 = f(f(f(f(0.5) * src[c]) + f(f(0.125) * f(f(f(src[l] + src[r]) + src[d]) + src[u]))) - f(halfLam * f(f(f(fr0 - fl0) + gu0) - gd0)));
      let n1 = f(f(f(f(0.5) * src[c + 1]) + f(f(0.125) * f(f(f(src[l + 1] + src[r + 1]) + src[d + 1]) + src[u + 1]))) - f(halfLam * f(f(f(fr1 - fl1) + gu1) - gd1)));
      let n2 = f(f(f(f(0.5) * src[c + 2]) + f(f(0.125) * f(f(f(src[l + 2] + src[r + 2]) + src[d + 2]) + src[u + 2]))) - f(halfLam * f(f(f(fr2 - fl2) + gu2) - gd2)));
      let n3 = f(f(f(f(0.5) * src[c + 3]) + f(f(0.125) * f(f(f(src[l + 3] + src[r + 3]) + src[d + 3]) + src[u + 3]))) - f(halfLam * f(f(f(fr3 - fl3) + gu3) - gd3)));
      if (n0 < eps) {
        n0 = Math.max(n0, 0); n1 = 0; n2 = 0; n3 = Math.max(n3, 0);
      } else {
        const s = f(n0 / f(n0 + fric));
        n1 = f(n1 * s); n2 = f(n2 * s); n3 = Math.max(f(n3 - f(decay * src[c + 3])), 0);
      }
      dst[c] = n0; dst[c + 1] = n1; dst[c + 2] = n2; dst[c + 3] = n3;
    }
  }
}

// Same arithmetic without Math.fround (double intermediates, rounded on store): the idiomatic fast JS form.
export function jsStepF64(src, dst, w, h, y0 = 0, y1 = h, P = PARAMS) {
  const lam = P.lam, g = P.g, fric = P.fric, eps = P.eps, decay = P.decay;
  const halfLam = 0.5 * lam, halfG = 0.5 * g;
  for (let y = y0; y < y1; y++) {
    const yd = (y > 0 ? y - 1 : 0) * w, yu = (y < h - 1 ? y + 1 : h - 1) * w, yc = y * w;
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : 0, xr = x < w - 1 ? x + 1 : w - 1;
      const c = (yc + x) * 4, l = (yc + xl) * 4, r = (yc + xr) * 4, d = (yd + x) * 4, u = (yu + x) * 4;
      let ih = 1 / Math.max(src[r], eps); let vel = src[r + 1] * ih;
      const fr0 = src[r + 1], fr1 = src[r + 1] * vel + halfG * src[r] * src[r], fr2 = src[r + 2] * vel, fr3 = src[r + 3] * vel;
      ih = 1 / Math.max(src[l], eps); vel = src[l + 1] * ih;
      const fl0 = src[l + 1], fl1 = src[l + 1] * vel + halfG * src[l] * src[l], fl2 = src[l + 2] * vel, fl3 = src[l + 3] * vel;
      ih = 1 / Math.max(src[u], eps); vel = src[u + 2] * ih;
      const gu0 = src[u + 2], gu1 = src[u + 1] * vel, gu2 = src[u + 2] * vel + halfG * src[u] * src[u], gu3 = src[u + 3] * vel;
      ih = 1 / Math.max(src[d], eps); vel = src[d + 2] * ih;
      const gd0 = src[d + 2], gd1 = src[d + 1] * vel, gd2 = src[d + 2] * vel + halfG * src[d] * src[d], gd3 = src[d + 3] * vel;
      let n0 = 0.5 * src[c] + 0.125 * (src[l] + src[r] + src[d] + src[u]) - halfLam * (fr0 - fl0 + gu0 - gd0);
      let n1 = 0.5 * src[c + 1] + 0.125 * (src[l + 1] + src[r + 1] + src[d + 1] + src[u + 1]) - halfLam * (fr1 - fl1 + gu1 - gd1);
      let n2 = 0.5 * src[c + 2] + 0.125 * (src[l + 2] + src[r + 2] + src[d + 2] + src[u + 2]) - halfLam * (fr2 - fl2 + gu2 - gd2);
      let n3 = 0.5 * src[c + 3] + 0.125 * (src[l + 3] + src[r + 3] + src[d + 3] + src[u + 3]) - halfLam * (fr3 - fl3 + gu3 - gd3);
      if (n0 < eps) {
        n0 = Math.max(n0, 0); n1 = 0; n2 = 0; n3 = Math.max(n3, 0);
      } else {
        const s = n0 / (n0 + fric);
        n1 = n1 * s; n2 = n2 * s; n3 = Math.max(n3 - decay * src[c + 3], 0);
      }
      dst[c] = n0; dst[c + 1] = n1; dst[c + 2] = n2; dst[c + 3] = n3;
    }
  }
}
