/**
 * Validation of the item catalogue as a whole against the research dossiers. The tables in this
 * file are transcribed from docs/research/items.md (table 10.1, table 10.2, section 2.4) and
 * docs/research/standards.md (section 5.3) independently of the records, so that a slip in a
 * record shows up as a disagreement.
 */

import { isValidId, radToDeg } from '@spotless/core';
import type { GeometryDefMm } from '@spotless/geometry';
import {
  boundingBox,
  buildCollisionPieces,
  buildRenderMesh,
  COLLISION_CHORD_ERROR,
  expandGeometryMm,
  meshTopology,
  meshVolume,
  RENDER_CHORD_ERROR,
  surfaceArea,
} from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import {
  getItemType,
  instantiate,
  listItemTypes,
  partMaterialOf,
  poseQuaternion,
} from './catalogue.ts';
import { frictionPair } from './contact.ts';
import { getMaterial, hasMaterial, WATER_DENSITY_60C } from './materials.ts';
import { brimfulVolume, countedTwice } from './shape-util.ts';
import { hasSoil } from './soils.ts';
import { staticStability } from './stability.ts';
import type { ItemType } from './types.ts';
import { RACK_MATERIALS } from './validate.ts';

type Grams = number | readonly [number, number];

/** Relative distance of a mass from a figure, or from the nearest end of a range (0 inside). */
function deviation(grams: number, target: Grams): number {
  if (typeof target === 'number') return grams / target - 1;
  if (grams < target[0]) return grams / target[0] - 1;
  if (grams > target[1]) return grams / target[1] - 1;
  return 0;
}

function massG(id: string): number {
  return instantiate(id).mass.mass * 1000;
}

// ---------------------------------------------------------------------------------------------
// Dossier tables
// ---------------------------------------------------------------------------------------------

/**
 * Verified masses, grams (items.md table 10.1, column "Mass", entries tagged V; a pair is the
 * range the dossier gives). The test-standard dinner plate is from standards.md section 5.3.
 */
const VERIFIED_MASS_G: Readonly<Record<string, Grams>> = {
  dinner_plate_porcelain_iec: 530,
  dinner_plate_porcelain_270: 770,
  dinner_plate_vitrelle_260: 340,
  dinner_plate_stoneware_270: 798,
  deep_plate_porcelain_220: 590,
  pasta_bowl_porcelain_230: 660,
  cereal_bowl_porcelain_160: 440,
  cereal_bowl_vitrelle_159: 179,
  cereal_bowl_stoneware_130: 479,
  ramekin_porcelain_89: 181,
  mug_ceramic_300: 351,
  mug_glass_240: 250,
  tumbler_250: 220,
  pint_glass_473: 440,
  wine_glass_red_540: 184,
  wine_glass_generic_200: 268,
  champagne_flute_170: 130,
  pitcher_plastic_240: 293,
  measuring_jug_glass_500: 618,
  glass_bowl_180: 545,
  chefs_knife_200: [165, 184],
  ladle_steel_311: 180,
  turner_nylon_279: 73,
  spatula_plastic_330: 90,
  balloon_whisk_292: [96, 123],
  tongs_steel_350: [150, 204],
  wooden_spoon_305: [41, 59],
  swivel_peeler_180: [57, 70],
  colander_steel_5qt: 420,
  chopping_board_pe_340: [560, 570],
  chopping_board_pp_375: 700,
  chopping_board_beech_380: [1550, 1590],
  mixing_bowl_glass_4qt: 1602,
  mixing_bowl_steel_4qt: 476,
  mixing_bowl_steel_light_4qt: 254,
  saucepan_clad_2qt: 907,
  saucepan_steel_170: 504,
  frying_pan_clad_254: 1190,
  frying_pan_nonstick_280: 900,
  skillet_steel_270: 988,
  skillet_cast_iron_260: 2427,
  skillet_cast_iron_305: 3580,
  lid_steel_165: 450,
  oven_dish_stoneware_320: 2300,
  oven_dish_glass_3qt: 1410,
  baking_tray_half_sheet: 748,
  muffin_tin_12: 590,
  loaf_pan_nonstick_210: 352,
  food_container_600ml: 44.8,
  water_bottle_generic_200: 179,
  blender_jug_2l: 1190,
};

/**
 * The items whose mass from geometry is more than 3 % from the verified figure, worst first:
 * [id, deviation in percent, why it was left there].
 */
const VERIFIED_MASS_OFFENDERS: readonly (readonly [string, number, string])[] = [
  [
    'chopping_board_pe_340',
    9,
    'a solid polyethylene slab of the stated size weighs more than the board, which has a ' +
      "hanging hole and thinned edges; the dossier's own model is 10 % over (items.md 2.4)",
  ],
  [
    'oven_dish_glass_3qt',
    8,
    'the verified 1410 g needs a 3.5 mm wall, under the 5 to 6.5 mm the dossier gives for ' +
      'this glassware; the wall is held at 3.8 mm',
  ],
  [
    'lid_steel_165',
    -6,
    'the figure is the difference of two listed weights rounded to the pound; the wall is ' +
      'held at 2 mm, the thickest plausible for a lid',
  ],
];

/**
 * Estimated and recalled masses, grams (items.md table 10.1, entries tagged E or R), for items
 * modelled as the dossier describes them.
 */
const ESTIMATED_MASS_G: Readonly<Record<string, Grams>> = {
  dessert_plate_porcelain_190: 300,
  bread_plate_vitrelle_170: 150,
  soup_plate_porcelain_230: 490,
  dessert_bowl_vitrelle_130: 120,
  saucer_porcelain_140: 155,
  tea_cup_porcelain_210: 155,
  mug_porcelain_240: 260,
  espresso_cup_porcelain_80: 150,
  espresso_saucer_porcelain_120: 110,
  serving_bowl_vitrelle_216: 310,
  oval_platter_vitrelle_241: 300,
  oval_platter_porcelain_320: 900,
  melamine_plate_230: 200,
  melamine_bowl_150: 136,
  tumbler_360: 290,
  test_glass_borosilicate_250: 100,
  iced_tea_glass_355: 265,
  highball_350: 270,
  wine_glass_bordeaux_610: 230,
  glass_jug_1000: 790,
  dinner_knife_210: [80, 100],
  dinner_fork_185: [40, 55],
  salad_fork_156: [25, 35],
  soup_spoon_190: [50, 60],
  dessert_spoon_160: [35, 45],
  teaspoon_130: [20, 30],
  steak_knife_230: [60, 90],
  chopstick_bamboo: 6,
  chopstick_melamine: 13,
  serving_spoon_216: 75,
  serving_fork_210: 55,
  box_grater_300: 350,
  sieve_mesh_200: 220,
  mixing_bowl_pp_3l: 240,
  lid_glass_240: 600,
  cooling_rack_half: 400,
  container_lid_pp: [15, 40],
  baby_bottle_pp_260: 44,
  bottle_teat_silicone: 9,
  drinking_cup_pp_400: 41,
  spatula_silicone_280: 60,
};

/**
 * Items the catalogue models without the lid, cap or rack that the dossier's figure includes:
 * the figure (grams, or its range) bounds the item's own mass from above.
 */
const GROSS_MASS_G: Readonly<Record<string, Grams>> = {
  stockpot_steel_8qt: 2180,
  roasting_tin_427: [2700, 3200],
  food_container_clip_1l: [123, 130],
  food_container_1l: 120,
  lunch_box_2l: 250,
  water_bottle_tritan_1l: 177,
  travel_mug_steel_470: [249, 354],
  sippy_cup_240: 62,
};

/** Items added from standards.md section 5.3, for which no dossier gives a mass. */
const NO_DOSSIER_MASS: readonly string[] = [
  'melamine_dessert_plate_iec_195',
  'melamine_bowl_iec_213',
];

/**
 * Overall size along x, y and z, millimetres (items.md table 10.1; standards.md 5.3 for the
 * test-standard articles); null where the dossier does not give that extent. By the
 * catalogue's convention a handle or the long axis lies along x.
 */
const OVERALL_SIZE_MM: Readonly<
  Record<string, readonly [number | null, number | null, number | null]>
> = {
  dinner_plate_porcelain_iec: [250, 250, 24],
  dinner_plate_porcelain_270: [270, 270, 30],
  dinner_plate_vitrelle_260: [260, 260, 19],
  dinner_plate_stoneware_270: [270, 270, 30],
  dessert_plate_porcelain_190: [190, 190, 18],
  bread_plate_vitrelle_170: [170, 170, 15],
  soup_plate_porcelain_230: [230, 230, 40],
  deep_plate_porcelain_220: [220, 220, 60],
  pasta_bowl_porcelain_230: [230, 230, 65],
  cereal_bowl_porcelain_160: [160, 160, 70],
  cereal_bowl_vitrelle_159: [159, 159, 51],
  cereal_bowl_stoneware_130: [130, 130, 80],
  dessert_bowl_vitrelle_130: [130, 130, 45],
  ramekin_porcelain_89: [89, 89, 44],
  saucer_porcelain_140: [140, 140, 17],
  espresso_saucer_porcelain_120: [120, 120, 15],
  serving_bowl_vitrelle_216: [216, 216, 65],
  glass_bowl_180: [180, 180, 80],
  oval_platter_vitrelle_241: [241, 191, 20],
  oval_platter_porcelain_320: [320, 230, 28],
  melamine_plate_230: [230, 230, 18],
  melamine_bowl_150: [150, 150, 60],
  melamine_dessert_plate_iec_195: [195, 195, null],
  melamine_bowl_iec_213: [213, 213, null],
  tea_cup_porcelain_210: [null, 85, 65],
  mug_porcelain_240: [null, 85, 70],
  mug_ceramic_300: [null, 80, 100],
  mug_glass_240: [null, null, 70],
  espresso_cup_porcelain_80: [null, 70, 60],
  tumbler_250: [87, 87, 90],
  tumbler_360: [88, 88, 124],
  test_glass_borosilicate_250: [60, 60, null],
  iced_tea_glass_355: [73, 73, 133],
  highball_350: [65, 65, 150],
  pint_glass_473: [89, 89, 149],
  wine_glass_red_540: [92, 92, 244],
  wine_glass_generic_200: [80, 80, 200],
  wine_glass_bordeaux_610: [95, 95, 265],
  champagne_flute_170: [65, 65, 224],
  glass_jug_1000: [null, 110, 190],
  pitcher_plastic_240: [180, 110, 240],
  measuring_jug_glass_500: [165, 107, 107],
  dinner_knife_210: [210, null, null],
  dinner_fork_185: [185, null, null],
  salad_fork_156: [156, null, null],
  soup_spoon_190: [190, null, null],
  dessert_spoon_160: [160, null, null],
  teaspoon_130: [130, null, null],
  steak_knife_230: [230, null, null],
  chopstick_bamboo: [240, 7, 7],
  chopstick_melamine: [240, 7, 7],
  serving_spoon_216: [216, null, null],
  serving_fork_210: [210, null, null],
  chefs_knife_200: [335, 50, null],
  ladle_steel_311: [311, 108, null],
  turner_nylon_279: [279, 84, null],
  spatula_plastic_330: [330, 50, 20],
  balloon_whisk_292: [292, 67, null],
  tongs_steel_350: [350, 38, 50],
  wooden_spoon_305: [305, null, null],
  swivel_peeler_180: [180, 25, 25],
  box_grater_300: [114, 75, 300],
  colander_steel_5qt: [null, 286, 127],
  sieve_mesh_200: [null, 200, null],
  chopping_board_pe_340: [340, 240, 8],
  chopping_board_pp_375: [375, 267, 8],
  chopping_board_beech_380: [380, 270, 22],
  mixing_bowl_glass_4qt: [310, 310, 114],
  mixing_bowl_steel_4qt: [264, 264, 108],
  mixing_bowl_steel_light_4qt: [271, 271, 95],
  mixing_bowl_pp_3l: [260, 260, 125],
  spatula_silicone_280: [280, 55, null],
  saucepan_clad_2qt: [318, 159, null],
  saucepan_steel_170: [null, 170, null],
  frying_pan_clad_254: [470, 254, null],
  frying_pan_nonstick_280: [null, 280, null],
  skillet_steel_270: [null, 270, null],
  skillet_cast_iron_260: [409, 260, null],
  skillet_cast_iron_305: [457, 319, null],
  stockpot_steel_8qt: [null, 260, 195],
  lid_glass_240: [240, 240, null],
  lid_steel_165: [165, 165, null],
  oven_dish_stoneware_320: [397, 253, 70],
  oven_dish_glass_3qt: [401, 241, 64],
  baking_tray_half_sheet: [455, 328, 25],
  roasting_tin_427: [427, 325, 86],
  muffin_tin_12: [330, 245, 32],
  cooling_rack_half: [419, 298, 22],
  loaf_pan_nonstick_210: [210, 110, 80],
  food_container_clip_1l: [176, 128, null],
  food_container_1l: [210, 150, null],
  food_container_600ml: [140, 140, 60],
  container_lid_pp: [180, 130, 12],
  lunch_box_2l: [215, 165, 70],
  water_bottle_tritan_1l: [89, 89, 215],
  water_bottle_generic_200: [90, 90, 200],
  travel_mug_steel_470: [80, 80, 190],
  baby_bottle_pp_260: [68, 68, 145],
  bottle_teat_silicone: [50, 50, 45],
  sippy_cup_240: [70, 70, 90],
  drinking_cup_pp_400: [85, 85, 120],
  blender_jug_2l: [203, null, 257],
};

/**
 * Height of the centre of mass, millimetres, of the dossier's own thin-shell models (items.md
 * table 10.2, column z_c) for the items whose catalogue profile follows the dossier's.
 */
const DOSSIER_COM_HEIGHT_MM: Readonly<Record<string, number>> = {
  dinner_plate_porcelain_270: 11,
  dinner_plate_vitrelle_260: 6,
  dessert_plate_porcelain_190: 8,
  soup_plate_porcelain_230: 20,
  deep_plate_porcelain_220: 25,
  pasta_bowl_porcelain_230: 29,
  cereal_bowl_porcelain_160: 31,
  ramekin_porcelain_89: 16,
  saucer_porcelain_140: 10,
  tea_cup_porcelain_210: 31,
  mug_ceramic_300: 43,
  espresso_cup_porcelain_80: 28,
  melamine_plate_230: 7,
  melamine_bowl_150: 28,
  tumbler_250: 38,
  iced_tea_glass_355: 54,
  highball_350: 56,
  pint_glass_473: 63,
  wine_glass_red_540: 114,
  glass_jug_1000: 80,
  mixing_bowl_glass_4qt: 54,
  mixing_bowl_steel_4qt: 51,
  mixing_bowl_pp_3l: 59,
  water_bottle_tritan_1l: 97,
  baby_bottle_pp_260: 64,
  sippy_cup_240: 39,
  drinking_cup_pp_400: 58,
};

/** Nominal capacity, millilitres, as the dossier's product names give it (1 US qt = 946 ml). */
const NOMINAL_CAPACITY_ML: Readonly<Record<string, number>> = {
  deep_plate_porcelain_220: 900,
  pasta_bowl_porcelain_230: 1260,
  cereal_bowl_porcelain_160: 800,
  cereal_bowl_vitrelle_159: 532,
  dessert_bowl_vitrelle_130: 296,
  ramekin_porcelain_89: 177,
  serving_bowl_vitrelle_216: 950,
  tea_cup_porcelain_210: 207,
  mug_porcelain_240: 240,
  mug_ceramic_300: 300,
  mug_glass_240: 240,
  espresso_cup_porcelain_80: 80,
  tumbler_250: 250,
  tumbler_360: 360,
  test_glass_borosilicate_250: 250,
  iced_tea_glass_355: 355,
  highball_350: 350,
  pint_glass_473: 473,
  glass_jug_1000: 1000,
  measuring_jug_glass_500: 500,
  mixing_bowl_glass_4qt: 3785,
  mixing_bowl_steel_4qt: 3785,
  mixing_bowl_steel_light_4qt: 3785,
  mixing_bowl_pp_3l: 3000,
  saucepan_clad_2qt: 1893,
  stockpot_steel_8qt: 7571,
  water_bottle_tritan_1l: 946,
  travel_mug_steel_470: 470,
  sippy_cup_240: 240,
  drinking_cup_pp_400: 400,
  blender_jug_2l: 1893,
};

/**
 * Nominal capacity, millilitres, of vessels that are not a plain shell of revolution; measured by
 * flooding the expanded shape (1 US qt = 946 ml).
 */
const NOMINAL_CAPACITY_FLOODED_ML: Readonly<Record<string, number>> = {
  champagne_flute_170: 170,
  wine_glass_red_540: 540,
  wine_glass_bordeaux_610: 610,
  food_container_clip_1l: 1000,
  lunch_box_2l: 2000,
};

/** Nominal capacity, millilitres, of the vessels that hold more than 1.5 times it (unreconciled). */
const OVERSIZED_CAPACITY_ML: Readonly<Record<string, number>> = {
  food_container_1l: 1000,
  food_container_600ml: 600,
  oven_dish_glass_3qt: 2839,
};

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/**
 * Brimful capacity of a shell of revolution in millilitres, from its profile alone: conical
 * frustums between the vertices of the inner surface (radius r - t / 2), from the inner face of
 * the base to the last vertex.
 */
function brimfulCapacityMl(type: ItemType): number {
  const g = type.geometry;
  if (g.class !== 'sor') throw new Error(`${type.id} is not a shell of revolution`);
  const first = g.profileMm[0] as readonly [number, number, number];
  const floor = first[1] + first[2] / 2;
  let mm3 = 0;
  for (let i = 0; i + 1 < g.profileMm.length; i++) {
    const a = g.profileMm[i] as readonly [number, number, number];
    const b = g.profileMm[i + 1] as readonly [number, number, number];
    let [r1, z1] = [Math.max(0, a[0] - a[2] / 2), a[1]];
    const [r2, z2] = [Math.max(0, b[0] - b[2] / 2), b[1]];
    if (z2 <= floor) continue;
    if (z1 < floor) {
      r1 += ((floor - z1) / (z2 - z1)) * (r2 - r1);
      z1 = floor;
    }
    mm3 += (Math.PI / 3) * (z2 - z1) * (r1 * r1 + r1 * r2 + r2 * r2);
  }
  return mm3 / 1000;
}

type Point2 = readonly [number, number];

/** Convex hull of points in the plane, counter-clockwise (monotone chain). */
function convexHull(points: readonly Point2[]): Point2[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point2, a: Point2, b: Point2): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (input: readonly Point2[]): Point2[] => {
    const out: Point2[] = [];
    for (const p of input) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2] as Point2, out[out.length - 1] as Point2, p) <= 0
      ) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** Distance from `p` to the boundary of a counter-clockwise convex polygon; negative outside. */
function insideMargin(polygon: readonly Point2[], p: Point2): number {
  if (polygon.length < 3) return Number.NEGATIVE_INFINITY;
  let margin = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i] as Point2;
    const b = polygon[(i + 1) % polygon.length] as Point2;
    const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
    margin = Math.min(margin, (ex * (p[1] - a[1]) - ey * (p[0] - a[0])) / Math.hypot(ex, ey));
  }
  return margin;
}

/**
 * How far inside its support polygon the centre of mass of an upright item is, metres, measured
 * on the render mesh and independently of `staticStability`: the support polygon is the convex
 * hull of the mesh vertices within `band` of the resting plane.
 */
function supportMargin(id: string, band: number): number {
  const instance = instantiate(id);
  const mesh = buildRenderMesh(instance.shape, { chordError: COLLISION_CHORD_ERROR });
  const contact: Point2[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    if ((mesh.positions[i + 2] as number) <= band) {
      contact.push([mesh.positions[i] as number, mesh.positions[i + 1] as number]);
    }
  }
  return insideMargin(convexHull(contact), [instance.mass.com[0], instance.mass.com[1]]);
}

const TYPES = listItemTypes();

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

describe('coverage of the starter catalogue (items.md table 10.1)', () => {
  it('has well over the 60 item types asked for, with unique well-formed ids', () => {
    expect(TYPES.length).toBeGreaterThanOrEqual(98);
    const ids = TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(isValidId(id), id).toBe(true);
  });

  it('has at least one item type for every one of the 98 rows', () => {
    const rows = new Set(TYPES.map((t) => t.row).filter((row): row is number => row !== null));
    for (let row = 1; row <= 98; row++) expect(rows.has(row), `row ${row}`).toBe(true);
    expect(rows.size).toBe(98);
  });

  it('adds only the two melamine articles of the standard load beyond the table', () => {
    const added = TYPES.filter((t) => t.row === null).map((t) => t.id);
    expect(added.sort()).toEqual([...NO_DOSSIER_MASS].sort());
  });

  it('names a reference product and a source for every dimension, mass and profile', () => {
    for (const type of TYPES) {
      expect(type.reference.product.length, type.id).toBeGreaterThan(0);
      expect(type.dimensions.length, type.id).toBeGreaterThan(0);
      expect(type.profile.note.length, type.id).toBeGreaterThan(0);
      // Every profile in the dossier is an estimate fitted to dimensions and mass.
      expect(type.profile.tag, type.id).toBe('ESTIMATED');
      expect(type.game.defaultPoints, type.id).toBeGreaterThan(0);
    }
  });
});

describe('every item type expands to a shape resting on z = 0', () => {
  it('expands through the geometry kernel and sits on the plane within 0.05 mm', () => {
    for (const type of TYPES) {
      const shape = expandGeometryMm(type.geometry);
      expect(shape.parts.length, type.id).toBeGreaterThan(0);
      const box = boundingBox(shape);
      expect(Math.abs(box.min[2]) * 1000, type.id).toBeLessThan(0.05);
    }
  });
});

describe('every item type weighs little of its material twice', () => {
  // The kernel's mass properties are sums over parts, so parts that overlap are weighed twice
  // where they do, and the wall thicknesses fitted to the stated masses hide it. Measured here
  // per item: the mass of the parts over the mass of the solid they make together (the densest
  // part at each point), less one.
  const twice = new Map<string, number>();
  for (const type of TYPES) {
    const instance = instantiate(type.id);
    const extra = countedTwice(instance.shape).mass;
    twice.set(type.id, extra / (instance.mass.mass - extra));
  }

  it('at most 7 % for any item, and above 3 % for a known few', () => {
    const above = [...twice].filter(([, share]) => share > 0.03).map(([id]) => id);
    for (const [id, share] of twice) expect(share, id).toBeLessThan(0.07);
    // Joints of handles and heads (cutlery, utensils), the corner fillets of box shells, the
    // foot ring of a plate. A new name here is a new outlier; the kernel has no mass of the
    // union yet, which would remove the list.
    expect(above.sort()).toEqual([
      'baking_tray_half_sheet',
      'dessert_plate_porcelain_190',
      'dinner_fork_185',
      'food_container_clip_1l',
      'lunch_box_2l',
      'measuring_jug_glass_500',
      'muffin_tin_12',
      'oven_dish_glass_3qt',
      'oven_dish_stoneware_320',
      'salad_fork_156',
      'serving_fork_210',
      'spatula_plastic_330',
      'spatula_silicone_280',
      'steak_knife_230',
      'turner_nylon_279',
      'wooden_spoon_305',
    ]);
  });

  it('3.2 % for the muffin tin, whose top plate once counted 23 % of the tin twice', () => {
    // Round flanges wide enough to cover the corners between the cups, and nine strips across
    // them: 112 g of 592 g counted twice, the centre of mass 2.5 mm too high and the sheet
    // fitted 19 % too thin. The plate is now cut into pieces that fit round the cups.
    const share = twice.get('muffin_tin_12') as number;
    expect(share).toBeGreaterThan(0.025);
    expect(share).toBeLessThan(0.04);
    const tin = instantiate('muffin_tin_12');
    expect(Math.abs(tin.mass.mass * 1000 - 590)).toBeLessThan(1);
    // The sheet that 590 g of aluminium make of this surface: 1.6 mm (it was 1.34 mm).
    const cup = tin.shape.parts.find((part) => part.id === 'cup_01.body');
    if (cup === undefined || cup.prim.kind !== 'sor') throw new Error('no cup');
    expect(cup.prim.profile[0]?.t).toBeCloseTo(0.001608, 9);
    // Centre of mass: 18.6 mm up (20.8 mm before; 18.3 mm for the solid of the old parts).
    expect(tin.mass.com[2] * 1000).toBeGreaterThan(18.2);
    expect(tin.mass.com[2] * 1000).toBeLessThan(19);
  });
});

describe('every item type is ready for the physics and render packages', () => {
  it('yields convex collision pieces that carry catalogue materials', () => {
    // At the platform's 0.5 mm chord error. The muffin tin, twelve shells in one item, is the
    // largest by far at 765 pieces; the median item has about 95.
    let total = 0;
    for (const type of TYPES) {
      const { shape } = instantiate(type.id);
      const pieces = buildCollisionPieces(shape, { chordError: COLLISION_CHORD_ERROR });
      const partIds = new Set(shape.parts.map((part) => part.id));
      expect(pieces.length, type.id).toBeGreaterThan(0);
      expect(pieces.length, type.id).toBeLessThan(1000);
      for (const piece of pieces) {
        expect(partIds.has(piece.part), `${type.id}: ${piece.part}`).toBe(true);
        expect(hasMaterial(piece.material ?? ''), `${type.id}: ${piece.part}`).toBe(true);
      }
      total += pieces.length;
    }
    expect(total).toBeLessThan(15000);
  });

  it('yields a render mesh that is closed part by part and encloses the volume weighed', () => {
    // Facets lie inside the curved surface, so a mesh never encloses more than the solid; at
    // the render chord error of 0.1 mm it encloses at least 95 % of it (the thin wires of the
    // cooling rack lose the most). Perforated parts are weighed with their open area taken
    // out, which the mesh does not show, so they are left out of the volume check.
    for (const type of TYPES) {
      const instance = instantiate(type.id);
      const mesh = buildRenderMesh(instance.shape, { chordError: RENDER_CHORD_ERROR });
      for (let part = 0; part < mesh.partIds.length; part++) {
        expect(meshTopology(mesh, part).closed, `${type.id}: ${mesh.partIds[part]}`).toBe(true);
      }
      if (instance.shape.parts.some((part) => (part.porosity ?? 0) > 0)) continue;
      const ratio = meshVolume(mesh) / instance.volume;
      expect(ratio, type.id).toBeGreaterThan(0.95);
      expect(ratio, type.id).toBeLessThanOrEqual(1 + 1e-6);
    }
  });
});

describe('overall size against the dossiers', () => {
  it('is within 2 mm of every extent the dossiers state', () => {
    let checked = 0;
    for (const type of TYPES) {
      const stated = OVERALL_SIZE_MM[type.id];
      expect(stated, `${type.id} has no row in the size table of this test`).toBeDefined();
      if (stated === undefined) continue;
      const box = boundingBox(expandGeometryMm(type.geometry));
      for (let axis = 0; axis < 3; axis++) {
        const expected = stated[axis];
        if (expected === null || expected === undefined) continue;
        const size = ((box.max[axis] as number) - (box.min[axis] as number)) * 1000;
        expect(Math.abs(size - expected), `${type.id} axis ${'xyz'[axis]}`).toBeLessThanOrEqual(2);
        checked++;
      }
    }
    expect(Object.keys(OVERALL_SIZE_MM).length).toBe(TYPES.length);
    expect(checked).toBeGreaterThanOrEqual(220);
  });

  it('is symmetric about the axis for round items and has its handle along +x', () => {
    for (const type of TYPES) {
      const g = type.geometry;
      if (g.class !== 'sor') continue;
      const box = instantiate(type.id).bbox;
      // Round or oval body: centred on the axis across the handle direction.
      expect(Math.abs(box.max[1] + box.min[1]) * 1000, type.id).toBeLessThan(0.01);
      const handles = (g.addons ?? []).filter(
        (a) => a.type === 'handle_bar' || a.type === 'handle_loop',
      );
      if (handles.length === 1) expect(box.max[0], type.id).toBeGreaterThan(-box.min[0]);
    }
  });
});

describe('mass from geometry against the dossiers', () => {
  it('puts every item type in exactly one of the mass tables of this test', () => {
    const tables = [VERIFIED_MASS_G, ESTIMATED_MASS_G, GROSS_MASS_G];
    for (const type of TYPES) {
      const hits =
        tables.filter((table) => table[type.id] !== undefined).length +
        (NO_DOSSIER_MASS.includes(type.id) ? 1 : 0);
      expect(hits, type.id).toBe(1);
    }
    const listed = tables.reduce((n, table) => n + Object.keys(table).length, 0);
    expect(listed + NO_DOSSIER_MASS.length).toBe(TYPES.length);
  });

  it('is within 15 % of every verified mass', () => {
    expect(Object.keys(VERIFIED_MASS_G).length).toBeGreaterThanOrEqual(50);
    for (const [id, target] of Object.entries(VERIFIED_MASS_G)) {
      expect(Math.abs(deviation(massG(id), target)), id).toBeLessThan(0.15);
    }
  });

  it('is within 3 % of every verified mass but three, which are known and explained', () => {
    const offenders = Object.entries(VERIFIED_MASS_G)
      .map(([id, target]) => [id, 100 * deviation(massG(id), target)] as const)
      .filter(([, percent]) => Math.abs(percent) > 3)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    expect(offenders.map(([id]) => id)).toEqual(VERIFIED_MASS_OFFENDERS.map(([id]) => id));
    for (const [id, percent, why] of VERIFIED_MASS_OFFENDERS) {
      const actual = offenders.find(([offender]) => offender === id);
      expect(actual, id).toBeDefined();
      // The listed deviation is rounded to a whole percent.
      expect(Math.abs((actual?.[1] ?? Number.NaN) - percent), `${id}: ${why}`).toBeLessThan(1);
    }
  });

  it('states the verified figure in the record of every such item', () => {
    for (const [id, target] of Object.entries(VERIFIED_MASS_G)) {
      const mass = getItemType(id).mass;
      expect(mass.tag, id).toBe('VERIFIED');
      expect(deviation(mass.valueG, target), id).toBe(0);
    }
  });

  it('is within 10 % of every estimated or recalled mass', () => {
    // items.md 2.4: unverified masses carry roughly 10 % uncertainty for monolithic ware. Four
    // are more than 3 % off, all light: the two platters, whose walls are held at plausible
    // thicknesses (2.95 mm of laminated glass, 5.5 mm of porcelain), and the two chopsticks,
    // which the rod class makes round in section where the dossier's are 7 mm square.
    for (const [id, target] of Object.entries(ESTIMATED_MASS_G)) {
      const mass = getItemType(id).mass;
      expect(mass.tag === 'ESTIMATED' || mass.tag === 'RECALLED', id).toBe(true);
      expect(deviation(mass.valueG, target), id).toBe(0);
      expect(Math.abs(deviation(massG(id), target)), id).toBeLessThan(0.1);
    }
    const far = Object.entries(ESTIMATED_MASS_G)
      .filter(([id, target]) => Math.abs(deviation(massG(id), target)) > 0.03)
      .map(([id]) => id)
      .sort();
    expect(far).toEqual([
      'chopstick_bamboo',
      'chopstick_melamine',
      'oval_platter_porcelain_320',
      'oval_platter_vitrelle_241',
    ]);
  });

  it('is below the figure that includes a lid, cap or rack, and at least half of it', () => {
    for (const [id, gross] of Object.entries(GROSS_MASS_G)) {
      const upper = typeof gross === 'number' ? gross : gross[1];
      const lower = typeof gross === 'number' ? gross : gross[0];
      const grams = massG(id);
      expect(grams, id).toBeLessThan(upper);
      expect(grams, id).toBeGreaterThan(0.5 * lower);
      const mass = getItemType(id).mass;
      expect(mass.tag, id).toBe('ESTIMATED');
      expect(mass.grossG, id).toBe(upper);
    }
  });

  it('gives the melamine articles without a dossier mass the wall the standard requires', () => {
    // items.md rows 25 and 26: melamine ware has a wall of at least 2.5 to 3.0 mm (verified).
    // Mean wall = 2 x volume / total surface area.
    for (const id of [...NO_DOSSIER_MASS, 'melamine_plate_230', 'melamine_bowl_150']) {
      const instance = instantiate(id);
      const wallMm = ((2 * instance.volume) / surfaceArea(instance.shape)) * 1000;
      expect(wallMm, id).toBeGreaterThanOrEqual(2.5);
      expect(wallMm, id).toBeLessThanOrEqual(3.5);
    }
  });

  it('has a positive-definite inertia and a centre of mass inside the bounding box', () => {
    for (const type of TYPES) {
      const { mass, bbox } = instantiate(type.id);
      const [ixx, iyy, izz] = [mass.inertia[0], mass.inertia[4], mass.inertia[8]] as [
        number,
        number,
        number,
      ];
      expect(Math.min(ixx, iyy, izz), type.id).toBeGreaterThan(0);
      // Triangle inequalities of a rigid body's principal-axis-aligned diagonal.
      expect(ixx + iyy, type.id).toBeGreaterThanOrEqual(izz * (1 - 1e-9));
      expect(iyy + izz, type.id).toBeGreaterThanOrEqual(ixx * (1 - 1e-9));
      expect(izz + ixx, type.id).toBeGreaterThanOrEqual(iyy * (1 - 1e-9));
      for (let i = 0; i < 3; i++) {
        expect(mass.com[i] as number, type.id).toBeGreaterThan(bbox.min[i] as number);
        expect(mass.com[i] as number, type.id).toBeLessThan(bbox.max[i] as number);
      }
    }
  });
});

describe("centre of mass against the dossier's own models", () => {
  it('is at the height items.md table 10.2 gives, within 2.5 mm or 5 %', () => {
    for (const [id, expectedMm] of Object.entries(DOSSIER_COM_HEIGHT_MM)) {
      const heightMm = (instantiate(id).mass.com[2] as number) * 1000;
      const tolerance = Math.max(2.5, 0.05 * expectedMm);
      expect(Math.abs(heightMm - expectedMm), id).toBeLessThanOrEqual(tolerance);
    }
  });

  it('is pulled towards the handle by about the offsets the dossier estimates', () => {
    // items.md 10.2: clad fry pan 44 mm, Lodge skillet 25 mm; within 15 %.
    const offsetMm = (id: string): number => (instantiate(id).mass.com[0] as number) * 1000;
    expect(Math.abs(offsetMm('frying_pan_clad_254') / 44 - 1)).toBeLessThan(0.15);
    expect(Math.abs(offsetMm('skillet_cast_iron_260') / 25 - 1)).toBeLessThan(0.15);
    // The mug's handle (12 x 8 mm section) is lighter than the 45 g of the dossier's model, so
    // its offset is under the dossier's 7 mm; see the unreconciled rows in the hand-over.
    expect(offsetMm('mug_ceramic_300')).toBeGreaterThan(2);
    expect(offsetMm('mug_ceramic_300')).toBeLessThan(7);
  });

  it('is at 43 to 47 % of the height of the stemware the dossier modelled', () => {
    for (const id of ['wine_glass_red_540', 'champagne_flute_170']) {
      const { mass, bbox } = instantiate(id);
      const share = (mass.com[2] as number) / (bbox.max[2] as number);
      expect(share, id).toBeGreaterThan(0.43);
      expect(share, id).toBeLessThan(0.47);
    }
  });
});

describe('capacity from the profile against the nominal capacity', () => {
  it('is between 0.95 and 1.5 times nominal when filled to the brim', () => {
    for (const [id, nominalMl] of Object.entries(NOMINAL_CAPACITY_ML)) {
      const ratio = brimfulCapacityMl(getItemType(id)) / nominalMl;
      expect(ratio, id).toBeGreaterThan(0.95);
      expect(ratio, id).toBeLessThan(1.5);
    }
  });

  it('agrees with the water the expanded shape holds, within 6 %, for deep vessels', () => {
    // Two independent routes to the same number: frustums on the authored profile, and a flood
    // of the signed distance of the expanded shape. Shallow plates are left out: their wells are
    // only a few grid cells deep and the profile integral stops short of the rounded rim.
    for (const id of ['pint_glass_473', 'mug_porcelain_240', 'stockpot_steel_8qt', 'tumbler_360']) {
      const flooded = brimfulVolume(instantiate(id).shape) * 1e6;
      const fromProfile = brimfulCapacityMl(getItemType(id));
      expect(Math.abs(flooded / fromProfile - 1), id).toBeLessThan(0.06);
    }
  });

  it('is between 0.95 and 1.5 times nominal for stemware and box-shaped vessels, by flooding', () => {
    // These have no plain profile to integrate (a bowl on a stem, a drafted box, a compound), so
    // the expanded shape is filled until it spills. The flute held 1.75 times its nominal volume
    // before its bowl was brought back to the dossier's profile.
    for (const [id, nominalMl] of Object.entries(NOMINAL_CAPACITY_FLOODED_ML)) {
      const ratio = (brimfulVolume(instantiate(id).shape) * 1e6) / nominalMl;
      expect(ratio, id).toBeGreaterThan(0.95);
      expect(ratio, id).toBeLessThan(1.5);
    }
  });

  it('is 1.5 to 1.7 times nominal for three vessels whose listed outer sizes are kept', () => {
    // Unreconciled, reported in the hand-over: the two food containers are straight drafted boxes
    // at the listed outer length and width, and the Pyrex dish is sized to its listed inner
    // dimensions; real ones have more draft and larger corner radii than a box shell carries.
    // This test fails when they are reshaped, which is the moment to move them to the table above.
    for (const [id, nominalMl] of Object.entries(OVERSIZED_CAPACITY_ML)) {
      const ratio = (brimfulVolume(instantiate(id).shape) * 1e6) / nominalMl;
      expect(ratio, id).toBeGreaterThan(1.5);
      expect(ratio, id).toBeLessThan(1.7);
    }
  });

  it('is 1.7 times nominal for the baby bottle, whose dossier dimensions are too large', () => {
    // items.md row 93 estimates D 68, H 145 for a 260 ml bottle; a cylinder of that size holds
    // well over 400 ml. Reported as an unreconciled row; this test fails when it is fixed.
    const ratio = brimfulCapacityMl(getItemType('baby_bottle_pp_260')) / 260;
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(1.8);
  });
});

describe('surface regions and typical soils', () => {
  it('lists exactly the regions of the expanded shape, each with area and a label', () => {
    for (const type of TYPES) {
      const { shape } = instantiate(type.id);
      const inShape = [...new Set(shape.regions.map((r) => r.id))].sort();
      const listed = type.surfaceRegions.map((r) => r.id).sort();
      expect(listed, type.id).toEqual(inShape);
      for (const region of type.surfaceRegions) {
        expect(surfaceArea(shape, region.id), `${type.id}: ${region.id}`).toBeGreaterThan(0);
        expect(region.label.length, `${type.id}: ${region.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('covers the whole surface of every item with its regions', () => {
    // The geometry kernel leaves the end faces of the straight pieces of a box shell, which
    // are buried in its corner pieces, out of every region: up to 1.5 % of the summed surface
    // of the parts of a thick-walled dish. Everything else is covered exactly.
    const hasBoxShell = (g: GeometryDefMm): boolean =>
      g.class === 'box_shell' ||
      (g.class === 'compound' && g.children.some((child) => hasBoxShell(child.def)));
    let boxes = 0;
    for (const type of TYPES) {
      const instance = instantiate(type.id);
      const total = Object.values(instance.regionAreas).reduce((a, b) => a + b, 0);
      const share = total / surfaceArea(instance.shape);
      if (hasBoxShell(type.geometry) && type.id !== 'container_lid_pp') {
        boxes++;
        expect(share, type.id).toBeGreaterThan(0.98);
        expect(share, type.id).toBeLessThan(1);
      } else {
        expect(share, type.id).toBeCloseTo(1, 9);
      }
    }
    expect(boxes).toBe(10);
  });

  it('puts every typical soil on a region the item has, and the soil is in the catalogue', () => {
    for (const type of TYPES) {
      expect(type.typicalSoils.length, type.id).toBeGreaterThan(0);
      const { shape } = instantiate(type.id);
      for (const soil of type.typicalSoils) {
        expect(hasSoil(soil.soil), `${type.id}: ${soil.soil}`).toBe(true);
        expect(surfaceArea(shape, soil.region), `${type.id}: ${soil.region}`).toBeGreaterThan(0);
      }
    }
  });

  it('has a food-contact region carrying a typical soil on every item', () => {
    for (const type of TYPES) {
      const food = new Set(type.surfaceRegions.filter((r) => r.foodContact).map((r) => r.id));
      expect(food.size, type.id).toBeGreaterThan(0);
      expect(
        type.typicalSoils.some((soil) => food.has(soil.region)),
        type.id,
      ).toBe(true);
    }
  });

  it('carries the soils items.md section 10.3 assigns to a family', () => {
    const soilsOn = (id: string, region: string): string[] =>
      getItemType(id)
        .typicalSoils.filter((s) => s.region === region)
        .map((s) => s.soil);
    // Dinner plates: egg yolk, mashed potato, meat, preserves (AHAM), baked cheese, sauces.
    expect(soilsOn('dinner_plate_porcelain_270', 'well')).toEqual(
      expect.arrayContaining(['egg_yolk_dried', 'mashed_potato', 'minced_meat', 'cheese_baked']),
    );
    // Soup plates: oat-flake porridge. Cups: tea, coffee, milk skin, lipstick on the rim.
    expect(soilsOn('soup_plate_porcelain_230', 'well')).toContain('porridge');
    expect(soilsOn('tea_cup_porcelain_210', 'interior')).toEqual(
      expect.arrayContaining(['tea_tannin', 'coffee', 'milk_skin']),
    );
    expect(soilsOn('tea_cup_porcelain_210', 'rim')).toEqual(['lipstick']);
    // Stemware: wine and lipstick. Chopsticks: rice starch. Bottles: milk film.
    expect(soilsOn('wine_glass_red_540', 'interior')).toContain('red_wine');
    expect(soilsOn('chopstick_bamboo', 'tip')).toContain('rice_starch');
    expect(soilsOn('baby_bottle_pp_260', 'interior')).toContain('milk_film');
    // Frying pans: polymerised fat, egg. Food containers: tomato stain, oil, curry.
    expect(soilsOn('skillet_cast_iron_260', 'interior_base')).toEqual(
      expect.arrayContaining(['fat_polymerised', 'egg_cooked']),
    );
    expect(soilsOn('food_container_1l', 'interior')).toEqual(
      expect.arrayContaining(['tomato_sauce', 'vegetable_oil', 'curry']),
    );
  });

  it('divides the inside of a saucepan into base and wall at the corner of its profile', () => {
    // Profile: flat to r = 78 mm, a chamfer to r = 84.65 mm at z = 7 mm, then a straight wall
    // to z = 99.65 mm. Mid-surface areas; the inner face is smaller by the order of t / r.
    const pan = instantiate('saucepan_steel_170');
    const base = Math.PI * 78 ** 2 + Math.PI * (78 + 84.65) * Math.hypot(6.65, 6.65);
    const wall = 2 * Math.PI * 84.65 * (99.65 - 7);
    expect(((pan.regionAreas.interior_base as number) * 1e6) / base).toBeGreaterThan(0.98);
    expect(((pan.regionAreas.interior_base as number) * 1e6) / base).toBeLessThan(1.0);
    expect(Math.abs(((pan.regionAreas.interior_wall as number) * 1e6) / wall - 1)).toBeLessThan(
      0.01,
    );
  });
});

describe('materials and contact pairs in use', () => {
  it('gives every part a catalogue material that agrees with the list of the record', () => {
    for (const type of TYPES) {
      for (const entry of type.materials) {
        expect(hasMaterial(entry.material), `${type.id}: ${entry.material}`).toBe(true);
      }
      for (const part of instantiate(type.id).shape.parts) {
        expect(hasMaterial(part.material), `${type.id}: ${part.id}`).toBe(true);
        expect(partMaterialOf(type, part.id), `${type.id}: ${part.id}`).toBe(part.material);
      }
    }
  });

  it('has a symmetric, finite friction and restitution for every pair in use, dry and wet', () => {
    const inUse = new Set<string>(RACK_MATERIALS);
    for (const type of TYPES) {
      for (const part of instantiate(type.id).shape.parts) inUse.add(part.material);
    }
    // The catalogue uses most of its materials; all but the PVC rack coating are on items.
    expect(inUse.size).toBeGreaterThanOrEqual(25);
    const keys = new Set([...inUse].map((id) => getMaterial(id).contactKey));
    expect(keys.size).toBeGreaterThanOrEqual(12);
    for (const a of inUse) {
      for (const b of inUse) {
        for (const wet of [false, true]) {
          const ab = frictionPair(a, b, wet);
          const ba = frictionPair(b, a, wet);
          expect(ab.friction, `${a}/${b}`).toBe(ba.friction);
          expect(ab.restitution, `${a}/${b}`).toBe(ba.restitution);
          expect(ab.friction, `${a}/${b}`).toBeGreaterThan(0);
          expect(ab.friction, `${a}/${b}`).toBeLessThan(1.5);
          expect(ab.restitution, `${a}/${b}`).toBeGreaterThanOrEqual(0);
          expect(ab.restitution, `${a}/${b}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('named poses', () => {
  it('has a recommended pose among its poses, with unique names, for every item', () => {
    for (const type of TYPES) {
      const names = type.placement.stablePoses.map((p) => p.name);
      expect(new Set(names).size, type.id).toBe(names.length);
      expect(names, type.id).toContain(type.placement.recommendedPose);
      expect(type.placement.zones.length, type.id).toBeGreaterThan(0);
    }
  });

  it('stands every item in its first pose, bar two that lie tilted and say so', () => {
    const tilted: string[] = [];
    for (const type of TYPES) {
      const instance = instantiate(type.id);
      const first = type.placement.stablePoses[0];
      if (first === undefined) throw new Error(`${type.id} has no pose`);
      const stable = staticStability(
        instance.shape,
        instance.mass.com,
        poseQuaternion(first),
      ).stable;
      expect(stable, type.id).toBe(first.freeStanding);
      if (!first.freeStanding) tilted.push(type.id);
    }
    // A chef's knife rocks onto its blade and a long-handled sieve onto its handle: their
    // level pose is not an equilibrium, and a solved 'resting' pose is given instead.
    expect(tilted.sort()).toEqual(['chefs_knife_200', 'sieve_mesh_200']);
    for (const id of tilted) {
      const resting = getItemType(id).placement.stablePoses.find((p) => p.name === 'resting');
      expect(resting?.freeStanding, id).toBe(true);
    }
  });

  it('has the centre of mass above the support polygon of every flat-based item upright', () => {
    // Independent of staticStability: the support polygon is the convex hull of the render
    // mesh vertices within 0.5 mm of the plane, which overstates it by up to 2 mm at a rounded
    // base corner. Shells of revolution, trays and boards stand on a flat face or a ring; the
    // narrowest margin in the catalogue is a tea cup's, 19 mm.
    let checked = 0;
    for (const type of TYPES) {
      if (!['sor', 'box_shell', 'slab'].includes(type.geometry.class)) continue;
      expect(supportMargin(type.id, 0.0005) * 1000, type.id).toBeGreaterThan(15);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(75);
  });

  it('finds the centre of mass outside the support polygon of the two tilted items', () => {
    for (const id of ['chefs_knife_200', 'sieve_mesh_200']) {
      expect(supportMargin(id, 0.0005) * 1000, id).toBeLessThan(-15);
    }
  });

  it('tips no earlier than atan(margin / height of the centre of mass) for flat-based items', () => {
    // Tilting about the edge of the base the centre of mass peaks at atan(d / h); an item whose
    // wall comes to rest on the plane first (a bowl) goes further. One degree of tolerance for
    // the overstated support polygon.
    for (const type of TYPES) {
      if (!['sor', 'box_shell', 'slab'].includes(type.geometry.class)) continue;
      const instance = instantiate(type.id);
      const first = type.placement.stablePoses[0];
      if (first === undefined) throw new Error(`${type.id} has no pose`);
      const s = staticStability(instance.shape, instance.mass.com, poseQuaternion(first));
      const edge = radToDeg(Math.atan2(supportMargin(type.id, 0.0005), instance.mass.com[2]));
      expect(radToDeg(s.tipAngle), type.id).toBeGreaterThan(edge - 1);
    }
  });

  it('tips a tumbler about its base corner and about its rim at atan(r / h)', () => {
    // Upright it rolls on the rounded base corner (centre at r = 26.78 mm, z = 3.72 mm);
    // inverted on the rounded rim (centre at r = 41.91 mm, z = 88.41 mm).
    const tumbler = instantiate('tumbler_250');
    const zc = (tumbler.mass.com[2] as number) * 1000;
    const tip = (name: string): number => {
      const pose = tumbler.stablePoses.find((p) => p.name === name);
      if (pose === undefined) throw new Error(`no pose ${name}`);
      return radToDeg(staticStability(tumbler.shape, tumbler.mass.com, pose.q).tipAngle);
    };
    expect(tip('upright')).toBeCloseTo(radToDeg(Math.atan(26.78 / (zc - 3.72))), 1);
    expect(tip('inverted')).toBeCloseTo(radToDeg(Math.atan(41.91 / (88.41 - zc))), 1);
  });

  it('makes stemware the least stable upright glassware, as the dossier says', () => {
    const tipDeg = (id: string): number => {
      const instance = instantiate(id);
      return radToDeg(staticStability(instance.shape, instance.mass.com, [0, 0, 0, 1]).tipAngle);
    };
    const stemware = TYPES.filter((t) => t.shapeTag === 'stemware').map((t) => tipDeg(t.id));
    const tumblers = TYPES.filter((t) => t.itemClass === 'tumbler').map((t) => tipDeg(t.id));
    expect(stemware).toHaveLength(4);
    expect(Math.max(...stemware)).toBeLessThan(Math.min(...tumblers));
    // "Top-heavy when upright": all tip within about 20 degrees.
    expect(Math.max(...stemware)).toBeLessThan(21);
  });
});

describe('flags', () => {
  it('marks as fragile exactly the items with a ceramic or glass body', () => {
    for (const type of TYPES) {
      const family = getMaterial(instantiate(type.id).contact.material).family;
      expect(type.flags.fragile, type.id).toBe(family === 'ceramic' || family === 'glass');
    }
  });

  it('marks as floating exactly the items less dense than water at 60 C', () => {
    for (const type of TYPES) {
      const instance = instantiate(type.id);
      const density = instance.mass.mass / instance.volume;
      expect(type.flags.floats, type.id).toBe(density < WATER_DENSITY_60C);
    }
  });

  it('floats polypropylene, polyethylene and wood and sinks the other plastics (items.md 3.1)', () => {
    const floats = (id: string): boolean => getItemType(id).flags.floats;
    for (const id of [
      'drinking_cup_pp_400',
      'food_container_1l',
      'container_lid_pp',
      'mixing_bowl_pp_3l',
      'baby_bottle_pp_260',
      'chopping_board_pe_340',
      'chopping_board_pp_375',
      'chopping_board_beech_380',
      'wooden_spoon_305',
      'chopstick_bamboo',
    ]) {
      expect(floats(id), id).toBe(true);
    }
    for (const id of [
      'melamine_bowl_150',
      'chopstick_melamine',
      'water_bottle_tritan_1l',
      'turner_nylon_279',
      'spatula_silicone_280',
      'bottle_teat_silicone',
      'tumbler_250',
      'dinner_fork_185',
    ]) {
      expect(floats(id), id).toBe(false);
    }
  });

  it('tells the items makers say to wash by hand (items.md 10.3)', () => {
    const safe = (id: string): boolean => getItemType(id).flags.dishwasherSafe;
    // Cast iron and non-stick are "not recommended"; sharp knives "hand wash only"; wood.
    for (const id of [
      'skillet_cast_iron_260',
      'skillet_cast_iron_305',
      'frying_pan_nonstick_280',
      'chefs_knife_200',
      'steak_knife_230',
      'wooden_spoon_305',
      'chopping_board_beech_380',
    ]) {
      expect(safe(id), id).toBe(false);
    }
    for (const type of TYPES) {
      if (type.category === 'tableware') expect(safe(type.id), type.id).toBe(true);
    }
  });

  it('keeps top-rack-only items out of the lower rack, and they are all plastic or rubber', () => {
    const topOnly = TYPES.filter((t) => t.flags.topRackOnly);
    expect(topOnly.length).toBeGreaterThanOrEqual(15);
    for (const type of topOnly) {
      expect(type.placement.zones, type.id).not.toContain('lower_rack');
      const family = getMaterial(instantiate(type.id).contact.material).family;
      expect(['polymer', 'elastomer'], type.id).toContain(family);
    }
  });
});
