/**
 * The registered parameters of the scene (docs/design/sim-core.md section M3, "Parameters";
 * docs/design/scope.md, "Calibration is a first-class feature"): every geometric constant the
 * scene builder reads has a key, a unit, a default, a range, a confidence tag and a source here,
 * and is contributed to the registry of `@spotless/sim-params`.
 *
 * All keys are under `scene.*`, so they belong to the `hydro` hash group: changing one changes
 * the key of every cached exposure.
 *
 * Units: SI (metres, radians); ratios are pure numbers.
 */

import {
  createParamSet,
  createRegistry,
  SHARED_PARAM_DEFS,
  type AnyParamDef,
  type ParamSet,
} from '@spotless/sim-params';

const M3 = 'sim-core section M3';

/** The parameters the scene builder reads, to be contributed to the registry. */
export const SCENE_PARAM_DEFS: readonly AnyParamDef[] = [
  {
    key: 'scene.deadDepth',
    unit: 'm',
    default: 0.2e-3,
    min: 0.02e-3,
    max: 1e-3,
    tag: 'SYN',
    source: `${M3} (scene.deadDepth); section 3.1: an element is dead when the point this far off it, along its normal, lies inside another part of the same shape (two parts lying face to face); also the margin of the chamber box outside which enclosure blocks are dropped`,
    group: 'hydro',
  },
  {
    key: 'scene.buriedDepth',
    unit: 'm',
    default: 5e-6,
    min: 1e-6,
    max: 1e-3,
    tag: 'SYN',
    source: `${M3} (section 3.1, dead elements): a cell, or a piece of rounded edge, whose centre lies deeper than this inside another part of the same shape is buried; a few micrometres, so that a surface that dips into another part is not counted twice (review of the scene build, wine glass stem in its foot)`,
    group: 'hydro',
  },
  {
    key: 'scene.machineBlockRatio',
    unit: '1',
    default: 2,
    min: 1,
    max: 4,
    tag: 'SYN',
    source:
      'sim-core section 3.3: tub, door liner, ceiling and basket walls carry blocks of 2 D_B; applied to every machine part that is not a wire',
    group: 'hydro',
  },
  {
    key: 'scene.slenderWidth',
    unit: 'm',
    default: 0.05,
    min: 0,
    max: 0.2,
    tag: 'SYN',
    source:
      'sim-core M6 "Sampling" (finer elements on slender parts): an item whose second-largest extent in its own frame is at most this is slender and carries blocks of scene.slenderBlockRatio D_B: the cutlery and the utensils (in the catalogue a dinner knife is 19 mm wide, a soup spoon 44 mm, a serving spoon 49 mm; the narrowest drinking vessel, the test glass, is 60 mm across). 0 takes no item as slender',
    group: 'hydro',
  },
  {
    key: 'scene.slenderBlockRatio',
    unit: '1',
    default: 1,
    min: 0.25,
    max: 1,
    tag: 'SYN',
    source:
      'sim-core M6 "Sampling" (finer elements on slender parts): block size of a slender item (scene.slenderWidth) over D_B. A soil cell is a quarter of a block and the visible soiled area of an item is a sum of whole cells, so finer blocks measure the few square millimetres a verdict on cutlery hangs on more finely. Measured on the standard load at the fast tier (sim-core scripts/variance-study.ts, 16 washes): at 0.5 the blocks rose by 29 %, the verdicts on which two simulation seeds disagree rose from 1.7 to 2.5 of 68 (knives joined the forks and glasses), and the agreement with the official tier stayed at 95 %: the finer cells resolve thin strips whose exposure scatters more. The default 1 therefore keeps the blocks of the other items; the rule is here to be measured again when the exposure of such strips is steadier',
    group: 'hydro',
  },
  {
    key: 'scene.lineElementRatio',
    unit: '1',
    default: 1.5,
    min: 0.5,
    max: 4,
    tag: 'SYN',
    source: `${M3} (scene.lineElement 3 mm at a 2 mm block): length of a line element in blocks`,
    group: 'hydro',
  },
  {
    key: 'scene.lineMaxRadius',
    unit: 'm',
    default: 3e-3,
    min: 0,
    max: 0.02,
    tag: 'SYN',
    source:
      'scene brief: capsules up to this radius (rack wires, tines, whisk wires, chopsticks) are line elements that carry their whole circumference; thicker capsules (stems, knobs) are gridded round their axis like a shell of revolution (sim-core section 3.1 table)',
    group: 'hydro',
  },
  {
    key: 'scene.cutMerge',
    unit: '1',
    default: 0.25,
    min: 0,
    max: 0.5,
    tag: 'SYN',
    source: `${M3} (scene.cutMerge); section 3.3: a cut cell below this area fraction joins its largest face neighbour`,
    group: 'hydro',
  },
  {
    key: 'scene.stitchReach',
    unit: '1',
    default: 0.75,
    min: 0.25,
    max: 2,
    tag: 'SYN',
    source: `${M3} (scene.stitchReach); section 3.1: boundary elements of different parts of one item within this many block widths are joined by a stitch link`,
    group: 'hydro',
    bracket: 'G4',
  },
  {
    key: 'scene.wireTouchGap',
    unit: 'm',
    default: 0.3e-3,
    min: 0,
    max: 2e-3,
    tag: 'SYN',
    source:
      'scene first build: two wires of one basket or utensil are joined where their surfaces come within this distance (welds and crossings overlap; parallel wires a few millimetres apart do not)',
    group: 'hydro',
  },
  {
    key: 'scene.contactGap',
    unit: 'm',
    default: 4e-3,
    min: 0.5e-3,
    max: 10e-3,
    tag: 'ESTIMATED',
    source:
      'scene brief (about twice the capillary length); films sections 0.2, 2.1 and 2.2 (l_c = sqrt(sigma / (rho g)): about 2.0 mm in main-wash liquor and 2.6 mm in clean water at 60 C); sim-core M7.6 gap reservoirs',
    validity: 'surfaces of different bodies closer than this can hold a capillary bridge',
    group: 'hydro',
    bracket: 'G4',
    calibration: 'contacts',
  },
  {
    key: 'scene.dripLevelTolerance',
    unit: 'm',
    default: 10e-6,
    min: 0,
    max: 1e-3,
    tag: 'SYN',
    source:
      'scene first build: a neighbour counts as lower, so that water runs on to it, only if its centre is lower by more than this; keeps the blocks of a level rim from draining into each other by rounding noise',
    group: 'hydro',
  },
  {
    key: 'scene.pitMinNormalZ',
    unit: '1',
    default: 0.1,
    min: 0,
    max: 0.5,
    tag: 'SYN',
    source:
      'sim-core section 3.7 item 4 (terminal blocks are basin pits when facing up, drip sites when facing sideways or down): a terminal block whose outward normal has a vertical component above this holds water instead of dripping',
    group: 'hydro',
    bracket: 'G4',
  },
  {
    key: 'scene.dripStartOffset',
    unit: 'm',
    default: 0.1e-3,
    min: 1e-6,
    max: 1e-3,
    tag: 'SYN',
    source:
      'scene first build: the drip ray starts this far off the surface, so that it does not strike the block it leaves',
    group: 'hydro',
  },
  {
    key: 'scene.rayChordError',
    unit: 'm',
    default: 0.05e-3,
    min: 0.005e-3,
    max: 0.2e-3,
    tag: 'SYN',
    source:
      'sim-core section 3.5 (triangle hierarchy with hits polished on the analytic primitive; 0.2 mm there) and decision D4; scope note. 0.05 mm keeps the silhouette of every surface within 2.5 % of a 2 mm jet',
    validity:
      'hit points and normals are analytic whatever the value; it bounds the error of silhouettes, of which triangle is struck first and of rays that graze',
    group: 'hydro',
  },
  {
    key: 'scene.basinSampleStep',
    unit: 'm',
    default: 0.1e-3,
    min: 0.01e-3,
    max: 1e-3,
    tag: 'SYN',
    source:
      'sim-core section 3.7 item 5 (V(level) on shells of revolution by one-dimensional quadrature): spacing of the meridian samples of that quadrature',
    group: 'hydro',
  },
  {
    key: 'scene.basinMinDepth',
    unit: 'm',
    default: 0.1e-3,
    min: 0,
    max: 2e-3,
    tag: 'SYN',
    source:
      'scene first build: a cavity whose crest stands less than this above its floor is reported as no basin (a film, not a pool; film.poolDepth of sim-core M7.6 separates thin puddles)',
    group: 'hydro',
  },
  {
    key: 'scene.basinGridRatio',
    unit: '1',
    default: 1.5,
    min: 1.05,
    max: 4,
    tag: 'SYN',
    source:
      'review of the first build: width of the columns of the terrain that is filled to find the hollows of box and stretched shells, in block sizes; above 1 so that the blocks of a wall leave no gap between columns',
    group: 'hydro',
  },
  {
    key: 'scene.basinMinVolume',
    unit: 'm3',
    default: 0.5e-6,
    min: 0,
    max: 20e-6,
    tag: 'SYN',
    source:
      'review of the first build (standards: 1 mL of standing water makes an item not clean): a hollow found by filling the terrain of an item (box shells, stretched shells) that holds less than this is reported as no basin',
    group: 'hydro',
  },
];

/** Number of points of the level and volume table of a basin (sim-core M3, `scene.basinLevels`). */
export const BASIN_LEVELS = 64;

/** The resolved values the scene builder works with. SI units. */
export interface SceneParams {
  /** Standard gravity, m/s2 (`phys.gravity`). */
  readonly gravity: number;
  readonly deadDepth: number;
  readonly buriedDepth: number;
  readonly machineBlockRatio: number;
  readonly slenderWidth: number;
  readonly slenderBlockRatio: number;
  readonly lineElementRatio: number;
  readonly lineMaxRadius: number;
  readonly cutMerge: number;
  readonly stitchReach: number;
  readonly wireTouchGap: number;
  readonly contactGap: number;
  readonly dripLevelTolerance: number;
  readonly pitMinNormalZ: number;
  readonly dripStartOffset: number;
  readonly rayChordError: number;
  readonly basinSampleStep: number;
  readonly basinMinDepth: number;
  readonly basinMinVolume: number;
  readonly basinGridRatio: number;
}

let defaults: ParamSet | undefined;

/**
 * The parameter set of the registry made of the shared definitions of `@spotless/sim-params`
 * and {@link SCENE_PARAM_DEFS}, at its defaults: what the scene builder uses when it is given no
 * set. A caller that composes the registry of the whole simulation passes its own set instead.
 */
export function defaultSceneParamSet(): ParamSet {
  defaults ??= createParamSet(
    createRegistry({ contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS] }),
  );
  return defaults;
}

/** Reads the scene's parameters from a parameter set (default: the registry defaults). */
export function resolveSceneParams(params: ParamSet = defaultSceneParamSet()): SceneParams {
  return {
    gravity: params.get('phys.gravity'),
    deadDepth: params.get('scene.deadDepth'),
    buriedDepth: params.get('scene.buriedDepth'),
    machineBlockRatio: params.get('scene.machineBlockRatio'),
    slenderWidth: params.get('scene.slenderWidth'),
    slenderBlockRatio: params.get('scene.slenderBlockRatio'),
    lineElementRatio: params.get('scene.lineElementRatio'),
    lineMaxRadius: params.get('scene.lineMaxRadius'),
    cutMerge: params.get('scene.cutMerge'),
    stitchReach: params.get('scene.stitchReach'),
    wireTouchGap: params.get('scene.wireTouchGap'),
    contactGap: params.get('scene.contactGap'),
    dripLevelTolerance: params.get('scene.dripLevelTolerance'),
    pitMinNormalZ: params.get('scene.pitMinNormalZ'),
    dripStartOffset: params.get('scene.dripStartOffset'),
    rayChordError: params.get('scene.rayChordError'),
    basinSampleStep: params.get('scene.basinSampleStep'),
    basinMinDepth: params.get('scene.basinMinDepth'),
    basinMinVolume: params.get('scene.basinMinVolume'),
    basinGridRatio: params.get('scene.basinGridRatio'),
  };
}
