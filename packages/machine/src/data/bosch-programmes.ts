/**
 * The programmes of the Bosch SMV4HAX40G, from docs/research/machine-bosch-smv4hax40g.md
 * section 4. Section numbers below refer to that dossier.
 *
 * The primary programme is "AUTO 2:25": Auto 45-65 as the 2 h 25 min run of section 4.4, the
 * normal branch of a sensor-controlled programme, written row for row (A0 to A13). Three other
 * branches of Auto from section 4.6 and the fixed programmes outlined in section 4.7 are built
 * from the same blocks by `boschProgramme`. Machine Care is not here: the dossier does not
 * reconstruct it.
 *
 * The machine is the single source of what it does the same way in every programme, and the
 * steps here do not repeat it: when the dispenser opens and when the rinse aid is dosed
 * (`dosing`), how fast water comes in and goes out (`hydraulics.fill`, `hydraulics.drain`), the
 * default alternation of the spray levels (`hydraulics.diverter.defaultPattern`), the heater's
 * cut-out and the default drying time. `expandProgramme` reads them from the machine, so a
 * calibrated value there changes every programme. What a programme fixes is here: its baths,
 * targets, pump speeds, hold lengths and the lengths of its rows.
 *
 * What the dossier's table leaves open, and what is chosen here (all tagged `estimated`):
 * - A row that both fills and circulates (A7, A9) is written as a fill step followed by a
 *   circulation step. The fill takes the time the pre-store tank needs at the machine's
 *   discharge flow (2.5 L at 5 L/min: 30 s) and the circulation is the row's length less that
 *   nominal half minute.
 * - Row A3, "2.5 L pumped out and replaced" in 2 min, is a 30 s partial drain and a fill of at
 *   least 90 s (longer if the inlet valve needs longer).
 * - The rinse aid is dosed by the machine's rule, 60 s after the final-rinse circulation
 *   starts with the liquor above 40 C: at 1:31.0, where the dossier's table says "at about
 *   1:30.5" (it counts the minute from the start of the row, of which the fill takes 30 s).
 * - The filter flush of the light branch is 0.5 L let in and pumped out, without circulation.
 *
 * Authoring units: minutes, litres, millilitres, kilowatt-hours, degrees C, rev/min.
 */

import type { DiverterPatternDef, ProgrammeDef, ProgrammeStepDef } from '../def.ts';
import type { ProgrammePhase } from '../programme-types.ts';
import type { Provenance } from '../provenance.ts';
import type { Range } from '../types.ts';
import { prov } from './helpers.ts';

const B = 'machine-bosch-smv4hax40g.md';

/**
 * Lower arm 60 s, then upper arm with the roof spinner 60 s (section 2.8; an assumption). The
 * same as the machine's `hydraulics.diverter.defaultPattern`, which the programmes that follow
 * Auto use by giving no wash pattern; this constant is for programmes that fix it.
 */
export const BOSCH_PATTERN_60: DiverterPatternDef = [
  ['l', 60],
  ['ur', 60],
];

/** The same alternation with 45 s dwells, used in the rinses of section 4.4. */
export const BOSCH_PATTERN_45: DiverterPatternDef = [
  ['l', 45],
  ['ur', 45],
];

/** Lower and upper arm fed together (the patent embodiment's position LU). */
export const BOSCH_PATTERN_BOTH: DiverterPatternDef = [['lu', 60]];

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

/** What distinguishes one programme of this machine from another. */
export interface BoschProgrammeOptions {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Letter of the rows (`A` gives A0 to A13). */
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
  /**
   * Water exchanged after the pre-rinse, litres: 0 keeps the water, a volume below the bath
   * is pumped out and replaced, and the whole first bath means a full drain and refill.
   */
  readonly exchangeL: number;
  /** Target of the main wash, degrees C; null for a programme that only rinses. */
  readonly washTarget: number | null;
  /**
   * A staged heat-up: the wash is first heated to `target` (degrees C), then circulated for
   * `holdMin` minutes with the heater off, then heated to `washTarget`. Undefined: one ramp.
   * `docs/research/auto-programme-evidence.md` sections 1.2 and 3.2 (fact-checked): the 2008
   * platform decides the end temperature of an automatic wash "im Reinigen"; a pause near 45 C
   * rests on three weak hints (a relayed service statement, one owner's report, a power trace
   * of an unidentified machine) and none against. Plateau 30 to 45 C, 5 to 20 min; status
   * unknown until a run on the owner's machine is logged.
   */
  readonly heatPlateau?: { readonly target: number; readonly holdMin: number };
  /** Length of the hold after the heat-up, minutes. */
  readonly holdMin: number;
  /** Thermostat band of a wash that is held at its target, kelvin; undefined: heater off. */
  readonly reheatBand?: number;
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
 * the tank, cold pre-rinse, optional water exchange, heat-up during which the machine releases
 * the dispenser, post-wash hold during which the tank is refilled, drain, optional flush, intermediate
 * rinses from the tank, final rinse with rinse aid, drain, and closed-door drying during which
 * the tank is filled in three portions for the next run.
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
  const washes = o.washTarget !== null;

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
  if (washes && o.exchangeL > 0) {
    const full = o.exchangeL >= o.firstBathL;
    steps.push({
      ...base(
        '3_drain',
        '3',
        'pre_rinse',
        full
          ? 'D1 = "heavily soiled": the pre-rinse water is pumped out'
          : `D1 = "soiled": ${o.exchangeL} L pumped out`,
      ),
      kind: 'drain',
      durationMin: 0.5,
      ...(full ? {} : { volumeL: o.exchangeL }),
    });
    steps.push({
      ...base('3_fill', '3', 'main_wash', `replaced with ${o.exchangeL} L of mains water`),
      kind: 'fill',
      // The 2 min row of the partial exchange (section 4.4) leaves 90 s for its fill; a full
      // exchange has no row of its own and takes what the inlet valve needs.
      ...(full ? {} : { durationMin: 1.5 }),
      sources: [{ from: 'mains', volumeL: o.exchangeL }],
    });
  }

  if (o.washTarget !== null) {
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
    if (o.heatPlateau !== undefined) {
      steps.push({
        ...base(
          '4_heat_plateau',
          '4',
          'main_wash',
          `main wash, heat-up to the ${o.heatPlateau.target} C plateau`,
        ),
        kind: 'heat',
        target: o.heatPlateau.target,
        ...pumped,
      });
      steps.push({
        ...base(
          '4_plateau',
          '4',
          'main_wash',
          `plateau: ${o.heatPlateau.holdMin} min with the heater off and the pump on; turbidity read (D2)`,
        ),
        kind: 'hold',
        durationMin: o.heatPlateau.holdMin,
        target: o.heatPlateau.target,
        ...pumped,
      });
    }
    steps.push({
      ...base(
        '4_heat',
        '4',
        'main_wash',
        o.heatPlateau === undefined
          ? 'main wash, heat-up to the target with the heater on continuously; turbidity read on the way up (D2)'
          : 'main wash, heat-up from the plateau to the target',
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
        o.reheatBand === undefined
          ? `main wash, post-wash phase: heater off, pump on; 15 min before the end the heat exchanger takes ${RINSE_L} L of cold mains water; turbidity read at the end (D3)`
          : `main wash held at its target by the heater; 15 min before the end the heat exchanger takes ${RINSE_L} L of cold mains water`,
      ),
      kind: 'hold',
      durationMin: o.holdMin,
      target: o.washTarget,
      ...(o.reheatBand === undefined ? {} : { reheatBand: o.reheatBand }),
      ...pumped,
      prestoreFills: [{ atMin: tankAt, volumeL: RINSE_L }],
    });
  }
  steps.push({
    ...base(
      '6_drain',
      '6',
      washes ? 'main_wash' : 'pre_rinse',
      'drain, with short circulate / drain alternation to flush the filter',
    ),
    kind: 'drain',
    durationMin: 1.5,
    filterFlush: true,
  });

  if (washes) {
    if (o.flush) {
      // The light branch has the flush in place of the intermediate rinse (row 7).
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
      ...base(
        '9_fill',
        '9',
        'final_rinse',
        `final-rinse fill: ${RINSE_L} L from the heat exchanger`,
      ),
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
  }

  const portion = TANK_L / 3;
  steps.push({
    ...base(
      '13_dry',
      '13',
      'drying',
      washes
        ? `drying: door closed, no fan; the heat exchanger is filled with ${TANK_L} L of cold mains water in three portions (at 5, 30 and 55 % of the step) and stays full for the next run; moisture condenses on the cooled left wall`
        : `the heat exchanger is refilled with ${TANK_L} L of mains water for the next run`,
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

/** The manufacturer's printed range for Auto 45-65 (section 4.1). */
const AUTO_PRINTED = {
  printedDurationMin: [100, 165] as Range,
  printedEnergyKWh: [0.9, 1.5] as Range,
  printedMainsWaterL: [7.0, 15.5] as Range,
};

/** The options of AUTO 2:25, the table of section 4.4. */
export const BOSCH_AUTO_145_OPTIONS: BoschProgrammeOptions = {
  id: 'auto_145',
  name: 'Auto 45-65 (2:25, normal branch)',
  description:
    "Auto 45-65 as the 2 h 25 min run the owner's machine shows: the normal branch of a sensor-controlled programme (section 4.4). Cold pre-rinse; 2.5 L of the pre-rinse water exchanged; wash heated to 65 C and not reheated; one unheated intermediate rinse; final rinse heated to 69 C; closed-door drying. 11.5 L and about 1.04 kWh. Anchored: the total duration, the water and energy level (two laboratory-measured sisters), the first-bath and final-rinse volumes, the heating rate and the tank mechanism. Estimated: every step duration, both targets, the partial exchange, the pump speeds and the diverter pattern.",
  rowPrefix: 'A',
  firstBathL: 4.0,
  preRinseMin: 11.5,
  rinseRpm: 2800,
  washRpm: 3000,
  // No wash pattern and no drying time: the machine's default pattern (L 60 s, UR 60 s) and
  // its default drying step (40 min).
  rinsePattern: BOSCH_PATTERN_45,
  exchangeL: 2.5,
  washTarget: 65,
  holdMin: 46,
  flush: false,
  intermediateRinses: 1,
  rinseMin: 7.5,
  finalTarget: 69,
  finalHoldMin: 3,
  declared: {
    durationMin: 145,
    mainsWaterL: 11.5,
    energyKWh: 1.04,
    durationToleranceMin: 1,
    energyTolerance: 0.03,
    ...AUTO_PRINTED,
  },
  provenance: prov(
    'estimated',
    `${B} 4.4 (table A0 to A13 and its evidence table), 4.5`,
    "The 145 min total is the owner's statement; the 11.5 L and the energy level rest on two laboratory-measured sister machines (11.2 to 11.9 L, 1.06 to 1.11 kWh). The 46 min hold is set by the 145 min total.",
  ),
};

/**
 * What no document decides about Auto 45-65 on this platform, with the range each may lie in
 * (`docs/research/auto-recommendation.md` section 2 and `auto-programme-evidence.md` sections
 * 3 and 9, fact-checked 10 October 2026). The values of {@link BOSCH_AUTO_145_OPTIONS} are
 * kept where the evidence does not prefer another; one logged run of the owner's machine
 * (power at 10 s or faster and a temperature logger in the upper basket) settles all of them.
 */
export const BOSCH_AUTO_145_UNCERTAIN = {
  /**
   * Wash target of the normal branch, C: 65 as written, undetermined between 50 and 65. For
   * lower: the 2008 platform's 45 / 50 / 55 C variant and a power trace of an unidentified
   * machine (peak 48 to 58 C); for 65: the 2008 structure "65 C, two rinses" draws the 11.5 L
   * measured on the sisters, the thermal model is 2 to 7 % under the sisters' energy at 65 C
   * and 9 to 13 % under at 55 C, and a relayed service statement ends the ramp at 65 C.
   */
  washTarget: { value: 65, range: [50, 65], tag: 'ESTIMATED' },
  /** Plateau of a staged heat-up: off by default; 30 to 45 C for 5 to 20 min if there is one. */
  heatPlateau: { value: null, target: [30, 45], holdMin: [5, 20], tag: 'ESTIMATED' },
  /** The heater is off after the maximum (BSH patent of 2010, verified as the general practice). */
  reheatBand: { value: null, tag: 'VERIFIED' },
  /** Final rinse, C: 69 printed for this model's Intensive and Express; 65 for Auto on the 2008 platform. */
  finalTarget: { value: 69, range: [63, 72], tag: 'ESTIMATED' },
  /** Length of the unheated post-wash, minutes; set by the 145 min total. */
  holdMin: { value: 46, range: [20, 46], tag: 'ESTIMATED' },
  /**
   * Which branch runs. The decision points are documented (turbidity at the end of the
   * pre-rinse, during the wash and in the first rinse; a failed calibration gives the maximum
   * programme; a pre-cleaned load "a weaker programme"); no threshold, unit or time of
   * reading is public for any generation, so no rule is implemented: the normal branch runs
   * whatever the load, and the light and heavy branches are separate programmes.
   */
  branchRule: { value: null, tag: 'ESTIMATED' },
} as const;

/**
 * The named alternative course "staged to 55 C" (auto-recommendation.md section 2): heat to
 * 45 C, 10 min with the heater off, heat to 55 C, 42 min post-wash, a 10 min rinse, 1 min of
 * final hold and 35.5 min of drying, which keeps 2 h 25 min (144.7 min, 11.5 L and 0.96 kWh in
 * the thermal model). It is not among {@link BOSCH_PROGRAMMES}: a wash names it explicitly
 * (`boschProgramme(BOSCH_AUTO_145_STAGED_55_OPTIONS)`), because the primary course stays the
 * one as written until a run is logged.
 */
export const BOSCH_AUTO_145_STAGED_55_OPTIONS: BoschProgrammeOptions = {
  ...BOSCH_AUTO_145_OPTIONS,
  id: 'auto_145_staged_55',
  name: 'Auto 45-65 (2:25, staged to 55 C)',
  description:
    'Auto 45-65 with a staged heat-up to a 55 C wash: the alternative course of the fact-checked programme dossier (plateau at 45 C for 10 min, heater off after the 55 C target). Status unknown: the wash target of the normal branch is undetermined between 50 and 65 C.',
  washTarget: 55,
  heatPlateau: { target: 45, holdMin: 10 },
  holdMin: 42,
  rinseMin: 10,
  finalHoldMin: 1,
  dryMin: 35.5,
  declared: {
    durationMin: 145,
    mainsWaterL: 11.5,
    energyKWh: 0.96,
    durationToleranceMin: 1,
    energyTolerance: 0.03,
    ...AUTO_PRINTED,
  },
  provenance: prov(
    'estimated',
    'docs/research/auto-programme-evidence.md 3.2, 9; docs/research/auto-recommendation.md 2',
    'A named alternative, not the primary course: three weak hints for a pause near 45 C and an undetermined wash target. The post-wash of 42 min keeps the total at 145 min.',
  ),
};

/** The programmes of the Bosch SMV4HAX40G in authoring units; the first is the primary one. */
export const BOSCH_PROGRAMMES: readonly ProgrammeDef[] = [
  boschProgramme(BOSCH_AUTO_145_OPTIONS),
  boschProgramme({
    ...BOSCH_AUTO_145_OPTIONS,
    id: 'auto_145_keep',
    name: 'Auto 45-65 (2:25, pre-rinse water kept, two rinses)',
    description:
      'The alternative "N-keep" of section 4.6: the pre-rinse water is kept (no row A3) and a second intermediate rinse follows the first; the hold is shortened to keep 2 h 25 min. The only 11.5 L structure documented for the platform (2008: cleaning at 65, two intermediate rinses). 11.5 L, 1.09 kWh in the dossier\'s model.',
    exchangeL: 0,
    intermediateRinses: 2,
    holdMin: 37.5,
    declared: {
      durationMin: 145,
      mainsWaterL: 11.5,
      energyKWh: 1.09,
      durationToleranceMin: 1,
      energyTolerance: 0.03,
      ...AUTO_PRINTED,
    },
    provenance: prov(
      'estimated',
      `${B} 4.6 (N-keep)`,
      'Hold "about 38 min" in the dossier; 37.5 min keeps the total at 145 min.',
    ),
  }),
  boschProgramme({
    ...BOSCH_AUTO_145_OPTIONS,
    id: 'auto_100_light',
    name: 'Auto 45-65 (1:40, light branch)',
    description:
      'The light branch "L" of section 4.6, for a pre-rinsed or nearly clean load: no water exchange, wash at 45 C, a short hold, and a 0.5 L filter flush in place of the intermediate rinse. 7.0 L, the printed minimum; 0.76 kWh in the dossier\'s model against the printed 0.900.',
    exchangeL: 0,
    washTarget: 45,
    holdMin: 17,
    flush: true,
    intermediateRinses: 0,
    declared: {
      durationMin: 100,
      mainsWaterL: 7.0,
      energyKWh: 0.76,
      durationToleranceMin: 1,
      energyTolerance: 0.04,
      ...AUTO_PRINTED,
    },
    provenance: prov(
      'estimated',
      `${B} 4.6 (L, light)`,
      'Hold "about 17 min" set by the 1:40 total.',
    ),
  }),
  boschProgramme({
    ...BOSCH_AUTO_145_OPTIONS,
    id: 'auto_165_heavy',
    name: 'Auto 45-65 (2:45, heavy branch)',
    description:
      'The heavy branch "H" of section 4.6, for a heavily soiled load or a failed sensor calibration: the pre-rinse water is drained and replaced in full, wash at 65 C with a longer hold, and two intermediate rinses. 15.5 L, the printed maximum; 1.15 kWh in the dossier\'s model against the printed 1.500.',
    exchangeL: 4.0,
    holdMin: 54,
    intermediateRinses: 2,
    declared: {
      durationMin: 165,
      mainsWaterL: 15.5,
      energyKWh: 1.15,
      durationToleranceMin: 1,
      energyTolerance: 0.04,
      ...AUTO_PRINTED,
    },
    provenance: prov(
      'estimated',
      `${B} 4.6 (H, heavy)`,
      'Hold "about 54 min" set by the 2:45 total. The full drain leaves the carry-over, so the wash bath is 4.4 L here against 4.0 L in the dossier\'s balance.',
    ),
  }),
  boschProgramme({
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
    exchangeL: 0,
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
      `${B} 4.7 (Eco 50), 4.1, 4.2 (water arithmetic), 4.5`,
      "Step durations other than the outline's are those of AUTO 2:25; the soak is set by the printed 4:55. The dossier's model gives 0.88 kWh against the label's 0.836.",
    ),
  }),
  boschProgramme({
    id: 'intensive_70',
    name: 'Intensive 70',
    description:
      "Intensive 70, reconstructed in outline in section 4.7: 4.0 L, pre-rinse of about 10 min, heat to 70 C at increased spray pressure (about 3400 rpm assumed) and hold 30 to 40 min, two 2.5 L intermediate rinses (a third adds the printed 10 min and 2.5 L), final rinse 69 C, drying about 35 min. Printed 2:05 to 2:15, 1.300 to 1.400 kWh, 11.5 to 14.0 L; the dossier's model gives 1.16 to 1.27 kWh.",
    rowPrefix: 'I',
    firstBathL: 4.0,
    preRinseMin: 10,
    rinseRpm: 2800,
    washRpm: 3400,
    rinsePattern: BOSCH_PATTERN_45,
    exchangeL: 0,
    washTarget: 70,
    holdMin: 30,
    flush: false,
    intermediateRinses: 2,
    rinseMin: 7.5,
    finalTarget: 69,
    finalHoldMin: 3,
    dryMin: 35,
    declared: {
      durationMin: 130,
      mainsWaterL: 11.5,
      energyKWh: 1.16,
      durationToleranceMin: 5,
      energyTolerance: 0.06,
      printedDurationMin: [125, 135],
      printedEnergyKWh: [1.3, 1.4],
      printedMainsWaterL: [11.5, 14.0],
    },
    provenance: prov(
      'estimated',
      `${B} 4.7 (Intensive 70), 4.1, 4.2 (water arithmetic), 4.5`,
      "The two-rinse form (11.5 L). Declared duration: the middle of the printed range. Declared energy: the lower end of the dossier's 1.16 to 1.27 kWh, which belongs to the two-rinse form; that range is from the programme researcher's model, whose constants (2150 W heater, 70 W pump, 4 W/K loss) give about 0.04 kWh more than those of section 3.1 used here.",
    ),
  }),
  boschProgramme({
    id: 'express_65',
    name: 'Express 65 (1 h)',
    description:
      "Express 65, reconstructed in outline in section 4.7: no pre-rinse; about 5.5 L with lower and upper arm fed together (diverter state LU, if the production water switch has it); heat to 65 C in about 20 min; a short hold; one rinse; final rinse 69 C; about 5 min drying. Printed 1:00, 1.300 kWh, 10.5 L; the dossier's model gives 1.06 to 1.10 kWh. The 5.5 L first bath is an assumption made to reach the printed 10.5 L.",
    rowPrefix: 'X',
    firstBathL: 5.5,
    preRinseMin: 0,
    rinseRpm: 3000,
    washRpm: 3000,
    washPattern: BOSCH_PATTERN_BOTH,
    rinsePattern: BOSCH_PATTERN_BOTH,
    exchangeL: 0,
    washTarget: 65,
    holdMin: 12,
    flush: false,
    intermediateRinses: 1,
    rinseMin: 4.5,
    finalTarget: 69,
    finalHoldMin: 2,
    dryMin: 5,
    declared: {
      durationMin: 60,
      mainsWaterL: 10.5,
      energyKWh: 1.08,
      durationToleranceMin: 2,
      energyTolerance: 0.06,
      printedDurationMin: [60, 60],
      printedEnergyKWh: [1.3, 1.3],
      printedMainsWaterL: [10.5, 10.5],
    },
    provenance: prov(
      'estimated',
      `${B} 4.7 (Express 65), 4.1, 4.5`,
      "Pump speed 3000 rpm in state LU, a 4.5 min rinse, a 2 min final hold and the 12 min wash hold are chosen here to meet the printed hour. Declared energy: the middle of the dossier's 1.06 to 1.10 kWh.",
    ),
  }),
  boschProgramme({
    id: 'silence_50',
    name: 'Silence 50',
    description:
      "Silence 50, reconstructed in outline in section 4.7: as Eco 50 at reduced spray pressure (about 2400 rpm assumed) with a 63 C final rinse. Printed 4:00, 1.050 kWh, 11.0 L. The outline gives Eco's 9.5 L, not the printed 11.0 L: the dossier leaves the extra 1.5 L and 0.21 kWh unexplained, and this programme does too.",
    rowPrefix: 'S',
    firstBathL: 4.0,
    preRinseMin: 15,
    rinseRpm: 2400,
    washRpm: 2400,
    rinsePattern: BOSCH_PATTERN_45,
    exchangeL: 0,
    washTarget: 50,
    holdMin: 92.5,
    flush: true,
    intermediateRinses: 1,
    rinseMin: 7.5,
    finalTarget: 63,
    finalHoldMin: 3,
    dryMin: 90,
    declared: {
      durationMin: 240,
      mainsWaterL: 9.5,
      energyKWh: null,
      durationToleranceMin: 2,
      energyTolerance: 0.06,
      printedDurationMin: [240, 240],
      printedEnergyKWh: [1.05, 1.05],
      printedMainsWaterL: [11.0, 11.0],
    },
    provenance: prov(
      'estimated',
      `${B} 4.7 (Silence 50), 4.1`,
      'Declared water is what the outline adds up to (9.5 L), 1.5 L short of the printed 11.0 L. No model energy is given in the dossier. The soak is set by the printed 4:00.',
    ),
  }),
  boschProgramme({
    id: 'pre_rinse',
    name: 'Pre-rinse (Favourite, factory setting)',
    description:
      'The stand-alone cold pre-rinse of section 4.7: one 4.0 L cold fill, about 11 min of spraying, drain. Printed 0:15, 0.050 kWh, 4.0 L. The heat exchanger is refilled at the end, which is what makes the mains water 4.0 L.',
    rowPrefix: 'R',
    firstBathL: 4.0,
    preRinseMin: 11.5,
    rinseRpm: 2800,
    washRpm: 2800,
    rinsePattern: BOSCH_PATTERN_45,
    exchangeL: 0,
    washTarget: null,
    holdMin: 0,
    flush: false,
    intermediateRinses: 0,
    rinseMin: 0,
    finalTarget: 0,
    finalHoldMin: 0,
    dryMin: 0.5,
    declared: {
      durationMin: 15,
      mainsWaterL: 4.0,
      energyKWh: null,
      durationToleranceMin: 1,
      energyTolerance: 0.06,
      printedDurationMin: [15, 15],
      printedEnergyKWh: [0.05, 0.05],
      printedMainsWaterL: [4.0, 4.0],
    },
    provenance: prov(
      'estimated',
      `${B} 4.7 (Pre-rinse), 4.1`,
      'Spraying 11.5 min as row A2 of Auto.',
    ),
  }),
];
