/**
 * The registered parameters of the virtual inspector (docs/research/standards.md sections 6.1
 * and 10; docs/design/platform.md section 6, "Clean").
 *
 * The keys are under `inspect.*` and belong to the `soil` hash group: they are read after the
 * wash and never change an exposure. The visibility thresholds of the soil classes are soil
 * properties and are registered with the soil model (`soil.<class>.visibleMass`); the
 * orchestrator hands them to the inspector with the rules below.
 */

import type { AnyParamDef, ParamSet } from '@spotless/sim-params';

const ST = 'standards';

/** The parameters the inspector reads, to be contributed to the registry. */
export const INSPECTOR_PARAM_DEFS: readonly AnyParamDef[] = [
  {
    key: 'inspect.puddleDepthMm',
    unit: 'mm',
    default: 0.5,
    min: 0.05,
    max: 5,
    tag: 'ESTIMATED',
    source: `${ST} 10.2 (E8), P01; review of the first build: water left standing deeper than this on an upward face of an item counts as pooled water (a puddle on a level board or in a hollow no basin was found for), not as film`,
    group: 'soil',
  },
  {
    key: 'inspect.puddleMinNormalZ',
    unit: '1',
    default: 0.5,
    min: 0,
    max: 1,
    tag: 'SYN',
    source:
      'review of the first build: vertical component of the normal above which a face counts as facing up for inspect.puddleDepthMm (the pendant ridge of a lower edge is as deep but hangs: it is film)',
    group: 'soil',
  },
  {
    key: 'inspect.liftWarnRatio',
    unit: '1',
    default: 0.8,
    min: 0.1,
    max: 5,
    tag: 'ESTIMATED',
    source:
      'scope note ("items that the screening marks as likely to be moved by jets are reported"); jets 11.2 step 5f: peak upward jet force over the weight of an item above which the wash reports it as likely to be moved',
    group: 'soil',
  },
  {
    key: 'inspect.overlapDepthMm',
    unit: 'mm',
    default: 0.75,
    min: 0.1,
    max: 10,
    tag: 'SYN',
    source:
      'review of the first build; loader standard loads (the loading physics leaves overlaps of up to 0.5 mm): depth by which one item may lie inside another before the wash reports the placement as impossible',
    group: 'soil',
  },
  {
    key: 'inspect.maxSpecks',
    unit: '1',
    default: 4,
    min: 0,
    max: 20,
    tag: 'VERIFIED',
    source: `${ST} 10.2 (E8), 6.1: most visible specks on an item that is clean (IEC score 4)`,
    group: 'soil',
  },
  {
    key: 'inspect.maxAreaMm2',
    unit: 'mm2',
    default: 4,
    min: 0,
    max: 200,
    tag: 'VERIFIED',
    source: `${ST} 10.2 (E8), 6.1: largest visibly soiled area of an item that is clean (IEC score 4)`,
    group: 'soil',
  },
  {
    key: 'inspect.maxWaterMl',
    unit: 'mL',
    default: 1,
    min: 0,
    max: 20,
    tag: 'ESTIMATED',
    source: `${ST} 10.2 (E8): most water an item may hold in its cavities and be clean (V_max)`,
    group: 'soil',
  },
  {
    key: 'inspect.dotDiameterMm',
    unit: 'mm',
    default: 2,
    min: 0.3,
    max: 5,
    tag: 'ESTIMATED',
    source: `${ST} 10.2 (E7): a connected visibly soiled region of at most this equivalent diameter counts as one speck (d_dot)`,
    group: 'soil',
  },
  {
    key: 'inspect.speckMinDiameterMm',
    unit: 'mm',
    default: 0.3,
    min: 0.1,
    max: 1,
    tag: 'ESTIMATED',
    source: `${ST} 10.2 (E7), 10.3, 14 (d_min 0.3 mm, 0.2 to 0.5: acuity of 1 arcminute at 0.4 m, tripled for contrast and the 10 s viewing limit): equivalent diameter below which a residue is not seen. Read only where the soil model gives the share of an element that is above the visibility threshold (sub-element coverage): the residue of a patch the size of a dot (inspect.dotDiameterMm) is then one fragment of that share of the dot, seen from this size up, whatever the size of the elements`,
    group: 'soil',
  },
  {
    kind: 'vector',
    key: 'inspect.speckBands',
    unit: '1',
    default: [0, 4, 10],
    min: 0,
    max: 1000,
    tag: 'VERIFIED',
    source: `${ST} 6.1 (IEC 60436 Ed. 3.1 as transcribed by the US DOE): most specks for the scores 5, 4 and 3; more score 2`,
    group: 'soil',
  },
  {
    kind: 'vector',
    key: 'inspect.areaBandsMm2',
    unit: 'mm2',
    default: [0, 4, 20, 50, 200],
    min: 0,
    max: 100000,
    tag: 'VERIFIED',
    source: `${ST} 6.1: largest soiled area for the scores 5, 4, 3, 2 and 1; more scores 0`,
    group: 'soil',
  },
];

/** What decides whether an item is clean, as numbers. */
export interface InspectionRules {
  /** Most specks and most visibly soiled area (mm2) of a clean item. */
  readonly maxSpecks: number;
  readonly maxAreaMm2: number;
  /** Most water (mL) a clean item holds in its cavities. */
  readonly maxWaterMl: number;
  /** Largest equivalent diameter of a region that counts as a speck, mm. */
  readonly dotDiameterMm: number;
  /** Speck counts up to which the IEC score is 5, 4, 3 (then 2). */
  readonly speckBands: readonly number[];
  /** Soiled areas (mm2) up to which the IEC score is 5, 4, 3, 2, 1 (then 0). */
  readonly areaBandsMm2: readonly number[];
  /**
   * Per soil class of the elements: dry mass per area above which a residue is visible,
   * mg/cm2, and the share of an element's own initial loading above which it is visible (0 for
   * a class judged by mass alone; where both apply the lower threshold decides).
   */
  readonly visibleMass_mg_cm2: readonly number[];
  readonly visibleFraction: readonly number[];
  /**
   * Per soil class, where the caller knows it: the band in which a residue becomes visible,
   * mg/cm2 (standards 10.3 gives a range per appearance, not a number). `inspectBand` judges an
   * item at both ends of it.
   */
  readonly visibleBand_mg_cm2?: {
    readonly low: readonly number[];
    readonly high: readonly number[];
  };
  /**
   * Sub-element coverage (standards 10.2, phi_e), when the soil model provides it: the share
   * of an element of soil class `classIndex` whose residue is above `threshold`, from its
   * loading at the start and now (mg/cm2 for the three). Absent: an element is visibly soiled
   * as a whole or not at all.
   */
  readonly visibleShare?: (
    classIndex: number,
    initial: number,
    residual: number,
    threshold: number,
  ) => number;
  /**
   * `visibleShare` for one element as a function of the threshold alone (the same numbers),
   * when the soil model provides it: for a caller that asks for many thresholds.
   */
  readonly visibleShareOf?: (
    classIndex: number,
    initial: number,
    residual: number,
  ) => (threshold: number) => number;
  /**
   * Per soil class, with `visibleShare`: true for a class whose residue is a film thinned
   * everywhere by the same share (a stain, a fat film), which is judged by area and never
   * broken into specks; false or absent for a class that leaves bare patches.
   */
  readonly filmClass?: readonly boolean[];
  /**
   * Smallest visibly soiled area of a dot-sized patch that is seen, mm2 (a speck of
   * `inspect.speckMinDiameterMm`); used with `visibleShare` only.
   */
  readonly speckMinAreaMm2: number;
}

/**
 * The rules from a parameter set built on a registry that holds `INSPECTOR_PARAM_DEFS`, with
 * the visibility thresholds of the soil classes given by the caller (dry mass per area in
 * kg/m2, as the soil model registers them; 1 mg/cm2 = 0.01 kg/m2), and with them, where the
 * soil model has one, its rule for the share of an element that is above a threshold.
 */
export function inspectionRules(
  params: ParamSet,
  visibility: {
    readonly mass: readonly number[];
    readonly fraction: readonly number[];
    readonly share?: InspectionRules['visibleShare'];
    readonly shareOf?: InspectionRules['visibleShareOf'];
    readonly film?: readonly boolean[];
    /** The band of visibility per class, kg/m2 (see `InspectionRules.visibleBand_mg_cm2`). */
    readonly band?: { readonly low: readonly number[]; readonly high: readonly number[] };
  },
): InspectionRules {
  const speck = params.get('inspect.speckMinDiameterMm');
  return {
    ...(visibility.share === undefined ? {} : { visibleShare: visibility.share }),
    ...(visibility.shareOf === undefined ? {} : { visibleShareOf: visibility.shareOf }),
    ...(visibility.film === undefined ? {} : { filmClass: [...visibility.film] }),
    ...(visibility.band === undefined
      ? {}
      : {
          visibleBand_mg_cm2: {
            low: visibility.band.low.map((kgPerM2) => kgPerM2 * 100),
            high: visibility.band.high.map((kgPerM2) => kgPerM2 * 100),
          },
        }),
    speckMinAreaMm2: (Math.PI * speck * speck) / 4,
    maxSpecks: params.get('inspect.maxSpecks'),
    maxAreaMm2: params.get('inspect.maxAreaMm2'),
    maxWaterMl: params.get('inspect.maxWaterMl'),
    dotDiameterMm: params.get('inspect.dotDiameterMm'),
    speckBands: params.getVector('inspect.speckBands'),
    areaBandsMm2: params.getVector('inspect.areaBandsMm2'),
    visibleMass_mg_cm2: visibility.mass.map((kgPerM2) => kgPerM2 * 100),
    visibleFraction: [...visibility.fraction],
  };
}
