// The jet stage on hand-built scenes with known answers: a jet standing on a plate against the
// closed forms and the dossier's reference values, a grazing jet, a footprint sweeping at
// 1 m/s against the stress history of jets section 4.9, a jet on a wire, a broken jet, the
// loads on items, and the water balance.
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  buildWashScene,
  createParamSet,
  createRegistry,
  HYDRAULICS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  TIER_FAST,
  TIER_OFFICIAL,
  type ParamSet,
  type SprayState,
  type WashScene,
} from './index.ts';
import {
  bindJetClosures,
  DROPLET_SOURCE,
  JET_FIELD,
  JET_FIELD_COUNT,
  jetStage,
  JETS_PARAM_DEFS,
  subRayPattern,
  WATER_UNIT,
  type JetStageOutput,
} from './index.ts';
import { fixtureMaterial, jetState, slab, SLAB_HALF_THICKNESS, wire } from './testing/fixtures.ts';

const registry = createRegistry({
  contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS, HYDRAULICS_PARAM_DEFS, JETS_PARAM_DEFS],
});
const params = createParamSet(registry);
const closures = bindJetClosures(params);
const water = bindSharedClosures(params).water(50);
const gamma = closures.gammaWater(50);
const G = params.get('phys.gravity');

// The dossier's reference jet J2-8.
const D = 2e-3;
const V = 8;
const FLOW = (Math.PI * D * D * V) / 4;

/** The stage on the f64 reference tracer, so that the tests do not depend on a device. */
function run(scene: WashScene, state: SprayState, set: ParamSet = params, tier = TIER_FAST) {
  return jetStage({ scene, state, armLevels: [], params: set, tier, seed: 7, gpu: null });
}

function field(out: JetStageOutput, entry: number, name: keyof typeof JET_FIELD): number {
  return out.exposure.values[JET_FIELD_COUNT * entry + JET_FIELD[name]] as number;
}

describe('sub-ray patterns', () => {
  it('sample equal areas of the jet section', () => {
    // The mean of r^2 over a disc of unit radius is 1/2.
    for (const count of [7, 19]) {
      const p = subRayPattern(count);
      let mean = 0;
      for (let s = 0; s < count; s++)
        mean += ((p[2 * s] as number) ** 2 + (p[2 * s + 1] as number) ** 2) / count;
      expect(Math.abs(mean - 0.5), `${count} sub-rays`).toBeLessThan(0.035);
      expect(p[0]).toBe(0);
      expect(p[1]).toBe(0);
    }
  });
});

describe('a jet standing on a horizontal plate', () => {
  // The plate lies at z = 0.2 with its top face at 0.204; the jet comes straight down from
  // 10 mm above it, on to the centre of a soil cell.
  const top = 0.2 + SLAB_HALF_THICKNESS;
  const scene = buildWashScene({
    items: [slab('plate', 0.1, 0.1, { p: [0, 0, 0.2], q: [0, 0, 0, 1] })],
    machine: [],
    blockSize: 2e-3,
    materials: fixtureMaterial,
    params,
  });
  const axis: [number, number] = [0.0005, 0.0005];
  const state = jetState({
    origin: [axis[0], axis[1], top + 0.01],
    direction: [0, 0, -1],
    speed: V,
    diameter: D,
  });
  const fall = 0.01 - params.get('jets.launchOffset');
  const speed = Math.sqrt(
    V * V +
      2 * G * (0.01 - params.get('jets.launchOffset')) +
      2 * G * params.get('jets.launchOffset'),
  );
  const d = Math.sqrt((4 * FLOW) / (Math.PI * speed));
  const re = (speed * d) / water.nu;
  const xi = closures.splatterFraction(speed, D, fall, water.rho, gamma, 1);
  const jump = closures.fanRadius(FLOW * (1 - xi), water.rho, water.nu, gamma);
  let out: JetStageOutput;
  const radius = (cell: number): number =>
    Math.hypot(
      (scene.soilCells.centre[3 * cell] as number) - axis[0],
      (scene.soilCells.centre[3 * cell + 1] as number) - axis[1],
    );

  it('strikes with every sub-ray and accounts for every unit of water', async () => {
    out = await run(scene, state);
    expect(out.backend).toBe('cpu');
    expect(out.stats.rays).toBe(7);
    expect(out.stats.hits).toBe(7);
    const ledger = out.ledger;
    if (ledger === undefined) throw new Error('no ledger');
    expect(ledger.nozzle).toBe(Math.round((water.rho * FLOW * state.period) / WATER_UNIT));
    expect(ledger.lost).toBe(0);
    expect(ledger.scatter).toBe(0);
    expect(ledger.nozzle).toBe(ledger.handover + ledger.splatter);
    // The hand-over table holds exactly what the ledger says, in whole units.
    let handed = 0;
    for (const units of out.handover?.mass ?? []) {
      expect(Number.isInteger(units)).toBe(true);
      handed += units;
    }
    expect(handed).toBe(ledger.handover);
    // The arm stands still, so the jet runs all the time: the same in every phase bin.
    const handover = out.handover;
    if (handover === undefined) throw new Error('no hand-over');
    expect(handover.bins).toBe(32);
    for (let k = 0; k < handover.bins; k++) {
      let inBin = 0;
      for (let i = handover.offsets[k] as number; i < (handover.offsets[k + 1] as number); i++) {
        inBin += handover.mass[i] as number;
      }
      expect(Math.abs(inBin - ledger.handover / handover.bins)).toBeLessThan(handover.block.length);
    }
    // And the arrival flux is that water as a rate.
    let rate = 0;
    for (let i = 0; i < out.arrival.block.length; i++) {
      rate +=
        (out.arrival.flux[i] as number) *
        (scene.blocks.area[out.arrival.block[i] as number] as number);
    }
    expect(rate / ((ledger.handover * WATER_UNIT) / state.period)).toBeCloseTo(1, 5);
  });

  it('splatters the fraction of the dossier and hands the rest to the film at the jump', () => {
    // V d / nu_20 = 16,000: S_W = 0.184, xi = 0.092 (jets 5.6; 0.09 in the worked example).
    const ledger = out.ledger;
    if (ledger === undefined) throw new Error('no ledger');
    expect(ledger.splatter / ledger.nozzle).toBeCloseTo(xi, 3);
    expect(xi).toBeCloseTo(0.092, 2);
    expect(out.sources?.count).toBe(1);
    expect(out.sources?.kind[0]).toBe(DROPLET_SOURCE.splatter);
    // The film is handed over in the outer quarter of the fan, all round.
    const handover = out.handover;
    if (handover === undefined) throw new Error('no hand-over');
    const quadrants = [0, 0, 0, 0];
    for (let i = 0; i < handover.block.length; i++) {
      const b = handover.block[i] as number;
      const x = (scene.blocks.centre[3 * b] as number) - axis[0];
      const y = (scene.blocks.centre[3 * b + 1] as number) - axis[1];
      const r = Math.hypot(x, y);
      expect(r).toBeGreaterThan(0.75 * jump - 2e-3);
      expect(r).toBeLessThan(jump + 2e-3);
      quadrants[(x > 0 ? 1 : 0) + (y > 0 ? 2 : 0)] =
        (quadrants[(x > 0 ? 1 : 0) + (y > 0 ? 2 : 0)] as number) + (handover.mass[i] as number);
    }
    for (const q of quadrants) expect(q / ledger.handover).toBeCloseTo(0.25, 2);
  });

  it('reaches the stagnation pressure of the dossier on the axis', () => {
    // rho V^2 / 2 = 31.6 kPa for the reference jet (a little more after 10 mm of fall).
    const entry = Array.from(out.exposure.cell).findIndex((c) => radius(c) < 1e-5);
    expect(entry).toBeGreaterThanOrEqual(0);
    expect(field(out, entry, 'pressurePeak') / (0.5 * water.rho * speed * speed)).toBeCloseTo(1, 3);
    expect(field(out, entry, 'pressurePeak') / 31_600).toBeGreaterThan(0.99);
    expect(field(out, entry, 'pressurePeak') / 31_600).toBeLessThan(1.02);
    // No shear on the axis.
    expect(field(out, entry, 'shearPeak')).toBeLessThan(1);
  });

  it('gives every soil cell the wall shear of the closed forms at its radius', () => {
    let peak = 0;
    let far = 0;
    let checked = 0;
    for (let i = 0; i < out.exposure.cell.length; i++) {
      const cell = out.exposure.cell[i] as number;
      // The underside of the plate sees nothing: only the struck face is in the table.
      expect(scene.soilCells.centre[3 * cell + 2] as number).toBeGreaterThan(top - 1e-3);
      const r = radius(cell);
      const got = field(out, i, 'shearPeak');
      peak = Math.max(peak, got);
      if (field(out, i, 'wetDuty') > 0) far = Math.max(far, r);
      // Within the fan the jet stands on the cell all the time.
      expect(field(out, i, 'wetDuty')).toBeCloseTo(1, 5);
      // Within 12 mm of the axis (3 jet diameters plus the coarse stride) every cell is
      // evaluated at its own centre; further out, at the centre of its block.
      const block = scene.soilCells.block[cell] as number;
      const blockRadius = Math.hypot(
        (scene.blocks.centre[3 * block] as number) - axis[0],
        (scene.blocks.centre[3 * block + 1] as number) - axis[1],
      );
      const at = blockRadius < 12e-3 ? r : blockRadius;
      const film = closures.filmShear(at / d, re) * water.rho * speed * speed;
      const want =
        at <= d / 2 + params.get('jets.stagEdge') * d
          ? Math.min(closures.stagShear(speed, d, water.rho, water.nu, 1, at / d), film)
          : film;
      // Away from the turbulent transition (9.1 d), where the model jumps and the table
      // interpolates across the jump.
      if (Math.abs(Math.log(at / d / (0.2964 * Math.cbrt(re)))) < 0.08) continue;
      if (Math.abs(Math.log(at / d / (0.24 * Math.cbrt(re)))) < 0.05) continue;
      expect(Math.abs(got / want - 1), `at ${(r / d).toFixed(2)} d`).toBeLessThan(0.02);
      checked++;
    }
    expect(checked).toBeGreaterThan(3000);
    // The dossier's peak, 237 Pa at 0.55 d, as nearly as 1 mm cells sample it.
    expect(peak).toBeLessThan(240);
    expect(peak).toBeGreaterThan(0.8 * 237);
    // The fan ends at the film jump: 41 mm less the splattered share.
    expect(Math.abs(far - jump)).toBeLessThan(2.5e-3);
    expect(jump * 1000).toBeGreaterThan(37);
    expect(jump * 1000).toBeLessThan(40);
  });

  it('orders the duties by level and counts the footprint as the shear above the first', () => {
    const level = params.getVector('jets.shearLevels');
    for (let i = 0; i < out.exposure.cell.length; i++) {
      const peak = field(out, i, 'shearPeak');
      expect(field(out, i, 'duty')).toBe(peak > (level[0] as number) ? 1 : 0);
      expect(field(out, i, 'shearDuty1')).toBe(peak > (level[1] as number) ? 1 : 0);
      expect(field(out, i, 'shearDuty2')).toBe(peak > (level[2] as number) ? 1 : 0);
      expect(field(out, i, 'shearDuty3')).toBe(peak > (level[3] as number) ? 1 : 0);
      if (field(out, i, 'duty') > 0) expect(field(out, i, 'shearMean')).toBeCloseTo(peak, 3);
    }
  });

  it('pushes on the plate with the momentum flux of the jet, 0.20 N', () => {
    // "The jet pushes on the item with 0.20 N" (jets 11.4).
    const load = out.loads?.[0];
    if (load === undefined) throw new Error('no load');
    expect(load.itemId).toBe('plate');
    const force = water.rho * FLOW * speed;
    expect(load.mean[2] / -force).toBeCloseTo(1, 3);
    expect(Math.abs(load.mean[0])).toBeLessThan(1e-3 * force);
    expect(force).toBeCloseTo(0.2, 2);
    expect(load.peak / force).toBeCloseTo(1, 3);
    expect(load.peakUp).toBe(0);
    expect(load.liftRatio).toBeUndefined();
  });

  it('is the same on a repeat', async () => {
    const again = await run(scene, state);
    expect(again.exposure.cell).toEqual(out.exposure.cell);
    expect(again.exposure.values).toEqual(out.exposure.values);
    expect(again.handover?.mass).toEqual(out.handover?.mass);
    expect(again.ledger).toEqual(out.ledger);
  });
});

describe('a jet at grazing incidence', () => {
  // 20 degrees from the plate, travelling towards +x.
  const top = 0.2 + SLAB_HALF_THICKNESS;
  const scene = buildWashScene({
    items: [slab('plate', 0.15, 0.1, { p: [0, 0, 0.2], q: [0, 0, 0, 1] })],
    machine: [],
    blockSize: 2e-3,
    materials: fixtureMaterial,
    params,
  });
  const angle = (20 * Math.PI) / 180;
  const state = jetState({
    origin: [-0.08 - 0.03 * Math.cos(angle), 0, top + 0.03 * Math.sin(angle)],
    direction: [Math.cos(angle), 0, -Math.sin(angle)],
    speed: V,
    diameter: D,
  });

  it('sends its flow forward (jets 4.7: 99 % at 20 degrees)', async () => {
    const out = await run(scene, state);
    const handover = out.handover;
    if (handover === undefined || out.ledger === undefined) throw new Error('no hand-over');
    let ahead = 0;
    for (let i = 0; i < handover.block.length; i++) {
      const b = handover.block[i] as number;
      if ((scene.blocks.centre[3 * b] as number) > -0.08) ahead += handover.mass[i] as number;
    }
    expect(ahead / out.ledger.handover).toBeGreaterThan(0.97);
    // The footprint is a stripe: far longer ahead of the jet than it is wide.
    let forward = 0;
    let sideways = 0;
    let behind = 0;
    for (let i = 0; i < out.exposure.cell.length; i++) {
      if (field(out, i, 'duty') === 0) continue;
      const cell = out.exposure.cell[i] as number;
      const x = (scene.soilCells.centre[3 * cell] as number) + 0.08;
      forward = Math.max(forward, x);
      behind = Math.max(behind, -x);
      sideways = Math.max(sideways, Math.abs(scene.soilCells.centre[3 * cell + 1] as number));
    }
    expect(forward).toBeGreaterThan(4 * sideways);
    expect(forward).toBeGreaterThan(8 * behind);
    // Normal force rho Q V sin(phi); the tangential part is c_t rho Q V cos(phi).
    const load = out.loads?.[0];
    if (load === undefined) throw new Error('no load');
    const arrive = Math.atan2(V * Math.sin(angle) + 0.5 * 0, V * Math.cos(angle));
    expect(load.mean[2] / -(water.rho * FLOW * V * Math.sin(arrive))).toBeGreaterThan(0.97);
    expect(load.mean[2] / -(water.rho * FLOW * V * Math.sin(arrive))).toBeLessThan(1.1);
    expect(load.mean[0] / (0.2 * water.rho * FLOW * V * Math.cos(arrive))).toBeCloseTo(1, 1);
    // A grazing jet splatters less, as sin(phi).
    expect(out.ledger.splatter / out.ledger.nozzle).toBeLessThan(0.05);
  });
});

describe('a footprint sweeping at 1 m/s (jets 4.9)', () => {
  // The jet turns at 0.1 m about the z axis, 10 rad/s, and strikes a slab from below; a
  // second slab lies above the first in its shadow. Every part of the film counts as footprint
  // here (first shear level 0.1 Pa), so that duty x mean shear is the stress-time integral.
  const all = createParamSet(registry, { 'jets.shearLevels': [0.1, 30, 100, 300] });
  const scene = buildWashScene({
    items: [
      slab('a_slab', 0.16, 0.16, { p: [0, 0, 0.1], q: [0, 0, 0, 1] }),
      slab('b_slab', 0.16, 0.16, { p: [0, 0, 0.16], q: [0, 0, 0, 1] }),
    ],
    machine: [],
    blockSize: 2e-3,
    materials: fixtureMaterial,
    params: all,
  });
  const omega = 10;
  const radius = 0.1;
  const state = jetState({
    origin: [radius, 0, 0.1 - SLAB_HALF_THICKNESS - 0.02],
    direction: [0, 0, 1],
    speed: V,
    diameter: D,
    omega,
  });
  // The nozzle moves at omega R, so the jet leans and lands a little further out.
  const lean = (omega * radius) / V;
  const hitRadius = Math.hypot(radius, 0.02 * lean);
  const sweep = omega * hitRadius;
  let out: JetStageOutput;
  const offsetOf = (cell: number): number =>
    Math.hypot(
      scene.soilCells.centre[3 * cell] as number,
      scene.soilCells.centre[3 * cell + 1] as number,
    ) - hitRadius;

  it('exposes the struck slab only', async () => {
    out = await run(scene, state, all);
    const a = scene.itemInstance.get('a_slab');
    expect(out.stats.hits).toBe(out.stats.rays);
    expect(out.exposure.cell.length).toBeGreaterThan(10_000);
    for (const cell of out.exposure.cell) {
      expect(scene.blocks.instance[scene.soilCells.block[cell] as number]).toBe(a);
    }
    expect(out.ledger?.lost).toBe(0);
  });

  it('gives the stress-time integral of the dossier across the track', () => {
    // E_tau per pass at 1 m/s: 4.3, 3.8, 3.1, 1.6 Pa s at 0, 5, 10, 20 mm from the track
    // (jets 4.9, for a footprint moving in a straight line at normal incidence). Here the
    // track is a circle of 0.1 m and the jet leans 7 degrees, so the comparison is to 15 %.
    const want: [number, number][] = [
      [0, 4.3],
      [5e-3, 3.8],
      [10e-3, 3.1],
      [20e-3, 1.6],
    ];
    for (const [offset, impulse] of want) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < out.exposure.cell.length; i++) {
        const cell = out.exposure.cell[i] as number;
        if (Math.abs(Math.abs(offsetOf(cell)) - offset) > 0.6e-3) continue;
        sum += field(out, i, 'duty') * field(out, i, 'shearMean') * state.period;
        count++;
      }
      expect(count).toBeGreaterThan(100);
      const got = (sum / count) * (sweep / 1);
      expect(got / impulse, `${offset * 1000} mm off the track`).toBeGreaterThan(0.85);
      expect(got / impulse, `${offset * 1000} mm off the track`).toBeLessThan(1.15);
    }
  });

  it('holds the shear above 30 and 100 Pa for about 45 and 12 ms on the track', () => {
    // jets 11.4: "shear above 100 Pa for about 12 ms and above 30 Pa for about 45 ms".
    let above30 = 0;
    let above100 = 0;
    let peak = 0;
    let count = 0;
    for (let i = 0; i < out.exposure.cell.length; i++) {
      const cell = out.exposure.cell[i] as number;
      if (Math.abs(offsetOf(cell)) > 0.6e-3) continue;
      above30 += field(out, i, 'shearDuty1') * state.period * sweep;
      above100 += field(out, i, 'shearDuty2') * state.period * sweep;
      peak += field(out, i, 'shearPeak');
      count++;
      // The duties are nested.
      expect(field(out, i, 'wetDuty')).toBeGreaterThanOrEqual(field(out, i, 'duty'));
      expect(field(out, i, 'duty')).toBeGreaterThanOrEqual(field(out, i, 'shearDuty1'));
      expect(field(out, i, 'shearDuty1')).toBeGreaterThanOrEqual(field(out, i, 'shearDuty2'));
    }
    expect((above30 / count) * 1000).toBeGreaterThan(36);
    expect((above30 / count) * 1000).toBeLessThan(54);
    expect((above100 / count) * 1000).toBeGreaterThan(8.5);
    expect((above100 / count) * 1000).toBeLessThan(15);
    // "peak wall shear 236 Pa" on the track, as nearly as the stride of the gather samples it.
    expect(peak / count).toBeGreaterThan(0.8 * 236);
    expect(peak / count).toBeLessThan(1.02 * 236);
  });

  it('lifts the slab with rho Q V, steadily round the revolution', () => {
    const load = out.loads?.[0];
    if (load === undefined) throw new Error('no load');
    const speed = Math.hypot(V, omega * radius);
    // The vertical part of the momentum flux: rho Q V_z, a little less after 20 mm of rise.
    expect(load.mean[2] / (water.rho * FLOW * V)).toBeGreaterThan(0.97);
    expect(load.mean[2] / (water.rho * FLOW * V)).toBeLessThan(1.01);
    expect(load.peakUp / load.mean[2]).toBeCloseTo(1, 1);
    expect(load.peak).toBeLessThan(1.05 * water.rho * FLOW * speed);
  });

  it('reports the lift against the weight of the item where its mass is known', async () => {
    const light = await jetStage({
      scene,
      state,
      armLevels: [],
      params: all,
      tier: TIER_FAST,
      seed: 7,
      gpu: null,
      itemMass: new Map([['a_slab', 0.01]]),
    });
    const load = light.loads?.find((l) => l.itemId === 'a_slab');
    if (load === undefined) throw new Error('no load');
    // 0.2 N on a 10 g item: about twice its weight.
    expect(load.liftRatio).toBeCloseTo(load.peakUp / (0.01 * G), 12);
    expect(load.liftRatio ?? 0).toBeGreaterThan(1.8);
    expect(load.liftRatio ?? 0).toBeLessThan(2.2);
  });

  it('does not depend on the number of arm angles or sub-rays beyond 5 %', async () => {
    const fine = await run(scene, state, all, TIER_OFFICIAL);
    expect(fine.stats.rays).toBe(8192 * 19);
    let coarseSum = 0;
    let fineSum = 0;
    for (let i = 0; i < out.exposure.cell.length; i++) {
      coarseSum += field(out, i, 'duty') * field(out, i, 'shearMean');
    }
    for (let i = 0; i < fine.exposure.cell.length; i++) {
      fineSum += field(fine, i, 'duty') * field(fine, i, 'shearMean');
    }
    expect(coarseSum / fineSum).toBeGreaterThan(0.95);
    expect(coarseSum / fineSum).toBeLessThan(1.05);
    expect(fine.exposure.cell.length / out.exposure.cell.length).toBeCloseTo(1, 1);
  });
});

describe('a jet on a rack wire', () => {
  // A wire of 2 mm radius along y, 50 mm above a nozzle that points straight up, with a slab
  // 50 mm above the wire.
  const scene = buildWashScene({
    items: [slab('plate', 0.1, 0.1, { p: [0, 0, 0.2], q: [0, 0, 0, 1] })],
    machine: [wire('rack', [0, -0.1, 0.15], [0, 0.1, 0.15], 2e-3)],
    blockSize: 2e-3,
    materials: fixtureMaterial,
    params,
  });

  it('leaves 5 % on a wire that takes the whole jet and throws the rest off as fans', async () => {
    const out = await run(
      scene,
      jetState({ origin: [0, 0, 0.1], direction: [0, 0, 1], speed: V, diameter: D }),
    );
    const ledger = out.ledger;
    if (ledger === undefined) throw new Error('no ledger');
    expect(out.stats.hits).toBe(7);
    expect(ledger.handover).toBe(Math.floor(0.05 * ledger.nozzle));
    expect(ledger.scatter).toBe(ledger.nozzle - ledger.handover);
    expect(ledger.splatter).toBe(0);
    expect(out.sources?.kind[0]).toBe(DROPLET_SOURCE.wireFan);
    // The fan source carries the axis and the radius of the wire.
    expect(Math.abs(out.sources?.normal[1] ?? 0)).toBeCloseTo(1, 6);
    expect(out.sources?.shape[0]).toBeCloseTo(2e-3, 9);
    // What stays is on the wire, and the plate behind it sees no jet.
    for (const b of out.arrival.block)
      expect(scene.instances[scene.blocks.instance[b] as number]?.id).toBe('rack');
    expect(out.exposure.cell.length).toBe(0);
  });

  it('lets the part of a jet that misses the wire fly on to the plate', async () => {
    // The axis of the jet runs along the flank of the wire: the sub-rays beside it pass.
    const out = await run(
      scene,
      jetState({ origin: [2e-3, 0, 0.1], direction: [0, 0, 1], speed: V, diameter: D }),
    );
    const ledger = out.ledger;
    if (ledger === undefined) throw new Error('no ledger');
    expect(ledger.lost).toBe(0);
    expect(ledger.scatter).toBeGreaterThan(0.2 * ledger.nozzle);
    expect(ledger.scatter).toBeLessThan(0.8 * ledger.nozzle);
    expect(out.exposure.cell.length).toBeGreaterThan(100);
    const kinds = Array.from(out.sources?.kind ?? []).sort();
    expect(kinds).toEqual([DROPLET_SOURCE.splatter, DROPLET_SOURCE.wireFan]);
    expect(ledger.nozzle).toBe(ledger.handover + ledger.splatter + ledger.scatter);
  });
});

describe('a jet that has broken up', () => {
  // A sub-jet of a slot nozzle breaks up over `jets.sheetBreakup` (0.1 m): after 0.2 m it is a
  // droplet train, with the stress efficiency k_drop and the plateau splatter.
  const scene = buildWashScene({
    items: [slab('plate', 0.1, 0.1, { p: [0, 0, 0.3], q: [0, 0, 0, 1] })],
    machine: [],
    blockSize: 2e-3,
    materials: fixtureMaterial,
    params,
  });
  const at = (subJets: number) =>
    jetState({
      origin: [0.0005, 0.0005, 0.096],
      direction: [0, 0, 1],
      speed: V,
      diameter: D,
      subJets,
    });

  it('stresses the wall 0.7 times as much and splatters 30 % of its flow', async () => {
    const whole = await run(scene, at(1));
    const broken = await run(scene, at(7));
    expect(
      broken.ledger !== undefined && broken.ledger.splatter / broken.ledger.nozzle,
    ).toBeCloseTo(0.3, 3);
    // The coherent jet is on the plateau of the pipe-jet correlation after 0.2 m: k_S 0.30.
    expect(whole.ledger !== undefined && whole.ledger.splatter / whole.ledger.nozzle).toBeCloseTo(
      0.15,
      2,
    );
    // Cell by cell near the axis (the fans differ further out, because the splatter does).
    const byCell = new Map<number, number>();
    for (let i = 0; i < whole.exposure.cell.length; i++)
      byCell.set(whole.exposure.cell[i] as number, field(whole, i, 'shearPeak'));
    let compared = 0;
    for (let i = 0; i < broken.exposure.cell.length; i++) {
      const cell = broken.exposure.cell[i] as number;
      const r = Math.hypot(
        (scene.soilCells.centre[3 * cell] as number) - 0.0005,
        (scene.soilCells.centre[3 * cell + 1] as number) - 0.0005,
      );
      const reference = byCell.get(cell);
      if (r > 8e-3 || r < 1e-4 || reference === undefined) continue;
      expect(field(broken, i, 'shearPeak') / reference).toBeCloseTo(0.7, 6);
      compared++;
    }
    expect(compared).toBeGreaterThan(150);
  });
});

describe('a face that another item covers (review of the first build)', () => {
  // A jet strikes a plate from above near the edge of a second plate that lies over half of
  // it, `gap` above its top face: the fast film of the jet reaches 41 mm from the impact and
  // would run under the cover.
  const top = 0.2 + SLAB_HALF_THICKNESS;
  const build = (gap: number): WashScene =>
    buildWashScene({
      items: [
        slab('a_plate', 0.1, 0.1, { p: [0, 0, 0.2], q: [0, 0, 0, 1] }),
        // Covers x > 10 mm of the plate.
        slab('b_cover', 0.05, 0.1, {
          p: [0.06, 0, top + gap + SLAB_HALF_THICKNESS],
          q: [0, 0, 0, 1],
        }),
      ],
      machine: [],
      blockSize: 2e-3,
      materials: fixtureMaterial,
      params,
    });
  const state = jetState({
    origin: [0, 0.0005, top + 0.03],
    direction: [0, 0, -1],
    speed: V,
    diameter: D,
  });
  /** Soil cells of the plate's top face under the cover (x from 15 to 35 mm, in the fan). */
  const under = (scene: WashScene, out: JetStageOutput): { struck: number; cells: number } => {
    const plate = scene.itemInstance.get('a_plate') as number;
    const entry = new Map<number, number>();
    out.exposure.cell.forEach((c, i) => entry.set(c, i));
    let struck = 0;
    let cells = 0;
    for (let c = 0; c < scene.soilCells.count; c++) {
      const b = scene.soilCells.block[c] as number;
      if (scene.blocks.instance[b] !== plate) continue;
      if ((scene.blocks.normal[3 * b + 2] as number) < 0.9) continue;
      const x = scene.soilCells.centre[3 * c] as number;
      const y = scene.soilCells.centre[3 * c + 1] as number;
      if (x < 0.015 || x > 0.035 || Math.abs(y) > 0.01) continue;
      cells++;
      const e = entry.get(c);
      if (e !== undefined && field(out, e, 'shearPeak') > 2.8) struck++;
    }
    return { struck, cells };
  };

  it('gets the fan of a jet where the cover stands well off, and none where it lies close', async () => {
    // Open (30 mm above): the film at 15 to 35 mm from the impact stresses every cell with
    // more than the 2.8 Pa that soaked baked sauce withstands.
    const open = build(0.03);
    const wide = under(open, await run(open, state));
    expect(wide.cells).toBeGreaterThan(100);
    expect(wide.struck).toBe(wide.cells);
    // 2 mm above (below jets.fanMinGap = 3 mm): none of it.
    const tight = build(0.002);
    const closed = under(tight, await run(tight, state));
    expect(closed.cells).toBe(wide.cells);
    expect(closed.struck).toBe(0);
    // 6.5 mm above (half way to jets.fanFullGap = 10 mm): half the shear, so still struck.
    const half = build(0.0065);
    const out = await run(half, state);
    expect(under(half, out).struck).toBe(wide.cells);
    const openOut = await run(open, state);
    const peakAt = (scene: WashScene, o: JetStageOutput): number => {
      const entry = new Map<number, number>();
      o.exposure.cell.forEach((c, i) => entry.set(c, i));
      let sum = 0;
      for (let c = 0; c < scene.soilCells.count; c++) {
        const x = scene.soilCells.centre[3 * c] as number;
        const b = scene.soilCells.block[c] as number;
        if (scene.blocks.instance[b] !== scene.itemInstance.get('a_plate')) continue;
        if ((scene.blocks.normal[3 * b + 2] as number) < 0.9 || x < 0.02 || x > 0.03) continue;
        const e = entry.get(c);
        if (e !== undefined) sum += field(o, e, 'shearPeak');
      }
      return sum;
    };
    expect(peakAt(half, out) / peakAt(open, openOut)).toBeCloseTo(0.5, 1);
  });

  it('hands the same water to the film whether the face is covered or not', async () => {
    const open = build(0.03);
    const tight = build(0.002);
    const a = await run(open, state);
    const b = await run(tight, state);
    // The cover changes what the fan does to the soil, not where the water of the jet goes.
    expect(b.ledger?.nozzle).toBe(a.ledger?.nozzle);
    expect(b.ledger?.handover).toBe(a.ledger?.handover);
  });
});

describe('a fan that meets a cover', () => {
  // A jet strikes a plate from above at x = 0. A strip lies 2 mm over the band x = 12 to 24 mm
  // of its top face (closer than jets.fanMinGap), leaving the plate open again beyond it: the
  // fan of the jet reaches 41 mm from the impact and would run under the strip and out again.
  const top = 0.2 + SLAB_HALF_THICKNESS;
  const build = (covered: boolean): WashScene =>
    buildWashScene({
      items: [
        slab('a_plate', 0.1, 0.1, { p: [0, 0, 0.2], q: [0, 0, 0, 1] }),
        slab('b_strip', 0.006, 0.1, {
          p: [0.018, 0, top + (covered ? 0.002 : 0.03) + SLAB_HALF_THICKNESS],
          q: [0, 0, 0, 1],
        }),
      ],
      machine: [],
      blockSize: 2e-3,
      materials: fixtureMaterial,
      params,
    });
  const state = jetState({
    origin: [0, 0.0005, top + 0.05],
    direction: [0, 0, -1],
    speed: V,
    diameter: D,
  });
  /** Jet time on the top face of the plate in a band of x (|y| < 8 mm), and water handed to it. */
  const band = (
    scene: WashScene,
    out: JetStageOutput,
    x0: number,
    x1: number,
  ): { wet: number; cells: number; handed: number } => {
    const plate = scene.itemInstance.get('a_plate') as number;
    const entry = new Map<number, number>();
    out.exposure.cell.forEach((c, i) => entry.set(c, i));
    let wet = 0;
    let cells = 0;
    for (let c = 0; c < scene.soilCells.count; c++) {
      const b = scene.soilCells.block[c] as number;
      if (scene.blocks.instance[b] !== plate) continue;
      if ((scene.blocks.normal[3 * b + 2] as number) < 0.9) continue;
      const x = scene.soilCells.centre[3 * c] as number;
      if (x < x0 || x > x1 || Math.abs(scene.soilCells.centre[3 * c + 1] as number) > 0.008)
        continue;
      cells++;
      const e = entry.get(c);
      if (e !== undefined && field(out, e, 'wetDuty') > 0) wet++;
    }
    let handed = 0;
    const handover = out.handover;
    if (handover === undefined) throw new Error('no hand-over');
    for (let i = 0; i < handover.block.length; i++) {
      const b = handover.block[i] as number;
      if (scene.blocks.instance[b] !== plate) continue;
      if ((scene.blocks.normal[3 * b + 2] as number) < 0.9) continue;
      const x = scene.blocks.centre[3 * b] as number;
      if (x >= x0 && x <= x1) handed += handover.mass[i] as number;
    }
    return { wet, cells, handed };
  };

  it('does not run under it, nor reach what lies beyond it, and leaves its water at its edge', async () => {
    const open = build(false);
    const shut = build(true);
    const free = await run(open, state);
    const cut = await run(shut, state);
    // With the strip well off, the fan covers the band under it and the band beyond.
    expect(band(open, free, 0.014, 0.022).wet).toBe(band(open, free, 0.014, 0.022).cells);
    expect(band(open, free, 0.027, 0.036).wet).toBe(band(open, free, 0.027, 0.036).cells);
    expect(band(open, free, 0.027, 0.036).cells).toBeGreaterThan(30);
    // With the strip 2 mm above the face: no fan under it and none beyond it (the film cannot
    // cross), although the face beyond is open.
    expect(band(shut, cut, 0.014, 0.022).wet).toBe(0);
    expect(band(shut, cut, 0.027, 0.036).wet).toBe(0);
    // The same water reaches the film, none of it under or beyond the strip on this side: it
    // is handed over on the open face before the strip.
    expect(cut.ledger?.handover).toBe(free.ledger?.handover);
    expect(band(shut, cut, 0.013, 0.1).handed).toBe(0);
    expect(band(open, free, 0.013, 0.1).handed).toBeGreaterThan(0);
    expect(band(shut, cut, 0, 0.012).handed).toBeGreaterThan(band(open, free, 0, 0.012).handed);
  });
});

describe('the simulation seed and the angles an arm is sampled at', () => {
  const scene = buildWashScene({
    items: [slab('a_slab', 0.16, 0.16, { p: [0, 0, 0.1], q: [0, 0, 0, 1] })],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const state = jetState({
    origin: [0.1, 0, 0.1 - SLAB_HALF_THICKNESS - 0.02],
    direction: [0, 0, 1],
    speed: V,
    diameter: D,
    omega: 10,
  });
  const seeded = (seed: number) =>
    jetStage({ scene, state, armLevels: [], params, tier: TIER_FAST, seed, gpu: null });

  it('shifts the sampled angles with the seed, so that sampling error differs between seeds', async () => {
    const a = await seeded(3);
    const b = await seeded(4);
    const again = await seeded(3);
    expect(Array.from(again.exposure.values)).toEqual(Array.from(a.exposure.values));
    expect(Array.from(b.exposure.values)).not.toEqual(Array.from(a.exposure.values));
    // The same water leaves the nozzle and the same share reaches the film, whatever the seed.
    expect(b.ledger?.nozzle).toBe(a.ledger?.nozzle);
    const total = (o: JetStageOutput): number => {
      let sum = 0;
      for (let i = 0; i < o.exposure.cell.length; i++) {
        sum +=
          field(o, i, 'duty') *
          field(o, i, 'shearMean') *
          (scene.soilCells.area[o.exposure.cell[i] as number] as number);
      }
      return sum;
    };
    // The stress-time integral over the slab is a property of the jet, not of the sampling.
    expect(total(b) / total(a)).toBeCloseTo(1, 1);
  });
});
