/**
 * From a wash record to the machine and the programme the simulation is run with
 * (docs/calibration/wash-record.md sections 4 to 6).
 *
 *  - {@link machineOfRecord}: the machine specification with the record's measured values in
 *    place of the specification's (a nozzle bore, an arm rotation rate, any numeric field by
 *    its path), with the dose, the rinse aid and the water of the record.
 *  - {@link programmeOfRecord}: the nominal programme re-timed and re-targeted to the measured
 *    course of the run (direct statements about steps, times of fills, drains and heater
 *    switching read from a power log or noted, a liquor temperature log, the total duration),
 *    with a comparison of the adapted timeline against what was measured.
 *
 * Machine quantities that can be measured are entered as data here and never fitted
 * (docs/design/scope.md, "Calibration is a first-class feature").
 *
 * Units: SI inside; the record's own units at the boundary (see `record.ts`).
 */

import {
  armSteadyState,
  expandProgramme,
  findMachine,
  findProgramme,
  hydraulicOperatingPoint,
  timelineStateAt,
  validateMachineSpec,
  type MachineConfig,
  type MachineSpec,
  type ProgrammeSpec,
  type ProgrammeStep,
  type ProgrammeTimeline,
} from '@spotless/machine';
import type { CourseEvent, RecordCourse, WashRecord } from './record.ts';

/** Thrown when a record cannot be turned into a simulation input; the message says why. */
export class RecordSetupError extends Error {
  override readonly name = 'RecordSetupError';
}

type Mutable = Record<string, unknown> | unknown[];

/** The tokens of a specification path: `a.b[c].d` gives a, b, [c], d. */
function pathTokens(path: string): { readonly key: string; readonly index: boolean }[] {
  const tokens: { key: string; index: boolean }[] = [];
  const pattern = /([^.[\]]+)|\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(path)) !== null) {
    if (match[1] !== undefined) tokens.push({ key: match[1], index: false });
    else if (match[2] !== undefined) tokens.push({ key: match[2], index: true });
  }
  return tokens;
}

/**
 * A copy of `root` with the number at `path` replaced by `value`. Objects and lists along the
 * path are copied, everything else is shared. A list is indexed by the `id` of its element or
 * by position. Throws {@link RecordSetupError} when the path does not lead to a number.
 */
export function withNumberAt<T>(root: T, path: string, value: number): T {
  const tokens = pathTokens(path);
  if (tokens.length === 0) throw new RecordSetupError(`empty path "${path}"`);
  const step = (node: unknown, depth: number): unknown => {
    const token = tokens[depth];
    if (token === undefined) {
      if (typeof node !== 'number') {
        throw new RecordSetupError(`"${path}" is not a number of the machine specification`);
      }
      return value;
    }
    if (Array.isArray(node)) {
      let at = node.findIndex(
        (element) =>
          typeof element === 'object' &&
          element !== null &&
          (element as { id?: unknown }).id === token.key,
      );
      if (at < 0 && /^\d+$/.test(token.key)) at = Number(token.key);
      if (at < 0 || at >= node.length) {
        throw new RecordSetupError(`"${path}": no element "${token.key}"`);
      }
      const copy: unknown[] = [...(node as unknown[])];
      copy[at] = step(node[at], depth + 1);
      return copy;
    }
    if (typeof node === 'object' && node !== null && Object.hasOwn(node, token.key)) {
      const record = node as Record<string, unknown>;
      return { ...record, [token.key]: step(record[token.key], depth + 1) };
    }
    throw new RecordSetupError(`"${path}": the specification has no "${token.key}" there`);
  };
  return step(root as Mutable, 0) as T;
}

/** The machine of a record, as the simulation is run on it. */
export interface RecordMachineSetup {
  readonly spec: MachineSpec;
  readonly config: MachineConfig;
  /** What was changed against the catalogue's specification, in words. */
  readonly changes: readonly string[];
}

/**
 * The machine of a record: the catalogue's specification with the record's measured values,
 * dose, rinse aid and water. Throws {@link RecordSetupError} for an unknown machine, a path
 * that does not exist, or values that leave the specification invalid.
 */
export function machineOfRecord(record: WashRecord): RecordMachineSetup {
  const base = findMachine(record.machine.id);
  if (base === undefined) throw new RecordSetupError(`unknown machine "${record.machine.id}"`);
  let spec: MachineSpec = base;
  const changes: string[] = [];
  const set = (path: string, value: number, why: string): void => {
    spec = withNumberAt(spec, path, value);
    changes.push(`${path} = ${value} (${why})`);
  };

  const baseConfig: MachineConfig = record.machine.config ?? base.defaultConfig;
  const config: MachineConfig =
    record.machine.basket_heights === undefined
      ? baseConfig
      : {
          ...baseConfig,
          basketHeights: { ...baseConfig.basketHeights, ...record.machine.basket_heights },
        };

  for (const measured of record.machine.measured ?? []) {
    if (measured.quantity === 'spec') {
      set(measured.path, measured.value, `measured: ${measured.method}`);
    } else if (measured.quantity === 'nozzle_diameter') {
      const level = spec.sprayLevels.find((l) => l.id === measured.level);
      const nozzle = level?.nozzles.find((n) => n.id === measured.nozzle);
      if (level === undefined || nozzle === undefined) {
        throw new RecordSetupError(
          `machine ${spec.id} has no nozzle "${measured.nozzle}" on spray level "${measured.level}"`,
        );
      }
      if (nozzle.shape !== 'round') {
        throw new RecordSetupError(
          `nozzle ${measured.level}.${measured.nozzle} is not a round bore; override its size and area by path`,
        );
      }
      const d = measured.value_mm / 1000;
      const at = `sprayLevels[${level.id}].nozzles[${nozzle.id}]`;
      set(`${at}.size[0]`, d, `measured bore: ${measured.method}`);
      set(`${at}.area`, (Math.PI * d * d) / 4, 'from the measured bore');
    } else {
      const level = spec.sprayLevels.find((l) => l.id === measured.level);
      if (level === undefined || level.kind !== 'arm') {
        throw new RecordSetupError(`machine ${spec.id} has no spray arm "${measured.level}"`);
      }
      let point: ReturnType<typeof hydraulicOperatingPoint>;
      try {
        point = hydraulicOperatingPoint(spec, measured.position, measured.pump_rpm, {
          basketHeights: config.basketHeights,
        });
      } catch (error) {
        throw new RecordSetupError(
          `arm_speed of ${measured.level}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const branch = point.branches.find((b) => b.id === level.id);
      if (branch === undefined) {
        throw new RecordSetupError(
          `arm "${measured.level}" is not fed in diverter position "${measured.position}"`,
        );
      }
      // omega = (drive - k_f |F_ax|) / (brake + c_v): solve for the viscous coefficient c_v.
      const steady = armSteadyState(level, branch.armPressure);
      const omega = (measured.value_rpm * Math.PI) / 30;
      const viscous = (Math.abs(steady.drive) - steady.staticFriction) / omega - steady.brake;
      if (!(viscous >= 0)) {
        throw new RecordSetupError(
          `arm "${measured.level}" cannot turn at ${measured.value_rpm} rev/min in position ${measured.position} at ${measured.pump_rpm} rev/min of the pump: ` +
            `without any bearing friction the model gives ${((steady.frictionlessOmega * 30) / Math.PI).toFixed(1)} rev/min. ` +
            'Check the nozzle table (bores, angles) before the bearing.',
        );
      }
      set(
        `sprayLevels[${level.id}].bearing.viscous`,
        viscous,
        `so that the arm turns at the measured ${measured.value_rpm} rev/min: ${measured.method}`,
      );
    }
  }

  const consumables = record.consumables;
  if (consumables?.detergent !== undefined) {
    set(
      'dosing.detergentMass',
      consumables.detergent.form === 'none' ? 0 : consumables.detergent.dose_g / 1000,
      `dose of ${consumables.detergent.product}`,
    );
  }
  if (consumables?.rinse_aid?.dose_ml !== undefined) {
    set('dosing.rinseAidVolume', consumables.rinse_aid.dose_ml * 1e-6, 'rinse aid dosed');
  }
  if (consumables?.water?.inlet_temperature_c !== undefined) {
    set('thermal.inletTemperature', consumables.water.inlet_temperature_c, 'inlet water');
  }
  if (consumables?.water?.ambient_temperature_c !== undefined) {
    set('thermal.ambientTemperature', consumables.water.ambient_temperature_c, 'room');
  }

  if (changes.length > 0) {
    // New errors only. A programme's declared duration, water and energy hold for the nominal
    // conditions: that a measured inlet temperature or dose moves the model away from them is
    // the point of measuring, not a fault of the specification.
    const before = new Set(validateMachineSpec(base).map((p) => `${p.code}|${p.path}`));
    const noDetergent = consumables?.detergent !== undefined && spec.dosing.detergentMass === 0;
    const problems = validateMachineSpec(spec).filter(
      (p) =>
        p.severity === 'error' &&
        !/_mismatch$/.test(p.code) &&
        !before.has(`${p.code}|${p.path}`) &&
        // A wash without detergent is a wash worth running; the specification's range is for a
        // machine's rated dose.
        !(noDetergent && p.path === 'dosing.detergentMass'),
    );
    if (problems.length > 0) {
      throw new RecordSetupError(
        `the measured values leave the machine specification invalid: ${problems
          .slice(0, 4)
          .map((p) => `${p.path}: ${p.message}`)
          .join('; ')}`,
      );
    }
  }
  return { spec, config, changes };
}

// ---------------------------------------------------------------------------------------------
// The measured course of the run
// ---------------------------------------------------------------------------------------------

/** One change made to a step of the nominal programme. */
export interface CourseChange {
  readonly step: string;
  readonly field: 'duration' | 'target' | 'mains_volume';
  /** SI: seconds, degrees Celsius, cubic metres. */
  readonly from: number | null;
  readonly to: number;
  /** Where the new value comes from: `stated`, `event`, `temperature_log`, `duration`. */
  readonly source: string;
}

/** How the adapted timeline compares with what was measured. */
export interface CourseCheck {
  /** Each anchor used: when it was measured and when the adapted timeline has it, seconds. */
  readonly anchors: readonly {
    readonly kind: CourseEvent['kind'];
    readonly measured_s: number;
    readonly model_s: number;
  }[];
  readonly duration?: { readonly measured_s: number; readonly model_s: number };
  /** Liquor temperature of the adapted timeline against the temperature log. */
  readonly temperature?: {
    readonly readings: number;
    readonly rms_K: number;
    readonly max_K: number;
  };
  /** Energy of the adapted timeline against the integral of the power log, kWh. */
  readonly energy?: { readonly measured_kWh: number; readonly model_kWh: number };
}

/** The programme of a record, adapted to the measured course of the run. */
export interface RecordProgrammeSetup {
  readonly programme: ProgrammeSpec;
  /** True when a measured course replaced the nominal timeline. */
  readonly adapted: boolean;
  readonly changes: readonly CourseChange[];
  readonly check: CourseCheck;
  /** What could not be used, and why. */
  readonly notes: readonly string[];
}

/** Where a temperature log must have been taken to stand for the liquor. */
const LIQUOR_PROBE = /liquor|sump|water|tub_floor/i;

/** Largest accepted difference between a measured and a modelled time, seconds. */
const ANCHOR_TOLERANCE = 1;

/** Linear interpolation of a log at `t`; the end values outside its span. */
function logAt(t: readonly number[], values: readonly number[], at: number): number {
  const n = t.length;
  if (n === 0) return Number.NaN;
  if (at <= (t[0] as number)) return values[0] as number;
  if (at >= (t[n - 1] as number)) return values[n - 1] as number;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((t[mid] as number) <= at) lo = mid;
    else hi = mid;
  }
  const t0 = t[lo] as number;
  const t1 = t[hi] as number;
  const f = t1 > t0 ? (at - t0) / (t1 - t0) : 0;
  return (values[lo] as number) + ((values[hi] as number) - (values[lo] as number)) * f;
}

/**
 * The heater switching read from a mains power log: on while the power is above half the
 * heater's rating, with pauses shorter than `minGap` seconds bridged and bursts shorter than
 * `minOn` seconds dropped.
 */
export function heaterEventsFromPower(
  t: readonly number[],
  power: readonly number[],
  heaterPower: number,
  minGap = 30,
  minOn = 20,
): CourseEvent[] {
  const threshold = 0.5 * heaterPower;
  const intervals: [number, number][] = [];
  let start: number | null = null;
  for (let i = 0; i < t.length; i++) {
    const on = (power[i] as number) > threshold;
    if (on && start === null) {
      // The switch lies between this reading and the one before.
      start = i === 0 ? (t[0] as number) : 0.5 * ((t[i - 1] as number) + (t[i] as number));
    } else if (!on && start !== null) {
      intervals.push([start, 0.5 * ((t[i - 1] as number) + (t[i] as number))]);
      start = null;
    }
  }
  if (start !== null) intervals.push([start, t[t.length - 1] as number]);
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last !== undefined && interval[0] - last[1] < minGap) last[1] = interval[1];
    else merged.push([interval[0], interval[1]]);
  }
  const events: CourseEvent[] = [];
  for (const [a, b] of merged) {
    if (b - a < minOn) continue;
    events.push({ kind: 'heater_on', t_s: a }, { kind: 'heater_off', t_s: b });
  }
  return events;
}

/**
 * A step with another length. Mains water that the step lets into the pre-store tank at a time
 * counted from its start keeps its distance from the END of the step (the machine takes it
 * "15 minutes before the end" of the main-wash hold, however long the hold is), not earlier
 * than its start.
 */
export function retimedStep(step: ProgrammeStep, duration: number): ProgrammeStep {
  if (!('duration' in step)) return step;
  if (!('prestoreFills' in step) || step.duration === null || step.prestoreFills.length === 0) {
    return { ...step, duration };
  }
  const shift = duration - step.duration;
  return {
    ...step,
    duration,
    prestoreFills: step.prestoreFills.map((fill) =>
      fill.relative === true ? fill : { ...fill, at: Math.max(0, fill.at + shift) },
    ),
  };
}

function setStep(
  programme: ProgrammeSpec,
  stepId: string,
  change: (step: ProgrammeStep) => ProgrammeStep,
): ProgrammeSpec {
  return { ...programme, steps: programme.steps.map((s) => (s.id === stepId ? change(s) : s)) };
}

/** When the adapted timeline has the `index`-th anchor of a kind, seconds; undefined if it has none. */
function modelAnchor(
  timeline: ProgrammeTimeline,
  kind: CourseEvent['kind'],
  index: number,
): { readonly time: number; readonly segment: number } | undefined {
  const segments = timeline.segments.filter((s) =>
    kind === 'drain'
      ? s.kind === 'drain'
      : kind === 'fill'
        ? s.kind === 'fill'
        : s.kind === 'heat' && s.end > s.start,
  );
  const segment = segments[index];
  if (segment === undefined) return undefined;
  return { time: kind === 'heater_off' ? segment.end : segment.start, segment: segment.index };
}

/**
 * The programme of a record. Without a measured course it is the nominal programme of the
 * machine. With one, the nominal programme is adapted in this order:
 *
 *  1. direct statements about steps (`course.steps`) are applied as given;
 *  2. the heater switching is taken from `course.events`, or read from the power log;
 *  3. with a liquor temperature log, the target of every heat step (and of the hold after it)
 *     becomes the logged temperature at the moment the heater went off;
 *  4. the lengths of the steps between measured fills, drains and heater switchings are
 *     corrected until the timeline has each of them at its measured time; without a
 *     temperature log, a heat-up is made to end when the heater went off by moving its target;
 *  5. the last step is lengthened or shortened to the measured total duration.
 *
 * `spec` is the machine as {@link machineOfRecord} returns it. Throws {@link RecordSetupError}
 * for an unknown programme.
 */
export function programmeOfRecord(
  record: WashRecord,
  spec: MachineSpec,
  config: MachineConfig,
): RecordProgrammeSetup {
  const nominal = findProgramme(spec, record.programme.id);
  if (nominal === undefined) {
    throw new RecordSetupError(`machine ${spec.id} has no programme "${record.programme.id}"`);
  }
  const course: RecordCourse | undefined = record.programme.course;
  if (course === undefined) {
    return { programme: nominal, adapted: false, changes: [], check: { anchors: [] }, notes: [] };
  }
  const notes: string[] = [];
  const changes: CourseChange[] = [];
  let programme: ProgrammeSpec = nominal;
  const expand = (): ProgrammeTimeline => expandProgramme(spec, programme, { config });
  const stepOf = (id: string): ProgrammeStep | undefined =>
    programme.steps.find((s) => s.id === id);
  const setDuration = (id: string, duration: number, source: string): void => {
    const step = stepOf(id);
    if (step === undefined || !('duration' in step)) return;
    changes.push({ step: id, field: 'duration', from: step.duration, to: duration, source });
    programme = setStep(programme, id, (s) => retimedStep(s, duration));
  };
  const setTarget = (id: string, target: number, source: string): void => {
    const step = stepOf(id);
    if (step === undefined || (step.kind !== 'heat' && step.kind !== 'hold')) return;
    changes.push({ step: id, field: 'target', from: step.target, to: target, source });
    programme = setStep(programme, id, (s) =>
      s.kind === 'heat' || s.kind === 'hold' ? { ...s, target } : s,
    );
  };
  /** The target of a heat step, and of the hold that follows it in the same phase. */
  const setHeatTarget = (id: string, target: number, source: string): void => {
    setTarget(id, target, source);
    const at = programme.steps.findIndex((s) => s.id === id);
    const next = programme.steps[at + 1];
    const heat = programme.steps[at];
    if (
      next?.kind === 'hold' &&
      next.target !== null &&
      heat !== undefined &&
      next.phase === heat.phase
    ) {
      setTarget(next.id, target, source);
    }
  };

  // 1. Direct statements.
  for (const stated of course.steps ?? []) {
    const step = stepOf(stated.step);
    if (step === undefined) {
      notes.push(`course.steps: programme ${nominal.id} has no step "${stated.step}"`);
      continue;
    }
    if (stated.duration_s !== undefined) {
      if ('duration' in step) setDuration(step.id, stated.duration_s, 'stated');
      else notes.push(`course.steps: step ${step.id} takes no time`);
    }
    if (stated.target_c !== undefined) {
      if (step.kind === 'heat') setHeatTarget(step.id, stated.target_c, 'stated');
      else if (step.kind === 'hold') setTarget(step.id, stated.target_c, 'stated');
      else notes.push(`course.steps: step ${step.id} has no target temperature`);
    }
    if (stated.mains_volume_l !== undefined) {
      if (step.kind === 'fill') {
        const volume = stated.mains_volume_l / 1000;
        const others = step.sources.filter((s) => s.from !== 'mains');
        const before = step.sources.find((s) => s.from === 'mains')?.volume ?? null;
        changes.push({
          step: step.id,
          field: 'mains_volume',
          from: before,
          to: volume,
          source: 'stated',
        });
        programme = setStep(programme, step.id, (s) =>
          s.kind === 'fill' ? { ...s, sources: [...others, { from: 'mains', volume }] } : s,
        );
      } else notes.push(`course.steps: step ${step.id} is not a fill`);
    }
  }
  const stated = new Set((course.steps ?? []).map((s) => s.step));

  // 2. Anchors: fills, drains and heater switching.
  let events = [...(course.events ?? [])].filter((e) =>
    ['fill', 'drain', 'heater_on', 'heater_off'].includes(e.kind),
  );
  const hasHeaterEvents = events.some((e) => e.kind === 'heater_on' || e.kind === 'heater_off');
  if (!hasHeaterEvents && course.power_log !== undefined) {
    events = events.concat(
      heaterEventsFromPower(
        course.power_log.t_s,
        course.power_log.values,
        spec.thermal.heaterPower * spec.thermal.heaterDuty,
      ),
    );
  }
  events.sort((a, b) => a.t_s - b.t_s);
  const byKind = (kind: CourseEvent['kind']): CourseEvent[] =>
    events.filter((e) => e.kind === kind);

  // The measured anchors of a kind against those of the nominal timeline: one to one, or all
  // but a pre-drain at time 0 that nobody notes.
  const first = expand();
  const anchors: { kind: CourseEvent['kind']; index: number; t: number }[] = [];
  for (const kind of ['fill', 'drain', 'heater_on', 'heater_off'] as const) {
    const measured = byKind(kind);
    if (measured.length === 0) continue;
    let count = 0;
    while (modelAnchor(first, kind, count) !== undefined) count++;
    let offset = 0;
    if (
      measured.length === count - 1 &&
      kind === 'drain' &&
      modelAnchor(first, kind, 0)?.time === 0
    ) {
      offset = 1;
    } else if (measured.length !== count) {
      notes.push(
        `course: ${measured.length} measured ${kind} events against ${count} in programme ${nominal.id}; they are not used`,
      );
      continue;
    }
    measured.forEach((event, i) => anchors.push({ kind, index: i + offset, t: event.t_s }));
  }
  anchors.sort((a, b) => a.t - b.t);

  // 3. Heat targets from a liquor temperature log.
  const log = course.temperature_log;
  const liquorLog = log !== undefined && LIQUOR_PROBE.test(log.where ?? '') ? log : undefined;
  if (log !== undefined && liquorLog === undefined) {
    notes.push(
      `course.temperature_log was taken at "${log.where ?? 'an unstated place'}", not in the liquor: it is compared with the model but sets no target`,
    );
  }
  const targetFromLog = new Set<string>();
  if (liquorLog !== undefined) {
    const heats = first.segments.filter((s) => s.kind === 'heat' && s.end > s.start);
    heats.forEach((segment, k) => {
      if (stated.has(segment.stepId)) return;
      const off = anchors.find((a) => a.kind === 'heater_off' && a.index === k);
      let target: number;
      if (off !== undefined) {
        // The liquor is hottest when the heater goes off, which falls between two readings:
        // take the highest reading within a reading and a half of that moment.
        target = logAt(liquorLog.t_s, liquorLog.values, off.t);
        const n = liquorLog.t_s.length;
        const spacing =
          n > 1 ? ((liquorLog.t_s[n - 1] as number) - (liquorLog.t_s[0] as number)) / (n - 1) : 0;
        liquorLog.t_s.forEach((time, i) => {
          if (Math.abs(time - off.t) <= 1.5 * spacing)
            target = Math.max(target, liquorLog.values[i] as number);
        });
      } else {
        // No heater switching known: the highest reading of the phase of the heat-up, with the
        // nominal times stretched to the measured duration.
        const stretch =
          course.duration_s !== undefined ? course.duration_s / first.totals.duration : 1;
        const phaseEnd = Math.max(
          ...first.segments.filter((s) => s.phase === segment.phase).map((s) => s.end),
        );
        target = -Infinity;
        liquorLog.t_s.forEach((time, i) => {
          if (time >= segment.start * stretch && time <= phaseEnd * stretch) {
            target = Math.max(target, liquorLog.values[i] as number);
          }
        });
      }
      if (Number.isFinite(target)) {
        setHeatTarget(segment.stepId, Math.round(target * 10) / 10, 'temperature_log');
        targetFromLog.add(segment.stepId);
      }
    });
  }

  // 4. Step lengths between the anchors, in order of time.
  const adjustable = (step: ProgrammeStep): boolean =>
    !stated.has(step.id) &&
    (step.kind === 'circulate' || step.kind === 'hold' || step.kind === 'dry') &&
    step.duration !== null;
  let previousSegment = -1;
  for (const anchor of anchors) {
    for (let iteration = 0; iteration < 16; iteration++) {
      const timeline = expand();
      const at = modelAnchor(timeline, anchor.kind, anchor.index);
      if (at === undefined) break;
      const error = anchor.t - at.time;
      if (Math.abs(error) <= ANCHOR_TOLERANCE) break;
      if (anchor.kind === 'heater_off') {
        const segment = timeline.segments[at.segment];
        if (
          segment === undefined ||
          targetFromLog.has(segment.stepId) ||
          stated.has(segment.stepId)
        )
          break;
        // Move the target by the error times the rate of the heat-up.
        const liquor = segment.temperature.liquor;
        const rise = (liquor[liquor.length - 1] as number) - (liquor[0] as number);
        const rate = rise / Math.max(segment.end - segment.start, 1);
        const step = stepOf(segment.stepId);
        if (step?.kind !== 'heat' || !(rate > 0)) break;
        const cutOut = spec.thermal.heaterCutOut ?? Infinity;
        const target = Math.min(cutOut, Math.round((step.target + error * rate) * 100) / 100);
        if (target === step.target) break;
        setHeatTarget(step.id, target, 'event');
        continue;
      }
      // The last step of adjustable length that ends at or before the anchor and after the
      // anchor before it.
      let chosen: ProgrammeStep | undefined;
      for (const segment of timeline.segments) {
        if (segment.index >= at.segment) break;
        if (segment.index < previousSegment) continue;
        const step = stepOf(segment.stepId);
        if (step !== undefined && adjustable(step)) chosen = step;
      }
      if (chosen === undefined || !('duration' in chosen) || chosen.duration === null) {
        notes.push(
          `course: no step of adjustable length before the ${anchor.kind} at ${anchor.t} s; the timeline has it at ${at.time.toFixed(0)} s`,
        );
        break;
      }
      const duration = Math.max(0, Math.round(chosen.duration + error));
      if (duration === chosen.duration) break;
      setDuration(chosen.id, duration, 'event');
    }
    const settled = modelAnchor(expand(), anchor.kind, anchor.index);
    if (settled !== undefined) previousSegment = settled.segment;
  }

  // 5. The total duration, by the last step with a length.
  if (course.duration_s !== undefined) {
    for (let iteration = 0; iteration < 8; iteration++) {
      const timeline = expand();
      const error = course.duration_s - timeline.totals.duration;
      if (Math.abs(error) <= ANCHOR_TOLERANCE) break;
      const last = [...timeline.segments]
        .reverse()
        .find((s) => ['dry', 'hold', 'circulate'].includes(s.kind) && !stated.has(s.stepId));
      if (last === undefined) {
        notes.push('course: no step whose length can absorb the measured total duration');
        break;
      }
      const duration = Math.max(0, Math.round(last.end - last.start + error));
      if (duration === Math.round(last.end - last.start)) break;
      setDuration(last.stepId, duration, 'duration');
    }
  }

  // The comparison of the adapted timeline with the measurements.
  const timeline = expand();
  for (const problem of timeline.problems) {
    notes.push(`adapted programme: ${problem.code} at ${problem.stepId}: ${problem.message}`);
  }
  const check: {
    -readonly [K in keyof CourseCheck]: CourseCheck[K];
  } = {
    anchors: anchors.map((a) => ({
      kind: a.kind,
      measured_s: a.t,
      model_s: modelAnchor(timeline, a.kind, a.index)?.time ?? Number.NaN,
    })),
  };
  if (course.duration_s !== undefined) {
    check.duration = { measured_s: course.duration_s, model_s: timeline.totals.duration };
  }
  if (liquorLog !== undefined && liquorLog.t_s.length > 0) {
    let sum = 0;
    let max = 0;
    let n = 0;
    liquorLog.t_s.forEach((time, i) => {
      const state = timelineStateAt(timeline, time);
      // Readings with no water in the tub say nothing about the liquor.
      if (state === undefined || !(state.segment.liquorVolume.end > 0)) return;
      const d = state.liquorTemperature - (liquorLog.values[i] as number);
      sum += d * d;
      max = Math.max(max, Math.abs(d));
      n++;
    });
    if (n > 0) check.temperature = { readings: n, rms_K: Math.sqrt(sum / n), max_K: max };
  }
  if (course.power_log !== undefined && course.power_log.t_s.length > 1) {
    const { t_s: t, values } = course.power_log;
    let joules = 0;
    for (let i = 1; i < t.length; i++) {
      joules +=
        0.5 *
        ((values[i] as number) + (values[i - 1] as number)) *
        ((t[i] as number) - (t[i - 1] as number));
    }
    check.energy = { measured_kWh: joules / 3.6e6, model_kWh: timeline.totals.energy / 3.6e6 };
  }
  return {
    programme: {
      ...programme,
      id: nominal.id,
      description: `${nominal.description} Adapted to the measured course of wash record ${record.id}.`,
    },
    adapted: changes.length > 0,
    changes,
    check,
    notes,
  };
}

/**
 * The course a timeline would have been measured as: its fills, drains and heater switchings,
 * its liquor temperature every `interval` seconds while there is water in the tub, its mains
 * power at the same times, and its duration. For examples, synthetic records and tests; a real
 * course comes from a plug and a probe.
 */
export function courseOfTimeline(
  timeline: ProgrammeTimeline,
  options: { readonly interval?: number; readonly method?: string } = {},
): RecordCourse {
  const interval = options.interval ?? 60;
  const method = options.method ?? 'model';
  const events: CourseEvent[] = [];
  for (const segment of timeline.segments) {
    if (segment.kind === 'fill' || segment.kind === 'drain') {
      events.push({ kind: segment.kind, t_s: segment.start });
    } else if (segment.kind === 'heat' && segment.end > segment.start) {
      events.push(
        { kind: 'heater_on', t_s: segment.start },
        { kind: 'heater_off', t_s: segment.end },
      );
    }
  }
  const times: number[] = [];
  const temperatures: number[] = [];
  const powerTimes: number[] = [];
  const power: number[] = [];
  for (let t = 0; t < timeline.totals.duration; t += interval) {
    const state = timelineStateAt(timeline, t);
    if (state === undefined) continue;
    powerTimes.push(t);
    power.push(
      (state.heaterOn ? timeline.conditions.heaterPower : 0) + (state.diverter?.pumpPower ?? 0),
    );
    if (state.segment.liquorVolume.end > 0 && state.segment.liquorVolume.start > 0) {
      times.push(t);
      temperatures.push(Math.round(state.liquorTemperature * 10) / 10);
    }
  }
  return {
    duration_s: timeline.totals.duration,
    events,
    temperature_log: { t_s: times, values: temperatures, method, where: 'liquor (sump)' },
    power_log: { t_s: powerTimes, values: power, method },
  };
}
