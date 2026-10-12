/**
 * Affordances for the loading layer (docs/design/platform.md section 4.4): what the machine
 * offers an item besides its solid shapes. Everything here is computed from the specification
 * and the configuration with the same functions that build the shapes, so the two agree.
 *
 * Rack-frame values are in the frame of the basket they belong to; tub-frame values assume the
 * basket pushed in. Metres and radians.
 */

import type { Vec3 } from '@spotless/core';
import { poseCompose, poseInverseTransformPoint, poseTransformPoint, v3Add } from '@spotless/core';
import {
  basketHeightPosition,
  basketOrigin,
  cutleryBasketPositionId,
  getBasket,
  isTineRowFolded,
  shelfState,
  sprayLevelDatumZ,
} from '../config.ts';
import { cutleryBasketFootprint } from '../cutlery-placement.ts';
import { tabletDrop } from '../dispenser.ts';
import { basketRimInset } from '../outline.ts';
import type { ProvenanceTag } from '../provenance.ts';
import { provenanceTagOf } from '../provenance.ts';
import type {
  BasketSpec,
  HorizontalDirection,
  MachineConfig,
  MachineSpec,
  SprayArmSpec,
  TineRowSpec,
} from '../types.ts';
import { armFrameZ, buildSprayArm } from './arm.ts';
import {
  cupShelfBoxDown,
  cupShelfBoxUp,
  handleBox,
  holderBoxDown,
  holderBoxUp,
  holderFloorZ,
} from './basket.ts';
import { cutleryBasketPoseInRack, cutleryCells } from './cutlery.ts';
import { rimZ } from './rim.ts';
import { leansAlongRail, railDirection, railPoint, tineLine } from './tines.ts';
import { dispenserLidBox } from './tub.ts';
import type {
  ArmSweptVolume,
  BasketEnvelope,
  CupShelfZone,
  CutleryBasketAffordance,
  CutleryCell,
  FrameBox,
  HolderZone,
  LidSweptVolume,
  MachineAffordances,
  OverheadObstacle,
  SideRestZone,
  TabletPath,
  TineRowAffordance,
  TineSlot,
} from './types.ts';

/** A disc smaller than this in radius counts as a hub, not as something over the whole basket, metres. */
const SMALL_DISC = 0.1;
/** Two parallel rails further apart than this do not hold a plate together, metres. */
const PARTNER_RANGE = 0.2;
/** A slot this close to the side of the cutlery basket has no room for a plate, metres. */
const SLOT_COVER_MARGIN = 0.005;
/**
 * How far a plate standing in a slot reaches across its rail at the least, metres: a slot whose
 * rail passes the end of the cutlery basket closer than this is covered by it too.
 */
const SLOT_COVER_REACH = 0.05;
/**
 * A straight run of the floor's relief is a rest for cups when it falls towards a side wall at
 * an angle in this range, radians, over at least {@link SIDE_REST_RUN}. Below 20 degrees a
 * vessel simply stands on the floor and leans with it (the 14 degree ramp of the Bosch's upper
 * basket); above 50 it is a step, not a rest. [ESTIMATED: the two rests of the Bosch are 33
 * and 35 degrees over 47 and 55 mm]
 */
export const SIDE_REST_SLOPE: readonly [number, number] = [
  (20 * Math.PI) / 180,
  (50 * Math.PI) / 180,
];
/** Shortest run across the basket of a slope that counts as a rest, metres. */
export const SIDE_REST_RUN = 0.03;
/** Clearance kept between the opening of a cutlery cell and a basket handle over it, metres. */
const CELL_HANDLE_CLEARANCE = 0.002;

/** Unit normal of the plane a plate stands in at a slot: the rail direction turned by the lean. */
function plateNormal(row: TineRowSpec, lean: number, toward: HorizontalDirection): Vec3 {
  const rail = railDirection(row);
  if (lean === 0) return rail;
  // The plate's upward in-plane direction is the tine direction u = sin(l) d + cos(l) z, with d
  // along the rail (+ or -); the normal is the rail direction turned the same way.
  const sign = toward.startsWith('-') ? -1 : 1;
  return [rail[0] * Math.cos(lean), rail[1] * Math.cos(lean), -sign * Math.sin(lean)];
}

/** The tine rows of one basket in a configuration. */
export function tineRowAffordances(
  spec: MachineSpec,
  basket: BasketSpec,
  config: MachineConfig,
): TineRowAffordance[] {
  const origin = basketOrigin(spec, basket.id, config);
  // What the cutlery basket covers of this basket, lid grids included.
  const cutlery =
    spec.cutleryBasket !== null &&
    config.cutleryBasket !== null &&
    config.cutleryBasket.basketId === basket.id
      ? cutleryBasketFootprint(spec.cutleryBasket, config.cutleryBasket)
      : null;
  const underCutleryBasket = (row: TineRowSpec, centre: Vec3): boolean => {
    if (cutlery === null) return false;
    const [alongRange, acrossRange] =
      row.runs === 'x' ? [cutlery.x, cutlery.y] : [cutlery.y, cutlery.x];
    const along = row.runs === 'x' ? centre[0] : centre[1];
    return (
      along > alongRange[0] - SLOT_COVER_MARGIN &&
      along < alongRange[1] + SLOT_COVER_MARGIN &&
      row.railAt > acrossRange[0] - SLOT_COVER_REACH &&
      row.railAt < acrossRange[1] + SLOT_COVER_REACH
    );
  };
  return basket.tineRows.map((row): TineRowAffordance => {
    const folded = isTineRowFolded(spec, config, basket.id, row.id);
    const tines = row.tinePositions.map((_, i) => {
      const line = tineLine(row, i, folded);
      return { base: line.base, tip: line.end };
    });
    const along = leansAlongRail(row);
    const slots: TineSlot[] = [];
    if (!folded) {
      for (let i = 0; i + 1 < row.tinePositions.length; i++) {
        const a = row.tinePositions[i] as number;
        const b = row.tinePositions[i + 1] as number;
        const leanA = row.leanToward[i] as HorizontalDirection;
        const leanB = row.leanToward[i + 1] as HorizontalDirection;
        const vGap = along && leanA !== leanB;
        const lean = along && !vGap ? row.lean : 0;
        const centre = railPoint(row, (a + b) / 2);
        slots.push({
          index: i,
          centre,
          centreTub: v3Add(origin, centre),
          pitch: b - a,
          clearWidth: b - a - row.wireDiameter,
          lean,
          leanToward: leanA,
          plateNormal: plateNormal(row, lean, leanA),
          vGap,
          blockedBy: underCutleryBasket(row, centre) ? 'cutlery_basket' : null,
        });
      }
    }
    // The nearest parallel row whose rail overlaps this one.
    let partner: TineRowAffordance['partner'] = null;
    for (const other of basket.tineRows) {
      if (other.id === row.id || other.runs !== row.runs) continue;
      if (isTineRowFolded(spec, config, basket.id, other.id)) continue;
      const overlap =
        Math.min(row.railSpan[1], other.railSpan[1]) - Math.max(row.railSpan[0], other.railSpan[0]);
      const spacing = Math.abs(other.railAt - row.railAt);
      if (overlap <= 0 || spacing < 1e-6 || spacing > PARTNER_RANGE) continue;
      if (partner === null || spacing < partner.railSpacing) {
        partner = { rowId: other.id, railSpacing: spacing };
      }
    }
    return {
      basketId: basket.id,
      rowId: row.id,
      label: row.label,
      frame: basket.frame,
      runs: row.runs,
      state: folded ? 'folded' : 'up',
      rail: [railPoint(row, row.railSpan[0]), railPoint(row, row.railSpan[1])],
      railTopZ: row.railZ + basket.wires.floor.coated / 2,
      tines,
      slots,
      partner,
    };
  });
}

/** The cup shelves of one basket in a configuration. */
export function cupShelfZones(
  spec: MachineSpec,
  basket: BasketSpec,
  config: MachineConfig,
): CupShelfZone[] {
  return basket.cupShelves.map((shelf): CupShelfZone => {
    const state = shelfState(spec, config, basket.id, shelf.id);
    const down = cupShelfBoxDown(basket, shelf);
    const box = state === 'down' ? down : cupShelfBoxUp(basket, shelf);
    const freeX = shelf.side === 'left' ? down.max[0] : down.min[0];
    const notches: Vec3[] = [];
    for (let i = 0; i < shelf.stemwareNotches; i++) {
      const y = shelf.y[0] + ((i + 0.5) * (shelf.y[1] - shelf.y[0])) / shelf.stemwareNotches;
      notches.push([freeX, y, shelf.heightAboveGrid]);
    }
    return {
      basketId: basket.id,
      shelfId: shelf.id,
      state,
      box,
      surface:
        state === 'down'
          ? { x: [down.min[0], down.max[0]], y: [down.min[1], down.max[1]], z: down.max[2] }
          : null,
      clearBelow: state === 'down' ? down.min[2] : null,
      stemwareNotches: notches,
    };
  });
}

/** The holders of one basket in a configuration. */
export function holderZones(
  spec: MachineSpec,
  basket: BasketSpec,
  config: MachineConfig,
): HolderZone[] {
  return basket.holders.map((holder): HolderZone => {
    const state = holder.folds ? shelfState(spec, config, basket.id, holder.id) : 'down';
    const tag: ProvenanceTag =
      holder.floorZ === null ? 'estimated' : provenanceTagOf(holder.provenance, 'floorZ');
    return {
      basketId: basket.id,
      holderId: holder.id,
      kind: holder.kind,
      state,
      box: state === 'down' ? holderBoxDown(basket, holder) : holderBoxUp(basket, holder),
      floorZ: holderFloorZ(basket, holder),
      floorZTag: tag,
    };
  });
}

/**
 * The sloped rests along the side walls of one basket: every straight run of a floor relief
 * across x that falls towards the nearer side wall at {@link SIDE_REST_SLOPE} and is at least
 * {@link SIDE_REST_RUN} long, with nothing but low floor between its foot and the wall. The
 * Bosch's upper basket has two (IMG_9131: the floor wires fall at 33 and 35 degrees from a
 * ridge 150 mm either side of the middle to the low floor by each wall); a flat floor, and the
 * gentle ramp in the middle of that basket, have none.
 */
export function sideRestZones(basket: BasketSpec): SideRestZone[] {
  const relief = basket.floor.relief;
  if (relief === null || relief.axis !== 'x') return [];
  const [insetX, insetY] = basketRimInset(basket);
  const r = basket.wires.rim.coated / 2;
  const [width, depth] = basket.outline.size;
  const out: SideRestZone[] = [];
  const points = relief.points;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as { at: number; rise: number };
    const b = points[i] as { at: number; rise: number };
    const run = b.at - a.at;
    const fall = a.rise - b.rise;
    if (run < SIDE_REST_RUN) continue;
    const slope = Math.atan2(Math.abs(fall), run);
    if (slope < SIDE_REST_SLOPE[0] || slope > SIDE_REST_SLOPE[1]) continue;
    // It falls towards low x (the left wall) or high x (the right wall); its foot must be the
    // lowest floor from there to that wall, and the wall the nearer one.
    const left = fall < 0;
    const peak = left ? b : a;
    const foot = left ? a : b;
    const beyond = left ? points.slice(0, i - 1) : points.slice(i + 1);
    if (beyond.some((p) => p.rise > foot.rise + 1e-9)) continue;
    if (left ? foot.at > width / 2 : foot.at < width / 2) continue;
    out.push({
      basketId: basket.id,
      frame: basket.frame,
      restId: left ? 'left' : 'right',
      fallsToward: left ? '-x' : '+x',
      peakX: peak.at,
      footX: foot.at,
      wallX: left ? insetX + r : width - insetX - r,
      peakZ: peak.rise,
      footZ: foot.rise,
      slope,
      y: [insetY + r, depth - insetY - r],
    });
  }
  return out;
}

/**
 * The cells of the cutlery basket where the configuration puts it; none when it is out. The
 * opening of a cell (`box`) is free from its floor to above everything over it: where the handle
 * of the basket it stands in reaches over the cell, the strip under that handle is left out.
 */
export function cutleryCellAffordances(spec: MachineSpec, config: MachineConfig): CutleryCell[] {
  const cutlery = spec.cutleryBasket;
  const placement = config.cutleryBasket;
  if (cutlery === null || placement === null) return [];
  const basket = getBasket(spec, placement.basketId);
  const origin = basketOrigin(spec, placement.basketId, config);
  const inRack = cutleryBasketPoseInRack(cutlery, placement);
  const inTub = poseCompose({ p: origin, q: [0, 0, 0, 1] }, inRack);
  // The handle of the host basket as a box in the cutlery frame (the two frames are parallel
  // or a quarter turn apart, so a box stays a box).
  const handle = handleBox(basket);
  let over: FrameBox | null = null;
  if (handle !== null) {
    const a = poseInverseTransformPoint(inRack, handle.min);
    const b = poseInverseTransformPoint(inRack, handle.max);
    over = {
      min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
      max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
    };
  }
  return cutleryCells(cutlery).map((cell): CutleryCell => {
    const box = over === null ? cell.box : clearOf(cell.box, over);
    const { min, max } = box;
    return {
      id: cell.id,
      box,
      interior: cell.interior,
      floorCentreTub: poseTransformPoint(inTub, [
        (min[0] + max[0]) / 2,
        (min[1] + max[1]) / 2,
        min[2],
      ]),
      dividerAt: cell.dividerAt,
    };
  });
}

/**
 * A cell opening with the strip under an obstacle above its floor cut off: the opening is
 * shortened along the axis in which the obstacle reaches in least. An obstacle that covers the
 * whole opening leaves it as it is.
 */
function clearOf(cell: FrameBox, obstacle: FrameBox): FrameBox {
  const overlaps = (k: 0 | 1): boolean =>
    (obstacle.max[k] as number) > (cell.min[k] as number) &&
    (obstacle.min[k] as number) < (cell.max[k] as number);
  if (!overlaps(0) || !overlaps(1) || obstacle.max[2] <= cell.min[2]) return cell;
  const min: [number, number, number] = [cell.min[0], cell.min[1], cell.min[2]];
  const max: [number, number, number] = [cell.max[0], cell.max[1], cell.max[2]];
  let best: { axis: 0 | 1; low: boolean; cut: number } | null = null;
  for (const axis of [0, 1] as const) {
    // Cut from the low side up to the obstacle's far face, or from the high side down to its
    // near face, whichever of the four takes least.
    const fromLow =
      (obstacle.max[axis] as number) + CELL_HANDLE_CLEARANCE - (cell.min[axis] as number);
    const fromHigh =
      (cell.max[axis] as number) - ((obstacle.min[axis] as number) - CELL_HANDLE_CLEARANCE);
    if (best === null || fromLow < best.cut) best = { axis, low: true, cut: fromLow };
    if (fromHigh < best.cut) best = { axis, low: false, cut: fromHigh };
  }
  if (
    best === null ||
    best.cut >= (cell.max[best.axis] as number) - (cell.min[best.axis] as number)
  ) {
    return cell;
  }
  if (best.low) min[best.axis] += best.cut;
  else max[best.axis] -= best.cut;
  return { min, max };
}

/** The cutlery basket where the configuration puts it; null when there is none or it is out. */
export function cutleryBasketAffordance(
  spec: MachineSpec,
  config: MachineConfig,
): CutleryBasketAffordance | null {
  const cutlery = spec.cutleryBasket;
  const placement = config.cutleryBasket;
  if (cutlery === null || placement === null) return null;
  const basket = getBasket(spec, placement.basketId);
  const origin = basketOrigin(spec, placement.basketId, config);
  const { x, y } = cutleryBasketFootprint(cutlery, placement);
  return {
    basketId: basket.id,
    frame: basket.frame,
    positionId: cutleryBasketPositionId(spec, config),
    placement,
    poseTub: poseCompose(
      { p: origin, q: [0, 0, 0, 1] },
      cutleryBasketPoseInRack(cutlery, placement),
    ),
    box: { min: [x[0], y[0], 0], max: [x[1], y[1], cutlery.heightWithHandle] },
    rimZ: cutlery.size[2],
  };
}

/** The volume one spray arm sweeps, at the configured basket heights. */
export function armSweptVolume(
  spec: MachineSpec,
  arm: SprayArmSpec,
  config: MachineConfig,
): ArmSweptVolume {
  const z0 = armFrameZ(spec, arm, config);
  const rings = buildSprayArm(spec, arm).rings.map((ring) => ({
    ...ring,
    zMin: ring.zMin + z0,
    zMax: ring.zMax + z0,
  }));
  return {
    levelId: arm.id,
    partId: `${arm.id}_arm`,
    axis: arm.axis,
    rings,
    radius: Math.max(...rings.map((r) => r.rMax)),
    zMin: Math.min(...rings.map((r) => r.zMin)),
    zMax: Math.max(...rings.map((r) => r.zMax)),
  };
}

/** Everything above a basket that limits the height of its load, lowest first. */
export function overheadObstacles(
  spec: MachineSpec,
  basket: BasketSpec,
  config: MachineConfig,
): OverheadObstacle[] {
  const origin = basketOrigin(spec, basket.id, config);
  const out: OverheadObstacle[] = [];
  const add = (id: string, zTub: number, region: OverheadObstacle['region']): void => {
    if (zTub > origin[2]) out.push({ id, zTub, clearHeight: zTub - origin[2], region });
  };
  add('roof', spec.tub.z[1], { kind: 'everywhere' });
  for (const other of spec.baskets) {
    if (other.id === basket.id) continue;
    // The underside of the base grid of a basket above.
    const floorUnderside =
      Math.min(other.floor.alongX.z, other.floor.alongY.z) - other.wires.floor.coated / 2;
    add(other.frame, basketOrigin(spec, other.id, config)[2] + floorUnderside, {
      kind: 'everywhere',
    });
  }
  for (const level of spec.sprayLevels) {
    // What hangs under this basket, or stands below it, is not above its load.
    if (level.mount.kind === 'basket' && level.mount.basketId === basket.id) continue;
    if (level.kind === 'arm') {
      for (const ring of armSweptVolume(spec, level, config).rings) {
        if (ring.id === 'stem') continue;
        add(`${level.id}_arm.${ring.id}`, ring.zMin, {
          kind: 'disc',
          centre: level.axis,
          radius: ring.rMax,
        });
      }
    } else {
      const datum = sprayLevelDatumZ(spec, level, config.basketHeights);
      add(`${level.id}_sprayer`, datum + level.lowerFaceZ, {
        kind: 'disc',
        centre: level.axis,
        radius: level.diameter / 2,
      });
    }
  }
  return out.sort((a, b) => a.zTub - b.zTub || (a.id < b.id ? -1 : 1));
}

/** The usable interior of one basket in a configuration. */
export function basketEnvelope(
  spec: MachineSpec,
  basket: BasketSpec,
  config: MachineConfig,
): BasketEnvelope {
  const origin = basketOrigin(spec, basket.id, config);
  const overhead = overheadObstacles(spec, basket, config);
  const heights = overhead.map((o) => o.clearHeight);
  const wide = overhead
    .filter((o) => o.region.kind === 'everywhere' || o.region.radius >= SMALL_DISC)
    .map((o) => o.clearHeight);
  const maxItemHeight = Math.min(...heights);
  const [insetX, insetY] = basketRimInset(basket);
  const r = basket.wires.rim.coated / 2;
  const [width, depth] = basket.outline.size;
  const top = (side: 'front' | 'rear' | 'left' | 'right'): number => rimZ(basket, side) + r;
  return {
    basketId: basket.id,
    frame: basket.frame,
    positionId: basketHeightPosition(spec, basket.id, config.basketHeights).id,
    originTub: origin,
    interior: {
      min: [insetX + r, insetY + r, 0],
      max: [width - insetX - r, depth - insetY - r, maxItemHeight],
    },
    rimTopZ: { front: top('front'), rear: top('rear'), left: top('left'), right: top('right') },
    overhead,
    maxItemHeight,
    maxItemHeightClearOfDiscs: Math.min(...wide),
    travel: { direction: basket.pose.travelDirection, distance: basket.pose.travel },
  };
}

/** The volume the dispenser lid passes through when the chamber opens. Tub frame. */
export function dispenserLidSweep(spec: MachineSpec): LidSweptVolume {
  const closed = dispenserLidBox(spec);
  const lid = spec.dispenser.lid;
  const [w, h] = spec.dispenser.chamberSize;
  const min: [number, number, number] = [closed.min[0], closed.min[1], closed.min[2]];
  const max: [number, number, number] = [closed.max[0], closed.max[1], closed.max[2]];
  if (lid.kind === 'slides') {
    // It slides in the plane of the door by its own size and uncovers the chamber.
    if (lid.direction === 'up') max[2] += h;
    else if (lid.direction === 'down') min[2] -= h;
    else if (lid.direction === 'left') min[0] -= w;
    else max[0] += w;
  } else {
    // It swings into the tub about one edge: at most its own size deep, and the keep-out depth.
    const reach = lid.hingeEdge === 'top' || lid.hingeEdge === 'bottom' ? h : w;
    max[1] =
      closed.min[1] +
      Math.max(spec.dispenser.keepOutDepth, reach * Math.sin(Math.min(lid.angle, Math.PI / 2)));
    if (lid.angle > Math.PI / 2) {
      const over = -reach * Math.cos(lid.angle);
      if (lid.hingeEdge === 'bottom') min[2] -= over;
      else if (lid.hingeEdge === 'top') max[2] += over;
      else if (lid.hingeEdge === 'left') min[0] -= over;
      else max[0] += over;
    }
  }
  return { kind: lid.kind, closed, swept: { min, max } };
}

/** The tablet's way from the chamber to the tray or basket that catches it. */
export function tabletPath(spec: MachineSpec, config: MachineConfig): TabletPath {
  const drop = tabletDrop(spec, config);
  return {
    points: [drop.exit, drop.landing],
    caughtBy: drop.caughtBy,
    basketId: drop.basketId,
    target: drop.target,
    miss: drop.miss,
  };
}

/** All affordances of a machine in a configuration. */
export function buildAffordances(spec: MachineSpec, config: MachineConfig): MachineAffordances {
  const arms = spec.sprayLevels.filter((l): l is SprayArmSpec => l.kind === 'arm');
  return {
    tineRows: spec.baskets.flatMap((b) => tineRowAffordances(spec, b, config)),
    cupShelves: spec.baskets.flatMap((b) => cupShelfZones(spec, b, config)),
    holders: spec.baskets.flatMap((b) => holderZones(spec, b, config)),
    sideRests: spec.baskets.flatMap((b) => sideRestZones(b)),
    cutleryCells: cutleryCellAffordances(spec, config),
    cutleryBasket: cutleryBasketAffordance(spec, config),
    baskets: spec.baskets.map((b) => basketEnvelope(spec, getBasket(spec, b.id), config)),
    armSweeps: arms.map((arm) => armSweptVolume(spec, arm, config)),
    dispenserLid: dispenserLidSweep(spec),
    tabletPath: tabletPath(spec, config),
  };
}
