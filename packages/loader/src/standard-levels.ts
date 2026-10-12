/**
 * The levels behind the standard loads that are not levels of the game: the IEC test load, half
 * of it, and the owner's own load of 10 October 2026, all on the owner's machine. They are not
 * played: they are what the wash simulation is anchored and checked on, and whoever washes
 * them names the programme (the anchoring: Eco 50). The everyday family load that used to be
 * here is a starter level now (`mixedFamilyLevel` of `@spotless/levels`).
 *
 * The IEC load follows docs/research/standards.md section 5.1 (the Edition 4 / 5 load as
 * reconstructed there: type A and type B place settings alternating, plus ten serving pieces)
 * and section 13.3 (which soil goes on which piece, the working quantities, oven-dried two
 * hours at 80 degrees C, margarine fresh). Every piece is the catalogue item the dossiers name
 * for it; where the catalogue has no such piece the nearest one stands in and the level says so
 * ({@link IEC_SUBSTITUTIONS}).
 *
 * Items are listed in priority order: the order in which a policy is offered them.
 */

import type { SoilHeatHistory } from '@spotless/catalogue';
import { getItemType, getSoil } from '@spotless/catalogue';
import type { Level, LevelItem, LevelRules, LevelSoil } from '@spotless/levels';
import { INTERFACE_MANUAL, typicalAmountG } from '@spotless/levels';
import { PRIMARY_MACHINE } from '@spotless/machine';

/** A soil of a standard load before it is attached to an item. */
interface SoilSpec {
  readonly type: string;
  /** Region id to covered fraction. */
  readonly regions: Readonly<Record<string, number>>;
  /** Grams on the item; when absent, the catalogue's typical loading times the covered area. */
  readonly amountG?: number;
  readonly ageH: number;
  readonly description: string;
}

function soilOf(itemType: string, spec: SoilSpec): LevelSoil {
  const heat = getSoil(spec.type).heatHistories[0] as SoilHeatHistory;
  return {
    type: spec.type,
    regions: Object.keys(spec.regions).map((region) => ({
      region,
      coverage: spec.regions[region] as number,
    })),
    amountG:
      spec.amountG ??
      typicalAmountG(itemType, { type: spec.type, regions: spec.regions, ageH: spec.ageH }),
    ageH: spec.ageH,
    heatHistory: heat,
    description: spec.description,
  };
}

function numbered(
  prefix: string,
  count: number,
  itemType: string,
  soils: (index: number) => readonly SoilSpec[],
  points?: number,
): LevelItem[] {
  const out: LevelItem[] = [];
  const worth = points ?? getItemType(itemType).game.defaultPoints;
  for (let i = 1; i <= count; i++) {
    out.push({
      id: `${prefix}_${String(i).padStart(2, '0')}`,
      itemType,
      points: worth,
      soils: soils(i).map((spec) => soilOf(itemType, spec)),
    });
  }
  return out;
}

/**
 * Budgets of a standard load, by the starter levels' rule (`starterRules` of `@spotless/levels`):
 * the benchmark dossier's provisional 400 actions, and eight per item on offer where that is more.
 */
export function standardRules(itemCount: number): LevelRules {
  return {
    track: 'one_shot',
    actionsMax: Math.max(400, 8 * itemCount),
    queriesMax: Math.max(300, 15 * itemCount),
    washesMax: 1,
    mechanicalChecks: true,
  };
}

function standardLevel(
  id: string,
  title: string,
  summary: string,
  seed: number,
  items: readonly LevelItem[],
): Level {
  return {
    id,
    title,
    summary,
    machineId: PRIMARY_MACHINE.id,
    config: null,
    racks: {},
    programmeId: PRIMARY_MACHINE.primaryProgramme,
    items,
    rules: standardRules(items.length),
    seed,
    manual: INTERFACE_MANUAL,
  };
}

// ---------------------------------------------------------------------------------------------
// The IEC test load
// ---------------------------------------------------------------------------------------------

/** Hours the IEC soils have dried in the thermal cabinet (standards.md section 13.3). */
const OVEN_DRIED_H = 2;

const DRIED = 'oven-dried for 2 hours at 80 degrees C';

const EGG = (region: string, grams: number): SoilSpec => ({
  type: 'iec_egg_yolk',
  regions: { [region]: 0.6 },
  amountG: grams,
  ageH: OVEN_DRIED_H,
  description: `Egg yolk, ${DRIED}`,
});
const MEAT = (region: string, grams: number): SoilSpec => ({
  type: 'iec_minced_meat',
  regions: { [region]: 0.6 },
  amountG: grams,
  ageH: OVEN_DRIED_H,
  description: `Minced-meat mix, ${DRIED}`,
});
const SPINACH = (region: string, grams: number): SoilSpec => ({
  type: 'iec_spinach',
  regions: { [region]: 0.6 },
  amountG: grams,
  ageH: OVEN_DRIED_H,
  description: `Spinach, ${DRIED}`,
});
const OATS = (region: string, grams: number): SoilSpec => ({
  type: 'iec_oat_flakes',
  regions: { [region]: 0.6 },
  amountG: grams,
  ageH: OVEN_DRIED_H,
  description: `Oat-flake porridge, ${DRIED}`,
});
const MILK: SoilSpec = {
  type: 'iec_milk',
  regions: { interior: 0.5 },
  amountG: 10,
  ageH: OVEN_DRIED_H,
  description: 'Milk, 10 ml heated in the glass in a microwave oven until it dried on',
};
const TEA = (region: string): SoilSpec => ({
  type: 'iec_tea',
  regions: { [region]: 0.6 },
  ageH: OVEN_DRIED_H,
  description: `Tea film, ${DRIED}`,
});
const MARGARINE = (region: string, grams: number): SoilSpec => ({
  type: 'iec_margarine',
  regions: { [region]: 0.6 },
  amountG: grams,
  ageH: 0,
  description: 'Margarine, fresh',
});

/**
 * Pieces of the IEC load the catalogue does not carry and what stands in for them
 * (standards.md section 5.3).
 */
export const IEC_SUBSTITUTIONS: readonly {
  readonly piece: string;
  readonly standIn: string;
  readonly note: string;
}[] = [
  {
    piece: 'oven pot (WMF mini pan, 160 mm; item S1b)',
    standIn: 'saucepan_clad_2qt',
    note: 'the catalogue has no 160 mm oven pan; the 159 mm clad saucepan is the nearest pot',
  },
  {
    piece: 'gravy ladle (WMF, 180 mm)',
    standIn: 'ladle_steel_311',
    note: 'the catalogue has one ladle, 311 mm long',
  },
  {
    piece: 'second serving spoon (WMF, 260 mm)',
    standIn: 'serving_spoon_216',
    note: 'the catalogue serving spoon is 216 mm long',
  },
];

/**
 * The items of the IEC load for a number of place settings: odd settings are type A (dinner
 * plate, dessert plate, mug, glass dessert bowl, glass), even ones type B (soup plate, cup,
 * saucer, melamine dessert plate, glass), each with five pieces of cutlery, plus the ten
 * serving pieces when `serving` is true. Thirteen settings give 140 items.
 *
 * The order is the priority order: place setting by place setting, so that a machine that does
 * not take the whole load takes whole settings first, then the serving pieces.
 */
export function iecLoadItems(placeSettings: number, serving = true): LevelItem[] {
  const one = (
    prefix: string,
    n: number,
    itemType: string,
    soils: readonly SoilSpec[],
  ): LevelItem => ({
    id: `${prefix}_${String(n).padStart(2, '0')}`,
    itemType,
    points: getItemType(itemType).game.defaultPoints,
    soils: soils.map((spec) => soilOf(itemType, spec)),
  });
  const items: LevelItem[] = [];
  for (let setting = 1; setting <= placeSettings; setting++) {
    // The k-th setting of its type: every second one carries the alternative soil.
    const k = Math.ceil(setting / 2);
    const first = k % 2 === 1;
    if (setting % 2 === 1) {
      items.push(
        one('dinner_plate', k, 'dinner_plate_porcelain_iec', [
          first ? EGG('well', 3) : MEAT('well', 3),
        ]),
        one('dessert_plate', k, 'dessert_plate_porcelain_190', [
          first ? EGG('well', 2) : SPINACH('well', 2),
        ]),
        one('glass', setting, 'test_glass_borosilicate_250', [MILK]),
        one('mug', k, 'mug_ceramic_300', [TEA('interior')]),
        one('dessert_bowl', k, 'dessert_bowl_vitrelle_130', [
          first ? OATS('interior', 2) : SPINACH('interior', 2),
        ]),
      );
    } else {
      items.push(
        one('soup_plate', k, 'soup_plate_porcelain_230', [OATS('well', 3)]),
        one('glass', setting, 'test_glass_borosilicate_250', [MILK]),
        one('cup', k, 'tea_cup_porcelain_210', [TEA('interior')]),
        one('saucer', k, 'saucer_porcelain_140', [TEA('well')]),
        one('melamine_plate', k, 'melamine_dessert_plate_iec_195', [
          first ? SPINACH('well', 2) : MEAT('well', 2),
        ]),
      );
    }
    items.push(
      one('fork', setting, 'dinner_fork_185', [EGG('tines', 0.3)]),
      one('knife', setting, 'dinner_knife_210', [MARGARINE('blade', 0.3)]),
      one('soup_spoon', setting, 'soup_spoon_190', [OATS('bowl', 0.3)]),
      one('dessert_spoon', setting, 'dessert_spoon_160', []),
      one('teaspoon', setting, 'teaspoon_130', []),
    );
  }
  if (serving) {
    items.push(
      ...numbered('oval_platter', 1, 'oval_platter_porcelain_320', () => [MARGARINE('well', 5)]),
      ...numbered('small_pot', 1, 'saucepan_steel_170', () => [MEAT('interior_base', 5)]),
      ...numbered('oven_pot', 1, 'saucepan_clad_2qt', () => [SPINACH('interior_base', 5)]),
      ...numbered('glass_bowl', 1, 'glass_bowl_180', () => [SPINACH('interior', 5)]),
      ...numbered('melamine_bowl', 2, 'melamine_bowl_iec_213', (i) => [
        i % 2 === 1 ? MEAT('interior', 5) : SPINACH('interior', 5),
      ]),
      ...numbered('serving_spoon', 2, 'serving_spoon_216', () => []),
      ...numbered('serving_fork', 1, 'serving_fork_210', () => []),
      ...numbered('gravy_ladle', 1, 'ladle_steel_311', () => []),
    );
  }
  return items;
}

/** The IEC test load of 13 place settings with its serving pieces: 140 items. */
export function iecLevel(): Level {
  return standardLevel(
    'iec-13',
    'IEC test load, 13 place settings',
    'The EN 60436 load the machine is rated for: seven type A and six type B place settings with ten serving pieces, soiled as the standard prescribes and dried in the thermal cabinet.',
    60436,
    iecLoadItems(13, true),
  );
}

/**
 * Half of the IEC load: six place settings (three of each type) and half of the serving pieces
 * (the platter, one pot, one melamine bowl, a serving spoon and the serving fork): 65 items.
 */
export function halfIecLevel(): Level {
  const keep = new Set([
    'oval_platter_01',
    'small_pot_01',
    'melamine_bowl_01',
    'serving_spoon_01',
    'serving_fork_01',
  ]);
  return standardLevel(
    'iec-half',
    'Half an IEC load',
    'Six of the thirteen place settings of the EN 60436 load and half of its serving pieces, soiled as the standard prescribes.',
    60437,
    [...iecLoadItems(6, false), ...iecLoadItems(13, true).filter((item) => keep.has(item.id))],
  );
}

// ---------------------------------------------------------------------------------------------
// The everyday family load
// ---------------------------------------------------------------------------------------------

const HOME = (
  type: string,
  regions: Readonly<Record<string, number>>,
  ageH: number,
  description: string,
): SoilSpec => ({ type, regions, ageH, description });

/**
 * What stands in for each piece of the owner's loaded lower basket of 2026-10-10
 * (docs/reference/owner-photos/2026-10-10-lower-basket-loaded-by-owner.jpg): the catalogue has
 * none of his own ware, so the nearest piece of each kind is used. Left: the level's item ids;
 * right: what it is in the photograph and how the stand-in differs.
 */
export const OWNER_LOAD_STAND_INS: Readonly<Record<string, string>> = {
  'plate_01, plate_02':
    'the two wide-rimmed plates of the rear rows (published as 27 x 3.2 cm): dinner_plate_porcelain_270, 270 x 30 mm, a plain coupe profile where his have a broad flat rim',
  baking_tray_01:
    'the dark baking tray at the left wall: baking_tray_half_sheet, 455 x 328 x 25 mm (his looks a little shorter)',
  board_brown_01:
    'the thin brown chopping board across the back: chopping_board_pe_340, 340 x 240 x 8 mm',
  board_white_01:
    'the white plastic chopping board at the right wall: chopping_board_pp_375, 375 x 267 x 8 mm (his is thicker)',
  'pasta_bowl_01, pasta_bowl_02':
    'the two wide-rimmed pasta bowls: pasta_bowl_porcelain_230, 230 x 65 mm',
  serving_bowl_01:
    'the large lettered serving bowl at the front left: serving_bowl_vitrelle_216, 216 x 65 mm, smaller and far lighter (310 g) than his earthenware bowl',
  cereal_bowl_01: 'the cereal bowl at the front: cereal_bowl_porcelain_160, 160 x 70 mm',
  frying_pan_01:
    'the stainless frying pan: frying_pan_clad_254, 254 mm across and 470 mm with its handle',
  'fork_01..06, knife_01..04, spoon_01..04, teaspoon_01..02':
    'the forks, knives and spoons of the cutlery basket, heads up: the catalogue cutlery; the count is an estimate from the photograph',
  tongs_01:
    "the kitchen tongs: turner_nylon_279, a tool of about their length. The catalogue's tongs (tongs_steel_350) are 350 mm long; stood in the cutlery basket, where a piece can lean no more than 20 degrees, they reach 335 mm above the base grid and stop the upper arm, which his evidently do not",
  peeler_01:
    'the kitchen scissors, which the catalogue does not have: swivel_peeler_180 stands in as a small tool with a handle',
  'mug_01, glass_01, glass_02, container_01, container_02':
    'what can be seen of the upper basket (a patterned mug, glasses, plastic containers): mug_ceramic_300, tumbler_360, food_container_600ml, placed where the photograph shows them only roughly',
};

/**
 * The owner's own load of 2026-10-10, as far as the catalogue allows (see
 * {@link OWNER_LOAD_STAND_INS}): 33 items with the soils of an ordinary day. The soils are a
 * guess: the photograph shows the ware after loading, not what was on it.
 */
export function ownerLoadLevel(): Level {
  const items: LevelItem[] = [
    ...numbered('plate', 2, 'dinner_plate_porcelain_270', () => [
      HOME('tomato_sauce', { well: 0.5 }, 12, 'Tomato sauce from dinner, dried overnight'),
    ]),
    ...numbered('baking_tray', 1, 'baking_tray_half_sheet', () => [
      HOME('lard_tallow', { interior: 0.4 }, 12, 'Roasting fat, set'),
    ]),
    ...numbered('board_brown', 1, 'chopping_board_pe_340', () => [
      HOME('spinach_particles', { top: 0.3 }, 12, 'Shreds of vegetables on the cutting side'),
    ]),
    ...numbered('board_white', 1, 'chopping_board_pp_375', () => [
      HOME('spinach_particles', { top: 0.3 }, 12, 'Shreds of vegetables on the cutting side'),
    ]),
    ...numbered('pasta_bowl', 2, 'pasta_bowl_porcelain_230', () => [
      HOME('pasta_starch', { interior: 0.5 }, 12, 'Starchy film from pasta, dried on'),
    ]),
    ...numbered('serving_bowl', 1, 'serving_bowl_vitrelle_216', () => [
      HOME('vegetable_oil', { interior: 0.5 }, 12, 'Salad dressing'),
    ]),
    ...numbered('cereal_bowl', 1, 'cereal_bowl_porcelain_160', () => [
      HOME('porridge', { interior: 0.4 }, 3, 'Porridge from breakfast'),
    ]),
    ...numbered('frying_pan', 1, 'frying_pan_clad_254', () => [
      HOME('egg_cooked', { interior_base: 0.5 }, 12, 'Fried egg stuck to the bottom'),
    ]),
    ...numbered('fork', 6, 'dinner_fork_185', () => [
      HOME('tomato_sauce', { tines: 0.5 }, 12, 'Tomato sauce between the tines'),
    ]),
    ...numbered('knife', 4, 'dinner_knife_210', () => [
      HOME('butter_margarine', { blade: 0.4 }, 3, 'Butter on the blade'),
    ]),
    ...numbered('spoon', 4, 'dessert_spoon_160', () => [
      HOME('porridge', { bowl: 0.6 }, 3, 'Porridge in the bowl of the spoon'),
    ]),
    ...numbered('teaspoon', 2, 'teaspoon_130', () => [
      HOME('coffee', { bowl: 0.5 }, 3, 'Coffee dried in the bowl'),
    ]),
    ...numbered('tongs', 1, 'turner_nylon_279', () => [
      HOME('lard_tallow', { blade: 0.4 }, 12, 'Fat on the working end'),
    ]),
    ...numbered('peeler', 1, 'swivel_peeler_180', () => [
      HOME('spinach_particles', { blade: 0.3 }, 12, 'Peelings on the blade'),
    ]),
    ...numbered('mug', 1, 'mug_ceramic_300', () => [
      HOME('coffee', { interior: 0.6 }, 3, 'Coffee ring inside'),
    ]),
    ...numbered('glass', 2, 'tumbler_360', () => [
      HOME('milk_film', { interior: 0.5 }, 5, 'A film of milk inside'),
    ]),
    ...numbered('container', 2, 'food_container_600ml', () => [
      HOME('tomato_sauce', { interior: 0.5 }, 24, 'Tomato sauce from a packed lunch'),
    ]),
  ];
  return standardLevel(
    'owner-2026-10-10',
    "The owner's load of 10 October 2026",
    'The lower basket as the owner of the machine loaded it on the morning of 10 October 2026, with what can be seen of his upper basket: plates in the rear rows, a baking tray and two chopping boards along the walls, bowls and a frying pan leaning on one another, the cutlery basket at the front right.',
    20261010,
    items,
  );
}

/** The levels of the standard loads that are not starter levels, by id. */
export function standardLevels(): readonly Level[] {
  return [iecLevel(), halfIecLevel(), ownerLoadLevel()];
}
