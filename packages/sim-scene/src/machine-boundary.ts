/**
 * The boundary to `@spotless/machine`: the machine as the scene builder takes it.
 *
 * The scene needs little of the machine: a list of named shapes with poses in the tub frame,
 * which of them rotate during the wash (the spray arms, with their hinge), and which are the
 * sheet metal that encloses the chamber. `sceneMachineParts` reads exactly that from the
 * `MachineGeometry` that `buildMachineGeometry` returns, so the scene builder itself does not
 * depend on how the machine's shapes are produced and can equally be given a hand-built rack.
 *
 * This file used to hold a structural stand-in for `MachineGeometry`, written before the
 * geometry half of `@spotless/machine` existed. The real types are re-exported under the old
 * names, so that the modules that took the stand-in from here keep compiling.
 *
 * Units: SI. Frames: the tub frame T of docs/design/platform.md section 2.
 */

import type { Aabb } from '@spotless/geometry';
import {
  tubInterior,
  type MachineGeometry,
  type MachinePart,
  type MachineSpec,
} from '@spotless/machine';
import type { SceneMachinePart } from './scene-types.ts';

export type { MachineGeometry, MachinePartRole } from '@spotless/machine';

/** One part of the machine as `@spotless/machine` describes it (the former stand-in's name). */
export type MachineGeometryPart = MachinePart;

/**
 * The parts of a machine as the scene builder takes them, in the order of the geometry: the
 * spray arms as rotating parts with their hinge, the tub and the door liner as the enclosure.
 */
export function sceneMachineParts(geometry: MachineGeometry): SceneMachinePart[] {
  return geometry.parts.map((part): SceneMachinePart => {
    const base = { id: part.id, role: part.role, shape: part.shape, pose: part.pose };
    const enclosure = part.component === 'tub' || part.component === 'door';
    if (part.arm !== undefined) {
      return { ...base, rotation: { point: part.arm.hingePoint, axis: part.arm.hingeAxis } };
    }
    return enclosure ? { ...base, enclosure } : base;
  });
}

/**
 * The inside of the wash chamber of a machine with its door closed, tub frame: the box outside
 * which the sheet metal of the enclosure carries no blocks (`WashSceneInput.chamber`).
 */
export function sceneChamber(spec: MachineSpec): Aabb {
  const box = tubInterior(spec);
  return { min: box.min, max: box.max };
}
