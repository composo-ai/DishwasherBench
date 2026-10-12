/**
 * Programme expansion: a machine and a programme to a timeline (docs/research/machine.md
 * section 12.2 items 6 and 7).
 *
 * `expandProgramme` runs the steps of a programme in order against the lumped models of this
 * package and lays them out in time:
 * - a drain leaves the machine's carry-over; a fill mixes mains water (at the inlet
 *   temperature) and pre-stored water (at the tank's temperature) into what is in the tub.
 *   Water moves are applied at the start of their step. A fill lasts as long as its sources
 *   need at the machine's inlet flow and tank discharge flow, a drain as long as the drain pump
 *   needs, and each at least the duration its step gives;
 * - while the pump runs, the diverter follows the step's pattern (the machine's default pattern
 *   when the step gives none) and the hydraulic operating point of each diverter state gives
 *   the pump's electrical power, which ends up as heat in the liquor. For the machine's
 *   diverter transition time after each change of position the branches of the new position
 *   open linearly, and flow and power are those of the partly open branches;
 * - the water inventory is taken with the water the load holds back (`ExpandOptions.heldWater`:
 *   trapped in upward-facing vessels, above a blinded filter, absorbed). If what is left cannot
 *   keep the sump at its minimum volume in a diverter state, then in a phase in which the
 *   machine checks the level (`hydraulics.inventory.levelCheckIn`) it lets in a top-up of mains
 *   water, at most `maxTopUpsPerPhase` times per phase (a `top_up` event); otherwise, or if
 *   that is not enough, the operating point is the starved one (the pump draws air and its head
 *   falls, `primedOperatingPoint`), the step is reported as `pump_starved`, and the heater
 *   stays off: it is enabled only while the pump runs with a primed sump;
 * - the thermal model (`thermal.ts`) is integrated in steps of `timeStep` seconds; a heat step
 *   ends at the first step boundary at which the liquor has reached its target, so heat-up
 *   durations come from the model. The heater never heats beyond the machine's cut-out;
 * - detergent and rinse aid are released as the machine's `dosing` says: a dose step arms the
 *   release, which happens once the pump has then run for the delay (and, for rinse aid, the
 *   liquor has reached the minimum temperature);
 * - doses, fills, top-ups, drains and regenerations are reported as events.
 *
 * What is simplified: a top-up and the water of a background tank fill arrive at once; a
 * drain's run-down pauses (`hydraulics.drain.pattern`) are not laid out; during a diverter
 * transition only the branches of the new position pass water.
 *
 * The function is pure: the same machine, programme and options give the same timeline, and
 * nothing depends on wall-clock time or on iteration over unordered collections.
 *
 * Units: seconds from the start of the programme, m^3, J, W, degrees C; pump speeds in rev/min.
 */

import { getDiverterPosition } from './config.ts';
import type { OperatingPoint } from './hydraulics.ts';
import { hydraulicOperatingPoint } from './hydraulics.ts';
import type { HeldWater, PrimedOperatingPoint } from './inventory.ts';
import { primedOperatingPoint, waterInventory } from './inventory.ts';
import type {
  DiverterInterval,
  HeaterInterval,
  PrestoreFill,
  ProgrammePhase,
  ProgrammeSpec,
  ProgrammeStep,
  ProgrammeStepKind,
  ProgrammeTimeline,
  PumpPulse,
  TemperatureProfile,
  TimelineEvent,
  TimelineProblem,
  TimelineRow,
  TimelineSegment,
} from './programme-types.ts';
import type { ThermalModel, ThermalState } from './thermal.ts';
import { mixTemperature, NEGLIGIBLE_WATER_VOLUME, stepThermal, thermalModelOf } from './thermal.ts';
import type { DiverterPatternSpec, MachineConfig, MachineSpec } from './types.ts';

/** Default integration step of the thermal model, seconds (machine.md section 12.2 item 6). */
export const DEFAULT_TIME_STEP = 1;

/** Default interval of the temperature samples in a timeline, seconds. */
export const DEFAULT_SAMPLE_INTERVAL = 10;

/** Tolerance on volumes when judging overflow and underflow, m^3 (0.1 mL). */
const VOLUME_TOLERANCE = 1e-7;

/** The step a held-water function is asked about. */
export interface HeldWaterQuery {
  readonly stepId: string;
  readonly row: string;
  readonly phase: ProgrammePhase;
  readonly kind: ProgrammeStepKind;
}

/** The conditions a programme is expanded for. Everything defaults to the programme's and the machine's. */
export interface ExpandOptions {
  /**
   * Water the load keeps out of the sump while the pump runs, m^3 (`HeldWater`: trapped in
   * upward-facing vessels, standing above a blinded filter, absorbed; and, where the jet and
   * film models supply them, the water in flight and on the surfaces). One value for the whole
   * programme, or a function of the step. Default: nothing held, flight and film from the
   * machine's inventory times. This is how the way a machine is loaded reaches the pump: enough
   * trapped water starves it (`pump_starved`) or draws a top-up.
   */
  readonly heldWater?: HeldWater | ((step: HeldWaterQuery) => HeldWater);
  /** Machine configuration; it sets the static lift of an arm carried by an adjustable basket. */
  readonly config?: MachineConfig;
  /** Heat capacity of the load, J/K; default: the programme's conditions. */
  readonly loadHeatCapacity?: number;
  /** Temperature of the cold supply, degrees C; default: the machine's. */
  readonly inletTemperature?: number;
  /** Temperature of the room, and of everything at the start, degrees C; default: the machine's. */
  readonly ambientTemperature?: number;
  /** Mains voltage, V; the heater power scales with its square. Default: the nominal voltage. */
  readonly mainsVoltage?: number;
  /** Integration step, seconds; default {@link DEFAULT_TIME_STEP}. */
  readonly timeStep?: number;
  /** Interval of the temperature samples, seconds; default {@link DEFAULT_SAMPLE_INTERVAL}. */
  readonly sampleInterval?: number;
  /** Free water in the tub at the start, m^3; default 0. */
  readonly initialLiquorVolume?: number;
  /** Water in the pre-store tank at the start, m^3; default: the programme's conditions. */
  readonly prestoreInitialVolume?: number;
}

/** What the pump and heater do during a stretch of a step. */
interface PumpedRun {
  readonly pumpRpm: number;
  readonly diverter: DiverterPatternSpec;
  readonly pulse: PumpPulse | null;
  /** `off`: no heating. `target`: on below the target. `thermostat`: on below target - band, off at the target. */
  readonly heater:
    | { readonly mode: 'off' }
    | { readonly mode: 'target'; readonly target: number }
    | { readonly mode: 'thermostat'; readonly target: number; readonly band: number };
  /** Stop as soon as the liquor has reached this temperature (a heat step without a fixed duration). */
  readonly stopAt: number | null;
}

/** Mutable state of an expansion. */
interface Run {
  time: number;
  liquorVolume: number;
  prestoreVolume: number;
  thermal: ThermalState;
  mainsWater: number;
  heaterEnergy: number;
  pumpEnergy: number;
  otherEnergy: number;
  heaterOnTime: number;
  pumpOnTime: number;
  /** Key of the diverter pattern the pump is running, and the pump-on time spent in it. */
  patternKey: string | null;
  patternElapsed: number;
  lastPosition: string | null;
  /** Pump-on time since the diverter last changed position, seconds. */
  sinceSwitch: number;
  /** Phase the top-ups are being counted in, and how many it has had. */
  topUpPhase: ProgrammePhase | null;
  topUps: number;
}

/** A dose that a dose step has armed and that has not been released yet. */
interface PendingDose {
  readonly kind: 'detergent' | 'rinse_aid';
  readonly stepId: string;
  /** Pump-on time still to pass, seconds. */
  remaining: number;
  /** Liquor temperature it waits for, degrees C; null for none. */
  readonly minTemperature: number | null;
  /** Mass (kg) of detergent or volume (m^3) of rinse aid. */
  readonly amount: number;
}

/** Mean over [from, from + length] of the opening min(1, t / transition) of a moving diverter. */
function meanOpening(from: number, length: number, transition: number): number {
  const to = from + length;
  if (!(transition > 0) || from >= transition || !(length > 0)) return 1;
  if (to <= transition) return (from + to) / (2 * transition);
  return ((transition * transition - from * from) / (2 * transition) + (to - transition)) / length;
}

/** The water a `HeldWater` record keeps with the load and the filter, m^3. */
function heldTotal(held: HeldWater): number {
  return (held.trapped ?? 0) + (held.filterHeld ?? 0) + (held.absorbed ?? 0);
}

/** Position of a pattern at `elapsed` seconds of pump-on time. */
function patternPositionAt(pattern: DiverterPatternSpec, elapsed: number): string {
  const first = pattern.phases[0];
  if (first === undefined) throw new RangeError('expandProgramme: a diverter pattern has no phase');
  if (pattern.phases.length === 1) return first.position;
  let period = 0;
  for (const phase of pattern.phases) period += phase.duration;
  if (!(period > 0)) return first.position;
  let t = elapsed % period;
  for (const phase of pattern.phases) {
    if (t < phase.duration) return phase.position;
    t -= phase.duration;
  }
  return first.position;
}

/** Whether a pulsed pump is on at `elapsed` seconds into its step. */
function pulseOn(pulse: PumpPulse | null, elapsed: number): boolean {
  if (pulse === null) return true;
  const period = pulse.on + pulse.off;
  if (!(period > 0)) return true;
  return elapsed % period < pulse.on;
}

/**
 * Lays a programme of a machine out in time. See the file comment for what is modelled and
 * `ProgrammeTimeline` for what is returned. Anything that does not add up (a heat step that
 * times out or aims above the heater's cut-out, more water drawn from the pre-store tank than
 * it holds, a pump run with too little water, a dose whose bath is drained before it is
 * released) is reported in `problems`, never thrown.
 *
 * Throws a RangeError only for a programme that refers to a diverter position the machine does
 * not have; `validateMachineSpec` reports that as a problem before expanding.
 */
export function expandProgramme(
  spec: MachineSpec,
  programme: ProgrammeSpec,
  options: ExpandOptions = {},
): ProgrammeTimeline {
  const config = options.config ?? spec.defaultConfig;
  const dt = options.timeStep ?? DEFAULT_TIME_STEP;
  const sampleInterval = options.sampleInterval ?? DEFAULT_SAMPLE_INTERVAL;
  if (!(dt > 0) || !(sampleInterval > 0)) {
    throw new RangeError('expandProgramme: timeStep and sampleInterval must be positive');
  }
  const loadHeatCapacity = options.loadHeatCapacity ?? programme.conditions.loadHeatCapacity;
  const inletTemperature = options.inletTemperature ?? spec.thermal.inletTemperature;
  const ambientTemperature = options.ambientTemperature ?? spec.thermal.ambientTemperature;
  const voltage = options.mainsVoltage ?? spec.identity.nominalVoltage;
  const voltageRatio = voltage / spec.identity.nominalVoltage;
  const heaterPower =
    spec.thermal.heaterPower * spec.thermal.heaterDuty * voltageRatio * voltageRatio;
  const model: ThermalModel = thermalModelOf(spec, loadHeatCapacity, ambientTemperature);
  const inventorySpec = spec.hydraulics.inventory;
  const carryOver = inventorySpec.carryOver;
  const prestoreCapacity = spec.hydraulics.fill.prestoreVolume;
  const cutOut = spec.thermal.heaterCutOut;
  const transitionTime = Math.max(spec.hydraulics.diverter.transitionTime, 0);
  const heldOption = options.heldWater;
  const heldFor = (step: ProgrammeStep): HeldWater =>
    heldOption === undefined
      ? {}
      : typeof heldOption === 'function'
        ? heldOption({ stepId: step.id, row: step.row, phase: step.phase, kind: step.kind })
        : heldOption;

  const run: Run = {
    time: 0,
    liquorVolume: options.initialLiquorVolume ?? 0,
    prestoreVolume: options.prestoreInitialVolume ?? programme.conditions.prestoreInitialVolume,
    thermal: {
      liquor: ambientTemperature,
      load: ambientTemperature,
      machine: ambientTemperature,
      prestore: ambientTemperature,
    },
    mainsWater: 0,
    heaterEnergy: 0,
    pumpEnergy: 0,
    otherEnergy: programme.conditions.otherEnergy,
    heaterOnTime: 0,
    pumpOnTime: 0,
    patternKey: null,
    patternElapsed: 0,
    lastPosition: null,
    sinceSwitch: Number.POSITIVE_INFINITY,
    topUpPhase: null,
    topUps: 0,
  };
  const pendingDoses: PendingDose[] = [];
  const stepSpans = new Map<string, { start: number; end: number }>();

  const segments: TimelineSegment[] = [];
  const events: TimelineEvent[] = [];
  /** Number of events already handed to a segment. */
  let assignedEvents = 0;
  const problems: TimelineProblem[] = [];
  const rowEnds = new Map<string, { liquor: number; load: number }>();
  const reported = new Set<string>();
  const report = (code: string, stepId: string, message: string): void => {
    const key = `${code}|${stepId}`;
    if (reported.has(key)) return;
    reported.add(key);
    problems.push({ code, stepId, message });
  };

  const points = new Map<string, OperatingPoint>();
  /** The fully primed operating point of a position whose branches are `opening` open. */
  const pointFor = (position: string, pumpRpm: number, opening = 1): OperatingPoint => {
    const key = `${position}|${pumpRpm}|${opening}`;
    let point = points.get(key);
    if (point === undefined) {
      point = hydraulicOperatingPoint(spec, position, pumpRpm, {
        basketHeights: config.basketHeights,
        ...(opening < 1 ? { branchOpening: openingOf(position, opening) } : {}),
      });
      points.set(key, point);
    }
    return point;
  };
  const openingOf = (position: string, opening: number): Record<string, number> => {
    const record: Record<string, number> = {};
    for (const feed of getDiverterPosition(spec, position).feeds) record[feed] = opening;
    return record;
  };

  /**
   * The operating point of a diverter position with the water now in the machine, and the
   * inventory that goes with it: the fully primed point if that leaves the sump its minimum
   * volume, otherwise the starved point with the loss of prime fed back.
   */
  const starvedPoints = new Map<string, PrimedOperatingPoint>();
  const operatingFor = (
    position: string,
    pumpRpm: number,
    feeds: readonly string[],
    held: HeldWater,
    heldKey: string,
    opening: number,
  ): PrimedOperatingPoint => {
    const point = pointFor(position, pumpRpm, opening);
    const inventory = waterInventory(spec, run.liquorVolume, point.flow, feeds, held);
    if (inventory.primed) return { point, inventory };
    const key = `${position}|${pumpRpm}|${opening}|${run.liquorVolume}|${heldKey}`;
    let starved = starvedPoints.get(key);
    if (starved === undefined) {
      starved = primedOperatingPoint(spec, position, pumpRpm, run.liquorVolume, held, {
        basketHeights: config.basketHeights,
        ...(opening < 1 ? { branchOpening: openingOf(position, opening) } : {}),
      });
      starvedPoints.set(key, starved);
    }
    return starved;
  };

  /** Reports the doses that were armed and never released, and forgets them. */
  const dropPendingDoses = (why: string): void => {
    for (const dose of pendingDoses) {
      report(
        'dose_not_released',
        dose.stepId,
        `the ${dose.kind === 'detergent' ? 'detergent' : 'rinse aid'} was not released: ${why}${
          dose.remaining > 0
            ? ` with ${dose.remaining.toFixed(0)} s of its delay still to run`
            : dose.minTemperature === null
              ? ''
              : ` before the liquor reached ${dose.minTemperature} C`
        }`,
      );
    }
    pendingDoses.length = 0;
  };

  /** Admits mains water into the pre-store tank. */
  const fillPrestore = (stepId: string, volume: number): void => {
    if (prestoreCapacity === null) {
      report('no_prestore_tank', stepId, 'the machine has no pre-store tank to fill');
      return;
    }
    run.thermal = {
      ...run.thermal,
      prestore: mixTemperature([
        { volume: run.prestoreVolume, temperature: run.thermal.prestore },
        { volume, temperature: inletTemperature },
      ]),
    };
    run.prestoreVolume += volume;
    run.mainsWater += volume;
    events.push({ kind: 'prestore_fill', time: run.time, stepId, volume });
    if (run.prestoreVolume > prestoreCapacity + VOLUME_TOLERANCE) {
      report(
        'prestore_overflow',
        stepId,
        `the pre-store tank would hold ${(run.prestoreVolume * 1000).toFixed(2)} L, more than its ${(prestoreCapacity * 1000).toFixed(2)} L`,
      );
    }
  };

  /**
   * Advances time through one step: integrates the thermal model, runs the pump and heater as
   * `pumped` says (null: both off), applies the background fills, and records the segment.
   * `duration` null means "until `pumped.stopAt` is reached or `timeout` has passed".
   */
  const advance = (
    step: ProgrammeStep,
    duration: number | null,
    pumped: PumpedRun | null,
    prestoreFills: readonly PrestoreFill[],
    timeout: number,
    before: { liquorVolume: number; prestoreVolume: number; mainsWater: number },
    target: number | null,
  ): void => {
    const start = run.time;
    const heaterStart = { energy: run.heaterEnergy, onTime: run.heaterOnTime };
    const pumpStart = { energy: run.pumpEnergy, onTime: run.pumpOnTime };
    const profile = {
      time: [] as number[],
      liquor: [] as number[],
      load: [] as number[],
      machine: [] as number[],
      prestore: [] as number[],
    };
    const sample = (): void => {
      if (profile.time[profile.time.length - 1] === run.time) return;
      profile.time.push(run.time);
      profile.liquor.push(run.thermal.liquor);
      profile.load.push(run.thermal.load);
      profile.machine.push(run.thermal.machine);
      profile.prestore.push(run.thermal.prestore);
    };
    const diverter: DiverterInterval[] = [];
    const heater: HeaterInterval[] = [];
    // A fill given as a fraction of the step falls at its start when the step has no fixed length.
    const pendingFills = prestoreFills
      .map((fill) => ({
        at: fill.relative === true ? fill.at * (duration ?? 0) : fill.at,
        volume: fill.volume,
      }))
      .sort((a, b) => a.at - b.at);
    const held = heldFor(step);
    const heldKey = heldOption === undefined ? '' : JSON.stringify(held);

    if (pumped !== null) {
      const key = JSON.stringify(pumped.diverter.phases.map((p) => [p.position, p.duration]));
      if (run.patternKey !== key) {
        run.patternKey = key;
        run.patternElapsed = 0;
      }
    } else {
      run.patternKey = null;
      run.patternElapsed = 0;
      run.lastPosition = null;
      run.sinceSwitch = Number.POSITIVE_INFINITY;
    }

    sample();
    let elapsed = 0;
    let nextSample = sampleInterval;
    let heating = false;
    let timedOut = false;
    const limit = duration ?? timeout;
    // A tolerance of a millionth of a step keeps accumulated rounding from adding a sliver step.
    while (elapsed < limit - dt * 1e-6) {
      if (duration === null && pumped?.stopAt != null && run.thermal.liquor >= pumped.stopAt) break;
      while (pendingFills[0] !== undefined && pendingFills[0].at <= elapsed + dt * 1e-6) {
        const fill = pendingFills.shift();
        if (fill !== undefined) fillPrestore(step.id, fill.volume);
      }
      const h = Math.min(dt, limit - elapsed);
      let pumpPower = 0;
      let circulating = false;
      let primed = false;
      let heat = 0;
      if (pumped !== null && pulseOn(pumped.pulse, elapsed)) {
        circulating = true;
        const positionId = patternPositionAt(pumped.diverter, run.patternElapsed);
        const feeds = getDiverterPosition(spec, positionId).feeds;
        const moved = run.lastPosition !== null && run.lastPosition !== positionId;
        if (moved) run.sinceSwitch = 0;
        const opening =
          Math.round(meanOpening(run.sinceSwitch, h, transitionTime) * 1e6) / 1e6 || 1e-6;
        // The inventory is judged with the branches fully open: a transition is shorter than
        // the time the water takes to come back, so it does not refill the sump.
        let operating = operatingFor(positionId, pumped.pumpRpm, feeds, held, heldKey, 1);
        // The level check: a short sump in a phase in which the machine checks draws a top-up.
        if (run.topUpPhase !== step.phase) {
          run.topUpPhase = step.phase;
          run.topUps = 0;
        }
        while (
          !operating.inventory.primed &&
          inventorySpec.topUpVolume > 0 &&
          inventorySpec.levelCheckIn.includes(step.phase) &&
          run.topUps < inventorySpec.maxTopUpsPerPhase
        ) {
          const volume = inventorySpec.topUpVolume;
          run.thermal = {
            ...run.thermal,
            liquor: mixTemperature([
              { volume: run.liquorVolume, temperature: run.thermal.liquor },
              { volume, temperature: inletTemperature },
            ]),
          };
          run.liquorVolume += volume;
          run.mainsWater += volume;
          run.topUps += 1;
          events.push({
            kind: 'top_up',
            time: run.time,
            stepId: step.id,
            volume,
            liquorVolume: run.liquorVolume,
          });
          operating = operatingFor(positionId, pumped.pumpRpm, feeds, held, heldKey, 1);
        }
        const steady = operating.point;
        const inventory = operating.inventory;
        // While the diverter moves, flow and power are those of the partly open branches.
        const point =
          opening < 1
            ? operatingFor(positionId, pumped.pumpRpm, feeds, held, heldKey, opening).point
            : steady;
        pumpPower = point.electricalPower;
        primed = inventory.primed;
        if (!primed) {
          report(
            'pump_starved',
            step.id,
            `with ${(run.liquorVolume * 1000).toFixed(2)} L in the machine${heldTotal(held) > 0 ? `, ${(heldTotal(held) * 1000).toFixed(2)} L of it held by the load,` : ''} the sump holds ${(inventory.sump * 1000).toFixed(2)} L in diverter state "${positionId}", less than the ${(inventorySpec.minSumpVolume * 1000).toFixed(2)} L the pump needs: it draws ${(inventory.airFraction * 100).toFixed(0)} % air and delivers ${(steady.flow * 60000).toFixed(1)} L/min instead of ${(pointFor(positionId, pumped.pumpRpm).flow * 60000).toFixed(1)}`,
          );
        }
        const last = diverter[diverter.length - 1];
        if (last !== undefined && last.position === positionId && last.end === run.time) {
          diverter[diverter.length - 1] = { ...last, end: run.time + h };
        } else {
          diverter.push({
            start: run.time,
            end: run.time + h,
            position: positionId,
            feeds,
            transition: moved ? transitionTime : 0,
            pumpPower: steady.electricalPower,
            flow: steady.flow,
          });
        }
        run.lastPosition = positionId;
        run.sinceSwitch += h;
        run.patternElapsed += h;
        run.pumpEnergy += pumpPower * h;
        run.pumpOnTime += h;

        // Doses armed by an earlier dose step: released once the pump has run for the delay.
        for (let i = 0; i < pendingDoses.length;) {
          const dose = pendingDoses[i] as PendingDose;
          const ready =
            dose.remaining < h - dt * 1e-6 &&
            (dose.minTemperature === null || run.thermal.liquor >= dose.minTemperature);
          if (!ready) {
            dose.remaining = Math.max(dose.remaining - h, 0);
            i++;
            continue;
          }
          const at = run.time + Math.max(dose.remaining, 0);
          if (dose.kind === 'detergent') {
            events.push({
              kind: 'detergent_release',
              time: at,
              stepId: dose.stepId,
              mass: dose.amount,
              temperature: run.thermal.liquor,
            });
          } else {
            events.push({
              kind: 'rinse_aid_release',
              time: at,
              stepId: dose.stepId,
              volume: dose.amount,
              temperature: run.thermal.liquor,
            });
          }
          pendingDoses.splice(i, 1);
        }

        if (pumped.heater.mode === 'target') {
          heating = run.thermal.liquor < pumped.heater.target;
        } else if (pumped.heater.mode === 'thermostat') {
          if (run.thermal.liquor < pumped.heater.target - pumped.heater.band) heating = true;
          if (run.thermal.liquor >= pumped.heater.target) heating = false;
        }
        // The heater is enabled only while the pump runs with a primed sump (machine.md
        // section 12.2 item 6); a starved heat step therefore runs into its timeout.
        if (heating) {
          if (run.liquorVolume <= NEGLIGIBLE_WATER_VOLUME) {
            report('heater_dry', step.id, 'the heater is called for with no water in the tub');
          } else if (primed) {
            heat = heaterPower;
          }
        }
      }
      if (heat > 0) {
        const last = heater[heater.length - 1];
        if (last !== undefined && last.end === run.time) {
          heater[heater.length - 1] = { ...last, end: run.time + h };
        } else {
          heater.push({ start: run.time, end: run.time + h, power: heat });
        }
        run.heaterEnergy += heat * h;
        run.heaterOnTime += h;
      }
      run.thermal = stepThermal(
        model,
        run.thermal,
        {
          liquorVolume: run.liquorVolume,
          prestoreVolume: run.prestoreVolume,
          circulating,
          heaterPower: heat,
          pumpPower,
        },
        h,
      );
      elapsed += h;
      run.time = start + elapsed;
      if (elapsed >= nextSample - dt * 1e-6) {
        sample();
        nextSample += sampleInterval;
      }
    }
    if (duration === null && pumped?.stopAt != null && run.thermal.liquor < pumped.stopAt) {
      timedOut = true;
    }
    for (const fill of pendingFills) fillPrestore(step.id, fill.volume);
    run.time = start + elapsed;
    sample();
    if (timedOut) {
      report(
        'heat_timeout',
        step.id,
        `the liquor reached ${run.thermal.liquor.toFixed(1)} C, not the target of ${String(pumped?.stopAt)} C, within ${(timeout / 60).toFixed(0)} min`,
      );
    }

    rowEnds.set(step.row, { liquor: run.thermal.liquor, load: run.thermal.load });
    if (!(run.time > start)) return;
    const temperature: TemperatureProfile = profile;
    events.sort((a, b) => a.time - b.time);
    segments.push({
      index: segments.length,
      stepId: step.id,
      row: step.row,
      kind: step.kind,
      phase: step.phase,
      label: step.label,
      start,
      end: run.time,
      liquorVolume: { start: before.liquorVolume, end: run.liquorVolume },
      prestoreVolume: { start: before.prestoreVolume, end: run.prestoreVolume },
      target,
      temperature,
      pumpRpm: pumped === null ? 0 : pumped.pumpRpm,
      diverter,
      heater,
      heaterOnTime: run.heaterOnTime - heaterStart.onTime,
      heaterEnergy: run.heaterEnergy - heaterStart.energy,
      pumpOnTime: run.pumpOnTime - pumpStart.onTime,
      pumpEnergy: run.pumpEnergy - pumpStart.energy,
      mainsWater: run.mainsWater - before.mainsWater,
      // Everything since the last segment: the events of this step and of the zero-duration
      // steps (doses) that fell at its start.
      events: events.slice(assignedEvents),
      heldWater: pumped === null ? 0 : heldTotal(held),
    });
    assignedEvents = events.length;
  };

  const defaultPattern = spec.hydraulics.diverter.defaultPattern;
  /** A heating target as the machine can reach it: never above the heater's cut-out. */
  const reachable = (step: ProgrammeStep, target: number): number => {
    if (cutOut === null || target <= cutOut) return target;
    report(
      'target_above_cut_out',
      step.id,
      `a target of ${target} C is above the ${cutOut} C at which the heater goes off; the liquor is heated to ${cutOut} C`,
    );
    return cutOut;
  };

  for (const step of programme.steps) {
    const before = {
      liquorVolume: run.liquorVolume,
      prestoreVolume: run.prestoreVolume,
      mainsWater: run.mainsWater,
    };
    const stepStart = run.time;
    switch (step.kind) {
      case 'dose_detergent':
        pendingDoses.push({
          kind: 'detergent',
          stepId: step.id,
          remaining: Math.max(spec.dosing.detergentReleaseDelay, 0),
          minTemperature: null,
          amount: spec.dosing.detergentMass,
        });
        rowEnds.set(step.row, { liquor: run.thermal.liquor, load: run.thermal.load });
        break;
      case 'dose_rinse_aid':
        pendingDoses.push({
          kind: 'rinse_aid',
          stepId: step.id,
          remaining: Math.max(spec.dosing.rinseAidDelay ?? 0, 0),
          minTemperature: spec.dosing.rinseAidMinTemperature,
          amount: step.volume ?? spec.dosing.rinseAidVolume,
        });
        rowEnds.set(step.row, { liquor: run.thermal.liquor, load: run.thermal.load });
        break;
      case 'drain': {
        dropPendingDoses('the bath is drained');
        let removed: number;
        if (step.volume === null) {
          removed = Math.max(run.liquorVolume - carryOver, 0);
        } else {
          removed = Math.min(step.volume, run.liquorVolume);
          if (step.volume > run.liquorVolume + VOLUME_TOLERANCE) {
            report(
              'drain_exceeds_content',
              step.id,
              `a partial drain of ${(step.volume * 1000).toFixed(2)} L from a tub holding ${(run.liquorVolume * 1000).toFixed(2)} L`,
            );
          }
        }
        run.liquorVolume -= removed;
        // The step lasts at least as long as the drain pump needs for the volume.
        const drainFlow = spec.hydraulics.drain.flow;
        const duration = Math.max(step.duration, drainFlow > 0 ? removed / drainFlow : 0);
        events.push({
          kind: 'drain',
          time: run.time,
          duration,
          stepId: step.id,
          volume: removed,
          remaining: run.liquorVolume,
          temperature: run.thermal.liquor,
        });
        advance(step, duration, null, [], 0, before, null);
        break;
      }
      case 'fill': {
        let fromMains = 0;
        let fromPrestore = 0;
        for (const source of step.sources) {
          if (source.from === 'mains') fromMains += source.volume;
          else fromPrestore += source.volume;
        }
        if (fromPrestore > 0 && prestoreCapacity === null) {
          report('no_prestore_tank', step.id, 'the machine has no pre-store tank to draw from');
          fromPrestore = 0;
        }
        if (fromPrestore > run.prestoreVolume + VOLUME_TOLERANCE) {
          report(
            'prestore_underflow',
            step.id,
            `${(fromPrestore * 1000).toFixed(2)} L drawn from a pre-store tank holding ${(run.prestoreVolume * 1000).toFixed(2)} L`,
          );
          fromPrestore = run.prestoreVolume;
        }
        const incoming = fromMains + fromPrestore;
        const incomingTemperature = mixTemperature([
          { volume: fromMains, temperature: inletTemperature },
          { volume: fromPrestore, temperature: run.thermal.prestore },
        ]);
        run.thermal = {
          ...run.thermal,
          liquor: mixTemperature([
            { volume: run.liquorVolume, temperature: run.thermal.liquor },
            { volume: incoming, temperature: incomingTemperature },
          ]),
        };
        run.liquorVolume += incoming;
        run.prestoreVolume = Math.max(run.prestoreVolume - fromPrestore, 0);
        run.mainsWater += fromMains;
        // As long as the sources need at the machine's flows, and at least the step's own time.
        const inletFlow = spec.hydraulics.fill.inletFlow;
        const dischargeFlow = spec.hydraulics.fill.prestoreDischargeFlow;
        const duration = Math.max(
          step.duration ?? 0,
          fromMains > 0 && inletFlow > 0 ? fromMains / inletFlow : 0,
          fromPrestore > 0 && dischargeFlow !== null && dischargeFlow > 0
            ? fromPrestore / dischargeFlow
            : 0,
        );
        events.push({
          kind: 'fill',
          time: run.time,
          duration,
          stepId: step.id,
          volume: incoming,
          fromMains,
          fromPrestore,
          temperature: incomingTemperature,
        });
        advance(step, duration, null, step.prestoreFills, 0, before, null);
        break;
      }
      case 'circulate':
        advance(
          step,
          step.duration,
          {
            pumpRpm: step.pumpRpm,
            diverter: step.diverter ?? defaultPattern,
            pulse: step.pulse,
            heater: { mode: 'off' },
            stopAt: null,
          },
          step.prestoreFills,
          0,
          before,
          null,
        );
        break;
      case 'heat': {
        const target = reachable(step, step.target);
        advance(
          step,
          step.duration,
          {
            pumpRpm: step.pumpRpm,
            diverter: step.diverter ?? defaultPattern,
            pulse: step.pulse,
            heater: { mode: 'target', target },
            stopAt: step.duration === null ? target : null,
          },
          step.prestoreFills,
          step.timeout,
          before,
          step.target,
        );
        break;
      }
      case 'hold': {
        const target =
          step.target !== null && step.reheatBand !== null ? reachable(step, step.target) : null;
        advance(
          step,
          step.duration,
          {
            pumpRpm: step.pumpRpm,
            diverter: step.diverter ?? defaultPattern,
            pulse: step.pulse,
            heater:
              target !== null && step.reheatBand !== null
                ? { mode: 'thermostat', target, band: step.reheatBand }
                : { mode: 'off' },
            stopAt: null,
          },
          step.prestoreFills,
          0,
          before,
          step.target,
        );
        break;
      }
      case 'regenerate':
        run.mainsWater += step.water;
        run.otherEnergy += step.energy;
        events.push({
          kind: 'regeneration',
          time: run.time,
          duration: step.duration,
          stepId: step.id,
          water: step.water,
          energy: step.energy,
        });
        advance(
          step,
          step.duration,
          step.pumpRpm === null
            ? null
            : {
                pumpRpm: step.pumpRpm,
                diverter: step.diverter ?? defaultPattern,
                pulse: null,
                heater: { mode: 'off' },
                stopAt: null,
              },
          [],
          0,
          before,
          null,
        );
        break;
      case 'dry': {
        const duration = step.duration ?? spec.drying.defaultDuration;
        const autoOpen = spec.drying.autoOpen;
        if (autoOpen !== null && autoOpen.after < duration) {
          events.push({
            kind: 'door_open',
            time: run.time + autoOpen.after,
            stepId: step.id,
            gap: autoOpen.gap,
          });
        }
        advance(step, duration, null, step.prestoreFills, 0, before, null);
        break;
      }
    }
    stepSpans.set(step.id, { start: stepStart, end: run.time });
  }
  dropPendingDoses('the programme ends');

  events.sort((a, b) => a.time - b.time);

  // One row per row of the programme table, also for a row whose steps take no time.
  const rows: TimelineRow[] = [];
  for (const step of programme.steps) {
    const segment = segments.find((s) => s.stepId === step.id);
    const span = stepSpans.get(step.id) ?? { start: run.time, end: run.time };
    const { start, end } = span;
    const target = step.kind === 'heat' || step.kind === 'hold' ? step.target : null;
    const pumpRpm = segment?.pumpRpm ?? 0;
    const mainsWater = segment?.mainsWater ?? 0;
    const heaterOnTime = segment?.heaterOnTime ?? 0;
    const last = rows[rows.length - 1];
    const ends = rowEnds.get(step.row);
    if (last !== undefined && last.row === step.row) {
      rows[rows.length - 1] = {
        ...last,
        end: Math.max(last.end, end),
        mainsWater: last.mainsWater + mainsWater,
        target: target === null ? last.target : Math.max(last.target ?? target, target),
        pumpRpm: Math.max(last.pumpRpm, pumpRpm),
        heaterOnTime: last.heaterOnTime + heaterOnTime,
      };
    } else {
      rows.push({
        row: step.row,
        phase: step.phase,
        start,
        end,
        mainsWater,
        target,
        pumpRpm,
        heaterOnTime,
        liquorTemperatureAtEnd: ends?.liquor ?? run.thermal.liquor,
        loadTemperatureAtEnd: ends?.load ?? run.thermal.load,
      });
    }
  }

  return {
    machineId: spec.id,
    programmeId: programme.id,
    conditions: {
      loadHeatCapacity,
      inletTemperature,
      ambientTemperature,
      heaterPower,
      timeStep: dt,
      sampleInterval,
      basketHeights: config.basketHeights,
    },
    segments,
    events,
    rows,
    totals: {
      duration: run.time,
      mainsWater: run.mainsWater,
      heaterEnergy: run.heaterEnergy,
      pumpEnergy: run.pumpEnergy,
      otherEnergy: run.otherEnergy,
      energy: run.heaterEnergy + run.pumpEnergy + run.otherEnergy,
      heaterOnTime: run.heaterOnTime,
      pumpOnTime: run.pumpOnTime,
      prestoreVolumeAtEnd: run.prestoreVolume,
    },
    problems,
  };
}
