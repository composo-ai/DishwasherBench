/**
 * Cutlery, sharp knives and chopsticks (rows 41 to 51 of the starter catalogue,
 * docs/research/items.md section 10.1).
 *
 * The dossier gives lengths (verified) and mass ranges (mostly recalled) but no cross-sections,
 * so the proportions are the catalogue's own [ESTIMATED]: flat shanks 2.2 to 3.5 mm thick with a
 * raised neck, four-prong forks, shallow spoon bowls, a solid-handled table knife. Each piece is
 * authored lying flat on z = 0 with its handle end at x = 0 and its working end towards +x, so
 * that the identity orientation is how it lies on a table. Section sizes are fitted to the
 * middle of the dossier's mass range. Authoring units: millimetres, grams.
 */

import type { RodDefMm } from '@spotless/geometry';
import type { ItemType } from '../types.ts';
import {
  ALONG_Y,
  defineItem,
  dim,
  E,
  extentOf,
  FLAT,
  FLAT_INVERTED,
  FLAT_INVERTED_STEADY,
  HANDLE_DOWN,
  HANDLE_UP,
  length,
  mass,
  pose,
  R,
  rename,
  regionsOf,
  soil,
  V,
  type Family,
} from './builders.ts';

const STEEL = [{ part: '*', material: 'stainless_steel' }] as const;

const OWN_PROPORTIONS =
  "Length from the dossier; cross-sections and head proportions are the catalogue engineer's, fitted to the middle of the mass range.";

/** Lying on its edge in a slot of a cutlery tray. */
const ON_EDGE = pose('on_edge', [90, 0, 0], false, 'lying on its edge in a slot of a cutlery tray');

const CUTLERY_FLAGS = {
  dishwasherSafe: true,
  topRackOnly: false,
  fragile: false,
  floats: false,
  concave: false,
} as const;

const FORK: Family = {
  category: 'cutlery',
  itemClass: 'dinner_fork',
  shapeTag: 'cutlery',
  zones: ['cutlery_basket', 'third_rack'],
  poses: [FLAT, FLAT_INVERTED, HANDLE_DOWN, HANDLE_UP, ON_EDGE],
  recommendedPose: 'handle_down',
  usual:
    'Cutlery basket (handles down for spoons/forks, mixed to avoid nesting) or flat in third-rack tray',
  behaviour: 'Spoon nesting shadows soil; teaspoons lying flat in a tray are jet-mobile',
  soils: [
    soil('tines', 'egg_yolk_dried', 'smear'),
    soil('tines', 'mashed_potato', 'patch'),
    soil('tines', 'tomato_sauce', 'smear'),
    soil('tines', 'cheese_melted', 'patch'),
  ],
  flags: CUTLERY_FLAGS,
};

const SPOON: Family = {
  ...FORK,
  itemClass: 'table_spoon',
  soils: [
    soil('bowl', 'porridge', 'smear'),
    soil('bowl', 'wheat_biscuit_cereal', 'patch'),
    soil('bowl', 'yoghurt', 'film'),
    soil('bowl', 'coffee', 'film'),
    soil('bowl_back', 'porridge', 'smear'),
  ],
  flags: { ...CUTLERY_FLAGS, concave: true },
};

const TABLE_KNIFE: Family = {
  ...FORK,
  itemClass: 'dinner_knife',
  poses: [FLAT, FLAT_INVERTED_STEADY, HANDLE_DOWN, HANDLE_UP, ON_EDGE],
  recommendedPose: 'handle_up',
  soils: [
    soil('blade', 'butter_margarine', 'smear'),
    soil('blade', 'peanut_butter', 'smear'),
    soil('blade', 'jam', 'smear'),
    soil('blade', 'cheese_melted', 'smear'),
  ],
};

const SHARP_KNIFE: Family = {
  category: 'cutlery',
  itemClass: 'steak_knife',
  shapeTag: 'cutlery',
  zones: ['third_rack', 'cutlery_basket'],
  poses: [FLAT, FLAT_INVERTED_STEADY, HANDLE_UP, ON_EDGE],
  recommendedPose: 'flat',
  usual: 'Third rack flat, or basket point-down',
  behaviour: 'Often "hand wash only"; edge damage is a chemistry/damage flag',
  soils: [
    soil('blade', 'lard_tallow', 'film'),
    soil('blade', 'minced_meat', 'smear'),
    soil('blade', 'cheese_melted', 'smear'),
  ],
  flags: { ...CUTLERY_FLAGS, dishwasherSafe: false },
};

const CHOPSTICK: Family = {
  category: 'cutlery',
  itemClass: 'chopstick',
  shapeTag: 'cutlery',
  zones: ['cutlery_basket', 'third_rack'],
  poses: [FLAT, HANDLE_DOWN, HANDLE_UP],
  recommendedPose: 'handle_up',
  usual: 'Basket cell or third rack',
  behaviour: 'Lightest item in the catalogue: jet-mobile, floats if wood, falls through rack',
  soils: [
    soil('tip', 'rice_starch', 'film'),
    soil('tip', 'rice_grains', 'specks'),
    soil('tip', 'tomato_sauce', 'smear'),
  ],
  flags: CUTLERY_FLAGS,
};

const CHOPSTICK_REGIONS = regionsOf(['grip', 'tip'], {
  grip: ['grip', false],
  tip: ['eating end', true],
});

/** A chopstick: round at the grip, tapering to the eating end. */
function chopstick(material: string): RodDefMm {
  return {
    class: 'rod',
    material,
    nodes: [
      { pMm: [3.5, 0, 3.5], widthMm: 7, thicknessMm: 7 },
      { pMm: [150, 0, 3.5], widthMm: 7, thicknessMm: 7 },
      { pMm: [238.25, 0, 1.75], widthMm: 3.5, thicknessMm: 3.5 },
    ],
    head: { type: 'none' },
    regions: [
      { id: 'grip', part: 'handle.0' },
      { id: 'tip', part: 'handle.1' },
    ],
  };
}

/** Cutlery, sharp knives and chopsticks. */
export const CUTLERY: readonly ItemType[] = [
  defineItem(TABLE_KNIFE, {
    id: 'dinner_knife_210',
    row: 41,
    name: 'Dinner knife, solid handle',
    product: 'IKEA DRAGON knife 21 cm',
    standardItem:
      'the IEC 60436 and AHAM DW-2 knife is the WMF 12.0803.6047 (209 mm, discontinued; standards.md 5.3)',
    sources: ['items.md P13, S1', 'standards.md 5.3 (S17)'],
    dimensions: [length(210, V, { rangeMm: [210, 248] })],
    mass: mass(90, R, {
      rangeG: [80, 100],
      grossG: 97,
      note: '97 g including packaging (verified)',
    }),
    profileNote: OWN_PROPORTIONS,
    materials: STEEL,
    geometry: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [3.5, 0, 3.5], widthMm: 15, thicknessMm: 7 },
        { pMm: [98.5, 0, 3.5], widthMm: 13, thicknessMm: 7 },
      ],
      head: { type: 'blade', lengthMm: 111.5, widthMm: 19, thicknessMm: 2 },
    },
    surfaceRegions: ['handle', 'blade'],
  }),
  defineItem(FORK, {
    id: 'dinner_fork_185',
    row: 42,
    name: 'Dinner fork',
    product: 'WMF Signum dinner fork 12.1905.6040',
    standardItem: 'AHAM DW-2 dinner fork; IEC 60436 fork',
    sources: ['items.md P13, S1, S8', 'standards.md 5.3 (S17)'],
    dimensions: [
      length(185, V, {
        rangeMm: [185, 211],
        note: 'standards.md 5.3 lists the same article at 188 mm',
      }),
    ],
    mass: mass(45, R, {
      rangeG: [40, 55],
      note: 'the Signum fork is listed at 40 g gross; a generic utensil was weighed at 47.6 g (both verified)',
    }),
    profileNote: OWN_PROPORTIONS,
    materials: STEEL,
    geometry: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [1.55, 0, 1.55], widthMm: 14, thicknessMm: 3.1 },
        { pMm: [68, 0, 3.5], widthMm: 9.5, thicknessMm: 3.1 },
        { pMm: [104, 0, 5.5], widthMm: 6.5, thicknessMm: 3.1 },
        { pMm: [126, 0, 1.1], widthMm: 22, thicknessMm: 2.2 },
        { pMm: [131.85, 0, 1.1], widthMm: 24, thicknessMm: 2.2 },
      ],
      head: { type: 'fork_tines', count: 4, lengthMm: 52.05, widthMm: 24, thicknessMm: 2.2 },
    },
    surfaceRegions: ['handle', 'tines'],
  }),
  defineItem(FORK, {
    id: 'salad_fork_156',
    row: 43,
    name: 'Salad or cake fork',
    product: 'WMF Signum cake fork 12.1964.6040',
    standardItem: 'AHAM DW-2 salad fork',
    sources: ['items.md P13, S1'],
    itemClass: 'salad_fork',
    dimensions: [length(156, V, { rangeMm: [156, 160] })],
    mass: mass(30, R, { rangeG: [25, 35] }),
    profileNote: OWN_PROPORTIONS,
    materials: STEEL,
    geometry: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [1.35, 0, 1.35], widthMm: 12.5, thicknessMm: 2.7 },
        { pMm: [58, 0, 3], widthMm: 8.5, thicknessMm: 2.7 },
        { pMm: [88, 0, 4.5], widthMm: 6, thicknessMm: 2.7 },
        { pMm: [106, 0, 1], widthMm: 19, thicknessMm: 2 },
        { pMm: [111.15, 0, 1], widthMm: 21, thicknessMm: 2 },
      ],
      head: { type: 'fork_tines', count: 4, lengthMm: 43.85, widthMm: 21, thicknessMm: 2 },
    },
    soils: [
      soil('tines', 'porridge', 'smear'),
      soil('tines', 'jam', 'smear'),
      soil('tines', 'chocolate', 'smear'),
    ],
    surfaceRegions: ['handle', 'tines'],
  }),
  defineItem(SPOON, {
    id: 'soup_spoon_190',
    row: 44,
    name: 'Soup or table spoon',
    product: 'IKEA DRAGON spoon 19 cm',
    standardItem: 'the IEC 60436 soup spoon is the WMF Signum 12.1904.6040, also 190 mm',
    sources: ['items.md P13', 'standards.md 5.3 (S17)'],
    dimensions: [length(190, V)],
    mass: mass(55, R, { rangeG: [50, 60] }),
    profileNote: OWN_PROPORTIONS,
    materials: STEEL,
    geometry: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [1.5, 0, 1.5], widthMm: 14, thicknessMm: 3 },
        { pMm: [70, 0, 5], widthMm: 9, thicknessMm: 3 },
        { pMm: [112, 0, 9.7], widthMm: 8, thicknessMm: 3 },
        { pMm: [125.3, 0, 9.7], widthMm: 8, thicknessMm: 3 },
      ],
      head: { type: 'spoon_bowl', lengthMm: 64, widthMm: 43, depthMm: 9, thicknessMm: 1.4 },
    },
    surfaceRegions: ['handle', 'bowl', 'bowl_back'],
  }),
  defineItem(SPOON, {
    id: 'dessert_spoon_160',
    row: 45,
    name: 'Dessert spoon',
    product: 'IKEA DRAGON dessert spoon 16 cm',
    standardItem: 'the IEC 60436 dessert spoon is the WMF Signum 12.1910.6040 (156 mm)',
    sources: ['items.md P13', 'standards.md 5.3 (S17)'],
    itemClass: 'dessert_spoon',
    dimensions: [length(160, V)],
    mass: mass(40, R, { rangeG: [35, 45] }),
    profileNote: OWN_PROPORTIONS,
    materials: STEEL,
    geometry: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [1.4, 0, 1.4], widthMm: 12.5, thicknessMm: 2.8 },
        { pMm: [60, 0, 4], widthMm: 8.5, thicknessMm: 2.8 },
        { pMm: [95, 0, 8.2], widthMm: 7, thicknessMm: 2.8 },
        { pMm: [106.3, 0, 8.2], widthMm: 7, thicknessMm: 2.8 },
      ],
      head: { type: 'spoon_bowl', lengthMm: 53, widthMm: 36, depthMm: 7.5, thicknessMm: 1.4 },
    },
    surfaceRegions: ['handle', 'bowl', 'bowl_back'],
  }),
  defineItem(SPOON, {
    id: 'teaspoon_130',
    row: 46,
    name: 'Teaspoon',
    product: 'IKEA DRAGON teaspoon 13 cm',
    standardItem: 'the IEC 60436 teaspoon is the WMF Signum 12.1907.6040 (136 mm)',
    sources: ['items.md P13', 'standards.md 5.3 (S17)'],
    itemClass: 'teaspoon',
    dimensions: [length(130, V, { rangeMm: [130, 159] })],
    mass: mass(25, R, { rangeG: [20, 30] }),
    profileNote: OWN_PROPORTIONS,
    materials: STEEL,
    geometry: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [1.3, 0, 1.3], widthMm: 11, thicknessMm: 2.6 },
        { pMm: [48, 0, 3.5], widthMm: 7.5, thicknessMm: 2.6 },
        { pMm: [76, 0, 7], widthMm: 6, thicknessMm: 2.6 },
        { pMm: [86.2, 0, 7], widthMm: 6, thicknessMm: 2.6 },
      ],
      head: { type: 'spoon_bowl', lengthMm: 43.2, widthMm: 29, depthMm: 6.4, thicknessMm: 1.2 },
    },
    soils: [
      soil('bowl', 'tea_tannin', 'film'),
      soil('bowl', 'coffee', 'film'),
      soil('bowl', 'yoghurt', 'film'),
      soil('bowl', 'sugar_syrup', 'film'),
    ],
    surfaceRegions: ['handle', 'bowl', 'bowl_back'],
  }),
  defineItem(SHARP_KNIFE, {
    id: 'steak_knife_230',
    row: 47,
    name: 'Steak knife, wooden handle',
    product: 'generic steak knife',
    sources: [],
    dimensions: [length(230, R), dim('blade_length', 115, R, extentOf('blade.head*', 'x'))],
    mass: mass(75, R, { rangeG: [60, 90] }),
    profileNote:
      "Catalogue engineer's proportions: a beech handle over a full steel tang and a 22 mm blade; sizes fitted to the middle of the mass range. The dossier allows a POM or a wooden handle; wood is modelled.",
    // The blade comes first: it is most of the mass and what meets the rack.
    materials: [
      { part: 'blade*', material: 'stainless_steel' },
      { part: 'grip*', material: 'beech' },
    ],
    geometry: {
      class: 'compound',
      children: [
        {
          id: 'grip',
          def: {
            class: 'rod',
            material: 'beech',
            nodes: [
              { pMm: [6, 0, 6], widthMm: 20, thicknessMm: 12 },
              { pMm: [112, 0, 6], widthMm: 18, thicknessMm: 12 },
            ],
            head: { type: 'none' },
          },
        },
        {
          id: 'blade',
          def: {
            class: 'rod',
            material: 'stainless_steel',
            nodes: [
              { pMm: [12, 0, 6], widthMm: 14, thicknessMm: 2.9 },
              { pMm: [115, 0, 6], widthMm: 16, thicknessMm: 2.9 },
            ],
            head: { type: 'blade', lengthMm: 115, widthMm: 22, thicknessMm: 2.2 },
          },
        },
      ],
      regionRenames: [rename('*.handle', 'handle'), rename('blade.blade', 'blade')],
    },
    surfaceRegions: ['handle', 'blade'],
  }),
  defineItem(CHOPSTICK, {
    id: 'chopstick_bamboo',
    row: 48,
    name: 'Chopstick, bamboo (one of a pair)',
    product: 'generic bamboo chopstick',
    sources: [],
    dimensions: [
      length(240, R, { rangeMm: [230, 240] }),
      dim('grip_size', 7, R, ALONG_Y, { note: '7 mm at the grip tapering to about 3 at the tip' }),
    ],
    mass: mass(6, E),
    profileNote:
      'Round 7 mm grip tapering to 3.5 mm; the dossier describes a square grip, which the rod class makes round.',
    materials: [{ part: '*', material: 'bamboo' }],
    geometry: chopstick('bamboo'),
    flags: { floats: true },
    surfaceRegions: CHOPSTICK_REGIONS,
  }),
  defineItem(CHOPSTICK, {
    id: 'chopstick_melamine',
    row: 48,
    name: 'Chopstick, melamine (one of a pair)',
    product: 'generic melamine chopstick',
    sources: [],
    dimensions: [
      length(240, R, { rangeMm: [230, 240] }),
      dim('grip_size', 7, R, ALONG_Y, { note: '7 mm at the grip tapering to about 3 at the tip' }),
    ],
    mass: mass(13, E),
    profileNote:
      'Round 7 mm grip tapering to 3.5 mm; the dossier describes a square grip, which the rod class makes round.',
    materials: [{ part: '*', material: 'melamine' }],
    geometry: chopstick('melamine'),
    behaviour: 'Jet-mobile; sinks, unlike a wooden chopstick; falls through rack',
    surfaceRegions: CHOPSTICK_REGIONS,
  }),
  defineItem(SPOON, {
    id: 'serving_spoon_216',
    row: 49,
    name: 'Serving spoon',
    product: 'Bon Chef 8.5 in table or serving spoon',
    standardItem: 'the IEC 60436 serving spoon is the WMF 12.8386.6041 (260 mm; standards.md 5.3)',
    sources: ['items.md P13', 'standards.md 5.3 (S17)'],
    itemClass: 'serving_spoon',
    zones: ['cutlery_basket', 'third_rack', 'upper_rack'],
    dimensions: [length(216, V)],
    mass: mass(75, E),
    profileNote: OWN_PROPORTIONS,
    materials: STEEL,
    geometry: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [1.5, 0, 1.5], widthMm: 16, thicknessMm: 3 },
        { pMm: [80, 0, 6], widthMm: 10, thicknessMm: 3 },
        { pMm: [128, 0, 11.8], widthMm: 9, thicknessMm: 3 },
        { pMm: [142.7, 0, 11.8], widthMm: 9, thicknessMm: 3 },
      ],
      head: { type: 'spoon_bowl', lengthMm: 72.5, widthMm: 48, depthMm: 11, thicknessMm: 1.6 },
    },
    soils: [
      soil('bowl', 'mashed_potato', 'patch'),
      soil('bowl', 'gravy', 'film'),
      soil('bowl', 'rice_starch', 'film'),
      soil('bowl_back', 'gravy', 'film'),
    ],
    surfaceRegions: ['handle', 'bowl', 'bowl_back'],
  }),
  defineItem(FORK, {
    id: 'serving_fork_210',
    row: 50,
    name: 'Serving fork',
    product: 'WMF Signum table fork 12.1902.6040 (8.25 in)',
    standardItem: 'AHAM DW-2 serving cold meat fork',
    sources: ['items.md P13, S1', 'standards.md 5.3 (S17)'],
    itemClass: 'serving_fork',
    zones: ['cutlery_basket', 'third_rack', 'upper_rack'],
    dimensions: [length(210, V)],
    mass: mass(55, E, { grossG: 59, note: '59 g shipping weight (verified)' }),
    profileNote: OWN_PROPORTIONS,
    materials: STEEL,
    geometry: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [1.5, 0, 1.5], widthMm: 16, thicknessMm: 3 },
        { pMm: [78, 0, 4], widthMm: 10, thicknessMm: 3 },
        { pMm: [118, 0, 6], widthMm: 7, thicknessMm: 3 },
        { pMm: [142, 0, 1.15], widthMm: 24, thicknessMm: 2.3 },
        { pMm: [148, 0, 1.15], widthMm: 26, thicknessMm: 2.3 },
      ],
      head: { type: 'fork_tines', count: 4, lengthMm: 60.85, widthMm: 26, thicknessMm: 2.3 },
    },
    soils: [
      soil('tines', 'minced_meat', 'smear'),
      soil('tines', 'lard_tallow', 'film'),
      soil('tines', 'gravy', 'film'),
    ],
    surfaceRegions: ['handle', 'tines'],
  }),
  defineItem(SHARP_KNIFE, {
    id: 'chefs_knife_200',
    row: 51,
    name: "Chef's knife, 8 in",
    product: "Victorinox Fibrox Pro 8 in chef's knife",
    sources: ['items.md P14'],
    itemClass: 'chefs_knife',
    zones: ['third_rack', 'upper_rack'],
    dimensions: [
      length(335, V),
      dim('blade_length', 200, V, extentOf('blade.head*', 'x')),
      dim('blade_width', 50, V, extentOf('blade.head*', 'y'), { rangeMm: [48, 53] }),
    ],
    mass: mass(175, V, { rangeG: [165, 184] }),
    profileNote:
      "Catalogue engineer's proportions: an elastomer handle over a steel tang and a 2.5 mm blade whose spine is offset towards the top of the handle; sizes fitted to the middle of the mass range.",
    // The blade comes first: it is most of the mass and what meets the rack.
    materials: [
      { part: 'blade*', material: 'stainless_steel' },
      { part: 'grip*', material: 'tpe' },
    ],
    geometry: {
      class: 'compound',
      children: [
        {
          id: 'grip',
          def: {
            class: 'rod',
            material: 'tpe',
            nodes: [
              { pMm: [9, 0, 9], widthMm: 32, thicknessMm: 18 },
              { pMm: [126, 0, 9], widthMm: 28, thicknessMm: 18 },
            ],
            head: { type: 'none' },
          },
        },
        {
          id: 'blade',
          positionMm: [0, -8, 0],
          def: {
            class: 'rod',
            material: 'stainless_steel',
            nodes: [
              { pMm: [60, 0, 9], widthMm: 8, thicknessMm: 2.5 },
              { pMm: [135, 0, 9], widthMm: 12, thicknessMm: 2.5 },
            ],
            head: { type: 'blade', lengthMm: 200, widthMm: 50, thicknessMm: 2.35 },
          },
        },
      ],
      regionRenames: [rename('*.handle', 'handle'), rename('blade.blade', 'blade')],
    },
    surfaceRegions: ['handle', 'blade'],
    poses: [
      pose('flat', [0, 0, 0], false, 'lying flat, blade level'),
      pose(
        'resting',
        [3.565, 2.509, -0.241],
        true,
        'as it lies on a table: rolled 3.6 degrees and tipped 2.5 degrees onto its blade (solved for this geometry)',
      ),
      FLAT_INVERTED,
      HANDLE_UP,
      ON_EDGE,
    ],
    recommendedPose: 'flat',
  }),
];
