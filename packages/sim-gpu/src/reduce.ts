/**
 * The integer block reduction (docs/design/sim-core.md section M1, "Integer block reduction";
 * determinism rule 5): exact 64-bit sums of i32 or u32 words over a whole buffer or per
 * segment, computed on the GPU in passes of fan-in 64 that carry each sum as two u32 words with
 * explicit carry. Being integer and associative, the result does not depend on the order of
 * evaluation, on the workgroup size or on the batching.
 *
 * Segmented form: elements are stored grouped by segment and a CPU-built offset table gives
 * each segment's range; nothing is sorted. Every segment is reduced by its own tree, and all
 * trees advance together, one level per pass: a pass has one invocation per (group, field),
 * where a group is up to 64 consecutive entries of one segment, listed in a table built on the
 * CPU. After the last pass each segment has exactly one entry.
 *
 * Units: bytes for strides and offsets; sums are in the stored integer unit of the field.
 */

import { dispatchGrid } from './grid.ts';
import type { RecordLayout } from './layout.ts';
import {
  MAX_REDUCE_FIELDS,
  REDUCTION_FAN_IN,
  type BatchOp,
  type GpuContext,
  type Kernel,
  type KernelDef,
  type ManagedBuffer,
  type ReduceField,
  type ReduceSpec,
} from './types.ts';
import { BUFFER_USAGE } from './usage.ts';
import { WGSL_I64, type WgslLibrary } from './wgsl.ts';

const FAN = REDUCTION_FAN_IN;

/** The four kernels: first pass or later pass, groups implicit or from the table. */
function reduceWgsl(stage: 'leaf' | 'node', table: boolean): string {
  const range = table
    ? `let r = ranges[g];
  let start = r.x;
  let n = r.y;`
    : `let start = g * ${FAN}u;
  let n = min(${FAN}u, P.count - min(P.count, start));`;
  const load =
    stage === 'leaf'
      ? `let w = src[(start + k) * P.stride + P.field[f].x];
    let v = vec2<u32>(w, select(0u, 0xffffffffu, P.field[f].y == 1u && (w & 0x80000000u) != 0u));`
      : `let at = 2u * ((start + k) * P.fields + f);
    let v = vec2<u32>(src[at], src[at + 1u]);`;
  return /* wgsl */ `
#include "${WGSL_I64}"
struct ReduceParams {
  count: u32,
  stride: u32,
  fields: u32,
  groups: u32,
  row: u32,
  spare0: u32,
  spare1: u32,
  spare2: u32,
  field: array<vec4<u32>, ${MAX_REDUCE_FIELDS}>,
}
@group(0) @binding(0) var<uniform> P: ReduceParams;
@group(0) @binding(1) var<storage, read> src: array<u32>;
@group(0) @binding(2) var<storage, read_write> dst: array<u32>;
${table ? '@group(0) @binding(3) var<storage, read> ranges: array<vec2<u32>>;' : ''}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.y * P.row + gid.x;
  if (idx >= P.groups * P.fields) { return; }
  let g = idx / P.fields;
  let f = idx % P.fields;
  ${range}
  var acc = vec2<u32>(0u, 0u);
  for (var k = 0u; k < n; k++) {
    ${load}
    acc = i64_add(acc, v);
  }
  dst[2u * idx] = acc.x;
  dst[2u * idx + 1u] = acc.y;
}
`;
}

let scratchSerial = 0;

/**
 * The four kernels of the reduction, compiled once when the context is created: first pass or
 * later pass, groups implicit (whole buffer) or from the group table (segmented).
 */
export interface ReduceKernels {
  /** First pass over the source words, implicit groups. */
  readonly leaf: Kernel;
  /** Later pass over 64-bit pairs, implicit groups. */
  readonly node: Kernel;
  /** First pass, groups from the table. */
  readonly leafTable: Kernel;
  /** Later pass, groups from the table. */
  readonly nodeTable: Kernel;
}

/**
 * The definition of one of the four reduction kernels (see {@link ReduceKernels}). They use
 * integer arithmetic only; `bitcast` is declared because the included 64-bit helpers have it.
 */
export function reduceKernelDef(
  library: WgslLibrary,
  stage: 'leaf' | 'node',
  table: boolean,
): KernelDef {
  return {
    name: `sim-gpu.reduce.${stage}${table ? '.table' : ''}`,
    wgsl: library.assemble(reduceWgsl(stage, table)),
    entry: 'main',
    bindings: [
      { group: 0, binding: 0, name: 'params', kind: 'uniform' },
      { group: 0, binding: 1, name: 'src', kind: 'read-only-storage' },
      { group: 0, binding: 2, name: 'dst', kind: 'storage' },
      ...(table
        ? [{ group: 0, binding: 3, name: 'ranges', kind: 'read-only-storage' } as const]
        : []),
    ],
    uses: ['bitcast'],
    reads: ['params', 'src', ...(table ? ['ranges'] : [])],
    writes: ['dst'],
    atomics: [],
  };
}

/** One pass of the tree: how many output groups, and for the segmented form their ranges. */
interface Level {
  readonly groups: number;
  /** Entries of the level's input (implicit groups only). */
  readonly inputCount: number;
  /** `(start, count)` per output group (segmented form only). */
  readonly ranges: Uint32Array | null;
}

/** The passes that reduce `count` entries to one, in implicit groups of the fan-in. */
function wholeLevels(count: number): Level[] {
  const levels: Level[] = [];
  let entries = count;
  do {
    const groups = Math.max(1, Math.ceil(entries / FAN));
    levels.push({ groups, inputCount: entries, ranges: null });
    entries = groups;
  } while (entries > 1);
  return levels;
}

/**
 * The passes that reduce every segment to one entry. Each segment keeps at least one group in
 * every pass (an empty segment a group of no entries), so that after the last pass entry `s`
 * belongs to segment `s`.
 */
function segmentLevels(offsets: Uint32Array): Level[] {
  const segments = offsets.length - 1;
  let starts = new Float64Array(segments);
  let lengths = new Float64Array(segments);
  for (let s = 0; s < segments; s++) {
    starts[s] = offsets[s] as number;
    lengths[s] = (offsets[s + 1] as number) - (offsets[s] as number);
  }
  const levels: Level[] = [];
  for (;;) {
    let groups = 0;
    let longest = 0;
    for (let s = 0; s < segments; s++) {
      groups += Math.max(1, Math.ceil((lengths[s] as number) / FAN));
    }
    const ranges = new Uint32Array(2 * groups);
    const nextStarts = new Float64Array(segments);
    const nextLengths = new Float64Array(segments);
    let g = 0;
    for (let s = 0; s < segments; s++) {
      const length = lengths[s] as number;
      const own = Math.max(1, Math.ceil(length / FAN));
      nextStarts[s] = g;
      nextLengths[s] = own;
      longest = Math.max(longest, own);
      for (let j = 0; j < own; j++, g++) {
        ranges[2 * g] = (starts[s] as number) + j * FAN;
        ranges[2 * g + 1] = Math.max(0, Math.min(FAN, length - j * FAN));
      }
    }
    levels.push({ groups, inputCount: 0, ranges });
    if (longest <= 1) return levels;
    starts = nextStarts;
    lengths = nextLengths;
  }
}

/** A reduction whose passes are encoded and submitted; only its result is still to be read. */
export interface EncodedReduction {
  /** The buffer that holds the result, 8 bytes (low word, high word) per sum. */
  readonly result: ManagedBuffer;
  /** Number of sums: fields times segments. */
  readonly sums: number;
  /** Scratch buffers to release once the result has been read. */
  readonly scratch: readonly ManagedBuffer[];
}

/**
 * Validates a reduction and encodes and submits all of its passes, synchronously: the passes
 * are in the queue when this returns, so the reduction covers exactly the work submitted before
 * the call. Returns null for a segmented reduction with no segments. Throws a `RangeError` for
 * an argument error; on any throw the scratch buffers made so far are released.
 */
export function encodeReduceI64(
  ctx: GpuContext,
  kernels: ReduceKernels,
  src: ManagedBuffer,
  spec: ReduceSpec,
  offsets: Uint32Array | null,
): EncodedReduction | null {
  const say = (text: string): never => {
    throw new RangeError(`reduction over ${src.name}: ${text}`);
  };
  const { strideBytes, fields } = spec;
  if (!Number.isInteger(strideBytes) || strideBytes <= 0 || strideBytes % 4 !== 0) {
    say(`stride ${strideBytes} is not a positive multiple of 4 bytes`);
  }
  if (fields.length < 1 || fields.length > MAX_REDUCE_FIELDS) {
    say(`${fields.length} fields; 1 to ${MAX_REDUCE_FIELDS} can be summed at once`);
  }
  for (const field of fields) {
    if (
      !Number.isInteger(field.offsetBytes) ||
      field.offsetBytes < 0 ||
      field.offsetBytes % 4 !== 0 ||
      field.offsetBytes + 4 > strideBytes
    ) {
      say(`field offset ${field.offsetBytes} is not a word of a ${strideBytes}-byte element`);
    }
  }
  if ((src.usage & BUFFER_USAGE.STORAGE) === 0) say('the buffer has no storage usage');
  const capacity = Math.floor(src.bytes / strideBytes);
  const count = spec.count ?? capacity;
  if (!Number.isInteger(count) || count < 0 || count > capacity) {
    say(`${count} elements of ${strideBytes} bytes do not fit its ${src.bytes} bytes`);
  }
  let segments = 1;
  if (offsets !== null) {
    segments = offsets.length - 1;
    for (let s = 0; s < segments; s++) {
      if ((offsets[s] as number) > (offsets[s + 1] as number)) {
        say(`the offset table decreases at segment ${s}`);
      }
    }
    if ((offsets[segments] as number) > count) {
      say(`the offset table ends at element ${offsets[segments]}, beyond ${count}`);
    }
    if (segments === 0) return null;
  }

  const levels = offsets === null ? wholeLevels(count) : segmentLevels(offsets);
  const table = offsets !== null;
  const leaf = table ? kernels.leafTable : kernels.leaf;
  const node = table ? kernels.nodeTable : kernels.node;
  const nFields = fields.length;
  const serial = scratchSerial++;
  const scratch: ManagedBuffer[] = [];
  const make = (suffix: string, bytes: number, usage: number): ManagedBuffer => {
    const buffer = ctx.buffer({
      name: `sim-gpu.reduce#${serial}.${suffix}`,
      owner: 'sim-gpu',
      stage: 'run',
      bytes,
      usage,
      fields: [{ name: 'word', type: 'u32', role: 'statistic', unit: '-' }],
    });
    scratch.push(buffer);
    return buffer;
  };

  try {
    const params = make('params', 32 + 16 * MAX_REDUCE_FIELDS, BUFFER_USAGE.UNIFORM);
    const first = levels[0] as Level;
    // Two outputs used alternately; the first pass has the most groups, the second the next most.
    const outputs = [
      make('a', 8 * nFields * first.groups, BUFFER_USAGE.STORAGE),
      levels.length > 1
        ? make('b', 8 * nFields * (levels[1] as Level).groups, BUFFER_USAGE.STORAGE)
        : null,
    ];
    const ranges = table ? make('ranges', 8 * first.groups, BUFFER_USAGE.STORAGE) : null;

    let input = src;
    levels.forEach((level, index) => {
      const output = outputs[index % 2] as ManagedBuffer;
      const grid = dispatchGrid(level.groups * nFields, 64);
      const words = new Uint32Array(8 + 4 * MAX_REDUCE_FIELDS);
      words.set([level.inputCount, strideBytes / 4, nFields, level.groups, grid.row]);
      fields.forEach((field, f) => {
        words[8 + 4 * f] = field.offsetBytes / 4;
        words[8 + 4 * f + 1] = field.type === 'i32' ? 1 : 0;
      });
      // writeBuffer and submit are both queue operations, so each pass sees its own parameters.
      ctx.write(params, words);
      if (ranges !== null && level.ranges !== null) ctx.write(ranges, level.ranges);
      const op: BatchOp = {
        op: 'dispatch',
        kernel: index === 0 ? leaf : node,
        bindings: { params, src: input, dst: output, ...(ranges !== null ? { ranges } : {}) },
        workgroups: grid.workgroups,
        plannedTime: 0,
      };
      ctx.submit([op]);
      input = output;
    });
    return { result: input, sums: nFields * segments, scratch };
  } catch (error) {
    releaseScratch(ctx, scratch);
    throw error;
  }
}

/** Releases scratch buffers that are still alive (a destroyed context has released them). */
export function releaseScratch(ctx: GpuContext, scratch: readonly ManagedBuffer[]): void {
  for (const buffer of scratch) if (!buffer.released) ctx.release(buffer);
}

/** The 64-bit sums stored as (low word, high word) pairs in `bytes`. */
export function decodeI64Pairs(bytes: ArrayBuffer): BigInt64Array {
  const pairs = new Uint32Array(bytes);
  const sums = new BigInt64Array(pairs.length / 2);
  for (let i = 0; i < sums.length; i++) {
    const lo = BigInt(pairs[2 * i] as number);
    const hi = BigInt(pairs[2 * i + 1] as number);
    sums[i] = BigInt.asIntN(64, (hi << 32n) | lo);
  }
  return sums;
}

/**
 * Sums the fields of `spec` over `src`: over the whole buffer if `offsets` is null (one sum per
 * field), else per segment of the offset table (`[segment][field]`, row-major). Exact. All
 * passes and the copy for the read-back are encoded before this returns, so the sums are those
 * of the buffer as left by the work submitted before the call; later work is not included.
 * An argument error is a rejection. See `GpuContext.reduceI64` and `reduceI64By`, which call
 * this.
 */
export function reduceI64OnGpu(
  ctx: GpuContext,
  kernels: ReduceKernels,
  src: ManagedBuffer,
  spec: ReduceSpec,
  offsets: Uint32Array | null,
): Promise<BigInt64Array> {
  let encoded: EncodedReduction | null;
  let bytes: Promise<ArrayBuffer>;
  try {
    encoded = encodeReduceI64(ctx, kernels, src, spec, offsets);
    if (encoded === null) return Promise.resolve(new BigInt64Array(0));
    try {
      bytes = ctx.read(encoded.result, 0, 8 * encoded.sums);
    } catch (error) {
      releaseScratch(ctx, encoded.scratch);
      throw error;
    }
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
  const { scratch } = encoded;
  return bytes.then(decodeI64Pairs).finally(() => releaseScratch(ctx, scratch));
}

/**
 * The {@link ReduceSpec} that sums named 32-bit integer fields of a record layout, in the order
 * given; a field with `count` elements contributes one sum per element. Throws for a field that
 * is not `u32` or `i32`.
 */
export function reduceSpecOf(layout: RecordLayout, names: readonly string[]): ReduceSpec {
  const fields: ReduceField[] = [];
  for (const name of names) {
    const field = layout.fields.find((f) => f.name === name && !f.pad);
    if (field === undefined) throw new Error(`${layout.name} has no field ${name}`);
    if (field.type !== 'u32' && field.type !== 'i32') {
      throw new Error(`${layout.name}.${name} is ${field.type}; only u32 and i32 are summed`);
    }
    for (let k = 0; k < (field.count ?? 1); k++) {
      fields.push({ offsetBytes: field.offset + k * (field.stride ?? 4), type: field.type });
    }
  }
  return { strideBytes: layout.byteSize, fields };
}
