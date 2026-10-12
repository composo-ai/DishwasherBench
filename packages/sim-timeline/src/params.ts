/**
 * The registered parameters of the replay of the first build (docs/design/scope.md, "Whole
 * cycle"; docs/design/sim-core.md section M10).
 *
 * All keys are under `tl.*`, in the `soil` hash group: changing one reuses cached exposure.
 */

import type { AnyParamDef, ParamSet } from '@spotless/sim-liquor';

/** The parameters the replay reads, to be contributed to the registry. */
export const TIMELINE_PARAM_DEFS: readonly AnyParamDef[] = [
  {
    key: 'tl.offTick',
    unit: 's',
    default: 2,
    min: 0.5,
    max: 10,
    tag: 'SYN',
    source: 'sim-core section 0, "tick": step of the replay with the pump off',
    group: 'soil',
  },
  {
    key: 'tl.dryTick',
    unit: 's',
    default: 10,
    min: 1,
    max: 60,
    tag: 'SYN',
    source: 'sim-core section 0, "tick": step of the replay in drying',
    group: 'soil',
  },
  {
    key: 'tl.poolMixing',
    unit: '1',
    default: 0.5,
    min: 0,
    max: 1,
    tag: 'SYN',
    source:
      'sim-core M10, "Pools and gaps" (eta_mix); chemistry 10.2: share of the water entering a full pool that mixes with it before it spills',
    group: 'soil',
    calibration: 'pools',
  },
  {
    key: 'tl.poolThermalTime',
    unit: 's',
    default: 600,
    min: 60,
    max: 3600,
    tag: 'SYN',
    source:
      'first build: time constant with which standing water in an item takes the temperature of the load (sim-core M10 gives alpha_pool = 500 W/(m2 K))',
    group: 'soil',
    calibration: 'pools',
  },
  {
    key: 'tl.soilStride',
    unit: '1',
    default: 8,
    min: 1,
    max: 64,
    tag: 'SYN',
    source:
      'review of the first build: ticks (arm revolutions) the soil is stepped over at once while the spray state, the water and the pool levels do not change; its laws are linear or exponential in the step. 1 steps the soil every revolution',
    group: 'soil',
  },
  {
    key: 'tl.soilTemperatureStep',
    unit: 'K',
    default: 0.5,
    min: 0.05,
    max: 5,
    tag: 'SYN',
    source:
      'review of the first build: a soil step ends early when the liquor temperature has moved by more than this since the step began',
    group: 'soil',
  },
  {
    key: 'tl.soilPHStep',
    unit: '1',
    default: 0.05,
    min: 0.005,
    max: 1,
    tag: 'SYN',
    source:
      'review of the first build: a soil step ends early when the pH of the liquor has moved by more than this since the step began',
    group: 'soil',
  },
  {
    key: 'tl.initialFilmTemperature',
    unit: 'degC',
    default: 20,
    min: 5,
    max: 40,
    tag: 'ESTIMATED',
    source:
      'replay of the first build: temperature of the water on the load before the first liquor has been sprayed (room temperature)',
    group: 'soil',
  },
  {
    key: 'tl.initialFilmPH',
    unit: '1',
    default: 7,
    min: 6,
    max: 9,
    tag: 'ESTIMATED',
    source:
      'replay of the first build: pH of the water on the load before the first liquor has been sprayed',
    group: 'soil',
  },
];

/** The replay parameters as numbers. */
export interface TimelineParams {
  readonly offTick: number;
  readonly dryTick: number;
  readonly poolMixing: number;
  readonly poolThermalTime: number;
  readonly soilStride: number;
  readonly soilTemperatureStep: number;
  readonly soilPHStep: number;
  readonly initialFilmTemperature: number;
  readonly initialFilmPH: number;
  /**
   * `soil.supplyExchange` of the soil model, 1/s: the replay turns the exchange column of the
   * water table (the inverse of the age of the water on a block) into the supply factor.
   */
  readonly supplyExchange: number;
  /**
   * `soil.heldFilmCapacity` of the soil model, kg of dry soil per kg of residual film; 0: a
   * residual film takes up nothing.
   */
  readonly heldFilmCapacity: number;
}

/** Reads the replay parameters from a set built on a registry that holds the definitions. */
export function resolveTimelineParams(params: ParamSet): TimelineParams {
  return {
    offTick: params.get('tl.offTick'),
    dryTick: params.get('tl.dryTick'),
    poolMixing: params.get('tl.poolMixing'),
    poolThermalTime: params.get('tl.poolThermalTime'),
    soilStride: Math.max(1, Math.round(params.get('tl.soilStride'))),
    soilTemperatureStep: params.get('tl.soilTemperatureStep'),
    soilPHStep: params.get('tl.soilPHStep'),
    initialFilmTemperature: params.get('tl.initialFilmTemperature'),
    initialFilmPH: params.get('tl.initialFilmPH'),
    supplyExchange: params.get('soil.supplyExchange'),
    heldFilmCapacity: params.get('soil.heldFilmCapacity'),
  };
}
