// Every binary record layout of the simulation against the design contract itself: the sizes
// docs/design/sim-core.md states, row by row its offset tables, and the rules every layout
// must obey (no overlap, every byte listed, WGSL alignment, narrow fields only in the roles
// determinism rule 7 allows). The contract is read from the document, not copied into the test.
import {
  FIELD_BYTES,
  layoutProblems,
  NARROW_FIELD_ROLES,
  NARROW_FIELD_TYPES,
  type DrainDown,
  type KHot,
  type LayoutField,
  type RecordLayout,
  type SSlow,
} from '@spotless/sim-core';
import { describe, expect, it } from 'vitest';
import { extractOffsetTable, extractStatedSizes } from './contract-document.ts';
import { readContract, readPackageSources } from './node/workspace.ts';
import { allRecordLayouts, MODULE_OF_PACKAGE } from './record-layouts.ts';

const contract = readContract();
const layouts = allRecordLayouts();
const byName = new Map(layouts.map((l) => [l.layout.name, l.layout]));

/** The scalar storage types of a layout's elements, with the byte each starts at, in byte order. */
function elements(layout: RecordLayout): { offset: number; type: string; field: LayoutField }[] {
  const list: { offset: number; type: string; field: LayoutField }[] = [];
  for (const field of layout.fields) {
    const stride = field.stride ?? FIELD_BYTES[field.type];
    for (let k = 0; k < (field.count ?? 1); k++) {
      list.push({ offset: field.offset + k * stride, type: field.type, field });
    }
  }
  return list.sort((a, b) => a.offset - b.offset);
}

describe('every record layout the simulation packages export', () => {
  it('is found: forty layouts at least, each under a distinct record name', () => {
    expect(layouts.length).toBeGreaterThanOrEqual(40);
    expect(byName.size).toBe(layouts.length);
  });

  it.each(layouts.map((l) => [l.exportName, l.layout] as const))(
    '%s obeys the layout rules',
    (_name, layout) => {
      expect(layoutProblems(layout)).toEqual([]);
    },
  );

  it('keeps narrow fields out of the state and accumulator roles (determinism rule 7)', () => {
    // Stated on its own because it is the rule the contract's red team added: f16 soil water
    // stalls hydration, a u8 fill fraction freezes.
    const offenders: string[] = [];
    for (const { layout } of layouts) {
      for (const field of layout.fields) {
        if (NARROW_FIELD_TYPES.includes(field.type) && !NARROW_FIELD_ROLES.includes(field.role)) {
          offenders.push(`${layout.name}.${field.name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is declared once, in a package at or below the module that owns the record', () => {
    // A layout lives in the owner's package, or in a lower one when a module below the owner
    // reads the record. Either way the owner's entry point must export it, which it does by
    // re-exporting the packages it depends on.
    const moduleNumber = (id: string): number => Number(id.slice(1));
    const declaredIn = new Map<string, string>();
    for (const pkg of Object.keys(MODULE_OF_PACKAGE)) {
      for (const [, text] of readPackageSources(pkg)) {
        for (const match of text.matchAll(/export const (\w+_LAYOUT)\b/g)) {
          const name = match[1] as string;
          expect(declaredIn.has(name), `${name} declared twice`).toBe(false);
          declaredIn.set(name, pkg);
        }
      }
    }
    for (const { exportName } of layouts) {
      expect(declaredIn.has(exportName), `${exportName} has no declaration`).toBe(true);
    }
    for (const { exportName, layout } of layouts) {
      const home = MODULE_OF_PACKAGE[declaredIn.get(exportName) as string] as string;
      expect(
        moduleNumber(home),
        `${exportName} is declared in ${home}, above its owner ${layout.owner}`,
      ).toBeLessThanOrEqual(moduleNumber(layout.owner));
    }
  });
});

describe('decoded record types', () => {
  it('are derived from the layouts: one property per field that is not padding', () => {
    // The object literals must compile against the types derived from the layouts; their keys
    // are then compared with the fields at run time.
    const drain: DrainDown = { h2: 31e-6, h10: 14e-6, h60: 5.7e-6, tDewet: 60, endState: 0 };
    const hot: KHot = { m: 6.8e-7, q: 1e-9, b: 0, dewetCounter: 0, regime: 3, f: 1 };
    const slow: SSlow = { b: 0 };
    const named = (layout: RecordLayout): string[] =>
      layout.fields.filter((f) => !f.pad).map((f) => f.name);
    expect(Object.keys(drain)).toEqual(named(byName.get('DrainDown') as RecordLayout));
    expect(Object.keys(hot)).toEqual(named(byName.get('KHot') as RecordLayout));
    // `SSlow` is "bead store b f32 (m); spare u32": the spare word is not a property.
    expect(Object.keys(slow)).toEqual(named(byName.get('SSlow') as RecordLayout));
    expect(byName.get('SSlow')?.fields).toHaveLength(2);
  });
});

describe('record sizes the contract states', () => {
  const stated = extractStatedSizes(contract);

  it('finds the twenty-five sizes of sections 3, 4 and 5', () => {
    expect(stated.map((s) => s.name).sort()).toEqual([
      'BlockAux',
      'BlockRelease',
      'BlockStatic',
      'BvhNode',
      'DrainDown',
      'EffectiveExposure',
      'FilmExposure',
      'FilmStats',
      'FootprintRecord',
      'HitRecord',
      'Instance',
      'JetExposure',
      'KHot',
      'KParams',
      'Parcel',
      'Primitive',
      'ReservoirLiquor',
      'SFilm',
      'SSlow',
      'SStatic',
      'SectorRecord',
      'SoilCell',
      'SoilStatic',
      'SourceRecord',
      'TimelineBlock',
    ]);
  });

  // SourceRecord is the one record whose listed fields (34 bytes) do not fit the stated size
  // (32): it is 36 bytes here, and the test fixes both numbers so that a correction of either
  // side is noticed.
  const exceptions: Readonly<Record<string, number>> = { SourceRecord: 36 };

  it.each(stated.map((s) => [s.name, s.bytes, s.source] as const))(
    '%s is %i bytes',
    (name, bytes) => {
      const layout = byName.get(name);
      expect(layout, `no layout named ${name}`).toBeDefined();
      const expected = exceptions[name] ?? bytes;
      expect(layout?.byteSize).toBe(expected);
      if (name in exceptions) expect(bytes).toBe(32);
    },
  );
});

describe('offset tables of the contract', () => {
  // Where each offset table stands in the document.
  const tables: readonly (readonly [string, string])[] = [
    ['BlockStatic', '`BlockStatic`, 96 bytes per block:'],
    ['FilmStats', '`FilmStats`. Sampled every'],
    ['SoilCell', '**State.** `SoilCell`, 136 bytes'],
    ['TimelineBlock', '`TimelineBlock`, 64 bytes'],
    ['EffectiveExposure', '`EffectiveExposure`, 40 bytes per film cell and tick'],
    ['FilmExposure', '### 5.2 FilmExposure'],
    ['DrainDown', '### 5.3 DrainDown'],
    ['JetExposure', '### 5.4 JetExposure'],
  ];

  it.each(tables)(
    '%s: every row starts where the previous one ends, in the contract and in the layout',
    (name, anchor) => {
      const rows = extractOffsetTable(contract, anchor);
      const layout = byName.get(name) as RecordLayout;
      expect(rows.length).toBeGreaterThan(2);

      // The contract's own table is gap-free and ends at the size of the record.
      rows.forEach((row, i) => {
        const next = rows[i + 1]?.offset ?? layout.byteSize;
        expect(row.offset + row.bytes, `${name} row at ${row.offset}`).toBe(next);
      });

      // The layout has, in each row's bytes, exactly the scalar types the row lists, in order.
      // (A row the contract types as plain u8 may hold a log-coded byte: "gap (log code)".)
      const mine = elements(layout);
      for (const row of rows) {
        const inRow = mine.filter(
          (e) => e.offset >= row.offset && e.offset < row.offset + row.bytes,
        );
        const types = inRow.map((e) =>
          e.field.pad && row.scalars.includes('pad') ? 'pad' : e.type,
        );
        const expected = [...row.scalars];
        if (expected.every((s) => s === 'pad')) {
          // "28 bytes": reserved space, whatever words the layout pads it with.
          expect(
            inRow.every((e) => e.field.pad === true),
            `${name} row at ${row.offset}`,
          ).toBe(true);
          expect(inRow.reduce((sum, e) => sum + FIELD_BYTES[e.field.type], 0)).toBe(row.bytes);
          continue;
        }
        const matches = types.map(
          (type, i) => type === expected[i] || (type === 'log8' && expected[i] === 'u8'),
        );
        expect(types.length, `${name} row at ${row.offset} (${row.field})`).toBe(expected.length);
        expect(
          matches.every(Boolean),
          `${name} row at ${row.offset}: ${types.join(' ')} against ${row.type}`,
        ).toBe(true);
        expect(inRow[0]?.offset, `${name} row ${row.field}`).toBe(row.offset);
      }
    },
  );

  it('gives a log range to every field the contract tables type as log u8', () => {
    for (const [name, anchor] of tables) {
      const layout = byName.get(name) as RecordLayout;
      const mine = elements(layout);
      for (const row of extractOffsetTable(contract, anchor)) {
        if (!row.scalars.includes('log8')) continue;
        const coded = mine.filter(
          (e) => e.offset >= row.offset && e.offset < row.offset + row.bytes && e.type === 'log8',
        );
        expect(coded.length, `${name} ${row.field}`).toBe(
          row.scalars.filter((s) => s === 'log8').length,
        );
        for (const e of coded)
          expect(e.field.log?.min, `${name}.${e.field.name}`).toBeGreaterThan(0);
      }
    }
  });
});
