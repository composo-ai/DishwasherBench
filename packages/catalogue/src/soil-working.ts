/**
 * The working quantities of every soil: how much of it there is on the area it covers, on which
 * basis the amount is stated, how much of that is dry matter the wash has to remove, how much
 * of a named region it usually covers, how it has usually been heated and aged, and what its
 * residue looks like (docs/calibration/soil-quantities.md section 2).
 *
 * This is what a level writes a soil record from. `SoilType.loading` remains the dossiers'
 * loading with its provenance; where the two differ the working quantity is the one that is
 * used: 22 soils have no solids fraction in the dossiers, tomato sauce is stated there on a
 * dry basis together with a solids fraction, and the stains are a tenth to a half of the
 * dossiers' upper bound.
 *
 * The wash simulation keeps the same table by soil id (`SOIL_DATA` of `@spotless/sim-soil`) and
 * reads it, not this one. The two are held equal, row by row, by a test of `@spotless/bench`
 * (`soil-agreement.test.ts`), which may depend on both; the catalogue may not depend on the
 * simulation.
 *
 * Units: g/m^2 (1 mg/cm^2 = 10 g/m^2), hours, mass fractions.
 */

import type { SoilHeatHistory } from './types.ts';

/** How the residue of a soil is seen (docs/research/standards.md section 10.3; a stain: chemistry.md 8.6). */
export type SoilAppearance = 'coloured' | 'translucent' | 'fat' | 'stain';

/** Every {@link SoilAppearance}. */
export const SOIL_APPEARANCES: readonly SoilAppearance[] = [
  'coloured',
  'translucent',
  'fat',
  'stain',
];

/** How a soil is laid on an item, which decides how evenly it lies. */
export type SoilLaidOn = 'film' | 'spread' | 'brushed' | 'sprayed';

/** The working quantities of one soil. */
export interface SoilWorkingQuantity {
  /** Whether an amount of this soil is stated wet (as applied) or dry. */
  readonly basis: 'wet' | 'dry';
  /** Dry matter the wash has to remove per unit of the stated amount; 1 for a soil stated dry. */
  readonly solidsFraction: number;
  /** Where the solids fraction comes from. */
  readonly solidsSource: 'catalogue' | 'dossier' | 'composition';
  /** Working loading of the covered area on that basis, g/m^2. */
  readonly gPerM2: number;
  /** The range a soil record may lie in on the area it covers, g/m^2. */
  readonly rangeGPerM2: readonly [number, number];
  /** Share of a named region a record of the soil usually covers. */
  readonly coverage: number;
  /** The heat history the soil usually has (one of the soil's `heatHistories`). */
  readonly heatHistory: SoilHeatHistory;
  /** Usual hours from soiling to the wash. */
  readonly ageH: number;
  readonly appearance: SoilAppearance;
  readonly laidOn: SoilLaidOn;
  /** Where the numbers come from. */
  readonly source: string;
}

function w(
  basis: 'wet' | 'dry',
  solidsFraction: number,
  solidsSource: SoilWorkingQuantity['solidsSource'],
  gPerM2: number,
  rangeGPerM2: readonly [number, number],
  coverage: number,
  heatHistory: SoilHeatHistory,
  ageH: number,
  appearance: SoilAppearance,
  laidOn: SoilLaidOn,
  source: string,
): SoilWorkingQuantity {
  return {
    basis,
    solidsFraction,
    solidsSource,
    gPerM2,
    rangeGPerM2,
    coverage,
    heatHistory,
    ageH,
    appearance,
    laidOn,
    source,
  };
}

/** The working quantities by soil id; every soil of the catalogue has an entry (tested). */
// prettier-ignore
export const SOIL_WORKING: Readonly<Record<string, SoilWorkingQuantity>> = {
  aham_coffee: w('dry', 1, 'dossier', 0.15, [0.05, 1], 0.6, 'none', 2, 'stain', 'film', 'as coffee'),
  aham_creamed_corn: w('wet', 0.25, 'composition', 150, [50, 300], 0.25, 'none', 2, 'coloured', 'spread', 'creamed corn is about a quarter solids, yellow'),
  aham_egg_yolk: w('wet', 0.5, 'catalogue', 150, [100, 300], 0.25, 'none', 2, 'coloured', 'spread', 'standards 4.2'),
  aham_ground_beef: w('wet', 0.4, 'catalogue', 120, [60, 300], 0.25, 'none', 2, 'coloured', 'spread', 'standards 4.2'),
  aham_mashed_potato: w('wet', 0.22, 'catalogue', 1500, [500, 3000], 0.25, 'none', 2, 'translucent', 'spread', 'standards 4.2'),
  aham_oatmeal: w('wet', 0.16, 'catalogue', 600, [300, 1000], 0.25, 'none', 2, 'translucent', 'spread', 'standards 4.2'),
  aham_peanut_butter: w('wet', 0.98, 'catalogue', 300, [100, 500], 0.25, 'none', 2, 'fat', 'spread', 'standards 4.2'),
  aham_raspberry_preserves: w('wet', 0.65, 'catalogue', 100, [30, 300], 0.25, 'none', 2, 'coloured', 'spread', 'standards 4.2'),
  aham_tomato_juice: w('wet', 0.06, 'composition', 30, [10, 60], 0.6, 'none', 2, 'coloured', 'film', 'tomato juice is about 6 % solids'),
  avocado: w('wet', 0.27, 'catalogue', 150, [50, 300], 0.3, 'none', 2, 'coloured', 'spread', 'soils 5.10'),
  burnt_carbonised: w('dry', 1, 'dossier', 100, [20, 300], 0.3, 'burnt', 2, 'coloured', 'spread', 'soils 8.1 (stated dry)'),
  burnt_sugar: w('dry', 1, 'dossier', 100, [20, 300], 0.3, 'baked', 2, 'coloured', 'spread', 'soils 5.6 (stated dry); a burnt soil'),
  butter_margarine: w('wet', 0.82, 'composition', 10, [5, 150], 0.3, 'none', 1, 'fat', 'spread', 'butter and margarine are about 82 % fat and solids; the catalogue names both, the melting curve is butter\'s'),
  caramel: w('wet', 0.85, 'composition', 100, [30, 300], 0.3, 'cooked', 2, 'coloured', 'spread', 'a caramel sauce is about 85 % solids'),
  cheese_baked: w('dry', 1, 'dossier', 280, [100, 600], 0.2, 'baked', 2, 'coloured', 'spread', 'soils 8.1 (baked complex soil, stated dry)'),
  cheese_melted: w('wet', 0.6, 'catalogue', 800, [300, 2000], 0.2, 'warm', 2, 'coloured', 'spread', 'soils 8.1'),
  chocolate: w('wet', 0.99, 'composition', 100, [30, 300], 0.3, 'none', 2, 'fat', 'spread', 'cocoa butter clears at 34 to 37 C, nearest to butter in chemistry 4.2, which does not list it'),
  coffee: w('dry', 1, 'dossier', 0.15, [0.05, 1], 0.6, 'none', 12, 'stain', 'film', 'soils 5.7: less tenacious than tea; a third of an IKW-level stain'),
  cream: w('wet', 0.4, 'composition', 50, [20, 150], 0.4, 'none', 2, 'fat', 'film', 'whipping cream: 35 % milk fat and 5 % other solids; melts as butter (chemistry 4.2)'),
  curry: w('wet', 0.25, 'composition', 150, [50, 300], 0.3, 'none', 2, 'fat', 'spread', 'a sauce of about a quarter fat and solids; the fat is ghee or oil'),
  dough_batter: w('wet', 0.5, 'composition', 300, [100, 500], 0.3, 'none', 2, 'translucent', 'spread', 'dough about 60 % and batter about 40 % solids'),
  egg_cooked: w('wet', 0.5, 'catalogue', 150, [100, 600], 0.3, 'cooked', 2, 'coloured', 'spread', 'soils 8.1'),
  egg_white: w('wet', 0.12, 'catalogue', 150, [50, 300], 0.3, 'none', 2, 'translucent', 'film', 'soils 8.1 (a clear to white protein film)'),
  egg_yolk_dried: w('wet', 0.5, 'catalogue', 150, [100, 600], 0.3, 'none', 2, 'coloured', 'spread', 'soils 8.1'),
  fat_polymerised: w('dry', 1, 'dossier', 100, [20, 300], 0.4, 'baked', 2, 'coloured', 'film', 'soils 8.1 (stated dry); a burnt soil, the protein law slowed by its bake index'),
  gravy: w('wet', 0.1, 'catalogue', 150, [50, 300], 0.5, 'warm', 2, 'coloured', 'film', 'soils 5.3: a brown starch-thickened film'),
  hummus: w('wet', 0.35, 'catalogue', 300, [100, 500], 0.3, 'none', 2, 'coloured', 'spread', 'a beige starch and protein paste'),
  iec_egg_yolk: w('wet', 0.5, 'catalogue', 113, [100, 170], 1, 'warm', 3, 'coloured', 'brushed', 'standards 13.3: 3 g on the well of a dinner plate, 2 g on a dessert plate (132), 0.3 g on the tines of a fork (165)'),
  iec_margarine: w('wet', 0.82, 'composition', 154, [100, 160], 0.5, 'none', 0, 'fat', 'spread', 'standards 13.3: 0.3 g on half of a knife blade, 5 g on the platter; loaded fresh; margarine is about 82 % fat and solids'),
  iec_milk: w('wet', 0.05, 'dossier', 1950, [1500, 3700], 0.25, 'baked', 3, 'translucent', 'film', 'standards 13.3: 10 mL (10.3 g) per glass on a quarter of the interior, 53 cm2 of the test glass; solids to digest 0.05 (soil.milk.solidsFraction); cooked dry in a microwave oven at about 100 C'),
  iec_minced_meat: w('wet', 0.21, 'catalogue', 113, [100, 120], 1, 'warm', 3, 'coloured', 'spread', 'standards 4.4, 13.3: 3 g on the well of a dinner plate (266 cm2)'),
  iec_oat_flakes: w('wet', 0.08, 'catalogue', 122, [100, 160], 1, 'warm', 3, 'translucent', 'spread', 'standards 4.1 (verified: 3 g, 10.6 mg/cm2, brushed on with the rim free), 4.4'),
  iec_spinach: w('wet', 0.08, 'composition', 120, [100, 135], 1, 'warm', 3, 'coloured', 'spread', 'standards 13.3: 2 g on a dessert plate; minced frozen spinach is about 92 % water'),
  iec_tea: w('dry', 1, 'dossier', 0.25, [0.1, 1], 0.6, 'warm', 3, 'stain', 'film', 'standards 4.1, 13.3: half-filled once, 1 h at 80 C, emptied: taken as half the film of the IKW stain (two fills drawn down in steps, hard water with iron, stored 3 days), range 0.2 to 2 of it'),
  ikw_creme_brulee: w('wet', 0.33, 'catalogue', 198, [187, 209], 0.8, 'baked', 4, 'coloured', 'spread', 'standards 4.3 (verified: 19.8 mg/cm2, 2 cm rim free)'),
  ikw_egg_yolk: w('wet', 0.5, 'catalogue', 107, [100, 115], 1, 'cooked', 30, 'coloured', 'brushed', 'standards 4.3 (verified: 1.5 g on 140 cm2, 750 mg dry)'),
  ikw_milk_microwaved: w('wet', 0.05, 'dossier', 1950, [1500, 3700], 0.25, 'baked', 3, 'translucent', 'film', 'standards 4.1: 10 mL baked 10 min at 450 W, then 2 h at 80 C'),
  ikw_milk_skin: w('wet', 0.25, 'composition', 30, [10, 60], 0.3, 'warm', 3, 'translucent', 'film', 'as milk_skin'),
  ikw_minced_meat: w('wet', 0.21, 'catalogue', 118, [113, 123], 1, 'baked', 3, 'coloured', 'spread', 'standards 4.3 (verified: 11.8 mg/cm2)'),
  ikw_pasta: w('wet', 0.15, 'catalogue', 120, [100, 140], 1, 'baked', 3, 'translucent', 'spread', 'standards 4.4'),
  ikw_starch_mix: w('dry', 1, 'dossier', 37.5, [35, 40], 1, 'warm', 52, 'translucent', 'sprayed', 'standards 4.3 (verified: 3.75 mg/cm2 dry; 48 h air and 4 h at 80 C)'),
  ikw_tea: w('dry', 1, 'dossier', 0.5, [0.2, 1], 0.9, 'none', 72, 'stain', 'film', 'standards 4.3, chemistry 3.4: the IKW-level stain, the nominal film of soil.tea.visibleMass'),
  jam: w('wet', 0.65, 'catalogue', 100, [30, 300], 0.3, 'none', 2, 'coloured', 'spread', 'soils 8.1'),
  lard_tallow: w('wet', 1, 'composition', 150, [20, 300], 0.5, 'cooked', 2, 'fat', 'film', 'roast drippings: the catalogue names lard and tallow together; the harder of the two (a record of lard alone can name the class fat_lard)'),
  lipstick: w('wet', 1, 'composition', 5, [1, 20], 0.1, 'none', 2, 'fat', 'film', 'waxes melt above every fat of chemistry 4.2; the hardest listed stands for them'),
  mashed_potato: w('wet', 0.22, 'catalogue', 1500, [500, 3000], 0.3, 'none', 2, 'translucent', 'spread', 'soils 8.1 (white crusty patches; the starch threshold)'),
  mayonnaise: w('wet', 0.8, 'composition', 150, [50, 300], 0.3, 'none', 2, 'fat', 'spread', 'about 78 % oil with egg yolk'),
  milk_burnt: w('wet', 0.07, 'composition', 200, [100, 3500], 0.3, 'cooked', 2, 'translucent', 'film', 'whole milk: protein 3.3 and fat 3.6 g per 100 g are the film to digest (soil.milk.solidsFraction)'),
  milk_film: w('wet', 0.125, 'catalogue', 30, [10, 60], 0.6, 'none', 2, 'translucent', 'film', 'soils 8.1: a cold-dried milk film redisperses'),
  milk_skin: w('wet', 0.25, 'composition', 30, [10, 60], 0.3, 'warm', 2, 'translucent', 'film', 'a skin of milk protein and fat, about a quarter solids'),
  minced_meat: w('wet', 0.4, 'catalogue', 120, [60, 300], 0.3, 'cooked', 2, 'coloured', 'spread', 'soils 8.1'),
  mustard: w('wet', 0.3, 'composition', 100, [30, 200], 0.2, 'none', 2, 'coloured', 'spread', 'prepared mustard is 20 to 35 % solids'),
  pasta_starch: w('dry', 1, 'dossier', 37.5, [20, 100], 0.4, 'cooked', 2, 'translucent', 'film', 'soils 8.1 (stated dry)'),
  peanut_butter: w('wet', 0.98, 'catalogue', 300, [100, 500], 0.3, 'none', 2, 'fat', 'spread', 'peanut oil is liquid'),
  porridge: w('wet', 0.16, 'catalogue', 600, [300, 2000], 0.4, 'none', 2, 'translucent', 'spread', 'soils 8.1'),
  red_wine: w('dry', 1, 'dossier', 0.15, [0.05, 1], 0.3, 'none', 12, 'stain', 'film', 'soils 5.7: a dried ring; a third of an IKW-level stain'),
  rice_grains: w('wet', 0.31, 'catalogue', 50, [10, 200], 0.2, 'cooked', 2, 'coloured', 'spread', 'soils 5.4: discrete grains, seen as particles'),
  rice_starch: w('dry', 1, 'dossier', 30, [10, 50], 0.4, 'cooked', 2, 'translucent', 'film', 'soils 5.4 (film of 10 to 50 g/m2, stated dry)'),
  seeds: w('wet', 0.9, 'composition', 30, [10, 100], 0.2, 'none', 2, 'coloured', 'spread', 'dry seeds'),
  spinach_particles: w('wet', 0.08, 'composition', 100, [30, 300], 0.3, 'none', 2, 'coloured', 'spread', 'chopped spinach is about 92 % water'),
  sugar_syrup: w('wet', 0.8, 'catalogue', 100, [30, 300], 0.4, 'none', 2, 'translucent', 'film', 'soils 8.1'),
  tea_tannin: w('dry', 1, 'dossier', 0.25, [0.05, 1], 0.6, 'none', 12, 'stain', 'film', 'soils 5.7, 8.1 (under 1 g/m2); a cup left standing, half an IKW-level stain'),
  tomato_sauce: w('wet', 0.3, 'catalogue', 150, [150, 1000], 0.3, 'none', 2, 'coloured', 'spread', 'soils 8.1 gives 50 to 300 g/m2 dry (278 in the test); the catalogue states a dry basis and a solids fraction of 0.3 together, and the wash has always multiplied by it: an amount is taken as wet sauce, so the catalogue\'s 150 g/m2 is 45 g/m2 dry, the low end of the dossier\'s range'),
  vegetable_oil: w('wet', 1, 'composition', 15, [5, 50], 0.6, 'none', 1, 'fat', 'film', 'chemistry 4.2: liquid at every wash temperature'),
  wheat_biscuit_cereal: w('wet', 0.3, 'catalogue', 600, [300, 2000], 0.3, 'none', 2, 'coloured', 'spread', 'soils 5.4: beige crusted patches with bran'),
  yoghurt: w('wet', 0.135, 'catalogue', 150, [50, 300], 0.4, 'none', 2, 'translucent', 'film', 'soils 5.2'),
};

/**
 * Dry matter of a soil record per covered area, g/m^2: the stated amount over the covered area
 * times the soil's solids fraction.
 */
export function dryLoadingGPerM2(
  working: SoilWorkingQuantity,
  amountG: number,
  coveredAreaM2: number,
): number {
  return (amountG / coveredAreaM2) * working.solidsFraction;
}
