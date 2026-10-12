/**
 * Determinism probes (docs/design/sim-core.md section M1, "Determinism probes"; rules 9 and 13
 * of section 6): one small kernel per {@link OpClass}. Each kernel evaluates a handful of
 * expressions of its class on {@link PROBE_COUNT} pseudo-random inputs; the SHA-256 of its
 * output is recorded per GPU stack. When an operating-system or bindings update changes a hash,
 * the class names the kernels whose bits may have moved (`KernelDef.uses`).
 *
 * Beside the hash, every expression is compared on the CPU with what strict IEEE 754
 * single-precision arithmetic gives under each plausible reading (operations kept separate or
 * fused into a multiply-add, evaluated in source order or reassociated, a division or a
 * multiplication by the reciprocal), so that the record also says what the stack's shader
 * compiler does. For transcendental functions the reference is the double-precision result of
 * the JavaScript engine rounded to single, and the record gives the largest distance from it in
 * units in the last place: the tolerance a CPU reference implementation needs (rule 17).
 *
 * The inputs are built from integer hashes (`rng_hash3` of `@spotless/core`) by assembling
 * sign, exponent and fraction bits, so that the kernel and the CPU see identical operands
 * without any float operation being involved in making them. Dimensionless.
 *
 * Nothing here needs Node; recording to and reading from `probes/` is in `node/probe-files.ts`.
 */

import { hashU32, sha256Hex } from '@spotless/core';
import { f16BitsToNumber, numberToF16Bits } from './f16.ts';
import { gpuStackOf, type GpuStack } from './stack.ts';
import { OP_CLASSES, type GpuContext, type OpClass } from './types.ts';
import { BUFFER_USAGE } from './usage.ts';
import { opClassesInWgsl, WGSL_RNG } from './wgsl.ts';

/** Invocations per probe kernel. */
export const PROBE_COUNT = 16384;

/** Output words per invocation of a probe kernel. */
export const PROBE_WORDS = 12;

/** Seed of the probe inputs. Changing it changes every recorded hash. */
export const PROBE_SEED = 0x5eedc0de;

/** Format version of a {@link ProbeRecord}. */
export const PROBE_RECORD_VERSION = 1;

/** Bins of the atomics probe: add, signed add and max, {@link ATOMIC_BINS} each. */
const ATOMIC_BINS = 256;

const f = Math.fround;

/** The operands of one invocation: four floats and one raw hash word. */
export interface ProbeOperands {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly h: number;
}

/**
 * Operand `k` of invocation `i` of the probe of class number `op` (operand `4 s + n` is the
 * n-th of a, b, c, d of operand set `s`): a float with a random sign, a random 23-bit fraction
 * and an exponent uniform in `[-span, span]`, the same bits the kernel's `pin` builds.
 */
export function probeOperand(op: number, i: number, k: number, span: number): number {
  const h = hashU32(PROBE_SEED, op, i, 2 * k);
  const m = hashU32(PROBE_SEED, op, i, 2 * k + 1);
  const e = 127 - span + (h % (2 * span + 1));
  const bits = ((m & 0x80000000) | (e << 23) | (m & 0x007fffff)) >>> 0;
  return new Float32Array(Uint32Array.of(bits).buffer)[0] as number;
}

/** One expression of a probe and the readings it is compared with. */
interface ProbeColumn {
  /** Name of the expression in the record. */
  readonly name: string;
  /** WGSL expression of type `u32` (`float: false`) or `f32` (`float: true`). */
  readonly wgsl: string;
  /** True if the expression is an `f32`, stored as its bits. */
  readonly float: boolean;
  /**
   * Reference values by reading: for a float column the real number (rounded to single here),
   * for an integer column the u32.
   */
  readonly refs: Readonly<Record<string, (x: ProbeOperands) => number>>;
  /**
   * Index of the column whose operands this one uses. By default every column has operands of
   * its own, so that the compiler cannot share a subexpression between two columns and each
   * expression is seen in isolation; a column that names another shows what sharing does.
   */
  readonly operandsOf?: number;
}

interface ProbeDef {
  readonly op: OpClass;
  /** Exponent span of the operands a, b, c, d. */
  readonly span: number;
  /** Extra statements before the expressions (shared temporaries). */
  readonly prelude?: string;
  readonly columns: readonly ProbeColumn[];
}

const bitsOf = (x: number): number => new Uint32Array(Float32Array.of(x).buffer)[0] as number;
const fl = (
  name: string,
  wgsl: string,
  refs: ProbeColumn['refs'],
  operandsOf?: number,
): ProbeColumn => ({
  name,
  wgsl,
  float: true,
  refs,
  ...(operandsOf !== undefined ? { operandsOf } : {}),
});
const int = (name: string, wgsl: string, refs: ProbeColumn['refs']): ProbeColumn => ({
  name,
  wgsl,
  float: false,
  refs,
});
/**
 * WGSL float-to-i32 conversion: truncation toward zero, with the operand first clamped to the
 * largest single-precision value that fits an i32, 2^31 - 128 (so an overflowing conversion
 * gives 0x7fffff80, not 0x7fffffff).
 */
const toI32 = (x: number): number =>
  Math.min(2 ** 31 - 128, Math.max(-(2 ** 31), Math.trunc(x))) >>> 0;
/** The same for u32: clamped to 0 and to 2^32 - 256. */
const toU32 = (x: number): number => Math.min(2 ** 32 - 256, Math.max(0, Math.trunc(x)));
/** Round half to even, as WGSL `round`. */
const roundEven = (x: number): number => {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
};
/** A half-precision bit pattern that is neither NaN nor infinity. */
const finiteHalf = (bits: number): number => ((bits & 0x7c00) === 0x7c00 ? bits & 0xfbff : bits);
const halves = (h: number): [number, number] => [
  finiteHalf(h & 0xffff),
  finiteHalf((h >>> 16) & 0xffff),
];
const HALVES_WGSL =
  'let hh = (h & select(0xffffffffu, 0xfffffbffu, (h & 0x7c00u) == 0x7c00u)) & ' +
  'select(0xffffffffu, 0xfbffffffu, (h & 0x7c000000u) == 0x7c000000u);';

const PROBES: readonly ProbeDef[] = [
  {
    op: 'addmul',
    span: 8,
    columns: [
      fl('sum4', '((a + b) + c) + d', {
        sourceOrder: (x) => f(f(f(x.a + x.b) + x.c) + x.d),
        pairwise: (x) => f(f(x.a + x.b) + f(x.c + x.d)),
        reversed: (x) => f(x.a + f(x.b + f(x.c + x.d))),
      }),
      fl('product4', '((a * b) * c) * d', {
        sourceOrder: (x) => f(f(f(x.a * x.b) * x.c) * x.d),
        pairwise: (x) => f(f(x.a * x.b) * f(x.c * x.d)),
      }),
      fl('sumTimesSum', '(a + b) * (c + d)', {
        sourceOrder: (x) => f(f(x.a + x.b) * f(x.c + x.d)),
      }),
      fl('cancel', '(a + b) - a', {
        sourceOrder: (x) => f(f(x.a + x.b) - x.a),
        simplified: (x) => x.b,
      }),
      fl('scale', '0.1 * a', { sourceOrder: (x) => f(f(0.1) * x.a) }),
      fl('differenceOfSquares', '(a - b) * (a + b)', {
        sourceOrder: (x) => f(f(x.a - x.b) * f(x.a + x.b)),
        expanded: (x) => f(f(x.a * x.a) - f(x.b * x.b)),
      }),
      // The four-term sum again, on the operands of column 2, which computes a + b and c + d:
      // a compiler that reassociates can reuse those two sums.
      fl(
        'sum4SharedPairs',
        '((a + b) + c) + d',
        {
          sourceOrder: (x) => f(f(f(x.a + x.b) + x.c) + x.d),
          pairwise: (x) => f(f(x.a + x.b) + f(x.c + x.d)),
        },
        2,
      ),
    ],
  },
  {
    op: 'div',
    span: 8,
    columns: [
      fl('quotient', 'a / b', {
        correctlyRounded: (x) => f(x.a / x.b),
        timesReciprocal: (x) => f(x.a * f(1 / x.b)),
      }),
      fl('reciprocal', '1.0 / b', { correctlyRounded: (x) => f(1 / x.b) }),
      fl('overSum', 'a / (b + c)', { correctlyRounded: (x) => f(x.a / f(x.b + x.c)) }),
      fl('twice', '(a / b) / c', {
        sourceOrder: (x) => f(f(x.a / x.b) / x.c),
        combined: (x) => f(x.a / f(x.b * x.c)),
      }),
      fl('byConstant', 'a / 3.0', {
        correctlyRounded: (x) => f(x.a / 3),
        timesReciprocal: (x) => f(x.a * f(1 / 3)),
      }),
      fl('mulDiv', '(a * b) / b', {
        sourceOrder: (x) => f(f(x.a * x.b) / x.b),
        simplified: (x) => x.a,
      }),
      fl('ratio', '(a - b) / (a + b)', { sourceOrder: (x) => f(f(x.a - x.b) / f(x.a + x.b)) }),
    ],
  },
  {
    op: 'sqrt',
    span: 8,
    columns: [
      fl('sqrt', 'sqrt(abs(a))', { correctlyRounded: (x) => f(Math.sqrt(Math.abs(x.a))) }),
      fl('inverseSqrt', 'inverseSqrt(abs(a))', {
        correctlyRounded: (x) => f(1 / Math.sqrt(Math.abs(x.a))),
        oneOverSqrt: (x) => f(1 / f(Math.sqrt(Math.abs(x.a)))),
      }),
      fl('hypot', 'sqrt(a * a + b * b)', {
        separate: (x) => f(Math.sqrt(f(f(x.a * x.a) + f(x.b * x.b)))),
        fusedLeft: (x) => f(Math.sqrt(f(x.a * x.a + f(x.b * x.b)))),
        fusedRight: (x) => f(Math.sqrt(f(f(x.a * x.a) + x.b * x.b))),
      }),
      fl('length2', 'length(vec2<f32>(a, b))', {
        separate: (x) => f(Math.sqrt(f(f(x.a * x.a) + f(x.b * x.b)))),
        fusedLeft: (x) => f(Math.sqrt(f(x.a * x.a + f(x.b * x.b)))),
        fusedRight: (x) => f(Math.sqrt(f(f(x.a * x.a) + x.b * x.b))),
        correctlyRounded: (x) => f(Math.hypot(x.a, x.b)),
      }),
      fl('oneOverSqrt', '1.0 / sqrt(abs(a))', {
        sourceOrder: (x) => f(1 / f(Math.sqrt(Math.abs(x.a)))),
        correctlyRounded: (x) => f(1 / Math.sqrt(Math.abs(x.a))),
      }),
      fl('normalizeX', 'normalize(vec2<f32>(a, b)).x', {
        correctlyRounded: (x) => f(x.a / Math.hypot(x.a, x.b)),
      }),
    ],
  },
  {
    op: 'explog',
    span: 3,
    columns: [
      fl('exp', 'exp(a)', { double: (x) => f(Math.exp(x.a)) }),
      fl('exp2', 'exp2(a)', { double: (x) => f(2 ** x.a) }),
      fl('log', 'log(abs(b))', { double: (x) => f(Math.log(Math.abs(x.b))) }),
      fl('log2', 'log2(abs(b))', { double: (x) => f(Math.log2(Math.abs(x.b))) }),
      fl('expNegative', 'exp(-abs(a))', { double: (x) => f(Math.exp(-Math.abs(x.a))) }),
      fl('log1p', 'log(1.0 + abs(c))', { double: (x) => f(Math.log(f(1 + Math.abs(x.c)))) }),
      fl('expTimesExp', 'exp(a) * exp(-a)', {
        double: (x) => f(f(Math.exp(x.a)) * f(Math.exp(-x.a))),
        one: () => 1,
      }),
    ],
  },
  {
    op: 'pow',
    span: 3,
    prelude: 'let p = abs(a); let q = clamp(b, -4.0, 4.0);',
    columns: [
      fl('pow', 'pow(p, q)', {
        double: (x) => f(Math.abs(x.a) ** Math.min(4, Math.max(-4, x.b))),
      }),
      fl('powHalf', 'pow(p, 0.5)', {
        double: (x) => f(Math.abs(x.a) ** 0.5),
        sqrt: (x) => f(Math.sqrt(Math.abs(x.a))),
      }),
      fl('powTwo', 'pow(p, 2.0)', { square: (x) => f(x.a * x.a) }),
      fl('powThreeHalves', 'pow(p, 1.5)', { double: (x) => f(Math.abs(x.a) ** 1.5) }),
      fl('powMinusOne', 'pow(p, -1.0)', { reciprocal: (x) => f(1 / Math.abs(x.a)) }),
      fl('twoToThe', 'pow(2.0, q)', { double: (x) => f(2 ** Math.min(4, Math.max(-4, x.b))) }),
    ],
  },
  {
    op: 'cbrt',
    span: 8,
    columns: [
      fl('powThird', 'pow(abs(a), 1.0 / 3.0)', {
        double: (x) => f(Math.abs(x.a) ** f(1 / 3)),
        cubeRoot: (x) => f(Math.cbrt(Math.abs(x.a))),
      }),
      fl('signedPowThird', 'sign(a) * pow(abs(a), 0.33333334)', {
        double: (x) => f(Math.sign(x.a) * f(Math.abs(x.a) ** f(1 / 3))),
        cubeRoot: (x) => f(Math.cbrt(x.a)),
      }),
      fl('expLogThird', 'exp(log(abs(a)) / 3.0)', {
        double: (x) => f(Math.exp(f(f(Math.log(Math.abs(x.a))) / 3))),
        cubeRoot: (x) => f(Math.cbrt(Math.abs(x.a))),
      }),
    ],
  },
  {
    op: 'trig',
    span: 3,
    columns: [
      fl('sin', 'sin(a)', { double: (x) => f(Math.sin(x.a)) }),
      fl('cos', 'cos(a)', { double: (x) => f(Math.cos(x.a)) }),
      fl('tan', 'tan(a)', { double: (x) => f(Math.tan(x.a)) }),
      fl('sinLarge', 'sin(a * 100.0)', { double: (x) => f(Math.sin(f(x.a * 100))) }),
      fl('tanh', 'tanh(a)', { double: (x) => f(Math.tanh(x.a)) }),
      fl('pythagoras', 'cos(a) * cos(a) + sin(a) * sin(a)', {
        double: (x) => {
          const c = f(Math.cos(x.a));
          const s = f(Math.sin(x.a));
          return f(f(c * c) + f(s * s));
        },
        one: () => 1,
      }),
    ],
  },
  {
    op: 'atan2',
    span: 8,
    prelude: 'let u = clamp(a * 0.00390625, -1.0, 1.0);',
    columns: [
      fl('atan2', 'atan2(a, b)', { double: (x) => f(Math.atan2(x.a, x.b)) }),
      fl('atan', 'atan(a)', { double: (x) => f(Math.atan(x.a)) }),
      fl('acos', 'acos(u)', {
        double: (x) => f(Math.acos(Math.min(1, Math.max(-1, x.a / 256)))),
      }),
      fl('asin', 'asin(u)', {
        double: (x) => f(Math.asin(Math.min(1, Math.max(-1, x.a / 256)))),
      }),
    ],
  },
  {
    op: 'ftoi',
    span: 8,
    columns: [
      int('truncate', 'bitcast<u32>(i32(a))', { specified: (x) => toI32(x.a) }),
      int('unsigned', 'u32(a)', { specified: (x) => toU32(x.a) }),
      int('fixedPoint20', 'bitcast<u32>(i32(a * 1048576.0))', {
        specified: (x) => toI32(f(x.a * 1048576)),
      }),
      int('floor', 'bitcast<u32>(i32(floor(a)))', { specified: (x) => toI32(Math.floor(x.a)) }),
      // floor(a) + 0.5 is exact here, so every operand of round is a tie.
      int('roundTie', 'bitcast<u32>(i32(round(floor(a) + 0.5)))', {
        tiesToEven: (x) => toI32(roundEven(Math.floor(x.a) + 0.5)),
        tiesAway: (x) => {
          const t = Math.floor(x.a) + 0.5;
          return toI32(Math.sign(t) * Math.round(Math.abs(t)));
        },
      }),
      // |a| is at least 2^-8, so a * 1e12 is always outside the range of i32 and of u32.
      int('saturateI32', 'bitcast<u32>(i32(a * 1e12))', {
        clampedToFloat: (x) => toI32(f(x.a * f(1e12))),
        clampedToInteger: (x) => (x.a > 0 ? 0x7fffffff : 0x80000000),
      }),
      int('saturateU32', 'u32(a * 1e12)', {
        clampedToFloat: (x) => toU32(f(x.a * f(1e12))),
        clampedToInteger: (x) => (x.a > 0 ? 0xffffffff : 0),
      }),
      int('fixedPointDecimal', 'bitcast<u32>(i32(a * 1000000.0))', {
        specified: (x) => toI32(f(x.a * 1e6)),
      }),
    ],
  },
  {
    op: 'fma',
    span: 8,
    columns: [
      fl('mulAdd', 'a * b + c', {
        separate: (x) => f(f(x.a * x.b) + x.c),
        fused: (x) => f(x.a * x.b + x.c),
      }),
      fl('mulSubMul', 'a * b - c * d', {
        separate: (x) => f(f(x.a * x.b) - f(x.c * x.d)),
        fusedLeft: (x) => f(x.a * x.b - f(x.c * x.d)),
        fusedRight: (x) => f(f(x.a * x.b) - x.c * x.d),
      }),
      fl('fmaBuiltin', 'fma(a, b, c)', {
        separate: (x) => f(f(x.a * x.b) + x.c),
        fused: (x) => f(x.a * x.b + x.c),
      }),
      fl('sumOfSquares', 'a * a + b * b', {
        separate: (x) => f(f(x.a * x.a) + f(x.b * x.b)),
        fusedLeft: (x) => f(x.a * x.a + f(x.b * x.b)),
        fusedRight: (x) => f(f(x.a * x.a) + x.b * x.b),
      }),
      fl('dot2', 'dot(vec2<f32>(a, b), vec2<f32>(c, d))', {
        separate: (x) => f(f(x.a * x.c) + f(x.b * x.d)),
        fusedLeft: (x) => f(x.a * x.c + f(x.b * x.d)),
        fusedRight: (x) => f(f(x.a * x.c) + x.b * x.d),
      }),
      fl('addMul', 'c + a * b', {
        separate: (x) => f(x.c + f(x.a * x.b)),
        fused: (x) => f(x.c + x.a * x.b),
      }),
      fl('horner', '(a * b + c) * d + a', {
        separate: (x) => f(f(f(f(x.a * x.b) + x.c) * x.d) + x.a),
        fused: (x) => f(f(x.a * x.b + x.c) * x.d + x.a),
      }),
      // The same a * b + c as column 0, on the operands of the next column, which stores
      // their product a * b: the product then has two uses in the kernel.
      fl(
        'mulAddSharedProduct',
        'a * b + c',
        { separate: (x) => f(f(x.a * x.b) + x.c), fused: (x) => f(x.a * x.b + x.c) },
        8,
      ),
      fl('product', 'a * b', { correctlyRounded: (x) => f(x.a * x.b) }),
    ],
  },
  {
    op: 'f16',
    span: 8,
    prelude: HALVES_WGSL,
    columns: [
      int('pack', 'pack2x16float(vec2<f32>(a, b))', {
        nearestEven: (x) => (numberToF16Bits(x.a) | (numberToF16Bits(x.b) << 16)) >>> 0,
      }),
      fl('unpackX', 'unpack2x16float(hh).x', { exact: (x) => f16BitsToNumber(halves(x.h)[0]) }),
      fl('unpackY', 'unpack2x16float(hh).y', { exact: (x) => f16BitsToNumber(halves(x.h)[1]) }),
      int('unpackPack', 'pack2x16float(unpack2x16float(hh))', {
        identity: (x) => (halves(x.h)[0] | (halves(x.h)[1] << 16)) >>> 0,
      }),
      fl('quantize', 'quantizeToF16(a)', {
        nearestEven: (x) => f16BitsToNumber(numberToF16Bits(x.a)),
      }),
    ],
  },
  {
    op: 'bitcast',
    span: 8,
    columns: [
      int('roundTrip', 'bitcast<u32>(bitcast<f32>(h))', { identity: (x) => x.h }),
      int('negate', 'bitcast<u32>(-a)', { signFlip: (x) => (bitsOf(x.a) ^ 0x80000000) >>> 0 }),
      int('abs', 'bitcast<u32>(abs(a))', { signClear: (x) => bitsOf(x.a) & 0x7fffffff }),
      fl('min', 'min(a, b)', { exact: (x) => Math.min(x.a, x.b) }),
      fl('max', 'max(a, b)', { exact: (x) => Math.max(x.a, x.b) }),
      fl('select', 'select(a, b, a < b)', { exact: (x) => (x.a < x.b ? x.b : x.a) }),
      fl('fromU32', 'f32(h)', { nearestEven: (x) => f(x.h) }),
      fl('fromI32', 'f32(bitcast<i32>(h))', { nearestEven: (x) => f(x.h | 0) }),
    ],
  },
];

/** The WGSL of a probe of float or conversion expressions. */
function probeWgsl(def: ProbeDef): string {
  const op = OP_CLASSES.indexOf(def.op);
  if (def.columns.length > PROBE_WORDS) {
    throw new Error(`probe ${def.op} has more than ${PROBE_WORDS} expressions`);
  }
  const blocks = def.columns
    .map((column, j) => {
      const set = column.operandsOf ?? j;
      const value = column.float ? `bitcast<u32>(${column.wgsl})` : column.wgsl;
      return `  {
    let a = pin(i, ${4 * set}u);
    let b = pin(i, ${4 * set + 1}u);
    let c = pin(i, ${4 * set + 2}u);
    let d = pin(i, ${4 * set + 3}u);
    let h = rng_hash3(${PROBE_SEED}u, ${op}u, i, ${1000 + set}u);
    ${def.prelude ?? ''}
    out[i * ${PROBE_WORDS}u + ${j}u] = ${value};
  }`;
    })
    .join('\n');
  return /* wgsl */ `
#include "${WGSL_RNG}"
@group(0) @binding(0) var<storage, read_write> out: array<u32>;
fn pin(i: u32, k: u32) -> f32 {
  let h = rng_hash3(${PROBE_SEED}u, ${op}u, i, 2u * k);
  let m = rng_hash3(${PROBE_SEED}u, ${op}u, i, 2u * k + 1u);
  let e = ${127 - def.span}u + h % ${2 * def.span + 1}u;
  return bitcast<f32>((m & 0x80000000u) | (e << 23u) | (m & 0x007fffffu));
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= ${PROBE_COUNT}u) { return; }
${blocks}
}`;
}

/**
 * The atomics probe: every invocation adds to an unsigned bin, adds a signed value to a second
 * bin and raises a third with `atomicMax`, targets and values from hashes; about 64 writers
 * per bin. The bins are the result, and they have one right answer whatever the scheduling.
 */
const ATOMICS_WGSL = /* wgsl */ `
#include "${WGSL_RNG}"
@group(0) @binding(0) var<storage, read_write> bins: array<atomic<u32>>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= ${PROBE_COUNT}u) { return; }
  let op = ${OP_CLASSES.indexOf('atomics')}u;
  let t = rng_hash3(${PROBE_SEED}u, op, i, 0u);
  let v = rng_hash3(${PROBE_SEED}u, op, i, 1u);
  atomicAdd(&bins[t % ${ATOMIC_BINS}u], v & 0xffffu);
  atomicAdd(&bins[${ATOMIC_BINS}u + (t >> 8u) % ${ATOMIC_BINS}u], (v >> 16u) - 32768u);
  atomicMax(&bins[${2 * ATOMIC_BINS}u + (t >> 16u) % ${ATOMIC_BINS}u], v);
}`;

/** What the atomics probe must produce, computed on the CPU. */
function atomicsExpected(): Uint32Array {
  const op = OP_CLASSES.indexOf('atomics');
  const bins = new Uint32Array(3 * ATOMIC_BINS);
  for (let i = 0; i < PROBE_COUNT; i++) {
    const t = hashU32(PROBE_SEED, op, i, 0);
    const v = hashU32(PROBE_SEED, op, i, 1);
    const add = t % ATOMIC_BINS;
    bins[add] = (bins[add] as number) + (v & 0xffff);
    const signed = ATOMIC_BINS + ((t >>> 8) % ATOMIC_BINS);
    bins[signed] = (bins[signed] as number) + (v >>> 16) - 32768;
    const max = 2 * ATOMIC_BINS + ((t >>> 16) % ATOMIC_BINS);
    bins[max] = Math.max(bins[max] as number, v);
  }
  return bins;
}

/** How one expression compares with one reading of it. */
export interface ProbeAgreement {
  /** Invocations (or bins) whose bits equal the reading's. */
  readonly matches: number;
  /**
   * For float expressions: the largest distance from the reading in units in the last place,
   * over the invocations where both are finite; null for integer expressions.
   */
  readonly maxUlp: number | null;
}

/** The result of one probe on one stack. */
export interface ProbeResult {
  /** SHA-256 (hex) of the output words, little-endian. */
  readonly hash: string;
  /** SHA-256 (hex) of the probe's WGSL: a change of the probe itself, not of the stack. */
  readonly source: string;
  /** Number of invocations (or bins) compared: the denominator of `matches`. */
  readonly count: number;
  /** Agreement by expression, then by reading. */
  readonly expressions: Readonly<Record<string, Readonly<Record<string, ProbeAgreement>>>>;
}

/** The probe results of one GPU stack: the content of `probes/<stack>.json`. */
export interface ProbeRecord {
  /** Format version, {@link PROBE_RECORD_VERSION}. */
  readonly version: number;
  /** The GPU stack the probes ran on. */
  readonly stack: GpuStack;
  /** One result per operation class. */
  readonly probes: Readonly<Record<OpClass, ProbeResult>>;
}

/** Distance in units in the last place between two finite single-precision bit patterns. */
function ulpDistance(x: number, y: number): number {
  const ordered = (bits: number): number =>
    bits & 0x80000000 ? -(bits & 0x7fffffff) : bits & 0x7fffffff;
  return Math.abs(ordered(x) - ordered(y));
}

const isNanBits = (bits: number): boolean =>
  (bits & 0x7f800000) === 0x7f800000 && (bits & 0x007fffff) !== 0;
const isFiniteBits = (bits: number): boolean => (bits & 0x7f800000) !== 0x7f800000;

function analyse(def: ProbeDef, words: Uint32Array): ProbeResult['expressions'] {
  const op = OP_CLASSES.indexOf(def.op);
  const tallies = def.columns.map((column) =>
    Object.keys(column.refs).map(() => ({ matches: 0, maxUlp: 0 })),
  );
  for (let i = 0; i < PROBE_COUNT; i++) {
    def.columns.forEach((column, j) => {
      const set = column.operandsOf ?? j;
      const x: ProbeOperands = {
        a: probeOperand(op, i, 4 * set, def.span),
        b: probeOperand(op, i, 4 * set + 1, def.span),
        c: probeOperand(op, i, 4 * set + 2, def.span),
        d: probeOperand(op, i, 4 * set + 3, def.span),
        h: hashU32(PROBE_SEED, op, i, 1000 + set),
      };
      const got = words[i * PROBE_WORDS + j] as number;
      Object.values(column.refs).forEach((ref, r) => {
        const tally = (tallies[j] as { matches: number; maxUlp: number }[])[r] as {
          matches: number;
          maxUlp: number;
        };
        const value = ref(x);
        if (!column.float) {
          if (got === value >>> 0) tally.matches++;
          return;
        }
        const want = bitsOf(value);
        if (got === want || (isNanBits(got) && isNanBits(want))) {
          tally.matches++;
        } else if (isFiniteBits(got) && isFiniteBits(want)) {
          tally.maxUlp = Math.max(tally.maxUlp, ulpDistance(got, want));
        }
      });
    });
  }
  const expressions: Record<string, Record<string, ProbeAgreement>> = {};
  def.columns.forEach((column, j) => {
    const byReading: Record<string, ProbeAgreement> = {};
    Object.keys(column.refs).forEach((reading, r) => {
      const tally = (tallies[j] as { matches: number; maxUlp: number }[])[r] as {
        matches: number;
        maxUlp: number;
      };
      byReading[reading] = { matches: tally.matches, maxUlp: column.float ? tally.maxUlp : null };
    });
    expressions[column.name] = byReading;
  });
  return expressions;
}

/** The operation classes that have a probe: all of them. */
export const PROBED_OP_CLASSES: readonly OpClass[] = [...PROBES.map((p) => p.op), 'atomics'];

/**
 * The assembled WGSL of the probe of one class, for a reader who wants to see what was run.
 * `assemble` is `GpuContext.wgsl.assemble`.
 */
export function probeSource(op: OpClass, assemble: (source: string) => string): string {
  if (op === 'atomics') return assemble(ATOMICS_WGSL);
  const def = PROBES.find((p) => p.op === op);
  if (def === undefined) throw new Error(`no probe for operation class ${op}`);
  return assemble(probeWgsl(def));
}

/** Runs the probe of one operation class and compares it with its references. */
export async function runProbe(ctx: GpuContext, op: OpClass): Promise<ProbeResult> {
  const wgsl = probeSource(op, (s) => ctx.wgsl.assemble(s));
  const atomics = op === 'atomics';
  const kernel = await ctx.kernel({
    name: `sim-gpu.probe.${op}`,
    wgsl,
    entry: 'main',
    bindings: [{ group: 0, binding: 0, name: 'out', kind: 'storage' }],
    // Beside its own class a probe relies on whatever its source needs to produce and store
    // the result words (`bitcast` in every float probe); those are declared from the source.
    uses: [...new Set<OpClass>([op, ...opClassesInWgsl(wgsl, 'main')])],
    reads: [],
    writes: atomics ? [] : ['out'],
    atomics: atomics ? ['out'] : [],
  });
  const out = ctx.buffer({
    name: `sim-gpu.probe.${op}.out`,
    owner: 'sim-gpu',
    stage: 'run',
    bytes: 4 * (atomics ? 3 * ATOMIC_BINS : PROBE_COUNT * PROBE_WORDS),
    usage: BUFFER_USAGE.STORAGE,
    fields: [{ name: 'word', type: 'u32', role: 'statistic', unit: '-' }],
  });
  try {
    ctx.submit([
      {
        op: 'dispatch',
        kernel,
        bindings: { out },
        workgroups: [PROBE_COUNT / 64, 1, 1],
        plannedTime: 0,
      },
    ]);
    const bytes = new Uint8Array(await ctx.read(out));
    const words = new Uint32Array(bytes.buffer);
    const hash = sha256Hex(bytes);
    const source = sha256Hex(wgsl);
    if (atomics) {
      const expected = atomicsExpected();
      let matches = 0;
      for (let i = 0; i < expected.length; i++) if (words[i] === expected[i]) matches++;
      return {
        hash,
        source,
        count: expected.length,
        expressions: { bins: { exact: { matches, maxUlp: null } } },
      };
    }
    const def = PROBES.find((p) => p.op === op) as ProbeDef;
    return { hash, source, count: PROBE_COUNT, expressions: analyse(def, words) };
  } finally {
    ctx.release(out);
  }
}

/** Runs every probe, in the order of {@link OP_CLASSES}, on the stack of the context. */
export async function runProbes(ctx: GpuContext): Promise<ProbeRecord> {
  const probes = {} as Record<OpClass, ProbeResult>;
  for (const op of OP_CLASSES) probes[op] = await runProbe(ctx, op);
  return { version: PROBE_RECORD_VERSION, stack: gpuStackOf(ctx.stack), probes };
}

/** What the probes say about the shader compiler of a stack, in a form a report can print. */
export interface CompilerBehaviour {
  /**
   * How `a * b + c` is evaluated when the product has no other use: `fused` (one rounding),
   * `separate` (two), or `mixed` if neither reading explains every result.
   */
  readonly multiplyAdd: 'fused' | 'separate' | 'mixed';
  /** The same when the product `a * b` is also used elsewhere in the kernel. */
  readonly multiplyAddOfSharedProduct: 'fused' | 'separate' | 'mixed';
  /** True if `fma(a, b, c)` is a true fused multiply-add. */
  readonly fmaBuiltinIsFused: boolean;
  /**
   * True if some sum, product or quotient was not evaluated in source order: reassociated to
   * reuse a subexpression, or simplified algebraically.
   */
  readonly reassociates: boolean;
  /** True if `a / constant` is computed as `a * (1 / constant)`. */
  readonly divisionByConstantIsMultiplication: boolean;
  /** True if every division is the correctly rounded quotient. */
  readonly divisionCorrectlyRounded: boolean;
  /** True if `sqrt` is correctly rounded. */
  readonly sqrtCorrectlyRounded: boolean;
  /**
   * True if float-to-integer conversion truncates toward zero and clamps an out-of-range
   * operand to the largest single-precision value inside the integer range.
   */
  readonly conversionAsSpecified: boolean;
  /** True if the integer atomics gave the one right answer. */
  readonly atomicsExact: boolean;
  /** Largest distance of division and sqrt results from correct rounding, ulp. */
  readonly divideSqrtMaxUlp: number;
  /** Largest distance of exp, log, pow and trigonometric results from double precision, ulp. */
  readonly transcendentalMaxUlp: number;
  /** One sentence per finding. */
  readonly sentences: readonly string[];
}

/** Reads a {@link ProbeRecord} for the questions a kernel author asks of a stack. */
export function compilerBehaviour(record: ProbeRecord): CompilerBehaviour {
  const p = record.probes;
  const cell = (op: OpClass, expression: string, reading: string): ProbeAgreement => {
    const found = p[op].expressions[expression]?.[reading];
    if (found === undefined) throw new Error(`probe record has no ${op}.${expression}.${reading}`);
    return found;
  };
  const all = (op: OpClass, expression: string, reading: string): boolean =>
    cell(op, expression, reading).matches === p[op].count;
  const share = (op: OpClass, expression: string, reading: string): string =>
    `${((cell(op, expression, reading).matches / p[op].count) * 100).toFixed(1)} %`;
  const fusion = (expression: string): 'fused' | 'separate' | 'mixed' =>
    all('fma', expression, 'fused')
      ? 'fused'
      : all('fma', expression, 'separate')
        ? 'separate'
        : 'mixed';

  const multiplyAdd = fusion('mulAdd');
  const multiplyAddOfSharedProduct = fusion('mulAddSharedProduct');
  const fmaBuiltinIsFused = all('fma', 'fmaBuiltin', 'fused');
  const inSourceOrder: [OpClass, string][] = [
    ['addmul', 'sum4'],
    ['addmul', 'product4'],
    ['addmul', 'cancel'],
    ['addmul', 'differenceOfSquares'],
    ['addmul', 'sum4SharedPairs'],
    ['div', 'mulDiv'],
    ['div', 'twice'],
  ];
  const moved = inSourceOrder.filter(([op, e]) => !all(op, e, 'sourceOrder'));
  // Division is not exact on every stack, so the two quotient expressions cannot show
  // reordering by themselves; they count only where division is correctly rounded.
  const divisionCorrectlyRounded =
    all('div', 'quotient', 'correctlyRounded') && all('div', 'reciprocal', 'correctlyRounded');
  const reordered = moved.filter(([op]) => op !== 'div' || divisionCorrectlyRounded);
  const reassociates = reordered.length > 0;
  const divisionByConstantIsMultiplication =
    all('div', 'byConstant', 'timesReciprocal') && !all('div', 'byConstant', 'correctlyRounded');
  const sqrtCorrectlyRounded = all('sqrt', 'sqrt', 'correctlyRounded');
  const conversionAsSpecified =
    all('ftoi', 'truncate', 'specified') &&
    all('ftoi', 'unsigned', 'specified') &&
    all('ftoi', 'fixedPoint20', 'specified') &&
    all('ftoi', 'floor', 'specified') &&
    all('ftoi', 'roundTie', 'tiesToEven') &&
    all('ftoi', 'saturateI32', 'clampedToFloat') &&
    all('ftoi', 'saturateU32', 'clampedToFloat');
  const atomicsExact = all('atomics', 'bins', 'exact');
  const divideSqrtMaxUlp = Math.max(
    cell('div', 'quotient', 'correctlyRounded').maxUlp ?? 0,
    cell('div', 'reciprocal', 'correctlyRounded').maxUlp ?? 0,
    cell('div', 'overSum', 'correctlyRounded').maxUlp ?? 0,
    cell('sqrt', 'sqrt', 'correctlyRounded').maxUlp ?? 0,
    cell('sqrt', 'inverseSqrt', 'correctlyRounded').maxUlp ?? 0,
  );
  let transcendentalMaxUlp = 0;
  for (const op of ['explog', 'pow', 'cbrt', 'trig', 'atan2'] as const) {
    for (const readings of Object.values(p[op].expressions)) {
      transcendentalMaxUlp = Math.max(transcendentalMaxUlp, readings['double']?.maxUlp ?? 0);
    }
  }
  const fusionText = (kind: 'fused' | 'separate' | 'mixed', expression: string): string =>
    kind === 'fused'
      ? 'fused into one multiply-add (one rounding) in every case'
      : kind === 'separate'
        ? 'a rounded product and a rounded sum in every case (not fused)'
        : `fused in ${share('fma', expression, 'fused')} and separate in ` +
          `${share('fma', expression, 'separate')} of cases`;
  const sentences = [
    `a * b + c, the product used once: ${fusionText(multiplyAdd, 'mulAdd')}.`,
    `a * b + c, the product also used elsewhere in the kernel: ` +
      `${fusionText(multiplyAddOfSharedProduct, 'mulAddSharedProduct')}.`,
    `a * b - c * d matches fma(a, b, -(c * d)) in ${share('fma', 'mulSubMul', 'fusedLeft')}, ` +
      `fma(-c, d, a * b) in ${share('fma', 'mulSubMul', 'fusedRight')} and two rounded products ` +
      `in ${share('fma', 'mulSubMul', 'separate')}; dot(vec2, vec2) fuses its first product in ` +
      `${share('fma', 'dot2', 'fusedLeft')}, its second in ${share('fma', 'dot2', 'fusedRight')}, ` +
      `neither in ${share('fma', 'dot2', 'separate')}; Horner (a * b + c) * d + a is fused twice ` +
      `in ${share('fma', 'horner', 'fused')}.`,
    `fma(a, b, c) is ${fmaBuiltinIsFused ? '' : 'not '}a true fused multiply-add.`,
    reassociates
      ? `Expressions are not always evaluated as written: ` +
        reordered
          .map(([op, e]) => `${e} follows source order in only ${share(op, e, 'sourceOrder')}`)
          .join('; ') +
        ` ((a + b) - a equals b in ${share('addmul', 'cancel', 'simplified')}; the four-term sum ` +
        `beside (a + b) * (c + d) is (a + b) + (c + d) in ` +
        `${share('addmul', 'sum4SharedPairs', 'pairwise')}).`
      : 'Sums and products are evaluated in source order; nothing is reassociated or simplified.',
    divisionCorrectlyRounded
      ? 'Division is the correctly rounded quotient.'
      : `Division is not correctly rounded: a / b is exact in ${share('div', 'quotient', 'correctlyRounded')} ` +
        `and 1 / b in ${share('div', 'reciprocal', 'correctlyRounded')} of cases.`,
    divisionByConstantIsMultiplication
      ? 'Division by a constant is multiplication by its rounded reciprocal.'
      : `Division by a constant is a division (a / 3 correctly rounded in ` +
        `${share('div', 'byConstant', 'correctlyRounded')}).`,
    sqrtCorrectlyRounded
      ? 'sqrt is correctly rounded.'
      : `sqrt is not correctly rounded (exact in ${share('sqrt', 'sqrt', 'correctlyRounded')}).`,
    `Division and sqrt are within ${divideSqrtMaxUlp} units in the last place of correct rounding.`,
    conversionAsSpecified
      ? 'Float-to-integer conversion truncates toward zero, round() takes ties to even, and an ' +
        'out-of-range operand is clamped to the largest float inside the integer range ' +
        '(0x7fffff80 for i32, 0xffffff00 for u32).'
      : 'Float-to-integer conversion does not follow truncate-and-clamp in every case.',
    `exp, log, pow and the trigonometric functions are within ${transcendentalMaxUlp} units in ` +
      `the last place of double precision on the probe inputs.`,
    atomicsExact
      ? 'Integer atomicAdd and atomicMax with about 64 writers per target give the exact result.'
      : 'Integer atomics did NOT give the exact result.',
  ];
  return {
    multiplyAdd,
    multiplyAddOfSharedProduct,
    fmaBuiltinIsFused,
    reassociates,
    divisionByConstantIsMultiplication,
    divisionCorrectlyRounded,
    sqrtCorrectlyRounded,
    conversionAsSpecified,
    atomicsExact,
    divideSqrtMaxUlp,
    transcendentalMaxUlp,
    sentences,
  };
}

/** The classes whose recorded hash differs from the current one, or whose probe was changed. */
export function compareProbeRecords(
  recorded: ProbeRecord,
  current: ProbeRecord,
): { readonly changed: OpClass[]; readonly probeEdited: OpClass[] } {
  const changed: OpClass[] = [];
  const probeEdited: OpClass[] = [];
  for (const op of OP_CLASSES) {
    const before = recorded.probes[op];
    const now = current.probes[op];
    if (before === undefined || before.source !== now.source) probeEdited.push(op);
    else if (before.hash !== now.hash) changed.push(op);
  }
  return { changed, probeEdited };
}
