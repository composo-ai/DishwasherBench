/**
 * The programme of the Bosch SMV4HAX40G that the simulation runs, Eco 50, from
 * docs/research/machine-bosch-smv4hax40g.md section 4. Section numbers below refer to that
 * dossier. Eco 50 is the only programme simulated: the others of the machine are out of scope
 * (docs/design/scope.md).
 *
 * Eco 50 is written row for row (E0 to E13) by `boschProgramme` from the building blocks of
 * section 4.4, with the targets, baths and lengths of the outline of section 4.7.
 *
 * The machine is the single source of what it does the same way in every run, and the steps
 * here do not repeat it: when the dispenser opens and when the rinse aid is dosed
 * (`dosing`), how fast water comes in and goes out (`hydraulics.fill`, `hydraulics.drain`), the
 * default alternation of the spray levels (`hydraulics.diverter.defaultPattern`), the heater's
 * cut-out and the default drying time. `expandProgramme` reads them from the machine, so a
 * calibrated value there changes the programme. What the programme fixes is here: its baths,
 * targets, pump speeds, hold lengths and the lengths of its rows.
 *
 * What the dossier leaves open, and what is chosen here (all tagged `estimated`):
 * - A row that both fills and circulates (E7, E9) is written as a fill step followed by a
 *   circulation step. The fill takes the time the pre-store tank needs at the machine's
 *   discharge flow (2.5 L at 5 L/min: 30 s) and the circulation is the row's length less that
 *   nominal half minute.
 * - The rinse aid is dosed by the machine's rule, 60 s after the final-rinse circulation
 *   starts with the liquor above 40 C.
 * - The filter flush after the wash drain is 0.5 L let in and pumped out, without circulation.
 *
 * Authoring units: minutes, litres, millilitres, kilowatt-hours, degrees C, rev/min.
 */

import type { DiverterPatternDef, ProgrammeDef, ProgrammeStepDef } from '../def.ts';
import type { ProgrammePhase } from '../programme-types.ts';
import type { Provenance } from '../provenance.ts';
import type { Range } from '../types.ts';
import { prov } from './helpers.ts';

const B = 'machine-bosch-smv4hax40g.md';

/** Lower arm 45 s, then upper arm with the roof spinner 45 s: the rinses of section 4.4. */
export const BOSCH_PATTERN_45: DiverterPatternDef = [
  ['l', 45],
  ['ur', 45],
];

/** Volume of the pre-store tank (the heat exchanger), litres (section 2.9). */
const TANK_L = 3.1;

/** Volume of a rinse bath, litres (section 2.9). */
const RINSE_L = 2.5;

/** Volume of a filter flush, litres (section 2.9). */
const FLUSH_L = 0.5;

/**
 * Nominal time the tank takes to deliver one rinse bath, minutes (2.5 L at the machine's 5
 * L/min). It only sizes the circulation that shares a row with a tank fill; the fill itself
 * takes what the machine's discharge flow gives.
 */
const TANK_FILL_MIN = 0.5;

/** Full 13 place-setting load, J/K (section 4.4). */
const FULL_LOAD_J_PER_K = 23000;

/** Drain pump and electronics over a run, kWh (section 4.5). */
const OTHER_ENERGY_KWH = 0.01;

/** What a programme of this machine fixes (see `boschProgramme`). */
export interface BoschProgrammeOptions {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Letter of the rows (`E` gives E0 to E13). */
  readonly rowPrefix: string;
  /** Volume of the first bath, litres: 3.1 L of it from the tank, the rest from the mains. */
  readonly firstBathL: number;
  /** Length of the cold pre-rinse, minutes; 0 for a programme without one. */
  readonly preRinseMin: number;
  /** Pump speed of the pre-rinse and of the rinses, rev/min. */
  readonly rinseRpm: number;
  /** Pump speed of the main wash, rev/min. */
  readonly washRpm: number;
  /** Diverter pattern of the pre-rinse and the main wash; undefined: the machine's default. */
  readonly washPattern?: DiverterPatternDef;
  /** Diverter pattern of the rinses. */
  readonly rinsePattern: DiverterPatternDef;
  /** Target of the main wash, degrees C. */
  readonly washTarget: number;
  /** Length of the hold after the heat-up (heater off, pump on), minutes. */
  readonly holdMin: number;
  /** Whether a 0.5 L filter flush follows the wash drain. */
  readonly flush: boolean;
  /** Number of intermediate rinses. */
  readonly intermediateRinses: number;
  /** Length of one intermediate rinse including its fill, minutes. */
  readonly rinseMin: number;
  /** Target of the final rinse, degrees C. */
  readonly finalTarget: number;
  /** Length of the final-rinse hold, minutes. */
  readonly finalHoldMin: number;
  /** Length of the drying step, minutes; undefined: the machine's default drying time. */
  readonly dryMin?: number;
  readonly declared: {
    readonly durationMin: number;
    readonly mainsWaterL: number;
    readonly energyKWh: number | null;
    readonly durationToleranceMin: number;
    readonly energyTolerance: number;
    readonly printedDurationMin: Range | null;
    readonly printedEnergyKWh: Range | null;
    readonly printedMainsWaterL: Range | null;
  };
  readonly provenance: Provenance;
}

/**
 * A programme of the Bosch from the building blocks of section 4.4: pre-drain, first fill from
 * the tank, cold pre-rinse, heat-up during which the machine releases the dispenser, post-wash
 * hold during which the tank is refilled, drain, optional flush, intermediate rinses from the
 * tank, final rinse with rinse aid, drain, and closed-door drying during which the tank is
 * filled in three portions for the next run.
 */
export function boschProgramme(o: BoschProgrammeOptions): ProgrammeDef {
  const p = o.rowPrefix;
  const lower = p.toLowerCase();
  const steps: ProgrammeStepDef[] = [];
  const base = (id: string, row: string, phase: ProgrammePhase, label: string) => ({
    id: `${lower}${id}`,
    row: `${p}${row}`,
    phase,
    label,
  });

  steps.push({
    ...base(
      '0_pre_drain',
      '0',
      'start',
      'pre-drain; the inlet valve is driven for 5 s and its flow pulses are checked',
    ),
    kind: 'drain',
    durationMin: 0.5,
  });
  const firstPhase: ProgrammePhase = o.preRinseMin > 0 ? 'pre_rinse' : 'main_wash';
  steps.push({
    ...base(
      '1_fill',
      '1',
      firstPhase,
      `fill 1: the ${TANK_L} L left in the heat exchanger by the previous run plus ${(o.firstBathL - TANK_L).toFixed(1)} L of mains water`,
    ),
    kind: 'fill',
    durationMin: 1,
    sources: [
      { from: 'prestore', volumeL: TANK_L },
      { from: 'mains', volumeL: o.firstBathL - TANK_L },
    ],
  });
  if (o.preRinseMin > 0) {
    steps.push({
      ...base(
        '2_pre_rinse',
        '2',
        'pre_rinse',
        'cold pre-rinse: no detergent, no heating; turbidity sensor calibrated at the start and read near the end (D1); level check by pump current',
      ),
      kind: 'circulate',
      durationMin: o.preRinseMin,
      pumpRpm: o.rinseRpm,
      ...(o.washPattern === undefined ? {} : { diverter: o.washPattern }),
    });
  }
  const pumped = {
    pumpRpm: o.washRpm,
    ...(o.washPattern === undefined ? {} : { diverter: o.washPattern }),
  };
  steps.push({
    ...base(
      '4_dose',
      '4',
      'main_wash',
      "dispenser armed: the lid is released after the machine's delay of circulation; the tablet drops into the upper-rack tray and is sprayed from below by the upper arm",
    ),
    kind: 'dose_detergent',
  });
  steps.push({
    ...base(
      '4_heat',
      '4',
      'main_wash',
      'main wash, heat-up to the target with the heater on continuously; turbidity read on the way up (D2)',
    ),
    kind: 'heat',
    target: o.washTarget,
    ...pumped,
  });
  // The tank is refilled 15 min before the wash drains, or at the start of a shorter hold.
  const tankAt = Math.max(o.holdMin - 15, 0);
  steps.push({
    ...base(
      '5_hold',
      '5',
      'main_wash',
      `main wash, post-wash phase: heater off, pump on; 15 min before the end the heat exchanger takes ${RINSE_L} L of cold mains water; turbidity read at the end (D3)`,
    ),
    kind: 'hold',
    durationMin: o.holdMin,
    target: o.washTarget,
    ...pumped,
    prestoreFills: [{ atMin: tankAt, volumeL: RINSE_L }],
  });
  steps.push({
    ...base(
      '6_drain',
      '6',
      'main_wash',
      'drain, with short circulate / drain alternation to flush the filter',
    ),
    kind: 'drain',
    durationMin: 1.5,
    filterFlush: true,
  });

  if (o.flush) {
    // A flush without an intermediate rinse takes the rinse's row (7).
    const row = o.intermediateRinses > 0 ? '6b' : '7';
    steps.push({
      ...base(
        '7_flush_fill',
        row,
        'intermediate_rinse',
        'filter flush: 0.5 L of mains water let in',
      ),
      kind: 'fill',
      durationMin: 0.5,
      sources: [{ from: 'mains', volumeL: FLUSH_L }],
    });
    steps.push({
      ...base('7_flush_drain', row, 'intermediate_rinse', 'filter flush: pumped out'),
      kind: 'drain',
      durationMin: 1.5,
      filterFlush: true,
    });
  }
  for (let k = 0; k < o.intermediateRinses; k++) {
    const suffix = k === 0 ? '' : String.fromCharCode('a'.charCodeAt(0) + k);
    steps.push({
      ...base(
        `7${suffix}_fill`,
        `7${suffix}`,
        'intermediate_rinse',
        `intermediate rinse ${k + 1}: ${RINSE_L} L from the heat exchanger, unheated`,
      ),
      kind: 'fill',
      sources: [{ from: 'prestore', volumeL: RINSE_L }],
    });
    steps.push({
      ...base(
        `7${suffix}_rinse`,
        `7${suffix}`,
        'intermediate_rinse',
        `intermediate rinse ${k + 1}: circulation; the heat exchanger is refilled at once with ${RINSE_L} L of mains water for the next bath`,
      ),
      kind: 'circulate',
      durationMin: o.rinseMin - TANK_FILL_MIN,
      pumpRpm: o.rinseRpm,
      diverter: o.rinsePattern,
      prestoreFills: [{ atMin: 0, volumeL: RINSE_L }],
    });
    steps.push({
      ...base(`8${suffix}_drain`, `8${suffix}`, 'intermediate_rinse', 'drain'),
      kind: 'drain',
      durationMin: 1.5,
    });
  }
  steps.push({
    ...base('9_fill', '9', 'final_rinse', `final-rinse fill: ${RINSE_L} L from the heat exchanger`),
    kind: 'fill',
    sources: [{ from: 'prestore', volumeL: RINSE_L }],
  });
  steps.push({
    ...base(
      '9_rinse_aid',
      '9',
      'final_rinse',
      'rinse aid armed: the machine doses it (5 pulses of 1 mL) after its delay of circulation, once the liquor is above its minimum temperature',
    ),
    kind: 'dose_rinse_aid',
  });
  steps.push({
    ...base('9_circulate', '9', 'final_rinse', 'final rinse: circulation before the heat-up'),
    kind: 'circulate',
    durationMin: 2 - TANK_FILL_MIN,
    pumpRpm: o.rinseRpm,
    diverter: o.rinsePattern,
  });
  steps.push({
    ...base('10_heat', '10', 'final_rinse', 'final rinse, heat-up'),
    kind: 'heat',
    target: o.finalTarget,
    pumpRpm: o.rinseRpm,
    diverter: o.rinsePattern,
  });
  steps.push({
    ...base('11_hold', '11', 'final_rinse', 'final rinse, hold'),
    kind: 'hold',
    durationMin: o.finalHoldMin,
    target: o.finalTarget,
    pumpRpm: o.rinseRpm,
    diverter: o.rinsePattern,
  });
  steps.push({
    ...base('12_drain', '12', 'final_rinse', 'drain'),
    kind: 'drain',
    durationMin: 1.5,
  });

  const portion = TANK_L / 3;
  steps.push({
    ...base(
      '13_dry',
      '13',
      'drying',
      `drying: door closed, no fan; the heat exchanger is filled with ${TANK_L} L of cold mains water in three portions (at 5, 30 and 55 % of the step) and stays full for the next run; moisture condenses on the cooled left wall`,
    ),
    kind: 'dry',
    ...(o.dryMin === undefined ? {} : { durationMin: o.dryMin }),
    prestoreFills: [
      { atFraction: 0.05, volumeL: portion },
      { atFraction: 0.3, volumeL: portion },
      { atFraction: 0.55, volumeL: TANK_L - 2 * portion },
    ],
  });

  return {
    id: o.id,
    name: o.name,
    description: o.description,
    steps,
    conditions: {
      loadHeatCapacity: FULL_LOAD_J_PER_K,
      prestoreInitialVolumeL: TANK_L,
      otherEnergyKWh: OTHER_ENERGY_KWH,
    },
    declared: {
      durationMin: o.declared.durationMin,
      mainsWaterL: o.declared.mainsWaterL,
      energyKWh: o.declared.energyKWh,
      durationToleranceMin: o.declared.durationToleranceMin,
      waterToleranceL: 0.05,
      energyTolerance: o.declared.energyTolerance,
      printed: {
        durationMin: o.declared.printedDurationMin,
        energyKWh: o.declared.printedEnergyKWh,
        mainsWaterL: o.declared.printedMainsWaterL,
      },
    },
    provenance: o.provenance,
  };
}

/** The options of Eco 50, the outline of section 4.7 written row for row (E0 to E13). */
export const BOSCH_ECO_50_OPTIONS: BoschProgrammeOptions = {
  id: 'eco_50',
  name: 'Eco 50',
  description:
    'Eco 50, reconstructed in outline in section 4.7: 4.0 L first fill, cold pre-rinse of about 15 min, the same water kept, heat to 50 C, a long soak, filter flush, one 2.5 L intermediate rinse, final rinse to 61 C, drying of the order of 90 min; sensors not used. Printed 4:55, 0.836 kWh, 9.5 L. The dossier writes of "intermittent spraying" in the soak but gives no pattern: the soak is circulated continuously here.',
  rowPrefix: 'E',
  firstBathL: 4.0,
  preRinseMin: 15,
  rinseRpm: 2800,
  washRpm: 3000,
  rinsePattern: BOSCH_PATTERN_45,
  washTarget: 50,
  holdMin: 149,
  flush: true,
  intermediateRinses: 1,
  rinseMin: 7.5,
  finalTarget: 61,
  finalHoldMin: 3,
  dryMin: 90,
  declared: {
    durationMin: 295,
    mainsWaterL: 9.5,
    energyKWh: 0.88,
    durationToleranceMin: 2,
    energyTolerance: 0.06,
    printedDurationMin: [295, 295],
    printedEnergyKWh: [0.836, 0.836],
    printedMainsWaterL: [9.5, 9.5],
  },
  provenance: prov(
    'estimated',
    `${B} 4.7 (Eco 50), 4.4 (rows), 4.1, 4.2 (water arithmetic), 4.5`,
    "Step durations other than the outline's follow the rows reconstructed in section 4.4; the soak is set by the printed 4:55. The dossier's model gives 0.88 kWh against the label's 0.836.",
  ),
};

/** The programme of the Bosch SMV4HAX40G in authoring units: Eco 50, the only one simulated. */
export const BOSCH_PROGRAMMES: readonly ProgrammeDef[] = [boschProgramme(BOSCH_ECO_50_OPTIONS)];
