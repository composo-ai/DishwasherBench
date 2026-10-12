// WGSL assembly, uniform parameter blocks, the stack string as text and dispatch sizes: the
// parts of module M1 that need no GPU (docs/design/sim-core.md section M1).
import { RNG_WGSL } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { dispatchGrid } from './grid.ts';
import { spikeHashHex, firstDifferentByte } from './hash.ts';
import { gpuStackKey, gpuStackOf, gpuStackSlug, stackKey } from './stack.ts';
import type { StackString } from './types.ts';
import {
  createWgslLibrary,
  opClassesInWgsl,
  uniformBlock,
  wgslUsesAtomics,
  WGSL_I64,
  WGSL_NONFINITE,
  WGSL_RNG,
} from './wgsl.ts';

describe('WgslLibrary', () => {
  it('starts with the generator of @spotless/core and the two helpers of this package', () => {
    const lib = createWgslLibrary();
    expect(lib.names()).toEqual([WGSL_RNG, WGSL_I64, WGSL_NONFINITE].sort());
    // The generator is the one core exports, not a copy that could drift (rule 8).
    expect(lib.assemble(`#include "${WGSL_RNG}"`)).toContain(RNG_WGSL.trim());
  });

  it('replaces include lines, each module once, dependencies first', () => {
    const lib = createWgslLibrary();
    lib.define('a', 'fn a() -> u32 { return 1u; }');
    lib.define('b', '#include "a"\nfn b() -> u32 { return a() + 1u; }');
    lib.define('c', '  #include "a"  \n#include "b"\nfn c() -> u32 { return a() + b(); }');
    const out = lib.assemble('#include "c"\n#include "a"\n#include "b"\nfn main() {}');
    // One definition of each function, in dependency order, then the kernel's own code.
    for (const name of ['a', 'b', 'c']) {
      expect(out.split(`fn ${name}()`).length - 1, name).toBe(1);
    }
    expect(out.indexOf('fn a()')).toBeLessThan(out.indexOf('fn b()'));
    expect(out.indexOf('fn b()')).toBeLessThan(out.indexOf('fn c()'));
    expect(out.indexOf('fn c()')).toBeLessThan(out.indexOf('fn main()'));
    expect(out).not.toMatch(/^\s*#include/m);
  });

  it('leaves text that merely mentions #include inside a line alone', () => {
    const lib = createWgslLibrary();
    const source = 'let x = 1u; // see #include "rng" above';
    expect(lib.assemble(source)).toBe(source);
  });

  it('refuses unknown names, cycles and conflicting redefinitions', () => {
    const lib = createWgslLibrary();
    expect(() => lib.assemble('#include "nope"')).toThrow(
      /unknown WGSL include "nope"; defined: rng/,
    );
    lib.define('x', '#include "y"');
    lib.define('y', '#include "x"');
    expect(() => lib.assemble('#include "x"')).toThrow(/cycle: x -> y -> x/);
    lib.define('same', 'const K = 1;');
    lib.define('same', 'const K = 1;');
    expect(() => lib.define('same', 'const K = 2;')).toThrow(/already defined/);
    expect(() => lib.define('bad name', '')).toThrow(/characters/);
    expect(lib.has('same')).toBe(true);
    expect(lib.has('other')).toBe(false);
  });
});

describe('uniformBlock', () => {
  const block = uniformBlock('FilmParams', [
    { name: 'cells', type: 'u32' },
    { name: 'nu', type: 'f32' },
    { name: 'tilt', type: 'i32' },
  ]);

  it('declares one scalar member per field, in order', () => {
    expect(block.wgsl).toBe('struct FilmParams {\n  cells: u32,\n  nu: f32,\n  tilt: i32,\n}\n');
    expect(block.byteSize).toBe(12);
  });

  it('packs little-endian words, floats to single precision', () => {
    const bytes = new Uint8Array(block.pack({ cells: 0x01020304, nu: 1.0e-6, tilt: -2 }));
    expect([...bytes.subarray(0, 4)]).toEqual([4, 3, 2, 1]);
    expect(new Float32Array(bytes.buffer, 4, 1)[0]).toBe(Math.fround(1.0e-6));
    expect([...bytes.subarray(8)]).toEqual([0xfe, 0xff, 0xff, 0xff]);
  });

  it('refuses missing, unknown, non-integer, out-of-range and non-finite values', () => {
    expect(() => block.pack({ cells: 1, nu: 1 })).toThrow(/no value for member tilt/);
    expect(() => block.pack({ cells: 1, nu: 1, tilt: 0, extra: 1 })).toThrow(/no member extra/);
    expect(() => block.pack({ cells: 1.5, nu: 1, tilt: 0 })).toThrow(RangeError);
    expect(() => block.pack({ cells: -1, nu: 1, tilt: 0 })).toThrow(RangeError);
    expect(() => block.pack({ cells: 1, nu: NaN, tilt: 0 })).toThrow(RangeError);
    expect(() => block.pack({ cells: 1, nu: Infinity, tilt: 0 })).toThrow(RangeError);
    // A finite double beyond single precision would be stored as infinity (rule 12). The
    // largest f32 is 2^128 - 2^104; half a unit in the last place above it rounds to infinity.
    const f32Max = 2 ** 128 - 2 ** 104;
    expect(() => block.pack({ cells: 1, nu: 1e39, tilt: 0 })).toThrow(/not a finite f32/);
    expect(() => block.pack({ cells: 1, nu: -(f32Max + 2 ** 103), tilt: 0 })).toThrow(RangeError);
    const top = new DataView(block.pack({ cells: 1, nu: f32Max + 2 ** 102, tilt: 0 }));
    expect(top.getUint32(4, true)).toBe(0x7f7fffff);
    expect(() => block.pack({ cells: 1, nu: 1, tilt: 2 ** 31 })).toThrow(RangeError);
    expect(() => uniformBlock('P', [])).toThrow(/no members/);
    expect(() =>
      uniformBlock('P', [
        { name: 'a', type: 'u32' },
        { name: 'a', type: 'f32' },
      ]),
    ).toThrow(/twice/);
    expect(() => uniformBlock('1P', [{ name: 'a', type: 'u32' }])).toThrow(/identifier/);
  });
});

describe('stack string', () => {
  const stack: StackString = {
    sim: '0.1.0',
    gpu: 'apple metal-3 apple-m3-pro',
    os: 'macOS 27.0.1 (26A434)',
    webgpu: 'webgpu 0.6.2',
    runtime: 'node 20.19.0',
    physics: 'jolt-physics 1.0.0',
  };

  it('is one line with all six parts in a fixed order', () => {
    expect(stackKey(stack)).toBe(
      'sim=0.1.0; gpu=apple metal-3 apple-m3-pro; os=macOS 27.0.1 (26A434); ' +
        'webgpu=webgpu 0.6.2; runtime=node 20.19.0; physics=jolt-physics 1.0.0',
    );
  });

  it('changes when the operating-system build or the bindings change (rule 13)', () => {
    const keys = new Set([
      stackKey(stack),
      stackKey({ ...stack, os: 'macOS 27.0.2 (26A500)' }),
      stackKey({ ...stack, webgpu: 'webgpu 0.6.3' }),
      stackKey({ ...stack, sim: '0.1.1' }),
      stackKey({ ...stack, gpu: 'apple metal-3 apple-m4-pro' }),
      stackKey({ ...stack, runtime: 'node 22.0.0' }),
      stackKey({ ...stack, physics: 'jolt-physics 1.0.1' }),
    ]);
    expect(keys.size).toBe(7);
  });

  it('gives probes a key and a file name that leave out simulator and physics versions', () => {
    const gpuStack = gpuStackOf(stack);
    expect(gpuStackKey(gpuStack)).toBe(
      'gpu=apple metal-3 apple-m3-pro; os=macOS 27.0.1 (26A434); webgpu=webgpu 0.6.2; runtime=node 20.19.0',
    );
    expect(gpuStackSlug(gpuStack)).toBe(
      'apple-metal-3-apple-m3-pro__macos-27.0.1-26a434__webgpu-0.6.2__node-20.19.0',
    );
    expect(gpuStackSlug(gpuStackOf({ ...stack, sim: '9.9.9' }))).toBe(gpuStackSlug(gpuStack));
    expect(gpuStackSlug({ ...gpuStack, os: 'macOS 27.0.2 (26A500)' })).not.toBe(
      gpuStackSlug(gpuStack),
    );
  });
});

describe('dispatchGrid', () => {
  it('covers every invocation, in one row while that fits and in rows beyond', () => {
    expect(dispatchGrid(0, 64)).toEqual({ workgroups: [0, 0, 0], row: 64 });
    expect(dispatchGrid(1, 64)).toEqual({ workgroups: [1, 1, 1], row: 64 });
    expect(dispatchGrid(64, 64).workgroups).toEqual([1, 1, 1]);
    expect(dispatchGrid(65, 64).workgroups).toEqual([2, 1, 1]);
    // 32,768 workgroups of 64 is the widest row: 2,097,152 invocations.
    expect(dispatchGrid(2_097_152, 64)).toEqual({ workgroups: [32768, 1, 1], row: 2_097_152 });
    expect(dispatchGrid(2_097_153, 64)).toEqual({ workgroups: [32768, 2, 1], row: 2_097_152 });
    for (const n of [1, 63, 4096, 5_000_000, 123_456_789]) {
      const grid = dispatchGrid(n, 64);
      const [x, y] = grid.workgroups;
      expect(x * 64 * y).toBeGreaterThanOrEqual(n);
      expect(grid.row).toBe(x * 64);
      expect(Math.max(x, y)).toBeLessThanOrEqual(65535);
      // No whole row is wasted.
      expect((y - 1) * grid.row).toBeLessThan(n);
    }
    expect(() => dispatchGrid(-1, 64)).toThrow(RangeError);
    expect(() => dispatchGrid(10, 0)).toThrow(RangeError);
  });
});

describe('result hashes', () => {
  it('finds the first differing byte, or none', () => {
    const a = Uint8Array.of(1, 2, 3, 4);
    expect(firstDifferentByte(a, Uint8Array.of(1, 2, 3, 4))).toBe(-1);
    expect(firstDifferentByte(a, Uint8Array.of(1, 2, 9, 4))).toBe(2);
    expect(firstDifferentByte(a, Uint8Array.of(1, 2, 3))).toBe(3);
    expect(firstDifferentByte(a.buffer, new Uint32Array(a.buffer))).toBe(-1);
  });

  it('hashes like the spike: FNV-1a offset basis for no bytes, and order matters', () => {
    // With no bytes the two halves are their initial values, 0x811c9dc5 and 0x01000193.
    expect(spikeHashHex(new Uint8Array(0))).toBe('811c9dc501000193');
    // One byte 0x00: h1 = basis * prime (FNV-1a of a zero byte) = 0x050c5d1f.
    expect(spikeHashHex(Uint8Array.of(0)).slice(0, 8)).toBe('050c5d1f');
    expect(spikeHashHex(Uint8Array.of(1, 2))).not.toBe(spikeHashHex(Uint8Array.of(2, 1)));
  });
});

describe('opClassesInWgsl (determinism rule 9)', () => {
  const header = '@group(0) @binding(0) var<storage, read_write> o: array<f32>;\n';
  const main = (body: string): string =>
    `${header}@compute @workgroup_size(1) fn main() { ${body} }`;

  it('recognises each class from the built-ins that belong to it', () => {
    const cases: readonly (readonly [string, readonly string[]])[] = [
      ['o[0] = sqrt(o[1]);', ['sqrt']],
      ['o[0] = inverseSqrt(o[1]) + length(vec2<f32>(o[1], o[2]));', ['sqrt']],
      ['o[0] = exp(o[1]) + log2(o[2]);', ['explog']],
      ['o[0] = tanh (o[1]);', ['explog']],
      ['o[0] = pow(o[1], 1.5);', ['pow']],
      ['o[0] = sin(o[1]) * cos(o[1]) + atan(o[2]);', ['trig']],
      ['o[0] = atan2(o[1], o[2]);', ['atan2']],
      ['o[0] = fma(o[1], o[2], o[3]);', ['fma']],
      ['o[0] = unpack2x16float(7u).x;', ['f16']],
      ['o[0] = bitcast<f32>(7u);', ['bitcast']],
      [
        'o[0] = pow(sqrt(o[1]), exp(o[2])) + bitcast<f32>(1u);',
        ['sqrt', 'explog', 'pow', 'bitcast'],
      ],
      // Nothing recognisable: arithmetic, an integer division, an array length, a conversion.
      ['o[0] = o[1] * o[2] + f32(arrayLength(&o) / 2u);', []],
    ];
    for (const [body, classes] of cases) {
      expect(opClassesInWgsl(main(body), 'main'), body).toEqual(classes);
    }
  });

  it('ignores comments and identifiers that merely contain a built-in name', () => {
    const source = main(`
      // o[0] = sqrt(o[1]);
      /* pow(o[1], 2.0) /* nested exp(1.0) */ still a comment: sin(1.0) */
      let my_sqrt = 1.0; let expo = 2.0; o[0] = my_sqrt * expo;`);
    expect(opClassesInWgsl(source, 'main')).toEqual([]);
    expect(wgslUsesAtomics(source, 'main')).toBe(false);
  });

  it('follows calls from the entry point and skips helpers it cannot reach', () => {
    const source = `${header}
fn unused(x: f32) -> f32 { return cos(x); }
fn leaf(x: f32) -> f32 { return sqrt(x); }
fn middle(x: f32) -> f32 { return leaf(x) + 1.0; }
@compute @workgroup_size(1) fn main() { o[0] = middle(o[1]); }
@compute @workgroup_size(1) fn other() { o[0] = pow(o[1], unused(o[2])); }`;
    expect(opClassesInWgsl(source, 'main')).toEqual(['sqrt']);
    expect(opClassesInWgsl(source, 'other')).toEqual(['pow', 'trig']);
    // Without an entry point, or with one that does not exist, the whole source counts.
    expect(opClassesInWgsl(source)).toEqual(['sqrt', 'pow', 'trig']);
    expect(opClassesInWgsl(source, 'missing')).toEqual(['sqrt', 'pow', 'trig']);
  });

  it('sees atomic types and built-ins', () => {
    const source = `@group(0) @binding(0) var<storage, read_write> a: array<atomic<u32>>;
@compute @workgroup_size(1) fn main() { atomicAdd(&a[0], 1u); }`;
    expect(opClassesInWgsl(source, 'main')).toEqual(['atomics']);
    expect(wgslUsesAtomics(source, 'main')).toBe(true);
  });

  it('finds what the shared includes of this package use', () => {
    const lib = createWgslLibrary();
    // The uniform draw is integer arithmetic and a conversion: nothing to declare. The normal
    // draw (Box-Muller) is what brings sqrt, log and cos, and only a kernel that calls it.
    const withRng = (body: string): string => lib.assemble(`#include "${WGSL_RNG}"\n${main(body)}`);
    expect(opClassesInWgsl(withRng('o[0] = rng_unit(rng_hash2(1u, 2u, 3u));'), 'main')).toEqual([]);
    expect(opClassesInWgsl(withRng('o[0] = rng_normal(1u, 2u);'), 'main')).toEqual([
      'sqrt',
      'explog',
      'trig',
    ]);
    const withGuard = lib.assemble(
      `#include "${WGSL_NONFINITE}"\n${main('if (nonfinite_f32(o[1])) { o[0] = 0.0; }')}`,
    );
    expect(opClassesInWgsl(withGuard, 'main')).toEqual(['bitcast']);
  });
});
