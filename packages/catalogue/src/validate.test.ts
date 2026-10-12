import type { SorDefMm, SorProfilePointMm } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { getItemType, instantiate } from './catalogue.ts';
import { getMaterial } from './materials.ts';
import { getSoil } from './soils.ts';
import type { ItemType, Material, SoilType } from './types.ts';
import {
  DIMENSION_TOLERANCE_MM,
  ESTIMATED_MASS_TOLERANCE,
  QUANTISED_POSE_SLACK_DEG,
  STEADY_POSE_MIN_TIP_DEG,
  validateCatalogue,
  validateItemType,
  validateMaterial,
  validateSoilType,
  VERIFIED_MASS_TOLERANCE,
} from './validate.ts';

/** The laminated-glass dinner plate: a plain shell, 260 x 19 mm, verified at 340 g. */
const PLATE = getItemType('dinner_plate_vitrelle_260');
const PLATE_GEOMETRY = PLATE.geometry as SorDefMm;

/** A copy of the plate record under a test id, with some fields replaced. */
function plate(change: Partial<ItemType> = {}): ItemType {
  return { ...PLATE, id: 'test_plate', ...change };
}

/** The messages `validateItemType` returns for a record. */
function problems(type: ItemType): string[] {
  return validateItemType(type).map((issue) => issue.message);
}

function expectOne(messages: readonly string[], pattern: RegExp): void {
  expect(messages.filter((m) => pattern.test(m))).toHaveLength(1);
}

describe('validateCatalogue', () => {
  it('finds nothing wrong with the catalogue', () => {
    const issues = validateCatalogue().map((i) => `${i.scope} ${i.id}: ${i.message}`);
    expect(issues).toEqual([]);
  });
});

describe('validateItemType', () => {
  it('accepts an unchanged copy of a catalogue record', () => {
    expect(PLATE_GEOMETRY.class).toBe('sor');
    expect(problems(plate())).toEqual([]);
  });

  it('reports a stated dimension more than 2 mm from the geometry', () => {
    expect(DIMENSION_TOLERANCE_MM).toBe(2);
    const withDiameter = (valueMm: number): ItemType =>
      plate({
        dimensions: PLATE.dimensions.map((d) => (d.name === 'diameter' ? { ...d, valueMm } : d)),
      });
    // The geometry is 260.0 mm across.
    expect(problems(withDiameter(261.9))).toEqual([]);
    expect(problems(withDiameter(258.1))).toEqual([]);
    expectOne(problems(withDiameter(262.1)), /dimension 'diameter' is 260\.0 mm, stated 262\.1/);
    expectOne(problems(withDiameter(257.9)), /dimension 'diameter'/);
  });

  it('reports a dimension that is neither measured nor explained, or outside its own range', () => {
    expectOne(
      problems(plate({ dimensions: [{ name: 'diameter', valueMm: 260, tag: 'VERIFIED' }] })),
      /is not measured and does not say why/,
    );
    const ranged = PLATE.dimensions.map((d) =>
      d.name === 'diameter' ? { ...d, rangeMm: [250, 255] as const } : d,
    );
    expectOne(problems(plate({ dimensions: ranged })), /outside the range stated for it/);
  });

  it('holds a verified mass to 15 % and an estimated one to 25 %', () => {
    expect(VERIFIED_MASS_TOLERANCE).toBe(0.15);
    expect(ESTIMATED_MASS_TOLERANCE).toBe(0.25);
    const grams = instantiate(PLATE.id).mass.mass * 1000;
    const stated = (factor: number, tag: 'VERIFIED' | 'ESTIMATED'): ItemType =>
      plate({ mass: { valueG: grams / factor, tag } });
    // Geometry 14 % and 16 % heavier, and as much lighter, than a verified figure.
    expect(problems(stated(1.14, 'VERIFIED'))).toEqual([]);
    expect(problems(stated(0.86, 'VERIFIED'))).toEqual([]);
    expectOne(problems(stated(1.16, 'VERIFIED')), /computed mass .* \(VERIFIED\)/);
    expectOne(problems(stated(0.84, 'VERIFIED')), /computed mass .* \(VERIFIED\)/);
    // The same against an estimate, with the wider tolerance.
    expect(problems(stated(1.24, 'ESTIMATED'))).toEqual([]);
    expectOne(problems(stated(1.26, 'ESTIMATED')), /computed mass .* \(ESTIMATED\)/);
  });

  it('reports a mass above the gross figure of the record', () => {
    const grams = instantiate(PLATE.id).mass.mass * 1000;
    const withGross = (grossG: number): ItemType =>
      plate({ mass: { valueG: grams, tag: 'ESTIMATED', grossG } });
    expect(problems(withGross(grams + 1))).toEqual([]);
    expectOne(problems(withGross(grams - 1)), /exceeds the gross figure/);
  });

  it('reports geometry that does not rest on z = 0', () => {
    const lifted: SorProfilePointMm[] = PLATE_GEOMETRY.profileMm.map(
      ([r, z, t]): SorProfilePointMm => [r, z + 1, t],
    );
    const messages = problems(plate({ geometry: { ...PLATE_GEOMETRY, profileMm: lifted } }));
    // The plate's base is 0.005 mm above the plane as authored (1.24 - 2.47 / 2).
    expect(messages).toEqual(['lowest point is at z = 1.005 mm, not 0']);
  });

  it('reports a material the catalogue does not have, in the geometry or in the list', () => {
    const inGeometry = problems(
      plate({ geometry: { ...PLATE_GEOMETRY, material: 'unobtainium' } }),
    );
    expectOne(inGeometry, /does not expand: .*unobtainium/);
    const inList = problems(plate({ materials: [{ part: '*', material: 'unobtainium' }] }));
    expectOne(inList, /unknown material 'unobtainium'/);
    expectOne(inList, /part 'body' is 'glass_vitrelle' in the geometry but 'unobtainium'/);
  });

  it('reports a materials entry that selects no part', () => {
    const messages = problems(
      plate({
        materials: [
          { part: 'knob', material: 'stainless_steel' },
          { part: '*', material: 'glass_vitrelle' },
        ],
      }),
    );
    expect(messages).toEqual(["materials entry 'knob' selects no part"]);
  });

  it('reports regions that are listed but absent, and present but not listed', () => {
    const extra = [...PLATE.surfaceRegions, { id: 'spout', label: 'lip', foodContact: true }];
    expect(problems(plate({ surfaceRegions: extra }))).toEqual([
      "listed region 'spout' is not a region of the shape",
    ]);
    const missing = PLATE.surfaceRegions.filter((r) => r.id !== 'underside');
    expect(problems(plate({ surfaceRegions: missing }))).toEqual([
      "region 'underside' of the shape is not listed",
    ]);
  });

  it('reports a typical soil on a region the item lacks, or a soil that does not exist', () => {
    expect(
      problems(
        plate({ typicalSoils: [{ region: 'handle', soil: 'egg_yolk_dried', pattern: 'smear' }] }),
      ),
    ).toEqual(["typical soil on unknown region 'handle'"]);
    expect(
      problems(plate({ typicalSoils: [{ region: 'well', soil: 'unobtainium', pattern: 'film' }] })),
    ).toEqual(["typical soil 'unobtainium' is not in the catalogue"]);
    expect(problems(plate({ typicalSoils: [] }))).toEqual(['no typical soil']);
  });

  it('reports a pose marked free-standing in which the item would fall over', () => {
    // A plate on its edge is not in equilibrium on a flat surface.
    const poses = PLATE.placement.stablePoses.map((p) =>
      p.name === 'on_edge' ? { ...p, freeStanding: true } : p,
    );
    const messages = problems(plate({ placement: { ...PLATE.placement, stablePoses: poses } }));
    expectOne(messages, /pose 'on_edge' is marked free-standing but a tilt of 0\.25 degrees/);
    expect(messages).toHaveLength(1);
  });

  it('accepts a free-standing pose that is off the quaternion grid, as long as the item settles next to it', () => {
    // The platform rounds quaternion components to 1e-4 (platform.md section 2), which turns a
    // pose that is not on that grid by up to 0.01 degrees. The plate upside down, turned 33.3
    // degrees about the vertical, is as steady rounded as not. (That every free-standing pose
    // of the catalogue settles within 0.02 degrees of its rounded form, the chef's knife
    // included, which the strict test rejects when rounded, is checked in stability.test.ts.)
    expect(QUANTISED_POSE_SLACK_DEG).toBe(0.05);
    const steady = PLATE.placement.stablePoses.find((p) => p.name === 'inverted');
    if (steady === undefined) throw new Error('no inverted pose');
    const turned = { ...steady, name: 'inverted_turned', rotXyzDeg: [180, 0, 33.3] as const };
    const poses = [...PLATE.placement.stablePoses, turned];
    expect(problems(plate({ placement: { ...PLATE.placement, stablePoses: poses } }))).toEqual([]);
  });

  it('reports a part that is not joined to the rest of the item', () => {
    // A foot ring under a plate is part of the plate; a knob that floats 5 mm above the well
    // is not, and neither is one that only just touches it.
    const withKnob = (zMm: number): ItemType =>
      plate({
        geometry: {
          ...PLATE_GEOMETRY,
          addons: [{ type: 'knob', zMm, radiusMm: 8, heightMm: 30 }],
        },
        materials: [{ part: '*', material: PLATE_GEOMETRY.material }],
        dimensions: PLATE.dimensions.filter((d) => d.name === 'diameter'),
        surfaceRegions: [
          ...PLATE.surfaceRegions,
          { id: 'knob', label: 'knob', foodContact: false },
        ],
      });
    const wellTopMm =
      (PLATE_GEOMETRY.profileMm[0] as SorProfilePointMm)[1] +
      (PLATE_GEOMETRY.profileMm[0] as SorProfilePointMm)[2] / 2;
    const joined = problems(withKnob(wellTopMm - 1)).filter((m) => /not joined/.test(m));
    expect(joined).toEqual([]);
    const floating = problems(withKnob(wellTopMm + 5)).filter((m) => /not joined/.test(m));
    expect(floating).toHaveLength(1);
    expect(floating[0]).toMatch(
      /part 'knob' is not joined to the rest of the item: 'knob' and 'body' are 5\.\d\d mm apart/,
    );
    const touching = problems(withKnob(wellTopMm)).filter((m) => /not joined/.test(m));
    expect(touching).toHaveLength(1);
    expect(touching[0]).toMatch(/apart or merely touch/);
  });

  it('reports a pose that stands firmly but is not marked free-standing', () => {
    expect(STEADY_POSE_MIN_TIP_DEG).toBe(5);
    const poses = PLATE.placement.stablePoses.map((p) =>
      p.name === 'inverted' ? { ...p, freeStanding: false } : p,
    );
    const messages = problems(plate({ placement: { ...PLATE.placement, stablePoses: poses } }));
    expectOne(messages, /pose 'inverted' is not marked free-standing but stands/);
    expect(messages).toHaveLength(1);
  });

  it('reports an item with no free-standing pose, a missing recommended pose, a repeated name', () => {
    const lean = PLATE.placement.stablePoses.filter((p) => !p.freeStanding);
    expectOne(
      problems(plate({ placement: { ...PLATE.placement, stablePoses: lean } })),
      /no free-standing pose/,
    );
    expectOne(
      problems(plate({ placement: { ...PLATE.placement, recommendedPose: 'hanging' } })),
      /recommended pose 'hanging' is not one of its poses/,
    );
    const twice = [...PLATE.placement.stablePoses, PLATE.placement.stablePoses[0]].filter(
      (p): p is ItemType['placement']['stablePoses'][number] => p !== undefined,
    );
    expectOne(
      problems(plate({ placement: { ...PLATE.placement, stablePoses: twice } })),
      /pose name used twice/,
    );
  });

  it('reports flags that contradict the materials or the zones', () => {
    expect(problems(plate({ flags: { ...PLATE.flags, fragile: false } }))).toEqual([
      'fragile flag is false but the body is glass',
    ]);
    expectOne(problems(plate({ flags: { ...PLATE.flags, floats: true } })), /floats flag is true/);
    // The plate's usual zone is the lower rack.
    expect(PLATE.placement.zones).toContain('lower_rack');
    expect(problems(plate({ flags: { ...PLATE.flags, topRackOnly: true } }))).toEqual([
      'is top rack only but lists the lower rack among its usual zones',
    ]);
  });
});

describe('validateMaterial', () => {
  const pp = getMaterial('polypropylene');
  const messages = (material: Material): string[] =>
    validateMaterial(material).map((i) => i.message);

  it('accepts the catalogue records', () => {
    expect(messages(pp)).toEqual([]);
    expect(messages(getMaterial('porcelain_glazed'))).toEqual([]);
  });

  it('reports a floats flag that disagrees with the density (water at 60 C is 983 kg/m^3)', () => {
    expect(pp.density.value).toBeLessThan(983);
    expect(messages({ ...pp, floats: false })).toEqual(['floats flag disagrees with density']);
    const glass = getMaterial('glass_soda_lime');
    expect(messages({ ...glass, floats: true })).toEqual(['floats flag disagrees with density']);
  });

  it('reports a value outside its own range and a property that is not positive', () => {
    expect(messages({ ...pp, density: { ...pp.density, value: 905, range: [910, 950] } })).toEqual([
      'value outside its own range',
    ]);
    const noHeat = {
      ...pp,
      thermal: { ...pp.thermal, specificHeat: { ...pp.thermal.specificHeat, value: 0 } },
    };
    expect(messages(noHeat)).toContain('specific heat must be positive');
  });

  it('reports contact angles with receding above advancing, and a class they do not imply', () => {
    const swapped = {
      ...pp,
      wetting: {
        ...pp.wetting,
        angles: { ...pp.wetting.angles, clean_water: { advancingDeg: 60, recedingDeg: 95 } },
      },
    };
    expect(messages(swapped)).toContain(
      'contact angles in clean_water must satisfy 0 <= receding <= advancing <= 180',
    );
    // Polypropylene is rivulet-prone; calling it a continuous film contradicts its angles.
    expect(pp.wetting.class).toBe('rivulet_prone');
    expect(messages({ ...pp, wetting: { ...pp.wetting, class: 'continuous_film' } })).toEqual([
      'wetting class disagrees with the contact angles',
    ]);
  });
});

describe('validateSoilType', () => {
  const tea = getSoil('tea_tannin');
  const porridge = getSoil('porridge');
  const messages = (soil: SoilType): string[] => validateSoilType(soil).map((i) => i.message);

  it('accepts the catalogue records', () => {
    expect(messages(tea)).toEqual([]);
    expect(messages(porridge)).toEqual([]);
  });

  it('reports a typical loading outside its range and a solids fraction above one', () => {
    expect(
      messages({ ...porridge, loading: { ...porridge.loading, typicalGPerM2: 2500 } }),
    ).toEqual(['typical loading is not inside a positive range']);
    expect(
      messages({ ...porridge, loading: { ...porridge.loading, solidsFraction: 1.2 } }),
    ).toEqual(['solids fraction outside 0 to 1']);
  });

  it('reports a difficulty rank outside 1 to 10 or outside its own range', () => {
    expect(
      messages({ ...porridge, difficulty: { ...porridge.difficulty, rank: 11, range: [7, 11] } }),
    ).toEqual(['difficulty rank outside 1 to 10', 'difficulty rank outside its range']);
    expect(messages({ ...porridge, difficulty: { ...porridge.difficulty, rank: 5 } })).toEqual([
      'difficulty rank outside its range',
    ]);
  });

  it('reports a stain loaded on a wet basis', () => {
    expect(messages({ ...tea, loading: { ...tea.loading, basis: 'wet' } })).toEqual([
      'a stain is loaded as dry matter',
    ]);
  });

  it('reports a heat history without a phrase and an age phrase without a placeholder', () => {
    expect(messages({ ...porridge, heatHistories: [...porridge.heatHistories, 'burnt'] })).toEqual([
      "no description for heat 'burnt'",
    ]);
    expect(
      messages({ ...porridge, description: { ...porridge.description, aged: 'dried on' } }),
    ).toEqual(['aged description has no {age} placeholder']);
    expect(messages({ ...porridge, typicalRegions: [], patterns: [] })).toEqual([
      'no typical region',
      'no pattern',
    ]);
  });
});
