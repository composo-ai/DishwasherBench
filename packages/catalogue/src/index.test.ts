import { STANDARD_GRAVITY } from '@spotless/core';
import { buildCollisionPieces, COLLISION_CHORD_ERROR } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import * as api from './index.ts';

describe('@spotless/catalogue entry point', () => {
  it('exports the loader API', () => {
    for (const name of [
      'getItemType',
      'listItemTypes',
      'getMaterial',
      'listMaterials',
      'frictionPair',
      'contactPairLookup',
      'listSoils',
      'getSoil',
      'describeSoil',
      'instantiate',
      'getDetergent',
      'getRinseAid',
      'validateCatalogue',
    ] as const) {
      expect(typeof api[name], name).toBe('function');
    }
  });

  it('loads a place setting of the standard load: eleven pieces, about 2 kg', () => {
    // One IEC place setting (standards.md 5.1 and 5.3) with the masses of items.md table 10.1
    // and the verified 530 g of the dinner plate.
    const setting: readonly (readonly [string, number])[] = [
      ['dinner_plate_porcelain_iec', 530],
      ['soup_plate_porcelain_230', 490],
      ['dessert_plate_porcelain_190', 300],
      ['saucer_porcelain_140', 155],
      ['tea_cup_porcelain_210', 155],
      ['test_glass_borosilicate_250', 100],
      ['dinner_knife_210', 90],
      ['dinner_fork_185', 45],
      ['soup_spoon_190', 55],
      ['dessert_spoon_160', 40],
      ['teaspoon_130', 25],
    ];
    let kilograms = 0;
    let expectedGrams = 0;
    for (const [id, grams] of setting) {
      const instance = api.instantiate(id);
      kilograms += instance.mass.mass;
      expectedGrams += grams;
      // Every piece is ready for the physics package: collision pieces with known materials.
      const pieces = buildCollisionPieces(instance.shape, { chordError: COLLISION_CHORD_ERROR });
      expect(pieces.length, id).toBeGreaterThan(0);
      for (const piece of pieces) {
        expect(api.hasMaterial(piece.material ?? instance.contact.material), id).toBe(true);
      }
    }
    expect(expectedGrams).toBe(1985);
    expect(Math.abs((kilograms * 1000) / expectedGrams - 1)).toBeLessThan(0.02);
    // On wet coated wire the setting slides under a horizontal force of mu m g with mu 0.13 to
    // 0.15 (items.md 11.1: glass 0.13, steel 0.14, glazed ceramic 0.15): about 2.9 N.
    let force = 0;
    for (const [id] of setting) {
      const instance = api.instantiate(id);
      const mu = api.frictionPair(instance.contact.material, 'rack_wire_pa11', true).friction;
      expect(mu, id).toBeGreaterThanOrEqual(0.13);
      expect(mu, id).toBeLessThanOrEqual(0.15);
      force += mu * instance.mass.mass * STANDARD_GRAVITY;
    }
    expect(force).toBeGreaterThan(0.13 * 1.985 * 9.80665 * 0.98);
    expect(force).toBeLessThan(0.15 * 1.985 * 9.80665 * 1.02);
  });
});
