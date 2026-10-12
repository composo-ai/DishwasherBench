// Contract tests of the binary tables of module M3: each layout against the size, the offsets
// and the packing that docs/design/sim-core.md section 3 states, transcribed here independently
// of layouts.ts, and against the rules of layoutProblems (no overlap, every byte listed, WGSL
// alignment, narrow fields only in the roles determinism rule 7 allows).
import { fieldBytes, layoutProblems, type LayoutField, type RecordLayout } from '@spotless/sim-gpu';
import { describe, expect, it } from 'vitest';
import {
  BLOCK_AUX_LAYOUT,
  BLOCK_FEATURE_CODES,
  BLOCK_FILM_LAYOUT,
  BLOCK_STATIC_LAYOUT,
  BVH_NODE_LAYOUT,
  EXPOSURE_SCHEMA,
  FEATURE_TAG_CODES,
  FILM_CLASSES,
  GAP_LOG_RANGE,
  HIT_RECORD_LAYOUT,
  INSTANCE_KIND_CODES,
  INSTANCE_LAYOUT,
  JET_EXPOSURE_LAYOUT,
  JET_M_LEVELS_N_PER_M,
  JET_TAU_LEVELS_PA,
  PATCH_ROW_LAYOUT,
  PRIMITIVE_LAYOUT,
  PRIMITIVE_TYPE_CODES,
  SIDE_CODES,
  SOIL_STATIC_LAYOUT,
  WETTING_SUMMARY_CELL_LAYOUT,
} from './index.ts';

/** The fields of a layout with their optional members visible (layouts are literal types). */
function fieldsOf(layout: RecordLayout): readonly LayoutField[] {
  return layout.fields;
}

/** A named field. */
function fieldOf(layout: RecordLayout, name: string): LayoutField {
  const field = layout.fields.find((f) => f.name === name);
  if (!field) throw new Error(`${layout.name} has no field ${name}`);
  return field;
}

/** Offset of a named field. */
function offsetOf(layout: RecordLayout, name: string): number {
  return fieldOf(layout, name).offset;
}

/** Bytes of the fields that are not padding. */
function listedBytes(layout: RecordLayout): number {
  return layout.fields
    .filter((f: LayoutField) => !f.pad)
    .reduce((sum, f) => sum + fieldBytes(f), 0);
}

/** Bit sub-fields of a field as `name: width` in order of position. */
function bitWidths(layout: RecordLayout, name: string): string[] {
  return [...(fieldOf(layout, name).bits ?? [])]
    .sort((a, b) => a.lsb - b.lsb)
    .map((b) => `${b.name}:${b.width}`);
}

// The size each record has in the contract, with the words that state it.
const CONTRACT_SIZES: readonly (readonly [RecordLayout, number, string])[] = [
  [HIT_RECORD_LAYOUT, 32, '3.5: "`HitRecord`, 32 bytes"'],
  [PRIMITIVE_LAYOUT, 48, '3.5: "`Primitive`, 48 bytes"'],
  [BVH_NODE_LAYOUT, 32, '3.5: "`BvhNode`, 32 bytes"'],
  [INSTANCE_LAYOUT, 80, '3.5: "`Instance`, 80 bytes"'],
  [PATCH_ROW_LAYOUT, 40, '3.2: "Row table (40 bytes per film row"'],
  [BLOCK_STATIC_LAYOUT, 96, '3.7: "`BlockStatic`, 96 bytes per block"'],
  [BLOCK_AUX_LAYOUT, 16, '3.7: "`BlockAux`, 16 bytes"'],
  [SOIL_STATIC_LAYOUT, 8, '3.7: "`SoilStatic`, 8 bytes per soil cell"'],
  [BLOCK_FILM_LAYOUT, 4, '3.6: "`blockFilm` is a u32 table per block and grid"'],
  [JET_EXPOSURE_LAYOUT, 56, '5.4: "JetExposure: 56 bytes per soil cell"'],
  [WETTING_SUMMARY_CELL_LAYOUT, 2, 'M7: "perFilmCell: GPUBuffer /* 2 x u8"'],
];

describe('record layouts of sections 3 and 5.4', () => {
  it.each(CONTRACT_SIZES)('%o has the size the contract states', (layout, bytes) => {
    expect(layout.byteSize).toBe(bytes);
    expect(layoutProblems(layout)).toEqual([]);
  });

  it('adds up with the memory table of section 3.8', () => {
    // "BlockStatic + BlockAux | 112 per block".
    expect(BLOCK_STATIC_LAYOUT.byteSize + BLOCK_AUX_LAYOUT.byteSize).toBe(112);
  });

  it('pads the two records whose listed fields fall short of the stated size', () => {
    // Primitive: type u8, feature u8, patch u16; 8 x f32; firstRow u32; aux u32 = 44 of 48.
    expect(listedBytes(PRIMITIVE_LAYOUT)).toBe(1 + 1 + 2 + 8 * 4 + 4 + 4);
    expect(listedBytes(PRIMITIVE_LAYOUT)).toBe(44);
    // Instance: 3 x 4 f32; root, primBase, blockBase u32; item u16, kind u8, arm u8; 2 x f32;
    // spare u32 = 76 of 80, of which 72 carry data.
    expect(listedBytes(INSTANCE_LAYOUT)).toBe(12 * 4 + 3 * 4 + 2 + 1 + 1 + 2 * 4);
    expect(INSTANCE_LAYOUT.byteSize - listedBytes(INSTANCE_LAYOUT)).toBe(4 + 4);
  });
});

describe('HitRecord, BvhNode (section 3.5)', () => {
  it('orders the hit fields as the contract lists them', () => {
    // "t f32; instance u32; prim u32; patch u32; a f32; b f32; cosInc f32; flags u32"
    expect(HIT_RECORD_LAYOUT.fields.map((f) => `${f.name} ${f.type}`)).toEqual([
      't f32',
      'instance u32',
      'prim u32',
      'patch u32',
      'a f32',
      'b f32',
      'cosInc f32',
      'flags u32',
    ]);
  });

  it('interleaves the box corners with the two indices of a node', () => {
    // "min vec3 f32, leftOrFirst u32, max vec3 f32, count u32": each corner with its word
    // makes one 16-byte vec4 slot.
    expect(BVH_NODE_LAYOUT.fields.map((f) => [f.name, f.offset])).toEqual([
      ['min', 0],
      ['leftOrFirst', 12],
      ['max', 16],
      ['count', 28],
    ]);
  });
});

describe('row table (section 3.2)', () => {
  it('holds nine f32 and one packed word', () => {
    const floats = PATCH_ROW_LAYOUT.fields.filter((f) => f.type === 'f32');
    expect(floats).toHaveLength(9);
    expect(offsetOf(PATCH_ROW_LAYOUT, 'packed')).toBe(36);
  });

  it('packs log2 N_theta, zone, side and seven flags into 22 bits', () => {
    // "{log2 N_th: 5 bits; developable zone id: 8; side: 2; flags: convex edge, concave fold,
    // band boundary above, band boundary below, gutter row, rim apex, pole: 7; spare}"
    const bits = bitWidths(PATCH_ROW_LAYOUT, 'packed');
    expect(bits.slice(0, 3)).toEqual(['log2Ntheta:5', 'zone:8', 'side:2']);
    expect(bits.slice(3)).toEqual([
      'convexEdge:1',
      'concaveFold:1',
      'bandAbove:1',
      'bandBelow:1',
      'gutterRow:1',
      'rimApex:1',
      'pole:1',
    ]);
    const used = bits.reduce((sum, b) => sum + Number(b.split(':')[1]), 0);
    expect(used).toBe(5 + 8 + 2 + 7);
  });

  it('can hold the column count of the widest row of any tier', () => {
    // Section 3.2: N_th,C = 4 * 2^round(log2(2 pi r / (4 D_C))), doubled for the official tier
    // and again for the reference tier. A 0.5 m radius is beyond any item or arm.
    const coarse = 4 * 2 ** Math.round(Math.log2((2 * Math.PI * 0.5) / (4 * 0.004)));
    const reference = 4 * coarse;
    expect(Math.log2(reference)).toBeLessThan(2 ** 5);
  });

  it('uses the side codes that section 5.6 fixes for the result', () => {
    // "side: Uint8Array; // [N_e] part index; 0 out, 1 in, 2 rim or edge"
    expect(SIDE_CODES).toEqual({ out: 0, in: 1, rim: 2 });
  });
});

describe('BlockStatic, BlockAux, SoilStatic (section 3.7)', () => {
  it('places the rows of the BlockStatic table at the offsets the contract gives', () => {
    // Offset column of the table: 0, 16, 24, 32, 64, 80, 84, 88, 92.
    const firstOfRow = [
      'centre',
      'normal',
      'gN',
      'donor',
      'donorWeight',
      'twin',
      'firstFilmCell',
      'firstSoilCell',
      'gap',
    ];
    expect(firstOfRow.map((name) => offsetOf(BLOCK_STATIC_LAYOUT, name))).toEqual([
      0, 16, 24, 32, 64, 80, 84, 88, 92,
    ]);
    // Type column: vec3 f32; f32 | 2 x i16; i16; f16 | 4 x f16 | 8 x u32 | 8 x u16 | u32 x 3 | 4 x u8.
    const types = fieldsOf(BLOCK_STATIC_LAYOUT).map((f) => `${f.count ?? 1}x${f.type}`);
    expect(types).toEqual([
      '3xf32',
      '1xf32',
      '2xi16',
      '1xi16',
      '1xf16',
      '1xf16',
      '1xf16',
      '2xf16',
      '8xu32',
      '8xu16',
      '1xu32',
      '1xu32',
      '1xu32',
      '1xlog8',
      '1xu8',
      '1xu8',
      '1xu8',
    ]);
  });

  it('normalises the donor weights and the coverage rank as the contract writes them', () => {
    // "donorWeight[8] | 8 x u16 / 65535"; "coverage rank (u8 / 255)".
    expect(65535 * (fieldOf(BLOCK_STATIC_LAYOUT, 'donorWeight').scale ?? 0)).toBeCloseTo(1, 12);
    expect(255 * (fieldOf(SOIL_STATIC_LAYOUT, 'coverageRank').scale ?? 0)).toBeCloseTo(1, 12);
  });

  it('numbers the block features in the order of the contract', () => {
    // "feature (smooth, edge row, pit, drip site, wire, contact, pole, dead)"
    expect(Object.keys(BLOCK_FEATURE_CODES)).toEqual([
      'smooth',
      'edgeRow',
      'pit',
      'dripSite',
      'wire',
      'contact',
      'pole',
      'dead',
    ]);
    expect(Object.values(BLOCK_FEATURE_CODES)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('resolves the gap thresholds of the contract in its log code', () => {
    // v(code) = min (max / min)^(code / 255): neighbouring codes differ by this ratio.
    const step = (GAP_LOG_RANGE.max / GAP_LOG_RANGE.min) ** (1 / 255);
    // `scene.gapReach` 10 mm is the top of the range.
    expect(GAP_LOG_RANGE.max).toBe(0.01);
    // `film.gapNoFlow` 0.4 mm and `scene.contactGap` 0.5 mm, and the 0.2, 0.5 and 1 mm gaps of
    // the capillary-rise test, must fall on different codes with room to spare.
    const code = (v: number): number =>
      Math.round(
        (255 * Math.log(v / GAP_LOG_RANGE.min)) / Math.log(GAP_LOG_RANGE.max / GAP_LOG_RANGE.min),
      );
    expect(code(0.5e-3) - code(0.4e-3)).toBeGreaterThanOrEqual(5);
    expect(new Set([0.2e-3, 0.4e-3, 0.5e-3, 1e-3].map(code)).size).toBe(4);
    expect(step - 1).toBeLessThan(0.03);
    expect(code(0.2e-3)).toBeGreaterThan(1);
  });

  it('packs the sixteen bytes of BlockAux as the contract lists them', () => {
    // "patch id and row (u32); catchment area A_up (f32); basin id (u16) and gutter element
    // (u16); film class and sub-cell count (u8), region index (u8), gap reservoir id (u16)"
    expect(BLOCK_AUX_LAYOUT.fields.map((f) => `${f.type}@${f.offset}`)).toEqual([
      'u32@0',
      'f32@4',
      'u16@8',
      'u16@10',
      'u8@12',
      'u8@13',
      'u16@14',
    ]);
    // The patch id must fit the u16 that Primitive gives it.
    expect(bitWidths(BLOCK_AUX_LAYOUT, 'patchRow')).toEqual(['patch:16', 'row:16']);
    // Two bits hold the four film classes; four bits hold the 9 sub-cells of a pole block.
    expect(FILM_CLASSES).toEqual(['S1', 'S2', 'K2', 'LINE']);
    expect(bitWidths(BLOCK_AUX_LAYOUT, 'filmClass')).toEqual(['filmClass:2', 'subCells:4']);
  });

  it('splits the blockFilm word at bit 31', () => {
    // "bit 31 says whether the block is S-solved, bits 0 to 30 are the word offset of its
    // first deposit accumulator"
    const bits = fieldOf(BLOCK_FILM_LAYOUT, 'word').bits ?? [];
    expect(bits.map((b) => [b.name, b.lsb, b.width])).toEqual([
      ['accumulatorOffset', 0, 31],
      ['sSolved', 31, 1],
    ]);
  });
});

describe('enumerations of section 3.5', () => {
  it('numbers primitive types, feature tags and instance kinds in the order listed', () => {
    // Parameters are given for "frustum", "capsule", "polygon".
    expect(PRIMITIVE_TYPE_CODES).toEqual({ frustum: 0, capsule: 1, polygon: 2 });
    // "feature tag: smooth, rim with radius code, wire with width code, edge seam with radius
    // code": four values in two bits.
    expect(Object.values(FEATURE_TAG_CODES)).toEqual([0, 1, 2, 3]);
    // "instances (items, wire groups, basket, tub parts, arms)"
    expect(Object.keys(INSTANCE_KIND_CODES)).toEqual(['item', 'wires', 'basket', 'tub', 'arm']);
  });
});

describe('JetExposure (section 5.4)', () => {
  it('places the rows of the table at the offsets the contract gives', () => {
    // Offset column: 0, 16, 32, 34, 36, 37, 38, 39, 40.
    const names = [
      'tExcTau',
      'tExcM',
      'tauPk',
      'MPk',
      'pPk',
      'nPass',
      'restMax',
      'flags',
      'eventPhase',
    ];
    expect(names.map((name) => offsetOf(JET_EXPOSURE_LAYOUT, name))).toEqual([
      0, 16, 32, 34, 36, 37, 38, 39, 40,
    ]);
  });

  it('stores four events of four bytes each: phase, two peaks and the time above 10 Pa', () => {
    // "event[4] | 4 x {phase u8, tauPk log u8, MPk log u8, t10 log u8}"
    const events = fieldsOf(JET_EXPOSURE_LAYOUT).filter((f) => f.name.startsWith('event'));
    expect(events.map((f) => [f.type, f.offset, f.count, f.stride])).toEqual([
      ['u8', 40, 4, 4],
      ['log8', 41, 4, 4],
      ['log8', 42, 4, 4],
      ['log8', 43, 4, 4],
    ]);
    const t10 = events[3];
    expect(t10?.log).toEqual({ min: 1e-5, max: 1 });
  });

  it('has the shear and momentum-flux levels of the gather', () => {
    // M5: "tauLevel = 3, 5, 10, 20, 30, 50, 100, 200 Pa ...; MLevel = 0.25, 0.5, 1, 2, 4, 8,
    // 16, 32 N/m".
    expect(JET_TAU_LEVELS_PA.join(', ')).toBe('3, 5, 10, 20, 30, 50, 100, 200');
    expect(JET_M_LEVELS_N_PER_M.join(', ')).toBe('0.25, 0.5, 1, 2, 4, 8, 16, 32');
    // One level per u16 of each exceedance curve.
    const count = (name: string): number | undefined => fieldOf(JET_EXPOSURE_LAYOUT, name).count;
    expect(count('tExcTau')).toBe(JET_TAU_LEVELS_PA.length);
    expect(count('tExcM')).toBe(JET_M_LEVELS_N_PER_M.length);
    // "10 Pa is the protein threshold tau*" is a stored level; the peel threshold of 20 N/m
    // lies inside the momentum-flux levels.
    expect(JET_TAU_LEVELS_PA).toContain(10);
    expect(Math.max(...JET_M_LEVELS_N_PER_M)).toBeGreaterThan(20);
  });

  it('saturates an exceedance time at one whole revolution', () => {
    // "every u16 time saturates at 65,535 (a stalled arm holds a cell above threshold for the
    // whole revolution)", in units of 2^-16 revolution.
    const field = fieldOf(JET_EXPOSURE_LAYOUT, 'tExcTau');
    expect(field.saturating).toBe(true);
    expect(65535 * (field.scale ?? 0)).toBeCloseTo(1, 4);
    expect(65536 * (field.scale ?? 0)).toBe(1);
  });

  it('names the six flag bits in the order of the table', () => {
    // "bit 0 droplet-train majority; 1 pre-wetted correction applied; 2 track clipped by an
    // edge; 3 fold crossed; 4 capped boundary-layer zone; 5 slot sub-jet"
    expect(fieldOf(JET_EXPOSURE_LAYOUT, 'flags').bits?.map((b) => b.lsb)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it('is version 1 of the exposure schema', () => {
    // Section 5.1: "a versioned schema (`exposureSchema: 1`)".
    expect(EXPOSURE_SCHEMA).toBe(1);
  });
});
