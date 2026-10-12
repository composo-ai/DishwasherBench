/// <reference types="@webgpu/types" />
// Test support only (not exported by the package): runs a small WGSL compute shader through the
// Dawn bindings (`webgpu`) so that generated WGSL can be compared with its f64 reference. It does
// not use @spotless/sim-gpu, which the parameters package may not depend on.
import { create, globals } from 'webgpu';

interface GpuConstants {
  readonly GPUBufferUsage: {
    readonly MAP_READ: number;
    readonly COPY_SRC: number;
    readonly COPY_DST: number;
    readonly STORAGE: number;
    readonly UNIFORM: number;
  };
  readonly GPUTextureUsage: { readonly COPY_DST: number; readonly TEXTURE_BINDING: number };
  readonly GPUMapMode: { readonly READ: number };
}

const { GPUBufferUsage, GPUTextureUsage, GPUMapMode } = globals as unknown as GpuConstants;

// The instance and the adapter must stay strongly referenced for the life of the device: Dawn
// drops the instance when the object returned by create() is collected, and the process then
// dies with a segmentation fault at the next pipeline creation (spike report, lib.mjs; seen here
// too). A module-level binding that no function captures is collectable once the module has been
// evaluated, so the references are parked on globalThis.
const gpu = create([]);
const adapter = await gpu.requestAdapter();
(globalThis as { spotlessSimParamsGpuKeepAlive?: unknown }).spotlessSimParamsGpuKeepAlive = [
  gpu,
  adapter,
];

/** The test device, or `null` when the machine has no adapter (GPU tests are then skipped). */
export const gpuDevice: GPUDevice | null = adapter ? await adapter.requestDevice() : null;

/** Releases the test device. Call from `afterAll`. */
export function destroyGpuDevice(): void {
  gpuDevice?.destroy();
}

/** What a test shader binds besides its input and output arrays. */
export interface MapKernelExtras {
  /** Uniform block at binding 0: WGSL struct name and contents. Declared as `var<uniform> params`. */
  readonly uniform?: { readonly structName: string; readonly data: Float32Array };
  /** Read-only storage buffer of f32 at binding 3, declared as `tbl`. */
  readonly buffer?: Float32Array;
  /** `r32float` texture at binding 3, declared as `tbl`. */
  readonly texture?: {
    readonly width: number;
    readonly height: number;
    readonly texels: Float32Array;
  };
  /** Read-only storage buffer at binding 4 declared as `rows: array<rowStruct>`. */
  readonly rows?: { readonly structName: string; readonly data: Float32Array };
}

/**
 * Runs `body` once per row. Row i reads `inp[i * inStride + k]` through the local `b`
 * (`inp[b + k]`) and writes `outp[o + k]`, `o = i * outStride`. `prelude` is module-scope WGSL
 * (structs and functions). Returns the output array. Throws on a WGSL compilation error.
 */
export async function runMapKernel(
  device: GPUDevice,
  prelude: string,
  body: string,
  input: Float32Array,
  inStride: number,
  outStride: number,
  extras: MapKernelExtras = {},
): Promise<Float32Array> {
  const rows = input.length / inStride;
  const declarations: string[] = [];
  if (extras.uniform) {
    declarations.push(`@group(0) @binding(0) var<uniform> params: ${extras.uniform.structName};`);
  }
  if (extras.buffer) declarations.push('@group(0) @binding(3) var<storage, read> tbl: array<f32>;');
  if (extras.texture) declarations.push('@group(0) @binding(3) var tbl: texture_2d<f32>;');
  if (extras.rows) {
    declarations.push(
      `@group(0) @binding(4) var<storage, read> rows: array<${extras.rows.structName}>;`,
    );
  }
  // The struct declarations of the prelude must precede the variables that use them, so the
  // variables are declared after the prelude's first part (WGSL allows any order at module scope).
  const code = `
@group(0) @binding(1) var<storage, read> inp: array<f32>;
@group(0) @binding(2) var<storage, read_write> outp: array<f32>;
${declarations.join('\n')}
${prelude}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= ${rows}u) {
    return;
  }
  let b = i * ${inStride}u;
  let o = i * ${outStride}u;
  _ = inp[b]; // keeps the input binding in the automatic layout when the body ignores it
  ${body}
}
`;
  const module = device.createShaderModule({ code });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((m) => m.type === 'error');
  if (errors.length > 0) {
    throw new Error(
      `WGSL compilation failed: ${errors.map((m) => `${m.lineNum}: ${m.message}`).join('; ')}\n${code}`,
    );
  }
  device.pushErrorScope('validation');
  const pipeline = await device.createComputePipelineAsync({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  });
  const storage = (data: Float32Array, usage: number): GPUBuffer => {
    const buffer = device.createBuffer({ size: Math.max(16, data.byteLength), usage });
    device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
    return buffer;
  };
  const inBuffer = storage(input, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const outBytes = rows * outStride * 4;
  const outBuffer = device.createBuffer({
    size: outBytes,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readback = device.createBuffer({
    size: outBytes,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  const entries: GPUBindGroupEntry[] = [
    { binding: 1, resource: { buffer: inBuffer } },
    { binding: 2, resource: { buffer: outBuffer } },
  ];
  const owned: GPUBuffer[] = [inBuffer, outBuffer, readback];
  if (extras.uniform) {
    const buffer = storage(extras.uniform.data, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    owned.push(buffer);
    entries.push({ binding: 0, resource: { buffer } });
  }
  if (extras.buffer) {
    const buffer = storage(extras.buffer, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    owned.push(buffer);
    entries.push({ binding: 3, resource: { buffer } });
  }
  let texture: GPUTexture | null = null;
  if (extras.texture) {
    const { width, height, texels } = extras.texture;
    texture = device.createTexture({
      size: [width, height],
      format: 'r32float',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    device.queue.writeTexture(
      { texture },
      texels.buffer,
      { offset: texels.byteOffset, bytesPerRow: 4 * width, rowsPerImage: height },
      [width, height],
    );
    entries.push({ binding: 3, resource: texture.createView() });
  }
  if (extras.rows) {
    const buffer = storage(extras.rows.data, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    owned.push(buffer);
    entries.push({ binding: 4, resource: { buffer } });
  }
  const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(rows / 64));
  pass.end();
  encoder.copyBufferToBuffer(outBuffer, 0, readback, 0, outBytes);
  device.queue.submit([encoder.finish()]);
  const validation = await device.popErrorScope();
  if (validation) throw new Error(`WebGPU validation error: ${validation.message}\n${code}`);
  await readback.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(readback.getMappedRange().slice(0));
  readback.unmap();
  for (const buffer of owned) buffer.destroy();
  texture?.destroy();
  return result;
}
