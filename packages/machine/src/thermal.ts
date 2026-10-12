/**
 * The lumped thermal model of the machine (docs/research/machine.md sections 6.2 and 12.2
 * item 6): liquor, load and machine nodes, plus the water of the heat-exchanger tank on the
 * side wall where the machine has one (docs/research/machine-bosch-smv4hax40g.md section 4.5).
 *
 *   C_w dT_w/dt = P_h + P_pump - G_wl (T_w - T_l) - G_wm (T_w - T_m)
 *   C_l dT_l/dt = G_wl (T_w - T_l) - G_lm (T_l - T_m)
 *   C_m dT_m/dt = G_wm (T_w - T_m) + G_lm (T_l - T_m) - G_t (T_m - T_t) - UA (T_m - T_amb)
 *   C_t dT_t/dt = G_t (T_m - T_t)
 *
 * While the pump circulates, G_wl and G_wm are the machine's liquor-load and liquor-machine
 * conductances and G_lm is zero. With the pump off the liquor no longer reaches the load
 * (G_wl = 0), what water is left exchanges with the machine through the idle conductance, and
 * the load exchanges with the machine through the tub air (G_lm; the generic model's
 * G_la (T_l - T_tub_air) with the tub air at the machine temperature). G_t is the wall
 * conductance of the tank scaled by how full it is. The electrical power of the circulation
 * pump ends up as heat in the liquor.
 *
 * Integration is explicit Euler, as in both dossiers (1 s steps there), with the step
 * subdivided where a node would otherwise be stiff. The scheme conserves energy exactly: every
 * exchange leaves one node and enters another within the same sub-step.
 *
 * Units: degrees Celsius, watts, joules per kelvin, watts per kelvin, cubic metres, seconds.
 */

import type { MachineSpec } from './types.ts';
import { WATER_VOLUMETRIC_HEAT_CAPACITY } from './water.ts';

/** Volume below which a body of water is treated as absent, m^3 (one millilitre). */
export const NEGLIGIBLE_WATER_VOLUME = 1e-6;

/**
 * Largest product of time step and node rate (sum of conductances over heat capacity) taken in
 * one Euler sub-step. The dossiers' own 1 s steps are at 0.05 to 0.07 for the liquor node.
 */
export const MAX_EULER_STEP_RATIO = 0.1;

/** The constants of the thermal model for one machine and one load. */
export interface ThermalModel {
  /** Heat capacity of the load C_l, J/K; 0 for an empty machine. */
  readonly loadHeatCapacity: number;
  /** Heat capacity of the machine C_m, J/K. */
  readonly machineHeatCapacity: number;
  /** G_wl while circulating, W/K. */
  readonly liquorLoadConductance: number;
  /** G_wm while circulating, W/K. */
  readonly liquorMachineConductance: number;
  /** G_wm with the pump off, W/K. */
  readonly liquorMachineConductanceIdle: number;
  /** G_lm with the pump off, W/K. */
  readonly loadMachineConductanceIdle: number;
  /** Cabinet loss UA, W/K. */
  readonly cabinetConductance: number;
  /** Conductance between the machine and a full pre-store tank, W/K; 0 without a tank. */
  readonly prestoreConductance: number;
  /** Volume of the full pre-store tank, m^3; 0 without a tank. */
  readonly prestoreCapacity: number;
  /** Room temperature T_amb, degrees C. */
  readonly ambientTemperature: number;
}

/** The temperatures of the four nodes, degrees C. */
export interface ThermalState {
  /** The liquor: the free water in the tub. Meaningless while the tub is empty. */
  readonly liquor: number;
  /** The load. */
  readonly load: number;
  /** The machine: tub, racks, sump, wetted plastic. */
  readonly machine: number;
  /** The water in the pre-store tank. Meaningless while the tank is empty. */
  readonly prestore: number;
}

/** What drives the thermal model over one step. */
export interface ThermalInputs {
  /** Free water in the tub, m^3. */
  readonly liquorVolume: number;
  /** Water in the pre-store tank, m^3. */
  readonly prestoreVolume: number;
  /** Whether the circulation pump is spraying the load. */
  readonly circulating: boolean;
  /** Heater power delivered to the liquor, W. */
  readonly heaterPower: number;
  /** Circulation pump power dissipated in the liquor, W. */
  readonly pumpPower: number;
}

/** Rates of change of the node temperatures, K/s. */
export interface ThermalRates {
  readonly liquor: number;
  readonly load: number;
  readonly machine: number;
  readonly prestore: number;
}

/**
 * The thermal model of a machine with a load of heat capacity `loadHeatCapacity` (J/K; default:
 * the full rated load the machine's programme tables assume) in a room at `ambientTemperature`
 * (degrees C; default: the machine's).
 */
export function thermalModelOf(
  spec: MachineSpec,
  loadHeatCapacity: number = spec.thermal.referenceLoadHeatCapacity,
  ambientTemperature: number = spec.thermal.ambientTemperature,
): ThermalModel {
  const tank = spec.drying.heatExchanger;
  const prestoreCapacity = tank?.volume ?? 0;
  return {
    loadHeatCapacity,
    machineHeatCapacity: spec.thermal.machineHeatCapacity,
    liquorLoadConductance: spec.thermal.liquorLoadConductance,
    liquorMachineConductance: spec.thermal.liquorMachineConductance,
    liquorMachineConductanceIdle: spec.thermal.liquorMachineConductanceIdle,
    loadMachineConductanceIdle: spec.thermal.loadMachineConductanceIdle,
    cabinetConductance: spec.thermal.cabinetConductance,
    prestoreConductance: prestoreCapacity > 0 ? (tank?.wallConductance ?? 0) : 0,
    prestoreCapacity,
    ambientTemperature,
  };
}

/** Heat capacity of a volume of water (m^3), J/K. */
export function waterHeatCapacity(volume: number): number {
  return Math.max(volume, 0) * WATER_VOLUMETRIC_HEAT_CAPACITY;
}

/** The conductances in force for the given inputs, W/K, and the heat capacities, J/K. */
function coefficients(model: ThermalModel, inputs: ThermalInputs) {
  const hasLiquor = inputs.liquorVolume > NEGLIGIBLE_WATER_VOLUME;
  const hasLoad = model.loadHeatCapacity > 0;
  const hasTank = model.prestoreCapacity > 0 && inputs.prestoreVolume > NEGLIGIBLE_WATER_VOLUME;
  const liquorLoad = hasLiquor && hasLoad && inputs.circulating ? model.liquorLoadConductance : 0;
  const liquorMachine = !hasLiquor
    ? 0
    : inputs.circulating
      ? model.liquorMachineConductance
      : model.liquorMachineConductanceIdle;
  const loadMachine = hasLoad && !inputs.circulating ? model.loadMachineConductanceIdle : 0;
  const tank = hasTank
    ? model.prestoreConductance * Math.min(inputs.prestoreVolume / model.prestoreCapacity, 1)
    : 0;
  return {
    hasLiquor,
    hasLoad,
    hasTank,
    liquorLoad,
    liquorMachine,
    loadMachine,
    tank,
    liquorCapacity: waterHeatCapacity(inputs.liquorVolume),
    tankCapacity: waterHeatCapacity(inputs.prestoreVolume),
  };
}

/** Rates of change of the node temperatures for a state and inputs, K/s. */
export function thermalRates(
  model: ThermalModel,
  state: ThermalState,
  inputs: ThermalInputs,
): ThermalRates {
  const k = coefficients(model, inputs);
  const liquorToLoad = k.liquorLoad * (state.liquor - state.load);
  const liquorToMachine = k.liquorMachine * (state.liquor - state.machine);
  const loadToMachine = k.loadMachine * (state.load - state.machine);
  const machineToTank = k.tank * (state.machine - state.prestore);
  const loss = model.cabinetConductance * (state.machine - model.ambientTemperature);
  return {
    liquor: k.hasLiquor
      ? (inputs.heaterPower + inputs.pumpPower - liquorToLoad - liquorToMachine) / k.liquorCapacity
      : 0,
    load: k.hasLoad ? (liquorToLoad - loadToMachine) / model.loadHeatCapacity : 0,
    machine: (liquorToMachine + loadToMachine - machineToTank - loss) / model.machineHeatCapacity,
    prestore: k.hasTank ? machineToTank / k.tankCapacity : 0,
  };
}

/**
 * Number of equal Euler sub-steps `stepThermal` takes for a step of `dt` seconds: enough to
 * keep every node's step ratio at or below {@link MAX_EULER_STEP_RATIO}.
 */
export function thermalSubSteps(model: ThermalModel, inputs: ThermalInputs, dt: number): number {
  const k = coefficients(model, inputs);
  let rate =
    (k.liquorMachine + k.loadMachine + k.tank + model.cabinetConductance) /
    model.machineHeatCapacity;
  if (k.hasLiquor) rate = Math.max(rate, (k.liquorLoad + k.liquorMachine) / k.liquorCapacity);
  if (k.hasLoad) rate = Math.max(rate, (k.liquorLoad + k.loadMachine) / model.loadHeatCapacity);
  if (k.hasTank) rate = Math.max(rate, k.tank / k.tankCapacity);
  return Math.max(1, Math.ceil((rate * dt) / MAX_EULER_STEP_RATIO - 1e-12));
}

/** The state after `dt` seconds of constant inputs (explicit Euler, subdivided where stiff). */
export function stepThermal(
  model: ThermalModel,
  state: ThermalState,
  inputs: ThermalInputs,
  dt: number,
): ThermalState {
  const n = thermalSubSteps(model, inputs, dt);
  const h = dt / n;
  let current = state;
  for (let i = 0; i < n; i++) {
    const rates = thermalRates(model, current, inputs);
    current = {
      liquor: current.liquor + rates.liquor * h,
      load: current.load + rates.load * h,
      machine: current.machine + rates.machine * h,
      prestore: current.prestore + rates.prestore * h,
    };
  }
  return current;
}

/**
 * Heat content of the model relative to `reference` degrees C, joules: the sum of heat capacity
 * times temperature over the nodes that exist. Its change over a step equals the heater and
 * pump energy put in less the cabinet loss.
 */
export function thermalEnergy(
  model: ThermalModel,
  state: ThermalState,
  inputs: Pick<ThermalInputs, 'liquorVolume' | 'prestoreVolume'>,
  reference = 0,
): number {
  let energy = model.machineHeatCapacity * (state.machine - reference);
  energy += model.loadHeatCapacity * (state.load - reference);
  if (inputs.liquorVolume > NEGLIGIBLE_WATER_VOLUME) {
    energy += waterHeatCapacity(inputs.liquorVolume) * (state.liquor - reference);
  }
  if (model.prestoreCapacity > 0 && inputs.prestoreVolume > NEGLIGIBLE_WATER_VOLUME) {
    energy += waterHeatCapacity(inputs.prestoreVolume) * (state.prestore - reference);
  }
  return energy;
}

/**
 * Heating rate with liquor, load and machine at one temperature, K/s (machine.md section 6.2):
 * (P_h - UA (T - T_amb)) / (C_w + C_l + C_m).
 */
export function coupledHeatingRate(
  model: ThermalModel,
  liquorVolume: number,
  heaterPower: number,
  temperature: number,
): number {
  const capacity =
    waterHeatCapacity(liquorVolume) + model.loadHeatCapacity + model.machineHeatCapacity;
  return (
    (heaterPower - model.cabinetConductance * (temperature - model.ambientTemperature)) / capacity
  );
}

/**
 * Temperature of several bodies of water mixed together, degrees C: the volume-weighted mean.
 * Bodies of zero volume are ignored; if all are empty the temperature of the first is returned.
 */
export function mixTemperature(
  parts: readonly { readonly volume: number; readonly temperature: number }[],
): number {
  let volume = 0;
  let heat = 0;
  for (const part of parts) {
    if (part.volume > 0) {
      volume += part.volume;
      heat += part.volume * part.temperature;
    }
  }
  if (volume > 0) return heat / volume;
  return parts[0]?.temperature ?? 0;
}
