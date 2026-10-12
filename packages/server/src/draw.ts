/**
 * What a client draws: poses of bodies for display, the scene view, and the geometry payload
 * (the parametric shapes of the machine in its current configuration and of every item type of
 * the level, with the placement aids).
 */

import type { Pose } from '@spotless/core';
import { canonicalHash, compareIds, roundToGrid } from '@spotless/core';
import { bodyMaterialOf, instantiate } from '@spotless/catalogue';
import type { GameSession, SceneState } from '@spotless/session';
import { uncountedSceneState } from './session-internals.ts';
import type {
  DrawPose,
  DrawPoses,
  GeometryPayload,
  ItemTypePayload,
  MachinePartPayload,
  SceneView,
} from './types.ts';

/** A tub-frame SI pose as a {@link DrawPose}: millimetres to 0.01 mm, quaternion to 1e-5. */
export function toDrawPose(pose: Pose): DrawPose {
  const [x, y, z, w] = pose.q;
  return {
    position_mm: [
      roundToGrid(pose.p[0] * 1000, 100),
      roundToGrid(pose.p[1] * 1000, 100),
      roundToGrid(pose.p[2] * 1000, 100),
    ],
    quat_wxyz: [
      roundToGrid(w, 100_000),
      roundToGrid(x, 100_000),
      roundToGrid(y, 100_000),
      roundToGrid(z, 100_000),
    ],
  };
}

/** True when two draw poses are the same numbers. */
export function sameDrawPose(a: DrawPose, b: DrawPose): boolean {
  return (
    a.position_mm[0] === b.position_mm[0] &&
    a.position_mm[1] === b.position_mm[1] &&
    a.position_mm[2] === b.position_mm[2] &&
    a.quat_wxyz[0] === b.quat_wxyz[0] &&
    a.quat_wxyz[1] === b.quat_wxyz[1] &&
    a.quat_wxyz[2] === b.quat_wxyz[2] &&
    a.quat_wxyz[3] === b.quat_wxyz[3]
  );
}

/** Draw poses of every machine part and every placed item of a session. */
export function drawPoses(session: GameSession): DrawPoses {
  const poses = session.bodyPoses();
  const parts: { [id: string]: DrawPose } = {};
  for (const id of Object.keys(poses.parts).sort(compareIds)) {
    parts[id] = toDrawPose(poses.parts[id] as Pose);
  }
  const items: { [id: string]: DrawPose } = {};
  for (const id of Object.keys(poses.items).sort(compareIds)) {
    items[id] = toDrawPose(poses.items[id] as Pose);
  }
  return { parts, items };
}

/** Key of the machine geometry of a session: changes when its configuration does. */
export function geometryKey(session: GameSession): string {
  const geometry = session.machineGeometry();
  return canonicalHash({ machine: geometry.machineId, config: geometry.config });
}

/**
 * The scene of a session for drawing. `state` may be given when the caller already holds the
 * scene state of this moment (the result of an action); otherwise it is read without counting
 * a query.
 */
export function sceneView(session: GameSession, state?: SceneState): SceneView {
  return {
    state: state ?? uncountedSceneState(session),
    poses: drawPoses(session),
    geometry_key: geometryKey(session),
  };
}

/**
 * The geometry a client needs to draw a session: every part of the machine in its current
 * configuration, the machine's placement aids, and every item type the level uses. Nothing
 * here says anything about the wash.
 */
export function geometryPayload(session: GameSession): GeometryPayload {
  const geometry = session.machineGeometry();
  const parts: MachinePartPayload[] = geometry.parts.map((part) => ({
    id: part.id,
    role: part.role,
    component: part.component,
    frame: part.frame,
    material: part.material,
    carried_by: part.carriedBy,
    probe: part.role === 'arm',
    motion: part.motion,
    reference_pose: part.pose,
    shape: part.shape,
  }));
  const records = new Map(session.card.items.map((record) => [record.item_id, record]));
  const itemTypes: { [itemType: string]: ItemTypePayload } = {};
  const items = [...session.level.items]
    .sort((a, b) => compareIds(a.id, b.id))
    .map((item) => ({ item_id: item.id, item_type: item.itemType }));
  for (const item of items) {
    if (itemTypes[item.item_type] !== undefined) continue;
    const instance = instantiate(item.item_type);
    const record = records.get(item.item_id);
    itemTypes[item.item_type] = {
      item_type: item.item_type,
      display_name: instance.type.name,
      class: instance.type.itemClass,
      shape: instance.shape,
      bbox: instance.bbox,
      reference_point: instance.referencePoint,
      material: bodyMaterialOf(instance.type),
      orientation_presets: record?.orientation_presets ?? [],
    };
  }
  return {
    geometry_key: geometryKey(session),
    units: { length: 'm', angle: 'rad', quaternion: 'xyzw' },
    machine: {
      machine_id: geometry.machineId,
      config: geometry.config,
      parts,
      affordances: geometry.affordances,
    },
    item_types: itemTypes,
    items,
  };
}
