import { describe, expect, it } from 'vitest';
import { hydraulicOperatingPoint } from './hydraulics.ts';
import { primedOperatingPoint } from './inventory.ts';
import { BOSCH_SMV4HAX40G, BOSCH_SMV4HAX40G_DRILL_BORE, primaryProgramme } from './machines.ts';
import type { ProgrammeTimeline } from './programme-types.ts';
import { expandProgramme } from './programme.ts';
import {
  fitStepToTotalDuration,
  sprayTimeByLevel,
  timelineStateAt,
  withRegeneration,
  withStepDuration,
} from './programme-tools.ts';
import { expectNear, expectWithin, must, mutableCopy, toKWh, toLitres } from './test-util.ts';
import type { MachineSpec } from './types.ts';

const MIN = 60;
const ECO = primaryProgramme(BOSCH_SMV4HAX40G);
const TIMELINE = expandProgramme(BOSCH_SMV4HAX40G, ECO);

describe('Eco 50 of the Bosch (sections 4.1, 4.2, 4.5 and 4.7)', () => {
  it('is the primary programme and expands without problems', () => {
    expect(ECO.id).toBe('eco_50');
    expect(TIMELINE.problems).toEqual([]);
  });

  it('runs for its printed 4:55 and draws the 9.5 L of its outline', () => {
    expectNear(TIMELINE.totals.duration / MIN, 295, 2);
    expectNear(toLitres(TIMELINE.totals.mainsWater), 9.5, 1e-9);
    const printedWater = must(must(ECO.declared.printed).mainsWater);
    expectNear(toLitres(printedWater[0]), 9.5, 1e-9);
    expectNear(toLitres(printedWater[1]), 9.5, 1e-9);
    // It leaves the heat exchanger full for the next run.
    expectNear(toLitres(TIMELINE.totals.prestoreVolumeAtEnd), 3.1, 1e-9);
  });

  it('reproduces the water arithmetic of section 4.2 from the steps', () => {
    // "Eco 4.0 + 0.5 + 2.5 + 2.5 = 9.5".
    expectNear(toLitres(TIMELINE.totals.mainsWater), 4.0 + 0.5 + 2.5 + 2.5, 1e-9);
  });

  it("gives the model energy the dossier quotes, above the label's 0.836 kWh", () => {
    // Section 4.5: "0.88 for Eco 50 against the label's 0.836".
    expectNear(toKWh(TIMELINE.totals.energy), 0.88, 0.04);
    expect(toKWh(TIMELINE.totals.energy)).toBeGreaterThan(0.836);
  });

  it('is not moved by the nozzle measurements: the same duration and water with either bore of the lower arm', () => {
    const drill = expandProgramme(BOSCH_SMV4HAX40G_DRILL_BORE, ECO);
    expect(drill.problems).toEqual([]);
    expectNear(drill.totals.duration, TIMELINE.totals.duration, 1);
    expectNear(drill.totals.mainsWater, TIMELINE.totals.mainsWater, 1e-12);
  });

  it('a softener regeneration adds 7 min, 5 L and 0.05 kWh', () => {
    const regen = withRegeneration(BOSCH_SMV4HAX40G, ECO);
    const timeline = expandProgramme(BOSCH_SMV4HAX40G, regen);
    expect(timeline.problems).toEqual([]);
    // The step itself adds exactly 7 min, 5 L and 0.05 kWh; the pause lets the machine cool a
    // little, which lengthens the final heat-up by some seconds and their energy.
    expectNear((timeline.totals.duration - TIMELINE.totals.duration) / MIN, 7, 0.25);
    expect(timeline.totals.duration - TIMELINE.totals.duration).toBeGreaterThanOrEqual(7 * MIN);
    expectNear(toLitres(timeline.totals.mainsWater - TIMELINE.totals.mainsWater), 5, 1e-9);
    expectNear(toKWh(timeline.totals.energy - TIMELINE.totals.energy), 0.05, 0.01);
    expectNear(toKWh(timeline.totals.otherEnergy - TIMELINE.totals.otherEnergy), 0.05, 1e-12);
    const event = must(timeline.events.find((e) => e.kind === 'regeneration'));
    // "takes place before the end of the main rinse cycle": after the hold, before its drain.
    const hold = must(timeline.rows.find((r) => r.row === 'E5'));
    expect(event.time).toBeGreaterThan(hold.start);
    expectNear(must(timeline.rows.find((r) => r.row === 'E6')).start - event.time, 7 * MIN, 1e-9);
    expectNear(regen.declared.duration / MIN, 302, 1e-9);
    // A machine without softener data is left alone.
    const plain = mutableCopy(BOSCH_SMV4HAX40G);
    Reflect.set(plain, 'softener', null);
    expect(withRegeneration(plain, ECO)).toBe(ECO);
  });
});

describe('the diverter pattern resolved into intervals', () => {
  it('alternates lower arm and upper arm with roof spinner every 60 s in the pre-rinse', () => {
    const preRinse = must(TIMELINE.segments.find((s) => s.stepId === 'e2_pre_rinse'));
    // 15 min at L/UR 60/60: fifteen full dwells.
    expect(preRinse.diverter).toHaveLength(15);
    preRinse.diverter.forEach((interval, i) => {
      expect(interval.position).toBe(i % 2 === 0 ? 'l' : 'ur');
      expect(interval.feeds).toEqual(i % 2 === 0 ? ['lower'] : ['upper', 'roof']);
      expectNear(interval.start - preRinse.start, 60 * i, 1e-9);
      expectNear(interval.end - interval.start, 60, 1e-9);
      // The water switch takes 2.5 s to move; it is in place at the start of a pump run.
      expect(interval.transition).toBe(i === 0 ? 0 : 2.5);
      expect(interval.flow).toBeGreaterThan(0);
    });
    expect(must(preRinse.diverter[0]).start).toBe(preRinse.start);
    expect(must(preRinse.diverter[14]).end).toBe(preRinse.end);
  });

  it('keeps alternating across the dispenser release and into the hold', () => {
    const heat = must(TIMELINE.segments.find((s) => s.stepId === 'e4_heat'));
    const hold = must(TIMELINE.segments.find((s) => s.stepId === 'e5_hold'));
    // The alternation runs on from the pre-rinse, whose water is kept: the wash starts on the
    // upper arm, and the dispenser opens after that first dwell, as the diverter turns.
    const release = must(TIMELINE.events.find((e) => e.kind === 'detergent_release'));
    expect(must(heat.diverter[0]).position).toBe('ur');
    expect(must(heat.diverter[1]).position).toBe('l');
    expectNear(release.time, must(heat.diverter[1]).start, 1e-9);
    const all = [...heat.diverter, ...hold.diverter];
    // Joined end to end, every dwell is 60 s except the last, cut by the end of the hold.
    const dwells: number[] = [];
    all.forEach((interval, i) => {
      const previous = all[i - 1];
      if (previous !== undefined && previous.position === interval.position) {
        dwells[dwells.length - 1] =
          must(dwells[dwells.length - 1]) + (interval.end - interval.start);
      } else dwells.push(interval.end - interval.start);
    });
    dwells.slice(0, -1).forEach((d) => expectNear(d, 60, 1e-6));
  });

  it('uses 45 s dwells in the rinses and restarts with the lower arm after a pause', () => {
    const rinse = must(TIMELINE.segments.find((s) => s.stepId === 'e7_rinse'));
    expect(must(rinse.diverter[0]).position).toBe('l');
    expectNear(must(rinse.diverter[0]).end - must(rinse.diverter[0]).start, 45, 1e-9);
    expect(must(rinse.diverter[1]).position).toBe('ur');
    // 7 min at 45 s: nine full dwells and a tenth of 15 s.
    expect(rinse.diverter).toHaveLength(10);
  });

  it('covers exactly the time the pump runs, and feeds both levels about equally', () => {
    for (const segment of TIMELINE.segments) {
      const covered = segment.diverter.reduce((sum, d) => sum + (d.end - d.start), 0);
      expectNear(covered, segment.pumpOnTime, 1e-6, segment.stepId);
      if (segment.pumpRpm === 0) expect(segment.diverter).toEqual([]);
    }
    const byLevel = sprayTimeByLevel(TIMELINE);
    expectNear(must(byLevel['lower']) + must(byLevel['upper']), TIMELINE.totals.pumpOnTime, 1e-6);
    expect(byLevel['upper']).toBe(byLevel['roof']);
    expectNear(must(byLevel['lower']) / TIMELINE.totals.pumpOnTime, 0.5, 0.02);
  });
});

describe('expandProgramme: properties of any timeline', () => {
  const timelines: readonly (readonly [string, ProgrammeTimeline])[] = [
    ...BOSCH_SMV4HAX40G.programmes.map(
      (p) => [`bosch ${p.id}`, expandProgramme(BOSCH_SMV4HAX40G, p)] as const,
    ),
  ];

  it.each(timelines)(
    '%s: segments are contiguous, ordered and consistent with the totals',
    (_name, timeline) => {
      expect(timeline.problems).toEqual([]);
      let clock = 0;
      let mains = 0;
      let heater = 0;
      let pump = 0;
      timeline.segments.forEach((segment, i) => {
        expect(segment.index).toBe(i);
        expect(segment.start).toBe(clock);
        expect(segment.end).toBeGreaterThan(segment.start);
        clock = segment.end;
        mains += segment.mainsWater;
        heater += segment.heaterEnergy;
        pump += segment.pumpEnergy;
        // The volumes carry over from one segment to the next.
        const next = timeline.segments[i + 1];
        if (next !== undefined) {
          expect(next.prestoreVolume.start).toBeCloseTo(segment.prestoreVolume.end, 12);
        }
        // Temperature samples start at the start, end at the end, and are in order.
        const t = segment.temperature.time;
        expect(t[0]).toBe(segment.start);
        expect(t[t.length - 1]).toBe(segment.end);
        for (let k = 1; k < t.length; k++) expect(must(t[k])).toBeGreaterThan(must(t[k - 1]));
        expect(segment.temperature.liquor).toHaveLength(t.length);
        expect(segment.temperature.load).toHaveLength(t.length);
        expect(segment.temperature.machine).toHaveLength(t.length);
        expect(segment.temperature.prestore).toHaveLength(t.length);
        // Heater only with the pump running; events inside the segment.
        for (const interval of segment.heater) {
          expect(
            segment.diverter.some((d) => d.start <= interval.start && d.end > interval.start),
          ).toBe(true);
        }
        for (const event of segment.events) {
          expect(event.time).toBeGreaterThanOrEqual(segment.start);
          expect(event.time).toBeLessThanOrEqual(segment.end);
        }
      });
      expect(clock).toBe(timeline.totals.duration);
      expectNear(mains, timeline.totals.mainsWater, 1e-12);
      expectWithin(heater, timeline.totals.heaterEnergy, 1e-12);
      expectWithin(pump, timeline.totals.pumpEnergy, 1e-12);
      // Every event is in exactly one segment (none falls after the last step here).
      const inSegments = timeline.segments.reduce((sum, s) => sum + s.events.length, 0);
      expect(inSegments).toBe(timeline.events.length);
      for (let k = 1; k < timeline.events.length; k++) {
        expect(must(timeline.events[k]).time).toBeGreaterThanOrEqual(
          must(timeline.events[k - 1]).time,
        );
      }
      // The machine ends drained.
      expect(
        must(timeline.segments[timeline.segments.length - 1]).liquorVolume.end,
      ).toBeLessThanOrEqual(0.4e-3 + 1e-12);
    },
  );

  it('is deterministic and survives JSON unchanged', () => {
    const again = expandProgramme(BOSCH_SMV4HAX40G, ECO);
    expect(again).toEqual(TIMELINE);
    expect(JSON.stringify(again)).toBe(JSON.stringify(TIMELINE));
    expect(JSON.parse(JSON.stringify(TIMELINE))).toEqual(TIMELINE);
  });

  it('hardly depends on the integration step', () => {
    const fine = expandProgramme(BOSCH_SMV4HAX40G, ECO, { timeStep: 0.25 });
    expectNear(fine.totals.duration, TIMELINE.totals.duration, 5);
    expectWithin(fine.totals.energy, TIMELINE.totals.energy, 0.003);
    expectNear(
      must(fine.rows.find((r) => r.row === 'E5')).liquorTemperatureAtEnd,
      must(TIMELINE.rows.find((r) => r.row === 'E5')).liquorTemperatureAtEnd,
      0.05,
    );
    expect(() => expandProgramme(BOSCH_SMV4HAX40G, ECO, { timeStep: 0 })).toThrow(RangeError);
  });

  it('samples the temperatures every sample interval', () => {
    const coarse = expandProgramme(BOSCH_SMV4HAX40G, ECO, { sampleInterval: 60 });
    const hold = must(coarse.segments.find((s) => s.stepId === 'e5_hold'));
    // 149 min: the start, 149 whole minutes.
    expect(hold.temperature.time).toHaveLength(150);
    expectNear(must(hold.temperature.time[1]) - must(hold.temperature.time[0]), 60, 1e-9);
    expect(coarse.totals).toEqual(TIMELINE.totals);
  });

  it('moves the upper branch with the configured Rackmatic level', () => {
    const at = (level: string) =>
      expandProgramme(BOSCH_SMV4HAX40G, ECO, {
        config: { ...BOSCH_SMV4HAX40G.defaultConfig, basketHeights: { upper: level } },
      });
    const flow = (timeline: ProgrammeTimeline) =>
      must(must(timeline.segments.find((s) => s.stepId === 'e2_pre_rinse')).diverter[1]).flow;
    expect(flow(at('3'))).toBeGreaterThan(flow(at('1')));
    expect(at('1').conditions.basketHeights).toEqual({ upper: '1' });
    expect(TIMELINE.conditions.basketHeights).toEqual({ upper: '1' });
  });

  it('reports what does not add up instead of throwing', () => {
    // Twice the tank's content drawn for the first fill.
    const greedy = mutableCopy(ECO);
    const fill = must(greedy.steps.find((s) => s.id === 'e1_fill'));
    if (fill.kind !== 'fill') throw new Error('not a fill');
    must(fill.sources[0]).volume = 6.2e-3;
    expect(expandProgramme(BOSCH_SMV4HAX40G, greedy).problems.map((p) => p.code)).toContain(
      'prestore_underflow',
    );

    // A heater too weak to reach the target in two hours.
    const weak: MachineSpec = {
      ...BOSCH_SMV4HAX40G,
      thermal: { ...BOSCH_SMV4HAX40G.thermal, heaterPower: 150 },
    };
    const cold = expandProgramme(weak, ECO);
    expect(cold.problems.map((p) => p.code)).toContain('heat_timeout');
    expect(must(cold.problems.find((p) => p.code === 'heat_timeout')).stepId).toBe('e4_heat');

    // A first bath too small to keep the pump primed.
    const dry = mutableCopy(ECO);
    const small = must(dry.steps.find((s) => s.id === 'e1_fill'));
    if (small.kind !== 'fill') throw new Error('not a fill');
    must(small.sources[0]).volume = 0.3e-3;
    must(small.sources[1]).volume = 0.3e-3;
    const starved = expandProgramme(BOSCH_SMV4HAX40G, dry);
    expect(starved.problems.map((p) => p.code)).toContain('pump_starved');

    // The tank overfilled.
    const over = mutableCopy(ECO);
    const hold = must(over.steps.find((s) => s.id === 'e5_hold'));
    if (hold.kind !== 'hold') throw new Error('not a hold');
    must(hold.prestoreFills[0]).volume = 3.5e-3;
    expect(expandProgramme(BOSCH_SMV4HAX40G, over).problems.map((p) => p.code)).toContain(
      'prestore_overflow',
    );

    // Pre-stored water on a machine without a tank, and a partial drain of more than there is.
    const tankless = mutableCopy(BOSCH_SMV4HAX40G);
    tankless.hydraulics.fill.prestoreVolume = null;
    expect(expandProgramme(tankless, ECO).problems.map((p) => p.code)).toContain(
      'no_prestore_tank',
    );
    const deep = mutableCopy(ECO);
    const drain = must(deep.steps.find((s) => s.id === 'e6_drain'));
    if (drain.kind !== 'drain') throw new Error('not a drain');
    drain.volume = 9e-3;
    expect(expandProgramme(BOSCH_SMV4HAX40G, deep).problems.map((p) => p.code)).toContain(
      'drain_exceeds_content',
    );
  });

  it('runs a starved pump at its air-derated point and keeps the heater off (machine.md 12.2 items 4 and 6)', () => {
    // The first bath cut to 1.6 L (0.7 L from the tank, 0.9 L of mains water), which the
    // pre-rinse and the wash share. The machine is one that cannot top up (the Bosch itself
    // would let in 0.5 L: see the top-up tests).
    const dry = mutableCopy(ECO);
    const fill = must(dry.steps.find((s) => s.id === 'e1_fill'));
    if (fill.kind !== 'fill') throw new Error('not a fill');
    must(fill.sources[0]).volume = 0.7e-3;
    const noTopUp = mutableCopy(BOSCH_SMV4HAX40G);
    noTopUp.hydraulics.inventory.maxTopUpsPerPhase = 0;
    const timeline = expandProgramme(noTopUp, dry);
    const heat = must(timeline.segments.find((s) => s.stepId === 'e4_heat'));
    expectNear(heat.liquorVolume.start, 1.6e-3, 1e-9, 'bath volume');

    const inventory = BOSCH_SMV4HAX40G.hydraulics.inventory;
    const pipes = must(
      BOSCH_SMV4HAX40G.hydraulics.branches.find((b) => b.id === 'lower'),
    ).pipeVolume;
    const full = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000);
    // At the full 30.5 L/min of the owner update (the dossier had 27.9) the sump would hold
    // 1.6 - 0.25 - 30.5/60 x 2.0 s = 0.333 L < 0.5 L.
    const sumpAtFullFlow =
      1.6e-3 - pipes - full.flow * (inventory.flightTime + inventory.returnTime);
    expectNear(sumpAtFullFlow, 0.333e-3, 0.002e-3, 'sump at the full flow');
    expect(sumpAtFullFlow).toBeLessThan(inventory.minSumpVolume);

    // The timeline's flow is the fixed point: the air fraction that its own sump volume gives
    // reproduces it through the pump curve (checked here through the plain operating point).
    const lower = must(heat.diverter.find((d) => d.position === 'l'));
    expect(lower.flow).toBeLessThan(full.flow);
    expect(lower.flow).toBeGreaterThan(0.8 * full.flow);
    const sump = 1.6e-3 - pipes - lower.flow * (inventory.flightTime + inventory.returnTime);
    const airFraction = 1 - sump / inventory.minSumpVolume;
    // It lies below the air fraction the full flow would give, 1 - 0.333 / 0.5 = 0.33.
    expect(airFraction).toBeGreaterThan(0);
    expect(airFraction).toBeLessThan(1 - 0.333 / 0.5);
    const derated = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000, { airFraction });
    expectWithin(derated.flow, lower.flow, 1e-6, 'fixed point of flow and air fraction');
    expectWithin(lower.pumpPower, derated.electricalPower, 1e-6, 'pump power at the starved point');
    expect(lower.pumpPower).toBeLessThan(full.electricalPower);

    // Reported once per starved step, with the heater off throughout: the wash never reaches
    // 50 C, the heat step runs into its 120 min timeout and only the pump warms the water.
    const starvedSteps = timeline.problems
      .filter((p) => p.code === 'pump_starved')
      .map((p) => p.stepId);
    expect(starvedSteps).toEqual(['e2_pre_rinse', 'e4_heat', 'e5_hold']);
    expect(timeline.problems.filter((p) => p.code === 'heat_timeout').map((p) => p.stepId)).toEqual(
      ['e4_heat'],
    );
    expect(heat.heater).toEqual([]);
    expect(heat.heaterEnergy).toBe(0);
    expectNear(heat.end - heat.start, 120 * MIN, 1e-6, 'timeout');
    expect(must(heat.temperature.liquor[heat.temperature.liquor.length - 1])).toBeLessThan(40);
    // The other state of the wash, upper arm with roof spinner, is starved as well (0.5 L in
    // its pipes): 1.6 - 0.5 - 28.4/60 x 2.0 s = 0.15 L at the full flow.
    const upperRoof = must(heat.diverter.find((d) => d.position === 'ur'));
    expect(upperRoof.flow).toBeLessThan(hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'ur', 3000).flow);
    // The rinses, with their full 2.9 L, are primed and heated as before.
    const final = must(timeline.segments.find((s) => s.stepId === 'e10_heat'));
    expect(final.heaterEnergy).toBeGreaterThan(0);
    expect(
      timeline.problems.some((p) => p.stepId.startsWith('a9') || p.stepId.startsWith('a10')),
    ).toBe(false);
  });
});

describe('programme tools', () => {
  it('fits a hold to a total running time', () => {
    const shorter = fitStepToTotalDuration(BOSCH_SMV4HAX40G, ECO, 'e5_hold', 280 * MIN);
    const timeline = expandProgramme(BOSCH_SMV4HAX40G, shorter);
    expectNear(timeline.totals.duration, 280 * MIN, 0.5);
    const hold = must(shorter.steps.find((s) => s.id === 'e5_hold'));
    if (hold.kind !== 'hold') throw new Error('not a hold');
    // 15 min less in total needs about 15 min less hold.
    expectNear(hold.duration / MIN, 134, 0.5);
    expect(() => fitStepToTotalDuration(BOSCH_SMV4HAX40G, ECO, 'e5_hold', 60 * MIN)).toThrow(
      RangeError,
    );
    expect(() => fitStepToTotalDuration(BOSCH_SMV4HAX40G, ECO, 'e4_dose', 295 * MIN)).toThrow(
      RangeError,
    );
    expect(() => fitStepToTotalDuration(BOSCH_SMV4HAX40G, ECO, 'e4_heat', 295 * MIN)).toThrow(
      RangeError,
    );
  });

  it('retimes one step and leaves the programme it was given untouched', () => {
    const longer = withStepDuration(ECO, 'e13_dry', 100 * MIN);
    const before = must(ECO.steps.find((s) => s.id === 'e13_dry'));
    const after = must(longer.steps.find((s) => s.id === 'e13_dry'));
    if (before.kind !== 'dry' || after.kind !== 'dry') throw new Error('not a dry step');
    // Eco 50 gives its drying step its own length, 90 min.
    expect(before.duration).toBe(90 * MIN);
    expect(after.duration).toBe(100 * MIN);
    expectNear(
      expandProgramme(BOSCH_SMV4HAX40G, longer).totals.duration - TIMELINE.totals.duration,
      10 * MIN,
      1e-9,
    );
    expect(() => withStepDuration(ECO, 'nope', 1)).toThrow(RangeError);
    expect(() => withStepDuration(ECO, 'e4_dose', 1)).toThrow(RangeError);
  });

  it('reads the state of the machine at a time', () => {
    expect(timelineStateAt(TIMELINE, -1)).toBeUndefined();
    expect(timelineStateAt(TIMELINE, TIMELINE.totals.duration)).toBeUndefined();
    // 0:20: in the heat-up, heater on, 3000 rpm, the load a little behind the liquor.
    const heating = must(timelineStateAt(TIMELINE, 20 * MIN));
    expect(heating.segment.row).toBe('E4');
    expect(heating.heaterOn).toBe(true);
    expect(heating.segment.pumpRpm).toBe(3000);
    expect(heating.liquorTemperature).toBeGreaterThan(heating.loadTemperature);
    expect(heating.liquorTemperature).toBeLessThan(50);
    // 0:50: in the soak, heater off, the liquor a little under the 50 C it was heated to.
    const holding = must(timelineStateAt(TIMELINE, 50 * MIN));
    expect(holding.segment.row).toBe('E5');
    expect(holding.heaterOn).toBe(false);
    expect(holding.liquorTemperature).toBeLessThan(50);
    expect(holding.liquorTemperature).toBeGreaterThan(45);
    // 4:00: drying, nothing fed.
    const drying = must(timelineStateAt(TIMELINE, 240 * MIN));
    expect(drying.segment.kind).toBe('dry');
    expect(drying.diverter).toBeNull();
  });
});

describe('the machine is the single source of what every programme shares', () => {
  // A calibrator changes one value of the machine and re-expands: the timeline must follow.
  const changed = (edit: (spec: ReturnType<typeof mutableCopy<MachineSpec>>) => void) => {
    const spec = mutableCopy(BOSCH_SMV4HAX40G);
    edit(spec);
    return expandProgramme(spec, primaryProgramme(spec));
  };
  const eventTime = (timeline: ProgrammeTimeline, kind: string): number =>
    must(timeline.events.find((e) => e.kind === kind)).time;

  it('opens the dispenser after dosing.detergentReleaseDelay of main-wash circulation', () => {
    const start = must(TIMELINE.segments.find((s) => s.stepId === 'e4_heat')).start;
    expectNear(eventTime(TIMELINE, 'detergent_release') - start, 60, 1e-9);
    const late = changed((spec) => {
      spec.dosing.detergentReleaseDelay = 300;
    });
    expectNear(eventTime(late, 'detergent_release') - start, 300, 1e-9);
    // A delay that is not a whole number of time steps is honoured to the second fraction.
    const odd = changed((spec) => {
      spec.dosing.detergentReleaseDelay = 90.5;
    });
    expectNear(eventTime(odd, 'detergent_release') - start, 90.5, 1e-9);
    // The step lengths do not depend on when the lid opens.
    expectNear(late.totals.duration, TIMELINE.totals.duration, 1e-9);
  });

  it('releases the mass of dosing.detergentMass and the volume of dosing.rinseAidVolume', () => {
    const timeline = changed((spec) => {
      spec.dosing.detergentMass = 0.035;
      spec.dosing.rinseAidVolume = 3e-6;
    });
    const release = must(timeline.events.find((e) => e.kind === 'detergent_release'));
    const dose = must(timeline.events.find((e) => e.kind === 'rinse_aid_release'));
    if (release.kind !== 'detergent_release' || dose.kind !== 'rinse_aid_release') {
      throw new Error('wrong events');
    }
    expectNear(release.mass, 0.035, 1e-12);
    expectNear(dose.volume, 3e-6, 1e-15);
  });

  it('doses rinse aid after dosing.rinseAidDelay and not below dosing.rinseAidMinTemperature', () => {
    const start = must(TIMELINE.segments.find((s) => s.stepId === 'e9_circulate')).start;
    const late = changed((spec) => {
      spec.dosing.rinseAidDelay = 80;
      spec.dosing.rinseAidMinTemperature = 20;
    });
    expectNear(eventTime(late, 'rinse_aid_release') - start, 80, 1e-9);
    // A minimum of 60 C is not met when the delay has passed (the liquor is at about 35 C): the
    // dose waits for the heat-up to reach it.
    const hot = changed((spec) => {
      spec.dosing.rinseAidMinTemperature = 60;
    });
    const dose = must(hot.events.find((e) => e.kind === 'rinse_aid_release'));
    if (dose.kind !== 'rinse_aid_release') throw new Error('not a rinse-aid release');
    expect(dose.time - start).toBeGreaterThan(5 * MIN);
    expect(dose.temperature).toBeGreaterThanOrEqual(60);
    expect(dose.temperature).toBeLessThan(60.1);
    expect(must(timelineStateAt(hot, dose.time)).segment.stepId).toBe('e10_heat');
    // A minimum that the final rinse never reaches: nothing is dosed, and the timeline says so.
    const never = changed((spec) => {
      spec.dosing.rinseAidMinTemperature = 75;
    });
    expect(never.events.some((e) => e.kind === 'rinse_aid_release')).toBe(false);
    expect(never.problems.map((p) => `${p.code}:${p.stepId}`)).toContain(
      'dose_not_released:e9_rinse_aid',
    );
  });

  it('never heats beyond thermal.heaterCutOut and reports a target above it', () => {
    const timeline = changed((spec) => {
      spec.thermal.heaterCutOut = 45;
    });
    const peak = Math.max(...timeline.segments.flatMap((s) => [...s.temperature.liquor]));
    expect(peak).toBeLessThan(45.1);
    expect(peak).toBeGreaterThanOrEqual(45);
    const codes = timeline.problems.map((p) => `${p.code}:${p.stepId}`);
    expect(codes).toContain('target_above_cut_out:e4_heat');
    expect(codes).toContain('target_above_cut_out:e10_heat');
    // The heat steps end at the cut-out instead of running into their timeout.
    expect(timeline.problems.some((p) => p.code === 'heat_timeout')).toBe(false);
    expect(timeline.totals.heaterEnergy).toBeLessThan(0.75 * TIMELINE.totals.heaterEnergy);
    // The shipped machine heats to 50 and 61 C under a cut-out of 75 C: nothing to report.
    expect(TIMELINE.problems).toEqual([]);
  });

  it('takes as long over a fill as fill.inletFlow needs, and at least the length of its row', () => {
    const fillOf = (timeline: ProgrammeTimeline, stepId: string) =>
      must(timeline.segments.find((s) => s.stepId === stepId));
    // The filter flush: 0.5 L at 2.5 L/min is 12 s; its row allows 30 s.
    const normal = fillOf(TIMELINE, 'e7_flush_fill');
    expectNear(normal.end - normal.start, 30, 1e-9);
    // At 0.5 L/min the same 0.5 L take 60 s, and the first fill's 0.9 L of mains water 108 s.
    const slow = changed((spec) => {
      spec.hydraulics.fill.inletFlow = 0.5 / 60000;
    });
    expectNear(fillOf(slow, 'e7_flush_fill').end - fillOf(slow, 'e7_flush_fill').start, 60, 1e-6);
    expectNear(fillOf(slow, 'e1_fill').end - fillOf(slow, 'e1_fill').start, 108, 1e-6);
    expect(slow.totals.duration - TIMELINE.totals.duration).toBeGreaterThan(70);
    // A slower tank discharge lengthens the transfers of the rinses: 2.5 L at 2.5 L/min, 60 s.
    const slowTank = changed((spec) => {
      spec.hydraulics.fill.prestoreDischargeFlow = 2.5 / 60000;
    });
    expectNear(fillOf(slowTank, 'e9_fill').end - fillOf(slowTank, 'e9_fill').start, 60, 1e-6);
  });

  it('takes as long over a drain as drain.flow needs, and at least the length of its step', () => {
    const drainOf = (timeline: ProgrammeTimeline) =>
      must(timeline.segments.find((s) => s.stepId === 'e6_drain'));
    expectNear(drainOf(TIMELINE).end - drainOf(TIMELINE).start, 90, 1e-9);
    // 4.0 L less the 0.4 L carry-over at 1 L/min: 216 s.
    const slow = changed((spec) => {
      spec.hydraulics.drain.flow = 1 / 60000;
    });
    expectNear(drainOf(slow).end - drainOf(slow).start, 216, 1e-6);
  });

  it('runs the wash in hydraulics.diverter.defaultPattern and dries for drying.defaultDuration', () => {
    const wash = must(ECO.steps.find((s) => s.id === 'e4_heat'));
    if (wash.kind !== 'heat') throw new Error('not a heat step');
    expect(wash.diverter).toBeNull();
    const timeline = changed((spec) => {
      spec.hydraulics.diverter.defaultPattern = {
        phases: [
          { position: 'ur', duration: 30 },
          { position: 'l', duration: 90 },
        ],
      };
      spec.drying.defaultDuration = 55 * MIN;
    });
    const preRinse = must(timeline.segments.find((s) => s.stepId === 'e2_pre_rinse'));
    expect(preRinse.diverter.slice(0, 3).map((d) => [d.position, d.end - d.start])).toEqual([
      ['ur', 30],
      ['l', 90],
      ['ur', 30],
    ]);
    // The rinses keep the pattern their steps fix (45 s dwells).
    const rinse = must(timeline.segments.find((s) => s.stepId === 'e7_rinse'));
    expectNear(must(rinse.diverter[0]).end - must(rinse.diverter[0]).start, 45, 1e-9);
    // Eco 50's drying step has a length of its own; one without takes the machine's default.
    expectNear(
      must(timeline.segments.find((s) => s.kind === 'dry')).end -
        must(timeline.segments.find((s) => s.kind === 'dry')).start,
      90 * MIN,
      1e-9,
    );
    const unset = mutableCopy(ECO);
    const dryStep = must(unset.steps.find((s) => s.kind === 'dry'));
    if (dryStep.kind !== 'dry') throw new Error('not a dry step');
    dryStep.duration = null;
    const defaultSpec = mutableCopy(BOSCH_SMV4HAX40G);
    defaultSpec.drying.defaultDuration = 55 * MIN;
    const dry = must(expandProgramme(defaultSpec, unset).segments.find((s) => s.kind === 'dry'));
    expectNear(dry.end - dry.start, 55 * MIN, 1e-9);
    // The tank is still filled at 5, 30 and 55 % of the drying step.
    const fills = expandProgramme(defaultSpec, unset).events.filter(
      (e) => e.kind === 'prestore_fill' && e.stepId === dry.stepId,
    );
    expect(fills.map((e) => (e.time - dry.start) / (dry.end - dry.start))).toEqual([
      0.05, 0.3, 0.55,
    ]);
  });

  it('passes less water and draws less power while the diverter moves (transitionTime)', () => {
    // Pump energy falls as the transition lengthens; with none it is the sum over the dwells.
    const energy = (transition: number) =>
      changed((spec) => {
        spec.hydraulics.diverter.transitionTime = transition;
      }).totals.pumpEnergy;
    expect(energy(0)).toBeGreaterThan(energy(2.5));
    expect(energy(2.5)).toBeGreaterThan(energy(10));
    expectNear(energy(2.5), TIMELINE.totals.pumpEnergy, 1e-9);
    // For a transition of 10 s the deficit is that of branches opening linearly: at mean
    // opening 0.5 over 10 s, against 2.5 s, about four times as much.
    const deficit = (transition: number) => energy(0) - energy(transition);
    expectNear(deficit(10) / deficit(2.5), 4, 0.8);
  });

  it('holds the changed carry-over as before (the control of the comparison)', () => {
    const timeline = changed((spec) => {
      spec.hydraulics.inventory.carryOver = 0.6e-3;
    });
    expect(timeline.totals.heaterEnergy).not.toBe(TIMELINE.totals.heaterEnergy);
  });
});

describe('water held by the load, the level check and the top-up (machine.md 4.5; dossier 3.5, 4.3 row D4)', () => {
  const inventory = BOSCH_SMV4HAX40G.hydraulics.inventory;

  it('checks the level in the pre-rinse and the wash only, with one top-up of 0.5 L per phase', () => {
    expect(inventory.levelCheckIn).toEqual(['pre_rinse', 'main_wash']);
    expect(inventory.maxTopUpsPerPhase).toBe(1);
    expectNear(inventory.topUpVolume, 0.5e-3, 1e-12);
  });

  it('draws no top-up and reports nothing with an empty load', () => {
    expect(TIMELINE.events.some((e) => e.kind === 'top_up')).toBe(false);
    expect(TIMELINE.segments.every((s) => s.heldWater === 0)).toBe(true);
  });

  it('tops up once in the wash when 1 L is trapped there, and does not starve', () => {
    // The wash bath is 4.0 L. In position UR at 3000 rpm the pipes hold 0.5 L and 28.4 L/min is
    // 0.95 L in flight and on the load: 2.55 L in the sump, 1.55 L with 1 L trapped, still above
    // the 0.5 L the pump needs. So 1 L is survivable in the wash without help (dossier 3.5),
    // and a top-up is drawn only when the sump actually runs short: here with 2.2 L trapped.
    const survivable = expandProgramme(BOSCH_SMV4HAX40G, ECO, {
      heldWater: (step) => (step.phase === 'main_wash' ? { trapped: 1.0e-3 } : {}),
    });
    expect(survivable.problems).toEqual([]);
    expect(survivable.events.some((e) => e.kind === 'top_up')).toBe(false);

    const trapped = 2.2e-3;
    const timeline = expandProgramme(BOSCH_SMV4HAX40G, ECO, {
      heldWater: (step) => (step.phase === 'main_wash' ? { trapped } : {}),
    });
    const topUps = timeline.events.filter((e) => e.kind === 'top_up');
    expect(topUps).toHaveLength(1);
    const topUp = must(topUps[0]);
    if (topUp.kind !== 'top_up') throw new Error('not a top-up');
    expectNear(topUp.volume, 0.5e-3, 1e-12);
    expectNear(topUp.liquorVolume, 4.5e-3, 1e-9);
    // It is drawn when the wash circulation starts, and it is mains water.
    const heat = must(timeline.segments.find((s) => s.stepId === 'e4_heat'));
    expect(topUp.time).toBeGreaterThanOrEqual(heat.start);
    expect(topUp.time).toBeLessThan(heat.start + 2 * MIN);
    expectNear(toLitres(timeline.totals.mainsWater), 9.5 + 0.5, 1e-6);
    expectNear(heat.heldWater, trapped, 1e-12);
    // With it the sump is long enough in both states, by the inventory done by hand:
    // 4.5 - 2.2 - pipes - Q (t_flight + t_return) >= 0.5 L.
    for (const position of ['l', 'ur']) {
      const point = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, position, 3000);
      const pipes = BOSCH_SMV4HAX40G.hydraulics.branches
        .filter((b) => point.branches.some((p) => p.id === b.id))
        .reduce((sum, b) => sum + b.pipeVolume, 0);
      const sump =
        4.5e-3 - trapped - pipes - point.flow * (inventory.flightTime + inventory.returnTime);
      expect(sump, position).toBeGreaterThanOrEqual(inventory.minSumpVolume);
      // ... and without the top-up it would not have been in at least one of them.
    }
    const ur = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'ur', 3000);
    expect(
      4.0e-3 - trapped - 0.5e-3 - ur.flow * (inventory.flightTime + inventory.returnTime),
    ).toBeLessThan(inventory.minSumpVolume);
    expect(timeline.problems.filter((p) => p.code === 'pump_starved')).toEqual([]);
    // The wash still reaches its target.
    expect(timeline.problems).toEqual([]);
  });

  it('starves the pump in a rinse with 1.2 L trapped: no level check there, no top-up (dossier 3.5)', () => {
    // "The 2.5 L rinse baths leave about 1.6 L in the sump against a prime limit of 0.5 L: one
    // litre trapped in upright bowls is survivable in the wash and marginal in the rinses,
    // where the machine does no level check and no top-up."
    const expandWith = (trappedLitres: number) =>
      expandProgramme(BOSCH_SMV4HAX40G, ECO, {
        heldWater: (step) =>
          step.phase === 'intermediate_rinse' || step.phase === 'final_rinse'
            ? { trapped: trappedLitres * 1e-3 }
            : {},
      });
    const marginal = expandWith(1.0);
    expect(marginal.problems.filter((p) => p.code === 'pump_starved')).toEqual([]);
    const starved = expandWith(1.2);
    expect(starved.events.some((e) => e.kind === 'top_up')).toBe(false);
    const steps = starved.problems.filter((p) => p.code === 'pump_starved').map((p) => p.stepId);
    expect(steps).toContain('e7_rinse');
    expect(steps).toContain('e10_heat');
    // The starved state delivers less than the primed one, by the fixed point of
    // `primedOperatingPoint` with the same trapped water.
    const rinse = must(starved.segments.find((s) => s.stepId === 'e7_rinse'));
    const upper = must(rinse.diverter.find((d) => d.position === 'ur'));
    const expected = primedOperatingPoint(BOSCH_SMV4HAX40G, 'ur', 2800, 2.9e-3, {
      trapped: 1.2e-3,
    });
    expect(expected.inventory.primed).toBe(false);
    expectWithin(upper.flow, expected.point.flow, 1e-9, 'starved flow');
    expect(upper.flow).toBeLessThan(hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'ur', 2800).flow);
    // The heater is off while the pump is starved, so the final rinse heats more slowly.
    expect(starved.totals.duration).toBeGreaterThan(marginal.totals.duration);
  });

  it('follows the three top-up values of the machine', () => {
    const run = (
      trappedLitres: number,
      edit: (spec: ReturnType<typeof mutableCopy<MachineSpec>>) => void,
    ) => {
      const spec = mutableCopy(BOSCH_SMV4HAX40G);
      edit(spec);
      return expandProgramme(spec, primaryProgramme(spec), {
        heldWater: (step) => (step.phase === 'main_wash' ? { trapped: trappedLitres * 1e-3 } : {}),
      });
    };
    const topUps = (timeline: ProgrammeTimeline) =>
      timeline.events
        .filter((e) => e.kind === 'top_up')
        .map((e) => (e.kind === 'top_up' ? e.volume : 0));
    const starved = (timeline: ProgrammeTimeline) =>
      timeline.problems.some((p) => p.code === 'pump_starved');
    // topUpVolume: one top-up of the volume given.
    const larger = run(2.2, (spec) => void (spec.hydraulics.inventory.topUpVolume = 0.8e-3));
    expect(topUps(larger)).toEqual([0.8e-3]);
    expectNear(toLitres(larger.totals.mainsWater), 9.5 + 0.8, 1e-6);
    // maxTopUpsPerPhase: 2.7 L trapped needs two top-ups of 0.5 L (the sump is 0.65 L short
    // in position UR); the Bosch allows one and then starves, a machine that allows two does not.
    expect(topUps(run(2.7, () => undefined))).toEqual([0.5e-3]);
    expect(starved(run(2.7, () => undefined))).toBe(true);
    const twice = run(2.7, (spec) => void (spec.hydraulics.inventory.maxTopUpsPerPhase = 2));
    expect(topUps(twice)).toEqual([0.5e-3, 0.5e-3]);
    expect(starved(twice)).toBe(false);
    // levelCheckIn: a machine that does not check the level in the wash starves instead.
    const unchecked = run(
      2.2,
      (spec) => void (spec.hydraulics.inventory.levelCheckIn = ['pre_rinse']),
    );
    expect(topUps(unchecked)).toEqual([]);
    expect(starved(unchecked)).toBe(true);
  });

  it('takes one value of held water for the whole programme as well', () => {
    const timeline = expandProgramme(BOSCH_SMV4HAX40G, ECO, { heldWater: { trapped: 1.2e-3 } });
    const steps = timeline.problems.filter((p) => p.code === 'pump_starved').map((p) => p.stepId);
    expect(steps).toContain('e7_rinse');
    expect(must(timeline.segments.find((s) => s.stepId === 'e2_pre_rinse')).heldWater).toBe(1.2e-3);
    // Segments without the pump hold nothing back from it.
    expect(must(timeline.segments.find((s) => s.kind === 'dry')).heldWater).toBe(0);
  });
});

describe('rows of a timeline', () => {
  it('keeps the row of a heat step whose target is already met', () => {
    // The final rinse comes out of the tank and off the warm load at about 35 C: a target of
    // 30 C is met before the step begins, so it takes no time. (The rinse aid, which waits for
    // 40 C, is let go at 30 C here.)
    const cool = mutableCopy(ECO);
    for (const step of cool.steps) {
      if (step.id === 'e10_heat' && step.kind === 'heat') step.target = 30;
      if (step.id === 'e11_hold' && step.kind === 'hold') step.target = 30;
    }
    const spec = mutableCopy(BOSCH_SMV4HAX40G);
    spec.dosing.rinseAidMinTemperature = 30;
    const timeline = expandProgramme(spec, cool);
    expect(timeline.segments.some((s) => s.stepId === 'e10_heat')).toBe(false);
    expect(timeline.rows.map((r) => r.row)).toEqual(TIMELINE.rows.map((r) => r.row));
    expect(timeline.rows).toHaveLength(14);
    const row = must(timeline.rows.find((r) => r.row === 'E10'));
    expect(row.end - row.start).toBe(0);
    expect(row.heaterOnTime).toBe(0);
    expect(row.target).toBe(30);
    // It sits between its neighbours.
    const before = must(timeline.rows.find((r) => r.row === 'E9'));
    const after = must(timeline.rows.find((r) => r.row === 'E11'));
    expect(row.start).toBe(before.end);
    expect(after.start).toBe(row.end);
    expect(timeline.problems).toEqual([]);
  });

  it('lays the rows end to end over the whole programme for every shipped programme', () => {
    for (const spec of [BOSCH_SMV4HAX40G]) {
      for (const programme of spec.programmes) {
        const timeline = expandProgramme(spec, programme);
        const rows = [...new Set(programme.steps.map((s) => s.row))];
        expect(
          timeline.rows.map((r) => r.row),
          programme.id,
        ).toEqual(rows);
        expect(must(timeline.rows[0]).start).toBe(0);
        timeline.rows.forEach((row, i) => {
          if (i > 0) expectNear(row.start, must(timeline.rows[i - 1]).end, 1e-9, programme.id);
        });
        expectNear(
          must(timeline.rows[timeline.rows.length - 1]).end,
          timeline.totals.duration,
          1e-9,
        );
      }
    }
  });
});
