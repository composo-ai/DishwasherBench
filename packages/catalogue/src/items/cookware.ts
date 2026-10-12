/**
 * Cookware: saucepans, stockpot, frying pans, skillets and pan lids (rows 68 to 77 of the
 * starter catalogue, docs/research/items.md section 10.1, with the profiles of its section 10.2).
 *
 * Pans are shells of revolution with a straight bar handle along +x. The dossier's profiles are
 * mid-surface polylines that reach the product's outer radius; here the vertices are pulled in
 * by half a wall thickness where a stated diameter applies, and the wall thickness is fitted so
 * that the geometry kernel reproduces the stated mass with the handle in place. Pot and pan
 * bodies carry the three surfaces a test standard scores separately (inner bottom, inner wall,
 * outside). Authoring units: millimetres, grams.
 */

import type { SorProfilePointMm } from '@spotless/geometry';
import type { ItemType } from '../types.ts';
import {
  ALONG_X,
  ALONG_Y,
  AT_BASE,
  AT_RIM,
  defineItem,
  diameter,
  dim,
  E,
  extentOf,
  height,
  INNER_DEPTH,
  INVERTED,
  INVERTED_SUPPORTED,
  INVERTED_TILTED,
  mass,
  ON_EDGE,
  pose,
  potBodyRegions,
  R,
  soil,
  UPRIGHT,
  V,
  type Family,
} from './builders.ts';

/** On edge with the handle pointing up. */
const ON_EDGE_HANDLE_UP = pose(
  'on_edge_handle_up',
  [90, 0, 90],
  false,
  'standing on its rim with the handle pointing up, inside towards the front',
);

const HANDLE_REGION = { id: 'handle', part: 'handle*' } as const;

const SAUCEPAN: Family = {
  category: 'cookware',
  itemClass: 'saucepan',
  shapeTag: 'pot',
  zones: ['lower_rack'],
  poses: [UPRIGHT, INVERTED_SUPPORTED, INVERTED_TILTED, ON_EDGE],
  recommendedPose: 'inverted_tilted',
  usual: 'Lower rack, inverted and tilted',
  behaviour: 'Tall; baked-on soil; blocks upper arm if upright',
  soils: [
    soil('interior_base', 'milk_burnt', 'crust'),
    soil('interior_base', 'pasta_starch', 'crust'),
    soil('interior_base', 'rice_starch', 'crust'),
    soil('interior_wall', 'tomato_sauce', 'ring'),
    soil('interior_wall', 'pasta_starch', 'film'),
    soil('interior_wall', 'porridge', 'ring'),
  ],
  flags: {
    dishwasherSafe: true,
    topRackOnly: false,
    fragile: false,
    floats: false,
    concave: true,
  },
};

const FRYING_PAN: Family = {
  category: 'cookware',
  itemClass: 'frying_pan',
  shapeTag: 'pan',
  zones: ['lower_rack'],
  poses: [UPRIGHT, INVERTED_SUPPORTED, ON_EDGE, ON_EDGE_HANDLE_UP],
  recommendedPose: 'on_edge',
  usual: 'Lower rack on edge or inverted',
  behaviour: 'Handle-heavy; cast iron and non-stick are "not recommended" items',
  soils: [
    soil('interior_base', 'egg_cooked', 'patch'),
    soil('interior_base', 'fat_polymerised', 'film'),
    soil('interior_base', 'burnt_carbonised', 'crust'),
    soil('interior_base', 'lard_tallow', 'film'),
    soil('interior_wall', 'fat_polymerised', 'splatter'),
    soil('exterior', 'fat_polymerised', 'drips'),
  ],
  flags: {
    dishwasherSafe: true,
    topRackOnly: false,
    fragile: false,
    floats: false,
    concave: true,
  },
};

const PAN_LID: Family = {
  category: 'cookware',
  itemClass: 'pan_lid',
  shapeTag: 'lid',
  zones: ['lower_rack'],
  poses: [
    UPRIGHT,
    pose('inverted', [180, 0, 0], false, 'upside down, resting on its knob'),
    ON_EDGE,
  ],
  recommendedPose: 'on_edge',
  usual: 'Lower rack on edge (pan lids); upper rack wedged (container lids)',
  behaviour: 'Container lids are the most jet-mobile common item',
  soils: [
    soil('underside', 'lard_tallow', 'film'),
    soil('underside', 'tomato_sauce', 'splatter'),
    soil('underside', 'vegetable_oil', 'film'),
  ],
  flags: {
    dishwasherSafe: true,
    topRackOnly: false,
    fragile: false,
    floats: false,
    concave: true,
  },
};

/** Regions of a domed lid: its profile runs outward and down, so the 'in' side is the top. */
const LID_REGIONS = [
  { id: 'top', part: 'body', side: 'in' },
  { id: 'underside', part: 'body', side: 'out' },
  { id: 'knob', part: 'knob' },
] as const;

const LID_LABELS = [
  { id: 'top', label: 'top', foodContact: false },
  { id: 'underside', label: 'underside', foodContact: true },
  { id: 'knob', label: 'knob', foodContact: false },
] as const;

const POT_SURFACES = ['interior_base', 'interior_wall', 'exterior', 'handle'] as const;

const FITTED =
  'Profile of items.md 10.2 with its vertices pulled in to the stated diameters; wall fitted to the mass with the handle in place.';

// Profiles are named so that the base corner used for the surface regions is in one place.
const SAUCEPAN_CLAD: readonly SorProfilePointMm[] = [
  [0, 0.99, 1.98],
  [72.01, 0.99, 1.98],
  [78.5, 8, 1.98],
  [78.51, 109.01, 1.98],
];
const SAUCEPAN_LIGHT: readonly SorProfilePointMm[] = [
  [0, 0.35, 0.69],
  [78, 0.35, 0.69],
  [84.65, 7, 0.69],
  [84.65, 99.65, 0.69],
];
const FRY_PAN_CLAD: readonly SorProfilePointMm[] = [
  [0, 1.15, 2.31],
  [93.85, 1.15, 2.31],
  [112, 15, 2.31],
  [125.85, 52.45, 2.31],
];
const FRY_PAN_NONSTICK: readonly SorProfilePointMm[] = [
  [0, 1.76, 3.52],
  [105.04, 1.76, 3.52],
  [125, 20, 2.94],
  [138.53, 43.53, 2.94],
];
const SKILLET_STEEL: readonly SorProfilePointMm[] = [
  [0, 0.71, 1.42],
  [100.19, 0.71, 1.42],
  [118, 14, 1.42],
  [134.29, 49.29, 1.42],
];
const SKILLET_IRON_260: readonly SorProfilePointMm[] = [
  [0, 1.82, 3.65],
  [108.18, 1.82, 3.65],
  [113, 6, 3.83],
  [128.18, 49.18, 3.65],
];
const SKILLET_IRON_305: readonly SorProfilePointMm[] = [
  [0, 1.99, 3.99],
  [128.11, 1.99, 3.99],
  [133, 6, 4.18],
  [157.51, 55.01, 3.99],
];
const STOCKPOT: readonly SorProfilePointMm[] = [
  [0, 4.9, 0.6],
  [118.1, 4.9, 0.6],
  [129.6, 12, 0.6],
  [129.7, 194.7, 0.6],
];

/** Saucepans, stockpot, frying pans, skillets and pan lids. */
export const COOKWARE: readonly ItemType[] = [
  defineItem(SAUCEPAN, {
    id: 'saucepan_clad_2qt',
    row: 68,
    name: 'Saucepan, tri-ply clad, 2 qt',
    product: 'All-Clad D3 saucepan 2 qt',
    sources: ['items.md P18'],
    dimensions: [
      dim('top_diameter', 159, V, AT_RIM),
      dim('depth', 108, V, INNER_DEPTH),
      dim('overall_length', 318, V, ALONG_X),
    ],
    mass: mass(907, V, { grossG: 1360, note: '1360 g with its lid (verified)' }),
    profileNote:
      'Straight-sided body of the stated diameter and depth with a cast stainless handle; wall fitted to the mass (items.md 2.5: the nominal 2.6 mm is too thick for this pan, nearer 1.8).',
    materials: [
      { part: 'handle*', material: 'stainless_steel' },
      { part: '*', material: 'stainless_clad' },
    ],
    geometry: {
      class: 'sor',
      material: 'stainless_clad',
      profileMm: SAUCEPAN_CLAD,
      addons: [
        {
          type: 'handle_bar',
          attachZMm: 88,
          lengthMm: 161.5,
          sectionMm: [18, 5.5],
          elevationDeg: 15,
          material: 'stainless_steel',
        },
      ],
      regions: [...potBodyRegions(SAUCEPAN_CLAD, 2), HANDLE_REGION],
    },
    surfaceRegions: POT_SURFACES,
  }),
  defineItem(SAUCEPAN, {
    id: 'saucepan_steel_170',
    row: 69,
    name: 'Saucepan, light stainless steel, 17 cm',
    product: 'generic steel cooking pot with handle (Matheus and Dollar 2010 sample)',
    standardItem: 'IEC 60436 Ed. 4 has stainless pots (WMF, 160 mm; standards.md 5.3)',
    sources: ['items.md S8'],
    dimensions: [
      diameter(170, V),
      dim('height', 100, V, extentOf('body', 'z'), { note: 'height of the pot body' }),
      dim('overall_length', 320, E, ALONG_X, { note: 'handle length assumed; not listed' }),
    ],
    mass: mass(504, V),
    profileNote:
      'Thin single-wall body of the stated size with a steel strap handle; wall fitted to the mass.',
    materials: [{ part: '*', material: 'stainless_steel' }],
    geometry: {
      class: 'sor',
      material: 'stainless_steel',
      profileMm: SAUCEPAN_LIGHT,
      addons: [
        {
          type: 'handle_bar',
          attachZMm: 82,
          lengthMm: 150.5,
          sectionMm: [22, 4],
          elevationDeg: 10,
        },
      ],
      regions: [...potBodyRegions(SAUCEPAN_LIGHT, 2), HANDLE_REGION],
    },
    surfaceRegions: POT_SURFACES,
  }),
  defineItem(FRYING_PAN, {
    id: 'frying_pan_clad_254',
    row: 70,
    name: 'Frying pan, tri-ply clad, 10 in',
    product: 'All-Clad D3 fry pan 10 in',
    sources: ['items.md P18'],
    dimensions: [
      dim('top_diameter', 254, V, AT_RIM),
      dim('base_diameter', 190, V, AT_BASE),
      dim('depth', 51, V, INNER_DEPTH),
      dim('overall_length', 470, V, ALONG_X),
    ],
    mass: mass(1190, V),
    profileNote: `${FITTED} The cast stainless handle is sized towards the dossier's 250 g.`,
    materials: [
      { part: 'handle*', material: 'stainless_steel' },
      { part: '*', material: 'stainless_clad' },
    ],
    geometry: {
      class: 'sor',
      material: 'stainless_clad',
      profileMm: FRY_PAN_CLAD,
      addons: [
        {
          type: 'handle_bar',
          attachZMm: 42,
          lengthMm: 230.3,
          sectionMm: [22, 6.5],
          elevationDeg: 20,
          material: 'stainless_steel',
        },
      ],
      regions: [...potBodyRegions(FRY_PAN_CLAD, 1), HANDLE_REGION],
    },
    surfaceRegions: POT_SURFACES,
  }),
  defineItem(FRYING_PAN, {
    id: 'frying_pan_nonstick_280',
    row: 71,
    name: 'Frying pan, non-stick aluminium, 28 cm',
    product: 'Nisbets Essentials aluminium non-stick frying pan 28 cm',
    sources: ['items.md P18'],
    dimensions: [
      diameter(280, V),
      dim('height', 45, V, extentOf('body', 'z'), { note: 'height of the pan body' }),
      dim('overall_length', 465, E, ALONG_X, { note: 'handle length assumed; not listed' }),
    ],
    mass: mass(900, V),
    profileNote: `${FITTED} The riveted steel handle is sized towards the dossier's 220 g.`,
    notes:
      'The whole body carries the non-stick material, outside and underside too, where a real pan is bare or enamelled aluminium: a part has one contact material and one surface material. The coating friction (0.14 on stone, as the dossier lists for the pan) therefore also applies where the pan stands on a rack; the outside of the pan wants its own surface material once regions can carry one.',
    materials: [
      { part: 'handle*', material: 'stainless_steel' },
      { part: '*', material: 'aluminium_nonstick' },
    ],
    geometry: {
      class: 'sor',
      material: 'aluminium_nonstick',
      profileMm: FRY_PAN_NONSTICK,
      addons: [
        {
          type: 'handle_bar',
          attachZMm: 34,
          lengthMm: 194.1,
          sectionMm: [26, 5.5],
          elevationDeg: 15,
          material: 'stainless_steel',
        },
      ],
      regions: [...potBodyRegions(FRY_PAN_NONSTICK, 1), HANDLE_REGION],
    },
    flags: { dishwasherSafe: false },
    surfaceRegions: POT_SURFACES,
  }),
  defineItem(FRYING_PAN, {
    id: 'skillet_steel_270',
    row: 72,
    name: 'Skillet, steel, 27 cm',
    product: 'generic metal skillet (Matheus and Dollar 2010 sample)',
    sources: ['items.md S8'],
    dimensions: [
      diameter(270, V),
      dim('height', 50, V, extentOf('body', 'z'), { note: 'height of the pan body' }),
      dim('overall_length', 460, E, ALONG_X, { note: 'handle length assumed; not listed' }),
    ],
    mass: mass(988, V),
    profileNote:
      'The dossier leaves the metal open (steel or aluminium); a carbon-steel pan with a strap handle is modelled, its wall fitted to the mass.',
    materials: [{ part: '*', material: 'carbon_steel' }],
    geometry: {
      class: 'sor',
      material: 'carbon_steel',
      profileMm: SKILLET_STEEL,
      addons: [
        { type: 'handle_bar', attachZMm: 36, lengthMm: 214, sectionMm: [24, 3], elevationDeg: 25 },
      ],
      regions: [...potBodyRegions(SKILLET_STEEL, 1), HANDLE_REGION],
    },
    surfaceRegions: POT_SURFACES,
  }),
  defineItem(FRYING_PAN, {
    id: 'skillet_cast_iron_260',
    row: 73,
    name: 'Skillet, cast iron, 10.25 in',
    product: 'Lodge L8SK3 skillet 10.25 in',
    sources: ['items.md P19'],
    dimensions: [
      diameter(260, V),
      dim('overall_length', 409, V, ALONG_X),
      dim('height', 51, V, extentOf('body', 'z'), { note: 'height of the pan body' }),
    ],
    mass: mass(2427, V),
    profileNote: `${FITTED} The handle is sized towards the dossier's 330 g; a short helper lip is added opposite it.`,
    materials: [{ part: '*', material: 'cast_iron_seasoned' }],
    geometry: {
      class: 'sor',
      material: 'cast_iron_seasoned',
      profileMm: SKILLET_IRON_260,
      addons: [
        {
          type: 'handle_bar',
          attachZMm: 38,
          lengthMm: 138.5,
          sectionMm: [30, 11],
          elevationDeg: 12,
        },
        { type: 'handle_bar', attachZMm: 42, lengthMm: 10, sectionMm: [70, 8], azimuthDeg: 180 },
      ],
      regions: [...potBodyRegions(SKILLET_IRON_260, 1), HANDLE_REGION],
    },
    flags: { dishwasherSafe: false },
    surfaceRegions: POT_SURFACES,
  }),
  defineItem(FRYING_PAN, {
    id: 'skillet_cast_iron_305',
    row: 74,
    name: 'Skillet, cast iron, 12 in',
    product: 'Lodge L10SK3 skillet 12 in',
    sources: ['items.md P19'],
    dimensions: [
      dim('width', 319, V, ALONG_Y, {
        note: 'the listed width includes the pouring lips; a round pan of that diameter is modelled',
      }),
      dim('length', 457, V, ALONG_X),
      dim('height', 57, V, extentOf('body', 'z'), { note: 'height of the pan body' }),
    ],
    mass: mass(3580, V, { note: 'another retailer lists 3320 g' }),
    profileNote: `${FITTED} The handle and helper lip are sized towards the dossier's 500 g.`,
    materials: [{ part: '*', material: 'cast_iron_seasoned' }],
    geometry: {
      class: 'sor',
      material: 'cast_iron_seasoned',
      profileMm: SKILLET_IRON_305,
      addons: [
        {
          type: 'handle_bar',
          attachZMm: 42,
          lengthMm: 130.7,
          sectionMm: [32, 12],
          elevationDeg: 12,
        },
        { type: 'handle_bar', attachZMm: 46, lengthMm: 10, sectionMm: [80, 9], azimuthDeg: 180 },
      ],
      regions: [...potBodyRegions(SKILLET_IRON_305, 1), HANDLE_REGION],
    },
    flags: { dishwasherSafe: false },
    surfaceRegions: POT_SURFACES,
  }),
  defineItem(SAUCEPAN, {
    id: 'stockpot_steel_8qt',
    row: 75,
    name: 'Stockpot, stainless steel, 8 qt',
    product: "Cuisinart Chef's Classic stockpot 766-24, 8 qt",
    sources: ['items.md P20'],
    itemClass: 'stockpot',
    dimensions: [diameter(260, V), height(195, V)],
    mass: mass(1780, E, {
      grossG: 2180,
      note: '2180 g with its lid (verified), less an assumed 400 g lid; the items.md 10.2 model of the pot is 1964 g at a smaller diameter',
    }),
    profileNote:
      'Thin single-wall body of the stated size on an encapsulated disc base (4 mm aluminium in 0.6 mm steel, items.md 10.2), with two side handles; wall fitted to the mass.',
    materials: [
      { part: 'base', material: 'stainless_encapsulated_base' },
      { part: '*', material: 'stainless_steel' },
    ],
    geometry: {
      class: 'sor',
      material: 'stainless_steel',
      profileMm: STOCKPOT,
      addons: [
        {
          type: 'base_disc',
          radiusMm: 110,
          thicknessMm: 4.8,
          material: 'stainless_encapsulated_base',
        },
        { type: 'handle_bar', attachZMm: 165, lengthMm: 24, sectionMm: [70, 7] },
        { type: 'handle_bar', attachZMm: 165, lengthMm: 24, sectionMm: [70, 7], azimuthDeg: 180 },
      ],
      regions: [...potBodyRegions(STOCKPOT, 2), { id: 'base', part: 'base' }, HANDLE_REGION],
    },
    poses: [UPRIGHT, INVERTED, INVERTED_TILTED, ON_EDGE],
    surfaceRegions: ['interior_base', 'interior_wall', 'exterior', 'base', 'handle'],
  }),
  defineItem(PAN_LID, {
    id: 'lid_glass_240',
    row: 76,
    name: 'Pan lid, glass, 24 cm',
    product: 'generic tempered-glass lid with a steel rim and knob',
    sources: [],
    dimensions: [diameter(240, R), dim('dome_height', 25, R, extentOf('body', 'z'))],
    mass: mass(600, E),
    profileNote:
      'Dome profile of items.md 10.2; the steel rim and knob (150 g in the dossier) are modelled as a steel knob; wall fitted to the mass.',
    materials: [
      { part: 'knob', material: 'stainless_steel' },
      { part: '*', material: 'glass_soda_lime' },
    ],
    geometry: {
      class: 'sor',
      material: 'glass_soda_lime',
      profileMm: [
        [0, 22.9, 4.2],
        [60, 19, 4.2],
        [110, 6, 4.2],
        [117.9, 2.1, 4.2],
      ],
      addons: [{ type: 'knob', zMm: 24, radiusMm: 17, heightMm: 20, material: 'stainless_steel' }],
      regions: LID_REGIONS,
    },
    poses: [
      UPRIGHT,
      pose('inverted', [180, 0, 0], true, 'upside down, standing on its flat knob'),
      ON_EDGE,
    ],
    flags: { fragile: true },
    surfaceRegions: LID_LABELS,
  }),
  defineItem(PAN_LID, {
    id: 'lid_steel_165',
    row: 77,
    name: 'Pan lid, stainless steel, 16.5 cm',
    product: 'All-Clad D3 2 qt saucepan lid',
    sources: ['items.md P18'],
    dimensions: [diameter(165, E)],
    mass: mass(450, V, {
      note: 'the difference of the listed weights of the saucepan with and without lid, which are rounded to the pound',
    }),
    profileNote:
      'Shallow steel dome with a solid loop handle; the wall is held at 2 mm, the thickest plausible, which leaves the lid below the derived mass.',
    materials: [{ part: '*', material: 'stainless_steel' }],
    geometry: {
      class: 'sor',
      material: 'stainless_steel',
      profileMm: [
        [0, 14, 2],
        [45, 12, 2],
        [76, 5, 2],
        [81.5, 1, 2],
      ],
      addons: [{ type: 'knob', zMm: 14.5, radiusMm: 11, heightMm: 32 }],
      regions: LID_REGIONS,
    },
    surfaceRegions: LID_LABELS,
  }),
];
