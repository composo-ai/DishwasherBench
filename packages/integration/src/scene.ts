/**
 * A loading scene for the integration tests: one physics world with the stand-in rack, friction
 * from the catalogue's pair table and catalogue items as bodies, with everything derived the way
 * the session will derive it:
 *
 *   catalogue `instantiate(id)` -> `Shape`, mass properties and contact material
 *   geometry `buildCollisionPieces(shape)` -> convex pieces
 *   physics `addBody(id, pieces, mass, material, pose, kind)`
 *
 * No shape, mass or coefficient is made up here.
 *
 * Units: SI. Frames: the world frame is the tub frame of the physics package; unless a rack pose
 * is given the rack frame coincides with it. Poses map an item frame to the world frame.
 */

import type { ItemInstance } from '@spotless/catalogue';
import { contactPairLookup, instantiate } from '@spotless/catalogue';
import type { Pose, Quat, Vec3 } from '@spotless/core';
import { POSE_IDENTITY, compareIds, quatFromAxisAngle, quatMul, quatRotate } from '@spotless/core';
import type { Aabb, CollisionPiece, Shape } from '@spotless/geometry';
import { COLLISION_CHORD_ERROR, boundingBox, buildCollisionPieces } from '@spotless/geometry';
import type {
  BodyKind,
  JoltPhysicsWorld,
  JoltWorldSettings,
  SettleResult,
} from '@spotless/physics';
import {
  JOLT_SETTINGS,
  LOADING_GRAVITY,
  LOADING_TIME_STEP,
  NO_MASS,
  createPhysicsWorld,
  settleOptionsFor,
} from '@spotless/physics';
import type { StandInRack } from './stand-in-rack.ts';
import {
  BASKET_MATERIAL,
  RACK_MATERIAL,
  TUB_FLOOR_MATERIAL,
  buildStandInRack,
} from './stand-in-rack.ts';

/** Body id of the rack every scene starts with (base grid, frame and tines). */
export const RACK_ID = 'rack';
/** Body id of the cutlery basket standing on the rack. */
export const BASKET_ID = 'rack_basket';
/** Body id of the tub floor under the rack. */
export const TUB_FLOOR_ID = 'tub_floor';

/** A body of the scene with the single description everything is derived from. */
export interface SceneBody {
  readonly id: string;
  /** The shape in the body's own frame. */
  readonly shape: Shape;
  /** Its collision pieces at the platform's collision chord error (0.5 mm). */
  readonly pieces: readonly CollisionPiece[];
  readonly kind: BodyKind;
}

/** A catalogue item in the scene. */
export interface SceneItem extends SceneBody {
  readonly typeId: string;
  readonly instance: ItemInstance;
  /** The pose it was released at (item frame to world frame). */
  readonly released: Pose;
}

/** One physics world with the stand-in rack and whatever has been loaded onto it. */
export interface LoadingScene {
  readonly world: JoltPhysicsWorld;
  readonly rack: StandInRack;
  /** The rack frame in the world frame. */
  readonly rackPose: Pose;
  /** Static and kinematic bodies: the rack, its basket, the tub floor and any added later. */
  readonly fixtures: SceneBody[];
  /** The catalogue items, in the order they were added. */
  readonly items: SceneItem[];
}

/** Options of {@link createLoadingScene}. */
export interface LoadingSceneOptions {
  /** The rack to load; defaults to the stand-in rack at its standard dimensions. */
  readonly rack?: StandInRack;
  /** The rack frame in the world frame; defaults to the identity. */
  readonly rackPose?: Pose;
  /** How the rack and its basket take part: `'static'` (default) or `'kinematic'`. */
  readonly rackKind?: 'static' | 'kinematic';
  /** Wet (wash) friction instead of dry (loading) friction; default false. */
  readonly wet?: boolean;
  /** Leave out the cutlery basket or the tub floor; both are present by default. */
  readonly basket?: boolean;
  readonly tubFloor?: boolean;
  /** Engine settings to change from the loading defaults (for studying one setting only). */
  readonly settings?: Partial<JoltWorldSettings>;
}

const pieceCache = new WeakMap<Shape, readonly CollisionPiece[]>();

/**
 * The collision pieces of a shape at the platform's collision chord error, cached per shape
 * object: bodies of the same item type then share one array, which lets the physics world share
 * one engine shape between them.
 */
export function collisionPiecesOf(shape: Shape): readonly CollisionPiece[] {
  let pieces = pieceCache.get(shape);
  if (pieces === undefined) {
    pieces = buildCollisionPieces(shape, { chordError: COLLISION_CHORD_ERROR });
    pieceCache.set(shape, pieces);
  }
  return pieces;
}

/**
 * Adds a static or kinematic body built from a shape (a rack, a basket, a floor) at `pose`
 * (shape frame to world frame). `material` is the catalogue material of any piece that names
 * none; the pieces of a shape carry the material of their own part.
 */
export function addFixture(
  scene: LoadingScene,
  id: string,
  shape: Shape,
  material: string,
  pose: Pose = POSE_IDENTITY,
  kind: 'static' | 'kinematic' = 'static',
): SceneBody {
  const body: SceneBody = { id, shape, pieces: collisionPiecesOf(shape), kind };
  scene.world.addBody(id, body.pieces, NO_MASS, { material }, pose, kind);
  scene.fixtures.push(body);
  return body;
}

/**
 * Creates a world stepping at the loading time step under loading gravity, with contact
 * coefficients from the catalogue's pair table, and puts the stand-in rack, its cutlery basket
 * and the tub floor into it. Dispose of `scene.world` when done.
 */
export async function createLoadingScene(options: LoadingSceneOptions = {}): Promise<LoadingScene> {
  const rack = options.rack ?? buildStandInRack();
  const world = await createPhysicsWorld(
    {
      timeStep: LOADING_TIME_STEP,
      gravity: LOADING_GRAVITY,
      pairLookup: contactPairLookup(options.wet ?? false),
    },
    { ...JOLT_SETTINGS, ...options.settings },
  );
  const rackPose = options.rackPose ?? POSE_IDENTITY;
  const scene: LoadingScene = { world, rack, rackPose, fixtures: [], items: [] };
  const kind = options.rackKind ?? 'static';
  addFixture(scene, RACK_ID, rack.rack, RACK_MATERIAL, rackPose, kind);
  if (options.basket !== false) {
    addFixture(scene, BASKET_ID, rack.basket, BASKET_MATERIAL, rackPose, kind);
  }
  if (options.tubFloor !== false) {
    addFixture(scene, TUB_FLOOR_ID, rack.tubFloor, TUB_FLOOR_MATERIAL, rackPose, 'static');
  }
  return scene;
}

/**
 * Adds a catalogue item as a dynamic body at `pose` (item frame to world frame), at rest. Shape,
 * mass properties and contact material are those of `instantiate(typeId)`.
 */
export function addItem(scene: LoadingScene, id: string, typeId: string, pose: Pose): SceneItem {
  const instance = instantiate(typeId);
  const item: SceneItem = {
    id,
    typeId,
    instance,
    shape: instance.shape,
    pieces: collisionPiecesOf(instance.shape),
    kind: 'dynamic',
    released: pose,
  };
  scene.world.addBody(id, item.pieces, instance.mass, instance.contact, pose, 'dynamic');
  scene.items.push(item);
  return item;
}

/** The item with the given id. Throws when the scene has none. */
export function itemOf(scene: LoadingScene, id: string): SceneItem {
  const found = scene.items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`integration: no item '${id}' in the scene`);
  return found;
}

/**
 * The orientation of a named pose of an item type (`'upright'`, `'inverted'`, `'on_edge'`, ...),
 * optionally turned afterwards by `yaw` radians about the world's +z.
 */
export function orientationOf(instance: ItemInstance, poseName: string, yaw = 0): Quat {
  const found = instance.stablePoses.find((pose) => pose.name === poseName);
  if (found === undefined) {
    throw new Error(`integration: item type '${instance.type.id}' has no pose '${poseName}'`);
  }
  return yaw === 0 ? found.q : quatMul(quatFromAxisAngle([0, 0, 1], yaw), found.q);
}

/**
 * The pose that puts a shape, turned by `q`, with the centre of its bounding box at (`x`, `y`)
 * and its lowest point at height `z` (all in the frame `q` turns into, metres).
 */
export function poseOver(shape: Shape, q: Quat, x: number, y: number, z: number): Pose {
  const box = boundingBox(shape, { p: [0, 0, 0], q });
  return {
    p: [x - (box.min[0] + box.max[0]) / 2, y - (box.min[1] + box.max[1]) / 2, z - box.min[2]],
    q,
  };
}

/**
 * Lowers a probe (pieces at `pose`) straight down by up to `travel` metres and returns the pose
 * `gap` metres above first contact, which is how the session releases a placed item
 * (docs/design/platform.md section 6, step 4: lower along -z to first contact and release at
 * rest). Returns the pose at the end of the travel when nothing is met. Throws when the probe
 * already overlaps something at `pose`.
 */
export function lowerToContact(
  scene: LoadingScene,
  pieces: readonly CollisionPiece[],
  pose: Pose,
  travel: number,
  gap = 0.0005,
  ignore: readonly string[] = [],
): { readonly pose: Pose; readonly hit: boolean; readonly with?: string } {
  const start = scene.world.penetration(pieces, pose, ignore);
  if (start.depth > 0) {
    throw new Error(
      `integration: the start pose overlaps ${start.with.join(', ')} by ${(start.depth * 1000).toFixed(3)} mm`,
    );
  }
  const end: Pose = { p: [pose.p[0], pose.p[1], pose.p[2] - travel], q: pose.q };
  const sweep = scene.world.sweep(pieces, pose, end, ignore);
  const drop = Math.max(0, sweep.fraction * travel - (sweep.hit ? gap : 0));
  const at: Pose = { p: [pose.p[0], pose.p[1], pose.p[2] - drop], q: pose.q };
  return sweep.with === undefined
    ? { pose: at, hit: sweep.hit }
    : { pose: at, hit: sweep.hit, with: sweep.with };
}

/** Settles the scene with the platform's rest criterion and settle budget. */
export function settleScene(scene: LoadingScene): SettleResult {
  return scene.world.settle(settleOptionsFor(scene.world.timeStep));
}

/** Angle in degrees between the item-frame +z axis of a pose and the world's vertical, 0 to 180. */
export function axisFromUpDeg(q: Quat): number {
  const axis = quatRotate(q, [0, 0, 1]);
  return (Math.acos(Math.max(-1, Math.min(1, axis[2]))) * 180) / Math.PI;
}

/** The bounding box of a scene body at its current pose, world frame, metres. */
export function bodyBounds(scene: LoadingScene, body: SceneBody): Aabb {
  return boundingBox(body.shape, scene.world.getPose(body.id));
}

/** Largest linear (m/s) and angular (rad/s) speed among the given bodies. */
export function fastest(
  scene: LoadingScene,
  ids: readonly string[],
): { readonly linear: number; readonly angular: number } {
  let linear = 0;
  let angular = 0;
  for (const id of ids) {
    const v = scene.world.getVelocity(id);
    linear = Math.max(linear, Math.hypot(v.linear[0], v.linear[1], v.linear[2]));
    angular = Math.max(angular, Math.hypot(v.angular[0], v.angular[1], v.angular[2]));
  }
  return { linear, angular };
}

/** Ids of the items of a scene, sorted. */
export function itemIds(scene: LoadingScene): string[] {
  return scene.items.map((item) => item.id).sort(compareIds);
}

/** The point of an item given in its item frame, in the world frame at its current pose. */
export function itemPoint(scene: LoadingScene, id: string, point: Vec3): Vec3 {
  const pose = scene.world.getPose(id);
  const turned = quatRotate(pose.q, point);
  return [pose.p[0] + turned[0], pose.p[1] + turned[1], pose.p[2] + turned[2]];
}
