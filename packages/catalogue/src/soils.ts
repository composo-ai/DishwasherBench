/**
 * Soil identities: what a soil is called, which class of the soil model it belongs to, how it is
 * described to a player, how much of it there typically is and how hard it is to remove.
 *
 * Sources: docs/research/soils.md section 5 (class by class), 7.9 (classes), 8.1 (default
 * loadings and solids fractions) and 5.11 (difficulty ranking), and docs/research/standards.md
 * section 4 (the soils of IEC 60436, AHAM DW-1 and the IKW method). Difficulty ranks are
 * [ESTIMATED] in the dossier (a synthesis for a 45 to 55 degree C enzymatic cycle). Where the
 * dossiers give no loading for a soil, the range here is the catalogue engineer's and its source
 * says so.
 *
 * Kinetic and adhesion parameters are deliberately absent: they are the wash simulation's.
 * Units: areal loadings in g/m^2 (1 mg/cm^2 = 10 g/m^2).
 */

import { SOIL_WORKING } from './soil-working.ts';
import type {
  Provenance,
  SoilClass,
  SoilDescriptionTemplates,
  SoilDifficulty,
  SoilGroup,
  SoilHeatHistory,
  SoilLoading,
  SoilPattern,
  SoilType,
  StandardSoilSpec,
} from './types.ts';

/** Phrases for the age of a soil, by how the soil ages. */
const AGEING = {
  /** Water-based soils that dry on. */
  dries: { fresh: 'still wet', aged: 'dried on for {age}' },
  /** Fats and oils, which do not dry. */
  sets: { fresh: 'fresh', aged: 'left for {age}' },
  /** Stains from drinks left standing. */
  stains: { fresh: 'fresh', aged: 'left standing for {age}' },
  /** Soils baked or burnt on. */
  baked: { fresh: 'straight from the heat', aged: 'left for {age} after cooking' },
} as const;

function loading(
  basis: 'wet' | 'dry',
  typicalGPerM2: number,
  rangeGPerM2: readonly [number, number],
  solidsFraction: number | null,
  tag: Provenance,
  source: string,
): SoilLoading {
  return { basis, typicalGPerM2, rangeGPerM2, solidsFraction, tag, source };
}

function difficulty(
  rank: number,
  range: readonly [number, number],
  source: string,
): SoilDifficulty {
  return { rank, range, tag: 'ESTIMATED', source };
}

interface SoilSpec {
  readonly id: string;
  readonly name: string;
  readonly group: SoilGroup;
  readonly soilClass: SoilClass;
  readonly secondary?: readonly SoilClass[];
  readonly standard?: StandardSoilSpec;
  /** Noun phrase per applicable heat history; the first key is the default history. */
  readonly byHeat: Readonly<Partial<Record<SoilHeatHistory, string>>>;
  readonly ageing: keyof typeof AGEING;
  readonly loading: SoilLoading;
  readonly regions: readonly string[];
  readonly patterns: readonly SoilPattern[];
  readonly difficulty: SoilDifficulty;
  readonly residue: string;
  readonly stainsPlastics?: boolean;
}

function soilType(spec: SoilSpec): SoilType {
  const description: SoilDescriptionTemplates = { byHeat: spec.byHeat, ...AGEING[spec.ageing] };
  const working = SOIL_WORKING[spec.id];
  if (working === undefined) {
    throw new RangeError(`catalogue: soil '${spec.id}' has no working quantities`);
  }
  return {
    id: spec.id,
    name: spec.name,
    group: spec.group,
    soilClass: spec.soilClass,
    secondaryClasses: spec.secondary ?? [],
    ...(spec.standard === undefined ? {} : { standard: spec.standard }),
    description,
    heatHistories: Object.keys(spec.byHeat) as SoilHeatHistory[],
    loading: spec.loading,
    working,
    typicalRegions: spec.regions,
    patterns: spec.patterns,
    difficulty: spec.difficulty,
    residue: spec.residue,
    stainsPlastics: spec.stainsPlastics ?? false,
  };
}

/** Source text for loadings the dossiers do not give. */
const OWN = 'catalogue engineer (no figure in soils.md)';

const EATING_SURFACES = ['well', 'interior', 'bowl', 'tines'] as const;

const IEC_AGEING = 'dried 2 h at 80 C in a thermal cabinet with the rest of the load';
const AHAM_AGEING = 'air-dried 2 h at room conditions';

/** Every soil type, home soils first, then the soils of the standard test methods. */
export const SOILS: readonly SoilType[] = [
  // ---- egg (soils.md 5.1) ----
  soilType({
    id: 'egg_yolk_dried',
    name: 'Dried egg yolk',
    group: 'egg',
    soilClass: 'SWP',
    byHeat: { none: 'Egg yolk', warm: 'Egg yolk, kept warm' },
    ageing: 'dries',
    loading: loading(
      'wet',
      150,
      [100, 600],
      0.5,
      'ESTIMATED',
      'soils.md 5.1 and 8.1 (real plates 100 to 600 g/m2 wet in the smeared zone; test methods 107 to 146)',
    ),
    regions: EATING_SURFACES,
    patterns: ['smear', 'film'],
    difficulty: difficulty(8, [8, 8], 'soils.md 5.1, 5.11'),
    residue:
      'matt pale-yellow to translucent film, uniform fading rather than patches; occasionally a clean stripe along a jet track',
  }),
  soilType({
    id: 'egg_cooked',
    name: 'Cooked or baked egg',
    group: 'egg',
    soilClass: 'SWP',
    secondary: ['BURN'],
    byHeat: { cooked: 'Cooked egg', baked: 'Baked-on egg' },
    ageing: 'baked',
    loading: loading(
      'wet',
      150,
      [100, 600],
      0.5,
      'ESTIMATED',
      'soils.md 8.1 (egg yolk, cooked or baked: loading as for dried yolk)',
    ),
    regions: ['well', 'interior', 'interior_base', 'blade'],
    patterns: ['patch', 'crust', 'smear'],
    difficulty: difficulty(9, [9, 9], 'soils.md 5.1, 5.11'),
    residue: 'matt pale-yellow film, possibly a residual film where it was baked',
  }),
  soilType({
    id: 'egg_white',
    name: 'Egg white',
    group: 'egg',
    soilClass: 'SWP',
    byHeat: { none: 'Egg white', cooked: 'Fried-on egg white' },
    ageing: 'dries',
    loading: loading('wet', 150, [50, 300], 0.12, 'ESTIMATED', 'soils.md 5.1 and 8.1'),
    regions: ['well', 'interior', 'wires', 'blade'],
    patterns: ['film', 'smear'],
    difficulty: difficulty(5, [5, 7], 'soils.md 5.1 (5 raw-dried, 7 fried on)'),
    residue: 'thin whitish film or flakes at edges, visible when dry',
  }),

  // ---- dairy (soils.md 5.2) ----
  soilType({
    id: 'milk_film',
    name: 'Milk film',
    group: 'dairy',
    soilClass: 'SOL',
    byHeat: { none: 'Milk' },
    ageing: 'dries',
    loading: loading(
      'wet',
      30,
      [20, 50],
      0.125,
      'ESTIMATED',
      'soils.md 5.2 and 8.1 (drained film)',
    ),
    regions: ['interior', 'rim', 'spout'],
    patterns: ['film', 'ring', 'ring_and_film', 'drips'],
    difficulty: difficulty(2, [2, 2], 'soils.md 5.2, 5.11'),
    residue: 'faint white haze',
  }),
  soilType({
    id: 'milk_burnt',
    name: 'Heated, microwaved or burnt milk',
    group: 'dairy',
    soilClass: 'BURN',
    secondary: ['SWP'],
    byHeat: {
      cooked: 'Milk heated in the vessel',
      baked: 'Microwaved, baked-on milk',
      burnt: 'Burnt milk',
    },
    ageing: 'baked',
    loading: loading(
      'wet',
      200,
      [100, 300],
      null,
      'ESTIMATED',
      'soils.md 8.1 ("100 to 300 dry-equivalent film 20 to 100 um")',
    ),
    regions: ['interior', 'interior_base'],
    patterns: ['bottom_pool', 'crust', 'ring'],
    difficulty: difficulty(9, [8, 9], 'soils.md 5.2, 5.11'),
    residue: 'cream to brown patches or rings, rough',
  }),
  soilType({
    id: 'milk_skin',
    name: 'Milk skin',
    group: 'dairy',
    soilClass: 'SWP',
    secondary: ['FAT'],
    byHeat: { warm: 'Milk skin', cooked: 'Milk skin, dried on hot' },
    ageing: 'dries',
    loading: loading(
      'wet',
      30,
      [20, 50],
      null,
      'ESTIMATED',
      `${OWN}: the milk-film loading of soils.md 5.2 is used as a stand-in`,
    ),
    regions: ['interior', 'rim'],
    patterns: ['film', 'ring'],
    difficulty: difficulty(6, [6, 6], 'soils.md 5.2, 5.11'),
    residue: 'translucent skin fragments',
  }),
  soilType({
    id: 'cheese_melted',
    name: 'Melted cheese',
    group: 'dairy',
    soilClass: 'SWP',
    secondary: ['FAT'],
    byHeat: { warm: 'Melted cheese', cooked: 'Melted cheese, cooked on' },
    ageing: 'sets',
    loading: loading('wet', 800, [300, 2000], 0.6, 'ESTIMATED', 'soils.md 5.2 and 8.1'),
    regions: ['well', 'interior', 'tines', 'blade', 'grating'],
    patterns: ['patch', 'smear'],
    difficulty: difficulty(7, [7, 7], 'soils.md 5.2, 5.11'),
    residue: 'rubbery pale-yellow strings and patches',
  }),
  soilType({
    id: 'cheese_baked',
    name: 'Baked cheese or lasagne crust',
    group: 'dairy',
    soilClass: 'BURN',
    secondary: ['SWP', 'FAT'],
    byHeat: { baked: 'Baked-on cheese', burnt: 'Burnt cheese crust' },
    ageing: 'baked',
    loading: loading(
      'dry',
      280,
      [200, 1000],
      null,
      'ESTIMATED',
      'soils.md 5.2 (rim crusts 200 to 1000 g/m2) and 8.1 (baked complex soil 280 g/m2 dry, verified for the Cambridge model soil)',
    ),
    regions: ['interior', 'well', 'rim', 'flange'],
    patterns: ['crust', 'patch'],
    difficulty: difficulty(9, [9, 10], 'soils.md 5.2, 5.9, 5.11'),
    residue: 'brown crust at rims and corners',
  }),
  soilType({
    id: 'yoghurt',
    name: 'Yoghurt',
    group: 'dairy',
    soilClass: 'SWP',
    byHeat: { none: 'Yoghurt' },
    ageing: 'dries',
    loading: loading(
      'wet',
      150,
      [50, 300],
      0.135,
      'ESTIMATED',
      'soils.md 5.2 (50 to 300 g/m2; 85 to 88 % water)',
    ),
    regions: ['interior', 'bowl', 'well'],
    patterns: ['film', 'smear'],
    difficulty: difficulty(5, [3, 5], 'soils.md 5.2 (3 fresh, 5 dried)'),
    residue: 'white film, often in spoon bowls',
  }),
  soilType({
    id: 'cream',
    name: 'Cream',
    group: 'dairy',
    soilClass: 'FAT',
    secondary: ['SWP'],
    byHeat: { none: 'Cream' },
    ageing: 'dries',
    loading: loading('wet', 50, [20, 100], null, 'ESTIMATED', 'soils.md 5.2'),
    regions: ['interior', 'well', 'bowl'],
    patterns: ['film', 'smear'],
    difficulty: difficulty(3, [2, 4], 'soils.md 5.2'),
    residue: 'greasy film',
  }),

  // ---- meat (soils.md 5.3) ----
  soilType({
    id: 'minced_meat',
    name: 'Minced meat with fat',
    group: 'meat',
    soilClass: 'SWP',
    secondary: ['FAT', 'PART'],
    byHeat: {
      none: 'Minced meat juices and fat',
      cooked: 'Cooked-on minced meat and fat',
      baked: 'Baked-on minced meat',
    },
    ageing: 'dries',
    loading: loading(
      'wet',
      120,
      [50, 300],
      0.4,
      'ESTIMATED',
      'soils.md 5.3 and 8.1 (real plates 50 to 300 g/m2; test soil 118 g/m2 wet, verified)',
    ),
    regions: ['well', 'interior', 'tines', 'blade', 'top', 'head'],
    patterns: ['smear', 'specks', 'film'],
    difficulty: difficulty(4, [4, 7], 'soils.md 5.3 (4 fresh, 7 baked)'),
    residue: 'brown specks and a thin protein film; grey greasy film if the fat did not melt',
  }),
  soilType({
    id: 'gravy',
    name: 'Gravy',
    group: 'meat',
    soilClass: 'SWS',
    secondary: ['FAT', 'SWP'],
    byHeat: { none: 'Gravy', warm: 'Gravy, kept warm' },
    ageing: 'dries',
    loading: loading(
      'wet',
      150,
      [50, 300],
      0.1,
      'ESTIMATED',
      'soils.md 5.4 (flour-thickened sauces 50 to 300 g/m2); solids from the composition of 5.3 (3 to 6 % starch, 2 to 5 % fat, 1 to 3 % gelatin and protein)',
    ),
    regions: ['well', 'rim', 'bowl', 'bowl_back', 'tines', 'interior'],
    patterns: ['film', 'drips', 'smear'],
    difficulty: difficulty(4, [4, 5], 'soils.md 5.3, 5.11'),
    residue: 'hazy film',
  }),

  // ---- starch (soils.md 5.4) ----
  soilType({
    id: 'rice_starch',
    name: 'Rice starch film',
    group: 'starch',
    soilClass: 'SWS',
    byHeat: { none: 'Rice starch', cooked: 'Cooked-on rice starch' },
    ageing: 'dries',
    loading: loading(
      'dry',
      30,
      [10, 50],
      null,
      'ESTIMATED',
      'soils.md 5.4 (film of 10 to 50 g/m2)',
    ),
    regions: ['interior', 'interior_base', 'well', 'bowl', 'tip'],
    patterns: ['film', 'crust'],
    difficulty: difficulty(5, [5, 5], 'soils.md 5.4, 5.11'),
    residue: 'clear film, invisible wet, hazy and rough when dry',
  }),
  soilType({
    id: 'pasta_starch',
    name: 'Pasta starch',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['SWP'],
    byHeat: {
      none: 'Pasta starch',
      cooked: 'Cooked-on pasta starch',
      baked: 'Baked-on pasta',
    },
    ageing: 'dries',
    loading: loading(
      'dry',
      37.5,
      [20, 100],
      null,
      'ESTIMATED',
      'soils.md 5.4 (starch film 20 to 100 g/m2 plus stuck pieces) and 8.1 (default 37.5 g/m2 dry, the test value)',
    ),
    regions: ['interior', 'interior_base', 'interior_wall', 'well', 'mesh'],
    patterns: ['film', 'crust', 'ring'],
    difficulty: difficulty(6, [6, 7], 'soils.md 5.4, 5.11'),
    residue: 'translucent film, stuck strands',
  }),
  soilType({
    id: 'porridge',
    name: 'Porridge',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['PART'],
    byHeat: { none: 'Porridge', warm: 'Porridge, kept warm' },
    ageing: 'dries',
    loading: loading(
      'wet',
      600,
      [300, 2000],
      0.16,
      'ESTIMATED',
      'soils.md 5.4 and 8.1 (bowls 300 to 1000 g/m2 with thick ridges; 84 % water)',
    ),
    regions: ['interior', 'well', 'bowl', 'bowl_back', 'rim'],
    patterns: ['bottom_pool', 'ring', 'smear', 'film'],
    difficulty: difficulty(8, [7, 8], 'soils.md 5.4, 5.11'),
    residue: 'beige film and flakes at the waterline of the bowl',
  }),
  soilType({
    id: 'wheat_biscuit_cereal',
    name: 'Wheat-biscuit breakfast cereal',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['PART', 'SWP'],
    byHeat: { none: 'Wheat-biscuit cereal with milk' },
    ageing: 'dries',
    loading: loading(
      'wet',
      600,
      [300, 2000],
      0.3,
      'ESTIMATED',
      'soils.md 5.4 and 8.1 (300 to 2000 g/m2 in bowl bottoms and on spoons; solids 0.16 to 0.30)',
    ),
    regions: ['interior', 'bowl', 'rim'],
    patterns: ['patch', 'bottom_pool', 'ring'],
    difficulty: difficulty(9, [9, 9], 'soils.md 5.4, 5.11'),
    residue: 'beige crusted patches, usually bowl bottom and rim line',
  }),
  soilType({
    id: 'mashed_potato',
    name: 'Mashed potato',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['FAT'],
    byHeat: { none: 'Mashed potato', warm: 'Mashed potato, kept warm' },
    ageing: 'dries',
    loading: loading('wet', 1500, [500, 3000], 0.22, 'ESTIMATED', 'soils.md 5.4 and 8.1'),
    regions: ['well', 'interior', 'tines', 'bowl'],
    patterns: ['patch', 'smear'],
    difficulty: difficulty(6, [6, 6], 'soils.md 5.4, 5.11'),
    residue: 'white crusty patches',
  }),
  soilType({
    id: 'dough_batter',
    name: 'Dough or batter',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['SWP'],
    byHeat: { none: 'Dough or batter', baked: 'Baked-on batter' },
    ageing: 'dries',
    loading: loading(
      'wet',
      300,
      [100, 500],
      null,
      'ESTIMATED',
      'soils.md 5.4 (bread dough smears)',
    ),
    regions: ['interior', 'rim', 'head', 'wires', 'cavities', 'top'],
    patterns: ['smear', 'drips', 'crust'],
    difficulty: difficulty(6, [6, 6], 'soils.md 5.4 (bread dough), 5.11'),
    residue: 'grey-white hard smears',
  }),

  // ---- fats (soils.md 5.5) ----
  soilType({
    id: 'butter_margarine',
    name: 'Butter or margarine',
    group: 'fat',
    soilClass: 'FAT',
    byHeat: { none: 'Butter or margarine' },
    ageing: 'sets',
    loading: loading(
      'wet',
      10,
      [5, 20],
      null,
      'ESTIMATED',
      'soils.md 5.5 and 8.1 (buttered plate)',
    ),
    regions: ['well', 'blade', 'interior', 'head'],
    patterns: ['smear', 'film'],
    difficulty: difficulty(2, [2, 4], 'soils.md 5.5 (2 to 3; 4 in a 40 C cycle on thick items)'),
    residue: 'greasy smear, water beading',
  }),
  soilType({
    id: 'lard_tallow',
    name: 'Lard or tallow',
    group: 'fat',
    soilClass: 'FAT',
    byHeat: { cooked: 'Meat fat (lard or tallow)', none: 'Lard or tallow' },
    ageing: 'sets',
    loading: loading(
      'wet',
      150,
      [50, 300],
      null,
      'ESTIMATED',
      'soils.md 5.5 and 8.1 (roasting tin)',
    ),
    regions: ['interior', 'interior_base', 'blade', 'top', 'tines', 'underside', 'head'],
    patterns: ['film', 'patch'],
    difficulty: difficulty(
      4,
      [3, 6],
      'soils.md 5.5 (lard 3 to 4; tallow and lamb fat 5 to 6 below 50 C)',
    ),
    residue: 'white waxy patches, greasy film',
  }),
  soilType({
    id: 'vegetable_oil',
    name: 'Vegetable oil',
    group: 'fat',
    soilClass: 'FAT',
    byHeat: { none: 'Vegetable oil' },
    ageing: 'sets',
    loading: loading('wet', 15, [5, 30], null, 'ESTIMATED', 'soils.md 5.5 (oily salad bowl)'),
    regions: ['interior', 'underside', 'well'],
    patterns: ['film'],
    difficulty: difficulty(2, [2, 2], 'soils.md 5.5, 5.11'),
    residue: 'greasy smear, rainbow film on glass',
  }),
  soilType({
    id: 'mayonnaise',
    name: 'Mayonnaise',
    group: 'fat',
    soilClass: 'FAT',
    secondary: ['SWP'],
    byHeat: { none: 'Mayonnaise' },
    ageing: 'dries',
    loading: loading('wet', 150, [50, 300], null, 'ESTIMATED', `${OWN}: taken like yoghurt`),
    regions: ['interior', 'well', 'blade', 'bowl'],
    patterns: ['smear'],
    difficulty: difficulty(6, [3, 6], 'soils.md 5.5 (3 fresh, 6 dried)'),
    residue: 'greasy film over a yellowish film',
  }),
  soilType({
    id: 'fat_polymerised',
    name: 'Polymerised baked-on fat',
    group: 'burnt',
    soilClass: 'BURN',
    secondary: ['FAT'],
    byHeat: { baked: 'Baked-on fat', burnt: 'Burnt-on fat' },
    ageing: 'baked',
    loading: loading(
      'dry',
      100,
      [20, 300],
      null,
      'ESTIMATED',
      'soils.md 8.1 (polymerised fat, char)',
    ),
    regions: ['interior', 'interior_base', 'interior_wall', 'exterior', 'cavities', 'wire'],
    patterns: ['film', 'splatter', 'drips', 'crust'],
    difficulty: difficulty(10, [10, 10], 'soils.md 5.5, 5.11'),
    residue: 'brown tacky varnish',
  }),

  // ---- burnt-on (soils.md 5.9) ----
  soilType({
    id: 'burnt_carbonised',
    name: 'Burnt-on carbonised crust',
    group: 'burnt',
    soilClass: 'BURN',
    byHeat: { burnt: 'Burnt-on crust' },
    ageing: 'baked',
    loading: loading(
      'dry',
      100,
      [20, 300],
      null,
      'ESTIMATED',
      'soils.md 8.1 (polymerised fat, char)',
    ),
    regions: ['interior', 'interior_base', 'rim', 'flange'],
    patterns: ['crust', 'patch'],
    difficulty: difficulty(10, [9, 10], 'soils.md 5.9, 5.11'),
    residue:
      'brown to black patches at rims, corners and the former liquid line; rough to the touch',
  }),

  // ---- sugars (soils.md 5.6) ----
  soilType({
    id: 'sugar_syrup',
    name: 'Sugar syrup, honey or dried soft drink',
    group: 'sugar',
    soilClass: 'SOL',
    byHeat: { none: 'Sugary syrup' },
    ageing: 'dries',
    loading: loading(
      'wet',
      100,
      [20, 300],
      0.8,
      'ESTIMATED',
      "soils.md 8.1 (default 100 g/m2, solids 0.65 to 0.82); the range is the catalogue engineer's",
    ),
    regions: ['interior', 'bowl', 'well'],
    patterns: ['bottom_pool', 'film', 'drips'],
    difficulty: difficulty(2, [1, 2], 'soils.md 5.6, 5.11'),
    residue: 'sticky patch only where never wetted',
  }),
  soilType({
    id: 'caramel',
    name: 'Caramel or toffee',
    group: 'sugar',
    soilClass: 'SOL',
    secondary: ['FAT'],
    byHeat: { cooked: 'Caramel' },
    ageing: 'sets',
    loading: loading(
      'wet',
      100,
      [20, 300],
      null,
      'ESTIMATED',
      "soils.md 8.1 (default 100 g/m2 for sugars); the range is the catalogue engineer's",
    ),
    regions: ['interior', 'interior_base', 'well'],
    patterns: ['patch', 'film'],
    difficulty: difficulty(3, [3, 3], 'soils.md 5.6, 5.11'),
    residue: 'amber glassy patch',
  }),
  soilType({
    id: 'burnt_sugar',
    name: 'Burnt sugar',
    group: 'sugar',
    soilClass: 'BURN',
    secondary: ['SOL'],
    byHeat: { baked: 'Caramelised, baked-on sugar', burnt: 'Burnt sugar' },
    ageing: 'baked',
    loading: loading(
      'dry',
      100,
      [20, 300],
      null,
      'ESTIMATED',
      "soils.md 8.1 (default 100 g/m2 for sugars); the range is the catalogue engineer's",
    ),
    regions: ['interior', 'interior_base', 'cavities', 'wire'],
    patterns: ['crust', 'specks'],
    difficulty: difficulty(7, [6, 7], 'soils.md 5.6, 5.11'),
    residue: 'black-brown glassy crust',
  }),
  soilType({
    id: 'jam',
    name: 'Jam or fruit preserve',
    group: 'sugar',
    soilClass: 'SOL',
    secondary: ['PART'],
    byHeat: { none: 'Jam' },
    ageing: 'dries',
    loading: loading(
      'wet',
      100,
      [20, 300],
      0.65,
      'ESTIMATED',
      "soils.md 8.1 (default 100 g/m2, solids 0.65 to 0.82); the range is the catalogue engineer's",
    ),
    regions: ['well', 'blade', 'tines', 'interior'],
    patterns: ['patch', 'smear', 'ring'],
    difficulty: difficulty(2, [2, 3], 'soils.md 5.6, 5.11'),
    residue: 'seeds, fruit skin specks',
  }),
  soilType({
    id: 'chocolate',
    name: 'Chocolate',
    group: 'sugar',
    soilClass: 'FAT',
    secondary: ['SOL', 'PART'],
    byHeat: { none: 'Chocolate', warm: 'Melted chocolate' },
    ageing: 'sets',
    loading: loading('wet', 100, [20, 300], null, 'ESTIMATED', `${OWN}: taken like the sugars`),
    regions: ['well', 'interior', 'tines', 'head'],
    patterns: ['smear', 'patch'],
    difficulty: difficulty(3, [3, 3], 'soils.md 5.6, 5.11'),
    residue: 'brown smear if the item stayed cold',
  }),

  // ---- stains (soils.md 5.7) ----
  soilType({
    id: 'tea_tannin',
    name: 'Tea tannin stain',
    group: 'stain',
    soilClass: 'STAIN',
    byHeat: { none: 'Tea stain', warm: 'Tea stain, dried on warm' },
    ageing: 'stains',
    loading: loading(
      'dry',
      0.5,
      [0.1, 1],
      null,
      'ESTIMATED',
      'soils.md 5.7 and 8.1 (well under 1 g/m2)',
    ),
    regions: ['interior', 'well', 'bowl'],
    patterns: ['ring_and_film', 'ring', 'film'],
    difficulty: difficulty(7, [6, 7], 'soils.md 5.7, 5.11 (bleach-dependent)'),
    residue: 'brown film and tide lines in cups',
  }),
  soilType({
    id: 'coffee',
    name: 'Coffee stain',
    group: 'stain',
    soilClass: 'STAIN',
    secondary: ['FAT'],
    byHeat: { none: 'Coffee' },
    ageing: 'stains',
    loading: loading(
      'dry',
      0.5,
      [0.1, 1],
      null,
      'ESTIMATED',
      'soils.md 5.7 and 8.1 (under 1 g/m2)',
    ),
    regions: ['interior', 'well', 'bowl'],
    patterns: ['bottom_pool', 'ring', 'ring_and_film', 'film'],
    difficulty: difficulty(4, [4, 4], 'soils.md 5.7, 5.11'),
    residue: 'light-brown film',
  }),
  soilType({
    id: 'red_wine',
    name: 'Red wine stain',
    group: 'stain',
    soilClass: 'STAIN',
    byHeat: { none: 'Red wine' },
    ageing: 'stains',
    loading: loading(
      'dry',
      0.5,
      [0.1, 1],
      null,
      'ESTIMATED',
      'soils.md 5.7 and 8.1 (under 1 g/m2)',
    ),
    regions: ['interior'],
    patterns: ['ring', 'bottom_pool'],
    difficulty: difficulty(3, [3, 4], 'soils.md 5.7, 5.11'),
    residue: 'grey-violet ring',
  }),

  // ---- particles (soils.md 5.8) ----
  soilType({
    id: 'spinach_particles',
    name: 'Spinach and herb particles',
    group: 'particle',
    soilClass: 'PART',
    byHeat: { none: 'Spinach and herb fragments', cooked: 'Cooked spinach' },
    ageing: 'dries',
    loading: loading(
      'wet',
      100,
      [20, 300],
      null,
      'ESTIMATED',
      `${OWN}: about 2 g of wet spinach on a dessert plate, the working quantity of standards.md 13.3`,
    ),
    regions: ['well', 'interior', 'top', 'blade', 'grating', 'mesh'],
    patterns: ['specks'],
    difficulty: difficulty(
      3,
      [3, 5],
      'soils.md 5.8 (detachment 3 to 5; redeposition is the usual problem)',
    ),
    residue: 'green or dark specks and grit, usually on items that were clean before the wash',
  }),
  soilType({
    id: 'seeds',
    name: 'Seeds',
    group: 'particle',
    soilClass: 'PART',
    byHeat: { none: 'Seeds (sesame, poppy, tomato, chilli)' },
    ageing: 'dries',
    loading: loading(
      'wet',
      30,
      [5, 100],
      null,
      'ESTIMATED',
      `${OWN}: scattered seeds of 0.5 to 3 mm stuck by a thin binder`,
    ),
    regions: ['well', 'interior', 'mesh', 'top'],
    patterns: ['specks'],
    difficulty: difficulty(3, [3, 5], 'soils.md 5.8'),
    residue: 'dark specks, often redeposited on other items',
  }),
  soilType({
    id: 'rice_grains',
    name: 'Stuck rice grains',
    group: 'particle',
    soilClass: 'PART',
    secondary: ['SWS'],
    byHeat: { none: 'Rice grains', cooked: 'Cooked-on rice grains' },
    ageing: 'dries',
    loading: loading(
      'wet',
      50,
      [10, 150],
      0.31,
      'ESTIMATED',
      `${OWN}: 5 to 50 cooked grains of about 25 mg on 100 cm2; solids from soils.md 5.4 (68 to 70 % water)`,
    ),
    regions: ['interior', 'well', 'tip', 'mesh'],
    patterns: ['specks'],
    difficulty: difficulty(5, [5, 5], 'soils.md 5.4, 5.11'),
    residue: 'stuck grains; redeposited grains elsewhere',
  }),

  // ---- mixed meal soils (soils.md 5.10) ----
  soilType({
    id: 'tomato_sauce',
    name: 'Tomato sauce or ketchup',
    group: 'mixed',
    soilClass: 'PEEL',
    secondary: ['STAIN'],
    byHeat: {
      none: 'Tomato sauce',
      warm: 'Tomato sauce, kept warm',
      cooked: 'Cooked-on tomato sauce',
    },
    ageing: 'dries',
    loading: loading(
      'dry',
      150,
      [50, 300],
      0.3,
      'ESTIMATED',
      'soils.md 8.1 (50 to 300 g/m2; the test loading is 278 g/m2, verified) and 5.10 (ketchup about 70 % water)',
    ),
    regions: ['well', 'interior', 'interior_wall', 'tines', 'bowl', 'top', 'underside', 'lip'],
    patterns: ['smear', 'ring', 'splatter', 'stain'],
    difficulty: difficulty(
      4,
      [2, 4],
      'soils.md 5.10 (2 fresh, 4 dried; the stain it leaves in polypropylene is 9 to 10)',
    ),
    residue: 'red-orange flakes; orange tint on plastics',
    stainsPlastics: true,
  }),
  soilType({
    id: 'curry',
    name: 'Curry',
    group: 'mixed',
    soilClass: 'FAT',
    secondary: ['PART', 'STAIN'],
    byHeat: { none: 'Curry sauce', cooked: 'Cooked-on curry' },
    ageing: 'dries',
    loading: loading(
      'wet',
      150,
      [50, 300],
      null,
      'ESTIMATED',
      `${OWN}: taken like a flour-thickened sauce`,
    ),
    regions: ['interior', 'well'],
    patterns: ['smear', 'ring', 'stain'],
    difficulty: difficulty(5, [5, 5], 'soils.md 5.10, 5.11 (the stain it leaves in plastics is 8)'),
    residue: 'yellow film and specks',
    stainsPlastics: true,
  }),
  soilType({
    id: 'peanut_butter',
    name: 'Peanut butter',
    group: 'mixed',
    soilClass: 'FAT',
    secondary: ['PART', 'SWP'],
    byHeat: { none: 'Peanut butter' },
    ageing: 'sets',
    loading: loading(
      'wet',
      300,
      [100, 1000],
      0.98,
      'ESTIMATED',
      `${OWN}: thick smears on knives; solids from soils.md 5.10 (under 2 % water)`,
    ),
    regions: ['blade', 'well', 'interior'],
    patterns: ['smear', 'patch'],
    difficulty: difficulty(6, [6, 7], 'soils.md 5.10, 5.11'),
    residue: 'tan greasy smear',
  }),
  soilType({
    id: 'lipstick',
    name: 'Lipstick',
    group: 'mixed',
    soilClass: 'FAT',
    secondary: ['STAIN'],
    byHeat: { none: 'Lipstick' },
    ageing: 'sets',
    loading: loading('wet', 5, [1, 20], null, 'ESTIMATED', `${OWN}: a thin smear`),
    regions: ['rim'],
    patterns: ['arc'],
    difficulty: difficulty(8, [8, 8], 'soils.md 5.10, 5.11'),
    residue: 'red or pink smear at the rim',
  }),
  soilType({
    id: 'hummus',
    name: 'Hummus',
    group: 'mixed',
    soilClass: 'SWS',
    secondary: ['SWP', 'FAT'],
    byHeat: { none: 'Hummus' },
    ageing: 'dries',
    loading: loading(
      'wet',
      300,
      [100, 1000],
      0.35,
      'ESTIMATED',
      `${OWN}; solids from soils.md 5.10 (65 % water)`,
    ),
    regions: ['well', 'interior', 'bowl'],
    patterns: ['smear', 'patch'],
    difficulty: difficulty(5, [3, 6], 'soils.md 5.10 (3 fresh, 5 to 6 dried)'),
    residue: 'beige crust',
  }),
  soilType({
    id: 'avocado',
    name: 'Avocado',
    group: 'mixed',
    soilClass: 'PEEL',
    secondary: ['FAT', 'PART'],
    byHeat: { none: 'Avocado' },
    ageing: 'dries',
    loading: loading(
      'wet',
      150,
      [50, 300],
      0.27,
      'ESTIMATED',
      `${OWN}; solids from soils.md 5.10 (73 % water)`,
    ),
    regions: ['well', 'interior', 'tines', 'blade'],
    patterns: ['smear', 'film'],
    difficulty: difficulty(5, [5, 5], 'soils.md 5.10, 5.11'),
    residue: 'brown-green film',
  }),
  soilType({
    id: 'mustard',
    name: 'Mustard',
    group: 'mixed',
    soilClass: 'PEEL',
    secondary: ['PART', 'STAIN'],
    byHeat: { none: 'Mustard' },
    ageing: 'dries',
    loading: loading('wet', 100, [20, 300], null, 'ESTIMATED', `${OWN}: a smear`),
    regions: ['well', 'blade', 'interior'],
    patterns: ['smear'],
    difficulty: difficulty(4, [4, 4], 'soils.md 5.10, 5.11'),
    residue: 'yellow film',
    stainsPlastics: true,
  }),

  // ---- IEC 60436 soils (standards.md 4.1) ----
  soilType({
    id: 'iec_milk',
    name: 'IEC milk, microwaved in a glass',
    group: 'dairy',
    soilClass: 'BURN',
    secondary: ['SWP'],
    standard: {
      method: 'IEC 60436',
      substrate: 'glasses',
      recipe:
        'UHT milk with 1.5 % fat, 10 mL per glass (the amount is recalled), cooked in a microwave oven until the bottom of the glass is between shades 4 and 6 of the shade chart',
      ageing: IEC_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.1',
    },
    byHeat: { baked: 'Milk cooked dry in a microwave oven' },
    ageing: 'baked',
    loading: loading(
      'wet',
      3500,
      [3000, 4000],
      null,
      'ESTIMATED',
      'standards.md 4.1: 10 mL of milk on the 28 cm2 base of the 60 mm test glass',
    ),
    regions: ['interior'],
    patterns: ['bottom_pool', 'crust'],
    difficulty: difficulty(9, [8, 9], 'soils.md 5.2 (heated, microwaved or burnt milk)'),
    residue: 'cream to brown patches or rings, rough',
  }),
  soilType({
    id: 'iec_tea',
    name: 'IEC tea',
    group: 'stain',
    soilClass: 'STAIN',
    standard: {
      method: 'IEC 60436',
      substrate: 'cups, mugs and saucers',
      recipe:
        'Sir Winston Broken Orange Pekoe brewed with the test water; cups half-filled, pre-dried 1 h at 80 C, then emptied',
      ageing: IEC_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.1',
    },
    byHeat: { warm: 'Tea dried in at 80 C' },
    ageing: 'stains',
    loading: loading('dry', 0.5, [0.1, 1], null, 'ESTIMATED', 'soils.md 5.7 (well under 1 g/m2)'),
    regions: ['interior', 'well'],
    patterns: ['ring_and_film'],
    difficulty: difficulty(7, [6, 7], 'soils.md 5.7 (tea)'),
    residue: 'brown film and tide lines in cups',
  }),
  soilType({
    id: 'iec_minced_meat',
    name: 'IEC minced meat',
    group: 'meat',
    soilClass: 'SWP',
    secondary: ['FAT', 'PART'],
    standard: {
      method: 'IEC 60436',
      substrate: 'dinner plates, platters, glass bowls and pots',
      recipe:
        'raw minced beef mixed with egg; grams per item not readable (working quantity 3 g per plate, standards.md 13.3)',
      ageing: IEC_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.1, 13.3',
    },
    byHeat: { warm: 'Minced meat and egg, oven-dried' },
    ageing: 'dries',
    loading: loading(
      'wet',
      118,
      [100, 120],
      0.21,
      'ESTIMATED',
      'standards.md 4.4 and 13.3 (chosen to match the verified 11.8 mg/cm2 of the IKW meat soil)',
    ),
    regions: ['well', 'interior'],
    patterns: ['smear'],
    difficulty: difficulty(
      4,
      [4, 7],
      'soils.md 5.3 (4 fresh, 7 baked at 130 C; 80 C lies between)',
    ),
    residue: 'brown specks and a thin protein film',
  }),
  soilType({
    id: 'iec_egg_yolk',
    name: 'IEC egg yolk',
    group: 'egg',
    soilClass: 'SWP',
    standard: {
      method: 'IEC 60436',
      substrate: 'dinner plates, dessert plates and forks',
      recipe:
        'egg yolk; quantity by a formula of the standard that could not be read (working quantity 3 g per dinner plate, standards.md 13.3)',
      ageing: IEC_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.1, 13.3',
    },
    byHeat: { warm: 'Egg yolk, oven-dried' },
    ageing: 'dries',
    loading: loading(
      'wet',
      107,
      [100, 120],
      0.5,
      'ESTIMATED',
      'standards.md 4.4 and 13.3 (about 10 to 12 mg/cm2 wet)',
    ),
    regions: ['well', 'tines'],
    patterns: ['smear'],
    difficulty: difficulty(8, [8, 9], 'soils.md 5.1'),
    residue: 'matt pale-yellow to translucent film',
  }),
  soilType({
    id: 'iec_oat_flakes',
    name: 'IEC oat-flake porridge',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['PART'],
    standard: {
      method: 'IEC 60436',
      substrate: 'soup plates, soup spoons and dessert bowls',
      recipe:
        '50 g oat flakes, 250 mL milk (1.5 % fat) and 750 mL water boiled 10 min; 3 g of hot porridge brushed onto a 23 cm soup plate with the rim kept free, 10.6 +/- 0.5 mg/cm2',
      ageing: IEC_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.1',
    },
    byHeat: { warm: 'Oat-flake porridge, oven-dried' },
    ageing: 'dries',
    loading: loading(
      'wet',
      106,
      [101, 111],
      0.08,
      'VERIFIED',
      'standards.md 4.1 and 4.4 (solids estimated there)',
    ),
    regions: ['well', 'bowl', 'interior'],
    patterns: ['film', 'smear'],
    difficulty: difficulty(8, [7, 8], 'soils.md 5.4 (porridge)'),
    residue: 'beige film and flakes',
  }),
  soilType({
    id: 'iec_spinach',
    name: 'IEC spinach',
    group: 'particle',
    soilClass: 'PART',
    standard: {
      method: 'IEC 60436',
      substrate: 'dessert plates, platters, glass bowls and pots',
      recipe:
        'frozen chopped spinach passed through a mincer with a 2 mm disc, or freeze-dried spinach; grams per item not readable (working quantity 2 g per dessert plate, standards.md 13.3)',
      ageing: IEC_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.1, 13.3',
    },
    byHeat: { warm: 'Minced spinach, oven-dried' },
    ageing: 'dries',
    loading: loading(
      'wet',
      100,
      [50, 150],
      null,
      'ESTIMATED',
      'standards.md 13.3 (2 g wet on a dessert plate)',
    ),
    regions: ['well', 'interior'],
    patterns: ['specks', 'smear'],
    difficulty: difficulty(3, [3, 5], 'soils.md 5.8'),
    residue: 'green specks, usually redeposited on other items',
  }),
  soilType({
    id: 'iec_margarine',
    name: 'IEC margarine',
    group: 'fat',
    soilClass: 'FAT',
    standard: {
      method: 'IEC 60436',
      substrate: 'oval platter',
      recipe:
        'margarine; grams not readable (working quantity 5 g on the platter, standards.md 13.3)',
      ageing: 'none: the only soiled item that does not go into the thermal cabinet; loaded last',
      tag: 'VERIFIED',
      source: 'standards.md 4.1, 13.3',
    },
    byHeat: { none: 'Margarine' },
    ageing: 'sets',
    loading: loading(
      'wet',
      125,
      [50, 200],
      null,
      'ESTIMATED',
      'standards.md 13.3 (5 g on the oval platter)',
    ),
    regions: ['well'],
    patterns: ['smear'],
    difficulty: difficulty(2, [2, 4], 'soils.md 5.5 (butter and margarine)'),
    residue: 'greasy smear, water beading',
  }),

  // ---- IKW soils (standards.md 4.3; all verified) ----
  soilType({
    id: 'ikw_tea',
    name: 'IKW black tea',
    group: 'stain',
    soilClass: 'STAIN',
    standard: {
      method: 'IKW',
      substrate: 'thick-walled white tea cups',
      recipe:
        '30 g Assam in 2 L boiling synthetic water with 0.1 mL ferric sulphate stock, 5 min brew; 100 mL per cup at 85 C, 20 mL withdrawn every 5 min until empty; repeated once with fresh tea',
      ageing: 'at least 3 days in a climate room',
      tag: 'VERIFIED',
      source: 'standards.md 4.3',
    },
    byHeat: { none: 'Strong black tea, drawn down in steps' },
    ageing: 'stains',
    loading: loading('dry', 0.5, [0.1, 1], null, 'ESTIMATED', 'soils.md 5.7 (well under 1 g/m2)'),
    regions: ['interior'],
    patterns: ['ring_and_film'],
    difficulty: difficulty(7, [6, 7], 'soils.md 5.7 (tea; Assam is the hardest)'),
    residue: 'brown film and tide lines in cups',
  }),
  soilType({
    id: 'ikw_milk_microwaved',
    name: 'IKW milk, microwaved',
    group: 'dairy',
    soilClass: 'BURN',
    secondary: ['SWP'],
    standard: {
      method: 'IKW',
      substrate: '150 mL glass beakers',
      recipe: '10 mL low-fat UHT milk (1.5 %), baked 10 min at 450 W, six beakers at once',
      ageing: '2 h at 80 C',
      tag: 'VERIFIED',
      source: 'standards.md 4.3',
    },
    byHeat: { baked: 'Milk baked on in a microwave oven' },
    ageing: 'baked',
    loading: loading(
      'wet',
      3500,
      [3000, 4000],
      null,
      'ESTIMATED',
      'standards.md 4.3: 10 mL of milk on the base of a 150 mL beaker (about 28 cm2)',
    ),
    regions: ['interior'],
    patterns: ['bottom_pool', 'crust'],
    difficulty: difficulty(9, [8, 9], 'soils.md 5.2 (heated, microwaved or burnt milk)'),
    residue: 'cream to brown patches or rings, rough',
  }),
  soilType({
    id: 'ikw_milk_skin',
    name: 'IKW milk skin',
    group: 'dairy',
    soilClass: 'SWP',
    secondary: ['FAT'],
    standard: {
      method: 'IKW',
      substrate: '250 mL tall beakers',
      recipe:
        '100 mL UHT milk (3.5 %) heated to 88 +/- 2 C, cooled to 30 to 35 C, milk poured off under the skin',
      ageing: 'overnight, then 2 h at 80 C',
      tag: 'VERIFIED',
      source: 'standards.md 4.3',
    },
    byHeat: { warm: 'Milk skin, dried on' },
    ageing: 'dries',
    loading: loading(
      'wet',
      30,
      [20, 50],
      null,
      'ESTIMATED',
      `${OWN}: the milk-film loading of soils.md 5.2 is used as a stand-in`,
    ),
    regions: ['interior'],
    patterns: ['film', 'ring'],
    difficulty: difficulty(6, [6, 6], 'soils.md 5.2 (milk skin)'),
    residue: 'translucent skin fragments',
  }),
  soilType({
    id: 'ikw_starch_mix',
    name: 'IKW starch mix',
    group: 'starch',
    soilClass: 'SWS',
    standard: {
      method: 'IKW',
      substrate: 'glass plates, 177 cm2 inner area',
      recipe:
        '3.25 % suspension of potato, maize, rice and wheat starch cooked 30 min at 95 C; 20.4 g per plate',
      ageing: 'at least 48 h in air, then 4 h at 80 C; dry film 619 to 708 mg',
      tag: 'VERIFIED',
      source: 'standards.md 4.3',
    },
    byHeat: { warm: 'Mixed starch film, oven-dried' },
    ageing: 'dries',
    loading: loading(
      'dry',
      37.5,
      [35, 40],
      null,
      'VERIFIED',
      'standards.md 4.3 (3.75 +/- 0.25 mg/cm2 dry)',
    ),
    regions: ['well'],
    patterns: ['film'],
    difficulty: difficulty(7, [7, 7], 'soils.md 5.4 (starch mix), 5.11'),
    residue: 'clear film, invisible wet, hazy and rough dry; blue with iodine',
  }),
  soilType({
    id: 'ikw_pasta',
    name: 'IKW pasta',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['SWP'],
    standard: {
      method: 'IKW',
      substrate: 'Arzberg dinner plates, 25 cm',
      recipe:
        '80 g spaghetti boiled 8 min; 150 g cooked pasta blended with 200 mL water; 3.0 +/- 0.1 g per plate, 2 cm rim left free',
      ageing: '2 h at 120 C',
      tag: 'VERIFIED',
      source: 'standards.md 4.3',
    },
    byHeat: { baked: 'Blended pasta, baked on' },
    ageing: 'baked',
    loading: loading(
      'wet',
      120,
      [115, 125],
      0.15,
      'ESTIMATED',
      'standards.md 4.4 (3 g on about 250 cm2)',
    ),
    regions: ['well'],
    patterns: ['film'],
    difficulty: difficulty(6, [6, 7], 'soils.md 5.4 (pasta)'),
    residue: 'translucent film, visible after iodine staining',
  }),
  soilType({
    id: 'ikw_egg_yolk',
    name: 'IKW egg yolk',
    group: 'egg',
    soilClass: 'SWP',
    standard: {
      method: 'IKW',
      substrate: 'brushed stainless-steel sheets, 10 x 15 cm',
      recipe: '1.5 +/- 0.1 g over 140 cm2',
      ageing:
        '4 h room air; 30 s in boiling water; 30 min at 80 C; at least 24 h rest; 750 +/- 100 mg dry',
      tag: 'VERIFIED',
      source: 'standards.md 4.3',
    },
    byHeat: { cooked: 'Egg yolk, set in boiling water and dried' },
    ageing: 'dries',
    loading: loading(
      'wet',
      107,
      [100, 114],
      0.5,
      'VERIFIED',
      'standards.md 4.3 and 4.4 (1.5 +/- 0.1 g on 140 cm2)',
    ),
    regions: ['well'],
    patterns: ['smear'],
    difficulty: difficulty(8, [8, 9], 'soils.md 5.1 (8 dried, 9 cooked)'),
    residue: 'matt pale-yellow to translucent film',
  }),
  soilType({
    id: 'ikw_minced_meat',
    name: 'IKW minced meat',
    group: 'meat',
    soilClass: 'SWP',
    secondary: ['FAT', 'PART'],
    standard: {
      method: 'IKW',
      substrate: 'Arzberg dessert plates, 19 cm',
      recipe:
        '225 g lean pork and beef, 75 g whole egg and 80 mL water blended 2 min; 3 +/- 0.1 g per plate, 11.8 +/- 0.5 mg/cm2',
      ageing: '2 h at 130 C',
      tag: 'VERIFIED',
      source: 'standards.md 4.3',
    },
    byHeat: { baked: 'Minced meat and egg, baked on' },
    ageing: 'baked',
    loading: loading(
      'wet',
      118,
      [113, 123],
      0.21,
      'VERIFIED',
      'standards.md 4.3 and 4.4 (solids estimated there)',
    ),
    regions: ['well'],
    patterns: ['smear'],
    difficulty: difficulty(7, [7, 7], 'soils.md 5.3 (baked), 5.11'),
    residue: 'brown specks and a thin protein film, shown by Phloxin B dye',
  }),
  soilType({
    id: 'ikw_creme_brulee',
    name: 'IKW creme brulee',
    group: 'sugar',
    soilClass: 'SWP',
    secondary: ['SWS', 'BURN'],
    standard: {
      method: 'IKW',
      substrate: 'Arzberg dessert plates, 19 cm',
      recipe:
        'ready mix heated to 60 C; 3.5 +/- 0.2 g per plate, 19.8 +/- 1.1 mg/cm2, 2 cm rim free',
      ageing: '2 h room air, then 2 h at 140 C',
      tag: 'VERIFIED',
      source: 'standards.md 4.3',
    },
    byHeat: { baked: 'Egg custard, baked on' },
    ageing: 'baked',
    loading: loading(
      'wet',
      198,
      [187, 209],
      0.33,
      'VERIFIED',
      'standards.md 4.3 and 4.4 (solids estimated there)',
    ),
    regions: ['well'],
    patterns: ['film', 'crust'],
    difficulty: difficulty(8, [8, 8], 'soils.md 5.6, 5.11'),
    residue: 'brown film',
  }),

  // ---- AHAM DW-1 soils (standards.md 4.2; assignments verified, gram quantities not found) ----
  soilType({
    id: 'aham_egg_yolk',
    name: 'AHAM egg yolk',
    group: 'egg',
    soilClass: 'SWP',
    standard: {
      method: 'AHAM DW-1',
      substrate: 'dinner plates (a quarter section), forks and the serving fork',
      recipe: 'egg yolk; grams per item not found',
      ageing: AHAM_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.2',
    },
    byHeat: { none: 'Egg yolk' },
    ageing: 'dries',
    loading: loading('wet', 150, [100, 600], 0.5, 'ESTIMATED', 'soils.md 8.1 (egg yolk)'),
    regions: ['well', 'tines'],
    patterns: ['smear'],
    difficulty: difficulty(8, [8, 8], 'soils.md 5.1'),
    residue: 'matt pale-yellow to translucent film',
  }),
  soilType({
    id: 'aham_creamed_corn',
    name: 'AHAM creamed corn',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['PART', 'SOL'],
    standard: {
      method: 'AHAM DW-1',
      substrate: 'bread and butter plates, dessert bowls, a serving bowl and spoons',
      recipe: 'creamed corn; grams per item not found',
      ageing: AHAM_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.2',
    },
    byHeat: { none: 'Creamed corn' },
    ageing: 'dries',
    loading: loading(
      'wet',
      150,
      [50, 300],
      null,
      'ESTIMATED',
      'soils.md 5.4 (flour-thickened sauces)',
    ),
    regions: ['well', 'interior', 'bowl'],
    patterns: ['smear', 'specks'],
    difficulty: difficulty(
      4,
      [4, 5],
      'no rank in soils.md; ranked as a flour-thickened sauce (soils.md 5.4)',
    ),
    residue: 'hazy film and kernel skins',
  }),
  soilType({
    id: 'aham_oatmeal',
    name: 'AHAM oatmeal',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['PART'],
    standard: {
      method: 'AHAM DW-1',
      substrate: 'bread and butter plates, dessert bowls and spoons',
      recipe: 'oatmeal made with milk; grams per item not found',
      ageing: AHAM_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.2',
    },
    byHeat: { none: 'Oatmeal' },
    ageing: 'dries',
    loading: loading('wet', 600, [300, 2000], 0.16, 'ESTIMATED', 'soils.md 8.1 (porridge)'),
    regions: ['well', 'interior', 'bowl'],
    patterns: ['smear', 'bottom_pool'],
    difficulty: difficulty(8, [7, 8], 'soils.md 5.4 (porridge)'),
    residue: 'beige film and flakes',
  }),
  soilType({
    id: 'aham_mashed_potato',
    name: 'AHAM mashed potatoes',
    group: 'starch',
    soilClass: 'SWS',
    secondary: ['FAT'],
    standard: {
      method: 'AHAM DW-1',
      substrate: 'dinner plates (a quarter section) and a serving bowl',
      recipe: 'mashed potatoes; grams per item not found',
      ageing: AHAM_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.2',
    },
    byHeat: { none: 'Mashed potato' },
    ageing: 'dries',
    loading: loading('wet', 1500, [500, 3000], 0.22, 'ESTIMATED', 'soils.md 8.1 (mashed potato)'),
    regions: ['well', 'interior'],
    patterns: ['patch'],
    difficulty: difficulty(6, [6, 6], 'soils.md 5.4'),
    residue: 'white crusty patches',
  }),
  soilType({
    id: 'aham_ground_beef',
    name: 'AHAM ground beef with tomato paste',
    group: 'meat',
    soilClass: 'SWP',
    secondary: ['FAT', 'PART', 'PEEL'],
    standard: {
      method: 'AHAM DW-1',
      substrate: 'dinner plates (a quarter section)',
      recipe: 'ground beef and tomato paste mixture; grams per item not found',
      ageing: AHAM_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.2',
    },
    byHeat: { none: 'Ground beef with tomato paste' },
    ageing: 'dries',
    loading: loading('wet', 120, [50, 300], 0.4, 'ESTIMATED', 'soils.md 8.1 (minced meat)'),
    regions: ['well'],
    patterns: ['smear'],
    difficulty: difficulty(4, [4, 7], 'soils.md 5.3 (4 fresh, 7 baked)'),
    residue: 'brown specks and a thin protein film',
    stainsPlastics: true,
  }),
  soilType({
    id: 'aham_raspberry_preserves',
    name: 'AHAM raspberry preserves with coffee grounds',
    group: 'sugar',
    soilClass: 'SOL',
    secondary: ['PART'],
    standard: {
      method: 'AHAM DW-1',
      substrate: 'dinner plates (a quarter section)',
      recipe: 'red raspberry preserves with coffee grounds; grams per item not found',
      ageing: AHAM_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.2',
    },
    byHeat: { none: 'Raspberry preserves with coffee grounds' },
    ageing: 'dries',
    loading: loading('wet', 100, [20, 300], 0.65, 'ESTIMATED', 'soils.md 8.1 (sugars, honey, jam)'),
    regions: ['well'],
    patterns: ['patch', 'specks'],
    difficulty: difficulty(2, [2, 3], 'soils.md 5.6 (jam)'),
    residue: 'seeds and coffee grounds',
  }),
  soilType({
    id: 'aham_peanut_butter',
    name: 'AHAM peanut butter',
    group: 'mixed',
    soilClass: 'FAT',
    secondary: ['PART', 'SWP'],
    standard: {
      method: 'AHAM DW-1',
      substrate: 'knives and the serving platter',
      recipe: 'peanut butter, applied to knives; grams per item not found',
      ageing: AHAM_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.2',
    },
    byHeat: { none: 'Peanut butter' },
    ageing: 'sets',
    loading: loading(
      'wet',
      300,
      [100, 1000],
      0.98,
      'ESTIMATED',
      `${OWN}: thick smears on knives; solids from soils.md 5.10 (under 2 % water)`,
    ),
    regions: ['blade', 'well'],
    patterns: ['smear'],
    difficulty: difficulty(6, [6, 7], 'soils.md 5.10'),
    residue: 'tan greasy smear',
  }),
  soilType({
    id: 'aham_tomato_juice',
    name: 'AHAM tomato juice',
    group: 'mixed',
    soilClass: 'SOL',
    secondary: ['PART', 'STAIN'],
    standard: {
      method: 'AHAM DW-1',
      substrate: 'glasses',
      recipe: 'tomato juice; grams per item not found',
      ageing: AHAM_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.2',
    },
    byHeat: { none: 'Tomato juice' },
    ageing: 'dries',
    loading: loading(
      'wet',
      30,
      [20, 50],
      null,
      'ESTIMATED',
      `${OWN}: a drained film, like milk (soils.md 5.2)`,
    ),
    regions: ['interior'],
    patterns: ['ring_and_film'],
    difficulty: difficulty(2, [1, 4], 'soils.md 5.10, 5.11 (fresh sauces 1 to 2, dried ketchup 4)'),
    residue: 'red-orange film and pulp specks',
    stainsPlastics: true,
  }),
  soilType({
    id: 'aham_coffee',
    name: 'AHAM coffee',
    group: 'stain',
    soilClass: 'STAIN',
    secondary: ['PART'],
    standard: {
      method: 'AHAM DW-1',
      substrate: 'coffee cups and saucers',
      recipe: 'coffee; grams per item not found',
      ageing: AHAM_AGEING,
      tag: 'VERIFIED',
      source: 'standards.md 4.2',
    },
    byHeat: { none: 'Coffee' },
    ageing: 'stains',
    loading: loading('dry', 0.5, [0.1, 1], null, 'ESTIMATED', 'soils.md 5.7 (under 1 g/m2)'),
    regions: ['interior', 'well'],
    patterns: ['ring_and_film', 'bottom_pool'],
    difficulty: difficulty(4, [4, 4], 'soils.md 5.7 (coffee)'),
    residue: 'light-brown film',
  }),
];

const BY_ID: ReadonlyMap<string, SoilType> = new Map(SOILS.map((s) => [s.id, s]));

const SORTED: readonly SoilType[] = [...SOILS].sort((a, b) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
);

/** True when the catalogue has a soil type with this id. */
export function hasSoil(id: string): boolean {
  return BY_ID.has(id);
}

/** The soil type with the given catalogue id. Throws a RangeError for an unknown id. */
export function getSoil(id: string): SoilType {
  const found = BY_ID.get(id);
  if (found === undefined) throw new RangeError(`catalogue: unknown soil '${id}'`);
  return found;
}

/** Every soil type, sorted by id. */
export function listSoils(): readonly SoilType[] {
  return SORTED;
}

/**
 * An age in hours in words: "less than an hour", "about an hour", "about 12 hours",
 * "about a day", "about 3 days".
 */
export function formatSoilAge(ageH: number): string {
  if (!(ageH >= 0) || !Number.isFinite(ageH)) {
    throw new RangeError(`catalogue: a soil age must be a finite number of hours, got ${ageH}`);
  }
  if (ageH < 1) return 'less than an hour';
  if (ageH < 1.5) return 'about an hour';
  if (ageH < 22) return `about ${Math.round(ageH)} hours`;
  if (ageH < 36) return 'about a day';
  return `about ${Math.round(ageH / 24)} days`;
}

/** What `describeSoil` needs to know about one soil on one item. */
export interface SoilDescriptionInput {
  /** Time since soiling, hours. */
  readonly ageH: number;
  /** How the soil was heated; defaults to the soil's first applicable history. */
  readonly heatHistory?: SoilHeatHistory;
  /** Labels of the regions that carry it, for example `['inside base']`. */
  readonly regionLabels?: readonly string[];
}

/**
 * A sentence fragment describing a soil as a person who cooked and ate the meal would, for
 * example "Porridge, dried on for about 12 hours, on the inside base". Throws a RangeError for
 * an unknown soil id or a heat history that does not apply to the soil.
 */
export function describeSoil(soilId: string, input: SoilDescriptionInput): string {
  const soil = getSoil(soilId);
  const heat = input.heatHistory ?? (soil.heatHistories[0] as SoilHeatHistory);
  const noun = soil.description.byHeat[heat];
  if (noun === undefined) {
    throw new RangeError(`catalogue: soil '${soilId}' has no heat history '${heat}'`);
  }
  const age =
    input.ageH < 1
      ? soil.description.fresh
      : soil.description.aged.replace('{age}', formatSoilAge(input.ageH));
  const labels = input.regionLabels ?? [];
  const where =
    labels.length === 0
      ? ''
      : `, on the ${labels.length === 1 ? (labels[0] as string) : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1] as string}`}`;
  return `${noun}, ${age}${where}`;
}

/** One ingredient of the IKW ballast soil. */
export interface BallastIngredient {
  readonly name: string;
  /** Share by mass, percent. */
  readonly massPercent: number;
}

/**
 * The IKW ballast soil: a frozen 50 g block added with the detergent to load the wash liquor
 * with easily removed meal residue. Not a surface soil. [VERIFIED] standards.md section 4.3 and
 * soils.md section 5.10 (IKW Table 4); IEC 60436 Annex V doses 100 g of ballast for 10 or more
 * place settings and 60 g below.
 */
export const IKW_BALLAST_SOIL: {
  readonly portionG: number;
  readonly ingredients: readonly BallastIngredient[];
} = {
  portionG: 50,
  ingredients: [
    { name: 'vegetable oil', massPercent: 31.6 },
    { name: 'whole egg', massPercent: 15.8 },
    { name: 'cream', massPercent: 9.4 },
    { name: 'margarine', massPercent: 6.3 },
    { name: 'lard', massPercent: 6.3 },
    { name: 'deep-frying fat', massPercent: 6.3 },
    { name: 'whole milk', massPercent: 6.3 },
    { name: 'ketchup', massPercent: 6.3 },
    { name: 'mustard', massPercent: 6.3 },
    { name: 'potato starch', massPercent: 2.2 },
    { name: 'gravy', massPercent: 1.7 },
    { name: 'wheat flour', massPercent: 0.6 },
    { name: 'quark powder', massPercent: 0.6 },
    { name: 'benzoic acid', massPercent: 0.3 },
  ],
};
