/**
 * A third back end for the closure functions of `@spotless/sim-params` (`expr.ts`): the same
 * expression tree compiled to plain JavaScript, for the hot loops of the CPU stages.
 *
 * `compileExprFn` of sim-params is the f64 reference: it walks the tree through closures and
 * allocates a frame per call, which is exact and slow (about a microsecond per call). The
 * exposure gather evaluates a closure tens of millions of times, so here the tree is written
 * out once as JavaScript source and handed to the engine's compiler. The operations and their
 * order are those of the tree, so the two evaluators give bit-identical results (a test holds
 * them to that); the domain rules of `expr.ts` (`pow`, `atan2`, the limited `tanh`) are
 * reproduced.
 *
 * Parameters are read once, when the functions are compiled, and become literals of the
 * generated source.
 */

import { exprFnClosure, type Expr, type ExprFn, type ParamSet } from '@spotless/sim-params';

/** A compiled closure function: plain numbers in, a number out. */
export type FastFn = (...args: number[]) => number;

const TANH_LIMIT = 16;

const PRELUDE = `
const __pow = (a, b) => {
  if (a !== a || b !== b || a < 0 || (a === 0 && b === 0)) return NaN;
  return a === 0 && b < 0 ? Infinity : Math.pow(a, b);
};
const __atan2 = (a, b) => (a === 0 && b === 0 ? NaN : Math.atan2(a, b));
const __tanh = (a) => Math.tanh(Math.min(Math.max(a, -${TANH_LIMIT}), ${TANH_LIMIT}));
`;

function paramNumber(params: ParamSet, key: string, index: number | null): number {
  const def = params.registry.def(key);
  if (def.kind === 'enum') return params.enumIndex(key);
  if (def.kind === 'vector') {
    const v = params.getVector(key);
    if (index === null || index < 0 || index >= v.length) {
      throw new RangeError(`parameter ${key} is a vector of ${v.length}: component ${index}`);
    }
    return v[index] as number;
  }
  if (index !== null) throw new RangeError(`parameter ${key} is a scalar and has no components`);
  return params.get(key);
}

function literal(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return 'Infinity';
  if (value === -Infinity) return '(-Infinity)';
  // The shortest text that reads back as the same double.
  const text = String(value);
  return value < 0 || Object.is(value, -0) ? `(${text})` : text;
}

const INFIX: Readonly<Record<string, string>> = { add: '+', sub: '-', mul: '*', div: '/' };
const COMPARE: Readonly<Record<string, string>> = { lt: '<', le: '<=', gt: '>', ge: '>=' };

function emit(e: Expr, params: ParamSet): string {
  switch (e.op) {
    case 'lit':
      return literal(e.value);
    case 'input':
    case 'local':
      return `v_${e.name}`;
    case 'param':
      return literal(paramNumber(params, e.key, e.index));
    case 'unary': {
      const a = emit(e.a, params);
      if (e.fn === 'neg') return `(-${a})`;
      if (e.fn === 'tanh') return `__tanh(${a})`;
      return `Math.${e.fn}(${a})`;
    }
    case 'binary': {
      const a = emit(e.a, params);
      const b = emit(e.b, params);
      const infix = INFIX[e.fn];
      if (infix !== undefined) return `(${a} ${infix} ${b})`;
      if (e.fn === 'pow') return `__pow(${a}, ${b})`;
      if (e.fn === 'atan2') return `__atan2(${a}, ${b})`;
      return `Math.${e.fn}(${a}, ${b})`;
    }
    case 'select':
      return (
        `((${emit(e.a, params)} ${COMPARE[e.cmp] as string} ${emit(e.b, params)}) ? ` +
        `${emit(e.then, params)} : ${emit(e.otherwise, params)})`
      );
    case 'enumIs': {
      const def = params.registry.def(e.key);
      const index = def.kind === 'enum' ? def.options.indexOf(e.option) : -1;
      if (index < 0) throw new RangeError(`"${e.option}" is not an option of parameter ${e.key}`);
      return emit(params.enumIndex(e.key) === index ? e.then : e.otherwise, params);
    }
    case 'call':
      return `f_${e.fn.name}(${e.args.map((a) => emit(a, params)).join(', ')})`;
  }
}

/**
 * The JavaScript source of `fns` and of every function they call, as the body of a function
 * that returns them by name. Exposed for the test that reads it.
 */
export function exprFastSource(fns: readonly ExprFn[], params: ParamSet): string {
  const all = exprFnClosure(fns);
  const parts: string[] = [PRELUDE];
  for (const fn of all) {
    const lines: string[] = [];
    lines.push(`function f_${fn.name}(${fn.inputs.map((n) => `v_${n}`).join(', ')}) {`);
    for (const [name, value] of fn.locals)
      lines.push(`  const v_${name} = ${emit(value, params)};`);
    lines.push(`  return ${emit(fn.result, params)};`);
    lines.push('}');
    parts.push(lines.join('\n'));
  }
  parts.push(`return { ${all.map((fn) => `${fn.name}: f_${fn.name}`).join(', ')} };`);
  return parts.join('\n');
}

/**
 * Compiles `fns` (and what they call) against a parameter set. Returns the compiled functions
 * by name; each takes its inputs in the order of its definition, in the units the definition
 * states.
 */
export function compileExprFast(
  fns: readonly ExprFn[],
  params: ParamSet,
): Readonly<Record<string, FastFn>> {
  // The source is generated from registered closure definitions only, never from input data.
  const make = new Function(exprFastSource(fns, params)) as () => Record<string, FastFn>;
  return make();
}
