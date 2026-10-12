// Round trip of the record helpers of module M1 (docs/design/sim-core.md section M1) for every
// record layout the simulation packages export: records written on the CPU through
// `recordView` are read field by field in a kernel through the generated WGSL, and records
// written field by field in a kernel are compared byte for byte with the CPU's encoding.
//
// The layouts are found on disk and imported at run time, not through package dependencies:
// they live in the packages above this one (sim-scene, sim-jets, sim-spray, sim-film, sim-soil),
// and module M1 may depend on @spotless/core only.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hashU32 } from '@spotless/core';
import { afterAll, describe, expect, it } from 'vitest';
import { f16BitsToNumber } from './f16.ts';
import { FIELD_BYTES, layoutProblems, type LayoutField, type RecordLayout } from './layout.ts';
import { tryCreateNodeGpuContext } from './node/device.ts';
import {
  recordBufferBytes,
  recordInclude,
  recordView,
  recordWgsl,
  wgslIdentifier,
} from './record.ts';
import type { GpuContext, ManagedBuffer } from './types.ts';
import { BUFFER_USAGE } from './usage.ts';

const ctx = await tryCreateNodeGpuContext();
afterAll(() => ctx?.destroy());

function isLayout(value: unknown): value is RecordLayout {
  const v = value as Partial<RecordLayout> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.name === 'string' &&
    typeof v.byteSize === 'number' &&
    Array.isArray(v.fields)
  );
}

/** Every exported `*_LAYOUT` of the simulation packages, by export name. */
async function repositoryLayouts(): Promise<[string, RecordLayout][]> {
  const packages = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const found = new Map<string, RecordLayout>();
  for (const pkg of readdirSync(packages).sort()) {
    if (!pkg.startsWith('sim-') || pkg === 'sim-gpu') continue;
    const src = join(packages, pkg, 'src');
    for (const file of readdirSync(src).sort()) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const path = join(src, file);
      if (!/export const \w+_LAYOUT\b/.test(readFileSync(path, 'utf8'))) continue;
      const module = (await import(/* @vite-ignore */ pathToFileURL(path).href)) as Record<
        string,
        unknown
      >;
      for (const [name, value] of Object.entries(module)) {
        if (name.endsWith('_LAYOUT') && isLayout(value)) found.set(name, value);
      }
    }
  }
  return [...found.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}

const layouts = await repositoryLayouts();

/**
 * A layout of this file with what the repository's might lack: a reserved word as a field name,
 * and a repeated 8-byte group of three narrow members and an f32, whose narrow members
 * therefore lie in words that are not adjacent (words 3 and 5).
 */
const LOCAL = {
  name: 'RoundTrip',
  section: 'test',
  owner: 'M1',
  per: 'element',
  byteSize: 32,
  fields: [
    { name: 'mass', type: 'u32', offset: 0, role: 'state', unit: 'kg', scale: 1e-12, doc: 'x' },
    { name: 'type', type: 'i32', offset: 4, role: 'static', unit: '-', doc: 'reserved word' },
    { name: 'h', type: 'f16', offset: 8, role: 'statistic', unit: 'm', scale: 1e-6, doc: 'x' },
    { name: 'v', type: 'i16', offset: 10, role: 'static', unit: 'm/s', scale: 1e-3, doc: 'x' },
    {
      name: 'peak',
      type: 'u8',
      offset: 12,
      count: 2,
      stride: 8,
      role: 'statistic',
      unit: '1',
      doc: 'x',
    },
    {
      name: 'code',
      type: 'log8',
      offset: 13,
      count: 2,
      stride: 8,
      role: 'statistic',
      unit: 'Pa',
      log: { min: 1, max: 1e4 },
      doc: 'x',
    },
    {
      name: 'n',
      type: 'u16',
      offset: 14,
      count: 2,
      stride: 8,
      role: 'counter',
      unit: '1',
      bound: 60000,
      doc: 'x',
    },
    {
      name: 'gain',
      type: 'f32',
      offset: 16,
      count: 2,
      stride: 8,
      role: 'state',
      unit: '1',
      doc: 'x',
    },
    { name: 'spare', type: 'u32', offset: 28, role: 'static', unit: '-', pad: true, doc: 'x' },
  ],
} as const satisfies RecordLayout;

interface Element {
  readonly field: LayoutField;
  readonly k: number;
}

function elementsOf(layout: RecordLayout): Element[] {
  return layout.fields
    .filter((f) => !f.pad)
    .flatMap((field) => Array.from({ length: field.count ?? 1 }, (_, k) => ({ field, k })));
}

/** A stored number for an element, pseudo-random, with the extremes in the first records. */
function storedValue(field: LayoutField, record: number, seed: number): number {
  const h = record === 0 ? 0 : record === 1 ? 0xffffffff : hashU32(seed, record);
  switch (field.type) {
    case 'u32':
      return h;
    case 'i32':
      return h | 0;
    case 'u16':
      return h & 0xffff;
    case 'i16':
      return ((h & 0xffff) << 16) >> 16;
    case 'u8':
    case 'log8':
      return h & 0xff;
    case 'f32': {
      // Any bit pattern that is not NaN or infinity (whose payload need not survive).
      const bits = (h & 0x7f800000) === 0x7f800000 ? h & 0xff7fffff : h;
      return new Float32Array(Uint32Array.of(bits).buffer)[0] as number;
    }
    case 'f16': {
      const bits = h & 0xffff;
      return f16BitsToNumber((bits & 0x7c00) === 0x7c00 ? bits & 0xfbff : bits);
    }
  }
}

/** The 32 bits a kernel sees or supplies for a stored number: the value itself or its f32 bits. */
function asWord(field: LayoutField, stored: number): number {
  if (field.type === 'f32' || field.type === 'f16') {
    return new Uint32Array(Float32Array.of(stored).buffer)[0] as number;
  }
  return stored >>> 0;
}

/** WGSL type of what the accessors of a field read and take (documented on `recordWgsl`). */
function accessType(field: LayoutField): 'u32' | 'i32' | 'f32' {
  if (field.type === 'f32' || field.type === 'f16') return 'f32';
  if (field.type === 'i32' || field.type === 'i16') return 'i32';
  return 'u32';
}

const toWord = (type: string, expr: string): string =>
  type === 'u32' ? expr : `bitcast<u32>(${expr})`;
const fromWord = (type: string, expr: string): string =>
  type === 'u32' ? expr : `bitcast<${type}>(${expr})`;

/** The two kernels of the round trip for a record of whole words, per the documented naming. */
function structKernels(layout: RecordLayout): { read: string; write: string } {
  const name = layout.name;
  const elements = elementsOf(layout);
  const reads: string[] = [];
  const writes: string[] = [];
  elements.forEach(({ field, k }, j) => {
    const id = wgslIdentifier(field.name);
    const type = accessType(field);
    const many = (field.count ?? 1) > 1;
    const value = fromWord(type, `vals[i * ${elements.length}u + ${j}u]`);
    if (FIELD_BYTES[field.type] === 4) {
      const member = !many ? id : (field.stride ?? 4) === 4 ? `${id}[${k}]` : `${id}_${k}`;
      reads.push(`out[i * ${elements.length}u + ${j}u] = ${toWord(type, `r.${member}`)};`);
      writes.push(`r.${member} = ${value};`);
    } else {
      const index = many ? `, ${k}u` : '';
      reads.push(
        `out[i * ${elements.length}u + ${j}u] = ${toWord(type, `${name}_${id}(r${index})`)};`,
      );
      writes.push(`${name}_set_${id}(&r${index}, ${value});`);
    }
  });
  const head = `#include "${recordInclude(layout)}"\n`;
  return {
    read: `${head}
@group(0) @binding(0) var<storage, read> recs: array<${name}>;
@group(0) @binding(1) var<storage, read_write> out: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&recs)) { return; }
  let r = recs[i];
  ${reads.join('\n  ')}
}`,
    write: `${head}
@group(0) @binding(0) var<storage, read> vals: array<u32>;
@group(0) @binding(1) var<storage, read_write> recs: array<${name}>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&recs)) { return; }
  var r: ${name};
  ${writes.join('\n  ')}
  recs[i] = r;
}`,
  };
}

/** The two kernels for a record of 1 or 2 bytes, packed into `array<u32>`. */
function subWordKernels(layout: RecordLayout): { read: string; write: string } {
  const name = layout.name;
  const elements = elementsOf(layout);
  const perWord = 4 / layout.byteSize;
  const reads: string[] = [];
  const writes: string[] = [];
  elements.forEach(({ field, k }, j) => {
    const type = accessType(field);
    const index = (field.count ?? 1) > 1 ? `, ${k}u` : '';
    reads.push(
      `out[i * ${elements.length}u + ${j}u] = ${toWord(type, `${name}_${field.name}(word, i${index})`)};`,
    );
    writes.push(
      `word = ${name}_with_${field.name}(word, i${index}, ${fromWord(type, `vals[i * ${elements.length}u + ${j}u]`)});`,
    );
  });
  const head = `#include "${recordInclude(layout)}"\n`;
  return {
    read: `${head}
@group(0) @binding(0) var<storage, read> recs: array<u32>;
@group(0) @binding(1) var<storage, read_write> out: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&recs) * ${name}_PER_WORD) { return; }
  let word = recs[i / ${name}_PER_WORD];
  ${reads.join('\n  ')}
}`,
    // One invocation per word, so that no two invocations write the same word.
    write: `${head}
@group(0) @binding(0) var<storage, read> vals: array<u32>;
@group(0) @binding(1) var<storage, read_write> recs: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= arrayLength(&recs)) { return; }
  var word = 0u;
  for (var t = 0u; t < ${perWord}u; t++) {
    let i = gid.x * ${perWord}u + t;
    ${writes.join('\n    ')}
  }
  recs[gid.x] = word;
}`,
  };
}

const RECORDS = 256;

async function roundTrip(gpu: GpuContext, layout: RecordLayout, seed: number): Promise<void> {
  expect(layoutProblems(layout)).toEqual([]);
  const elements = elementsOf(layout);
  const subWord = layout.byteSize < 4;
  if (!gpu.wgsl.has(recordInclude(layout))) {
    gpu.wgsl.define(recordInclude(layout), recordWgsl(layout));
  }
  const source = subWord ? subWordKernels(layout) : structKernels(layout);

  // The CPU's records and, per element, the 32 bits the kernel must see or is given.
  const bytes = new ArrayBuffer(recordBufferBytes(layout, RECORDS));
  const view = recordView(layout, bytes, RECORDS);
  const words = new Uint32Array(RECORDS * elements.length);
  for (let i = 0; i < RECORDS; i++) {
    elements.forEach(({ field, k }, j) => {
      const stored = storedValue(field, i, seed + 977 * j);
      view.setRaw(i, field.name, stored, k);
      // What was stored must read back the same on the CPU before the GPU is asked.
      expect(Object.is(view.raw(i, field.name, k), stored)).toBe(true);
      words[i * elements.length + j] = asWord(field, stored);
    });
  }

  const make = (suffix: string, size: number): ManagedBuffer =>
    gpu.buffer({
      name: `${layout.name}.${suffix}`,
      owner: 'test',
      stage: 'A',
      bytes: size,
      usage: BUFFER_USAGE.STORAGE,
      fields: [{ name: 'word', type: 'u32', role: 'static', unit: '-' }],
    });
  const kernel = (kind: 'read' | 'write', a: string, b: string) =>
    gpu.kernel({
      name: `${layout.name}.${kind}`,
      wgsl: gpu.wgsl.assemble(source[kind]),
      entry: 'main',
      bindings: [
        { group: 0, binding: 0, name: a, kind: 'read-only-storage' },
        { group: 0, binding: 1, name: b, kind: 'storage' },
      ],
      uses: ['bitcast', 'f16'],
      reads: [a],
      writes: [b],
      atomics: [],
    });
  try {
    const [reader, writer] = await Promise.all([
      kernel('read', 'recs', 'out'),
      kernel('write', 'vals', 'recs'),
    ]);
    const cpuRecords = make('cpu', bytes.byteLength);
    const seen = make('seen', words.byteLength);
    const given = make('given', words.byteLength);
    const gpuRecords = make('gpu', bytes.byteLength);
    gpu.write(cpuRecords, bytes);
    gpu.write(given, words);
    const groups = [Math.ceil(RECORDS / 64), 1, 1] as const;
    gpu.submit([
      {
        op: 'dispatch',
        kernel: reader,
        bindings: { recs: cpuRecords, out: seen },
        workgroups: groups,
        plannedTime: 0,
      },
      {
        op: 'dispatch',
        kernel: writer,
        bindings: { vals: given, recs: gpuRecords },
        workgroups: groups,
        plannedTime: 0,
      },
    ]);

    // CPU to GPU: every element as the kernel read it.
    const seenWords = new Uint32Array(await gpu.read(seen));
    const misread: string[] = [];
    for (let i = 0; i < RECORDS && misread.length < 5; i++) {
      elements.forEach(({ field, k }, j) => {
        const at = i * elements.length + j;
        if (seenWords[at] !== words[at]) {
          misread.push(`record ${i} ${field.name}[${k}]: ${seenWords[at]} for ${words[at]}`);
        }
      });
    }
    expect(misread, `${layout.name} read in a kernel`).toEqual([]);

    // GPU to CPU: the record bytes the kernel wrote equal the CPU's, padding included.
    const written = new Uint8Array(await gpu.read(gpuRecords));
    const expected = new Uint8Array(bytes);
    const differing: string[] = [];
    for (let at = 0; at < expected.length && differing.length < 5; at++) {
      if (written[at] !== expected[at]) {
        differing.push(
          `record ${Math.floor(at / layout.byteSize)} byte ${at % layout.byteSize}: ` +
            `${written[at]} for ${expected[at]}`,
        );
      }
    }
    expect(differing, `${layout.name} written in a kernel`).toEqual([]);
    // And the CPU view reads the kernel's records back as the stored numbers.
    const back = recordView(layout, written.buffer as ArrayBuffer, RECORDS);
    for (const i of [0, 1, 2, 77, RECORDS - 1]) {
      for (const { field, k } of elements) {
        expect(
          Object.is(back.raw(i, field.name, k), view.raw(i, field.name, k)),
          `${layout.name} record ${i} ${field.name}[${k}]`,
        ).toBe(true);
      }
    }
  } finally {
    gpu.releaseStage('A');
  }
}

describe.skipIf(ctx === null)('record round trip, CPU view against generated WGSL', () => {
  const gpu = ctx as GpuContext;

  it('finds the record layouts of the repository', () => {
    // contract-issues.md counts forty layouts in the skeletons; fewer means the search broke.
    expect(layouts.length).toBeGreaterThanOrEqual(40);
    const kinds = new Set(layouts.flatMap(([, l]) => l.fields.map((f) => f.type)));
    expect([...kinds].sort()).toEqual(['f16', 'f32', 'i16', 'i32', 'log8', 'u16', 'u32', 'u8']);
    // Both shapes are present: records of whole words and records packed into words.
    expect(layouts.some(([, l]) => l.byteSize < 4)).toBe(true);
    expect(
      layouts.some(([, l]) => l.fields.some((f) => (f.stride ?? 0) > FIELD_BYTES[f.type])),
    ).toBe(true);
  });

  it('round-trips a local layout with a reserved name, a repeated group and padding', async () => {
    await roundTrip(gpu, LOCAL, 1);
    // The generated source is what the documentation of recordWgsl says it is.
    const wgsl = recordWgsl(LOCAL);
    expect(wgsl).toContain('struct RoundTrip {');
    expect(wgsl).toContain('  type_: i32,');
    expect(wgsl).toContain('  packed_w2: array<u32, 2>,');
    expect(wgsl).toContain('  gain_0: f32,');
    expect(wgsl).toContain('  packed_w5: array<u32, 1>,');
    expect(wgsl).toContain('  gain_1: f32,');
    expect(wgsl).toContain('  pad_w7: u32,');
    expect(wgsl).toContain('const RoundTrip_mass_SCALE: f32 = 1e-12;');
    expect(wgsl).toContain('const RoundTrip_code_LOG_MAX: f32 = 10000.0;');
    expect(wgsl).toContain('const RoundTrip_gain_WORD: u32 = 4u;');
    // The narrow members of the group are in two runs, so their accessors switch on k.
    expect(wgsl).toMatch(
      /fn RoundTrip_n\(r: RoundTrip, k: u32\) -> u32 \{\s+var x = 0u;\s+switch k/,
    );
  });

  it.each(layouts)('round-trips %s', async (_name, layout) => {
    await roundTrip(gpu, layout, 1000 + layout.byteSize);
  });

  it('declares atomic members that a kernel can add to, and bit accessors that agree with the CPU', async () => {
    const DEPOSIT = {
      name: 'Deposit',
      section: 'test',
      owner: 'M1',
      per: 'block',
      byteSize: 12,
      fields: [
        {
          name: 'mass',
          type: 'u32',
          offset: 0,
          role: 'accumulator',
          unit: 'kg',
          scale: 1e-12,
          bound: 2 ** 31,
          doc: 'x',
        },
        {
          name: 'momentum',
          type: 'i32',
          offset: 4,
          role: 'accumulator',
          unit: 'kg m/s',
          scale: 1e-12,
          bound: 2 ** 31 - 1,
          doc: 'x',
        },
        {
          name: 'word',
          type: 'u32',
          offset: 8,
          role: 'static',
          unit: '-',
          bits: [
            { name: 'regime', lsb: 0, width: 2, doc: 'x' },
            { name: 'cells', lsb: 2, width: 4, doc: 'x' },
            { name: 'link', lsb: 6, width: 26, doc: 'x' },
          ],
          doc: 'x',
        },
      ],
    } as const satisfies RecordLayout;
    gpu.wgsl.define('record/Deposit/atomic', recordWgsl(DEPOSIT, { atomic: ['mass', 'momentum'] }));
    const blocks = 64;
    const writers = 4096;
    const kernel = await gpu.kernel({
      name: 'deposit-atomic',
      wgsl: gpu.wgsl.assemble(`
#include "record/Deposit/atomic"
@group(0) @binding(0) var<storage, read_write> acc: array<Deposit>;
@group(0) @binding(1) var<storage, read_write> split: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= ${writers}u) { return; }
  let target_block = (i * 7u) % ${blocks}u;
  atomicAdd(&acc[target_block].mass, i + 1u);
  atomicAdd(&acc[target_block].momentum, 100 - i32(i));
  // The bit accessors, on the static word of block i (one writer per block).
  if (i < ${blocks}u) {
    let w = acc[i].word;
    split[3u * i] = Deposit_word_regime(w);
    split[3u * i + 1u] = Deposit_word_cells(w);
    split[3u * i + 2u] = Deposit_word_link(Deposit_word_with_cells(w, 9u));
  }
}`),
      entry: 'main',
      bindings: [
        { group: 0, binding: 0, name: 'acc', kind: 'storage' },
        { group: 0, binding: 1, name: 'split', kind: 'storage' },
      ],
      uses: ['atomics'],
      reads: ['acc'],
      writes: ['split'],
      atomics: ['acc'],
    });
    const bytes = new ArrayBuffer(12 * blocks);
    const view = recordView(DEPOSIT, bytes);
    for (let b = 0; b < blocks; b++) {
      view.setBits(b, 'word', 'regime', b % 4);
      view.setBits(b, 'word', 'cells', (b * 5) % 16);
      view.setBits(b, 'word', 'link', hashU32(4, b) % 2 ** 26);
    }
    const acc = gpu.buffer({
      name: 'deposit.acc',
      owner: 'test',
      stage: 'A',
      bytes: 12 * blocks,
      usage: BUFFER_USAGE.STORAGE,
      layout: DEPOSIT,
    });
    const split = gpu.buffer({
      name: 'deposit.split',
      owner: 'test',
      stage: 'A',
      bytes: 12 * blocks,
      usage: BUFFER_USAGE.STORAGE,
      fields: [{ name: 'word', type: 'u32', role: 'static', unit: '-' }],
    });
    gpu.write(acc, bytes);
    await gpu.run([
      {
        op: 'dispatch',
        kernel,
        bindings: { acc, split },
        workgroups: [writers / 64, 1, 1],
        plannedTime: 0,
      },
    ]);
    const result = recordView(DEPOSIT, await gpu.read(acc));
    const parts = new Uint32Array(await gpu.read(split));
    for (let b = 0; b < blocks; b++) {
      let mass = 0;
      let momentum = 0;
      for (let i = 0; i < writers; i++) {
        if ((i * 7) % blocks === b) {
          mass += i + 1;
          momentum += 100 - i;
        }
      }
      expect(result.raw(b, 'mass')).toBe(mass);
      expect(result.raw(b, 'momentum')).toBe(momentum);
      expect(parts[3 * b]).toBe(view.bits(b, 'word', 'regime'));
      expect(parts[3 * b + 1]).toBe(view.bits(b, 'word', 'cells'));
      expect(parts[3 * b + 2]).toBe(view.bits(b, 'word', 'link'));
    }
    // The ledger sums of the atomic fields through the exact reduction.
    const sums = await gpu.reduceI64(acc, {
      strideBytes: 12,
      fields: [
        { offsetBytes: 0, type: 'u32' },
        { offsetBytes: 4, type: 'i32' },
      ],
    });
    expect(sums[0]).toBe(BigInt((writers * (writers + 1)) / 2));
    expect(sums[1]).toBe(BigInt(100 * writers - (writers * (writers - 1)) / 2));
    gpu.releaseStage('A');
  });
});
