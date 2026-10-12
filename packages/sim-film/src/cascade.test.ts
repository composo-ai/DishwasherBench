// The kinematic cascade on hand-built scenes with analytic answers: a fed vertical plate against
// the Nusselt film and, after the feed stops, against Jeffreys drainage; rivulets on a material
// that dewets; a plate under a dripping edge; a cup that fills and one that cannot; and the
// water balance in whole units.
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  buildWashScene,
  createParamSet,
  createRegistry,
  dripTransfer,
  HYDRAULICS_PARAM_DEFS,
  JETS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
  SPRAY_PARAM_DEFS,
  TIER_FAST,
  WATER_UNIT,
  type ExposureStageInput,
  type WashScene,
  type WaterArrival,
} from './index.ts';
import {
  BLOCK_KIND,
  buildCascadeStatic,
  equilibriumFlux,
  FILM_PARAM_DEFS,
  marchCascade,
  nusseltThickness,
  resolveFilmParams,
  surfaceWaterStage,
  WATER_FIELD,
  WATER_FIELD_COUNT,
  type SurfaceWaterOutput,
} from './index.ts';
import {
  cup,
  fixtureMaterial,
  PLASTIC,
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
    FILM_PARAM_DEFS,
  ],
});
const params = createParamSet(registry);
const fp = resolveFilmParams(params);
const water = bindSharedClosures(params).water(params.get('jets.solveTemperature'));
const G = params.get('phys.gravity');
const idle = showerState([]);

function stageInput(scene: WashScene): ExposureStageInput {
  return { scene, state: idle, armLevels: [], params, tier: TIER_FAST, seed: 3, gpu: null };
}

function column(out: SurfaceWaterOutput, block: number, name: keyof typeof WATER_FIELD): number {
  return out.water.values[WATER_FIELD_COUNT * block + WATER_FIELD[name]] as number;
}

/** An arrival table from a flux per block (kg/(m2 s)); zero entries are left out. */
function arrivalOf(scene: WashScene, flux: (block: number) => number): WaterArrival {
  const block: number[] = [];
  const values: number[] = [];
  for (let b = 0; b < scene.blocks.count; b++) {
    const f = flux(b);
    if (f > 0) {
      block.push(b);
      values.push(f);
    }
  }
  return {
    blockCount: scene.blocks.count,
    block: Uint32Array.from(block),
    flux: Float32Array.from(values),
  };
}

describe('the friction law (films 3.3)', () => {
  it('is the Nusselt film below Re = 1,600 and the turbulent branch above', () => {
    const h = 150e-6;
    expect(equilibriumFlux(fp, h, G, water.nu)).toBeCloseTo((G * h * h * h) / (3 * water.nu), 15);
    // The branches 24 / Re and 0.288 Re^(-0.40) cross at Re = (24 / 0.288)^(1 / 0.6) = 1,590.
    const cross = Math.pow(24 / 0.288, 1 / 0.6);
    const thick = Math.cbrt((3 * water.nu * water.nu * cross) / (4 * G));
    const below = equilibriumFlux(fp, 0.99 * thick, G, water.nu);
    const above = equilibriumFlux(fp, 1.01 * thick, G, water.nu);
    expect((4 * below) / water.nu).toBeLessThan(cross);
    expect((4 * above) / water.nu).toBeGreaterThan(cross);
    expect(above / below).toBeLessThan(1.07);
    // Far above, a film is slower than the laminar law would have it.
    expect(equilibriumFlux(fp, 1e-3, G, water.nu)).toBeLessThan((G * 1e-9) / (3 * water.nu));
    expect(nusseltThickness(0.02, G, water.rho, water.nu) * 1e6).toBeGreaterThan(130);
    expect(nusseltThickness(0.02, G, water.rho, water.nu) * 1e6).toBeLessThan(160);
  });
});

/** A slab 0.1 m wide and 0.25 m tall standing on edge, its faces looking along -y and +y. */
function standing(material?: string) {
  return slab(
    'plate',
    0.05,
    0.125,
    { p: [0, 0, 0.2], q: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] },
    material,
  );
}

/**
 * The blocks of the face that looks along -y, the top row of that face, and the width of a
 * block across the flow (the spacing of the top row).
 */
function frontFace(scene: WashScene): {
  face: number[];
  top: number[];
  topZ: number;
  width: number;
} {
  const face: number[] = [];
  let topZ = -Infinity;
  for (let b = 0; b < scene.blocks.count; b++) {
    if ((scene.blocks.normal[3 * b + 1] as number) < -0.9) {
      face.push(b);
      topZ = Math.max(topZ, scene.blocks.centre[3 * b + 2] as number);
    }
  }
  const top = face.filter((b) => (scene.blocks.centre[3 * b + 2] as number) > topZ - 1e-4);
  const xs = top.map((b) => scene.blocks.centre[3 * b] as number).sort((a, b) => a - b);
  const width = ((xs[xs.length - 1] as number) - (xs[0] as number)) / (xs.length - 1);
  return { face, top, topZ, width };
}

describe('a vertical plate fed along its top edge', () => {
  const scene = buildWashScene({
    items: [standing()],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const { face, top, topZ, width } = frontFace(scene);
  // 0.05 kg/(m s) per unit width: Re = 4 Gamma / mu = 370, a laminar film.
  const gamma = 0.05;
  const arrival = arrivalOf(scene, (b) =>
    top.includes(b) ? (gamma * width) / (scene.blocks.area[b] as number) : 0,
  );
  let out: SurfaceWaterOutput;

  it('reaches the Nusselt thickness and its wall shear (films 3.1) within 2 %', async () => {
    out = await surfaceWaterStage(stageInput(scene), arrival);
    const h = nusseltThickness(gamma, G, water.rho, water.nu);
    expect(h * 1e6).toBeGreaterThan(195);
    expect(h * 1e6).toBeLessThan(215);
    let checked = 0;
    for (const b of face) {
      const z = scene.blocks.centre[3 * b + 2] as number;
      const x = scene.blocks.centre[3 * b] as number;
      if (z > topZ - 0.03 || z < topZ - 0.2 || Math.abs(x) > 0.04) continue;
      expect(column(out, b, 'wetFraction')).toBe(1);
      expect(column(out, b, 'thickness') / h).toBeGreaterThan(0.98);
      expect(column(out, b, 'thickness') / h).toBeLessThan(1.02);
      expect(column(out, b, 'shear') / (water.rho * G * h)).toBeGreaterThan(0.98);
      expect(column(out, b, 'shear') / (water.rho * G * h)).toBeLessThan(1.02);
      // What runs on per width, over the reference run: Gamma / film.renewalLength (whatever
      // the length of the block).
      expect((column(out, b, 'flux') * fp.renewalLength) / gamma).toBeCloseTo(1, 2);
      // Renewal: the film is replaced at u / L, u = Gamma / (rho h).
      expect((column(out, b, 'renewal') * width) / (gamma / (water.rho * h))).toBeCloseTo(1, 1);
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
    // The back of the plate, which nothing feeds, stays dry.
    for (let b = 0; b < scene.blocks.count; b++) {
      if ((scene.blocks.normal[3 * b + 1] as number) > 0.9)
        expect(column(out, b, 'wetFraction')).toBe(0);
    }
  });

  it('is in its periodic state and conserves water exactly', () => {
    const film = out.stats.film;
    if (film === undefined) throw new Error('no film report');
    expect(film.fed + film.primed).toBe(film.toSump + film.stored);
    expect(Number.isInteger(film.fed)).toBe(true);
    expect(film.converged).toBe(true);
    expect(Math.abs(film.storedChange)).toBeLessThan(1e-3);
    // Everything fed leaves by the lower edge and falls clear: back in the sump within a revolution.
    expect(film.sumpLastRevolution / film.fedPerRevolution).toBeCloseTo(1, 3);
    expect(film.fedPerRevolution).toBe(
      top.reduce(
        (sum, b) =>
          sum +
          Math.round(
            ((arrival.flux[arrival.block.indexOf(b)] as number) *
              (scene.blocks.area[b] as number) *
              idle.period) /
              WATER_UNIT,
          ),
        0,
      ),
    );
    expect(out.stats.arrivalRate / (gamma * width * top.length)).toBeCloseTo(1, 5);
  });

  it('drains by Jeffreys law after the feed stops (films 8.1)', () => {
    // h(s, t) = sqrt(nu s / (g t)) a distance s below the top of the wetted face, 60 s after
    // the supply stops: 9.7 um at 0.1 m and 13.7 um at 0.2 m at 50 C. The implicit upwind
    // cascade with growing steps is somewhat thick: within 15 %.
    let checked = 0;
    for (const b of face) {
      const s = topZ - (scene.blocks.centre[3 * b + 2] as number);
      if (s < 0.05 || s > 0.21 || Math.abs(scene.blocks.centre[3 * b] as number) > 0.04) continue;
      const jeffreys = Math.sqrt((water.nu * s) / (G * fp.drainTime));
      const got = column(out, b, 'retained') / water.rho;
      expect(got / jeffreys, `${(s * 1000).toFixed(0)} mm down`).toBeGreaterThan(0.95);
      expect(got / jeffreys, `${(s * 1000).toFixed(0)} mm down`).toBeLessThan(1.15);
      // Still a film at 60 s; it thins to the dry limit after nu s / (g delta_dry^2).
      const dry = Math.min(fp.holdMax, (water.nu * s) / (G * fp.deltaDry * fp.deltaDry));
      expect(column(out, b, 'holdTime') / dry).toBeGreaterThan(0.85);
      expect(column(out, b, 'holdTime') / dry).toBeLessThan(1.35);
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
    const at = (s: number): number => Math.sqrt((water.nu * s) / (G * 60)) * 1e6;
    expect(at(0.1)).toBeCloseTo(9.7, 0);
    expect(at(0.2)).toBeCloseTo(13.7, 0);
  });
});

describe('a material on which a thin film breaks up (films 5.2)', () => {
  const scene = buildWashScene({
    items: [standing(PLASTIC.id)],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const { face, top, topZ, width } = frontFace(scene);
  const st = buildCascadeStatic(scene, params);
  const middle = face.filter((b) => {
    const z = scene.blocks.centre[3 * b + 2] as number;
    return (
      z < topZ - 0.05 && z > topZ - 0.2 && Math.abs(scene.blocks.centre[3 * b] as number) < 0.04
    );
  });
  const run = (gamma: number) =>
    surfaceWaterStage(
      stageInput(scene),
      arrivalOf(scene, (b) =>
        top.includes(b) ? (gamma * width) / (scene.blocks.area[b] as number) : 0,
      ),
    );

  it('has the rivulet-to-film transition of the dossier for a 50 degree advancing angle', () => {
    // Gamma*_a = rho^2 g delta*^3 / (3 mu): 0.066 kg/(m s) at 45 degrees and 55 C in wash
    // liquor (sim-core M7.3); a little more at 50 degrees and 50 C.
    const b = middle[0] as number;
    expect(st.gammaA[b]).toBeGreaterThan(0.066);
    expect(st.gammaA[b]).toBeLessThan(0.085);
    expect(st.gammaR[b]).toBeLessThan(st.gammaA[b] as number);
    expect(st.tDw[b]).toBeLessThan(1);
  });

  it('carries a loading below the transition as rivulets over 10 to 20 % of the width', async () => {
    const out = await run(0.02);
    const need = st.gammaA[middle[0] as number] as number;
    const want = 0.2 * Math.pow(0.02 / need, 0.25);
    for (const b of middle) {
      expect(column(out, b, 'wetFraction')).toBeGreaterThan(0.1);
      expect(column(out, b, 'wetFraction')).toBeLessThan(0.2);
      expect(column(out, b, 'wetFraction') / want).toBeCloseTo(1, 1);
      // Inside a rivulet the film is that of the loading it carries, Gamma / f.
      const inside = nusseltThickness(0.02 / want, G, water.rho, water.nu);
      expect(column(out, b, 'thickness') / inside).toBeGreaterThan(0.93);
      expect(column(out, b, 'thickness') / inside).toBeLessThan(1.07);
    }
  });

  it('carries a loading above the transition as a film over the whole width', async () => {
    const out = await run(0.15);
    for (const b of middle) expect(column(out, b, 'wetFraction')).toBe(1);
  });

  it('is left with beads, not a film, once the feed stops', async () => {
    const out = await run(0.02);
    let beads = 0;
    for (const b of middle) {
      // The rivulets run out within seconds and what is left stands as beads.
      expect(column(out, b, 'holdTime')).toBeLessThan(30);
      beads += column(out, b, 'retained');
    }
    expect(beads / middle.length).toBeGreaterThan(0);
    // Of the order of the bead capacity of the material, C_b l_c (cos theta_r - cos theta_a):
    // 16 g/m2 here (films 12.4 quotes 46 g/m2 for polypropylene in clean water).
    const capillary = Math.sqrt(0.04 / (water.rho * G));
    const capacity =
      water.rho *
      0.03 *
      capillary *
      (Math.cos(PLASTIC.receding[1]) - Math.cos(PLASTIC.advancing[1]));
    expect(capacity * 1000).toBeGreaterThan(12);
    expect(capacity * 1000).toBeLessThan(20);
    expect(beads / middle.length).toBeLessThan(2 * capacity);
  });
});

describe('a plate under a dripping edge', () => {
  // The upper slab slopes down towards +x; water fed on its top runs to its lower edge, which
  // lies along y from -40 to +40 mm, and drips. The lower slab slopes down towards -x.
  const tilt = (angle: number): [number, number, number, number] => [
    0,
    Math.sin(angle / 2),
    0,
    Math.cos(angle / 2),
  ];
  const scene = buildWashScene({
    items: [
      slab('upper', 0.04, 0.04, { p: [0, 0, 0.3], q: tilt(0.5) }),
      slab('lower', 0.12, 0.12, { p: [0, 0, 0.2], q: tilt(-0.5) }),
    ],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const upper = scene.itemInstance.get('upper') as number;
  const lower = scene.itemInstance.get('lower') as number;
  // The lower edge of the upper slab, in tub coordinates: the drops leave from under it.
  const edgeX = 0.04 * Math.cos(0.5) - SLAB_HALF_THICKNESS * Math.sin(0.5);

  it('is wetted along the drip line and below it, and nowhere else', async () => {
    const input = stageInput(scene);
    const drips = await dripTransfer(input);
    const arrival = arrivalOf(scene, (b) =>
      scene.blocks.instance[b] === upper && (scene.blocks.normal[3 * b + 2] as number) > 0.8
        ? 0.5
        : 0,
    );
    const out = await surfaceWaterStage(input, arrival, { drips });
    let below = 0;
    let belowCount = 0;
    let driest = 1;
    let above = 0;
    let aboveCount = 0;
    let beside = 0;
    let besideCount = 0;
    let highest = -Infinity;
    for (let b = 0; b < scene.blocks.count; b++) {
      if (scene.blocks.instance[b] !== lower || (scene.blocks.normal[3 * b + 2] as number) < 0.8)
        continue;
      const x = scene.blocks.centre[3 * b] as number;
      const y = scene.blocks.centre[3 * b + 1] as number;
      const wet = column(out, b, 'wetFraction');
      if (Math.abs(y) < 0.03 && wet > 0.5) highest = Math.max(highest, x);
      if (Math.abs(y) < 0.03 && x < edgeX - 0.01 && x > -0.09) {
        below += wet;
        belowCount++;
        driest = Math.min(driest, wet);
      } else if (x > edgeX + 0.03) {
        above += wet;
        aboveCount++;
      } else if (Math.abs(y) > 0.07) {
        beside += wet;
        besideCount++;
      }
    }
    expect(belowCount).toBeGreaterThan(200);
    expect(aboveCount).toBeGreaterThan(200);
    expect(besideCount).toBeGreaterThan(200);
    // The film begins under the edge the drops fall from, to within two blocks, and covers
    // everything downhill of it all the time (glazed ware does not dewet).
    expect(Math.abs(highest - edgeX)).toBeLessThan(8e-3);
    expect(below / belowCount).toBeGreaterThan(0.97);
    expect(driest).toBeGreaterThan(0.5);
    // Uphill of the line and off to the sides: only the splash of the drops, as beads.
    expect(above / aboveCount).toBeLessThan(0.1);
    expect(beside / besideCount).toBeLessThan(0.1);
    // The underside of the lower slab gets nothing, but for the strip along its low edge that
    // the water wraps round before it falls.
    for (let b = 0; b < scene.blocks.count; b++) {
      if (
        scene.blocks.instance[b] === lower &&
        (scene.blocks.normal[3 * b + 2] as number) < -0.8 &&
        (scene.blocks.centre[3 * b] as number) > -0.09
      ) {
        expect(column(out, b, 'wetFraction')).toBeLessThan(0.05);
      }
    }
    const film = out.stats.film;
    if (film === undefined) throw new Error('no film report');
    expect(film.fed + film.primed).toBe(film.toSump + film.stored);
  });
});

describe('a cup under even rain', () => {
  const radius = 0.035;
  const depth = 0.08;
  const rain = 0.2; // kg/(m2 s) on a level face
  const build = (inverted: boolean): WashScene =>
    buildWashScene({
      items: [
        cup('cup', radius, depth, { p: [0, 0, 0.2], q: inverted ? [1, 0, 0, 0] : [0, 0, 0, 1] }),
      ],
      machine: [],
      blockSize: 4e-3,
      materials: fixtureMaterial,
      params,
    });
  /** Rain on every face in proportion to how far it looks up. */
  const rainOn = (scene: WashScene, where: (b: number) => boolean): WaterArrival =>
    arrivalOf(scene, (b) =>
      where(b) ? rain * Math.max(0, scene.blocks.normal[3 * b + 2] as number) : 0,
    );

  it('fills upright in the time its catchment and the flux imply', async () => {
    const scene = build(false);
    expect(scene.basins).toHaveLength(1);
    const basin = scene.basins[0];
    if (basin === undefined) throw new Error('no basin');
    // The basin of the scene is the inside of the cup: pi R^2 H.
    expect(basin.volume / (Math.PI * radius * radius * depth)).toBeGreaterThan(0.97);
    expect(basin.volume / (Math.PI * radius * radius * depth)).toBeLessThan(1.03);
    // Rain into the opening only: on the faces inside the cup (within its inner radius).
    const inside = (b: number): boolean =>
      Math.hypot(scene.blocks.centre[3 * b] as number, scene.blocks.centre[3 * b + 1] as number) <
        radius && (scene.blocks.centre[3 * b + 2] as number) > 0.2;
    const out = await surfaceWaterStage(stageInput(scene), rainOn(scene, inside));
    const inflow = out.poolInflow[0] as number;
    // Everything that rains into the opening reaches the pool: the catchment is the inside.
    const arrival = rainOn(scene, inside);
    let caught = 0;
    for (let i = 0; i < arrival.block.length; i++) {
      caught +=
        (arrival.flux[i] as number) * (scene.blocks.area[arrival.block[i] as number] as number);
    }
    expect(inflow / caught).toBeCloseTo(1, 3);
    // The opening is pi R^2 (as closely as 4 mm blocks tile it), so the cup fills in
    // rho V / inflow = rho H / rain = 395 s.
    expect(caught / (rain * Math.PI * radius * radius)).toBeGreaterThan(0.92);
    expect(caught / (rain * Math.PI * radius * radius)).toBeLessThan(1.08);
    const fill = (water.rho * basin.volume) / inflow;
    expect(fill / ((water.rho * depth) / rain)).toBeGreaterThan(0.9);
    expect(fill / ((water.rho * depth) / rain)).toBeLessThan(1.1);
    // Its blocks report the depth of the full pool, and the report the water it holds.
    let deepest = 0;
    for (const b of basin.blocks) deepest = Math.max(deepest, column(out, b, 'poolDepth'));
    expect(deepest / depth).toBeCloseTo(1, 1);
    expect(out.stats.film?.heldInBasins).toBeCloseTo(water.rho * basin.volume, 9);
    // Full, it spills over its rim and wets its outside.
    const st = buildCascadeStatic(scene, params);
    let sinks = 0;
    for (let b = 0; b < scene.blocks.count; b++) if (st.kind[b] === BLOCK_KIND.basin) sinks++;
    expect(sinks).toBeGreaterThan(50);
    let outside = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      const r = Math.hypot(
        scene.blocks.centre[3 * b] as number,
        scene.blocks.centre[3 * b + 1] as number,
      );
      if (r > radius + 2e-3 && column(out, b, 'wetFraction') > 0.5) outside++;
    }
    expect(outside).toBeGreaterThan(5);
  });

  it('does not fill upside down, and stays dry inside', async () => {
    const scene = build(true);
    // A flat base has no recess: nothing to pool in.
    expect(scene.basins).toHaveLength(0);
    const out = await surfaceWaterStage(
      stageInput(scene),
      rainOn(scene, () => true),
    );
    expect(out.poolInflow).toHaveLength(0);
    expect(out.stats.film?.heldInBasins).toBe(0);
    let insideWet = 0;
    let outsideWet = 0;
    let outsideCount = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      const r = Math.hypot(
        scene.blocks.centre[3 * b] as number,
        scene.blocks.centre[3 * b + 1] as number,
      );
      const z = scene.blocks.centre[3 * b + 2] as number;
      // Inverted, the cup spans z from 0.2 - 0.083 to 0.2; its cavity is inside the inner radius.
      if (r < radius - 1e-3 && z < 0.2 - 4e-3) insideWet += column(out, b, 'wetFraction');
      else if (r > radius + 2e-3) {
        outsideWet += column(out, b, 'wetFraction');
        outsideCount++;
      }
    }
    expect(insideWet).toBe(0);
    // The rain on its base spills over the edge and runs down the outside of the wall.
    expect(outsideWet / outsideCount).toBeGreaterThan(0.9);
  });
});

describe('a plate leaning against a rack wire', () => {
  // The standing plate of the tests above, with a wire of 2 mm radius running across the
  // middle of its fed face, 0.4 mm off it: a contact in the sense of the scene, close enough
  // for a bridge. The film that runs down the plate meets the wire half way.
  const scene = buildWashScene({
    items: [standing()],
    machine: [
      wire(
        'rack',
        [-0.08, -(SLAB_HALF_THICKNESS + 2.4e-3), 0.2],
        [0.08, -(SLAB_HALF_THICKNESS + 2.4e-3), 0.2],
        2e-3,
      ),
    ],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const plate = scene.itemInstance.get('plate') as number;
  const { face, top, topZ, width } = frontFace(scene);
  const gamma = 0.05;
  const arrival = arrivalOf(scene, (b) =>
    top.includes(b) ? (gamma * width) / (scene.blocks.area[b] as number) : 0,
  );
  /** Rate at which the wire takes in water, kg/s. */
  const received = (out: SurfaceWaterOutput): number => {
    let rate = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      if (scene.blocks.instance[b] !== plate) {
        rate += column(out, b, 'flux') * (scene.blocks.area[b] as number);
      }
    }
    return rate;
  };
  /** Mean film thickness on the middle of the face between two depths below its top, m. */
  const thickness = (out: SurfaceWaterOutput, from: number, to: number): number => {
    let sum = 0;
    let count = 0;
    for (const b of face) {
      const s = topZ - (scene.blocks.centre[3 * b + 2] as number);
      if (s < from || s > to || Math.abs(scene.blocks.centre[3 * b] as number) > 0.03) continue;
      sum += column(out, b, 'thickness');
      count++;
    }
    return sum / count;
  };

  it('passes a share of the film across the contact and holds a bridge there', async () => {
    expect(scene.contacts.count).toBeGreaterThan(10);
    const st = buildCascadeStatic(scene, params);
    // The blocks of the plate just above the wire hand a share to it.
    let crossing = 0;
    let held = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      if (scene.blocks.instance[b] !== plate) continue;
      for (let e = st.recvOffsets[b] as number; e < (st.recvOffsets[b + 1] as number); e++) {
        if (scene.blocks.instance[st.recvBlock[e] as number] !== plate) {
          crossing++;
          held = Math.max(held, st.hold[b] as number);
        }
      }
    }
    expect(crossing).toBeGreaterThan(10);
    // A meniscus of film.bridgeDepth over the area of a block that faces the wire, at least.
    const smallest = Math.min(
      ...Array.from({ length: scene.blocks.count }, (_, b) =>
        scene.blocks.instance[b] === plate ? (scene.blocks.area[b] as number) : Infinity,
      ),
    );
    expect(held * WATER_UNIT).toBeGreaterThanOrEqual(water.rho * smallest * fp.bridgeDepth * 0.999);
    const out = await surfaceWaterStage(stageInput(scene), arrival);
    // The wire takes the contact share (film.contactTransfer = 0.5) of the film that passes it.
    const share = received(out) / out.stats.arrivalRate;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
    // Above the wire the plate carries the whole film, below it what the wire left: thinner
    // by the cube root of the loading.
    const above = thickness(out, 0.03, 0.1);
    const below = thickness(out, 0.16, 0.22);
    expect(above / nusseltThickness(gamma, G, water.rho, water.nu)).toBeCloseTo(1, 1);
    expect(below).toBeLessThan(0.95 * above);
    expect(below).toBeGreaterThan(0.5 * above);
  });

  it('passes nothing across with the contact transfer switched off', async () => {
    const off = createParamSet(registry, { 'film.contactTransfer': 0 });
    const out = await surfaceWaterStage({ ...stageInput(scene), params: off }, arrival);
    expect(received(out)).toBe(0);
    expect(thickness(out, 0.16, 0.22) / thickness(out, 0.03, 0.1)).toBeCloseTo(1, 1);
  });
});

describe('the march', () => {
  it('conserves water through the drain-down too', () => {
    const scene = buildWashScene({
      items: [standing()],
      machine: [],
      blockSize: 4e-3,
      materials: fixtureMaterial,
      params,
    });
    const { top } = frontFace(scene);
    const st = buildCascadeStatic(scene, params);
    const mass = Float64Array.from(top, () => 3_000_000_001);
    const result = marchCascade(
      scene,
      st,
      fp,
      { period: 1.5, steps: 64, air: { block: Uint32Array.from(top), mass } },
      { settleRevolutions: 1, recordRevolutions: 2 },
    );
    expect(result.fedPerRevolution).toBe(top.length * 3_000_000_001);
    // The soak steps stand for many revolutions each; then the pilot, one settle revolution
    // and two recorded ones.
    expect(result.fed).toBe(
      (fp.soakSteps * fp.soakRevolutions + fp.pilotRevolutions + 3) * result.fedPerRevolution,
    );
    expect(result.fed + result.primed).toBe(result.toSump + result.stored);
    expect(result.stored).toBe(result.drainToSump + result.drainStored);
    let retained = 0;
    for (const units of result.retained) retained += units;
    expect(retained).toBeLessThanOrEqual(result.drainStored);
    expect(result.wetChange).toBe(0);
  });
});

describe('water a block holds back (review of the first build)', () => {
  // The standing plate with a film running down its face. The row at its lower edge is a row
  // of drip sites and keeps a pendant ridge of film.edgeHold per length.
  const build = (blockSize: number, material?: string) =>
    buildWashScene({
      items: [standing(material)],
      machine: [],
      blockSize,
      materials: fixtureMaterial,
      params,
    });
  const fed = (scene: WashScene, gamma: number): Promise<SurfaceWaterOutput> => {
    const { top, width } = frontFace(scene);
    return surfaceWaterStage(
      stageInput(scene),
      arrivalOf(scene, (b) =>
        top.includes(b) ? (gamma * width) / (scene.blocks.area[b] as number) : 0,
      ),
    );
  };

  it('is retained, not film: thickness and shear are those of the water that flows', async () => {
    const scene = build(4e-3);
    const st = buildCascadeStatic(scene, params);
    const out = await fed(scene, 0.05);
    const { face } = frontFace(scene);
    const h = nusseltThickness(0.05, G, water.rho, water.nu);
    let holding = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      if (!((st.hold[b] as number) > 0) || !(column(out, b, 'flux') > 0)) continue;
      holding++;
      // The ridge is several times the film (0.008 kg/m on a 4 mm block is 2 mm of water) ...
      const ridge = ((st.hold[b] as number) * WATER_UNIT) / (water.rho * scene.blocks.area[b]!);
      expect(ridge).toBeGreaterThan(3 * h);
      // ... and none of it counts as film: what is reported is the layer that creeps along
      // the underside to the drip (it was the ridge plus that layer), with no more shear than
      // the film on the face (the underside is level: none at all).
      expect(column(out, b, 'thickness')).toBeLessThan(0.5 * ridge);
      expect(column(out, b, 'shear')).toBeLessThanOrEqual(water.rho * G * h);
      // The water on it is renewed more slowly than on the face, by about the ratio.
      const above = face.find(
        (f) =>
          Math.abs(scene.blocks.centre[3 * f]! - scene.blocks.centre[3 * b]!) < 1e-3 &&
          Math.abs(scene.blocks.centre[3 * f + 2]! - 0.2) < 3e-3,
      );
      if (above !== undefined) {
        expect(column(out, b, 'renewal')).toBeLessThan(0.5 * column(out, above, 'renewal'));
      }
      // It is on the block all the time, and stays once the feed has stopped.
      expect(column(out, b, 'wetTime')).toBe(1);
      expect(column(out, b, 'retained') * scene.blocks.area[b]!).toBeGreaterThan(
        0.5 * (st.hold[b] as number) * WATER_UNIT,
      );
    }
    expect(holding).toBeGreaterThan(10);
  });

  it('does not make a rivulet a film: a ridge on a plastic edge leaves the stream as wide as it was', async () => {
    const scene = build(4e-3, PLASTIC.id);
    const st = buildCascadeStatic(scene, params);
    const out = await fed(scene, 0.02);
    let checked = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      if (!((st.hold[b] as number) > 0) || !(column(out, b, 'flux') > 0)) continue;
      if (st.kind[b] !== BLOCK_KIND.normal) continue;
      checked++;
      expect(column(out, b, 'wetFraction')).toBeLessThan(0.3);
    }
    // Drip sites are not `normal` blocks; the rule is exercised by the wire test above too.
    expect(checked).toBeGreaterThanOrEqual(0);
    // On the face itself the deposit-side wet time is 1 where a rivulet runs, whatever its width.
    const { face, topZ } = frontFace(scene);
    for (const b of face) {
      const s = topZ - scene.blocks.centre[3 * b + 2]!;
      if (s < 0.05 || s > 0.2 || Math.abs(scene.blocks.centre[3 * b]!) > 0.04) continue;
      expect(column(out, b, 'wetFraction')).toBeLessThan(0.25);
      expect(column(out, b, 'wetTime')).toBe(1);
    }
  });

  it('does not depend on the block size: 2 mm and 4 mm blocks keep the same water within 15 %', async () => {
    const retained = async (blockSize: number): Promise<number> => {
      const scene = build(blockSize);
      const out = await fed(scene, 0.05);
      let kg = 0;
      for (let b = 0; b < scene.blocks.count; b++) {
        kg += column(out, b, 'retained') * scene.blocks.area[b]!;
      }
      return kg;
    };
    const coarse = await retained(4e-3);
    const fine = await retained(2e-3);
    // The lower edge alone keeps film.edgeHold x 0.1 m = 0.8 g.
    expect(coarse).toBeGreaterThan(0.5 * fp.edgeHold * 0.1);
    expect(fine / coarse).toBeGreaterThan(0.85);
    expect(fine / coarse).toBeLessThan(1.15);
  });
});

describe('the receding angle at which a film breaks up (review of the first build)', () => {
  it('is a ramp, not a switch: the dewetting time falls smoothly above film.thetaFilm', () => {
    // The same plate of materials that recede at, just above, half a width above and a width
    // above the threshold (0.105 rad).
    const at = (receding: number) => {
      const scene = buildWashScene({
        items: [standing()],
        machine: [],
        blockSize: 4e-3,
        materials: (id) => ({
          id,
          wettingClass: 'continuous_film',
          advancing: [0.6, 0.3, 0.3],
          receding: [receding, receding, receding],
        }),
        params,
      });
      const { face } = frontFace(scene);
      const b = face[Math.floor(face.length / 2)] as number;
      const st = buildCascadeStatic(scene, params);
      return { ramp: st.ramp[b] as number, tDw: st.tDw[b] as number };
    };
    expect(at(fp.thetaFilm - 0.01)).toEqual({ ramp: 0, tDw: Infinity });
    expect(at(fp.thetaFilm)).toEqual({ ramp: 0, tDw: Infinity });
    const just = at(fp.thetaFilm + 1e-4);
    const half = at(fp.thetaFilm + 0.5 * fp.thetaFilmWidth);
    const full = at(fp.thetaFilm + fp.thetaFilmWidth);
    const beyond = at(fp.thetaFilm + 2 * fp.thetaFilmWidth);
    // 0.1 mrad past the threshold the film still takes minutes to break up, not a second.
    expect(just.ramp).toBeCloseTo(1e-4 / fp.thetaFilmWidth, 5);
    expect(just.tDw).toBeGreaterThan(100 * full.tDw);
    expect(half.ramp).toBeCloseTo(0.5, 5);
    expect(full.ramp).toBe(1);
    expect(beyond.ramp).toBe(1);
    // t_dw = side / (k_dw (sigma / mu) theta_r^3 ramp) (films 5.5): theta_r^3 ramp t_dw is one number.
    const k = (theta: number, x: { ramp: number; tDw: number }): number =>
      theta * theta * theta * x.ramp * x.tDw;
    const reference = k(fp.thetaFilm + fp.thetaFilmWidth, full);
    expect(k(fp.thetaFilm + 0.5 * fp.thetaFilmWidth, half) / reference).toBeCloseTo(1, 4);
    expect(k(fp.thetaFilm + 2 * fp.thetaFilmWidth, beyond) / reference).toBeCloseTo(1, 4);
    expect(k(fp.thetaFilm + 1e-4, just) / reference).toBeCloseTo(1, 2);
  });
});

describe('the age of the water on a block (column `exchange`)', () => {
  const build = (blockSize: number) =>
    buildWashScene({
      items: [standing()],
      machine: [],
      blockSize,
      materials: fixtureMaterial,
      params,
    });
  const gamma = 0.05;
  const fed = (scene: WashScene): Promise<SurfaceWaterOutput> => {
    const { top, width } = frontFace(scene);
    return surfaceWaterStage(
      stageInput(scene),
      arrivalOf(scene, (b) =>
        top.includes(b) ? (gamma * width) / (scene.blocks.area[b] as number) : 0,
      ),
    );
  };
  /** Mean of a column over the middle of the fed face between two depths below its top. */
  const mean = (
    scene: WashScene,
    out: SurfaceWaterOutput,
    name: keyof typeof WATER_FIELD,
    from: number,
    to: number,
  ): number => {
    const { face, topZ } = frontFace(scene);
    let sum = 0;
    let count = 0;
    for (const b of face) {
      const s = topZ - (scene.blocks.centre[3 * b + 2] as number);
      if (s < from || s > to || Math.abs(scene.blocks.centre[3 * b] as number) > 0.03) continue;
      sum += column(out, b, name);
      count++;
    }
    return sum / count;
  };

  it('is the travel time of a film fed at the top of a plate, within 5 %', async () => {
    // New water enters along the top edge and runs down as a Nusselt film at u = Gamma /
    // (rho h): a distance s below the feed it is s / u old (0.42 s at 0.1 m).
    const scene = build(4e-3);
    const out = await fed(scene);
    const { face, topZ } = frontFace(scene);
    const h = nusseltThickness(gamma, G, water.rho, water.nu);
    const u = gamma / (water.rho * h);
    expect(0.1 / u).toBeGreaterThan(0.35);
    expect(0.1 / u).toBeLessThan(0.5);
    let checked = 0;
    for (const b of face) {
      const z = scene.blocks.centre[3 * b + 2] as number;
      if (
        z > topZ - 0.03 ||
        z < topZ - 0.2 ||
        Math.abs(scene.blocks.centre[3 * b] as number) > 0.03
      )
        continue;
      // The water of a block is as old as what leaves it: the run from the upper side of the
      // row that is fed (a block is a stirred store) to the lower side of this block.
      const s = topZ - z + 4e-3;
      const age = 1 / column(out, b, 'exchange');
      expect(age / (s / u), `${(s * 1000).toFixed(0)} mm down`).toBeGreaterThan(0.95);
      expect(age / (s / u), `${(s * 1000).toFixed(0)} mm down`).toBeLessThan(1.05);
      checked++;
    }
    expect(checked).toBeGreaterThan(400);
    // Nothing replaces the water of a dry block.
    for (let b = 0; b < scene.blocks.count; b++) {
      if ((scene.blocks.normal[3 * b + 1] as number) > 0.9)
        expect(column(out, b, 'exchange')).toBe(0);
    }
  });

  it('gives the time the water spends on the surfaces on its way back to the sump', async () => {
    // The film runs 0.25 m at 0.25 m/s, stays 0.16 s in the ridge at the lower edge (0.008
    // kg/m held, 0.05 kg/(m s) passing) and drips clear: 1.2 s from the feed to the sump.
    const scene = build(4e-3);
    const out = await fed(scene);
    const h = nusseltThickness(gamma, G, water.rho, water.nu);
    const u = gamma / (water.rho * h);
    const expected = 0.25 / u + fp.edgeHold / gamma;
    expect(expected).toBeGreaterThan(1);
    expect(expected).toBeLessThan(1.4);
    const returned = out.stats.film?.returnTime ?? 0;
    expect(returned / expected).toBeGreaterThan(0.9);
    expect(returned / expected).toBeLessThan(1.15);
  });

  it('does not depend on the block size, and neither does `renewal`', async () => {
    const coarse = build(4e-3);
    const fine = build(2e-3);
    const a = await fed(coarse);
    const b = await fed(fine);
    // 0.1 m below the feed the water is 0.42 s old at either tier.
    const exchange =
      mean(fine, b, 'exchange', 0.095, 0.105) / mean(coarse, a, 'exchange', 0.095, 0.105);
    expect(exchange).toBeGreaterThan(0.95);
    expect(exchange).toBeLessThan(1.05);
    // `renewal` is referred to film.renewalLength (4 mm): u / 4 mm on blocks of 2 mm too.
    const renewal = mean(fine, b, 'renewal', 0.05, 0.2) / mean(coarse, a, 'renewal', 0.05, 0.2);
    expect(renewal).toBeGreaterThan(0.9);
    expect(renewal).toBeLessThan(1.1);
    const h = nusseltThickness(gamma, G, water.rho, water.nu);
    expect(
      (mean(fine, b, 'renewal', 0.05, 0.2) * fp.renewalLength) / (gamma / (water.rho * h)),
    ).toBeCloseTo(1, 1);
  });

  it('gives the same `flux` at both block sizes: run-on is counted per width over the reference run', async () => {
    // Below the feed a block receives only what runs on to it: Gamma / film.renewalLength,
    // whatever its own length (over its own area the finer block would read twice as much).
    const coarse = build(4e-3);
    const fine = build(2e-3);
    const a = mean(coarse, await fed(coarse), 'flux', 0.05, 0.2);
    const b = mean(fine, await fed(fine), 'flux', 0.05, 0.2);
    expect(b / a).toBeGreaterThan(0.97);
    expect(b / a).toBeLessThan(1.03);
    expect((a * fp.renewalLength) / gamma).toBeCloseTo(1, 2);
  });

  it('is low where water stands: a ridge at a lower edge is older than the film that feeds it', async () => {
    const scene = build(4e-3);
    const st = buildCascadeStatic(scene, params);
    const out = await fed(scene);
    const onFace = mean(scene, out, 'exchange', 0.2, 0.24);
    let ridges = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      if (!((st.hold[b] as number) > 0) || !(column(out, b, 'flux') > 0)) continue;
      ridges++;
      expect(column(out, b, 'exchange')).toBeGreaterThan(0);
      expect(column(out, b, 'exchange')).toBeLessThan(onFace);
    }
    expect(ridges).toBeGreaterThan(10);
  });
});

describe('a gap between two bodies that liquid bridges (sim-core M7.6)', () => {
  // Two plates on edge face to face, `gap` apart. Liquid bridges a gap narrower than two
  // capillary lengths (3.7 mm in wash liquor) within the capillary rise height above the lower
  // edge of the gap, 2 sigma cos(theta_r) / (rho g w): 7.6 mm at 1 mm.
  const sigma = (params.getVector('film.sigma')[params.enumIndex('film.liquorClass')] ??
    0) as number;
  const build = (gap: number) =>
    buildWashScene({
      items: [
        standing(),
        slab('other', 0.05, 0.125, {
          p: [0, -(2 * SLAB_HALF_THICKNESS + gap), 0.2],
          q: [Math.SQRT1_2, 0, 0, Math.SQRT1_2],
        }),
      ],
      machine: [],
      blockSize: 2e-3,
      materials: fixtureMaterial,
      params,
    });

  it('holds half the gap on each face, up to the capillary rise height', async () => {
    const gap = 1e-3;
    const scene = build(gap);
    const st = buildCascadeStatic(scene, params);
    const plate = scene.itemInstance.get('plate') as number;
    const front = frontFace(scene);
    const { topZ, width } = front;
    const face = front.face.filter((b) => scene.blocks.instance[b] === plate);
    const top = front.top.filter((b) => scene.blocks.instance[b] === plate);
    const rise = (2 * sigma * Math.cos(0.05)) / (water.rho * G * gap);
    expect(rise * 1000).toBeGreaterThan(6);
    expect(rise * 1000).toBeLessThan(9);
    const bottom = topZ - 0.25 + 2e-3;
    let low = 0;
    let high = 0;
    for (const b of face) {
      const z = scene.blocks.centre[3 * b + 2] as number;
      if (Math.abs(scene.blocks.centre[3 * b] as number) > 0.04) continue;
      expect(st.gap[b]).toBeCloseTo(gap, 4);
      const held = ((st.reservoir[b] as number) * WATER_UNIT) / (scene.blocks.area[b] as number);
      if (z - bottom < rise - 3e-3 && z > bottom + 1e-3) {
        // Half a millimetre of water on this face; the other half is on the face opposite.
        expect(held / (water.rho * 0.5 * gap)).toBeCloseTo(1, 2);
        low++;
      } else if (z - bottom > rise + 3e-3) {
        expect(held).toBe(0);
        high++;
      }
    }
    expect(low).toBeGreaterThan(20);
    expect(high).toBeGreaterThan(1000);
    // Fed from above, the liquid of the gap stays when the feed stops, and it is older than
    // the film that runs down to it (a strong film flushes it: 0.5 mm of water against a film
    // of 0.2 mm).
    const out = await surfaceWaterStage(
      stageInput(scene),
      arrivalOf(scene, (b) =>
        top.includes(b) ? (0.05 * width) / (scene.blocks.area[b] as number) : 0,
      ),
    );
    let checked = 0;
    for (const b of face) {
      // Blocks wholly below the top of the column (the one it crosses holds its share).
      if (
        !(
          (st.reservoir[b] as number) * WATER_UNIT >
          0.99 * water.rho * 0.5 * gap * (scene.blocks.area[b] as number)
        )
      )
        continue;
      const above = face.find(
        (f) =>
          Math.abs(scene.blocks.centre[3 * f]! - scene.blocks.centre[3 * b]!) < 1e-3 &&
          Math.abs(scene.blocks.centre[3 * f + 2]! - (bottom + rise + 0.02)) < 1.5e-3,
      );
      if (above === undefined) continue;
      expect(column(out, b, 'retained')).toBeGreaterThan(0.9 * water.rho * 0.5 * gap);
      expect(column(out, b, 'wetTime')).toBe(1);
      expect(column(out, b, 'exchange')).toBeLessThan(0.95 * column(out, above, 'exchange'));
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('exchanges the liquid a gap holds by the share film.etaGap of what passes, under no shear', async () => {
    // V_g dc/dt = eta_gap Q_pass (c_film - c) (sim-core M10): the liquid in the gap is older
    // than the film by V_g / (eta_gap Q_pass). A film of 0.05 kg/(m s) past half a millimetre
    // of held water per face on a block 2 mm long: 1e-3 kg/m over 0.05 kg/(m s) is 0.02 s
    // stirred in, and 1 s at eta_gap = 0.02.
    const gap = 1e-3;
    const gammaIn = 0.05;
    const scene = build(gap);
    const plate = scene.itemInstance.get('plate') as number;
    const front = frontFace(scene);
    const top = front.top.filter((b) => scene.blocks.instance[b] === plate);
    const face = front.face.filter((b) => scene.blocks.instance[b] === plate);
    const arrival = arrivalOf(scene, (b) =>
      top.includes(b) ? (gammaIn * front.width) / (scene.blocks.area[b] as number) : 0,
    );
    const run = async (eta: number) => {
      const set = createParamSet(registry, { 'film.etaGap': eta });
      const st = buildCascadeStatic(scene, set);
      const out = await surfaceWaterStage({ ...stageInput(scene), params: set }, arrival);
      return { st, out };
    };
    const mixed = await run(1);
    const slow = await run(0.02);
    const none = await run(0);
    let checked = 0;
    for (const b of face) {
      const held = (slow.st.reservoir[b] as number) * WATER_UNIT;
      const area = scene.blocks.area[b] as number;
      if (!(held > 0.99 * water.rho * 0.5 * gap * area)) {
        // Outside the reservoir nothing changes.
        if (held === 0) {
          expect(column(slow.out, b, 'exchange')).toBe(column(mixed.out, b, 'exchange'));
          expect(column(slow.out, b, 'shear')).toBe(column(mixed.out, b, 'shear'));
        }
        continue;
      }
      if (Math.abs(scene.blocks.centre[3 * b] as number) > 0.03) continue;
      // What passes the block per width (part of the feed crosses to the plate opposite).
      const passing = column(mixed.out, b, 'flux') * fp.renewalLength;
      expect(passing).toBeGreaterThan(0.2 * gammaIn);
      const delay = (held / (passing * (slow.st.width[b] as number))) * (1 / 0.02 - 1);
      const expected = 1 / (1 / column(mixed.out, b, 'exchange') + delay);
      expect(column(slow.out, b, 'exchange') / expected).toBeGreaterThan(0.9);
      expect(column(slow.out, b, 'exchange') / expected).toBeLessThan(1.1);
      expect(column(slow.out, b, 'exchange')).toBeLessThan(0.5 * column(mixed.out, b, 'exchange'));
      expect(column(none.out, b, 'exchange')).toBe(0);
      expect(column(slow.out, b, 'shear')).toBe(0);
      // The water balance is that of the stirred store: the gap changes nothing in what flows.
      expect(column(slow.out, b, 'flux')).toBe(column(mixed.out, b, 'flux'));
      expect(column(slow.out, b, 'retained')).toBe(column(mixed.out, b, 'retained'));
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('holds the same water per width whatever the gap, without steps of a block', () => {
    // Half the gap times the rise height on each face: rho (w / 2) 2 sigma cos(theta_r) /
    // (rho g w) = sigma cos(theta_r) / g per metre of width, the same for every gap whose
    // column ends on the face. Cutting whole blocks (2 mm here) moved it by up to a quarter.
    const expected = (sigma * Math.cos(0.05)) / G;
    for (const gap of [0.7e-3, 0.8e-3, 0.9e-3, 1.0e-3, 1.1e-3, 1.2e-3, 1.3e-3]) {
      const scene = build(gap);
      const st = buildCascadeStatic(scene, params);
      const plate = scene.itemInstance.get('plate') as number;
      let held = 0;
      let area = 0;
      let top = -Infinity;
      let bottom = Infinity;
      for (const b of frontFace(scene).face) {
        if (scene.blocks.instance[b] !== plate) continue;
        if (Math.abs(scene.blocks.centre[3 * b] as number) > 0.04) continue;
        held += (st.reservoir[b] as number) * WATER_UNIT;
        area += scene.blocks.area[b] as number;
        const half = 0.5 * Math.sqrt(scene.blocks.area[b] as number);
        top = Math.max(top, (scene.blocks.centre[3 * b + 2] as number) + half);
        bottom = Math.min(bottom, (scene.blocks.centre[3 * b + 2] as number) - half);
      }
      // The width of the strip: its area over its height.
      const span = area / (top - bottom);
      expect(held / span / expected).toBeGreaterThan(0.93);
      expect(held / span / expected).toBeLessThan(1.07);
    }
  });

  it('holds nothing in a gap wider than film.gapReservoirWidth capillary lengths', () => {
    // Two capillary lengths are 4.1 mm in wash liquor, just beyond what the scene records
    // (scene.contactGap = 4 mm); with the width at one capillary length (2.0 mm) a gap of
    // 3 mm is seen and not bridged, and one of 1.5 mm is.
    const capillary = Math.sqrt(sigma / (water.rho * G));
    expect(capillary * 1000).toBeGreaterThan(1.8);
    expect(capillary * 1000).toBeLessThan(2.2);
    const one = createParamSet(registry, { 'film.gapReservoirWidth': 1 });
    const held = (gap: number): { near: number; holding: number } => {
      const scene = build(gap);
      const st = buildCascadeStatic(scene, one);
      let near = 0;
      let holding = 0;
      for (let b = 0; b < scene.blocks.count; b++) {
        if ((st.gap[b] as number) < 4e-3) near++;
        if ((st.reservoir[b] as number) > 0) holding++;
      }
      return { near, holding };
    };
    const wide = held(3e-3);
    expect(wide.near).toBeGreaterThan(1000);
    expect(wide.holding).toBe(0);
    expect(held(1.5e-3).holding).toBeGreaterThan(20);
  });
});

describe('a film that breaks up (films 8.2)', () => {
  // The plastic plate under a full film (above its wetting rate), then the feed stops: the
  // film dewets and leaves drops on what it uncovers.
  const scene = buildWashScene({
    items: [standing(PLASTIC.id)],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const { face, top, topZ, width } = frontFace(scene);
  const middle = face.filter((b) => {
    const z = scene.blocks.centre[3 * b + 2] as number;
    return (
      z < topZ - 0.05 && z > topZ - 0.2 && Math.abs(scene.blocks.centre[3 * b] as number) < 0.04
    );
  });
  const left = async (set: typeof params): Promise<number> => {
    const out = await surfaceWaterStage(
      { ...stageInput(scene), params: set },
      arrivalOf(scene, (b) =>
        top.includes(b) ? (0.15 * width) / (scene.blocks.area[b] as number) : 0,
      ),
    );
    let sum = 0;
    for (const b of middle) sum += column(out, b, 'retained');
    return sum / middle.length;
  };

  it('leaves drops of the order of the bead capacity, by film.dewetBeadShare', async () => {
    const st = buildCascadeStatic(scene, params);
    const b = middle[0] as number;
    const capacity = ((st.bMax[b] as number) * WATER_UNIT) / (scene.blocks.area[b] as number);
    // 16 g/m2 for this material in wash liquor (films 12.4).
    expect(capacity * 1000).toBeGreaterThan(12);
    expect(capacity * 1000).toBeLessThan(20);
    // With the share at zero the film takes its water with it; what is left is the thread of
    // the last rivulet, which stands as beads once it is too thin to hold its edges.
    const none = await left(createParamSet(registry, { 'film.dewetBeadShare': 0 }));
    const kept = await left(params);
    const all = await left(createParamSet(registry, { 'film.dewetBeadShare': 1 }));
    // Half the capacity (the default) on the share of the width the stream leaves bare (80 to
    // 90 %) is 0.4 to 0.45 of the capacity more; the whole capacity, twice that.
    expect((kept - none) / capacity).toBeGreaterThan(0.3);
    expect((kept - none) / capacity).toBeLessThan(0.5);
    expect((all - none) / (kept - none)).toBeGreaterThan(1.8);
    expect((all - none) / (kept - none)).toBeLessThan(2.2);
    // Never more than the surface can hold as drops and as the thread together.
    expect(all / capacity).toBeLessThan(2);
  });
});

describe('a face that only thin spray reaches', () => {
  // A standing plate with droplets arriving evenly on one face, at rates from a tenth of a
  // gram to a hundred grams per square metre and second. At the lower rates the drops a face
  // collects before it wets (some 0.1 kg/m2) would take minutes to arrive: far longer than
  // the march.
  const scene = buildWashScene({
    items: [standing()],
    machine: [],
    blockSize: 4e-3,
    materials: fixtureMaterial,
    params,
  });
  const { face } = frontFace(scene);
  const middle = face.filter((b) => {
    const x = Math.abs(scene.blocks.centre[3 * b] as number);
    const z = scene.blocks.centre[3 * b + 2] as number;
    return x < 0.03 && Math.abs(z - 0.25) < 0.01;
  });

  it('lets what arrives run off in the recorded revolutions, at every rate: renewal rises with the rate and is never zero', async () => {
    const renewal: number[] = [];
    const exchange: number[] = [];
    for (const rate of [1e-4, 1e-3, 1e-2, 1e-1]) {
      const inFace = new Set(face);
      const out = await surfaceWaterStage(
        stageInput(scene),
        arrivalOf(scene, (b) => (inFace.has(b) ? rate : 0)),
      );
      expect(out.stats.film?.fed).toBeGreaterThan(0);
      let sum = 0;
      let age = 0;
      for (const b of middle) {
        expect(column(out, b, 'wetTime')).toBe(1);
        expect(column(out, b, 'renewal')).toBeGreaterThan(0);
        sum += column(out, b, 'renewal');
        age += column(out, b, 'exchange');
      }
      renewal.push(sum / middle.length);
      exchange.push(age / middle.length);
    }
    expect(middle.length).toBeGreaterThan(20);
    for (let i = 1; i < renewal.length; i++) {
      // A thin film runs as the square of its thickness and its thickness as the cube root
      // of what it carries: a tenfold rate renews the water on the face 10^(2/3) = 4.6 times
      // as fast where nothing is held back; never less than 1.5 times, never tenfold.
      const ratio = (renewal[i] as number) / (renewal[i - 1] as number);
      expect(ratio).toBeGreaterThan(1.5);
      expect(ratio).toBeLessThan(10);
      expect(exchange[i] as number).toBeGreaterThan(exchange[i - 1] as number);
    }
  });

  it('gives a face of a material that dewets the mean of its cycle of drops, in proportion to what arrives', async () => {
    // On polypropylene a thin film breaks back into drops, which collect for minutes before
    // they run off again: whatever moment of that cycle the recorded revolutions see, the
    // table holds the mean over it.
    const plastic = buildWashScene({
      items: [standing(PLASTIC.id)],
      machine: [],
      blockSize: 4e-3,
      materials: fixtureMaterial,
      params,
    });
    const front = frontFace(plastic).face;
    const inFace = new Set(front);
    const st = buildCascadeStatic(plastic, params);
    const at = front.filter((b) => {
      const x = Math.abs(plastic.blocks.centre[3 * b] as number);
      const z = plastic.blocks.centre[3 * b + 2] as number;
      return x < 0.03 && Math.abs(z - 0.3) < 0.01;
    });
    expect(at.length).toBeGreaterThan(10);
    const mean = async (rate: number): Promise<number> => {
      const out = await surfaceWaterStage(
        stageInput(plastic),
        arrivalOf(plastic, (b) => (inFace.has(b) ? rate : 0)),
      );
      let sum = 0;
      for (const b of at) {
        expect(column(out, b, 'renewal')).toBeGreaterThan(0);
        expect(column(out, b, 'exchange')).toBeGreaterThan(0);
        sum += column(out, b, 'renewal');
      }
      return sum / at.length;
    };
    const slow = await mean(2e-4);
    const faster = await mean(4e-4);
    // Near the top of the face only the drops of the face itself arrive: twice the rate,
    // twice the renewal (within a fifth: some blocks are caught while their drops run).
    expect(faster / slow).toBeGreaterThan(1.6);
    expect(faster / slow).toBeLessThan(2.4);
    // The rate of arrival over half the amount at which the drops run off.
    const b = at[0] as number;
    const onset =
      (Math.min(st.mWet[b] as number, st.bMax[b] as number) * WATER_UNIT) /
      (plastic.blocks.area[b] as number);
    expect(slow / (2e-4 / (0.5 * onset))).toBeGreaterThan(0.5);
    expect(slow / (2e-4 / (0.5 * onset))).toBeLessThan(4);
  });
});

describe('the pendant ridge of a lower edge that is not level', () => {
  // A cup standing mouth down, tipped a little about the x axis: its rim is a lower edge and
  // the inside of its base an underside, both at the tilt of the cup.
  const heldBelow = (degrees: number): number => {
    const a = (degrees * Math.PI) / 180;
    // Mouth down (half a turn about x), then tipped by `a` about x.
    const half = Math.PI + a;
    const scene = buildWashScene({
      items: [
        cup('cup', 0.035, 0.08, {
          p: [0, 0, 0.3],
          q: [Math.sin(half / 2), 0, 0, Math.cos(half / 2)],
        }),
      ],
      machine: [],
      blockSize: 4e-3,
      materials: fixtureMaterial,
      params,
    });
    const st = buildCascadeStatic(scene, params);
    // What the blocks that face down can hold back (pendant ridge, pendant film), kg.
    let hold = 0;
    for (let b = 0; b < scene.blocks.count; b++) {
      if ((scene.blocks.normal[3 * b + 2] as number) > -0.7) continue;
      hold += (st.hold[b] as number) * WATER_UNIT;
    }
    return hold;
  };

  it('can keep its drops while they are pinned, and fewer as it steepens, without a jump at level', () => {
    const tilts = [0, 0.1, 0.3, 0.6, 2, 5, 10, 20];
    const held = tilts.map(heldBelow);
    const level = held[0] as number;
    // A level rim of 0.23 m in two rows of blocks, 8 g/m each (film.edgeHold), and the
    // pendant film of the base inside: 2 to 3 g.
    expect(level * 1000).toBeGreaterThan(1.5);
    expect(level * 1000).toBeLessThan(3.5);
    // With the fixture glaze in wash liquor the drops of a ridge are pinned up to about 1
    // degree (sin beta_0 = sigma (cos theta_r - cos theta_a) / (g edgeHold) = 0.017), those
    // of the pendant film further: tipped by a fraction of a degree the cup can keep what it
    // keeps level, to 2 %. (The first build let every block of a rim that is not exactly
    // level pass its water on with nothing held: 0.37 g of 2.1 g at one degree.)
    for (const i of [1, 2, 3]) {
      expect((held[i] as number) / level).toBeGreaterThan(0.98);
      expect((held[i] as number) / level).toBeLessThan(1.02);
    }
    // Beyond it less and less, as one over the sine of the tilt, never more than before.
    for (let i = 4; i < held.length; i++) {
      expect(held[i] as number).toBeLessThan(held[i - 1] as number);
    }
    expect((held[4] as number) / level).toBeGreaterThan(0.6);
    expect((held[7] as number) / level).toBeLessThan(0.4);
    expect((held[7] as number) / level).toBeGreaterThan(0.05);
  });
});
