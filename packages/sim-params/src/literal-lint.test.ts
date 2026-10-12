// The literal lint of sim-core.md section 0 on hand-written sources: each case states which
// literals must be reported and which must pass.
import { describe, expect, it } from 'vitest';
import { assertNoPhysicalLiterals, isAllowedLiteralValue, lintLiterals } from './index.ts';
import { assertKernelFilesHaveNoPhysicalLiterals, readKernelSources } from './node.ts';

const found = (text: string, language: 'wgsl' | 'ts' = 'wgsl', options = {}): string[] =>
  lintLiterals(text, language, 'k', options).map((f) => f.literal);

describe('lintLiterals', () => {
  it('reports physical constants in WGSL and passes structure', () => {
    const wgsl = `
struct P { g: f32, }
@group(0) @binding(12) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> h: array<vec4<f32>>;
// 9.81 in a comment is not code; neither is /* 0.072 */
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let rho = 998.2;            // density
  let sigma = 7.2e-2;         // surface tension
  let nu = 1.0e-6f;
  let third = 0.3333333;      // exact factor 1/3
  let x = 0.5 * h[gid.x].x + 2.0 * f32(gid.x) - 3.14159265 * 1.5;
  let m = (gid.x >> 16u) & 0xFFFFu;
  let big = gid.x & 65535u;   // 2^16 - 1 in an integer context
  let n = 1000u;
  let y = vec3<f32>(1.0, 0.0, 15.0);
  let t = 0.1;
}`;
    expect(found(wgsl)).toEqual(['998.2', '7.2e-2', '1.0e-6f', '1000u', '0.1']);
    const first = lintLiterals(wgsl, 'wgsl', 'k.wgsl')[0];
    expect(first).toMatchObject({ source: 'k.wgsl', line: 8, column: 13, value: 998.2 });
  });

  it('honours the allow list, the integer limit and the pragmas, which need a reason', () => {
    expect(found('let a = 17; let b = 16;')).toEqual(['17']);
    expect(found('let a = 17; let b = 64.0;', 'wgsl', { maxInteger: 64 })).toEqual([]);
    expect(found('let a = 0.4;', 'wgsl', { allow: [0.4] })).toEqual([]);
    expect(found('var a: array<u32, 256>; // literal-ok: tile size')).toEqual([]);
    expect(found('var a: array<u32, 300>; // literal-ok:')).toEqual(['300']);
    const block = `// literal-ok-begin: generated table shape
let n = 137u;
// literal-ok-end
let m = 137u;`;
    expect(lintLiterals(block, 'wgsl').map((f) => f.line)).toEqual([4]);
  });

  it('scans TypeScript code and template literals but not strings or comments', () => {
    const ts = [
      "import { x } from './v2/file3.ts';",
      'const label = "at 55 degrees";',
      '/** 0.072 N/m */',
      'export function ref(h: number): number { return 1000 * h ** 3 / (3 * 5.04e-4); }',
      'export const KERNEL = /* wgsl */ `',
      '  fn f(x: f32) -> f32 { return 0.289 * x + f32(${2 + 40}); }',
      '`;',
      'const mask = 0xff;',
      'const big = 123n;',
    ].join('\n');
    expect(found(ts, 'ts')).toEqual(['1000', '5.04e-4', '0.289', '40', '123n']);
  });

  it('accepts exactly the small numbers and geometric factors', () => {
    for (const v of [
      0,
      1,
      2,
      15,
      16,
      0.5,
      0.25,
      1.5,
      Math.PI,
      2 * Math.PI,
      1 / 3,
      4 / 3,
      Math.SQRT2,
      3.1415927,
      -2,
    ]) {
      expect(isAllowedLiteralValue(v), String(v)).toBe(true);
    }
    for (const v of [0.1, 17, 9.80665, 273.15, 3.14, 1e-3, 0.3, 998, Number.NaN]) {
      expect(isAllowedLiteralValue(v), String(v)).toBe(false);
    }
  });

  it('keeps line numbers and pragmas through apostrophes, escapes and nested templates', () => {
    // An apostrophe inside template text is not the start of a string (the reviewer's case).
    const apostrophe = [
      "const m = `can't read ${name}`; const g = 9.81;",
      'const a = 4.2; // literal-ok: reason',
      'const b = 7.77;',
    ].join('\n');
    expect(lintLiterals(apostrophe, 'ts').map((f) => `${f.line}:${f.column} ${f.literal}`)).toEqual(
      ['1:43 9.81', '3:11 7.77'],
    );
    // A backslash-newline inside a quoted string and inside a template: the next lines keep
    // their numbers. An unterminated quote ends at the end of its line.
    const continued = [
      "const s = 'one \\",
      "two 3.3'; const c = 4.4;",
      'const t = `a \\',
      'b`; const d = 5.5; // literal-ok: reason',
      "const u = 'unterminated 6.6",
      'const e = 7.7;',
    ].join('\n');
    expect(lintLiterals(continued, 'ts').map((f) => `${f.line}:${f.column} ${f.literal}`)).toEqual([
      '2:21 4.4',
      '6:11 7.7',
    ]);
    // Strings inside ${ } are strings again; the template text after the closing brace is code.
    const nested =
      'const k = `let a = ${on ? "9.81" : `${x}{\'}`} * 3.7; // it\'s 2.2\n let b = 8.8;`;';
    expect(found(nested, 'ts')).toEqual(['3.7', '8.8']);
    // An object literal inside ${ } does not end the interpolation early.
    expect(found('const k = `${f({ a: "x`y" })} 6.6`; const z = 5.5;', 'ts')).toEqual([
      '6.6',
      '5.5',
    ]);
  });

  it('reads separators, binary, octal and hexadecimal-float spellings by their value', () => {
    expect(found('const rho = 1_000; const g = 9_81e-2; const ok = 1_6;', 'ts')).toEqual([
      '1_000',
      '9_81e-2',
    ]);
    expect(lintLiterals('const g = 9_81e-2;', 'ts')[0]?.value).toBeCloseTo(9.81, 12);
    // 0b1111101000 and 0o1750 are both 1000; masks and small integers pass.
    expect(
      found(
        'const a = 0b1111101000; const b = 0o1750; const m = 0b1111_1111; const s = 0o20;',
        'ts',
      ),
    ).toEqual(['0b1111101000', '0o1750']);
    // Hexadecimal floats: 9.81, 998.2 and 0.072 written three ways; 0x1p4 = 16 and 0x.8p0 = 0.5
    // pass by value.
    const hex = lintLiterals(
      'let g = 0x9.cf5c28f5c28f8p+0; let r = 0xf98.cccdp-2; let s = 0x1.26e978d4fdf3bp-4f;\n' +
        'let n = 0x1p4; let h = 0x.8p0; let q = 0x1.8; let m = 0xFFFFu & 0x3e8;',
      'wgsl',
    );
    expect(hex.map((f) => f.literal)).toEqual([
      '0x9.cf5c28f5c28f8p+0',
      '0xf98.cccdp-2',
      '0x1.26e978d4fdf3bp-4f',
    ]);
    expect(hex[0]?.value).toBeCloseTo(9.81, 12);
    expect(hex[1]?.value).toBeCloseTo(998.2, 3);
    expect(hex[2]?.value).toBeCloseTo(0.072, 12);
    // A hexadecimal integer followed by a member access is still an integer.
    expect(found('const t = 0xff.toString(); const u = 0xab.valueOf();', 'ts')).toEqual([]);
  });

  it('reports a begin pragma without an end and an end without a begin', () => {
    const open = lintLiterals(
      'let a = 1.0;\n// literal-ok-begin: table\nfn f() -> f32 { return 9.81; }',
      'wgsl',
      'k.wgsl',
    );
    expect(open).toMatchObject([
      { problem: 'unterminated-begin', line: 2, column: 4, literal: 'literal-ok-begin' },
    ]);
    expect(() =>
      assertNoPhysicalLiterals([{ name: 'k.wgsl', text: '// literal-ok-begin: t\nlet g = 9.81;' }]),
    ).toThrow(/k\.wgsl:1:4 literal-ok-begin \(unterminated-begin\)/);
    // A begin without a reason opens nothing, so its end is reported and its literals too.
    const stray = lintLiterals('// literal-ok-begin:\nlet g = 9.81;\n// literal-ok-end', 'wgsl');
    expect(stray.map((f) => [f.problem, f.line])).toEqual([
      ['literal', 2],
      ['end-without-begin', 3],
    ]);
  });

  it('does not let registry defaults through as eighths', () => {
    // Defaults of M7.9 and similar that the first rule (any multiple of 1/8 up to 16) passed.
    expect(found('let nCl = 0.375; let cap = 2.25; let lake = 0.75; let x = 9.875;')).toEqual([
      '0.375',
      '2.25',
      '0.75',
      '9.875',
    ]);
    // The same ratios as quotients of integers pass, as do the three listed fractions.
    expect(found('let a = 3.0 / 8.0 + 0.5 * x + 0.25 * y + 1.5 * z;')).toEqual([]);
    for (const v of [0.125, 0.75, 2.5, 15.875, 0.375]) {
      expect(isAllowedLiteralValue(v), String(v)).toBe(false);
    }
  });

  it('throws from the one-line assertions with file, line and literal', () => {
    expect(() => assertNoPhysicalLiterals([{ name: 'a.wgsl', text: 'let g = 9.81;' }])).toThrow(
      /a\.wgsl:1:9 9\.81/,
    );
    expect(() =>
      assertNoPhysicalLiterals([{ name: 'a.wgsl', text: 'let g = p.g * 2.0;' }]),
    ).not.toThrow();
  });

  it('reads kernel files from a directory and refuses to pass on nothing', () => {
    // This package's own sources: closures.ts holds the correlations' coefficients as registry
    // defaults (data, not kernel code), so it is not a kernel source and is not matched.
    const dir = import.meta.dirname;
    expect(readKernelSources([dir])).toEqual([]);
    expect(() => assertKernelFilesHaveNoPhysicalLiterals([dir])).toThrow(/no kernel source/);
    const sources = readKernelSources([dir], (name) => name.endsWith('expr.ts'));
    expect(sources.map((s) => s.name.split('/').pop())).toEqual(['expr.ts']);
    // expr.ts is generic machinery: it holds no number beyond small integers.
    expect(() =>
      assertKernelFilesHaveNoPhysicalLiterals([dir], {
        match: (name) => name.endsWith('/expr.ts'),
      }),
    ).not.toThrow();
  });
});
