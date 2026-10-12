/**
 * The implementation of {@link GpuContext} (docs/design/sim-core.md section M1): the device
 * wrapper, registered buffers, the kernel cache, batched dispatch and the entry points of the
 * integer reductions and the non-finite guard. The rules of section 6 that can be enforced
 * mechanically at this level are enforced here: limits requested from the adapter, every
 * binding below 2^32 - 4 bytes, at most 8 storage buffers and 3 bind groups per kernel, the
 * narrow-field rule at buffer registration, command buffers sized from planned time only, and
 * device loss or any WebGPU error reported as a failure.
 *
 * Nothing here is specific to Node: the WebGPU entry object (`navigator.gpu` in a browser, the
 * Dawn bindings in Node) is passed in as a {@link GpuEntry}; `node/device.ts` builds one.
 *
 * Units: bytes and seconds.
 */

import { sha256Hex } from '@spotless/core';
import { countNonFiniteOnGpu, floatWordMask, guardKernelDef } from './guard.ts';
import { fieldRuleProblems, layoutProblems, type RecordLayout } from './layout.ts';
import { reduceI64OnGpu, reduceKernelDef, type ReduceKernels } from './reduce.ts';
import {
  BINDING_BYTES_LIMIT,
  COMMAND_BUFFER_PLANNED_S,
  DEFAULT_MAX_LIVE_BYTES,
  MAX_BIND_GROUPS_PER_KERNEL,
  MAX_STORAGE_BUFFERS_PER_KERNEL,
  OP_CLASSES,
  type AccumulatorPair,
  type BatchOp,
  type BindingDef,
  type BindingResource,
  type BufferDescriptor,
  type Dispatch,
  type DispatchBatch,
  type FieldDef,
  type GpuContext,
  type GpuFailure,
  type GpuStats,
  type Kernel,
  type KernelDef,
  type ManagedBuffer,
  type OpClass,
  type ReduceSpec,
  type StackString,
  type StageId,
  type SubmitOptions,
} from './types.ts';
import { BUFFER_USAGE } from './usage.ts';
import { createWgslLibrary, opClassesInWgsl, wgslUsesAtomics, type WgslLibrary } from './wgsl.ts';

/** `GPUMapMode.READ` of the WebGPU specification. */
const MAP_MODE_READ = 0x0001;
/** `GPUShaderStage.COMPUTE` of the WebGPU specification. */
const SHADER_STAGE_COMPUTE = 0x0004;
/** Bytes written to a buffer per `writeBuffer` call (spike report: large writes are chunked). */
const UPLOAD_CHUNK_BYTES = 64 * 2 ** 20;
/** The staging buffer is kept between reads only up to this size, bytes. */
const STAGING_KEEP_BYTES = 64 * 2 ** 20;
/** Smallest staging buffer, bytes. */
const STAGING_MIN_BYTES = 64 * 2 ** 10;
/** `run()` awaits the GPU after this many command buffers (spike report section 12: 2 to 4). */
const RUN_AWAIT_EVERY = 4;

/**
 * Thrown (as a rejection) by the asynchronous methods of a context whose device was lost or
 * reported an error. It is an infrastructure failure in the sense of platform.md section 2:
 * the run fails; nothing is truncated or retried (determinism rule 12).
 */
export class GpuInfrastructureError extends Error {
  /** What failed. */
  readonly failure: GpuFailure;

  constructor(failure: GpuFailure) {
    super(`GPU ${failure.kind}: ${failure.message}`);
    this.name = 'GpuInfrastructureError';
    this.failure = failure;
  }
}

/**
 * What an environment supplies to create a context: the WebGPU entry object and the parts of
 * the stack string only the environment knows. In a browser `gpu` is `navigator.gpu`; in Node
 * it is the object returned by the Dawn bindings (`nodeGpuEntry` in `node/device.ts`). The
 * context keeps the entry referenced for as long as it lives, which is what keeps the Dawn
 * instance alive (spike report section 3: a collected instance rejects every later call).
 */
export interface GpuEntry {
  /** The WebGPU entry object. */
  readonly gpu: GPU;
  /** Operating-system name and build, for example `macOS 27.0.1 (26A434)`. */
  readonly os: string;
  /** Version of the WebGPU implementation, for example `webgpu 0.6.2` or a browser build. */
  readonly webgpu: string;
  /** JavaScript runtime and version, for example `node 20.19.0`. */
  readonly runtime: string;
}

/** Options of {@link createGpuContext}. */
export interface GpuContextOptions {
  /** The WebGPU entry object and the environment's part of the stack string. */
  readonly entry: GpuEntry;
  /** Simulator version for the stack string, `MAJOR.MINOR.PATCH`. */
  readonly sim: string;
  /** Rigid-body engine and version for the stack string. */
  readonly physics: string;
  /** Ceiling on the bytes of live registered buffers; default {@link DEFAULT_MAX_LIVE_BYTES}. */
  readonly maxLiveBytes?: number;
  /** Called once, with the first failure of the device. */
  readonly onFailure?: (failure: GpuFailure) => void;
}

class BufferImpl implements ManagedBuffer {
  handle: GPUBuffer | null;

  constructor(
    readonly id: number,
    readonly name: string,
    readonly owner: string,
    readonly stage: StageId | 'run',
    readonly bytes: number,
    readonly usage: GPUBufferUsageFlags,
    readonly fields: readonly FieldDef[],
    readonly layout: RecordLayout | undefined,
    handle: GPUBuffer,
  ) {
    this.handle = handle;
  }

  get released(): boolean {
    return this.handle === null;
  }

  get gpu(): GPUBuffer {
    if (this.handle === null) throw new Error(`buffer ${this.name} has been released`);
    return this.handle;
  }
}

interface CachedBindGroup {
  readonly group: GPUBindGroup;
  readonly bufferIds: readonly number[];
}

interface PipelineEntry {
  readonly pipeline: GPUComputePipeline;
  readonly layouts: readonly GPUBindGroupLayout[];
  /** Bind groups by group index, keyed by the resources bound. */
  readonly bindGroups: Map<string, CachedBindGroup>[];
}

interface KernelImpl extends Kernel {
  readonly entry: PipelineEntry;
  /** The bindings of each group, sorted by binding index. */
  readonly groups: readonly (readonly BindingDef[])[];
}

/**
 * The problems of a list of registered fields under determinism rule 7 and the bound rule: the
 * same per-field checker a record layout is held to (`fieldRuleProblems` in layout.ts), so that
 * a buffer registered with `fields` and one registered with a `layout` cannot disagree.
 */
function fieldProblems(fields: readonly FieldDef[]): string[] {
  return fields.flatMap((field) => fieldRuleProblems(field));
}

function isManaged(resource: BindingResource): resource is ManagedBuffer {
  return 'gpu' in resource;
}

/**
 * Creates a context: requests an adapter and a device with every limit the adapter offers,
 * builds the stack string, and installs the failure handlers. Rejects with
 * {@link GpuInfrastructureError} if there is no adapter.
 */
export async function createGpuContext(options: GpuContextOptions): Promise<GpuContext> {
  const { entry } = options;
  const adapter = await entry.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (adapter === null) {
    throw new GpuInfrastructureError({ kind: 'internal', message: 'no WebGPU adapter available' });
  }
  // The default limits are too small (a 16 M cell state is twice the default binding size), so
  // every numeric limit the adapter reports is requested (section M1).
  const requiredLimits: Record<string, number> = {};
  const offered = adapter.limits as unknown as Readonly<Record<string, unknown>>;
  for (const key in offered) {
    const value = offered[key];
    if (typeof value === 'number') requiredLimits[key] = value;
  }
  const device = await adapter.requestDevice({ requiredLimits });
  if (
    device.limits.maxStorageBuffersPerShaderStage < MAX_STORAGE_BUFFERS_PER_KERNEL ||
    device.limits.maxBindGroups < MAX_BIND_GROUPS_PER_KERNEL
  ) {
    device.destroy();
    throw new GpuInfrastructureError({
      kind: 'internal',
      message: `device offers ${device.limits.maxStorageBuffersPerShaderStage} storage buffers and ${device.limits.maxBindGroups} bind groups; ${MAX_STORAGE_BUFFERS_PER_KERNEL} and ${MAX_BIND_GROUPS_PER_KERNEL} are needed`,
    });
  }
  const info = adapter.info;
  const gpuName =
    [info.vendor, info.architecture, info.device].filter((s) => s.length > 0).join(' ') ||
    info.description ||
    'unknown';
  const stack: StackString = {
    sim: options.sim,
    gpu: gpuName,
    os: entry.os,
    webgpu: entry.webgpu,
    runtime: entry.runtime,
    physics: options.physics,
  };
  const context = new Context(entry, adapter, device, stack, options);
  // The kernels of the reductions and of the guard are compiled here, once, so that a reduction
  // or a guard call can encode its dispatches synchronously: it then covers exactly the work
  // submitted before the call, whether the pipeline cache is cold or warm (section 6).
  await context.prepare();
  return context;
}

class Context implements GpuContext {
  readonly wgsl: WgslLibrary = createWgslLibrary();

  private firstFailure: GpuFailure | null = null;
  private destroying = false;
  private nextBufferId = 1;
  private readonly live = new Map<string, BufferImpl>();
  private readonly pipelines = new Map<string, Promise<PipelineEntry>>();
  private readonly compiled: PipelineEntry[] = [];
  private readonly textureIds = new WeakMap<GPUTextureView, number>();
  private nextTextureId = 1;
  private readonly pendingScopes: { kind: GpuFailure['kind']; error: Promise<GPUError | null> }[] =
    [];
  /** Reject callbacks of the waits in flight (see `untilDone`). */
  private readonly waiters = new Set<(reason: Error) => void>();
  private staging: GPUBuffer | null = null;
  private stagingBusy = false;
  /** Names of the kernels registered so far, by operation class they declared. */
  private readonly kernelsByClass = new Map<OpClass, Set<string>>();
  private reduceKernels: ReduceKernels | null = null;
  private guardKernel: Kernel | null = null;
  private readonly maxLiveBytes: number;
  private readonly counters = {
    commandBuffers: 0,
    dispatches: 0,
    pipelinesCompiled: 0,
    liveBytes: 0,
    peakBytes: 0,
    readbacks: 0,
  };

  constructor(
    /** Held so that the WebGPU instance outlives the device (see {@link GpuEntry}). */
    readonly entry: GpuEntry,
    /** Held for the same reason: the spike kept the adapter referenced as well. */
    readonly adapter: GPUAdapter,
    readonly device: GPUDevice,
    readonly stack: StackString,
    private readonly options: GpuContextOptions,
  ) {
    this.maxLiveBytes = options.maxLiveBytes ?? DEFAULT_MAX_LIVE_BYTES;
    device.addEventListener('uncapturederror', (event) => {
      const error = (event as GPUUncapturedErrorEvent).error;
      this.fail({ kind: 'uncaptured-error', message: error.message });
    });
    void device.lost.then((lostInfo) => {
      if (this.destroying) return;
      this.fail({
        kind: 'device-lost',
        message: `${lostInfo.reason ?? 'unknown'}: ${lostInfo.message}`,
      });
    });
  }

  /** Compiles the kernels the context itself dispatches (reductions and the guard). */
  async prepare(): Promise<void> {
    const reduce = (stage: 'leaf' | 'node', table: boolean): Promise<Kernel> =>
      this.kernel(reduceKernelDef(this.wgsl, stage, table));
    const [leaf, node, leafTable, nodeTable, guard] = await Promise.all([
      reduce('leaf', false),
      reduce('node', false),
      reduce('leaf', true),
      reduce('node', true),
      this.kernel(guardKernelDef(this.wgsl)),
    ]);
    this.reduceKernels = { leaf, node, leafTable, nodeTable };
    this.guardKernel = guard;
  }

  get stats(): GpuStats {
    return { ...this.counters, liveBuffers: this.live.size };
  }

  failure(): GpuFailure | null {
    return this.firstFailure;
  }

  private fail(failure: GpuFailure): void {
    if (this.firstFailure !== null) return;
    this.firstFailure = failure;
    this.rejectWaiters(new GpuInfrastructureError(failure));
    this.options.onFailure?.(failure);
  }

  private rejectWaiters(reason: Error): void {
    const waiting = [...this.waiters];
    this.waiters.clear();
    for (const reject of waiting) reject(reason);
  }

  /**
   * `work`, or a rejection as soon as the device fails or the context is destroyed, whichever
   * comes first, so that no wait hangs on a dead device. The wait is registered only while it
   * is pending: nothing stays reachable from the context once `work` has settled. (Racing each
   * wait against one long-lived "lost" promise would attach a reaction to that promise per
   * call, about 1 kB that is never freed.)
   */
  private untilDone<T>(work: Promise<T>): Promise<T> {
    if (this.firstFailure !== null || this.destroying) {
      work.catch(() => undefined);
      return Promise.reject(
        this.firstFailure !== null
          ? new GpuInfrastructureError(this.firstFailure)
          : new Error('the GPU context has been destroyed'),
      );
    }
    return new Promise<T>((resolve, reject) => {
      this.waiters.add(reject);
      work.then(
        (value) => {
          this.waiters.delete(reject);
          resolve(value);
        },
        (error: unknown) => {
          this.waiters.delete(reject);
          reject(error);
        },
      );
    });
  }

  private throwIfFailed(): void {
    if (this.firstFailure !== null) throw new GpuInfrastructureError(this.firstFailure);
    if (this.destroying) throw new Error('the GPU context has been destroyed');
  }

  /** Runs `body` inside an error scope; the scope's result is examined by the next `drain`. */
  private scoped<T>(kind: 'validation' | 'out-of-memory', body: () => T): T {
    // Push, body and pop are synchronous, so scopes of different callers cannot interleave.
    this.device.pushErrorScope(kind);
    try {
      return body();
    } finally {
      // A scope that cannot be popped (the device is gone) reports nothing here: the loss
      // itself is reported by the `lost` handler.
      this.pendingScopes.push({ kind, error: this.device.popErrorScope().catch(() => null) });
    }
  }

  // ---- buffers --------------------------------------------------------------------------------

  buffer(d: BufferDescriptor): ManagedBuffer {
    this.throwIfFailed();
    const say = (text: string): never => {
      throw new Error(`buffer ${d.name} (${d.owner}): ${text}`);
    };
    if (d.name.length === 0 || d.owner.length === 0) say('needs a name and an owner');
    if (this.live.has(d.name)) say('a live buffer already has this name');
    if (!Number.isInteger(d.bytes) || d.bytes <= 0 || d.bytes % 4 !== 0) {
      say(`${d.bytes} bytes is not a positive multiple of 4`);
    }
    if (d.bytes >= BINDING_BYTES_LIMIT) {
      say(`${d.bytes} bytes is not below the binding limit of 2^32 - 4 bytes`);
    }
    const fields = d.fields ?? d.layout?.fields;
    if (fields === undefined || fields.length === 0) {
      return say('declares no fields (give `fields` or `layout`)');
    }
    const problems = [
      ...(d.fields !== undefined ? fieldProblems(d.fields) : []),
      ...(d.layout ? layoutProblems(d.layout) : []),
    ];
    if (problems.length > 0) say(problems.join('; '));
    if (this.counters.liveBytes + d.bytes > this.maxLiveBytes) {
      say(
        `${d.bytes} bytes would take the live total past the ceiling of ${this.maxLiveBytes} ` +
          `bytes (${this.counters.liveBytes} in use)`,
      );
    }
    const usage = d.usage | BUFFER_USAGE.COPY_SRC | BUFFER_USAGE.COPY_DST;
    const handle = this.scoped('out-of-memory', () =>
      this.device.createBuffer({ label: d.name, size: d.bytes, usage }),
    );
    const buffer = new BufferImpl(
      this.nextBufferId++,
      d.name,
      d.owner,
      d.stage,
      d.bytes,
      usage,
      fields,
      d.layout,
      handle,
    );
    // Fails for a buffer that mixes floats and integers without a layout: the guard could not
    // tell which words are floats.
    floatWordMask(buffer);
    this.live.set(d.name, buffer);
    this.counters.liveBytes += d.bytes;
    this.counters.peakBytes = Math.max(this.counters.peakBytes, this.counters.liveBytes);
    return buffer;
  }

  private own(b: ManagedBuffer): BufferImpl {
    if (!(b instanceof BufferImpl) || this.live.get(b.name) !== b) {
      throw new Error(`buffer ${b.name} is not a live buffer of this context`);
    }
    return b;
  }

  write(b: ManagedBuffer, data: ArrayBuffer | ArrayBufferView, byteOffset = 0): void {
    this.throwIfFailed();
    const target = this.own(b);
    const bytes = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
    if (byteOffset % 4 !== 0 || bytes.byteLength % 4 !== 0 || byteOffset < 0) {
      throw new RangeError(
        `write to ${b.name}: offset ${byteOffset} and length ${bytes.byteLength} must be multiples of 4`,
      );
    }
    if (byteOffset + bytes.byteLength > b.bytes) {
      throw new RangeError(
        `write to ${b.name}: ${bytes.byteLength} bytes at ${byteOffset} exceed its ${b.bytes} bytes`,
      );
    }
    for (let done = 0; done < bytes.byteLength; done += UPLOAD_CHUNK_BYTES) {
      const n = Math.min(UPLOAD_CHUNK_BYTES, bytes.byteLength - done);
      this.device.queue.writeBuffer(target.gpu, byteOffset + done, bytes, done, n);
    }
  }

  read(b: ManagedBuffer, byteOffset = 0, byteLength = b.bytes - byteOffset): Promise<ArrayBuffer> {
    const source = this.own(b);
    if (
      !Number.isInteger(byteOffset) ||
      !Number.isInteger(byteLength) ||
      byteOffset < 0 ||
      byteLength < 0 ||
      byteOffset + byteLength > b.bytes
    ) {
      throw new RangeError(
        `read of ${b.name}: ${byteLength} bytes at ${byteOffset} are outside its ${b.bytes} bytes`,
      );
    }
    // An argument error above is thrown; a failed device is reported as a rejection, like
    // every other failure of an asynchronous method.
    if (this.firstFailure !== null) {
      return Promise.reject(new GpuInfrastructureError(this.firstFailure));
    }
    this.throwIfFailed();
    // Copies must cover whole words.
    const start = byteOffset - (byteOffset % 4);
    const length = Math.ceil((byteOffset + byteLength - start) / 4) * 4;
    if (length === 0) return Promise.resolve(new ArrayBuffer(0));
    // The copy is encoded now, before anything is awaited, so the read sees exactly the work
    // submitted before this call. The reusable staging buffer serves one read at a time; a read
    // requested while it is mapped gets a staging buffer of its own, destroyed afterwards.
    const shared = !this.stagingBusy;
    const staging = shared ? this.stagingFor(length) : this.createStaging(length);
    if (shared) this.stagingBusy = true;
    this.scoped('validation', () => {
      const encoder = this.device.createCommandEncoder();
      encoder.copyBufferToBuffer(source.gpu, start, staging, 0, length);
      this.device.queue.submit([encoder.finish()]);
    });
    const mapped = staging.mapAsync(MAP_MODE_READ, 0, length);
    const take = async (): Promise<ArrayBuffer> => {
      try {
        await this.untilDone(mapped);
        // The data is only as good as the commands that produced it: an error reported for
        // any of them fails the read.
        await this.settleScopes();
        this.throwIfFailed();
        const range = staging.getMappedRange(0, length);
        const out = range.slice(byteOffset - start, byteOffset - start + byteLength);
        staging.unmap();
        this.counters.readbacks++;
        return out;
      } finally {
        if (!shared) {
          staging.destroy();
        } else {
          this.stagingBusy = false;
          if (staging.size > STAGING_KEEP_BYTES && this.staging === staging) {
            staging.destroy();
            this.staging = null;
          }
        }
      }
    };
    return take();
  }

  /** Awaits the error scopes opened so far and records the first error as the failure. */
  private async settleScopes(): Promise<void> {
    const scopes = this.pendingScopes.splice(0);
    if (scopes.length === 0) return;
    const errors = await this.untilDone(Promise.all(scopes.map((s) => s.error)));
    errors.forEach((error, index) => {
      if (error !== null) {
        this.fail({
          kind: (scopes[index] as { kind: GpuFailure['kind'] }).kind,
          message: error.message,
        });
      }
    });
  }

  private createStaging(bytes: number): GPUBuffer {
    let size = STAGING_MIN_BYTES;
    while (size < bytes) size *= 2;
    return this.scoped('out-of-memory', () =>
      this.device.createBuffer({
        label: 'sim-gpu.staging',
        size: Math.min(size, 2 ** 32 - 8),
        usage: BUFFER_USAGE.MAP_READ | BUFFER_USAGE.COPY_DST,
      }),
    );
  }

  private stagingFor(bytes: number): GPUBuffer {
    if (this.staging !== null && this.staging.size >= bytes) return this.staging;
    this.staging?.destroy();
    this.staging = this.createStaging(bytes);
    return this.staging;
  }

  release(b: ManagedBuffer): void {
    const buffer = this.own(b);
    buffer.gpu.destroy();
    buffer.handle = null;
    this.live.delete(buffer.name);
    this.counters.liveBytes -= buffer.bytes;
    // Bind groups that refer to the destroyed buffer are dropped.
    for (const entry of this.compiled) {
      for (const cache of entry.bindGroups) {
        for (const [key, cached] of cache) {
          if (cached.bufferIds.includes(buffer.id)) cache.delete(key);
        }
      }
    }
  }

  releaseStage(stage: StageId): void {
    for (const buffer of [...this.live.values()]) {
      if (buffer.stage === stage) this.release(buffer);
    }
  }

  // ---- kernels --------------------------------------------------------------------------------

  async kernel(def: KernelDef): Promise<Kernel> {
    this.throwIfFailed();
    const say = (text: string): never => {
      throw new Error(`kernel ${def.name}: ${text}`);
    };
    const storage = def.bindings.filter(
      (b) => b.kind === 'storage' || b.kind === 'read-only-storage',
    ).length;
    if (storage > MAX_STORAGE_BUFFERS_PER_KERNEL) {
      say(
        `${storage} storage buffers; at most ${MAX_STORAGE_BUFFERS_PER_KERNEL} are allowed ` +
          `(merge the static tables of a patch into one buffer)`,
      );
    }
    const slots = new Map<string, BindingDef>();
    const places = new Set<string>();
    let groupCount = 0;
    for (const b of def.bindings) {
      if (!Number.isInteger(b.group) || b.group < 0 || b.group >= MAX_BIND_GROUPS_PER_KERNEL) {
        say(
          `binding ${b.name} is in group ${b.group}; groups 0 to ${MAX_BIND_GROUPS_PER_KERNEL - 1} are allowed`,
        );
      }
      if (!Number.isInteger(b.binding) || b.binding < 0)
        say(`binding ${b.name} has index ${b.binding}`);
      if (slots.has(b.name)) say(`slot ${b.name} is declared twice`);
      if (places.has(`${b.group}/${b.binding}`)) {
        say(`group ${b.group} binding ${b.binding} is declared twice`);
      }
      slots.set(b.name, b);
      places.add(`${b.group}/${b.binding}`);
      groupCount = Math.max(groupCount, b.group + 1);
    }
    for (const name of [...def.reads, ...def.writes, ...def.atomics]) {
      if (!slots.has(name)) say(`reads, writes or atomics name ${name}, which is not a binding`);
    }
    for (const name of [...def.writes, ...def.atomics]) {
      if (slots.get(name)?.kind !== 'storage') {
        say(`${name} is written but is not a read-write storage binding`);
      }
    }
    // A read-write storage binding is a binding the kernel writes: `writes` and `atomics`
    // together must name exactly those slots, so that the declarations cannot be incomplete
    // (the shader compiler already refuses a store to a read-only binding).
    for (const b of def.bindings) {
      if (b.kind === 'storage' && !def.writes.includes(b.name) && !def.atomics.includes(b.name)) {
        say(
          `slot ${b.name} is a read-write storage binding but is in neither writes nor atomics ` +
            `(list it, or bind it as read-only-storage)`,
        );
      }
    }
    for (const use of def.uses) {
      if (!OP_CLASSES.includes(use)) say(`unknown operation class ${String(use)}`);
    }
    if (/^[ \t]*#include\b/m.test(def.wgsl)) {
      say('the source still has an #include line; pass it through wgsl.assemble first');
    }
    // Rule 9: every operation class the entry point can reach must be declared, so that a changed probe
    // names every kernel whose bits may have moved.
    const undeclared = opClassesInWgsl(def.wgsl, def.entry).filter((c) => !def.uses.includes(c));
    if (undeclared.length > 0) {
      say(
        `the source uses ${undeclared.join(', ')} but \`uses\` does not list ${undeclared.length > 1 ? 'them' : 'it'}`,
      );
    }
    if (wgslUsesAtomics(def.wgsl, def.entry) !== def.atomics.length > 0) {
      say(
        def.atomics.length > 0
          ? 'atomics are declared but the source has no atomic operation'
          : 'the source has atomic operations but `atomics` names no slot',
      );
    }

    const groups: BindingDef[][] = Array.from({ length: groupCount }, () => []);
    for (const b of def.bindings) (groups[b.group] as BindingDef[]).push(b);
    for (const g of groups) g.sort((a, b) => a.binding - b.binding);

    const sourceHash = sha256Hex(
      JSON.stringify([
        def.entry,
        groups.map((g) => g.map((b) => [b.binding, b.kind, b.viewDimension ?? ''])),
        def.wgsl,
      ]),
    );
    let pending = this.pipelines.get(sourceHash);
    if (pending === undefined) {
      pending = this.compile(def, groups);
      this.pipelines.set(sourceHash, pending);
      // A failed compilation is not cached, so that the error is reported again.
      pending.catch(() => this.pipelines.delete(sourceHash));
    }
    const entry = await pending;
    for (const use of def.uses) {
      let names = this.kernelsByClass.get(use);
      if (names === undefined) {
        names = new Set();
        this.kernelsByClass.set(use, names);
      }
      names.add(def.name);
    }
    const kernel: KernelImpl = { def, pipeline: entry.pipeline, sourceHash, entry, groups };
    return kernel;
  }

  kernelsUsing(classes: readonly OpClass[]): string[] {
    const names = new Set<string>();
    for (const c of classes) for (const name of this.kernelsByClass.get(c) ?? []) names.add(name);
    return [...names].sort();
  }

  private async compile(
    def: KernelDef,
    groups: readonly (readonly BindingDef[])[],
  ): Promise<PipelineEntry> {
    // The error scope keeps a WGSL error from also arriving as an uncaptured error, which
    // would fail the whole context for a mistake that is reported here with its line.
    this.device.pushErrorScope('validation');
    const module = this.device.createShaderModule({ label: def.name, code: def.wgsl });
    const layouts = groups.map((bindings, group) =>
      this.device.createBindGroupLayout({
        label: `${def.name}.group${group}`,
        entries: bindings.map((b): GPUBindGroupLayoutEntry => {
          const base = { binding: b.binding, visibility: SHADER_STAGE_COMPUTE };
          if (b.kind === 'texture') {
            return {
              ...base,
              texture: { sampleType: 'unfilterable-float', viewDimension: b.viewDimension ?? '2d' },
            };
          }
          return { ...base, buffer: { type: b.kind } };
        }),
      }),
    );
    const layout = this.device.createPipelineLayout({
      label: def.name,
      bindGroupLayouts: layouts,
    });
    const scope = this.device.popErrorScope();
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((m) => m.type === 'error');
    if (errors.length > 0) {
      await scope;
      const lines = def.wgsl.split('\n');
      const text = errors
        .slice(0, 5)
        .map(
          (m) =>
            `${m.lineNum}:${m.linePos} ${m.message}\n    ${(lines[m.lineNum - 1] ?? '').trim()}`,
        )
        .join('\n  ');
      throw new Error(`kernel ${def.name}: WGSL does not compile:\n  ${text}`);
    }
    const scopeError = await scope;
    if (scopeError !== null) {
      throw new Error(`kernel ${def.name}: ${scopeError.message}`);
    }
    let pipeline: GPUComputePipeline;
    try {
      pipeline = await this.device.createComputePipelineAsync({
        label: def.name,
        layout,
        compute: { module, entryPoint: def.entry },
      });
    } catch (error) {
      throw new Error(
        `kernel ${def.name}: the pipeline cannot be created (do the WGSL bindings match ` +
          `KernelDef.bindings?): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    this.counters.pipelinesCompiled++;
    const entry: PipelineEntry = {
      pipeline,
      layouts,
      bindGroups: groups.map(() => new Map<string, CachedBindGroup>()),
    };
    this.compiled.push(entry);
    return entry;
  }

  private bindGroupsFor(dispatch: Dispatch): GPUBindGroup[] {
    const kernel = dispatch.kernel as Partial<KernelImpl>;
    const { entry, groups } = kernel;
    if (entry === undefined || groups === undefined || !this.compiled.includes(entry)) {
      throw new Error(
        `kernel ${dispatch.kernel.def.name} was not made by the kernel() of this context`,
      );
    }
    const name = dispatch.kernel.def.name;
    const declared = new Set(dispatch.kernel.def.bindings.map((b) => b.name));
    for (const slot of Object.keys(dispatch.bindings)) {
      if (!declared.has(slot)) throw new Error(`dispatch of ${name}: no slot named ${slot}`);
    }
    return groups.map((bindings, group) => {
      const keys: string[] = [];
      const bufferIds: number[] = [];
      const entries = bindings.map((b): GPUBindGroupEntry => {
        const resource = dispatch.bindings[b.name];
        if (resource === undefined) {
          throw new Error(`dispatch of ${name}: nothing is bound to slot ${b.name}`);
        }
        if ('texture' in resource) {
          if (b.kind !== 'texture') {
            throw new Error(`dispatch of ${name}: slot ${b.name} takes a buffer, not a texture`);
          }
          let id = this.textureIds.get(resource.texture);
          if (id === undefined) {
            id = this.nextTextureId++;
            this.textureIds.set(resource.texture, id);
          }
          keys.push(`t${id}`);
          return { binding: b.binding, resource: resource.texture };
        }
        if (b.kind === 'texture') {
          throw new Error(`dispatch of ${name}: slot ${b.name} takes a texture, not a buffer`);
        }
        const buffer = this.own(isManaged(resource) ? resource : resource.buffer);
        bufferIds.push(buffer.id);
        if (isManaged(resource)) {
          // The whole buffer; its size was checked against the binding limit at registration.
          keys.push(`b${buffer.id}`);
          return { binding: b.binding, resource: { buffer: buffer.gpu } };
        }
        const { offset, size } = resource;
        if (
          !Number.isInteger(offset) ||
          !Number.isInteger(size) ||
          offset < 0 ||
          size <= 0 ||
          offset % 4 !== 0 ||
          size % 4 !== 0 ||
          offset + size > buffer.bytes
        ) {
          throw new RangeError(
            `dispatch of ${name}: window ${offset}+${size} of ${buffer.name} (${buffer.bytes} bytes) for slot ${b.name} is not a word-aligned part of it`,
          );
        }
        if (size >= BINDING_BYTES_LIMIT) {
          throw new RangeError(
            `dispatch of ${name}: binding of ${size} bytes for slot ${b.name} is not below 2^32 - 4 bytes`,
          );
        }
        const alignment =
          b.kind === 'uniform'
            ? this.device.limits.minUniformBufferOffsetAlignment
            : this.device.limits.minStorageBufferOffsetAlignment;
        if (offset % alignment !== 0) {
          throw new RangeError(
            `dispatch of ${name}: window offset ${offset} of ${buffer.name} for slot ${b.name} is not a multiple of the device's ${alignment}-byte binding alignment`,
          );
        }
        keys.push(`b${buffer.id}@${offset}+${size}`);
        return { binding: b.binding, resource: { buffer: buffer.gpu, offset, size } };
      });
      const cache = entry.bindGroups[group] as Map<string, CachedBindGroup>;
      const key = keys.join('|');
      let cached = cache.get(key);
      if (cached === undefined) {
        cached = {
          group: this.device.createBindGroup({
            label: `${name}.group${group}`,
            layout: entry.layouts[group] as GPUBindGroupLayout,
            entries,
          }),
          bufferIds,
        };
        cache.set(key, cached);
      }
      return cached.group;
    });
  }

  // ---- dispatch -------------------------------------------------------------------------------

  /** Splits a batch into runs whose planned time stays within the bound, in order. */
  private plan(batch: DispatchBatch, options: SubmitOptions | undefined): BatchOp[][] {
    const limit = options?.maxPlannedTime ?? COMMAND_BUFFER_PLANNED_S[1];
    if (!(limit > 0)) throw new RangeError(`maxPlannedTime ${limit} is not positive`);
    const chunks: BatchOp[][] = [];
    let current: BatchOp[] = [];
    let planned = 0;
    for (const op of batch) {
      const cost = op.op === 'dispatch' ? op.plannedTime : 0;
      if (!(cost >= 0) || !Number.isFinite(cost)) {
        throw new RangeError(`a dispatch has planned time ${cost}`);
      }
      if (current.length > 0 && planned + cost > limit) {
        chunks.push(current);
        current = [];
        planned = 0;
      }
      current.push(op);
      planned += cost;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  private encode(chunk: readonly BatchOp[]): void {
    const maxGroups = this.device.limits.maxComputeWorkgroupsPerDimension;
    this.scoped('validation', () => {
      const encoder = this.device.createCommandEncoder();
      let pass: GPUComputePassEncoder | null = null;
      let pipeline: GPUComputePipeline | null = null;
      const endPass = (): void => {
        pass?.end();
        pass = null;
        pipeline = null;
      };
      for (const op of chunk) {
        if (op.op === 'clear') {
          endPass();
          encoder.clearBuffer(this.own(op.buffer).gpu);
        } else if (op.op === 'copy') {
          endPass();
          const bytes = op.bytes ?? op.from.bytes;
          if (bytes % 4 !== 0 || bytes <= 0 || bytes > op.from.bytes || bytes > op.to.bytes) {
            throw new RangeError(
              `copy of ${bytes} bytes from ${op.from.name} to ${op.to.name} does not fit`,
            );
          }
          encoder.copyBufferToBuffer(this.own(op.from).gpu, 0, this.own(op.to).gpu, 0, bytes);
        } else {
          for (const n of op.workgroups) {
            if (!Number.isInteger(n) || n < 0 || n > maxGroups) {
              throw new RangeError(
                `dispatch of ${op.kernel.def.name}: workgroup count ${n} is outside 0 to ${maxGroups}`,
              );
            }
          }
          const groups = this.bindGroupsFor(op);
          pass ??= encoder.beginComputePass();
          if (pipeline !== op.kernel.pipeline) {
            pass.setPipeline(op.kernel.pipeline);
            pipeline = op.kernel.pipeline;
          }
          groups.forEach((group, index) =>
            (pass as GPUComputePassEncoder).setBindGroup(index, group),
          );
          pass.dispatchWorkgroups(op.workgroups[0], op.workgroups[1], op.workgroups[2]);
          this.counters.dispatches++;
        }
      }
      endPass();
      this.device.queue.submit([encoder.finish()]);
      this.counters.commandBuffers++;
    });
  }

  submit(batch: DispatchBatch, options?: SubmitOptions): void {
    this.throwIfFailed();
    for (const chunk of this.plan(batch, options)) this.encode(chunk);
  }

  async drain(): Promise<void> {
    this.throwIfFailed();
    await this.untilDone(this.device.queue.onSubmittedWorkDone());
    await this.settleScopes();
    this.throwIfFailed();
  }

  async run(batch: DispatchBatch, options?: SubmitOptions): Promise<void> {
    this.throwIfFailed();
    let sinceAwait = 0;
    for (const chunk of this.plan(batch, options)) {
      this.encode(chunk);
      if (++sinceAwait === RUN_AWAIT_EVERY) {
        await this.drain();
        sinceAwait = 0;
      }
    }
    await this.drain();
  }

  // ---- accumulators ---------------------------------------------------------------------------

  accumulators(d: BufferDescriptor): AccumulatorPair {
    const current = this.buffer({ ...d, name: `${d.name}.a` });
    try {
      return { current, next: this.buffer({ ...d, name: `${d.name}.b` }) };
    } catch (error) {
      this.release(current);
      throw error;
    }
  }

  swapAccumulators(pair: AccumulatorPair, batch?: BatchOp[]): void {
    const { current, next } = pair;
    pair.current = next;
    pair.next = current;
    // The old current has been read by every pass of the step that ends here (rule 6: a buffer
    // is cleared only after its last reader); it now collects for the step after the next.
    const clear: BatchOp = { op: 'clear', buffer: current };
    if (batch !== undefined) batch.push(clear);
    else this.submit([clear]);
  }

  // ---- reductions and the guard ---------------------------------------------------------------

  private internalKernels(): { reduce: ReduceKernels; guard: Kernel } {
    if (this.reduceKernels === null || this.guardKernel === null) {
      throw new Error('the GPU context is not ready (it must be made by createGpuContext)');
    }
    return { reduce: this.reduceKernels, guard: this.guardKernel };
  }

  reduceI64(src: ManagedBuffer, spec: ReduceSpec): Promise<BigInt64Array> {
    this.own(src);
    return reduceI64OnGpu(this, this.internalKernels().reduce, src, spec, null);
  }

  reduceI64By(
    src: ManagedBuffer,
    spec: ReduceSpec,
    key: Uint32Array,
    segments?: number,
  ): Promise<BigInt64Array> {
    this.own(src);
    if (key.length < 1) throw new RangeError('reduceI64By: the offset table is empty');
    if (segments !== undefined && segments !== key.length - 1) {
      throw new RangeError(
        `reduceI64By: ${segments} segments were announced but the offset table has ${key.length - 1}`,
      );
    }
    return reduceI64OnGpu(this, this.internalKernels().reduce, src, spec, key);
  }

  nonFiniteCount(buffers?: readonly ManagedBuffer[]): Promise<number> {
    const list = buffers ?? [...this.live.values()].filter((b) => floatWordMask(b) !== null);
    for (const b of list) this.own(b);
    const { reduce, guard } = this.internalKernels();
    return countNonFiniteOnGpu(this, guard, reduce, list);
  }

  // ---- end ------------------------------------------------------------------------------------

  destroy(): void {
    if (this.destroying) return;
    for (const buffer of [...this.live.values()]) this.release(buffer);
    this.destroying = true;
    this.rejectWaiters(new Error('the GPU context has been destroyed'));
    this.staging?.destroy();
    this.staging = null;
    // The bindings keep a destroyed device, and through its listeners this object, alive: drop
    // what it holds so that a destroyed context costs as little as possible.
    this.pipelines.clear();
    this.compiled.length = 0;
    this.pendingScopes.length = 0;
    this.reduceKernels = null;
    this.guardKernel = null;
    this.device.destroy();
  }
}
