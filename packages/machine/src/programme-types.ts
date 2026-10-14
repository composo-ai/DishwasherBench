/**
 * Wash programmes as tables of steps, and the timeline a programme expands to.
 *
 * A programme is a list of steps run in order (machine.md section 12.2 item 7): drain, fill,
 * circulate, heat to a target, hold, dose detergent, dose rinse aid, regenerate, dry. A step has
 * a fixed duration where the programme fixes one; a heat step lasts as long as the thermal
 * model says it takes to reach its target. `expandProgramme` (`programme.ts`) turns a machine
 * and a programme into a `ProgrammeTimeline`.
 *
 * Units: SI. Seconds from the start of the programme for times, cubic metres for volumes,
 * joules for energies, watts, kilograms, degrees Celsius; pump speeds in revolutions per minute
 * (`pumpRpm`). All types are plain read-only data and survive JSON unchanged.
 */

import type { Provenance } from './provenance.ts';
import type { DiverterPatternSpec, Range } from './types.ts';

// ---------------------------------------------------------------------------------------------
// Programme steps
// ---------------------------------------------------------------------------------------------

/** The part of a wash programme a step belongs to. */
export type ProgrammePhase =
  'start' | 'pre_rinse' | 'main_wash' | 'intermediate_rinse' | 'final_rinse' | 'drying';

/** Every {@link ProgrammePhase}, in the order they occur. */
export const PROGRAMME_PHASES: readonly ProgrammePhase[] = [
  'start',
  'pre_rinse',
  'main_wash',
  'intermediate_rinse',
  'final_rinse',
  'drying',
];

/** Where the water of a fill comes from. */
export interface FillSource {
  /** `mains`: the cold supply; `prestore`: the pre-store tank (the heat exchanger). */
  readonly from: 'mains' | 'prestore';
  /** Volume taken from that source, m^3. */
  readonly volume: number;
}

/**
 * Mains water admitted into the pre-store tank while a step runs. It does not interrupt the
 * step: the tank fills in the background and the water does not reach the tub.
 */
export interface PrestoreFill {
  /**
   * Time after the start of the step, seconds; with `relative` true, a fraction (0 to 1) of
   * the step's duration instead.
   */
  readonly at: number;
  /** Whether `at` is a fraction of the step's duration; default false. */
  readonly relative?: boolean;
  /** Volume admitted, m^3. */
  readonly volume: number;
}

/** Intermittent spraying: the pump runs for `on` seconds, rests for `off` seconds, and repeats. */
export interface PumpPulse {
  readonly on: number;
  readonly off: number;
}

/** Fields of every step. */
export interface StepBase {
  /** Id unique within the programme, a valid lower-case identifier (`a4_heat`). */
  readonly id: string;
  /**
   * Row of the dossier's programme table the step belongs to (`A4`). A row that combines
   * several actions is written as several steps with the same row.
   */
  readonly row: string;
  readonly phase: ProgrammePhase;
  /** What happens, in words. */
  readonly label: string;
}

/** Fields of every step during which the circulation pump runs. */
export interface PumpedStepBase extends StepBase {
  /** Circulation pump speed, revolutions per minute. */
  readonly pumpRpm: number;
  /**
   * How the diverter alternates between spray levels during the step; null for the machine's
   * `hydraulics.diverter.defaultPattern`.
   */
  readonly diverter: DiverterPatternSpec | null;
  /** Intermittent spraying, or null for continuous circulation. */
  readonly pulse: PumpPulse | null;
  readonly prestoreFills: readonly PrestoreFill[];
}

/** Pump water out of the tub. */
export interface DrainStep extends StepBase {
  readonly kind: 'drain';
  /**
   * Duration, seconds. The step lasts longer if the machine's drain pump
   * (`hydraulics.drain.flow`) needs longer to move the volume.
   */
  readonly duration: number;
  /**
   * Volume pumped out, m^3, for a partial drain; null for a full drain, which leaves only the
   * machine's carry-over.
   */
  readonly volume: number | null;
  /** Whether the drain alternates with short bursts of circulation to flush the filter. */
  readonly filterFlush: boolean;
}

/** Admit water into the tub. The pumps do not run. */
export interface FillStep extends StepBase {
  readonly kind: 'fill';
  /**
   * Shortest duration, seconds, or null. The step lasts as long as its sources need at the
   * machine's inlet flow and pre-store discharge flow (`hydraulics.fill`), and at least this
   * long: a row of a programme table that allows more time than the valve needs keeps its
   * length, and a slower valve lengthens the step.
   */
  readonly duration: number | null;
  readonly sources: readonly FillSource[];
  readonly prestoreFills: readonly PrestoreFill[];
}

/** Circulate without heating for a fixed time. */
export interface CirculateStep extends PumpedStepBase {
  readonly kind: 'circulate';
  /** Fixed duration, seconds. */
  readonly duration: number;
}

/**
 * Circulate with the heater on until the liquor reaches `target`.
 *
 * With `duration` null the step ends when the target is reached, so its length comes from the
 * thermal model. With a `duration` the step lasts exactly that long: the heater is on until the
 * target is reached and off after that. A target above the machine's `thermal.heaterCutOut` is
 * not reached: the heater goes off at the cut-out, the step ends there, and the timeline
 * reports `target_above_cut_out`.
 */
export interface HeatStep extends PumpedStepBase {
  readonly kind: 'heat';
  /** Liquor temperature at which the heater goes off, degrees C. */
  readonly target: number;
  readonly duration: number | null;
  /** Time after which a step without a fixed duration gives up, seconds. */
  readonly timeout: number;
}

/**
 * Circulate for a fixed time after a heat-up. The heater is off unless `reheatBand` is given,
 * in which case it comes back on whenever the liquor has fallen that far below `target` and
 * goes off again at the target.
 */
export interface HoldStep extends PumpedStepBase {
  readonly kind: 'hold';
  /** Fixed duration, seconds. */
  readonly duration: number;
  /** Temperature the hold refers to, degrees C; null for an unheated hold with no target. */
  readonly target: number | null;
  /** Width of the thermostat band, kelvin; null for a hold with the heater off. */
  readonly reheatBand: number | null;
}

/**
 * Arm the detergent release. The step takes no time and is written before the circulation it
 * belongs to: the dispenser lid opens once the pump has then run for the machine's
 * `dosing.detergentReleaseDelay`, whatever steps that circulation is made of. The mass released
 * is the machine's `dosing.detergentMass`. If the bath is drained or the programme ends before
 * the delay has passed, nothing is released and the timeline reports `dose_not_released`.
 */
export interface DoseDetergentStep extends StepBase {
  readonly kind: 'dose_detergent';
}

/**
 * Arm the rinse-aid dose. The step takes no time and is written before the circulation it
 * belongs to: the rinse aid is dosed once the pump has then run for the machine's
 * `dosing.rinseAidDelay` (no wait when that is null) and the liquor is at or above the machine's
 * `dosing.rinseAidMinTemperature` (no condition when that is null). If the bath is drained or
 * the programme ends first, nothing is dosed and the timeline reports `dose_not_released`.
 */
export interface DoseRinseAidStep extends StepBase {
  readonly kind: 'dose_rinse_aid';
  /** Volume dosed, m^3; null for the machine's `dosing.rinseAidVolume`. */
  readonly volume: number | null;
}

/**
 * Regenerate the water softener. The brine and rinse water go to the drain, not into the
 * liquor. Circulation continues at `pumpRpm` when one is given.
 */
export interface RegenerateStep extends StepBase {
  readonly kind: 'regenerate';
  /** Fixed duration, seconds. */
  readonly duration: number;
  /** Mains water used, m^3. */
  readonly water: number;
  /** Energy used beyond the circulation pump, joules. */
  readonly energy: number;
  /** Circulation pump speed while regenerating, revolutions per minute; null with the pump off. */
  readonly pumpRpm: number | null;
  /** Diverter pattern while regenerating; null for the machine's default pattern. */
  readonly diverter: DiverterPatternSpec | null;
}

/** Dry the load: pumps and heater off. */
export interface DryStep extends StepBase {
  readonly kind: 'dry';
  /** Fixed duration, seconds; null for the machine's `drying.defaultDuration`. */
  readonly duration: number | null;
  readonly prestoreFills: readonly PrestoreFill[];
}

/** One step of a programme. */
export type ProgrammeStep =
  | DrainStep
  | FillStep
  | CirculateStep
  | HeatStep
  | HoldStep
  | DoseDetergentStep
  | DoseRinseAidStep
  | RegenerateStep
  | DryStep;

/** The `kind` of a {@link ProgrammeStep}. */
export type ProgrammeStepKind = ProgrammeStep['kind'];

// ---------------------------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------------------------

/** The conditions a programme's stated figures hold for. SI. */
export interface ProgrammeConditions {
  /** Heat capacity of the load, J/K. */
  readonly loadHeatCapacity: number;
  /** Water in the pre-store tank at the start, left there by the previous run, m^3. */
  readonly prestoreInitialVolume: number;
  /** Energy of the drain pump and the electronics over the whole run, joules. */
  readonly otherEnergy: number;
}

/** What the dossier or the manufacturer says a programme adds up to. SI. */
export interface ProgrammeDeclared {
  /** Total running time, seconds. */
  readonly duration: number;
  /** Mains water drawn, m^3. */
  readonly mainsWater: number;
  /** Electrical energy by the dossier's balance, joules; null if it gives none. */
  readonly energy: number | null;
  /** Largest accepted difference between the expanded duration and `duration`, seconds. */
  readonly durationTolerance: number;
  /** Largest accepted difference in mains water, m^3. */
  readonly waterTolerance: number;
  /** Largest accepted relative difference in energy. */
  readonly energyTolerance: number;
  /** The manufacturer's printed figures as ranges (a single figure is a zero-width range). */
  readonly printed: {
    readonly duration: Range | null;
    readonly energy: Range | null;
    readonly mainsWater: Range | null;
  } | null;
}

/** One wash programme of a machine. */
export interface ProgrammeSpec {
  /** Catalogue id, a valid lower-case identifier (`eco_50`). */
  readonly id: string;
  /** Name for display. */
  readonly name: string;
  /** What the programme is and its evidence. */
  readonly description: string;
  readonly steps: readonly ProgrammeStep[];
  readonly conditions: ProgrammeConditions;
  readonly declared: ProgrammeDeclared;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// The expanded timeline
// ---------------------------------------------------------------------------------------------

/** A stretch of time during which the diverter feeds one set of spray levels. */
export interface DiverterInterval {
  /** Seconds from the start of the programme. */
  readonly start: number;
  readonly end: number;
  /** Id of the diverter position. */
  readonly position: string;
  /** Ids of the spray levels fed in that position. */
  readonly feeds: readonly string[];
  /**
   * Seconds at the start of the interval during which the diverter is still moving from the
   * previous position (0 when it was already there). During them the branches of the new
   * position open linearly from closed to fully open, and flow and pump power are below the
   * figures given here.
   */
  readonly transition: number;
  /** Circulation pump electrical power in this state with the branches fully open, watts. */
  readonly pumpPower: number;
  /** Total circulated flow in this state with the branches fully open, m^3/s. */
  readonly flow: number;
}

/** A stretch of time during which the heater is on. */
export interface HeaterInterval {
  /** Seconds from the start of the programme. */
  readonly start: number;
  readonly end: number;
  /** Mean heater power over the interval, watts. */
  readonly power: number;
}

/** Something that happens at a moment of the programme. Times in seconds from its start. */
export type TimelineEvent =
  | {
      readonly kind: 'fill';
      readonly time: number;
      /** Time the fill takes, seconds. */
      readonly duration: number;
      readonly stepId: string;
      /** Volume that enters the tub, m^3. */
      readonly volume: number;
      /** Part of it drawn from the mains, m^3. */
      readonly fromMains: number;
      /** Part of it drawn from the pre-store tank, m^3. */
      readonly fromPrestore: number;
      /** Temperature of the water that enters, degrees C. */
      readonly temperature: number;
    }
  | {
      /** Mains water admitted into the pre-store tank. */
      readonly kind: 'prestore_fill';
      readonly time: number;
      readonly stepId: string;
      readonly volume: number;
    }
  | {
      readonly kind: 'drain';
      readonly time: number;
      /** Time the drain step takes, seconds. */
      readonly duration: number;
      readonly stepId: string;
      /** Volume pumped out, m^3. */
      readonly volume: number;
      /** Volume left in the machine, m^3. */
      readonly remaining: number;
      /** Temperature of the liquor pumped out, degrees C. */
      readonly temperature: number;
    }
  | {
      /** The dispenser lid is released. */
      readonly kind: 'detergent_release';
      readonly time: number;
      readonly stepId: string;
      /** Mass of detergent, kg. */
      readonly mass: number;
      /** Liquor temperature at that moment, degrees C. */
      readonly temperature: number;
    }
  | {
      readonly kind: 'rinse_aid_release';
      readonly time: number;
      readonly stepId: string;
      /** Volume of rinse aid, m^3. */
      readonly volume: number;
      /** Liquor temperature at that moment, degrees C. */
      readonly temperature: number;
    }
  | {
      /**
       * Mains water admitted because the pump ran unevenly: the level check of a phase listed in
       * the machine's `hydraulics.inventory.levelCheckIn` found the sump below its minimum.
       */
      readonly kind: 'top_up';
      readonly time: number;
      readonly stepId: string;
      /** Volume admitted, m^3. */
      readonly volume: number;
      /** Free water in the tub after it, m^3. */
      readonly liquorVolume: number;
    }
  | {
      readonly kind: 'regeneration';
      readonly time: number;
      readonly duration: number;
      readonly stepId: string;
      /** Mains water used, m^3. */
      readonly water: number;
      /** Energy used, joules. */
      readonly energy: number;
    }
  | {
      /** The door opens automatically during drying. */
      readonly kind: 'door_open';
      readonly time: number;
      readonly stepId: string;
      /** Gap at the inside top edge of the door, metres. */
      readonly gap: number;
    };

/** The `kind` of a {@link TimelineEvent}. */
export type TimelineEventKind = TimelineEvent['kind'];

/**
 * Modelled temperatures over one segment, sampled at its start, at every sample interval and
 * at its end. Degrees C; `time` in seconds from the start of the programme.
 */
export interface TemperatureProfile {
  readonly time: readonly number[];
  /** The liquor (free water in the tub). */
  readonly liquor: readonly number[];
  /** The load. */
  readonly load: readonly number[];
  /** The machine: tub, racks, sump. */
  readonly machine: readonly number[];
  /** The water in the pre-store tank (its last value while the tank is empty). */
  readonly prestore: readonly number[];
}

/** One step of a programme that takes time, laid out in time. */
export interface TimelineSegment {
  /** Position in `ProgrammeTimeline.segments`. */
  readonly index: number;
  readonly stepId: string;
  readonly row: string;
  readonly kind: ProgrammeStepKind;
  readonly phase: ProgrammePhase;
  readonly label: string;
  /** Seconds from the start of the programme. */
  readonly start: number;
  readonly end: number;
  /** Free water in the tub at the start and at the end of the segment, m^3. */
  readonly liquorVolume: { readonly start: number; readonly end: number };
  /** Water in the pre-store tank at the start and at the end, m^3. */
  readonly prestoreVolume: { readonly start: number; readonly end: number };
  /** Target liquor temperature of the step, degrees C; null if it has none. */
  readonly target: number | null;
  readonly temperature: TemperatureProfile;
  /** Circulation pump speed, revolutions per minute; 0 with the pump off. */
  readonly pumpRpm: number;
  /** Which spray levels are fed when; empty with the pump off. */
  readonly diverter: readonly DiverterInterval[];
  /** When the heater is on; empty if it stays off. */
  readonly heater: readonly HeaterInterval[];
  /** Time the heater is on, seconds. */
  readonly heaterOnTime: number;
  /** Heater energy, joules. */
  readonly heaterEnergy: number;
  /** Time the circulation pump runs, seconds. */
  readonly pumpOnTime: number;
  /** Circulation pump energy, joules. */
  readonly pumpEnergy: number;
  /** Mains water drawn during the segment, into the tub or into the pre-store tank, m^3. */
  readonly mainsWater: number;
  /** Events at or after `start` and before `end`. */
  readonly events: readonly TimelineEvent[];
  /**
   * Water held out of the sump by the load during the segment, as given to `expandProgramme`
   * (`ExpandOptions.heldWater`), m^3: trapped in upward-facing items, above a blinded filter and
   * absorbed. 0 when none was given.
   */
  readonly heldWater: number;
}

/** The steps of one row of the dossier's programme table, added up. */
export interface TimelineRow {
  readonly row: string;
  readonly phase: ProgrammePhase;
  /** Seconds from the start of the programme. */
  readonly start: number;
  readonly end: number;
  /** Mains water drawn in the row, m^3. */
  readonly mainsWater: number;
  /** Highest target of its steps, degrees C; null if none has one. */
  readonly target: number | null;
  /** Pump speed of its pumped steps, revolutions per minute; 0 if the pump never runs. */
  readonly pumpRpm: number;
  /** Time the heater is on, seconds. */
  readonly heaterOnTime: number;
  /** Liquor temperature at the end of the row, degrees C. */
  readonly liquorTemperatureAtEnd: number;
  /** Load temperature at the end of the row, degrees C. */
  readonly loadTemperatureAtEnd: number;
}

/** What a programme adds up to. SI. */
export interface TimelineTotals {
  /** Total running time, seconds. */
  readonly duration: number;
  /** Mains water drawn, m^3. */
  readonly mainsWater: number;
  /** Heater energy, joules. */
  readonly heaterEnergy: number;
  /** Circulation pump energy, joules. */
  readonly pumpEnergy: number;
  /** Drain pump, electronics and regeneration energy, joules. */
  readonly otherEnergy: number;
  /** Total electrical energy, joules. */
  readonly energy: number;
  /** Time the heater is on, seconds. */
  readonly heaterOnTime: number;
  /** Time the circulation pump runs, seconds. */
  readonly pumpOnTime: number;
  /** Water left in the pre-store tank at the end, m^3. */
  readonly prestoreVolumeAtEnd: number;
}

/** Something that does not add up in an expanded programme. */
export interface TimelineProblem {
  /** Stable machine-readable code, for example `heat_timeout`. */
  readonly code: string;
  /** Id of the step concerned. */
  readonly stepId: string;
  readonly message: string;
}

/** The conditions an expansion was run with. SI. */
export interface TimelineConditions {
  /** Heat capacity of the load, J/K. */
  readonly loadHeatCapacity: number;
  /** Temperature of the cold supply, degrees C. */
  readonly inletTemperature: number;
  /** Temperature of the room, and of everything at the start, degrees C. */
  readonly ambientTemperature: number;
  /** Heater power while it is on (after voltage and duty), watts. */
  readonly heaterPower: number;
  /** Integration step, seconds. */
  readonly timeStep: number;
  /** Interval of the temperature samples, seconds. */
  readonly sampleInterval: number;
  /** Height position of each adjustable basket (it sets the static lift of a carried arm). */
  readonly basketHeights: Readonly<Record<string, string>>;
}

/** A programme laid out in time: what `expandProgramme` returns. */
export interface ProgrammeTimeline {
  readonly machineId: string;
  readonly programmeId: string;
  readonly conditions: TimelineConditions;
  /** One segment per step that takes time, in order, without gaps. */
  readonly segments: readonly TimelineSegment[];
  /** Every event, in order of time. */
  readonly events: readonly TimelineEvent[];
  /**
   * The rows of the programme table, in order: one per row of the programme, also for a row
   * whose steps take no time (a heat step whose target is already met).
   */
  readonly rows: readonly TimelineRow[];
  readonly totals: TimelineTotals;
  /** Empty when everything adds up. */
  readonly problems: readonly TimelineProblem[];
}
