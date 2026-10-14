import {
  armSteadyState,
  expandProgramme,
  hydraulicOperatingPoint,
  PRIMARY_MACHINE,
  primaryProgramme,
  timelineStateAt,
  type ProgrammeSpec,
} from '@spotless/machine';
import { describe, expect, it } from 'vitest';
import {
  WASH_RECORD_FORMAT,
  type RecordCourse,
  type RecordMachine,
  type WashRecord,
} from './record.ts';
import {
  courseOfTimeline,
  heaterEventsFromPower,
  machineOfRecord,
  programmeOfRecord,
  RecordSetupError,
  withNumberAt,
} from './setup.ts';

function record(machine: Partial<RecordMachine> = {}, extra: Partial<WashRecord> = {}): WashRecord {
  return {
    format: WASH_RECORD_FORMAT,
    version: 1,
    id: 'setup-test',
    kind: 'synthetic',
    provenance: { methods: { m: { description: 'test' } } },
    machine: { id: 'bosch_smv4hax40g', ...machine },
    programme: { id: 'eco_50' },
    load: { items: [] },
    observations: [],
    ...extra,
  };
}

describe('withNumberAt', () => {
  const root = {
    a: {
      b: 1,
      list: [
        { id: 'x', v: 2 },
        { id: 'y', v: 3 },
      ],
    },
    c: [10, 20],
  };

  it('replaces a number by its path and shares everything off the path', () => {
    const next = withNumberAt(root, 'a.list[y].v', 9);
    expect(next.a.list[1]?.v).toBe(9);
    expect(root.a.list[1]?.v).toBe(3);
    expect(next.a.list[0]).toBe(root.a.list[0]);
    expect(next.c).toBe(root.c);
    expect(withNumberAt(root, 'c[1]', 5).c).toEqual([10, 5]);
    expect(withNumberAt(root, 'a.list[0].v', 7).a.list[0]?.v).toBe(7);
  });

  it('refuses a path that leads nowhere or to something that is not a number', () => {
    expect(() => withNumberAt(root, 'a.nope', 1)).toThrow(/no "nope"/);
    expect(() => withNumberAt(root, 'a.list[z].v', 1)).toThrow(/no element "z"/);
    expect(() => withNumberAt(root, 'a.list', 1)).toThrow(/not a number/);
    expect(() => withNumberAt(root, '', 1)).toThrow(RecordSetupError);
  });
});

describe('machineOfRecord', () => {
  it('returns the catalogue machine untouched when nothing was measured', () => {
    const setup = machineOfRecord(record());
    expect(setup.spec).toBe(PRIMARY_MACHINE);
    expect(setup.config).toBe(PRIMARY_MACHINE.defaultConfig);
    expect(setup.changes).toEqual([]);
  });

  it('sets the bore and the area of a measured nozzle, and nothing else', () => {
    const setup = machineOfRecord(
      record({
        measured: [
          { quantity: 'nozzle_diameter', level: 'lower', nozzle: 'l3', value_mm: 3.0, method: 'm' },
        ],
      }),
    );
    const lower = setup.spec.sprayLevels.find((l) => l.id === 'lower');
    const nozzle = lower?.nozzles.find((n) => n.id === 'l3');
    expect(nozzle?.size[0]).toBeCloseTo(0.003, 12);
    expect(nozzle?.area).toBeCloseTo((Math.PI * 0.003 ** 2) / 4, 15);
    expect(lower?.nozzles.find((n) => n.id === 'l2')?.size[0]).toBeCloseTo(0.0033, 12);
    expect(PRIMARY_MACHINE.sprayLevels[0]?.nozzles.find((n) => n.id === 'l3')?.size[0]).toBeCloseTo(
      0.0033,
      12,
    );
    expect(setup.changes).toHaveLength(2);
    // A slot is not a bore.
    expect(() =>
      machineOfRecord(
        record({
          measured: [
            { quantity: 'nozzle_diameter', level: 'lower', nozzle: 'l9', value_mm: 3, method: 'm' },
          ],
        }),
      ),
    ).toThrow(/not a round bore/);
    expect(() =>
      machineOfRecord(
        record({
          measured: [
            {
              quantity: 'nozzle_diameter',
              level: 'lower',
              nozzle: 'l99',
              value_mm: 3,
              method: 'm',
            },
          ],
        }),
      ),
    ).toThrow(/no nozzle "l99"/);
  });

  it('makes the arm model turn at a measured rotation rate', () => {
    // The specification gives 42.0 rev/min for the lower arm at 3000 rev/min of the pump.
    const setup = machineOfRecord(
      record({
        measured: [
          {
            quantity: 'arm_speed',
            level: 'lower',
            position: 'l',
            pump_rpm: 3000,
            value_rpm: 35,
            method: 'm',
          },
        ],
      }),
    );
    const arm = setup.spec.sprayLevels.find((l) => l.id === 'lower');
    if (arm === undefined || arm.kind !== 'arm') throw new Error('no arm');
    const point = hydraulicOperatingPoint(setup.spec, 'l', 3000, {
      basketHeights: setup.config.basketHeights,
    });
    const pressure = point.branches.find((b) => b.id === 'lower')?.armPressure ?? 0;
    expect(armSteadyState(arm, pressure).rpm).toBeCloseTo(35, 6);
    // Faster than the arm turns without any friction cannot be had from the bearing.
    expect(() =>
      machineOfRecord(
        record({
          measured: [
            {
              quantity: 'arm_speed',
              level: 'lower',
              position: 'l',
              pump_rpm: 3000,
              value_rpm: 120,
              method: 'm',
            },
          ],
        }),
      ),
    ).toThrow(/without any bearing friction the model gives 76\.9 rev\/min/);
    expect(() =>
      machineOfRecord(
        record({
          measured: [
            {
              quantity: 'arm_speed',
              level: 'upper',
              position: 'l',
              pump_rpm: 3000,
              value_rpm: 30,
              method: 'm',
            },
          ],
        }),
      ),
    ).toThrow(/not fed in diverter position "l"/);
  });

  it('applies overrides by path, the dose, the rinse aid and the water', () => {
    const setup = machineOfRecord(
      record(
        {
          basket_heights: { upper: '2' },
          measured: [
            { quantity: 'spec', path: 'dosing.detergentReleaseDelay', value: 150, method: 'm' },
          ],
        },
        {
          consumables: {
            detergent: { product: 'X', form: 'tablet', dose_g: 17.4 },
            rinse_aid: { dose_ml: 3 },
            water: { inlet_temperature_c: 11.5, ambient_temperature_c: 19 },
          },
        },
      ),
    );
    expect(setup.spec.dosing.detergentReleaseDelay).toBe(150);
    expect(setup.spec.dosing.detergentMass).toBeCloseTo(0.0174, 12);
    expect(setup.spec.dosing.rinseAidVolume).toBeCloseTo(3e-6, 15);
    expect(setup.spec.thermal.inletTemperature).toBe(11.5);
    expect(setup.spec.thermal.ambientTemperature).toBe(19);
    expect(setup.config.basketHeights['upper']).toBe('2');
    expect(setup.changes.join('\n')).toMatch(/dosing\.detergentMass = 0\.0174 \(dose of X\)/);
    // No detergent at all is a dose of zero.
    const none = machineOfRecord(
      record({}, { consumables: { detergent: { product: '-', form: 'none', dose_g: 0 } } }),
    );
    expect(none.spec.dosing.detergentMass).toBe(0);
  });

  it('refuses a path the specification does not have, and an unknown machine', () => {
    expect(() =>
      machineOfRecord(
        record({ measured: [{ quantity: 'spec', path: 'thermal.colour', value: 1, method: 'm' }] }),
      ),
    ).toThrow(/has no "colour"/);
    expect(() => machineOfRecord(record({ id: 'nope' }))).toThrow(/unknown machine "nope"/);
  });
});

describe('heaterEventsFromPower', () => {
  it('reads heater switching from a power log, bridging pauses and dropping bursts', () => {
    const t: number[] = [];
    const p: number[] = [];
    for (let s = 0; s <= 3000; s += 10) {
      t.push(s);
      const heating =
        (s >= 900 && s < 1900 && !(s >= 1400 && s < 1420)) || // a 20 s pause inside the heat-up
        (s >= 2500 && s < 2510); // a 10 s burst
      p.push(heating ? 2150 : s >= 100 && s < 2800 ? 60 : 3);
    }
    const events = heaterEventsFromPower(t, p, 2100);
    expect(events.map((e) => e.kind)).toEqual(['heater_on', 'heater_off']);
    // Switches are placed half way between the readings either side: to 5 s.
    expect(events[0]?.t_s).toBeCloseTo(895, 6);
    expect(events[1]?.t_s).toBeCloseTo(1895, 6);
  });
});

describe('programmeOfRecord', () => {
  const spec = PRIMARY_MACHINE;
  const nominal = primaryProgramme(spec);

  /** Eco 50 as it would run with another main-wash target and hold. */
  function variant(target: number, hold: number): ProgrammeSpec {
    return {
      ...nominal,
      steps: nominal.steps.map((step) =>
        step.id === 'e4_heat'
          ? { ...step, target }
          : step.id === 'e5_hold' && step.kind === 'hold'
            ? {
                ...step,
                target,
                duration: hold,
                prestoreFills: [{ at: hold - 900, volume: 0.0025 }],
              }
            : step,
      ),
    };
  }

  it('is the nominal programme without a course', () => {
    const setup = programmeOfRecord(record(), spec, spec.defaultConfig);
    expect(setup.programme).toBe(nominal);
    expect(setup.adapted).toBe(false);
  });

  it('applies direct statements about steps', () => {
    const course: RecordCourse = {
      steps: [
        { step: 'e4_heat', target_c: 52 },
        { step: 'e5_hold', duration_s: 1500 },
        { step: 'e1_fill', mains_volume_l: 1.4 },
      ],
    };
    const setup = programmeOfRecord(
      record({}, { programme: { id: 'eco_50', course } }),
      spec,
      spec.defaultConfig,
    );
    const step = (id: string) => setup.programme.steps.find((s) => s.id === id);
    expect(step('e4_heat')).toMatchObject({ target: 52 });
    // The hold after a heat-up follows its target.
    expect(step('e5_hold')).toMatchObject({ target: 52, duration: 1500 });
    const fill = step('e1_fill');
    expect(
      fill?.kind === 'fill' ? fill.sources.find((s) => s.from === 'mains')?.volume : 0,
    ).toBeCloseTo(0.0014, 12);
    expect(setup.changes.every((c) => c.source === 'stated')).toBe(true);
    const timeline = expandProgramme(spec, setup.programme, {});
    const heat = timeline.segments.find((s) => s.stepId === 'e4_heat');
    expect(heat?.temperature.liquor.at(-1)).toBeCloseTo(52, 0);
  });

  it('recovers the course of a run from its events and a liquor temperature log', () => {
    // A run whose main wash reached 55 C and was held for 30 min, as a plug and a probe would record it.
    const truth = expandProgramme(spec, variant(55, 1800), {});
    const course = courseOfTimeline(truth, { interval: 30, method: 'm' });
    delete (course as { power_log?: unknown }).power_log;
    const setup = programmeOfRecord(
      record({}, { programme: { id: 'eco_50', course } }),
      spec,
      spec.defaultConfig,
    );
    expect(setup.adapted).toBe(true);
    const adapted = expandProgramme(spec, setup.programme, {});
    // The main wash reaches the logged temperature to half a kelvin ...
    const heat = adapted.segments.find((s) => s.stepId === 'e4_heat');
    expect(Math.abs((heat?.temperature.liquor.at(-1) ?? 0) - 55)).toBeLessThan(0.5);
    // ... every fill and drain is where it was measured, to 2 s, and the run is as long.
    for (const anchor of setup.check.anchors) {
      if (anchor.kind === 'fill' || anchor.kind === 'drain') {
        expect(
          Math.abs(anchor.model_s - anchor.measured_s),
          `${anchor.kind} at ${anchor.measured_s}`,
        ).toBeLessThanOrEqual(2);
      }
    }
    expect(Math.abs(adapted.totals.duration - truth.totals.duration)).toBeLessThanOrEqual(2);
    expect(setup.check.duration?.measured_s).toBe(truth.totals.duration);
    // The liquor temperature follows the log to 1 K rms; the nominal programme misses it by more.
    expect(setup.check.temperature?.rms_K ?? 99).toBeLessThan(1);
    let square = 0;
    let n = 0;
    const nominalTimeline = expandProgramme(spec, nominal, {});
    course.temperature_log?.t_s.forEach((t, i) => {
      const state = timelineStateAt(nominalTimeline, t);
      if (state === undefined) return;
      square += (state.liquorTemperature - (course.temperature_log?.values[i] ?? 0)) ** 2;
      n++;
    });
    expect(Math.sqrt(square / n)).toBeGreaterThan(3 * (setup.check.temperature?.rms_K ?? 99));
    expect(setup.changes.map((c) => `${c.step}.${c.field}`)).toContain('e4_heat.target');
    expect(setup.changes.map((c) => `${c.step}.${c.field}`)).toContain('e5_hold.duration');
  });

  it('turns heater-on time into temperature when there is only a power log', () => {
    const truth = expandProgramme(spec, variant(52, 2400), {});
    const full = courseOfTimeline(truth, { interval: 5, method: 'm' });
    const course: RecordCourse = {
      duration_s: full.duration_s as number,
      power_log: full.power_log as NonNullable<RecordCourse['power_log']>,
      events: (full.events ?? []).filter((e) => e.kind === 'fill' || e.kind === 'drain'),
    };
    const setup = programmeOfRecord(
      record({}, { programme: { id: 'eco_50', course } }),
      spec,
      spec.defaultConfig,
    );
    const heat = expandProgramme(spec, setup.programme, {}).segments.find(
      (s) => s.stepId === 'e4_heat',
    );
    // The heater went off after the time 52 C takes; the thermal model gives the target back to 1.5 K.
    expect(Math.abs((heat?.temperature.liquor.at(-1) ?? 0) - 52)).toBeLessThan(1.5);
    const off = setup.check.anchors.filter((a) => a.kind === 'heater_off')[0];
    expect(Math.abs((off?.model_s ?? 0) - (off?.measured_s ?? 99))).toBeLessThanOrEqual(6);
    expect(setup.check.energy?.model_kWh ?? 0).toBeGreaterThan(
      0.9 * (setup.check.energy?.measured_kWh ?? 99),
    );
    expect(setup.check.energy?.model_kWh ?? 99).toBeLessThan(
      1.1 * (setup.check.energy?.measured_kWh ?? 0),
    );
  });

  it('does not use events whose number does not fit the programme, and says so', () => {
    const course: RecordCourse = { events: [{ kind: 'drain', t_s: 4000 }] };
    const setup = programmeOfRecord(
      record({}, { programme: { id: 'eco_50', course } }),
      spec,
      spec.defaultConfig,
    );
    expect(setup.adapted).toBe(false);
    expect(setup.notes.join('\n')).toMatch(/1 measured drain events against 5 in programme eco_50/);
  });

  it('compares a probe that is not in the liquor without letting it set targets', () => {
    const truth = expandProgramme(spec, variant(55, 1800), {});
    const made = courseOfTimeline(truth, { interval: 60, method: 'm' });
    const course: RecordCourse = {
      temperature_log: {
        ...(made.temperature_log as NonNullable<RecordCourse['temperature_log']>),
        where: 'air_upper_rack',
      },
    };
    const setup = programmeOfRecord(
      record({}, { programme: { id: 'eco_50', course } }),
      spec,
      spec.defaultConfig,
    );
    expect(setup.changes).toEqual([]);
    expect(setup.notes.join('\n')).toMatch(/not in the liquor/);
  });
});
