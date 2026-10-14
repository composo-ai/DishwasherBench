import { describe, expect, it } from 'vitest';
import {
  MAX_ID_LENGTH,
  brandId,
  compareIds,
  isValidId,
  itemId,
  itemTypeId,
  levelId,
  machineId,
  materialId,
  programmeId,
  soilId,
  type ItemId,
} from './ids.ts';

describe('identifiers', () => {
  it('accepts the identifier shapes used in the design documents', () => {
    for (const id of [
      'plate_03',
      'lower_rack.tine_row_2',
      'handle.2',
      'fam07-seed3',
      'bosch_smv4hax40g',
      '7up',
    ]) {
      expect(isValidId(id)).toBe(true);
    }
  });

  it('rejects empty, upper-case, spaced, non-ASCII, badly started and over-long strings', () => {
    for (const id of [
      '',
      'Plate_03',
      'plate 03',
      'plate/03',
      'tasse_à_café',
      '_plate',
      '.x',
      '-x',
    ]) {
      expect(isValidId(id)).toBe(false);
    }
    expect(isValidId('a'.repeat(MAX_ID_LENGTH))).toBe(true);
    expect(isValidId('a'.repeat(MAX_ID_LENGTH + 1))).toBe(false);
  });

  it('brands are plain strings at run time and serialise as such', () => {
    const id: ItemId = itemId('plate_03');
    expect(id).toBe('plate_03');
    expect(JSON.stringify({ id })).toBe('{"id":"plate_03"}');
    expect(typeof itemTypeId('dinner_plate_270')).toBe('string');
    expect(materialId('porcelain_glazed')).toBe('porcelain_glazed');
    expect(soilId('porridge_dried')).toBe('porridge_dried');
    expect(machineId('bosch_smv4hax40g')).toBe('bosch_smv4hax40g');
    expect(programmeId('eco_50')).toBe('eco_50');
    expect(levelId('fam07-seed3')).toBe('fam07-seed3');
  });

  it('branding a malformed string throws (a programmer error)', () => {
    expect(() => itemId('Plate 3')).toThrow(RangeError);
    expect(() => brandId<'X'>('')).toThrow(RangeError);
  });

  it('compareIds orders by UTF-16 code unit, independent of locale', () => {
    // Code units: '-' 45 < '.' 46 < '0'..'9' 48-57 < '_' 95 < 'a'..'z' 97-122.
    const sorted = ['b', 'a_1', 'a1', 'a.1', 'a-1', 'a', 'item_10', 'item_2'].sort(compareIds);
    expect(sorted).toEqual(['a', 'a-1', 'a.1', 'a1', 'a_1', 'b', 'item_10', 'item_2']);
    expect(compareIds('x', 'x')).toBe(0);
    expect(compareIds('a', 'b')).toBe(-1);
    expect(compareIds('b', 'a')).toBe(1);
    // Same order as the default sort, which also compares code units.
    const ids = ['mug_04', 'pan_01', 'plate_03', 'plate_02', 'bowl_02', 'lower_rack.tine_row_2'];
    expect([...ids].sort(compareIds)).toEqual([...ids].sort());
  });
});
