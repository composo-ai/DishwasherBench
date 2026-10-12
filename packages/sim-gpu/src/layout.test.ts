// Tests of the layout vocabulary of module M1: the checker that every record layout of every
// simulation package must pass (sizes, overlaps, WGSL alignment, determinism rule 7), and the
// shared fixed-point units against the figures the contract derives from them.
import { describe, expect, it } from 'vitest';
import {
  BINDING_BYTES_LIMIT,
  FIELD_BYTES,
  FIELD_TYPES,
  fieldRuleProblems,
  HEAT_UNIT_J,
  INTEGER_FIELD_MAX,
  layoutProblems,
  NARROW_FIELD_ROLES,
  NARROW_FIELD_TYPES,
  SOIL_MASS_UNIT_KG,
  WATER_MASS_UNIT_KG,
  WATER_MOMENTUM_UNIT_KG_M_S,
  type FieldRole,
  type LayoutField,
  type RecordLayout,
  type RecordOf,
} from './index.ts';

/** A sound 16-byte record with every kind of field, used as the starting point of each case. */
const SOUND = {
  name: 'Example',
  section: 'test',
  owner: 'M1',
  per: 'element',
  byteSize: 16,
  fields: [
    { name: 'mass', type: 'u32', offset: 0, role: 'state', unit: 'kg', scale: 1e-12, doc: 'x' },
    { name: 'height', type: 'f16', offset: 4, role: 'statistic', unit: 'm', scale: 1e-6, doc: 'x' },
    {
      name: 'samples',
      type: 'u16',
      offset: 6,
      role: 'counter',
      unit: '1',
      bound: 3648,
      doc: 'x',
    },
    { name: 'duty', type: 'u8', offset: 8, count: 3, role: 'statistic', unit: '1', doc: 'x' },
    {
      name: 'peak',
      type: 'log8',
      offset: 11,
      role: 'statistic',
      unit: 'Pa',
      log: { min: 10, max: 1e5 },
      doc: 'x',
    },
    {
      name: 'word',
      type: 'u32',
      offset: 12,
      role: 'static',
      unit: '-',
      bits: [
        { name: 'offset', lsb: 0, width: 31, doc: 'x' },
        { name: 'flag', lsb: 31, width: 1, doc: 'x' },
      ],
      doc: 'x',
    },
  ],
} as const satisfies RecordLayout;

/** A copy of the sound record with one field replaced or added. */
function withField(name: string, change: Partial<LayoutField>): RecordLayout {
  return {
    ...SOUND,
    fields: SOUND.fields.map((f) => (f.name === name ? { ...f, ...change } : f)),
  };
}

describe('layoutProblems', () => {
  it('accepts a sound record', () => {
    expect(layoutProblems(SOUND)).toEqual([]);
  });

  it('reports a record whose fields do not add up to its size', () => {
    // 20 bytes declared, 16 listed: the last word belongs to no field.
    const problems = layoutProblems({ ...SOUND, byteSize: 20 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('bytes 16 to 19 belong to no field');
    // 12 bytes declared: the last field ends beyond the record.
    expect(layoutProblems({ ...SOUND, byteSize: 12 }).join('\n')).toContain('beyond the record');
  });

  it('reports a size that is not a whole number of 32-bit words', () => {
    const fields: LayoutField[] = [
      { name: 'a', type: 'u16', offset: 0, count: 3, role: 'static', unit: '-', doc: 'x' },
    ];
    const base = { name: 'Odd', section: 'test', owner: 'M1', per: 'element' };
    expect(layoutProblems({ ...base, byteSize: 6, fields }).join('\n')).toContain(
      'neither a multiple of 4',
    );
    // Records of 1 or 2 bytes are allowed: they are packed into words.
    expect(
      layoutProblems({
        ...base,
        byteSize: 2,
        fields: [{ name: 'a', type: 'f16', offset: 0, role: 'statistic', unit: 'm', doc: 'x' }],
      }),
    ).toEqual([]);
  });

  it('reports overlapping fields', () => {
    const problems = layoutProblems(withField('height', { offset: 2 }));
    expect(problems.join('\n')).toContain('field height overlaps field mass at byte 2');
  });

  it('reports a field that is not aligned to its own size', () => {
    // A 32-bit word at offset 6 could not be a WGSL struct member.
    const fields: LayoutField[] = [
      { name: 'a', type: 'u16', offset: 0, count: 3, role: 'static', unit: '-', doc: 'x' },
      { name: 'b', type: 'f32', offset: 6, role: 'state', unit: 'm', doc: 'x' },
      { name: 'c', type: 'u16', offset: 10, role: 'static', unit: '-', doc: 'x' },
    ];
    const problems = layoutProblems({
      name: 'Misaligned',
      section: 'test',
      owner: 'M1',
      per: 'element',
      byteSize: 12,
      fields,
    });
    expect(problems).toEqual([
      'Misaligned: field b (f32) at offset 6, stride 4 is not aligned to 4 bytes',
    ]);
    // A 16-bit field at an odd offset would straddle a byte pair.
    expect(layoutProblems(withField('samples', { offset: 7 })).join('\n')).toContain(
      'not aligned to 2 bytes',
    );
  });

  it('allows narrow fields only the roles of determinism rule 7', () => {
    const allowed: FieldRole[] = ['static', 'statistic', 'counter'];
    expect([...NARROW_FIELD_ROLES].sort()).toEqual([...allowed].sort());
    for (const type of NARROW_FIELD_TYPES) {
      for (const role of ['state', 'accumulator'] as const) {
        const field: LayoutField = {
          name: 'x',
          type,
          offset: 0,
          count: 4 / FIELD_BYTES[type],
          role,
          unit: '1',
          bound: 1,
          ...(type === 'log8' ? { log: { min: 1, max: 2 } } : {}),
          doc: 'x',
        };
        if (type === 'f16' || type === 'log8') delete (field as { bound?: number }).bound;
        const problems = layoutProblems({
          name: 'Narrow',
          section: 'test',
          owner: 'M1',
          per: 'element',
          byteSize: 4,
          fields: [field],
        });
        expect(problems.join('\n'), `${type} ${role}`).toContain('determinism rule 7');
      }
    }
    // The same roles are fine on 32-bit words.
    expect(layoutProblems(withField('mass', { role: 'accumulator', bound: 2 ** 31 }))).toEqual([]);
  });

  it('requires a bound within the type on integer accumulators and counters', () => {
    const noBound = SOUND.fields.map((f) => {
      if (f.name !== 'samples') return f;
      const { bound: _bound, ...rest } = f;
      return rest;
    });
    expect(layoutProblems({ ...SOUND, fields: noBound }).join('\n')).toContain(
      'integer counter without a registered bound',
    );
    expect(layoutProblems(withField('samples', { bound: 65536 })).join('\n')).toContain(
      'bound 65536, outside 1 to 65535',
    );
    expect(layoutProblems(withField('height', { bound: 10 })).join('\n')).toContain(
      'has a bound but is stored as f16',
    );
  });

  it('holds a field to one rule whether it comes from a layout or a field list', () => {
    // A counter is an integer with a bound (rule 7; M1, "Narrow fields").
    for (const type of ['f16', 'log8', 'f32'] as const) {
      expect(fieldRuleProblems({ name: 'n', type, role: 'counter', unit: '1' }), type).toEqual([
        `field n is a counter stored as ${type}, not as an integer`,
      ]);
    }
    expect(fieldRuleProblems({ name: 'n', type: 'u16', role: 'counter', unit: '1' })).toEqual([
      'field n is an integer counter without a registered bound',
    ]);
    expect(
      fieldRuleProblems({ name: 'n', type: 'u16', role: 'counter', unit: '1', bound: 3430 }),
    ).toEqual([]);
    expect(
      fieldRuleProblems({ name: 'n', type: 'u16', role: 'accumulator', unit: '1', bound: 9 }),
    ).toEqual(['field n is a narrow u16 with role accumulator (determinism rule 7)']);
    // f32 state and accumulators are allowed and carry no bound.
    expect(fieldRuleProblems({ name: 'h', type: 'f32', role: 'state', unit: 'm' })).toEqual([]);
    expect(fieldRuleProblems({ name: 'h', type: 'f32', role: 'accumulator', unit: 'm' })).toEqual(
      [],
    );
    // The layout checker reports the same sentences, prefixed with the layout's name.
    expect(layoutProblems(withField('height', { role: 'counter' }))).toEqual([
      'Example: field height is a counter stored as f16, not as an integer',
    ]);
  });

  it('allows saturating on integer, f16 and log8 fields, not on f32', () => {
    expect(layoutProblems(withField('height', { saturating: true }))).toEqual([]);
    expect(layoutProblems(withField('samples', { saturating: true }))).toEqual([]);
    const f32Layout: RecordLayout = {
      name: 'F',
      section: 'test',
      owner: 'M1',
      per: 'element',
      byteSize: 4,
      fields: [
        { name: 'x', type: 'f32', offset: 0, role: 'state', unit: '1', saturating: true, doc: 'x' },
      ],
    };
    expect(layoutProblems(f32Layout)).toEqual([
      'F: field x is marked saturating but is stored as f32',
    ]);
  });

  it('requires a log range on log8 fields and nowhere else', () => {
    const noRange = SOUND.fields.map((f) => {
      if (f.name !== 'peak') return f;
      const { log: _log, ...rest } = f;
      return rest;
    });
    expect(layoutProblems({ ...SOUND, fields: noRange }).join('\n')).toContain(
      'log8 without a log range',
    );
    expect(layoutProblems(withField('peak', { log: { min: 0, max: 1 } })).join('\n')).toContain(
      'log range 0 to 1',
    );
    expect(layoutProblems(withField('mass', { log: { min: 1, max: 2 } })).join('\n')).toContain(
      'log range but is stored as u32',
    );
  });

  it('checks bit sub-fields', () => {
    expect(
      layoutProblems(
        withField('word', {
          bits: [
            { name: 'a', lsb: 0, width: 20, doc: 'x' },
            { name: 'b', lsb: 19, width: 4, doc: 'x' },
          ],
        }),
      ).join('\n'),
    ).toContain('bits b overlap another sub-field at bit 19');
    expect(
      layoutProblems(
        withField('word', { bits: [{ name: 'a', lsb: 30, width: 4, doc: 'x' }] }),
      ).join('\n'),
    ).toContain('end at bit 34 of a 32-bit element');
  });

  it('reports duplicate names but lets padding repeat', () => {
    const fields: LayoutField[] = [
      { name: 'a', type: 'u32', offset: 0, role: 'static', unit: '-', doc: 'x' },
      { name: 'a', type: 'u32', offset: 4, role: 'static', unit: '-', doc: 'x' },
      { name: 'spare', type: 'u32', offset: 8, role: 'static', unit: '-', pad: true, doc: 'x' },
      { name: 'spare', type: 'u32', offset: 12, role: 'static', unit: '-', pad: true, doc: 'x' },
    ];
    expect(
      layoutProblems({
        name: 'Twice',
        section: 'test',
        owner: 'M1',
        per: 'element',
        byteSize: 16,
        fields,
      }),
    ).toEqual(['Twice: field a is declared twice']);
  });

  it('places repeated groups with a stride', () => {
    // Four events of {phase u8, peak log8, spare u16}: an array of 4-byte structs.
    const events: RecordLayout = {
      name: 'Events',
      section: 'test',
      owner: 'M1',
      per: 'element',
      byteSize: 16,
      fields: [
        {
          name: 'phase',
          type: 'u8',
          offset: 0,
          count: 4,
          stride: 4,
          role: 'statistic',
          unit: '1',
          doc: 'x',
        },
        {
          name: 'peak',
          type: 'log8',
          offset: 1,
          count: 4,
          stride: 4,
          role: 'statistic',
          unit: 'Pa',
          log: { min: 1, max: 1e4 },
          doc: 'x',
        },
        {
          name: 'spare',
          type: 'u16',
          offset: 2,
          count: 4,
          stride: 4,
          role: 'static',
          unit: '-',
          pad: true,
          doc: 'x',
        },
      ],
    };
    expect(layoutProblems(events)).toEqual([]);
  });
});

describe('RecordOf', () => {
  it('names the decoded fields of a layout and leaves padding out', () => {
    // A compile-time check: this object must be assignable, with arrays for counted fields.
    const decoded: RecordOf<typeof SOUND> = {
      mass: 1e-6,
      height: 1.5e-4,
      samples: 12,
      duty: [0.1, 0.2, 0.3],
      peak: 100,
      word: 0x80000010,
    };
    expect(Object.keys(decoded).sort()).toEqual(SOUND.fields.map((f) => f.name).sort() as string[]);
  });
});

describe('storage types and shared fixed-point units (section 4)', () => {
  it('gives every storage type its size and an integer range where it has one', () => {
    expect(FIELD_TYPES.map((t) => FIELD_BYTES[t])).toEqual([4, 4, 4, 2, 2, 2, 1, 1]);
    expect(INTEGER_FIELD_MAX.u8).toBe(255);
    expect(INTEGER_FIELD_MAX.i16).toBe(32767);
    expect(INTEGER_FIELD_MAX.f16).toBeUndefined();
  });

  it('reproduces the figures the contract derives from the water mass unit', () => {
    // "one unit is 0.25 nm of film on a 4 mm2 block" (water, 1000 kg/m3)
    expect(WATER_MASS_UNIT_KG / (1000 * 4e-6)).toBeCloseTo(0.25e-9, 15);
    // "a u32 holds 4.3 g, an i32 accumulator +/- 2.1 g per base step"
    expect(2 ** 32 * WATER_MASS_UNIT_KG * 1000).toBeCloseTo(4.3, 1);
    expect(2 ** 31 * WATER_MASS_UNIT_KG * 1000).toBeCloseTo(2.1, 1);
    // "range 2.1 x 10^-3 kg m/s; a 0.34 g drip at 3 m/s ... uses under 5 % of it per cell":
    // the whole drip is 0.34e-3 * 3 = 1.02e-3 kg m/s, so it must be spread over at least 10 cells.
    const range = 2 ** 31 * WATER_MOMENTUM_UNIT_KG_M_S;
    expect(range).toBeCloseTo(2.1e-3, 4);
    expect((0.34e-3 * 3) / range / 0.05).toBeGreaterThan(9);
  });

  it('holds the largest soil release and block heat the contract plans for', () => {
    // A 1 mm2 soil cell carrying 1 kg/m2 of dry soil (a 1 mm deposit) removed in one tick.
    expect(1e-6 / SOIL_MASS_UNIT_KG).toBeLessThan(2 ** 32);
    // A 4 mm2 block of 6 mm porcelain (2400 kg/m3, 1000 J/(kg K)) stepping by 35 K in one tick.
    const joules = 4e-6 * 6e-3 * 2400 * 1000 * 35;
    expect(joules / HEAT_UNIT_J).toBeLessThan(2 ** 31);
    // A binding of exactly 4 GiB is beyond the limit; the largest advertised binding is at it.
    expect(BINDING_BYTES_LIMIT).toBe(4294967292);
    expect(2 ** 32).toBeGreaterThan(BINDING_BYTES_LIMIT);
  });
});
