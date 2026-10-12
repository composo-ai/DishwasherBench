/**
 * STAND-IN of the secondary-water stage (docs/design/scope.md build order, step 4). It let the
 * whole pipeline run before the real stage (`spray-stage.ts`) was written, and is kept,
 * labelled, for comparison and for tests that want an exposure with known values; nothing uses
 * it by default.
 *
 * What it does, and nothing more: the shower of every fixed sprayer of the spray state (the
 * Bosch roof spinner) is `spray.standInShowerRays` droplets leaving its outlet at its droplet
 * speed, evenly distributed over the solid angle of its cone; each falls on a parabola under
 * gravity, traced as straight segments with the scene's f64 reference tracer, and credits its
 * share of the shower's flow to the block it lands on.
 *
 * What it ignores (each is the real stage's job): splatter where jets strike, fans off wires,
 * rims and tines, jets broken up in flight, splash of droplets where they land, air drag, the
 * size of a droplet (paths have zero width), and the rotation of the spinner (the shower is
 * steady). Without those, a surface that neither a jet nor the shower reaches, nor water
 * running down from them, stays dry.
 *
 * Deterministic: directions come from the counter-based generator keyed by (seed, shower,
 * droplet); droplets are traced in index order.
 */

import { hashU32, u32ToUnitFloat } from '@spotless/core';
import type { ExposureStageInput } from '@spotless/sim-jets';
import {
  bindSharedClosures,
  createTraceHit,
  resolveJetParams,
  SCENE_NONE,
} from '@spotless/sim-jets';
import { resolveSprayParams } from './params.ts';
import type { SecondaryWaterOutput } from './secondary-water.ts';

/** Arithmetic controls of the stand-in (not physical quantities). */
export const SPRAY_STAND_IN_NUMERICS = {
  /** A droplet starts this far from the outlet along its direction, so that it clears it, m. */
  launchOffset: 2e-3,
  /** RNG domains of the droplet directions and of the angles the arms stand at. */
  directionDomain: 0x73686f77,
  armDomain: 0x73686f61,
} as const;

const TWO_PI = 2 * Math.PI;

/** The stand-in secondary-water stage: see the file comment. */
export function secondaryWaterStandIn(input: ExposureStageInput): SecondaryWaterOutput {
  const { scene, state } = input;
  const sp = resolveSprayParams(input.params);
  const rho = bindSharedClosures(input.params).water(
    resolveJetParams(input.params).solveTemperature,
  ).rho;
  const gravity = scene.gravity;
  const tracer = scene.rays;
  const rotating = scene.trace.roots.filter((root) => root.rotating !== null).length;
  if (input.armLevels.length !== rotating) {
    throw new RangeError(
      `secondaryWaterStandIn: ${input.armLevels.length} arm levels for ${rotating} rotating roots`,
    );
  }
  const blocks = scene.blocks;
  const arrival = new Float64Array(blocks.count);
  const hit = createTraceHit();
  const angles = new Array<number>(rotating).fill(0);
  const seed = input.seed >>> 0;
  let paths = 0;
  let landed = 0;
  let flow = 0;
  let lostFlow = 0;

  state.showers.forEach((shower, showerIndex) => {
    const n = sp.standInShowerRays;
    const share = shower.flow / n;
    // An orthonormal frame about the cone axis.
    const [ax, ay, az] = shower.axis;
    const ref: [number, number, number] = Math.abs(az) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let ux = ay * ref[2] - az * ref[1];
    let uy = az * ref[0] - ax * ref[2];
    let uz = ax * ref[1] - ay * ref[0];
    const un = Math.hypot(ux, uy, uz);
    ux /= un;
    uy /= un;
    uz /= un;
    const vx = ay * uz - az * uy;
    const vy = az * ux - ax * uz;
    const vz = ax * uy - ay * ux;
    const cosMax = Math.cos(shower.coneHalfAngle);
    for (let k = 0; k < n; k++) {
      paths++;
      flow += share;
      // Uniform over the solid angle of the cone: cos(theta) uniform in [cos(alpha), 1].
      const u1 = u32ToUnitFloat(
        hashU32(seed, SPRAY_STAND_IN_NUMERICS.directionDomain, showerIndex, k, 0),
      );
      const u2 = u32ToUnitFloat(
        hashU32(seed, SPRAY_STAND_IN_NUMERICS.directionDomain, showerIndex, k, 1),
      );
      const cosT = 1 - u1 * (1 - cosMax);
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
      const phi = TWO_PI * u2;
      const c = Math.cos(phi) * sinT;
      const s = Math.sin(phi) * sinT;
      let dx = cosT * ax + c * ux + s * vx;
      let dy = cosT * ay + c * uy + s * vy;
      let dz = cosT * az + c * uz + s * vz;
      // Every turning arm stands at a hashed angle while this droplet flies.
      for (let r = 0; r < rotating; r++) {
        const arm = state.arms.find((a) => a.level === input.armLevels[r]);
        angles[r] =
          arm === undefined
            ? 0
            : arm.stalled
              ? arm.stallAngle
              : TWO_PI *
                u32ToUnitFloat(hashU32(seed, SPRAY_STAND_IN_NUMERICS.armDomain, showerIndex, k, r));
      }
      tracer.setAngles(angles);
      let px = shower.origin[0] + dx * SPRAY_STAND_IN_NUMERICS.launchOffset;
      let py = shower.origin[1] + dy * SPRAY_STAND_IN_NUMERICS.launchOffset;
      let pz = shower.origin[2] + dz * SPRAY_STAND_IN_NUMERICS.launchOffset;
      let wx = shower.dropletSpeed * dx;
      let wy = shower.dropletSpeed * dy;
      let wz = shower.dropletSpeed * dz;
      const dt = sp.standInFlightStep;
      const steps = Math.ceil(sp.standInFlightTime / dt);
      let block = SCENE_NONE;
      for (let i = 0; i < steps; i++) {
        // One step of the parabola as a chord.
        const qx = px + wx * dt;
        const qy = py + wy * dt;
        const qz = pz + wz * dt - 0.5 * gravity * dt * dt;
        const len = Math.hypot(qx - px, qy - py, qz - pz);
        if (!(len > 0)) break;
        dx = (qx - px) / len;
        dy = (qy - py) / len;
        dz = (qz - pz) / len;
        if (tracer.trace(px, py, pz, dx, dy, dz, len, ((showerIndex << 20) ^ k) >>> 0, seed, hit)) {
          block = hit.block;
          break;
        }
        px = qx;
        py = qy;
        pz = qz;
        wz -= gravity * dt;
      }
      if (block === SCENE_NONE) {
        lostFlow += share;
        continue;
      }
      landed++;
      arrival[block] = (arrival[block] as number) + rho * share;
    }
  });
  tracer.setAngles([]);

  let count = 0;
  for (let b = 0; b < blocks.count; b++) if ((arrival[b] as number) > 0) count++;
  const block = new Uint32Array(count);
  const flux = new Float32Array(count);
  let n = 0;
  for (let b = 0; b < blocks.count; b++) {
    const rate = arrival[b] as number;
    if (!(rate > 0)) continue;
    block[n] = b;
    flux[n] = rate / (blocks.area[b] as number);
    n++;
  }
  return {
    arrival: { blockCount: blocks.count, block, flux },
    stats: { paths, landed, flow, lostFlow },
  };
}
