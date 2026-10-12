/**
 * The GPU tracer of a scene: the buffers of a `TraceData` on the device and the kernel of
 * `trace.wgsl.ts`, through the wrapper of `@spotless/sim-gpu` (docs/design/sim-core.md
 * sections 3.5 and M1). It answers batches of rays and of short segments (droplets on curved
 * paths are chains of segments) with hit distance, block, soil cell and normal.
 *
 * Rays are `TraceRay` records and hits `TraceHit` records (`trace-data.ts`), 32 bytes each.
 * Rotating parts are posed per batch: every ray of one batch sees the spray arms at the same
 * angles.
 *
 * Units: metres, radians. Frame: tub frame.
 */

import {
  BUFFER_USAGE,
  dispatchGrid,
  type BatchOp,
  type GpuContext,
  type Kernel,
  type ManagedBuffer,
} from '@spotless/sim-gpu';
import { BVH_NODE_LAYOUT } from './layouts.ts';
import { rootTransform } from './trace-cpu.ts';
import {
  HIT_WORDS,
  packTraceTables,
  packTraceTriangles,
  RAY_WORDS,
  TRACE_HIT_LAYOUT,
  TRACE_NUMERICS,
  TRACE_RAY_LAYOUT,
  TRACE_TRIANGLE_LAYOUT,
  type TraceData,
} from './trace-data.ts';
import {
  TRACE_PARAMS_BYTES,
  TRACE_PARAMS_HEADER_WORDS,
  TRACE_WGSL,
  TRACE_WORKGROUP,
} from './trace.wgsl.ts';

/** How one batch is traced. */
export interface GpuTraceOptions {
  /** One angle per rotating root, in root order, radians (0 the reference pose); default 0. */
  readonly angles?: readonly number[];
  /** Seed of the passage through porous parts (u32); default 0. */
  readonly seed?: number;
  /** Added to the key of every ray (u32); default 0. */
  readonly keyBase?: number;
  /**
   * Planning rate of the kernel, rays per second, from which the planned time of the dispatch
   * is computed (never measured during a run); default {@link TRACE_PLANNING_RATE}.
   */
  readonly planningRate?: number;
}

/**
 * Planning rate of the trace kernel, rays per second: a little under the slower of the two rates
 * the full-load benchmark of this package measured on the reference machine (78 M rays/s for
 * jet-like bundles, 106 M for short segments; bench/out/full-load.json). It replaces the
 * 60 M segment queries per second the contract planned with (section 7.1).
 */
export const TRACE_PLANNING_RATE = 70e6;

/** The tracer of one scene on one device. */
export interface GpuTracer {
  /** Bytes of the buffers that hold the scene (nodes, triangles, tables). */
  readonly sceneBytes: number;
  /**
   * The dispatch that traces the first `count` rays of `rays` into `hits`. The uniform block is
   * written when this is called, so the returned steps must be submitted before the tracer is
   * asked for another batch.
   */
  encode(
    rays: ManagedBuffer,
    hits: ManagedBuffer,
    count: number,
    options?: GpuTraceOptions,
  ): BatchOp[];
  /** Creates a ray buffer and a hit buffer for up to `capacity` rays, named after `name`. */
  createBatchBuffers(name: string, capacity: number): { rays: ManagedBuffer; hits: ManagedBuffer };
  /**
   * Traces `count` rays given as `TraceRay` records and returns their `TraceHit` records: upload,
   * dispatch and read-back. For tests and small batches; a stage that keeps its rays on the GPU
   * uses `encode`.
   */
  trace(rays: ArrayBuffer, count: number, options?: GpuTraceOptions): Promise<ArrayBuffer>;
  /** Releases every buffer of the tracer. */
  release(): void;
}

const WORD_FIELD = [{ name: 'word', type: 'u32', role: 'static', unit: '-' }] as const;

/**
 * Uploads the ray data of a scene and compiles the kernel. `name` prefixes the buffer names, so
 * two scenes can be resident on one device.
 */
export async function createGpuTracer(
  gpu: GpuContext,
  data: TraceData,
  name = 'scene',
): Promise<GpuTracer> {
  const kernel: Kernel = await gpu.kernel({
    name: 'scene-trace',
    wgsl: gpu.wgsl.assemble(TRACE_WGSL),
    entry: 'main',
    bindings: [
      { group: 0, binding: 0, name: 'params', kind: 'uniform' },
      { group: 0, binding: 1, name: 'nodes', kind: 'read-only-storage' },
      { group: 0, binding: 2, name: 'tris', kind: 'read-only-storage' },
      { group: 0, binding: 3, name: 'tables', kind: 'read-only-storage' },
      { group: 0, binding: 4, name: 'rays', kind: 'read-only-storage' },
      { group: 0, binding: 5, name: 'hits', kind: 'storage' },
    ],
    uses: ['addmul', 'div', 'sqrt', 'atan2', 'ftoi', 'bitcast'],
    reads: ['params', 'nodes', 'tris', 'tables', 'rays'],
    writes: ['hits'],
    atomics: [],
  });
  const tables = packTraceTables(data);
  const triangles = packTraceTriangles(data);
  const nodeBytes = Math.max(64, data.nodes.byteLength);
  const nodes = gpu.buffer({
    name: `${name}.trace.nodes`,
    owner: 'sim-scene',
    stage: 'run',
    bytes: nodeBytes,
    usage: BUFFER_USAGE.STORAGE,
    layout: BVH_NODE_LAYOUT,
  });
  if (data.nodes.byteLength > 0) gpu.write(nodes, data.nodes);
  const tris = gpu.buffer({
    name: `${name}.trace.triangles`,
    owner: 'sim-scene',
    stage: 'run',
    bytes: triangles.byteLength,
    usage: BUFFER_USAGE.STORAGE,
    layout: TRACE_TRIANGLE_LAYOUT,
  });
  gpu.write(tris, triangles);
  const table = gpu.buffer({
    name: `${name}.trace.tables`,
    owner: 'sim-scene',
    stage: 'run',
    bytes: tables.words.byteLength,
    usage: BUFFER_USAGE.STORAGE,
    fields: WORD_FIELD,
  });
  gpu.write(table, tables.words);
  const params = gpu.buffer({
    name: `${name}.trace.params`,
    owner: 'sim-scene',
    stage: 'run',
    bytes: TRACE_PARAMS_BYTES,
    usage: BUFFER_USAGE.UNIFORM,
    fields: WORD_FIELD,
  });
  const owned: ManagedBuffer[] = [nodes, tris, table, params];
  let scratch: { rays: ManagedBuffer; hits: ManagedBuffer; capacity: number } | null = null;
  let scratchSerial = 0;

  const writeParams = (count: number, row: number, options: GpuTraceOptions): void => {
    const bytes = new ArrayBuffer(TRACE_PARAMS_BYTES);
    const u = new Uint32Array(bytes);
    const f = new Float32Array(bytes);
    u[0] = count;
    u[1] = row;
    u[2] = (options.seed ?? 0) >>> 0;
    u[3] = (options.keyBase ?? 0) >>> 0;
    u[4] = data.roots.length;
    u[5] = tables.patchBase;
    u[6] = tables.rowBase;
    u[7] = tables.cellBase;
    u[8] = tables.soilBase;
    u[9] = TRACE_NUMERICS.newtonSteps;
    u[10] = TRACE_NUMERICS.maxSwitches;
    f[11] = data.chordError;
    f[12] = TRACE_NUMERICS.detMin;
    f[13] = TRACE_NUMERICS.acceptResidual;
    f[14] = TRACE_NUMERICS.maxStepChords * data.chordError;
    f[15] = TRACE_NUMERICS.minSlope;
    u[16] = tables.quarterBase;
    let rotating = 0;
    data.roots.forEach((root, k) => {
      const o = TRACE_PARAMS_HEADER_WORDS + 16 * k;
      if (root.rotating === null) {
        f[o] = 1;
        f[o + 5] = 1;
        f[o + 10] = 1;
      } else {
        const a = rootTransform(root.rotating, options.angles?.[rotating++] ?? 0);
        for (let r = 0; r < 3; r++) {
          f[o + 4 * r] = a.m[3 * r] as number;
          f[o + 4 * r + 1] = a.m[3 * r + 1] as number;
          f[o + 4 * r + 2] = a.m[3 * r + 2] as number;
          f[o + 4 * r + 3] = a.c[r] as number;
        }
      }
      u[o + 12] = root.node;
    });
    gpu.write(params, bytes);
  };

  const encode = (
    rays: ManagedBuffer,
    hits: ManagedBuffer,
    count: number,
    options: GpuTraceOptions = {},
  ): BatchOp[] => {
    if (count === 0) return [];
    const grid = dispatchGrid(count, TRACE_WORKGROUP);
    writeParams(count, grid.row, options);
    return [
      {
        op: 'dispatch',
        kernel,
        bindings: { params, nodes, tris, tables: table, rays, hits },
        workgroups: grid.workgroups,
        plannedTime: count / (options.planningRate ?? TRACE_PLANNING_RATE),
      },
    ];
  };

  const createBatchBuffers = (
    bufferName: string,
    capacity: number,
  ): { rays: ManagedBuffer; hits: ManagedBuffer } => ({
    rays: gpu.buffer({
      name: `${bufferName}.rays`,
      owner: 'sim-scene',
      stage: 'run',
      bytes: 4 * RAY_WORDS * Math.max(1, capacity),
      usage: BUFFER_USAGE.STORAGE,
      layout: TRACE_RAY_LAYOUT,
    }),
    hits: gpu.buffer({
      name: `${bufferName}.hits`,
      owner: 'sim-scene',
      stage: 'run',
      bytes: 4 * HIT_WORDS * Math.max(1, capacity),
      usage: BUFFER_USAGE.STORAGE,
      layout: TRACE_HIT_LAYOUT,
    }),
  });

  return {
    sceneBytes: nodeBytes + triangles.byteLength + tables.words.byteLength,
    encode,
    createBatchBuffers,
    async trace(rays, count, options = {}) {
      if (count === 0) return new ArrayBuffer(0);
      if (scratch === null || scratch.capacity < count) {
        if (scratch !== null) {
          gpu.release(scratch.rays);
          gpu.release(scratch.hits);
        }
        scratch = {
          ...createBatchBuffers(`${name}.trace.scratch${scratchSerial++}`, count),
          capacity: count,
        };
      }
      gpu.write(scratch.rays, new Uint8Array(rays, 0, 4 * RAY_WORDS * count));
      await gpu.run(encode(scratch.rays, scratch.hits, count, options));
      return gpu.read(scratch.hits, 0, 4 * HIT_WORDS * count);
    },
    release() {
      for (const buffer of owned) gpu.release(buffer);
      if (scratch !== null) {
        gpu.release(scratch.rays);
        gpu.release(scratch.hits);
        scratch = null;
      }
    },
  };
}
