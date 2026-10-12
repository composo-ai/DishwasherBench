// B0: environment. Adapter info, limits, features, power-preference effect.
import { create, globals } from 'webgpu';
import { saveJSON, now } from './lib.mjs';
Object.assign(globalThis, globals);

async function probe(powerPreference, flags = []) {
  const t0 = now();
  const gpu = create(flags);
  const adapter = await gpu.requestAdapter(powerPreference ? { powerPreference } : undefined);
  const t1 = now();
  if (!adapter) return { powerPreference, error: 'no adapter' };
  const info = adapter.info ?? (await adapter.requestAdapterInfo?.());
  const limits = {};
  for (const k in adapter.limits) limits[k] = Number(adapter.limits[k]);
  const features = [...adapter.features].sort();
  const device = await adapter.requestDevice();
  const t2 = now();
  const defaultLimits = {};
  for (const k in device.limits) defaultLimits[k] = Number(device.limits[k]);
  device.destroy();
  return {
    powerPreference: powerPreference ?? '(unset)',
    info: {
      vendor: info?.vendor, architecture: info?.architecture, device: info?.device, description: info?.description,
      subgroupMinSize: info?.subgroupMinSize, subgroupMaxSize: info?.subgroupMaxSize, isFallbackAdapter: info?.isFallbackAdapter,
    },
    requestAdapterMs: t1 - t0, requestDeviceMs: t2 - t1,
    features, limits, defaultLimits,
    wgslLanguageFeatures: gpu.wgslLanguageFeatures ? [...gpu.wgslLanguageFeatures].sort() : null,
    preferredCanvasFormat: gpu.getPreferredCanvasFormat?.(),
  };
}

const res = {
  node: process.version, platform: process.platform, arch: process.arch,
  results: [await probe('high-performance'), await probe('low-power'), await probe(undefined)],
};
saveJSON('b0_env.json', res);
const r = res.results[0];
console.log('adapter info:', r.info);
console.log('features:', r.features.join(', '));
console.log('wgsl language features:', r.wgslLanguageFeatures?.join(', '));
const keys = ['maxBufferSize', 'maxStorageBufferBindingSize', 'maxUniformBufferBindingSize', 'maxComputeInvocationsPerWorkgroup',
  'maxComputeWorkgroupSizeX', 'maxComputeWorkgroupSizeY', 'maxComputeWorkgroupSizeZ', 'maxComputeWorkgroupsPerDimension',
  'maxComputeWorkgroupStorageSize', 'maxStorageBuffersPerShaderStage', 'maxStorageTexturesPerShaderStage',
  'maxSampledTexturesPerShaderStage', 'maxSamplersPerShaderStage', 'maxUniformBuffersPerShaderStage',
  'maxTextureDimension1D', 'maxTextureDimension2D', 'maxTextureDimension3D', 'maxTextureArrayLayers',
  'maxBindGroups', 'maxBindingsPerBindGroup', 'maxDynamicStorageBuffersPerPipelineLayout',
  'minStorageBufferOffsetAlignment', 'minUniformBufferOffsetAlignment'];
console.log('\nlimit | adapter (max) | device default');
for (const k of keys) console.log(`${k} | ${r.limits[k]} | ${r.defaultLimits[k]}`);
console.log('\nall limit keys:', Object.keys(r.limits).join(', '));
for (const x of res.results) {
  console.log(`\npowerPreference=${x.powerPreference}: ${x.info.vendor} / ${x.info.architecture} / ${x.info.device} / ${x.info.description}; adapter ${x.requestAdapterMs.toFixed(1)} ms, device ${x.requestDeviceMs.toFixed(1)} ms`);
  console.log('  same limits as high-performance:', JSON.stringify(x.limits) === JSON.stringify(r.limits), ' same features:', JSON.stringify(x.features) === JSON.stringify(r.features));
}
process.exit(0);
