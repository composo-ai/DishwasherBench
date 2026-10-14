/**
 * What the anchored parameter set is made of: the corrections of mechanism and data that were
 * taken from the dossiers (each a registered parameter whose default is the first build), the
 * parameters the anchoring fit moves, those it took back or returned to their defaults after
 * the review of 10 October 2026, an assumption about the heat stability of the protease of the
 * owner's detergent (a bracket of two values), and the wash input of a literature record.
 */

import type { ParamValue, WashInput } from '@spotless/sim-core';
import {
  machineOfRecord,
  programmeOfRecord,
  washLoadOfRecord,
  type WashRecord,
} from '../../src/index.ts';
import { MILK_CASES, type MilkCase } from './scenario.ts';

/** One override of the anchored set with where it comes from. */
export interface AnchoredOverride {
  readonly key: string;
  readonly value: ParamValue;
  readonly evidence: string;
}

/**
 * Values of the anchored set that are read off bench data or the standard and not searched.
 * Of the corrections the second anchoring carried as overrides, the loading on a lattice, oven
 * drying, a film that nothing renews and a stain judged against a level are registry defaults
 * since the third; the spread of the loading inside a deposit and the scatter of the amount
 * stay in the set, because tests of the first build hold the registry to the lumped element
 * and to exact amounts.
 */
export const MECHANISM_CORRECTIONS: readonly AnchoredOverride[] = [
  {
    key: 'soil.subCellCv',
    value: 0.1,
    evidence:
      'soils 3.2, 7.7 (Go23, verified: a standard deviation of 5 g/m2 at a mean of 50 g/m2 gives a sprayed layer its constant-rate stage and its decay stage) and 6.1 (the in-machine tile runs at a constant rate to about 70 % and is complete at about 65 min, 1.05 to 1.15 times the time its constant rate needs). The second anchoring had 0.3 here on top of 0.3 between patches (a total of 0.42: the thickest places of a deposit took four times its mean, and the tile would be 98 % gone only at about 110 min). The registry default stays 0, the lumped element, because a test of the first build (sim-verify, wash-stacking) holds it there; with it a deposit thins evenly for ever. Measured, not searched',
  },
  {
    key: 'soil.amountCv',
    value: 0.05,
    evidence:
      'standards 13.5: per-item soil mass varies by 3 to 7 % (the verified application tolerances of the IKW method). The registry lays down exactly the stated amount (a weighed soil of a wash record must not scatter); a standard load soiled by hand does, and it is what one run differs from the next by before anything is washed. Data, not searched',
  },
  {
    key: 'soil.egg_yolk.tLag',
    value: 300,
    evidence:
      'soils 6.1 (in-machine tile at 55 C: "no removal for about the first 5 min", then the constant stage), 6.2 (lags of the six cases from the gauge: 3.14 min at 55 C and 13.05 min at 30 C for the reference liquor) and 8.3 ("9 (3 at 55 C, 13 at 30 C; scatter 0.4 to 33)"). The lag of the model runs with the enzyme factor (1.15 at 55 C, 0.54 at 30 C with the activity mid-point at 75 C) and is followed by a ramp of half a lag: 300 s at 50 C gives first removal after 4.3 min and the full rate after 6.5 min at 55 C, and 9.3 min at 30 C; the registered 540 s gives 7.8 and 11.7 min at 55 C against the 5 observed. Read off the bench data, not searched',
  },
  {
    key: 'soil.milk.tLag',
    value: 300,
    evidence:
      'The class milk was split from egg_yolk for its appearance and has no lag data of its own (soils 8.3 lists burnt milk at 10 min with confidence L): it follows the egg-yolk value',
  },
];

/**
 * Values a wash of the owner's own machine fixed, in the set since the sixth anchoring
 * (docs/calibration/owner-wash-01-calibration.md). They are held while the three keys of
 * {@link FITTED_KEYS} are fitted to the published record, and they are in every layer of the
 * set, the owner's capsule included: they describe the machine, not a detergent. Since the
 * seventh anchoring the duty of the soak is also the registered default of `prog.soakDuty`
 * (its range the wash's profile interval, 0.59 to 1); the set goes on stating it, so that a
 * later change of the default cannot move a set fitted with this value.
 */
export const OWNER_CALIBRATED: readonly AnchoredOverride[] = [
  {
    key: 'prog.soakDuty',
    value: 0.8,
    evidence:
      "docs/calibration/owner-wash-01-calibration.md: the owner's wash 01 (four plates of fork-spread egg yolk on Eco 50 with his capsule, 10 October 2026) fitted with the calibration tool together with the published class means and the label's energy. Both air-dried plates came out spotless and both oven-dried ones with 25 and 100 mm2 left: at 0.5, the registered default until that wash was read, the model leaves every plate visibly soiled whatever amount of yolk it carried; with the soak circulated throughout it leaves a tenth of what was seen on the oven-dried plates. The joint log posterior is highest at 0.80 with every other parameter at its registered value and falls by 1.92 only towards 0.6 and not at all before 1 (the 95 % profile interval: about 0.6 to 1, the upper end of the range). The rate, the protease level and this duty move the four plates together; the bench rates and the published means hold the first two, so the duty carries what the wash says. ESTIMATED from one wash whose yolk was not weighed",
  },
];

/** The overrides of the owner-calibrated values as a record of key to value. */
export function ownerCalibratedOverrides(): Record<string, ParamValue> {
  return Object.fromEntries(OWNER_CALIBRATED.map((o) => [o.key, o.value]));
}

/** Corrections of earlier anchorings that are not in the set (kept for the record). */
export const WITHDRAWN_CORRECTIONS: readonly AnchoredOverride[] = [
  {
    key: 'soil.egg_yolk.bakeReference',
    value: 0.2,
    evidence:
      'Rested on the monitor tile of the in-machine study (CFT DM-22) having been heat-aged like an IEC soil. Neither dossier says so; withdrawn after the review of the first anchoring.',
  },
];

/** The parameters the anchoring fit moves, with what identifies each. */
export const FITTED_KEYS: readonly { readonly key: string; readonly why: string }[] = [
  {
    key: 'soil.egg_yolk.rateRef',
    why: 'The six in-machine egg-yolk rates (soils 6.1) alone, on the bench tile, no wash. soil.milk.rateRef is set to the same value: the milk class has no rate data of its own, and the cutlery and the glass class of the round robin ask for the same protease level with it.',
  },
  {
    key: 'liq.xProtease',
    why: "ESTIMATED: how much of the in-machine study's protease prill a gram of reference detergent D is worth is not known (chemistry 1.3; enzymes-at-temperature.md section 4). Identified by the cutlery and the glass class means of the literature record together.",
  },
  {
    key: 'soil.bleachRate',
    why: 'ESTIMATED (chemistry 3.4: "no published rate constant for tea-stain removal by peracid on ceramic"). With the visibility of a stain and the film of the IEC tea set from evidence (soil.tea.visibleMass, soil-data.ts), the crockery class mean identifies it: every plate and bowl is clean on the round robin\'s eco programme, so the crockery deficit is the tea.',
  },
];

/** The search bounds of `liq.xProtease`, kg/kg: 0.03 to 0.10 g/L of prill at 5 g/L of detergent, the range of the bench data. */
export const X_PROTEASE_SEARCH_MAX = 0.02;

/** Parameters earlier anchorings fitted and this one does not search, with the reason. */
export const RETURNED_KEYS: readonly { readonly key: string; readonly why: string }[] = [
  {
    key: 'soil.supplyExchange',
    why: 'Set by three mass balances (its registered source), not by the record: with it the supply factor of the wetted faces of the standard load is 0.84 to 0.99, and halving or doubling it moves no class mean by more than the seed scatter.',
  },
  {
    key: 'soil.applicationCv',
    why: "The spread of a brushed layer decides how long the last specks take and is not identified by class means on a 160 min eco programme (every plate is bare under 0.1 to 0.3). The owner's interrupted egg-yolk wash measures it.",
  },
];

/** The wash input of a wash record: its machine, programme with the stated course, and load. */
export function washInputOfRecord(
  record: WashRecord,
  params: Readonly<Record<string, ParamValue>> = {},
  seeds: { readonly levelSeed?: number; readonly simSeed?: number; readonly milk?: MilkCase } = {},
): WashInput {
  const machine = machineOfRecord(record);
  const programme = programmeOfRecord(record, machine.spec, machine.config);
  const load = washLoadOfRecord(record, machine.spec, machine.config);
  // The record holds the milk as the film that has to be digested; the other reading scales it.
  const milk = MILK_CASES[seeds.milk ?? 'film'] / MILK_CASES.film;
  const items =
    milk === 1
      ? load.items
      : load.items.map((item) => ({
          ...item,
          soils: item.soils.map((soil) =>
            soil.type === 'iec_milk' ? { ...soil, amount_g: soil.amount_g * milk } : soil,
          ),
        }));
  return {
    machine: machine.spec,
    config: machine.config,
    programme: programme.programme,
    items,
    tier: record.sim?.tier ?? 'fast',
    levelSeed: seeds.levelSeed ?? record.sim?.level_seed ?? 1,
    simSeed: seeds.simSeed ?? record.sim?.sim_seed ?? 1,
    params: {
      ...load.params,
      ...(record.sim?.params as Record<string, ParamValue> | undefined),
      ...params,
    },
    ...(load.dispenserBlocked ? { dispenserBlocked: true } : {}),
    ...(Object.keys(load.stalledArms).length > 0 ? { stalledArms: load.stalledArms } : {}),
  };
}

/** The overrides of the bench-anchored values as a record of key to value. */
export function mechanismOverrides(): Record<string, ParamValue> {
  return Object.fromEntries(MECHANISM_CORRECTIONS.map((o) => [o.key, o.value]));
}

/**
 * What a wash with the owner's capsule takes beyond the composition of
 * `packages/calibration/detergents/finish-powerball-ultimate.json`.
 */
export const OWNER_CAPSULE: readonly AnchoredOverride[] = [
  {
    key: 'liq.xProtease',
    value: 0.03,
    evidence:
      "enzymes-at-temperature.md section 4 (fact-checked): a premium unit dose carries 32 to 43 mg of active protease per wash (US 11,492,571, verified), 0.33 to 0.44 g of the 9.71 % granulate of the same maker's in-machine studies (verified), which is the unit of the rate law (soil.enzymeRef: g/L of that prill): 0.026 to 0.034 kg per kg of a 12.9 g capsule; the middle. ESTIMATED from VERIFIED: the owner's capsule is another maker's (subtilisin \"under 1 %\", grade and activity undisclosed), range 0.0125 to 0.05. It replaces the rule of the second anchoring (2.5 times the level fitted for detergent D), which tied the capsule to a fit of another product",
  },
];

/**
 * The upper end of the bracket for the heat stability of the capsule's protease: an
 * ASSUMPTION, labelled as one wherever it is used. The default layer keeps the registered
 * half-life (30 min at 60 C and pH 10.5), which the capsule's milder liquor (pH 10.1 to 10.4)
 * already stretches to 40 to 50 min through liq.proteasePhSlope.
 */
export const OWNER_CAPSULE_STABLE: readonly AnchoredOverride[] = [
  {
    key: 'liq.proteaseHalfLife',
    value: 7200,
    evidence:
      'auto-recommendation.md section 2: "no default; keep both sets as a bracket", 1800 to 14400 s. 2 h at 60 C in place of 30 min. ASSUMED: no measurement in a liquor exists.',
  },
];

/** Mass of one unit of the owner's capsule, kg (detergent dossier 0.3, VERIFIED). */
export const OWNER_TABLET_DOSE = 0.0129;
