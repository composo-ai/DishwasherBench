/**
 * The non-finite guard (docs/design/sim-core.md section M1, "Non-finite guard"; determinism
 * rule 12): counts the float words of a buffer whose exponent bits are all ones, that is NaN
 * and the two infinities, for f32 words (exponent mask 0x7f800000) and for the f16 halves of
 * packed words (exponent mask 0x7c00). WGSL lets an implementation assume such values do not
 * occur, so a guard written with float comparisons or `clamp` may be compiled away; this one
 * reads the float state as `u32` words and tests bit patterns, and its count is summed by the
 * exact integer reduction. A non-zero count at a stage boundary fails the run.
 */

import { dispatchGrid } from './grid.ts';
import { FIELD_BYTES } from './layout.ts';
import {
  decodeI64Pairs,
  encodeReduceI64,
  releaseScratch,
  type EncodedReduction,
  type ReduceKernels,
} from './reduce.ts';
import {
  REDUCTION_FAN_IN,
  type GpuContext,
  type Kernel,
  type KernelDef,
  type ManagedBuffer,
} from './types.ts';
import { BUFFER_USAGE } from './usage.ts';
import { WGSL_NONFINITE, type WgslLibrary } from './wgsl.ts';

/** Most 32-bit words one record may have for the guard (the size of its mask): 4,096 bytes. */
export const GUARD_MAX_RECORD_WORDS = 1024;

/** Which words of each element of a buffer hold floats. */
export interface FloatWordMask {
  /** Words per element. */
  readonly strideWords: number;
  /** Bit `w % 32` of entry `w >> 5` is set if word `w` of an element is an f32. */
  readonly mask: Uint32Array;
  /** The same bit set, for words whose low 16 bits (bytes 0 and 1) are an f16. */
  readonly lowHalf: Uint32Array;
  /** The same bit set, for words whose high 16 bits (bytes 2 and 3) are an f16. */
  readonly highHalf: Uint32Array;
}

/**
 * The float words of one element of a registered buffer, or null if it has none. With a
 * layout, the words its f32 fields occupy and the halves its f16 fields occupy (a 2-byte
 * record of one f16 is two to a word); without one, every word if all registered fields are
 * f32, or every half if all are f16. Throws for a buffer that registers float fields beside
 * others, or f32 beside f16, without a layout, because the guard could then not tell floats
 * from integers (an integer may legitimately have the bit pattern of a NaN).
 */
export function floatWordMask(buffer: ManagedBuffer): FloatWordMask | null {
  const layout = buffer.layout;
  if (layout !== undefined) {
    const strideWords = Math.ceil(layout.byteSize / 4);
    const size = Math.ceil(strideWords / 32);
    const mask = new Uint32Array(size);
    const lowHalf = new Uint32Array(size);
    const highHalf = new Uint32Array(size);
    const set = (bits: Uint32Array, word: number): void => {
      bits[word >> 5] = ((bits[word >> 5] as number) | (1 << (word & 31))) >>> 0;
    };
    let any = false;
    for (const field of layout.fields) {
      if ((field.type !== 'f32' && field.type !== 'f16') || field.pad) continue;
      const stride = field.stride ?? FIELD_BYTES[field.type];
      for (let k = 0; k < (field.count ?? 1); k++) {
        const at = field.offset + k * stride;
        if (field.type === 'f32') set(mask, at >> 2);
        else set(at % 4 === 0 ? lowHalf : highHalf, at >> 2);
        any = true;
      }
    }
    if (!any) return null;
    // A 2-byte record is packed two to a word: its f16 is in both halves of every word.
    if (layout.byteSize === 2) set(highHalf, 0);
    return { strideWords, mask, lowHalf, highHalf };
  }
  const f32s = buffer.fields.filter((f) => f.type === 'f32').length;
  const f16s = buffer.fields.filter((f) => f.type === 'f16').length;
  if (f32s + f16s === 0) return null;
  if (f32s !== buffer.fields.length && f16s !== buffer.fields.length) {
    throw new Error(
      `buffer ${buffer.name} registers float fields beside other fields without a layout; give ` +
        `its record layout so that the non-finite guard can tell which words are floats`,
    );
  }
  const all = Uint32Array.of(1);
  const none = Uint32Array.of(0);
  return f32s > 0
    ? { strideWords: 1, mask: all, lowHalf: none, highHalf: none }
    : { strideWords: 1, mask: none, lowHalf: all, highHalf: all };
}

const MASK_VEC4S = GUARD_MAX_RECORD_WORDS / 128;
/** Words of the uniform block of the guard kernel: 8 scalars and three masks. */
const PARAM_WORDS = 8 + 3 * (GUARD_MAX_RECORD_WORDS / 32);

const GUARD_WGSL = /* wgsl */ `
#include "${WGSL_NONFINITE}"
struct GuardParams {
  count: u32,
  stride: u32,
  groups: u32,
  row: u32,
  words: u32,
  dst_base: u32,
  spare0: u32,
  spare1: u32,
  mask: array<vec4<u32>, ${MASK_VEC4S}>,
  low_half: array<vec4<u32>, ${MASK_VEC4S}>,
  high_half: array<vec4<u32>, ${MASK_VEC4S}>,
}
@group(0) @binding(0) var<uniform> P: GuardParams;
@group(0) @binding(1) var<storage, read> src: array<u32>;
@group(0) @binding(2) var<storage, read_write> dst: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let g = gid.y * P.row + gid.x;
  if (g >= P.groups) { return; }
  let start = g * ${REDUCTION_FAN_IN}u;
  let n = min(${REDUCTION_FAN_IN}u, P.count - start);
  var found = 0u;
  for (var k = 0u; k < n; k++) {
    let base = (start + k) * P.stride;
    for (var w = 0u; w < P.stride; w++) {
      // The last record of a buffer may be partial: words past the end are not examined.
      if (base + w >= P.words) { break; }
      let bit = 1u << (w & 31u);
      let bits = src[base + w];
      if ((P.mask[w >> 7u][(w >> 5u) & 3u] & bit) != 0u) {
        if (nonfinite_bits(bits)) { found += 1u; }
      } else {
        if ((P.low_half[w >> 7u][(w >> 5u) & 3u] & bit) != 0u && (bits & 0x7c00u) == 0x7c00u) {
          found += 1u;
        }
        if ((P.high_half[w >> 7u][(w >> 5u) & 3u] & bit) != 0u
            && (bits & 0x7c000000u) == 0x7c000000u) {
          found += 1u;
        }
      }
    }
  }
  dst[P.dst_base + g] = found;
}
`;

/** The definition of the guard kernel, compiled once when the context is created. */
export function guardKernelDef(library: WgslLibrary): KernelDef {
  return {
    name: 'sim-gpu.nonfinite',
    wgsl: library.assemble(GUARD_WGSL),
    entry: 'main',
    bindings: [
      { group: 0, binding: 0, name: 'params', kind: 'uniform' },
      { group: 0, binding: 1, name: 'src', kind: 'read-only-storage' },
      { group: 0, binding: 2, name: 'dst', kind: 'storage' },
    ],
    uses: ['bitcast'],
    reads: ['params', 'src'],
    writes: ['dst'],
    atomics: [],
  };
}

let scratchSerial = 0;

/**
 * Counts the non-finite float words and halves of the given buffers (see the module comment),
 * as one total. Every buffer's dispatch, the reduction of the counts and the copy for the
 * read-back are encoded before this returns, so all buffers are examined as left by the work
 * submitted before the call, at one point of the queue; later work is not included. A buffer
 * without float fields counts zero; one without storage usage (a uniform block) is examined
 * through a scratch copy. A trailing partial record is examined as far as the buffer goes.
 * Elements larger than {@link GUARD_MAX_RECORD_WORDS} words are refused (a rejection).
 */
export function countNonFiniteOnGpu(
  ctx: GpuContext,
  guard: Kernel,
  reduce: ReduceKernels,
  buffers: readonly ManagedBuffer[],
): Promise<number> {
  const scratch: ManagedBuffer[] = [];
  let encoded: EncodedReduction | null = null;
  let bytes: Promise<ArrayBuffer>;
  try {
    const jobs: { buffer: ManagedBuffer; floats: FloatWordMask; count: number; groups: number }[] =
      [];
    let totalGroups = 0;
    for (const buffer of buffers) {
      const floats = floatWordMask(buffer);
      if (floats === null) continue;
      if (floats.strideWords > GUARD_MAX_RECORD_WORDS) {
        throw new Error(
          `buffer ${buffer.name}: elements of ${floats.strideWords} words exceed the guard's ` +
            `${GUARD_MAX_RECORD_WORDS}`,
        );
      }
      const count = Math.ceil(buffer.bytes / (4 * floats.strideWords));
      const groups = Math.ceil(count / REDUCTION_FAN_IN);
      jobs.push({ buffer, floats, count, groups });
      totalGroups += groups;
    }
    if (jobs.length === 0) return Promise.resolve(0);

    const serial = scratchSerial++;
    const make = (suffix: string, size: number, usage: number): ManagedBuffer => {
      const made = ctx.buffer({
        name: `sim-gpu.nonfinite#${serial}.${suffix}`,
        owner: 'sim-gpu',
        stage: 'run',
        bytes: size,
        usage,
        fields: [{ name: 'word', type: 'u32', role: 'statistic', unit: '-' }],
      });
      scratch.push(made);
      return made;
    };
    const params = make('params', 4 * PARAM_WORDS, BUFFER_USAGE.UNIFORM);
    const counts = make('counts', 4 * totalGroups, BUFFER_USAGE.STORAGE);
    let base = 0;
    jobs.forEach((job, index) => {
      let src = job.buffer;
      if ((src.usage & BUFFER_USAGE.STORAGE) === 0) {
        // The kernel binds storage buffers; anything else is examined through a copy.
        const copy = make(`copy${index}`, src.bytes, BUFFER_USAGE.STORAGE);
        ctx.submit([{ op: 'copy', from: src, to: copy }]);
        src = copy;
      }
      const grid = dispatchGrid(job.groups, 64);
      const words = new Uint32Array(PARAM_WORDS);
      words.set([job.count, job.floats.strideWords, job.groups, grid.row, src.bytes / 4, base]);
      words.set(job.floats.mask, 8);
      words.set(job.floats.lowHalf, 8 + GUARD_MAX_RECORD_WORDS / 32);
      words.set(job.floats.highHalf, 8 + 2 * (GUARD_MAX_RECORD_WORDS / 32));
      // writeBuffer and submit are both queue operations, so each dispatch sees its own
      // parameters.
      ctx.write(params, words);
      ctx.submit([
        {
          op: 'dispatch',
          kernel: guard,
          bindings: { params, src, dst: counts },
          workgroups: grid.workgroups,
          plannedTime: 0,
        },
      ]);
      base += job.groups;
    });
    encoded = encodeReduceI64(
      ctx,
      reduce,
      counts,
      { strideBytes: 4, fields: [{ offsetBytes: 0, type: 'u32' }] },
      null,
    );
    if (encoded === null) throw new Error('the reduction of the guard counts is empty');
    bytes = ctx.read(encoded.result, 0, 8);
  } catch (error) {
    releaseScratch(ctx, scratch);
    if (encoded !== null) releaseScratch(ctx, encoded.scratch);
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
  const all = [...scratch, ...encoded.scratch];
  return bytes
    .then((data) => Number(decodeI64Pairs(data)[0]))
    .finally(() => releaseScratch(ctx, all));
}
