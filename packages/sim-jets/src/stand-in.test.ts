// The jet stage of the first build: the closed forms against the worked profile of the jets
// dossier, and the stand-in against analytic values on a slab swept by one vertical jet.
import {
  bindSharedClosures,
  buildWashScene,
  createParamSet,
  createRegistry,
  HYDRAULICS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  TIER_FAST,
  type SceneItem,
  type SceneMaterial,
  type SprayState,
} from './index.ts';
import { describe, expect, it } from 'vitest';
import {
  createJetImpact,
  JET_FIELD,
  JET_FIELD_COUNT,
  jetImpactAt,
  jetPeakShear,
  jetStageStandIn,
  JETS_PARAM_DEFS,
  resolveJetParams,
} from './index.ts';

const registry = createRegistry({
  contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS, HYDRAULICS_PARAM_DEFS, JETS_PARAM_DEFS],
});
const params = createParamSet(registry, { 'jets.standInPhases': 3600 });
const jp = resolveJetParams(params);
const water = bindSharedClosures(params).water(50);

describe('closed forms of an impinging jet (jets 4.2 to 4.4)', () => {
  // The dossier's reference jet J2-8: d = 2 mm, V = 8 m/s, water at 50 C, Re = 28,900.
  const d = 2e-3;
  const v = 8;
  const at = (x: number) => jetImpactAt(jp, water.rho, water.nu, v, d, 1, x * d, createJetImpact());

  it('has the Reynolds number the dossier quotes', () => {
    expect((v * d) / water.nu).toBeGreaterThan(28_900 * 0.98);
    expect((v * d) / water.nu).toBeLessThan(28_900 * 1.02);
  });

  it('gives the stagnation pressure and its fall-off', () => {
    // "stagnation pressure up to 31.6 kPa" (11.4); p / p_s = 0.94, 0.73, 0.44, 0.09, 0.01.
    expect(at(0).pressure / 1000).toBeCloseTo(31.6, 1);
    const ratios = [0.25, 0.5, 0.7, 1.0, 1.25].map((x) => at(x).pressure / at(0).pressure);
    [0.94, 0.73, 0.44, 0.09, 0.01].forEach((want, i) => expect(ratios[i]).toBeCloseTo(want, 2));
  });

  it('reproduces the radial-film profile of the dossier table within 2 %', () => {
    // r/d, h (um), tau (Pa), rho U^2 h (N/m), from the table of section 4.4.
    const rows: [number, number, number, number][] = [
      [0.55, 464, 237, 28],
      [1, 263, 176, 15],
      [2, 143, 124, 6.9],
      [3, 105, 101, 4.2],
    ];
    for (const [x, h, tau, m] of rows) {
      const got = at(x);
      expect((got.thickness * 1e6) / h).toBeGreaterThan(0.98);
      expect((got.thickness * 1e6) / h).toBeLessThan(1.02);
      expect(got.shear / tau).toBeGreaterThan(0.97);
      expect(got.shear / tau).toBeLessThan(1.03);
      expect(got.momentum / m).toBeGreaterThan(0.95);
      expect(got.momentum / m).toBeLessThan(1.05);
    }
  });

  it('peaks at 0.63 rho V^2 Re^(-1/2) and rises linearly from zero inside', () => {
    // The two branches cross at x = (0.472 / 1.150)^(2/3) = 0.552, where the coefficient is
    // 0.635; the dossier rounds both ("0.63 ... at r = 0.55 d").
    const re = (v * d) / water.nu;
    const peak = jetPeakShear(jp, water.rho, water.nu, v, d);
    expect(peak / ((water.rho * v * v) / Math.sqrt(re))).toBeCloseTo(0.635, 3);
    expect(at(0).shear).toBe(0);
    expect(at(0.25).shear / peak).toBeCloseTo(0.25 / 0.5523, 3);
    expect(at(0.5523).shear / peak).toBeCloseTo(1, 3);
    // "For J2-8: ... 234 Pa at 50 C".
    expect(peak).toBeGreaterThan(234 * 0.98);
    expect(peak).toBeLessThan(234 * 1.03);
  });

  it('weakens the stagnation pressure with the square of the sine of the incidence', () => {
    const oblique = jetImpactAt(jp, water.rho, water.nu, v, d, 0.5, 0, createJetImpact());
    expect(oblique.pressure / at(0).pressure).toBeCloseTo(0.25, 12);
  });
});

describe('stand-in jet stage on a slab swept by one vertical jet', () => {
  const glass: SceneMaterial = {
    id: 'glass',
    wettingClass: 'continuous_film',
    advancing: [0.3, 0.2, 0.2],
    receding: [0.1, 0.05, 0.05],
  };
  const slab = (itemId: string, z: number): SceneItem => ({
    itemId,
    typeId: 'slab',
    shape: {
      parts: [
        {
          id: 'body',
          prim: { kind: 'rbox', halfExtents: [0.15, 0.15, 0.003], radius: 0.001 },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material: 'glass',
        },
      ],
      regions: [
        { id: 'underside', part: 'body', side: 'out' },
        { id: 'top', part: 'body', side: 'in' },
      ],
    },
    pose: { p: [0, 0, z], q: [0, 0, 0, 1] },
    soils: [
      {
        type: 'any',
        regions: [
          { region: 'underside', coverage: 1 },
          { region: 'top', coverage: 1 },
        ],
        amount_g: 1,
        age_h: 1,
        heat_history: 'none',
      },
    ],
  });
  // `a_slab` is struck from below; `b_slab` lies above it in its shadow.
  const scene = buildWashScene({
    items: [slab('a_slab', 0.2), slab('b_slab', 0.26)],
    machine: [],
    blockSize: 2e-3,
    materials: () => glass,
    params,
  });
  const radius = 0.1;
  const speed = 8;
  const diameter = 2e-3;
  const omega = 4;
  const flow = (Math.PI * diameter * diameter * speed) / 4;
  const state: SprayState = {
    index: 0,
    id: 'test@3000',
    position: 'test',
    pumpRpm: 3000,
    headFactor: 1,
    flow,
    pumpPressure: 0,
    arms: [
      {
        level: 'test',
        axis: [0, 0],
        senseSign: 1,
        omega,
        period: (2 * Math.PI) / omega,
        stalled: false,
        stallAngle: 0,
        armPressure: 0,
      },
    ],
    jets: [
      {
        level: 'test',
        nozzle: 'n1',
        subJet: 0,
        subJets: 1,
        arm: 0,
        origin: [radius, 0, 0.05],
        direction: [0, 0, 1],
        flow,
        speed,
        diameter,
      },
    ],
    showers: [],
    masterArm: 0,
    period: (2 * Math.PI) / omega,
    duration: 60,
    key: 'test',
  };
  const out = jetStageStandIn({ scene, state, armLevels: [], params, tier: TIER_FAST, seed: 7 });

  // Where the jet lands: the nozzle moves at omega R, so the jet leans by atan(omega R / V).
  const underside = 0.2 - 0.004;
  const lean = (omega * radius) / speed;
  const hitRadius = Math.hypot(radius, (underside - 0.05) * lean);
  const absSpeed = Math.hypot(speed, omega * radius);
  const sinInc = speed / absSpeed;
  const footprint = jp.standInFootprintDiameters * diameter;
  const a = scene.instances[scene.itemInstance.get('a_slab') ?? -1];
  const b = scene.instances[scene.itemInstance.get('b_slab') ?? -1];
  if (a === undefined || b === undefined) throw new Error('missing instance');
  const ownerOf = (cell: number): number =>
    scene.blocks.instance[scene.soilCells.block[cell] as number] as number;

  it('strikes with every ray and conserves the water of the jet', () => {
    expect(out.stats.rays).toBe(3600);
    expect(out.stats.hits).toBe(3600);
    expect(out.stats.lostFlow).toBe(0);
    let rate = 0;
    for (let i = 0; i < out.arrival.block.length; i++) {
      const block = out.arrival.block[i] as number;
      rate += (out.arrival.flux[i] as number) * (scene.blocks.area[block] as number);
      expect(scene.blocks.instance[block]).toBe(a.index);
    }
    expect(rate / (water.rho * flow)).toBeCloseTo(1, 5);
  });

  it('exposes only the struck face of the lower slab, sorted by cell', () => {
    expect(out.exposure.cell.length).toBeGreaterThan(1000);
    expect(out.exposure.values.length).toBe(JET_FIELD_COUNT * out.exposure.cell.length);
    for (let i = 0; i < out.exposure.cell.length; i++) {
      const cell = out.exposure.cell[i] as number;
      if (i > 0) expect(cell).toBeGreaterThan(out.exposure.cell[i - 1] as number);
      expect(ownerOf(cell)).toBe(a.index);
      expect(scene.soilCells.centre[3 * cell + 2]).toBeCloseTo(underside, 6);
    }
  });

  it('gives a cell the share of the revolution its footprint chord subtends', () => {
    // A cell at radius rho from the axis is within R of the hit while the hit, on its circle of
    // radius r_h, is within the angle acos((r_h^2 + rho^2 - R^2) / (2 r_h rho)) of it.
    let checked = 0;
    for (let i = 0; i < out.exposure.cell.length; i += 37) {
      const cell = out.exposure.cell[i] as number;
      const rho = Math.hypot(
        scene.soilCells.centre[3 * cell] as number,
        scene.soilCells.centre[3 * cell + 1] as number,
      );
      const offset = Math.abs(rho - hitRadius);
      if (offset > 0.6 * footprint) continue; // chords near the edge are a few samples long
      const half = Math.acos(
        (hitRadius * hitRadius + rho * rho - footprint * footprint) / (2 * hitRadius * rho),
      );
      const duty = out.exposure.values[JET_FIELD_COUNT * i + JET_FIELD.duty] as number;
      expect(duty / (half / Math.PI)).toBeGreaterThan(0.95);
      expect(duty / (half / Math.PI)).toBeLessThan(1.05);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('gives cells on the track the peak shear and pressure of the closed forms', () => {
    const peak = jetPeakShear(jp, water.rho, water.nu, absSpeed, diameter);
    let checked = 0;
    for (let i = 0; i < out.exposure.cell.length; i++) {
      const cell = out.exposure.cell[i] as number;
      const rho = Math.hypot(
        scene.soilCells.centre[3 * cell] as number,
        scene.soilCells.centre[3 * cell + 1] as number,
      );
      const offset = Math.abs(rho - hitRadius);
      if (offset > 0.25 * diameter) continue;
      const v = JET_FIELD_COUNT * i;
      // The footprint passes over the cell, so it sees the peak at 0.55 d (oblique by 3 degrees,
      // which lowers the stagnation branch a little and moves the crossing outward).
      const shear = out.exposure.values[v + JET_FIELD.shearPeak] as number;
      expect(shear / peak).toBeGreaterThan(0.93);
      expect(shear / peak).toBeLessThanOrEqual(1.0001);
      const want = jetImpactAt(
        jp,
        water.rho,
        water.nu,
        absSpeed,
        diameter,
        sinInc,
        offset,
        createJetImpact(),
      );
      const pressure = out.exposure.values[v + JET_FIELD.pressurePeak] as number;
      expect(pressure / want.pressure).toBeGreaterThan(0.97);
      expect(pressure / want.pressure).toBeLessThanOrEqual(1.0001);
      // Means are taken inside the footprint: they lie below the peaks and above zero.
      expect(out.exposure.values[v + JET_FIELD.shearMean]).toBeLessThan(shear);
      expect(out.exposure.values[v + JET_FIELD.shearMean]).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('leaves the slab behind the first one untouched', () => {
    expect(b.blockCount).toBeGreaterThan(0);
    for (const cell of out.exposure.cell) expect(ownerOf(cell)).not.toBe(b.index);
  });

  it('is the same on a repeat', () => {
    const again = jetStageStandIn({
      scene,
      state,
      armLevels: [],
      params,
      tier: TIER_FAST,
      seed: 7,
    });
    expect(again.exposure.cell).toEqual(out.exposure.cell);
    expect(again.exposure.values).toEqual(out.exposure.values);
    expect(again.arrival.flux).toEqual(out.arrival.flux);
  });

  it('holds a stalled arm in place: its cells are under the jet all the time', () => {
    const arm = state.arms[0];
    if (arm === undefined) throw new Error('no arm');
    const held: SprayState = {
      ...state,
      arms: [{ ...arm, omega: 0, period: 0, stalled: true, stallAngle: 0.5 }],
      masterArm: -1,
    };
    const fixed = jetStageStandIn({
      scene,
      state: held,
      armLevels: [],
      params,
      tier: TIER_FAST,
      seed: 7,
    });
    expect(fixed.stats.rays).toBe(1);
    expect(fixed.exposure.cell.length).toBeGreaterThan(20);
    for (let i = 0; i < fixed.exposure.cell.length; i++) {
      expect(fixed.exposure.values[JET_FIELD_COUNT * i + JET_FIELD.duty]).toBe(1);
      const cell = fixed.exposure.cell[i] as number;
      const dx = (scene.soilCells.centre[3 * cell] as number) - radius * Math.cos(0.5);
      const dy = (scene.soilCells.centre[3 * cell + 1] as number) - radius * Math.sin(0.5);
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(footprint + 1e-9);
    }
  });
});
