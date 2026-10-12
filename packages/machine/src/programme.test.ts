import { describe, expect, it } from 'vitest';
import type { BoschProgrammeOptions } from './data/bosch-programmes.ts';
import { BOSCH_AUTO_145_OPTIONS, boschProgramme } from './data/bosch-programmes.ts';
import { hydraulicOperatingPoint } from './hydraulics.ts';
import { primedOperatingPoint } from './inventory.ts';
import { loadProgrammeSpec } from './load.ts';
import {
  BOSCH_SMV4HAX40G,
  BOSCH_SMV4HAX40G_DRILL_BORE,
  findProgramme,
  primaryProgramme,
  SPOT_60,
} from './machines.ts';
import type { ExpandOptions } from './programme.ts';
import { expandProgramme } from './programme.ts';
import {
  fitStepToTotalDuration,
  liquorTimeAbove,
  sprayTimeByLevel,
  timelineStateAt,
  withRegeneration,
  withStepDuration,
} from './programme-tools.ts';
import type { ProgrammeSpec, ProgrammeTimeline, TimelineSegment } from './programme-types.ts';
import { expectNear, expectWithin, must, mutableCopy, toKWh, toLitres } from './test-util.ts';
import type { MachineSpec } from './types.ts';

const MIN = 60;
const AUTO = primaryProgramme(BOSCH_SMV4HAX40G);
const TIMELINE = expandProgramme(BOSCH_SMV4HAX40G, AUTO);

/** The segments of one row of the dossier's table. */
function rowSegments(timeline: ProgrammeTimeline, row: string): TimelineSegment[] {
  return timeline.segments.filter((s) => s.row === row);
}

/**
 * A variant of AUTO 2:25 with its hold fitted to a total running time, as the dossier does
 * ("total held at 145 min by adjusting the hold"). The programme is rebuilt for every trial
 * hold, so that the tank is still refilled 15 min before the wash drains.
 */
function variant(
  changes: Partial<BoschProgrammeOptions>,
  totalMin = 145,
  spec: MachineSpec = BOSCH_SMV4HAX40G,
  options: ExpandOptions = {},
): { programme: ProgrammeSpec; timeline: ProgrammeTimeline } {
  let holdMin = BOSCH_AUTO_145_OPTIONS.holdMin;
  let programme = loadProgrammeSpec(
    boschProgramme({ ...BOSCH_AUTO_145_OPTIONS, ...changes, holdMin }),
  );
  let timeline = expandProgramme(spec, programme, options);
  for (let i = 0; i < 8 && Math.abs(timeline.totals.duration - totalMin * MIN) > 0.5; i++) {
    holdMin = Math.round(holdMin * MIN + totalMin * MIN - timeline.totals.duration) / MIN;
    programme = loadProgrammeSpec(
      boschProgramme({ ...BOSCH_AUTO_145_OPTIONS, ...changes, holdMin }),
    );
    timeline = expandProgramme(spec, programme, options);
  }
  expectNear(timeline.totals.duration, totalMin * MIN, 1, 'fitted total duration');
  return { programme, timeline };
}

describe('AUTO 2:25 of the Bosch: the table of machine-bosch-smv4hax40g.md section 4.4', () => {
  it('is the primary programme and expands without problems', () => {
    expect(BOSCH_SMV4HAX40G.primaryProgramme).toBe('auto_145');
    expect(AUTO.id).toBe('auto_145');
    expect(TIMELINE.problems).toEqual([]);
    expect(TIMELINE.machineId).toBe('bosch_smv4hax40g');
    expect(TIMELINE.programmeId).toBe('auto_145');
  });

  it('comes to 2 h 25 min within one minute', () => {
    expectNear(TIMELINE.totals.duration / MIN, 145, 1.0, 'total duration in minutes');
    // The fixed steps of the table add up to 118 min; the two heat-ups come from the thermal
    // model (18.0 and 8.9 min in the dossier's balance).
    const modelled = rowSegments(TIMELINE, 'A4').concat(rowSegments(TIMELINE, 'A10'));
    const heatUps = modelled.reduce((sum, s) => sum + (s.end - s.start), 0);
    expectNear((TIMELINE.totals.duration - heatUps) / MIN, 118, 1e-9);
    expectNear(heatUps / MIN, 26.9, 0.3);
  });

  // [row, clock at its start (min), mains water (L), target (C), pump (rpm), duration (min),
  //  whether the duration comes from the thermal model].
  const table = [
    ['A0', 0, 0, null, 0, 0.5, false],
    ['A1', 0.5, 0.9, null, 0, 1, false],
    ['A2', 1.5, 0, null, 2800, 11.5, false],
    ['A3', 13, 2.5, null, 0, 2, false],
    ['A4', 15, 0, 65, 3000, 18, true],
    ['A5', 33, 2.5, 65, 3000, 46, false],
    ['A6', 79, 0, null, 0, 1.5, false],
    ['A7', 80.5, 2.5, null, 2800, 7.5, false],
    ['A8', 88, 0, null, 0, 1.5, false],
    ['A9', 89.5, 0, null, 2800, 2, false],
    ['A10', 91.5, 0, 69, 2800, 9, true],
    ['A11', 100.5, 0, 69, 2800, 3, false],
    ['A12', 103.5, 0, null, 0, 1.5, false],
    ['A13', 105, 3.1, null, 0, 40, false],
  ] as const;

  it('has the fourteen rows A0 to A13 in order', () => {
    expect(TIMELINE.rows.map((r) => r.row)).toEqual(table.map(([row]) => row));
    // The rows follow one another without gaps.
    TIMELINE.rows.forEach((row, i) => {
      const next = TIMELINE.rows[i + 1];
      if (next !== undefined) expect(next.start).toBe(row.end);
    });
    expect(must(TIMELINE.rows[0]).start).toBe(0);
    expect(must(TIMELINE.rows[TIMELINE.rows.length - 1]).end).toBe(TIMELINE.totals.duration);
  });

  it.each(table)(
    'row %s: clock, mains water, target, pump speed and duration',
    (id, clock, mains, target, rpm, duration, modelled) => {
      const row = must(
        TIMELINE.rows.find((r) => r.row === id),
        `row ${id}`,
      );
      // Fixed durations are exact; the two heat-ups are printed to the whole minute (18 and 9;
      // 18.0 and 8.9 in the balance) and everything after them shifts with them.
      expectNear((row.end - row.start) / MIN, duration, modelled ? 0.25 : 1e-9, 'duration');
      expectNear(row.start / MIN, clock, clock > 15 ? 0.25 : 1e-9, 'clock time');
      expectNear(toLitres(row.mainsWater), mains, 1e-9, 'mains water');
      expect(row.target).toBe(target);
      expect(row.pumpRpm).toBe(rpm);
    },
  );

  it('draws 11.5 L of mains water, 3.1 L of which is in the tank at the end', () => {
    // "mains water 0.9 + 2.5 + 2.5 + 2.5 + 3.1 = 11.5 L".
    expectNear(toLitres(TIMELINE.totals.mainsWater), 11.5, 1e-9);
    expectNear(toLitres(TIMELINE.totals.prestoreVolumeAtEnd), 3.1, 1e-9);
    const fills = TIMELINE.events.filter((e) => e.kind === 'fill' || e.kind === 'prestore_fill');
    const mains = fills.reduce(
      (sum, e) =>
        sum + (e.kind === 'fill' ? e.fromMains : e.kind === 'prestore_fill' ? e.volume : 0),
      0,
    );
    expectNear(toLitres(mains), 11.5, 1e-9);
  });

  it('gives the load the baths the dossier lists: 4.0, 4.0, 2.9 and 2.9 L', () => {
    // "Baths seen by the load: 4.0 L pre-rinse; 4.0 L wash (1.5 L of pre-rinse liquor kept,
    // 2.5 L fresh); 2.9 L intermediate rinse; 2.9 L final rinse."
    const volume = (stepId: string) =>
      toLitres(
        must(
          TIMELINE.segments.find((s) => s.stepId === stepId),
          stepId,
        ).liquorVolume.end,
      );
    expectNear(volume('a2_pre_rinse'), 4.0, 1e-9);
    expectNear(volume('a3_drain'), 1.5, 1e-9);
    expectNear(volume('a5_hold'), 4.0, 1e-9);
    expectNear(volume('a6_drain'), 0.4, 1e-9);
    expectNear(volume('a7_rinse'), 2.9, 1e-9);
    expectNear(volume('a10_heat'), 2.9, 1e-9);
    expectNear(volume('a13_dry'), 0.4, 1e-9);
    // The tank: full at the start, emptied by the first fill, 2.5 L from 1:04 on, full again.
    const tank = (stepId: string) =>
      must(
        TIMELINE.segments.find((s) => s.stepId === stepId),
        stepId,
      ).prestoreVolume;
    expectNear(toLitres(tank('a1_fill').start), 3.1, 1e-9);
    expectNear(toLitres(tank('a1_fill').end), 0, 1e-9);
    expectNear(toLitres(tank('a5_hold').end), 2.5, 1e-9);
    expectNear(toLitres(tank('a7_fill').end), 0, 1e-9);
    expectNear(toLitres(tank('a7_rinse').end), 2.5, 1e-9);
    expectNear(toLitres(tank('a9_fill').end), 0, 1e-9);
  });

  it('releases the detergent 60 s after the main-wash circulation starts', () => {
    const releases = TIMELINE.events.filter((e) => e.kind === 'detergent_release');
    expect(releases).toHaveLength(1);
    const release = must(releases[0]);
    const a4 = must(TIMELINE.rows.find((r) => r.row === 'A4'));
    expectNear(release.time - a4.start, BOSCH_SMV4HAX40G.dosing.detergentReleaseDelay, 1e-9);
    expectNear(release.time / MIN, 16, 1e-9);
    if (release.kind !== 'detergent_release') throw new Error('not a detergent release');
    expectNear(release.mass, 0.02, 1e-12);
    // The pump is running and the heater is already on when the lid opens.
    const state = must(timelineStateAt(TIMELINE, release.time));
    expect(state.segment.stepId).toBe('a4_heat');
    expect(state.heaterOn).toBe(true);
    expect(state.diverter).not.toBeNull();
    // The event belongs to the segment that starts at that instant.
    expect(state.segment.events.some((e) => e.kind === 'detergent_release')).toBe(true);
  });

  it('doses 5 mL of rinse aid 60 s after the final-rinse circulation starts, at about 1:31, into liquor above 40 C', () => {
    const doses = TIMELINE.events.filter((e) => e.kind === 'rinse_aid_release');
    expect(doses).toHaveLength(1);
    const dose = must(doses[0]);
    if (dose.kind !== 'rinse_aid_release') throw new Error('not a rinse-aid release');
    // The machine's rule (dossier specification block): "final rinse, about 1 min after
    // circulation starts, liquor above 40 C". Circulation starts when the 30 s transfer from
    // the tank is over, so the dose falls at 1:31.0; the dossier's table, which counts the
    // minute from the start of row A9, says "at about 1:30.5".
    const circulation = must(TIMELINE.segments.find((s) => s.stepId === 'a9_circulate'));
    expectNear(dose.time - circulation.start, must(BOSCH_SMV4HAX40G.dosing.rinseAidDelay), 1e-9);
    expectNear(dose.time / MIN, 90.5, 0.75);
    expectNear(dose.volume, 5e-6, 1e-15);
    expect(dose.temperature).toBeGreaterThan(must(BOSCH_SMV4HAX40G.dosing.rinseAidMinTemperature));
    expectNear(dose.temperature, 45, 1.0);
  });

  it('fills, drains and tank fills happen where the table puts them', () => {
    const drains = TIMELINE.events.filter((e) => e.kind === 'drain');
    // A0, A3 (partial), A6, A8, A12.
    expect(drains.map((e) => e.stepId)).toEqual([
      'a0_pre_drain',
      'a3_drain',
      'a6_drain',
      'a8_drain',
      'a12_drain',
    ]);
    const volumes = drains.map((e) => (e.kind === 'drain' ? toLitres(e.volume) : Number.NaN));
    [0, 2.5, 3.6, 2.5, 2.5].forEach((v, i) => expectNear(must(volumes[i]), v, 1e-9));
    // "at 1:04 the heat exchanger takes 2.5 L of cold mains water" (15 min before the wash drains).
    const tankFills = TIMELINE.events.filter((e) => e.kind === 'prestore_fill');
    expect(tankFills).toHaveLength(5);
    const hold = must(TIMELINE.rows.find((r) => r.row === 'A5'));
    expectNear((hold.end - must(tankFills[0]).time) / MIN, 15, 1e-9);
    expectNear(must(tankFills[0]).time / MIN, 64, 0.25);
    // Drying: three portions at 5, 30 and 55 % of the 40 min step, 3.1 L in all.
    const dry = must(TIMELINE.rows.find((r) => r.row === 'A13'));
    const portions = tankFills.slice(2);
    [0.05, 0.3, 0.55].forEach((f, i) =>
      expectNear((must(portions[i]).time - dry.start) / (40 * MIN), f, 1e-9),
    );
    expectNear(
      toLitres(portions.reduce((sum, e) => sum + (e.kind === 'prestore_fill' ? e.volume : 0), 0)),
      3.1,
      1e-9,
    );
  });
});

describe('AUTO 2:25 of the Bosch: the energy and temperature balance of section 4.5', () => {
  it('uses 1.04 kWh, 91 % of it for heating', () => {
    // "Total 1.04 kWh (heating 91 %)"; a second analyst's implementation gives 1.035 kWh.
    expectNear(toKWh(TIMELINE.totals.energy), 1.04, 0.01);
    expectNear(TIMELINE.totals.heaterEnergy / TIMELINE.totals.energy, 0.91, 0.01);
    expectNear(toKWh(TIMELINE.totals.otherEnergy), 0.01, 1e-12);
    expectWithin(
      TIMELINE.totals.energy,
      TIMELINE.totals.heaterEnergy + TIMELINE.totals.pumpEnergy + TIMELINE.totals.otherEnergy,
      1e-12,
    );
  });

  it('heats for 26.9 min in two blocks: 0.631 kWh in the wash and 0.310 kWh in the final rinse', () => {
    expectNear(TIMELINE.totals.heaterOnTime / MIN, 26.9, 0.2);
    const wash = rowSegments(TIMELINE, 'A4').reduce((sum, s) => sum + s.heaterEnergy, 0);
    const final = rowSegments(TIMELINE, 'A10').reduce((sum, s) => sum + s.heaterEnergy, 0);
    expectNear(toKWh(wash), 0.631, 0.005);
    expectNear(toKWh(final), 0.31, 0.005);
    expectWithin(wash + final, TIMELINE.totals.heaterEnergy, 1e-12);
    // 2100 W at 230 V and full duty while it is on.
    expect(TIMELINE.conditions.heaterPower).toBe(2100);
    expectWithin(TIMELINE.totals.heaterEnergy, 2100 * TIMELINE.totals.heaterOnTime, 1e-12);
    // Two blocks: the intervals of the split row A4 join end to end.
    const intervals = TIMELINE.segments.flatMap((s) => s.heater);
    let blocks = 0;
    intervals.forEach((interval, i) => {
      const previous = intervals[i - 1];
      if (previous === undefined || previous.end !== interval.start) blocks++;
    });
    expect(blocks).toBe(2);
    // "the wash is heated to 65 C and not reheated": no heater in the hold.
    expect(must(TIMELINE.segments.find((s) => s.stepId === 'a5_hold')).heater).toEqual([]);
  });

  it("runs the circulation pump for 96 min and 0.087 kWh, as the dossier's 97 min and 0.087 kWh", () => {
    // The pump powers are those of the owner update's table 5.1 (the measured nozzles on the
    // dossier's pump curve): 58 and 57 W at 3000 rpm (lower arm; upper arm with roof spinner),
    // 49 and 48 W at 2800 rpm. The dossier's table had 57 / 54 and 47 / 45 W.
    const powers = new Map<string, number>();
    const minutes = new Map<string, number>();
    for (const segment of TIMELINE.segments) {
      for (const interval of segment.diverter) {
        const key = `${interval.position}@${segment.pumpRpm}`;
        powers.set(key, interval.pumpPower);
        minutes.set(key, (minutes.get(key) ?? 0) + (interval.end - interval.start) / MIN);
      }
    }
    expectNear(must(powers.get('l@3000')), 58, 0.6);
    expectNear(must(powers.get('ur@3000')), 57, 0.6);
    expectNear(must(powers.get('l@2800')), 49, 0.6);
    expectNear(must(powers.get('ur@2800')), 48, 0.6);
    // The wash (rows A4 and A5, 64 min at 3000 rpm) alternates the two levels minute by minute.
    // (The heat-up ends on a whole second, so the two can differ by a second or two.)
    expectNear(must(minutes.get('l@3000')), 32, 0.05);
    expectNear(must(minutes.get('ur@3000')), 32, 0.05);
    // The pump rests during the two 30 s transfers from the tank (rows A7 and A9): 96 min in all.
    expectNear(TIMELINE.totals.pumpOnTime / MIN, 96, 0.3);
    const rest = must(minutes.get('l@2800')) + must(minutes.get('ur@2800'));
    expectNear(rest, 32, 0.3);
    // Energy by hand with the update's powers: 32 x 58 + 32 x 57 + 32 x 48.5 W min = 0.087 kWh.
    // That holds for a diverter that moves at once; the machine's takes 2.5 s per change, during
    // which the branches are partly open and the pump draws less: about 107 changes at a mean
    // deficit of some 20 W, 0.0014 kWh.
    const byHand = (32 * 58 + 32 * 57 + 32 * 48.5) / 60000;
    const instant = mutableCopy(BOSCH_SMV4HAX40G);
    instant.hydraulics.diverter.transitionTime = 0;
    expectNear(toKWh(expandProgramme(instant, AUTO).totals.pumpEnergy), byHand, 0.001);
    expectNear(toKWh(TIMELINE.totals.pumpEnergy), 0.087, 0.002);
    expect(toKWh(TIMELINE.totals.pumpEnergy)).toBeLessThan(byHand);
    expect(toKWh(TIMELINE.totals.pumpEnergy)).toBeGreaterThan(byHand - 0.003);
    // The dossier charges 57 W (at 3000 rpm) and 47 W (at 2800 rpm) for the whole of each phase
    // over 97 min, the two transfers included, and also arrives at 0.087 kWh: the measured
    // nozzles pass more water at less pressure for about the same power.
    const wash = rowSegments(TIMELINE, 'A4')
      .concat(rowSegments(TIMELINE, 'A5'))
      .reduce((sum, s) => sum + s.pumpOnTime, 0);
    const other = TIMELINE.totals.pumpOnTime - wash + 2 * 30;
    expectNear((wash + other) / MIN, 97, 0.3);
    expectNear(toKWh(57 * wash + 47 * other), 0.087, 0.001);
  });

  it('is not moved by the nozzle measurements: 145 min, 11.5 L and 1.04 kWh with either bore of the lower arm', () => {
    // The programme's water is metered and its energy is nine tenths heating, so the owner's
    // nozzle measurements (and the open question of the 3.3 or 4.5 mm bore) change the cycle
    // only through the pump's power, about 57 W either way (owner update, tables 5.1 and 5.2).
    const drill = expandProgramme(
      BOSCH_SMV4HAX40G_DRILL_BORE,
      primaryProgramme(BOSCH_SMV4HAX40G_DRILL_BORE),
    );
    expect(drill.problems).toEqual([]);
    for (const timeline of [TIMELINE, drill]) {
      expectNear(timeline.totals.duration / MIN, 145, 0.25, 'duration');
      expectNear(toLitres(timeline.totals.mainsWater), 11.5, 1e-9, 'mains water');
      expectNear(toKWh(timeline.totals.energy), 1.04, 0.005, 'energy');
    }
    expectNear(toKWh(drill.totals.pumpEnergy), toKWh(TIMELINE.totals.pumpEnergy), 0.004);
    expectNear(drill.totals.duration, TIMELINE.totals.duration, 10);
  });

  it('follows the liquor temperatures of the balance within 1 K', () => {
    // "23 (pre-rinse) / 18.5 (after exchange) / 65 at 0:33 / 62 at 1:04 / 55 at 1:19 /
    //  49 (intermediate rinse) / 45 to 69 (final rinse) / 67 at the last drain".
    const end = (row: string) =>
      must(TIMELINE.rows.find((r) => r.row === row)).liquorTemperatureAtEnd;
    expectNear(end('A1'), 21, 0.5);
    expectNear(end('A2'), 23, 0.5);
    expectNear(end('A3'), 18.5, 0.5);
    expectNear(end('A4'), 65, 0.1);
    expectNear(must(timelineStateAt(TIMELINE, 64 * MIN - 1)).liquorTemperature, 62, 1.0);
    expectNear(end('A5'), 55, 1.0);
    expectNear(end('A7'), 49, 1.0);
    expectNear(end('A9'), 45, 1.0);
    expectNear(end('A10'), 69, 0.1);
    expectNear(end('A11'), 67, 1.0);
  });

  it('follows the load temperatures of the balance within 1 K', () => {
    // "64 at the end of the heat-up; 55 at the wash drain; 67 after the final rinse; 59 after
    //  40 min of drying".
    const end = (row: string) =>
      must(TIMELINE.rows.find((r) => r.row === row)).loadTemperatureAtEnd;
    expectNear(end('A4'), 64, 1.0);
    expectNear(end('A5'), 55, 1.0);
    expectNear(end('A11'), 67, 1.0);
    expectNear(end('A13'), 59, 1.0);
  });

  it('keeps the wash liquor above 55 C for 48 min and above 60 C for 35 min', () => {
    // The dossier's trace runs to the wash drain: these are times in the main wash.
    expectNear(liquorTimeAbove(TIMELINE, 55, ['main_wash']) / MIN, 48, 1);
    expectNear(liquorTimeAbove(TIMELINE, 60, ['main_wash']) / MIN, 35, 1);
    // The final rinse (45 to 69 C at 2.7 K/min, then a 3 min hold) adds 8 and 6 min.
    expectNear(
      (liquorTimeAbove(TIMELINE, 55) - liquorTimeAbove(TIMELINE, 55, ['main_wash'])) / MIN,
      8,
      1,
    );
    expectNear(
      (liquorTimeAbove(TIMELINE, 60) - liquorTimeAbove(TIMELINE, 60, ['main_wash'])) / MIN,
      6,
      1,
    );
    expect(liquorTimeAbove(TIMELINE, 70)).toBe(0);
    // Above room temperature it counts every second of circulation after the pre-rinse.
    expect(liquorTimeAbove(TIMELINE, 23.5)).toBeGreaterThan(80 * MIN);
  });

  it("lies inside the manufacturer's printed ranges for Auto 45-65", () => {
    // Manual and quick reference guide: 1:40 to 2:45, 0.900 to 1.500 kWh, 7.0 to 15.5 L.
    const printed = must(AUTO.declared.printed);
    expect(must(printed.duration)).toEqual([100 * MIN, 165 * MIN]);
    expect(TIMELINE.totals.duration).toBeGreaterThan(100 * MIN);
    expect(TIMELINE.totals.duration).toBeLessThan(165 * MIN);
    expect(toKWh(TIMELINE.totals.energy)).toBeGreaterThan(0.9);
    expect(toKWh(TIMELINE.totals.energy)).toBeLessThan(1.5);
    expect(toLitres(TIMELINE.totals.mainsWater)).toBeGreaterThan(7.0);
    expect(toLitres(TIMELINE.totals.mainsWater)).toBeLessThan(15.5);
    // The two laboratory-measured sisters: 11.2 to 11.9 L and 1.06 to 1.11 kWh.
    expect(toLitres(TIMELINE.totals.mainsWater)).toBeGreaterThanOrEqual(11.2);
    expect(toLitres(TIMELINE.totals.mainsWater)).toBeLessThanOrEqual(11.9);
  });

  it('is 2 and 6 % below the two measured sisters when run for their conditions', () => {
    // "run for their conditions (14 place settings, 2:13) the model gives 1.04 kWh against the
    //  measured 1.06 and 1.11, 2 and 6 % low". 14 place settings: a load 24.8 / 23 as heavy.
    const sisters = variant({}, 133, BOSCH_SMV4HAX40G, { loadHeatCapacity: 23000 * (24.8 / 23) });
    const energy = toKWh(sisters.timeline.totals.energy);
    expectNear(sisters.timeline.totals.duration / MIN, 133, 0.02);
    expectNear(energy, 1.04, 0.012);
    expectNear(1 - energy / 1.06, 0.02, 0.012);
    expectNear(1 - energy / 1.11, 0.06, 0.012);
  });
});

describe('AUTO 2:25 of the Bosch: sensitivity and alternatives (sections 4.5 and 4.6)', () => {
  // The dossier holds the total at 145 min by adjusting the hold; so does `variant`. Its
  // figures are printed to 0.01 kWh.
  const TOLERANCE = 0.012;

  it('wash target 55 / 60 C: 0.96 / 1.00 kWh', () => {
    expectNear(toKWh(variant({ washTarget: 55 }).timeline.totals.energy), 0.96, TOLERANCE);
    const sixty = variant({ washTarget: 60 });
    expectNear(toKWh(sixty.timeline.totals.energy), 1.0, TOLERANCE);
    // "A4 stops at 60 C after 15.8 min; the liquor then drifts to 57 C and falls to 51 C".
    const heatUp = rowSegments(sixty.timeline, 'A4').reduce((sum, s) => sum + (s.end - s.start), 0);
    expectNear(heatUp / MIN, 15.8, 0.2);
    expectNear(
      must(sixty.timeline.rows.find((r) => r.row === 'A5')).liquorTemperatureAtEnd,
      51,
      1.0,
    );
  });

  it('final rinse 65 / 72 C: 0.98 / 1.08 kWh', () => {
    expectNear(toKWh(variant({ finalTarget: 65 }).timeline.totals.energy), 0.98, TOLERANCE);
    expectNear(toKWh(variant({ finalTarget: 72 }).timeline.totals.energy), 1.08, TOLERANCE);
  });

  it('British winter (inlet 8 C, room 19 C, 240 V): 1.15 kWh', () => {
    const winter = variant({}, 145, BOSCH_SMV4HAX40G, {
      inletTemperature: 8,
      ambientTemperature: 19,
      mainsVoltage: 240,
    });
    expectNear(toKWh(winter.timeline.totals.energy), 1.15, TOLERANCE);
    // "2290 W at 240 V": the heater scales with the voltage squared.
    expectNear(winter.timeline.conditions.heaterPower, 2290, 5);
    expectWithin(winter.timeline.conditions.heaterPower, 2100 * (240 / 230) ** 2, 1e-12);
  });

  it('half load: 0.87 kWh', () => {
    const half = variant({}, 145, BOSCH_SMV4HAX40G, { loadHeatCapacity: 11500 });
    expectNear(toKWh(half.timeline.totals.energy), 0.87, TOLERANCE);
  });

  it('cabinet loss 2.6 / 4.0 W/K: 1.03 / 1.07 kWh; machine heat capacity 10 / 18 kJ/K: 0.99 / 1.09 kWh', () => {
    const withThermal = (changes: Partial<MachineSpec['thermal']>): MachineSpec => ({
      ...BOSCH_SMV4HAX40G,
      thermal: { ...BOSCH_SMV4HAX40G.thermal, ...changes },
    });
    const energy = (changes: Partial<MachineSpec['thermal']>) =>
      toKWh(variant({}, 145, withThermal(changes)).timeline.totals.energy);
    expectNear(energy({ cabinetConductance: 2.6 }), 1.03, TOLERANCE);
    expectNear(energy({ cabinetConductance: 4.0 }), 1.07, TOLERANCE);
    expectNear(energy({ machineHeatCapacity: 10000 }), 0.99, TOLERANCE);
    expectNear(energy({ machineHeatCapacity: 18000 }), 1.09, TOLERANCE);
  });

  it('N-keep (no exchange, two rinses): 11.5 L, 1.09 kWh, hold about 38 min', () => {
    const keep = variant({ exchangeL: 0, intermediateRinses: 2 });
    expectNear(toLitres(keep.timeline.totals.mainsWater), 11.5, 1e-9);
    expectNear(toKWh(keep.timeline.totals.energy), 1.09, TOLERANCE);
    const hold = must(keep.timeline.segments.find((s) => s.stepId === 'a5_hold'));
    expectNear((hold.end - hold.start) / MIN, 38, 1.0);
    expect(keep.timeline.rows.some((r) => r.row === 'A3')).toBe(false);
    expect(
      keep.timeline.rows.filter((r) => r.phase === 'intermediate_rinse' && r.pumpRpm > 0),
    ).toHaveLength(2);
  });

  it('held wash (heater back on 1.5 K below the target): 1.11 kWh, about 5 min of extra heating', () => {
    const held = variant({ reheatBand: 1.5 });
    expectNear(toKWh(held.timeline.totals.energy), 1.11, TOLERANCE);
    const hold = must(held.timeline.segments.find((s) => s.stepId === 'a5_hold'));
    expectNear(hold.heaterOnTime / MIN, 5, 0.5);
    // In short bursts, most of it after the heat exchanger fills.
    expect(hold.heater.length).toBeGreaterThan(3);
    // The liquor never leaves the band by more than a step's worth.
    const lowest = Math.min(...hold.temperature.liquor);
    expect(lowest).toBeGreaterThan(65 - 1.5 - 0.5);
    // "1.06 with a 60 C target".
    expectNear(
      toKWh(variant({ reheatBand: 1.5, washTarget: 60 }).timeline.totals.energy),
      1.06,
      TOLERANCE,
    );
  });

  it('light branch (1:40): 7.0 L and 0.76 kWh; heavy branch (2:45): 15.5 L and 1.15 kWh', () => {
    const light = variant(
      { exchangeL: 0, washTarget: 45, flush: true, intermediateRinses: 0 },
      100,
    );
    expectNear(toLitres(light.timeline.totals.mainsWater), 7.0, 1e-9);
    expectNear(toKWh(light.timeline.totals.energy), 0.76, TOLERANCE);
    // "wash 45 C (8.7 min heat-up); hold about 17 min".
    const heatUp = rowSegments(light.timeline, 'A4').reduce((sum, s) => sum + (s.end - s.start), 0);
    expectNear(heatUp / MIN, 8.7, 0.2);
    const hold = must(light.timeline.segments.find((s) => s.stepId === 'a5_hold'));
    expectNear((hold.end - hold.start) / MIN, 17, 1.0);

    const heavy = variant({ exchangeL: 4.0, intermediateRinses: 2 }, 165);
    expectNear(toLitres(heavy.timeline.totals.mainsWater), 15.5, 1e-9);
    // The full drain leaves the 0.4 L carry-over, so the wash bath is 4.4 L here against the
    // 4.0 L of the dossier's balance: the heat-up is half a minute longer and the energy
    // 0.02 kWh higher than its 1.15 kWh.
    expectNear(
      toLitres(must(heavy.timeline.segments.find((s) => s.stepId === 'a5_hold')).liquorVolume.end),
      4.4,
      1e-9,
    );
    expectNear(toKWh(heavy.timeline.totals.energy), 1.15, 0.03);
    expect(toKWh(heavy.timeline.totals.energy)).toBeGreaterThan(1.15);
    const heavyHold = must(heavy.timeline.segments.find((s) => s.stepId === 'a5_hold'));
    expectNear((heavyHold.end - heavyHold.start) / MIN, 54, 1.5);
  });

  it('N-full (4.0 L exchanged): 13.0 L', () => {
    const full = variant({ exchangeL: 4.0 });
    expectNear(toLitres(full.timeline.totals.mainsWater), 13.0, 1e-9);
    // 1.05 kWh in the dossier with a 4.0 L wash bath; 4.4 L here (see the heavy branch).
    expectNear(toKWh(full.timeline.totals.energy), 1.05, 0.03);
  });

  it('a softener regeneration adds 7 min, 5 L and 0.05 kWh', () => {
    const regen = withRegeneration(BOSCH_SMV4HAX40G, AUTO);
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
    const hold = must(timeline.rows.find((r) => r.row === 'A5'));
    expect(event.time).toBeGreaterThan(hold.start);
    expectNear(must(timeline.rows.find((r) => r.row === 'A6')).start - event.time, 7 * MIN, 1e-9);
    expectNear(regen.declared.duration / MIN, 152, 1e-9);
    // A machine without softener data is left alone.
    expect(withRegeneration(SPOT_60, primaryProgramme(SPOT_60))).toBe(primaryProgramme(SPOT_60));
  });
});

describe('the diverter pattern resolved into intervals', () => {
  it('alternates lower arm and upper arm with roof spinner every 60 s in the pre-rinse', () => {
    const preRinse = must(TIMELINE.segments.find((s) => s.stepId === 'a2_pre_rinse'));
    // 11.5 min at L/UR 60/60: eleven full dwells and half of a twelfth.
    expect(preRinse.diverter).toHaveLength(12);
    preRinse.diverter.forEach((interval, i) => {
      expect(interval.position).toBe(i % 2 === 0 ? 'l' : 'ur');
      expect(interval.feeds).toEqual(i % 2 === 0 ? ['lower'] : ['upper', 'roof']);
      expectNear(interval.start - preRinse.start, 60 * i, 1e-9);
      expectNear(interval.end - interval.start, i === 11 ? 30 : 60, 1e-9);
      // The water switch takes 2.5 s to move; it is in place at the start of a pump run.
      expect(interval.transition).toBe(i === 0 ? 0 : 2.5);
      expect(interval.flow).toBeGreaterThan(0);
    });
    expect(must(preRinse.diverter[0]).start).toBe(preRinse.start);
    expect(must(preRinse.diverter[11]).end).toBe(preRinse.end);
  });

  it('keeps alternating across the dispenser release and into the hold', () => {
    const heat = must(TIMELINE.segments.find((s) => s.stepId === 'a4_heat'));
    const hold = must(TIMELINE.segments.find((s) => s.stepId === 'a5_hold'));
    // The dispenser opens after the first dwell on the lower arm, as the diverter turns to the
    // upper arm, which sprays the tablet tray from below.
    const release = must(TIMELINE.events.find((e) => e.kind === 'detergent_release'));
    expect(must(heat.diverter[0]).position).toBe('l');
    expect(must(heat.diverter[1]).position).toBe('ur');
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
    const rinse = must(TIMELINE.segments.find((s) => s.stepId === 'a7_rinse'));
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
    ...SPOT_60.programmes.map((p) => [`spot60 ${p.id}`, expandProgramme(SPOT_60, p)] as const),
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
    const again = expandProgramme(BOSCH_SMV4HAX40G, AUTO);
    expect(again).toEqual(TIMELINE);
    expect(JSON.stringify(again)).toBe(JSON.stringify(TIMELINE));
    expect(JSON.parse(JSON.stringify(TIMELINE))).toEqual(TIMELINE);
  });

  it('hardly depends on the integration step', () => {
    const fine = expandProgramme(BOSCH_SMV4HAX40G, AUTO, { timeStep: 0.25 });
    expectNear(fine.totals.duration, TIMELINE.totals.duration, 5);
    expectWithin(fine.totals.energy, TIMELINE.totals.energy, 0.003);
    expectNear(
      must(fine.rows.find((r) => r.row === 'A5')).liquorTemperatureAtEnd,
      must(TIMELINE.rows.find((r) => r.row === 'A5')).liquorTemperatureAtEnd,
      0.05,
    );
    expect(() => expandProgramme(BOSCH_SMV4HAX40G, AUTO, { timeStep: 0 })).toThrow(RangeError);
  });

  it('samples the temperatures every sample interval', () => {
    const coarse = expandProgramme(BOSCH_SMV4HAX40G, AUTO, { sampleInterval: 60 });
    const hold = must(coarse.segments.find((s) => s.stepId === 'a5_hold'));
    // 46 min: the start, 46 whole minutes.
    expect(hold.temperature.time).toHaveLength(47);
    expectNear(must(hold.temperature.time[1]) - must(hold.temperature.time[0]), 60, 1e-9);
    expect(coarse.totals).toEqual(TIMELINE.totals);
  });

  it('moves the upper branch with the configured Rackmatic level', () => {
    const at = (level: string) =>
      expandProgramme(BOSCH_SMV4HAX40G, AUTO, {
        config: { ...BOSCH_SMV4HAX40G.defaultConfig, basketHeights: { upper: level } },
      });
    const flow = (timeline: ProgrammeTimeline) =>
      must(must(timeline.segments.find((s) => s.stepId === 'a2_pre_rinse')).diverter[1]).flow;
    expect(flow(at('3'))).toBeGreaterThan(flow(at('1')));
    expect(at('1').conditions.basketHeights).toEqual({ upper: '1' });
    expect(TIMELINE.conditions.basketHeights).toEqual({ upper: '1' });
  });

  it('reports what does not add up instead of throwing', () => {
    // Twice the tank's content drawn for the first fill.
    const greedy = mutableCopy(AUTO);
    const fill = must(greedy.steps.find((s) => s.id === 'a1_fill'));
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
    const cold = expandProgramme(weak, AUTO);
    expect(cold.problems.map((p) => p.code)).toContain('heat_timeout');
    expect(must(cold.problems.find((p) => p.code === 'heat_timeout')).stepId).toBe('a4_heat');

    // A first bath too small to keep the pump primed.
    const dry = mutableCopy(AUTO);
    const small = must(dry.steps.find((s) => s.id === 'a1_fill'));
    if (small.kind !== 'fill') throw new Error('not a fill');
    must(small.sources[0]).volume = 0.3e-3;
    must(small.sources[1]).volume = 0.3e-3;
    const starved = expandProgramme(BOSCH_SMV4HAX40G, dry);
    expect(starved.problems.map((p) => p.code)).toContain('pump_starved');

    // The tank overfilled.
    const over = mutableCopy(AUTO);
    const hold = must(over.steps.find((s) => s.id === 'a5_hold'));
    if (hold.kind !== 'hold') throw new Error('not a hold');
    must(hold.prestoreFills[0]).volume = 3.5e-3;
    expect(expandProgramme(BOSCH_SMV4HAX40G, over).problems.map((p) => p.code)).toContain(
      'prestore_overflow',
    );

    // Pre-stored water on a machine without a tank, and a partial drain of more than there is.
    const spot = mutableCopy(primaryProgramme(SPOT_60));
    const first = must(spot.steps.find((s) => s.id === 'a1_fill'));
    if (first.kind !== 'fill') throw new Error('not a fill');
    first.sources.push({ from: 'prestore', volume: 1e-3 });
    const drain = must(spot.steps.find((s) => s.id === 'a1_drain'));
    if (drain.kind !== 'drain') throw new Error('not a drain');
    drain.volume = 9e-3;
    const codes = expandProgramme(SPOT_60, spot).problems.map((p) => p.code);
    expect(codes).toContain('no_prestore_tank');
    expect(codes).toContain('drain_exceeds_content');
  });

  it('runs a starved pump at its air-derated point and keeps the heater off (machine.md 12.2 items 4 and 6)', () => {
    // The main wash refilled with 0.1 L instead of 2.5 L: 1.6 L in the machine. The machine is
    // one that cannot top up (the Bosch itself would let in 0.5 L: see the top-up tests).
    const dry = mutableCopy(AUTO);
    const fill = must(dry.steps.find((s) => s.id === 'a3_fill'));
    if (fill.kind !== 'fill') throw new Error('not a fill');
    must(fill.sources[0]).volume = 0.1e-3;
    const noTopUp = mutableCopy(BOSCH_SMV4HAX40G);
    noTopUp.hydraulics.inventory.maxTopUpsPerPhase = 0;
    const timeline = expandProgramme(noTopUp, dry);
    const heat = must(timeline.segments.find((s) => s.stepId === 'a4_heat'));
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
    // 65 C, the heat step runs into its 120 min timeout and only the pump warms the water.
    const starvedSteps = timeline.problems
      .filter((p) => p.code === 'pump_starved')
      .map((p) => p.stepId);
    expect(starvedSteps).toEqual(['a4_heat', 'a5_hold']);
    expect(timeline.problems.filter((p) => p.code === 'heat_timeout').map((p) => p.stepId)).toEqual(
      ['a4_heat'],
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
    const final = must(timeline.segments.find((s) => s.stepId === 'a10_heat'));
    expect(final.heaterEnergy).toBeGreaterThan(0);
    expect(
      timeline.problems.some((p) => p.stepId.startsWith('a9') || p.stepId.startsWith('a10')),
    ).toBe(false);
  });
});

describe('programme tools', () => {
  it('fits a hold to a total running time', () => {
    const shorter = fitStepToTotalDuration(BOSCH_SMV4HAX40G, AUTO, 'a5_hold', 130 * MIN);
    const timeline = expandProgramme(BOSCH_SMV4HAX40G, shorter);
    expectNear(timeline.totals.duration, 130 * MIN, 0.5);
    const hold = must(shorter.steps.find((s) => s.id === 'a5_hold'));
    if (hold.kind !== 'hold') throw new Error('not a hold');
    // 15 min less in total needs about 15 min less hold (the final heat-up shifts a little).
    expectNear(hold.duration / MIN, 31, 0.5);
    expect(() => fitStepToTotalDuration(BOSCH_SMV4HAX40G, AUTO, 'a5_hold', 60 * MIN)).toThrow(
      RangeError,
    );
    expect(() => fitStepToTotalDuration(BOSCH_SMV4HAX40G, AUTO, 'a4_dose', 145 * MIN)).toThrow(
      RangeError,
    );
    expect(() => fitStepToTotalDuration(BOSCH_SMV4HAX40G, AUTO, 'a4_heat', 145 * MIN)).toThrow(
      RangeError,
    );
  });

  it('retimes one step and leaves the programme it was given untouched', () => {
    const longer = withStepDuration(AUTO, 'a13_dry', 50 * MIN);
    const before = must(AUTO.steps.find((s) => s.id === 'a13_dry'));
    const after = must(longer.steps.find((s) => s.id === 'a13_dry'));
    if (before.kind !== 'dry' || after.kind !== 'dry') throw new Error('not a dry step');
    // AUTO gives its drying step no length: it takes the machine's default, 40 min.
    expect(before.duration).toBeNull();
    expect(BOSCH_SMV4HAX40G.drying.defaultDuration).toBe(40 * MIN);
    expect(after.duration).toBe(50 * MIN);
    expectNear(
      expandProgramme(BOSCH_SMV4HAX40G, longer).totals.duration - TIMELINE.totals.duration,
      10 * MIN,
      1e-9,
    );
    expect(() => withStepDuration(AUTO, 'nope', 1)).toThrow(RangeError);
    expect(() => withStepDuration(AUTO, 'a4_dose', 1)).toThrow(RangeError);
  });

  it('reads the state of the machine at a time', () => {
    expect(timelineStateAt(TIMELINE, -1)).toBeUndefined();
    expect(timelineStateAt(TIMELINE, TIMELINE.totals.duration)).toBeUndefined();
    // 0:20: in the heat-up, heater on, 3000 rpm.
    const heating = must(timelineStateAt(TIMELINE, 20 * MIN));
    expect(heating.segment.row).toBe('A4');
    expect(heating.heaterOn).toBe(true);
    expect(heating.segment.pumpRpm).toBe(3000);
    // The dossier's trace: liquor 34.7 C and load 33.2 C at 20 min.
    expectNear(heating.liquorTemperature, 34.7, 0.5);
    expectNear(heating.loadTemperature, 33.2, 0.5);
    // 0:50: in the hold, heater off, liquor 62.6 C in the dossier's trace.
    const holding = must(timelineStateAt(TIMELINE, 50 * MIN));
    expect(holding.segment.row).toBe('A5');
    expect(holding.heaterOn).toBe(false);
    expectNear(holding.liquorTemperature, 62.6, 0.5);
    // 2:00: drying, nothing fed.
    const drying = must(timelineStateAt(TIMELINE, 120 * MIN));
    expect(drying.segment.kind).toBe('dry');
    expect(drying.diverter).toBeNull();
  });
});

describe('the other programmes of the Bosch (sections 4.1 and 4.7)', () => {
  // [id, printed duration (min) as a range, printed water (L) as a range, what the outline adds up to (L)].
  const printed = [
    ['eco_50', [295, 295], [9.5, 9.5], 9.5],
    ['intensive_70', [125, 135], [11.5, 14.0], 11.5],
    ['express_65', [60, 60], [10.5, 10.5], 10.5],
    ['silence_50', [240, 240], [11.0, 11.0], 9.5],
    ['pre_rinse', [15, 15], [4.0, 4.0], 4.0],
    ['auto_100_light', [100, 165], [7.0, 15.5], 7.0],
    ['auto_165_heavy', [100, 165], [7.0, 15.5], 15.5],
    ['auto_145_keep', [100, 165], [7.0, 15.5], 11.5],
  ] as const;

  it.each(printed)(
    '%s runs for its printed time and draws the water of its outline',
    (id, duration, water, outline) => {
      const programme = must(findProgramme(BOSCH_SMV4HAX40G, id), id);
      const timeline = expandProgramme(BOSCH_SMV4HAX40G, programme);
      expect(timeline.problems).toEqual([]);
      expect(timeline.totals.duration / MIN).toBeGreaterThanOrEqual(duration[0] - 2);
      expect(timeline.totals.duration / MIN).toBeLessThanOrEqual(duration[1] + 2);
      expectNear(toLitres(timeline.totals.mainsWater), outline, 1e-9);
      const printedWater = must(must(programme.declared.printed).mainsWater);
      expectNear(toLitres(printedWater[0]), water[0], 1e-9);
      expectNear(toLitres(printedWater[1]), water[1], 1e-9);
      // Every programme leaves the heat exchanger full for the next run.
      expectNear(toLitres(timeline.totals.prestoreVolumeAtEnd), 3.1, 1e-9);
    },
  );

  it('reproduces the water arithmetic of section 4.2 from the steps', () => {
    // "Eco 4.0 + 0.5 + 2.5 + 2.5 = 9.5; Auto minimum 4.0 + 0.5 + 2.5 = 7.0; Auto maximum
    //  4.0 + 4.0 + 3 x 2.5 = 15.5; Intensive 4.0 + 2 x 2.5 + 2.5 = 11.5; Express 5.5 + 2.5 + 2.5".
    const water = (id: string) =>
      toLitres(
        expandProgramme(BOSCH_SMV4HAX40G, must(findProgramme(BOSCH_SMV4HAX40G, id))).totals
          .mainsWater,
      );
    expectNear(water('eco_50'), 4.0 + 0.5 + 2.5 + 2.5, 1e-9);
    expectNear(water('auto_100_light'), 4.0 + 0.5 + 2.5, 1e-9);
    expectNear(water('auto_165_heavy'), 4.0 + 4.0 + 3 * 2.5, 1e-9);
    expectNear(water('intensive_70'), 4.0 + 2 * 2.5 + 2.5, 1e-9);
    expectNear(water('express_65'), 5.5 + 2.5 + 2.5, 1e-9);
    expectNear(water('auto_145'), 4.0 + 3 * 2.5, 1e-9);
  });

  it('Silence 50 falls 1.5 L short of its printed water, as the dossier says its outline does', () => {
    const programme = must(findProgramme(BOSCH_SMV4HAX40G, 'silence_50'));
    const timeline = expandProgramme(BOSCH_SMV4HAX40G, programme);
    const printedWater = must(must(programme.declared.printed).mainsWater);
    expectNear(toLitres(printedWater[0]) - toLitres(timeline.totals.mainsWater), 1.5, 1e-9);
  });

  it('gives the model energies the dossier quotes, below the printed ones', () => {
    // Section 4.5: "1.06 to 1.10 kWh for Express 65 against the printed 1.300, 1.16 to 1.27 for
    // Intensive 70 against the printed 1.300, and 0.88 for Eco 50 against the label's 0.836",
    // from the programme researcher's model, whose constants give about 0.04 kWh more than
    // those of section 3.1 used here.
    const energy = (id: string) =>
      toKWh(
        expandProgramme(BOSCH_SMV4HAX40G, must(findProgramme(BOSCH_SMV4HAX40G, id))).totals.energy,
      );
    expectNear(energy('express_65'), 1.08, 0.05);
    expect(energy('express_65')).toBeLessThan(1.3);
    expectNear(energy('intensive_70'), 1.16, 0.05);
    expect(energy('intensive_70')).toBeLessThan(1.3);
    expectNear(energy('eco_50'), 0.88, 0.04);
    expect(energy('eco_50')).toBeGreaterThan(0.836);
  });

  it('Express feeds lower and upper arm together; Intensive washes at 3400 rpm and 70 C', () => {
    const express = expandProgramme(
      BOSCH_SMV4HAX40G,
      must(findProgramme(BOSCH_SMV4HAX40G, 'express_65')),
    );
    const fed = new Set(express.segments.flatMap((s) => s.diverter.map((d) => d.feeds.join('+'))));
    expect([...fed]).toEqual(['lower+upper']);
    expect(express.rows.some((r) => r.phase === 'pre_rinse')).toBe(false);
    // "about 5.5 L ... heat to 65 C in about 20 min".
    expectNear(
      toLitres(must(express.segments.find((s) => s.stepId === 'x4_heat')).liquorVolume.end),
      5.5,
      1e-9,
    );
    const heatUp = express.segments
      .filter((s) => s.row === 'X4')
      .reduce((sum, s) => sum + (s.end - s.start), 0);
    expectNear(heatUp / MIN, 20, 1.0);
    const intensive = expandProgramme(
      BOSCH_SMV4HAX40G,
      must(findProgramme(BOSCH_SMV4HAX40G, 'intensive_70')),
    );
    const wash = must(intensive.rows.find((r) => r.row === 'I4'));
    expect(wash.pumpRpm).toBe(3400);
    expect(wash.target).toBe(70);
    expect(must(intensive.rows.find((r) => r.row === 'I10')).target).toBe(69);
  });
});

describe('AUTO of SPOT-60 (machine.md section 7.3)', () => {
  const programme = primaryProgramme(SPOT_60);
  const timeline = expandProgramme(SPOT_60, programme);

  it('has the six rows of the table with their water, targets and pump speeds', () => {
    // [row, water in (L), target (C), pump (rpm), stated duration (min)].
    const table = [
      ['A1', 3.4, null, 2600, 10],
      ['A2', 3.6, 55, 3000, 24],
      ['A3', 0, 55, 3000, 25],
      ['A4', 3.0, null, 2600, 9],
      ['A5', 3.0, 62, 2800, 22],
      ['A6', 0, null, 0, 45],
    ] as const;
    expect(timeline.rows.map((r) => r.row)).toEqual(table.map(([row]) => row));
    for (const [id, water, target, rpm, duration] of table) {
      const row = must(timeline.rows.find((r) => r.row === id));
      expectNear(toLitres(row.mainsWater), water, 1e-9, `${id} water`);
      expect(row.target).toBe(target);
      expect(row.pumpRpm).toBe(rpm);
      // Rows without a heat-up have exactly their stated duration. A2's 24 min is reproduced
      // within 1.5 min; A5's 22 min is not: its heat-up starts from a load at 44 C and takes
      // 15 min here, so the row comes to 19.6 min (see the description of the programme).
      const actual = (row.end - row.start) / MIN;
      if (id === 'A2') expectNear(actual, duration, 1.5, id);
      else if (id === 'A5') expectNear(actual, duration, 3.0, id);
      else expectNear(actual, duration, 1e-9, id);
    }
  });

  it("adds up to 13.0 L, and to the dossier's 135 min within 4 min", () => {
    expect(timeline.problems).toEqual([]);
    expectNear(toLitres(timeline.totals.mainsWater), 13.0, 1e-9);
    expectNear(timeline.totals.duration / MIN, 135, 4);
  });

  it("uses less energy than the table states, inside the dossier's own sanity band", () => {
    // The table's 1.15 kWh is anchored to fleet averages (section 7.2). With the model of
    // section 6.2 its steps need two heat-ups of 2000 W x 0.7: about 21 and 15 min.
    const energy = toKWh(timeline.totals.energy);
    expectNear(timeline.conditions.heaterPower, 1400, 1e-9);
    expectNear(timeline.totals.heaterOnTime / MIN, 36, 1.5);
    // Section 8: "Auto 10 to 14 L, 0.9 to 1.3 kWh ... Heating should be 80 to 90 % of cycle energy."
    expect(energy).toBeGreaterThan(0.9);
    expect(energy).toBeLessThan(1.3);
    expect(energy).toBeLessThan(1.15);
    expectWithin(energy, 1.15, 0.2);
    const share = timeline.totals.heaterEnergy / timeline.totals.energy;
    expect(share).toBeGreaterThan(0.8);
    expect(share).toBeLessThan(0.9);
  });

  it('opens the dispenser 60 s after circulation starts and doses rinse aid at 40 C', () => {
    const release = must(timeline.events.find((e) => e.kind === 'detergent_release'));
    const circulation = must(timeline.segments.find((s) => s.stepId === 'a2_heat'));
    expectNear(release.time - circulation.start, 60, 1e-9);
    const dose = must(timeline.events.find((e) => e.kind === 'rinse_aid_release'));
    if (dose.kind !== 'rinse_aid_release') throw new Error('not a rinse-aid release');
    expectNear(dose.volume, 3e-6, 1e-15);
    expect(dose.temperature).toBeGreaterThanOrEqual(40);
    expect(dose.temperature).toBeLessThan(40.1);
  });

  it('opens the door 25 min into the drying step', () => {
    const open = must(timeline.events.find((e) => e.kind === 'door_open'));
    const dry = must(timeline.segments.find((s) => s.kind === 'dry'));
    expectNear(open.time - dry.start, 25 * MIN, 1e-9);
    if (open.kind !== 'door_open') throw new Error('not a door opening');
    expectNear(open.gap, 0.1, 1e-12);
    // The Bosch keeps its door closed.
    expect(TIMELINE.events.some((e) => e.kind === 'door_open')).toBe(false);
  });

  it('heats the main wash at about 1.6 K/min', () => {
    const heat = must(timeline.segments.find((s) => s.stepId === 'a2_heat'));
    // From 2 min into the step, when the cold fill has come to terms with the warmer load and
    // machine, to its end (samples every 10 s).
    const { time, liquor } = heat.temperature;
    const from = time.findIndex((t) => t >= heat.start + 2 * MIN);
    const rate =
      ((must(liquor[liquor.length - 1]) - must(liquor[from])) / (heat.end - must(time[from]))) *
      MIN;
    // "heater duty 0.7 during heat-up, giving 1.6 K/min full load", plus the pump's 80 W.
    expectNear(rate, 1.6, 0.15);
  });

  it('alternates lower arm with mid and top arm', () => {
    const preRinse = must(timeline.segments.find((s) => s.stepId === 'a1_pre_rinse'));
    expect(must(preRinse.diverter[0]).feeds).toEqual(['lower']);
    expect(must(preRinse.diverter[1]).feeds).toEqual(['mid', 'top']);
    expect(must(preRinse.diverter[1]).transition).toBe(1.5);
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
    const start = must(TIMELINE.segments.find((s) => s.stepId === 'a4_heat')).start;
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
    const start = must(TIMELINE.segments.find((s) => s.stepId === 'a9_circulate')).start;
    const late = changed((spec) => {
      spec.dosing.rinseAidDelay = 80;
    });
    expectNear(eventTime(late, 'rinse_aid_release') - start, 80, 1e-9);
    // A minimum of 60 C is not met when the delay has passed (the liquor is at about 45 C): the
    // dose waits for the heat-up to reach it.
    const hot = changed((spec) => {
      spec.dosing.rinseAidMinTemperature = 60;
    });
    const dose = must(hot.events.find((e) => e.kind === 'rinse_aid_release'));
    if (dose.kind !== 'rinse_aid_release') throw new Error('not a rinse-aid release');
    expect(dose.time - start).toBeGreaterThan(5 * MIN);
    expect(dose.temperature).toBeGreaterThanOrEqual(60);
    expect(dose.temperature).toBeLessThan(60.1);
    expect(must(timelineStateAt(hot, dose.time)).segment.stepId).toBe('a10_heat');
    // A minimum that the final rinse never reaches: nothing is dosed, and the timeline says so.
    const never = changed((spec) => {
      spec.dosing.rinseAidMinTemperature = 75;
    });
    expect(never.events.some((e) => e.kind === 'rinse_aid_release')).toBe(false);
    expect(never.problems.map((p) => `${p.code}:${p.stepId}`)).toContain(
      'dose_not_released:a9_rinse_aid',
    );
  });

  it('never heats beyond thermal.heaterCutOut and reports a target above it', () => {
    const timeline = changed((spec) => {
      spec.thermal.heaterCutOut = 50;
    });
    const peak = Math.max(...timeline.segments.flatMap((s) => [...s.temperature.liquor]));
    expect(peak).toBeLessThan(50.1);
    expect(peak).toBeGreaterThanOrEqual(50);
    const codes = timeline.problems.map((p) => `${p.code}:${p.stepId}`);
    expect(codes).toContain('target_above_cut_out:a4_heat');
    expect(codes).toContain('target_above_cut_out:a10_heat');
    // The heat steps end at the cut-out instead of running into their timeout.
    expect(timeline.problems.some((p) => p.code === 'heat_timeout')).toBe(false);
    expect(timeline.totals.heaterEnergy).toBeLessThan(0.75 * TIMELINE.totals.heaterEnergy);
    // The shipped machine heats to 65 and 69 C under a cut-out of 75 C: nothing to report.
    expect(TIMELINE.problems).toEqual([]);
  });

  it('takes as long over a fill as fill.inletFlow needs, and at least the length of its row', () => {
    const fillOf = (timeline: ProgrammeTimeline, stepId: string) =>
      must(timeline.segments.find((s) => s.stepId === stepId));
    // Row A3: 2.5 L at 2.5 L/min is 60 s; the row allows 90 s.
    const normal = fillOf(TIMELINE, 'a3_fill');
    expectNear(normal.end - normal.start, 90, 1e-9);
    // At 0.5 L/min the same 2.5 L take 300 s, and the first fill's 0.9 L of mains water 108 s.
    const slow = changed((spec) => {
      spec.hydraulics.fill.inletFlow = 0.5 / 60000;
    });
    expectNear(fillOf(slow, 'a3_fill').end - fillOf(slow, 'a3_fill').start, 300, 1e-6);
    expectNear(fillOf(slow, 'a1_fill').end - fillOf(slow, 'a1_fill').start, 108, 1e-6);
    expect(slow.totals.duration - TIMELINE.totals.duration).toBeGreaterThan(200);
    // A slower tank discharge lengthens the transfers of the rinses: 2.5 L at 2.5 L/min, 60 s.
    const slowTank = changed((spec) => {
      spec.hydraulics.fill.prestoreDischargeFlow = 2.5 / 60000;
    });
    expectNear(fillOf(slowTank, 'a9_fill').end - fillOf(slowTank, 'a9_fill').start, 60, 1e-6);
  });

  it('takes as long over a drain as drain.flow needs, and at least the length of its step', () => {
    const drainOf = (timeline: ProgrammeTimeline) =>
      must(timeline.segments.find((s) => s.stepId === 'a6_drain'));
    expectNear(drainOf(TIMELINE).end - drainOf(TIMELINE).start, 90, 1e-9);
    // 4.0 L less the 0.4 L carry-over at 1 L/min: 216 s.
    const slow = changed((spec) => {
      spec.hydraulics.drain.flow = 1 / 60000;
    });
    expectNear(drainOf(slow).end - drainOf(slow).start, 216, 1e-6);
  });

  it('runs the wash in hydraulics.diverter.defaultPattern and dries for drying.defaultDuration', () => {
    const wash = must(AUTO.steps.find((s) => s.id === 'a4_heat'));
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
    const preRinse = must(timeline.segments.find((s) => s.stepId === 'a2_pre_rinse'));
    expect(preRinse.diverter.slice(0, 3).map((d) => [d.position, d.end - d.start])).toEqual([
      ['ur', 30],
      ['l', 90],
      ['ur', 30],
    ]);
    // The rinses keep the pattern their steps fix (45 s dwells).
    const rinse = must(timeline.segments.find((s) => s.stepId === 'a7_rinse'));
    expectNear(must(rinse.diverter[0]).end - must(rinse.diverter[0]).start, 45, 1e-9);
    const dry = must(timeline.segments.find((s) => s.kind === 'dry'));
    expectNear(dry.end - dry.start, 55 * MIN, 1e-9);
    // The tank is still filled at 5, 30 and 55 % of the drying step.
    const fills = timeline.events.filter(
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
    const survivable = expandProgramme(BOSCH_SMV4HAX40G, AUTO, {
      heldWater: (step) => (step.phase === 'main_wash' ? { trapped: 1.0e-3 } : {}),
    });
    expect(survivable.problems).toEqual([]);
    expect(survivable.events.some((e) => e.kind === 'top_up')).toBe(false);

    const trapped = 2.2e-3;
    const timeline = expandProgramme(BOSCH_SMV4HAX40G, AUTO, {
      heldWater: (step) => (step.phase === 'main_wash' ? { trapped } : {}),
    });
    const topUps = timeline.events.filter((e) => e.kind === 'top_up');
    expect(topUps).toHaveLength(1);
    const topUp = must(topUps[0]);
    if (topUp.kind !== 'top_up') throw new Error('not a top-up');
    expectNear(topUp.volume, 0.5e-3, 1e-12);
    expectNear(topUp.liquorVolume, 4.5e-3, 1e-9);
    // It is drawn when the wash circulation starts, and it is mains water.
    const heat = must(timeline.segments.find((s) => s.stepId === 'a4_heat'));
    expect(topUp.time).toBeGreaterThanOrEqual(heat.start);
    expect(topUp.time).toBeLessThan(heat.start + 2 * MIN);
    expectNear(toLitres(timeline.totals.mainsWater), 11.5 + 0.5, 1e-6);
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
      expandProgramme(BOSCH_SMV4HAX40G, AUTO, {
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
    expect(steps).toContain('a7_rinse');
    expect(steps).toContain('a10_heat');
    // The starved state delivers less than the primed one, by the fixed point of
    // `primedOperatingPoint` with the same trapped water.
    const rinse = must(starved.segments.find((s) => s.stepId === 'a7_rinse'));
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
    expectNear(toLitres(larger.totals.mainsWater), 11.5 + 0.8, 1e-6);
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
    const timeline = expandProgramme(BOSCH_SMV4HAX40G, AUTO, { heldWater: { trapped: 1.2e-3 } });
    const steps = timeline.problems.filter((p) => p.code === 'pump_starved').map((p) => p.stepId);
    expect(steps).toContain('a7_rinse');
    expect(must(timeline.segments.find((s) => s.stepId === 'a2_pre_rinse')).heldWater).toBe(1.2e-3);
    // Segments without the pump hold nothing back from it.
    expect(must(timeline.segments.find((s) => s.kind === 'dry')).heldWater).toBe(0);
  });
});

describe('rows of a timeline', () => {
  it('keeps the row of a heat step whose target is already met', () => {
    // The final rinse comes out of the tank and off the hot load at about 45 C: a target of
    // 40 C is met before the step begins, so it takes no time.
    const cool = mutableCopy(AUTO);
    for (const step of cool.steps) {
      if (step.id === 'a10_heat' && step.kind === 'heat') step.target = 40;
      if (step.id === 'a11_hold' && step.kind === 'hold') step.target = 40;
    }
    const timeline = expandProgramme(BOSCH_SMV4HAX40G, cool);
    expect(timeline.segments.some((s) => s.stepId === 'a10_heat')).toBe(false);
    expect(timeline.rows.map((r) => r.row)).toEqual(TIMELINE.rows.map((r) => r.row));
    expect(timeline.rows).toHaveLength(14);
    const row = must(timeline.rows.find((r) => r.row === 'A10'));
    expect(row.end - row.start).toBe(0);
    expect(row.heaterOnTime).toBe(0);
    expect(row.target).toBe(40);
    // It sits between its neighbours.
    const before = must(timeline.rows.find((r) => r.row === 'A9'));
    const after = must(timeline.rows.find((r) => r.row === 'A11'));
    expect(row.start).toBe(before.end);
    expect(after.start).toBe(row.end);
    expect(timeline.problems).toEqual([]);
  });

  it('lays the rows end to end over the whole programme for every shipped programme', () => {
    for (const spec of [BOSCH_SMV4HAX40G, SPOT_60]) {
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
