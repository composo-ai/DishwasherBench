// Runs the WGSL random number generator exported by @spotless/core on the GPU (Dawn, through the
// `webgpu` package) and compares it with the TypeScript implementation. This is the test behind
// the claim that the two give identical bits. It also serves as the smoke test of the sim-gpu
// skeleton: it proves the Dawn bindings load and execute a compute shader on this machine.
//
// If no GPU adapter is available (for example on a CI machine without one) the GPU tests are
// skipped and say so; they never pass silently.
import {
  hashU32,
  pcgHash,
  randomIntBelow,
  randomNormal,
  randomRange,
  RNG_WGSL,
  u32ToUnitFloat,
} from '@spotless/core';
import { afterAll, describe, expect, it } from 'vitest';
import { create, globals } from 'webgpu';

const COUNT = 8192;

const SHADER = /* wgsl */ `
${RNG_WGSL}

@group(0) @binding(0) var<storage, read> keys: array<vec4<u32>>;
@group(0) @binding(1) var<storage, read_write> out_a: array<vec4<u32>>;
@group(0) @binding(2) var<storage, read_write> out_b: array<vec4<u32>>;
@group(0) @binding(3) var<storage, read_write> out_f: array<vec4<f32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&keys)) {
    return;
  }
  let k = keys[i];
  let h3 = rng_hash3(k.x, k.y, k.z, k.w);
  out_a[i] = vec4<u32>(rng_hash0(k.x), rng_hash1(k.x, k.y), rng_hash2(k.x, k.y, k.z), h3);
  let n = max(k.w, 1u);
  out_b[i] = vec4<u32>(
    rng_hash4(k.x, k.y, k.z, k.w, i),
    rng_int_below(rng_key(rng_key(rng_begin(k.x), k.y), k.z), n),
    bitcast<u32>(rng_unit(h3)),
    rng_pcg(k.x),
  );
  out_f[i] = vec4<f32>(
    rng_normal(rng_hash3(k.x, k.y, k.z, 0u), rng_hash3(k.x, k.y, k.z, 1u)),
    rng_range(h3, -2.0, 5.0),
    rng_unit(h3),
    0.0,
  );
}
`;

interface GpuConstants {
  readonly GPUBufferUsage: {
    readonly MAP_READ: number;
    readonly COPY_SRC: number;
    readonly COPY_DST: number;
    readonly STORAGE: number;
  };
  readonly GPUMapMode: { readonly READ: number };
}

const { GPUBufferUsage, GPUMapMode } = globals as unknown as GpuConstants;

/** Test inputs: (seed, k0, k1, k2) tuples mixing edge values, small counters and random words. */
function makeKeys(): Uint32Array {
  const keys = new Uint32Array(4 * COUNT);
  const edge = [0, 1, 2, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff, 3221225472, 3221225473];
  for (let i = 0; i < COUNT; i++) {
    for (let c = 0; c < 4; c++) {
      let value: number;
      if (i < 512) {
        value = edge[(i >> (2 * c)) % edge.length] as number;
      } else if (i < 2048) {
        value = c === 0 ? 7 : c === 1 ? i & 31 : c === 2 ? i >> 5 : i;
      } else {
        // Independent of the generator under test: a 32-bit linear congruential sequence.
        value = (Math.imul(i * 4 + c, 1664525) + 1013904223) >>> 0;
        value = (Math.imul(value ^ (value >>> 15), 2246822519) ^ (i << c)) >>> 0;
      }
      keys[4 * i + c] = value;
    }
  }
  return keys;
}

const gpu = create([]);
const adapter = await gpu.requestAdapter();
const device = adapter ? await adapter.requestDevice() : null;

afterAll(() => {
  device?.destroy();
});

async function runShader(
  dev: GPUDevice,
  keys: Uint32Array,
): Promise<{ a: Uint32Array; b: Uint32Array; f: Float32Array }> {
  const bytes = keys.byteLength;
  const module = dev.createShaderModule({ code: SHADER });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((m) => m.type === 'error');
  if (errors.length > 0) {
    throw new Error(`WGSL compilation failed: ${errors.map((m) => m.message).join('; ')}`);
  }
  const pipeline = await dev.createComputePipelineAsync({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  });
  const input = dev.createBuffer({
    size: bytes,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  dev.queue.writeBuffer(input, 0, keys.buffer, keys.byteOffset, bytes);
  const outputs = [0, 1, 2].map(() =>
    dev.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
  );
  const readbacks = [0, 1, 2].map(() =>
    dev.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
  );
  const bindGroup = dev.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: input } },
      ...outputs.map((buffer, i) => ({ binding: i + 1, resource: { buffer } })),
    ],
  });
  const encoder = dev.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(keys.length / 4 / 64));
  pass.end();
  outputs.forEach((buffer, i) => {
    encoder.copyBufferToBuffer(buffer, 0, readbacks[i] as GPUBuffer, 0, bytes);
  });
  dev.queue.submit([encoder.finish()]);
  const copies: ArrayBuffer[] = [];
  for (const buffer of readbacks) {
    await buffer.mapAsync(GPUMapMode.READ);
    copies.push(buffer.getMappedRange().slice(0));
    buffer.unmap();
  }
  for (const buffer of [input, ...outputs, ...readbacks]) buffer.destroy();
  return {
    a: new Uint32Array(copies[0] as ArrayBuffer),
    b: new Uint32Array(copies[1] as ArrayBuffer),
    f: new Float32Array(copies[2] as ArrayBuffer),
  };
}

describe('webgpu (Dawn) bindings', () => {
  it('finds a GPU adapter, or reports that the GPU tests are being skipped', () => {
    if (!device) {
      console.warn('sim-gpu: no WebGPU adapter available; GPU parity tests are SKIPPED');
    }
    expect(typeof gpu.requestAdapter).toBe('function');
  });
});

describe.skipIf(!device)('WGSL random numbers match TypeScript bit for bit', () => {
  const keys = makeKeys();
  const resultPromise = device ? runShader(device, keys) : null;
  const key = (i: number, c: number): number => keys[4 * i + c] as number;

  it('rng_pcg and rng_hash0 .. rng_hash4 equal pcgHash and hashU32 on 8192 key tuples', async () => {
    const { a, b } = await (resultPromise as NonNullable<typeof resultPromise>);
    let mismatches = 0;
    for (let i = 0; i < COUNT; i++) {
      const [s, k0, k1, k2] = [key(i, 0), key(i, 1), key(i, 2), key(i, 3)];
      if (a[4 * i] !== hashU32(s)) mismatches++;
      if (a[4 * i + 1] !== hashU32(s, k0)) mismatches++;
      if (a[4 * i + 2] !== hashU32(s, k0, k1)) mismatches++;
      if (a[4 * i + 3] !== hashU32(s, k0, k1, k2)) mismatches++;
      if (b[4 * i] !== hashU32(s, k0, k1, k2, i)) mismatches++;
      if (b[4 * i + 3] !== pcgHash(s)) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('rng_int_below equals randomIntBelow, including bounds that need rejection', async () => {
    const { b } = await (resultPromise as NonNullable<typeof resultPromise>);
    let mismatches = 0;
    let rejectingBounds = 0;
    for (let i = 0; i < COUNT; i++) {
      const n = Math.max(key(i, 3), 1);
      if (n > 0x80000000) rejectingBounds++;
      if (b[4 * i + 1] !== randomIntBelow(n, key(i, 0), key(i, 1), key(i, 2))) mismatches++;
    }
    expect(mismatches).toBe(0);
    // The inputs must actually exercise the rejection loop (bounds above 2^31 reject often).
    expect(rejectingBounds).toBeGreaterThan(1000);
  });

  it('rng_unit gives the same f32 bit pattern as u32ToUnitFloat', async () => {
    const { b, f } = await (resultPromise as NonNullable<typeof resultPromise>);
    const expected = new Float32Array(1);
    const expectedBits = new Uint32Array(expected.buffer);
    let mismatches = 0;
    for (let i = 0; i < COUNT; i++) {
      const u = u32ToUnitFloat(hashU32(key(i, 0), key(i, 1), key(i, 2), key(i, 3)));
      expected[0] = u;
      // The TypeScript value must survive the conversion to f32 unchanged...
      if (expected[0] !== u) mismatches++;
      // ...and the GPU must have produced exactly those bits.
      if (b[4 * i + 2] !== expectedBits[0]) mismatches++;
      if (f[4 * i + 2] !== u) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('rng_range and rng_normal agree with TypeScript to f32 accuracy (not bit for bit)', async () => {
    const { f } = await (resultPromise as NonNullable<typeof resultPromise>);
    let worstRange = 0;
    let worstNormal = 0;
    for (let i = 0; i < COUNT; i++) {
      const [s, k0, k1, k2] = [key(i, 0), key(i, 1), key(i, 2), key(i, 3)];
      worstRange = Math.max(
        worstRange,
        Math.abs((f[4 * i + 1] as number) - randomRange(-2, 5, s, k0, k1, k2)),
      );
      worstNormal = Math.max(worstNormal, Math.abs((f[4 * i] as number) - randomNormal(s, k0, k1)));
    }
    // rng_range: one f32 multiply and add on values of magnitude up to 7: a few ulps of 7.
    expect(worstRange).toBeLessThan(4e-6);
    // rng_normal: f32 log near 1 has an absolute error of about 1e-7, which sqrt amplifies when
    // u1 is within a few 2^-24 of 1; 2e-3 bounds that case. Typical differences are ~1e-6.
    expect(worstNormal).toBeLessThan(2e-3);
  });
});
