// Unit tests of the readers of the design contract, on small inputs with hand-computed
// results, so that the tests which compare the code with the contract rest on readers that
// are themselves checked.
import { describe, expect, it } from 'vitest';
import {
  expandTypeCell,
  extractDeclarations,
  extractModuleTable,
  extractOffsetTable,
  extractStatedSizes,
  extractTsBlocks,
  memberNames,
  stripComments,
} from './contract-document.ts';

describe('extractModuleTable', () => {
  it('reads id, package and the cells of "Depends on"', () => {
    const markdown = [
      '| Id | Package | Responsibility | Runs on | Depends on |',
      '|---|---|---|---|---|',
      '| M3 | `@spotless/sim-scene` | atlas, primitives | CPU + GPU | geometry, machine, M1, M2 |',
      '| M12 | `@spotless/sim-core` | orchestration | CPU | all |',
      '| not a row | of the table |',
    ].join('\n');
    expect(extractModuleTable(markdown)).toEqual([
      { id: 'M3', package: 'sim-scene', dependsOn: ['geometry', 'machine', 'M1', 'M2'] },
      { id: 'M12', package: 'sim-core', dependsOn: ['all'] },
    ]);
  });
});

describe('extractStatedSizes', () => {
  it('reads the three forms in which the contract states a size', () => {
    const markdown = [
      '`HitRecord`, 32 bytes: t f32; instance u32. `BvhNode`, 32 bytes: min vec3 f32.',
      '### 5.3 DrainDown: 8 bytes per block, per combo',
      '| `KHot` (per block, two copies) | 16 | m_u u32 |',
      '| deposit accumulators (current and next) | 20 per S cell; 8 per K block | i32 words |',
      'A record of 32 bytes without a name is not a stated size.',
    ].join('\n');
    expect(extractStatedSizes(markdown).map((s) => [s.name, s.bytes])).toEqual([
      ['HitRecord', 32],
      ['BvhNode', 32],
      ['DrainDown', 8],
      ['KHot', 16],
    ]);
  });
});

describe('expandTypeCell', () => {
  it('expands counts, vectors, normalisations and log codes', () => {
    expect(expandTypeCell('vec3 f32; f32', 'world centre; area (m2)')).toEqual([
      'f32',
      'f32',
      'f32',
      'f32',
    ]);
    expect(expandTypeCell('2 x i16; i16; f16', 'normal; direction; sin(beta)')).toEqual([
      'i16',
      'i16',
      'i16',
      'f16',
    ]);
    expect(expandTypeCell('8 x u16 / 65535', 'donorWeight[8]')).toEqual(new Array(8).fill('u16'));
    expect(expandTypeCell('2 x log u8', 'mfMean, mfPeak')).toEqual(['log8', 'log8']);
    expect(expandTypeCell('u16; u8 / 255; u8', 'flags; widthFrac; spare')).toEqual([
      'u16',
      'u8',
      'u8',
    ]);
  });

  it('takes the count from the field when the type has none', () => {
    // "w[12] | f32": twelve; "tauDuty[5] | 5 x u8 / 255": five, not twenty-five.
    expect(expandTypeCell('f32', 'w[12]')).toHaveLength(12);
    expect(expandTypeCell('u8 / 255', 'tauDuty[4]')).toEqual(['u8', 'u8', 'u8', 'u8']);
    expect(expandTypeCell('5 x u8 / 255', 'tauDuty[5]')).toHaveLength(5);
    expect(expandTypeCell('u16', 'tExcTau[8]')).toHaveLength(8);
  });

  it('expands a repeated group and a number of bytes', () => {
    expect(
      expandTypeCell('4 x {phase u8, tauPk log u8, MPk log u8, t10 log u8}', 'event[4]'),
    ).toEqual(new Array(4).fill(['u8', 'log8', 'log8', 'log8']).flat());
    expect(expandTypeCell('28 bytes', 'reserved')).toEqual(new Array(28).fill('pad'));
  });

  it('refuses a cell it cannot read', () => {
    expect(() => expandTypeCell('quaternion', 'q')).toThrow(/cannot read/);
  });
});

describe('extractOffsetTable', () => {
  const markdown = [
    'Some prose. `Example`, 12 bytes:',
    '',
    '| Offset | Field | Type | Unit |',
    '|---|---|---|---|',
    '| 0 | a, b | 2 x f16 | um |',
    '| 4 | c[4] | u8 / 255 | - |',
    '| 8 | d | u32 | - |',
    '',
    '| Offset | Field | Type |',
    '|---|---|---|',
    '| 0 | other | f32 |',
  ].join('\n');

  it('reads the first table after the anchor, with the bytes of each row', () => {
    const rows = extractOffsetTable(markdown, '`Example`, 12 bytes');
    expect(rows.map((r) => [r.offset, r.bytes])).toEqual([
      [0, 4],
      [4, 4],
      [8, 4],
    ]);
    expect(rows[1]?.scalars).toEqual(['u8', 'u8', 'u8', 'u8']);
  });

  it('throws when the anchor or the table is missing', () => {
    expect(() => extractOffsetTable(markdown, '`Missing`')).toThrow(/anchor not found/);
    expect(() => extractOffsetTable('`Lonely`, 4 bytes and no table', '`Lonely`')).toThrow(
      /no offset table/,
    );
  });
});

describe('TypeScript readers', () => {
  it('strips comments, which may contain colons and braces', () => {
    const source =
      'a: number; /* 64 x (level m, volume m3): { */ b: string; // c: gone\nd: boolean';
    expect(memberNames(stripComments(source))).toEqual(['a', 'b', 'd']);
  });

  it('names properties, optional properties, methods, parameters and tuple labels', () => {
    const body =
      '{ readonly epoch: number; filmClassOverride?: FilmClass; build(items: readonly WashItem[]): Promise<Scene>; ' +
      'itemBlocks: ReadonlyMap<string, readonly [first: number, count: number]> }';
    expect(memberNames(body)).toEqual([
      'epoch',
      'filmClassOverride',
      'build',
      'items',
      'itemBlocks',
      'first',
      'count',
    ]);
  });

  it('finds interfaces, type aliases over several union members, and functions', () => {
    const block = [
      "type ArmState = { kind: 'free' } | { kind: 'stalled'; angleQ: number } | { kind: 'knocking'; profile: string };",
      'interface ComboId { diverter: string; arms: readonly ArmState[] }',
      'interface Outer { inner: { deep: number }; after: string }',
      'function wash(input: WashInput, env: { gpu: GpuContext }): Promise<WashResult>;',
    ].join('\n');
    expect(extractDeclarations(block)).toEqual([
      { kind: 'type', name: 'ArmState', members: ['kind', 'angleQ', 'profile'] },
      { kind: 'interface', name: 'ComboId', members: ['diverter', 'arms'] },
      { kind: 'interface', name: 'Outer', members: ['inner', 'deep', 'after'] },
      { kind: 'function', name: 'wash', members: ['input', 'env', 'gpu'] },
    ]);
  });

  it('takes only the ts code blocks of a document', () => {
    const markdown =
      'text\n```ts\ninterface A { x: number }\n```\n```\nnot ts: y\n```\n```ts\ntype B = 1;\n```';
    expect(extractTsBlocks(markdown)).toHaveLength(2);
  });
});
