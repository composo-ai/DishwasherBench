/**
 * Hydraulics of the first build (docs/design/scope.md; docs/design/sim-core.md section M4): a
 * thin layer over `@spotless/machine` that turns a machine, a configuration and a programme
 * into what the rest of the wash simulation reads.
 *
 *  - **Spray states**: the distinct combinations of water-switch (diverter) position, pump
 *    speed and prime that the programme uses. Each carries its coherent jets (origin and
 *    direction as a function of arm angle, flow, speed, diameter), the motion of its arms, the
 *    showers of its fixed sprayers and its total duration in the programme. A stretch in which
 *    the load keeps so much water out of the sump that the pump draws air (the machine's
 *    timeline gives its reduced flow) is a state of its own: the same position and speed at
 *    the two steps of `hyd.primeSteps` about the head multiplier that delivers that flow,
 *    mixed in time so that the flow is the timeline's.
 *  - **The schedule**: which spray state is active when (or that the pump is off), and the
 *    machine's own timeline with the liquor volume and temperature, the heater, fills, drains,
 *    detergent and rinse-aid release.
 *
 * Nothing of the machine's physics is re-implemented here. Operating points come from
 * `hydraulicOperatingPoint`, arm speeds from `armSteadyState`, nozzle positions and directions
 * from `nozzleState`, the programme in time from `expandProgramme`. What this layer adds is
 * bookkeeping: one record per jet, slots as bundles of round sub-jets, and the rotation of a
 * jet about its arm's axis in closed form ({@link jetLaunch}), which a test holds to
 * `nozzleState` at other angles.
 *
 * Conventions (those of `@spotless/machine`, contract-issues.md R1): the arm angle is the
 * azimuth of the "+" blade in the tub frame from +x towards +y, whatever the rotation sense; an
 * arm's speed is non-negative in its own sense and `senseSign` is +1 for counter-clockwise seen
 * from above. A clockwise arm's angle decreases with time.
 *
 * Units: SI (m, s, m3/s, m/s, Pa, rad); pump speeds in rev/min (`pumpRpm`). Frame: tub frame T.
 */

import { canonicalHash, type Vec3 } from '@spotless/core';
import {
  armSteadyState,
  expandProgramme,
  getDiverterPosition,
  HEAD_LOSS_PER_AIR_FRACTION,
  hydraulicOperatingPoint,
  nozzleState,
  timelineStateAt,
  type ExpandOptions,
  type HeldWater,
  type HeldWaterQuery,
  type MachineConfig,
  type MachineSpec,
  type NozzleSpec,
  type ProgrammePhase,
  type ProgrammeSpec,
  type ProgrammeStepKind,
  type ProgrammeTimeline,
  type SprayArmSpec,
} from '@spotless/machine';
import type { ParamSet } from '@spotless/sim-params';
import { resolveHydraulicsParams, type HydraulicsParams } from './params.ts';

/** A rotating spray arm in one spray state. */
export interface SprayArm {
  /** Id of its spray level (`lower`, `upper`). */
  readonly level: string;
  /** Tub-frame (x, y) of its rotation axis, metres. */
  readonly axis: readonly [number, number];
  /** +1 when it turns counter-clockwise seen from above, -1 when clockwise. */
  readonly senseSign: 1 | -1;
  /**
   * Angular speed in its own rotation sense, rad/s; 0 when it does not turn. Negative only for
   * a nozzle table whose jets push the arm against its declared sense.
   */
  readonly omega: number;
  /** Time of one revolution, seconds; 0 when the arm does not turn. */
  readonly period: number;
  /** True when the arm stands still (stalled by friction, or held by the load). */
  readonly stalled: boolean;
  /** Arm angle while it stands still, radians (0 unless the caller gave one). */
  readonly stallAngle: number;
  /** Gauge pressure inside the arm, Pa. */
  readonly armPressure: number;
}

/**
 * One coherent round jet of a spray state: a round nozzle, or one of the sub-jets that
 * represent the fan of a slot (jets dossier section 2.5).
 */
export interface SprayJet {
  /** Id of the spray level and of the nozzle on it. */
  readonly level: string;
  readonly nozzle: string;
  /** Index of the sub-jet within its nozzle (0 for a round nozzle) and their number. */
  readonly subJet: number;
  readonly subJets: number;
  /** Index into `SprayState.arms` of the arm that carries the nozzle. */
  readonly arm: number;
  /** Nozzle exit at arm angle 0, tub frame, metres. */
  readonly origin: Vec3;
  /** Unit direction of the jet relative to the arm at arm angle 0, tub-frame components. */
  readonly direction: Vec3;
  /** Volume flow of the jet, m3/s. */
  readonly flow: number;
  /** Speed of the jet relative to the nozzle, m/s. */
  readonly speed: number;
  /** Diameter of the jet, metres (after contraction; the equivalent round jet of a sub-jet). */
  readonly diameter: number;
}

/** The droplet shower of a fixed sprayer (the Bosch roof spinner) in one spray state. */
export interface SprayShower {
  /** Id of the spray level. */
  readonly level: string;
  /** The outlet, tub frame, metres. */
  readonly origin: Vec3;
  /** Unit axis of the cone the droplets leave in (straight down). */
  readonly axis: Vec3;
  /** Half-angle of that cone, radians. */
  readonly coneHalfAngle: number;
  /** Speed of the droplets leaving the sprayer, m/s. */
  readonly dropletSpeed: number;
  /** Volume flow of the shower, m3/s. */
  readonly flow: number;
}

/** One distinct combination of diverter position and pump speed of a programme. */
export interface SprayState {
  /**
   * Position in `WashHydraulics.states`: states are sorted by position id, then pump speed,
   * then from full prime down.
   */
  readonly index: number;
  /**
   * `<position>@<pumpRpm>`, for example `l@3000`; for a starved pump with the head multiplier
   * in per cent appended, for example `l@3000~50`.
   */
  readonly id: string;
  /** Id of the diverter position. */
  readonly position: string;
  /** Circulation pump speed, rev/min. */
  readonly pumpRpm: number;
  /**
   * Head multiplier of the pump, 0 to 1: 1 with the inlet flooded (full prime), less when the
   * sump is short of water and the pump draws air (`@spotless/machine`, `waterInventory`).
   */
  readonly headFactor: number;
  /** Total circulated flow, m3/s, and pressure rise across the pump, Pa, at that prime. */
  readonly flow: number;
  readonly pumpPressure: number;
  /** The rotating arms fed in this state, in the order of the machine's spray levels. */
  readonly arms: readonly SprayArm[];
  /** The coherent jets, arm by arm, nozzle by nozzle, sub-jet by sub-jet. */
  readonly jets: readonly SprayJet[];
  /** The showers of the fixed sprayers fed in this state. */
  readonly showers: readonly SprayShower[];
  /** Index into `arms` of the slowest turning arm, or -1 when none turns. */
  readonly masterArm: number;
  /**
   * The tick of the replay while this state is active, seconds: one revolution of the master
   * arm, or `hyd.nominalPeriod` when no arm turns.
   */
  readonly period: number;
  /** Total time the state is active in the programme, seconds. */
  readonly duration: number;
  /**
   * `sha256:` hash of everything above except `index` and `duration`: what an exposure of the
   * state depends on.
   */
  readonly key: string;
}

/** A stretch of the programme with one spray state, or with the pump off. */
export interface WashSpan {
  /** Position in `WashSchedule.spans`. */
  readonly index: number;
  /** Seconds from the start of the programme. */
  readonly start: number;
  readonly end: number;
  /** Index into `WashHydraulics.states`, or -1 with the pump off. */
  readonly state: number;
  /** Index of the machine timeline segment the span lies in. */
  readonly segment: number;
  readonly phase: ProgrammePhase;
  readonly kind: ProgrammeStepKind;
  readonly stepId: string;
}

/** A programme in time, as the replay steps through it. */
export interface WashSchedule {
  /** Total running time, seconds. */
  readonly duration: number;
  /** The spans in order, without gaps, from 0 to `duration`. */
  readonly spans: readonly WashSpan[];
  /**
   * The machine's own expansion of the programme: segments with liquor volume and modelled
   * temperatures, heater intervals, and the events (fills, drains, detergent and rinse-aid
   * release, top-ups) with their times, volumes and temperatures.
   */
  readonly timeline: ProgrammeTimeline;
}

/** What the machine is doing at one instant of a schedule. */
export interface WashInstant {
  /** The span that contains the instant. */
  readonly span: WashSpan;
  /** Free water in the tub, m3 (linear within a fill or a drain). */
  readonly liquorVolume: number;
  /** Modelled temperatures of the liquor, the load and the machine, degrees Celsius. */
  readonly liquorTemperature: number;
  readonly loadTemperature: number;
  readonly machineTemperature: number;
  readonly heaterOn: boolean;
}

/** Spray states and schedule of one wash. */
export interface WashHydraulics {
  readonly machineId: string;
  readonly programmeId: string;
  readonly states: readonly SprayState[];
  readonly schedule: WashSchedule;
}

/** What {@link buildWashHydraulics} is given. */
export interface WashHydraulicsInput {
  readonly spec: MachineSpec;
  readonly programme: ProgrammeSpec;
  /** Machine configuration; default: the machine's own. */
  readonly config?: MachineConfig;
  /** Parameter set built on a registry that holds `HYDRAULICS_PARAM_DEFS`. */
  readonly params: ParamSet;
  /**
   * Arms the load holds still, by spray level id, with the arm angle (radians) they stand at.
   * Default: every arm is free.
   */
  readonly stalledArms?: Readonly<Record<string, number>>;
  /**
   * Water the load keeps out of the sump, m3 (`expandProgramme`): one record for the whole
   * programme, or a function of the step. Default none.
   */
  readonly heldWater?: HeldWater | ((step: HeldWaterQuery) => HeldWater);
  /** Heat capacity of the load, J/K; default: the programme's conditions. */
  readonly loadHeatCapacity?: number;
}

const TWO_PI = 2 * Math.PI;

function normalise(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n > 0 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 1];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * The directions of the round sub-jets of a nozzle at arm angle 0. A round nozzle has one, its
 * own. An oblong opening is `count` jets spread evenly over its fan angle in the plane that
 * holds the jet axis and the long axis of the slot (radial, or along the blade's travel).
 */
function subJetDirections(nozzle: NozzleSpec, axis: Vec3, count: number, fanAngle: number): Vec3[] {
  if (count <= 1 || !(fanAngle > 0)) return [axis];
  const blade = nozzle.blade === '-' ? -1 : 1;
  // At arm angle 0 the "+" blade lies along +x: radial is (blade, 0, 0), tangential (0, blade, 0).
  const along: Vec3 = nozzle.slotAxis === 'tangential' ? [0, blade, 0] : [blade, 0, 0];
  let turn = cross(axis, along);
  if (Math.hypot(turn[0], turn[1], turn[2]) < 1e-9) turn = cross(axis, [0, 0, 1]);
  if (Math.hypot(turn[0], turn[1], turn[2]) < 1e-9) return [axis];
  const k = normalise(turn);
  // `side` is the unit vector in the fan plane across the jet axis.
  const side = cross(k, axis);
  const out: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const a = -0.5 * fanAngle + (fanAngle * (i + 0.5)) / count;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.push(
      normalise([c * axis[0] + s * side[0], c * axis[1] + s * side[1], c * axis[2] + s * side[2]]),
    );
  }
  return out;
}

/** Id of a spray state: position and pump speed, with the head multiplier of a starved pump. */
function stateId(positionId: string, pumpRpm: number, headFactor: number): string {
  const base = `${positionId}@${pumpRpm}`;
  return headFactor < 1 ? `${base}~${Math.round(100 * headFactor)}` : base;
}

/** Steps of the bisection for the head multiplier that delivers a flow (a tolerance of 1e-6). */
const PRIME_BISECTION = 20;

/**
 * The head multiplier at which the pump delivers `flow` in a diverter position, 0 to 1: the
 * flow of the operating point falls monotonically with the air the pump draws.
 */
function headFactorForFlow(
  spec: MachineSpec,
  config: MachineConfig,
  positionId: string,
  pumpRpm: number,
  flow: number,
): number {
  const flowAt = (headFactor: number): number =>
    hydraulicOperatingPoint(spec, positionId, pumpRpm, {
      basketHeights: config.basketHeights,
      airFraction: (1 - headFactor) / HEAD_LOSS_PER_AIR_FRACTION,
    }).flow;
  const full = flowAt(1);
  // literal-ok-begin: arithmetic tolerance
  if (!(flow < full * (1 - 1e-6))) return 1;
  // literal-ok-end
  if (!(flow > 0)) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < PRIME_BISECTION; i++) {
    const mid = 0.5 * (lo + hi);
    if (flowAt(mid) < flow) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Flow of a diverter position at a head multiplier of the pump, m3/s. */
function flowAtHeadFactor(
  spec: MachineSpec,
  config: MachineConfig,
  positionId: string,
  pumpRpm: number,
  headFactor: number,
): number {
  return hydraulicOperatingPoint(spec, positionId, pumpRpm, {
    basketHeights: config.basketHeights,
    airFraction: (1 - headFactor) / HEAD_LOSS_PER_AIR_FRACTION,
  }).flow;
}

/**
 * A starved stretch as a mixture in time of the two registered steps of the head multiplier
 * on either side of the exact one: `lower` and `upper` (multipliers) and the share of the
 * time spent at `upper`, chosen so that the mixture delivers `flow`. At full prime both are 1.
 */
function primeMixture(
  spec: MachineSpec,
  config: MachineConfig,
  positionId: string,
  pumpRpm: number,
  flow: number,
  steps: number,
): { readonly lower: number; readonly upper: number; readonly upperShare: number } {
  const exact = headFactorForFlow(spec, config, positionId, pumpRpm, flow);
  if (exact >= 1) return { lower: 1, upper: 1, upperShare: 1 };
  const k = Math.min(steps - 1, Math.floor(exact * steps));
  const lower = k / steps;
  const upper = (k + 1) / steps;
  const below = k === 0 ? 0 : flowAtHeadFactor(spec, config, positionId, pumpRpm, lower);
  const above = flowAtHeadFactor(spec, config, positionId, pumpRpm, upper);
  const upperShare = above > below ? Math.min(1, Math.max(0, (flow - below) / (above - below))) : 1;
  return { lower, upper, upperShare };
}

function buildState(
  spec: MachineSpec,
  config: MachineConfig,
  positionId: string,
  pumpRpm: number,
  headFactor: number,
  hyd: HydraulicsParams,
  stalledArms: Readonly<Record<string, number>>,
): Omit<SprayState, 'index' | 'duration'> {
  const point = hydraulicOperatingPoint(spec, positionId, pumpRpm, {
    basketHeights: config.basketHeights,
    ...(headFactor < 1 ? { airFraction: (1 - headFactor) / HEAD_LOSS_PER_AIR_FRACTION } : {}),
  });
  const arms: SprayArm[] = [];
  const jets: SprayJet[] = [];
  const showers: SprayShower[] = [];
  for (const level of spec.sprayLevels) {
    const branch = point.branches.find((b) => b.id === level.id);
    if (branch === undefined) continue;
    if (level.kind === 'fixed') {
      const first = level.nozzles[0];
      if (first === undefined) continue;
      const at = nozzleState(spec, level.id, first.id, 0, 0, 0, config);
      showers.push({
        level: level.id,
        origin: at.position,
        axis: [0, 0, -1],
        coneHalfAngle: level.spray.coneHalfAngle,
        dropletSpeed: level.spray.dropletSpeed,
        flow: branch.flow,
      });
      continue;
    }
    const arm: SprayArmSpec = level;
    const held = Object.hasOwn(stalledArms, arm.id);
    const steady = armSteadyState(arm, branch.armPressure);
    const omega = held ? 0 : steady.omega;
    const armIndex = arms.length;
    arms.push({
      level: arm.id,
      axis: [arm.axis[0], arm.axis[1]],
      senseSign: arm.sense === 'cw' ? -1 : 1,
      omega,
      period: omega !== 0 ? TWO_PI / Math.abs(omega) : 0,
      stalled: omega === 0,
      stallAngle: held ? (stalledArms[arm.id] ?? 0) : 0,
      armPressure: branch.armPressure,
    });
    for (const nozzle of arm.nozzles) {
      const op = branch.nozzles.find((n) => n.id === nozzle.id);
      if (op === undefined || !(op.flow > 0) || !(op.jetSpeed > 0)) continue;
      const at = nozzleState(spec, arm.id, nozzle.id, 0, 0, op.jetSpeed, config);
      const oblong = nozzle.shape !== 'round';
      const count = oblong ? Math.max(1, Math.round(nozzle.fan?.subJets ?? hyd.slotSubJets)) : 1;
      const fanAngle = oblong ? (nozzle.fan?.angle ?? hyd.slotFanAngle) : 0;
      const directions = subJetDirections(nozzle, at.direction, count, fanAngle);
      const flow = op.flow / directions.length;
      // Conservation of volume gives the diameter of every jet: for a round bore this is
      // d_n sqrt(C_d / C_v), for a sub-jet the equivalent round jet of its share of the flow.
      const diameter = Math.sqrt((4 * flow) / (Math.PI * op.jetSpeed));
      directions.forEach((direction, subJet) => {
        jets.push({
          level: arm.id,
          nozzle: nozzle.id,
          subJet,
          subJets: directions.length,
          arm: armIndex,
          origin: at.position,
          direction,
          flow,
          speed: op.jetSpeed,
          diameter,
        });
      });
    }
  }
  let masterArm = -1;
  for (let i = 0; i < arms.length; i++) {
    const period = (arms[i] as SprayArm).period;
    if (period > 0 && (masterArm < 0 || period > (arms[masterArm] as SprayArm).period)) {
      masterArm = i;
    }
  }
  const period = masterArm >= 0 ? (arms[masterArm] as SprayArm).period : hyd.nominalPeriod;
  const content = {
    id: stateId(positionId, pumpRpm, headFactor),
    position: positionId,
    pumpRpm,
    headFactor,
    flow: point.flow,
    pumpPressure: point.pumpPressure,
    arms,
    jets,
    showers,
    masterArm,
    period,
  };
  return { ...content, key: canonicalHash(content) };
}

/**
 * The spray states and the schedule of a programme on a machine. Pure: the same input gives
 * the same output, and the states (with their keys) do not depend on `heldWater` or
 * `loadHeatCapacity`, which change only the schedule.
 *
 * Simplifications: the head multiplier of a starved stretch is found from the flow the
 * machine's timeline gives for it; every diverter interval of the stretch is then spent partly
 * at the registered step of `hyd.primeSteps` below that multiplier and partly at the step
 * above it (lower first), in the shares that deliver the timeline's flow, so that the water a
 * load receives changes continuously with the water it traps (a pump that surges is two steady
 * states in turn, not a cycle of priming and losing prime); the step 0 is a state without
 * jets; during the seconds in which the diverter moves, the state it moves to counts as active
 * with its full flow.
 */
export function buildWashHydraulics(input: WashHydraulicsInput): WashHydraulics {
  const { spec, programme } = input;
  const config = input.config ?? spec.defaultConfig;
  const hyd = resolveHydraulicsParams(input.params);
  const options: {
    -readonly [K in keyof ExpandOptions]: ExpandOptions[K];
  } = { config };
  if (input.heldWater !== undefined) options.heldWater = input.heldWater;
  if (input.loadHeatCapacity !== undefined) options.loadHeatCapacity = input.loadHeatCapacity;
  const timeline = expandProgramme(spec, programme, options);

  // Spans: the diverter intervals of every segment, with the pump-off stretches between them.
  interface RawSpan {
    start: number;
    end: number;
    position: string | null;
    pumpRpm: number;
    /** Head multiplier of the pump: 1 or one of the steps of `hyd.primeSteps`. */
    headFactor: number;
    segment: number;
  }
  const raw: RawSpan[] = [];
  const push = (span: RawSpan): void => {
    if (!(span.end > span.start)) return;
    const last = raw[raw.length - 1];
    if (
      last !== undefined &&
      last.segment === span.segment &&
      last.position === span.position &&
      last.pumpRpm === span.pumpRpm &&
      last.headFactor === span.headFactor &&
      last.end === span.start
    ) {
      last.end = span.end;
      return;
    }
    raw.push(span);
  };
  // The prime of a stretch: the two steps of the head multiplier about the one that delivers
  // the flow the timeline gives, and the share of the stretch at the upper one.
  const primes = new Map<string, ReturnType<typeof primeMixture>>();
  const primeOf = (
    position: string,
    pumpRpm: number,
    flow: number,
  ): ReturnType<typeof primeMixture> => {
    const key = `${position}|${pumpRpm}|${flow}`;
    let prime = primes.get(key);
    if (prime === undefined) {
      prime = primeMixture(spec, config, position, pumpRpm, flow, hyd.primeSteps);
      primes.set(key, prime);
    }
    return prime;
  };
  // A soak (a long hold of the main wash) is sprayed in cycles: the spans of the segment as
  // the programme writes them are laid out over the first `prog.soakDuty` of every cycle of
  // `prog.soakCycle`, in order, and the pump rests for what is left of the cycle with the
  // diverter where it stood. The spray states are the same; only their times move.
  const allRaw = raw;
  const laidOut = (segment: (typeof timeline.segments)[number], written: RawSpan[]): void => {
    const length = segment.end - segment.start;
    const soak =
      segment.kind === 'hold' &&
      segment.phase === 'main_wash' &&
      length >= hyd.soakFrom &&
      hyd.soakDuty < 1 &&
      hyd.soakCycle > 0;
    if (!soak) {
      for (const span of written) push(span);
      return;
    }
    const on = hyd.soakDuty * hyd.soakCycle;
    const rest = { position: null, pumpRpm: 0, headFactor: 1, segment: segment.index };
    for (let cycle = 0; segment.start + cycle * hyd.soakCycle < segment.end; cycle++) {
      const real = segment.start + cycle * hyd.soakCycle;
      // The stretch of the written spans that is sprayed in this cycle, and where it goes.
      const from = segment.start + cycle * on;
      const to = from + on;
      const shift = real - from;
      const stop = Math.min(real + on, segment.end);
      for (const span of written) {
        const start = Math.max(span.start, from) + shift;
        const end = Math.min(Math.min(span.end, to) + shift, stop);
        push({ ...span, start, end });
      }
      push({ ...rest, start: stop, end: Math.min(real + hyd.soakCycle, segment.end) });
    }
  };
  for (const segment of timeline.segments) {
    const written: RawSpan[] = [];
    const first = allRaw.length;
    let cursor = segment.start;
    const off = { position: null, pumpRpm: 0, headFactor: 1, segment: segment.index };
    for (const interval of segment.diverter) {
      const feeds = getDiverterPosition(spec, interval.position).feeds.length > 0;
      const start = Math.max(interval.start, cursor);
      const end = Math.min(interval.end, segment.end);
      const sprays = feeds && segment.pumpRpm > 0;
      push({ ...off, start: cursor, end: start });
      const span = {
        position: sprays ? interval.position : null,
        pumpRpm: feeds ? segment.pumpRpm : 0,
        segment: segment.index,
      };
      if (!sprays) {
        push({ ...span, start, end, headFactor: 1 });
      } else {
        // A starved interval: first at the lower step, then at the upper one.
        const prime = primeOf(interval.position, segment.pumpRpm, interval.flow);
        const cut = prime.upperShare >= 1 ? start : end - prime.upperShare * (end - start);
        push({ ...span, start, end: cut, headFactor: prime.lower });
        push({ ...span, start: cut, end, headFactor: prime.upper });
      }
      cursor = Math.max(cursor, end);
    }
    push({ ...off, start: cursor, end: segment.end });
    // The spans of the segment as written, taken back and laid out (as they are, or in cycles).
    written.push(...allRaw.splice(first));
    laidOut(segment, written);
  }

  // The distinct states, sorted by position id, pump speed and prime (full prime first).
  const combos = new Map<
    string,
    { position: string; pumpRpm: number; headFactor: number; duration: number }
  >();
  for (const span of raw) {
    if (span.position === null) continue;
    const id = stateId(span.position, span.pumpRpm, span.headFactor);
    const entry = combos.get(id) ?? {
      position: span.position,
      pumpRpm: span.pumpRpm,
      headFactor: span.headFactor,
      duration: 0,
    };
    entry.duration += span.end - span.start;
    combos.set(id, entry);
  }
  const ordered = [...combos.values()].sort((a, b) =>
    a.position < b.position
      ? -1
      : a.position > b.position
        ? 1
        : a.pumpRpm - b.pumpRpm || b.headFactor - a.headFactor,
  );
  const states: SprayState[] = ordered.map((combo, index) => ({
    ...buildState(
      spec,
      config,
      combo.position,
      combo.pumpRpm,
      combo.headFactor,
      hyd,
      input.stalledArms ?? {},
    ),
    index,
    duration: combo.duration,
  }));
  const indexOf = new Map(states.map((s) => [s.id, s.index]));

  const spans: WashSpan[] = raw.map((span, index) => {
    const segment = timeline.segments[span.segment];
    if (segment === undefined) throw new Error('buildWashHydraulics: span without a segment');
    return {
      index,
      start: span.start,
      end: span.end,
      state:
        span.position === null
          ? -1
          : (indexOf.get(stateId(span.position, span.pumpRpm, span.headFactor)) ?? -1),
      segment: span.segment,
      phase: segment.phase,
      kind: segment.kind,
      stepId: segment.stepId,
    };
  });

  return {
    machineId: spec.id,
    programmeId: programme.id,
    states,
    schedule: { duration: timeline.totals.duration, spans, timeline },
  };
}

/** The launch of a jet at one arm angle: {@link jetLaunch} fills it. Tub frame, SI. */
export interface JetLaunch {
  /** Nozzle exit, metres. */
  ox: number;
  oy: number;
  oz: number;
  /** Unit direction of the absolute exit velocity (jet relative to the arm plus the nozzle's own motion). */
  dx: number;
  dy: number;
  dz: number;
  /** Magnitude of the absolute exit velocity, m/s. */
  speed: number;
}

/** A fresh {@link JetLaunch}. */
export function createJetLaunch(): JetLaunch {
  return { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 1, speed: 0 };
}

/**
 * Where a jet leaves and where it goes at arm angle `armAngle` (radians): its record at arm
 * angle 0 turned about the arm's axis, with the velocity of the nozzle added to that of the
 * jet (`nozzleState` of `@spotless/machine`, in closed form). Fills and returns `out`.
 */
export function jetLaunch(
  state: SprayState,
  jet: SprayJet,
  armAngle: number,
  out: JetLaunch,
): JetLaunch {
  const arm = state.arms[jet.arm];
  if (arm === undefined) throw new RangeError(`jetLaunch: jet of ${jet.level} has no arm`);
  const c = Math.cos(armAngle);
  const s = Math.sin(armAngle);
  const rx = jet.origin[0] - arm.axis[0];
  const ry = jet.origin[1] - arm.axis[1];
  const px = c * rx - s * ry;
  const py = s * rx + c * ry;
  out.ox = arm.axis[0] + px;
  out.oy = arm.axis[1] + py;
  out.oz = jet.origin[2];
  const dx = c * jet.direction[0] - s * jet.direction[1];
  const dy = s * jet.direction[0] + c * jet.direction[1];
  // Velocity of the nozzle: omega about +z, counter-clockwise for senseSign +1.
  const w = arm.senseSign * arm.omega;
  const vx = jet.speed * dx - w * py;
  const vy = jet.speed * dy + w * px;
  const vz = jet.speed * jet.direction[2];
  const speed = Math.hypot(vx, vy, vz);
  out.speed = speed;
  out.dx = speed > 0 ? vx / speed : dx;
  out.dy = speed > 0 ? vy / speed : dy;
  out.dz = speed > 0 ? vz / speed : jet.direction[2];
  return out;
}

/** Arm angle (radians) of an arm `time` seconds after it stood at `angle0`. */
export function armAngleAt(arm: SprayArm, time: number, angle0 = 0): number {
  return arm.stalled ? arm.stallAngle : angle0 + arm.senseSign * arm.omega * time;
}

/** The span of a schedule that contains `time` (the last span at or after the end). */
export function spanAt(schedule: WashSchedule, time: number): WashSpan {
  const spans = schedule.spans;
  let lo = 0;
  let hi = spans.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((spans[mid] as WashSpan).end <= time) lo = mid + 1;
    else hi = mid;
  }
  const span = spans[lo];
  if (span === undefined) throw new RangeError('spanAt: the schedule has no span');
  return span;
}

/**
 * What the machine is doing `time` seconds into a schedule: the span, the liquor volume (linear
 * within its segment) and the machine's modelled temperatures (linear between its samples).
 */
export function washInstantAt(schedule: WashSchedule, time: number): WashInstant {
  const span = spanAt(schedule, time);
  const segment = schedule.timeline.segments[span.segment];
  if (segment === undefined) throw new RangeError('washInstantAt: span without a segment');
  const t = Math.min(Math.max(time, segment.start), segment.end);
  const length = segment.end - segment.start;
  const f = length > 0 ? (t - segment.start) / length : 1;
  const state = timelineStateAt(schedule.timeline, Math.min(t, segment.end - 1e-9));
  const last = segment.temperature.liquor.length - 1;
  return {
    span,
    liquorVolume:
      segment.liquorVolume.start + (segment.liquorVolume.end - segment.liquorVolume.start) * f,
    liquorTemperature: state?.liquorTemperature ?? segment.temperature.liquor[last] ?? Number.NaN,
    loadTemperature: state?.loadTemperature ?? segment.temperature.load[last] ?? Number.NaN,
    machineTemperature:
      state?.machineTemperature ?? segment.temperature.machine[last] ?? Number.NaN,
    heaterOn: state?.heaterOn ?? false,
  };
}
