/// <reference types="@webgpu/types" />
/**
 * Contract of module M1, the GPU foundation (docs/design/sim-core.md section 4, "M1. GPU
 * foundation"): everything between the simulation modules and WebGPU, so that the determinism
 * rules of section 6 are enforced in one place.
 *
 * Types and constants only; `context.ts` implements {@link GpuContext}. The contract is the
 * reference, not a frozen interface (docs/design/scope.md): where this file differs from the
 * code block of section M1 the doc comment of the member says so. The WebGPU handle types
 * (`GPUBuffer`, `GPUComputePipeline`, `GPUBindGroup`, `GPUBufferUsageFlags`) are the ambient
 * declarations of `@webgpu/types`, brought into every program that includes this file by the
 * reference directive above, so no other simulation package needs that package.
 *
 * Units: bytes for sizes and offsets, seconds for planned times. Nothing here has a frame.
 */

import type { RecordLayout } from './layout.ts';
import type { WgslLibrary } from './wgsl.ts';

// ---------------------------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------------------------

/**
 * The full stack a result was computed on (section M1; determinism rule 13). It is part of every
 * result, cache key, checkpoint and golden hash: an operating-system update or a bindings update
 * changes it and so invalidates caches and golden hashes.
 */
export interface StackString {
  /** Simulator version, `MAJOR.MINOR.PATCH`. */
  readonly sim: string;
  /** GPU adapter (vendor, architecture and device as the adapter reports them). */
  readonly gpu: string;
  /** Operating-system name and build, for example `macOS 27.0.1 (26A434)`. */
  readonly os: string;
  /** Version of the WebGPU implementation (the `webgpu` npm package, or the browser build). */
  readonly webgpu: string;
  /** JavaScript runtime and version, for example `node 20.19.0`. */
  readonly runtime: string;
  /** Rigid-body engine and version (`@spotless/physics`: Jolt). */
  readonly physics: string;
}

// ---------------------------------------------------------------------------------------------
// Registered fields
// ---------------------------------------------------------------------------------------------

/**
 * Storage type of one field of a registered buffer (section M1, `FieldDef.type`).
 *
 * - `f32`, `u32`, `i32`: one 32-bit word; the only types a `state` or `accumulator` may have.
 * - `f16`: IEEE half precision in the scaled unit of the field (section 5.1: never an SI value
 *   below 6e-5, which would be subnormal).
 * - `u16`, `u8`: unsigned integers, often normalised (`u8 / 255`).
 * - `i16`: signed 16-bit integer. Not in the contract's `FieldDef` union, although `BlockStatic`,
 *   `SourceRecord`, the emitter entry and the packed deposition table store `i16`; added here
 *   and reported as a contract issue.
 * - `log8`: "log u8" of section 5.1: one byte `code` storing
 *   `v = min * (max / min)^(code / 255)`, with `code` 0 meaning zero.
 */
export type FieldType = 'f32' | 'u32' | 'i32' | 'f16' | 'u16' | 'i16' | 'u8' | 'log8';

/** Every {@link FieldType}, widest first. */
export const FIELD_TYPES: readonly FieldType[] = [
  'f32',
  'u32',
  'i32',
  'f16',
  'u16',
  'i16',
  'u8',
  'log8',
];

/**
 * What a field is used for (section M1, `FieldDef.role`); the role decides which storage types
 * are allowed (determinism rule 7 and the "Narrow fields" rule of M1).
 *
 * - `state`: evolving physical state, read and rewritten across steps or ticks.
 * - `accumulator`: summed into by many writers (`atomicAdd`) or across steps.
 * - `counter`: an integer count whose largest possible value is registered (`FieldDef.bound`).
 * - `statistic`: written whole, never incremented: maxima, snapshots, copies, packed outputs.
 * - `static`: geometry and parameters that do not change during a solve.
 */
export type FieldRole = 'state' | 'accumulator' | 'counter' | 'statistic' | 'static';

/** Every {@link FieldRole}. */
export const FIELD_ROLES: readonly FieldRole[] = [
  'state',
  'accumulator',
  'counter',
  'statistic',
  'static',
];

/**
 * One registered field of a buffer (section M1). Every integer field is registered with its unit
 * and the largest value the plan can produce; M1 asserts the bound at plan time and counts
 * saturations at run time (section 4, "Shared fixed-point units"; section 8.2).
 */
export interface FieldDef {
  /** Field name, unique within its buffer. */
  readonly name: string;
  /** Storage type. */
  readonly type: FieldType;
  /** Use of the field; restricts the storage type (rule 7). */
  readonly role: FieldRole;
  /** Unit of the field's value, for example `kg`, `Pa`, `1` for a pure number. */
  readonly unit: string;
  /**
   * Largest value the field may hold, in stored integer units. Required for integer
   * accumulators and counters.
   */
  readonly bound?: number;
}

// ---------------------------------------------------------------------------------------------
// Kernels
// ---------------------------------------------------------------------------------------------

/**
 * Class of floating-point or integer operation a kernel relies on (section M1; determinism
 * rule 9). There is one determinism probe per class, so a changed probe hash names the kernels
 * whose bits may have moved.
 */
export type OpClass =
  | 'addmul'
  | 'div'
  | 'sqrt'
  | 'explog'
  | 'pow'
  | 'cbrt'
  | 'trig'
  | 'atan2'
  | 'ftoi'
  | 'fma'
  | 'atomics'
  | 'f16'
  | 'bitcast';

/** Every {@link OpClass}, in the order of the contract. */
export const OP_CLASSES: readonly OpClass[] = [
  'addmul',
  'div',
  'sqrt',
  'explog',
  'pow',
  'cbrt',
  'trig',
  'atan2',
  'ftoi',
  'fma',
  'atomics',
  'f16',
  'bitcast',
];

/**
 * One binding of a kernel. The contract uses this type in `KernelDef.bindings` and never defines
 * it; this is the smallest reading that lets `kernel()` build the bind group layouts and make
 * the checks section M1 lists (count of storage buffers, count of bind groups).
 *
 * `name` is the name of the binding slot, not of one buffer: a kernel that runs on alternate
 * steps with the two members of a double-buffered pair binds different buffers to the same slot.
 * `KernelDef.reads`, `writes` and `atomics` name slots too, and `Dispatch.bindings` maps each
 * slot to the buffer bound for that dispatch.
 */
export interface BindingDef {
  /** Bind group index, 0 to 2 (at most 3 bind groups per kernel). */
  readonly group: number;
  /** Binding index within the group. */
  readonly binding: number;
  /** Name of the slot, unique within the kernel, for example `src`. */
  readonly name: string;
  /**
   * Kind of resource: a uniform block, a read-only storage buffer, a read-write storage buffer
   * (also for atomics), or a closure-table texture read with `textureLoad` (an unfilterable
   * float texture; hardware filtering is not used, determinism rule 10).
   */
  readonly kind: 'uniform' | 'read-only-storage' | 'storage' | 'texture';
  /** For `texture` bindings: the view dimension; default `2d`. */
  readonly viewDimension?: '1d' | '2d' | '2d-array' | '3d';
}

/**
 * A compute kernel as registered with `GpuContext.kernel` (section M1). The pipeline is cached
 * by source hash. `reads`, `writes` and `atomics` are slot names of `bindings`; they are checked
 * against the bindings when the kernel is registered: a written or atomically written slot
 * must be a read-write storage binding, and every read-write storage binding must be in
 * `writes` or `atomics`. `uses` is checked against the source for the classes that can be
 * recognised there (`opClassesInWgsl`). The check of the accumulator discipline across a whole
 * batch that the contract derives from them is not built yet.
 */
export interface KernelDef {
  /** Kernel name, unique in the run, for example `s_stage1`. */
  readonly name: string;
  /** Complete WGSL source of the module, after assembly (`WgslLibrary.assemble`). */
  readonly wgsl: string;
  /** Name of the `@compute` entry point. */
  readonly entry: string;
  /** Every binding of the kernel; at most 8 storage buffers and 3 bind groups. */
  readonly bindings: readonly BindingDef[];
  /**
   * Every operation class the kernel relies on (rule 9). Classes the source visibly calls are
   * enforced; `addmul`, `div`, `ftoi` and `cbrt` cannot be recognised and are the author's to
   * declare.
   */
  readonly uses: readonly OpClass[];
  /** Slots the kernel reads. */
  readonly reads: readonly string[];
  /** Slots the kernel writes with plain stores. */
  readonly writes: readonly string[];
  /** Slots the kernel writes with `atomicAdd` or `atomicMax`. */
  readonly atomics: readonly string[];
}

/** A compiled pipeline together with the definition it was built from (section M1). */
export interface Kernel {
  /** The definition passed to `GpuContext.kernel`. */
  readonly def: KernelDef;
  /** The compiled compute pipeline. */
  readonly pipeline: GPUComputePipeline;
  /** SHA-256 (hex) of entry point, bindings and source: the key the pipeline is cached under. */
  readonly sourceHash: string;
}

// ---------------------------------------------------------------------------------------------
// Buffers
// ---------------------------------------------------------------------------------------------

/**
 * A stage letter of the pipeline of section 2.1: A set-up, B hydraulics and shake-down,
 * C primary jets, D jet gather, E pilot, F Monte Carlo, G film, H replay, I end passes, J I/O.
 */
export type StageId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';

/** Every {@link StageId}, in letter order (the pilot E runs before the gather D; section 2.1). */
export const STAGE_IDS: readonly StageId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/** What `GpuContext.buffer` is given: a buffer with a name, an owner and declared fields. */
export interface BufferDescriptor {
  /** Name of the buffer, unique among the live buffers of the context. */
  readonly name: string;
  /** The package that owns the buffer, for example `sim-film`. */
  readonly owner: string;
  /** The stage whose end releases the buffer (`releaseStage`), or `'run'`. */
  readonly stage: StageId | 'run';
  /** Size of the buffer, bytes: a positive multiple of 4 below {@link BINDING_BYTES_LIMIT}. */
  readonly bytes: number;
  /** WebGPU usage flags (`BUFFER_USAGE`); `COPY_SRC` and `COPY_DST` are always added. */
  readonly usage: GPUBufferUsageFlags;
  /**
   * The registered fields of one element. May be omitted when `layout` is given (the fields of
   * the layout are used).
   */
  readonly fields?: readonly FieldDef[];
  /**
   * The record layout of one element, when the buffer is an array of records. It tells the
   * non-finite guard which words of a record are floats; a buffer whose fields mix floats and
   * integers must give it.
   */
  readonly layout?: RecordLayout;
}

/**
 * A registered GPU buffer (section M1). The contract writes "a `GPUBuffer` with its registered
 * fields, owner and stage"; here it is an object that holds the `GPUBuffer`, not a subtype of
 * it, so that the handle a module keeps stays valid if the context later has to recreate the
 * underlying buffer (eviction to the staging file and device-loss recovery, neither built yet).
 * Modules pass `ManagedBuffer`s to the context and never keep a bind group of their own.
 */
export interface ManagedBuffer {
  /** The name the buffer was registered under. */
  readonly name: string;
  /** The package that owns the buffer. */
  readonly owner: string;
  /** The stage whose end releases the buffer, or `'run'`. */
  readonly stage: StageId | 'run';
  /** Size, bytes. */
  readonly bytes: number;
  /** WebGPU usage flags the buffer was created with. */
  readonly usage: GPUBufferUsageFlags;
  /** The registered fields of one element. */
  readonly fields: readonly FieldDef[];
  /** The record layout of one element, if one was registered. */
  readonly layout: RecordLayout | undefined;
  /** True once the buffer has been released; a released buffer cannot be bound, read or written. */
  readonly released: boolean;
  /** The underlying WebGPU buffer. Throws if the buffer has been released. */
  readonly gpu: GPUBuffer;
}

/**
 * The current and next buffer of one double-buffered deposit accumulator (section M1,
 * "Accumulator discipline"; determinism rule 6). `GpuContext.swapAccumulators` exchanges the two
 * members in place, which is why they are not read-only: a dispatch built after the swap that
 * names `pair.current` binds the other physical buffer.
 */
export interface AccumulatorPair {
  /** Read by the passes of this base step; written by writers that must be seen in this step. */
  current: ManagedBuffer;
  /** Written by passes whose output belongs to the next base step. */
  next: ManagedBuffer;
}

// ---------------------------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------------------------

/**
 * What is bound to one slot of a kernel for one dispatch: a whole buffer, a window of a buffer
 * (`offset` and `size` in bytes, both multiples of 4; `size` below {@link BINDING_BYTES_LIMIT};
 * `offset` a multiple of the device's binding offset alignment, 256 bytes on the reference
 * stack), or a texture view for a closure table.
 */
export type BindingResource =
  | ManagedBuffer
  | { readonly buffer: ManagedBuffer; readonly offset: number; readonly size: number }
  | { readonly texture: GPUTextureView };

/**
 * One kernel invocation of a {@link DispatchBatch} (section M1). The contract's "bind groups"
 * are replaced by the buffers themselves, keyed by slot name; the context builds and caches the
 * bind groups. The contract's "element list" is a kernel that binds a list buffer and is
 * dispatched over its length; it needs no separate form.
 */
export interface Dispatch {
  /** Discriminant of {@link BatchOp}. */
  readonly op: 'dispatch';
  /** The kernel to run. */
  readonly kernel: Kernel;
  /** The resource bound to every slot of the kernel, by `BindingDef.name`. */
  readonly bindings: Readonly<Record<string, BindingResource>>;
  /** Workgroup counts `[x, y, z]`, each from 0 to the device limit (65,535). */
  readonly workgroups: readonly [x: number, y: number, z: number];
  /**
   * Planned GPU time of this dispatch, seconds: work divided by the frozen planning rate of the
   * kernel. Used only to split a batch into command buffers; never measured (rule 1).
   */
  readonly plannedTime: number;
}

/** One ordered step of a {@link DispatchBatch}: a dispatch, or a buffer clear or copy. */
export type BatchOp =
  | Dispatch
  | {
      /** Sets a whole buffer to zero (`clearBuffer`). */
      readonly op: 'clear';
      readonly buffer: ManagedBuffer;
    }
  | {
      /** Copies `bytes` bytes (default: the whole source) between two buffers. */
      readonly op: 'copy';
      readonly from: ManagedBuffer;
      readonly to: ManagedBuffer;
      readonly bytes?: number;
    };

/**
 * An ordered list of steps (section M1). `GpuContext.submit` encodes them in order and splits
 * them into command buffers of bounded planned GPU time; the order is part of the result
 * (determinism rule 6) and the split is not (rule 18, batching invariance).
 */
export type DispatchBatch = readonly BatchOp[];

/** How a batch is split into command buffers. */
export interface SubmitOptions {
  /**
   * Largest planned GPU time of one command buffer, seconds; default the upper end of
   * {@link COMMAND_BUFFER_PLANNED_S}. A dispatch planned longer than this gets a command buffer
   * to itself. The lower end (50 ms) is a target for the planner, not something a short batch
   * can be made to meet.
   */
  readonly maxPlannedTime?: number;
}

// ---------------------------------------------------------------------------------------------
// Reductions
// ---------------------------------------------------------------------------------------------

/** One 32-bit integer word of an element to be summed by the integer block reduction. */
export interface ReduceField {
  /** Byte offset of the word within one element; a multiple of 4. */
  readonly offsetBytes: number;
  /** `u32` words are zero-extended to 64 bits, `i32` words sign-extended. */
  readonly type: 'u32' | 'i32';
}

/**
 * Which words of which elements an integer block reduction sums. The contract's
 * `reduceI64(src, strideBytes, fields: number)` does not say where the fields lie nor whether
 * they are signed; this record does.
 */
export interface ReduceSpec {
  /** Size of one element, bytes; a multiple of 4. */
  readonly strideBytes: number;
  /** The words to sum, at most {@link MAX_REDUCE_FIELDS}; one 64-bit sum is returned per entry. */
  readonly fields: readonly ReduceField[];
  /** Number of elements to cover, from element 0; default: as many as the buffer holds. */
  readonly count?: number;
}

// ---------------------------------------------------------------------------------------------
// Failures and statistics
// ---------------------------------------------------------------------------------------------

/**
 * An infrastructure failure of the device (determinism rule 12, "failure, not truncation"): the
 * device was lost, or WebGPU reported an error (validation, out of memory, internal). After a
 * failure every asynchronous method of the context rejects; recovery is not built yet.
 */
export interface GpuFailure {
  /** What happened. */
  readonly kind: 'device-lost' | 'uncaptured-error' | 'validation' | 'out-of-memory' | 'internal';
  /** The message WebGPU gave. */
  readonly message: string;
}

/** Counters of what a context has done; plain numbers for tests and benchmark reports. */
export interface GpuStats {
  /** Command buffers submitted. */
  readonly commandBuffers: number;
  /** Kernel dispatches encoded. */
  readonly dispatches: number;
  /** Pipelines compiled (cache misses of `kernel()`). */
  readonly pipelinesCompiled: number;
  /** Registered buffers alive now. */
  readonly liveBuffers: number;
  /** Bytes of registered buffers alive now. */
  readonly liveBytes: number;
  /** Largest value `liveBytes` has had. */
  readonly peakBytes: number;
  /** Read-backs completed. */
  readonly readbacks: number;
}

// ---------------------------------------------------------------------------------------------
// The context
// ---------------------------------------------------------------------------------------------

/**
 * The GPU foundation as the simulation modules see it (section M1). Every method that returns
 * data computed on the GPU is asynchronous, because WebGPU has only `mapAsync` (section 2.3).
 *
 * Differences from the contract's code block, all of them simplifications of the first build:
 * `kernel` is asynchronous (so that a WGSL error is reported with its line, not as a later
 * uncaptured error); `reduceI64` and `reduceI64By` take a {@link ReduceSpec}; `nonFiniteCount`
 * may be given the buffers to examine; `write`, `release`, `accumulators`, `run`, `failure`,
 * `destroy`, `device`, `wgsl` and `stats` are added. The members the first build leaves out are
 * declared in {@link GpuContextDeferred}.
 */
export interface GpuContext {
  /** The stack this context runs on (rule 13). */
  readonly stack: StackString;
  /** The WebGPU device, for what the context does not wrap (creating closure-table textures). */
  readonly device: GPUDevice;
  /** The shared WGSL source of this context: `#include` names that `assemble` resolves. */
  readonly wgsl: WgslLibrary;
  /** What the context has done so far. */
  readonly stats: GpuStats;

  /**
   * Creates and registers a zero-filled buffer. Throws if the name is in use, if `bytes` is not
   * a positive multiple of 4 below {@link BINDING_BYTES_LIMIT}, if the fields break the
   * narrow-field rule (rule 7: a narrow field is `static`, `statistic` or a bounded `counter`;
   * integer accumulators and counters carry a `bound`), or if the context's memory ceiling
   * would be exceeded.
   */
  buffer(d: BufferDescriptor): ManagedBuffer;
  /** Uploads `data` to a buffer at `byteOffset` (default 0); both multiples of 4 bytes. */
  write(b: ManagedBuffer, data: ArrayBuffer | ArrayBufferView, byteOffset?: number): void;
  /**
   * Reads `byteLength` bytes of a buffer starting at `byteOffset` (defaults: the whole buffer),
   * as left by the work submitted before the call: the copy is encoded synchronously, so work
   * submitted after the call (even before the result is awaited) is not seen. One reusable
   * staging buffer serves a read at a time; a read requested while another is in flight gets a
   * temporary staging buffer of its own, so concurrent reads are allowed.
   */
  read(b: ManagedBuffer, byteOffset?: number, byteLength?: number): Promise<ArrayBuffer>;
  /** Destroys a buffer and frees its name. */
  release(b: ManagedBuffer): void;
  /** Releases every buffer registered for a stage. */
  releaseStage(stage: StageId): void;

  /**
   * Compiles a kernel. The pipeline is cached by source hash; a kernel with more than
   * {@link MAX_STORAGE_BUFFERS_PER_KERNEL} storage buffers or more than
   * {@link MAX_BIND_GROUPS_PER_KERNEL} bind groups is rejected, as is a WGSL error. The
   * declarations are checked against the source as far as that is mechanical: every operation
   * class the source calls (`opClassesInWgsl`) must be in `uses` (rule 9); every read-write
   * storage binding must be in `writes` or `atomics`; and `atomics` is non-empty exactly when
   * the source has atomic operations.
   */
  kernel(def: KernelDef): Promise<Kernel>;
  /**
   * The names of the kernels registered on this context so far that declared any of the given
   * operation classes in `uses`, sorted, each once (the context's own reduction and guard
   * kernels included). With the classes whose probe hashes changed
   * (`compareProbeRecords(...).changed`), it names the kernels whose bits may have moved (section M1,
   * "Determinism probes"; rule 9).
   */
  kernelsUsing(classes: readonly OpClass[]): string[];
  /**
   * Encodes a batch in order and submits it, split into command buffers of bounded planned GPU
   * time (never sized from the clock). Returns at once; the work is finished after `drain`.
   */
  submit(batch: DispatchBatch, options?: SubmitOptions): void;
  /**
   * Resolves when all submitted work has finished (`onSubmittedWorkDone`); rejects with a
   * `GpuInfrastructureError` if the device was lost or reported an error.
   */
  drain(): Promise<void>;
  /**
   * `submit` followed by `drain`, awaiting the GPU every few command buffers so that the queue
   * stays short (spike report section 12).
   */
  run(batch: DispatchBatch, options?: SubmitOptions): Promise<void>;

  /** Creates the two zero-filled buffers of a deposit accumulator, `<name>.a` and `<name>.b`. */
  accumulators(d: BufferDescriptor): AccumulatorPair;
  /**
   * Exchanges current and next and clears the new next. With `batch`, the clear is appended to
   * that batch (so that it happens at this point of the batch being built); without, it is
   * submitted at once.
   */
  swapAccumulators(pair: AccumulatorPair, batch?: BatchOp[]): void;

  /**
   * Exact 64-bit sums of i32 or u32 words over a whole buffer (integer block reduction of
   * section M1, fan-in {@link REDUCTION_FAN_IN}, 64-bit sums carried as two u32 with explicit
   * carry). Returns one sum per field of the specification. Like `read`, it covers exactly the
   * work submitted before the call: every pass is encoded synchronously with kernels compiled
   * when the context was created, so the result is the same whether or not the caller submits
   * more work before awaiting it, and whether caches are cold or warm (section 6). An argument
   * error is a rejection.
   */
  reduceI64(src: ManagedBuffer, spec: ReduceSpec): Promise<BigInt64Array>;
  /**
   * The segmented form: elements are stored grouped by segment, and `key` is the CPU-built
   * offset table of the contract's prose: `key[s]` is the first element of segment `s` and
   * `key[segments]` one past the last element of the last segment (non-decreasing; a segment
   * may be empty). Returns `[segment][field]`, row-major. `segments`, if given, must equal
   * `key.length - 1`. (The contract's signature has `key` as a buffer with one segment id per
   * element; its prose has the offset table. The offset table is implemented.) Covers exactly
   * the work submitted before the call, as `reduceI64` does.
   */
  reduceI64By(
    src: ManagedBuffer,
    spec: ReduceSpec,
    key: Uint32Array,
    segments?: number,
  ): Promise<BigInt64Array>;

  /**
   * Number of f32 words and f16 halves whose exponent bits are all ones (NaN or infinity),
   * counted on bit patterns in a kernel (bit-pattern guard of M1). Examines the given buffers,
   * or by default every live buffer that registered f32 or f16 fields (a buffer without
   * storage usage, such as a uniform block, through a scratch copy). All of them are examined
   * as left by the work submitted before the call, at one point of the queue, as `read` does;
   * a trailing partial record is examined too.
   */
  nonFiniteCount(buffers?: readonly ManagedBuffer[]): Promise<number>;

  /** The first infrastructure failure of the device, or null. */
  failure(): GpuFailure | null;
  /** Releases every buffer and destroys the device. */
  destroy(): void;
}

/**
 * The members of the contract's `GpuContext` that the first build leaves out (see
 * docs/design/scope.md and the brief of the GPU foundation): eviction of run-scoped buffers to
 * a staging file, checkpoint and restore, and saturation counters. Nothing implements this
 * interface yet. It is kept so that the names stay reserved: because modules hold
 * {@link ManagedBuffer} handles and never bind groups, these can be added to the context
 * without changing callers.
 */
export interface GpuContextDeferred {
  /** Reads the run-scoped buffers back into the staging file `to` and releases their memory. */
  evict(stage: 'run', to: string): Promise<void>;
  /** Recreates the run-scoped buffers from the staging file `from` and uploads them. */
  readmit(from: string): Promise<void>;
  /** Writes every registered run-scoped buffer, with the stack string, under `tag`. */
  checkpoint(tag: string): Promise<void>;
  /** Restores the checkpoint written under `tag`. */
  restore(tag: string): Promise<void>;
  /** Number of integer fields that reached their registered bound. */
  saturationCount(): Promise<number>;
}

// ---------------------------------------------------------------------------------------------
// Constants the contract fixes for M1
// ---------------------------------------------------------------------------------------------

/**
 * Shared fixed-point unit of water mass, kilograms per integer unit (section 4, "Shared
 * fixed-point units"): u32 and i32 words. One unit is 0.25 nm of film on a 4 mm2 block; a u32
 * holds 4.3 g and an i32 accumulator +/- 2.1 g per base step.
 */
export const WATER_MASS_UNIT_KG = 1e-12;

/**
 * Shared fixed-point unit of water momentum, kg m/s per integer unit (section 4): i32
 * accumulators cleared every base step, range 2.1e-3 kg m/s.
 */
export const WATER_MOMENTUM_UNIT_KG_M_S = 1e-12;

/**
 * Shared fixed-point unit of removed soil mass, kilograms per integer unit (section 4): u32 per
 * soil cell and tick, summed in 64 bits.
 */
export const SOIL_MASS_UNIT_KG = 1e-15;

/** Shared fixed-point unit of heat, joules per integer unit (section 4): i32 per block and tick. */
export const HEAT_UNIT_J = 1e-7;

/**
 * Every binding, and so every registered buffer, must be smaller than this many bytes (section
 * M1: "every binding is asserted to be smaller than 2^32 - 4 bytes"). Read strictly: the largest
 * binding allowed is 2^32 - 8 bytes, one word less than the bindings advertise.
 */
export const BINDING_BYTES_LIMIT = 2 ** 32 - 4;

/**
 * Most storage buffers one kernel may bind (section M1): the device limit is 10; 8 is the
 * default in browsers, where the fast and preview tiers must run.
 */
export const MAX_STORAGE_BUFFERS_PER_KERNEL = 8;

/** Most bind groups one kernel may use (section M1). */
export const MAX_BIND_GROUPS_PER_KERNEL = 3;

/** Fan-in of one pass of the integer block reduction (section M1). */
export const REDUCTION_FAN_IN = 64;

/**
 * Shortest and longest planned GPU time of one command buffer, seconds (sections 2.3 and M1:
 * 50 to 250 ms; chunk sizes come from the frozen planning rates, never from the clock).
 */
export const COMMAND_BUFFER_PLANNED_S: readonly [min: number, max: number] = [0.05, 0.25];

/** Most fields one integer block reduction can sum (the size of its uniform field table). */
export const MAX_REDUCE_FIELDS = 16;

/**
 * Ceiling on the bytes of registered buffers alive at once, unless the context is created with
 * another: 4 GiB (spike report section 12, "stay under 4 GB of GPU buffers in total"; the
 * contract plans a peak of 2.1 GB). Exceeding it fails the registration (rule 12).
 */
export const DEFAULT_MAX_LIVE_BYTES = 4 * 2 ** 30;
