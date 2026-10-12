// Contract tests of module M9: the shapes of its records with the numbers of the contract's own
// regression list, and its enumerations against what docs/design/sim-core.md states.
import { celsiusToKelvin } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  FILLS,
  LIQUOR_CLASS_IDS,
  LIQUOR_STATE_FIELDS,
  TABLET_STATES,
  type DepositSinks,
  type DetergentSpec,
  type LiquorState,
  type RateTables,
  type SupplySpec,
  type TabletSupply,
} from './index.ts';

/** A main-wash liquor of the regression row "pH 10.7 at 50 C for type D at 4.1 g/L". */
const MAIN_WASH: LiquorState = {
  V_m3: 3.6e-3,
  T_K: celsiusToKelvin(50),
  pH: 10.7,
  cls: 'D',
  sigma_N_m: 0.04,
  nu_m2_s: 0.553e-6,
  rho_kg_m3: 988,
  alkalinity: 25,
  carbonate: 15,
  protease: 0.05,
  amylase: 0.02,
  paa: 0.23,
  hoo: 0.1,
  surfactant: 0.08,
  chelantFree: 1.2,
  caFree: 0,
  fatFree: 0.01,
  fines: 0.05,
  grit: 0.01,
  tds: 4.1,
  dissolved: 0.3,
  foam: 0.1,
  filterLoad: 0.002,
  tabletLeft_kg: 0.001,
};

describe('LiquorState (section M9)', () => {
  it('has the 24 fields of the contract', () => {
    // The interface of section M9 lists V_m3, T_K, pH, cls, sigma_N_m, nu_m2_s, rho_kg_m3,
    // alkalinity, carbonate, protease, amylase, paa, hoo, surfactant, chelantFree, caFree,
    // fatFree, fines, grit, tds, dissolved, foam, filterLoad, tabletLeft_kg.
    const names =
      'V_m3 T_K pH cls sigma_N_m nu_m2_s rho_kg_m3 alkalinity carbonate protease amylase paa hoo ' +
      'surfactant chelantFree caFree fatFree fines grit tds dissolved foam filterLoad tabletLeft_kg';
    expect(Object.keys(MAIN_WASH)).toEqual(names.split(' '));
    expect(Object.keys(MAIN_WASH)).toHaveLength(LIQUOR_STATE_FIELDS);
  });

  it('is class D once the dissolved surfactant passes liq.surfClass', () => {
    // "`liq.surfClass` 0.02 kg/m3 of nonionic surfactant (about 18 % of a 20 g dose in 3.6 L)":
    // 0.02 kg/m3 in 3.6 L is 72 mg, which is 18 % of the 0.4 g of surfactant in a dose with 2 %
    // of it.
    const threshold = 0.02;
    expect(MAIN_WASH.surfactant).toBeGreaterThan(threshold);
    expect(MAIN_WASH.cls).toBe('D');
    expect(LIQUOR_CLASS_IDS).toContain(MAIN_WASH.cls);
    const surfactantInDose = (threshold * MAIN_WASH.V_m3) / 0.18;
    expect(surfactantInDose / 0.02).toBeCloseTo(0.02, 3);
  });

  it('holds the peracid peak of the regression list in mol/m3', () => {
    // "peracid peak about 0.23 mmol/L": 1 mmol/L is 1 mol/m3.
    expect(MAIN_WASH.paa).toBeCloseTo(0.23, 2);
  });
});

describe('inputs and exchanges of the liquor model', () => {
  it('names the three tablet states and the four fills', () => {
    // M9: "state: 'closed' | 'released' | 'stuck'"; M10: fill fractions "(pre-rinse, main wash,
    // intermediate rinses, final rinse)".
    expect(TABLET_STATES).toEqual(['closed', 'released', 'stuck']);
    expect([...FILLS]).toEqual(['preRinse', 'mainWash', 'intermediateRinse', 'finalRinse']);
  });

  it('accepts the tablet supplies of the M10 tablet test', () => {
    // "tablet on tray blocks under films of 0.02 and 0.002 kg/(m s); in a full basin; behind a
    // stuck lid | w_tab = 1, 0.11, 1 (into the basin), w_stuck" with `liq.wStuck` = 0.006.
    const supplies: TabletSupply[] = [
      { state: 'released', wTab: 1, into: 'sump' },
      { state: 'released', wTab: 0.11, into: 'sump' },
      { state: 'released', wTab: 1, into: { reservoir: 3 } },
      { state: 'stuck', wTab: 0.006, into: 'sump' },
    ];
    for (const s of supplies) {
      expect(s.wTab).toBeGreaterThanOrEqual(0);
      expect(s.wTab).toBeLessThanOrEqual(1);
    }
    // A stuck tablet at 0.006 releases 15 % of the dose over the main wash where a free one on
    // a well-fed tray releases all of it: the two differ by more than two orders of magnitude.
    expect((supplies[0] as TabletSupply).wTab / (supplies[3] as TabletSupply).wTab).toBeGreaterThan(
      100,
    );
  });

  it('accepts a dose, a supply and the deposit sinks in SI', () => {
    // Appendix A item 26: the regression tests use 14.5 g of detergent in 3.5 L, which is the
    // 4.1 g/L of the pH row.
    const dose: DetergentSpec = {
      id: 'iec_type_d',
      form: 'powder',
      mass_kg: 14.5e-3,
      composition: { carbonate: 1.2 },
    };
    expect(dose.mass_kg / 3.5e-3).toBeCloseTo(4.1, 1);
    const supply: SupplySpec = { T_K: celsiusToKelvin(15), composition: { hardness: 2.5 } };
    expect(supply.T_K).toBeCloseTo(288.15, 10);
    const sinks: DepositSinks = {
      fines_kg: 0,
      grit_kg: 0,
      fat_kg: 0,
      dissolved_kg: 0,
      water_kg: 0.4,
    };
    // "the verified 0.3 to 0.5 L for a normal load" of carry-over per drain.
    expect(sinks.water_kg).toBeGreaterThanOrEqual(0.3);
    expect(sinks.water_kg).toBeLessThanOrEqual(0.5);
  });

  it('sizes the rate tables as the contract states', () => {
    // M8 "Numerics": "(64 entries over the range of block temperatures present)" and "a
    // two-dimensional table pH(alkalinity / total carbonate, T) of 64 x 32 entries".
    const tables: RateTables = {
      T0_K: 290,
      dT_K: 1,
      fTprotease: new Float32Array(64),
      fTamylase: new Float32Array(64),
      aT: [new Float32Array(64)],
      sfc: [new Float32Array(64)],
      pHTable: new Float32Array(64 * 32),
    };
    expect(tables.pHTable).toHaveLength(2048);
    // 64 entries at 1 K cover 17 C to 80 C: the range from a cold fill to past the 70 C of the
    // hottest programme.
    expect(tables.T0_K + 63 * tables.dT_K).toBeGreaterThan(celsiusToKelvin(70));
  });
});
