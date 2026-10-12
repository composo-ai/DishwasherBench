/**
 * A stand-in rack for the integration tests: a wire base grid, a rim frame, two rails of plate
 * tines and a cutlery basket of thin walls, built from the geometry kernel's primitives.
 *
 * It stands in for the machine geometry that `@spotless/machine` will generate from the dossier
 * on the owner's dishwasher. EVERY DIMENSION IS IN ONE PLACE, {@link STAND_IN_RACK}: to run the
 * same scenarios on real machine geometry, replace that record (or the shapes built from it) and
 * nothing else. The scenarios compute what they expect (slot widths, grid openings, cell sizes)
 * from the record, never from numbers of their own.
 *
 * Provenance: the layout follows the SPOT-60 baseline lower rack of docs/research/machine.md
 * section 2.4.2, whose values are all [ESTIMATED] there; where the stand-in departs from it the
 * field says so. Nothing here is measured on a real rack.
 *
 * Frame (docs/design/platform.md section 2): the rack frame. Origin at the rack's front-left
 * corner at the top surface of the base grid, +x to the right, +y to the back, +z up. Authoring
 * units are millimetres (`...Mm` fields); every shape and every derived length is SI.
 */

import type { Vec3 } from '@spotless/core';
import { mmToM } from '@spotless/core';
import type { Aabb, Part, Shape } from '@spotless/geometry';

/** Catalogue material of the rack wires (nylon-coated steel). */
export const RACK_MATERIAL = 'rack_wire_pa11';
/** Catalogue material of the cutlery basket. */
export const BASKET_MATERIAL = 'polypropylene';
/** Catalogue material of the tub floor under the rack. */
export const TUB_FLOOR_MATERIAL = 'stainless_steel';

/** Height above the base grid up to which an item counts as loaded on the rack, metres. */
export const ENVELOPE_HEIGHT = 0.5;

/** Dimensions of the cutlery basket of a stand-in rack, millimetres. */
export interface StandInBasketDimensions {
  /** Front-left corner of the basket's footprint in the rack frame, (x, y). */
  readonly cornerMm: readonly [number, number];
  /** Number of cells along x and along y. */
  readonly cells: readonly [number, number];
  /** Clear inner size of one cell along x and along y. */
  readonly cellMm: readonly [number, number];
  /** Thickness of the outer walls and of the dividers. */
  readonly wallMm: number;
  /** Thickness of the floor, which lies on the base grid. */
  readonly floorMm: number;
  /** Height of the walls above the top of the floor. */
  readonly depthMm: number;
}

/** Every dimension of a stand-in rack, millimetres. */
export interface StandInRackDimensions {
  /** Outer width (along x) over the frame wires. */
  readonly widthMm: number;
  /** Outer depth (along y) over the frame wires. */
  readonly depthMm: number;
  /** Height of the centre of the rim wire above the top of the base grid. */
  readonly rimHeightMm: number;
  /** Finished diameter of the frame wires (perimeter, rim and posts). */
  readonly frameWireMm: number;
  /** Finished diameter of the base-grid wires. */
  readonly gridWireMm: number;
  /** Finished diameter of the tines. */
  readonly tineWireMm: number;
  /**
   * Upper layer of the base grid: wires running front to back (along y), their tops at z = 0.
   * x of the first wire, pitch and number of wires.
   */
  readonly gridAlongY: {
    readonly firstMm: number;
    readonly pitchMm: number;
    readonly count: number;
  };
  /**
   * Lower layer of the base grid: wires running left to right (along x), welded under the upper
   * layer. y of the first wire, pitch and number of wires.
   */
  readonly gridAlongX: {
    readonly firstMm: number;
    readonly pitchMm: number;
    readonly count: number;
  };
  /** One frame post every this many grid wires along each side (the corners always have one). */
  readonly postEvery: number;
  /**
   * Plate tines: upright tines standing on two of the front-to-back grid wires (the rails). A
   * plate stands on its edge across the rails, in the slot between two consecutive tines of
   * each rail.
   */
  readonly tines: {
    /** Indices (into the front-to-back grid wires) of the two rails. */
    readonly railWires: readonly [number, number];
    /** y of the first tine, pitch along the rail and number of tines per rail. */
    readonly firstMm: number;
    readonly pitchMm: number;
    readonly count: number;
    /** Height of the tine tips above the top of the base grid. */
    readonly heightMm: number;
  };
  readonly basket: StandInBasketDimensions;
  /** Distance from the top of the base grid down to the tub floor under the rack. */
  readonly tubFloorBelowGridMm: number;
}

/**
 * THE dimensions of the stand-in rack. Replace this record to change the rack every scenario
 * runs on.
 *
 * Source of each value (docs/research/machine.md section 2.4.2, SPOT-60 lower rack, every value
 * [ESTIMATED] there unless marked):
 * - 525 x 495 mm outer size; 5.0 mm frame wire and 3.4 mm grid and tine wire with a 0.4 mm nylon
 *   coating, so 5.8 and 4.2 mm finished;
 * - base grid: front-to-back wires at 35 mm pitch over left-to-right wires at 100 mm pitch (an
 *   opening of about 31 x 96 mm);
 * - tines 62 mm tall with hemispherical tips, on front-to-back rails;
 * - tub floor 50 mm below the grid.
 * Departures of the stand-in, all [ESTIMATED] choices of this package:
 * - the tines stand upright (the baseline leans them 8 degrees) and are 35 mm apart along the
 *   rail (the baseline says 25 mm, range 18 to 35): between upright tines on rails 105 mm apart
 *   an IEC dinner plate needs 22 mm of clear slot and a 30 mm deep plate 28 mm (worked out in
 *   `slotFit` of rack-geometry.ts), and 35 mm gives 30.8 mm;
 * - one bank of two rails with 13 tines (12 slots) instead of 8 short rows;
 * - the rim is 120 mm above the grid;
 * - the cutlery basket is 2 x 4 cells of 60 x 57.5 mm with solid 2 mm walls, 120 mm deep, on a
 *   footprint of 126 x 240 mm (the baseline: 240 x 135 mm, 7 cells, a lattice).
 */
export const STAND_IN_RACK: StandInRackDimensions = {
  widthMm: 525,
  depthMm: 495,
  rimHeightMm: 120,
  frameWireMm: 5.8,
  gridWireMm: 4.2,
  tineWireMm: 4.2,
  gridAlongY: { firstMm: 17.5, pitchMm: 35, count: 15 },
  gridAlongX: { firstMm: 47.5, pitchMm: 100, count: 5 },
  postEvery: 3,
  tines: { railWires: [3, 6], firstMm: 37.5, pitchMm: 35, count: 13, heightMm: 62 },
  basket: {
    cornerMm: [385, 12],
    cells: [2, 4],
    cellMm: [60, 57.5],
    wallMm: 2,
    floorMm: 2,
    depthMm: 120,
  },
  tubFloorBelowGridMm: 50,
};

/** A slot for a plate: the gap between two consecutive tines of each of the two rails. */
export interface PlateSlot {
  /** Index of the slot, from the front. */
  readonly index: number;
  /** x of the two rails, metres. */
  readonly railX: readonly [number, number];
  /** x midway between the rails, where a plate is centred, metres. */
  readonly centreX: number;
  /** y of the tines in front of and behind the slot (their axes), metres. */
  readonly frontY: number;
  readonly backY: number;
  /** Clear width of the slot between the tine surfaces, metres. */
  readonly clearWidth: number;
  /** Height of the tine tips above the base grid, metres. */
  readonly tineHeight: number;
}

/** One cell of the cutlery basket, as the clear space inside its walls. */
export interface BasketCell {
  /** Index of the cell along x and along y. */
  readonly index: readonly [number, number];
  /** Clear space of the cell from the top of the floor to the rim of the walls, metres. */
  readonly inner: Aabb;
  /** Centre of the cell in x and y, metres. */
  readonly centre: readonly [number, number];
}

/** The clear opening of the base grid between its wires, metres. */
export interface GridOpening {
  /** Clear gap between neighbouring front-to-back wires (measured along x). */
  readonly alongX: number;
  /** Clear gap between neighbouring left-to-right wires (measured along y). */
  readonly alongY: number;
  /** How far the tops of the left-to-right wires lie below the tops of the front-to-back wires. */
  readonly lowerLayerDrop: number;
}

/** A stand-in rack built from a set of dimensions: its shapes and where things go on it. */
export interface StandInRack {
  readonly dims: StandInRackDimensions;
  /** Base grid, frame and tines, in the rack frame. */
  readonly rack: Shape;
  /** The cutlery basket standing on the base grid, in the rack frame. */
  readonly basket: Shape;
  /** The tub floor under the rack, in the rack frame. */
  readonly tubFloor: Shape;
  /** The plate slots, from the front. */
  readonly slots: readonly PlateSlot[];
  /** The basket cells, row by row (y outer, x inner). */
  readonly cells: readonly BasketCell[];
  /** x of every front-to-back grid wire and y of every left-to-right one, metres. */
  readonly wiresAlongY: readonly number[];
  readonly wiresAlongX: readonly number[];
  readonly opening: GridOpening;
  /**
   * Where the reference point of an item loaded on the rack can be, metres: inside the frame in
   * plan, from the underside of the base grid up to {@link ENVELOPE_HEIGHT} above its top (items
   * stand taller than the rim). An item whose reference point is outside has left the rack.
   */
  readonly envelope: Aabb;
  /**
   * The open part of the base grid in plan, with neither tines nor basket over it: (x, y) of its
   * front-left and back-right corners, metres. It lies to the right of the plates (two and a
   * half grid pitches beyond the right-hand rail, where a plate centred between the rails ends),
   * behind the basket and inside the frame.
   */
  readonly openZone: {
    readonly min: readonly [number, number];
    readonly max: readonly [number, number];
  };
  /**
   * A point of the open zone to stand a single item on, (x, y) in metres: half-way along the
   * zone front to back and, of the gaps between two front-to-back wires, in the middle of the
   * one nearest to its centre line, so that a round base there rests on wires either side.
   */
  readonly openPoint: readonly [number, number];
  /** Height of the tub floor's top surface in the rack frame (negative), metres. */
  readonly tubFloorZ: number;
}

const IDENTITY = { p: [0, 0, 0] as Vec3, q: [0, 0, 0, 1] as const };

function index2(i: number): string {
  return i < 10 ? `0${i}` : `${i}`;
}

function positions(spec: { firstMm: number; pitchMm: number; count: number }): number[] {
  const out: number[] = [];
  for (let i = 0; i < spec.count; i++) out.push(spec.firstMm + i * spec.pitchMm);
  return out;
}

function requirePositive(value: number, what: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new RangeError(`integration: ${what} must be a finite number above zero, got ${value}`);
  }
}

function checkDimensions(d: StandInRackDimensions): void {
  for (const [value, what] of [
    [d.widthMm, 'rack width'],
    [d.depthMm, 'rack depth'],
    [d.rimHeightMm, 'rim height'],
    [d.frameWireMm, 'frame wire diameter'],
    [d.gridWireMm, 'grid wire diameter'],
    [d.tineWireMm, 'tine wire diameter'],
    [d.gridAlongY.pitchMm, 'grid pitch along x'],
    [d.gridAlongX.pitchMm, 'grid pitch along y'],
    [d.tines.pitchMm, 'tine pitch'],
    [d.tines.heightMm, 'tine height'],
    [d.basket.wallMm, 'basket wall'],
    [d.basket.floorMm, 'basket floor'],
    [d.basket.depthMm, 'basket depth'],
    [d.basket.cellMm[0], 'basket cell size along x'],
    [d.basket.cellMm[1], 'basket cell size along y'],
    [d.tubFloorBelowGridMm, 'tub floor distance'],
  ] as const) {
    requirePositive(value, what);
  }
  const count = (n: number, what: string, least: number): void => {
    if (!Number.isInteger(n) || n < least) {
      throw new RangeError(`integration: ${what} must be a whole number of at least ${least}`);
    }
  };
  count(d.gridAlongY.count, 'the number of front-to-back grid wires', 2);
  count(d.gridAlongX.count, 'the number of left-to-right grid wires', 2);
  count(d.tines.count, 'the number of tines per rail', 2);
  count(d.postEvery, 'the post spacing', 1);
  count(d.basket.cells[0], 'the number of basket cells along x', 1);
  count(d.basket.cells[1], 'the number of basket cells along y', 1);
  const [a, b] = d.tines.railWires;
  for (const rail of [a, b]) {
    if (!Number.isInteger(rail) || rail < 0 || rail >= d.gridAlongY.count) {
      throw new RangeError(`integration: tine rail ${rail} is not a front-to-back grid wire`);
    }
  }
  if (!(a < b)) throw new RangeError('integration: the two tine rails must be given left first');
  const lastX = d.gridAlongY.firstMm + (d.gridAlongY.count - 1) * d.gridAlongY.pitchMm;
  const lastY = d.gridAlongX.firstMm + (d.gridAlongX.count - 1) * d.gridAlongX.pitchMm;
  const lastTine = d.tines.firstMm + (d.tines.count - 1) * d.tines.pitchMm;
  if (d.gridAlongY.firstMm <= d.frameWireMm || lastX >= d.widthMm - d.frameWireMm) {
    throw new RangeError('integration: the front-to-back grid wires do not fit inside the frame');
  }
  if (d.gridAlongX.firstMm <= d.frameWireMm || lastY >= d.depthMm - d.frameWireMm) {
    throw new RangeError('integration: the left-to-right grid wires do not fit inside the frame');
  }
  if (d.tines.firstMm <= d.frameWireMm || lastTine >= d.depthMm - d.frameWireMm) {
    throw new RangeError('integration: the tines do not fit inside the frame');
  }
  if (!(d.tines.pitchMm > d.tineWireMm) || !(d.gridAlongY.pitchMm > d.gridWireMm)) {
    throw new RangeError('integration: wires closer together than they are thick');
  }
}

function capsule(id: string, a: Vec3, b: Vec3, radius: number): Part {
  return { id, prim: { kind: 'capsule', a, b, radius }, pose: IDENTITY, material: RACK_MATERIAL };
}

/**
 * The wires of the rack as one `Shape` of capsules (rack frame, metres). Part ids, which is what
 * contacts are attributed to:
 * - `grid_y.NN`: the front-to-back wires of the upper layer, tops at z = 0;
 * - `grid_x.NN`: the left-to-right wires of the lower layer, one wire diameter lower;
 * - `frame.base.*`, `frame.rim.*`, `frame.post.*`: the perimeter at grid level, the rim and the
 *   posts between them;
 * - `tine.<rail>.<NN>`: the tines of rail `a` (left) and `b` (right), from the front; a tine is
 *   one capsule from the axis of its rail wire to its tip, which is a hemisphere.
 * One region, `wire`, covers everything.
 */
function buildRackShape(d: StandInRackDimensions): Shape {
  const parts: Part[] = [];
  const rFrame = mmToM(d.frameWireMm) / 2;
  const rGrid = mmToM(d.gridWireMm) / 2;
  const rTine = mmToM(d.tineWireMm) / 2;
  // Axes of the frame wires: half a wire inside the outer size.
  const x0 = rFrame;
  const x1 = mmToM(d.widthMm) - rFrame;
  const y0 = rFrame;
  const y1 = mmToM(d.depthMm) - rFrame;
  const upperZ = -rGrid;
  const lowerZ = -3 * rGrid;
  const baseZ = -rFrame;
  const rimZ = mmToM(d.rimHeightMm);

  const xs = positions(d.gridAlongY).map(mmToM);
  const ys = positions(d.gridAlongX).map(mmToM);
  xs.forEach((x, i) => {
    parts.push(capsule(`grid_y.${index2(i)}`, [x, y0, upperZ], [x, y1, upperZ], rGrid));
  });
  ys.forEach((y, j) => {
    parts.push(capsule(`grid_x.${index2(j)}`, [x0, y, lowerZ], [x1, y, lowerZ], rGrid));
  });

  // Perimeter at grid level (top flush with the grid) and the rim above it.
  for (const [name, z] of [
    ['base', baseZ],
    ['rim', rimZ],
  ] as const) {
    parts.push(capsule(`frame.${name}.front`, [x0, y0, z], [x1, y0, z], rFrame));
    parts.push(capsule(`frame.${name}.back`, [x0, y1, z], [x1, y1, z], rFrame));
    parts.push(capsule(`frame.${name}.left`, [x0, y0, z], [x0, y1, z], rFrame));
    parts.push(capsule(`frame.${name}.right`, [x1, y0, z], [x1, y1, z], rFrame));
  }
  // Posts: the four corners, then one every `postEvery` grid wires along each side.
  const post = (id: string, x: number, y: number): void => {
    parts.push(capsule(`frame.post.${id}`, [x, y, baseZ], [x, y, rimZ], rFrame));
  };
  post('corner.fl', x0, y0);
  post('corner.fr', x1, y0);
  post('corner.bl', x0, y1);
  post('corner.br', x1, y1);
  xs.forEach((x, i) => {
    if (i % d.postEvery !== Math.floor(d.postEvery / 2)) return;
    post(`front.${index2(i)}`, x, y0);
    post(`back.${index2(i)}`, x, y1);
  });
  ys.forEach((y, j) => {
    post(`left.${index2(j)}`, x0, y);
    post(`right.${index2(j)}`, x1, y);
  });

  // Tines: from the axis of the rail wire up to the tip.
  const tipZ = mmToM(d.tines.heightMm) - rTine;
  const tineYs = positions(d.tines).map(mmToM);
  d.tines.railWires.forEach((wire, r) => {
    const x = xs[wire] as number;
    const rail = r === 0 ? 'a' : 'b';
    tineYs.forEach((y, k) => {
      parts.push(capsule(`tine.${rail}.${index2(k)}`, [x, y, upperZ], [x, y, tipZ], rTine));
    });
  });
  return { parts, regions: [{ id: 'wire', part: '*' }] };
}

/**
 * The cutlery basket as one `Shape` of sharp-edged plates (rack frame, metres): a floor lying on
 * the base grid, walls and dividers along y (`wall_y.N`) and along x (`wall_x.N`). Regions:
 * `floor` and `walls`.
 */
function buildBasketShape(d: StandInRackDimensions): Shape {
  const b = d.basket;
  const wall = mmToM(b.wallMm);
  const floor = mmToM(b.floorMm);
  const depth = mmToM(b.depthMm);
  const [nx, ny] = b.cells;
  const cellX = mmToM(b.cellMm[0]);
  const cellY = mmToM(b.cellMm[1]);
  const sizeX = nx * cellX + (nx + 1) * wall;
  const sizeY = ny * cellY + (ny + 1) * wall;
  const cornerX = mmToM(b.cornerMm[0]);
  const cornerY = mmToM(b.cornerMm[1]);
  const parts: Part[] = [];
  const plate = (id: string, centre: Vec3, half: Vec3): void => {
    parts.push({
      id,
      prim: { kind: 'rbox', halfExtents: half, radius: 0 },
      pose: { p: centre, q: [0, 0, 0, 1] },
      material: BASKET_MATERIAL,
    });
  };
  plate(
    'floor',
    [cornerX + sizeX / 2, cornerY + sizeY / 2, floor / 2],
    [sizeX / 2, sizeY / 2, floor / 2],
  );
  const wallZ = floor + depth / 2;
  for (let i = 0; i <= nx; i++) {
    const x = cornerX + wall / 2 + i * (cellX + wall);
    plate(`wall_y.${i}`, [x, cornerY + sizeY / 2, wallZ], [wall / 2, sizeY / 2, depth / 2]);
  }
  for (let j = 0; j <= ny; j++) {
    const y = cornerY + wall / 2 + j * (cellY + wall);
    plate(`wall_x.${j}`, [cornerX + sizeX / 2, y, wallZ], [sizeX / 2, wall / 2, depth / 2]);
  }
  return {
    parts,
    regions: [
      { id: 'floor', part: 'floor' },
      { id: 'walls', part: 'wall*' },
    ],
  };
}

/** The tub floor: a 10 mm slab under the rack, reaching 100 mm beyond it on every side. */
function buildTubFloorShape(d: StandInRackDimensions): Shape {
  const margin = 0.1;
  const thickness = 0.01;
  const top = -mmToM(d.tubFloorBelowGridMm);
  const width = mmToM(d.widthMm);
  const depth = mmToM(d.depthMm);
  return {
    parts: [
      {
        id: 'floor',
        prim: {
          kind: 'rbox',
          halfExtents: [width / 2 + margin, depth / 2 + margin, thickness / 2],
          radius: 0,
        },
        pose: { p: [width / 2, depth / 2, top - thickness / 2], q: [0, 0, 0, 1] },
        material: TUB_FLOOR_MATERIAL,
      },
    ],
    regions: [{ id: 'floor', part: 'floor' }],
  };
}

/**
 * Builds the stand-in rack from a set of dimensions (by default {@link STAND_IN_RACK}): the
 * shapes of the rack, the basket and the tub floor in the rack frame, and where plates and
 * cutlery go. Throws a RangeError for dimensions that do not make a rack.
 */
export function buildStandInRack(dims: StandInRackDimensions = STAND_IN_RACK): StandInRack {
  checkDimensions(dims);
  const xs = positions(dims.gridAlongY).map(mmToM);
  const ys = positions(dims.gridAlongX).map(mmToM);
  const tineYs = positions(dims.tines).map(mmToM);
  const railX: readonly [number, number] = [
    xs[dims.tines.railWires[0]] as number,
    xs[dims.tines.railWires[1]] as number,
  ];
  const slots: PlateSlot[] = [];
  for (let k = 0; k + 1 < tineYs.length; k++) {
    slots.push({
      index: k,
      railX,
      centreX: (railX[0] + railX[1]) / 2,
      frontY: tineYs[k] as number,
      backY: tineYs[k + 1] as number,
      clearWidth: mmToM(dims.tines.pitchMm - dims.tineWireMm),
      tineHeight: mmToM(dims.tines.heightMm),
    });
  }

  const b = dims.basket;
  const wall = mmToM(b.wallMm);
  const cellX = mmToM(b.cellMm[0]);
  const cellY = mmToM(b.cellMm[1]);
  const cells: BasketCell[] = [];
  for (let j = 0; j < b.cells[1]; j++) {
    for (let i = 0; i < b.cells[0]; i++) {
      const minX = mmToM(b.cornerMm[0]) + wall + i * (cellX + wall);
      const minY = mmToM(b.cornerMm[1]) + wall + j * (cellY + wall);
      cells.push({
        index: [i, j],
        inner: {
          min: [minX, minY, mmToM(b.floorMm)],
          max: [minX + cellX, minY + cellY, mmToM(b.floorMm + b.depthMm)],
        },
        centre: [minX + cellX / 2, minY + cellY / 2],
      });
    }
  }

  const frame = mmToM(dims.frameWireMm);
  // The open zone: right of the plates, behind the basket where the basket is in the way.
  const pitchX = mmToM(dims.gridAlongY.pitchMm);
  const openLeft = railX[1] + 2.5 * pitchX;
  const openRight = mmToM(dims.widthMm) - frame;
  const basketBack = mmToM(b.cornerMm[1]) + b.cells[1] * cellY + (b.cells[1] + 1) * wall;
  const basketRight = mmToM(b.cornerMm[0]) + b.cells[0] * cellX + (b.cells[0] + 1) * wall;
  const basketInZone = basketRight > openLeft && mmToM(b.cornerMm[0]) < openRight;
  const openFront = basketInZone ? basketBack : frame;
  const openBack = mmToM(dims.depthMm) - frame;
  if (!(openRight - openLeft > pitchX) || !(openBack - openFront > pitchX)) {
    throw new RangeError('integration: the rack leaves no open part of the grid beside the plates');
  }
  // The gap between two front-to-back wires whose middle is nearest to the middle of the zone.
  let openX = (openLeft + openRight) / 2;
  let nearest = Infinity;
  for (let i = 0; i + 1 < xs.length; i++) {
    const middle = ((xs[i] as number) + (xs[i + 1] as number)) / 2;
    const off = Math.abs(middle - (openLeft + openRight) / 2);
    if (middle > openLeft && middle < openRight && off < nearest) {
      nearest = off;
      openX = middle;
    }
  }
  return {
    dims,
    rack: buildRackShape(dims),
    basket: buildBasketShape(dims),
    tubFloor: buildTubFloorShape(dims),
    slots,
    cells,
    wiresAlongY: xs,
    wiresAlongX: ys,
    opening: {
      alongX: mmToM(dims.gridAlongY.pitchMm - dims.gridWireMm),
      alongY: mmToM(dims.gridAlongX.pitchMm - dims.gridWireMm),
      lowerLayerDrop: mmToM(dims.gridWireMm),
    },
    envelope: {
      min: [frame, frame, -mmToM(2 * dims.gridWireMm)],
      max: [mmToM(dims.widthMm) - frame, mmToM(dims.depthMm) - frame, ENVELOPE_HEIGHT],
    },
    openZone: { min: [openLeft, openFront], max: [openRight, openBack] },
    openPoint: [openX, (openFront + openBack) / 2],
    tubFloorZ: -mmToM(dims.tubFloorBelowGridMm),
  };
}
