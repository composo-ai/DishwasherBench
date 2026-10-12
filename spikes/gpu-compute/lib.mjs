// Shared helpers for the Spotless GPU-compute spike.
// Runs under Node (Dawn bindings, npm "webgpu"). The benchmark kernels themselves are plain WGSL strings
// and can be reused unchanged in a browser.
import { create, globals } from 'webgpu';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBenchLock, benchLockStatus, foreignBenchProcs } from './benchlock.mjs';
export { acquireBenchLock, benchLockStatus, foreignBenchProcs };

Object.assign(globalThis, globals);

export const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, 'out');
mkdirSync(OUT, { recursive: true });

export function saveJSON(name, obj) {
  const p = join(OUT, name);
  writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

// IMPORTANT: the object returned by create() must stay strongly referenced for the life of the device. If it is
// garbage-collected, Dawn drops the instance and every later async call rejects with "Instance dropped".
const keepAlive = [];
let lostInfo = null;
export function deviceLost() { return lostInfo; }

/**
 * Acquire a device with every limit raised to what the adapter supports.
 * NOTE (added 15:55 on 2026-10-08): this first takes the cross-process benchmark lock (see benchlock.mjs), because two
 * jobs were running GPU benchmarks from this directory at once and halving each other's numbers. If your script
 * prints "[benchlock] waiting ..." it is queued behind another benchmark, not hung. BENCH_NOLOCK=1 opts out.
 */
export async function getDevice({ powerPreference = process.env.POWER_PREF ?? 'high-performance', flags = [], features = null, quiet = false } = {}) {
  await acquireBenchLock();
  // DAWN_FLAGS="enable-dawn-features=disable_robustness;backend=metal" passes Dawn options to any benchmark unchanged.
  if (!flags.length && process.env.DAWN_FLAGS) flags = process.env.DAWN_FLAGS.split(';').filter(Boolean);
  const gpu = create(flags);
  keepAlive.push(gpu);
  const adapter = await gpu.requestAdapter({ powerPreference });
  if (!adapter) throw new Error('no adapter');
  keepAlive.push(adapter);
  const requiredLimits = {};
  for (const k in adapter.limits) {
    const v = adapter.limits[k];
    if (typeof v === 'number' || typeof v === 'bigint') requiredLimits[k] = v;
  }
  const want = features ?? ['timestamp-query', 'shader-f16', 'float32-filterable', 'bgra8unorm-storage',
    'texture-formats-tier1', 'texture-formats-tier2', 'subgroups'];
  const requiredFeatures = want.filter((f) => adapter.features.has(f));
  const device = await adapter.requestDevice({ requiredLimits, requiredFeatures });
  const errors = [];
  device.addEventListener?.('uncapturederror', (e) => {
    errors.push(String(e.error?.message ?? e));
    if (!quiet) console.error('[uncapturederror]', e.error?.message ?? e);
  });
  device.lost.then((info) => {
    lostInfo = { reason: info.reason, message: info.message };
    if (info.reason !== 'destroyed') console.error('[device.lost]', info.reason, info.message);
  });
  return { gpu, adapter, device, errors };
}

export const now = () => performance.now();

/** Wait until every submitted command has finished executing on the GPU. */
export async function gpuDone(device) {
  await device.queue.onSubmittedWorkDone();
}

export function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : 0.5 * (s[n / 2 - 1] + s[n / 2]);
}
export function stats(a) {
  const s = [...a].sort((x, y) => x - y);
  return { best: s[0], median: median(s), worst: s[s.length - 1], n: s.length, spreadPct: 100 * (s[s.length - 1] - s[0]) / median(s) };
}
/** For throughput (bigger is better). */
export function tstats(a) {
  const s = [...a].sort((x, y) => y - x);
  return { best: s[0], median: median(s), worst: s[s.length - 1], n: s.length, spreadPct: 100 * (s[0] - s[s.length - 1]) / median(s) };
}

export function fmt(x, digits = 3) {
  if (x === undefined || x === null || Number.isNaN(x)) return 'n/a';
  const a = Math.abs(x);
  if (a >= 1e9) return (x / 1e9).toFixed(digits - 1) + 'G';
  if (a >= 1e6) return (x / 1e6).toFixed(digits - 1) + 'M';
  if (a >= 1e3) return (x / 1e3).toFixed(digits - 1) + 'k';
  return x.toFixed(digits - 1);
}

/** Read back `size` bytes of a buffer (copy to a MAP_READ staging buffer, mapAsync, copy out). */
export async function readBuffer(device, src, size, offset = 0, Type = Uint8Array) {
  const staging = device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(src, offset, staging, 0, size);
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const out = new Type(staging.getMappedRange().slice(0));
  staging.unmap();
  staging.destroy();
  return out;
}

/** Upload a large typed array in chunks (queue.writeBuffer has practical size limits). */
export function upload(device, buffer, data, chunk = 64 << 20) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  for (let o = 0; o < bytes.byteLength; o += chunk) {
    const n = Math.min(chunk, bytes.byteLength - o);
    device.queue.writeBuffer(buffer, o, bytes, o, n);
  }
}

export async function checkedPipeline(device, code, entryPoint = 'main', label = '') {
  device.pushErrorScope('validation');
  const module = device.createShaderModule({ code, label });
  const info = await module.getCompilationInfo?.();
  if (info) for (const m of info.messages) if (m.type === 'error') throw new Error(`WGSL ${label}: ${m.lineNum}:${m.linePos} ${m.message}`);
  const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint }, label });
  const err = await device.popErrorScope();
  if (err) throw new Error(`pipeline ${label}: ${err.message}`);
  return pipeline;
}

/** FNV-1a 64-bit hash of a byte array, as hex. Used for determinism checks. */
export function hashBytes(u8) {
  let h1 = 0x811c9dc5 | 0, h2 = 0x01000193 | 0;
  for (let i = 0; i < u8.length; i++) {
    h1 = Math.imul(h1 ^ u8[i], 0x01000193);
    h2 = Math.imul(h2 ^ u8[i], 0x85ebca6b) + 0x7f4a7c15 | 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
