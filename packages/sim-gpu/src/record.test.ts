// CPU side of the record helpers of module M1: half-precision conversion against IEEE 754
// values worked out by hand, the record view against bytes written by hand, log coding against
// the contract's formula (section 5.1), bit sub-fields, and the vocabulary fixes of layout.ts.
import { describe, expect, it } from 'vitest';
import { f16BitsToNumber, F16_MAX, F16_MIN_NORMAL, numberToF16Bits } from './f16.ts';
import {
  isExactIntegerField,
  layoutProblems,
  packBits,
  unpackBits,
  type LayoutField,
  type RecordLayout,
} from './layout.ts';
import {
  log8Decode,
  log8Encode,
  log8EncodeChecked,
  recordBufferBytes,
  recordInclude,
  recordView,
  recordWgsl,
  wgslFloat,
  wgslIdentifier,
} from './record.ts';

describe('half precision', () => {
  it('decodes the bit patterns of IEEE 754 binary16', () => {
    expect(f16BitsToNumber(0x0000)).toBe(0);
    expect(Object.is(f16BitsToNumber(0x8000), -0)).toBe(true);
    expect(f16BitsToNumber(0x3c00)).toBe(1);
    expect(f16BitsToNumber(0xc000)).toBe(-2);
    expect(f16BitsToNumber(0x3555)).toBe(0.333251953125); // nearest half to 1/3
    expect(f16BitsToNumber(0x7bff)).toBe(65504);
    expect(f16BitsToNumber(0x0400)).toBe(2 ** -14);
    expect(f16BitsToNumber(0x0001)).toBe(2 ** -24); // smallest subnormal
    expect(f16BitsToNumber(0x03ff)).toBe(1023 * 2 ** -24); // largest subnormal
    expect(f16BitsToNumber(0x7c00)).toBe(Infinity);
    expect(f16BitsToNumber(0xfc00)).toBe(-Infinity);
    expect(Number.isNaN(f16BitsToNumber(0x7e00))).toBe(true);
    expect(F16_MAX).toBe(65504);
    expect(F16_MIN_NORMAL).toBe(2 ** -14);
  });

  it('encodes every one of the 65,536 patterns back to itself', () => {
    let wrong = 0;
    for (let bits = 0; bits < 65536; bits++) {
      const isNan = (bits & 0x7c00) === 0x7c00 && (bits & 0x3ff) !== 0;
      const back = numberToF16Bits(f16BitsToNumber(bits));
      if (isNan ? back !== 0x7e00 : back !== bits) wrong++;
    }
    expect(wrong).toBe(0);
  });

  it('rounds to nearest, ties to even, and overflows to infinity', () => {
    // Between 1 (0x3c00) and 1 + 2^-10 (0x3c01): the tie goes to the even pattern.
    expect(numberToF16Bits(1 + 2 ** -11)).toBe(0x3c00);
    expect(numberToF16Bits(1 + 2 ** -11 + 2 ** -30)).toBe(0x3c01);
    // Between 0x3c01 and 0x3c02 the tie goes up, to the even 0x3c02.
    expect(numberToF16Bits(1 + 3 * 2 ** -11)).toBe(0x3c02);
    // Just below 2: rounds up into the next exponent.
    expect(numberToF16Bits(2 - 2 ** -12)).toBe(0x4000);
    // Overflow: 65520 is the tie between 65504 and 2^16 and goes to infinity; below it does not.
    expect(numberToF16Bits(65519.99)).toBe(0x7bff);
    expect(numberToF16Bits(65520)).toBe(0x7c00);
    expect(numberToF16Bits(-1e9)).toBe(0xfc00);
    // Subnormals: units of 2^-24; half a unit is a tie that goes to zero (even).
    expect(numberToF16Bits(2 ** -25)).toBe(0x0000);
    expect(numberToF16Bits(1.5 * 2 ** -24)).toBe(0x0002);
    expect(numberToF16Bits(2 ** -14 - 2 ** -26)).toBe(0x0400); // rounds up to the smallest normal
    expect(numberToF16Bits(-0)).toBe(0x8000);
    expect(numberToF16Bits(NaN)).toBe(0x7e00);
    // The contract's remark: an SI value below 6e-5 would be subnormal.
    expect(numberToF16Bits(6e-5) & 0x7c00).toBe(0);
    expect(numberToF16Bits(6.2e-5) & 0x7c00).not.toBe(0);
  });
});

const CELL = {
  name: 'Cell',
  section: 'test',
  owner: 'M1',
  per: 'cell',
  byteSize: 20,
  fields: [
    { name: 'm', type: 'u32', offset: 0, role: 'state', unit: 'kg', scale: 1e-12, doc: 'x' },
    {
      name: 'q',
      type: 'i32',
      offset: 4,
      role: 'accumulator',
      unit: 'kg m/s',
      scale: 1e-12,
      bound: 2 ** 31 - 1,
      doc: 'x',
    },
    { name: 'h', type: 'f16', offset: 8, role: 'statistic', unit: 'm', scale: 1e-6, doc: 'x' },
    {
      name: 'duty',
      type: 'u8',
      offset: 10,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      saturating: true,
      doc: 'x',
    },
    {
      name: 'tau',
      type: 'log8',
      offset: 11,
      role: 'statistic',
      unit: 'Pa',
      log: { min: 0.01, max: 1e4 },
      doc: 'x',
    },
    {
      name: 'v',
      type: 'i16',
      offset: 12,
      count: 2,
      role: 'static',
      unit: 'm/s',
      scale: 1e-3,
      doc: 'x',
    },
    {
      name: 'word',
      type: 'u32',
      offset: 16,
      role: 'static',
      unit: '-',
      bits: [
        { name: 'regime', lsb: 0, width: 2, doc: 'x' },
        { name: 'offset', lsb: 2, width: 29, doc: 'x' },
        { name: 'wet', lsb: 31, width: 1, doc: 'x' },
      ],
      doc: 'x',
    },
  ],
} as const satisfies RecordLayout;

describe('recordView', () => {
  it('reads a record whose bytes were written by hand', () => {
    const bytes = new Uint8Array(40);
    // Record 1 at byte 20, little-endian.
    bytes.set([0x00, 0xe4, 0x0b, 0x54], 20); // m = 0x540be400 = 1,410,065,408 units
    bytes.set([0xfe, 0xff, 0xff, 0xff], 24); // q = -2
    bytes.set([0x00, 0x3c], 28); // h = 1.0 (half) in micrometres
    bytes[30] = 51; // duty = 51 / 255 = 0.2
    bytes[31] = 255; // tau = max
    bytes.set([0x18, 0xfc, 0xe8, 0x03], 32); // v = -1000, 1000 mm/s
    bytes.set([0x06, 0x00, 0x00, 0x80], 36); // regime 2, offset 1, wet 1
    const view = recordView(CELL, bytes);
    expect(view.count).toBe(2);
    expect(view.raw(1, 'm')).toBe(1410065408);
    expect(view.value(1, 'm')).toBeCloseTo(1.410065408e-3, 15);
    expect(view.raw(1, 'q')).toBe(-2);
    expect(view.raw(1, 'h')).toBe(1);
    expect(view.value(1, 'h')).toBe(1e-6);
    expect(view.value(1, 'duty')).toBeCloseTo(0.2, 15);
    expect(view.value(1, 'tau')).toBeCloseTo(1e4, 9);
    expect([view.raw(1, 'v', 0), view.raw(1, 'v', 1)]).toEqual([-1000, 1000]);
    expect(view.value(1, 'v', 0)).toBeCloseTo(-1, 15);
    expect(view.raw(1, 'word')).toBe(0x80000006);
    expect(view.bits(1, 'word', 'regime')).toBe(2);
    expect(view.bits(1, 'word', 'offset')).toBe(1);
    expect(view.bits(1, 'word', 'wet')).toBe(1);
    // Record 0 is all zero.
    expect(view.decode(0)).toEqual({ m: 0, q: 0, h: 0, duty: 0, tau: 0, v: [0, 0], word: 0 });
  });

  it('writes the bytes a record must have', () => {
    const bytes = new Uint8Array(20);
    const view = recordView(CELL, bytes);
    view.setRaw(0, 'm', 0x01020304);
    view.setRaw(0, 'q', -1);
    view.setValue(0, 'h', 2e-6); // 2 micrometres: half 0x4000
    view.setValue(0, 'duty', 1);
    view.setValue(0, 'tau', 0.01 * (1e4 / 0.01) ** (128 / 255));
    view.setValue(0, 'v', 0.5, 1); // 500 mm/s = 0x01f4
    view.setBits(0, 'word', 'offset', 2 ** 29 - 1);
    view.setBits(0, 'word', 'wet', 1);
    view.setBits(0, 'word', 'regime', 3);
    view.setBits(0, 'word', 'regime', 1); // replacing a sub-field leaves the others
    expect([...bytes]).toEqual([
      0x04, 0x03, 0x02, 0x01, 0xff, 0xff, 0xff, 0xff, 0x00, 0x40, 0xff, 128, 0x00, 0x00, 0xf4, 0x01,
      0xfd, 0xff, 0xff, 0xff,
    ]);
  });

  it('refuses stored numbers outside the type, and clamps only saturating fields', () => {
    const view = recordView(CELL, new ArrayBuffer(20));
    expect(() => view.setRaw(0, 'm', 2 ** 32)).toThrow(RangeError);
    expect(() => view.setRaw(0, 'm', -1)).toThrow(RangeError);
    expect(() => view.setRaw(0, 'm', 0.5)).toThrow(RangeError);
    expect(() => view.setRaw(0, 'v', 40000)).toThrow(RangeError);
    // 5e-3 kg is 5e9 units, beyond u32: a ledger field fails, it does not truncate (rule 12).
    expect(() => view.setValue(0, 'm', 5e-3)).toThrow(RangeError);
    // `duty` is saturating: 1.7 is stored as 255.
    view.setValue(0, 'duty', 1.7);
    expect(view.raw(0, 'duty')).toBe(255);
    view.setValue(0, 'duty', -0.2);
    expect(view.raw(0, 'duty')).toBe(0);
    expect(() => view.setBits(0, 'word', 'regime', 4)).toThrow(RangeError);
    expect(() => view.bits(0, 'word', 'nothing')).toThrow(RangeError);
    expect(() => view.raw(1, 'm')).toThrow(RangeError);
    expect(() => view.raw(0, 'v', 2)).toThrow(RangeError);
    expect(() => recordView(CELL, new ArrayBuffer(20), 2)).toThrow(RangeError);
  });

  it('never stores a non-finite float or a wrong log code without failing (rule 12)', () => {
    const view = recordView(CELL, new ArrayBuffer(20));
    // h is an f16 in micrometres. 65,504 um is the largest half; 65,519 um still rounds to it;
    // 65,520 um is the tie that rounds to infinity; 0.07 m is 70,000 um.
    view.setValue(0, 'h', 65504e-6);
    expect(view.raw(0, 'h')).toBe(65504);
    view.setRaw(0, 'h', 65519.99);
    expect(view.raw(0, 'h')).toBe(65504);
    for (const stored of [65520, -65520, 70000, Infinity, -Infinity, NaN]) {
      expect(() => view.setRaw(0, 'h', stored), `raw ${stored}`).toThrow(RangeError);
    }
    expect(() => view.setValue(0, 'h', 0.07)).toThrow(/not a finite f16/);
    expect(() => view.setValue(0, 'h', NaN)).toThrow(RangeError);
    // Nothing was written by the refused calls.
    expect(view.raw(0, 'h')).toBe(65504);
    // tau is log8 over 0.01 to 10,000 Pa and not saturating.
    expect(() => view.setValue(0, 'tau', NaN)).toThrow(/NaN/);
    expect(() => view.setValue(0, 'tau', 1e9)).toThrow(/above the log8 range/);
    expect(() => view.setValue(0, 'tau', -1)).toThrow(/negative/);
    view.setValue(0, 'tau', 1e4);
    expect(view.raw(0, 'tau')).toBe(255);
    // A code step is a factor 10^(6/255), 5.6 %; within half a step (2.7 %) above the top the
    // nearest code is still 255, beyond it there is none.
    view.setValue(0, 'tau', 1e4 * 1.02);
    expect(view.raw(0, 'tau')).toBe(255);
    expect(() => view.setValue(0, 'tau', 1e4 * 1.04)).toThrow(RangeError);
    expect(view.raw(0, 'tau')).toBe(255);
    // Zero is code 0 and a positive value below the range is code 1, as documented.
    view.setValue(0, 'tau', 0);
    expect(view.raw(0, 'tau')).toBe(0);
    view.setValue(0, 'tau', 1e-9);
    expect(view.raw(0, 'tau')).toBe(1);
    // NaN into an integer field, saturating or not.
    expect(() => view.setValue(0, 'm', NaN)).toThrow(RangeError);
    expect(() => view.setValue(0, 'duty', NaN)).toThrow(RangeError);
  });

  it('clamps f16 and log8 fields that are declared saturating, and still refuses NaN', () => {
    const layout = {
      name: 'Sat',
      section: 'test',
      owner: 'M1',
      per: 'cell',
      byteSize: 8,
      fields: [
        {
          name: 'h',
          type: 'f16',
          offset: 0,
          role: 'statistic',
          unit: 'm',
          scale: 1e-6,
          saturating: true,
          doc: 'x',
        },
        {
          name: 'p',
          type: 'log8',
          offset: 2,
          role: 'statistic',
          unit: 'Pa',
          log: { min: 10, max: 1e5 },
          saturating: true,
          doc: 'x',
        },
        { name: 'spare', type: 'u8', offset: 3, role: 'static', unit: '-', pad: true, doc: 'x' },
        { name: 'f', type: 'f32', offset: 4, role: 'state', unit: '1', doc: 'x' },
      ],
    } as const satisfies RecordLayout;
    expect(layoutProblems(layout)).toEqual([]);
    const view = recordView(layout, new ArrayBuffer(8));
    view.setValue(0, 'h', 0.07);
    expect(view.raw(0, 'h')).toBe(65504);
    view.setValue(0, 'h', -1);
    expect(view.raw(0, 'h')).toBe(-65504);
    view.setValue(0, 'p', 3e7);
    expect(view.raw(0, 'p')).toBe(255);
    view.setValue(0, 'p', -5);
    expect(view.raw(0, 'p')).toBe(0);
    expect(() => view.setValue(0, 'h', NaN)).toThrow(RangeError);
    expect(() => view.setValue(0, 'p', NaN)).toThrow(RangeError);
    // An f32 field: the largest f32 is 2^128 - 2^104; 1e39 would be stored as infinity.
    view.setValue(0, 'f', 2 ** 128 - 2 ** 104);
    expect(view.raw(0, 'f')).toBe(2 ** 128 - 2 ** 104);
    for (const value of [1e39, -1e39, 2 ** 128 - 2 ** 103, Infinity, NaN]) {
      expect(() => view.setValue(0, 'f', value), `${value}`).toThrow(/not a finite f32/);
    }
    expect(view.raw(0, 'f')).toBe(2 ** 128 - 2 ** 104);
    // log8Encode is the clamping encoder, log8EncodeChecked the failing one.
    expect(log8Encode(1e9, 10, 1e5)).toBe(255);
    expect(() => log8EncodeChecked(1e9, 10, 1e5)).toThrow(RangeError);
    expect(() => log8Encode(NaN, 10, 1e5)).toThrow(RangeError);
    expect(log8EncodeChecked(1e5, 10, 1e5)).toBe(255);
  });

  it('encodes a decoded record and decodes it back', () => {
    const view = recordView(CELL, new ArrayBuffer(40));
    const record = {
      m: 6.8e-7,
      q: -3e-9,
      h: 31e-6,
      duty: 0.4,
      tau: 12.5,
      v: [0.25, -1.5],
      word: 77,
    };
    view.encode(1, record);
    const back = view.decode(1);
    // Integers are exact multiples of their unit; the others round as their storage does.
    expect(view.raw(1, 'm')).toBe(680000);
    expect(view.raw(1, 'q')).toBe(-3000);
    expect(back.m).toBeCloseTo(6.8e-7, 18);
    expect(back.h).toBeCloseTo(31e-6, 8); // f16: 11 bits of 31
    expect(back.duty).toBeCloseTo(0.4, 2); // u8 / 255
    expect(Math.abs(Math.log(back.tau / 12.5))).toBeLessThan(Math.log(1e6) / 255 / 2 + 1e-12);
    expect(back.v).toEqual([0.25, -1.5]);
    expect(back.word).toBe(77);
    expect(() => view.encode(0, { ...record, v: [1] })).toThrow(RangeError);
  });

  it('sizes buffers in whole words, also for records of one or two bytes', () => {
    expect(recordBufferBytes(CELL, 10)).toBe(200);
    const tiny = { ...CELL, byteSize: 2 };
    expect(recordBufferBytes(tiny, 5)).toBe(12);
    expect(recordBufferBytes({ ...CELL, byteSize: 1 }, 1)).toBe(4);
    expect(recordBufferBytes(CELL, 0)).toBe(4);
  });
});

describe('log coding (section 5.1)', () => {
  it('follows v = min (max / min)^(code / 255) with code 0 meaning zero', () => {
    expect(log8Decode(0, 10, 1e5)).toBe(0);
    expect(log8Decode(255, 10, 1e5)).toBeCloseTo(1e5, 9);
    // 4 decades over 255 codes: code 51 is 0.8 decades above the minimum.
    expect(log8Decode(51, 10, 1e5)).toBeCloseTo(10 * 10 ** 0.8, 9);
    // One code is a factor of 10^(4/255) = 1.0368: the coding error is at most half of that.
    for (const v of [11, 37.5, 1234, 99999]) {
      const back = log8Decode(log8Encode(v, 10, 1e5), 10, 1e5);
      expect(Math.abs(Math.log10(back / v))).toBeLessThanOrEqual(2 / 255 + 1e-12);
    }
  });

  it('never codes something present as zero, and clamps at the ends', () => {
    expect(log8Encode(0, 10, 1e5)).toBe(0);
    expect(log8Encode(-3, 10, 1e5)).toBe(0);
    expect(log8Encode(1e-9, 10, 1e5)).toBe(1);
    expect(log8Encode(10, 10, 1e5)).toBe(1);
    expect(log8Encode(1e9, 10, 1e5)).toBe(255);
  });
});

describe('layout vocabulary', () => {
  const word = CELL.fields[6] as LayoutField;

  it('splits and builds packed words by sub-field name', () => {
    expect(unpackBits(word, 0x80000006)).toEqual({ regime: 2, offset: 1, wet: 1 });
    expect(packBits(word, { regime: 2, offset: 1, wet: 1 })).toBe(0x80000006);
    expect(packBits(word, { offset: 5 })).toBe(20);
    expect(() => packBits(word, { regime: 4 })).toThrow(RangeError);
    expect(() => packBits(word, { nothing: 1 })).toThrow(/no bits named/);
    expect(() => unpackBits(CELL.fields[0], 1)).toThrow(/no bit sub-fields/);
  });

  it('knows which fields are exact integer ledger quantities', () => {
    const exact = CELL.fields.filter(isExactIntegerField).map((f) => f.name);
    // m (u32 state) and q (i32 accumulator); not the statistics, the statics or the floats.
    expect(exact).toEqual(['m', 'q']);
  });
});

describe('generated WGSL text', () => {
  it('uses only scalar words, never vectors, and names packed runs by their first word', () => {
    const wgsl = recordWgsl(CELL);
    expect(wgsl).toContain(
      'struct Cell {\n  m: u32,\n  q: i32,\n  packed_w2: array<u32, 2>,\n  word: u32,\n}',
    );
    expect(wgsl).not.toMatch(/vec[234]<.*>,\n/);
    expect(wgsl).toContain('const Cell_BYTES: u32 = 20u;');
    expect(wgsl).toContain('const Cell_WORDS: u32 = 5u;');
    expect(wgsl).toContain('const Cell_word_WORD: u32 = 4u;');
    expect(wgsl).toContain('fn Cell_h(r: Cell) -> f32');
    expect(wgsl).toContain('fn Cell_v(r: Cell, k: u32) -> i32');
    expect(wgsl).toContain('fn Cell_set_tau(r: ptr<function, Cell>, v: u32)');
    expect(wgsl).toContain('fn Cell_word_regime(x: u32) -> u32 { return (x >> 0u) & 0x3u; }');
    expect(wgsl).toContain('fn Cell_word_with_wet(x: u32, v: u32) -> u32');
    expect(wgsl).toContain('const Cell_tau_LOG_MIN: f32 = 0.01;');
    expect(recordInclude(CELL)).toBe('record/Cell');
  });

  it('declares atomic members on request and then omits by-value accessors', () => {
    const wgsl = recordWgsl(CELL, { atomic: ['q'] });
    expect(wgsl).toContain('  q: atomic<i32>,');
    expect(wgsl).not.toContain('fn Cell_h(');
    expect(() => recordWgsl(CELL, { atomic: ['h'] })).toThrow(/cannot be atomic/);
    expect(() => recordWgsl(CELL, { atomic: ['missing'] })).toThrow(/cannot be atomic/);
  });

  it('escapes reserved words and writes floats the compiler reads back exactly', () => {
    expect(wgslIdentifier('type')).toBe('type_');
    expect(wgslIdentifier('filter')).toBe('filter_');
    expect(wgslIdentifier('mass')).toBe('mass');
    expect(() => wgslIdentifier('2fast')).toThrow();
    expect(wgslFloat(2)).toBe('2.0');
    expect(wgslFloat(-3)).toBe('-3.0');
    expect(wgslFloat(1e-12)).toBe('1e-12');
    expect(Number(wgslFloat(1 / 255))).toBe(1 / 255);
    expect(() => wgslFloat(Infinity)).toThrow(RangeError);
  });
});
