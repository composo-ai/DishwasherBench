/**
 * The scene of a load for drawing: the baskets, their fittings and the spray arms of the
 * machine with every loaded item at its pose, and the standard orthographic views of it.
 *
 * A scene is built either from a live session (baskets wherever they stand) or from a wash
 * manifest (baskets pushed in, as the wash sees the load). The tub shell, the door and the
 * dispenser are left out so that the load can be seen.
 */

import { getItemType, instantiate } from '@spotless/catalogue';
import type { Pose, Vec3 } from '@spotless/core';
import type { MachineConfig, MachineGeometry } from '@spotless/machine';
import { buildMachineGeometry, findMachine } from '@spotless/machine';
import type { GameSession } from '@spotless/session';
import type { OrthoView, Raster, RenderBody, Rgb } from './render.ts';
import { contactSheet, renderView } from './render.ts';

/** A load ready to be drawn. */
export interface LoadScene {
  readonly bodies: readonly RenderBody[];
  /** Tub-frame z of the top of the upper basket's base grid, metres. */
  readonly upperFloorZ: number;
  /** Ids of the bodies that belong to the lower basket level (machine parts and items). */
  readonly lowerLevel: ReadonlySet<string>;
  /** Ids of the bodies that belong to the upper basket level. */
  readonly upperLevel: ReadonlySet<string>;
  /** The box that holds everything drawn, tub frame, metres. */
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
}

/** One item of a scene: its catalogue type and where it is. */
export interface SceneItem {
  readonly item_id: string;
  readonly item_type: string;
  /** Item frame to tub frame, SI. */
  readonly pose: Pose;
}

const WIRE: Rgb = [70, 74, 80];
const FITTING: Rgb = [214, 190, 150];
const CUTLERY_BASKET: Rgb = [205, 196, 176];
const ARM: Rgb = [120, 160, 215];

const TAG_COLOURS: Readonly<Record<string, Rgb>> = {
  plate: [246, 244, 236],
  saucer: [240, 232, 214],
  platter: [236, 224, 200],
  flat_dish: [176, 180, 188],
  bowl: [178, 208, 238],
  cup: [246, 190, 130],
  mug: [236, 150, 96],
  glass: [150, 226, 226],
  stemware: [126, 206, 226],
  jug: [140, 200, 170],
  pot: [150, 154, 164],
  pan: [104, 108, 120],
  container: [150, 214, 140],
  lid: [190, 226, 160],
  cutlery: [176, 184, 204],
  utensil: [214, 150, 190],
  board: [206, 164, 110],
  bottle: [190, 170, 236],
  wire_rack: [150, 150, 160],
};

/** Colour an item of a catalogue type is drawn in (by its shape family). */
export function itemColour(itemType: string): Rgb {
  return TAG_COLOURS[getItemType(itemType).shapeTag] ?? [220, 220, 220];
}

/** Machine parts that are drawn; the tub shell, the door and what is fixed to them are not. */
const DRAWN_COMPONENTS: ReadonlySet<string> = new Set([
  'basket_wires',
  'basket_fittings',
  'tablet_tray',
  'cutlery_basket',
  'spray_arm',
  'arm_feed',
]);

function partColour(component: string, role: string): Rgb {
  if (role === 'arm' || component === 'arm_feed') return ARM;
  if (component === 'basket_wires') return WIRE;
  if (component === 'cutlery_basket') return CUTLERY_BASKET;
  return FITTING;
}

function buildScene(
  geometry: MachineGeometry,
  partPoses: Readonly<Record<string, Pose>> | null,
  items: readonly SceneItem[],
): LoadScene {
  const bodies: RenderBody[] = [];
  const lower = new Set<string>();
  const upper = new Set<string>();
  const upperBasket = geometry.affordances.baskets.find((b) => b.frame === 'upper_rack');
  const upperOrigin = upperBasket?.originTub ?? [0, 0, 0.42];
  let upperFloorZ = upperOrigin[2];
  for (const part of geometry.parts) {
    const drawn = part.role === 'arm' || DRAWN_COMPONENTS.has(part.component);
    if (!drawn) continue;
    const pose = partPoses?.[part.id] ?? part.pose;
    if (part.id === 'upper_rack') upperFloorZ = pose.p[2];
    bodies.push({
      id: part.id,
      shape: part.shape,
      pose,
      colour: partColour(part.component, part.role),
      chordError: 0.0006,
    });
    if (part.id.startsWith('upper_rack')) upper.add(part.id);
    else if (part.id.startsWith('lower_rack') || part.id === 'cutlery_basket') lower.add(part.id);
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const spec = findMachine(geometry.machineId);
  if (spec !== undefined) {
    min[0] = spec.tub.x[0];
    max[0] = spec.tub.x[1];
    min[1] = spec.tub.y[0];
    max[1] = spec.tub.y[1];
    min[2] = spec.tub.z[0];
    max[2] = spec.tub.z[1];
  }
  for (const item of items) {
    const instance = instantiate(item.item_type);
    bodies.push({
      id: item.item_id,
      shape: instance.shape,
      pose: item.pose,
      colour: itemColour(item.item_type),
    });
    (item.pose.p[2] >= upperFloorZ - 0.03 ? upper : lower).add(item.item_id);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k] as number, (item.pose.p[k] as number) - 0.2);
      max[k] = Math.max(max[k] as number, (item.pose.p[k] as number) + 0.2);
    }
  }
  for (const body of bodies) {
    for (let k = 0; k < 2; k++) {
      min[k] = Math.min(min[k] as number, (body.pose.p[k] as number) - 0.02);
    }
  }
  return { bodies, upperFloorZ, lowerLevel: lower, upperLevel: upper, bounds: { min, max } };
}

/** The scene of a wash manifest: the machine in the manifest's configuration, baskets in. */
export function sceneOfManifest(manifest: {
  readonly machine_id: string;
  readonly machine_config: MachineConfig;
  readonly items: readonly SceneItem[];
}): LoadScene {
  const spec = findMachine(manifest.machine_id);
  if (spec === undefined) throw new RangeError(`loader: unknown machine '${manifest.machine_id}'`);
  return buildScene(buildMachineGeometry(spec, manifest.machine_config), null, manifest.items);
}

/** The scene of a live session: baskets and items where they are now. */
export function sceneOfSession(session: GameSession): LoadScene {
  const poses = session.bodyPoses();
  const types = new Map(session.level.items.map((item) => [item.id, item.itemType]));
  const items: SceneItem[] = Object.keys(poses.items)
    .sort()
    .map((id) => ({
      item_id: id,
      item_type: types.get(id) as string,
      pose: poses.items[id] as Pose,
    }));
  return buildScene(session.machineGeometry(), poses.parts, items);
}

/** Names of the standard views, in the order of the contact sheet. */
export const STANDARD_VIEWS = ['top-lower', 'top-upper', 'front', 'side'] as const;

/** Name of a standard view. */
export type StandardViewName = (typeof STANDARD_VIEWS)[number] | 'iso';

/**
 * Draws one standard view of a scene.
 *  - `top-lower`: the lower basket from above (the upper basket and what is in it left out);
 *  - `top-upper`: the upper basket from above;
 *  - `front`: from the door, +x to the right, z up;
 *  - `side`: from the left wall, the door on the left of the picture, z up;
 *  - `iso`: from the front left above.
 */
export function renderStandardView(
  scene: LoadScene,
  name: StandardViewName,
  widthPx = 900,
): Raster {
  const { min, max } = scene.bounds;
  let bodies = scene.bodies;
  let view: OrthoView;
  if (name === 'top-lower' || name === 'top-upper') {
    const level = name === 'top-lower' ? scene.lowerLevel : scene.upperLevel;
    const others = name === 'top-lower' ? scene.upperLevel : scene.lowerLevel;
    bodies = scene.bodies.filter(
      (b) =>
        level.has(b.id) ||
        (!others.has(b.id) &&
          (name === 'top-lower'
            ? b.pose.p[2] < scene.upperFloorZ - 0.1
            : b.pose.p[2] >= scene.upperFloorZ - 0.1) &&
          b.id !== 'upper_arm' &&
          b.id !== 'upper_arm_feed'),
    );
    view = {
      name,
      right: [1, 0, 0],
      up: [0, 1, 0],
      bounds: { min: [min[0], min[1], 0], max: [max[0], max[1], 0] },
      caption: `${name}: from above, +x right, +y (back) up`,
    };
  } else if (name === 'front') {
    view = {
      name,
      right: [1, 0, 0],
      up: [0, 0, 1],
      bounds: { min: [min[0], 0, min[2]], max: [max[0], 0, max[2]] },
      caption: 'front: from the door, +x right, z up',
    };
  } else if (name === 'side') {
    view = {
      name,
      right: [0, 1, 0],
      up: [0, 0, 1],
      bounds: { min: [0, min[1], min[2]], max: [0, max[1], max[2]] },
      caption: 'side: from the left wall, door on the left, z up',
    };
  } else {
    const right: Vec3 = [Math.SQRT1_2, Math.SQRT1_2, 0];
    const up: Vec3 = [-0.35, 0.35, 0.87];
    view = {
      name,
      right,
      up,
      bounds: { min, max },
      caption: 'iso: from the front left above',
    };
  }
  return renderView(bodies, view, { widthPx });
}

/** The four standard views on one sheet: both baskets from above, then front and side. */
export function renderLoadSheet(scene: LoadScene, widthPx = 760): Raster {
  return contactSheet(
    STANDARD_VIEWS.map((name) => renderStandardView(scene, name, widthPx)),
    2,
  );
}
