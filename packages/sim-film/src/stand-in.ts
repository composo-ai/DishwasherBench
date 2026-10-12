/**
 * STAND-IN of the surface-water stage (docs/design/scope.md build order, step 5). It let the
 * whole pipeline run before the kinematic cascade (`cascade.ts`, `surface-stage.ts`) was
 * written, and is kept, labelled, for comparison and for tests that want an exposure with
 * known values; nothing uses it by default.
 *
 * What it does, and nothing more: every block that receives water out of the air is wet, and
 * so is every block reached from one by following the cell graph downhill:
 *  - from a block to each neighbour whose centre is lower by more than
 *    `scene.dripLevelTolerance` (the scene's own rule for "lower");
 *  - over level ground from a block that faces up and has no lower neighbour (a pit) to its
 *    level neighbours, so that water spreads over a flat top until it finds an edge;
 *  - from a drip site to the block its drop lands on (`scene.drips`).
 *
 * Every wet block gets the same nominal film: wet all the time, the mean arrival flux of the
 * wet surface, the thickness `film.standInThickness`, the wall shear of a film of that
 * thickness under gravity along the surface (rho g sin(tilt) h), the renewal that follows from
 * flux and thickness, and after the spray the residual film `film.standInResidual` for
 * `film.standInHoldTime`. A basin takes in the mean flux over the area of its blocks that are
 * wet.
 *
 * What it ignores (each is the cascade's job): how much water goes where (no mass is routed:
 * a trickle and a torrent wet alike), wetting thresholds and rivulets (every material wets
 * completely wherever water can run), film thickness and shear as functions of the flow,
 * spreading sideways and uphill under a jet, capillary bridges at contacts, the time a film
 * needs to arrive, and the filling of basins from what runs into them.
 *
 * Deterministic: a flood fill whose result does not depend on the order of visits.
 */

import type { ExposureStageInput, WaterArrival } from '@spotless/sim-jets';
import {
  BLOCK_FLAG,
  bindSharedClosures,
  DRIP_TO_FLOOR,
  resolveJetParams,
  SCENE_NONE,
} from '@spotless/sim-jets';
import { resolveFilmParams } from './params.ts';
import { WATER_FIELD, WATER_FIELD_COUNT, type SurfaceWaterOutput } from './surface-water.ts';

/** The stand-in surface-water stage: see the file comment. */
export function surfaceWaterStandIn(
  input: ExposureStageInput,
  arrival: WaterArrival,
): SurfaceWaterOutput {
  const { scene } = input;
  const blocks = scene.blocks;
  if (arrival.blockCount !== blocks.count) {
    throw new RangeError('surfaceWaterStandIn: the arrival table belongs to another scene');
  }
  const fp = resolveFilmParams(input.params);
  const rho = bindSharedClosures(input.params).water(
    resolveJetParams(input.params).solveTemperature,
  ).rho;
  const level = input.params.get('scene.dripLevelTolerance');
  const graph = scene.graph;
  const drips = scene.drips;

  const wet = new Uint8Array(blocks.count);
  const stack: number[] = [];
  let arrivalRate = 0;
  for (let i = 0; i < arrival.block.length; i++) {
    const b = arrival.block[i] as number;
    arrivalRate += (arrival.flux[i] as number) * (blocks.area[b] as number);
    if (wet[b] === 0) {
      wet[b] = 1;
      stack.push(b);
    }
  }
  while (stack.length > 0) {
    const b = stack.pop() as number;
    const z = blocks.centre[3 * b + 2] as number;
    const flags = blocks.flags[b] as number;
    const reach = (flags & BLOCK_FLAG.pit) !== 0 ? z + level : z - level;
    const strict = (flags & BLOCK_FLAG.pit) === 0;
    for (let e = graph.offsets[b] as number; e < (graph.offsets[b + 1] as number); e++) {
      const n = graph.neighbour[e] as number;
      if (wet[n] !== 0) continue;
      const zn = blocks.centre[3 * n + 2] as number;
      if (strict ? zn < reach : zn <= reach) {
        wet[n] = 1;
        stack.push(n);
      }
    }
    if ((flags & BLOCK_FLAG.dripSite) !== 0) {
      const entry = drips.ofBlock[b] as number;
      if (entry !== SCENE_NONE) {
        const target = drips.target[entry] as number;
        if (target !== DRIP_TO_FLOOR && target !== SCENE_NONE && wet[target] === 0) {
          wet[target] = 1;
          stack.push(target);
        }
      }
    }
  }

  let wetBlocks = 0;
  let wetArea = 0;
  for (let b = 0; b < blocks.count; b++) {
    if (wet[b] === 0) continue;
    wetBlocks++;
    wetArea += blocks.area[b] as number;
  }
  const meanFlux = wetArea > 0 ? arrivalRate / wetArea : 0;

  const values = new Float32Array(WATER_FIELD_COUNT * blocks.count);
  for (let b = 0; b < blocks.count; b++) {
    if (wet[b] === 0) continue;
    const o = WATER_FIELD_COUNT * b;
    values[o + WATER_FIELD.wetFraction] = 1;
    values[o + WATER_FIELD.wetTime] = 1;
    values[o + WATER_FIELD.flux] = meanFlux;
    values[o + WATER_FIELD.thickness] = fp.standInThickness;
    // `gravityAlong` is g sin(tilt): the weight of the film along the surface per unit volume.
    values[o + WATER_FIELD.shear] = rho * (blocks.gravityAlong[b] as number) * fp.standInThickness;
    values[o + WATER_FIELD.renewal] = meanFlux / (rho * fp.standInThickness);
    // The stand-in film is rained on evenly: its water is as old as it takes to replace it.
    values[o + WATER_FIELD.exchange] = meanFlux / (rho * fp.standInThickness);
    values[o + WATER_FIELD.retained] = rho * fp.standInResidual;
    values[o + WATER_FIELD.holdTime] = fp.standInHoldTime;
  }

  const poolInflow = new Float32Array(scene.basins.length);
  scene.basins.forEach((basin, index) => {
    let area = 0;
    for (let i = 0; i < basin.blocks.length; i++) {
      const b = basin.blocks[i] as number;
      if (wet[b] !== 0) area += blocks.area[b] as number;
    }
    if (!(area > 0)) return;
    poolInflow[index] = meanFlux * area;
    for (let i = 0; i < basin.blocks.length; i++) {
      const b = basin.blocks[i] as number;
      values[WATER_FIELD_COUNT * b + WATER_FIELD.poolDepth] = basin.depth[i] as number;
    }
  });

  return {
    water: { blockCount: blocks.count, values },
    poolInflow,
    stats: { wetBlocks, wetArea, arrivalRate },
  };
}
