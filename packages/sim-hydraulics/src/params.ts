/**
 * The registered parameters of the hydraulics layer of the first build (docs/design/scope.md,
 * "Calibration is a first-class feature"; docs/design/sim-core.md section M4, "Parameters").
 *
 * The machine itself is data (`MachineSpec`: nozzle tables, pump curve, branch losses, bearing
 * friction); it is entered as measured, not fitted, and is not repeated here. What is registered
 * here is what this layer adds to the machine's own equations: how a slot is turned into round
 * sub-jets when the machine's nozzle table does not say, and the tick of a spray state in
 * which no arm turns.
 *
 * The keys under `hyd.*` belong to the `hydro` hash group: changing one changes the key of
 * every cached exposure.
 *
 * The keys under `prog.*` say how a long soak of a programme is sprayed (`buildWashHydraulics`):
 * they move the times at which the spray states are active, not the states, so they are in
 * the `soil` hash group and a change reuses cached exposure.
 */

import type { AnyParamDef, ParamSet } from '@spotless/sim-params';

const M4 = 'sim-core section M4';

/** The parameters `buildWashHydraulics` reads, to be contributed to the registry. */
export const HYDRAULICS_PARAM_DEFS: readonly AnyParamDef[] = [
  {
    key: 'hyd.slotSubJets',
    unit: '1',
    default: 7,
    min: 1,
    max: 9,
    tag: 'ESTIMATED',
    source: `${M4}, "Slot nozzles"; jets 2.5: round sub-jets that represent the fan of a slot whose nozzle record gives no count`,
    group: 'hydro',
    calibration: 'jetStress',
  },
  {
    key: 'hyd.slotFanAngle',
    unit: 'rad',
    default: (40 * Math.PI) / 180,
    min: 0,
    max: (90 * Math.PI) / 180,
    tag: 'ESTIMATED',
    source: `${M4}, parameter table (fan angle 40 degrees); jets 2.5: included fan angle of a slot whose nozzle record gives none`,
    group: 'hydro',
    calibration: 'jetAccess',
  },
  {
    key: 'hyd.nominalPeriod',
    unit: 's',
    default: 2,
    min: 0.5,
    max: 10,
    tag: 'SYN',
    source: `${M4}, "Time base of a combo": tick of a spray state in which no fed arm turns`,
    group: 'hydro',
  },
  {
    key: 'hyd.primeSteps',
    unit: '1',
    default: 4,
    min: 1,
    max: 20,
    tag: 'SYN',
    source: `${M4}, "Water inventory" (f_H = max(1 - 2.5 alpha, 0)); machine 4.5: a pump that draws air loses head. The head multiplier of a starved stretch of the programme lies between two of this many equal steps between 0 and 1; the stretch is spent at those two steps in the shares of time that deliver its flow, and every step in use is a spray state of its own with its own exposure (1 is the fully primed state)`,
    group: 'hydro',
  },
  {
    key: 'prog.soakDuty',
    unit: '1',
    default: 0.8,
    min: 0.59,
    max: 1,
    tag: 'ESTIMATED',
    source:
      "the owner's test wash 01 (docs/calibration/owner-wash-01-calibration.md: four plates of fork-spread egg yolk on Eco 50 with his capsule, 10 October 2026), fitted with the calibration tool together with the published class means and with the label's energy as prior: 0.80, 95 % profile interval 0.59 to 1, which is the range registered here (1, continuous circulation, is the bound and is not excluded: the log likelihood of the wash is -5.79 at 0.8, -5.55 at 1 and -10.18 at 0.5). ESTIMATED from one wash whose yolk was not weighed: with a fifth less yolk on every plate the best value is 0.7 to 0.8, with a quarter more it is 1; confounded with the protease level of the capsule and with the oven penalty (soil.bakeRate, correlation 0.83). Until 11 October 2026 the default was 0.5, from the label's energy alone, and the range 0.1 to 1 (machine dossier, Bosch SMV4HAX40G, 4.7: Eco 50 has a \"long soak with intermittent spraying\", the manual \"longer soaking and drying times\", no pattern given; with the pump on throughout its 149 min the machine model puts Eco 50 at 0.90 kWh, heater 0.71, pump 0.18 of which 0.137 in the soak, other 0.01, against the printed 0.836: the 0.065 kWh too many are 47 % of the soak's pump energy, so the label alone is met with the pump on for about half the soak, 0.53, and the model's own energy error of 0.05 kWh spans 0.15 to 0.9). The wash contradicts that value: both air-dried plates came out spotless, and at 0.5 the model leaves every plate visibly soiled whatever amount of yolk it carried. Share of a soak (a hold of the main wash of at least prog.soakFrom) in which the circulation pump runs. 1: continuous circulation (every build before water-6)",
    group: 'soil',
    calibration: 'programme',
  },
  {
    key: 'prog.soakCycle',
    unit: 's',
    default: 600,
    min: 60,
    max: 3600,
    tag: 'SYN',
    source:
      'no document gives the pattern of the intermittent spraying of Eco 50 (machine dossier 4.7): length of one cycle of spraying and resting in a soak. The pump runs for prog.soakDuty of every cycle with the diverter alternating as the programme writes it, then rests with the diverter where it stood. What a rest does to the soil is the residual film (film.* hold times, soil.heldFilmCapacity per stop of the spray), so the number of rests matters as well as their share',
    group: 'soil',
    calibration: 'programme',
  },
  {
    key: 'prog.soakFrom',
    unit: 's',
    default: 3600,
    min: 0,
    max: 14400,
    tag: 'ESTIMATED',
    source:
      'machine dossier 4.7 says "intermittent spraying" of the long soak of Eco 50 (149 min); the pattern is not given. A hold of the main wash is sprayed intermittently when it is at least this long',
    group: 'soil',
    calibration: 'programme',
  },
];

/** The hydraulics parameters as numbers. */
export interface HydraulicsParams {
  /** Round sub-jets per slot when the nozzle record gives none. */
  readonly slotSubJets: number;
  /** Included fan angle of a slot when the nozzle record gives none, radians. */
  readonly slotFanAngle: number;
  /** Tick of a spray state without a turning arm, seconds. */
  readonly nominalPeriod: number;
  /** Steps between 0 and 1 to which the head multiplier of a starved pump is rounded. */
  readonly primeSteps: number;
  /** Share of a soak in which the pump runs, 0 to 1. */
  readonly soakDuty: number;
  /** Length of one cycle of spraying and resting in a soak, seconds. */
  readonly soakCycle: number;
  /** A hold of the main wash at least this long is a soak, seconds. */
  readonly soakFrom: number;
}

/** Reads the hydraulics parameters from a set built on a registry that holds the definitions. */
export function resolveHydraulicsParams(params: ParamSet): HydraulicsParams {
  return {
    slotSubJets: Math.max(1, Math.round(params.get('hyd.slotSubJets'))),
    slotFanAngle: params.get('hyd.slotFanAngle'),
    nominalPeriod: params.get('hyd.nominalPeriod'),
    primeSteps: Math.max(1, Math.round(params.get('hyd.primeSteps'))),
    soakDuty: Math.min(1, Math.max(0, params.get('prog.soakDuty'))),
    soakCycle: params.get('prog.soakCycle'),
    soakFrom: params.get('prog.soakFrom'),
  };
}
