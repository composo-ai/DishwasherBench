/**
 * Test support for the exposure stages: hand-built items and spray states with known numbers.
 * Not part of the package's entry point; the tests of `@spotless/sim-spray` and
 * `@spotless/sim-film` reach it by a relative path.
 *
 * Units: SI. Frame: tub frame (z up).
 */

import type { Pose, Vec3 } from '@spotless/core';
import type { SprayJet, SprayShower, SprayState } from '@spotless/sim-hydraulics';
import type { SceneItem, SceneMachinePart, SceneMaterial } from '@spotless/sim-scene';

/** A material that keeps a film (glazed ware in wash liquor). */
export const GLAZE: SceneMaterial = {
  id: 'glaze',
  wettingClass: 'continuous_film',
  advancing: [0.6, 0.3, 0.3],
  receding: [0.2, 0.05, 0.05],
};

/** A material on which a thin film breaks up (polypropylene in wash liquor: 50 / 25 degrees). */
export const PLASTIC: SceneMaterial = {
  id: 'plastic',
  wettingClass: 'rivulet_prone',
  advancing: [1.66, 0.873, 0.96],
  receding: [1.05, 0.436, 0.436],
};

/** The wetting data of the fixture materials by id. */
export function fixtureMaterial(id: string): SceneMaterial {
  return id === PLASTIC.id ? PLASTIC : GLAZE;
}

/** Half the thickness of a {@link slab}, metres. */
export const SLAB_HALF_THICKNESS = 4e-3;

/**
 * A flat slab, `2 hx` by `2 hy` and 8 mm thick, with one region `all` that is soiled all over.
 * In its own frame it lies in the x-y plane.
 */
export function slab(
  itemId: string,
  hx: number,
  hy: number,
  pose: Pose,
  material = GLAZE.id,
): SceneItem {
  return {
    itemId,
    typeId: 'slab',
    shape: {
      parts: [
        {
          id: 'body',
          prim: { kind: 'rbox', halfExtents: [hx, hy, 3e-3], radius: 1e-3 },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material,
        },
      ],
      regions: [{ id: 'all', part: 'body' }],
    },
    pose,
    soils: [
      {
        type: 'any',
        regions: [{ region: 'all', coverage: 1 }],
        amount_g: 1,
        age_h: 1,
        heat_history: 'none',
      },
    ],
  };
}

/**
 * An upright cup: a shell of revolution about z with a flat base and a straight wall, inner
 * radius `radius` and inner depth `depth`, 3 mm thick, with one region `all`.
 */
export function cup(itemId: string, radius: number, depth: number, pose: Pose): SceneItem {
  const t = 3e-3;
  return {
    itemId,
    typeId: 'cup',
    shape: {
      parts: [
        {
          id: 'body',
          prim: {
            kind: 'sor',
            profile: [
              { r: 0, z: t / 2, t },
              { r: radius + t / 2, z: t / 2, t },
              { r: radius + t / 2, z: t + depth, t },
            ],
          },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material: GLAZE.id,
        },
      ],
      regions: [{ id: 'all', part: 'body' }],
    },
    pose,
    soils: [
      {
        type: 'any',
        regions: [{ region: 'all', coverage: 1 }],
        amount_g: 1,
        age_h: 1,
        heat_history: 'none',
      },
    ],
  };
}

/** A straight rack wire of radius `radius` from `a` to `b`, as a machine part. */
export function wire(id: string, a: Vec3, b: Vec3, radius: number): SceneMachinePart {
  return {
    id,
    role: 'wires',
    shape: {
      parts: [
        {
          id: 'wire',
          prim: { kind: 'capsule', a, b, radius },
          pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
          material: GLAZE.id,
        },
      ],
      regions: [{ id: 'wires', part: '*' }],
    },
    pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
  };
}

/** What {@link jetState} is given. */
export interface JetStateOptions {
  /** Nozzle exit at arm angle 0 and unit direction of the jet. */
  readonly origin: Vec3;
  readonly direction: Vec3;
  /** Speed (m/s) and diameter (m) of the jet. */
  readonly speed: number;
  readonly diameter: number;
  /** Angular speed of the arm about the z axis, rad/s; 0 for an arm that stands still. */
  readonly omega?: number;
  /** Sub-jets of the nozzle the jet belongs to (above 1: a slot). */
  readonly subJets?: number;
  /** Time of one revolution used when the arm stands still, s. */
  readonly nominalPeriod?: number;
  readonly showers?: readonly SprayShower[];
}

/** A spray state with one arm about the z axis that carries one round jet. */
export function jetState(options: JetStateOptions): SprayState {
  const omega = options.omega ?? 0;
  const stalled = !(omega > 0);
  const period = stalled ? (options.nominalPeriod ?? 1.5) : (2 * Math.PI) / omega;
  const flow = (Math.PI * options.diameter * options.diameter * options.speed) / 4;
  const jet: SprayJet = {
    level: 'test',
    nozzle: 'n1',
    subJet: 0,
    subJets: options.subJets ?? 1,
    arm: 0,
    origin: options.origin,
    direction: options.direction,
    flow,
    speed: options.speed,
    diameter: options.diameter,
  };
  return {
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
        period: stalled ? 0 : period,
        stalled,
        stallAngle: 0,
        armPressure: 0,
      },
    ],
    jets: [jet],
    showers: options.showers ?? [],
    masterArm: stalled ? -1 : 0,
    period,
    duration: 60,
    key: `test:${JSON.stringify(options)}`,
  };
}

/** A spray state with no jets: only the showers given. */
export function showerState(showers: readonly SprayShower[], period = 1.5): SprayState {
  return {
    index: 0,
    id: 'shower@3000',
    position: 'shower',
    pumpRpm: 3000,
    headFactor: 1,
    flow: showers.reduce((sum, s) => sum + s.flow, 0),
    pumpPressure: 0,
    arms: [],
    jets: [],
    showers,
    masterArm: -1,
    period,
    duration: 60,
    key: `shower:${JSON.stringify(showers)}`,
  };
}
