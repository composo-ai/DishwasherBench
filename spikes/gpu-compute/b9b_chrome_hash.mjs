// B9b: cross-implementation determinism. Runs B1 (1024x1024, 200 steps, storage buffers) in headless Chrome and compares
// the FNV hash of the final state with the hash produced by Node/Dawn in b7_determinism.mjs (out/b7_determinism.json).
// Chrome ships a much newer Dawn/Tint than npm webgpu@0.3.0, so this tests "does a Dawn upgrade change the bits?".
// Usage: node b9b_chrome_hash.mjs
import http from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { acquireBenchLock } from './benchlock.mjs';
import { wgslBuffer, initState, PARAMS } from './stencil.mjs';

await acquireBenchLock();
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const here = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(here + 'out/chrome-profile', { recursive: true });
const server = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>b9b</title>'); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: here + 'out/chrome-profile', args: ['--no-first-run', '--no-default-browser-check'], protocolTimeout: 600000 });
const version = await browser.version();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);
const res = await page.evaluate(async ({ code, initSrc, P }) => {
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  const device = await adapter.requestDevice();
  const W = 1024, H = 1024, STEPS = 200, K = 16;
  const initState = new Function('return ' + initSrc)();
  const init = initState(W, H);
  const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: device.createShaderModule({ code }), entryPoint: 'main' } });
  const ab = new ArrayBuffer(32), dv = new DataView(ab);
  dv.setUint32(0, W, true); dv.setUint32(4, H, true); dv.setFloat32(8, P.lam, true); dv.setFloat32(12, P.g, true); dv.setFloat32(16, P.fric, true); dv.setFloat32(20, P.eps, true); dv.setFloat32(24, P.decay, true);
  const ubo = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); device.queue.writeBuffer(ubo, 0, ab);
  const bufs = [0, 1].map(() => device.createBuffer({ size: W * H * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC }));
  device.queue.writeBuffer(bufs[0], 0, init);
  const bg = [0, 1].map((i) => device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: { buffer: bufs[i] } }, { binding: 2, resource: { buffer: bufs[1 - i] } }] }));
  const runOnce = async () => {
    device.queue.writeBuffer(bufs[0], 0, init);
    let cur = 0;
    for (let d = 0; d < STEPS; d += K) {
      const e = device.createCommandEncoder();
      for (let i = 0; i < Math.min(K, STEPS - d); i++) { const p = e.beginComputePass(); p.setPipeline(pipeline); p.setBindGroup(0, bg[cur]); p.dispatchWorkgroups(W / 8, H / 8); p.end(); cur ^= 1; }
      device.queue.submit([e.finish()]);
    }
    const stg = device.createBuffer({ size: W * H * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const e = device.createCommandEncoder(); e.copyBufferToBuffer(bufs[cur], 0, stg, 0, W * H * 16); device.queue.submit([e.finish()]);
    await stg.mapAsync(GPUMapMode.READ);
    const u8 = new Uint8Array(stg.getMappedRange().slice(0)); stg.unmap(); stg.destroy();
    let h1 = 0x811c9dc5 | 0, h2 = 0x01000193 | 0;
    for (let i = 0; i < u8.length; i++) { h1 = Math.imul(h1 ^ u8[i], 0x01000193); h2 = Math.imul(h2 ^ u8[i], 0x85ebca6b) + 0x7f4a7c15 | 0; }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  };
  return { hashes: [await runOnce(), await runOnce()], adapter: { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture } };
}, { code: wgslBuffer(8, 8), initSrc: initState.toString(), P: PARAMS });
await browser.close(); server.close();
const b7p = here + 'out/b7_determinism.json';
const nodeHash = existsSync(b7p) ? JSON.parse(readFileSync(b7p, 'utf8')).b1.baseline.hash : null;
const out = { when: new Date().toISOString(), chrome: version, chromeHashes: res.hashes, chromeRunToRunIdentical: res.hashes[0] === res.hashes[1], nodeDawnHash: nodeHash, chromeEqualsNodeDawn: nodeHash ? res.hashes[0] === nodeHash : null, adapter: res.adapter };
console.log(JSON.stringify(out, null, 2));
writeFileSync(here + 'out/b9b_chrome_hash.json', JSON.stringify(out, null, 2));
process.exit(0);
