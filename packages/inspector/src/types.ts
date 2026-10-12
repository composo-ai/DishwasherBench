/**
 * Types of the virtual inspector: what it is shown of an item after the wash and what it
 * reports (docs/research/standards.md section 10; docs/design/sim-core.md section 5.6).
 *
 * The input is independent of how the simulation represents surfaces: a list of soil elements
 * with their areas, their residue by soil class and their neighbours on the surface. Units are
 * those of the standards dossier: mm2, mg/cm2 of dry soil, mL of water.
 */

/** The soil elements of one item: every piece of its surface that carried soil at the start. */
export interface InspectionElements {
  /** Number of elements N. */
  readonly count: number;
  /** [N] index into the item's `regionIds`, or 0xFFFF for none. */
  readonly region: Uint16Array;
  /** [N] area of the element, mm2. */
  readonly areaMm2: Float32Array;
  /** [N x C] dry soil per area at the start and at the end, mg/cm2, per soil class. */
  readonly initial_mg_cm2: Float32Array;
  readonly residual_mg_cm2: Float32Array;
  /**
   * The elements that touch each element on the surface, in compressed rows: the neighbours of
   * element `e` are `indices[offsets[e] .. offsets[e + 1] - 1]`. Symmetric.
   */
  readonly neighbours: { readonly offsets: Uint32Array; readonly indices: Uint32Array };
}

/** One item as the inspector is shown it. */
export interface InspectionItem {
  readonly itemId: string;
  /** Ids of the surface regions of the item. */
  readonly regionIds: readonly string[];
  /** Number of soil classes C of the element arrays. */
  readonly classCount: number;
  readonly elements: InspectionElements;
  /** Water standing in the cavities of the item at the end, mL. */
  readonly pooledWater_mL: number;
  /**
   * What the water standing in the item leaves where it stood (standards 10.2 counts residue
   * left by pooled liquor; chemistry 5.3, R2: everything suspended and dissolved in a pool is
   * left on its footprint). Absent: no standing water, or none that holds soil.
   */
  readonly standing?: StandingResidue;
}

/**
 * The residue of the water standing in an item, as patches of its surface: one per block of
 * surface under the water that faces up. They are not soil elements (they need not have
 * carried soil) and have no neighbours: a patch is visibly soiled as a whole or not at all,
 * and counts by its area, never as a speck.
 */
export interface StandingResidue {
  /** Number of patches P. */
  readonly count: number;
  /** [P] index into `regionIds` of the item, or 0xFFFF. */
  readonly region: Uint16Array;
  /** [P] area, mm2. */
  readonly areaMm2: Float32Array;
  /** [P x C] dry residue per soil class, mg/cm2. */
  readonly residue_mg_cm2: Float32Array;
}

/** What the inspector finds on one region of an item. */
export interface RegionInspection {
  readonly regionId: string;
  /** Area of the soil elements of the region, mm2. */
  readonly areaMm2: number;
  /** Dry soil on the region at the start and at the end, mg. */
  readonly initialMass_mg: number;
  readonly residualMass_mg: number;
  /** Area still visibly soiled, mm2. */
  readonly visibleAreaMm2: number;
  /** Separate visibly soiled regions small enough to count as specks. */
  readonly specks: number;
}

/** What the inspector finds on one item. */
export interface ItemInspection {
  readonly itemId: string;
  /** True when the item meets the rule: few enough specks, little enough area, little enough water. */
  readonly clean: boolean;
  /** IEC cleaning score 0 to 5: the lower of the score by specks and the score by area. */
  readonly score: number;
  /** Dry soil on the item at the start and at the end, mg. */
  readonly initialMass_mg: number;
  readonly residualMass_mg: number;
  /** Area visibly soiled at the start and at the end, mm2. */
  readonly initialVisibleAreaMm2: number;
  readonly visibleAreaMm2: number;
  /** Separate visibly soiled regions small enough to count as specks. */
  readonly specks: number;
  /** Water standing in the cavities of the item, mL. */
  readonly pooledWater_mL: number;
  /**
   * Of `visibleAreaMm2` and of `residualMass_mg`: what the water standing in the item left
   * where it stood, mm2 and mg (0 without standing water that holds soil).
   */
  readonly standingVisibleAreaMm2: number;
  readonly standingResidue_mg: number;
  /** Per region of the item that has soil elements, in the order of `regionIds`. */
  readonly regions: readonly RegionInspection[];
  /** [N] 1 where an element is visibly soiled at the end, for drawing a residue map. */
  readonly visible: Uint8Array;
  /**
   * [N] share of each element that is visibly soiled at the end: 0 or 1 without sub-element
   * coverage, the share of its area above the visibility threshold with it (0 where that is
   * less than a speck).
   */
  readonly coverage: Float32Array;
}
