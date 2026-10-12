/**
 * The literal lint of docs/design/sim-core.md section 0: "A lint test fails on numeric literals
 * in kernels and reference implementations other than 0, 1, 2 and exact geometric factors listed
 * in M2." It keeps physical constants out of kernel sources, so that every one of them reaches a
 * kernel through a uniform block built from the registry and can be calibrated.
 *
 * The contract never lists the geometric factors; the list is {@link GEOMETRIC_FACTORS} here
 * (reported as a contract issue). What passes:
 *
 *  - integers from 0 to `maxInteger` (default 16), written as integers or as floats (`3.0`):
 *    loop bounds, component counts, the exact integers of closed forms (the 15 of the
 *    Hartley-Murgatroyd thickness, the 3 and 12 of lubrication theory). This is wider than the
 *    contract's "0, 1, 2" (reported as a contract issue);
 *  - the fractions of {@link ALLOWED_FRACTIONS} (0.25, 0.5, 1.5) and no other: any other exact
 *    ratio is written as a quotient of integers (`3.0 / 8.0`), so that a registry default such as
 *    0.375 or 2.25 cannot be typed into a kernel unnoticed;
 *  - the geometric factors (pi and its simple multiples, 1/3, 2/3, 4/3, 1/6, the square roots of
 *    2 and 3 and their reciprocals), matched to a relative 1e-6, the precision of an f32 literal;
 *  - in integer contexts (a WGSL literal with a `u` or `i` suffix, a TypeScript bigint, a binary
 *    or octal literal): powers of two and powers of two minus one, which are bit masks, shifts
 *    and fixed-point word sizes;
 *  - any hexadecimal integer (hash constants, bit patterns). A hexadecimal float (`0x1.8p3`) is
 *    a float and is judged by its value;
 *  - literals inside WGSL attributes (`@binding(3)`, `@workgroup_size(64)`);
 *  - anything on a line that carries `literal-ok: <reason>`, and anything between a line with
 *    `literal-ok-begin: <reason>` and one with `literal-ok-end` (for generated table code and for
 *    structural sizes such as `array<u32, 64>`). The reason is mandatory. A begin without an end
 *    and an end without a begin are findings themselves.
 *
 * Numeric separators (`1_000`) are read as part of the number. TypeScript sources are scanned as
 * code with comments and quoted strings removed. The text of a template literal is scanned as
 * WGSL, because that is where WGSL lives in a `.wgsl.ts` file: quotes in it are ordinary
 * characters, `//` and block comments in it are comments (ending at the closing backtick at the
 * latest), and `${ ... }` is TypeScript code again.
 *
 * Limits: this is a tokenizer, not a parser. A TypeScript regular-expression literal that holds
 * a quote, a backtick or digits can confuse it; a `${` inside a comment inside a template
 * literal is not followed. A hexadecimal integer of any value passes.
 * This file has no Node dependency: `node.ts` adds the reading of files.
 */

/**
 * The exact geometric factors a kernel may write as literals, by name. The contract promises
 * such a list in M2 and does not give it; this is the list.
 */
export const GEOMETRIC_FACTORS: Readonly<Record<string, number>> = {
  pi: Math.PI,
  twoPi: 2 * Math.PI,
  fourPi: 4 * Math.PI,
  halfPi: Math.PI / 2,
  quarterPi: Math.PI / 4,
  invPi: 1 / Math.PI,
  fourThirdsPi: (4 * Math.PI) / 3,
  radPerDeg: Math.PI / 180,
  degPerRad: 180 / Math.PI,
  third: 1 / 3,
  twoThirds: 2 / 3,
  fourThirds: 4 / 3,
  sixth: 1 / 6,
  sqrt2: Math.SQRT2,
  invSqrt2: Math.SQRT1_2,
  sqrt3: Math.sqrt(3),
  invSqrt3: 1 / Math.sqrt(3),
};

/** Largest integer that passes the lint by default. */
export const DEFAULT_MAX_INTEGER = 16;

/**
 * The only non-integer values, besides the geometric factors, that may be written as literals:
 * the half and quarter of closed forms and the 3/2 of power laws.
 */
export const ALLOWED_FRACTIONS: readonly number[] = [0.25, 0.5, 1.5];

/** Relative tolerance with which a literal is matched to a geometric factor or an allowed value. */
export const LITERAL_MATCH_TOLERANCE = 1e-6;

/** Options of the literal lint. */
export interface LiteralLintOptions {
  /** Largest plain integer allowed. Default {@link DEFAULT_MAX_INTEGER}. */
  readonly maxInteger?: number;
  /** Further values to allow, matched to {@link LITERAL_MATCH_TOLERANCE}. Use sparingly. */
  readonly allow?: readonly number[];
}

/** One literal the lint rejects, or one misused pragma. */
export interface LiteralFinding {
  /**
   * `literal`: a numeric literal that is not allowed. `unterminated-begin`: a
   * `literal-ok-begin` with no `literal-ok-end` after it. `end-without-begin`: a
   * `literal-ok-end` with no open `literal-ok-begin` (which includes a begin without a reason).
   */
  readonly problem: 'literal' | 'unterminated-begin' | 'end-without-begin';
  /** Name of the source, as given by the caller (a file path). */
  readonly source: string;
  /** Line, counted from 1. */
  readonly line: number;
  /** Column, counted from 1. */
  readonly column: number;
  /** The literal as written; for a pragma problem, the pragma. */
  readonly literal: string;
  /** Its value; NaN for a pragma problem. */
  readonly value: number;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= LITERAL_MATCH_TOLERANCE * Math.max(Math.abs(a), Math.abs(b));
}

/**
 * True when a non-negative value may be written as a literal in a kernel or a closure
 * expression: an integer up to `maxInteger`, one of {@link ALLOWED_FRACTIONS}, a geometric
 * factor or one of `allow`. (The sign of a literal is an operator and is not part of it.)
 */
export function isAllowedLiteralValue(value: number, options: LiteralLintOptions = {}): boolean {
  const maxInteger = options.maxInteger ?? DEFAULT_MAX_INTEGER;
  const v = Math.abs(value);
  if (!Number.isFinite(v)) return false;
  if (v <= maxInteger && Number.isInteger(v)) return true;
  if (ALLOWED_FRACTIONS.includes(v)) return true;
  for (const factor of Object.values(GEOMETRIC_FACTORS)) if (near(v, factor)) return true;
  for (const allowed of options.allow ?? []) if (near(v, Math.abs(allowed))) return true;
  return false;
}

function isBitPattern(value: number): boolean {
  if (!Number.isInteger(value) || value < 0 || value > 2 ** 53) return false;
  const log = Math.log2(value);
  const logPlus = Math.log2(value + 1);
  return Number.isInteger(log) || Number.isInteger(logPlus);
}

const HEX_FLOAT =
  /^0[xX](?:[0-9a-fA-F_]*\.[0-9a-fA-F_]*(?:[pP][+-]?\d+)?|[0-9a-fA-F_]+[pP][+-]?\d+)/;
const HEX_INT = /^0[xX][0-9a-fA-F_]+/;
const BINARY_OR_OCTAL = /^0(?:[bB][01_]+|[oO][0-7_]+)/;
const DECIMAL = /^(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?/;
const IDENT_CHAR = /[A-Za-z0-9_$]/;
const HEX_RADIX = 16;
/** Longest numeric literal the tokenizer reads, in characters. */
const MAX_LITERAL_LENGTH = 96;

/** Value of a hexadecimal float such as `0x1.8p3` (digits, optional fraction, optional binary exponent). */
function hexFloatValue(literal: string): number {
  const [mantissa = '', exponent = '0'] = literal.slice(2).toLowerCase().split('p');
  const [whole = '', fraction = ''] = mantissa.split('.');
  let value = 0;
  for (const digit of whole) value = value * HEX_RADIX + Number.parseInt(digit, HEX_RADIX);
  let scale = 1;
  for (const digit of fraction) {
    scale /= HEX_RADIX;
    value += Number.parseInt(digit, HEX_RADIX) * scale;
  }
  return value * 2 ** Number(exponent);
}

/** A numeric literal at the start of `text`: its spelling without a suffix, its value and its form. */
function readNumber(
  text: string,
): { literal: string; value: number; form: 'hex-int' | 'bits' | 'float' } | null {
  const hexFloat = HEX_FLOAT.exec(text);
  // `0xff.toString()` is a hexadecimal integer followed by a member access, not a float.
  if (
    hexFloat &&
    !(/\.[0-9a-fA-F_]*$/.test(hexFloat[0]) && /[A-Za-z_$]/.test(text[hexFloat[0].length] ?? ''))
  ) {
    const literal = hexFloat[0];
    return { literal, value: hexFloatValue(literal.replaceAll('_', '')), form: 'float' };
  }
  const hexInt = HEX_INT.exec(text);
  if (hexInt) {
    return { literal: hexInt[0], value: Number(hexInt[0].replaceAll('_', '')), form: 'hex-int' };
  }
  const bits = BINARY_OR_OCTAL.exec(text);
  if (bits) return { literal: bits[0], value: Number(bits[0].replaceAll('_', '')), form: 'bits' };
  const decimal = DECIMAL.exec(text);
  if (decimal) {
    return { literal: decimal[0], value: Number(decimal[0].replaceAll('_', '')), form: 'float' };
  }
  return null;
}

/**
 * Scans one source text and returns the literals that are not allowed and the misused pragmas
 * (see the file comment for the rules), in order of position. `language` selects how comments
 * and strings are skipped: `wgsl` for a WGSL text, `ts` for TypeScript (the text of whose
 * template literals is scanned as WGSL).
 */
export function lintLiterals(
  text: string,
  language: 'wgsl' | 'ts',
  source = '<text>',
  options: LiteralLintOptions = {},
): LiteralFinding[] {
  const findings: LiteralFinding[] = [];
  const lines = text.split('\n');
  // Pass 1: which lines are exempt by a pragma, and pragmas without their partner.
  const exempt = new Array<boolean>(lines.length).fill(false);
  const pragma = (
    problem: 'unterminated-begin' | 'end-without-begin',
    at: number,
    word: string,
  ): void => {
    const column = (lines[at] as string).indexOf(word) + 1;
    findings.push({ problem, source, line: at + 1, column, literal: word, value: Number.NaN });
  };
  let openAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (/literal-ok-begin:\s*\S/.test(line) && openAt < 0) openAt = i;
    if (openAt >= 0 || /literal-ok:\s*\S/.test(line)) exempt[i] = true;
    if (/literal-ok-end/.test(line)) {
      if (openAt < 0) pragma('end-without-begin', i, 'literal-ok-end');
      openAt = -1;
    }
  }
  if (openAt >= 0) pragma('unterminated-begin', openAt, 'literal-ok-begin');

  // Pass 2: tokens. `modes` is the lexical nesting of a TypeScript text: code, the text of a
  // template literal inside it, the code of a `${ }` inside that, and so on. `braces` counts
  // the braces open in the current stretch of code, so that the `}` that ends a `${ }` is known.
  type Mode = { readonly template: boolean; braces: number };
  const modes: Mode[] = [{ template: false, braces: 0 }];
  let line = 0;
  let lineStart = 0;
  let i = 0;
  let attributeDepth = 0; // > 0 inside the parentheses of a WGSL attribute
  let pendingAttribute = false; // just read `@name`, an opening parenthesis may follow
  const n = text.length;
  const newline = (at: number): void => {
    line++;
    lineStart = at + 1;
  };
  while (i < n) {
    const c = text[i] as string;
    const next = text[i + 1];
    const mode = modes[modes.length - 1] as Mode;
    const inTemplate = mode.template;
    if (c === '\n') {
      newline(i);
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < n && text[i] !== '\n' && !(inTemplate && text[i] === '`')) i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        if (inTemplate && text[i] === '`') break;
        if (text[i] === '\n') newline(i);
        i++;
      }
      if (text[i] === '*') i += 2;
      continue;
    }
    if (language === 'ts') {
      if (inTemplate) {
        if (c === '\\') {
          if (next === '\n') newline(i + 1);
          i += 2;
          continue;
        }
        if (c === '`') {
          modes.pop();
          i++;
          continue;
        }
        if (c === '$' && next === '{') {
          modes.push({ template: false, braces: 0 });
          i += 2;
          continue;
        }
      } else {
        if (c === "'" || c === '"') {
          // A quoted string ends at its quote or, when unterminated, before the end of the
          // line; the newline itself is left to the main loop, which counts it.
          i++;
          while (i < n && text[i] !== c && text[i] !== '\n') {
            if (text[i] === '\\') {
              if (text[i + 1] === '\n') newline(i + 1);
              i += 2;
            } else {
              i++;
            }
          }
          if (text[i] === c) i++;
          continue;
        }
        if (c === '`') {
          modes.push({ template: true, braces: 0 });
          i++;
          continue;
        }
        if (c === '{') mode.braces++;
        if (c === '}') {
          if (mode.braces === 0 && modes.length > 1) {
            modes.pop();
            i++;
            continue;
          }
          mode.braces = Math.max(0, mode.braces - 1);
        }
      }
    }
    if (c === '@' && /[A-Za-z_]/.test(next ?? '')) {
      i++;
      while (i < n && IDENT_CHAR.test(text[i] as string)) i++;
      pendingAttribute = true;
      continue;
    }
    if (pendingAttribute && c === '(') {
      attributeDepth = 1;
      pendingAttribute = false;
      i++;
      continue;
    }
    if (attributeDepth > 0 && (c === '(' || c === ')')) {
      attributeDepth += c === '(' ? 1 : -1;
      i++;
      continue;
    }
    if (!/\s/.test(c)) pendingAttribute = false;
    if (IDENT_CHAR.test(c) && !/\d/.test(c) && !(c === '$' && next === '{')) {
      // An identifier (which may contain digits: vec3, f32, x0) is skipped whole.
      while (
        i < n &&
        IDENT_CHAR.test(text[i] as string) &&
        !(text[i] === '$' && text[i + 1] === '{')
      ) {
        i++;
      }
      continue;
    }
    const isNumberStart = /\d/.test(c) || (c === '.' && /\d/.test(next ?? ''));
    const number = isNumberStart ? readNumber(text.slice(i, i + MAX_LITERAL_LENGTH)) : null;
    if (!number) {
      i++;
      continue;
    }
    let literal = number.literal;
    let end = i + literal.length;
    let suffix = '';
    const after = text[end] ?? '';
    if (/[uifh]/.test(after) && !IDENT_CHAR.test(text[end + 1] ?? '')) {
      suffix = after;
      end++;
    } else if (language === 'ts' && after === 'n') {
      suffix = 'n';
      end++;
    }
    const value = number.value;
    literal += suffix;
    const integerContext =
      number.form === 'bits' || suffix === 'u' || suffix === 'i' || suffix === 'n';
    const allowed =
      attributeDepth > 0 ||
      exempt[line] === true ||
      number.form === 'hex-int' ||
      (integerContext && isBitPattern(value)) ||
      isAllowedLiteralValue(value, options);
    if (!allowed) {
      findings.push({
        problem: 'literal',
        source,
        line: line + 1,
        column: i - lineStart + 1,
        literal,
        value,
      });
    }
    i = end;
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

/** A kernel source handed to {@link lintKernelSources}. */
export interface KernelSource {
  /** Name shown in findings; the language is taken from its extension unless `language` is set. */
  readonly name: string;
  /** The source text. */
  readonly text: string;
  /** `wgsl` or `ts`. Default: `wgsl` for a name ending in `.wgsl`, else `ts`. */
  readonly language?: 'wgsl' | 'ts';
}

/** Lints several sources and returns every finding, in the order of the sources. */
export function lintKernelSources(
  sources: readonly KernelSource[],
  options: LiteralLintOptions = {},
): LiteralFinding[] {
  return sources.flatMap((s) =>
    lintLiterals(s.text, s.language ?? (s.name.endsWith('.wgsl') ? 'wgsl' : 'ts'), s.name, options),
  );
}

/** Findings as text, one per line: `file:line:column literal`, with the problem when it is a pragma. */
export function formatLiteralFindings(findings: readonly LiteralFinding[]): string {
  return findings
    .map(
      (f) =>
        `${f.source}:${f.line}:${f.column} ${f.literal}` +
        (f.problem === 'literal' ? '' : ` (${f.problem})`),
    )
    .join('\n');
}

/**
 * Throws an `Error` listing every disallowed literal of the sources; returns normally when there
 * is none. The one-line test of a package whose kernels are strings:
 * `it('has no physical literals', () => assertNoPhysicalLiterals([{ name, text }]))`.
 */
export function assertNoPhysicalLiterals(
  sources: readonly KernelSource[],
  options: LiteralLintOptions = {},
): void {
  const findings = lintKernelSources(sources, options);
  if (findings.length > 0) {
    throw new Error(
      `${findings.length} numeric literal(s) that must come from the parameter registry ` +
        `(sim-core.md section 0):\n${formatLiteralFindings(findings)}`,
    );
  }
}
