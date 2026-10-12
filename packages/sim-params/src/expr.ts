/**
 * Two-back-end closure functions (docs/design/sim-core.md section M2, "Shared closure
 * functions"): a formula is written once as an expression tree and serves both an f64 TypeScript
 * evaluator (the CPU reference and every CPU caller) and a WGSL emitter (the kernel), so that
 * the modules that share a closure cannot drift apart.
 *
 * An expression is built from function inputs, earlier locals, registry parameters and a small
 * set of operations. A numeric literal must pass the literal lint of section 0
 * (`isAllowedLiteralValue`): a physical constant can enter an expression only as a registry
 * parameter, which the emitted WGSL reads from a uniform block. Every value is a scalar: f64 on
 * the CPU, f32 in WGSL. Units and frames are those of the function that is defined; the facility
 * itself has none.
 *
 * Domain rules that keep the two back ends equal: the base of `pow` is non-negative and is
 * positive when the exponent is not; `atan2` is not taken of (0, 0); `sqrt` and `log` take
 * non-negative and positive arguments; both branches of `select` are always evaluated and must
 * be finite. Outside these domains WGSL leaves the result to the device (measured on Metal:
 * NaN, or infinity for 0 to a negative power), and the f64 evaluator returns the same instead
 * of the finite value of `Math.pow` or `Math.atan2`, so that a CPU reference cannot pass where
 * the kernel fails. `tanh` is evaluated on its argument limited to +-{@link TANH_ARGUMENT_LIMIT} on both
 * back ends, because Metal's `tanh` returns 0 or NaN from an argument of about 44 upward
 * (measured; its value is exactly 1 in f32 long before the limit).
 *
 * Overflow is not made equal: a value beyond the f32 range (3.4e38) is infinite in the kernel
 * and finite in the f64 evaluator. A definition whose constant subexpressions leave that range
 * is rejected; one that leaves it for some input is the author's to avoid.
 */
import { isAllowedLiteralValue } from './literal-lint.ts';
import type { ParamSet } from './param-set.ts';
import { compareKeys } from './registry.ts';

/** Functions of one argument. `log` is the natural logarithm. */
export type UnaryFn =
  'neg' | 'abs' | 'sqrt' | 'exp' | 'log' | 'sin' | 'cos' | 'tan' | 'atan' | 'tanh' | 'floor';

/** Functions of two arguments. `atan2(a, b)` is the angle of the point (b, a). */
export type BinaryFn = 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max' | 'pow' | 'atan2';

/** Comparisons of a `select`. */
export type CompareFn = 'lt' | 'le' | 'gt' | 'ge';

/** A node of an expression tree. Build with {@link expr}; nodes are plain immutable data. */
export type Expr =
  | { readonly op: 'lit'; readonly value: number }
  | { readonly op: 'input'; readonly name: string }
  | { readonly op: 'local'; readonly name: string }
  | {
      /** A registry parameter: a scalar, component `index` of a vector, or the index of the name an enumeration holds. */
      readonly op: 'param';
      readonly key: string;
      readonly index: number | null;
    }
  | { readonly op: 'unary'; readonly fn: UnaryFn; readonly a: Expr }
  | { readonly op: 'binary'; readonly fn: BinaryFn; readonly a: Expr; readonly b: Expr }
  | {
      /** `then` where `a cmp b`, else `otherwise`. */
      readonly op: 'select';
      readonly cmp: CompareFn;
      readonly a: Expr;
      readonly b: Expr;
      readonly then: Expr;
      readonly otherwise: Expr;
    }
  | {
      /** `then` where the enumeration parameter `key` holds `option`, else `otherwise`. */
      readonly op: 'enumIs';
      readonly key: string;
      readonly option: string;
      readonly then: Expr;
      readonly otherwise: Expr;
    }
  | { readonly op: 'call'; readonly fn: ExprFn; readonly args: readonly Expr[] };

/** An expression or a number, which stands for a literal. */
export type ExprLike = Expr | number;

/** A closure function: named scalar inputs, locals evaluated in order, and a result. */
export interface ExprFn {
  /** Name of the WGSL function, a valid identifier that is unique among the functions emitted together. */
  readonly name: string;
  /** What the function computes, with the units of its inputs and result; emitted as a comment. */
  readonly doc: string;
  /** Names of the scalar inputs, in call order. */
  readonly inputs: readonly string[];
  /** Named intermediate values, each of which may use the inputs and the locals before it. */
  readonly locals: readonly (readonly [string, Expr])[];
  /** The value returned. */
  readonly result: Expr;
}

/** Thrown when an expression or a function definition is malformed. */
export class ExprError extends Error {
  override readonly name = 'ExprError';
}

function lift(x: ExprLike): Expr {
  if (typeof x !== 'number') return x;
  if (!isAllowedLiteralValue(x)) {
    throw new ExprError(
      `literal ${x} is not a small exact number or a geometric factor: ` +
        'register it as a parameter (sim-core.md section 0)',
    );
  }
  return { op: 'lit', value: x };
}

function unary(fn: UnaryFn): (a: ExprLike) => Expr {
  return (a) => ({ op: 'unary', fn, a: lift(a) });
}

function binary(fn: BinaryFn): (a: ExprLike, b: ExprLike) => Expr {
  return (a, b) => ({ op: 'binary', fn, a: lift(a), b: lift(b) });
}

function fold(fn: 'add' | 'mul'): (first: ExprLike, ...rest: ExprLike[]) => Expr {
  return (first, ...rest) =>
    rest.reduce<Expr>((acc, x) => ({ op: 'binary', fn, a: acc, b: lift(x) }), lift(first));
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Names a closure function, an input or a local may not take, because the emitted WGSL would
 * not compile or would mean something else: the keywords and reserved words of WGSL, the
 * builtin functions the emitter calls, and the scalar type the emitted signatures name.
 */
const WGSL_FORBIDDEN_NAMES: ReadonlySet<string> = new Set(
  // Keywords.
  (
    'alias break case const const_assert continue continuing default diagnostic discard else ' +
    'enable false fn for if let loop override requires return struct switch true var while ' +
    // Reserved words.
    'NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await ' +
    'become cast catch class co_await co_return co_yield coherent column_major common compile ' +
    'compile_fragment concept const_cast consteval constexpr constinit crate debugger decltype ' +
    'delete demote demote_to_helper do dynamic_cast enum explicit export extends extern external ' +
    'fallthrough filter final finally friend from fxgroup get goto groupshared highp impl ' +
    'implements import inline instanceof interface layout lowp macro macro_rules match mediump ' +
    'meta mod module move mut mutable namespace new nil noexcept noinline nointerpolation ' +
    'non_coherent noncopyable noperspective null nullptr of operator package packoffset ' +
    'partition pass patch pixelfragment precise precision premerge priv protected pub public ' +
    'readonly ref regardless register reinterpret_cast require resource restrict self set shared ' +
    'sizeof smooth snorm static static_assert static_cast std subroutine super target template ' +
    'this thread_local throw trait try type typedef typeid typename typeof union unless unorm ' +
    'unsafe unsized use using varying virtual volatile wgsl where with writeonly yield ' +
    // Builtins and types the emitted code uses.
    'abs sqrt exp log sin cos tan atan tanh floor min max pow atan2 select clamp f32 u32 i32 bool'
  ).split(' '),
);

/**
 * Largest magnitude of the argument of `tanh` on both back ends. tanh(16) is 1 - 2.5e-14, which
 * is exactly 1 in f32, so the limit changes no f32 result.
 */
export const TANH_ARGUMENT_LIMIT = 16;

function walk(e: Expr, visit: (node: Expr) => void): void {
  visit(e);
  switch (e.op) {
    case 'unary':
      walk(e.a, visit);
      break;
    case 'binary':
      walk(e.a, visit);
      walk(e.b, visit);
      break;
    case 'select':
      for (const child of [e.a, e.b, e.then, e.otherwise]) walk(child, visit);
      break;
    case 'enumIs':
      walk(e.then, visit);
      walk(e.otherwise, visit);
      break;
    case 'call':
      for (const arg of e.args) walk(arg, visit);
      break;
    default:
      break;
  }
}

// The f64 meaning of each operation (used by the evaluator and by the folding of constants).

const UNARY: Readonly<Record<UnaryFn, (a: number) => number>> = {
  neg: (a) => -a,
  abs: Math.abs,
  sqrt: Math.sqrt,
  exp: Math.exp,
  log: Math.log,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  atan: Math.atan,
  tanh: (a) => Math.tanh(Math.min(Math.max(a, -TANH_ARGUMENT_LIMIT), TANH_ARGUMENT_LIMIT)),
  floor: Math.floor,
};

const BINARY: Readonly<Record<BinaryFn, (a: number, b: number) => number>> = {
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  div: (a, b) => a / b,
  min: Math.min,
  max: Math.max,
  // Outside the domain of the WGSL builtin the result is what the device gives (measured on
  // Metal): NaN for a negative base and for 0^0, infinity for 0 to a negative power.
  pow: (a, b) => {
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || (a === 0 && b === 0)) return Number.NaN;
    return a === 0 && b < 0 ? Number.POSITIVE_INFINITY : Math.pow(a, b);
  },
  atan2: (a, b) => (a === 0 && b === 0 ? Number.NaN : Math.atan2(a, b)),
};

const COMPARE: Readonly<Record<CompareFn, (a: number, b: number) => boolean>> = {
  lt: (a, b) => a < b,
  le: (a, b) => a <= b,
  gt: (a, b) => a > b,
  ge: (a, b) => a >= b,
};

/**
 * Value of an expression made of literals only, as the WGSL compiler would fold it; `null` when
 * the expression reads an input, a local or a parameter or calls a function.
 */
function constantValue(e: Expr): number | null {
  switch (e.op) {
    case 'lit':
      return e.value;
    case 'unary': {
      const a = constantValue(e.a);
      return a === null ? null : UNARY[e.fn](a);
    }
    case 'binary': {
      const a = constantValue(e.a);
      const b = constantValue(e.b);
      return a === null || b === null ? null : BINARY[e.fn](a, b);
    }
    case 'select': {
      const a = constantValue(e.a);
      const b = constantValue(e.b);
      const then = constantValue(e.then);
      const otherwise = constantValue(e.otherwise);
      if (a === null || b === null || then === null || otherwise === null) return null;
      return COMPARE[e.cmp](a, b) ? then : otherwise;
    }
    default:
      return null;
  }
}

function defineFn(def: {
  readonly name: string;
  readonly doc: string;
  readonly inputs: readonly string[];
  readonly locals?: readonly (readonly [string, ExprLike])[];
  readonly result: ExprLike;
}): ExprFn {
  const fail = (what: string): never => {
    throw new ExprError(`closure function ${def.name}: ${what}`);
  };
  const checkName = (what: string, name: string): void => {
    if (!IDENTIFIER.test(name)) fail(`${what} "${name}" is not an identifier`);
    if (WGSL_FORBIDDEN_NAMES.has(name)) {
      fail(`${what} "${name}" is a WGSL keyword, reserved word or builtin the emitted code uses`);
    }
  };
  checkName('the name', def.name);
  const known = new Set<string>();
  for (const name of def.inputs) {
    checkName('input', name);
    if (known.has(name)) fail(`"${name}" is defined twice`);
    known.add(name);
  }
  const inputs = new Set(def.inputs);
  const called = new Set<string>();
  const check = (e: Expr): void =>
    walk(e, (node) => {
      if (node.op === 'input' && !inputs.has(node.name)) fail(`unknown input "${node.name}"`);
      if (node.op === 'local' && (!known.has(node.name) || inputs.has(node.name))) {
        fail(`local "${node.name}" is used before it is defined`);
      }
      if (node.op === 'call' && node.args.length !== node.fn.inputs.length) {
        fail(`${node.fn.name} takes ${node.fn.inputs.length} arguments`);
      }
      if (node.op === 'call') called.add(node.fn.name);
      // The WGSL compiler folds a subexpression of literals and refuses a result that is not a
      // finite f32 ("cannot be represented"); refuse it here, where the formula is written.
      const constant = constantValue(node);
      if (constant !== null && !Number.isFinite(Math.fround(constant))) {
        fail(`a constant subexpression evaluates to ${constant}, which is not a finite f32`);
      }
    });
  const locals: (readonly [string, Expr])[] = [];
  for (const [name, value] of def.locals ?? []) {
    checkName('local', name);
    if (known.has(name)) fail(`"${name}" is defined twice`);
    const e = lift(value);
    check(e);
    known.add(name);
    locals.push([name, e]);
  }
  const result = lift(def.result);
  check(result);
  for (const name of known) {
    // WGSL: a parameter or a `let` that shadows a function cannot be called.
    if (called.has(name)) fail(`"${name}" is also the name of a function the body calls`);
  }
  return Object.freeze({ name: def.name, doc: def.doc, inputs: [...def.inputs], locals, result });
}

/**
 * The expression builders. Operands may be expressions or plain numbers; a plain number is a
 * literal and must pass the literal lint.
 */
export const expr = {
  /** A literal. Throws `ExprError` unless the value is a small exact number or a geometric factor. */
  lit: (value: number): Expr => lift(value),
  /** An input of the function being defined. */
  input: (name: string): Expr => ({ op: 'input', name }),
  /** A local of the function being defined. */
  local: (name: string): Expr => ({ op: 'local', name }),
  /**
   * A registry parameter by key. With `index`, one component of a vector parameter. For an
   * enumeration parameter the value is the position of the name it holds.
   */
  param: (key: string, index: number | null = null): Expr => ({ op: 'param', key, index }),
  /** Sum of the operands. */
  add: fold('add'),
  /** Product of the operands. */
  mul: fold('mul'),
  /** `a - b`. */
  sub: binary('sub'),
  /** `a / b`. */
  div: binary('div'),
  /** The smaller of `a` and `b`. */
  min: binary('min'),
  /** The larger of `a` and `b`. */
  max: binary('max'),
  /** `a` to the power `b`; `a` must not be negative, and must be positive when `b <= 0` (else NaN or infinity). */
  pow: binary('pow'),
  /** Angle of the point (b, a), radians; NaN at (0, 0). */
  atan2: binary('atan2'),
  /** `-a`. */
  neg: unary('neg'),
  /** Absolute value. */
  abs: unary('abs'),
  /** Square root of a non-negative value. */
  sqrt: unary('sqrt'),
  /** Natural exponential. */
  exp: unary('exp'),
  /** Natural logarithm of a positive value. */
  log: unary('log'),
  /** Sine of an angle in radians. */
  sin: unary('sin'),
  /** Cosine of an angle in radians. */
  cos: unary('cos'),
  /** Tangent of an angle in radians. */
  tan: unary('tan'),
  /** Arc tangent, radians. */
  atan: unary('atan'),
  /** Hyperbolic tangent of the argument limited to +-{@link TANH_ARGUMENT_LIMIT}. */
  tanh: unary('tanh'),
  /** Largest integer not above the value. */
  floor: unary('floor'),
  /** `x` limited to the interval from `lo` to `hi`. */
  clamp: (x: ExprLike, lo: ExprLike, hi: ExprLike): Expr => binary('min')(binary('max')(x, lo), hi),
  /** `then` where `a cmp b`, else `otherwise`. Both branches are evaluated. */
  select: (
    cmp: CompareFn,
    a: ExprLike,
    b: ExprLike,
    then: ExprLike,
    otherwise: ExprLike,
  ): Expr => ({
    op: 'select',
    cmp,
    a: lift(a),
    b: lift(b),
    then: lift(then),
    otherwise: lift(otherwise),
  }),
  /** `then` where the enumeration parameter `key` holds `option`, else `otherwise`. */
  enumIs: (key: string, option: string, then: ExprLike, otherwise: ExprLike): Expr => ({
    op: 'enumIs',
    key,
    option,
    then: lift(then),
    otherwise: lift(otherwise),
  }),
  /** A call of another closure function. */
  call: (fn: ExprFn, ...args: ExprLike[]): Expr => ({ op: 'call', fn, args: args.map(lift) }),
  /**
   * Defines a closure function. Throws `ExprError` on an unknown input, a local used before its
   * definition, a duplicate name, a name WGSL reserves or the emitted code calls, a call with
   * the wrong number of arguments, or a subexpression of literals that is not a finite f32.
   */
  fn: defineFn,
} as const;

// ---------------------------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------------------------

/**
 * The functions needed to evaluate `fns`, callees before callers, each once: the order in which
 * WGSL must declare them. Deterministic for a given argument. Throws `ExprError` when two
 * different functions share a name.
 */
export function exprFnClosure(fns: readonly ExprFn[]): ExprFn[] {
  const out: ExprFn[] = [];
  const byName = new Map<string, ExprFn>();
  const visit = (fn: ExprFn): void => {
    const seen = byName.get(fn.name);
    if (seen === fn) return;
    if (seen) throw new ExprError(`two closure functions are named ${fn.name}`);
    byName.set(fn.name, fn);
    for (const e of [...fn.locals.map(([, v]) => v), fn.result]) {
      walk(e, (node) => {
        if (node.op === 'call') visit(node.fn);
      });
    }
    out.push(fn);
  };
  for (const fn of fns) visit(fn);
  return out;
}

/**
 * Keys of every registry parameter that `fns` and the functions they call read, sorted: the list
 * from which the uniform block of a kernel that uses them is built.
 */
export function exprParamKeys(fns: readonly ExprFn[]): string[] {
  const keys = new Set<string>();
  for (const fn of exprFnClosure(fns)) {
    for (const e of [...fn.locals.map(([, v]) => v), fn.result]) {
      walk(e, (node) => {
        if (node.op === 'param' || node.op === 'enumIs') keys.add(node.key);
      });
    }
  }
  return [...keys].sort(compareKeys);
}

// ---------------------------------------------------------------------------------------------
// f64 evaluator
// ---------------------------------------------------------------------------------------------

type Compiled = (frame: Float64Array) => number;

function paramNumber(params: ParamSet, key: string, index: number | null): number {
  const def = params.registry.def(key);
  if (def.kind === 'enum') return params.enumIndex(key);
  if (def.kind === 'vector') {
    const v = params.getVector(key);
    if (index === null || index < 0 || index >= v.length) {
      throw new ExprError(`parameter ${key} is a vector of ${v.length}: component ${index}`);
    }
    return v[index] as number;
  }
  if (index !== null) throw new ExprError(`parameter ${key} is a scalar and has no components`);
  return params.get(key);
}

function enumOptionIndex(params: ParamSet, key: string, option: string): number {
  const def = params.registry.def(key);
  const index = def.kind === 'enum' ? def.options.indexOf(option) : -1;
  if (index < 0) throw new ExprError(`"${option}" is not an option of parameter ${key}`);
  return index;
}

/**
 * Binds a closure function to a parameter set and returns its f64 evaluator: a plain function of
 * the inputs, in the units the definition states. Parameters are read once, here. Throws `ExprError` when a parameter the function reads is missing
 * or of the wrong kind.
 */
export function compileExprFn(fn: ExprFn, params: ParamSet): (...args: number[]) => number {
  const cache = new Map<ExprFn, (...args: number[]) => number>();

  const compileFn = (f: ExprFn): ((...args: number[]) => number) => {
    const cached = cache.get(f);
    if (cached) return cached;
    const slots = new Map<string, number>();
    f.inputs.forEach((name, i) => slots.set(name, i));
    f.locals.forEach(([name], i) => slots.set(name, f.inputs.length + i));
    const compile = (e: Expr): Compiled => {
      switch (e.op) {
        case 'lit': {
          const value = e.value;
          return () => value;
        }
        case 'input':
        case 'local': {
          const slot = slots.get(e.name) as number;
          return (frame) => frame[slot] as number;
        }
        case 'param': {
          const value = paramNumber(params, e.key, e.index);
          return () => value;
        }
        case 'unary': {
          const op = UNARY[e.fn];
          const a = compile(e.a);
          return (frame) => op(a(frame));
        }
        case 'binary': {
          const op = BINARY[e.fn];
          const a = compile(e.a);
          const b = compile(e.b);
          return (frame) => op(a(frame), b(frame));
        }
        case 'select': {
          const cmp = COMPARE[e.cmp];
          const a = compile(e.a);
          const b = compile(e.b);
          const then = compile(e.then);
          const otherwise = compile(e.otherwise);
          return (frame) => (cmp(a(frame), b(frame)) ? then(frame) : otherwise(frame));
        }
        case 'enumIs': {
          const holds = params.enumIndex(e.key) === enumOptionIndex(params, e.key, e.option);
          return compile(holds ? e.then : e.otherwise);
        }
        case 'call': {
          const callee = compileFn(e.fn);
          const args = e.args.map(compile);
          const values = new Array<number>(args.length).fill(0);
          return (frame) => {
            for (let i = 0; i < args.length; i++) values[i] = (args[i] as Compiled)(frame);
            return callee(...values);
          };
        }
      }
    };
    const locals = f.locals.map(([, value]) => compile(value));
    const result = compile(f.result);
    const nIn = f.inputs.length;
    const size = nIn + locals.length;
    const evaluate = (...args: number[]): number => {
      if (args.length !== nIn) {
        throw new RangeError(`${f.name} takes ${nIn} arguments, got ${args.length}`);
      }
      // A fresh frame per call keeps nested calls of the same function independent.
      const frame = new Float64Array(size);
      for (let i = 0; i < nIn; i++) frame[i] = args[i] as number;
      for (let i = 0; i < locals.length; i++) frame[nIn + i] = (locals[i] as Compiled)(frame);
      return result(frame);
    };
    cache.set(f, evaluate);
    return evaluate;
  };
  return compileFn(fn);
}

// ---------------------------------------------------------------------------------------------
// WGSL emitter
// ---------------------------------------------------------------------------------------------

/** How the emitted WGSL reaches registry parameters. */
export interface ExprWgslTarget {
  /**
   * WGSL expression (an f32) for a parameter: a scalar, component `index` of a vector, or the
   * option index of an enumeration. `UniformLayout.ref` bound to the name of the uniform
   * variable is the usual implementation.
   */
  paramRef(key: string, index: number | null): string;
  /** Position of `option` among the options of the enumeration parameter `key`. */
  enumOptionIndex(key: string, option: string): number;
}

function wgslNumber(value: number): string {
  const text = String(Math.abs(value));
  const float = /[.e]/.test(text) ? text : `${text}.0`;
  return value < 0 || Object.is(value, -0) ? `(-${float})` : float;
}

const BINARY_INFIX: Partial<Record<BinaryFn, string>> = { add: '+', sub: '-', mul: '*', div: '/' };
const COMPARE_INFIX: Readonly<Record<CompareFn, string>> = { lt: '<', le: '<=', gt: '>', ge: '>=' };

function emit(e: Expr, target: ExprWgslTarget): string {
  switch (e.op) {
    case 'lit':
      return wgslNumber(e.value);
    case 'input':
    case 'local':
      return e.name;
    case 'param':
      return target.paramRef(e.key, e.index);
    case 'unary': {
      const a = emit(e.a, target);
      if (e.fn === 'neg') return `(-${a})`;
      if (e.fn === 'tanh') {
        const limit = wgslNumber(TANH_ARGUMENT_LIMIT);
        return `tanh(clamp(${a}, -${limit}, ${limit}))`;
      }
      return `${e.fn}(${a})`;
    }
    case 'binary': {
      const infix = BINARY_INFIX[e.fn];
      const a = emit(e.a, target);
      const b = emit(e.b, target);
      return infix ? `(${a} ${infix} ${b})` : `${e.fn}(${a}, ${b})`;
    }
    case 'select':
      return (
        `select(${emit(e.otherwise, target)}, ${emit(e.then, target)}, ` +
        `${emit(e.a, target)} ${COMPARE_INFIX[e.cmp]} ${emit(e.b, target)})`
      );
    case 'enumIs':
      return (
        `select(${emit(e.otherwise, target)}, ${emit(e.then, target)}, ` +
        `${target.paramRef(e.key, null)} == ${wgslNumber(target.enumOptionIndex(e.key, e.option))})`
      );
    case 'call':
      return `${e.fn.name}(${e.args.map((a) => emit(a, target)).join(', ')})`;
  }
}

/**
 * WGSL text of `fns` and of every function they call, callees first, each as
 * `fn name(a: f32, ...) -> f32`. The text contains no numeric literal that the literal lint
 * rejects; parameters appear as the expressions `target.paramRef` returns. The same tree
 * evaluated by {@link compileExprFn} is the f64 reference of the result.
 */
export function emitExprWgsl(fns: readonly ExprFn[], target: ExprWgslTarget): string {
  const parts: string[] = [];
  for (const fn of exprFnClosure(fns)) {
    const lines: string[] = [];
    for (const docLine of fn.doc.split('\n')) lines.push(`// ${docLine}`.trimEnd());
    lines.push(`fn ${fn.name}(${fn.inputs.map((n) => `${n}: f32`).join(', ')}) -> f32 {`);
    for (const [name, value] of fn.locals) lines.push(`  let ${name} = ${emit(value, target)};`);
    lines.push(`  return ${emit(fn.result, target)};`);
    lines.push('}');
    parts.push(lines.join('\n'));
  }
  return `${parts.join('\n\n')}\n`;
}
