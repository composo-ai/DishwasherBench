import { describe, expect, it } from 'vitest';
import { getSprayArm } from './config.ts';
import { BOSCH_SMV4HAX40G_DEF } from './data/bosch-smv4hax40g.ts';
import { SPOT60_DEF } from './data/spot60.ts';
import type { BasketDef, MachineDef, ProgrammeDef } from './def.ts';
import {
  DEFAULT_HEAT_TIMEOUT_MIN,
  JOULES_PER_KWH,
  loadDiverterPattern,
  loadMachineSpec,
  loadProgrammeSpec,
  nozzleArea,
} from './load.ts';
import { BOSCH_SMV4HAX40G, MACHINES, SPOT_60 } from './machines.ts';
import { floorReliefMax, floorRiseAt } from './outline.ts';
import { expectNear, expectWithin, must, mutableCopy } from './test-util.ts';

describe('nozzleArea', () => {
  it('is pi d^2 / 4 for a round bore', () => {
    expectWithin(nozzleArea('round', [0.003]), (Math.PI * 9e-6) / 4, 1e-15);
    // 3.0 mm: 7.07 mm2; 6.0 mm: 28.3 mm2 (the dossier's tables).
    expectNear(nozzleArea('round', [0.003]) * 1e6, 7.07, 0.005);
    expectNear(nozzleArea('round', [0.006]) * 1e6, 28.27, 0.005);
  });

  it('is a stadium for a slot: w (L - w) + pi w^2 / 4, whichever size comes first', () => {
    // 4.0 x 2.0 mm: 2 x 2 + pi = 7.14 mm2; 1.8 x 5.0 mm: 1.8 x 3.2 + pi 0.81 = 8.30 mm2.
    expectNear(nozzleArea('slot', [0.004, 0.002]) * 1e6, 4 + Math.PI, 1e-9);
    expectNear(nozzleArea('slot', [0.004, 0.002]) * 1e6, 7.14, 0.005);
    expectNear(nozzleArea('slot', [0.0018, 0.005]) * 1e6, 8.3, 0.005);
    expect(nozzleArea('slot', [0.005, 0.0018])).toBe(nozzleArea('slot', [0.0018, 0.005]));
    // A slot as long as it is wide is a round bore.
    expectWithin(nozzleArea('slot', [0.003, 0.003]), nozzleArea('round', [0.003]), 1e-12);
  });

  it('is length x width for a rectangular opening', () => {
    expectNear(nozzleArea('rect', [0.0025, 0.0025]) * 1e6, 6.25, 1e-9);
    expectNear(nozzleArea('rect', [0.004, 0.001]) * 1e6, 4, 1e-9);
  });
});

/** A small basket definition in a frame of its own, to check the move into the rack frame. */
function sampleBasket(): BasketDef {
  const lower = must(SPOT60_DEF.baskets.find((b) => b.id === 'lower'));
  return {
    ...lower,
    // Authoring frame: origin 100 mm right of and 40 mm behind the lower-arm axis; the basket's
    // front-left corner at (-200, -150) in it; the grid top 3 mm above its z = 0.
    local: { originInTubMm: [100, 40], frontLeftMm: [-200, -150], gridTopZMm: 3 },
    outline: {
      ...lower.outline,
      sizeMm: [400, 300],
      rimCentresMm: [394, 294],
      recesses: [{ side: 'rear', spanMm: [20, -20], depthMm: 5, rampMm: 10 }],
    },
    pose: { ...lower.pose, heightPositions: [{ id: 'fixed', label: 'fixed', datumZMm: 60 }] },
    walls: [{ side: 'left', horizontalWireZMm: [103, 53], uprightsMm: [50, -50] }],
    floor: {
      ...lower.floor,
      alongY: {
        positionsMm: [100, -100, 0],
        pitchMm: 100,
        zMm: 1,
        spanMm: [140, -140],
        humps: [],
        crankMm: 0,
      },
      alongX: {
        positionsMm: [-50, 50],
        pitchMm: 100,
        zMm: -3,
        spanMm: [-190, 190],
        humps: [{ fromMm: 60, toMm: 20, riseMm: 12 }],
        crankMm: 0,
      },
      // A ridge 30 mm high at x = +50 of the authoring frame, given out of order.
      relief: {
        axis: 'x',
        pointsMm: [
          [100, 0],
          [50, 30],
          [0, 0],
        ],
      },
    },
    tineRows: [
      {
        ...must(lower.tineRows[0]),
        id: 'row',
        runs: 'x',
        railAtMm: 30,
        railZMm: 13,
        railSpanMm: [150, -150],
        tinePositionsMm: [100, -100, 0],
        leanToward: ['+x', '-x', '+y'],
        heightMm: 60,
        leanDeg: 15,
      },
    ],
    wheels: { ...must(lower.wheels), stationsYMm: [100, -100], axleZMm: -7 },
  };
}

describe('loadMachineSpec: frames', () => {
  const def: MachineDef = {
    ...SPOT60_DEF,
    baskets: [sampleBasket()],
    cutleryBasket: null,
    sprayLevels: SPOT60_DEF.sprayLevels.filter((l) => l.mount.kind === 'tub'),
  };
  const basket = must(loadMachineSpec(def).baskets[0]);

  it('puts the rack-frame origin at the front-left corner, at the top of the base grid', () => {
    // Tub position of the corner: (100 - 200, 40 - 150) = (-100, -110) mm; grid top 60 + 3 mm.
    expectNear(basket.pose.originXY[0], -0.1, 1e-12);
    expectNear(basket.pose.originXY[1], -0.11, 1e-12);
    expectNear(must(basket.pose.heightPositions[0]).originZ, 0.063, 1e-12);
    expect(basket.outline.size).toEqual([0.4, 0.3]);
  });

  it('moves every coordinate into the rack frame and orders it', () => {
    // x_rack = x + 200, y_rack = y + 150, z_rack = z - 3 (mm).
    expect(basket.floor.alongY.positions.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([
      100, 200, 300,
    ]);
    expect(basket.floor.alongX.positions.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([100, 200]);
    expectNear(basket.floor.alongY.z, -0.002, 1e-12);
    expectNear(basket.floor.alongX.z, -0.006, 1e-12);
    // Spans run along the wires: y for the front-back family, x for the other.
    expect(basket.floor.alongY.span.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([10, 290]);
    expect(basket.floor.alongX.span.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([10, 390]);
    const hump = must(basket.floor.alongX.humps[0]);
    expect([hump.from, hump.to].map((v) => Math.round(v * 1e6) / 1e3)).toEqual([220, 260]);
    expectNear(hump.rise, 0.012, 1e-12);
    const wall = must(basket.walls[0]);
    expect(wall.horizontalWireZ.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([50, 100]);
    expect(wall.uprights.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([100, 200]);
    const recess = must(basket.outline.recesses[0]);
    expect(recess.span.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([180, 220]);
    const wheels = must(basket.wheels);
    expect(wheels.stationsY.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([50, 250]);
    expectNear(wheels.axleZ, -0.01, 1e-12);
  });

  it('moves a floor relief into the rack frame, in metres and in order, and leaves a flat floor null', () => {
    // x_rack = x + 200 mm.
    const relief = must(basket.floor.relief);
    expect(relief.axis).toBe('x');
    expect(relief.points.map((p) => [Math.round(p.at * 1e6) / 1e3, p.rise])).toEqual([
      [200, 0],
      [250, 0.03],
      [300, 0],
    ]);
    // Linear between the points, constant beyond them.
    expectNear(floorRiseAt(basket.floor, 0.225, 0.1), 0.015, 1e-12);
    expectNear(floorRiseAt(basket.floor, 0.25, 0.9), 0.03, 1e-12);
    expectNear(floorRiseAt(basket.floor, 0.29, 0), 0.006, 1e-12);
    expect(floorRiseAt(basket.floor, 0.1, 0)).toBe(0);
    expect(floorRiseAt(basket.floor, 0.39, 0)).toBe(0);
    expectNear(floorReliefMax(basket.floor), 0.03, 1e-12);
    // SPOT-60's own baskets have flat floors.
    for (const flat of loadMachineSpec(SPOT60_DEF).baskets) {
      expect(flat.floor.relief).toBeNull();
      expect(floorRiseAt(flat.floor, 0.1, 0.1)).toBe(0);
      expect(floorReliefMax(flat.floor)).toBe(0);
    }
  });

  it('keeps each tine with its lean direction when it orders the row', () => {
    const row = must(basket.tineRows[0]);
    expectNear(row.railAt, 0.18, 1e-12);
    expectNear(row.railZ, 0.01, 1e-12);
    expect(row.railSpan.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([50, 350]);
    expect(row.tinePositions.map((v) => Math.round(v * 1e6) / 1e3)).toEqual([100, 200, 300]);
    // Bases at x = -100, 0, +100 lean -x, +y, +x.
    expect(row.leanToward).toEqual(['-x', '+y', '+x']);
    expectNear(row.height, 0.06, 1e-12);
    expectNear(row.lean, (15 * Math.PI) / 180, 1e-15);
  });

  it('refuses a row whose lean list does not match its tines', () => {
    const broken = sampleBasket();
    const row = must(broken.tineRows[0]);
    const bad: BasketDef = { ...broken, tineRows: [{ ...row, leanToward: ['+x', '-x'] }] };
    expect(() => loadMachineSpec({ ...def, baskets: [bad] })).toThrow(RangeError);
    // A cutlery basket placed in a basket the machine does not have cannot be placed.
    expect(() =>
      loadMachineSpec({ ...def, cutleryBasket: must(SPOT60_DEF.cutleryBasket) }),
    ).not.toThrow();
    const stray = {
      ...must(SPOT60_DEF.cutleryBasket),
      defaultPlacement: { basketId: 'nowhere', centreMm: [0, 0] as const, longAxis: 'y' as const },
    };
    expect(() => loadMachineSpec({ ...def, cutleryBasket: stray })).toThrow(RangeError);
  });

  it('places the cutlery basket in the frame of the basket it stands in', () => {
    const cutlery = must(BOSCH_SMV4HAX40G.cutleryBasket);
    // (8, -133) from the rim centre of a 525 x 512 mm basket is (270.5, 123) from its corner.
    expectNear(cutlery.defaultPlacement.centre[0], 0.2705, 1e-12);
    expectNear(cutlery.defaultPlacement.centre[1], 0.123, 1e-12);
  });
});

describe('loadMachineSpec: units', () => {
  it('converts lengths, angles, volumes, flows, masses, times and energies', () => {
    const spec = BOSCH_SMV4HAX40G;
    const def = BOSCH_SMV4HAX40G_DEF;
    // mm to m.
    expect(spec.tub.x[1]).toBe(def.tub.xMm[1] / 1000);
    expect(spec.tub.verticalCornerRadius).toBe(0.03);
    // degrees to radians.
    expectNear(spec.tub.floorSlope, (4 * Math.PI) / 180, 1e-15);
    expectNear(spec.door.openAngle, Math.PI / 2, 1e-15);
    // litres and millilitres to m^3.
    expect(spec.sump.workingVolume).toBe(1.2 / 1000);
    expect(spec.dispenser.rinseAidReservoir).toBe(80 / 1e6);
    // L/min to m^3/s.
    expectWithin(spec.hydraulics.fill.inletFlow, 2.5 / 60000, 1e-15);
    // cm2 and mm2 to m^2.
    expect(spec.filter.micro.area).toBe(230 / 1e4);
    expectWithin(must(spec.hydraulics.branches[0]).statedCdA, 76.4e-6, 1e-12);
    // grams to kg.
    expectNear(must(spec.cutleryBasket).mass, 0.338, 1e-15);
    // minutes to seconds, kWh to joules.
    expect(spec.drying.defaultDuration).toBe(2400);
    expect(must(spec.softener).extraDuration).toBe(420);
    expectWithin(must(spec.softener).extraEnergy, 0.05 * JOULES_PER_KWH, 1e-15);
    expect(JOULES_PER_KWH).toBe(3.6e6);
    // rpm to rad/s for the design speed; pump speeds stay in rpm.
    expectNear(must(getSprayArm(SPOT_60, 'lower').designSpeed), (35 * Math.PI) / 30, 1e-12);
    expect(spec.hydraulics.pump.ratedSpeedRpm).toBe(3000);
    // The feed duct's heights above the stub ends become tub heights.
    const duct = must(spec.feedDuct);
    expectNear(duct.topZ, (-40 + 680) / 1000, 1e-12);
    expectNear(duct.topZ, spec.tub.z[1], 1e-12);
  });

  it("gives every nozzle the machine's velocity coefficient unless it has its own", () => {
    const def = mutableCopy(SPOT60_DEF);
    def.hydraulics.nozzleVelocityCoefficient = 0.97;
    const first = must(must(def.sprayLevels[0]).nozzles[0]);
    first.cv = 0.9;
    const spec = loadMachineSpec(def);
    const nozzles = must(spec.sprayLevels[0]).nozzles;
    expect(must(nozzles[0]).cv).toBe(0.9);
    expect(nozzles.slice(1).every((n) => n.cv === 0.97)).toBe(true);
  });

  it('records the slot axis only where the definition gives one', () => {
    const lower = must(BOSCH_SMV4HAX40G.sprayLevels[0]);
    const axis = (label: string) => must(lower.nozzles.find((n) => n.label === label)).slotAxis;
    // The lower arm's two tip slots lie across the blade; its round holes have no axis, and
    // the orientation of its rectangular underside outlet is not recorded.
    expect(axis('L9')).toBe('tangential');
    expect(axis('L10')).toBe('tangential');
    expect(axis('L1')).toBeNull();
    expect(axis('L8')).toBeNull();
    expect(axis('L11')).toBeNull();
    expect(lower.nozzles.every((n) => n.fan === null)).toBe(true);
    // A rectangular opening keeps its axis too: the upper arm's slots lie along the arm; the
    // orientation of its tip outlets is not recorded.
    const upper = must(BOSCH_SMV4HAX40G.sprayLevels[1]);
    const upperAxis = (label: string) =>
      must(upper.nozzles.find((n) => n.label === label)).slotAxis;
    expect(must(upper.nozzles.find((n) => n.label === 'U3')).shape).toBe('rect');
    expect(upperAxis('U3')).toBe('radial');
    expect(upperAxis('U6')).toBeNull();
    // A round bore never has one, whatever the definition says.
    const def = mutableCopy(SPOT60_DEF);
    const first = must(must(def.sprayLevels[0]).nozzles.find((n) => n.shape === 'round'));
    first.slotAxis = 'radial';
    const loaded = must(loadMachineSpec(def).sprayLevels[0]);
    expect(must(loaded.nozzles.find((n) => n.id === first.id)).slotAxis).toBeNull();
  });

  it('builds the default configuration from the default states', () => {
    expect(BOSCH_SMV4HAX40G.defaultConfig).toEqual({
      basketHeights: { upper: '1' },
      foldedTineRows: [],
      shelves: [
        { basketId: 'upper', shelfId: 'cup_front', state: 'up' },
        { basketId: 'upper', shelfId: 'cup_rear', state: 'up' },
        { basketId: 'upper', shelfId: 'knife_shelf', state: 'down' },
      ],
      cutleryBasket: must(BOSCH_SMV4HAX40G.cutleryBasket).defaultPlacement,
    });
    expect(SPOT_60.defaultConfig.basketHeights).toEqual({ upper: 'mid' });
    // A row that is folded by default appears in the default configuration.
    const def = mutableCopy(BOSCH_SMV4HAX40G_DEF);
    const r2 = must(must(def.baskets[0]).tineRows.find((r) => r.id === 'r2'));
    r2.defaultState = 'folded';
    expect(loadMachineSpec(def).defaultConfig.foldedTineRows).toEqual([
      { basketId: 'lower', rowId: 'r2' },
    ]);
  });
});

describe('loadProgrammeSpec and loadDiverterPattern', () => {
  it('converts minutes, litres, millilitres and kilowatt-hours', () => {
    const def: ProgrammeDef = {
      id: 'p',
      name: 'p',
      description: '',
      steps: [
        {
          id: 'a',
          row: 'A',
          phase: 'main_wash',
          label: '',
          kind: 'fill',
          sources: [{ from: 'mains', volumeL: 3.5 }],
          prestoreFills: [{ atMin: 0.5, volumeL: 1.5 }],
        },
        {
          id: 'b',
          row: 'A',
          phase: 'main_wash',
          label: '',
          kind: 'heat',
          target: 50,
          pumpRpm: 2800,
          diverter: [
            ['l', 45],
            ['u', 30],
          ],
        },
        {
          id: 'c',
          row: 'A',
          phase: 'main_wash',
          label: '',
          kind: 'hold',
          durationMin: 2.5,
          target: 50,
          reheatBand: 2,
          pumpRpm: 2800,
          diverter: [['l', 60]],
          pulse: { on: 50, off: 10 },
        },
        { id: 'd', row: 'A', phase: 'final_rinse', label: '', kind: 'dose_rinse_aid', volumeMl: 3 },
        {
          id: 'e',
          row: 'A',
          phase: 'main_wash',
          label: '',
          kind: 'regenerate',
          durationMin: 7,
          waterL: 5,
          energyKWh: 0.05,
        },
        {
          id: 'f',
          row: 'A',
          phase: 'main_wash',
          label: '',
          kind: 'drain',
          durationMin: 1.5,
          volumeL: 2,
        },
      ],
      conditions: { loadHeatCapacity: 23000, prestoreInitialVolumeL: 3.1, otherEnergyKWh: 0.01 },
      declared: {
        durationMin: 60,
        mainsWaterL: 10.5,
        energyKWh: 1.3,
        durationToleranceMin: 2,
        waterToleranceL: 0.05,
        energyTolerance: 0.05,
        printed: { durationMin: [60, 60], energyKWh: null, mainsWaterL: [10.5, 10.5] },
      },
      provenance: { tag: 'estimated', source: 'test' },
    };
    const p = loadProgrammeSpec(def);
    const [a, b, c, d, e, f] = p.steps;
    if (
      a?.kind !== 'fill' ||
      b?.kind !== 'heat' ||
      c?.kind !== 'hold' ||
      d?.kind !== 'dose_rinse_aid' ||
      e?.kind !== 'regenerate' ||
      f?.kind !== 'drain'
    ) {
      throw new Error('step kinds changed');
    }
    expect(a.duration).toBeNull();
    expect(a.sources).toEqual([{ from: 'mains', volume: 0.0035 }]);
    expect(a.prestoreFills).toEqual([{ at: 30, volume: 0.0015 }]);
    expect(b.duration).toBeNull();
    expect(b.timeout).toBe(DEFAULT_HEAT_TIMEOUT_MIN * 60);
    expect(b.diverter).toEqual({
      phases: [
        { position: 'l', duration: 45 },
        { position: 'u', duration: 30 },
      ],
    });
    expect(b.pulse).toBeNull();
    expect(c.duration).toBe(150);
    expect(c.reheatBand).toBe(2);
    expect(c.pulse).toEqual({ on: 50, off: 10 });
    expectNear(must(d.volume), 3e-6, 1e-18);
    expect(e.duration).toBe(420);
    expect(e.water).toBe(0.005);
    expectWithin(e.energy, 180000, 1e-12);
    expect(e.pumpRpm).toBeNull();
    expect(f.volume).toBe(0.002);
    expect(f.filterFlush).toBe(false);
    // What a step leaves out is left to the machine: null in the specification.
    const defaults = loadProgrammeSpec({
      ...def,
      steps: [
        { id: 'g', row: 'B', phase: 'final_rinse', label: '', kind: 'dose_rinse_aid' },
        {
          id: 'h',
          row: 'B',
          phase: 'final_rinse',
          label: '',
          kind: 'circulate',
          durationMin: 1,
          pumpRpm: 2800,
        },
        {
          id: 'i',
          row: 'B',
          phase: 'drying',
          label: '',
          kind: 'dry',
          prestoreFills: [
            { atFraction: 0.3, volumeL: 1 },
            { atMin: 2, volumeL: 1 },
          ],
        },
      ],
    }).steps;
    const [g, h, i] = defaults;
    if (g?.kind !== 'dose_rinse_aid' || h?.kind !== 'circulate' || i?.kind !== 'dry') {
      throw new Error('step kinds changed');
    }
    expect(g.volume).toBeNull();
    expect(h.diverter).toBeNull();
    expect(i.duration).toBeNull();
    expect(i.prestoreFills).toEqual([
      { at: 0.3, relative: true, volume: 0.001 },
      { at: 120, volume: 0.001 },
    ]);
    expect(p.conditions).toEqual({
      loadHeatCapacity: 23000,
      prestoreInitialVolume: 0.0031,
      otherEnergy: 36000,
    });
    expect(p.declared.duration).toBe(3600);
    expectWithin(must(p.declared.energy), 1.3 * 3.6e6, 1e-12);
    expect(must(p.declared.printed).duration).toEqual([3600, 3600]);
    expect(must(p.declared.printed).energy).toBeNull();
    expect(loadDiverterPattern([['a', 20]])).toEqual({ phases: [{ position: 'a', duration: 20 }] });
  });
});

describe('specifications are plain serialisable data', () => {
  it.each(MACHINES.map((m) => [m.id, m] as const))('%s survives JSON unchanged', (_id, spec) => {
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
  });

  it('a definition that has been through JSON loads to the same specification', () => {
    for (const [def, spec] of [
      [BOSCH_SMV4HAX40G_DEF, BOSCH_SMV4HAX40G],
      [SPOT60_DEF, SPOT_60],
    ] as const) {
      const revived = JSON.parse(JSON.stringify(def)) as MachineDef;
      expect(loadMachineSpec(revived)).toEqual(spec);
    }
  });

  it('holds only finite numbers', () => {
    const visit = (value: unknown, path: string): void => {
      if (typeof value === 'number') {
        expect(Number.isFinite(value), path).toBe(true);
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => visit(v, `${path}[${i}]`));
      } else if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value).sort())
          visit((value as Record<string, unknown>)[key], `${path}.${key}`);
      }
    };
    for (const spec of MACHINES) visit(spec, spec.id);
  });

  it('loading is deterministic', () => {
    expect(loadMachineSpec(BOSCH_SMV4HAX40G_DEF)).toEqual(BOSCH_SMV4HAX40G);
    expect(JSON.stringify(loadMachineSpec(SPOT60_DEF))).toBe(JSON.stringify(SPOT_60));
  });
});
