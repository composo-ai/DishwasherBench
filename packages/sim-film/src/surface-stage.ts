/**
 * The surface-water stage of the first build (docs/design/scope.md, "Surface water", "Indirect
 * water" and "Drainage and pooling"; docs/design/sim-core.md section M7): the kinematic cascade
 * of `cascade.ts` under the forcing of one spray state, written out as the surface-water table.
 *
 * What goes into the table, per block:
 *  - `wetFraction`: time-mean wetted share over the recorded revolutions: 1 under a film, the
 *    width fraction of a rivulet, the covered share of standing beads (`film.beadCover`);
 *  - `flux`: the water the block received per area and time: what landed on it out of the
 *    air (jets and droplets) over its own area, plus what ran on to it from above (and fell
 *    on it as drips) per width, over the reference run `film.renewalLength`. Run-on is a flow
 *    per width, so over the block's own area it would double when the blocks are halved; with
 *    the reference run the column is the same at both tiers (at the fast tier, whose blocks
 *    are as long as the reference run, it is everything received over the block's area);
 *  - `thickness`, `shear`: means over the steps in which water flows on the block, taken in
 *    its wetted part (h / f, rho g_s h / f), of the water that flows: what a block holds back
 *    (pendant ridge, puddle, bridge) is left out, so standing water has no shear;
 *  - `renewal`: discharge over all the water on the block (flowing, held back, beads), times
 *    the length of the block along the flow over `film.renewalLength`. For a block that only
 *    collected drops in the recorded revolutions (it receives, nothing leaves): the mean over
 *    the cycle of drops that grow to the onset of wetting and run off, the rate of arrival
 *    over half the onset amount; `exchange` is the same there;
 *  - `wetTime`: share of the recorded steps with any water on the block;
 *  - `exchange`: the inverse of the age of the water on the block (`CascadeResult.age`). On
 *    a block that stands in a liquid-filled gap (a gap reservoir of the cascade) it is the
 *    exchange of the liquid the gap holds: the film that passes mixes into it by the share
 *    `film.etaGap` only, so that liquid is older than the film by the water the block holds
 *    for the gap over eta_gap times its throughput (sim-core M7.6, M10); such a block is
 *    under standing liquid and its `shear` is 0;
 *  - `poolDepth`: depth under the full pool, for the blocks of a basin that takes in water;
 *  - `retained`, `holdTime`: from the drain-down (`film.drainTime` with the sprays off). A film
 *    that is still continuous at its end is taken to thin as t^(-1/2) down to `film.deltaDry`.
 *
 * The static tables of the cascade depend on the scene and the hydro parameters only and are
 * kept for the scene they were last built for.
 *
 * Units: SI. Index spaces: the blocks and basins of the `WashScene`.
 */

import {
  resolveJetParams,
  WATER_UNIT,
  type ExposureStageInput,
  type WaterArrival,
} from '@spotless/sim-jets';
import type { WashScene } from '@spotless/sim-scene';
import { buildCascadeStatic, marchCascade, type CascadeStatic } from './cascade.ts';
import { resolveFilmParams } from './params.ts';
import {
  WATER_FIELD,
  WATER_FIELD_COUNT,
  type SurfaceWaterFeed,
  type SurfaceWaterOutput,
} from './surface-water.ts';

/**
 * Mean water on a face over a cycle of collecting drops, as a share of the amount at which
 * they run off: the store grows evenly from nothing to that amount.
 */
// literal-ok-begin: the mean of a ramp from 0 to 1 (arithmetic, not a physical quantity)
const BEAD_CYCLE_MEAN = 0.5;
// literal-ok-end

const statics = new WeakMap<WashScene, { readonly key: string; readonly tables: CascadeStatic }>();

/** The static tables of the cascade for a scene and a parameter set (kept per scene). */
export function cascadeStaticOf(input: ExposureStageInput): CascadeStatic {
  const known = statics.get(input.scene);
  if (known !== undefined && known.key === input.params.hydroHash) return known.tables;
  const tables = buildCascadeStatic(input.scene, input.params);
  statics.set(input.scene, { key: input.params.hydroHash, tables });
  return tables;
}

/** The surface-water stage: see the file comment. */
export function surfaceWaterStage(
  input: ExposureStageInput,
  arrival: WaterArrival,
  feed: SurfaceWaterFeed = {},
): Promise<SurfaceWaterOutput> {
  const { scene, state } = input;
  const blocks = scene.blocks;
  if (arrival.blockCount !== blocks.count) {
    throw new RangeError('surfaceWaterStage: the arrival table belongs to another scene');
  }
  const fp = resolveFilmParams(input.params);
  const jp = resolveJetParams(input.params);
  input.onStage?.('film:static');
  const st = cascadeStaticOf(input);
  const official = input.tier.id === 'official';
  // literal-ok-begin: fallback for a missing entry of a registered vector (never taken with the registry defaults)
  const steps = feed.handover?.bins ?? jp.handoverBins[official ? 0 : 1] ?? 128;
  // literal-ok-end
  const period = state.period;

  // Without integer deposits from upstream, the arrival flux is steady airborne water.
  let air = feed.deposits;
  if (feed.handover === undefined && feed.deposits === undefined) {
    const mass = new Float64Array(arrival.block.length);
    for (let i = 0; i < arrival.block.length; i++) {
      const b = arrival.block[i] as number;
      mass[i] = Math.round(
        ((arrival.flux[i] as number) * (blocks.area[b] as number) * period) / WATER_UNIT,
      );
    }
    air = { blockCount: blocks.count, block: arrival.block, mass };
  }

  input.onStage?.('film:march');
  const settleRevolutions = Math.max(0, Math.round(input.tier.settleRevolutions));
  const recordRevolutions = Math.max(1, Math.round(input.tier.steadyRevolutions));
  const result = marchCascade(
    scene,
    st,
    fp,
    { period, steps, handover: feed.handover, air, drips: feed.drips },
    { settleRevolutions, recordRevolutions },
  );
  if (result.fed + result.primed !== result.toSump + result.stored) {
    throw new Error(
      `surfaceWaterStage: water is not conserved (${result.fed + result.primed} units fed, ` +
        `${result.toSump + result.stored} accounted for)`,
    );
  }

  input.onStage?.('film:tables');
  const rho = st.liquid.rho;
  const youngest = result.recordedTime / result.recordedSteps;
  const values = new Float32Array(WATER_FIELD_COUNT * blocks.count);
  let wetBlocks = 0;
  let wetArea = 0;
  let itemArea = 0;
  let itemWet = 0;
  let heldOnItems = 0;
  let retainedOnItems = 0;
  const isItem = scene.instances.map((instance) => instance.kind === 'item');
  for (let b = 0; b < blocks.count; b++) {
    const area = blocks.area[b] as number;
    const o = WATER_FIELD_COUNT * b;
    const wet = Math.min(1, (result.wetSum[b] as number) / result.recordedSteps);
    const flowing = result.flowSteps[b] as number;
    const item = isItem[blocks.instance[b] as number] === true;
    if (item) {
      itemArea += area;
      itemWet += wet * area;
      heldOnItems += result.held[b] as number;
      retainedOnItems += result.retained[b] as number;
    }
    values[o + WATER_FIELD.retained] = ((result.retained[b] as number) * WATER_UNIT) / area;
    values[o + WATER_FIELD.holdTime] = result.holdTime[b] as number;
    {
      const fromAir = result.airSum[b] as number;
      const runOn = (result.inSum[b] as number) - fromAir;
      // A line element (a wire) has no run to refer to: it keeps what it received per area.
      const width = st.line[b] === 1 ? 0 : (st.width[b] as number);
      values[o + WATER_FIELD.flux] =
        ((fromAir / area +
          (width > 0 && fp.renewalLength > 0 ? runOn / (width * fp.renewalLength) : runOn / area)) *
          WATER_UNIT) /
        result.recordedTime;
    }
    if (!(wet > 0)) continue;
    wetBlocks++;
    wetArea += area;
    values[o + WATER_FIELD.wetFraction] = wet;
    values[o + WATER_FIELD.wetTime] = Math.min(
      1,
      (result.timeSteps[b] as number) / result.recordedSteps,
    );
    if (flowing > 0) {
      // Units of flowing water in the wetted part; what the block holds back is left out.
      const mean = (result.massSum[b] as number) / flowing;
      values[o + WATER_FIELD.thickness] = (mean * WATER_UNIT) / (rho * area);
      values[o + WATER_FIELD.shear] = (st.tauCoef[b] as number) * mean;
    }
    // Throughput over the time-integrated hold-up (flowing, held back and beads), brought from
    // the run of the block to the reference run.
    const holdUp = ((result.totalSum[b] as number) * result.recordedTime) / result.recordedSteps;
    values[o + WATER_FIELD.renewal] =
      holdUp > 0 && fp.renewalLength > 0
        ? ((result.outSum[b] as number) / holdUp) * ((st.run[b] as number) / fp.renewalLength)
        : 0;
    // The water cannot be newer than one step of the march.
    let age = Math.max(result.age[b] as number, youngest);
    const gapUnits = st.reservoir[b] as number;
    if (gapUnits > 0) {
      // A gap reservoir: the liquid the gap holds takes up the share eta_gap of what passes.
      // (The age of the film already counts the held water as stirred in: only the rest of
      // the delay is added.)
      const through = Math.max(result.outSum[b] as number, result.inSum[b] as number);
      age =
        fp.etaGap > 0 && through > 0
          ? age + ((gapUnits * result.recordedTime) / through) * (1 / fp.etaGap - 1)
          : Infinity;
      values[o + WATER_FIELD.shear] = 0;
      values[o + WATER_FIELD.renewal] =
        (values[o + WATER_FIELD.renewal] as number) * Math.min(1, fp.etaGap);
    }
    values[o + WATER_FIELD.exchange] = (result.totalSum[b] as number) > 0 ? 1 / age : 0;
    if ((result.outSum[b] as number) === 0 && (result.inSum[b] as number) > 0) {
      // Drops that collect: nothing left the block in the recorded revolutions, but it
      // receives. On a material that dewets a thinly fed face goes round a cycle of minutes:
      // drops grow from nothing to the amount at which they run together and off (the onset of
      // the wetting threshold), then again. The recorded revolutions see a moment of it; the
      // table is the mean over the cycle: the water on the face is half the onset amount on
      // average and is replaced at the rate it arrives. (A rate per block, like the age: the
      // drops of a block do not travel along it.)
      const onset = Math.min(st.mWet[b] as number, st.bMax[b] as number);
      if (onset > 0) {
        const rate = (result.inSum[b] as number) / result.recordedTime;
        const cycle = Math.min(rate / (BEAD_CYCLE_MEAN * onset), 1 / youngest);
        values[o + WATER_FIELD.renewal] = cycle;
        values[o + WATER_FIELD.exchange] = cycle;
      }
    }
  }

  const poolInflow = new Float32Array(scene.basins.length);
  let heldInBasins = 0;
  scene.basins.forEach((basin, k) => {
    const units = result.basinIn[k] as number;
    if (!(units > 0)) return;
    poolInflow[k] = (units * WATER_UNIT) / result.recordedTime;
    heldInBasins += rho * basin.volume;
    for (let i = 0; i < basin.blocks.length; i++) {
      values[WATER_FIELD_COUNT * (basin.blocks[i] as number) + WATER_FIELD.poolDepth] = basin.depth[
        i
      ] as number;
    }
  });

  const storedChange =
    result.fedPerRevolution > 0 ? result.storedChange / result.fedPerRevolution : 0;
  return Promise.resolve({
    water: { blockCount: blocks.count, values },
    poolInflow,
    stats: {
      wetBlocks,
      wetArea,
      arrivalRate: (result.fedPerRevolution * WATER_UNIT) / period,
      film: {
        steps,
        pilotRevolutions: fp.pilotRevolutions,
        settleRevolutions,
        recordedRevolutions: recordRevolutions,
        fedPerRevolution: result.fedPerRevolution,
        fed: result.fed,
        primed: result.primed,
        toSump: result.toSump,
        stored: result.stored,
        sumpLastRevolution: result.sumpLastRevolution,
        storedChange,
        wetChange: result.wetChange,
        converged: Math.abs(storedChange) <= fp.massTolerance,
        heldOnItems: heldOnItems * WATER_UNIT,
        heldInBasins,
        itemWetFraction: itemArea > 0 ? itemWet / itemArea : 0,
        retainedOnItems: retainedOnItems * WATER_UNIT,
        returnTime: result.returnAge,
      },
    },
  });
}
