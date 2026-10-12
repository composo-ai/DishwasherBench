/**
 * The level families of the first generated set: three meals, each with the pieces it leaves
 * behind as ranges. See `generate.ts` for what a seed draws.
 *
 * The soils and the pieces are chosen as those of the hand-written starter levels are, for the
 * same reasons (the header of `starter/levels.ts`, docs/benchmark/levels.md sections 3 and 4):
 * on the table only soils whose verdict does not turn on a parameter the anchoring has not
 * settled, egg, meat and starch on the pans, hollow pieces with a soil a jet must reach,
 * pieces a hand can seat in this machine, and in each family one piece that looks worth its
 * place and is not.
 */

import type { FamilyGroup, LevelFamily } from './generate.ts';

const KNIFE: FamilyGroup = {
  prefix: 'knife',
  itemTypes: ['dinner_knife_210'],
  count: { perDiner: 1 },
  points: [2, 2],
  soils: [{ type: 'butter_margarine', regions: { blade: [0.3, 0.5] } }],
};

const DINNER_PLATES = [
  'dinner_plate_porcelain_270',
  'dinner_plate_stoneware_270',
  'dinner_plate_vitrelle_260',
] as const;

/** A thick smoothie in a glass: a soil soaking does not move, in a piece a careless hand leaves mouth up or on its side. */
const SMOOTHIE_GLASS: FamilyGroup = {
  prefix: 'smoothie_glass',
  itemTypes: ['tumbler_250', 'tumbler_360'],
  count: { perDiner: 1 },
  points: [5, 7],
  soils: [{ type: 'avocado', regions: { interior: [0.2, 0.4] } }],
};

/** Pasta for the family, the dish and the pans it was cooked in and the lunch tubs of the day. */
export const PASTA_SUPPER: LevelFamily = {
  id: 'pasta-supper',
  title: 'Pasta supper',
  summary:
    'Pasta with a tomato sauce, a salad and yoghurt for {diners}, cleared {age} after the meal, with the dish and the pans it was cooked in and the lunch tubs of the day. It does not all fit.',
  diners: [3, 5],
  ageH: [1, 3],
  traps: [
    'hollow pieces on their side or mouth up: the smoothie glasses and the ketchup pots carry a soil a jet must reach (archetype 3)',
    'an uncleanable piece worth a lot: the oven dish with baked-on cheese (archetype 8)',
    'a soil the programme may not shift: mince browned onto the pans (value against cleanability)',
    'capacity: the oven dish and the pans against a table of plates and bowls',
  ],
  groups: [
    {
      prefix: 'pasta_plate',
      itemTypes: DINNER_PLATES,
      count: { perDiner: 1 },
      points: [9, 10],
      soils: [{ type: 'tomato_sauce', regions: { well: [0.4, 0.6] } }],
    },
    {
      prefix: 'side_plate',
      itemTypes: ['dessert_plate_porcelain_190', 'bread_plate_vitrelle_170'],
      count: { perDiner: 1 },
      points: [4, 6],
      soils: [
        { type: 'vegetable_oil', regions: { well: [0.3, 0.6] } },
        { type: 'spinach_particles', regions: { well: [0.1, 0.2] } },
      ],
    },
    {
      prefix: 'yoghurt_bowl',
      itemTypes: ['dessert_bowl_vitrelle_130', 'cereal_bowl_vitrelle_159'],
      count: { perDiner: 1 },
      points: [6, 8],
      soils: [{ type: 'yoghurt', regions: { interior: [0.3, 0.5] } }],
    },
    SMOOTHIE_GLASS,
    {
      prefix: 'glass',
      itemTypes: ['tumbler_360', 'tumbler_250'],
      count: [2, 3],
      points: [4, 6],
      soils: [{ type: 'sugar_syrup', regions: { interior: [0.2, 0.4] } }],
    },
    {
      prefix: 'ketchup_pot',
      itemTypes: ['ramekin_porcelain_89'],
      count: [2, 3],
      points: [4, 6],
      soils: [{ type: 'tomato_sauce', regions: { interior: [0.3, 0.5] } }],
    },
    {
      prefix: 'fork',
      itemTypes: ['dinner_fork_185'],
      count: { perDiner: 1 },
      points: [2, 2],
      soils: [{ type: 'spinach_particles', regions: { tines: [0.4, 0.6] } }],
    },
    {
      prefix: 'spoon',
      itemTypes: ['dessert_spoon_160'],
      count: { perDiner: 1 },
      points: [2, 2],
      soils: [{ type: 'yoghurt', regions: { bowl: [0.4, 0.6] } }],
    },
    {
      prefix: 'knife',
      itemTypes: ['dinner_knife_210'],
      count: [2, 4],
      points: [2, 2],
      soils: [{ type: 'butter_margarine', regions: { blade: [0.3, 0.5] } }],
    },
    {
      prefix: 'oven_dish',
      itemTypes: ['oven_dish_glass_3qt', 'oven_dish_stoneware_320'],
      count: [1, 1],
      points: [24, 30],
      soils: [
        { type: 'cheese_baked', regions: { interior: [0.3, 0.4] }, heatHistory: 'baked' },
        { type: 'tomato_sauce', regions: { interior: [0.3, 0.4] }, heatHistory: 'cooked' },
      ],
    },
    {
      prefix: 'saucepan',
      itemTypes: ['saucepan_steel_170', 'saucepan_clad_2qt'],
      count: [1, 1],
      points: [16, 20],
      soils: [
        {
          type: 'tomato_sauce',
          regions: { interior_wall: [0.4, 0.6], interior_base: [0.2, 0.4] },
          heatHistory: 'cooked',
        },
      ],
    },
    {
      prefix: 'frying_pan',
      itemTypes: ['skillet_steel_270', 'frying_pan_clad_254'],
      count: [1, 1],
      points: [18, 22],
      chance: 0.7,
      soils: [
        {
          type: 'lard_tallow',
          regions: { interior_base: [0.6, 0.9], interior_wall: [0.3, 0.5] },
          heatHistory: 'cooked',
        },
        { type: 'minced_meat', regions: { interior_base: [0.15, 0.25] }, heatHistory: 'cooked' },
      ],
    },
    {
      prefix: 'salad_bowl',
      itemTypes: ['serving_bowl_vitrelle_216'],
      count: [1, 1],
      points: [9, 11],
      soils: [
        { type: 'vegetable_oil', regions: { interior: [0.4, 0.7] } },
        { type: 'spinach_particles', regions: { interior: [0.05, 0.15] } },
      ],
    },
    {
      prefix: 'board',
      itemTypes: ['chopping_board_pp_375'],
      count: [1, 1],
      points: [8, 10],
      soils: [{ type: 'spinach_particles', regions: { top: [0.15, 0.3] } }],
    },
    {
      prefix: 'lunch_tub',
      itemTypes: ['food_container_600ml'],
      count: [2, 3],
      points: [6, 8],
      soils: [
        { type: 'butter_margarine', regions: { interior: [0.2, 0.4] }, olderByH: 8 },
        { type: 'yoghurt', regions: { interior: [0.05, 0.15] }, olderByH: 8 },
      ],
    },
    {
      prefix: 'lid',
      itemTypes: ['lid_steel_165'],
      count: [1, 1],
      points: [5, 7],
      chance: 0.6,
      soils: [{ type: 'tomato_sauce', regions: { underside: [0.3, 0.5] }, heatHistory: 'cooked' }],
    },
    {
      prefix: 'turner',
      itemTypes: ['turner_nylon_279'],
      count: [1, 1],
      points: [3, 4],
      soils: [{ type: 'lard_tallow', regions: { blade: [0.4, 0.7] }, heatHistory: 'cooked' }],
    },
    {
      prefix: 'serving_spoon',
      itemTypes: ['serving_spoon_216'],
      count: [1, 2],
      points: [3, 3],
      soils: [
        {
          type: 'tomato_sauce',
          regions: { bowl: [0.5, 0.7], bowl_back: [0.2, 0.4] },
          heatHistory: 'cooked',
        },
      ],
    },
  ],
};

/** A roast with gravy and a crumble with cream, with the tin, the pans and the serving pieces. */
export const ROAST_LUNCH: LevelFamily = {
  id: 'roast-lunch',
  title: 'Sunday roast',
  summary:
    'A prawn cocktail, a roast with gravy and greens and a crumble with cream for {diners}, {age} after the table was cleared: the roasting tin, the pans, the platter and the little pots of mustard. It does not all fit.',
  diners: [4, 6],
  ageH: [2, 5],
  traps: [
    'hollow pieces on their side or mouth up: the starter glasses and the mustard pots carry a sauce a jet must reach (archetype 3)',
    'an uncleanable piece worth a lot: the roasting tin with baked-on fat (archetype 8)',
    'shadowing by a large flat piece: a platter and a board that go where plates would (archetype 1)',
    'a soil the programme may not shift: starch dried in the potato pan (value against cleanability)',
  ],
  groups: [
    {
      prefix: 'dinner_plate',
      itemTypes: DINNER_PLATES,
      count: { perDiner: 1 },
      points: [9, 11],
      soils: [
        { type: 'gravy', regions: { well: [0.4, 0.6], rim: [0.05, 0.15] } },
        { type: 'spinach_particles', regions: { well: [0.05, 0.15] } },
      ],
    },
    {
      prefix: 'pudding_bowl',
      itemTypes: ['dessert_bowl_vitrelle_130', 'cereal_bowl_vitrelle_159'],
      count: { perDiner: 1 },
      points: [6, 8],
      soils: [
        { type: 'jam', regions: { interior: [0.2, 0.4] } },
        { type: 'cream', regions: { interior: [0.1, 0.3] } },
      ],
    },
    {
      prefix: 'starter_glass',
      itemTypes: ['tumbler_250'],
      count: { perDiner: 1 },
      points: [5, 7],
      // The starter: prawn cocktail in a glass, its tomato and mayonnaise sauce dried on.
      soils: [
        { type: 'tomato_sauce', regions: { interior: [0.2, 0.4] } },
        { type: 'mayonnaise', regions: { interior: [0.1, 0.2] } },
      ],
    },
    {
      prefix: 'glass',
      itemTypes: ['tumbler_360', 'highball_350'],
      count: { perDiner: 1 },
      points: [4, 6],
      soils: [{ type: 'sugar_syrup', regions: { interior: [0.2, 0.4] } }],
    },
    {
      prefix: 'mustard_pot',
      itemTypes: ['ramekin_porcelain_89'],
      count: [2, 3],
      points: [4, 6],
      soils: [{ type: 'mustard', regions: { interior: [0.3, 0.5] } }],
    },
    {
      prefix: 'fork',
      itemTypes: ['dinner_fork_185'],
      count: { perDiner: 1 },
      points: [2, 2],
      soils: [{ type: 'gravy', regions: { tines: [0.4, 0.6] } }],
    },
    KNIFE,
    {
      prefix: 'spoon',
      itemTypes: ['dessert_spoon_160'],
      count: { perDiner: 1 },
      points: [2, 2],
      soils: [{ type: 'cream', regions: { bowl: [0.4, 0.6] } }],
    },
    {
      prefix: 'roasting_tin',
      itemTypes: ['roasting_tin_427'],
      count: [1, 1],
      points: [28, 34],
      soils: [
        { type: 'fat_polymerised', regions: { interior: [0.2, 0.4] }, heatHistory: 'baked' },
        { type: 'lard_tallow', regions: { interior: [0.4, 0.7] }, heatHistory: 'cooked' },
      ],
    },
    {
      prefix: 'gravy_pan',
      itemTypes: ['saucepan_clad_2qt', 'saucepan_steel_170'],
      count: [1, 1],
      points: [16, 20],
      soils: [
        {
          type: 'gravy',
          regions: { interior_wall: [0.3, 0.5], interior_base: [0.2, 0.4] },
          heatHistory: 'warm',
        },
      ],
    },
    {
      prefix: 'potato_pan',
      itemTypes: ['saucepan_steel_170', 'saucepan_clad_2qt'],
      count: [1, 1],
      points: [14, 18],
      chance: 0.7,
      soils: [
        {
          type: 'pasta_starch',
          regions: { interior_base: [0.5, 0.7], interior_wall: [0.4, 0.6] },
          heatHistory: 'cooked',
        },
      ],
    },
    {
      prefix: 'platter',
      itemTypes: ['oval_platter_porcelain_320'],
      count: [1, 1],
      points: [10, 12],
      soils: [
        { type: 'lard_tallow', regions: { well: [0.4, 0.6] }, heatHistory: 'cooked' },
        { type: 'gravy', regions: { well: [0.1, 0.3] } },
      ],
    },
    {
      prefix: 'vegetable_bowl',
      itemTypes: ['serving_bowl_vitrelle_216'],
      count: [1, 1],
      points: [8, 10],
      soils: [
        { type: 'butter_margarine', regions: { interior: [0.3, 0.5] } },
        { type: 'spinach_particles', regions: { interior: [0.05, 0.15] }, heatHistory: 'cooked' },
      ],
    },
    {
      prefix: 'board',
      itemTypes: ['chopping_board_pp_375'],
      count: [1, 1],
      points: [9, 11],
      soils: [{ type: 'lard_tallow', regions: { top: [0.3, 0.5] }, heatHistory: 'cooked' }],
    },
    {
      prefix: 'lid',
      itemTypes: ['lid_steel_165'],
      count: [1, 2],
      points: [5, 7],
      soils: [{ type: 'gravy', regions: { underside: [0.3, 0.5] }, heatHistory: 'warm' }],
    },
    {
      prefix: 'tongs',
      itemTypes: ['tongs_steel_350'],
      count: [1, 1],
      points: [4, 4],
      chance: 0.5,
      soils: [{ type: 'lard_tallow', regions: { head: [0.4, 0.7] }, heatHistory: 'cooked' }],
    },
    {
      prefix: 'serving_spoon',
      itemTypes: ['serving_spoon_216'],
      count: [1, 2],
      points: [3, 3],
      soils: [{ type: 'gravy', regions: { bowl: [0.5, 0.8], bowl_back: [0.2, 0.4] } }],
    },
  ],
};

/** Beans on toast, yoghurt and fruit, something hot to drink, with the pans and the boxes for the day. */
export const COOKED_BREAKFAST: LevelFamily = {
  id: 'cooked-breakfast',
  title: 'Cooked breakfast',
  summary:
    'Beans on toast with a fried egg, yoghurt, stewed fruit and smoothies for {diners}, left for {age}: the plates and bowls, the mugs and glasses, the pans, and the boxes for the day out. It does not all fit.',
  diners: [3, 5],
  ageH: [2, 5],
  traps: [
    'hollow pieces on their side or mouth up: the smoothie glasses and the beaker carry a soil a jet must reach (archetypes 3 and 5)',
    'an uncleanable piece worth a lot: the porridge pan left to dry (archetype 8)',
    'a soil the programme may not shift: egg fried onto the pan (value against cleanability)',
  ],
  groups: [
    {
      prefix: 'bean_plate',
      itemTypes: DINNER_PLATES,
      count: { perDiner: 1 },
      points: [8, 10],
      soils: [{ type: 'tomato_sauce', regions: { well: [0.3, 0.5] } }],
    },
    {
      prefix: 'yoghurt_bowl',
      itemTypes: ['cereal_bowl_vitrelle_159'],
      count: { perDiner: 1 },
      points: [7, 9],
      soils: [{ type: 'yoghurt', regions: { interior: [0.3, 0.5] } }],
    },
    {
      prefix: 'fruit_bowl',
      itemTypes: ['dessert_bowl_vitrelle_130'],
      count: [2, 3],
      points: [6, 8],
      soils: [
        { type: 'jam', regions: { interior: [0.2, 0.4] } },
        { type: 'cream', regions: { interior: [0.1, 0.3] } },
      ],
    },
    {
      prefix: 'toast_plate',
      itemTypes: ['bread_plate_vitrelle_170', 'dessert_plate_porcelain_190'],
      count: { perDiner: 1 },
      points: [3, 5],
      soils: [
        { type: 'butter_margarine', regions: { well: [0.2, 0.4] } },
        { type: 'jam', regions: { well: [0.1, 0.2] } },
      ],
    },
    SMOOTHIE_GLASS,
    {
      prefix: 'mug',
      itemTypes: ['mug_ceramic_300', 'mug_porcelain_240', 'mug_glass_240'],
      count: { perDiner: 1 },
      points: [5, 7],
      soils: [
        { type: 'chocolate', regions: { interior: [0.2, 0.4] } },
        { type: 'milk_skin', regions: { interior: [0.1, 0.3] }, heatHistory: 'warm' },
      ],
    },
    {
      prefix: 'juice_glass',
      itemTypes: ['tumbler_250', 'tumbler_360'],
      count: [2, 3],
      points: [4, 6],
      soils: [{ type: 'sugar_syrup', regions: { interior: [0.2, 0.4] } }],
    },
    {
      prefix: 'beaker',
      itemTypes: ['sippy_cup_240'],
      count: [1, 2],
      points: [5, 6],
      chance: 0.6,
      soils: [{ type: 'avocado', regions: { interior: [0.2, 0.4] } }],
    },
    {
      prefix: 'knife',
      itemTypes: ['dinner_knife_210'],
      count: { perDiner: 1 },
      points: [2, 2],
      soils: [
        { type: 'butter_margarine', regions: { blade: [0.3, 0.5] } },
        { type: 'jam', regions: { blade: [0.1, 0.3] } },
      ],
    },
    {
      prefix: 'fork',
      itemTypes: ['dinner_fork_185'],
      count: { perDiner: 1 },
      points: [2, 2],
      soils: [{ type: 'butter_margarine', regions: { tines: [0.3, 0.5] } }],
    },
    {
      prefix: 'spoon',
      itemTypes: ['dessert_spoon_160'],
      count: { perDiner: 1 },
      points: [2, 2],
      soils: [{ type: 'yoghurt', regions: { bowl: [0.4, 0.6] } }],
    },
    {
      prefix: 'porridge_pan',
      itemTypes: ['saucepan_clad_2qt'],
      count: [1, 1],
      points: [24, 28],
      soils: [
        {
          type: 'porridge',
          regions: { interior_wall: [0.5, 0.7], interior_base: [0.2, 0.4] },
          heatHistory: 'warm',
          // The pan left to dry: a thick band.
          relative: [1, 1.5],
        },
      ],
    },
    {
      prefix: 'frying_pan',
      itemTypes: ['frying_pan_clad_254', 'skillet_steel_270'],
      count: [1, 1],
      points: [20, 24],
      soils: [
        { type: 'egg_cooked', regions: { interior_base: [0.4, 0.6] }, heatHistory: 'cooked' },
        {
          type: 'lard_tallow',
          regions: { interior_base: [0.3, 0.5], interior_wall: [0.2, 0.4] },
          heatHistory: 'cooked',
        },
      ],
    },
    {
      prefix: 'bean_pan',
      itemTypes: ['saucepan_steel_170'],
      count: [1, 1],
      points: [12, 16],
      chance: 0.6,
      soils: [
        {
          type: 'tomato_sauce',
          regions: { interior_wall: [0.3, 0.5], interior_base: [0.2, 0.4] },
          heatHistory: 'cooked',
        },
      ],
    },
    {
      prefix: 'serving_bowl',
      itemTypes: ['serving_bowl_vitrelle_216'],
      count: [1, 1],
      points: [7, 9],
      soils: [{ type: 'yoghurt', regions: { interior: [0.3, 0.5] } }],
    },
    {
      prefix: 'lunch_box',
      itemTypes: ['food_container_600ml'],
      count: [2, 3],
      points: [6, 8],
      soils: [{ type: 'sugar_syrup', regions: { interior: [0.3, 0.5] } }],
    },
    {
      prefix: 'board',
      itemTypes: ['chopping_board_pp_375'],
      count: [1, 1],
      points: [7, 9],
      soils: [{ type: 'butter_margarine', regions: { top: [0.15, 0.3] } }],
    },
    {
      prefix: 'turner',
      itemTypes: ['turner_nylon_279'],
      count: [1, 1],
      points: [4, 4],
      soils: [{ type: 'lard_tallow', regions: { blade: [0.4, 0.6] }, heatHistory: 'cooked' }],
    },
  ],
};

/** The families of the first generated set, in the order their levels are listed. */
export const LEVEL_FAMILIES: readonly LevelFamily[] = [PASTA_SUPPER, ROAST_LUNCH, COOKED_BREAKFAST];
