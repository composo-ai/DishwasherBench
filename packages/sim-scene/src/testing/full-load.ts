/**
 * Test and benchmark support: the owner's machine with a representative full load.
 *
 * The load is about 13 place settings taken from the catalogue: plates in the lower basket,
 * cutlery in the cutlery basket, glasses, mugs and saucers in the upper basket. Items are set
 * on a regular lattice inside the baskets WITHOUT the loading physics: plates stand on edge
 * with the lean of the lower basket's tines, at the pitch of its slots, but nothing is settled
 * against the wires, so an item may cut through a tine or hang a few millimetres above the
 * floor wires. That is good enough to count blocks and to time the build and the tracers on a
 * realistically crowded machine; it is not a physically valid placement.
 *
 * Units: SI. Frame: tub frame.
 */

import {
  quatFromAxisAngle,
  quatFromTo,
  quatMul,
  type Pose,
  type Quat,
  type Vec3,
} from '@spotless/core';
import { boundingBox } from '@spotless/geometry';
import { BOSCH_SMV4HAX40G, buildMachineGeometry, type MachineGeometry } from '@spotless/machine';
import { sceneChamber, sceneMachineParts } from '../machine-boundary.ts';
import type { SceneItem, WashSceneInput } from '../scene-types.ts';
import { catalogueItem, catalogueMaterial, instantiate } from './catalogue.ts';

/** The regions of an item type that its typical soils lie on. */
function typicalSoilRegions(typeId: string): string[] {
  return [...new Set(instantiate(typeId).type.typicalSoils.map((soil) => soil.region))].sort();
}

/** A plate standing on edge: its axis along `normal`, its lowest point `clear` above `floorZ`. */
function onEdge(typeId: string, x: number, y: number, floorZ: number, normal: Vec3): Pose {
  const q = quatFromTo([0, 0, 1], normal);
  const box = boundingBox(instantiate(typeId).shape, { p: [0, 0, 0], q });
  return {
    p: [
      x - 0.5 * (box.min[0] + box.max[0]),
      y - 0.5 * (box.min[1] + box.max[1]),
      floorZ - box.min[2],
    ],
    q,
  };
}

/** An item turned upside down, its lowest point on `floorZ`, its axis at (x, y), turned by `yaw`. */
function inverted(typeId: string, x: number, y: number, floorZ: number, yaw: number): Pose {
  const flip: Quat = [1, 0, 0, 0];
  const q = quatMul(quatFromAxisAngle([0, 0, 1], yaw), flip);
  const box = boundingBox(instantiate(typeId).shape, { p: [0, 0, 0], q });
  return { p: [x, y, floorZ - box.min[2]], q };
}

/** A piece of cutlery standing on end, its long axis up, centred on (x, y) above `floorZ`. */
function onEnd(typeId: string, x: number, y: number, floorZ: number, yaw: number): Pose {
  const shape = instantiate(typeId).shape;
  const flat = boundingBox(shape);
  const size = [0, 1, 2].map((i) => (flat.max[i] as number) - (flat.min[i] as number));
  const long: Vec3 =
    size[0] === Math.max(...size)
      ? [1, 0, 0]
      : size[1] === Math.max(...size)
        ? [0, 1, 0]
        : [0, 0, 1];
  const q = quatMul(quatFromAxisAngle([0, 0, 1], yaw), quatFromTo(long, [0, 0, 1]));
  const box = boundingBox(shape, { p: [0, 0, 0], q });
  return {
    p: [
      x - 0.5 * (box.min[0] + box.max[0]),
      y - 0.5 * (box.min[1] + box.max[1]),
      floorZ - box.min[2],
    ],
    q,
  };
}

/** What {@link fullLoadInput} returns besides the scene input. */
export interface FullLoad {
  readonly input: Omit<WashSceneInput, 'blockSize'>;
  readonly geometry: MachineGeometry;
  /** Item count per catalogue type. */
  readonly itemTypes: Readonly<Record<string, number>>;
}

/**
 * The Bosch SMV4HAX40G in its default configuration with a full load of 114 catalogue items on
 * a lattice (see the file comment), every item carrying soil on the regions of its typical
 * soils.
 */
export function fullLoad(): FullLoad {
  const spec = BOSCH_SMV4HAX40G;
  const geometry = buildMachineGeometry(spec);
  const basket = (id: string): { origin: Vec3 } => {
    const envelope = geometry.affordances.baskets.find((b) => b.basketId === id);
    if (envelope === undefined) throw new Error(`no basket ${id}`);
    return { origin: envelope.originTub };
  };
  const lower = basket('lower').origin;
  const upper = basket('upper').origin;
  const items: SceneItem[] = [];
  const counts: Record<string, number> = {};
  const add = (typeId: string, pose: Pose): void => {
    counts[typeId] = (counts[typeId] ?? 0) + 1;
    const serial = String(counts[typeId]).padStart(2, '0');
    items.push(catalogueItem(`${typeId}_${serial}`, typeId, pose, typicalSoilRegions(typeId)));
  };
  const clear = 0.004;

  // Lower basket, rear band between its two long tine rows: 12 dinner plates and 6 dessert
  // plates on edge, leaning 15 degrees like the tines, one every slot and a half.
  const lean = (sign: number, angle: number): Vec3 => [Math.cos(angle), 0, sign * Math.sin(angle)];
  for (let k = 0; k < 18; k++) {
    const type = k % 3 === 2 ? 'dessert_plate_porcelain_190' : 'dinner_plate_porcelain_270';
    add(
      type,
      onEdge(
        type,
        lower[0] + 0.035 + 0.0273 * k,
        lower[1] + 0.3735,
        lower[2] + clear,
        lean(1, 0.26),
      ),
    );
  }
  // Lower basket, front bands left and right of the cutlery basket: 12 soup plates.
  for (let k = 0; k < 6; k++) {
    add(
      'soup_plate_porcelain_230',
      onEdge(
        'soup_plate_porcelain_230',
        lower[0] + 0.035 + 0.027 * k,
        lower[1] + 0.123,
        lower[2] + clear,
        lean(1, 0.3),
      ),
    );
    add(
      'soup_plate_porcelain_230',
      onEdge(
        'soup_plate_porcelain_230',
        lower[0] + 0.375 + 0.027 * k,
        lower[1] + 0.123,
        lower[2] + clear,
        lean(-1, 0.3),
      ),
    );
  }
  // Cutlery basket: 8 pieces standing in each of its six cells.
  const cutlery = ['dinner_fork_185', 'dinner_knife_210', 'soup_spoon_190', 'teaspoon_130'];
  geometry.affordances.cutleryCells.forEach((cell, c) => {
    const [fx, fy, fz] = cell.floorCentreTub;
    const halfY = 0.5 * (cell.box.max[1] - cell.box.min[1]) - 0.012;
    for (let k = 0; k < 8; k++) {
      const type = cutlery[(c + k) % cutlery.length] as string;
      const x = fx + (k % 2 === 0 ? -0.014 : 0.014);
      const y = fy + (halfY * (Math.floor(k / 2) - 1.5)) / 1.5;
      add(type, onEnd(type, x, y, fz + 0.003, (Math.PI / 4) * k));
    }
  });
  // Upper basket: 12 tumblers upside down on the right, 12 mugs upside down on the left, 12
  // saucers on edge between them.
  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < 2; i++) {
      add(
        'tumbler_250',
        inverted(
          'tumbler_250',
          upper[0] + 0.375 + 0.08 * i,
          upper[1] + 0.045 + 0.075 * j,
          upper[2] + clear,
          0,
        ),
      );
      add(
        'mug_porcelain_240',
        inverted(
          'mug_porcelain_240',
          upper[0] + 0.06 + 0.097 * i,
          upper[1] + 0.045 + 0.078 * j,
          upper[2] + clear,
          Math.PI / 2,
        ),
      );
    }
  }
  for (let j = 0; j < 12; j++) {
    add(
      'saucer_porcelain_140',
      onEdge(
        'saucer_porcelain_140',
        upper[0] + 0.265,
        upper[1] + 0.05 + 0.034 * j,
        upper[2] + clear,
        [0, Math.cos(0.2), Math.sin(0.2)],
      ),
    );
  }
  return {
    input: {
      items,
      machine: sceneMachineParts(geometry),
      materials: catalogueMaterial,
      chamber: sceneChamber(spec),
    },
    geometry,
    itemTypes: counts,
  };
}
