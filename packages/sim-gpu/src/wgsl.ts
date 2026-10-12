/**
 * WGSL assembly (docs/design/sim-core.md section M1; determinism rule 8 of section 6): shared
 * shader source is registered once under a name and pulled into a kernel with a line
 *
 *     #include "name"
 *
 * so that no module pastes the random number generator, a record struct or a parameter block
 * by hand. `#include` is not WGSL, so a kernel that was not assembled fails to compile instead
 * of silently missing its shared source. A module is emitted once, at its first use, however
 * often it is named; modules may include other modules.
 *
 * Also here: {@link uniformBlock}, which turns a list of scalar parameters into the WGSL
 * struct of a uniform block and the function that packs its bytes, so that the registry of
 * module M2 can hand parameters to kernels without a hand-written struct on either side.
 *
 * Nothing here touches the GPU or Node.
 */

import { RNG_WGSL } from '@spotless/core';
import type { OpClass } from './types.ts';

/** Name of the include that carries the counter-based random generator of `@spotless/core`. */
export const WGSL_RNG = 'rng';

/** Name of the include with the 64-bit helpers on `vec2<u32>` (low word, high word). */
export const WGSL_I64 = 'sim-gpu/i64';

/** Name of the include with the bit-pattern test for NaN and infinity. */
export const WGSL_NONFINITE = 'sim-gpu/nonfinite';

/**
 * 64-bit integers as `vec2<u32>` (x low word, y high word) with explicit carry (section M1,
 * "Integer block reduction"). `i64_from_i32` sign-extends.
 */
const I64_WGSL = /* wgsl */ `
fn i64_add(a: vec2<u32>, b: vec2<u32>) -> vec2<u32> {
  let lo = a.x + b.x;
  let carry = select(0u, 1u, lo < a.x);
  return vec2<u32>(lo, a.y + b.y + carry);
}
fn i64_from_u32(v: u32) -> vec2<u32> {
  return vec2<u32>(v, 0u);
}
fn i64_from_i32(v: i32) -> vec2<u32> {
  let bits = bitcast<u32>(v);
  return vec2<u32>(bits, select(0u, 0xffffffffu, (bits & 0x80000000u) != 0u));
}
`;

/**
 * The non-finite test of section M1: a float is examined as its bit pattern, because a test
 * written with float comparisons may be compiled away (WGSL lets an implementation assume that
 * NaN and infinity do not occur).
 */
const NONFINITE_WGSL = /* wgsl */ `
fn nonfinite_bits(bits: u32) -> bool {
  return (bits & 0x7f800000u) == 0x7f800000u;
}
fn nonfinite_f32(v: f32) -> bool {
  return nonfinite_bits(bitcast<u32>(v));
}
`;

/** A set of named WGSL modules and the assembly step that resolves `#include "name"` lines. */
export interface WgslLibrary {
  /**
   * Registers a module. The source may itself contain `#include` lines. Registering a name
   * again with identical source is allowed; with different source it throws.
   */
  define(name: string, source: string): void;
  /** True if a module of that name is registered. */
  has(name: string): boolean;
  /** The registered names, sorted. */
  names(): string[];
  /**
   * Returns `source` with every `#include "name"` line replaced by the named module (and,
   * first, by the modules that module includes), each module once. Throws on an unknown name
   * or a cycle.
   */
  assemble(source: string): string;
}

const INCLUDE_LINE = /^[ \t]*#include[ \t]+"([^"\n]+)"[ \t]*$/gm;

/**
 * Creates a library that already holds {@link WGSL_RNG} (the generator of `@spotless/core`,
 * rule 8), {@link WGSL_I64} and {@link WGSL_NONFINITE}.
 */
export function createWgslLibrary(): WgslLibrary {
  const modules = new Map<string, string>();

  const define = (name: string, source: string): void => {
    if (!/^[A-Za-z0-9_./-]+$/.test(name)) {
      throw new Error(`WGSL module name "${name}" has characters other than A-Z a-z 0-9 _ . / -`);
    }
    const existing = modules.get(name);
    if (existing !== undefined && existing !== source) {
      throw new Error(`WGSL module "${name}" is already defined with different source`);
    }
    modules.set(name, source);
  };

  const expand = (source: string, done: Set<string>, stack: string[]): string =>
    source.replace(INCLUDE_LINE, (_line, name: string) => {
      if (stack.includes(name)) {
        throw new Error(`WGSL include cycle: ${[...stack, name].join(' -> ')}`);
      }
      if (done.has(name)) return `// (include "${name}" already emitted)`;
      const body = modules.get(name);
      if (body === undefined) {
        throw new Error(
          `unknown WGSL include "${name}"; defined: ${[...modules.keys()].sort().join(', ')}`,
        );
      }
      // Dependencies first, then the module itself; marked done only after its own includes
      // have been expanded, so that a cycle is reported and not swallowed.
      const expanded = expand(body, done, [...stack, name]);
      done.add(name);
      return `// ---- include "${name}"\n${expanded.trim()}\n// ---- end "${name}"`;
    });

  define(WGSL_RNG, RNG_WGSL);
  define(WGSL_I64, I64_WGSL);
  define(WGSL_NONFINITE, NONFINITE_WGSL);

  return {
    define,
    has: (name) => modules.has(name),
    names: () => [...modules.keys()].sort(),
    assemble: (source) => expand(source, new Set<string>(), []),
  };
}

/** Scalar type of one member of a uniform parameter block. */
export type WgslUniformScalar = 'f32' | 'u32' | 'i32';

/** One member of a uniform parameter block. */
export interface WgslUniformField {
  /** WGSL member name. */
  readonly name: string;
  /** Scalar type; one 32-bit word. */
  readonly type: WgslUniformScalar;
}

/**
 * A uniform parameter block: the WGSL struct and the packing of its bytes, from one list of
 * members. Members are scalars, one 32-bit word each in declaration order, so the layout has
 * no padding and no alignment rule to get wrong.
 */
export interface WgslUniformBlock {
  /** Name of the WGSL struct. */
  readonly name: string;
  /** The members, in order. */
  readonly fields: readonly WgslUniformField[];
  /** The WGSL struct declaration (no binding: the kernel declares `var<uniform> P: Name;`). */
  readonly wgsl: string;
  /** Size of the block, bytes: four per member. */
  readonly byteSize: number;
  /**
   * Packs one value per member, little-endian. Throws if a member is missing, if a value is
   * given for a name that is not a member, if an integer member is given a value that is not
   * an integer of its range, or if a float member is given a value that is not finite as an
   * f32 (NaN, an infinity, or a magnitude that rounds beyond the largest f32, 3.4e38).
   */
  pack(values: Readonly<Record<string, number>>): ArrayBuffer;
}

/**
 * Builds a {@link WgslUniformBlock}. `f32` members store the nearest single-precision value of the
 * number given (SI units; the registry of M2 quantises before it packs, rule 14).
 */
export function uniformBlock(name: string, fields: readonly WgslUniformField[]): WgslUniformBlock {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`uniform block name "${name}" is not a WGSL identifier`);
  }
  if (fields.length === 0) throw new Error(`uniform block ${name} has no members`);
  const seen = new Set<string>();
  for (const field of fields) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.name)) {
      throw new Error(`uniform block ${name}: member "${field.name}" is not a WGSL identifier`);
    }
    if (seen.has(field.name)) {
      throw new Error(`uniform block ${name}: member ${field.name} is declared twice`);
    }
    seen.add(field.name);
  }
  const wgsl = `struct ${name} {\n${fields.map((f) => `  ${f.name}: ${f.type},`).join('\n')}\n}\n`;
  const byteSize = 4 * fields.length;

  const pack = (values: Readonly<Record<string, number>>): ArrayBuffer => {
    for (const key of Object.keys(values)) {
      if (!seen.has(key)) throw new Error(`uniform block ${name} has no member ${key}`);
    }
    const bytes = new ArrayBuffer(byteSize);
    const view = new DataView(bytes);
    fields.forEach((field, index) => {
      const value = values[field.name];
      if (value === undefined) {
        throw new Error(`uniform block ${name}: no value for member ${field.name}`);
      }
      if (field.type === 'f32') {
        // Tested after rounding to single precision: a finite double above the largest f32
        // would otherwise be stored as infinity (rule 12: failure, not truncation).
        if (!Number.isFinite(Math.fround(value))) {
          throw new RangeError(
            `uniform block ${name}: ${field.name} = ${value} is not a finite f32`,
          );
        }
        view.setFloat32(4 * index, value, true);
      } else {
        const [lo, hi] = field.type === 'u32' ? [0, 2 ** 32 - 1] : [-(2 ** 31), 2 ** 31 - 1];
        if (!Number.isInteger(value) || value < lo || value > hi) {
          throw new RangeError(
            `uniform block ${name}: ${field.name} = ${value} is not a ${field.type}`,
          );
        }
        if (field.type === 'u32') view.setUint32(4 * index, value, true);
        else view.setInt32(4 * index, value, true);
      }
    });
    return bytes;
  };

  return { name, fields, wgsl, byteSize, pack };
}

/** WGSL source without its comments (line comments and block comments, which may nest). */
function stripWgslComments(source: string): string {
  let out = '';
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const two = source.slice(i, i + 2);
    if (two === '/*') {
      depth++;
      i++;
    } else if (depth > 0 && two === '*/') {
      depth--;
      i++;
    } else if (depth === 0 && two === '//') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
    } else if (depth === 0) {
      out += source[i];
    }
  }
  return out;
}

/** The built-in calls that mark each operation class that can be recognised from the source. */
const OP_CLASS_TOKENS: readonly (readonly [OpClass, RegExp])[] = [
  ['sqrt', /\b(?:sqrt|inverseSqrt|length|distance|normalize)\s*\(/],
  ['explog', /\b(?:exp|exp2|log|log2|sinh|cosh|tanh|asinh|acosh|atanh)\s*\(/],
  ['pow', /\bpow\s*\(/],
  ['trig', /\b(?:sin|cos|tan|asin|acos|atan)\s*\(/],
  ['atan2', /\batan2\s*\(/],
  ['fma', /\bfma\s*\(/],
  ['atomics', /\batomic[A-Za-z]*\s*[(<]/],
  ['f16', /\b(?:pack2x16float|unpack2x16float|quantizeToF16)\s*\(/],
  ['bitcast', /\bbitcast\s*</],
];

/** The text of a source with comments removed, split into function bodies and the rest. */
interface WgslFunctions {
  /** Body text (signature included) of every function, by name. */
  readonly bodies: Map<string, string>;
  /** Everything outside the functions: declarations of structs, bindings and constants. */
  readonly globals: string;
}

function splitWgslFunctions(code: string): WgslFunctions {
  const bodies = new Map<string, string>();
  let globals = '';
  let at = 0;
  const header = /\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  for (let match = header.exec(code); match !== null; match = header.exec(code)) {
    const open = code.indexOf('{', match.index);
    if (open < 0) break;
    let depth = 0;
    let end = open;
    for (; end < code.length; end++) {
      if (code[end] === '{') depth++;
      else if (code[end] === '}' && --depth === 0) break;
    }
    globals += code.slice(at, match.index);
    bodies.set(match[1] as string, code.slice(match.index, end + 1));
    at = end + 1;
    header.lastIndex = at;
  }
  globals += code.slice(at);
  return { bodies, globals };
}

/**
 * The part of a WGSL source that the entry point `entry` can execute: the text outside
 * functions and the bodies of the functions reachable from `entry` through calls. The whole
 * source (comments removed) if there is no function of that name.
 */
function reachableWgsl(source: string, entry: string | undefined): string {
  const code = stripWgslComments(source);
  if (entry === undefined) return code;
  const { bodies, globals } = splitWgslFunctions(code);
  if (!bodies.has(entry)) return code;
  const reached = new Set<string>([entry]);
  const queue = [entry];
  let text = globals;
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    const body = bodies.get(name) as string;
    text += `\n${body}`;
    for (const call of body.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      const callee = call[1] as string;
      if (bodies.has(callee) && !reached.has(callee)) {
        reached.add(callee);
        queue.push(callee);
      }
    }
  }
  return text;
}

/**
 * The operation classes ({@link OpClass}; determinism rule 9) that a WGSL source calls, as far
 * as they can be recognised from its tokens, in the order of the contract: `sqrt` (also
 * `inverseSqrt`, `length`, `distance`, `normalize`), `explog` (`exp`, `exp2`, `log`, `log2` and
 * the hyperbolic functions, which are built from them), `pow`, `trig`, `atan2`, `fma`,
 * `atomics`, `f16` (`pack2x16float`, `unpack2x16float`, `quantizeToF16`) and `bitcast`.
 * `GpuContext.kernel` rejects a kernel that uses one of these without declaring it.
 *
 * With `entry`, only the functions reachable from that entry point through calls are scanned
 * (and the text outside functions), so a helper that an included module defines but the kernel
 * never calls does not count. Comments are ignored. Not recognisable, and so left to the
 * author: `addmul`, `div` (the token `/` is also integer division), `ftoi` (a conversion looks
 * like any constructor) and `cbrt` (WGSL has no cube root; it is written with `pow` or an
 * iteration).
 */
export function opClassesInWgsl(source: string, entry?: string): OpClass[] {
  const code = reachableWgsl(source, entry);
  return OP_CLASS_TOKENS.filter(([, token]) => token.test(code)).map(([name]) => name);
}

/**
 * True if the code reachable from `entry` (the whole source without it) has an atomic type or
 * calls an atomic built-in; comments are ignored.
 */
export function wgslUsesAtomics(source: string, entry?: string): boolean {
  return /\batomic[A-Za-z]*\s*[(<]/.test(reachableWgsl(source, entry));
}
