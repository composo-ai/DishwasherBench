// The hydraulics layer of the first build against the machine package it wraps: the spray
// states of the owner's programme, the flows and jets of each, the closed-form rotation of a
// jet against `nozzleState`, and the schedule against the machine's own timeline.
import {
  armSteadyState,
  BOSCH_SMV4HAX40G,
  getNozzle,
  getSprayArm,
  hydraulicOperatingPoint,
  nozzleState,
  primaryProgramme,
} from '@spotless/machine';
import { createParamSet, createRegistry, SHARED_PARAM_DEFS } from '@spotless/sim-params';
import { describe, expect, it } from 'vitest';
import {
  buildWashHydraulics,
  createJetLaunch,
  HYDRAULICS_PARAM_DEFS,
  jetLaunch,
  spanAt,
  washInstantAt,
  type SprayJet,
  type SprayState,
} from './index.ts';

const spec = BOSCH_SMV4HAX40G;
const programme = primaryProgramme(spec);
const registry = createRegistry({ contributions: [SHARED_PARAM_DEFS, HYDRAULICS_PARAM_DEFS] });
const params = createParamSet(registry);
const hydraulics = buildWashHydraulics({ spec, programme, params });

function stateOf(id: string): SprayState {
  const state = hydraulics.states.find((s) => s.id === id);
  if (state === undefined) throw new Error(`no state ${id}`);
  return state;
}

describe("spray states of the owner's Auto programme", () => {
  it('are the distinct diverter positions and pump speeds, sorted', () => {
    // The Bosch alternates the lower arm (l) with the upper arm and roof spinner (ur), at 2800
    // rev/min in the rinses and 3000 in the main wash.
    expect(hydraulics.states.map((s) => s.id)).toEqual(['l@2800', 'l@3000', 'ur@2800', 'ur@3000']);
    hydraulics.states.forEach((s, i) => expect(s.index).toBe(i));
  });

  it('last as long together as the pump runs', () => {
    const total = hydraulics.states.reduce((sum, s) => sum + s.duration, 0);
    expect(total).toBeCloseTo(hydraulics.schedule.timeline.totals.pumpOnTime, 6);
  });

  it('split the flow of the operating point over jets and showers exactly', () => {
    for (const state of hydraulics.states) {
      const point = hydraulicOperatingPoint(spec, state.position, state.pumpRpm);
      const jets = state.jets.reduce((sum, j) => sum + j.flow, 0);
      const showers = state.showers.reduce((sum, s) => sum + s.flow, 0);
      expect(jets + showers).toBeCloseTo(point.flow, 12);
      expect(state.flow).toBe(point.flow);
    }
  });

  it('take arm speeds from the torque balance and tick with the slowest turning arm', () => {
    const lower = stateOf('l@3000');
    const point = hydraulicOperatingPoint(spec, 'l', 3000);
    const steady = armSteadyState(getSprayArm(spec, 'lower'), point.branches[0]?.armPressure ?? 0);
    expect(lower.arms).toHaveLength(1);
    expect(lower.arms[0]?.omega).toBe(steady.omega);
    expect(lower.arms[0]?.senseSign).toBe(-1); // the owner's lower arm turns clockwise
    expect(lower.period).toBeCloseTo((2 * Math.PI) / steady.omega, 12);
    // About 42 rev/min: a tick of 1.4 s.
    expect(lower.period).toBeGreaterThan(1.2);
    expect(lower.period).toBeLessThan(1.7);
    const upper = stateOf('ur@3000');
    expect(upper.showers).toHaveLength(1);
    expect(upper.showers[0]?.level).toBe('roof');
    expect(upper.arms[0]?.senseSign).toBe(1);
  });

  it('give a round jet the contracted bore diameter d_n sqrt(C_d / C_v)', () => {
    const state = stateOf('l@3000');
    const round = state.jets.filter((j) => j.subJets === 1);
    expect(round.length).toBeGreaterThan(4);
    for (const jet of round) {
      const nozzle = getNozzle(getSprayArm(spec, 'lower'), jet.nozzle);
      if (nozzle.shape !== 'round') continue;
      const bore = nozzle.size[0] ?? 0;
      expect(jet.diameter).toBeCloseTo(bore * Math.sqrt(nozzle.cd / nozzle.cv), 12);
    }
  });

  it('represent a slot by sub-jets of equal flow fanned about the nozzle axis', () => {
    const state = stateOf('l@3000');
    const slotIds = [...new Set(state.jets.filter((j) => j.subJets > 1).map((j) => j.nozzle))];
    expect(slotIds.length).toBeGreaterThan(0);
    for (const id of slotIds) {
      const subs = state.jets.filter((j) => j.nozzle === id);
      const nozzle = getNozzle(getSprayArm(spec, 'lower'), id);
      const fan = nozzle.fan?.angle ?? params.get('hyd.slotFanAngle');
      const first = subs[0] as SprayJet;
      const last = subs[subs.length - 1] as SprayJet;
      expect(subs).toHaveLength(first.subJets);
      // Outermost sub-jets are fan (N - 1) / N apart, and the bundle is centred on the axis.
      const dot =
        first.direction[0] * last.direction[0] +
        first.direction[1] * last.direction[1] +
        first.direction[2] * last.direction[2];
      expect(Math.acos(Math.min(1, dot))).toBeCloseTo((fan * (subs.length - 1)) / subs.length, 9);
      const axis = nozzleState(spec, 'lower', id, 0, 0, first.speed).direction;
      const mean = [0, 1, 2].map((k) => subs.reduce((sum, j) => sum + (j.direction[k] ?? 0), 0));
      const norm = Math.hypot(mean[0] ?? 0, mean[1] ?? 0, mean[2] ?? 0);
      for (let k = 0; k < 3; k++) expect((mean[k] ?? 0) / norm).toBeCloseTo(axis[k] ?? 0, 9);
      // Each sub-jet is the round jet of its share of the flow at the nozzle's jet speed.
      for (const sub of subs) {
        expect(sub.diameter).toBeCloseTo(Math.sqrt((4 * sub.flow) / (Math.PI * sub.speed)), 15);
      }
    }
  });
});

describe('jetLaunch', () => {
  it('equals nozzleState of the machine package at any arm angle', () => {
    const launch = createJetLaunch();
    for (const state of hydraulics.states) {
      for (const jet of state.jets) {
        if (jet.subJets !== 1) continue;
        const arm = state.arms[jet.arm];
        if (arm === undefined) throw new Error('jet without arm');
        for (const angle of [0, 0.7, 2.1, -1.3, 5.9]) {
          const want = nozzleState(spec, jet.level, jet.nozzle, angle, arm.omega, jet.speed);
          jetLaunch(state, jet, angle, launch);
          expect(launch.ox).toBeCloseTo(want.position[0], 12);
          expect(launch.oy).toBeCloseTo(want.position[1], 12);
          expect(launch.oz).toBeCloseTo(want.position[2], 12);
          const speed = Math.hypot(want.velocity[0], want.velocity[1], want.velocity[2]);
          expect(launch.speed).toBeCloseTo(speed, 10);
          expect(launch.dx).toBeCloseTo(want.velocity[0] / speed, 12);
          expect(launch.dy).toBeCloseTo(want.velocity[1] / speed, 12);
          expect(launch.dz).toBeCloseTo(want.velocity[2] / speed, 12);
        }
      }
    }
  });
});

describe('schedule', () => {
  const { schedule } = hydraulics;

  it('covers the programme without gaps: 2 h 25 min', () => {
    expect(schedule.duration).toBe(schedule.timeline.totals.duration);
    expect(schedule.duration / 60).toBeCloseTo(145, 0);
    expect(schedule.spans[0]?.start).toBe(0);
    for (let i = 1; i < schedule.spans.length; i++) {
      expect(schedule.spans[i]?.start).toBe(schedule.spans[i - 1]?.end);
    }
    expect(schedule.spans[schedule.spans.length - 1]?.end).toBe(schedule.duration);
  });

  it('has the pump off in fills, drains and drying, and a spray state in every fed interval', () => {
    for (const span of schedule.spans) {
      if (span.kind === 'fill' || span.kind === 'drain' || span.kind === 'dry') {
        expect(span.state).toBe(-1);
      }
    }
    const fed = schedule.timeline.segments.flatMap((s) => s.diverter);
    const sprayed = schedule.spans.filter((s) => s.state >= 0);
    expect(sprayed.length).toBe(fed.length);
    expect(spanAt(schedule, fed[0]?.start ?? 0).state).toBeGreaterThanOrEqual(0);
  });

  it('reads volume and temperature from the machine timeline', () => {
    const fill = schedule.timeline.segments.find((s) => s.kind === 'fill');
    if (fill === undefined) throw new Error('no fill');
    const mid = washInstantAt(schedule, 0.5 * (fill.start + fill.end));
    expect(mid.liquorVolume).toBeCloseTo(
      0.5 * (fill.liquorVolume.start + fill.liquorVolume.end),
      12,
    );
    const hold = schedule.timeline.segments.find((s) => s.kind === 'hold');
    if (hold === undefined) throw new Error('no hold');
    const at = washInstantAt(schedule, hold.start);
    expect(at.liquorTemperature).toBeCloseTo(hold.temperature.liquor[0] ?? Number.NaN, 9);
    expect(at.span.phase).toBe('main_wash');
  });
});

describe('what the load changes', () => {
  it('keeps the spray states when the load holds water back', () => {
    const held = buildWashHydraulics({ spec, programme, params, heldWater: { trapped: 0.0003 } });
    expect(held.states.map((s) => s.key)).toEqual(hydraulics.states.map((s) => s.key));
  });

  it('gives a pump that runs short of water spray states of its own, at the flow of the timeline', () => {
    // 2.5 L trapped in upright vessels through the first bath (pre-rinse and main wash of the
    // Auto programme share their water): the sump is short, the pump draws air.
    const firstBath = new Set(['a1_fill', 'a2_pre_rinse', 'a3_drain', 'a3_fill', 'a4_dose']);
    const starved = buildWashHydraulics({
      spec,
      programme,
      params,
      heldWater: (step) =>
        firstBath.has(step.stepId) || step.phase === 'pre_rinse' ? { trapped: 0.0033 } : {},
    });
    const problems = starved.schedule.timeline.problems.map((p) => p.code);
    expect(problems).toContain('pump_starved');
    const short = starved.states.filter((s) => s.headFactor < 1);
    expect(short.length).toBeGreaterThan(0);
    const steps = params.get('hyd.primeSteps');
    for (const state of short) {
      // One of the registered steps of the head multiplier, named in the id.
      expect(
        Math.abs(state.headFactor * steps - Math.round(state.headFactor * steps)),
      ).toBeLessThan(1e-9);
      expect(state.id).toBe(
        `${state.position}@${state.pumpRpm}~${Math.round(100 * state.headFactor)}`,
      );
      // Less flow and slower jets than at full prime, and the jets still carry all of it.
      const full = hydraulicOperatingPoint(spec, state.position, state.pumpRpm);
      expect(state.flow).toBeLessThan(full.flow);
      const jets = state.jets.reduce((sum, j) => sum + j.flow, 0);
      const showers = state.showers.reduce((sum, sh) => sum + sh.flow, 0);
      expect(jets + showers).toBeCloseTo(state.flow, 12);
      const primed = stateOf(`${state.position}@${state.pumpRpm}`);
      for (const jet of state.jets) {
        const same = primed.jets.find((j) => j.nozzle === jet.nozzle && j.subJet === jet.subJet);
        if (same !== undefined) expect(jet.speed).toBeLessThan(same.speed);
      }
      // The flow of the state is that of the timeline within one step of the head
      // multiplier (one step of four is at most a quarter of the head).
      const fed = starved.schedule.timeline.segments
        .flatMap((seg) => seg.diverter.map((d) => ({ d, rpm: seg.pumpRpm })))
        .filter((e) => e.d.position === state.position && e.rpm === state.pumpRpm)
        .map((e) => e.d.flow)
        .filter((flow) => flow < full.flow * 0.999);
      expect(fed.length).toBeGreaterThan(0);
      // Some starved flow of the timeline lies within one step of this state: between it and
      // the state of the next step up or down (the test below holds the mixture to the flow).
      const same = [...starved.states, primed].filter(
        (other) => other.position === state.position && other.pumpRpm === state.pumpRpm,
      );
      const brackets = fed.some((flow) =>
        same.some(
          (other) =>
            Math.abs(other.headFactor - state.headFactor) < 1 / steps + 1e-9 &&
            other.headFactor !== state.headFactor &&
            flow >= Math.min(other.flow, state.flow) * (1 - 1e-6) &&
            flow <= Math.max(other.flow, state.flow) * (1 + 1e-6),
        ),
      );
      expect(brackets).toBe(true);
    }
    // The baths after the first one run at full prime, on the states of the unloaded machine.
    const rinse = starved.schedule.spans.filter(
      (span) => span.phase === 'final_rinse' && span.state >= 0,
    );
    expect(rinse.length).toBeGreaterThan(0);
    for (const span of rinse) expect(starved.states[span.state]?.headFactor).toBe(1);
    const total = starved.states.reduce((sum, s) => sum + s.duration, 0);
    expect(total).toBeCloseTo(starved.schedule.timeline.totals.pumpOnTime, 6);
  });

  it('delivers the flow of the timeline through a starved stretch, continuously in the trapped water', () => {
    const firstBath = new Set(['a1_fill', 'a2_pre_rinse', 'a3_drain', 'a3_fill', 'a4_dose']);
    // Water sprayed in the pre-rinse, m3, against the water the load traps, from 0.3 to 3.3 L.
    const sprayed: number[] = [];
    for (let trapped = 0.3e-3; trapped < 3.35e-3; trapped += 0.1e-3) {
      const wash = buildWashHydraulics({
        spec,
        programme,
        params,
        heldWater: (step) =>
          firstBath.has(step.stepId) || step.phase === 'pre_rinse' ? { trapped } : {},
      });
      let volume = 0;
      for (const span of wash.schedule.spans) {
        if (span.state < 0 || span.phase !== 'pre_rinse') continue;
        volume += (wash.states[span.state]?.flow ?? 0) * (span.end - span.start);
      }
      // The same volume as the machine's own timeline pumps in that phase, within 0.1 %.
      let timeline = 0;
      for (const segment of wash.schedule.timeline.segments) {
        if (segment.phase !== 'pre_rinse' || !(segment.pumpRpm > 0)) continue;
        for (const d of segment.diverter) {
          const fed = wash.schedule.spans.some(
            (span) =>
              span.state >= 0 && span.start < d.end && span.end > d.start && span.end > span.start,
          );
          if (fed)
            timeline += d.flow * (Math.min(d.end, segment.end) - Math.max(d.start, segment.start));
        }
      }
      expect(Math.abs(volume - timeline) / timeline).toBeLessThan(1e-3);
      sprayed.push(volume);
    }
    // More trapped water never gives more spray, and no 0.1 L step changes it by more than a
    // tenth of the full amount (rounding the head to quarters switched whole states at once).
    const full = sprayed[0] as number;
    for (let i = 1; i < sprayed.length; i++) {
      expect(sprayed[i] as number).toBeLessThanOrEqual((sprayed[i - 1] as number) * (1 + 1e-9));
      expect(((sprayed[i - 1] as number) - (sprayed[i] as number)) / full).toBeLessThan(0.1);
    }
    expect(sprayed[sprayed.length - 1] as number).toBeLessThan(0.9 * full);
  });

  it('stops an arm the load holds, and ticks at the nominal period when none turns', () => {
    const blocked = buildWashHydraulics({ spec, programme, params, stalledArms: { lower: 1.2 } });
    const state = blocked.states.find((s) => s.id === 'l@3000');
    expect(state?.arms[0]?.stalled).toBe(true);
    expect(state?.arms[0]?.stallAngle).toBe(1.2);
    expect(state?.masterArm).toBe(-1);
    expect(state?.period).toBe(params.get('hyd.nominalPeriod'));
    expect(state?.key).not.toBe(stateOf('l@3000').key);
  });
});

describe('the long soak of Eco 50', () => {
  const eco = spec.programmes.find((p) => p.id === 'eco_50');
  if (eco === undefined) throw new Error('the Bosch has no Eco 50');
  const build = (overrides: Record<string, number> = {}): ReturnType<typeof buildWashHydraulics> =>
    buildWashHydraulics({ spec, programme: eco, params: createParamSet(registry, overrides) });
  /** Seconds each spray state is active in the soak, by position, and the seconds of rest. */
  const soakOf = (
    h: ReturnType<typeof buildWashHydraulics>,
  ): { byPosition: Map<string, number>; sprayed: number; rest: number; rests: number } => {
    const byPosition = new Map<string, number>();
    let sprayed = 0;
    let rest = 0;
    let rests = 0;
    for (const span of h.schedule.spans) {
      if (span.kind !== 'hold' || span.phase !== 'main_wash') continue;
      const length = span.end - span.start;
      const state = h.states[span.state];
      if (state === undefined) {
        rest += length;
        rests++;
        continue;
      }
      sprayed += length;
      byPosition.set(state.position, (byPosition.get(state.position) ?? 0) + length);
    }
    return { byPosition, sprayed, rest, rests };
  };

  it('is circulated throughout at a duty of 1, as the programme writes it', () => {
    const soak = soakOf(build({ 'prog.soakDuty': 1 }));
    expect(soak.sprayed + soak.rest).toBeCloseTo(149 * 60, 6);
    expect(soak.rest).toBeLessThan(1);
  });

  it('is sprayed for eight of every ten minutes by default, both levels alike', () => {
    const continuous = build({ 'prog.soakDuty': 1 });
    const h = build();
    const soak = soakOf(h);
    // The soak is as long as it was and the programme has no gaps.
    expect(soak.sprayed + soak.rest).toBeCloseTo(149 * 60, 6);
    expect(h.schedule.duration).toBe(continuous.schedule.duration);
    for (let i = 1; i < h.schedule.spans.length; i++) {
      expect(h.schedule.spans[i]?.start).toBeCloseTo(h.schedule.spans[i - 1]?.end ?? NaN, 9);
    }
    // Eight tenths of it sprayed (the registered duty since the owner's wash 01), in 15
    // cycles (the last one cut short), each ending in a rest.
    expect(soak.sprayed / (149 * 60)).toBeGreaterThan(0.79);
    expect(soak.sprayed / (149 * 60)).toBeLessThan(0.82);
    expect(soak.rests).toBe(15);
    // The diverter goes on alternating where it stood: the levels share the sprayed time as
    // they do when the pump never rests.
    const shares = [...soak.byPosition.values()].map((seconds) => seconds / soak.sprayed);
    const before = soakOf(continuous);
    const sharesBefore = [...before.byPosition.values()].map((seconds) => seconds / before.sprayed);
    expect(shares.length).toBe(sharesBefore.length);
    shares.forEach((share, i) => expect(share).toBeCloseTo(sharesBefore[i] ?? NaN, 1));
    // The same spray states as without rests: cached exposure serves both.
    expect(h.states.map((s) => s.key)).toEqual(continuous.states.map((s) => s.key));
  });

  it('follows the duty and the cycle it is given', () => {
    // The low end of the registered range (the profile interval of the owner's wash 01).
    const low = soakOf(build({ 'prog.soakDuty': 0.6, 'prog.soakCycle': 1200 }));
    expect(low.sprayed / (149 * 60)).toBeGreaterThan(0.59);
    expect(low.sprayed / (149 * 60)).toBeLessThan(0.63);
    // Seven cycles of 20 min end in a rest; the eighth is cut short while it still sprays.
    expect(low.rests).toBe(7);
    // Below the range a value is refused: a wash cannot be given the contradicted soak.
    expect(() => build({ 'prog.soakDuty': 0.5 })).toThrow();
  });

  it('leaves the 46 min post-wash of Auto 45-65 circulating', () => {
    let rest = 0;
    for (const span of hydraulics.schedule.spans) {
      if (span.kind === 'hold' && span.phase === 'main_wash' && span.state < 0) {
        rest += span.end - span.start;
      }
    }
    expect(rest).toBeLessThan(1);
  });
});
