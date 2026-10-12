/**
 * The programme of the SPOT-60 baseline that this package carries: AUTO 45 to 65 for normal
 * soil, from docs/research/machine.md section 7.3 (13.0 L, 1.15 kWh, 135 min). Section numbers
 * refer to that dossier.
 *
 * The dossier's table has six rows (A1 to A6), each combining several actions and one duration.
 * Each row is written here as its actions in order. What the table leaves open and what is
 * chosen (all [ESTIMATED] there, tagged `generic` or `estimated` here):
 * - a fill takes its volume at the inlet flow (3.0 L/min) and a drain the baseline drain event
 *   (35 s pump, 10 s run-down, 10 s pump); the circulation of a row takes the rest of its
 *   stated duration, and a heat-up as long as the thermal model needs;
 * - rows that give a pump speed without a diverter pattern use the default L/U 60/60;
 * - the main-wash hold (A3) runs with the heater off: the table does not say, and at 55 C the
 *   pump's own heat balances the cabinet loss, so the liquor falls less than 1 K in 25 min.
 *
 * The table's 135 min and 1.15 kWh are anchored to fleet averages (section 7.2), not computed
 * from its steps: with the thermal model of section 6.2 these steps take about 131 min and
 * 0.95 kWh (the final-rinse heat-up starts from a load at 44 C and takes 15 min, not 17).
 * The declared figures are the dossier's; the tolerances are wide enough to hold both.
 *
 * Authoring units: minutes, litres, millilitres, kilowatt-hours, degrees C, rev/min.
 */

import type { DiverterPatternDef, ProgrammeDef } from '../def.ts';
import { prov } from './helpers.ts';

const M = 'machine.md';

/** Lower arm 60 s, then mid and top arm 60 s (section 4.4). */
export const SPOT60_PATTERN_60: DiverterPatternDef = [
  ['l', 60],
  ['u', 60],
];

/** One drain event: 35 s pump, 10 s run-down, 10 s pump (section 4.6), minutes. */
const DRAIN_MIN = 55 / 60;

/** Inlet flow, L/min (section 4.6). */
const INLET_L_PER_MIN = 3.0;

/** AUTO 45 to 65 of SPOT-60 for normal soil, in authoring units. */
export const SPOT60_AUTO_135: ProgrammeDef = {
  id: 'auto_135',
  name: 'AUTO 45-65 (normal soil)',
  description:
    'The soil-sensing AUTO programme of the generic baseline, values for normal soil (machine.md section 7.3): cold pre-rinse, main wash at 55 C, one intermediate rinse, final rinse at 62 C, drying with the door opening after 25 min. 13.0 L, 1.15 kWh, 135 min.',
  steps: [
    {
      id: 'a1_fill',
      row: 'A1',
      phase: 'pre_rinse',
      kind: 'fill',
      label: 'fill',
      sources: [{ from: 'mains', volumeL: 3.4 }],
    },
    {
      id: 'a1_pre_rinse',
      row: 'A1',
      phase: 'pre_rinse',
      kind: 'circulate',
      label: 'cold pre-rinse; turbidity check',
      durationMin: 10 - 3.4 / INLET_L_PER_MIN - DRAIN_MIN,
      pumpRpm: 2600,
      diverter: SPOT60_PATTERN_60,
    },
    {
      id: 'a1_drain',
      row: 'A1',
      phase: 'pre_rinse',
      kind: 'drain',
      label: 'drain',
      durationMin: DRAIN_MIN,
    },
    {
      id: 'a2_fill',
      row: 'A2',
      phase: 'main_wash',
      kind: 'fill',
      label: 'fill',
      sources: [{ from: 'mains', volumeL: 3.6 }],
    },
    {
      id: 'a2_dose',
      row: 'A2',
      phase: 'main_wash',
      kind: 'dose_detergent',
      label: "dispenser armed: it opens after the machine's delay of circulation (60 s)",
    },
    {
      id: 'a2_heat',
      row: 'A2',
      phase: 'main_wash',
      kind: 'heat',
      label: 'heat-up to the target (45 to 65 C by soil level)',
      target: 55,
      pumpRpm: 3000,
      diverter: SPOT60_PATTERN_60,
    },
    {
      id: 'a3_hold',
      row: 'A3',
      phase: 'main_wash',
      kind: 'hold',
      label: 'main wash hold (10 to 40 min by soil level)',
      durationMin: 25,
      target: 55,
      pumpRpm: 3000,
      diverter: SPOT60_PATTERN_60,
    },
    {
      id: 'a4_drain',
      row: 'A4',
      phase: 'main_wash',
      kind: 'drain',
      label: 'drain',
      durationMin: DRAIN_MIN,
    },
    {
      id: 'a4_fill',
      row: 'A4',
      phase: 'intermediate_rinse',
      kind: 'fill',
      label: 'fill',
      sources: [{ from: 'mains', volumeL: 3.0 }],
    },
    {
      id: 'a4_rinse',
      row: 'A4',
      phase: 'intermediate_rinse',
      kind: 'circulate',
      label: 'intermediate rinse, unheated',
      durationMin: 9 - 3.0 / INLET_L_PER_MIN - 2 * DRAIN_MIN,
      pumpRpm: 2600,
      diverter: SPOT60_PATTERN_60,
    },
    {
      id: 'a4_drain_2',
      row: 'A4',
      phase: 'intermediate_rinse',
      kind: 'drain',
      label: 'drain',
      durationMin: DRAIN_MIN,
    },
    {
      id: 'a5_fill',
      row: 'A5',
      phase: 'final_rinse',
      kind: 'fill',
      label: 'fill',
      sources: [{ from: 'mains', volumeL: 3.0 }],
    },
    {
      id: 'a5_rinse_aid',
      row: 'A5',
      phase: 'final_rinse',
      kind: 'dose_rinse_aid',
      label:
        'rinse aid armed: the machine doses it when the liquor reaches its minimum temperature (40 C)',
    },
    {
      id: 'a5_heat',
      row: 'A5',
      phase: 'final_rinse',
      kind: 'heat',
      label: 'final rinse heat-up',
      target: 62,
      pumpRpm: 2800,
      diverter: SPOT60_PATTERN_60,
    },
    {
      id: 'a5_hold',
      row: 'A5',
      phase: 'final_rinse',
      kind: 'hold',
      label: 'final rinse hold',
      durationMin: 3,
      target: 62,
      pumpRpm: 2800,
      diverter: SPOT60_PATTERN_60,
    },
    {
      id: 'a5_drain',
      row: 'A5',
      phase: 'final_rinse',
      kind: 'drain',
      label: 'drain',
      durationMin: DRAIN_MIN,
    },
    {
      id: 'a6_dry',
      row: 'A6',
      phase: 'drying',
      kind: 'dry',
      label: 'drying, door closed; auto-open',
      durationMin: 45,
    },
  ],
  conditions: { loadHeatCapacity: 23000, prestoreInitialVolumeL: 0, otherEnergyKWh: 0.01 },
  declared: {
    durationMin: 135,
    mainsWaterL: 13.0,
    energyKWh: 1.15,
    durationToleranceMin: 5,
    waterToleranceL: 0.05,
    energyTolerance: 0.2,
    printed: null,
  },
  provenance: prov(
    'generic',
    `${M} 7.3 (AUTO 45 to 65), 12.2 item 7`,
    "Totals are anchored to verified programme tables of other machines (section 7.2); the split into steps, their durations, pump speeds and diverter patterns are [ESTIMATED]. The 135 min and 1.15 kWh are anchored to fleet averages and are not what the steps add up to in the model (about 131 min and 0.95 kWh). How each row divides between its actions and the 0.01 kWh for the drain pump and electronics are this package's choices.",
  ),
};

/** The programmes of SPOT-60 in authoring units. */
export const SPOT60_PROGRAMMES: readonly ProgrammeDef[] = [SPOT60_AUTO_135];
