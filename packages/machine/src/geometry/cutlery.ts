/**
 * The free-standing cutlery basket as thin-walled cells.
 *
 * Its lattice is not drawn bar by bar. Walls, dividers and lid grids are thin slabs, and the
 * floor of each foot is a slab as deep as its ribs: all are closed for collision (a handle
 * cannot pass a floor, a tine of a fork cannot poke through a wall) and carry the open fraction
 * of the lattice as `Part.porosity`, which the wash scene reads to let water through. Drawn
 * are: the feet with their floors, the tunnels between them (open below and at both ends, so
 * that tine rails pass through with their tines) with ridged roofs, the long walls, the wall
 * down the middle, the cross walls over the tunnels, the thin dividers that split the middle
 * compartments, the carrying handle (two posts and a bar) and the lid grids.
 *
 * Frame `cutlery_basket`: origin at the front-left corner of the body in the plane of its feet,
 * +x across its width, +y along its long side, +z up; metres.
 *
 * How the basket was read from the owner's photographs (IMG_9080 from the front, IMG_9081 from
 * above; full-resolution pixels):
 * - two columns of compartments either side of a wall down the middle (IMG_9080: the lattice
 *   wall with fins at x = 2850 to 2900, left of the handle post);
 * - along the length four compartments per column: the two thick cross walls stand over the two
 *   tunnels (IMG_9081: at y = 2600 and 3330, each with the rounded top of its arch, on the rail
 *   lines of the side rows) and a thin divider halves the stretch between them (y = 2960 to
 *   2975), so 2 x 4 cells in the 2 x 3 compartments the maker counts;
 * - the handle is one flat arch over the middle wall, 21 mm wide (180 px at 8.55 px/mm at its
 *   height); its posts stand in from the ends of the body (in IMG_9081 the front end of the bar
 *   is 14 mm inside the front rim after correcting for its height; in the owner's loaded
 *   photograph of 2026-10-10 its front top edge is 20 mm behind the front wall), behind the
 *   handle of the lower basket.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { quatFromAxisAngle, QUAT_IDENTITY, quatRotate } from '@spotless/core';
import type { Part, Shape } from '@spotless/geometry';
import type { CutleryBasketPlacement, CutleryBasketSpec } from '../types.ts';
import {
  CUTLERY_CELL_HANDLE_CLEARANCE,
  CUTLERY_FLOOR_TOP,
  CUTLERY_HANDLE_POST_INSET,
  CUTLERY_HANDLE_SECTION,
  CUTLERY_LATTICE_BAR,
  CUTLERY_LID_OPEN_FRACTION,
  CUTLERY_TUNNEL_RIDGE,
  PLASTIC_WALL,
} from './assumptions.ts';
import type { Box } from './prims.ts';
import { slabPart } from './prims.ts';

/**
 * Open fraction of a lattice of rectangular openings `opening` (width, height) separated by
 * bars of width `bar`: opening area over the area of one pitch cell.
 */
export function latticeOpenFraction(opening: readonly [number, number], bar: number): number {
  return (opening[0] * opening[1]) / ((opening[0] + bar) * (opening[1] + bar));
}

/** Open fraction of the lattice walls of a cutlery basket, 0 to 1. */
export function cutleryWallOpenFraction(cutlery: CutleryBasketSpec): number {
  return latticeOpenFraction(cutlery.wallOpening, CUTLERY_LATTICE_BAR);
}

/** Open fraction of the lattice floor of a cutlery basket, 0 to 1. */
export function cutleryFloorOpenFraction(cutlery: CutleryBasketSpec): number {
  return latticeOpenFraction(cutlery.floorSlot, CUTLERY_LATTICE_BAR);
}

/**
 * The stretches of the long side on which the basket stands: one per foot, `[from, to]` along
 * +y between the outer faces of the walls that bound it. A flat-based basket has one.
 */
export function cutleryFeet(cutlery: CutleryBasketSpec): [number, number][] {
  const length = cutlery.size[0];
  const tunnels = cutlery.tunnels;
  if (cutlery.base === 'flat' || tunnels === null) return [[0, length]];
  const half = tunnels.clearWidth / 2;
  const centres = [...tunnels.centresFromMid].map((c) => length / 2 + c).sort((a, b) => a - b);
  const feet: [number, number][] = [];
  let from = 0;
  for (const c of centres) {
    feet.push([from, c - half]);
    from = c + half;
  }
  feet.push([from, length]);
  return feet;
}

/** The band across the width that the carrying handle stands over, or null without a handle. */
export function cutleryHandleBand(cutlery: CutleryBasketSpec): [number, number] | null {
  if (!(cutlery.heightWithHandle > cutlery.size[2])) return null;
  const width = cutlery.size[1];
  const half = CUTLERY_HANDLE_SECTION[0] / 2;
  return [width / 2 - half, width / 2 + half];
}

/** Height of the top of the cell floors above the plane of the feet, metres. */
export function cutleryFloorTop(cutlery: CutleryBasketSpec): number {
  return Math.min(CUTLERY_FLOOR_TOP, cutlery.size[2] / 4);
}

/** One compartment of a cutlery basket in its own frame. */
export interface CutleryCellBox {
  readonly id: string;
  /**
   * The opening of the cell: the part of its inside that is free from its floor to above the
   * carrying handle, as plan extent and height range (floor top to rim). An item let down
   * anywhere in it meets nothing of the basket before it meets the floor.
   */
  readonly box: Box;
  /**
   * The whole inside of the cell between its walls, which reaches under the carrying handle;
   * equal to `box` where no handle stands over the cell.
   */
  readonly interior: Box;
  /** y of a thin removable divider splitting the cell, or null. */
  readonly dividerAt: number | null;
}

/**
 * The stretches of the long side that are one cell each: a foot, or half a foot where a thin
 * divider splits it. With three feet and four `sectionsAlongLength`, each middle foot is split
 * at its middle.
 */
function cellStretches(cutlery: CutleryBasketSpec): [number, number][] {
  const t = PLASTIC_WALL;
  const feet = cutleryFeet(cutlery);
  const split = cutlery.sectionsAlongLength.length > feet.length;
  const stretches: [number, number][] = [];
  feet.forEach(([y0, y1], j) => {
    const middle = feet.length >= 3 && j > 0 && j < feet.length - 1;
    if (split && middle) {
      const mid = (y0 + y1) / 2;
      stretches.push([y0 + t, mid - t / 2], [mid + t / 2, y1 - t]);
    } else {
      stretches.push([y0 + t, y1 - t]);
    }
  });
  return stretches;
}

/** y of the thin dividers that split the middle feet. */
function thinDividers(cutlery: CutleryBasketSpec): number[] {
  const feet = cutleryFeet(cutlery);
  if (!(cutlery.sectionsAlongLength.length > feet.length) || feet.length < 3) return [];
  return feet.slice(1, -1).map(([y0, y1]) => (y0 + y1) / 2);
}

/**
 * The compartments as cells an item is let down into: `cellGrid[0]` across the width by one per
 * stretch along the length (see the file comment), named `c<across><along>` with `along`
 * counted from the front end. Each is listed with its free opening, which leaves out the strip
 * under the carrying handle.
 */
export function cutleryCells(cutlery: CutleryBasketSpec): CutleryCellBox[] {
  const [, width, height] = cutlery.size;
  const t = PLASTIC_WALL;
  const across = Math.max(1, cutlery.cellGrid[0]);
  const band = cutleryHandleBand(cutlery);
  const floor = cutleryFloorTop(cutlery);
  const stretches = cellStretches(cutlery);
  const cells: CutleryCellBox[] = [];
  for (let i = 0; i < across; i++) {
    // Inner faces of the walls either side: an outer wall is `t` thick, a wall between two
    // columns `t` thick about the column boundary.
    const x0 = (width * i) / across + (i === 0 ? t : t / 2);
    const x1 = (width * (i + 1)) / across - (i === across - 1 ? t : t / 2);
    let free0 = x0;
    let free1 = x1;
    if (band !== null) {
      // Keep the opening clear of the handle where the handle stands over one side of the
      // column; a column the handle crosses in its middle keeps its whole inside.
      const lo = band[0] - CUTLERY_CELL_HANDLE_CLEARANCE;
      const hi = band[1] + CUTLERY_CELL_HANDLE_CLEARANCE;
      if (lo > x0 && lo < x1 && hi >= x1) free1 = lo;
      else if (hi > x0 && hi < x1 && lo <= x0) free0 = hi;
    }
    stretches.forEach(([y0, y1], k) => {
      cells.push({
        id: `c${i}${k}`,
        box: { min: [free0, y0, floor], max: [free1, y1, height] },
        interior: { min: [x0, y0, floor], max: [x1, y1, height] },
        dividerAt: null,
      });
    });
  }
  return cells;
}

/**
 * The cutlery basket as a shape in its own frame. `material` is its catalogue material id; the
 * lid grids are drawn hanging outside the long walls unless the specification has them in use.
 */
export function buildCutleryBasket(cutlery: CutleryBasketSpec): Shape {
  const [length, width, height] = cutlery.size;
  const material = cutlery.material;
  const t = PLASTIC_WALL;
  const wallOpen = cutleryWallOpenFraction(cutlery);
  const floorOpen = cutleryFloorOpenFraction(cutlery);
  const parts: Part[] = [];
  const wall = (id: string, min: Vec3, max: Vec3, porosity = wallOpen): void => {
    parts.push(slabPart(id, min, max, material, 0.0005, porosity));
  };

  const feet = cutleryFeet(cutlery);
  const tunnelTop = cutlery.tunnels === null ? 0 : Math.min(cutlery.tunnels.height, height - t);
  const across = Math.max(1, cutlery.cellGrid[0]);
  const floorTop = cutleryFloorTop(cutlery);

  feet.forEach(([y0, y1], j) => {
    // Floor of the foot: its ribs as one slab from the plane of the feet to the floor's top.
    parts.push(
      slabPart(`foot.${j}.floor`, [0, y0, 0], [width, y1, floorTop], material, 0.001, floorOpen),
    );
    // The two long outer walls and the walls between the columns over it.
    wall(`foot.${j}.left`, [0, y0, 0], [t, y1, height]);
    wall(`foot.${j}.right`, [width - t, y0, 0], [width, y1, height]);
    for (let i = 1; i < across; i++) {
      const x = (width * i) / across;
      wall(`foot.${j}.mid.${i}`, [x - t / 2, y0, 0], [x + t / 2, y1, height]);
    }
    // Its two end walls: the outer end wall of the basket, or the wall of a tunnel.
    wall(`foot.${j}.front`, [0, y0, 0], [width, y0 + t, j === 0 ? height : tunnelTop]);
    wall(`foot.${j}.rear`, [0, y1 - t, 0], [width, y1, j === feet.length - 1 ? height : tunnelTop]);
  });

  // Over each tunnel: its roof, the long walls and the walls between the columns above it, and
  // one cross wall up to the rim.
  for (let j = 0; j + 1 < feet.length; j++) {
    const y0 = (feet[j] as [number, number])[1];
    const y1 = (feet[j + 1] as [number, number])[0];
    const mid = (y0 + y1) / 2;
    // The roof is ridged, like the arch it stands for: flat below at the tunnel's height, and
    // above it falling from a ridge under the cross wall to both sides, so that the end of a
    // handle let down on it slides into a cell and does not stand on a ledge.
    const r = 0.0005;
    const ridge = Math.min(CUTLERY_TUNNEL_RIDGE, height - tunnelTop - t);
    const roof: Vec3[] = [];
    for (const x of [r, width - r]) {
      roof.push(
        [x, y0 - t + r, tunnelTop + r],
        [x, y1 + t - r, tunnelTop + r],
        [x, mid, tunnelTop + ridge - r],
      );
    }
    parts.push({
      id: `tunnel.${j}.roof`,
      prim: { kind: 'hull', points: roof, radius: r },
      pose: { p: [0, 0, 0], q: QUAT_IDENTITY },
      material,
    });
    wall(`tunnel.${j}.left`, [0, y0 - t, tunnelTop], [t, y1 + t, height]);
    wall(`tunnel.${j}.right`, [width - t, y0 - t, tunnelTop], [width, y1 + t, height]);
    wall(`tunnel.${j}.cross`, [0, mid - t / 2, tunnelTop], [width, mid + t / 2, height]);
    for (let i = 1; i < across; i++) {
      const x = (width * i) / across;
      wall(`tunnel.${j}.mid.${i}`, [x - t / 2, y0 - t, tunnelTop], [x + t / 2, y1 + t, height]);
    }
  }

  // Thin removable dividers, across the whole width.
  thinDividers(cutlery).forEach((y, k) => {
    wall(`divider.${k}`, [t, y - t / 2, floorTop], [width - t, y + t / 2, height]);
  });

  // Carrying handle: a post standing in from each end over the middle wall, and a bar along
  // the top between them.
  const band = cutleryHandleBand(cutlery);
  if (band !== null) {
    const ht = CUTLERY_HANDLE_SECTION[1];
    const [x0, x1] = band;
    const top = cutlery.heightWithHandle;
    const inset = Math.min(CUTLERY_HANDLE_POST_INSET, length / 4);
    wall('handle.front', [x0, inset, height - t], [x1, inset + ht, top], 0);
    wall('handle.rear', [x0, length - inset - ht, height - t], [x1, length - inset, top], 0);
    wall('handle.bar', [x0, inset, top - ht], [x1, length - inset, top], 0);
  }

  // Lid grids.
  const lid = cutlery.lid;
  if (lid !== null) {
    const lidT = 0.003;
    const half = width / 2;
    if (lid.inUse) {
      wall('lid.left', [0, 0, height], [half, length, height + lidT], CUTLERY_LID_OPEN_FRACTION);
      wall(
        'lid.right',
        [half, 0, height],
        [width, length, height + lidT],
        CUTLERY_LID_OPEN_FRACTION,
      );
    } else {
      // Folded out: each hangs down outside its long wall, at the width over the lids, from
      // the edge of the rim it is hinged on. The rim is drawn as a strip from the wall to the
      // lid, so that nothing let down beside the wall goes down between wall and lid (in
      // IMG_9081 the top of each long wall is a frame 5 to 10 mm wide; the review's ladle went
      // down that gap to the wires of the lower basket).
      const out = Math.max(lidT, (cutlery.widthOverLids - width) / 2);
      const drop = Math.min(half, height - t);
      if (out > lidT) {
        wall('lid.left.hinge', [-out, 0, height - lidT], [0, length, height], 0);
        wall('lid.right.hinge', [width, 0, height - lidT], [width + out, length, height], 0);
      }
      wall(
        'lid.left',
        [-out, 0, height - drop],
        [-out + lidT, length, height],
        CUTLERY_LID_OPEN_FRACTION,
      );
      wall(
        'lid.right',
        [width + out - lidT, 0, height - drop],
        [width + out, length, height],
        CUTLERY_LID_OPEN_FRACTION,
      );
    }
  }

  return {
    parts,
    regions: [
      { id: 'floor', part: 'foot.0.floor' },
      ...feet.slice(1).map((_, j) => ({ id: 'floor', part: `foot.${j + 1}.floor` })),
      ...(parts.some((p) => p.id.startsWith('handle.'))
        ? [{ id: 'handle', part: 'handle.*' }]
        : []),
      ...(parts.some((p) => p.id.startsWith('lid.')) ? [{ id: 'lid', part: 'lid.*' }] : []),
      { id: 'walls', part: 'foot.*' },
      ...(feet.length > 1 ? [{ id: 'walls', part: 'tunnel.*' }] : []),
      ...(parts.some((p) => p.id.startsWith('divider.'))
        ? [{ id: 'walls', part: 'divider.*' }]
        : []),
    ],
  };
}

/**
 * Pose of the `cutlery_basket` frame in the rack frame of the basket it stands in: the centre of
 * its body at `placement.centre`, its feet on the top of the base grid, its long side along the
 * placement's axis.
 */
export function cutleryBasketPoseInRack(
  cutlery: CutleryBasketSpec,
  placement: CutleryBasketPlacement,
): Pose {
  const [length, width] = cutlery.size;
  const q = placement.longAxis === 'y' ? QUAT_IDENTITY : quatFromAxisAngle([0, 0, 1], -Math.PI / 2);
  const centre = quatRotate(q, [width / 2, length / 2, 0]);
  return {
    p: [placement.centre[0] - centre[0], placement.centre[1] - centre[1], 0],
    q,
  };
}
