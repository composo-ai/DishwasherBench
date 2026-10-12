import { STANDARD_GRAVITY } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { getBranch, getSprayLevel } from './config.ts';
import {
  BISECTION_ITERATIONS,
  branchFlowAt,
  branchOperatingPoint,
  headFactorFromAirFraction,
  hydraulicOperatingPoint,
  pumpElectricalPower,
  pumpFlowAt,
  pumpHeadAt,
  solveNetwork,
  sprayLevelCdA,
} from './hydraulics.ts';
import { BOSCH_SMV4HAX40G, BOSCH_SMV4HAX40G_DRILL_BORE, SPOT_60 } from './machines.ts';
import { expectNear, expectWithin, must, toKPa, toLPerMin } from './test-util.ts';
import type { MachineSpec } from './types.ts';
import { WATER_DENSITY } from './water.ts';

/**
 * The owner update (machine-bosch-owner-update.md) solved its operating points with the machine
 * in its default configuration (upper basket at Rackmatic level 1, static lift 0.455 m) and
 * with the roof branch's static lift still at the dossier's 0.72 m; its own specification block
 * then lowers that lift to 0.69 m with the measured roof ("section 5 was solved with 0.72, a
 * difference of 0.3 kPa"). The tables are therefore checked on the Bosch with the roof lift put
 * back to 0.72 m, and the effect of the 0.69 m the data carries is checked on its own.
 */
function withRoofLift(spec: MachineSpec, staticLift: number): MachineSpec {
  return {
    ...spec,
    hydraulics: {
      ...spec.hydraulics,
      branches: spec.hydraulics.branches.map((b) => (b.id === 'roof' ? { ...b, staticLift } : b)),
    },
  };
}

const BOSCH_AS_UPDATE_SOLVED = withRoofLift(BOSCH_SMV4HAX40G, 0.72);
const BOSCH_DRILL_BORE_AS_UPDATE_SOLVED = withRoofLift(BOSCH_SMV4HAX40G_DRILL_BORE, 0.72);

/**
 * A row of an operating-point table: diverter state, pump speed, pump pressure (kPa), total flow
 * (L/min), and per fed branch [flow L/min, arm pressure kPa, jet speed m/s].
 */
type TableRow = readonly [
  state: string,
  rpm: number,
  pumpKPa: number,
  totalLPerMin: number,
  branches: Readonly<Record<string, readonly [number, number, number]>>,
  hydraulicW: number,
  electricalW: number | null,
];

/**
 * Tolerances for a printed table: each figure is rounded to the last digit shown (half a unit),
 * and the dossiers' scripts used g = 9.81 where this package uses 9.80665 (0.03 %).
 */
function expectTableRow(spec: MachineSpec, row: TableRow, options = {}): void {
  const [state, rpm, pumpKPa, total, branches, hydraulicW, electricalW] = row;
  const point = hydraulicOperatingPoint(spec, state, rpm, options);
  const label = `${spec.id} ${state} at ${rpm} rpm`;
  expectNear(toKPa(point.pumpPressure), pumpKPa, 0.06 + 0.001 * pumpKPa, `${label}: pump pressure`);
  expectNear(toLPerMin(point.flow), total, 0.06 + 0.001 * total, `${label}: total flow`);
  expectNear(
    point.hydraulicPower,
    hydraulicW,
    0.06 + 0.002 * hydraulicW,
    `${label}: hydraulic power`,
  );
  if (electricalW !== null) {
    expectNear(point.electricalPower, electricalW, 0.6, `${label}: electrical power`);
  }
  expect(point.branches.map((b) => b.id).sort()).toEqual(Object.keys(branches).sort());
  for (const [id, [flow, armKPa, jet]] of Object.entries(branches)) {
    const branch = must(branchOperatingPoint(point, id), `branch ${id}`);
    expectNear(toLPerMin(branch.flow), flow, 0.06 + 0.001 * flow, `${label}: ${id} flow`);
    expectNear(
      toKPa(branch.armPressure),
      armKPa,
      0.06 + 0.001 * armKPa,
      `${label}: ${id} arm pressure`,
    );
    expectNear(branch.idealJetSpeed, jet, 0.006 + 0.001 * jet, `${label}: ${id} jet speed`);
  }
}

describe('hydraulic operating points of the Bosch with the measured nozzles (machine-bosch-owner-update.md section 5.1, case P)', () => {
  // The table of section 5.1 of the owner update (3.3 mm bores, dossier pump curve), transcribed.
  // It replaces the table of the dossier's section 3.3, whose nozzle areas were photo estimates
  // (lower arm at 3000 rpm: 27.9 L/min, 24.7 kPa, 7.04 m/s, now 30.5 L/min, 22.1 kPa, 6.65 m/s).
  // P_el = P_hyd / (0.40 x 0.72) + 8 W.
  const table: readonly TableRow[] = [
    ['l', 2400, 18.2, 24.2, { lower: [24.2, 13.9, 5.28] }, 7.4, 34],
    ['l', 2800, 24.7, 28.4, { lower: [28.4, 19.2, 6.2] }, 11.7, 49],
    ['l', 3000, 28.3, 30.5, { lower: [30.5, 22.1, 6.65] }, 14.4, 58],
    ['l', 3400, 36.3, 34.7, { lower: [34.7, 28.5, 7.56] }, 21.0, 81],
    ['ur', 2400, 19.6, 21.7, { upper: [15.3, 9.9, 4.46], roof: [6.4, 11.0, 4.69] }, 7.1, 33],
    ['ur', 2800, 26.1, 26.2, { upper: [18.3, 14.2, 5.34], roof: [7.8, 16.7, 5.78] }, 11.4, 48],
    ['ur', 3000, 29.8, 28.4, { upper: [19.8, 16.6, 5.77], roof: [8.6, 19.9, 6.31] }, 14.1, 57],
    ['ur', 3400, 37.8, 32.7, { upper: [22.7, 21.9, 6.63], roof: [10.0, 26.9, 7.35] }, 20.6, 80],
    ['u', 2400, 21.9, 16.4, { upper: [16.4, 11.5, 4.79] }, 6.0, 29],
    ['u', 2800, 29.6, 19.7, { upper: [19.7, 16.5, 5.75] }, 9.7, 42],
    ['u', 3000, 33.9, 21.3, { upper: [21.3, 19.3, 6.22] }, 12.0, 50],
    ['u', 3400, 43.3, 24.5, { upper: [24.5, 25.5, 7.15] }, 17.7, 69],
    ['r', 2400, 24.4, 7.5, { roof: [7.5, 15.2, 5.51] }, 3.0, 19],
    ['r', 2800, 33.1, 9.2, { roof: [9.2, 22.8, 6.76] }, 5.1, 26],
    ['r', 3000, 38.0, 10.0, { roof: [10.0, 27.1, 7.36] }, 6.3, 30],
    ['r', 3400, 48.7, 11.6, { roof: [11.6, 36.4, 8.55] }, 9.4, 41],
    ['lu', 2400, 13.2, 31.9, { lower: [20.3, 9.8, 4.43], upper: [11.6, 5.7, 3.39] }, 7.0, 32],
    ['lu', 2800, 17.5, 37.8, { lower: [23.6, 13.3, 5.16], upper: [14.2, 8.5, 4.14] }, 11.0, 46],
    ['lu', 3000, 19.8, 40.7, { lower: [25.3, 15.2, 5.52], upper: [15.4, 10.1, 4.5] }, 13.5, 55],
    ['lu', 3400, 25.1, 46.5, { lower: [28.6, 19.5, 6.25], upper: [17.9, 13.6, 5.21] }, 19.5, 76],
  ];

  it.each(table)('reproduces the row %s at %i rpm', (...row) => {
    expectTableRow(BOSCH_AS_UPDATE_SOLVED, row);
  });

  it('with the roof lift of the measured roof (0.69 m, not 0.72 m) only the roof branch moves, by under 0.3 kPa', () => {
    // Owner update section 7: "outlet 625 + 60 (was 0.72; section 5 was solved with 0.72, a
    // difference of 0.3 kPa)". rho g x 0.03 m = 294 Pa; the extra flow gives a little back.
    expectNear(getBranch(BOSCH_SMV4HAX40G, 'roof').staticLift, 0.69, 1e-12);
    const hydrostatic = WATER_DENSITY * STANDARD_GRAVITY * 0.03;
    expectNear(hydrostatic, 294, 1);
    for (const state of ['r', 'ur']) {
      const solved = hydraulicOperatingPoint(BOSCH_AS_UPDATE_SOLVED, state, 3000);
      const data = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, state, 3000);
      const gain =
        must(branchOperatingPoint(data, 'roof')).armPressure -
        must(branchOperatingPoint(solved, 'roof')).armPressure;
      expect(gain, state).toBeGreaterThan(0.6 * hydrostatic);
      expect(gain, state).toBeLessThan(hydrostatic);
    }
    // The states that do not feed the roof are the table's as they stand.
    for (const row of table.filter(([state]) => state === 'l' || state === 'u' || state === 'lu')) {
      expectTableRow(BOSCH_SMV4HAX40G, row);
    }
    // The upper arm, which shares the pump with the roof spinner in state UR, keeps the table's
    // 19.8 L/min, 16.6 kPa and 5.77 m/s; the roof outlet still rounds to 10.0 and 8.6 L/min.
    const ur = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'ur', 3000);
    const upper = must(branchOperatingPoint(ur, 'upper'));
    expectNear(toLPerMin(upper.flow), 19.8, 0.08);
    expectNear(toKPa(upper.armPressure), 16.6, 0.08);
    expectNear(upper.idealJetSpeed, 5.77, 0.012);
    expectNear(toLPerMin(must(branchOperatingPoint(ur, 'roof')).flow), 8.6, 0.06);
    const r = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'r', 3000);
    expectNear(toLPerMin(r.flow), 10.0, 0.06);
  });

  it('adds the nozzle tables up to C_d A = 76.4 and 57.1 mm2 (dossier: 66.0 and 41.0)', () => {
    // Owner update sections 2.5 and 3.4, summed here from the printed sizes:
    // lower 8 x 0.85 x pi 3.3^2 / 4 + 2 x 0.78 x (1.8 x 3.2 + pi 1.8^2 / 4) + 0.80 x 3.0 x 2.2;
    // upper 0.85 x pi 2.5^2 / 4 + 4 x 0.78 x 4.8 x 2.2 + 2 x 0.78 x 4.3 x 2.3 + 0.80 x pi 2.7^2 / 4.
    const lower =
      (8 * 0.85 * Math.PI * 3.3 ** 2) / 4 +
      2 * 0.78 * (1.8 * 3.2 + (Math.PI * 1.8 ** 2) / 4) +
      0.8 * 3.0 * 2.2;
    const upper =
      (0.85 * Math.PI * 2.5 ** 2) / 4 +
      4 * 0.78 * 4.8 * 2.2 +
      2 * 0.78 * 4.3 * 2.3 +
      (0.8 * Math.PI * 2.7 ** 2) / 4;
    expectNear(lower, 76.4, 0.05);
    expectNear(upper, 57.1, 0.05);
    expectNear(sprayLevelCdA(getSprayLevel(BOSCH_SMV4HAX40G, 'lower')) * 1e6, lower, 1e-9);
    expectNear(sprayLevelCdA(getSprayLevel(BOSCH_SMV4HAX40G, 'upper')) * 1e6, upper, 1e-9);
    expectNear(getBranch(BOSCH_SMV4HAX40G, 'lower').statedCdA * 1e6, 76.4, 1e-9);
    expectNear(getBranch(BOSCH_SMV4HAX40G, 'upper').statedCdA * 1e6, 57.1, 1e-9);
  });

  it('gives the per-nozzle flows of the lower-arm table (owner update 2.5) in state L at 3000 rpm', () => {
    // [nozzle, Q in L/min] from the table "p_arm = 22.1 kPa, jet velocity 6.65 m/s, total 30.5
    // L/min": every round hole 2.90, the tip slots 2.59, the underside outlet 2.11.
    const flows: readonly (readonly [string, number])[] = [
      ['l1', 2.9],
      ['l2', 2.9],
      ['l3', 2.9],
      ['l4', 2.9],
      ['l5', 2.9],
      ['l6', 2.9],
      ['l7', 2.9],
      ['l8', 2.9],
      ['l9', 2.59],
      ['l10', 2.59],
      ['l11', 2.11],
    ];
    const branch = must(hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000).branches[0]);
    expect(branch.nozzles.map((n) => n.id)).toEqual(flows.map(([id]) => id));
    for (const [id, flow] of flows) {
      const nozzle = must(branch.nozzles.find((n) => n.id === id));
      expectNear(toLPerMin(nozzle.flow), flow, 0.011, `flow of ${id}`);
      expectNear(nozzle.jetSpeed, 6.65, 0.01, `jet speed of ${id}`);
    }
    // Independently of the table: a round hole passes C_d A v = 0.85 x 8.553 mm2 x 6.65 m/s
    // = 48.3 mL/s, and its momentum flux is rho Q v = 0.32 N, the largest on the arm (the
    // dossier's single strongest jet, a 3.8 mm bore at 0.48 N, does not exist).
    const round = must(branch.nozzles.find((n) => n.id === 'l5'));
    expectWithin(round.flow, ((0.85 * Math.PI * 0.0033 ** 2) / 4) * branch.idealJetSpeed, 1e-12);
    expectNear(round.thrust, WATER_DENSITY * 48.3e-6 * 6.65, 0.002);
    expectNear(Math.max(...branch.nozzles.map((n) => n.thrust)), 0.32, 0.005, 'largest thrust');
  });

  it('gives the per-nozzle flows of the upper-arm and roof tables (owner update 3.4) in state UR at 3000 rpm', () => {
    // "p_arm = 16.6 kPa, jet velocity 5.77 m/s, arm 19.8 L/min, roof 8.6 L/min".
    const upper: readonly (readonly [string, number])[] = [
      ['u1', 1.45],
      ['u2', 2.85],
      ['u3', 2.85],
      ['u4', 2.85],
      ['u5', 2.85],
      ['u6', 2.67],
      ['u7', 2.67],
      ['u8', 1.59],
    ];
    const point = hydraulicOperatingPoint(BOSCH_AS_UPDATE_SOLVED, 'ur', 3000);
    const arm = must(branchOperatingPoint(point, 'upper'));
    expect(arm.nozzles.map((n) => n.id)).toEqual(upper.map(([id]) => id));
    for (const [id, flow] of upper) {
      const nozzle = must(arm.nozzles.find((n) => n.id === id));
      expectNear(toLPerMin(nozzle.flow), flow, 0.011, id);
      expectNear(nozzle.jetSpeed, 5.77, 0.01, `jet speed of ${id}`);
    }
    const roof = must(branchOperatingPoint(point, 'roof'));
    expectNear(toLPerMin(must(roof.nozzles[0]).flow), 8.6, 0.06, 'roof outlet flow');
  });

  it('moves the upper branch with the Rackmatic level: 0.025 m of lift per level', () => {
    const upper = getBranch(BOSCH_SMV4HAX40G, 'upper');
    expect(upper.liftAtPosition).toBe('2');
    const at = (level: string) =>
      must(
        branchOperatingPoint(
          hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'u', 3000, { basketHeights: { upper: level } }),
          'upper',
        ),
      );
    expectNear(at('1').staticLift, 0.455, 1e-12);
    expectNear(at('2').staticLift, 0.43, 1e-12);
    expectNear(at('3').staticLift, 0.405, 1e-12);
    // A higher arm leaves less pressure in it: about rho g x 0.025 m = 245 Pa per level, less
    // what the flow gives back. For one branch p_arm = rho g (H - z) / (1 + 2 (CdA)^2 (g b + K /
    // rho)), so the drop is 245 Pa / (1 + 2 (57.1e-6)^2 (9.80665 x 4.284e6 + 8e10 / 998)) = 137 Pa
    // with the measured C_d A of 57.1 mm2 (it was 181 Pa with the dossier's 41.0 mm2).
    const drop = at('2').armPressure - at('1').armPressure;
    const expected =
      (WATER_DENSITY * STANDARD_GRAVITY * 0.025) /
      (1 + 2 * 57.1e-6 ** 2 * (STANDARD_GRAVITY * 1.19e-3 * 3.6e9 + 8e10 / WATER_DENSITY));
    expectNear(expected, 137, 1);
    expectNear(drop, expected, 0.5);
    // The default configuration is level 1.
    expect(
      must(branchOperatingPoint(hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'u', 3000), 'upper'))
        .staticLift,
    ).toBe(at('1').staticLift);
  });
});

describe('the unresolved bore: the Bosch with the 4.5 mm of the drill test (machine-bosch-owner-update.md section 5.2, case D)', () => {
  // Only the rows that involve the lower arm differ from case P.
  const table: readonly TableRow[] = [
    ['l', 2400, 14.3, 30.4, { lower: [30.4, 8.0, 4.01] }, 7.2, 33],
    ['l', 2800, 19.2, 35.7, { lower: [35.7, 11.1, 4.71] }, 11.5, 48],
    ['l', 3000, 22.0, 38.4, { lower: [38.4, 12.8, 5.06] }, 14.1, 57],
    ['l', 3400, 28.1, 43.6, { lower: [43.6, 16.5, 5.75] }, 20.5, 79],
    ['lu', 2400, 10.5, 35.4, { lower: [25.7, 5.7, 3.39], upper: [9.7, 4.0, 2.82] }, 6.2, 29],
    ['lu', 2800, 13.7, 41.8, { lower: [29.8, 7.7, 3.93], upper: [12.0, 6.1, 3.5] }, 9.6, 41],
    ['lu', 3000, 15.6, 45.0, { lower: [31.9, 8.8, 4.21], upper: [13.1, 7.3, 3.82] }, 11.7, 49],
    ['lu', 3400, 19.6, 51.3, { lower: [36.1, 11.3, 4.75], upper: [15.3, 9.9, 4.46] }, 16.8, 66],
  ];

  it.each(table)('reproduces the row %s at %i rpm', (...row) => {
    expectTableRow(BOSCH_DRILL_BORE_AS_UPDATE_SOLVED, row);
  });

  it('differs from the default machine only in the lower arm: C_d A 126.4 mm2, eight 4.5 mm bores', () => {
    const lower = getSprayLevel(BOSCH_SMV4HAX40G_DRILL_BORE, 'lower');
    const round = lower.nozzles.filter((n) => n.shape === 'round');
    expect(round).toHaveLength(8);
    for (const n of round) expectNear(must(n.size[0]), 0.0045, 1e-12);
    expectNear(sprayLevelCdA(lower) * 1e6, 126.4, 0.05);
    expectNear(getBranch(BOSCH_SMV4HAX40G_DRILL_BORE, 'lower').statedCdA * 1e6, 126.4, 0.05);
    expect(BOSCH_SMV4HAX40G_DRILL_BORE.id).not.toBe(BOSCH_SMV4HAX40G.id);
    expect(getSprayLevel(BOSCH_SMV4HAX40G_DRILL_BORE, 'upper')).toEqual(
      getSprayLevel(BOSCH_SMV4HAX40G, 'upper'),
    );
    expect(BOSCH_SMV4HAX40G_DRILL_BORE.hydraulics.pump).toEqual(BOSCH_SMV4HAX40G.hydraulics.pump);
    // States that do not feed the lower arm are the default machine's.
    for (const state of ['ur', 'u', 'r']) {
      expect(hydraulicOperatingPoint(BOSCH_SMV4HAX40G_DRILL_BORE, state, 3000).flow).toBe(
        hydraulicOperatingPoint(BOSCH_SMV4HAX40G, state, 3000).flow,
      );
    }
  });

  it('halves the impact pressure of the lower jets: 5.06 against 6.65 m/s (section 5.4)', () => {
    const tape = must(hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000).branches[0]);
    const drill = must(hydraulicOperatingPoint(BOSCH_SMV4HAX40G_DRILL_BORE, 'l', 3000).branches[0]);
    expectNear(drill.idealJetSpeed / tape.idealJetSpeed, 5.06 / 6.65, 0.003);
    expectNear((drill.idealJetSpeed / tape.idealJetSpeed) ** 2, 0.58, 0.01);
    // "30 to 50 % more flow than documented at 70 % of the head" (section 5.3): 2.25 m.
    expectNear(
      hydraulicOperatingPoint(BOSCH_SMV4HAX40G_DRILL_BORE, 'l', 3000).pumpHead,
      2.25,
      0.006,
    );
  });
});

describe('hydraulic operating points of SPOT-60 (machine.md section 4.3)', () => {
  const table: readonly TableRow[] = [
    ['l', 3400, 53.3, 34.9, { lower: [34.9, 45.1, 9.5] }, 31.0, null],
    ['l', 3000, 41.6, 30.7, { lower: [30.7, 34.9, 8.36] }, 21.3, 82],
    ['l', 2600, 31.3, 26.5, { lower: [26.5, 25.9, 7.21] }, 13.8, null],
    ['l', 2200, 22.5, 22.2, { lower: [22.2, 18.3, 6.06] }, 8.3, null],
    ['l', 1800, 15.2, 17.9, { lower: [17.9, 11.9, 4.89] }, 4.5, null],
    ['u', 3400, 57.3, 30.2, { mid: [22.8, 44.1, 9.4], top: [7.4, 33.3, 8.17] }, 28.8, null],
    ['u', 3000, 44.8, 26.3, { mid: [19.9, 33.6, 8.2], top: [6.4, 24.9, 7.07] }, 19.6, null],
    ['u', 2600, 34.0, 22.3, { mid: [16.9, 24.4, 6.99], top: [5.4, 17.6, 5.94] }, 12.6, null],
    ['u', 2200, 24.6, 18.2, { mid: [13.9, 16.5, 5.75], top: [4.3, 11.3, 4.76] }, 7.5, null],
    ['u', 1800, 16.8, 14.0, { mid: [10.8, 9.9, 4.46], top: [3.2, 6.1, 3.49] }, 3.9, null],
    [
      'a',
      3000,
      27.9,
      44.6,
      { lower: [24.9, 22.9, 6.78], mid: [15.0, 19.2, 6.21], top: [4.7, 13.5, 5.2] },
      20.7,
      null,
    ],
    [
      'a',
      3400,
      35.3,
      51.0,
      { lower: [28.2, 29.4, 7.67], mid: [17.3, 25.5, 7.15], top: [5.5, 18.5, 6.08] },
      30.0,
      null,
    ],
  ];

  // The generic table is printed to the same digits but was rounded from a solve whose last
  // digit is occasionally one unit off this one (5.5 against 5.47 L/min); allow 0.6 % more.
  it.each(table)('reproduces the row %s at %i rpm', (...row) => {
    const [state, rpm, pumpKPa, total, branches] = row;
    const point = hydraulicOperatingPoint(SPOT_60, state, rpm);
    expectWithin(toKPa(point.pumpPressure), pumpKPa, 0.006, 'pump pressure');
    expectWithin(toLPerMin(point.flow), total, 0.006, 'total flow');
    for (const [id, [flow, armKPa, jet]] of Object.entries(branches)) {
      const branch = must(branchOperatingPoint(point, id));
      expectNear(toLPerMin(branch.flow), flow, 0.06 + 0.006 * flow, `${id} flow`);
      expectNear(toKPa(branch.armPressure), armKPa, 0.06 + 0.006 * armKPa, `${id} arm pressure`);
      expectNear(branch.idealJetSpeed, jet, 0.006 + 0.006 * jet, `${id} jet speed`);
    }
  });

  it('draws 82 W in state L at 3000 rpm: 21.3 W hydraulic (section 4.2)', () => {
    const point = hydraulicOperatingPoint(SPOT_60, 'l', 3000);
    expectNear(point.hydraulicPower, 21.3, 0.15);
    expectNear(point.electricalPower, 82, 0.6);
    expectNear(pumpElectricalPower(SPOT_60.hydraulics.pump, 21.3), 21.3 / (0.4 * 0.72) + 8, 1e-9);
  });

  it('feeding all arms drops the lower jets from 8.4 to 6.8 m/s and needs 45 L/min (section 4.3)', () => {
    const one = must(hydraulicOperatingPoint(SPOT_60, 'l', 3000).branches[0]);
    const all = hydraulicOperatingPoint(SPOT_60, 'a', 3000);
    expectNear(one.idealJetSpeed, 8.4, 0.05);
    expectNear(must(branchOperatingPoint(all, 'lower')).idealJetSpeed, 6.8, 0.05);
    expectNear(toLPerMin(all.flow), 45, 0.5);
  });
});

describe('the pump curve (machine.md section 4.2)', () => {
  it('follows the generic curve table: head in m at flow and speed', () => {
    // [Q L/min, head at 1800, 2200, 2600, 3000, 3400 rpm]; zero where the table prints 0.
    const rows: readonly (readonly number[])[] = [
      [0, 1.98, 2.96, 4.13, 5.5, 7.06],
      [10, 1.85, 2.82, 4.0, 5.37, 6.93],
      [20, 1.45, 2.42, 3.6, 4.97, 6.53],
      [30, 0.78, 1.76, 2.93, 4.3, 5.86],
      [40, 0, 0.82, 2.0, 3.37, 4.93],
      [50, 0, 0, 0.8, 2.17, 3.73],
      [60, 0, 0, 0, 0.7, 2.27],
    ];
    const speeds = [1800, 2200, 2600, 3000, 3400];
    const pump = SPOT_60.hydraulics.pump;
    for (const row of rows) {
      const flow = must(row[0]) / 60000;
      speeds.forEach((rpm, i) => {
        const head = Math.max(pumpHeadAt(pump, flow, rpm), 0);
        expectNear(head, must(row[i + 1]), 0.011, `head at ${must(row[0])} L/min, ${rpm} rpm`);
      });
    }
  });

  it('keeps the Bosch pump curve (owner update 5.4): 3.1 m at 27.5 L/min, 58 L/min free delivery; 385 mbar at 3500 rpm on the measured lower arm', () => {
    const pump = BOSCH_SMV4HAX40G.hydraulics.pump;
    expectNear(pump.shutOffHead, 4.0, 1e-12);
    expect(pump.ratedSpeedRpm).toBe(3000);
    expect(pump.speedRangeRpm).toEqual([2000, 3500]);
    expectNear(pumpHeadAt(pump, 27.5 / 60000, 3000), 3.1, 0.005);
    expectNear(toLPerMin(pumpFlowAt(pump, 0, 3000)), 58, 0.05);
    // The dossier built the curve to give 400 mbar at 3500 rpm on a lower arm of 66.0 mm2. On
    // the measured 76.4 mm2 the same curve gives, in closed form with the update's figures
    // (z = 0.11 m, K = 2.0e10 Pa s2/m6): Q^2 = rho g (H0 r^2 - z) / (rho g b + K + rho / (2 CdA^2)).
    const rhoG = WATER_DENSITY * STANDARD_GRAVITY;
    const b = 1.19e-3 * 3.6e9;
    const head0 = 4.0 * (3500 / 3000) ** 2;
    const q2 = (rhoG * (head0 - 0.11)) / (rhoG * b + 2.0e10 + WATER_DENSITY / (2 * 76.4e-6 ** 2));
    const point = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3500);
    expectWithin(point.pumpPressure, rhoG * (head0 - b * q2), 1e-4);
    expectNear(toKPa(point.pumpPressure), 38.5, 0.1);
    expectNear(point.pumpHead, 3.93, 0.01);
    // Section 5.3 of the update: one level at a time at 3000 rpm the pump works at 30.5 L/min
    // and 2.9 m (lower) and 28.4 L/min and 3.0 m (upper with roof), inside the documented 25 to
    // 30 L/min at 3.1 m of the sister pump within its rounding.
    const l = hydraulicOperatingPoint(BOSCH_AS_UPDATE_SOLVED, 'l', 3000);
    const ur = hydraulicOperatingPoint(BOSCH_AS_UPDATE_SOLVED, 'ur', 3000);
    expectNear(l.pumpHead, 2.89, 0.006);
    expectNear(ur.pumpHead, 3.04, 0.006);
  });

  it('converts b from m per (L/min)^2 to m per (m^3/s)^2: 1.333e-3 is 4.80e6 (machine.md 12.2)', () => {
    // "b = 1.333e-3 m per (L/min)^2 = 4.80e6 m per (m3/s)^2": the second figure to three digits.
    expectWithin(SPOT_60.hydraulics.pump.curveCoefficient, 4.8e6, 1e-3);
    expectWithin(SPOT_60.hydraulics.pump.curveCoefficient, 1.333e-3 * 60000 * 60000, 1e-12);
    expectWithin(BOSCH_SMV4HAX40G.hydraulics.pump.curveCoefficient, 1.19e-3 * 3.6e9, 1e-12);
  });

  it('scales with the square of the speed and inverts consistently', () => {
    const pump = BOSCH_SMV4HAX40G.hydraulics.pump;
    for (const rpm of [2000, 2800, 3500]) {
      for (const flowLPerMin of [5, 20, 35]) {
        const flow = flowLPerMin / 60000;
        const head = pumpHeadAt(pump, flow, rpm);
        if (head <= 0) continue;
        const back = pumpFlowAt(pump, WATER_DENSITY * STANDARD_GRAVITY * head, rpm);
        expectWithin(back, flow, 1e-10);
      }
    }
    expectWithin(pumpHeadAt(pump, 0, 1500), 4.0 * 0.25, 1e-12);
  });
});

describe('the network solve', () => {
  it('agrees with the closed form for a single branch to 1e-10', () => {
    // One branch: rho g (H0 r^2 - b Q^2) = rho g z + K Q^2 + rho Q^2 / (2 (CdA)^2).
    for (const spec of [BOSCH_SMV4HAX40G, SPOT_60]) {
      const pump = spec.hydraulics.pump;
      const branch = getBranch(spec, 'lower');
      const cdA = sprayLevelCdA(getSprayLevel(spec, 'lower'));
      for (const rpm of [1800, 2400, 3000, 3400]) {
        const r = rpm / pump.ratedSpeedRpm;
        const rhoG = WATER_DENSITY * STANDARD_GRAVITY;
        const q = Math.sqrt(
          (rhoG * (pump.shutOffHead * r * r - branch.staticLift)) /
            (rhoG * pump.curveCoefficient +
              branch.lossCoefficient +
              WATER_DENSITY / (2 * cdA * cdA)),
        );
        const point = hydraulicOperatingPoint(spec, 'l', rpm);
        expectWithin(point.flow, q, 1e-10, `${spec.id} at ${rpm} rpm`);
        expectWithin(
          point.pumpPressure,
          rhoG * (pump.shutOffHead * r * r - pump.curveCoefficient * q * q),
          1e-10,
        );
      }
    }
  });

  it('conserves flow: nozzles add up to their branch and branches to the pump', () => {
    for (const spec of [BOSCH_SMV4HAX40G, SPOT_60]) {
      for (const position of spec.hydraulics.diverter.positions) {
        for (const rpm of [2000, 2800, 3400]) {
          const point = hydraulicOperatingPoint(spec, position.id, rpm);
          let branchSum = 0;
          for (const branch of point.branches) {
            const nozzleSum = branch.nozzles.reduce((sum, n) => sum + n.flow, 0);
            expectNear(
              nozzleSum,
              branch.flow,
              1e-12 + 1e-10 * branch.flow,
              `${spec.id} ${position.id} ${branch.id}`,
            );
            // p_pump = rho g z + K Q^2 + p_arm on every branch that flows.
            if (branch.flow > 0) {
              const balance =
                WATER_DENSITY * STANDARD_GRAVITY * branch.staticLift +
                branch.lossPressure +
                branch.armPressure;
              expectWithin(balance, point.pumpPressure, 1e-10);
            }
            branchSum += branch.flow;
          }
          expectNear(
            branchSum,
            point.flow,
            1e-12 + 1e-9 * point.flow,
            `${spec.id} ${position.id} at ${rpm}`,
          );
          // The pump delivers that flow at that pressure: both sides of the root agree.
          const delivered = pumpFlowAt(spec.hydraulics.pump, point.pumpPressure, rpm);
          if (point.flow > 0)
            expectWithin(delivered, point.flow, 1e-9, `${spec.id} ${position.id} pump flow`);
          const head = pumpHeadAt(spec.hydraulics.pump, point.flow, rpm);
          expectNear(
            WATER_DENSITY * STANDARD_GRAVITY * head,
            point.pumpPressure,
            1e-9 * Math.max(point.pumpPressure, 1),
          );
        }
      }
    }
  });

  it('runs a closed position against shut-off pressure with no flow', () => {
    const point = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'closed', 3000);
    expect(point.flow).toBe(0);
    expect(point.branches).toEqual([]);
    expectWithin(point.pumpPressure, WATER_DENSITY * STANDARD_GRAVITY * 4.0, 1e-12);
    expect(point.hydraulicPower).toBe(0);
  });

  it('gives nothing with the pump stopped', () => {
    const point = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 0);
    expect(point.flow).toBe(0);
    expect(point.pumpPressure).toBe(0);
    expect(point.electricalPower).toBe(0);
    expect(must(point.branches[0]).nozzles.every((n) => n.flow === 0 && n.jetSpeed === 0)).toBe(
      true,
    );
  });

  it('passes no water into a branch whose lift exceeds the pump head', () => {
    // At 1000 rpm the Bosch pump's shut-off head is 4.0 / 9 = 0.44 m: above the lower arm's
    // 0.11 m and the upper arm's 0.43 m at level 2, but below the roof's 0.69 m.
    const point = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'ur', 1000, {
      basketHeights: { upper: '2' },
    });
    expect(must(branchOperatingPoint(point, 'roof')).flow).toBe(0);
    expect(must(branchOperatingPoint(point, 'roof')).armPressure).toBe(0);
    expect(must(branchOperatingPoint(point, 'upper')).flow).toBeGreaterThan(0);
    expect(branchFlowAt({ id: 'x', staticLift: 1, lossCoefficient: 0, cdA: 1e-5 }, 5000)).toBe(0);
  });

  it('is deterministic and independent of the order the branches are named in', () => {
    const pump = SPOT_60.hydraulics.pump;
    const a = { id: 'a', staticLift: 0.15, lossCoefficient: 2e10, cdA: 61.2e-6 };
    const b = { id: 'b', staticLift: 0.52, lossCoefficient: 5.6e10, cdA: 40.4e-6 };
    const ab = solveNetwork(pump, [a, b], 3000);
    const ba = solveNetwork(pump, [b, a], 3000);
    expect(ab.pumpPressure).toBe(solveNetwork(pump, [a, b], 3000).pumpPressure);
    expectWithin(ba.pumpPressure, ab.pumpPressure, 1e-12);
    expectWithin(must(ba.branchFlows[1]), must(ab.branchFlows[0]), 1e-12);
    expect(BISECTION_ITERATIONS).toBeGreaterThanOrEqual(60);
  });
});

describe('nozzle blockage, opening fraction and air ingestion (machine.md section 12.2 item 1)', () => {
  it('a blocked nozzle passes nothing, the others a little more, the arm less in total', () => {
    const clear = must(hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000).branches[0]);
    const blocked = must(
      hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000, { blockage: { lower: { l7: 1 } } })
        .branches[0],
    );
    expect(must(blocked.nozzles.find((n) => n.id === 'l7')).flow).toBe(0);
    expect(blocked.flow).toBeLessThan(clear.flow);
    expect(blocked.armPressure).toBeGreaterThan(clear.armPressure);
    const l1Clear = must(clear.nozzles.find((n) => n.id === 'l1')).flow;
    const l1Blocked = must(blocked.nozzles.find((n) => n.id === 'l1')).flow;
    expect(l1Blocked).toBeGreaterThan(l1Clear);
    // The remaining C_d A is the owner update's 76.4 mm2 less one 3.3 mm bore, 0.85 x 8.55 mm2.
    expectNear(blocked.cdA * 1e6, 76.4 - 0.85 * 8.55, 0.05);
  });

  it('half-blocking every nozzle is the same as halving the opening of the branch', () => {
    const half: Record<string, number> = {};
    for (const nozzle of getSprayLevel(BOSCH_SMV4HAX40G, 'lower').nozzles) half[nozzle.id] = 0.5;
    const byBlockage = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000, {
      blockage: { lower: half },
    });
    const byOpening = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000, {
      branchOpening: { lower: 0.5 },
    });
    expectWithin(byBlockage.flow, byOpening.flow, 1e-12);
    expectWithin(byBlockage.pumpPressure, byOpening.pumpPressure, 1e-12);
  });

  it('derates the pump head by 1 - 2.5 alpha, to nothing at alpha = 0.4 (machine.md 4.5)', () => {
    expect(headFactorFromAirFraction(0)).toBe(1);
    expectNear(headFactorFromAirFraction(0.1), 0.75, 1e-12);
    expectNear(headFactorFromAirFraction(0.2), 0.5, 1e-12);
    expect(headFactorFromAirFraction(0.4)).toBe(0);
    expect(headFactorFromAirFraction(0.6)).toBe(0);
    expect(headFactorFromAirFraction(-0.1)).toBe(1);
  });

  it('an air fraction acts exactly like a lower shut-off head', () => {
    // f_H = 0.75 at 3000 rpm is the pump at 3000 x sqrt(0.75) rpm, as far as the head term goes.
    const airy = hydraulicOperatingPoint(SPOT_60, 'l', 3000, { airFraction: 0.1 });
    const slower = hydraulicOperatingPoint(SPOT_60, 'l', 3000 * Math.sqrt(0.75));
    expect(airy.headFactor).toBe(0.75);
    expectWithin(airy.flow, slower.flow, 1e-10);
    expectWithin(airy.pumpPressure, slower.pumpPressure, 1e-10);
    expect(hydraulicOperatingPoint(SPOT_60, 'l', 3000, { airFraction: 0.5 }).flow).toBe(0);
  });

  it('uses the density and gravity it is given', () => {
    // With no static lift and no feed loss the flow does not depend on the density at all.
    const pump = SPOT_60.hydraulics.pump;
    const branch = { id: 'b', staticLift: 0, lossCoefficient: 0, cdA: 50e-6 };
    const water = solveNetwork(pump, [branch], 3000, 1, 998, STANDARD_GRAVITY);
    const hot = solveNetwork(pump, [branch], 3000, 1, 983, STANDARD_GRAVITY);
    expectWithin(hot.flow, water.flow, 1e-10);
    expectWithin(hot.pumpPressure / water.pumpPressure, 983 / 998, 1e-10);
  });
});
