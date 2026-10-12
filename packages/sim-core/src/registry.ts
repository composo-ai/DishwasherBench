/**
 * The parameter registry of the wash simulation, composed (docs/design/scope.md, "Calibration
 * is a first-class feature"; docs/design/sim-core.md section M2): every package declares its
 * definitions next to the code that reads them, and this is the one place they are put
 * together. A wash, the fitting tool and the command line all resolve their parameters
 * against this registry.
 */

import { INSPECTOR_PARAM_DEFS } from '@spotless/inspector';
import { FILM_PARAM_DEFS } from '@spotless/sim-film';
import { HYDRAULICS_PARAM_DEFS } from '@spotless/sim-hydraulics';
import { JETS_PARAM_DEFS } from '@spotless/sim-jets';
import { LIQUOR_PARAM_DEFS } from '@spotless/sim-liquor';
import {
  createParamSet,
  createRegistry,
  SHARED_PARAM_DEFS,
  type AnyParamDef,
  type ParamProvenance,
  type ParamRegistry,
  type ParamSet,
} from '@spotless/sim-params';
import { SCENE_PARAM_DEFS } from '@spotless/sim-scene';
import { SOIL_MODEL_CLASSES, SOIL_PARAM_DEFS } from '@spotless/sim-soil';
import { SPRAY_PARAM_DEFS } from '@spotless/sim-spray';
import { TIMELINE_PARAM_DEFS } from '@spotless/sim-timeline';

/** The contributions to the registry, by the package that declares them. */
export const WASH_PARAM_CONTRIBUTIONS: Readonly<Record<string, readonly AnyParamDef[]>> = {
  'sim-params': SHARED_PARAM_DEFS,
  'sim-scene': SCENE_PARAM_DEFS,
  'sim-hydraulics': HYDRAULICS_PARAM_DEFS,
  'sim-jets': JETS_PARAM_DEFS,
  'sim-spray': SPRAY_PARAM_DEFS,
  'sim-film': FILM_PARAM_DEFS,
  'sim-liquor': LIQUOR_PARAM_DEFS,
  'sim-soil': SOIL_PARAM_DEFS,
  'sim-timeline': TIMELINE_PARAM_DEFS,
  inspector: INSPECTOR_PARAM_DEFS,
};

let registry: ParamRegistry | undefined;

/**
 * The registry of the wash simulation: every parameter of every stage, with the model soil
 * classes as its per-class soil keys. Built once per process.
 */
export function washRegistry(): ParamRegistry {
  registry ??= createRegistry({
    contributions: Object.values(WASH_PARAM_CONTRIBUTIONS),
    soilClasses: [...SOIL_MODEL_CLASSES],
  });
  return registry;
}

/**
 * A parameter set of the wash simulation: the registry defaults with `overrides` on top.
 * Throws `ParamSetError` for an unknown key or a value outside its range.
 */
export function createWashParams(
  overrides: Readonly<Record<string, unknown>> = {},
  provenance?: ParamProvenance,
): ParamSet {
  return createParamSet(washRegistry(), overrides, provenance);
}
