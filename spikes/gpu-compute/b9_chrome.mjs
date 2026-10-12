// B9: the B1 kernel in headless Google Chrome (WebGPU), driven by puppeteer-core against the installed Chrome.
// The WGSL strings and the initial-state generator are the very same ones the Node/Dawn benchmark uses.
// Usage: node b9_chrome.mjs [headless|headful]
import http from 'node:http';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { acquireBenchLock, benchLockStatus } from './benchlock.mjs';
import { wgslBuffer, wgslTexture, initState, PARAMS } from './stencil.mjs';

await acquireBenchLock();
const mode = process.argv[2] ?? 'headless';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(CHROME)) { console.log('Google Chrome not found at', CHROME); process.exit(1); }
const here = fileURLToPath(new URL('.', import.meta.url));
const profile = here + 'out/chrome-profile';
mkdirSync(profile, { recursive: true });

// WebGPU needs a secure context: serve an empty page from localhost.
const server = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>b9</title><body>b9</body>'); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

async function attempt(label, args, headless) {
  const res = { label, args, headless };
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: CHROME, headless, userDataDir: profile, args: ['--no-first-run', '--no-default-browser-check', ...args], protocolTimeout: 600000 });
    res.chromeVersion = await browser.version();
    const page = await browser.newPage();
    page.on('console', (m) => { if (process.env.B9_VERBOSE) console.log('  [page]', m.text()); });
    await page.goto(url);
    res.result = await page.evaluate(async ({ bufCode, texCode, initSrc, P }) => {
      if (!navigator.gpu) return { error: 'navigator.gpu is undefined' };
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { error: 'requestAdapter returned null' };
      const info = adapter.info ?? {};
      const requiredLimits = {};
      for (const k of ['maxBufferSize', 'maxStorageBufferBindingSize', 'maxComputeInvocationsPerWorkgroup', 'maxComputeWorkgroupSizeX', 'maxComputeWorkgroupSizeY', 'maxTextureDimension2D']) requiredLimits[k] = adapter.limits[k];
      const device = await adapter.requestDevice({ requiredLimits });
      let lost = null; device.lost.then((i) => { lost = i.reason + ': ' + i.message; });
      const out = {
        adapter: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description },
        limits: { maxBufferSize: adapter.limits.maxBufferSize, maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize, maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup, maxTextureDimension2D: adapter.limits.maxTextureDimension2D, maxTextureDimension3D: adapter.limits.maxTextureDimension3D },
        features: [...adapter.features].sort(), userAgent: navigator.userAgent, crossOriginIsolated: self.crossOriginIsolated, cases: [],
      };
      const initState = new Function('return ' + initSrc)();
      const mkParams = (w, h) => {
        const ab = new ArrayBuffer(32), dv = new DataView(ab);
        dv.setUint32(0, w, true); dv.setUint32(4, h, true); dv.setFloat32(8, P.lam, true); dv.setFloat32(12, P.g, true); dv.setFloat32(16, P.fric, true); dv.setFloat32(20, P.eps, true); dv.setFloat32(24, P.decay, true);
        const b = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); device.queue.writeBuffer(b, 0, ab); return b;
      };
      const K = 32, REPS = 5;
      for (const [w, h] of [[1024, 1024], [2048, 2048], [4096, 4096]]) {
        for (const kind of ['buffer', 'texture']) {
          try {
            if (kind === 'buffer' && w * h * 16 > adapter.limits.maxStorageBufferBindingSize) { out.cases.push({ w, h, kind, skipped: 'binding size limit' }); continue; }
            const module = device.createShaderModule({ code: kind === 'buffer' ? bufCode : texCode });
            const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
            const init = initState(w, h);
            const ubo = mkParams(w, h);
            let views, res;
            if (kind === 'buffer') {
              res = [0, 1].map(() => device.createBuffer({ size: w * h * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC }));
              for (let o = 0; o < init.byteLength; o += 64 << 20) device.queue.writeBuffer(res[0], o, init.buffer, o, Math.min(64 << 20, init.byteLength - o));
              views = res.map((b) => ({ buffer: b }));
            } else {
              res = [0, 1].map(() => device.createTexture({ size: [w, h], format: 'rgba32float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST }));
              const rows = Math.max(1, Math.floor((64 << 20) / (w * 16)));
              for (let y = 0; y < h; y += rows) { const n = Math.min(rows, h - y); device.queue.writeTexture({ texture: res[0], origin: [0, y, 0] }, init, { offset: y * w * 16, bytesPerRow: w * 16, rowsPerImage: n }, [w, n, 1]); }
              views = res.map((t) => t.createView());
            }
            const bg = [0, 1].map((i) => device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: views[i] }, { binding: 2, resource: views[1 - i] }] }));
            let cur = 0;
            const steps = async (total) => {
              const t0 = performance.now();
              for (let d = 0; d < total; d += K) {
                const e = device.createCommandEncoder();
                for (let i = 0; i < K; i++) { const p = e.beginComputePass(); p.setPipeline(pipeline); p.setBindGroup(0, bg[cur]); p.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8)); p.end(); cur ^= 1; }
                device.queue.submit([e.finish()]);
              }
              await device.queue.onSubmittedWorkDone();
              return performance.now() - t0;
            };
            await steps(K);
            const cal = (await steps(K)) / K;
            const total = Math.max(K, Math.ceil(1000 / cal / K) * K);
            const v = []; for (let r = 0; r < REPS; r++) v.push(total * w * h / ((await steps(total)) / 1000));
            v.sort((a, b) => b - a);
            out.cases.push({ w, h, kind, steps: total, cellUpdatesPerSec: { best: v[0], median: v[REPS >> 1], worst: v[REPS - 1] } });
            res.forEach((r) => r.destroy()); ubo.destroy();
          } catch (e) { out.cases.push({ w, h, kind, error: String(e.message ?? e).slice(0, 300) }); }
        }
      }
      out.deviceLost = lost;
      return out;
    }, { bufCode: wgslBuffer(8, 8), texCode: wgslTexture(8, 8, 'sampled'), initSrc: initState.toString(), P: PARAMS });
  } catch (e) { res.error = String(e.message ?? e).slice(0, 500); }
  try { await browser?.close(); } catch {}
  return res;
}

const attempts = mode === 'headful'
  ? [['headful, default flags', [], false]]
  : [['new headless, default flags', [], true], ['new headless + --enable-unsafe-webgpu --use-angle=metal --enable-gpu', ['--enable-unsafe-webgpu', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], true]];
const out = { when: new Date().toISOString(), lock: benchLockStatus(), attempts: [] };
for (const [label, args, headless] of attempts) {
  const r = await attempt(label, args, headless);
  out.attempts.push(r);
  console.log(`\n== ${label} ==  Chrome ${r.chromeVersion ?? '?'}`);
  if (r.error || r.result?.error) { console.log('  FAILED:', r.error ?? r.result.error); continue; }
  const x = r.result;
  console.log('  adapter:', JSON.stringify(x.adapter), ' maxBufferSize', x.limits.maxBufferSize, ' maxStorageBufferBindingSize', x.limits.maxStorageBufferBindingSize);
  console.log('  features:', x.features.join(', '));
  for (const c of x.cases) console.log(`  ${(c.w + 'x' + c.h).padEnd(10)} ${c.kind.padEnd(8)}: ` + (c.cellUpdatesPerSec ? `${(c.cellUpdatesPerSec.best / 1e9).toFixed(2)}G best / ${(c.cellUpdatesPerSec.median / 1e9).toFixed(2)}G med cell-updates/s` : (c.error ?? c.skipped)));
  if (x.deviceLost) console.log('  DEVICE LOST:', x.deviceLost);
  if (!x.adapter?.architecture?.includes?.('swiftshader') && x.cases.some((c) => c.cellUpdatesPerSec)) break; // a real GPU run succeeded
}
writeFileSync(here + `out/b9_chrome_${mode}.json`, JSON.stringify(out, null, 2));
server.close();
process.exit(0);
