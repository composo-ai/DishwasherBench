/**
 * The loads of the phenomena suite that are put together by real loading physics: what goes
 * into the owner's machine, in which order, by which move. `build-loads.ts` plays each recipe
 * through the session layer (`@spotless/session`) with the moves of the scripted loader
 * (`@spotless/loader`) and saves the settled load under `../loads/<name>.json`, which is what
 * the suite reads.
 *
 * Positions are in millimetres in the frame of the basket named (origin at its front-left
 * corner on top of the base grid). Slot ids are those of `list_slots`.
 *
 * The lower basket of the Bosch SMV4HAX40G, for orientation (tub frame, mm): rows R1 (y = 161)
 * and R2 (y = 62) run left to right and hold plates together; slots 0 to 13 lean to the left
 * (x from -199 to +38, pitch 18.25), slot 14 is the wide gap where the tines lean apart, slots
 * 15 to 21 lean to the right. Rows ML/FL (left) and MR/FR (right) at the front hold five
 * pieces each at 26 mm pitch. The cutlery basket stands front and centre. The lower arm turns
 * about (0, 0) with a radius of 230 mm, the upper arm about (0, -30) under the upper basket.
 */

/** One item of a recipe: its id in the load and its catalogue type. */
export interface RecipeItem {
  readonly id: string;
  readonly type: string;
}

/** An orientation as the session takes it: a named preset of the item with offsets in degrees. */
export interface RecipeOrientation {
  readonly preset: string;
  readonly yaw_deg?: number;
  readonly pitch_deg?: number;
  readonly roll_deg?: number;
}

/** A basket a recipe places in. */
export type RecipeRack = 'lower_rack' | 'upper_rack' | 'cutlery_basket';

/** One move of a recipe. */
export type RecipeStep =
  /** Change an adjustable feature of a basket (a cup shelf folded down, a row folded). */
  | {
      readonly op: 'option';
      readonly rack: RecipeRack;
      readonly name: string;
      readonly value: string;
    }
  /**
   * Let an item down into a slot between tines, the way `list_slots` suggests for it
   * (`suggested_drop`); `reversed` turns it half a turn about the vertical first, so that its
   * face looks the other way; `shift` moves the drop along the row, mm (to crowd a slot).
   */
  | {
      readonly op: 'slot';
      readonly item: string;
      readonly rack: 'lower_rack' | 'upper_rack';
      readonly slot: string;
      readonly reversed?: boolean;
      readonly shift?: readonly number[];
      /** With `shift`: keep the placement only if the item ends touching this other item. */
      readonly touching?: string;
    }
  /** Lower an item at a spot and let it go. Several spots are tried in order until one holds. */
  | {
      readonly op: 'drop';
      readonly item: string;
      readonly rack: RecipeRack;
      readonly at: readonly (readonly [number, number])[];
      readonly orientation: RecipeOrientation;
      /** Heights of the reference point to try, mm; default: clear of the basket. */
      readonly z?: readonly number[];
      /** Keep the placement only if the session's check then finds this arm stopped by the item. */
      readonly mustStop?: 'lower_arm' | 'upper_arm';
      /** Keep the placement only if the item ends touching this other item. */
      readonly touching?: string;
      /** Accept an item the stability probe flags (it rests, but a nudge would move it). */
      readonly allowUnstable?: boolean;
      /** Most the item may turn while it settles, degrees; default 45 (it must not topple). */
      readonly maxTurn?: number;
      /** Keep the placement only if the item comes to rest within this distance of the spot, mm. */
      readonly within?: number;
      /** Keep the placement only if both spray arms still turn freely. */
      readonly clearOfArms?: boolean;
    }
  /** Drop an item into another item of its kind (a bowl into a bowl), along that item's axis. */
  | { readonly op: 'nest'; readonly item: string; readonly into: string }
  /** Lay a spoon into the bowl of a spoon that stands in the cutlery basket. */
  | { readonly op: 'nest_spoon'; readonly item: string; readonly into: string };

/** A load to build. */
export interface Recipe {
  readonly name: string;
  /** What the load is and which phenomena use it. */
  readonly description: string;
  readonly items: readonly RecipeItem[];
  readonly steps: readonly RecipeStep[];
}

const DINNER = 'dinner_plate_porcelain_iec';
const DESSERT = 'dessert_plate_porcelain_190';
const SOUP = 'soup_plate_porcelain_230';
const GLASS = 'test_glass_borosilicate_250';
const MUG = 'mug_ceramic_300';

const r1 = (index: number): string => `tine_row_r1.slot_${String(index).padStart(2, '0')}`;

function plates(prefix: string, type: string, count: number): RecipeItem[] {
  return Array.from({ length: count }, (_unused, i) => ({ id: `${prefix}_${i + 1}`, type }));
}

/**
 * A row of plates in the rear lane (R1 + R2) of the lower basket, one per listed slot; item k
 * stands in the k-th slot listed. They are put in the way a row is filled by hand: each next
 * plate on the side the tines lean to (the left half from the middle outwards to the left,
 * the right half outwards to the right), so that no plate has to be slid in under the lean of
 * the one before.
 */
function plateRow(prefix: string, slots: readonly number[]): RecipeStep[] {
  const steps = slots.map((slot, i) => ({
    slot,
    step: {
      op: 'slot' as const,
      item: `${prefix}_${i + 1}`,
      rack: 'lower_rack' as const,
      slot: r1(slot),
    },
  }));
  const left = steps.filter((s) => s.slot < 14).sort((a, b) => b.slot - a.slot);
  const right = steps.filter((s) => s.slot >= 14).sort((a, b) => a.slot - b.slot);
  return [...left, ...right].map((s) => s.step);
}

/** Spots of a cutlery cell (cutlery-basket frame, mm) at which a piece is let down. */
const CELL_CENTRE: Readonly<Record<string, readonly [number, number]>> = {
  c00: [32, 28],
  c01: [32, 115],
  c02: [32, 203],
  c10: [96, 28],
  c11: [96, 115],
  c12: [96, 203],
};
const CELLS = ['c00', 'c01', 'c02', 'c10', 'c11', 'c12'] as const;

/** Where the k-th piece of a cell is let down: towards the corners in turn (off the partition). */
function cellSpots(cell: string, k: number): (readonly [number, number])[] {
  const [cx, cy] = CELL_CENTRE[cell] as readonly [number, number];
  const long = cell.endsWith('1');
  const dy = long ? 28 : 10;
  const offsets: (readonly [number, number])[] = [
    [-14, -dy],
    [14, dy],
    [14, -dy],
    [-14, dy],
    [0, -dy],
    [0, dy],
  ];
  const out: (readonly [number, number])[] = [];
  for (let i = 0; i < offsets.length; i++) {
    const o = offsets[(k + i) % offsets.length] as readonly [number, number];
    out.push([cx + o[0], cy + o[1]]);
  }
  return out;
}

function cutlery(prefix: string, type: string, perCell: number, preset: string): Recipe['steps'] {
  const steps: RecipeStep[] = [];
  let n = 0;
  for (let k = 0; k < perCell; k++) {
    for (const cell of CELLS) {
      n += 1;
      steps.push({
        op: 'drop',
        item: `${prefix}_${n}`,
        rack: 'cutlery_basket',
        at: cellSpots(cell, k),
        orientation: { preset, yaw_deg: (k % 2) * 90 },
        allowUnstable: true,
        // A piece put into a cell that is already crowded leans on the others.
        maxTurn: 75,
      });
    }
  }
  return steps;
}

/** Spots on the floor of the upper basket (mm) where a glass or mug stands mouth down. */
const UPPER_SPOT_A: readonly (readonly [number, number])[] = [
  [330, 300],
  [336, 310],
  [324, 290],
];
const UPPER_SPOT_B: readonly (readonly [number, number])[] = [
  [420, 150],
  [426, 160],
  [414, 140],
];

const PLATES_18 = [3, 4, 5, 6, 7, 8, 9];
const PLATES_36 = [0, 2, 4, 6, 8, 10, 12];

/** Every load the suite has built by physics. */
export const RECIPES: readonly Recipe[] = [
  {
    name: 'plate-facing',
    description:
      'P02 A, P25, P26, P27, P29, P30, P34: one porcelain dessert plate in the rear lane of the lower basket (R1 slot 5, 108 mm left of the arm axis), eating face towards the arm axis',
    items: [{ id: 'plate', type: DESSERT }],
    steps: [{ op: 'slot', item: 'plate', rack: 'lower_rack', slot: r1(5) }],
  },
  {
    name: 'plates-18',
    description:
      'P03, P12 A, P21, P22: seven IEC dinner plates in neighbouring slots of the rear lane (R1 slots 3 to 9, pitch 18.25 mm), faces to the arm axis',
    items: plates('plate', DINNER, 7),
    steps: plateRow('plate', PLATES_18),
  },
  {
    name: 'plates-36',
    description:
      'P03, P06 A: seven IEC dinner plates in every second slot of the rear lane (R1 slots 0 to 12, pitch 36.5 mm)',
    items: plates('plate', DINNER, 7),
    steps: plateRow('plate', PLATES_36),
  },
  {
    name: 'plates-9',
    description:
      'P03: eight IEC dinner plates two to a slot (R1 slots 2, 4, 6, 8, each with a second plate pushed in beside the first). The physics nests the pair (under 1 mm between the covered well and its partner); the scenario sets one plate of each pair half a pitch in front of the other',
    items: plates('plate', DINNER, 8),
    steps: [8, 6, 4, 2].flatMap((slot, k): RecipeStep[] => {
      const i = 3 - k;
      return [
        { op: 'slot', item: `plate_${2 * i + 1}`, rack: 'lower_rack', slot: r1(slot) },
        {
          op: 'slot',
          item: `plate_${2 * i + 2}`,
          rack: 'lower_rack',
          slot: r1(slot),
          shift: [-9, 9, -13, 13, -6, 6],
          touching: `plate_${2 * i + 1}`,
        },
      ];
    }),
  },
  {
    name: 'plates-alt-18',
    description:
      'P12 B: dinner plates (R1 slots 3, 5, 7, 9) alternating with dessert plates (slots 4, 6, 8) at the same 18.25 mm pitch',
    items: [...plates('plate', DINNER, 4), ...plates('small', DESSERT, 3)],
    steps: [
      { op: 'slot', item: 'plate_4', rack: 'lower_rack', slot: r1(9) },
      { op: 'slot', item: 'small_3', rack: 'lower_rack', slot: r1(8) },
      { op: 'slot', item: 'plate_3', rack: 'lower_rack', slot: r1(7) },
      { op: 'slot', item: 'small_2', rack: 'lower_rack', slot: r1(6) },
      { op: 'slot', item: 'plate_2', rack: 'lower_rack', slot: r1(5) },
      { op: 'slot', item: 'small_1', rack: 'lower_rack', slot: r1(4) },
      { op: 'slot', item: 'plate_1', rack: 'lower_rack', slot: r1(3) },
    ],
  },
  {
    name: 'plates-18-upper',
    description: 'P23 B: the plates of plates-18 with three mugs mouth down in the upper basket',
    items: [...plates('plate', DINNER, 7), ...plates('upper', MUG, 3)],
    steps: [
      ...plateRow('plate', PLATES_18),
      {
        op: 'drop',
        item: 'upper_1',
        rack: 'upper_rack',
        at: UPPER_SPOT_A,
        orientation: { preset: 'inverted' },
      },
      {
        op: 'drop',
        item: 'upper_2',
        rack: 'upper_rack',
        at: UPPER_SPOT_B,
        orientation: { preset: 'inverted' },
      },
      {
        op: 'drop',
        item: 'upper_3',
        rack: 'upper_rack',
        at: [
          [240, 330],
          [246, 340],
        ],
        orientation: { preset: 'inverted' },
      },
    ],
  },
  {
    name: 'bowls-apart',
    description:
      'P04 A: two cereal bowls mouth down in the upper basket, side by side and clear of each other',
    items: [
      { id: 'bowl_under', type: 'cereal_bowl_vitrelle_159' },
      { id: 'bowl_over', type: 'cereal_bowl_vitrelle_159' },
    ],
    steps: [
      {
        op: 'drop',
        item: 'bowl_under',
        rack: 'upper_rack',
        at: [[330, 330]],
        orientation: { preset: 'inverted' },
      },
      {
        op: 'drop',
        item: 'bowl_over',
        rack: 'upper_rack',
        at: [
          [330, 140],
          [330, 130],
          [340, 150],
        ],
        orientation: { preset: 'inverted' },
      },
    ],
  },
  {
    name: 'bowls-nested',
    description:
      'P04 B: the same two bowls, the second dropped onto the first so that it comes to rest nested on it',
    items: [
      { id: 'bowl_under', type: 'cereal_bowl_vitrelle_159' },
      { id: 'bowl_over', type: 'cereal_bowl_vitrelle_159' },
    ],
    steps: [
      {
        op: 'drop',
        item: 'bowl_under',
        rack: 'upper_rack',
        at: [[330, 330]],
        orientation: { preset: 'inverted' },
      },
      { op: 'nest', item: 'bowl_over', into: 'bowl_under' },
    ],
  },
  {
    name: 'board-side',
    description:
      'P05 A: two dessert plates in the left front lane of the lower basket (ML slots 2 and 3), faces to the arm axis, and a 32 cm oval platter on edge outboard of them (slot 0, at the side wall)',
    items: [
      { id: 'plate_1', type: DESSERT },
      { id: 'plate_2', type: DESSERT },
      { id: 'board', type: 'oval_platter_porcelain_320' },
    ],
    steps: [
      { op: 'slot', item: 'board', rack: 'lower_rack', slot: 'tine_row_ml.slot_00' },
      { op: 'slot', item: 'plate_1', rack: 'lower_rack', slot: 'tine_row_ml.slot_02' },
      { op: 'slot', item: 'plate_2', rack: 'lower_rack', slot: 'tine_row_ml.slot_03' },
    ],
  },
  {
    name: 'soup-radial',
    description:
      'P07, P08: four soup plates in the lower basket: R1 slot 10 (112 mm from the arm axis), R1 slot 5 (155 mm), ML slot 0 (front left, 234 mm, outside the swept circle) and its mirror image MR slot 4 (front right)',
    items: plates('soup', SOUP, 4),
    steps: [
      { op: 'slot', item: 'soup_1', rack: 'lower_rack', slot: r1(10) },
      { op: 'slot', item: 'soup_2', rack: 'lower_rack', slot: r1(5) },
      { op: 'slot', item: 'soup_3', rack: 'lower_rack', slot: 'tine_row_ml.slot_00' },
      { op: 'slot', item: 'soup_4', rack: 'lower_rack', slot: 'tine_row_mr.slot_04' },
    ],
  },
  {
    name: 'soup-12',
    description:
      'P31: twelve soup plates in the lower basket (R1 slots 0 to 12 and 17 to 21, every second slot, ML slot 2 and MR slot 2; the rear slots 13 to 16 take no soup plate on the present basket)',
    items: plates('soup', SOUP, 12),
    steps: [
      ...plateRow('soup', [0, 2, 4, 6, 8, 10, 12, 17, 19, 21]),
      { op: 'slot', item: 'soup_11', rack: 'lower_rack', slot: 'tine_row_ml.slot_02' },
      { op: 'slot', item: 'soup_12', rack: 'lower_rack', slot: 'tine_row_mr.slot_02' },
    ],
  },
  {
    name: 'glass-between',
    description:
      'P10, P13 A, P32, P43: one 250 mL test glass mouth down on the floor of the upper basket between the tine rows',
    items: [{ id: 'glass', type: GLASS }],
    steps: [
      {
        op: 'drop',
        item: 'glass',
        rack: 'upper_rack',
        at: UPPER_SPOT_A,
        orientation: { preset: 'inverted' },
      },
    ],
  },
  {
    name: 'bowl-same-spot',
    description: 'P10: a shallow dessert bowl mouth down at the spot of the glass of glass-between',
    items: [{ id: 'bowl', type: 'dessert_bowl_vitrelle_130' }],
    steps: [
      {
        op: 'drop',
        item: 'bowl',
        rack: 'upper_rack',
        at: [...UPPER_SPOT_A, [330, 330], [340, 320], [320, 280], [336, 290], [344, 300]],
        orientation: { preset: 'inverted' },
        maxTurn: 35,
      },
    ],
  },
  {
    name: 'glass-free',
    description:
      'P13: one 250 mL test glass mouth down on the floor of the upper basket, clear of the tines (the scenario also sets it over a tine, as an exact pose)',
    items: [{ id: 'glass', type: GLASS }],
    steps: [
      {
        op: 'drop',
        item: 'glass',
        rack: 'upper_rack',
        at: [
          [420, 380],
          [426, 390],
          [414, 370],
        ],
        orientation: { preset: 'inverted' },
        maxTurn: 30,
      },
    ],
  },
  {
    name: 'glasses-touching',
    description:
      'P40 B: two test glasses mouth down in the upper basket, let down against each other',
    items: plates('glass', GLASS, 2),
    steps: [
      {
        op: 'drop',
        item: 'glass_1',
        rack: 'upper_rack',
        at: UPPER_SPOT_B,
        orientation: { preset: 'inverted' },
      },
      {
        op: 'drop',
        item: 'glass_2',
        rack: 'upper_rack',
        at: [
          [420, 222],
          [420, 220],
          [420, 218],
          [420, 216],
          [420, 214],
          [420, 212],
          [420, 210],
          [420, 208],
        ],
        orientation: { preset: 'inverted' },
        touching: 'glass_1',
      },
    ],
  },
  {
    name: 'glasses-apart',
    description: 'P40 A: the same two glasses with a clear gap between them',
    items: plates('glass', GLASS, 2),
    steps: [
      {
        op: 'drop',
        item: 'glass_1',
        rack: 'upper_rack',
        at: UPPER_SPOT_B,
        orientation: { preset: 'inverted' },
      },
      {
        op: 'drop',
        item: 'glass_2',
        rack: 'upper_rack',
        at: [
          [420, 240],
          [420, 244],
          [420, 248],
        ],
        orientation: { preset: 'inverted' },
      },
    ],
  },
  {
    name: 'dplate-lower',
    description:
      'P11 A, P33, P38: a porcelain dessert plate (R1 slot 4) and a melamine dessert plate of the same shape (R1 slot 8) in the lower basket, faces to the arm axis',
    items: [
      { id: 'plate', type: DESSERT },
      { id: 'melamine', type: 'melamine_dessert_plate_iec_195' },
    ],
    steps: [
      { op: 'slot', item: 'plate', rack: 'lower_rack', slot: r1(4) },
      { op: 'slot', item: 'melamine', rack: 'lower_rack', slot: r1(8) },
    ],
  },
  {
    // Until IMG_9131 (2026-10-11) the plate was let down over slot 2 of row A, where it had no
    // seat and came to lie against row B. With the knife shelf where the photograph has it
    // (149.5 mm up, over the left 101 mm of the basket) a 190 mm plate does not go into rows A
    // and A' at all while the shelf is down; in row C it has a seat (`list_slots`: down the
    // ramp from the rail, against the inner face of the right ridge), and stands there.
    name: 'dplate-upper',
    description:
      'P11 B: the same porcelain dessert plate standing in row C of the upper basket (rear half, slot 2)',
    items: [{ id: 'plate', type: DESSERT }],
    steps: [{ op: 'slot', item: 'plate', rack: 'upper_rack', slot: 'tine_row_c_rear.slot_02' }],
  },
  {
    name: 'platter-inward',
    description:
      'P14 A: an oval platter in the outermost slot of the rear lane (R1 slot 0, next to the left wall), eating face to the arm axis',
    items: [{ id: 'platter', type: 'oval_platter_vitrelle_241' }],
    steps: [{ op: 'slot', item: 'platter', rack: 'lower_rack', slot: r1(0) }],
  },
  {
    name: 'spoons-opposed',
    description:
      'P15 A: two soup spoons standing handle down in one cell of the cutlery basket, bowls turned away from each other',
    items: plates('spoon', 'soup_spoon_190', 2),
    steps: [
      {
        op: 'drop',
        item: 'spoon_1',
        rack: 'cutlery_basket',
        at: cellSpots('c01', 0),
        orientation: { preset: 'handle_down' },
        allowUnstable: true,
      },
      {
        op: 'drop',
        item: 'spoon_2',
        rack: 'cutlery_basket',
        at: cellSpots('c01', 3),
        orientation: { preset: 'handle_down', yaw_deg: 180 },
        allowUnstable: true,
      },
    ],
  },
  {
    name: 'spoons-nested',
    description:
      'P15 B: the same two spoons, the second laid into the bowl of the first (spooning). The physics lets it slide off and rest across the first; the scenario sets it into its nest',
    items: plates('spoon', 'soup_spoon_190', 2),
    steps: [
      {
        op: 'drop',
        item: 'spoon_1',
        rack: 'cutlery_basket',
        at: cellSpots('c01', 0),
        orientation: { preset: 'handle_down' },
        allowUnstable: true,
      },
      { op: 'nest_spoon', item: 'spoon_2', into: 'spoon_1' },
    ],
  },
  {
    name: 'forks-heads-up',
    description:
      'P16 A: six dinner forks, one per cell of the cutlery basket, handles down (heads up)',
    items: plates('fork', 'dinner_fork_185', 6),
    steps: cutlery('fork', 'dinner_fork_185', 1, 'handle_down'),
  },
  {
    name: 'forks-heads-down',
    description: 'P16 B: the same six forks, one per cell, handles up (heads down)',
    items: plates('fork', 'dinner_fork_185', 6),
    steps: cutlery('fork', 'dinner_fork_185', 1, 'handle_up'),
  },
  {
    name: 'spoons-1',
    description: 'P17, P18 A: six dessert spoons, one per cell of the cutlery basket, handles down',
    items: plates('spoon', 'dessert_spoon_160', 6),
    steps: cutlery('spoon', 'dessert_spoon_160', 1, 'handle_down'),
  },
  {
    name: 'spoons-2',
    description: 'P17: twelve dessert spoons, two per cell',
    items: plates('spoon', 'dessert_spoon_160', 12),
    steps: cutlery('spoon', 'dessert_spoon_160', 2, 'handle_down'),
  },
  {
    name: 'spoons-4',
    description: 'P17: twenty-four dessert spoons, four per cell',
    items: plates('spoon', 'dessert_spoon_160', 24),
    steps: cutlery('spoon', 'dessert_spoon_160', 4, 'handle_down'),
  },
  {
    name: 'spoons-shelf',
    description:
      'P18 B: six dessert spoons lying flat, bowls up, on the knife shelf of the upper basket (this machine has no cutlery drawer; the shelf is where pieces lie flat)',
    items: plates('spoon', 'dessert_spoon_160', 6),
    steps: [0, 1, 2, 3, 4, 5].map((i): RecipeStep => ({
      op: 'drop',
      item: `spoon_${i + 1}`,
      rack: 'upper_rack',
      at: [
        [50, 150 + 55 * i],
        [45, 150 + 55 * i],
        [55, 155 + 55 * i],
      ],
      orientation: { preset: 'flat', yaw_deg: 90 },
      // (The floor of the shelf is 153.5 mm above the floor wires, IMG_9131; it was drawn at
      // about 100, and the spoons were let go at 140 and 150.)
      z: [185, 195],
      allowUnstable: true,
    })),
  },
  {
    name: 'pot-inverted',
    description:
      'P35 A, P39: a 17 cm steel saucepan mouth down on the rear rows of the lower basket',
    items: [{ id: 'pot', type: 'saucepan_steel_170' }],
    steps: [
      {
        op: 'drop',
        item: 'pot',
        rack: 'lower_rack',
        at: [
          [160, 370],
          [170, 375],
          [150, 365],
          [180, 380],
        ],
        orientation: { preset: 'inverted' },
        z: [150, 160, 172],
        allowUnstable: true,
      },
    ],
  },
  {
    name: 'pot-on-side',
    description:
      'P35 B: the same saucepan lying on its side at the same place, opening to the arm axis',
    items: [{ id: 'pot', type: 'saucepan_steel_170' }],
    steps: [
      {
        op: 'drop',
        item: 'pot',
        rack: 'lower_rack',
        at: [
          [160, 370],
          [170, 375],
          [150, 365],
          [180, 380],
        ],
        orientation: { preset: 'on_edge' },
        z: [170, 180, 190, 200],
        allowUnstable: true,
        maxTurn: 180,
      },
    ],
  },
  {
    name: 'mug-on-shelf',
    description:
      'P36, P37: a ceramic mug mouth down on the rear cup shelf of the upper basket folded down (a level support)',
    items: [{ id: 'mug', type: MUG }],
    steps: [
      { op: 'option', rack: 'upper_rack', name: 'shelf_cup_rear', value: 'down' },
      {
        op: 'drop',
        item: 'mug',
        rack: 'upper_rack',
        at: [
          [440, 300],
          [445, 300],
          [435, 300],
          [440, 340],
          [440, 260],
        ],
        orientation: { preset: 'inverted' },
        z: [185, 175, 165],
        allowUnstable: true,
      },
    ],
  },
  {
    name: 'hollow-inverted',
    description:
      'P01 A: a ceramic mug and a cereal bowl mouth down on the floor of the upper basket',
    items: [
      { id: 'mug', type: MUG },
      { id: 'bowl', type: 'cereal_bowl_vitrelle_159' },
    ],
    steps: [
      {
        op: 'drop',
        item: 'mug',
        rack: 'upper_rack',
        at: UPPER_SPOT_B,
        orientation: { preset: 'inverted' },
      },
      {
        op: 'drop',
        item: 'bowl',
        rack: 'upper_rack',
        at: [[330, 330]],
        orientation: { preset: 'inverted' },
      },
    ],
  },
  {
    name: 'hollow-upright',
    description: 'P01 B: the same mug and bowl at the same places, mouth up',
    items: [
      { id: 'mug', type: MUG },
      { id: 'bowl', type: 'cereal_bowl_vitrelle_159' },
    ],
    steps: [
      {
        op: 'drop',
        item: 'mug',
        rack: 'upper_rack',
        at: UPPER_SPOT_B,
        orientation: { preset: 'upright' },
        // (On the floor of IMG_9131 the spot is on the inner face of the right ridge: the mug
        // slides to its foot and turns 36 degrees as it does, to stand 21 degrees from
        // upright against row C. 35 until then.)
        maxTurn: 40,
      },
      {
        op: 'drop',
        item: 'bowl',
        rack: 'upper_rack',
        at: [
          [330, 330],
          [340, 320],
          [320, 340],
          [330, 300],
        ],
        orientation: { preset: 'upright' },
        maxTurn: 35,
      },
    ],
  },
  {
    name: 'cups-centre-corner',
    description:
      'P28: two tea cups mouth down in the upper basket, one near the axis of the upper arm and one in a corner of the basket (outside the swept circle)',
    items: plates('cup', 'tea_cup_porcelain_210', 2),
    steps: [
      {
        op: 'drop',
        item: 'cup_1',
        rack: 'upper_rack',
        // On the ramp of the floor beside row C, 35 mm right of the arm axis (244, 258), where
        // it stands leaning 14 degrees on a tine of that row. (At 330, 250, where it was let
        // go until IMG_9131, it now comes down on the tips of row C, whose tines are drawn
        // where the photograph has them, and falls off them when the basket is pushed in.)
        at: [
          [270, 258],
          [270, 290],
          [260, 258],
        ],
        orientation: { preset: 'inverted' },
      },
      {
        op: 'drop',
        item: 'cup_2',
        rack: 'upper_rack',
        // The rear right corner is the rear end of the rest along the right wall (IMG_9131):
        // the cup is set on it as `list_slots` seats a tea cup there, leaning to the wall.
        // (Until then it was let straight down at 440, 440 and the spots after it, onto a
        // floor that was drawn level there; on the rest that way it falls over.)
        at: [
          [428, 429],
          [428, 425],
          [428, 433],
        ],
        orientation: { preset: 'inverted', roll_deg: 19, yaw_deg: 90 },
        z: [53, 54, 55],
      },
    ],
  },
  {
    name: 'lid-lower',
    description:
      'P41 A: a 20 g polypropylene container lid lying hollow side down on the tines of the lower basket, over the lower arm',
    items: [{ id: 'lid', type: 'container_lid_pp' }],
    steps: [
      {
        op: 'drop',
        item: 'lid',
        rack: 'lower_rack',
        at: [
          [125, 123],
          [150, 123],
          [100, 123],
          [160, 370],
          [200, 370],
          [380, 370],
        ],
        orientation: { preset: 'inverted' },
        allowUnstable: true,
        clearOfArms: true,
      },
    ],
  },
  {
    name: 'lid-upper',
    description: 'P41 B: the same lid lying hollow side down on the floor of the upper basket',
    items: [{ id: 'lid', type: 'container_lid_pp' }],
    steps: [
      {
        op: 'drop',
        item: 'lid',
        rack: 'upper_rack',
        at: [
          [330, 300],
          [336, 310],
          [300, 300],
          [360, 300],
          [330, 260],
          [330, 340],
          [270, 300],
          [390, 300],
          [300, 250],
          [360, 350],
        ],
        orientation: { preset: 'inverted' },
        allowUnstable: true,
        maxTurn: 60,
      },
    ],
  },
];
