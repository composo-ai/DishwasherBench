/**
 * Where the exposure stages trace their rays: the GPU kernel of the scene
 * (`createGpuTracer` of `@spotless/sim-scene`) when a device is available, the scene's f64
 * reference tracer otherwise.
 *
 * A stage hands over a batch of `TraceRay` records (32 bytes each: origin, length, direction,
 * key) with the angles of the rotating parts and gets back `TraceHit` records (distance, block,
 * soil cell, triangle, normal, cosine of incidence). The two back ends answer the same
 * question with the same record; they differ on about one grazing ray in 100,000 (the scene
 * engineer's measurement), so a result computed on the CPU is not bit-identical to one computed
 * on the GPU. Which one ran is reported (`TraceBackend.kind`).
 *
 * The device. `ExposureStageInput.gpu` names it when the caller has one; `null` asks for the
 * CPU. When the input says nothing, the stages use the context of this process: under Node it
 * is made once from the Dawn bindings (`@spotless/sim-gpu/node`), which this package reaches by
 * a relative path because the dependency table gives it `@spotless/sim-gpu` only through the
 * main entry point of `@spotless/sim-scene` (reported as a request; the orchestrator should
 * make the context and pass it). `setExposureGpu` overrides that for a process.
 *
 * The scene's buffers (about 100 MB for a full load) stay on the device for the scene that was
 * traced last, so that the four spray states of a wash share one upload.
 */

import {
  createGpuTracer,
  HIT_WORDS,
  RAY_WORDS,
  type GpuContext,
  type GpuTracer,
  type TraceData,
  type WashScene,
} from '@spotless/sim-scene';

/** A tracer of batches of rays against one scene. */
export interface TraceBackend {
  /** `gpu`: the kernel of the scene on a device; `cpu`: the f64 reference tracer. */
  readonly kind: 'gpu' | 'cpu';
  /**
   * Traces the first `count` rays of `rays` (`TraceRay` records) with the rotating parts at
   * `angles` (radians, one per rotating root) and returns their `TraceHit` records. `seed`
   * decides, with the key of each ray, the passage through porous parts.
   */
  trace(
    rays: ArrayBuffer,
    count: number,
    angles: readonly number[],
    seed: number,
  ): Promise<ArrayBuffer>;
  /** Bytes of the scene on the device (0 on the CPU). */
  readonly sceneBytes: number;
}

/** Most rays of one dispatch; larger batches are split (bounds the staging buffers). */
export const TRACE_BATCH_RAYS = 1 << 20;

let override: GpuContext | null | undefined;
let own: Promise<GpuContext | null> | undefined;
let resident:
  | { readonly data: TraceData; readonly gpu: GpuContext; readonly tracer: Promise<GpuTracer> }
  | undefined;
let serial = 0;

/**
 * Sets the device of this process for the exposure stages: a context to use it, `null` to
 * trace on the CPU, `undefined` to go back to the default (the Dawn bindings under Node).
 */
export function setExposureGpu(gpu: GpuContext | null | undefined): void {
  override = gpu;
}

/** Releases the scene buffers the exposure stages keep on the device. */
export async function releaseExposureGpu(): Promise<void> {
  if (resident === undefined) return;
  const held = resident;
  resident = undefined;
  (await held.tracer).release();
}

async function defaultGpu(): Promise<GpuContext | null> {
  const node = (globalThis as { process?: { versions?: { node?: string } } }).process?.versions
    ?.node;
  if (node === undefined) return null;
  try {
    // See the file comment: the Node-only entry point of sim-gpu, by a relative path.
    const bindings = await import('../../sim-gpu/src/node/index.ts');
    return await bindings.createNodeGpuContext({ sim: 'spotless-sim exposure' });
  } catch {
    // No adapter, or no bindings on this platform: the CPU tracer answers.
    return null;
  }
}

async function gpuFor(requested: GpuContext | null | undefined): Promise<GpuContext | null> {
  if (requested !== undefined) return requested;
  if (override !== undefined) return override;
  own ??= defaultGpu();
  return own;
}

/** Which tracer the exposure stages will use, before anything is traced. */
export interface ExposureBackendInfo {
  readonly kind: 'gpu' | 'cpu';
  /**
   * The stack of the device (adapter, driver, bindings) as it identifies itself; empty on the
   * CPU. Exposure computed on one stack is not bit-identical to that of another.
   */
  readonly stack: string;
  /**
   * True when the CPU answers although nobody asked for it: no device was named, none was set
   * for the process, and the default one could not be made (no adapter, no bindings).
   */
  readonly fallback: boolean;
}

/**
 * Which tracer `acquireTraceBackend` will hand out for `gpu` (as `ExposureStageInput.gpu`):
 * nothing is uploaded. The orchestrator puts this in its cache keys and reports a fallback.
 */
export async function exposureBackendInfo(gpu?: GpuContext | null): Promise<ExposureBackendInfo> {
  const device = await gpuFor(gpu);
  if (device === null) {
    return { kind: 'cpu', stack: '', fallback: gpu === undefined && override === undefined };
  }
  return { kind: 'gpu', stack: JSON.stringify(device.stack), fallback: false };
}

/**
 * The tracer of a scene: on `gpu` when it is a context, on the CPU when it is `null`, on the
 * device of this process when it is `undefined`.
 */
export async function acquireTraceBackend(
  scene: WashScene,
  gpu?: GpuContext | null,
): Promise<TraceBackend> {
  const device = await gpuFor(gpu);
  if (device === null) {
    const tracer = scene.rays;
    return {
      kind: 'cpu',
      sceneBytes: 0,
      trace(rays, count, angles, seed) {
        tracer.setAngles(angles);
        const hits = tracer.traceBatch(rays, count, seed >>> 0, 0);
        tracer.setAngles([]);
        return Promise.resolve(hits);
      },
    };
  }
  if (resident === undefined || resident.data !== scene.trace || resident.gpu !== device) {
    await releaseExposureGpu();
    resident = {
      data: scene.trace,
      gpu: device,
      tracer: createGpuTracer(device, scene.trace, `exposure${serial++}`),
    };
  }
  const tracer = await resident.tracer;
  return {
    kind: 'gpu',
    sceneBytes: tracer.sceneBytes,
    async trace(rays, count, angles, seed) {
      if (count <= TRACE_BATCH_RAYS) {
        return tracer.trace(rays, count, { angles, seed: seed >>> 0 });
      }
      const out = new ArrayBuffer(4 * HIT_WORDS * count);
      const all = new Uint8Array(out);
      for (let first = 0; first < count; first += TRACE_BATCH_RAYS) {
        const n = Math.min(TRACE_BATCH_RAYS, count - first);
        const part = await tracer.trace(
          rays.slice(4 * RAY_WORDS * first, 4 * RAY_WORDS * (first + n)),
          n,
          { angles, seed: seed >>> 0 },
        );
        all.set(new Uint8Array(part, 0, 4 * HIT_WORDS * n), 4 * HIT_WORDS * first);
      }
      return out;
    },
  };
}
