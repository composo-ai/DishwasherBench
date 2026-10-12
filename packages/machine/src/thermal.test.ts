import { describe, expect, it } from 'vitest';
import { BOSCH_SMV4HAX40G, SPOT_60 } from './machines.ts';
import { expectNear, expectWithin } from './test-util.ts';
import type { ThermalInputs, ThermalModel, ThermalState } from './thermal.ts';
import {
  coupledHeatingRate,
  mixTemperature,
  stepThermal,
  thermalEnergy,
  thermalModelOf,
  thermalRates,
  thermalSubSteps,
  waterHeatCapacity,
} from './thermal.ts';
import { WATER_VOLUMETRIC_HEAT_CAPACITY } from './water.ts';

const LITRE = 1e-3;

/** Integrates for `seconds` in 1 s steps, as both dossiers do. */
function run(
  model: ThermalModel,
  state: ThermalState,
  inputs: ThermalInputs,
  seconds: number,
): ThermalState {
  let s = state;
  for (let i = 0; i < seconds; i++) s = stepThermal(model, s, inputs, 1);
  return s;
}

describe('the thermal constants of the two machines', () => {
  it('counts 4186 J per litre and kelvin, as the dossiers do', () => {
    // machine.md 6.2: "15.9 kJ/K at 3.8 kg"; Bosch dossier 4.5: "4.0 x 4.186".
    expectNear(waterHeatCapacity(3.8 * LITRE), 15900, 10);
    expectNear(waterHeatCapacity(4.0 * LITRE), 4.0 * 4186, 1e-9);
    expect(WATER_VOLUMETRIC_HEAT_CAPACITY).toBe(4.186e6);
  });

  it('builds the Bosch model with its tank node and SPOT-60 without one', () => {
    const bosch = thermalModelOf(BOSCH_SMV4HAX40G);
    expect(bosch.loadHeatCapacity).toBe(23000);
    expect(bosch.machineHeatCapacity).toBe(14000);
    expect(bosch.liquorLoadConductance).toBe(600);
    expect(bosch.liquorMachineConductance).toBe(250);
    expect(bosch.cabinetConductance).toBe(3.0);
    expect(bosch.prestoreConductance).toBe(25);
    expectNear(bosch.prestoreCapacity, 3.1 * LITRE, 1e-12);
    expect(bosch.ambientTemperature).toBe(23);
    const spot = thermalModelOf(SPOT_60);
    expect(spot.cabinetConductance).toBe(2.6);
    expect(spot.prestoreCapacity).toBe(0);
    expect(spot.prestoreConductance).toBe(0);
    expect(thermalModelOf(SPOT_60, 0, 19).loadHeatCapacity).toBe(0);
    expect(thermalModelOf(SPOT_60, 0, 19).ambientTemperature).toBe(19);
  });
});

describe('heating rates (machine.md section 6.2)', () => {
  it('SPOT-60 well coupled: 2.3 K/min for a full load, 4.0 K/min empty, 1.6 K/min at 0.7 duty', () => {
    // "dT/dt = (P_h - UA (T - T_amb)) / (C_w + C_l + C_m) = 2000 / 52 900 = 0.038 K/s
    //  = 2.3 K/min for a full load and 4.0 K/min for an empty machine (C = 30 kJ/K)".
    const full = thermalModelOf(SPOT_60);
    expectNear(coupledHeatingRate(full, 3.8 * LITRE, 2000, 23), 0.038, 0.0005);
    expectNear(coupledHeatingRate(full, 3.8 * LITRE, 2000, 23) * 60, 2.3, 0.05);
    const empty = thermalModelOf(SPOT_60, 0);
    expectNear(coupledHeatingRate(empty, 3.8 * LITRE, 2000, 23) * 60, 4.0, 0.05);
    // "Baseline: heater duty 0.7 during heat-up, giving 1.6 K/min full load."
    expectNear(
      coupledHeatingRate(full, 3.8 * LITRE, 2000 * SPOT_60.thermal.heaterDuty, 23) * 60,
      1.6,
      0.05,
    );
    // The cabinet loss slows it: at 55 C, 2.6 W/K x 32 K = 83 W less.
    expectWithin(
      coupledHeatingRate(full, 3.8 * LITRE, 2000, 55),
      (2000 - 2.6 * 32) / (3.8 * 4186 + 23000 + 14000),
      1e-12,
    );
  });

  it('Bosch: the wash heat-up of the dossier takes 18.0 min at about 2.6 K/min', () => {
    // Section 4.5: "Heater, main wash: 18.5 to 65 C in 18.0 min (2.6 K/min)", from a 4.0 L
    // liquor at 18.5 C with the load at 23 C and the machine at 22.5 C; heater 2100 W and
    // 57 W of pump heat. Load "64 at the end of the heat-up".
    const model = thermalModelOf(BOSCH_SMV4HAX40G);
    const inputs: ThermalInputs = {
      liquorVolume: 4.0 * LITRE,
      prestoreVolume: 0,
      circulating: true,
      heaterPower: 2100,
      pumpPower: 57,
    };
    let state: ThermalState = { liquor: 18.5, load: 23, machine: 22.5, prestore: 23 };
    let seconds = 0;
    while (state.liquor < 65 && seconds < 7200) {
      state = stepThermal(model, state, inputs, 1);
      seconds++;
    }
    expectNear(seconds / 60, 18.0, 0.15, 'heat-up time');
    expectNear((65 - 18.5) / (seconds / 60), 2.6, 0.05, 'mean rate');
    expectNear(state.load, 64, 0.6, 'load at the end of the heat-up');
    // The 2010 platform's design rate is 2.5 K/min; the model is within 5 % of it.
    expectWithin((65 - 18.5) / (seconds / 60), 2.5, 0.05);
    // Hand check of the dossier: (4.0 x 4.186 + 23 + 14) kJ/K x 42 K = 2.26 MJ = 0.63 kWh.
    expectNear((seconds * 2100) / 3.6e6, 0.63, 0.01);
  });

  it('Bosch: the final-rinse heat-up takes 8.9 min from 45 C', () => {
    // Section 4.5: "Heater, final rinse: 45 to 69 C in 8.9 min"; 2.9 L, load and machine at
    // about 45 C (rows A9 and A10 of the balance), 47 W of pump heat.
    const model = thermalModelOf(BOSCH_SMV4HAX40G);
    const inputs: ThermalInputs = {
      liquorVolume: 2.9 * LITRE,
      prestoreVolume: 0,
      circulating: true,
      heaterPower: 2100,
      pumpPower: 47,
    };
    let state: ThermalState = { liquor: 45.4, load: 45.4, machine: 45.0, prestore: 36.5 };
    let seconds = 0;
    while (state.liquor < 69 && seconds < 7200) {
      state = stepThermal(model, state, inputs, 1);
      seconds++;
    }
    expectNear(seconds / 60, 8.9, 0.15);
    // Hand check: (2.9 x 4.186 + 23 + 14) kJ/K x 22 K = 1.08 MJ = 0.30 kWh.
    expectNear((seconds * 2100) / 3.6e6, 0.31, 0.01);
  });
});

describe('the model equations', () => {
  const model = thermalModelOf(BOSCH_SMV4HAX40G);

  it('gives the rates of the equations term by term while circulating', () => {
    const state: ThermalState = { liquor: 50, load: 40, machine: 35, prestore: 20 };
    const inputs: ThermalInputs = {
      liquorVolume: 4.0 * LITRE,
      prestoreVolume: 3.1 * LITRE,
      circulating: true,
      heaterPower: 2100,
      pumpPower: 57,
    };
    const r = thermalRates(model, state, inputs);
    // C_w dT_w/dt = 2100 + 57 - 600 (50 - 40) - 250 (50 - 35) = -7593 W.
    expectWithin(r.liquor, -7593 / (4.0 * 4186), 1e-12);
    // C_l dT_l/dt = 600 (50 - 40) = 6000 W.
    expectWithin(r.load, 6000 / 23000, 1e-12);
    // C_m dT_m/dt = 250 x 15 - 25 (35 - 20) - 3 (35 - 23) = 3750 - 375 - 36 = 3339 W.
    expectWithin(r.machine, 3339 / 14000, 1e-12);
    // C_t dT_t/dt = 25 (35 - 20) = 375 W.
    expectWithin(r.prestore, 375 / (3.1 * 4186), 1e-12);
  });

  it('with the pump off the liquor leaves the load alone and the load cools to the machine', () => {
    const state: ThermalState = { liquor: 60, load: 65, machine: 55, prestore: 30 };
    const inputs: ThermalInputs = {
      liquorVolume: 0.4 * LITRE,
      prestoreVolume: 1.55 * LITRE,
      circulating: false,
      heaterPower: 0,
      pumpPower: 0,
    };
    const r = thermalRates(model, state, inputs);
    // Liquor to machine through the idle conductance of 15 W/K: -15 x 5 = -75 W.
    expectWithin(r.liquor, -75 / (0.4 * 4186), 1e-12);
    // Load to machine through 6 W/K: -6 x 10 = -60 W.
    expectWithin(r.load, -60 / 23000, 1e-12);
    // Machine: +75 + 60 - 25 x 0.5 x (55 - 30) - 3 x 32 = 135 - 312.5 - 96 = -273.5 W.
    expectWithin(r.machine, -273.5 / 14000, 1e-12);
    // A half-full tank is coupled half as well: 12.5 W/K x 25 K = 312.5 W.
    expectWithin(r.prestore, 312.5 / (1.55 * 4186), 1e-12);
  });

  it('an empty tub, an empty tank and an empty machine drop out', () => {
    const state: ThermalState = { liquor: 80, load: 30, machine: 30, prestore: 5 };
    const dry: ThermalInputs = {
      liquorVolume: 0,
      prestoreVolume: 0,
      circulating: true,
      heaterPower: 2100,
      pumpPower: 50,
    };
    const r = thermalRates(model, state, dry);
    expect(r.liquor).toBe(0);
    expect(r.load).toBe(0);
    expect(r.prestore).toBe(0);
    expectWithin(r.machine, (-3 * 7) / 14000, 1e-12);
    const noLoad = thermalModelOf(BOSCH_SMV4HAX40G, 0);
    const wet: ThermalInputs = { ...dry, liquorVolume: 3 * LITRE };
    expect(thermalRates(noLoad, state, wet).load).toBe(0);
    // Without a load the liquor loses heat to the machine only.
    expectWithin(thermalRates(noLoad, state, wet).liquor, (2150 - 250 * 50) / (3 * 4186), 1e-12);
  });

  it('conserves energy exactly: what goes in less the cabinet loss is what the nodes gain', () => {
    const inputs: ThermalInputs = {
      liquorVolume: 2.9 * LITRE,
      prestoreVolume: 2.5 * LITRE,
      circulating: true,
      heaterPower: 2100,
      pumpPower: 47,
    };
    let state: ThermalState = { liquor: 20, load: 45, machine: 40, prestore: 15 };
    const before = thermalEnergy(model, state, inputs);
    let supplied = 0;
    let lost = 0;
    for (let i = 0; i < 600; i++) {
      lost += 3.0 * (state.machine - 23) * 1;
      supplied += (2100 + 47) * 1;
      state = stepThermal(model, state, inputs, 1);
    }
    const after = thermalEnergy(model, state, inputs);
    expectWithin(after - before, supplied - lost, 1e-9);
  });

  it('with no input and no loss everything settles at the capacity-weighted mean', () => {
    const sealed: ThermalModel = { ...model, cabinetConductance: 0 };
    const inputs: ThermalInputs = {
      liquorVolume: 4.0 * LITRE,
      prestoreVolume: 3.1 * LITRE,
      circulating: true,
      heaterPower: 0,
      pumpPower: 0,
    };
    const start: ThermalState = { liquor: 70, load: 20, machine: 30, prestore: 10 };
    const cw = 4.0 * 4186;
    const ct = 3.1 * 4186;
    const mean = (cw * 70 + 23000 * 20 + 14000 * 30 + ct * 10) / (cw + 23000 + 14000 + ct);
    const end = run(sealed, start, inputs, 6 * 3600);
    for (const t of [end.liquor, end.load, end.machine, end.prestore]) expectNear(t, mean, 1e-3);
  });

  it('relaxes two coupled nodes at the analytic rate', () => {
    // Liquor and load only (no machine coupling, no loss): the difference decays as
    // exp(-G (1/C_w + 1/C_l) t). With 4 L and 23 kJ/K at 600 W/K the time constant is 16.15 s.
    const pair: ThermalModel = {
      ...model,
      liquorMachineConductance: 0,
      cabinetConductance: 0,
      prestoreConductance: 0,
      prestoreCapacity: 0,
    };
    const inputs: ThermalInputs = {
      liquorVolume: 4.0 * LITRE,
      prestoreVolume: 0,
      circulating: true,
      heaterPower: 0,
      pumpPower: 0,
    };
    const rate = 600 * (1 / (4.0 * 4186) + 1 / 23000);
    expectNear(1 / rate, 16.15, 0.01);
    let state: ThermalState = { liquor: 60, load: 20, machine: 23, prestore: 23 };
    // Fine steps for a close comparison: 20 s in steps of 0.01 s.
    for (let i = 0; i < 2000; i++) state = stepThermal(pair, state, inputs, 0.01);
    expectWithin(state.liquor - state.load, 40 * Math.exp(-rate * 20), 1e-3);
    // With the dossiers' 1 s steps the same 20 s come out within 2 % of the exact difference.
    let coarse: ThermalState = { liquor: 60, load: 20, machine: 23, prestore: 23 };
    for (let i = 0; i < 20; i++) coarse = stepThermal(pair, coarse, inputs, 1);
    expectWithin(coarse.liquor - coarse.load, 40 * Math.exp(-rate * 20), 0.05);
  });

  it('subdivides a step that would be stiff, and not the ordinary ones', () => {
    const ordinary: ThermalInputs = {
      liquorVolume: 2.9 * LITRE,
      prestoreVolume: 0,
      circulating: true,
      heaterPower: 0,
      pumpPower: 0,
    };
    // (600 + 250) / (2.9 x 4186) = 0.070 per second: one step, as in the dossiers.
    expect(thermalSubSteps(model, ordinary, 1)).toBe(1);
    // A cupful circulating: (600 + 250) / (0.2 x 4186) = 1.02 per second needs eleven.
    const stiff: ThermalInputs = { ...ordinary, liquorVolume: 0.2 * LITRE };
    expect(thermalSubSteps(model, stiff, 1)).toBe(11);
    // Explicit Euler would overshoot with one step of 3 s here; the subdivided step does not.
    const state: ThermalState = { liquor: 80, load: 20, machine: 20, prestore: 20 };
    const next = stepThermal(model, state, stiff, 3);
    expect(next.liquor).toBeGreaterThan(20);
    expect(next.liquor).toBeLessThan(80);
    expect(next.load).toBeGreaterThan(20);
  });
});

describe('mixing', () => {
  it('the first Bosch fill mixes 3.1 L from the tank at 23 C with 0.9 L of mains at 15 C to 21 C', () => {
    // Step A1 of the dossier: "4.0 L in the tub at about 21 C".
    const t = mixTemperature([
      { volume: 3.1 * LITRE, temperature: 23 },
      { volume: 0.9 * LITRE, temperature: 15 },
    ]);
    expectWithin(t, (3.1 * 23 + 0.9 * 15) / 4.0, 1e-12);
    expectNear(t, 21, 0.3);
  });

  it('ignores empty bodies', () => {
    expect(
      mixTemperature([
        { volume: 0, temperature: 99 },
        { volume: 2e-3, temperature: 40 },
      ]),
    ).toBe(40);
    expect(mixTemperature([{ volume: 0, temperature: 12 }])).toBe(12);
  });
});
