/**
 * Bakeware: oven dishes, baking tray, roasting tin, muffin tin, cooling rack and loaf pan (rows
 * 78 to 84 of the starter catalogue, docs/research/items.md section 10.1).
 *
 * The dossier gives overall sizes and masses; the trays are box shells of those sizes whose wall
 * thickness is fitted to the mass (within the ranges of items.md section 2.5), with length along
 * x and width along y. Handles that the listed overall length includes are separate lugs.
 * Authoring units: millimetres, grams.
 */

import type { Vec3 } from '@spotless/core';
import type { CompoundDefMm, WirePolylineMm } from '@spotless/geometry';
import type { ItemType } from '../types.ts';
import {
  ALONG_X,
  ALONG_Z,
  defineItem,
  dim,
  E,
  FLAT_INVERTED_STEADY,
  height,
  INVERTED,
  length,
  mass,
  rename,
  ON_LONG_EDGE,
  ON_SHORT_EDGE,
  soil,
  UPRIGHT,
  V,
  width,
  type Family,
} from './builders.ts';

const BAKEWARE: Family = {
  category: 'bakeware',
  itemClass: 'oven_dish',
  shapeTag: 'pan',
  zones: ['lower_rack'],
  poses: [UPRIGHT, INVERTED, ON_LONG_EDGE, ON_SHORT_EDGE],
  recommendedPose: 'on_long_edge',
  usual: 'Lower rack on edge at the sides, or flat inverted',
  behaviour:
    'Largest shadows; muffin tin has 12 cavities that pool if upright; cooling rack wires trap residue',
  soils: [
    soil('interior', 'cheese_baked', 'crust'),
    soil('interior', 'fat_polymerised', 'film'),
    soil('interior', 'burnt_sugar', 'crust'),
    soil('interior', 'burnt_carbonised', 'crust'),
    soil('interior', 'lard_tallow', 'film'),
    soil('flange', 'cheese_baked', 'crust'),
    soil('cavities', 'dough_batter', 'crust'),
    soil('cavities', 'burnt_sugar', 'crust'),
    soil('cavities', 'fat_polymerised', 'film'),
    soil('top', 'dough_batter', 'crust'),
    soil('wire', 'burnt_sugar', 'specks'),
    soil('wire', 'fat_polymerised', 'film'),
    soil('wire', 'dough_batter', 'specks'),
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
// Muffin tin: twelve cups in a top plate made of pieces of sheet that fit round them.
// ---------------------------------------------------------------------------------------------

/** Sheet thickness of the muffin tin, mm (fitted to its mass). */
const MUFFIN_SHEET = 1.608;
/** Pitch of the cups along x and along y, mm. */
const MUFFIN_PITCH_X = 78;
const MUFFIN_PITCH_Y = 77;
/** Inner radius of a cavity at the top, mm. */
const MUFFIN_CAVITY_RADIUS = 32;
/** Outer radius of a cup's flange, mm: 3 mm of flat round the cavity. */
const MUFFIN_FLANGE_RADIUS = 35;
/** Overall height of the tin, mm. */
const MUFFIN_HEIGHT = 32;
/** Half length and half width of the top plate, mm. */
const MUFFIN_HALF_X = 165;
const MUFFIN_HALF_Y = 122.5;

/**
 * A 12-cup muffin tin of 330 x 245 x 32 mm with cavities of 64 mm.
 *
 * The top plate is the rectangle less twelve round holes, which no union of rectangles and
 * rings makes without overlap, and parts that overlap are weighed twice (the first model, round
 * flanges wide enough to cover the corners between the cups plus nine strips across them,
 * weighed 23 % of its sheet twice). So the plate is cut along the lines of the grid: every cup
 * sits in a square of 64 mm, the land between the squares is strips, and where four squares
 * meet the corners between the cavities belong to one piece, a rectangle with its corners cut
 * at 45 degrees to follow the flanges. Each cup carries a narrow flange of
 * {@link MUFFIN_FLANGE_RADIUS}; the cut corners end where that circle leaves the cup's square.
 * What still overlaps is the flange under the cut corners and under the strips (a segment of
 * 2.4 mm and one of 3 mm at each of four places per cup) and half a sheet thickness at every
 * seam between two pieces: 3.3 % of the mass (catalogue test "weighs little of its material
 * twice").
 */
function muffinTinGeometry(): CompoundDefMm {
  const t = MUFFIN_SHEET;
  const top = MUFFIN_HEIGHT - t / 2;
  const children: CompoundDefMm['children'][number][] = [];
  const columns = [-1.5, -0.5, 0.5, 1.5].map((k) => k * MUFFIN_PITCH_X);
  const rows = [-MUFFIN_PITCH_Y, 0, MUFFIN_PITCH_Y];
  let n = 0;
  for (const y of rows) {
    for (const x of columns) {
      n++;
      children.push({
        id: `cup_${String(n).padStart(2, '0')}`,
        positionMm: [x, y, 0],
        def: {
          class: 'sor',
          material: 'aluminium',
          profileMm: [
            [0, t / 2, t],
            [25, t / 2, t],
            [MUFFIN_CAVITY_RADIUS + t / 2, top, t],
            [MUFFIN_FLANGE_RADIUS - t / 2, top, t],
          ],
        },
      });
    }
  }
  // The lines of the grid: where the land between the squares of the cups runs, as intervals
  // across it. Along x: between the columns and at the two ends; along y: between the rows and
  // along the two sides.
  const half = MUFFIN_CAVITY_RADIUS;
  const between = (centres: readonly number[], limit: number): [number, number][] => {
    const lines: [number, number][] = [[-limit, (centres[0] as number) - half]];
    for (let i = 0; i + 1 < centres.length; i++) {
      lines.push([(centres[i] as number) + half, (centres[i + 1] as number) - half]);
    }
    lines.push([(centres[centres.length - 1] as number) + half, limit]);
    return lines;
  };
  const linesX = between(columns, MUFFIN_HALF_X);
  const linesY = between(rows, MUFFIN_HALF_Y);
  // How far a corner piece reaches into a square along its sides: to where the flange circle
  // crosses the side.
  const reach = half - Math.sqrt(MUFFIN_FLANGE_RADIUS ** 2 - half ** 2);
  // Neighbouring pieces share half a sheet thickness, so that their flats meet (their edges
  // are rounded with that radius) and the plate is one piece.
  const lap = t / 2;
  /** A piece of the plate covering [x0, x1] x [y0, y1], corners cut as given. */
  const piece = (
    id: string,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    cuts?: readonly [number, number, number, number],
  ): void => {
    children.push({
      id,
      positionMm: [(x0 + x1) / 2, (y0 + y1) / 2, MUFFIN_HEIGHT - t],
      def: {
        class: 'slab',
        material: 'aluminium',
        lengthMm: x1 - x0,
        widthMm: y1 - y0,
        thicknessMm: t,
        edgeRadiusMm: t / 2,
        ...(cuts === undefined ? {} : { cornerCutsMm: cuts }),
      },
    });
  };
  linesX.forEach(([x0, x1], i) => {
    const left = i > 0; // squares to the left of this line
    const right = i + 1 < linesX.length;
    linesY.forEach(([y0, y1], j) => {
      const below = j > 0;
      const above = j + 1 < linesY.length;
      // Where four squares meet (or two, or one, at the edge of the plate): the crossing of
      // the two lines and the corners of the squares around it.
      piece(
        `corner_${i}${j}`,
        x0 - (left ? reach : 0),
        x1 + (right ? reach : 0),
        y0 - (below ? reach : 0),
        y1 + (above ? reach : 0),
        [
          right && above ? reach : 0,
          left && above ? reach : 0,
          left && below ? reach : 0,
          right && below ? reach : 0,
        ],
      );
    });
    // The land along the sides of the squares, between two corner pieces.
    rows.forEach((y, j) => {
      piece(`strip_y${i}${j}`, x0, x1, y - half + reach - lap, y + half - reach + lap);
    });
  });
  linesY.forEach(([y0, y1], j) => {
    columns.forEach((x, i) => {
      piece(`strip_x${i}${j}`, x - half + reach - lap, x + half - reach + lap, y0, y1);
    });
  });
  return { class: 'compound', children };
}

// ---------------------------------------------------------------------------------------------
// Cooling rack: a wire frame, cross wires, three bearers and six feet.
// ---------------------------------------------------------------------------------------------

/** A half-sheet cooling rack of 419 x 298 x 22 mm. */
function coolingRackWires(): WirePolylineMm[] {
  const frameR = 2;
  const crossR = 0.85;
  const bearerR = 1.5;
  const zFrame = 22 - frameR;
  const zBearer = zFrame - crossR - bearerR;
  const hx = 419 / 2 - frameR;
  const hy = 298 / 2 - frameR;
  const wires: WirePolylineMm[] = [
    {
      pointsMm: [
        [-hx, -hy, zFrame],
        [hx, -hy, zFrame],
        [hx, hy, zFrame],
        [-hx, hy, zFrame],
      ],
      radiusMm: frameR,
      closed: true,
    },
  ];
  for (let i = 0; i < 34; i++) {
    const x = -198 + i * 12;
    wires.push({
      pointsMm: [
        [x, -hy, zFrame],
        [x, hy, zFrame],
      ],
      radiusMm: crossR,
    });
  }
  for (const y of [-100, 0, 100]) {
    wires.push({
      pointsMm: [
        [-hx, y, zBearer],
        [hx, y, zBearer],
      ],
      radiusMm: bearerR,
    });
    for (const x of [-180, 180]) {
      wires.push({
        pointsMm: [
          [x, y, bearerR],
          [x, y, zBearer],
        ],
        radiusMm: bearerR,
      });
    }
  }
  return wires;
}

/** Oven dishes, trays, tins and the cooling rack. */
export const BAKEWARE_ITEMS: readonly ItemType[] = [
  defineItem(BAKEWARE, {
    id: 'oven_dish_stoneware_320',
    row: 78,
    name: 'Oven dish, stoneware, 32 cm',
    product: 'Le Creuset rectangular stoneware dish 32 cm, 4 L',
    sources: ['items.md P21'],
    dimensions: [
      dim('length', 397, V, ALONG_X, { note: 'overall, with the two end lugs' }),
      width(253, V),
      height(70, V),
    ],
    mass: mass(2300, V),
    profileNote:
      'Drafted box shell with two end lugs making up the listed overall length; wall fitted to the mass (items.md 2.5: stoneware oven dishes 6 to 8 mm).',
    materials: [{ part: '*', material: 'stoneware_glazed' }],
    geometry: {
      class: 'compound',
      children: [
        {
          id: 'dish',
          def: {
            class: 'box_shell',
            material: 'stoneware_glazed',
            lengthMm: 337,
            widthMm: 253,
            heightMm: 70,
            wallMm: 6.1,
            cornerRadiusMm: 50,
            draftDeg: 8,
          },
        },
        {
          id: 'lug_a',
          positionMm: [182, 0, 56],
          def: {
            class: 'slab',
            material: 'stoneware_glazed',
            lengthMm: 33,
            widthMm: 130,
            thicknessMm: 14,
            edgeRadiusMm: 5,
          },
        },
        {
          id: 'lug_b',
          positionMm: [-182, 0, 56],
          def: {
            class: 'slab',
            material: 'stoneware_glazed',
            lengthMm: 33,
            widthMm: 130,
            thicknessMm: 14,
            edgeRadiusMm: 5,
          },
        },
      ],
      regionRenames: [
        rename('lug_*', 'handle'),
        rename('dish.interior', 'interior'),
        rename('dish.exterior', 'exterior'),
      ],
    },
    flags: { fragile: true },
    surfaceRegions: ['handle', 'interior', 'exterior'],
  }),
  defineItem(BAKEWARE, {
    id: 'oven_dish_glass_3qt',
    row: 79,
    name: 'Oven dish, glass, 3 qt',
    product: 'Pyrex Basics 3 qt oblong baking dish',
    sources: ['items.md P12'],
    dimensions: [
      dim('length', 401, V, ALONG_X, {
        note: 'overall, with the two end lugs (listed as about 401)',
      }),
      width(241, V),
      height(64, V),
      dim('inner_length', 335, V, null, {
        note: 'inside the rim: the shell is 342.6 mm long at the rim with a 3.8 mm wall',
      }),
      dim('inner_width', 226, V, null, {
        note: 'inside the rim: the shell is 233.6 mm wide at the rim with a 3.8 mm wall',
      }),
    ],
    mass: mass(1410, V),
    profileNote:
      'Drafted box shell sized to the listed inner dimensions, with a narrow rim flange and two end lugs making up the overall length. The listed mass would need a 3.5 mm wall, against the 5 to 6.5 mm items.md 2.5 gives for Pyrex ovenware; the wall is held at 3.8 mm, which leaves the dish 8 % over the listed mass.',
    materials: [{ part: '*', material: 'glass_soda_lime' }],
    geometry: {
      class: 'compound',
      children: [
        {
          id: 'dish',
          def: {
            class: 'box_shell',
            material: 'glass_soda_lime',
            lengthMm: 342.6,
            widthMm: 233.6,
            heightMm: 64,
            wallMm: 3.8,
            cornerRadiusMm: 40,
            flangeMm: 3.7,
            draftDeg: 5,
          },
        },
        {
          id: 'lug_a',
          positionMm: [186.5, 0, 58],
          def: {
            class: 'slab',
            material: 'glass_soda_lime',
            lengthMm: 28,
            widthMm: 150,
            thicknessMm: 6,
            edgeRadiusMm: 3,
          },
        },
        {
          id: 'lug_b',
          positionMm: [-186.5, 0, 58],
          def: {
            class: 'slab',
            material: 'glass_soda_lime',
            lengthMm: 28,
            widthMm: 150,
            thicknessMm: 6,
            edgeRadiusMm: 3,
          },
        },
      ],
      regionRenames: [
        rename('lug_*', 'handle'),
        rename('dish.flange', 'flange'),
        rename('dish.interior', 'interior'),
        rename('dish.exterior', 'exterior'),
      ],
    },
    flags: { fragile: true },
    surfaceRegions: ['handle', 'flange', 'interior', 'exterior'],
  }),
  defineItem(BAKEWARE, {
    id: 'baking_tray_half_sheet',
    row: 80,
    name: 'Baking tray, aluminium half sheet',
    product: 'Nordic Ware Naturals half sheet',
    sources: ['items.md P22'],
    itemClass: 'baking_tray',
    shapeTag: 'flat_dish',
    dimensions: [length(455, V), width(328, V), height(25, V)],
    mass: mass(748, V),
    profileNote:
      'Drafted aluminium box shell whose rim flange carries the 3.2 mm steel wire of the rolled rim; sheet thickness fitted to the mass (items.md 2.5: 1.0 to 1.4 mm).',
    materials: [
      { part: 'rim*', material: 'carbon_steel' },
      { part: '*', material: 'aluminium' },
    ],
    geometry: {
      class: 'compound',
      children: [
        {
          id: 'tray',
          def: {
            class: 'box_shell',
            material: 'aluminium',
            lengthMm: 447,
            widthMm: 320,
            heightMm: 25,
            wallMm: 1.34,
            cornerRadiusMm: 22,
            flangeMm: 4,
            draftDeg: 12,
          },
        },
        {
          id: 'rim',
          def: {
            class: 'wire',
            material: 'carbon_steel',
            wires: [
              {
                pointsMm: [
                  [-207.9, -162.4, 23.4],
                  [207.9, -162.4, 23.4],
                  [225.9, -144.4, 23.4],
                  [225.9, 144.4, 23.4],
                  [207.9, 162.4, 23.4],
                  [-207.9, 162.4, 23.4],
                  [-225.9, 144.4, 23.4],
                  [-225.9, -144.4, 23.4],
                ],
                radiusMm: 1.6,
                closed: true,
              },
            ],
          },
        },
      ],
      regionRenames: [
        rename('tray.flange', 'flange'),
        rename('rim.wire', 'flange'),
        rename('tray.interior', 'interior'),
        rename('tray.exterior', 'exterior'),
      ],
    },
    surfaceRegions: ['flange', 'interior', 'exterior'],
  }),
  defineItem(BAKEWARE, {
    id: 'roasting_tin_427',
    row: 81,
    name: 'Roasting tin, stainless steel, 16 in',
    product: 'Cuisinart 7117-16UR roaster (without its rack)',
    sources: ['items.md P22'],
    itemClass: 'roasting_tin',
    dimensions: [length(427, V), width(325, V), height(86, V)],
    mass: mass(2300, E, {
      rangeG: [2000, 2500],
      grossG: 3200,
      note: 'listed at 2700 to 3200 g with its rack (verified); a tri-ply roaster weighs 2980 g (verified); the tin alone is estimated',
    }),
    profileNote:
      'Drafted box shell of the listed size with a rim flange; the riveted handles are not modelled; wall fitted to the estimated mass.',
    materials: [{ part: '*', material: 'stainless_steel' }],
    geometry: {
      class: 'box_shell',
      material: 'stainless_steel',
      lengthMm: 407,
      widthMm: 305,
      heightMm: 86,
      wallMm: 1.22,
      cornerRadiusMm: 45,
      flangeMm: 10,
      draftDeg: 6,
    },
    surfaceRegions: ['flange', 'interior', 'exterior'],
  }),
  defineItem(BAKEWARE, {
    id: 'muffin_tin_12',
    row: 82,
    name: 'Muffin tin, 12 cups',
    product: 'Nordic Ware Naturals 12-cup muffin pan',
    sources: ['items.md P22'],
    itemClass: 'muffin_tin',
    dimensions: [
      length(330, V),
      width(245, V),
      height(32, V),
      dim('cavity_diameter', 64, V, null, {
        note: 'inner diameter of a cavity at the top: built into the cup profile',
      }),
    ],
    mass: mass(590, V),
    profileNote:
      'Twelve cups on a 78 mm grid in a top plate made of strips and of corner pieces cut to fit round the flanges of the cups, so that little of the sheet is counted twice; sheet thickness fitted to the mass.',
    materials: [{ part: '*', material: 'aluminium' }],
    geometry: {
      ...muffinTinGeometry(),
      regionRenames: [
        rename('cup_*.interior', 'cavities'),
        rename('cup_*.exterior', 'underside'),
        rename('cup_*.rim', 'top'),
        rename('strip_*.underside', 'underside'),
        rename('strip_*', 'top'),
        rename('corner_*.underside', 'underside'),
        rename('corner_*', 'top'),
      ],
    },
    poses: [UPRIGHT, FLAT_INVERTED_STEADY, ON_LONG_EDGE, ON_SHORT_EDGE],
    surfaceRegions: ['cavities', 'underside', 'top'],
  }),
  defineItem(BAKEWARE, {
    id: 'cooling_rack_half',
    row: 83,
    name: 'Cooling rack, half sheet',
    product: "Vollrath 20248 or Fat Daddio's CR-HALF cooling rack",
    sources: ['items.md P22'],
    itemClass: 'cooling_rack',
    shapeTag: 'wire_rack',
    dimensions: [length(419, V), width(298, V), dim('height', 22, V, ALONG_Z)],
    mass: mass(400, E),
    profileNote:
      'A 4 mm frame, 34 cross wires of 1.7 mm at 12 mm pitch, three bearers and six feet; wire sizes chosen to give the estimated mass.',
    materials: [{ part: '*', material: 'stainless_steel' }],
    geometry: { class: 'wire', material: 'stainless_steel', wires: coolingRackWires() },
    poses: [UPRIGHT, FLAT_INVERTED_STEADY, ON_LONG_EDGE, ON_SHORT_EDGE],
    flags: { concave: false },
    surfaceRegions: ['wire'],
  }),
  defineItem(BAKEWARE, {
    id: 'loaf_pan_nonstick_210',
    row: 84,
    name: 'Loaf pan, non-stick steel',
    product: 'generic non-stick metal baking pan (Matheus and Dollar 2010 sample)',
    sources: ['items.md S8'],
    itemClass: 'loaf_pan',
    dimensions: [length(210, V), width(110, V), height(80, V)],
    mass: mass(352, V),
    profileNote: 'Drafted box shell of the listed size with a narrow rim; wall fitted to the mass.',
    materials: [{ part: '*', material: 'carbon_steel_nonstick' }],
    geometry: {
      class: 'box_shell',
      material: 'carbon_steel_nonstick',
      lengthMm: 202,
      widthMm: 102,
      heightMm: 80,
      wallMm: 0.71,
      cornerRadiusMm: 12,
      flangeMm: 4,
      draftDeg: 6,
    },
    flags: { dishwasherSafe: false },
    surfaceRegions: ['flange', 'interior', 'exterior'],
  }),
];
