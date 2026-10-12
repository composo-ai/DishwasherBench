/**
 * STAND-IN of the jet stage (docs/design/scope.md build order, step 4). It let the whole
 * pipeline run before the real stage (`jet-stage.ts`) was written, and is kept, labelled, for
 * comparison and for tests that want an exposure with known values; nothing uses it by
 * default.
 *
 * What it does, and nothing more:
 *  1. every jet of the spray state is traced as ONE straight ray at `jets.standInPhases` arm
 *     angles per revolution, with the scene's f64 reference tracer (`scene.rays`);
 *  2. the soil cells within `jets.standInFootprintDiameters` jet diameters of each hit count as
 *     inside the footprint for that share of the revolution, and receive the wall pressure,
 *     wall shear and film momentum flux of the closed forms (`closures.ts`) at their distance
 *     from the hit;
 *  3. the jet's water is credited to the block it strikes.
 *
 * What it ignores (each matters to calibration and is the real stage's job):
 *  - gravity and break-up in flight: a jet is a straight coherent ray of zero width;
 *  - the elongation of the footprint at oblique incidence, the flow split, the fan limit and
 *    everything beyond the footprint circle (the radial film out to its jump);
 *  - footprints at wires, rims and edges (a hit there is treated like a hit on a wall);
 *  - sub-rays: a jet that grazes an edge is all hit or all miss;
 *  - splatter: all of the jet's water lands on the block it strikes;
 *  - the correlation of the arms of one state: while one arm is sampled, every other turning
 *    arm stands at a hashed angle;
 *  - a cell is reached through the cell graph from the struck block, on surface that faces the
 *    same way, so a footprint does not jump a gap between two items.
 *
 * Deterministic: single-threaded, rays in a fixed order, tables sorted by index.
 */

import { hashU32, u32ToUnitFloat } from '@spotless/core';
import { armAngleAt, createJetLaunch, jetLaunch } from '@spotless/sim-hydraulics';
import { bindSharedClosures } from '@spotless/sim-params';
import { BLOCK_FLAG, createTraceHit, SCENE_NONE } from '@spotless/sim-scene';
import { createJetImpact, jetImpactAt } from './closures.ts';
import {
  JET_FIELD,
  JET_FIELD_COUNT,
  type ExposureStageInput,
  type JetStageOutput,
} from './jet-exposure.ts';
import { resolveJetParams } from './params.ts';

/** Arithmetic tolerances of the stand-in (not physical quantities). */
export const JET_STAND_IN_NUMERICS = {
  /** A ray starts this far along the jet from the nozzle exit, so that it clears the arm, m. */
  launchOffset: 5e-4,
  /** Longest ray, metres: more than the diagonal of any domestic wash chamber. */
  maxRange: 2,
  /** RNG domain of the angles other arms stand at. */
  otherArmDomain: 0x6a657473,
} as const;

const TWO_PI = 2 * Math.PI;

/**
 * The stand-in jet stage: see the file comment. Returns the jet table and the water arrival of
 * one spray state.
 */
export function jetStageStandIn(input: ExposureStageInput): JetStageOutput {
  const { scene, state } = input;
  const jp = resolveJetParams(input.params);
  const water = bindSharedClosures(input.params).water(jp.solveTemperature);
  const tracer = scene.rays;
  const rotating = scene.trace.roots.filter((root) => root.rotating !== null).length;
  if (input.armLevels.length !== rotating) {
    throw new RangeError(
      `jetStageStandIn: ${input.armLevels.length} arm levels for ${rotating} rotating roots`,
    );
  }
  const blocks = scene.blocks;
  const cells = scene.soilCells;
  const graph = scene.graph;

  // Sparse accumulators: a slot per touched soil cell.
  const slotOf = new Int32Array(cells.count).fill(-1);
  const slotCell: number[] = [];
  const acc: number[] = [];
  const ACC = 7; // duty, shear sum, shear peak, pressure sum, pressure peak, momentum sum, peak
  const arrival = new Float64Array(blocks.count);
  const stamp = new Uint32Array(blocks.count);
  let stampNow = 0;
  const stack: number[] = [];

  const launch = createJetLaunch();
  const hit = createTraceHit();
  const impact = createJetImpact();
  const angles = new Array<number>(rotating).fill(0);
  let rays = 0;
  let hits = 0;
  let flow = 0;
  let lostFlow = 0;

  const deposit = (jetIndex: number, weight: number): void => {
    const jet = state.jets[jetIndex];
    if (jet === undefined) return;
    const hx = launch.ox + launch.dx * (hit.t + JET_STAND_IN_NUMERICS.launchOffset);
    const hy = launch.oy + launch.dy * (hit.t + JET_STAND_IN_NUMERICS.launchOffset);
    const hz = launch.oz + launch.dz * (hit.t + JET_STAND_IN_NUMERICS.launchOffset);
    const root = hit.block;
    if (root === SCENE_NONE) return;
    arrival[root] = (arrival[root] as number) + water.rho * jet.flow * weight;
    const radius = jp.standInFootprintDiameters * jet.diameter;
    const sinInc = Math.min(1, Math.max(hit.cosInc, 0));
    stampNow++;
    stack.length = 0;
    stack.push(root);
    stamp[root] = stampNow;
    while (stack.length > 0) {
      const b = stack.pop() as number;
      const first = blocks.soilFirst[b] as number;
      const isLine = ((blocks.flags[b] as number) & BLOCK_FLAG.line) !== 0;
      const facing =
        isLine ||
        b === root ||
        (blocks.normal[3 * b] as number) * hit.nx +
          (blocks.normal[3 * b + 1] as number) * hit.ny +
          (blocks.normal[3 * b + 2] as number) * hit.nz >
          0;
      if (first !== SCENE_NONE && facing) {
        for (let q = 0; q < 4; q++) {
          const c = first + q;
          const r = Math.hypot(
            (cells.centre[3 * c] as number) - hx,
            (cells.centre[3 * c + 1] as number) - hy,
            (cells.centre[3 * c + 2] as number) - hz,
          );
          if (r > radius) continue;
          jetImpactAt(jp, water.rho, water.nu, launch.speed, jet.diameter, sinInc, r, impact);
          let slot = slotOf[c] as number;
          if (slot < 0) {
            slot = slotCell.length;
            slotOf[c] = slot;
            slotCell.push(c);
            for (let i = 0; i < ACC; i++) acc.push(0);
          }
          const o = ACC * slot;
          acc[o] = (acc[o] as number) + weight;
          acc[o + 1] = (acc[o + 1] as number) + weight * impact.shear;
          acc[o + 2] = Math.max(acc[o + 2] as number, impact.shear);
          acc[o + 3] = (acc[o + 3] as number) + weight * impact.pressure;
          acc[o + 4] = Math.max(acc[o + 4] as number, impact.pressure);
          acc[o + 5] = (acc[o + 5] as number) + weight * impact.momentum;
          acc[o + 6] = Math.max(acc[o + 6] as number, impact.momentum);
        }
      }
      // Spread to the neighbours whose centres lie within the footprint (plus their own size).
      for (let e = graph.offsets[b] as number; e < (graph.offsets[b + 1] as number); e++) {
        const n = graph.neighbour[e] as number;
        if (stamp[n] === stampNow) continue;
        stamp[n] = stampNow;
        const d = Math.hypot(
          (blocks.centre[3 * n] as number) - hx,
          (blocks.centre[3 * n + 1] as number) - hy,
          (blocks.centre[3 * n + 2] as number) - hz,
        );
        if (d <= radius + Math.sqrt(blocks.area[n] as number)) stack.push(n);
      }
    }
  };

  state.arms.forEach((arm, armIndex) => {
    const samples = arm.stalled ? 1 : jp.standInPhases;
    const weight = 1 / samples;
    for (let k = 0; k < samples; k++) {
      const angle = arm.stalled ? armAngleAt(arm, 0) : (TWO_PI * (k + 0.5)) / samples;
      for (let r = 0; r < rotating; r++) {
        const level = input.armLevels[r];
        const other = state.arms.findIndex((a) => a.level === level);
        if (other === armIndex) angles[r] = angle;
        else if (other < 0) angles[r] = 0;
        else {
          const o = state.arms[other];
          angles[r] =
            o === undefined || o.stalled
              ? (o?.stallAngle ?? 0)
              : TWO_PI *
                u32ToUnitFloat(
                  hashU32(input.seed, JET_STAND_IN_NUMERICS.otherArmDomain, armIndex, other, k),
                );
        }
      }
      tracer.setAngles(angles);
      for (let j = 0; j < state.jets.length; j++) {
        const jet = state.jets[j];
        if (jet === undefined || jet.arm !== armIndex) continue;
        jetLaunch(state, jet, angle, launch);
        rays++;
        flow += jet.flow * weight;
        const struck = tracer.trace(
          launch.ox + launch.dx * JET_STAND_IN_NUMERICS.launchOffset,
          launch.oy + launch.dy * JET_STAND_IN_NUMERICS.launchOffset,
          launch.oz + launch.dz * JET_STAND_IN_NUMERICS.launchOffset,
          launch.dx,
          launch.dy,
          launch.dz,
          JET_STAND_IN_NUMERICS.maxRange,
          ((j << 16) ^ k) >>> 0,
          input.seed >>> 0,
          hit,
        );
        if (!struck || hit.block === SCENE_NONE) {
          lostFlow += jet.flow * weight;
          continue;
        }
        hits++;
        deposit(j, weight);
      }
    }
  });
  tracer.setAngles([]);

  // Tables in index order.
  let exposed = 0;
  for (let c = 0; c < cells.count; c++) if ((slotOf[c] as number) >= 0) exposed++;
  const cell = new Uint32Array(exposed);
  const values = new Float32Array(JET_FIELD_COUNT * exposed);
  let n = 0;
  for (let c = 0; c < cells.count; c++) {
    const slot = slotOf[c] as number;
    if (slot < 0) continue;
    const o = ACC * slot;
    const duty = Math.min(1, acc[o] as number);
    const inv = (acc[o] as number) > 0 ? 1 / (acc[o] as number) : 0;
    const v = JET_FIELD_COUNT * n;
    cell[n] = c;
    values[v + JET_FIELD.duty] = duty;
    values[v + JET_FIELD.shearPeak] = acc[o + 2] as number;
    values[v + JET_FIELD.shearMean] = (acc[o + 1] as number) * inv;
    values[v + JET_FIELD.pressurePeak] = acc[o + 4] as number;
    values[v + JET_FIELD.pressureMean] = (acc[o + 3] as number) * inv;
    values[v + JET_FIELD.momentumPeak] = acc[o + 6] as number;
    values[v + JET_FIELD.momentumMean] = (acc[o + 5] as number) * inv;
    n++;
  }
  let wetted = 0;
  for (let b = 0; b < blocks.count; b++) if ((arrival[b] as number) > 0) wetted++;
  const block = new Uint32Array(wetted);
  const flux = new Float32Array(wetted);
  n = 0;
  for (let b = 0; b < blocks.count; b++) {
    const rate = arrival[b] as number;
    if (!(rate > 0)) continue;
    block[n] = b;
    flux[n] = rate / (blocks.area[b] as number);
    n++;
  }
  return {
    exposure: { soilCellCount: cells.count, cell, values },
    arrival: { blockCount: blocks.count, block, flux },
    stats: { rays, hits, flow, lostFlow },
  };
}
