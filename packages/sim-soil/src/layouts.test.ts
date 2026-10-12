// Contract tests of the binary records of module M8 and of the timeline buffers its kernel
// binds: each layout against the size, the offsets and the field list that
// docs/design/sim-core.md states (sections M8 and M10), transcribed here independently of the
// layout files, and against the rules of layoutProblems.
import { gToKg, mm2ToM2 } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  BLOCK_RELEASE_LAYOUT,
  EFFECTIVE_EXPOSURE_LAYOUT,
  layoutProblems,
  RELEASE_CLASSES,
  RESERVOIR_LIQUOR_LAYOUT,
  SOIL_CELL_LAYERS,
  SOIL_CELL_LAYOUT,
  SOIL_CLASS_IDS,
  SOIL_MASS_UNIT_KG,
  SOIL_STATIC_LAYOUT,
  TIMELINE_BLOCK_LAYOUT,
  WETNESS_STATES,
  type ItemSoilRecord,
  type LayoutField,
  type RecordLayout,
} from './index.ts';

/** A named field, with its optional members visible (layouts are literal types). */
function fieldOf(layout: RecordLayout, name: string): LayoutField {
  const field = layout.fields.find((f) => f.name === name);
  if (!field) throw new Error(`${layout.name} has no field ${name}`);
  return field;
}

/** Offsets of the named fields. */
function offsets(layout: RecordLayout, names: readonly string[]): number[] {
  return names.map((name) => fieldOf(layout, name).offset);
}

/** The fields as `count x type`, in order. */
function shape(layout: RecordLayout): string[] {
  return layout.fields.map((f) => `${f.count ?? 1}x${f.type}`);
}

// The size each record has in the contract, with the words that state it.
const CONTRACT_SIZES: readonly (readonly [RecordLayout, number, string])[] = [
  [SOIL_CELL_LAYOUT, 136, 'M8: "`SoilCell`, 136 bytes"'],
  [BLOCK_RELEASE_LAYOUT, 32, 'M8: "`BlockRelease`, 32 bytes per soiled block and tick"'],
  [EFFECTIVE_EXPOSURE_LAYOUT, 40, 'M10: "`EffectiveExposure`, 40 bytes per film cell and tick"'],
  [TIMELINE_BLOCK_LAYOUT, 64, 'M10: "`TimelineBlock`, 64 bytes"'],
  [RESERVOIR_LIQUOR_LAYOUT, 32, 'M10: "`ReservoirLiquor`, 32 bytes per basin and gap"'],
];

describe('record layouts of M8 and of the timeline buffers it binds', () => {
  it.each(CONTRACT_SIZES)('%o has the size the contract states', (layout, bytes) => {
    expect(layout.byteSize).toBe(bytes);
    expect(layoutProblems(layout)).toEqual([]);
  });

  it('adds up with the memory table of section 3.8', () => {
    // "SoilCell + SoilStatic (stage H) | 144 per soil cell"
    expect(SOIL_CELL_LAYOUT.byteSize + SOIL_STATIC_LAYOUT.byteSize).toBe(144);
  });
});

describe('SoilCell (section M8)', () => {
  it('places the rows of the table at the offsets the contract gives', () => {
    // Offset column: 0, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 92, 96, 100, 104, 108.
    expect(
      offsets(SOIL_CELL_LAYOUT, [
        'w',
        'm0',
        'Er',
        'loose',
        'lagProg',
        'hFat',
        'removed',
        'cover',
        'Xad',
        'tWet',
        'stain',
        'class',
        'nbCover',
        'tauCohTop',
        'flags',
        'reserved',
      ]),
    ).toEqual([0, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 92, 96, 100, 104, 108]);
    // Type column: w[12] f32 | 8 x f32 | u32 | 2 x f32 | 4 x u8 | nbCover[4] u8 | 2 x f16 |
    // 2 x u16 | 28 bytes.
    expect(shape(SOIL_CELL_LAYOUT).join(' ')).toBe(
      '12xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xu32 1xf32 1xf32 ' +
        '1xu8 1xu8 1xu8 1xu8 4xu8 1xf16 1xf16 1xu16 1xu16 7xu32',
    );
    expect(SOIL_CELL_LAYERS).toBe(12);
    expect(SOIL_CELL_LAYOUT.byteSize - fieldOf(SOIL_CELL_LAYOUT, 'reserved').offset).toBe(28);
  });

  it('keeps every evolving field in f32 or an integer', () => {
    // "Every evolving field is f32 or an integer ... cover and X_ad are f32 so that small peel
    // decrements are not lost."
    const layout: RecordLayout = SOIL_CELL_LAYOUT;
    for (const field of layout.fields) {
      if (field.role === 'state') expect(field.type, field.name).toBe('f32');
    }
    for (const name of ['w', 'Er', 'lagProg', 'removed', 'cover', 'Xad', 'stain']) {
      expect(fieldOf(layout, name).role, name).toBe('state');
    }
    // "tWet | u32 | ms | cumulative wetted time (diagnostic; integer, rule 2)": a u32 of
    // milliseconds outlasts any programme (the sizing programme is 145 minutes).
    const tWet = fieldOf(layout, 'tWet');
    expect([tWet.type, tWet.scale]).toEqual(['u32', 1e-3]);
    expect((tWet.bound ?? 0) * 1e-3).toBeGreaterThan(145 * 60 * 100);
    // "nbCover[4] ... (a copy, not an accumulator)"; "tauCohTop, tauAd ... (diagnostics)".
    for (const name of ['nbCover', 'tauCohTop', 'tauAd']) {
      expect(fieldOf(layout, name).role, name).toBe('statistic');
    }
    // Layers only count down from at most 12.
    const nLayers = fieldOf(layout, 'nLayers');
    expect([nLayers.role, nLayers.bound]).toEqual(['counter', 12]);
  });

  it('holds the loading of a level soil record in its unit', () => {
    // M8, "Initial state": m_wet (per covered area) = amount_g / sum over regions(area x
    // coverage). 2 g of soil over half of a 100 cm2 well is 0.4 kg/m2 of wet soil, 400 g/m2:
    // the scale of the catalogue's loadings, and `m0` (dry, per covered area) is below it.
    const record: ItemSoilRecord = {
      type: 'porridge_dried',
      regions: [{ region: 'well', coverage: 0.5 }],
      amount_g: 2,
      age_h: 12,
      heat_history: 'none',
    };
    const coveredArea = record.regions.reduce((sum, r) => sum + mm2ToM2(100 * 100) * r.coverage, 0);
    const wetLoading = gToKg(record.amount_g) / coveredArea;
    expect(wetLoading).toBeCloseTo(0.4, 12);
    expect(fieldOf(SOIL_CELL_LAYOUT, 'm0').unit).toBe('kg/m2');
  });

  it('stores the bake index as B x 255 and particles per cm2', () => {
    expect(255 * (fieldOf(SOIL_CELL_LAYOUT, 'bake').scale ?? 0)).toBeCloseTo(1, 12);
    // 1 particle per cm2 is 10,000 per m2.
    expect(fieldOf(SOIL_CELL_LAYOUT, 'particles').scale).toBe(1e4);
  });

  it('numbers the eight soil classes of the soils dossier', () => {
    expect([...SOIL_CLASS_IDS]).toEqual([
      'SOL',
      'SWP',
      'SWS',
      'PEEL',
      'FAT',
      'BURN',
      'STAIN',
      'PART',
    ]);
    expect(SOIL_CLASS_IDS.length).toBeLessThanOrEqual(256);
  });
});

describe('BlockRelease (section M8)', () => {
  it('has one u32 per release class in units of 1e-15 kg', () => {
    // "8 release classes (...; 8 x u32 in 10^-15 kg)"
    const mass = fieldOf(BLOCK_RELEASE_LAYOUT, 'mass');
    expect([mass.type, mass.count, mass.scale]).toEqual([
      'u32',
      RELEASE_CLASSES.length,
      SOIL_MASS_UNIT_KG,
    ]);
    expect(RELEASE_CLASSES.length).toBe(8);
    // The four soil cells of a 2 mm block, each 1 mm2 with 1 kg/m2 of dry soil (a 1 mm deposit,
    // the thickest the one-way coupling admits), detached in one tick, fit one word.
    expect((4 * 1e-6 * 1) / SOIL_MASS_UNIT_KG).toBeLessThan(2 ** 32);
  });
});

describe('EffectiveExposure (section M10)', () => {
  it('places the rows of the table at the offsets the contract gives', () => {
    // Offset column: 0, 4, 10, 12, 18, 22, 27, 28, 30, 32, 34, 36.
    expect(
      offsets(EFFECTIVE_EXPOSURE_LAYOUT, [
        'sFlow',
        'hFlow',
        'mfMean',
        'jSupFlow',
        'hRes',
        'tauDuty',
        'beadArea',
        'dropDuty3',
        'depthImm',
        'reservoir',
        'renew',
        'flags',
      ]),
    ).toEqual([0, 4, 10, 12, 18, 22, 27, 28, 30, 32, 34, 36]);
    // Type column: 4 x u8 | 3 x f16 | 2 x log u8 | 3 x f16 | 2 x f16 | 5 x u8 | u8 | 2 x log u8 |
    // f16 | u16 | f16 | u16; u8; u8.
    expect(shape(EFFECTIVE_EXPOSURE_LAYOUT).join(' ')).toBe(
      '1xu8 1xu8 1xu8 1xu8 1xf16 1xf16 1xf16 1xlog8 1xlog8 1xf16 1xf16 1xf16 1xf16 1xf16 ' +
        '5xu8 1xu8 1xlog8 1xlog8 1xf16 1xu16 1xf16 1xu16 1xu8 1xu8',
    );
  });

  it('carries a share for four of the five wetness states, the dry share being the rest', () => {
    // "sFlow, sRes, sSparse, sImm | 4 x u8 / 255 | shares of the tick in four wetness states;
    // the dry share is the remainder"
    expect([...WETNESS_STATES]).toEqual([
      'dry',
      'sparse',
      'residualFilm',
      'flowingFilm',
      'immersed',
    ]);
    const shares = ['sFlow', 'sRes', 'sSparse', 'sImm'].map((name) =>
      fieldOf(EFFECTIVE_EXPOSURE_LAYOUT, name),
    );
    expect(shares).toHaveLength(WETNESS_STATES.length - 1);
    for (const share of shares) expect(255 * (share.scale ?? 0)).toBeCloseTo(1, 12);
  });

  it('uses the scaled units of the table', () => {
    const scale = (name: string): number | undefined =>
      fieldOf(EFFECTIVE_EXPOSURE_LAYOUT, name).scale;
    // "um; Pa; Pa", "g/(m2 s)", "um", "mm of water above the cell", "1/s".
    expect([scale('hFlow'), scale('tauFlow'), scale('tauPeak')]).toEqual([
      1e-6,
      undefined,
      undefined,
    ]);
    expect([scale('jSupFlow'), scale('jSupRes'), scale('depFlux')]).toEqual([1e-3, 1e-3, 1e-3]);
    expect([scale('hRes'), scale('hBead')]).toEqual([1e-6, 1e-6]);
    expect(scale('depthImm')).toBe(1e-3);
    expect(scale('renew')).toBeUndefined();
    // Jets under water (M8): the attenuation matters from 17 mm to 80 mm of water; stored 17
    // and 80.
    expect(0.017 / (scale('depthImm') ?? 1)).toBeCloseTo(17, 10);
  });

  it('is written whole by pass W: every field is a statistic', () => {
    const layout: RecordLayout = EFFECTIVE_EXPOSURE_LAYOUT;
    expect(new Set(layout.fields.filter((f) => !f.pad).map((f) => f.role))).toEqual(
      new Set(['statistic']),
    );
  });
});

describe('TimelineBlock (section M10)', () => {
  it('places the rows of the table at the offsets the contract gives', () => {
    // Offset column: 0, 8, 16, 24, 32, 40, 48, 60.
    expect(
      offsets(TIMELINE_BLOCK_LAYOUT, [
        'Ts',
        'filmMass',
        'deposition',
        'fill',
        'storeDissolved',
        'speckFines',
        'residue',
        'regime',
      ]),
    ).toEqual([0, 8, 16, 24, 32, 40, 48, 60]);
    // Type column: 2 x f32 | 2 x f32 | 2 x f32 | 4 x u16 | 2 x f32 | 2 x f32 | 3 x f32 |
    // u8; u8; u16.
    expect(shape(TIMELINE_BLOCK_LAYOUT).join(' ')).toBe(
      '1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 4xu16 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xf32 1xu8 1xu8 1xu16',
    );
  });

  it('keeps every evolving field in f32 except the four fill fractions', () => {
    // "every evolving field is f32 except the fill fractions, which are u16 that are
    // renormalised every tick"; "1 / 65,535; they sum to 65,535".
    const layout: RecordLayout = TIMELINE_BLOCK_LAYOUT;
    for (const field of layout.fields) {
      if (field.role === 'state') expect(field.type, field.name).toBe('f32');
    }
    const fill = fieldOf(layout, 'fill');
    expect([fill.type, fill.count, fill.role, fill.bound]).toEqual(['u16', 4, 'counter', 65535]);
    expect(65535 * (fill.scale ?? 0)).toBeCloseTo(1, 12);
  });

  it('keeps a fill fraction moving where a u8 would freeze, as the contract computes', () => {
    // M10: "a fraction keeps moving until it is within 0.5 % of its target at a renewal of
    // 10^-3 1/s (a u8 would freeze at 0, 62 % and 89 % for renewals of 0.001, 0.003 and
    // 0.01 1/s)". Per tick of 1.71 s (35 rpm) a fraction at distance x from its target moves by
    // x (1 - exp(-renew dt)); with rounding to the nearest unit it stops once that is below
    // half a unit.
    const dt = 60 / 35;
    const stallDistance = (unit: number, renew: number): number =>
      unit / 2 / (1 - Math.exp(-renew * dt));
    const u16 = fieldOf(TIMELINE_BLOCK_LAYOUT, 'fill').scale ?? 0;
    expect(stallDistance(u16, 1e-3)).toBeLessThan(0.005);
    expect(stallDistance(u16, 1e-3)).toBeGreaterThan(0.004);
    // The same with a u8: it never leaves 0 at 0.001 1/s and stops at 62 % and 89 %.
    const reached = (renew: number): number => Math.max(0, 1 - stallDistance(1 / 255, renew));
    // (Tolerance: one percentage point, the precision the contract quotes them to.)
    expect(reached(0.001)).toBe(0);
    expect(Math.abs(reached(0.003) - 0.62)).toBeLessThan(0.01);
    expect(Math.abs(reached(0.01) - 0.89)).toBeLessThan(0.01);
  });

  it('stores speck intensities per mm2', () => {
    // "speck intensity: fines; grit | 2 x f32 | 1/mm2"
    expect(fieldOf(TIMELINE_BLOCK_LAYOUT, 'speckFines').scale).toBe(1e6);
    expect(fieldOf(TIMELINE_BLOCK_LAYOUT, 'speckGrit').scale).toBe(1e6);
  });
});

describe('ReservoirLiquor (section M10)', () => {
  it('holds the eight values the contract lists, as f32', () => {
    // "level, temperature, alkalinity, total carbonate, protease, amylase, oxidant, filled flag
    // (8 x f32)"
    expect(RESERVOIR_LIQUOR_LAYOUT.fields.map((f) => f.name)).toEqual([
      'level',
      'temperature',
      'alkalinity',
      'totalCarbonate',
      'protease',
      'amylase',
      'oxidant',
      'filled',
    ]);
    expect(new Set(RESERVOIR_LIQUOR_LAYOUT.fields.map((f) => f.type))).toEqual(new Set(['f32']));
  });
});
