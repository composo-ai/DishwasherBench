/**
 * Tools on programmes and timelines: variants of a programme (a step retimed, a softener
 * regeneration added, a hold fitted to a total running time) and questions asked of an expanded
 * timeline (what is happening at a time, how long the liquor stays above a temperature).
 *
 * All pure functions. Units: seconds, m^3, J, degrees C.
 */

import type { ExpandOptions } from './programme.ts';
import { expandProgramme } from './programme.ts';
import type {
  DiverterInterval,
  ProgrammePhase,
  ProgrammeSpec,
  ProgrammeStep,
  ProgrammeTimeline,
  TimelineSegment,
} from './programme-types.ts';
import type { MachineSpec } from './types.ts';

/**
 * A copy of `programme` in which the step `stepId` lasts `duration` seconds. Pre-store fills of
 * the step keep their times from its start. Throws a RangeError if the programme has no such
 * step or the step has no duration to set (a dose).
 */
export function withStepDuration(
  programme: ProgrammeSpec,
  stepId: string,
  duration: number,
): ProgrammeSpec {
  let found = false;
  const steps = programme.steps.map((step): ProgrammeStep => {
    if (step.id !== stepId) return step;
    found = true;
    if (step.kind === 'dose_detergent' || step.kind === 'dose_rinse_aid') {
      throw new RangeError(`withStepDuration: step "${stepId}" takes no time`);
    }
    return { ...step, duration };
  });
  if (!found)
    throw new RangeError(`withStepDuration: programme ${programme.id} has no step "${stepId}"`);
  return { ...programme, steps };
}

/**
 * A copy of `programme` whose step `stepId` (a step with a fixed duration, usually the
 * main-wash hold) is lengthened or shortened until the expanded programme takes
 * `totalDuration` seconds, as the dossiers size a hold from a displayed running time. The
 * later heat-ups shift a little as the hold changes, so the duration is found by repeated
 * correction; it is rounded to the expansion's time step. Throws a RangeError if no duration
 * of that step can give the total.
 */
export function fitStepToTotalDuration(
  spec: MachineSpec,
  programme: ProgrammeSpec,
  stepId: string,
  totalDuration: number,
  options: ExpandOptions = {},
): ProgrammeSpec {
  const step = programme.steps.find((s) => s.id === stepId);
  if (step === undefined || !('duration' in step) || step.duration === null) {
    throw new RangeError(`fitStepToTotalDuration: step "${stepId}" has no fixed duration to fit`);
  }
  const dt = options.timeStep ?? 1;
  let duration = step.duration;
  let fitted = programme;
  for (let i = 0; i < 12; i++) {
    const total = expandProgramme(spec, fitted, options).totals.duration;
    const error = totalDuration - total;
    if (Math.abs(error) <= dt / 2) return fitted;
    duration = Math.round((duration + error) / dt) * dt;
    if (!(duration >= 0)) {
      throw new RangeError(
        `fitStepToTotalDuration: programme ${programme.id} cannot take ${totalDuration} s whatever the length of step "${stepId}"`,
      );
    }
    fitted = withStepDuration(programme, stepId, duration);
  }
  return fitted;
}

/**
 * A copy of `programme` with a softener regeneration added: one step of the machine's extra
 * duration, water and energy, inserted at the end of the main wash, before it drains (the
 * Bosch manual: "takes place before the end of the main rinse cycle"). The circulation pump
 * rests while it runs, so the programme gains exactly the stated time, water and energy apart
 * from what the pause does to the temperatures. Returns the programme unchanged if the machine
 * has no softener data or the programme has no main wash.
 */
export function withRegeneration(spec: MachineSpec, programme: ProgrammeSpec): ProgrammeSpec {
  const softener = spec.softener;
  if (softener === null) return programme;
  let last = -1;
  programme.steps.forEach((step, i) => {
    if (step.phase === 'main_wash' && (step.kind === 'hold' || step.kind === 'heat')) last = i;
  });
  const anchor = programme.steps[last];
  if (anchor === undefined) return programme;
  const regenerate: ProgrammeStep = {
    kind: 'regenerate',
    id: `${anchor.id}_regenerate`,
    row: anchor.row,
    phase: 'main_wash',
    label: 'softener regeneration',
    duration: softener.extraDuration,
    water: softener.extraWater,
    energy: softener.extraEnergy,
    pumpRpm: null,
    diverter: null,
  };
  return {
    ...programme,
    id: `${programme.id}_regen`,
    name: `${programme.name} with softener regeneration`,
    steps: [...programme.steps.slice(0, last + 1), regenerate, ...programme.steps.slice(last + 1)],
    declared: {
      ...programme.declared,
      duration: programme.declared.duration + softener.extraDuration,
      mainsWater: programme.declared.mainsWater + softener.extraWater,
      energy:
        programme.declared.energy === null
          ? null
          : programme.declared.energy + softener.extraEnergy,
    },
  };
}

/** What the machine is doing at one instant of a timeline. */
export interface TimelineState {
  /** The segment that contains the instant. */
  readonly segment: TimelineSegment;
  /** The diverter interval in force, or null with the pump off. */
  readonly diverter: DiverterInterval | null;
  /** Whether the heater is on. */
  readonly heaterOn: boolean;
  /** Modelled temperatures, linearly interpolated between samples, degrees C. */
  readonly liquorTemperature: number;
  readonly loadTemperature: number;
  readonly machineTemperature: number;
}

/** Linear interpolation of a sampled series at `time`. */
function interpolate(times: readonly number[], values: readonly number[], time: number): number {
  const n = times.length;
  if (n === 0) return Number.NaN;
  for (let i = 1; i < n; i++) {
    const t0 = times[i - 1];
    const t1 = times[i];
    const v0 = values[i - 1];
    const v1 = values[i];
    if (t0 === undefined || t1 === undefined || v0 === undefined || v1 === undefined) continue;
    if (time <= t1) {
      if (!(t1 > t0)) return v1;
      const f = Math.min(Math.max((time - t0) / (t1 - t0), 0), 1);
      return v0 + (v1 - v0) * f;
    }
  }
  return values[n - 1] ?? Number.NaN;
}

/**
 * The state of the machine `time` seconds into a timeline: the segment (the one that starts at
 * `time` if it falls on a boundary), the spray levels fed, the heater, and the modelled
 * temperatures. Returns undefined before the start and at or after the end.
 */
export function timelineStateAt(
  timeline: ProgrammeTimeline,
  time: number,
): TimelineState | undefined {
  const segment = timeline.segments.find((s) => time >= s.start && time < s.end);
  if (segment === undefined) return undefined;
  const profile = segment.temperature;
  return {
    segment,
    diverter: segment.diverter.find((d) => time >= d.start && time < d.end) ?? null,
    heaterOn: segment.heater.some((h) => time >= h.start && time < h.end),
    liquorTemperature: interpolate(profile.time, profile.liquor, time),
    loadTemperature: interpolate(profile.time, profile.load, time),
    machineTemperature: interpolate(profile.time, profile.machine, time),
  };
}

/**
 * Total time, in seconds, for which the modelled liquor temperature of the pumped segments of a
 * timeline is at or above `temperature` (degrees C), by linear interpolation between samples.
 * With `phases`, only the segments of those programme phases are counted.
 */
export function liquorTimeAbove(
  timeline: ProgrammeTimeline,
  temperature: number,
  phases?: readonly ProgrammePhase[],
): number {
  let total = 0;
  for (const segment of timeline.segments) {
    if (!(segment.pumpOnTime > 0)) continue;
    if (phases !== undefined && !phases.includes(segment.phase)) continue;
    const { time, liquor } = segment.temperature;
    for (let i = 1; i < time.length; i++) {
      const t0 = time[i - 1];
      const t1 = time[i];
      const v0 = liquor[i - 1];
      const v1 = liquor[i];
      if (t0 === undefined || t1 === undefined || v0 === undefined || v1 === undefined) continue;
      const above0 = v0 >= temperature;
      const above1 = v1 >= temperature;
      if (above0 && above1) total += t1 - t0;
      else if (above0 !== above1 && v1 !== v0) {
        const crossing = (temperature - v0) / (v1 - v0);
        total += (t1 - t0) * (above0 ? crossing : 1 - crossing);
      }
    }
  }
  return total;
}

/** Time each spray level is fed over a whole timeline, seconds, by spray level id. */
export function sprayTimeByLevel(timeline: ProgrammeTimeline): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const segment of timeline.segments) {
    for (const interval of segment.diverter) {
      for (const level of interval.feeds) {
        totals[level] = (totals[level] ?? 0) + (interval.end - interval.start);
      }
    }
  }
  return totals;
}
