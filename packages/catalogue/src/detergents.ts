/**
 * Detergents and rinse aid as data: the IEC reference detergent type D with its dose rule, a
 * generic modern all-in-one tablet, and the IEC reference rinse aid.
 *
 * Sources: docs/research/chemistry.md sections 1.1 (type D, verified from IEC 60436
 * Ed. 4 COR1:2020 Table E.1), 1.2 (dose rules), 1.4 (modern phosphate-free products: ranges
 * recalled from the patent and trade literature) and 8.2 (rinse aid, recalled), and
 * docs/research/standards.md sections 3.3 and 13.4.
 *
 * Only what a formulation is and how much is dosed lives here. Dissolution, pH and reaction
 * kinetics are the wash simulation's.
 * Units: mass percent, grams, millilitres.
 */

import type { Detergent, Ingredient, IngredientRole, Provenance, RinseAid } from './types.ts';

function verified(
  name: string,
  role: IngredientRole,
  massPercent: number,
  specification?: string,
): Ingredient {
  return {
    name,
    role,
    massPercent,
    tag: 'VERIFIED',
    ...(specification === undefined ? {} : { specification }),
  };
}

/**
 * An ingredient of the generic tablet: the dossier recalls a range; the value is the
 * catalogue's choice within it (the middle, adjusted so that the formulation adds up to 100).
 */
function chosen(
  name: string,
  role: IngredientRole,
  massPercent: number,
  rangePercent: readonly [number, number],
  tag: Provenance = 'ESTIMATED',
): Ingredient {
  return { name, role, massPercent, tag, rangePercent };
}

/**
 * IEC reference detergent type D: phosphate-free, percarbonate bleach, enzymes (IEC 60436
 * Ed. 4). Composition [VERIFIED] chemistry.md section 1.1; the sodium carbonate figure is the
 * balance to 100 and is [ESTIMATED] there. The dose rule is that of IEC 60436:2025 clause 5.7
 * [VERIFIED] chemistry.md section 1.2 (it is stated for detergent E; no open text gives the
 * Ed. 4 dose for type D, for which the IKW method uses 20 g).
 */
export const IEC_TYPE_D: Detergent = {
  id: 'iec_type_d',
  name: 'IEC reference detergent type D',
  form: 'powder',
  ingredients: [
    verified('Sodium citrate dihydrate', 'builder', 30),
    verified(
      'Maleic/acrylic acid copolymer sodium salt',
      'dispersant',
      12,
      'Sokalan CP 5 Gran (BASF), 50 % active on sodium carbonate',
    ),
    verified('Sodium percarbonate', 'bleach', 7),
    verified('Tetraacetylethylenediamine (TAED)', 'bleach_activator', 2),
    verified('Sodium disilicate', 'alkalinity', 10),
    verified(
      'Linear fatty alcohol ethoxylate',
      'surfactant',
      2,
      'Plurafac LF 403 (BASF), low-foam nonionic',
    ),
    verified('Protease', 'protease', 1, 'Savinase 6 T (Novozymes)'),
    verified('Amylase', 'amylase', 0.5, 'Termamyl 120 T (Novozymes)'),
    {
      name: 'Sodium carbonate',
      role: 'alkalinity',
      massPercent: 35.5,
      tag: 'ESTIMATED',
      specification: 'balance to 100',
    },
  ],
  dose: {
    kind: 'per_place_setting',
    baseG: 8,
    perPlaceSettingG: 0.5,
    smallMachineBelow: 8,
    perPlaceSettingSmallG: 0.7,
    tag: 'VERIFIED',
    source: 'chemistry.md 1.2 (IEC 60436:2025 clause 5.7, Formula (1))',
  },
  reference:
    'IEC 60436 Ed. 4 Table E.1 as corrected by COR1:2020 (chemistry.md 1.1, standards.md 3.3)',
};

/**
 * A generic modern phosphate-free all-in-one tablet. The ingredient ranges are [RECALLED] in
 * chemistry.md section 1.4 ("for building alternative detergent types in levels, not for
 * calibration"); each value is the catalogue's choice within its range and is [ESTIMATED],
 * except TAED, for which HERA's typical 2.5 % in dishwashing tablets is [VERIFIED]
 * (chemistry.md section 1.3). The dose is one tablet of 19 g: standards.md section 13.4 gives
 * 18 to 20 g for consumer-like levels and chemistry.md section 1.2 verifies 17 to 25 g for
 * commercial unit doses.
 */
export const GENERIC_TABLET: Detergent = {
  id: 'generic_tablet',
  name: 'Generic all-in-one tablet',
  form: 'tablet',
  ingredients: [
    chosen('MGDA trisodium salt', 'builder', 22, [10, 35]),
    chosen('Sodium citrate', 'builder', 15, [5, 30]),
    chosen('Sodium carbonate', 'alkalinity', 24.2, [10, 40]),
    chosen('Sodium disilicate', 'alkalinity', 2.5, [0, 5]),
    chosen('Sodium percarbonate', 'bleach', 15, [10, 20]),
    chosen('Tetraacetylethylenediamine (TAED)', 'bleach_activator', 2.5, [0.5, 3.2], 'VERIFIED'),
    chosen('Low-foam nonionic surfactant', 'surfactant', 5, [2, 8]),
    chosen('Sulfonated polyacrylate', 'dispersant', 6, [2, 10]),
    chosen('Phosphonate (HEDP)', 'scale_inhibitor', 1.5, [0, 3]),
    chosen('Subtilisin protease granulate', 'protease', 2, [1, 3]),
    chosen('Alpha-amylase granulate', 'amylase', 1, [0.5, 2]),
    chosen('Zinc or bismuth salt, benzotriazole', 'glass_care', 0.3, [0.1, 0.5]),
    chosen('High-cloud-point nonionic and polymer', 'rinse_function', 3, [1, 5]),
  ],
  dose: {
    kind: 'unit_dose',
    massG: 19,
    rangeG: [17, 25],
    tag: 'ESTIMATED',
    source:
      'standards.md 13.4 (one 18 to 20 g tablet); chemistry.md 1.2 (commercial unit doses 17 to 25 g, verified)',
  },
  reference:
    'chemistry.md 1.4 (modern commercial phosphate-free products; ranges recalled, values chosen within them)',
};

/** Every detergent, in id order. */
export const DETERGENTS: readonly Detergent[] = [GENERIC_TABLET, IEC_TYPE_D];

/**
 * IEC reference rinse aid "formula III" (acidic). Composition and dose are [RECALLED] in
 * chemistry.md section 8.2 (from memory of the standard; to be verified); that the reference
 * rinse aid is formula III and acidic is [VERIFIED] in standards.md section 3.3.
 */
export const IEC_RINSE_AID_III: RinseAid = {
  id: 'iec_formula_iii',
  name: 'IEC reference rinse aid, formula III',
  ingredients: [
    {
      name: 'Low-foam nonionic surfactant',
      role: 'surfactant',
      massPercent: 12.5,
      tag: 'RECALLED',
      specification: 'Plurafac LF 221',
    },
    {
      name: 'Sodium cumene sulfonate, 40 % solution',
      role: 'hydrotrope',
      massPercent: 11.5,
      tag: 'RECALLED',
    },
    { name: 'Citric acid', role: 'acid', massPercent: 5, tag: 'RECALLED' },
    { name: 'Water', role: 'water', massPercent: 71, tag: 'RECALLED' },
  ],
  doseMl: {
    value: 3,
    tag: 'RECALLED',
    source: 'chemistry.md 8.2 (dispenser settings span roughly 1 to 6 mL)',
    range: [1, 6],
  },
  acidic: true,
  reference: 'chemistry.md 8.2; standards.md 3.3 (formula III, acidic, for EU labelling)',
};

/** Every rinse aid. */
export const RINSE_AIDS: readonly RinseAid[] = [IEC_RINSE_AID_III];

/** Every detergent, sorted by id. */
export function listDetergents(): readonly Detergent[] {
  return DETERGENTS;
}

/** The detergent with the given catalogue id. Throws a RangeError for an unknown id. */
export function getDetergent(id: string): Detergent {
  const found = DETERGENTS.find((d) => d.id === id);
  if (found === undefined) throw new RangeError(`catalogue: unknown detergent '${id}'`);
  return found;
}

/** Every rinse aid, sorted by id. */
export function listRinseAids(): readonly RinseAid[] {
  return RINSE_AIDS;
}

/** The rinse aid with the given catalogue id. Throws a RangeError for an unknown id. */
export function getRinseAid(id: string): RinseAid {
  const found = RINSE_AIDS.find((r) => r.id === id);
  if (found === undefined) throw new RangeError(`catalogue: unknown rinse aid '${id}'`);
  return found;
}

/**
 * Dose of a detergent in grams for a wash. For a detergent dosed per place setting,
 * `placeSettingsLoaded` is the number of place settings in the load and `ratedPlaceSettings`
 * the rated capacity of the machine, which decides the rate (default: the number loaded). A
 * unit dose is one tablet whatever the load.
 */
export function detergentDoseG(
  detergent: Detergent,
  placeSettingsLoaded: number,
  ratedPlaceSettings: number = placeSettingsLoaded,
): number {
  const dose = detergent.dose;
  if (dose.kind === 'unit_dose') return dose.massG;
  if (!(placeSettingsLoaded >= 0) || !Number.isFinite(placeSettingsLoaded)) {
    throw new RangeError('catalogue: the number of place settings must be a finite number >= 0');
  }
  const rate =
    ratedPlaceSettings < dose.smallMachineBelow
      ? dose.perPlaceSettingSmallG
      : dose.perPlaceSettingG;
  return dose.baseG + rate * placeSettingsLoaded;
}

/**
 * Concentration of every ingredient of a detergent in the wash liquor, g/L, for a dose in
 * grams dissolved in a fill in litres. Keys are ingredient names.
 */
export function ingredientConcentrationsGPerL(
  detergent: Detergent,
  doseG: number,
  fillLitres: number,
): Readonly<Record<string, number>> {
  if (!(fillLitres > 0) || !Number.isFinite(fillLitres)) {
    throw new RangeError('catalogue: the fill volume must be a finite number above zero');
  }
  const out: Record<string, number> = {};
  for (const ingredient of detergent.ingredients) {
    out[ingredient.name] = ((ingredient.massPercent / 100) * doseG) / fillLitres;
  }
  return out;
}
