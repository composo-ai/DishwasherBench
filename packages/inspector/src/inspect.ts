/**
 * The virtual inspector (docs/research/standards.md section 10.2): from the residue left on an
 * item to "clean or not".
 *
 *   visibility   an element is visibly soiled when sum_k m_k / m_vis,k >= 1 over its soil
 *                classes, m_vis,k the visibility threshold of class k (for a class with a
 *                visible share f_k: the lower of m_vis,k and f_k times the element's own
 *                initial loading of that class)
 *   area         A = sum of the areas of the visibly soiled elements                       (E6)
 *   specks       n = number of connected visibly soiled regions whose equivalent diameter
 *                sqrt(4 A_region / pi) is at most d_dot; larger regions count through A    (E7)
 *   score        s = min(S_n(n), S_A(A)) with the IEC bands                                (E1)
 *   verdict      clean = n <= n_max and A <= A_max and pooled water <= V_max               (E8)
 *
 * Sub-element coverage (phi_e of section 10.2). Where the rules carry the soil model's rule
 * for it (`visibleShare`), an element is visibly soiled over the share of its area whose
 * residue is above the threshold: phi_e = min(1, sum_k phi_k). What is then seen must not
 * depend on how finely the surface is cut into elements (standards 10.1, requirement 3), so
 * every cut is made on a physical size, the dot of d_dot (area A_dot), and never on the area
 * of an element:
 *
 *   fragment   f_e = the visibly soiled area of a patch of A_dot about the element: the
 *              element and as much of its neighbours as fills the dot (A_dot phi_e for an
 *              element as large as a dot)
 *   seen       the element is seen when f_e is at least a speck of d_min (0.3 mm): a deposit
 *              that is 99.9 % gone leaves nothing an inspector sees in 10 s. A = sum a_e phi_e
 *              over the elements seen
 *   regions    connected groups of seen elements. With X the area of the elements of a region
 *              that are themselves covered by phi_min = a_min / A_dot or more:
 *                X <= A_dot                      one speck (the region is no larger than a dot)
 *                sparse and discrete             round(X_d / A_dot) specks, at least one: the
 *                                                residue of a soil that leaves bare patches
 *                                                (not a film), covering less than half of
 *                                                the area X_d it is seen on, is one fragment
 *                                                per dot, each a speck
 *                otherwise                       no speck: a patch or a film, counted by area
 *
 * A film (`filmClass`: a soil thinned everywhere by the same share, a stain or a fat film) is
 * never broken into specks: its share above the threshold is a soft band about the threshold
 * and it is judged by area.
 *
 * Without the rule an element is visibly soiled as a whole or not at all (the area is resolved
 * to one element: 1 mm2 at the official tier, 4 mm2 at the fast tier, where one visible
 * element is already the whole allowance), and a region is a speck when its area is at most a
 * dot.
 *
 * Residue of standing water (`InspectionItem.standing`): a patch of surface under the water
 * left standing in the item is visibly soiled, as a whole, when what that water leaves on it
 * meets the same visibility index sum_k m_k / m_vis,k >= 1 (the absolute thresholds: the patch
 * need not have carried soil of its own). Its area joins A and its mass the residue of its
 * region; it is a film or a sediment, never a speck.
 *
 * Simplifications against the dossier: redeposited particles are not counted (soil settling
 * from the wash water onto clean items is out of scope, docs/design/scope.md); deep hollow ware
 * is scored as a whole, not surface by surface.
 *
 * Deterministic: elements are visited in index order and regions are numbered by their lowest
 * element.
 */

import type { InspectionRules } from './params.ts';
import type { InspectionItem, ItemInspection, RegionInspection } from './types.ts';

/** IEC cleaning score for a number of specks: 5, 4, 3 up to the bands, then 2. */
export function scoreBySpecks(specks: number, bands: readonly number[]): number {
  for (let i = 0; i < bands.length; i++) if (specks <= (bands[i] as number)) return 5 - i;
  return 5 - bands.length;
}

/** IEC cleaning score for a visibly soiled area (mm2): 5, 4, 3, 2, 1 up to the bands, then 0. */
export function scoreByArea(areaMm2: number, bands: readonly number[]): number {
  for (let i = 0; i < bands.length; i++) if (areaMm2 <= (bands[i] as number)) return 5 - i;
  return Math.max(0, 5 - bands.length);
}

/**
 * Coverage below which a discrete residue is separate fragments (one per dot, each a speck)
 * and from which it is a patch counted by its area: half.
 */
// literal-ok-begin: named arithmetic control, documented where it is declared
const SPARSE_SHARE = 0.5;
// literal-ok-end

/** The verdict on an item at one end of the band of visibility. */
export interface BandVerdict {
  readonly clean: boolean;
  readonly score: number;
}

/**
 * The verdict on an item at the two ends of the band in which its residues become visible
 * (`InspectionRules.visibleBand_mg_cm2`; standards 10.3 states a range per appearance: a
 * tea stain is seen from 5 to 10 % of an IKW-level stain, a coloured residue from 0.02 to
 * 0.05 mg/cm2). `strict` judges every class at the low end (the sharpest eye), `lenient` at
 * the high end. Where the two agree the verdict does not depend on what an inspector sees;
 * where they differ (`decided` false) the item is inside the band, and the nominal verdict of
 * {@link inspectItem} is one reading of it. Without a band in the rules both are the nominal
 * verdict. The limits on specks, area and water are the same in all three.
 */
export function inspectBand(
  item: InspectionItem,
  rules: InspectionRules,
): { readonly strict: BandVerdict; readonly lenient: BandVerdict; readonly decided: boolean } {
  const band = rules.visibleBand_mg_cm2;
  const at = (mass: readonly number[] | undefined): BandVerdict => {
    const found = inspectItem(
      item,
      mass === undefined ? rules : { ...rules, visibleMass_mg_cm2: mass },
    );
    return { clean: found.clean, score: found.score };
  };
  const strict = at(band?.low);
  const lenient = at(band?.high);
  return { strict, lenient, decided: strict.clean === lenient.clean };
}

/** Inspects one item. `rules` must hold a visibility threshold for each of its soil classes. */
export function inspectItem(item: InspectionItem, rules: InspectionRules): ItemInspection {
  const { elements, classCount } = item;
  const n = elements.count;
  if (rules.visibleMass_mg_cm2.length < classCount || rules.visibleFraction.length < classCount) {
    throw new RangeError('inspectItem: no visibility threshold for a soil class of the item');
  }
  const visible = new Uint8Array(n);
  const coverage = new Float32Array(n);
  const shareOf = rules.visibleShare;
  /**
   * The share of element `e` that is visibly soiled with the given masses: 0 or 1 by the
   * visibility index without sub-element coverage, the sum of the classes' shares with it.
   */
  const film = rules.filmClass;
  /** The part of the last `covered` share that is of classes that leave bare patches, not films. */
  let discreteShare = 0;
  const covered = (masses: Float32Array, initial: Float32Array, e: number): number => {
    let sum = 0;
    let discrete = 0;
    for (let k = 0; k < classCount; k++) {
      const m = masses[classCount * e + k] as number;
      if (!(m > 0)) continue;
      let threshold = rules.visibleMass_mg_cm2[k] as number;
      const share = rules.visibleFraction[k] as number;
      if (share > 0)
        threshold = Math.min(threshold, share * (initial[classCount * e + k] as number));
      if (shareOf !== undefined) {
        const phi = shareOf(k, initial[classCount * e + k] as number, m, threshold);
        sum += phi;
        if (film?.[k] !== true) discrete += phi;
      } else {
        sum += threshold > 0 ? m / threshold : Infinity;
      }
    }
    discreteShare = discrete < 1 ? discrete : 1;
    if (shareOf === undefined) return sum >= 1 ? 1 : 0;
    return sum < 1 ? sum : 1;
  };
  const dotArea = (Math.PI * rules.dotDiameterMm * rules.dotDiameterMm) / 4;
  // With sub-element coverage: the smallest fragment of a dot-sized patch that is seen, and
  // the coverage of a patch that holds just that.
  const seenFrom = shareOf === undefined ? 0 : rules.speckMinAreaMm2;
  const minShare = dotArea > 0 ? seenFrom / dotArea : 0;
  // Per-region accumulators, by index into regionIds; one extra slot for elements of no region.
  const slots = item.regionIds.length + 1;
  const slotOf = (e: number): number => {
    const r = elements.region[e] as number;
    return r < item.regionIds.length ? r : item.regionIds.length;
  };
  const area = new Float64Array(slots);
  const initialMass = new Float64Array(slots);
  const residualMass = new Float64Array(slots);
  const visibleArea = new Float64Array(slots);
  const specks = new Int32Array(slots);
  const used = new Uint8Array(slots);
  const share = new Float32Array(n);
  const discrete = new Float32Array(n);
  const { offsets, indices } = elements.neighbours;
  let initialVisible = 0;
  for (let e = 0; e < n; e++) {
    const a = elements.areaMm2[e] as number;
    const slot = slotOf(e);
    used[slot] = 1;
    area[slot] = (area[slot] as number) + a;
    for (let k = 0; k < classCount; k++) {
      // mg/cm2 x mm2 = mg / 100.
      initialMass[slot] =
        (initialMass[slot] as number) +
        ((elements.initial_mg_cm2[classCount * e + k] as number) * a) / 100;
      residualMass[slot] =
        (residualMass[slot] as number) +
        ((elements.residual_mg_cm2[classCount * e + k] as number) * a) / 100;
    }
    const atStart = covered(elements.initial_mg_cm2, elements.initial_mg_cm2, e);
    if (atStart > 0 && atStart >= minShare) initialVisible += a * atStart;
    share[e] = covered(elements.residual_mg_cm2, elements.initial_mg_cm2, e);
    discrete[e] = discreteShare;
  }
  for (let e = 0; e < n; e++) {
    const phi = share[e] as number;
    if (!(phi > 0)) continue;
    const a = elements.areaMm2[e] as number;
    if (shareOf !== undefined) {
      // The visibly soiled area of a dot about the element.
      let fragment: number;
      if (a >= dotArea) {
        fragment = dotArea * phi;
      } else {
        let around = 0;
        let soiled = 0;
        for (let i = offsets[e] as number; i < (offsets[e + 1] as number); i++) {
          const other = indices[i] as number;
          const ao = elements.areaMm2[other] as number;
          around += ao;
          soiled += ao * (share[other] as number);
        }
        const need = dotArea - a;
        fragment = a * phi + (around > need ? need / around : 1) * soiled;
      }
      if (fragment < seenFrom) continue;
    }
    visible[e] = 1;
    coverage[e] = phi;
    const slot = slotOf(e);
    visibleArea[slot] = (visibleArea[slot] as number) + a * phi;
  }

  // Connected visibly soiled regions, by flood fill from the lowest element of each.
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  for (let e = 0; e < n; e++) {
    if (visible[e] === 0 || seen[e] !== 0) continue;
    // Visibly soiled area of the region; the area of its elements that are covered by the
    // smallest share or more, by anything and by a discrete residue; the discrete area.
    let regionArea = 0;
    let extent = 0;
    let discreteExtent = 0;
    let discreteArea = 0;
    seen[e] = 1;
    stack.push(e);
    while (stack.length > 0) {
      const at = stack.pop() as number;
      const a = elements.areaMm2[at] as number;
      regionArea += a * (coverage[at] as number);
      if ((coverage[at] as number) >= minShare) extent += a;
      if (shareOf !== undefined && (discrete[at] as number) >= minShare) {
        discreteExtent += a;
        discreteArea += a * (discrete[at] as number);
      }
      for (let i = offsets[at] as number; i < (offsets[at + 1] as number); i++) {
        const other = indices[i] as number;
        if (visible[other] === 0 || seen[other] !== 0) continue;
        seen[other] = 1;
        stack.push(other);
      }
    }
    let count = 0;
    if (shareOf === undefined) {
      if (regionArea <= dotArea) count = 1;
    } else if (extent <= dotArea) {
      count = 1;
    } else if (discreteExtent > 0 && discreteArea < SPARSE_SHARE * discreteExtent) {
      count = Math.max(1, Math.round(discreteExtent / dotArea));
    }
    if (count > 0) {
      const slot = slotOf(e);
      specks[slot] = (specks[slot] as number) + count;
    }
  }

  // What standing water left where it stood: by area, into the region of each patch.
  let standingVisible = 0;
  let standingMass = 0;
  const standing = item.standing;
  if (standing !== undefined) {
    for (let p = 0; p < standing.count; p++) {
      const a = standing.areaMm2[p] as number;
      let index = 0;
      let mass = 0;
      for (let k = 0; k < classCount; k++) {
        const m = standing.residue_mg_cm2[classCount * p + k] as number;
        if (!(m > 0)) continue;
        mass += m;
        const threshold = rules.visibleMass_mg_cm2[k] as number;
        index += threshold > 0 ? m / threshold : Infinity;
      }
      if (!(mass > 0)) continue;
      const r = standing.region[p] as number;
      const slot = r < item.regionIds.length ? r : item.regionIds.length;
      used[slot] = 1;
      // mg/cm2 x mm2 = mg / 100.
      residualMass[slot] = (residualMass[slot] as number) + (mass * a) / 100;
      standingMass += (mass * a) / 100;
      if (index >= 1) {
        visibleArea[slot] = (visibleArea[slot] as number) + a;
        standingVisible += a;
      }
    }
  }

  const regions: RegionInspection[] = [];
  let totalInitial = 0;
  let totalResidual = 0;
  let totalVisible = 0;
  let totalSpecks = 0;
  for (let s = 0; s < slots; s++) {
    if (used[s] === 0) continue;
    totalInitial += initialMass[s] as number;
    totalResidual += residualMass[s] as number;
    totalVisible += visibleArea[s] as number;
    totalSpecks += specks[s] as number;
    regions.push({
      regionId: item.regionIds[s] ?? '',
      areaMm2: area[s] as number,
      initialMass_mg: initialMass[s] as number,
      residualMass_mg: residualMass[s] as number,
      visibleAreaMm2: visibleArea[s] as number,
      specks: specks[s] as number,
    });
  }
  const score = Math.min(
    scoreBySpecks(totalSpecks, rules.speckBands),
    scoreByArea(totalVisible, rules.areaBandsMm2),
  );
  return {
    itemId: item.itemId,
    clean:
      totalSpecks <= rules.maxSpecks &&
      totalVisible <= rules.maxAreaMm2 &&
      item.pooledWater_mL <= rules.maxWaterMl,
    score,
    initialMass_mg: totalInitial,
    residualMass_mg: totalResidual,
    initialVisibleAreaMm2: initialVisible,
    visibleAreaMm2: totalVisible,
    specks: totalSpecks,
    pooledWater_mL: item.pooledWater_mL,
    standingVisibleAreaMm2: standingVisible,
    standingResidue_mg: standingMass,
    regions,
    visible,
    coverage,
  };
}
