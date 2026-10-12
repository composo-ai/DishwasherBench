/**
 * The standard set of scale drawings of a machine, composed from its geometry: a top view of
 * each basket with every wire and tine, a front and a side elevation of the whole interior, and
 * a top view of each spray arm with its nozzles numbered. They exist to be laid beside the
 * owner's photographs and tape readings (docs/reference/machine-drawings).
 *
 * Millimetres on the page; the frames are those of `types.ts` in this directory.
 */

import type { Pose, Vec3 } from '@spotless/core';
import { POSE_IDENTITY, poseCompose, poseInverse } from '@spotless/core';
import {
  basketOrigin,
  cutleryBasketPositionId,
  cutleryBasketPositions,
  withCutleryBasketAt,
} from '../config.ts';
import { nozzleDirection } from '../kinematics.ts';
import type { BasketSpec, MachineConfig, MachineSpec, SprayArmSpec } from '../types.ts';
import { buildMachineGeometry, getMachinePart } from './build.ts';
import type {
  Drawing,
  DrawingLabel,
  DrawingLayer,
  DrawingLevel,
  DrawingMark,
  DrawingView,
} from './drawing.ts';
import { layerOf, projectPoint } from './drawing.ts';
import type { MachineGeometry, MachinePart } from './types.ts';

/** A drawing with the file name (without extension) it is saved under. */
export interface NamedDrawing {
  readonly name: string;
  readonly drawing: Drawing;
}

const mm = (m: number): string => (Math.round(m * 10000) / 10).toString();

/** Position of a nozzle along the arm: its radius, negative on the "-" blade. */
function signedRadius(nozzle: {
  readonly blade: '+' | '-' | 'axis';
  readonly radius: number;
}): number {
  return nozzle.blade === '-' ? -nozzle.radius : nozzle.blade === 'axis' ? 0 : nozzle.radius;
}

function partsOfBasket(geometry: MachineGeometry, basket: BasketSpec): MachinePart[] {
  return geometry.parts.filter((p) => p.frame === basket.frame || p.carriedBy === basket.id);
}

/** Top view of one basket in its rack frame, with every wire and tine and the row labels. */
export function basketTopDrawing(
  spec: MachineSpec,
  geometry: MachineGeometry,
  basket: BasketSpec,
): Drawing {
  const view: DrawingView = 'top';
  const origin = basketOrigin(spec, basket.id, geometry.config);
  const toRack = poseInverse({ p: origin, q: [0, 0, 0, 1] });
  const inRack = (part: MachinePart): Pose => poseCompose(toRack, part.pose);
  const wires = getMachinePart(geometry, basket.frame);
  const layers: DrawingLayer[] = [];
  for (const part of partsOfBasket(geometry, basket)) {
    if (part.id === wires.id) continue;
    const arm = part.component === 'spray_arm' || part.component === 'arm_feed';
    layers.push(
      layerOf(part.id, part.shape, inRack(part), view, {
        stroke: arm ? '#7fb3d5' : '#b9770e',
        fill: arm ? '#d6eaf8' : '#fdebd0',
        opacity: arm ? 0.55 : 0.6,
        outline: 0.4,
      }),
    );
  }
  const hinged = new Set(basket.tineRows.filter((r) => r.hinge !== null).map((r) => r.id));
  const rowOf = (id: string): string | null =>
    id.startsWith('row.') ? (id.split('.')[1] ?? null) : null;
  const pose = inRack(wires);
  layers.push(
    layerOf(
      'walls',
      wires.shape,
      pose,
      view,
      { stroke: '#9aa0a6' },
      (id) => id.startsWith('rim.') || id.startsWith('wall.') || id.startsWith('upright.'),
    ),
  );
  layers.push(
    layerOf('floor', wires.shape, pose, view, { stroke: '#4d5156' }, (id) =>
      id.startsWith('floor.'),
    ),
  );
  const isRail = (id: string): boolean => id.split('.')[2] === 'rail';
  layers.push(
    layerOf('rails-fixed', wires.shape, pose, view, { stroke: '#99c1f1' }, (id) => {
      const r = rowOf(id);
      return r !== null && !hinged.has(r) && isRail(id);
    }),
  );
  layers.push(
    layerOf('rails-hinged', wires.shape, pose, view, { stroke: '#f1a7ad' }, (id) => {
      const r = rowOf(id);
      return r !== null && hinged.has(r) && isRail(id);
    }),
  );
  layers.push(
    layerOf('tines-fixed', wires.shape, pose, view, { stroke: '#1a5fb4' }, (id) => {
      const r = rowOf(id);
      return r !== null && !hinged.has(r) && !isRail(id);
    }),
  );
  layers.push(
    layerOf('tines-hinged', wires.shape, pose, view, { stroke: '#c01c28' }, (id) => {
      const r = rowOf(id);
      return r !== null && hinged.has(r) && !isRail(id);
    }),
  );
  // One dot per tine at its base on the rail, so that the tines can be counted.
  const bases: DrawingMark[] = [];
  for (const row of geometry.affordances.tineRows.filter((r) => r.basketId === basket.id)) {
    row.tines.forEach((tine, i) => {
      bases.push({
        kind: 'circle',
        part: `${row.rowId}.${i}`,
        c: projectPoint(tine.base, view),
        r: 1.1,
      });
    });
  }
  layers.push({ id: 'tine-bases', marks: bases, style: { stroke: '#000000' } });

  const labels: DrawingLabel[] = [];
  for (const row of geometry.affordances.tineRows.filter((r) => r.basketId === basket.id)) {
    const specRow = basket.tineRows.find((r) => r.id === row.rowId);
    const a = row.rail[0];
    const b = row.rail[1];
    // Put the label at the end of the rail that is nearer the outside of the basket.
    const centre = [basket.outline.size[0] / 2, basket.outline.size[1] / 2];
    const da = Math.hypot(a[0] - (centre[0] as number), a[1] - (centre[1] as number));
    const db = Math.hypot(b[0] - (centre[0] as number), b[1] - (centre[1] as number));
    const end = da >= db ? a : b;
    const at = projectPoint(end, view);
    const text = `${row.label.split(' ')[0]}: ${row.tines.length} tines${specRow?.hinge ? ', hinged' : ''}${row.state === 'folded' ? ' (folded)' : ''}`;
    labels.push({
      at:
        row.runs === 'x'
          ? [at[0] + (end === a ? 4 : -4), at[1] - 5]
          : [at[0] + 4, at[1] + (end === a ? 10 : -4)],
      text,
      size: 7,
      anchor: row.runs === 'x' && end !== a ? 'end' : 'start',
      colour: specRow?.hinge ? '#c01c28' : '#1a5fb4',
    });
  }
  const capsules = geometry.properties.capsulesByBasket[basket.id] ?? 0;
  return {
    title: `${spec.name}: ${basket.id} basket from above`,
    subtitle: `rack frame ${basket.frame} (origin front-left, front at the bottom); ${basket.floor.alongY.positions.length} front-back and ${basket.floor.alongX.positions.length} left-right floor wires, ${basket.tineRows.length} tine rows, ${basket.tineRows.reduce((n, r) => n + r.tinePositions.length, 0)} tines; ${capsules} capsules; height position ${geometry.affordances.baskets.find((b) => b.basketId === basket.id)?.positionId ?? ''}`,
    view,
    layers,
    labels,
    axes: ['x', 'y'],
    tick: 50,
  };
}

/** Top view of one spray arm in its arm frame at angle 0, nozzles numbered, jets as arrows. */
export function armTopDrawing(
  spec: MachineSpec,
  geometry: MachineGeometry,
  arm: SprayArmSpec,
): Drawing {
  const view: DrawingView = 'top';
  const part = getMachinePart(geometry, `${arm.id}_arm`);
  const senseSign: 1 | -1 = arm.sense === 'cw' ? -1 : 1;
  const layers: DrawingLayer[] = [
    layerOf(
      'body',
      part.shape,
      POSE_IDENTITY,
      view,
      { stroke: '#566573', fill: '#eaeded', outline: 0.4 },
      (id) => !id.startsWith('nozzle.'),
    ),
  ];
  const openings: DrawingMark[] = [];
  const jets: DrawingMark[] = [];
  const labels: DrawingLabel[] = [];
  arm.nozzles.forEach((nozzle) => {
    const az = nozzle.blade === '-' ? Math.PI : 0;
    const r = nozzle.blade === 'axis' ? 0 : nozzle.radius;
    const p: Vec3 = [r * Math.cos(az), r * Math.sin(az), 0];
    const c = projectPoint(p, view);
    const size = nozzle.size.map((s) => s * 1000);
    const long = (size[0] ?? 3) / 2;
    const short = (size[1] ?? size[0] ?? 3) / 2;
    if (nozzle.shape === 'round') {
      openings.push({ kind: 'circle', part: nozzle.id, c, r: long });
    } else {
      // An oblong opening: its long axis along the blade or across it.
      const across = nozzle.slotAxis === 'tangential';
      const hu = across ? short : long;
      const hv = across ? long : short;
      openings.push({
        kind: 'polygon',
        part: nozzle.id,
        points: [
          [c[0] - hu, c[1] - hv],
          [c[0] + hu, c[1] - hv],
          [c[0] + hu, c[1] + hv],
          [c[0] - hu, c[1] + hv],
        ],
      });
    }
    // The horizontal part of the jet direction at arm angle 0, 30 mm for a horizontal jet.
    const d = nozzleDirection(nozzle, 0, senseSign);
    const tip = projectPoint([p[0] + d[0] * 0.03, p[1] + d[1] * 0.03, 0], view);
    if (Math.hypot(tip[0] - c[0], tip[1] - c[1]) > 1) {
      jets.push({ kind: 'line', part: nozzle.id, a: c, b: tip, width: 0.9 });
      jets.push({ kind: 'circle', part: nozzle.id, c: tip, r: 1.3 });
    }
    const underside = nozzle.face === 'underside';
    // Labels stand above the arm in three staggered rows, in the order of the nozzles along it.
    const order = [...arm.nozzles]
      .sort((a, b) => signedRadius(a) - signedRadius(b))
      .indexOf(nozzle);
    const at: readonly [number, number] = [c[0], c[1] - 36 - (order % 3) * 9];
    labels.push({
      at,
      text: `${nozzle.label} r${mm(nozzle.radius)}${underside ? ' (under)' : ''}`,
      size: 6.5,
      anchor: 'middle',
      colour: underside ? '#7d3c98' : '#111',
      leaderTo: c,
    });
  });
  layers.push({
    id: 'openings',
    marks: openings,
    style: { stroke: '#111', fill: '#111', outline: 0.2 },
  });
  layers.push({ id: 'jets', marks: jets, style: { stroke: '#c01c28' } });
  labels.push({ at: [-arm.tipRadius * 1000, 34], text: `"-" blade`, size: 7, colour: '#566573' });
  labels.push({
    at: [arm.tipRadius * 1000, 34],
    text: `"+" blade (arm angle 0: along +x)`,
    size: 7,
    anchor: 'end',
    colour: '#566573',
  });
  const drives = arm.nozzles
    .filter((n) => n.drives)
    .map((n) => n.label)
    .join(', ');
  labels.push({
    at: [0, 34],
    text: `drive: ${drives || 'none'}`,
    size: 7,
    anchor: 'middle',
    colour: '#c01c28',
  });
  return {
    title: `${spec.name}: ${arm.name} from above`,
    subtitle: `tip radius ${mm(arm.tipRadius)} mm; ${arm.nozzles.filter((n) => n.face === 'top').length} openings on top, ${arm.nozzles.filter((n) => n.face === 'underside').length} underneath; turns ${arm.sense === 'cw' ? 'clockwise' : 'counter-clockwise'} seen from above; red: horizontal part of each jet (30 mm for a horizontal jet)`,
    view,
    layers,
    labels,
    axes: ['x', 'y'],
    tick: 50,
    pixelsPerMm: 3,
    pad: [10, 50, 10, 22],
  };
}

/** Front or side elevation of the whole interior in the tub frame, with the heights captioned. */
export function elevationDrawing(
  spec: MachineSpec,
  geometry: MachineGeometry,
  view: 'front' | 'side',
): Drawing {
  const layers: DrawingLayer[] = [];
  for (const part of geometry.parts) {
    // Seen from the door the liner and the dispenser would hide everything.
    if (view === 'front' && (part.component === 'door' || part.component === 'dispenser')) continue;
    const style =
      part.component === 'tub' || part.component === 'door'
        ? { stroke: '#7f8c8d', fill: 'none', outline: 0.5 }
        : part.component === 'basket_wires'
          ? { stroke: '#4d5156' }
          : part.component === 'spray_arm' ||
              part.component === 'arm_feed' ||
              part.component === 'fixed_sprayer'
            ? { stroke: '#1a5fb4', fill: '#d6eaf8', outline: 0.4, opacity: 0.9 }
            : part.component === 'feed_duct' || part.component === 'filter'
              ? { stroke: '#95a5a6', fill: '#f2f4f4', outline: 0.4, opacity: 0.8 }
              : { stroke: '#b9770e', fill: '#fdebd0', outline: 0.4, opacity: 0.7 };
    layers.push(layerOf(part.id, part.shape, part.pose, view, style));
  }
  const levels: DrawingLevel[] = [];
  const level = (z: number, text: string, colour?: string): void => {
    levels.push({
      axis: 'h',
      value: z * 1000,
      text: `${mm(z)}  ${text}`,
      ...(colour === undefined ? {} : { colour }),
    });
  };
  level(spec.tub.z[0], 'floor datum (filter plate)');
  level(spec.tub.z[1], 'roof');
  for (const sweep of geometry.affordances.armSweeps) {
    const blades = sweep.rings.find((r) => r.id === 'blades');
    const hub = sweep.rings.find((r) => r.id === 'hub');
    if (blades !== undefined) {
      level(blades.zMax, `${sweep.levelId} arm, nozzle exits`, '#1a5fb4');
      level(blades.zMin, `${sweep.levelId} arm, blade underside`, '#1a5fb4');
    }
    if (hub !== undefined && blades !== undefined && hub.zMin < blades.zMin - 1e-4) {
      level(hub.zMin, `${sweep.levelId} arm, lowest point of the hub`, '#1a5fb4');
    }
  }
  for (const envelope of geometry.affordances.baskets) {
    level(
      envelope.originTub[2],
      `${envelope.basketId} basket, top of the base grid (position ${envelope.positionId})`,
      '#196f3d',
    );
    level(
      envelope.originTub[2] + envelope.rimTopZ.left,
      `${envelope.basketId} basket, top of the side rim`,
      '#196f3d',
    );
  }
  for (const part of geometry.parts) {
    if (part.component !== 'fixed_sprayer') continue;
    const sprayer = spec.sprayLevels.find((l) => `${l.id}_sprayer` === part.id);
    if (sprayer !== undefined && sprayer.kind === 'fixed')
      level(sprayer.lowerFaceZ, `${sprayer.id} sprayer, lower face`, '#1a5fb4');
  }
  levels.sort((a, b) => a.value - b.value);
  const position = Object.entries(geometry.config.basketHeights)
    .map(([b, p]) => `${b} basket at position ${p}`)
    .join(', ');
  return {
    title: `${spec.name}: ${view === 'front' ? 'front elevation (seen from the door)' : 'side elevation (seen from the left; door on the left)'}`,
    subtitle: `tub frame, heights above the filter plate in mm; ${position || 'no adjustable basket'}; baskets pushed in, arms at angle 0`,
    view,
    layers,
    levels,
    axes: [view === 'front' ? 'x' : 'y', 'z'],
    tick: 50,
    captionMargin: 215,
    pixelsPerMm: 2,
  };
}

/**
 * The standard drawings of a machine in a configuration (default: its own): one top view per
 * basket, front and side elevations at every height position of an adjustable basket, and one
 * top view per spray arm.
 */
export function machineDrawings(
  spec: MachineSpec,
  config: MachineConfig = spec.defaultConfig,
): NamedDrawing[] {
  const geometry = buildMachineGeometry(spec, config);
  const out: NamedDrawing[] = [];
  for (const basket of spec.baskets) {
    out.push({
      name: `${basket.id}-basket-top`,
      drawing: basketTopDrawing(spec, geometry, basket),
    });
  }
  // The basket that holds the loose cutlery basket, once more for every other named position
  // it can stand at.
  const cutlery = spec.cutleryBasket;
  if (cutlery !== null && config.cutleryBasket !== null) {
    const here = cutleryBasketPositionId(spec, config);
    for (const position of cutleryBasketPositions(spec, config)) {
      if (position.id === here) continue;
      const host = spec.baskets.find((b) => b.id === position.placement.basketId);
      if (host === undefined) continue;
      const moved = buildMachineGeometry(spec, withCutleryBasketAt(spec, config, position.id));
      const drawing = basketTopDrawing(spec, moved, host);
      out.push({
        name: `${host.id}-basket-top-cutlery-${position.id.replace(/_/g, '-')}`,
        drawing: {
          ...drawing,
          subtitle: `cutlery basket at its position "${position.label}"; ${drawing.subtitle}`,
        },
      });
    }
  }
  out.push({ name: 'front-elevation', drawing: elevationDrawing(spec, geometry, 'front') });
  out.push({ name: 'side-elevation', drawing: elevationDrawing(spec, geometry, 'side') });
  for (const basket of spec.baskets) {
    if (basket.pose.heightPositions.length < 2) continue;
    for (const position of basket.pose.heightPositions) {
      if (position.id === geometry.config.basketHeights[basket.id]) continue;
      const other = buildMachineGeometry(spec, {
        ...config,
        basketHeights: { ...config.basketHeights, [basket.id]: position.id },
      });
      out.push({
        name: `front-elevation-${basket.id}-position-${position.id}`,
        drawing: elevationDrawing(spec, other, 'front'),
      });
    }
  }
  for (const level of spec.sprayLevels) {
    if (level.kind !== 'arm') continue;
    out.push({ name: `${level.id}-arm-top`, drawing: armTopDrawing(spec, geometry, level) });
  }
  return out;
}
