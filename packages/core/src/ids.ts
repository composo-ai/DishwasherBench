/**
 * Branded identifier types. A brand exists only in the type system: at run time every id is a
 * plain string and serialises as one. Brands stop an item-type id being passed where an item
 * instance id is expected. Wire and data-file types use plain `string`; brand at the point where
 * a string has been validated.
 */

declare const brandSymbol: unique symbol;

/** `T` tagged with the compile-time brand `B`. */
export type Brand<T, B extends string> = T & { readonly [brandSymbol]: B };

/** Item instance id, unique within a level, for example `plate_03`. */
export type ItemId = Brand<string, 'ItemId'>;
/** Catalogue item type id, for example `dinner_plate_270`. */
export type ItemTypeId = Brand<string, 'ItemTypeId'>;
/** Catalogue material id, for example `porcelain_glazed`. */
export type MaterialId = Brand<string, 'MaterialId'>;
/** Catalogue soil id, for example `porridge_dried`. */
export type SoilId = Brand<string, 'SoilId'>;
/** Machine id, for example `spot60`. */
export type MachineId = Brand<string, 'MachineId'>;
/** Wash programme id, for example `eco_50`. */
export type ProgrammeId = Brand<string, 'ProgrammeId'>;
/** Level id, for example `fam07-seed3`. */
export type LevelId = Brand<string, 'LevelId'>;

/** Longest identifier accepted by {@link isValidId}. */
export const MAX_ID_LENGTH = 64;

const ID_PATTERN = /^[a-z0-9][a-z0-9_.-]*$/;

/**
 * True when `s` is a well-formed identifier: 1 to 64 characters from lower-case ASCII letters,
 * digits, `_`, `.` and `-`, starting with a letter or digit. This covers instance ids
 * (`plate_03`), dotted part paths (`lower_rack.tine_row_2`) and level ids (`fam07-seed3`).
 */
export function isValidId(s: string): boolean {
  return s.length <= MAX_ID_LENGTH && ID_PATTERN.test(s);
}

/**
 * Brands a string as an identifier of kind `B` after checking that it is well formed. Throws a
 * RangeError otherwise; validate player-supplied strings with {@link isValidId} first and report
 * a rejection value instead.
 */
export function brandId<B extends string>(s: string): Brand<string, B> {
  if (!isValidId(s)) throw new RangeError(`brandId: malformed identifier ${JSON.stringify(s)}`);
  return s as Brand<string, B>;
}

/** Brands a validated string as an {@link ItemId}. Throws a RangeError if malformed. */
export function itemId(s: string): ItemId {
  return brandId<'ItemId'>(s);
}

/** Brands a validated string as an {@link ItemTypeId}. Throws a RangeError if malformed. */
export function itemTypeId(s: string): ItemTypeId {
  return brandId<'ItemTypeId'>(s);
}

/** Brands a validated string as a {@link MaterialId}. Throws a RangeError if malformed. */
export function materialId(s: string): MaterialId {
  return brandId<'MaterialId'>(s);
}

/** Brands a validated string as a {@link SoilId}. Throws a RangeError if malformed. */
export function soilId(s: string): SoilId {
  return brandId<'SoilId'>(s);
}

/** Brands a validated string as a {@link MachineId}. Throws a RangeError if malformed. */
export function machineId(s: string): MachineId {
  return brandId<'MachineId'>(s);
}

/** Brands a validated string as a {@link ProgrammeId}. Throws a RangeError if malformed. */
export function programmeId(s: string): ProgrammeId {
  return brandId<'ProgrammeId'>(s);
}

/** Brands a validated string as a {@link LevelId}. Throws a RangeError if malformed. */
export function levelId(s: string): LevelId {
  return brandId<'LevelId'>(s);
}

/**
 * Deterministic comparison of two identifiers by UTF-16 code unit, for `Array.prototype.sort`.
 * This is the canonical ordering wherever the design says "sorted by id" (body creation order,
 * contact lists, canonical loads). It does not depend on locale, unlike `localeCompare`.
 */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
