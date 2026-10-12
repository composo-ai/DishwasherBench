// Contract tests of the binary records of module M6 and of the film-stage buffers its kernels
// bind: each layout against the size and field list that docs/design/sim-core.md states,
// transcribed here independently, against the rules of layoutProblems, and the fixed-point
// units against the capacities the contract quotes for them.
import { STANDARD_GRAVITY } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  fieldBytes,
  IMPACT_DUTY_LAYOUT,
  IMPACT_DUTY_LOG_RANGE,
  IMPACT_DUTY_UNIT_M2_S,
  K_DEPOSIT_LAYOUT,
  K_HOT_LAYOUT,
  layoutProblems,
  MAX_DEPOSIT_TARGETS,
  MC_ACCUMULATOR_LAYOUT,
  MC_BIN_BOUND_UNITS,
  MC_MOMENTUM_UNIT_KG_M_S,
  PACKED_DEPOSITION_LAYOUT,
  PARCEL_LAYOUT,
  PHASE_BINS_PER_REV,
  REGIME_CODES,
  S_DEPOSIT_LAYOUT,
  S_FILM_LAYOUT,
  SPLIT_HALF_MASS_UNIT_KG,
  STEADY_WET_LAYOUT,
  WATER_MASS_UNIT_KG,
  WATER_MOMENTUM_UNIT_KG_M_S,
  type LayoutField,
  type RecordLayout,
} from './index.ts';

/** A named field, with its optional members visible (layouts are literal types). */
function fieldOf(layout: RecordLayout, name: string): LayoutField {
  const field = layout.fields.find((f) => f.name === name);
  if (!field) throw new Error(`${layout.name} has no field ${name}`);
  return field;
}

/** The fields as `count x type`, in order. */
function shape(layout: RecordLayout): string[] {
  return layout.fields.map((f) => `${f.count ?? 1}x${f.type}`);
}

// The size each record has in the contract, with the words that state it.
const CONTRACT_SIZES: readonly (readonly [RecordLayout, number, string])[] = [
  [PARCEL_LAYOUT, 48, 'M6: "`Parcel`, 48 bytes"; 3.8: "Parcels (time-coupled), 2 M slots | 48"'],
  [MC_ACCUMULATOR_LAYOUT, 288, 'M6: "Monte Carlo accumulator, 288 bytes per block"'],
  [PACKED_DEPOSITION_LAYOUT, 144, 'M6: "Packed table for the film stage, 144 bytes per block"'],
  [IMPACT_DUTY_LAYOUT, 8, 'M6: "Two more counters per block" (2 x u32 as in the accumulator)'],
  [S_DEPOSIT_LAYOUT, 20, 'M7.8: "deposit accumulators (current and next) | 20 per S cell"'],
  [K_DEPOSIT_LAYOUT, 8, 'M7.8: "8 per K block"'],
  [S_FILM_LAYOUT, 16, 'M7.8: "`SFilm` (per S film cell, two copies) | 16"'],
  [K_HOT_LAYOUT, 16, 'M7.8: "`KHot` (per block, two copies) | 16"'],
  [STEADY_WET_LAYOUT, 4, 'M7: "steadyWet: GPUBuffer /* 1 bit per block */", 32 blocks to a word'],
];

describe('record layouts of M6 and of the film buffers it binds', () => {
  it.each(CONTRACT_SIZES)('%o has the size the contract states', (layout, bytes) => {
    expect(layout.byteSize).toBe(bytes);
    expect(layoutProblems(layout)).toEqual([]);
  });

  it('adds up with the memory table of section 3.8', () => {
    // "KHot, two copies | 32 per block"; "Deposit accumulators, current and next | 40 per S
    // cell, 16 per K block".
    expect(2 * K_HOT_LAYOUT.byteSize).toBe(32);
    expect(2 * S_DEPOSIT_LAYOUT.byteSize).toBe(40);
    expect(2 * K_DEPOSIT_LAYOUT.byteSize).toBe(16);
  });
});

describe('Parcel', () => {
  it('lists its fields in the order of the contract', () => {
    // "position vec3 f32; velocity vec3 f32; mass u32 in 10^-12 kg ...; diameter f32; birth
    // step u32; lineage 2 x u32; kind, flags and fate u32"
    expect(shape(PARCEL_LAYOUT)).toEqual([
      '3xf32',
      '3xf32',
      '1xu32',
      '1xf32',
      '1xu32',
      '2xu32',
      '1xu32',
    ]);
    expect(fieldOf(PARCEL_LAYOUT, 'mass').scale).toBe(WATER_MASS_UNIT_KG);
  });

  it('holds the largest drop the contract plans for', () => {
    // "A drop heavier than 4.2 g does not occur (a 3.3 l_c drop is 0.34 g)". Water at 55 C:
    // sigma 0.0671 N/m, rho 985.7 kg/m3.
    const capacity = (fieldOf(PARCEL_LAYOUT, 'mass').bound ?? 0) * WATER_MASS_UNIT_KG;
    expect(capacity * 1e3).toBeGreaterThan(4.2);
    const capillaryLength = Math.sqrt(0.0671 / (985.7 * STANDARD_GRAVITY));
    const drop = 985.7 * (Math.PI / 6) * (3.3 * capillaryLength) ** 3;
    expect(drop * 1e3).toBeCloseTo(0.34, 2);
    expect(drop).toBeLessThan(capacity / 10);
  });
});

describe('Monte Carlo accumulator', () => {
  it('lists its fields in the order of the contract', () => {
    // "64 x u32 mass by phase bin ...; 3 x i32 momentum sum in 10^-9 kg m/s ...; u32 parcel
    // count; 2 x u32 impact duty; 2 x u32 split-half mass in 10^-10 kg"
    expect(shape(MC_ACCUMULATOR_LAYOUT)).toEqual(['64xu32', '3xi32', '1xu32', '2xu32', '2xu32']);
    expect(fieldOf(MC_ACCUMULATOR_LAYOUT, 'mass').count).toBe(PHASE_BINS_PER_REV);
    expect(fieldOf(MC_ACCUMULATOR_LAYOUT, 'momentum').scale).toBe(1e-9);
    expect(MC_MOMENTUM_UNIT_KG_M_S).toBe(1e-9);
    expect(fieldOf(MC_ACCUMULATOR_LAYOUT, 'splitHalfMass').scale).toBe(1e-10);
    expect(SPLIT_HALF_MASS_UNIT_KG).toBe(1e-10);
  });

  it('holds six times a whole 2 mm jet dwelling on one block for a bin', () => {
    // "a bin holds 4.3 g, six times a whole 2 mm jet dwelling on one block for a bin": a 2 mm
    // jet at 8.1 m/s for 1/64 of the 1.71 s revolution of the lower arm.
    const jet = 1000 * (Math.PI / 4) * 2e-3 ** 2 * 8.1; // kg/s
    const perBin = jet * (60 / 35 / PHASE_BINS_PER_REV);
    const u32Capacity = 2 ** 32 * WATER_MASS_UNIT_KG;
    expect(u32Capacity * 1e3).toBeCloseTo(4.3, 1);
    expect(u32Capacity / perBin).toBeGreaterThan(6);
    expect(u32Capacity / perBin).toBeLessThan(7);
    // The run fails once a block's bound passes 2^31 units, which still holds three such bins.
    expect(fieldOf(MC_ACCUMULATOR_LAYOUT, 'mass').bound).toBe(MC_BIN_BOUND_UNITS);
    expect((MC_BIN_BOUND_UNITS * WATER_MASS_UNIT_KG) / perBin).toBeGreaterThan(3);
  });

  it('lets each split-half sum hold a block at the saturation bound', () => {
    const blockBound = MC_BIN_BOUND_UNITS * WATER_MASS_UNIT_KG;
    expect(blockBound / SPLIT_HALF_MASS_UNIT_KG).toBeLessThan(2 ** 32);
  });

  it('resolves and holds the impact duties in the unit chosen for them', () => {
    // Section 5.2: the duties are area-time fractions from 1e-6 to 1. On a 4 mm2 block over a
    // 1.71 s revolution the smallest is 6.9e-12 m2 s; six recorded revolutions of 2.43 s at a
    // fraction of 1 are 5.8e-5 m2 s.
    expect(IMPACT_DUTY_LOG_RANGE).toEqual({ min: 1e-6, max: 1 });
    expect((1e-6 * 4e-6 * (60 / 35)) / IMPACT_DUTY_UNIT_M2_S).toBeGreaterThan(5);
    expect((6 * 2.432 * 4e-6) / IMPACT_DUTY_UNIT_M2_S).toBeLessThan(2 ** 32);
    expect(fieldOf(IMPACT_DUTY_LAYOUT, 'areaTime').scale).toBe(IMPACT_DUTY_UNIT_M2_S);
  });
});

describe('packed deposition table', () => {
  it('holds every field the contract lists', () => {
    // "64 x u16 mantissa by bin and one u8 shift per block ...; 3 x i16 mean velocity (mm/s);
    // f32 smoothed mean flux; u8 smoothing level; u8 flags (sparse, sheet-fed, gap); 2 x log u8
    // impact duty; one byte spare"
    const listed = 64 * 2 + 1 + 3 * 2 + 4 + 1 + 1 + 2 + 1;
    expect(listed).toBe(144);
    const packed: RecordLayout = PACKED_DEPOSITION_LAYOUT;
    const byName = new Map(packed.fields.map((f) => [f.name, `${f.count ?? 1}x${f.type}`]));
    expect(Object.fromEntries(byName)).toEqual({
      mantissa: '64xu16',
      shift: '1xu8',
      meanVelocity: '3xi16',
      meanFlux: '1xf32',
      smoothingLevel: '1xu8',
      flags: '1xu8',
      impactDuty: '2xlog8',
      spare: '1xu8',
    });
    expect(packed.fields.reduce((sum, f) => sum + fieldBytes(f), 0)).toBe(144);
    expect(fieldOf(PACKED_DEPOSITION_LAYOUT, 'flags').bits?.map((b) => b.name)).toEqual([
      'sparse',
      'sheetFed',
      'gap',
    ]);
  });

  it('can represent a bin at the saturation bound with a u8 shift', () => {
    // "value = mantissa << shift in the same integer unit": the largest bin the run allows
    // (2^31 units) needs a shift of 16, and the truncation is then below 2^16 units (66 ng).
    const shift = Math.ceil(Math.log2(MC_BIN_BOUND_UNITS / 65535));
    expect(shift).toBe(16);
    expect(65535 * 2 ** shift).toBeGreaterThanOrEqual(MC_BIN_BOUND_UNITS);
    expect(2 ** shift * WATER_MASS_UNIT_KG).toBeLessThan(1e-7);
  });
});

describe('deposit accumulators, SFilm and KHot (sections M7.1, M7.8)', () => {
  it('has five i32 words per S cell and two per K block', () => {
    // "An S cell has five i32 words {film mass, airborne mass, tangential momentum x 2, normal
    // momentum}; a K block has two {film mass, airborne mass}."
    expect(shape(S_DEPOSIT_LAYOUT)).toEqual(['1xi32', '1xi32', '2xi32', '1xi32']);
    expect(shape(K_DEPOSIT_LAYOUT)).toEqual(['1xi32', '1xi32']);
    const deposits: readonly LayoutField[] = [
      ...S_DEPOSIT_LAYOUT.fields,
      ...K_DEPOSIT_LAYOUT.fields,
    ];
    for (const field of deposits) {
      expect(field.role).toBe('accumulator');
      expect(field.bound).toBe(2 ** 31 - 1);
    }
    expect(fieldOf(S_DEPOSIT_LAYOUT, 'filmMass').scale).toBe(WATER_MASS_UNIT_KG);
    expect(fieldOf(S_DEPOSIT_LAYOUT, 'momentum').scale).toBe(WATER_MOMENTUM_UNIT_KG_M_S);
    // One parcel writes to at most 49 targets (a 7 x 7 neighbourhood).
    expect(MAX_DEPOSIT_TARGETS).toBe(7 * 7);
  });

  it('keeps the S state in three f32 and one packed word', () => {
    // "h f32; q1 f32; q2 f32; word u32 {p_imp f16 in Pa ...; flags u16: wet, immersed, seam,
    // gutter row, edge-pin code}"
    expect(shape(S_FILM_LAYOUT)).toEqual(['1xf32', '1xf32', '1xf32', '1xf16', '1xu16']);
    expect(fieldOf(S_FILM_LAYOUT, 'pImp').offset).toBe(12);
    expect(fieldOf(S_FILM_LAYOUT, 'flags').bits?.map((b) => b.name)).toEqual([
      'wet',
      'immersed',
      'seam',
      'gutterRow',
      'edgePin',
    ]);
    for (const name of ['h', 'q1', 'q2']) expect(fieldOf(S_FILM_LAYOUT, name).role).toBe('state');
  });

  it('keeps the cascade state in three u32 masses, a bounded counter and two codes', () => {
    // "m_u u32; q_u u32; b_u u32 (all 10^-12 kg); dewetting counter u16 (base steps, counter
    // with bound 65,535 = 128 s, saturating); regime u8; f u8 / 255 (statistic ...)"
    expect(shape(K_HOT_LAYOUT)).toEqual(['1xu32', '1xu32', '1xu32', '1xu16', '1xu8', '1xu8']);
    for (const name of ['m', 'q', 'b']) {
      expect(fieldOf(K_HOT_LAYOUT, name).role).toBe('state');
      expect(fieldOf(K_HOT_LAYOUT, name).scale).toBe(WATER_MASS_UNIT_KG);
    }
    const counter = fieldOf(K_HOT_LAYOUT, 'dewetCounter');
    expect([counter.role, counter.bound, counter.saturating]).toEqual(['counter', 65535, true]);
    // "65,535 = 128 s" at a base step of about 1.95 ms.
    expect(65535 * (2 / 1024)).toBeCloseTo(128, 0);
    expect(fieldOf(K_HOT_LAYOUT, 'f').role).toBe('statistic');
    expect(255 * (fieldOf(K_HOT_LAYOUT, 'f').scale ?? 0)).toBeCloseTo(1, 12);
  });

  it('resolves a quarter of a nanometre of film in the mass unit', () => {
    // Section 4: "one unit is 0.25 nm of film on a 4 mm2 block", and M7.3: "a film thinner
    // than about 3 um on a 2 mm block stops draining" (an outflow below half a unit per step).
    const unitThickness = (fieldOf(K_HOT_LAYOUT, 'm').scale ?? 0) / (1000 * 4e-6);
    expect(unitThickness).toBeCloseTo(0.25e-9, 13);
  });

  it('numbers the four regimes in the order of the contract', () => {
    // M7.3: "regime (DRY, BEAD, RIVULET, FILM)"; two bits in FilmExposure.flags.
    expect(REGIME_CODES).toEqual({ DRY: 0, BEAD: 1, RIVULET: 2, FILM: 3 });
  });
});
