/**
 * The loads the integration scenarios, the step-time measurement and the scene dump share:
 * twelve dinner plates in adjacent tine slots, a stack of nested bowls, cutlery in the basket and
 * a mixed load of sixty items on two racks.
 *
 * Every release pose is worked out from the rack's dimensions and the item's exact shape (the
 * geometry kernel), not from the physics world, so a load is the same list of bodies and poses
 * whatever order it is added in. Items are released at rest a small gap above where they will
 * touch, or dropped from a stated height.
 *
 * Units: SI. Poses are given in the frame of the rack they are loaded on and converted to the
 * world frame of the scene.
 */

import { instantiate } from '@spotless/catalogue';
import type { Pose } from '@spotless/core';
import { POSE_IDENTITY, poseCompose } from '@spotless/core';
import { boundingBox } from '@spotless/geometry';
import { kernelNestSpacing } from './nest.ts';
import { fitOverTines, leaningOrientation, slotFit } from './rack-geometry.ts';
import type { LoadingScene, SceneItem } from './scene.ts';
import { addFixture, addItem, collisionPiecesOf, orientationOf, poseOver } from './scene.ts';
import type { BasketCell, PlateSlot, StandInRack } from './stand-in-rack.ts';
import { BASKET_MATERIAL, RACK_MATERIAL } from './stand-in-rack.ts';

/** Gap above first contact at which a placed item is released, metres. */
export const RELEASE_GAP = 0.0005;

/** The dinner plate of the scenarios: the IEC 60436 test-load plate (250 mm, 530 g). */
export const DINNER_PLATE = 'dinner_plate_porcelain_iec';
/** The bowl of the scenarios: the 160 mm porcelain cereal bowl (440 g). */
export const BOWL = 'cereal_bowl_porcelain_160';
/** The mug of the scenarios: the 300 ml ceramic mug with a loop handle (351 g). */
export const MUG = 'mug_ceramic_300';
/** The cutlery dropped into the basket, in the order it is dealt to the cells. */
export const CUTLERY: readonly string[] = [
  'dinner_knife_210',
  'dinner_fork_185',
  'soup_spoon_190',
  'teaspoon_130',
  'dessert_spoon_160',
  'salad_fork_156',
];

function index2(i: number): string {
  return i < 10 ? `0${i}` : `${i}`;
}

/** Adds an item after checking that its release pose overlaps nothing in the scene. */
function release(
  scene: LoadingScene,
  id: string,
  typeId: string,
  rackPose: Pose,
  pose: Pose,
): SceneItem {
  const world = poseCompose(rackPose, pose);
  const pieces = collisionPiecesOf(instantiate(typeId).shape);
  const overlap = scene.world.penetration(pieces, world);
  if (overlap.depth > 0) {
    throw new Error(
      `integration: '${id}' would be released ${(overlap.depth * 1000).toFixed(3)} mm inside ${overlap.with.join(', ')}`,
    );
  }
  return addItem(scene, id, typeId, world);
}

/**
 * The pose (rack frame) at which a plate is released into a tine slot: standing on its edge
 * across the rails, upright, in the middle of the room the slot leaves it, {@link RELEASE_GAP}
 * above the base grid. Throws when the plate does not fit the slot upright.
 */
export function plateReleasePose(rack: StandInRack, slot: PlateSlot, typeId: string): Pose {
  const shape = instantiate(typeId).shape;
  const fit = slotFit(rack, slot, shape, 0);
  if (fit.play < 0) {
    throw new Error(
      `integration: '${typeId}' needs ${((slot.clearWidth - fit.play) * 1000).toFixed(1)} mm of slot, ` +
        `the rack has ${(slot.clearWidth * 1000).toFixed(1)} mm`,
    );
  }
  return {
    p: [slot.centreX, (fit.yMin + fit.yMax) / 2, fit.z + RELEASE_GAP],
    q: leaningOrientation(0),
  };
}

/**
 * Scenario b: one dinner plate in each of the first `count` slots (twelve by default), ids
 * `plate_00` ... in slot order. `reverse` adds them to the world last slot first; the bodies and
 * their poses are the same either way. `rackPose` is the frame of the rack they are loaded on
 * (default: the scene's own rack).
 */
export function loadPlates(
  scene: LoadingScene,
  options: {
    readonly count?: number;
    readonly reverse?: boolean;
    readonly typeId?: string;
    readonly rackPose?: Pose;
    readonly prefix?: string;
    readonly firstSlot?: number;
  } = {},
): SceneItem[] {
  const count = options.count ?? 12;
  const typeId = options.typeId ?? DINNER_PLATE;
  const first = options.firstSlot ?? 0;
  const prefix = options.prefix ?? 'plate';
  const rackPose = options.rackPose ?? scene.rackPose;
  const planned: { id: string; pose: Pose }[] = [];
  for (let k = 0; k < count; k++) {
    const slot = scene.rack.slots[first + k];
    if (slot === undefined) throw new Error(`integration: the rack has no slot ${first + k}`);
    planned.push({
      id: `${prefix}_${index2(k)}`,
      pose: plateReleasePose(scene.rack, slot, typeId),
    });
  }
  const order = options.reverse === true ? [...planned].reverse() : planned;
  const added = new Map<string, SceneItem>();
  for (const { id, pose } of order) added.set(id, release(scene, id, typeId, rackPose, pose));
  return planned.map(({ id }) => added.get(id) as SceneItem);
}

/**
 * A stack of `count` identical bowls on the base grid, their common axis at (`x`, `y`) of the
 * rack frame, each released {@link RELEASE_GAP} above where it nests in the one below (the
 * geometric nest spacing of the shape). Bowl `k` is turned by `yaw0 + k * yawStep` radians about
 * the axis. Ids `<prefix>_0` ... from the bottom.
 */
export function loadNestedBowls(
  scene: LoadingScene,
  x: number,
  y: number,
  options: {
    readonly count?: number;
    readonly typeId?: string;
    readonly yaw0?: number;
    readonly yawStep?: number;
    readonly prefix?: string;
    readonly rackPose?: Pose;
    /** Extra height added to each release, metres (to drop the bowls instead of placing them). */
    readonly drop?: number;
  } = {},
): { readonly items: SceneItem[]; readonly spacing: number } {
  const typeId = options.typeId ?? BOWL;
  const count = options.count ?? 4;
  const instance = instantiate(typeId);
  const spacing = kernelNestSpacing(instance.shape);
  const drop = options.drop ?? 0;
  const items: SceneItem[] = [];
  for (let k = 0; k < count; k++) {
    const q = orientationOf(instance, 'upright', (options.yaw0 ?? 0) + k * (options.yawStep ?? 0));
    const z = RELEASE_GAP + k * (spacing + RELEASE_GAP + drop) + drop;
    items.push(
      release(
        scene,
        `${options.prefix ?? 'bowl'}_${k}`,
        typeId,
        options.rackPose ?? scene.rackPose,
        { p: [x, y, z], q },
      ),
    );
  }
  return { items, spacing };
}

/** A piece of cutlery in the basket and the cell it was dropped into. */
export interface BasketPiece {
  readonly item: SceneItem;
  readonly cell: BasketCell;
}

/** How cutlery is dropped into the basket by {@link loadCutlery}. */
export interface CutleryDropOptions {
  /** Pieces per cell, by cell index; default two into every cell. */
  readonly perCell?: readonly number[];
  /** Height of the lowest point of the first piece of a cell above the cell floor, metres. */
  readonly dropHeight?: number;
  /** Height by which each further piece of a cell starts above the one before, metres. */
  readonly heightStep?: number;
  /** The frame of the rack the basket stands on; default the scene's own rack. */
  readonly rackPose?: Pose;
  /** Prefix of the ids; default `cutlery`. */
  readonly prefix?: string;
}

/**
 * Cutlery dropped into the basket, handles down, dealt from {@link CUTLERY} in turn; ids
 * `cutlery_NN`. The pieces of a cell stand side by side across it, flat faces towards each other
 * and alternately turned round, 14 mm apart or closer if the cell is short of room, each
 * twisted a few degrees about the vertical. By default the first is released with its handle 30
 * mm above the cell floor and every further one 80 mm higher, so that they arrive one after the
 * other.
 */
export function loadCutlery(scene: LoadingScene, options: CutleryDropOptions = {}): BasketPiece[] {
  const out: BasketPiece[] = [];
  const dropHeight = options.dropHeight ?? 0.03;
  const heightStep = options.heightStep ?? 0.08;
  scene.rack.cells.forEach((cell, c) => {
    const pieces = options.perCell === undefined ? 2 : (options.perCell[c] ?? 0);
    const sizeX = cell.inner.max[0] - cell.inner.min[0];
    const pitch = Math.min(0.014, (sizeX - 0.014) / Math.max(1, pieces));
    for (let j = 0; j < pieces; j++) {
      const typeId = CUTLERY[out.length % CUTLERY.length] as string;
      const instance = instantiate(typeId);
      // Handle down, the flat of the piece across the cell (its thickness along x); every other
      // piece faces the other way, and each is twisted by up to 6 degrees.
      const twist = ((((c * 7 + j * 3) % 5) - 2) * 3 * Math.PI) / 180;
      const q = orientationOf(instance, 'handle_down', (j % 2) * Math.PI + twist);
      const pose = poseOver(
        instance.shape,
        q,
        cell.centre[0] + (j - (pieces - 1) / 2) * pitch,
        cell.centre[1],
        cell.inner.min[2] + dropHeight + j * heightStep,
      );
      const id = `${options.prefix ?? 'cutlery'}_${index2(out.length)}`;
      out.push({
        item: release(scene, id, typeId, options.rackPose ?? scene.rackPose, pose),
        cell,
      });
    }
  });
  return out;
}

/**
 * The pose (rack frame) of a round vessel turned upside down with its axis at (`x`, `y`), turned
 * by `yaw` about the vertical, its rim `height` above the base grid.
 */
export function invertedPose(typeId: string, x: number, y: number, height: number, yaw = 0): Pose {
  const instance = instantiate(typeId);
  const q = orientationOf(instance, 'inverted', yaw);
  const box = boundingBox(instance.shape, { p: [0, 0, 0], q });
  // The axis of the vessel is the item z axis: the item origin maps to (x, y).
  return { p: [x, y, height - box.min[2]], q };
}

/** The groups of a {@link loadMixedLoad}. */
export interface MixedLoad {
  /** Lower rack: twelve dinner plates in the tine slots. */
  readonly plates: readonly SceneItem[];
  /** Lower rack: four nested bowls on the open part of the grid. */
  readonly bowls: readonly SceneItem[];
  /** Lower rack: cutlery in the basket, four and three pieces to a cell in turn (28 in all). */
  readonly cutlery: readonly BasketPiece[];
  /** Upper rack: four dessert plates in the first tine slots. */
  readonly sidePlates: readonly SceneItem[];
  /** Upper rack: three mugs and three tumblers upside down over pairs of tines. */
  readonly overTines: readonly SceneItem[];
  /** Upper rack: two food containers, two beakers and two wine glasses upside down on the grid. */
  readonly onGrid: readonly SceneItem[];
  /** The frame of the upper rack in the world frame. */
  readonly upperRackPose: Pose;
  /** Number of items in all. */
  readonly count: number;
}

/** What {@link loadMixedLoad} loads differently from its sixty-item default. */
export interface MixedLoadOptions {
  /** Pieces of cutlery per basket cell, by cell index; default four and three in turn. */
  readonly cutleryPerCell?: readonly number[];
  /** Number of nested bowls on the lower rack; default four. */
  readonly bowls?: number;
}

/** Height of the upper rack's base grid above the lower rack's, metres ([ESTIMATED] machine.md). */
export const UPPER_RACK_HEIGHT = 0.3;

/** What {@link loadUpperRack} puts on the upper rack. */
export interface UpperRackLoad {
  /** Four dessert plates in the first tine slots. */
  readonly sidePlates: readonly SceneItem[];
  /** Three mugs and three tumblers upside down over pairs of tines. */
  readonly overTines: readonly SceneItem[];
  /** Two food containers, two beakers and two wine glasses upside down on the grid. */
  readonly onGrid: readonly SceneItem[];
}

/**
 * Adds a second stand-in rack without a basket as the static body `upper_rack` at
 * `upperRackPose` (world frame) and loads it with sixteen items; see {@link loadMixedLoad}.
 */
export function loadUpperRack(scene: LoadingScene, upperRackPose: Pose): UpperRackLoad {
  const rack = scene.rack;
  addFixture(scene, 'upper_rack', rack.rack, RACK_MATERIAL, upperRackPose, 'static');
  const sidePlates = loadPlates(scene, {
    count: 4,
    typeId: 'dessert_plate_porcelain_190',
    rackPose: upperRackPose,
    prefix: 'side_plate',
  });
  const overTines: SceneItem[] = [];
  const over = (id: string, typeId: string, rail: 0 | 1, slotIndex: number, yaw: number): void => {
    const slot = rack.slots[slotIndex];
    if (slot === undefined) throw new Error(`integration: the rack has no slot ${slotIndex}`);
    const x = slot.railX[rail];
    const y = (slot.frontY + slot.backY) / 2;
    const rim = rimRadii(typeId);
    const fit = fitOverTines(rack, x, y, rim.inner, rim.outer);
    if (!fit.fits) throw new Error(`integration: '${typeId}' does not go over the tines there`);
    overTines.push(
      release(scene, id, typeId, upperRackPose, invertedPose(typeId, x, y, RELEASE_GAP, yaw)),
    );
  };
  [5, 8, 11].forEach((slotIndex, i) => {
    // Mugs on the right-hand rail with their handles to the right; tumblers on the left-hand one.
    over(`mug_${i}`, i === 1 ? 'mug_porcelain_240' : MUG, 1, slotIndex, 0);
    over(`tumbler_${i}`, 'tumbler_250', 0, slotIndex, 0);
  });
  const onGrid: SceneItem[] = [];
  // The upper rack has no basket: its open zone reaches from the front of the frame to the back.
  const frame = rack.dims.frameWireMm / 1000;
  const zoneLeft = rack.openZone.min[0];
  const right = rack.openZone.max[0];
  const zoneCentre = (zoneLeft + right) / 2;
  const quarter = (right - zoneLeft) / 4;
  let y = frame + 0.004;
  const row = (typeId: string, ids: readonly string[], xs: readonly number[]): void => {
    const box = boundingBox(instantiate(typeId).shape);
    const depth = box.max[1] - box.min[1];
    ids.forEach((id, i) => {
      onGrid.push(
        release(
          scene,
          id,
          typeId,
          upperRackPose,
          invertedPose(typeId, xs[i] as number, y + depth / 2, RELEASE_GAP),
        ),
      );
    });
    y += depth + 0.004;
  };
  row('food_container_600ml', ['container_0'], [zoneCentre]);
  row('food_container_600ml', ['container_1'], [zoneCentre]);
  row(
    'drinking_cup_pp_400',
    ['beaker_0', 'beaker_1'],
    [zoneCentre - quarter, zoneCentre + quarter],
  );
  row(
    'wine_glass_red_540',
    ['wine_glass_0', 'wine_glass_1'],
    [zoneCentre - quarter, zoneCentre + quarter],
  );

  return { sidePlates, overTines, onGrid };
}

/**
 * A mixed load on two racks, everything released at once; sixty items on the stand-in rack at
 * its standard dimensions:
 * - lower rack (the scene's own, with its basket): 12 dinner plates, 4 nested bowls and 28
 *   pieces of cutlery;
 * - upper rack (a second stand-in rack without a basket, {@link UPPER_RACK_HEIGHT} higher,
 *   added here as the static body `upper_rack`): 4 dessert plates in tine slots, 3 mugs and 3
 *   tumblers upside down over tine pairs, and 2 polypropylene food containers, 2 polypropylene
 *   beakers and 2 wine glasses upside down on the grid.
 * The layout is worked out from the rack (slots, cells, frame), so it follows a change of its
 * dimensions as far as the items still fit; where one does not, this throws and says which.
 * The scene must hold no items yet.
 */
export function loadMixedLoad(scene: LoadingScene, options: MixedLoadOptions = {}): MixedLoad {
  if (scene.items.length > 0) throw new Error('integration: the mixed load needs an empty scene');
  const rack = scene.rack;
  const lower = scene.rackPose;
  const upperRackPose = poseCompose(lower, { p: [0, 0, UPPER_RACK_HEIGHT], q: POSE_IDENTITY.q });

  // ---- lower rack
  const plates = loadPlates(scene, { count: 12 });
  // On the open part of the grid: right of the plates, behind the basket.
  const bowls = loadNestedBowls(scene, rack.openPoint[0], rack.openPoint[1], {
    count: options.bowls ?? 4,
  }).items;
  // Four and three pieces to a cell in turn. Under the upper rack there is no room to drop a
  // piece from above the rim: all start low.
  const cutlery = loadCutlery(scene, {
    perCell: options.cutleryPerCell ?? rack.cells.map((_, c) => (c % 2 === 0 ? 4 : 3)),
    dropHeight: 0.02,
    heightStep: 0,
  });

  const { sidePlates, overTines, onGrid } = loadUpperRack(scene, upperRackPose);

  return {
    plates,
    bowls,
    cutlery,
    sidePlates,
    overTines,
    onGrid,
    upperRackPose,
    count: scene.items.length,
  };
}

/** The groups of a {@link loadDenseLoad}. */
export interface DenseLoad {
  /** Lower rack: twelve dinner plates in the tine slots. */
  readonly plates: readonly SceneItem[];
  /** Lower rack: eight nested bowls on the open part of the grid. */
  readonly bowls: readonly SceneItem[];
  /** Lower rack: a full basket, eight pieces to a cell (64 in all). */
  readonly cutlery: readonly BasketPiece[];
  /** Upper rack: the sixteen items of {@link loadUpperRack}. */
  readonly upper: UpperRackLoad;
  /** Third level: twelve dessert plates in the tine slots. */
  readonly topPlates: readonly SceneItem[];
  /** Third level: eight nested dessert bowls on the open part of the grid. */
  readonly topBowls: readonly SceneItem[];
  /** Third level: three pieces of cutlery to a cell of a second basket (24 in all). */
  readonly topCutlery: readonly BasketPiece[];
  /** The items riding on the lower rack (plates, bowls, cutlery). */
  readonly lower: readonly SceneItem[];
  /** Number of items in all. */
  readonly count: number;
}

/** Steps between the stages of {@link loadDenseLoad}: one second at the loading time step. */
export const DENSE_LOAD_STAGE_STEPS = 240;

/**
 * A full, dense load of 144 items on the stand-in rack, put in the way a person fills a machine:
 * 1. lower rack (the scene's own, with its basket): twelve dinner plates, eight nested bowls and
 *    four pieces of cutlery in every basket cell, released together and stepped for a second;
 * 2. four more pieces dropped into every cell from above the ones standing there (the basket
 *    then holds 64), stepped for a second;
 * 3. the upper rack of {@link loadUpperRack}, and a third level 2 x {@link UPPER_RACK_HEIGHT}
 *    up (static bodies `top_rack` and `top_basket`) with twelve dessert plates, eight nested
 *    dessert bowls and three pieces of cutlery to a cell.
 * `afterStep` is called after every step of stages 1 and 2 (to watch the contact count). The
 * third level stands in for what a real upper rack takes side by side where the stand-in rack
 * has open grid; the load exists to press the contact solver as a tightly packed machine would.
 * The scene must hold no items yet.
 */
export function loadDenseLoad(scene: LoadingScene, afterStep: () => void = () => {}): DenseLoad {
  if (scene.items.length > 0) throw new Error('integration: the dense load needs an empty scene');
  const rack = scene.rack;
  const run = (): void => {
    for (let i = 0; i < DENSE_LOAD_STAGE_STEPS; i++) {
      scene.world.step(1);
      afterStep();
    }
  };
  const plates = loadPlates(scene, { count: 12 });
  const bowls = loadNestedBowls(scene, rack.openPoint[0], rack.openPoint[1], { count: 8 }).items;
  const four = rack.cells.map(() => 4);
  const cutlery = loadCutlery(scene, { perCell: four, dropHeight: 0.02, heightStep: 0 });
  run();
  // The longest piece is the 210 mm knife: the second four start clear above it.
  cutlery.push(
    ...loadCutlery(scene, { perCell: four, dropHeight: 0.24, heightStep: 0, prefix: 'cutlery_b' }),
  );
  run();

  const level = (k: number): Pose =>
    poseCompose(scene.rackPose, { p: [0, 0, k * UPPER_RACK_HEIGHT], q: POSE_IDENTITY.q });
  const upper = loadUpperRack(scene, level(1));
  const topRackPose = level(2);
  addFixture(scene, 'top_rack', rack.rack, RACK_MATERIAL, topRackPose, 'static');
  addFixture(scene, 'top_basket', rack.basket, BASKET_MATERIAL, topRackPose, 'static');
  const topPlates = loadPlates(scene, {
    count: 12,
    typeId: 'dessert_plate_porcelain_190',
    rackPose: topRackPose,
    prefix: 'top_plate',
  });
  const topBowls = loadNestedBowls(scene, rack.openPoint[0], rack.openPoint[1], {
    count: 8,
    typeId: 'dessert_bowl_vitrelle_130',
    prefix: 'top_bowl',
    rackPose: topRackPose,
  }).items;
  const topCutlery = loadCutlery(scene, {
    perCell: rack.cells.map(() => 3),
    dropHeight: 0.02,
    heightStep: 0,
    rackPose: topRackPose,
    prefix: 'top_cutlery',
  });
  return {
    plates,
    bowls,
    cutlery,
    upper,
    topPlates,
    topBowls,
    topCutlery,
    lower: [...plates, ...bowls, ...cutlery.map((piece) => piece.item)],
    count: scene.items.length,
  };
}

/**
 * Inner and outer radius of the rim of a shell-of-revolution item (the end of the profile of its
 * `body` part), metres.
 */
export function rimRadii(typeId: string): { readonly inner: number; readonly outer: number } {
  const body = instantiate(typeId).shape.parts.find((part) => part.id === 'body');
  if (body === undefined || body.prim.kind !== 'sor') {
    throw new Error(`integration: '${typeId}' has no shell-of-revolution body`);
  }
  const rim = body.prim.profile[body.prim.profile.length - 1];
  if (rim === undefined) throw new Error(`integration: '${typeId}' has an empty profile`);
  return { inner: rim.r - rim.t / 2, outer: rim.r + rim.t / 2 };
}
