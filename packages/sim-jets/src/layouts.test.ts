// Contract tests of the binary records of module M5: each layout against the size and the field
// list that docs/design/sim-core.md states, transcribed here independently of layouts.ts, and
// against the rules of layoutProblems.
import { describe, expect, it } from 'vitest';
import {
  EMITTER_BUCKETS,
  EMITTER_ENTRY_LAYOUT,
  EMITTER_MEAN_LAYOUT,
  fieldBytes,
  FOOTPRINT_RECORD_LAYOUT,
  H_RES_LAYOUT,
  JET_EXPOSURE_LAYOUT,
  JET_WET_LAYOUT,
  layoutProblems,
  LOAD_PHASE_BINS,
  PHASE_BINS_PER_REV,
  SECTOR_AZIMUTHS,
  SECTOR_END_CODES,
  SECTOR_PHASE_STRIDE,
  SECTOR_RECORD_LAYOUT,
  SOURCE_KIND_CODES,
  SOURCE_RECORD_LAYOUT,
  WATER_MASS_UNIT_KG,
  type ItemLoads,
  type LayoutField,
  type RecordLayout,
} from './index.ts';

/** A named field, with its optional members visible (layouts are literal types). */
function fieldOf(layout: RecordLayout, name: string): LayoutField {
  const field = layout.fields.find((f) => f.name === name);
  if (!field) throw new Error(`${layout.name} has no field ${name}`);
  return field;
}

/** Bytes of the fields that are not padding. */
function listedBytes(layout: RecordLayout): number {
  return layout.fields.filter((f) => !f.pad).reduce((sum, f) => sum + fieldBytes(f), 0);
}

/** The fields as `count x type`, in order. */
function shape(layout: RecordLayout): string[] {
  return layout.fields.map((f) => `${f.count ?? 1}x${f.type}`);
}

// The size each record has in the contract, with the words that state it. SourceRecord is the
// exception: see its own test.
const CONTRACT_SIZES: readonly (readonly [RecordLayout, number, string])[] = [
  [FOOTPRINT_RECORD_LAYOUT, 56, 'M5: "`FootprintRecord`, 56 bytes per (sub-jet, phase)"'],
  [SECTOR_RECORD_LAYOUT, 176, 'M5: "`SectorRecord`, 176 bytes per (sub-jet, walked phase)"'],
  [EMITTER_ENTRY_LAYOUT, 16, 'M5: "16 bytes per entry"; 3.8: "Emitter entries | 16 per entry"'],
  [JET_WET_LAYOUT, 8, '3.8: "Jet-wet table, one per active arm | 8 per block"'],
  [H_RES_LAYOUT, 2, 'M7: "hRes: GPUBuffer /* f16 um per block */"'],
  [EMITTER_MEAN_LAYOUT, 4, 'M5: one f32 per block (format not fixed by the contract)'],
];

describe('record layouts of M5', () => {
  it.each(CONTRACT_SIZES)('%o has the size the contract states', (layout, bytes) => {
    expect(layout.byteSize).toBe(bytes);
    expect(layoutProblems(layout)).toEqual([]);
  });

  it('re-exports the JetExposure layout of section 5.4, which M5 writes', () => {
    expect(JET_EXPOSURE_LAYOUT.byteSize).toBe(56);
    expect(JET_EXPOSURE_LAYOUT.owner).toBe('M5');
  });
});

describe('FootprintRecord', () => {
  it('has a 48-byte trace part and an 8-byte film part in the order of the contract', () => {
    // Trace part: "source point S in patch coordinates and offset r0 cot(phi) (3 x f32);
    // forward tangent angle, sin(phi), V, d, Q_hit (5 x f32); sweep velocity in the patch
    // tangent frame (2 x f32); flight time (f32); patch (u32)".
    // Film part: "f_c, xi (2 x f16); zone id (u16); flags (u16)".
    expect(shape(FOOTPRINT_RECORD_LAYOUT)).toEqual([
      '2xf32',
      '1xf32',
      '1xf32',
      '1xf32',
      '1xf32',
      '1xf32',
      '1xf32',
      '2xf32',
      '1xf32',
      '1xu32',
      '1xf16',
      '1xf16',
      '1xu16',
      '1xu16',
    ]);
    expect(fieldOf(FOOTPRINT_RECORD_LAYOUT, 'patch').offset).toBe((3 + 5 + 2 + 1) * 4);
    expect(fieldOf(FOOTPRINT_RECORD_LAYOUT, 'fc').offset).toBe(48);
    expect(FOOTPRINT_RECORD_LAYOUT.byteSize - 48).toBe(2 * 2 + 2 + 2);
  });
});

describe('SectorRecord', () => {
  it('holds four arrays over the 32 azimuths', () => {
    // "r_lim at 32 azimuths (32 x f16, mm); T(r_lim) (32 x f16, ms); separated or departed
    // fraction (32 x u8); end types (32 x 4 bits)"
    expect(SECTOR_AZIMUTHS).toBe(32);
    const bytes = 32 * 2 + 32 * 2 + 32 * 1 + (32 * 4) / 8;
    expect(bytes).toBe(176);
    expect(shape(SECTOR_RECORD_LAYOUT)).toEqual(['32xf16', '32xf16', '32xu8', '16xu8']);
    // Two 4-bit end types per byte.
    const nibbles = fieldOf(SECTOR_RECORD_LAYOUT, 'endType').bits ?? [];
    expect(nibbles.map((b) => [b.lsb, b.width])).toEqual([
      [0, 4],
      [4, 4],
    ]);
    expect(Math.max(...Object.values(SECTOR_END_CODES))).toBeLessThan(16);
  });

  it('stores the limit in millimetres and the travel time in milliseconds', () => {
    expect(fieldOf(SECTOR_RECORD_LAYOUT, 'rLim').scale).toBe(1e-3);
    expect(fieldOf(SECTOR_RECORD_LAYOUT, 'travelTime').scale).toBe(1e-3);
    // The reference fan of the contract, R_j = 41.3 mm, is stored as 41.3: far above the
    // smallest normal half-precision number (6e-5), which section 5.1 requires.
    expect(41.3e-3 / (fieldOf(SECTOR_RECORD_LAYOUT, 'rLim').scale ?? 1)).toBeCloseTo(41.3, 10);
  });

  it('is written for every fourth phase', () => {
    // "For every fourth phase and 32 azimuths a walk follows the film ray": 44 bytes per phase,
    // so footprint and sector records together take 100 bytes per (sub-jet, phase). (The memory
    // table of section 3.8 says 96.)
    expect(SECTOR_PHASE_STRIDE).toBe(4);
    expect(
      FOOTPRINT_RECORD_LAYOUT.byteSize + SECTOR_RECORD_LAYOUT.byteSize / SECTOR_PHASE_STRIDE,
    ).toBe(100);
  });
});

describe('emitter entries and jet-wet tables', () => {
  it('stores an entry as the contract lists it', () => {
    // "film cell u32; mass i32 in 10^-12 kg; velocity 2 x i16 in mm/s; spare"
    expect(shape(EMITTER_ENTRY_LAYOUT)).toEqual(['1xu32', '1xi32', '2xi16', '1xu32']);
    expect(fieldOf(EMITTER_ENTRY_LAYOUT, 'mass').scale).toBe(WATER_MASS_UNIT_KG);
    // An i16 in mm/s holds the 2.2 m/s hand-over cap and the 8 m/s of an uncapped fan.
    const top = 32767 * (fieldOf(EMITTER_ENTRY_LAYOUT, 'velocity').scale ?? 0);
    expect(top).toBeGreaterThan(8);
  });

  it('has one jet-wet bit per phase bin of the arm', () => {
    // "jetWet: GPUBuffer /* 64 bits per block: phase bins of that arm ... */"
    expect(8 * JET_WET_LAYOUT.byteSize).toBe(PHASE_BINS_PER_REV);
  });

  it('sorts entries into 4,096 buckets and tabulates loads in 256 bins', () => {
    // "sorted by arrival phase of the emitting arm into 4,096 buckets"; "256 phase bins per
    // arm"; both are whole multiples of the 64 phase bins of M4.
    expect(EMITTER_BUCKETS).toBe(4096);
    expect(LOAD_PHASE_BINS).toBe(256);
    expect(EMITTER_BUCKETS % PHASE_BINS_PER_REV).toBe(0);
    expect(LOAD_PHASE_BINS % PHASE_BINS_PER_REV).toBe(0);
    const loads: ItemLoads = {
      phaseBins: 256,
      force: new Float32Array(1 * 2 * 256 * 3),
      torque: new Float32Array(1 * 2 * 256 * 3),
    };
    expect(loads.force.length).toBe(loads.phaseBins * 2 * 3);
  });
});

describe('SourceRecord', () => {
  it('needs 34 bytes for the fields the contract lists, more than the 32 it states', () => {
    // "kind u8, sub-jet u8, phase u16; origin in the tub frame (vec3 f32); direction frame
    // (normal octahedral 2 x i16, tangent angle i16, spread code u16); mass rate (f32, kg/s);
    // speed (f16, m/s) and mass-median diameter (f16, mm); flight-time offset (f16, ms); spare"
    const listed = 1 + 1 + 2 + 3 * 4 + (2 * 2 + 2 + 2) + 4 + (2 + 2) + 2;
    expect(listed).toBe(34);
    expect(listedBytes(SOURCE_RECORD_LAYOUT)).toBe(listed);
    // Rounded up to whole words, with the 2 spare bytes at the end.
    expect(SOURCE_RECORD_LAYOUT.byteSize).toBe(36);
    expect(layoutProblems(SOURCE_RECORD_LAYOUT)).toEqual([]);
    expect(shape(SOURCE_RECORD_LAYOUT)).toEqual([
      '1xu8',
      '1xu8',
      '1xu16',
      '3xf32',
      '2xi16',
      '1xi16',
      '1xu16',
      '1xf32',
      '1xf16',
      '1xf16',
      '1xf16',
      '1xu16',
    ]);
  });

  it('numbers the six source kinds in the order of the contract', () => {
    // "kind u8 (splatter, wire fan, edge sheet, curtain, drop train, shed drops)"
    expect(Object.keys(SOURCE_KIND_CODES)).toEqual([
      'splatter',
      'wireFan',
      'edgeSheet',
      'curtain',
      'dropTrain',
      'shedDrops',
    ]);
    expect(Object.values(SOURCE_KIND_CODES)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('stores the droplet diameter in millimetres', () => {
    // A 0.19 d splatter droplet of a 2.25 mm jet is 0.43 mm: stored as 0.43, not as 4.3e-4,
    // which would be a subnormal half.
    const scale = fieldOf(SOURCE_RECORD_LAYOUT, 'diameter').scale ?? 1;
    expect((0.19 * 2.25e-3) / scale).toBeGreaterThan(6e-5);
  });
});
