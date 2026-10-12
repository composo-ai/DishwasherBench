/**
 * Example item definitions used only by this package's tests (the catalogue package owns the
 * real item data). They are written in authoring units, like catalogue files.
 *
 * Dimensions and masses come from docs/research/items.md: section 10.1 for outer dimensions and
 * masses (tags as given there) and section 10.2 for the profiles, which are all [ESTIMATED]
 * (fitted to those dimensions and masses). Where a dossier profile is a mid-surface that reaches
 * the product's outer radius, the rim vertex is pulled in by half a wall thickness here so that
 * the outer diameter is the product's.
 */

import type { GeometryDefMm } from './authoring.ts';

/** One example: its definition, the density to weigh it with and what the dossier says. */
export interface ExampleItem {
  readonly def: GeometryDefMm;
  /** Density per material id used by the definition, kg/m^3 (items.md section 3.1). */
  readonly densities: Readonly<Record<string, number>>;
  /** Mass the dossier gives for the product or item class, kg, as a range. */
  readonly massRangeKg: readonly [number, number];
  /** Where that mass comes from. */
  readonly massSource: string;
}

/** Densities of items.md section 3.1 used below, kg/m^3. */
const PORCELAIN = 2400; // [VERIFIED] 2300 to 2500, use 2400
const SODA_LIME = 2500; // [VERIFIED] 2400 to 2800, use 2500
const CRYSTAL_LEAD_FREE = 2550; // [ESTIMATED]
const STAINLESS = 7900; // [RECALLED] 7900 to 8000
const POLYPROPYLENE = 910; // [VERIFIED] 910 to 940

export const EXAMPLE_ITEMS = {
  /**
   * Dinner plate, 270 mm: IKEA 365+ plate 27 cm (item 2), D 270, H 30, 770 g [VERIFIED];
   * profile and foot ring (r 85, 6 x 4) [ESTIMATED], dossier model mass 792 g.
   */
  dinnerPlate: {
    def: {
      class: 'sor',
      material: 'porcelain_glazed',
      profileMm: [
        [0, 4, 5.2],
        [88, 4, 5.2],
        [100, 10, 5.2],
        [132.4, 27, 5.2],
      ],
      footRing: { rMm: 85, widthMm: 6, heightMm: 4, material: 'porcelain_unglazed' },
    },
    densities: { porcelain_glazed: PORCELAIN, porcelain_unglazed: PORCELAIN },
    massRangeKg: [0.693, 0.847],
    massSource: 'items.md 10.1 item 2: 770 g [VERIFIED], +-10 % (2.4: monolithic ceramic)',
  },
  /**
   * Cereal bowl, 160 mm: IKEA 365+ bowl 16 cm (item 10), D 160, H 70, 440 g [VERIFIED];
   * profile [ESTIMATED], dossier model mass 466 g.
   */
  bowl: {
    def: {
      class: 'sor',
      material: 'porcelain_glazed',
      profileMm: [
        [0, 3, 5],
        [40, 3, 5],
        [61, 20, 5],
        [74, 45, 5],
        [77.5, 67.5, 5],
      ],
      footRing: { rMm: 40, widthMm: 5, heightMm: 3, material: 'porcelain_unglazed' },
    },
    densities: { porcelain_glazed: PORCELAIN, porcelain_unglazed: PORCELAIN },
    massRangeKg: [0.396, 0.484],
    massSource: 'items.md 10.1 item 10: 440 g [VERIFIED], +-10 %',
  },
  /**
   * Mug with a loop handle: generic ceramic mug (item 18), D 80, H 100, 351 g [VERIFIED]. Foot
   * ring and handle (attach 25 to 80 mm, reach 30, section 12 x 8) are the [ESTIMATED] schema
   * example of section 9. The dossier profile has its mid-surface at r = 40 mm (84 mm outside);
   * here the outside is 80 mm and the wall 5 mm, which gives the verified mass.
   */
  mug: {
    def: {
      class: 'sor',
      material: 'porcelain_glazed',
      profileMm: [
        [0, 4.75, 5.5],
        [33, 4.75, 5.5],
        [35.5, 8.5, 5],
        [37.5, 97.5, 5],
      ],
      footRing: { rMm: 30, widthMm: 4, heightMm: 2.5, material: 'porcelain_unglazed' },
      addons: [{ type: 'handle_loop', attachZMm: [25, 80], reachMm: 30, sectionMm: [12, 8] }],
    },
    densities: { porcelain_glazed: PORCELAIN, porcelain_unglazed: PORCELAIN },
    massRangeKg: [0.316, 0.386],
    massSource: 'items.md 10.1 item 18: 351 g [VERIFIED], +-10 %',
  },
  /**
   * Tumbler: Duralex Picardie 25 cl (item 27), D 87, H 90, 220 g [VERIFIED]; profile with a 7 mm
   * base and a 4 to 3 mm wall [ESTIMATED], dossier model mass 211 g.
   */
  tumbler: {
    def: {
      class: 'sor',
      material: 'glass_soda_lime',
      profileMm: [
        [0, 3.5, 7],
        [27, 3.5, 7],
        [29, 8, 4],
        [39, 60, 3],
        [42, 88.5, 3],
      ],
    },
    densities: { glass_soda_lime: SODA_LIME },
    massRangeKg: [0.198, 0.242],
    massSource: 'items.md 10.1 item 27: 220 g [VERIFIED], +-10 %',
  },
  /**
   * Wine glass: Zwiesel Pure Cabernet 540 ml (item 33), H 244, D 92, 184 g [VERIFIED]; bowl
   * profile, stem D 8 and foot D 85 x 3.2 [ESTIMATED], dossier model mass 161 g (ratio 0.88).
   */
  wineGlass: {
    def: {
      class: 'sor',
      material: 'crystal_lead_free',
      profileMm: [
        [4, 120, 3],
        [30, 128, 1.6],
        [45.4, 165, 1.1],
        [44, 200, 1.0],
        [33, 243.5, 0.9],
      ],
      addons: [{ type: 'stem_foot', stemRadiusMm: 4, footRadiusMm: 42.5, footThicknessMm: 3.2 }],
    },
    densities: { crystal_lead_free: CRYSTAL_LEAD_FREE },
    massRangeKg: [0.145, 0.203],
    massSource:
      'items.md 10.1 item 33: 184 g [VERIFIED]; the dossier profile models 161 g, so 145 to 203 g',
  },
  /**
   * Dinner fork: L 185 to 211 [VERIFIED], 40 to 55 g [RECALLED] (item 42). Shank, shoulder and
   * four prongs are this package's own proportions.
   */
  fork: {
    def: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [0, 0, 1.5], widthMm: 14, thicknessMm: 3 },
        { pMm: [70, 0, 1.5], widthMm: 9, thicknessMm: 3 },
        { pMm: [110, 0, 1.5], widthMm: 6, thicknessMm: 3 },
        { pMm: [136, 0, 1.5], widthMm: 24, thicknessMm: 2.2 },
      ],
      head: { type: 'fork_tines', count: 4, lengthMm: 53, widthMm: 24, thicknessMm: 2.2 },
    },
    densities: { stainless_steel: STAINLESS },
    massRangeKg: [0.04, 0.055],
    massSource: 'items.md 10.1 item 42: 40 to 55 g [RECALLED]',
  },
  /**
   * Table spoon: L 190 [VERIFIED], 50 to 60 g [RECALLED] (item 44). The shank rises from the
   * table to the rim of the bowl and ends level, so that the bowl is level and its lowest point
   * is on z = 0.
   */
  spoon: {
    def: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [0, 0, 1.5], widthMm: 14, thicknessMm: 3 },
        { pMm: [70, 0, 5], widthMm: 9, thicknessMm: 3 },
        { pMm: [116, 0, 9.75], widthMm: 8, thicknessMm: 3 },
        { pMm: [128, 0, 9.75], widthMm: 8, thicknessMm: 3 },
      ],
      head: { type: 'spoon_bowl', lengthMm: 62, widthMm: 42, depthMm: 9, thicknessMm: 1.5 },
    },
    densities: { stainless_steel: STAINLESS },
    massRangeKg: [0.05, 0.06],
    massSource: 'items.md 10.1 item 44: 50 to 60 g [RECALLED]',
  },
  /**
   * Dinner knife with a solid handle: L 210 to 248 [VERIFIED], 80 to 100 g [RECALLED] (item 41).
   */
  knife: {
    def: {
      class: 'rod',
      material: 'stainless_steel',
      nodes: [
        { pMm: [0, 0, 3.5], widthMm: 15, thicknessMm: 7 },
        { pMm: [100, 0, 3.5], widthMm: 13, thicknessMm: 7 },
      ],
      head: { type: 'blade', lengthMm: 120, widthMm: 19, thicknessMm: 2 },
    },
    densities: { stainless_steel: STAINLESS },
    massRangeKg: [0.08, 0.1],
    massSource: 'items.md 10.1 item 41: 80 to 100 g [RECALLED]',
  },
  /**
   * Food container, 1 litre, without its lid: polypropylene, walls 1.2 to 2.0 mm [ESTIMATED]
   * (2.5). Products of this size weigh 120 to 130 g with a 15 to 40 g lid and clips (items 85,
   * 86, 88); a 0.6 L tub alone weighs 45 to 50 g [VERIFIED] (item 87). 170 x 120 x 60 mm at the
   * top with walls drafted 4 degrees (so that it nests) holds 1.05 L to the brim.
   */
  foodContainer: {
    def: {
      class: 'box_shell',
      material: 'polypropylene',
      lengthMm: 170,
      widthMm: 120,
      heightMm: 60,
      wallMm: 1.6,
      cornerRadiusMm: 22,
      flangeMm: 4,
      draftDeg: 4,
    },
    densities: { polypropylene: POLYPROPYLENE },
    massRangeKg: [0.06, 0.11],
    massSource:
      'items.md 10.1 items 85 to 88: 1 L container 120 to 130 g with a 15 to 40 g lid; 0.6 L tub 45 to 50 g',
  },
} as const satisfies Record<string, ExampleItem>;
