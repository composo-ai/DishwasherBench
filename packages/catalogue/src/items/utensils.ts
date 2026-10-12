/**
 * Long tools and preparation ware: ladle, turners and spatulas, whisk, tongs, wooden spoon,
 * peeler, grater, colander, sieve, chopping boards and mixing bowls (rows 52 to 67 and 98 of the
 * starter catalogue, docs/research/items.md section 10.1).
 *
 * The dossier gives overall sizes and masses for these tools but no cross-sections, so their
 * proportions are the catalogue's own [ESTIMATED], fitted to the stated mass. Tools are authored
 * as they lie on a table, handle end at x = 0 and working end towards +x. The mixing-bowl and
 * colander profiles are those of items.md section 10.2 with the rim pulled in to the stated
 * diameter and the wall fitted to the mass. Authoring units: millimetres, grams.
 */

import type { Vec3 } from '@spotless/core';
import type { CompoundDefMm, WirePolylineMm } from '@spotless/geometry';
import type { ItemType } from '../types.ts';
import {
  ALONG_X,
  ALONG_Y,
  ALONG_Z,
  defineItem,
  diameter,
  dim,
  E,
  extentOf,
  FLAT,
  FLAT_INVERTED,
  FLAT_INVERTED_STEADY,
  HANDLE_DOWN,
  HANDLE_UP,
  height,
  INCLINED,
  INVERTED,
  length,
  mass,
  ON_EDGE,
  ON_LONG_EDGE,
  ON_SHORT_EDGE,
  pose,
  R,
  rename,
  soil,
  UPRIGHT,
  V,
  type Family,
} from './builders.ts';

const OWN_PROPORTIONS =
  "Overall size from the dossier; cross-sections are the catalogue engineer's, fitted to the mass.";

const TOOL_USUAL = 'Upper rack lying flat, or third rack';
const TOOL_BEHAVIOUR =
  'Lying flat they shadow items below; whisk and grater have self-shadowing geometry; wooden spoon floats and is not dishwasher-safe';

const LONG_TOOL: Family = {
  category: 'utensil',
  itemClass: 'turner',
  shapeTag: 'utensil',
  zones: ['upper_rack', 'third_rack'],
  poses: [FLAT, FLAT_INVERTED, HANDLE_DOWN, HANDLE_UP],
  recommendedPose: 'flat_inverted',
  usual: TOOL_USUAL,
  behaviour: TOOL_BEHAVIOUR,
  soils: [
    soil('blade', 'egg_cooked', 'smear'),
    soil('blade', 'lard_tallow', 'film'),
    soil('blade', 'tomato_sauce', 'smear'),
    soil('head', 'dough_batter', 'smear'),
    soil('head', 'butter_margarine', 'film'),
    soil('head', 'chocolate', 'smear'),
    soil('bowl', 'gravy', 'film'),
    soil('bowl', 'tomato_sauce', 'smear'),
    soil('bowl', 'porridge', 'smear'),
    soil('bowl_back', 'tomato_sauce', 'smear'),
    soil('wires', 'dough_batter', 'smear'),
    soil('wires', 'egg_white', 'film'),
    soil('grating', 'cheese_melted', 'smear'),
    soil('grating', 'spinach_particles', 'specks'),
    soil('inside', 'cheese_melted', 'smear'),
  ],
  flags: {
    dishwasherSafe: true,
    topRackOnly: false,
    fragile: false,
    floats: false,
    concave: false,
  },
};

const BOARD: Family = {
  category: 'prep',
  itemClass: 'chopping_board',
  shapeTag: 'board',
  zones: ['lower_rack'],
  poses: [FLAT, FLAT_INVERTED_STEADY, ON_LONG_EDGE, ON_SHORT_EDGE],
  recommendedPose: 'on_long_edge',
  usual: 'Lower rack outer rows on edge',
  behaviour: 'Large flat shadow; can block detergent door; wood board not dishwasher-safe',
  soils: [
    soil('top', 'minced_meat', 'smear'),
    soil('top', 'tomato_sauce', 'smear'),
    soil('top', 'lard_tallow', 'film'),
    soil('top', 'spinach_particles', 'specks'),
  ],
  flags: {
    dishwasherSafe: true,
    topRackOnly: false,
    fragile: false,
    floats: true,
    concave: false,
  },
};

const MIXING_BOWL: Family = {
  category: 'prep',
  itemClass: 'mixing_bowl',
  shapeTag: 'bowl',
  zones: ['lower_rack'],
  poses: [UPRIGHT, INVERTED, INCLINED, ON_EDGE],
  recommendedPose: 'inclined',
  usual: 'Lower rack, steeply inclined, opening toward the arm',
  behaviour: 'Big shadow; PP bowl is light for its size (jet mobility about 0.1 to 0.2)',
  soils: [
    soil('interior', 'dough_batter', 'smear'),
    soil('interior', 'vegetable_oil', 'film'),
    soil('interior', 'mayonnaise', 'smear'),
    soil('interior', 'egg_white', 'film'),
    soil('rim', 'dough_batter', 'drips'),
  ],
  flags: {
    dishwasherSafe: true,
    topRackOnly: false,
    fragile: false,
    floats: false,
    concave: true,
  },
};

const STRAINER: Family = {
  category: 'prep',
  itemClass: 'colander',
  shapeTag: 'bowl',
  zones: ['lower_rack'],
  poses: [UPRIGHT, INVERTED, INCLINED, ON_EDGE],
  recommendedPose: 'on_edge',
  usual: 'Lower rack on edge or inverted',
  behaviour: 'Porous to jets; mesh traps redeposited soil',
  soils: [
    soil('interior', 'pasta_starch', 'film'),
    soil('interior', 'rice_grains', 'specks'),
    soil('interior', 'spinach_particles', 'specks'),
    soil('mesh', 'pasta_starch', 'film'),
    soil('mesh', 'rice_grains', 'specks'),
    soil('mesh', 'seeds', 'specks'),
  ],
  flags: {
    dishwasherSafe: true,
    topRackOnly: false,
    fragile: false,
    floats: false,
    concave: true,
  },
};

// ---------------------------------------------------------------------------------------------
// Balloon whisk: a handle and five wire loops, lying on a table.
// ---------------------------------------------------------------------------------------------

/** Radius of the whisk handle, mm. */
const WHISK_HANDLE_RADIUS = 14;
/** Radius of a whisk wire, mm. */
const WHISK_WIRE_RADIUS = 0.85;
/** Number of wire loops. */
const WHISK_LOOPS = 5;
/** Loop outline: distance along the whisk axis and distance from the axis, mm. */
const WHISK_OUTLINE: readonly (readonly [along: number, out: number])[] = [
  [118, 6],
  [165, 24],
  [215, 32.65],
  [255, 29],
  [280.5, 17],
  [292.3, 0],
];

/**
 * The whisk in the pose in which it lies on a table: resting on the end of its handle and on
 * its two lowest wires, its axis tilted up towards the balloon by the angle that makes both
 * touch z = 0. Points are given along the axis and across it and placed by that tilt.
 */
function whiskGeometry(): CompoundDefMm {
  const half = Math.PI / WHISK_LOOPS / 2; // plane angle of the lowest loops from the vertical
  const widest = WHISK_OUTLINE[2] as readonly [number, number];
  // Lowest point of the balloon below the axis, and of the handle end below it.
  const drop = widest[1] * Math.cos(half) + WHISK_WIRE_RADIUS;
  // Tilt a: (u - u0) sin a - drop cos a + r = 0, with u0 the centre of the handle-end sphere.
  const u0 = WHISK_HANDLE_RADIUS;
  const span = widest[0] - u0;
  const tilt = Math.atan2(drop, span) - Math.asin(WHISK_HANDLE_RADIUS / Math.hypot(span, drop));
  const sin = Math.sin(tilt);
  const cos = Math.cos(tilt);
  const z0 = WHISK_HANDLE_RADIUS - u0 * sin;
  /** A point `along` the axis, `up` and `side` across it, in the item frame. */
  const at = (along: number, up: number, side: number): Vec3 => [
    along * cos - up * sin,
    side,
    z0 + along * sin + up * cos,
  ];
  const wires: WirePolylineMm[] = [];
  for (let k = 0; k < WHISK_LOOPS; k++) {
    const phi = half + (k * Math.PI) / WHISK_LOOPS;
    const points: Vec3[] = [];
    for (const [along, out] of WHISK_OUTLINE) {
      points.push(at(along, out * Math.cos(phi), out * Math.sin(phi)));
    }
    for (let i = WHISK_OUTLINE.length - 2; i >= 0; i--) {
      const [along, out] = WHISK_OUTLINE[i] as readonly [number, number];
      points.push(at(along, -out * Math.cos(phi), -out * Math.sin(phi)));
    }
    wires.push({ pointsMm: points, radiusMm: WHISK_WIRE_RADIUS });
  }
  return {
    class: 'compound',
    children: [
      {
        id: 'grip',
        def: {
          class: 'wire',
          material: 'tpe',
          wires: [{ pointsMm: [at(u0, 0, 0), at(122, 0, 0)], radiusMm: WHISK_HANDLE_RADIUS }],
        },
      },
      { id: 'wires', def: { class: 'wire', material: 'stainless_steel', wires } },
    ],
  };
}

/** Long tools, colander, sieve, boards and mixing bowls. */
export const UTENSILS: readonly ItemType[] = [
  defineItem(LONG_TOOL, {
    id: 'ladle_steel_311',
    row: 52,
    name: 'Ladle, stainless steel, 6 oz',
    product: 'OXO Good Grips one-piece stainless steel ladle, 6 oz',
    sources: ['items.md P15'],
    itemClass: 'ladle',
    dimensions: [
      length(311, V, { note: 'measured here with the ladle lying on its handle' }),
      dim('bowl_diameter', 108, V, extentOf('head', 'y')),
    ],
    mass: mass(180, V),
    profileNote:
      'Flat strap handle and a spherical-cap bowl of 6 oz set at 41 degrees to it, so that the ladle lies on its handle with the back of the bowl just clear of the table; sizes fitted to the mass.',
    materials: [{ part: '*', material: 'stainless_steel' }],
    geometry: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [1.25, 0, 1.25], widthMm: 20, thicknessMm: 2.5 },
        { pMm: [221.1, 0, 1.25], widthMm: 14, thicknessMm: 2.5 },
        { pMm: [227.14, 0, 6.5], widthMm: 14, thicknessMm: 2.5 },
      ],
      head: { type: 'spoon_bowl', lengthMm: 107, widthMm: 107, depthMm: 35, thicknessMm: 1.02 },
    },
    poses: [
      pose('flat', [0, 0, 0], true, 'lying on its handle, bowl opening up and back'),
      pose('bowl_down', [180, 0, 0], false, 'lying with the bowl opening down'),
      HANDLE_DOWN,
      HANDLE_UP,
    ],
    recommendedPose: 'bowl_down',
    flags: { concave: true },
    surfaceRegions: ['handle', 'bowl', 'bowl_back'],
  }),
  defineItem(LONG_TOOL, {
    id: 'turner_nylon_279',
    row: 53,
    name: 'Turner, nylon',
    product: 'OXO Good Grips nylon flexible turner',
    sources: ['items.md P15'],
    dimensions: [length(279, V), dim('width', 84, V, ALONG_Y)],
    mass: mass(73, V),
    profileNote: OWN_PROPORTIONS,
    materials: [{ part: '*', material: 'nylon' }],
    geometry: {
      class: 'rod',
      material: 'nylon',
      nodes: [
        { pMm: [6.5, 0, 7], widthMm: 19, thicknessMm: 14 },
        { pMm: [150, 0, 6.5], widthMm: 17, thicknessMm: 13 },
        { pMm: [178, 0, 3], widthMm: 28, thicknessMm: 6 },
        { pMm: [190, 0, 1.7], widthMm: 84, thicknessMm: 3.4 },
        { pMm: [277.7, 0, 1.3], widthMm: 84, thicknessMm: 2.6 },
      ],
      head: { type: 'none' },
      regions: [
        { id: 'handle', part: 'handle.0' },
        { id: 'blade', part: 'handle*' },
      ],
    },
    flags: { topRackOnly: true },
    surfaceRegions: ['handle', 'blade'],
  }),
  defineItem(LONG_TOOL, {
    id: 'spatula_plastic_330',
    row: 54,
    name: 'Spatula, plastic',
    product: 'generic plastic spatula (Matheus and Dollar 2010 sample)',
    sources: ['items.md S8'],
    itemClass: 'spatula',
    dimensions: [length(330, V), dim('width', 50, V, ALONG_Y), dim('height', 20, V, ALONG_Z)],
    mass: mass(90, V),
    profileNote: `${OWN_PROPORTIONS} The blade rises from the handle to the stated height.`,
    materials: [{ part: '*', material: 'nylon' }],
    geometry: {
      class: 'rod',
      material: 'nylon',
      nodes: [
        { pMm: [7, 0, 7], widthMm: 24, thicknessMm: 14 },
        { pMm: [190, 0, 7], widthMm: 20, thicknessMm: 14 },
        { pMm: [215, 0, 8], widthMm: 30, thicknessMm: 6 },
        { pMm: [240, 0, 11], widthMm: 50, thicknessMm: 4 },
        { pMm: [328.75, 0, 18.75], widthMm: 50, thicknessMm: 2.5 },
      ],
      head: { type: 'none' },
      regions: [
        { id: 'handle', part: 'handle.0' },
        { id: 'blade', part: 'handle*' },
      ],
    },
    flags: { topRackOnly: true },
    surfaceRegions: ['handle', 'blade'],
  }),
  defineItem(LONG_TOOL, {
    id: 'balloon_whisk_292',
    row: 55,
    name: 'Balloon whisk, 11 in',
    product: 'OXO Good Grips 11 in balloon whisk',
    sources: ['items.md P15'],
    itemClass: 'whisk',
    dimensions: [
      length(292, V),
      dim('head_diameter', 67, V, extentOf('wires.*', 'y'), {
        note: 'from a listed circumference of 8.25 in',
      }),
    ],
    mass: mass(110, V, { rangeG: [96, 123] }),
    profileNote:
      'Five steel wire loops of 1.7 mm on an elastomer handle of 28 mm, authored in the pose in which the whisk lies on a table.',
    materials: [
      { part: 'grip*', material: 'tpe' },
      { part: 'wires*', material: 'stainless_steel' },
    ],
    geometry: {
      ...whiskGeometry(),
      regionRenames: [rename('grip.wire', 'handle'), rename('wires.wire', 'wires')],
    },
    poses: [FLAT, HANDLE_DOWN, HANDLE_UP],
    recommendedPose: 'flat',
    surfaceRegions: ['handle', 'wires'],
  }),
  defineItem(LONG_TOOL, {
    id: 'tongs_steel_350',
    row: 56,
    name: 'Tongs, 12 in, locking',
    product: 'OXO Good Grips 12 in locking tongs with nylon heads',
    sources: ['items.md P15'],
    itemClass: 'tongs',
    dimensions: [
      length(350, V),
      dim('width', 38, V, ALONG_Y, { rangeMm: [25, 38] }),
      dim('height', 50, V, ALONG_Z, { note: 'open, as the listing gives it' }),
    ],
    mass: mass(177, V, { rangeG: [150, 204] }),
    profileNote:
      'Two steel strap arms hinged at the handle end and open by 7.8 degrees, with nylon heads; the locking mechanism is not modelled. Sizes fitted to the middle of the mass range.',
    materials: [
      { part: 'lower_head*', material: 'nylon' },
      { part: 'upper_head*', material: 'nylon' },
      { part: '*', material: 'stainless_steel' },
    ],
    geometry: {
      class: 'compound',
      children: [
        {
          id: 'lower',
          def: {
            class: 'rod',
            material: 'stainless_steel',
            nodes: [
              { pMm: [0.7, 0, 0.7], widthMm: 25, thicknessMm: 1.4 },
              { pMm: [275, 0, 0.7], widthMm: 25, thicknessMm: 1.4 },
            ],
            head: { type: 'none' },
          },
        },
        {
          id: 'lower_head',
          def: {
            class: 'rod',
            material: 'nylon',
            nodes: [
              { pMm: [262, 0, 2], widthMm: 30, thicknessMm: 4 },
              { pMm: [300, 0, 2], widthMm: 38, thicknessMm: 4 },
              { pMm: [348, 0, 2], widthMm: 38, thicknessMm: 4 },
            ],
            head: { type: 'none' },
          },
        },
        {
          id: 'upper',
          rotXyzDeg: [0, -7.8, 0],
          // 0.2 mm into the lower arm at the hinge end: resting exactly on it (1.4 mm), the
          // rotation lifted its near end 0.09 mm clear, and the two arms were two bodies.
          positionMm: [0, 0, 1.2],
          def: {
            class: 'rod',
            material: 'stainless_steel',
            nodes: [
              { pMm: [0.7, 0, 0.7], widthMm: 25, thicknessMm: 1.4 },
              { pMm: [275, 0, 0.7], widthMm: 25, thicknessMm: 1.4 },
            ],
            head: { type: 'none' },
          },
        },
        {
          id: 'upper_head',
          rotXyzDeg: [0, -7.8, 0],
          positionMm: [0, 0, 1.2],
          def: {
            class: 'rod',
            material: 'nylon',
            nodes: [
              { pMm: [262, 0, -0.6], widthMm: 30, thicknessMm: 4 },
              { pMm: [300, 0, -0.6], widthMm: 38, thicknessMm: 4 },
              { pMm: [348, 0, -0.6], widthMm: 38, thicknessMm: 4 },
            ],
            head: { type: 'none' },
          },
        },
      ],
      regionRenames: [
        rename('lower_head.*', 'head'),
        rename('upper_head.*', 'head'),
        rename('lower.*', 'handle'),
        rename('upper.*', 'handle'),
      ],
    },
    poses: [FLAT, HANDLE_DOWN, HANDLE_UP],
    recommendedPose: 'flat',
    soils: [
      soil('head', 'lard_tallow', 'film'),
      soil('head', 'minced_meat', 'smear'),
      soil('head', 'tomato_sauce', 'smear'),
    ],
    surfaceRegions: ['head', 'handle'],
  }),
  defineItem(LONG_TOOL, {
    id: 'wooden_spoon_305',
    row: 57,
    name: 'Wooden spoon, 12 in',
    product: 'TableCraft or Browne beechwood spoon 12 in',
    sources: ['items.md P15'],
    itemClass: 'wooden_spoon',
    dimensions: [length(305, V), dim('handle_diameter', 9.5, V, extentOf('handle.0', 'y'))],
    mass: mass(50, V, { rangeG: [41, 59] }),
    profileNote:
      'Handle of the stated diameter, flattened by a millimetre so that it does not roll, and a thick, shallow bowl; bowl size and thickness fitted to the middle of the mass range.',
    materials: [{ part: '*', material: 'beech' }],
    geometry: {
      class: 'rod',
      material: 'beech',
      nodes: [
        { pMm: [4.25, 0, 4.25], widthMm: 9.5, thicknessMm: 8.5 },
        { pMm: [190, 0, 9.5], widthMm: 9.5, thicknessMm: 8.5 },
        { pMm: [214, 0, 13.8], widthMm: 22, thicknessMm: 10 },
        { pMm: [221.2, 0, 13.8], widthMm: 30, thicknessMm: 11 },
      ],
      head: { type: 'spoon_bowl', lengthMm: 78, widthMm: 56, depthMm: 8, thicknessMm: 11.6 },
    },
    poses: [FLAT, FLAT_INVERTED_STEADY, HANDLE_DOWN, HANDLE_UP],
    flags: { dishwasherSafe: false, floats: true, concave: true },
    surfaceRegions: ['handle', 'bowl', 'bowl_back'],
  }),
  defineItem(LONG_TOOL, {
    id: 'swivel_peeler_180',
    row: 58,
    name: 'Swivel peeler',
    product: 'OXO Good Grips swivel peeler',
    sources: ['items.md P15'],
    itemClass: 'peeler',
    dimensions: [
      length(180, V),
      dim('width', 25, V, ALONG_Y),
      dim('height', 25, V, ALONG_Z, {
        note: 'the grip is modelled 23 mm thick so that it has a flat to lie on',
      }),
    ],
    mass: mass(63, V, { rangeG: [57, 70] }),
    profileNote:
      'Elastomer grip with a steel wire yoke and a blade bar; sizes fitted to the middle of the mass range.',
    materials: [
      { part: 'grip*', material: 'tpe' },
      { part: 'yoke*', material: 'stainless_steel' },
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
              { pMm: [11.5, 0, 11.5], widthMm: 25, thicknessMm: 23 },
              { pMm: [104, 0, 11.5], widthMm: 25, thicknessMm: 23 },
            ],
            head: { type: 'none' },
          },
        },
        {
          id: 'yoke',
          def: {
            class: 'wire',
            material: 'stainless_steel',
            wires: [
              {
                pointsMm: [
                  [106, -8, 11.5],
                  [176, -8, 11.5],
                  [178.5, 0, 11.5],
                  [176, 8, 11.5],
                  [106, 8, 11.5],
                ],
                radiusMm: 1.5,
              },
              // The blade bar, from inside the end of the grip (which reaches x = 115.5) to the
              // tip of the yoke (whose wire is centred on x = 178.5), so that it is held at
              // both ends; thinner than the 2.5 mm it had when it stopped 4 mm short of both,
              // so that the peeler weighs the same.
              {
                pointsMm: [
                  [112, 0, 11.5],
                  [177, 0, 11.5],
                ],
                radiusMm: 2.15,
              },
            ],
          },
        },
      ],
      regionRenames: [rename('grip.*', 'handle'), rename('yoke.*', 'blade')],
    },
    poses: [FLAT, HANDLE_DOWN, HANDLE_UP],
    recommendedPose: 'flat',
    soils: [soil('blade', 'spinach_particles', 'specks'), soil('blade', 'rice_starch', 'film')],
    surfaceRegions: ['handle', 'blade'],
  }),
  defineItem(LONG_TOOL, {
    id: 'box_grater_300',
    row: 59,
    name: 'Box grater',
    product: 'OXO Good Grips box grater',
    sources: ['items.md P15'],
    itemClass: 'grater',
    zones: ['upper_rack', 'lower_rack'],
    dimensions: [height(300, V), dim('length', 114, V, ALONG_X), dim('width', 75, V, ALONG_Y)],
    mass: mass(350, E, { grossG: 504, note: '504 g packed (verified)' }),
    profileNote:
      'An upturned box of perforated 0.52 mm steel sheet (30 % open) with a plastic handle bar on top; the taper of the real grater is not modelled.',
    materials: [
      { part: 'grip*', material: 'tpe' },
      { part: '*', material: 'stainless_steel' },
    ],
    geometry: {
      class: 'compound',
      children: [
        {
          id: 'body',
          rotXyzDeg: [180, 0, 0],
          positionMm: [0, 0, 276],
          def: {
            class: 'box_shell',
            material: 'stainless_steel',
            porosity: 0.3,
            lengthMm: 114,
            widthMm: 75,
            heightMm: 276,
            wallMm: 0.52,
            cornerRadiusMm: 10,
          },
        },
        {
          id: 'grip',
          def: {
            class: 'wire',
            material: 'tpe',
            wires: [
              // 1 mm into the top of the body (z = 276): at z = 288 the bar only touched it along
              // a line.
              {
                pointsMm: [
                  [-38, 0, 287],
                  [38, 0, 287],
                ],
                radiusMm: 12,
              },
            ],
          },
        },
      ],
      regionRenames: [
        rename('grip.*', 'handle'),
        rename('body.interior', 'inside'),
        rename('body.exterior', 'grating'),
      ],
    },
    poses: [
      UPRIGHT,
      pose('on_side', [90, 0, 0], true, 'lying on a broad face'),
      pose('inverted', [180, 0, 0], false, 'standing on its handle, held by the rack'),
    ],
    recommendedPose: 'on_side',
    surfaceRegions: ['handle', 'inside', 'grating'],
  }),
  defineItem(STRAINER, {
    id: 'colander_steel_5qt',
    row: 60,
    name: 'Colander, stainless steel, 5 qt',
    product: 'OXO Good Grips 5 qt stainless steel colander',
    sources: ['items.md P15'],
    dimensions: [diameter(286, V), height(127, V)],
    mass: mass(420, V),
    profileNote:
      'Profile of items.md 10.2 raised onto a foot ring and pulled in to the stated diameter; 15 % open area (the dossier model without perforations is 29 % over); wall fitted to the mass. Two tab handles are added.',
    materials: [{ part: '*', material: 'stainless_steel' }],
    geometry: {
      class: 'sor',
      material: 'stainless_steel',
      porosity: 0.15,
      profileMm: [
        [0, 12.22, 0.43],
        [70.03, 12.22, 0.43],
        [118, 55, 0.43],
        [142.78, 126.78, 0.43],
      ],
      footRing: { rMm: 62, widthMm: 1, heightMm: 12.4 },
      addons: [
        { type: 'handle_bar', attachZMm: 118, lengthMm: 18, sectionMm: [50, 3] },
        { type: 'handle_bar', attachZMm: 118, lengthMm: 18, sectionMm: [50, 3], azimuthDeg: 180 },
      ],
    },
    surfaceRegions: ['rim', 'interior', 'exterior', 'foot', 'handle'],
  }),
  defineItem(STRAINER, {
    id: 'sieve_mesh_200',
    row: 61,
    name: 'Mesh sieve, 20 cm',
    product: 'generic mesh sieve',
    sources: [],
    itemClass: 'sieve',
    dimensions: [
      diameter(200, R),
      dim('depth', 75, R, { kind: 'inner_depth', part: 'mesh.body' }),
      dim('handle_length', 180, R, null, {
        note: 'length of the handle beyond the rim: a parameter of the handle, not a bounding size',
      }),
    ],
    mass: mass(220, E),
    profileNote:
      'A mesh bowl (55 % open) in a steel rim band with a flat strap handle; sizes fitted to the estimated mass.',
    materials: [{ part: '*', material: 'stainless_steel' }],
    geometry: {
      class: 'compound',
      children: [
        {
          id: 'mesh',
          def: {
            class: 'sor',
            material: 'stainless_steel',
            porosity: 0.55,
            profileMm: [
              [0, 0.3, 0.6],
              [30, 3, 0.6],
              [55, 13, 0.6],
              [78, 32, 0.6],
              [93, 55, 0.6],
              [99, 75, 0.6],
            ],
          },
        },
        {
          id: 'frame',
          def: {
            class: 'sor',
            material: 'stainless_steel',
            profileMm: [
              [99.4, 70, 1.2],
              [99.4, 80, 1.2],
            ],
            addons: [{ type: 'handle_bar', attachZMm: 75, lengthMm: 180, sectionMm: [14, 2.5] }],
          },
        },
      ],
      regionRenames: [
        rename('mesh.*', 'mesh'),
        rename('frame.handle', 'handle'),
        rename('frame.*', 'frame'),
      ],
    },
    poses: [
      pose('upright', [0, 0, 0], false, 'bowl level, as when it is held or hung on a pot'),
      pose(
        'resting',
        [0, 15.857, 0],
        true,
        'as it lies on a table: tipped 15.9 degrees onto the end of its handle (solved for this geometry)',
      ),
      pose('inverted', [180, 0, 0], true, 'upside down, resting on its rim'),
      ON_EDGE,
    ],
    recommendedPose: 'inverted',
    surfaceRegions: ['mesh', 'handle', 'frame'],
  }),
  defineItem(BOARD, {
    id: 'chopping_board_pe_340',
    row: 62,
    name: 'Chopping board, polyethylene',
    product: 'IKEA LEGITIM chopping board',
    sources: ['items.md P16'],
    dimensions: [length(340, V), dim('width', 240, V, ALONG_Y), dim('thickness', 8, V, ALONG_Z)],
    mass: mass(565, V, { rangeG: [560, 570] }),
    profileNote:
      'Solid slab of the listed size, as the dossier models it (which is 10 % over the listed weight: the real board has a hanging hole and thinner edges).',
    materials: [{ part: '*', material: 'polyethylene' }],
    geometry: {
      class: 'slab',
      material: 'polyethylene',
      lengthMm: 340,
      widthMm: 240,
      thicknessMm: 8,
      edgeRadiusMm: 3,
    },
    surfaceRegions: ['top', 'underside', 'edge'],
  }),
  defineItem(BOARD, {
    id: 'chopping_board_pp_375',
    row: 63,
    name: 'Chopping board, polypropylene',
    product: 'OXO Good Grips utility cutting board',
    sources: ['items.md P16'],
    dimensions: [
      length(375, V),
      dim('width', 267, V, ALONG_Y),
      dim('thickness', 8, V, ALONG_Z, {
        rangeMm: [8, 13],
        note: 'the listing gives 8 to 13 mm (soft edge grips); the slab is 8 mm',
      }),
    ],
    mass: mass(700, V),
    profileNote: 'Solid slab of the listed size; the soft edge grips are not modelled.',
    materials: [{ part: '*', material: 'polypropylene' }],
    geometry: {
      class: 'slab',
      material: 'polypropylene',
      lengthMm: 375,
      widthMm: 267,
      thicknessMm: 8,
      edgeRadiusMm: 3,
    },
    surfaceRegions: ['top', 'underside', 'edge'],
  }),
  defineItem(BOARD, {
    id: 'chopping_board_beech_380',
    row: 64,
    name: 'Chopping board, beech',
    product: 'IKEA PROPPMATT chopping board',
    sources: ['items.md P16'],
    dimensions: [length(380, V), dim('width', 270, V, ALONG_Y), dim('thickness', 22, V, ALONG_Z)],
    mass: mass(1570, V, { rangeG: [1550, 1590] }),
    profileNote: 'Solid slab of the listed size.',
    materials: [{ part: '*', material: 'beech' }],
    geometry: {
      class: 'slab',
      material: 'beech',
      lengthMm: 380,
      widthMm: 270,
      thicknessMm: 22,
      edgeRadiusMm: 3,
    },
    flags: { dishwasherSafe: false },
    surfaceRegions: ['top', 'underside', 'edge'],
  }),
  defineItem(MIXING_BOWL, {
    id: 'mixing_bowl_glass_4qt',
    row: 65,
    name: 'Mixing bowl, glass, 4 qt',
    product: 'Pyrex 4 qt mixing bowl',
    sources: ['items.md P12'],
    dimensions: [diameter(310, V, { rangeMm: [302, 318] }), height(114, V)],
    mass: mass(1602, V),
    profileNote:
      'Profile of items.md 10.2 with the rim pulled in to the stated diameter; wall fitted to the mass.',
    materials: [{ part: '*', material: 'glass_soda_lime' }],
    geometry: {
      class: 'sor',
      material: 'glass_soda_lime',
      profileMm: [
        [0, 3.11, 6.23],
        [55.14, 3.11, 6.23],
        [110, 40, 5.27],
        [145, 85, 5.27],
        [152.36, 111.36, 5.27],
      ],
    },
    flags: { fragile: true },
    surfaceRegions: ['rim', 'interior', 'exterior'],
  }),
  defineItem(MIXING_BOWL, {
    id: 'mixing_bowl_steel_4qt',
    row: 66,
    name: 'Mixing bowl, stainless steel, 4 qt',
    product: 'Vollrath 69040 mixing bowl 4 qt',
    sources: ['items.md P17'],
    dimensions: [diameter(264, V), height(108, V)],
    mass: mass(476, V),
    profileNote:
      'Profile of items.md 10.2 with the rim pulled in to the stated diameter; wall fitted to the mass. The rolled rim is not modelled.',
    materials: [{ part: '*', material: 'stainless_steel' }],
    geometry: {
      class: 'sor',
      material: 'stainless_steel',
      profileMm: [
        [0, 0.31, 0.63],
        [50.04, 0.31, 0.63],
        [97, 35, 0.63],
        [125, 75, 0.63],
        [131.69, 107.69, 0.63],
      ],
    },
    surfaceRegions: ['rim', 'interior', 'exterior'],
  }),
  defineItem(MIXING_BOWL, {
    id: 'mixing_bowl_steel_light_4qt',
    row: 66,
    name: 'Mixing bowl, light-gauge stainless steel, 4 qt',
    product: 'Vollrath 47934 economy mixing bowl 4 qt (26 gauge)',
    sources: ['items.md P17'],
    dimensions: [diameter(271, V), height(95, V)],
    mass: mass(254, V),
    profileNote:
      'Profile shaped after the items.md 10.2 steel bowl; wall fitted to the mass, which makes it 0.34 mm: under the 0.40 mm of the model in items.md 2.4 (15 % over the listed mass) and under 26 gauge sheet (0.48 mm). The rolled rim is not modelled.',
    materials: [{ part: '*', material: 'stainless_steel' }],
    geometry: {
      class: 'sor',
      material: 'stainless_steel',
      profileMm: [
        [0, 0.17, 0.34],
        [52.03, 0.17, 0.34],
        [100, 30, 0.34],
        [128, 64, 0.34],
        [135.33, 94.83, 0.34],
      ],
    },
    surfaceRegions: ['rim', 'interior', 'exterior'],
  }),
  defineItem(MIXING_BOWL, {
    id: 'mixing_bowl_pp_3l',
    row: 67,
    name: 'Mixing bowl, polypropylene, 3 L',
    product: 'generic polypropylene mixing bowl',
    sources: [],
    dimensions: [diameter(260, R), height(125, R)],
    mass: mass(240, E),
    profileNote:
      'Profile of items.md 10.2 with the rim pulled in to the stated diameter; wall fitted to the mass.',
    materials: [{ part: '*', material: 'polypropylene' }],
    geometry: {
      class: 'sor',
      material: 'polypropylene',
      profileMm: [
        [0, 1.24, 2.49],
        [60.01, 1.24, 2.49],
        [105, 45, 2.49],
        [125, 95, 2.49],
        [128.76, 123.76, 2.49],
      ],
    },
    flags: { floats: true },
    surfaceRegions: ['rim', 'interior', 'exterior'],
  }),
  defineItem(LONG_TOOL, {
    id: 'spatula_silicone_280',
    row: 98,
    name: 'Silicone spatula',
    product: 'generic silicone spatula',
    sources: [],
    itemClass: 'spatula',
    zones: ['upper_rack'],
    usual: 'Upper rack',
    behaviour: 'High friction, floats partly, absorbs odours',
    dimensions: [
      length(280, R),
      dim('head_width', 55, R, ALONG_Y),
      dim('head_length', 90, R, null, {
        note: 'the head tapers into the handle, so its length is not a bounding size',
      }),
    ],
    mass: mass(60, R),
    profileNote: `${OWN_PROPORTIONS} The nylon core is not modelled separately: its density is that of the silicone.`,
    materials: [{ part: '*', material: 'silicone' }],
    geometry: {
      class: 'rod',
      material: 'silicone',
      nodes: [
        { pMm: [5, 0, 6], widthMm: 14, thicknessMm: 12 },
        { pMm: [170, 0, 5], widthMm: 12, thicknessMm: 10 },
        { pMm: [190, 0, 3.5], widthMm: 30, thicknessMm: 7 },
        { pMm: [202, 0, 3.5], widthMm: 55, thicknessMm: 7 },
        { pMm: [278.25, 0, 1.75], widthMm: 55, thicknessMm: 3.5 },
      ],
      head: { type: 'none' },
      regions: [
        { id: 'handle', part: 'handle.0' },
        { id: 'head', part: 'handle*' },
      ],
    },
    flags: { topRackOnly: true },
    surfaceRegions: ['handle', 'head'],
    notes:
      'items.md table 10.3 says silicone tools "float partly", but its section 3.1 lists silicone (and nylon) among the materials that sink; the item is flagged as not floating, which is what its density gives.',
  }),
];
