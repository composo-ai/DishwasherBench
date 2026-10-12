// The secondary-water stage on hand-built scenes: the shower of a fixed sprayer over a slab,
// the splatter of a jet standing on a plate, the fans off a rack wire, the landing table of
// drips, and the water balance in whole units.
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  buildWashScene,
  createParamSet,
  createRegistry,
  HYDRAULICS_PARAM_DEFS,
  jetStage,
  JETS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  TIER_FAST,
  WATER_UNIT,
  type ExposureStageInput,
  type JetStageOutput,
  type ParamSet,
  type SprayState,
  type WashScene,
} from './index.ts';
import {
  DRIP_WEIGHT_ONE,
  dripTransfer,
  secondaryWaterStage,
  radicalInverse,
  SPRAY_PARAM_DEFS,
  type SecondaryWaterOutput,
} from './index.ts';
import {
  cup,
  fixtureMaterial,
  jetState,
  showerState,
  slab,
  SLAB_HALF_THICKNESS,
  wire,
} from '../../sim-jets/src/testing/fixtures.ts';

const registry = createRegistry({
  contributions: [
    SHARED_PARAM_DEFS,
    SCENE_PARAM_DEFS,
    HYDRAULICS_PARAM_DEFS,
    JETS_PARAM_DEFS,
    SPRAY_PARAM_DEFS,
  ],
});
// Heavy parcels, so that the f64 reference tracer answers in a moment, and a landing lattice
// finer than the blocks (4 mm here), so that these tests see where the droplets themselves
// land: the landing kernel has its own tests (`landing-kernel.test.ts`).
const SHOWER_PARCEL = 1.8e-5;
const params = createParamSet(registry, {
  'spray.parcelMass': [SHOWER_PARCEL, SHOWER_PARCEL],
  'spray.showerParcelFactor': 1,
  'spray.landingKernel': 2e-3,
});
// The splatter of one jet is a few grams a revolution: lighter parcels for it.
const jetParams = params.with({ 'spray.parcelMass': [5e-7, 5e-7] });
const rho = bindSharedClosures(params).water(50).rho;

function input(
  scene: WashScene,
  state: SprayState,
  set: ParamSet = params,
  seed = 5,
): ExposureStageInput {
  return { scene, state, armLevels: [], params: set, tier: TIER_FAST, seed, gpu: null };
}

const noJets = (scene: WashScene): JetStageOutput => ({
  exposure: {
    soilCellCount: scene.soilCells.count,
    cell: new Uint32Array(0),
    values: new Float32Array(0),
  },
  arrival: { blockCount: scene.blocks.count, block: new Uint32Array(0), flux: new Float32Array(0) },
  stats: { rays: 0, hits: 0, flow: 0, lostFlow: 0 },
});

describe('the shower of a fixed sprayer', () => {
  const scene = buildWashScene({
    items: [slab('plate', 0.15, 0.15, { p: [0, 0, 0.2], q: [0, 0, 0, 1] })],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const flow = 1e-4;
  const state = showerState([
    {
      level: 'roof',
      origin: [0, 0, 0.5],
      axis: [0, 0, -1],
      coneHalfAngle: 0.2,
      dropletSpeed: 2.5,
      flow,
    },
  ]);
  let out: SecondaryWaterOutput;

  it('lands every unit of its water or accounts for it as lost', async () => {
    out = await secondaryWaterStage(input(scene, state), noJets(scene));
    const ledger = out.ledger;
    if (ledger === undefined) throw new Error('no ledger');
    expect(out.backend).toBe('cpu');
    expect(ledger.sources).toBe(0);
    expect(ledger.showers).toBe(Math.round((rho * flow * state.period) / WATER_UNIT));
    expect(ledger.showers).toBe(ledger.deposited + ledger.lost);
    let landed = 0;
    for (const units of out.deposits?.mass ?? []) {
      expect(Number.isInteger(units)).toBe(true);
      landed += units;
    }
    expect(landed).toBe(ledger.deposited);
    // The shower is one source: its mass over the mass of a parcel.
    expect(out.stats.paths).toBe(Math.round((ledger.showers * WATER_UNIT) / SHOWER_PARCEL));
    expect(out.stats.paths).toBeGreaterThan(8000);
    // Every landing is on an item face that is open to the sky or on nothing: all of it is
    // accounted for by the kernel.
    const settled = out.stats.settled;
    if (settled === undefined) throw new Error('no record of the settling');
    expect(
      settled.pooledOpen + settled.pooledFaced + settled.keptOnItems + settled.onMachine,
    ).toBeCloseTo(1, 12);
    expect(settled.onMachine).toBe(0);
    // The cone falls wholly on the slab. Its 1.5 mm drops arrive at 3.5 m/s, twice the splash
    // threshold of a wetted wall, so a tenth of each is thrown on as secondaries, and most of
    // those fly clear of a 0.3 m slab.
    expect(ledger.lost / ledger.showers).toBeGreaterThan(0.02);
    expect(ledger.lost / ledger.showers).toBeLessThan(0.12);
    expect(out.stats.flow).toBeCloseTo(flow, 9);
  });

  it('falls on the top of the slab inside the footprint of its cone', () => {
    // 0.296 m below the outlet a cone of 0.2 rad is 60 mm in radius; gravity pulls it in a
    // little, and the splash of the larger drops lands just outside.
    const deposits = out.deposits;
    if (deposits === undefined) throw new Error('no deposits');
    let inside = 0;
    let inner = 0;
    let total = 0;
    for (let i = 0; i < deposits.block.length; i++) {
      const b = deposits.block[i] as number;
      const r = Math.hypot(
        scene.blocks.centre[3 * b] as number,
        scene.blocks.centre[3 * b + 1] as number,
      );
      // Never on the underside.
      expect(scene.blocks.normal[3 * b + 2] as number).toBeGreaterThan(-0.5);
      total += deposits.mass[i] as number;
      if (r < 0.062) inside += deposits.mass[i] as number;
      if (r < 0.03) inner += deposits.mass[i] as number;
    }
    expect(inside / total).toBeGreaterThan(0.9);
    // Even over the solid angle of the cone. A drop leaving at 2.5 m/s at angle a from the
    // vertical falls the 0.296 m in about 0.099 s and lands 2.5 sin(a) x 0.099 m from the
    // axis: inside 30 mm for a < 0.121 rad, which is (1 - cos 0.121) / (1 - cos 0.2) = 0.367
    // of the cone. Drag shortens the throw a little; the splash of a landing carries a tenth
    // of it further out.
    expect(inner / total).toBeGreaterThan(0.31);
    expect(inner / total).toBeLessThan(0.41);
  });

  it('is the same on a repeat and different with another seed', async () => {
    const again = await secondaryWaterStage(input(scene, state), noJets(scene));
    expect(again.deposits?.block).toEqual(out.deposits?.block);
    expect(again.deposits?.mass).toEqual(out.deposits?.mass);
    const other = await secondaryWaterStage(input(scene, state, params, 6), noJets(scene));
    expect(other.ledger?.showers).toBe(out.ledger?.showers);
    expect(other.deposits?.mass).not.toEqual(out.deposits?.mass);
  });

  it('flies a source as its mass over the parcel mass, in whole units, whatever the count', async () => {
    // A parcel mass that does not divide the water of the shower: 997 parcels and a remainder.
    const units = Math.round((rho * flow * state.period) / WATER_UNIT);
    const few = params.with({
      'spray.parcelMass': [(units * WATER_UNIT) / 997.3, SHOWER_PARCEL],
    });
    const official = {
      ...input(scene, state, few),
      tier: { ...TIER_FAST, id: 'official' as const },
    };
    const result = await secondaryWaterStage(official, noJets(scene));
    const ledger = result.ledger;
    if (ledger === undefined) throw new Error('no ledger');
    expect(result.stats.paths).toBe(997);
    expect(ledger.showers % 997).not.toBe(0);
    expect(ledger.deposited + ledger.lost).toBe(ledger.showers);
    // A fixed sprayer may be flown with coarser parcels than the splatter of the jets.
    const coarse = few.with({ 'spray.showerParcelFactor': 4 });
    const fewer = await secondaryWaterStage({ ...official, params: coarse }, noJets(scene));
    expect(fewer.stats.paths).toBe(Math.round(997.3 / 4));
    expect(fewer.ledger?.deposited).toBeGreaterThan(0);
    expect((fewer.ledger?.deposited ?? 0) + (fewer.ledger?.lost ?? 0)).toBe(ledger.showers);
  });
});

describe('the sequence a source draws its parcels from', () => {
  it('fills every tenth of an axis with its share of 1,000 points, in every base', () => {
    for (const base of [2, 3, 5, 7, 11, 13]) {
      const bins = new Array<number>(10).fill(0);
      for (let k = 1; k <= 1000; k++) {
        const v = radicalInverse(k, base);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
        const bin = Math.floor(10 * v);
        bins[bin] = (bins[bin] as number) + 1;
      }
      // Random points would scatter by about 10 in a bin of 100; the sequence stays within 5.
      for (const n of bins) expect(Math.abs(n - 100)).toBeLessThanOrEqual(5);
    }
    // The first eight points in base 2 are the eighths, one each.
    const eighths = Array.from({ length: 8 }, (_, k) => radicalInverse(k, 2)).sort();
    expect(eighths).toEqual([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]);
  });
});

describe('the splatter of a jet standing on a plate', () => {
  const top = 0.2 + SLAB_HALF_THICKNESS;
  const scene = buildWashScene({
    items: [slab('plate', 0.15, 0.15, { p: [0, 0, 0.2], q: [0, 0, 0, 1] })],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const state = jetState({
    origin: [0, 0, top + 0.01],
    direction: [0, 0, -1],
    speed: 8,
    diameter: 2e-3,
  });

  it('leaves from a ring 4.5 jet diameters out and lands beyond it', async () => {
    const stage = input(scene, state, jetParams);
    const jets = await jetStage(stage);
    const out = await secondaryWaterStage(stage, jets);
    const ledger = out.ledger;
    const deposits = out.deposits;
    if (ledger === undefined || deposits === undefined || jets.ledger === undefined)
      throw new Error('no ledger');
    expect(ledger.sources).toBe(jets.ledger.splatter);
    expect(ledger.sources).toBe(ledger.deposited + ledger.lost);
    let total = 0;
    let far = 0;
    let weighted = 0;
    for (let i = 0; i < deposits.block.length; i++) {
      const b = deposits.block[i] as number;
      const r = Math.hypot(
        scene.blocks.centre[3 * b] as number,
        scene.blocks.centre[3 * b + 1] as number,
      );
      // Nothing lands inside the ring the droplets leave from (9 mm, less a block).
      expect(r).toBeGreaterThan(9e-3 - 3e-3);
      total += deposits.mass[i] as number;
      weighted += r * (deposits.mass[i] as number);
      if (r > 0.02) far += deposits.mass[i] as number;
    }
    // Droplets of 0.2 to 1 mm thrown at 3 to 7 m/s, 10 to 30 degrees above the plate, carry
    // centimetres to decimetres: most of the splatter leaves the neighbourhood of the jet.
    expect(far / total).toBeGreaterThan(0.8);
    expect(weighted / total).toBeGreaterThan(0.03);
    // Some of it flies clear of a 0.3 m plate.
    expect(ledger.lost).toBeGreaterThan(0);
  });
});

describe('the fans off a rack wire', () => {
  // A jet straight up on to a wire along y; a slab 50 mm above the wire catches the fans.
  const scene = buildWashScene({
    items: [slab('plate', 0.15, 0.15, { p: [0, 0, 0.2], q: [0, 0, 0, 1] })],
    machine: [wire('rack', [0, -0.14, 0.15], [0, 0.14, 0.15], 2e-3)],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const state = jetState({ origin: [0, 0, 0.1], direction: [0, 0, 1], speed: 8, diameter: 2e-3 });

  it('throws two sheets past the wire, 40 degrees to either side of the jet', async () => {
    const stage = input(scene, state, jetParams);
    const jets = await jetStage(stage);
    const out = await secondaryWaterStage(stage, jets);
    const deposits = out.deposits;
    if (deposits === undefined || out.ledger === undefined || jets.ledger === undefined)
      throw new Error('no ledger');
    expect(out.ledger.sources).toBe(jets.ledger.scatter);
    const plate = scene.itemInstance.get('plate');
    let left = 0;
    let right = 0;
    let offset = 0;
    for (let i = 0; i < deposits.block.length; i++) {
      const b = deposits.block[i] as number;
      if (scene.blocks.instance[b] !== plate) continue;
      const x = scene.blocks.centre[3 * b] as number;
      const mass = deposits.mass[i] as number;
      if (x > 0) right += mass;
      else left += mass;
      offset += Math.abs(x) * mass;
    }
    // Most of the fans reach the plate, half on each side of the wire.
    expect((left + right) / out.ledger.sources).toBeGreaterThan(0.7);
    expect(left / (left + right)).toBeGreaterThan(0.44);
    expect(left / (left + right)).toBeLessThan(0.56);
    // 46 mm above the wire, 40 degrees off the jet: about 40 mm to the side.
    const mean = offset / (left + right);
    expect(mean).toBeGreaterThan(0.025);
    expect(mean).toBeLessThan(0.055);
  });
});

describe('the landing table of the drip sites', () => {
  // A small slab 92 mm above a larger one: every block of its underside is a drip site.
  const scene = buildWashScene({
    items: [
      slab('lower', 0.15, 0.15, { p: [0, 0, 0.2], q: [0, 0, 0, 1] }),
      slab('upper', 0.05, 0.05, { p: [0, 0, 0.3], q: [0, 0, 0, 1] }),
    ],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const state = showerState([]);

  it('sends the whole of every site somewhere, in exact weights', async () => {
    const table = await dripTransfer(input(scene, state));
    expect(table.siteCount).toBe(scene.drips.count);
    expect(table.siteCount).toBeGreaterThan(500);
    for (let site = 0; site < table.siteCount; site++) {
      let total = table.sump[site] as number;
      for (let e = table.offsets[site] as number; e < (table.offsets[site + 1] as number); e++) {
        total += table.weight[e] as number;
        if (e > (table.offsets[site] as number)) {
          expect(table.target[e] as number).toBeGreaterThan(table.target[e - 1] as number);
        }
      }
      expect(total).toBe(DRIP_WEIGHT_ONE);
    }
    // Kept for the scene: the spray states of a wash share it.
    expect(await dripTransfer(input(scene, state))).toBe(table);
  });

  it('lands the drops of the upper slab on the lower one, straight below, with a little splash', async () => {
    const table = await dripTransfer(input(scene, state));
    const upper = scene.itemInstance.get('upper');
    const lower = scene.itemInstance.get('lower');
    let below = 0;
    let thrown = 0;
    let sites = 0;
    for (let site = 0; site < table.siteCount; site++) {
      const from = scene.drips.block[site] as number;
      if (scene.blocks.instance[from] !== upper) continue;
      // A site in the middle of the underside (not on the rounded edge).
      if ((scene.blocks.normal[3 * from + 2] as number) > -0.99) continue;
      if (
        Math.hypot(
          scene.blocks.centre[3 * from] as number,
          scene.blocks.centre[3 * from + 1] as number,
        ) > 0.03
      )
        continue;
      sites++;
      for (let e = table.offsets[site] as number; e < (table.offsets[site + 1] as number); e++) {
        const to = table.target[e] as number;
        expect(scene.blocks.instance[to]).toBe(lower);
        const away = Math.hypot(
          (scene.blocks.centre[3 * to] as number) - (scene.blocks.centre[3 * from] as number),
          (scene.blocks.centre[3 * to + 1] as number) -
            (scene.blocks.centre[3 * from + 1] as number),
        );
        if (away < 8e-3) below += table.weight[e] as number;
        else thrown += table.weight[e] as number;
      }
      thrown += table.sump[site] as number;
    }
    expect(sites).toBeGreaterThan(50);
    // A 6.7 mm drop after 92 mm of fall: We about 175 against a splash threshold near 100 on a
    // wetted wall, so about 8 % of it is thrown (r_m = 0.1 (We / We_c - 1)).
    const share = thrown / (below + thrown);
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.16);
  });
});

describe('droplets that belong to their source', () => {
  // A jet stands on a plate; a second slab stands 0.2 m to the side, out of reach of what the
  // plate throws at this elevation only in part: some of the splatter lands on it.
  const top = 0.2 + SLAB_HALF_THICKNESS;
  const state = jetState({
    origin: [0, 0, top + 0.01],
    direction: [0, 0, -1],
    speed: 8,
    diameter: 2e-3,
  });
  const sceneWith = (others: ReturnType<typeof slab>[]): WashScene =>
    buildWashScene({
      items: [slab('plate', 0.1, 0.1, { p: [0, 0, 0.2], q: [0, 0, 0, 1] }), ...others],
      machine: [],
      blockSize: 4e-3,
      materials: fixtureMaterial,
      params,
    });
  const onPlate = async (scene: WashScene, seed = 5): Promise<Map<number, number>> => {
    const stage = input(scene, state, jetParams, seed);
    const out = await secondaryWaterStage(stage, await jetStage(stage));
    const plate = scene.instances[scene.itemInstance.get('plate') as number];
    if (plate === undefined || out.deposits === undefined) throw new Error('no plate');
    const map = new Map<number, number>();
    for (let i = 0; i < out.deposits.block.length; i++) {
      const b = out.deposits.block[i] as number;
      if (b >= plate.firstBlock && b < plate.firstBlock + plate.blockCount) {
        map.set(b - plate.firstBlock, out.deposits.mass[i] as number);
      }
    }
    return map;
  };

  it('leaves what an untouched item receives unchanged when something is added elsewhere', async () => {
    const alone = await onPlate(sceneWith([]));
    // A slab below the plate, where none of the plate's splatter can land or come from, and
    // one that sorts before the plate by id, so that every block index of the plate shifts.
    const below = slab('a_below', 0.05, 0.05, { p: [0, 0, 0.1], q: [0, 0, 0, 1] });
    const crowded = await onPlate(sceneWith([below]));
    expect(alone.size).toBeGreaterThan(150);
    // The same blocks, each with the same water to within a unit of rounding (1e-12 kg).
    expect([...crowded.keys()]).toEqual([...alone.keys()]);
    for (const [block, units] of alone) {
      expect(Math.abs((crowded.get(block) as number) - units)).toBeLessThanOrEqual(1);
    }
    // Another seed is another sample: the droplets do depend on the seed.
    expect(await onPlate(sceneWith([]), 6)).not.toEqual(alone);
  });
});

describe('the splatter of a jet that strikes the inside of a cup at a glance', () => {
  // An upright cup of 30 mm inner radius, 3 mm thick, and a jet that comes in through its mouth
  // and strikes the wall 15 mm below the rim, 20 degrees off the wall and half round it. The
  // ring the splatter leaves from is laid out in the plane of the wall at the jet, 30 mm ahead
  // of it: 16 mm of that round the cup, where that plane is 4.5 mm outside the inner face, on
  // the far side of the wall.
  const radius = 0.03;
  const depth = 0.08;
  const top = 0.2 + 3e-3 + depth;
  const scene = buildWashScene({
    items: [cup('cup', radius, depth, { p: [0, 0, 0.2], q: [0, 0, 0, 1] })],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const norm = Math.hypot(0.2, 0.6, -0.77);
  const state = jetState({
    origin: [0.02, -0.02, top + 0.02],
    direction: [0.2 / norm, 0.6 / norm, -0.77 / norm],
    speed: 8,
    diameter: 2e-3,
  });

  it('is born on the wall the jet struck: none of it starts beyond the wall', async () => {
    const stage = input(scene, state, jetParams);
    const jets = await jetStage(stage);
    const out = await secondaryWaterStage(stage, jets);
    const { ledger, deposits } = out;
    if (ledger === undefined || deposits === undefined || jets.ledger === undefined)
      throw new Error('no ledger');
    expect(jets.ledger.splatter).toBeGreaterThan(0);
    expect(ledger.sources).toBe(ledger.deposited + ledger.lost);
    let inside = 0;
    let outside = 0;
    for (let i = 0; i < deposits.block.length; i++) {
      const b = deposits.block[i] as number;
      const x = scene.blocks.centre[3 * b] as number;
      const y = scene.blocks.centre[3 * b + 1] as number;
      const r = Math.hypot(x, y);
      // The outer face of the wall: beyond the inner radius and facing away from the axis.
      const outward =
        ((scene.blocks.normal[3 * b] as number) * x +
          (scene.blocks.normal[3 * b + 1] as number) * y) /
        Math.max(r, 1e-9);
      if (r > radius + 1e-3 && outward > 0.5) outside += deposits.mass[i] as number;
      else inside += deposits.mass[i] as number;
    }
    // Nearly all of it lands inside the cup it was thrown in; nothing on the outside of the wall.
    expect(inside).toBeGreaterThan(0.9 * ledger.sources);
    expect(outside).toBe(0);
  });
});

describe('a droplet at the mouth of a gap', () => {
  // Two plates on edge, 1 mm apart, under the 1.5 mm drops of a fixed sprayer that fall at a
  // slant across the gap: a point falls into the gap and strikes one of the faces inside it; a
  // drop is wider than the gap and stays on the edges at its mouth.
  const gap = 1e-3;
  const half = 0.06;
  const onEdge = { q: [0, Math.SQRT1_2, 0, Math.SQRT1_2] as [number, number, number, number] };
  const scene = buildWashScene({
    items: [
      slab('left', half, half, { p: [-(gap / 2 + SLAB_HALF_THICKNESS), 0, 0.2], ...onEdge }),
      slab('right', half, half, { p: [gap / 2 + SLAB_HALF_THICKNESS, 0, 0.2], ...onEdge }),
    ],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const slant = Math.hypot(0.15, 1);
  const state = showerState([
    {
      level: 'roof',
      origin: [-0.045, 0, 0.5],
      axis: [0.15 / slant, 0, -1 / slant],
      coneHalfAngle: 0.08,
      dropletSpeed: 2.5,
      flow: 1e-4,
    },
  ]);
  /** Water that lands on the two faces of the gap, more than 6 mm below its mouth, in units. */
  const inGap = (out: SecondaryWaterOutput): number => {
    let units = 0;
    const deposits = out.deposits;
    if (deposits === undefined) throw new Error('no deposits');
    for (let i = 0; i < deposits.block.length; i++) {
      const b = deposits.block[i] as number;
      const x = scene.blocks.centre[3 * b] as number;
      const z = scene.blocks.centre[3 * b + 2] as number;
      if (Math.abs(x) < gap && z < 0.2 + half - 6e-3) units += deposits.mass[i] as number;
    }
    return units;
  };

  it('falls into the gap as a point and stays at its mouth with its size', async () => {
    const points = await secondaryWaterStage(
      input(scene, state, params.with({ 'spray.outlineRays': 0 })),
      noJets(scene),
    );
    const drops = await secondaryWaterStage(input(scene, state), noJets(scene));
    expect(scene.contacts.count).toBeGreaterThan(0);
    expect(inGap(points)).toBeGreaterThan(0);
    expect(inGap(drops)).toBe(0);
    // The water is all there in both cases.
    expect(drops.ledger?.showers).toBe((drops.ledger?.deposited ?? 0) + (drops.ledger?.lost ?? 0));
    expect(points.ledger?.showers).toBe(drops.ledger?.showers);
  });
});
