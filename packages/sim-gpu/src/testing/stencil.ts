/**
 * The B1 kernel of the GPU spike, run through this package's wrapper: a structured 5-point
 * stencil on four f32 per cell (a lazy Lax-Friedrichs shallow-water step with a wet/dry branch
 * and friction). It is the fixture behind the M1 test "the B1 stencil of the spike reproduces
 * hash ba69c15a8d62ffc6" (docs/design/sim-core.md section M1) and behind the workgroup-size,
 * batching and second-process invariance tests, and it is the first benchmark of the harness.
 *
 * The WGSL and the initial state are copied from spikes/gpu-compute/stencil.mjs and must stay
 * byte-identical in effect: the recorded hash depends on every operation. The quantities are
 * dimensionless test data, not physics of the simulator.
 */

import { BUFFER_USAGE } from '../usage.ts';
import type { BatchOp, GpuContext, Kernel, ManagedBuffer } from '../types.ts';
import { uniformBlock } from '../wgsl.ts';

/** Parameters of the spike's stencil (dimensionless). */
export const STENCIL_PARAMS = { lam: 0.2, g: 1.0, fric: 0.002, eps: 1e-4, decay: 1e-4 } as const;

/** The hash the spike recorded for 200 steps on a 1024 x 1024 grid (section M1, [MEASURED]). */
export const STENCIL_SPIKE_HASH = 'ba69c15a8d62ffc6';

const PARAMS_BLOCK = uniformBlock('Params', [
  { name: 'w', type: 'u32' },
  { name: 'h', type: 'u32' },
  { name: 'lam', type: 'f32' },
  { name: 'g', type: 'f32' },
  { name: 'fric', type: 'f32' },
  { name: 'eps', type: 'f32' },
  { name: 'decay', type: 'f32' },
  { name: 'pad', type: 'f32' },
]);

/** The stencil kernel with a workgroup of `wx` by `wy` invocations. */
export function stencilWgsl(wx: number, wy: number): string {
  return /* wgsl */ `
${PARAMS_BLOCK.wgsl}
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

/** The spike's deterministic initial state with wet and dry regions: four f32 per cell. */
export function stencilInitialState(w: number, h: number): Float32Array {
  const a = new Float32Array(w * h * 4);
  const kx = (2 * Math.PI * 3) / w;
  const ky = (2 * Math.PI * 2) / h;
  for (let y = 0; y < h; y++) {
    const sy = Math.sin(y * ky);
    const cy = Math.cos(y * ky * 2.5);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // Integer hash noise in [0, 1).
      let n = (x * 374761393 + y * 668265263) | 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      n = (n ^ (n >>> 16)) >>> 0;
      const r = n / 4294967296;
      const hh = Math.max(
        0,
        0.35 + 0.5 * Math.sin(x * kx) * sy + 0.25 * Math.cos(x * kx * 3.7) * cy + 0.05 * r - 0.2,
      );
      a[i] = hh;
      a[i + 1] = 0.1 * hh * cy;
      a[i + 2] = -0.1 * hh * sy;
      a[i + 3] = hh * r;
    }
  }
  return a;
}

/** How a stencil run is set up. */
export interface StencilOptions {
  /** Grid width and height, cells. */
  readonly w: number;
  readonly h: number;
  /** Workgroup size; default 8 by 8 as in the spike. */
  readonly wx?: number;
  readonly wy?: number;
  /**
   * Planning rate, cell updates per second, from which each step's planned time is computed;
   * default 4e9 (spike report section 11, [MEASURED] 4.0 G cell updates per second).
   */
  readonly planningRate?: number;
  /** Largest planned time of one command buffer, seconds; default that of the context. */
  readonly maxPlannedTime?: number;
  /** Prefix of the buffer names; default `stencil`. Two live simulations need two prefixes. */
  readonly name?: string;
}

/** A stencil simulation: two state buffers used alternately. */
export interface StencilSim {
  /** Cells of the grid. */
  readonly cells: number;
  /** The buffer that holds the state after the steps encoded so far. */
  current(): ManagedBuffer;
  /** The dispatches of `steps` further steps, in order. */
  steps(steps: number): BatchOp[];
  /** Restores the initial state. */
  reset(): void;
  /** Releases the buffers. */
  release(): void;
}

/** Creates a stencil simulation with its initial state uploaded. */
export async function createStencil(ctx: GpuContext, options: StencilOptions): Promise<StencilSim> {
  const { w, h } = options;
  const wx = options.wx ?? 8;
  const wy = options.wy ?? 8;
  const prefix = options.name ?? 'stencil';
  const kernel: Kernel = await ctx.kernel({
    name: `stencil-${wx}x${wy}`,
    wgsl: stencilWgsl(wx, wy),
    entry: 'main',
    bindings: [
      { group: 0, binding: 0, name: 'params', kind: 'uniform' },
      { group: 0, binding: 1, name: 'src', kind: 'read-only-storage' },
      { group: 0, binding: 2, name: 'dst', kind: 'storage' },
    ],
    uses: ['addmul', 'div', 'fma'],
    reads: ['params', 'src'],
    writes: ['dst'],
    atomics: [],
  });
  const state = (suffix: string): ManagedBuffer =>
    ctx.buffer({
      name: `${prefix}.${suffix}`,
      owner: 'sim-gpu',
      stage: 'run',
      bytes: w * h * 16,
      usage: BUFFER_USAGE.STORAGE,
      fields: [{ name: 'U', type: 'f32', role: 'state', unit: '1' }],
    });
  const buffers = [state('a'), state('b')];
  const params = ctx.buffer({
    name: `${prefix}.params`,
    owner: 'sim-gpu',
    stage: 'run',
    bytes: PARAMS_BLOCK.byteSize,
    usage: BUFFER_USAGE.UNIFORM,
    fields: [{ name: 'word', type: 'u32', role: 'static', unit: '-' }],
  });
  ctx.write(params, PARAMS_BLOCK.pack({ w, h, ...STENCIL_PARAMS, pad: 0 }));
  const initial = stencilInitialState(w, h);
  ctx.write(buffers[0] as ManagedBuffer, initial);
  let cur = 0;
  const plannedTime = (w * h) / (options.planningRate ?? 4e9);
  const workgroups = [Math.ceil(w / wx), Math.ceil(h / wy), 1] as const;
  return {
    cells: w * h,
    current: () => buffers[cur] as ManagedBuffer,
    steps(steps) {
      const ops: BatchOp[] = [];
      for (let i = 0; i < steps; i++) {
        ops.push({
          op: 'dispatch',
          kernel,
          bindings: {
            params,
            src: buffers[cur] as ManagedBuffer,
            dst: buffers[1 - cur] as ManagedBuffer,
          },
          workgroups,
          plannedTime,
        });
        cur = 1 - cur;
      }
      return ops;
    },
    reset() {
      ctx.write(buffers[0] as ManagedBuffer, initial);
      cur = 0;
    },
    release() {
      for (const b of [...buffers, params]) ctx.release(b);
    },
  };
}

/**
 * Runs `steps` steps from the initial state and returns the final state bytes (four f32 per
 * cell, row-major).
 */
export async function runStencil(
  ctx: GpuContext,
  options: StencilOptions & { readonly steps: number },
): Promise<Uint8Array> {
  const sim = await createStencil(ctx, options);
  try {
    await ctx.run(
      sim.steps(options.steps),
      options.maxPlannedTime !== undefined ? { maxPlannedTime: options.maxPlannedTime } : undefined,
    );
    return new Uint8Array(await ctx.read(sim.current()));
  } finally {
    sim.release();
  }
}
