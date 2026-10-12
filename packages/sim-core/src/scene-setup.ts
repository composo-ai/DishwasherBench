/**
 * The scene set-up of a wash: everything of the orchestrator that decides what the exposure
 * stages are given, in one file, so that the fingerprint of the exposure sources
 * (`node/fingerprint.ts`) covers it and nothing else of the orchestrator.
 *
 *  - the pose of an item as the wash uses it ({@link canonicalPose});
 *  - the wetting data of a material as the scene carries it ({@link sceneMaterialOf});
 *  - the geometry of a machine in a configuration, built once per process
 *    ({@link washMachineGeometry});
 *  - the items of a wash as the scene builder takes them, with soil cells on every region
 *    whatever is soiled ({@link washSceneItems}), so that the scene, and with it the key of
 *    every exposure set, does not depend on the soils;
 *  - the scene itself ({@link buildSceneOfWash}).
 *
 * The soil side, the replay and the result are in `wash.ts`: a change there does not change
 * what an exposure set is, and does not cost a recomputation of the water.
 */

import { getMaterial, LIQUOR_CLASSES } from '@spotless/catalogue';
import { canonicalHash, degToRad, quantiseQuat, type Pose } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import {
  buildMachineGeometry,
  type MachineConfig,
  type MachineGeometry,
  type MachineSpec,
} from '@spotless/machine';
import type { ParamSet } from '@spotless/sim-params';
import {
  buildWashScene,
  sceneChamber,
  sceneMachineParts,
  type ItemSoilRecord,
  type SceneItem,
  type SceneMaterial,
  type WashScene,
} from '@spotless/sim-scene';

/** Positions are used rounded to this, metres (0.1 mm), so that what is hashed is what is used. */
const POSITION_QUANTUM = 1e-4;

/**
 * The pose of an item as the wash uses it: position rounded to 0.1 mm, quaternion components to
 * 1e-4 and renormalised (docs/design/sim-core.md section 6, rule 14).
 */
export function canonicalPose(pose: Pose): Pose {
  const q = quantiseQuat(pose.q);
  if (q === null) throw new RangeError('canonicalPose: zero quaternion');
  const round = (v: number): number => {
    const r = Math.round(v / POSITION_QUANTUM) * POSITION_QUANTUM;
    return r === 0 ? 0 : r;
  };
  return { p: [round(pose.p[0]), round(pose.p[1]), round(pose.p[2])], q };
}

/** The wetting data of a catalogue material as the scene carries it (angles in radians). */
export function sceneMaterialOf(materialId: string): SceneMaterial {
  const material = getMaterial(materialId);
  const angle = (liquor: number, which: 'advancingDeg' | 'recedingDeg'): number => {
    const cls = LIQUOR_CLASSES[liquor];
    return cls === undefined ? 0 : degToRad(material.wetting.angles[cls][which]);
  };
  return {
    id: material.id,
    wettingClass: material.wetting.class,
    advancing: [angle(0, 'advancingDeg'), angle(1, 'advancingDeg'), angle(2, 'advancingDeg')],
    receding: [angle(0, 'recedingDeg'), angle(1, 'recedingDeg'), angle(2, 'recedingDeg')],
  };
}

const geometries = new WeakMap<MachineSpec, Map<string, MachineGeometry>>();

/** The geometry of a machine in a configuration, built once per process and configuration. */
export function washMachineGeometry(spec: MachineSpec, config: MachineConfig): MachineGeometry {
  let byConfig = geometries.get(spec);
  if (byConfig === undefined) {
    byConfig = new Map();
    geometries.set(spec, byConfig);
  }
  const key = canonicalHash(config);
  let geometry = byConfig.get(key);
  if (geometry === undefined) {
    geometry = buildMachineGeometry(spec, config);
    byConfig.set(key, geometry);
  }
  return geometry;
}

/** The distinct region ids of a shape, in shape order. */
export function regionIdsOf(shape: Shape): string[] {
  const ids: string[] = [];
  for (const region of shape.regions) if (!ids.includes(region.id)) ids.push(region.id);
  return ids;
}

/** One item of a wash as the scene is built from it. */
export interface WashSceneItem {
  readonly itemId: string;
  readonly typeId: string;
  readonly shape: Shape;
  /** The pose as used: already rounded (see {@link canonicalPose}). */
  readonly pose: Pose;
}

/**
 * The items as the scene builder takes them: soil cells on every region of every item,
 * whatever is soiled, so that the geometry of the scene does not depend on the soils.
 */
export function washSceneItems(items: readonly WashSceneItem[]): SceneItem[] {
  return items.map((item) => ({
    itemId: item.itemId,
    typeId: item.typeId,
    shape: item.shape,
    pose: item.pose,
    soils: [
      {
        type: 'any',
        regions: regionIdsOf(item.shape).map((region) => ({ region, coverage: 1 })),
        amount_g: 0,
        age_h: 0,
        heat_history: 'none',
      } satisfies ItemSoilRecord,
    ],
  }));
}

/** Builds the scene of a wash: the machine in its configuration with the items in it. */
export function buildSceneOfWash(
  spec: MachineSpec,
  config: MachineConfig,
  blockSize: number,
  items: readonly WashSceneItem[],
  params: ParamSet,
): WashScene {
  return buildWashScene({
    items: washSceneItems(items),
    machine: sceneMachineParts(washMachineGeometry(spec, config)),
    blockSize,
    materials: sceneMaterialOf,
    params,
    chamber: sceneChamber(spec),
  });
}
