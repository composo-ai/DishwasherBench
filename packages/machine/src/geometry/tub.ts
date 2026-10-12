/**
 * The fixed parts of the wash chamber as geometry: tub walls, floor with the filter region and
 * the sump, ceiling, the feed duct on the rear wall, the door liner, the dispenser and any fixed
 * sprayer. Tub frame T, metres.
 *
 * The chamber is drawn as the box between the inner faces the specification gives, closed at
 * the front by the door liner: the side walls, floor and roof run on from the flange plane to
 * the liner plane, where the real machine has the rim of the inner door. The sheet is drawn
 * outside those faces, so it takes nothing from the interior.
 */

import type { Vec3 } from '@spotless/core';
import { QUAT_IDENTITY } from '@spotless/core';
import type { Part, Shape } from '@spotless/geometry';
import type { FixedSprayerSpec, MachineSpec } from '../types.ts';
import {
  DISPENSER_PROUD,
  FEED_DUCT_FOOT_HEIGHT,
  PLASTIC_WALL,
  PORT_BLOCK_MARGIN,
  TUB_SHEET,
  WHEEL_LEDGE_WIDTH,
} from './assumptions.ts';
import type { Box } from './prims.ts';
import { puckPart, shapeOf, slabPart, tubePart } from './prims.ts';

/** The inside of the wash chamber with the door closed: side walls, liner to rear wall, floor datum to roof. */
export function tubInterior(spec: MachineSpec): Box {
  const { tub, door } = spec;
  return {
    min: [tub.x[0], Math.min(door.linerPlaneY, tub.y[0]), tub.z[0]],
    max: [tub.x[1], tub.y[1], tub.z[1]],
  };
}

/** The plan rectangle of the tub floor that the filter plate and the sump cover fill. */
export function filterRegion(spec: MachineSpec): {
  x: readonly [number, number];
  y: readonly [number, number];
} {
  const plate = spec.filter.flatPlate;
  const cover = spec.filter.sumpCover;
  const y0 = cover === null ? plate.y[0] : Math.min(plate.y[0], cover.y[0]);
  const y1 = cover === null ? plate.y[1] : Math.max(plate.y[1], cover.y[1]);
  return { x: plate.x, y: [y0, y1] };
}

/** Walls, roof, floor round the filter region, and the wheel ledges. */
export function buildTub(spec: MachineSpec): Shape {
  const inside = tubInterior(spec);
  const material = spec.tub.material;
  const t = TUB_SHEET;
  const [x0, y0, z0] = inside.min;
  const [x1, y1, z1] = inside.max;
  const r = Math.max(0, Math.min(spec.tub.verticalCornerRadius, (x1 - x0) / 4, (y1 - y0) / 4));
  const parts: Part[] = [
    slabPart('wall.left', [x0 - t, y0, z0 - t], [x0, y1 - r, z1 + t], material, 0.0005),
    slabPart('wall.right', [x1, y0, z0 - t], [x1 + t, y1 - r, z1 + t], material, 0.0005),
    slabPart('wall.rear', [x0 + r, y1, z0 - t], [x1 - r, y1 + t, z1 + t], material, 0.0005),
    slabPart('roof', [x0 - t, y0, z1], [x1 + t, y1 + t, z1 + t], material, 0.0005),
  ];
  if (r > 0) {
    // The two rear corners: quarter shells whose inner face has the corner radius.
    const profile = [
      { r: r + t / 2, z: z0, t },
      { r: r + t / 2, z: z1, t },
    ];
    parts.push({
      id: 'corner.rear_right',
      prim: { kind: 'sor', profile, arc: [0, Math.PI / 2] },
      pose: { p: [x1 - r, y1 - r, 0], q: QUAT_IDENTITY },
      material,
    });
    parts.push({
      id: 'corner.rear_left',
      prim: { kind: 'sor', profile, arc: [Math.PI / 2, Math.PI] },
      pose: { p: [x0 + r, y1 - r, 0], q: QUAT_IDENTITY },
      material,
    });
  }
  // The floor, leaving out the rectangle that the filter plate and the sump cover fill.
  const f = filterRegion(spec);
  const floor = (id: string, a: Vec3, b: Vec3): void => {
    if (b[0] - a[0] > 1e-6 && b[1] - a[1] > 1e-6) parts.push(slabPart(id, a, b, material, 0.0005));
  };
  floor('floor.left', [x0 - t, y0, z0 - t], [f.x[0], y1 + t, z0]);
  floor('floor.right', [f.x[1], y0, z0 - t], [x1 + t, y1 + t, z0]);
  floor('floor.front', [f.x[0], y0, z0 - t], [f.x[1], f.y[0], z0]);
  floor('floor.rear', [f.x[0], f.y[1], z0 - t], [f.x[1], y1 + t, z0]);
  // The ledges the lowest basket's wheels run on.
  const ledge = spec.tub.wheelLedgeZ;
  if (ledge !== null && ledge > z0) {
    const w = WHEEL_LEDGE_WIDTH;
    parts.push(slabPart('ledge.left', [x0, y0, z0], [x0 + w, y1 - r, ledge], material, 0.001));
    parts.push(slabPart('ledge.right', [x1 - w, y0, z0], [x1, y1 - r, ledge], material, 0.001));
  }
  // Wall features whose position is recorded (the guide rails of an upper basket): slabs
  // standing proud of their wall.
  for (const feature of spec.wallFeatures) {
    const at = feature.position;
    if (at === null || !(feature.proud > 0)) continue;
    const z: [number, number] = [Math.max(at.z[0], z0), Math.min(at.z[1], z1)];
    if (!(z[1] > z[0])) continue;
    const id = `feature.${feature.id}`;
    const p = feature.proud;
    if (feature.surface === 'left') {
      parts.push(
        slabPart(id, [x0, at.along[0], z[0]], [x0 + p, at.along[1], z[1]], material, 0.002),
      );
    } else if (feature.surface === 'right') {
      parts.push(
        slabPart(id, [x1 - p, at.along[0], z[0]], [x1, at.along[1], z[1]], material, 0.002),
      );
    } else if (feature.surface === 'rear') {
      parts.push(
        slabPart(id, [at.along[0], y1 - p, z[0]], [at.along[1], y1, z[1]], material, 0.002),
      );
    }
  }
  return {
    parts,
    regions: [
      { id: 'floor', part: 'floor.*', side: 'in' },
      { id: 'ledge', part: 'ledge.*' },
      { id: 'fittings', part: 'feature.*' },
      { id: 'roof', part: 'roof', side: 'out' },
      { id: 'walls', part: 'wall.*' },
      { id: 'walls', part: 'corner.*' },
      { id: 'outside', part: 'floor.*' },
      { id: 'outside', part: 'roof' },
    ].filter((region) =>
      parts.some((p) =>
        region.part.endsWith('*')
          ? p.id.startsWith(region.part.slice(0, -1))
          : p.id === region.part,
      ),
    ) as Shape['regions'],
  };
}

/**
 * The filter region: the flat fine filter and the sump cover as perforated sheets (their open
 * fractions as porosity), the crown of the coarse filter, the sump well under them, and the cap
 * of the salt container on the floor beside them.
 */
export function buildFilter(spec: MachineSpec): Shape {
  const { filter, sump, saltCap } = spec;
  const steel = spec.tub.material;
  const plastic = 'polypropylene';
  const sheet = 0.001;
  const parts: Part[] = [];
  const plate = filter.flatPlate;
  parts.push(
    slabPart(
      'flat_plate',
      [plate.x[0], plate.y[0], -sheet],
      [plate.x[1], plate.y[1], 0],
      steel,
      0.0002,
      plate.openFraction,
    ),
  );
  const cover = filter.sumpCover;
  if (cover !== null) {
    const open = Math.min(0.95, cover.openArea / (cover.size[0] * cover.size[1]));
    const cx = filter.axis[0];
    parts.push(
      slabPart(
        'sump_cover',
        [cx - cover.size[0] / 2, cover.y[0], -sheet],
        [cx + cover.size[0] / 2, cover.y[1], 0],
        plastic,
        0.0002,
        open,
      ),
    );
  }
  const coarse = filter.coarse;
  if (coarse.crownDiameter !== null && coarse.crownTopZ !== null && coarse.crownTopZ > 0) {
    parts.push(
      // The rim of a tube is rounded by half its wall: the mid-surface stops that far short.
      tubePart(
        'coarse_crown',
        filter.axis[0],
        filter.axis[1],
        coarse.crownDiameter / 2 - PLASTIC_WALL / 2,
        0,
        coarse.crownTopZ - PLASTIC_WALL / 2,
        PLASTIC_WALL,
        plastic,
      ),
    );
  }
  if (sump.depth > 0.004) {
    parts.push(
      tubePart(
        'sump_well',
        sump.centre[0],
        sump.centre[1],
        sump.diameter / 2,
        -sump.depth,
        -0.003,
        TUB_SHEET,
        plastic,
        { floor: true },
      ),
    );
  }
  if (saltCap !== null && saltCap.topZ > 0) {
    parts.push(
      puckPart(
        'salt_cap',
        [saltCap.centre[0], saltCap.centre[1], saltCap.topZ / 2],
        [0, 0, 1],
        saltCap.diameter / 2,
        saltCap.topZ,
        plastic,
      ),
    );
  }
  return shapeOf(parts, [
    ['flat_filter', 'flat_plate'],
    ['sump_cover', 'sump_cover'],
    ['coarse_filter', 'coarse_crown'],
    ['sump', 'sump_well'],
    ['salt_cap', 'salt_cap'],
  ]);
}

/** The door liner, closed: a sheet behind the liner plane across the whole opening. */
export function buildDoor(spec: MachineSpec): Shape {
  const inside = tubInterior(spec);
  const t = TUB_SHEET;
  const y = spec.door.linerPlaneY;
  const part = slabPart(
    'liner',
    [inside.min[0] - t, y - t, inside.min[2] - t],
    [inside.max[0] + t, y, inside.max[2] + t],
    spec.tub.material,
    0.0005,
  );
  return { parts: [part], regions: [{ id: 'liner', part: 'liner' }] };
}

/** The closed lid of the detergent chamber on the liner. */
export function dispenserLidBox(spec: MachineSpec): Box {
  const d = spec.dispenser;
  const y = spec.door.linerPlaneY;
  const [w, h] = d.chamberSize;
  return {
    min: [d.chamberCentre[0] - w / 2, y + DISPENSER_PROUD, d.chamberCentre[2] - h / 2],
    max: [d.chamberCentre[0] + w / 2, y + 2 * DISPENSER_PROUD, d.chamberCentre[2] + h / 2],
  };
}

/** The dispenser: the face of the unit on the liner and the lid of the detergent chamber. */
export function buildDispenser(spec: MachineSpec): Shape {
  const d = spec.dispenser;
  const y = spec.door.linerPlaneY;
  const plastic = 'polypropylene';
  const parts: Part[] = [];
  if (d.unitSize !== null) {
    const [w, h] = d.unitSize;
    const cx = (d.chamberCentre[0] + d.rinseAidOutlet[0]) / 2;
    const cz = d.chamberCentre[2];
    parts.push(
      slabPart(
        'unit',
        [cx - w / 2, y, cz - h / 2],
        [cx + w / 2, y + DISPENSER_PROUD, cz + h / 2],
        plastic,
        0.0005,
      ),
    );
  }
  const lid = dispenserLidBox(spec);
  parts.push(slabPart('lid', lid.min, lid.max, plastic, 0.0005));
  return shapeOf(parts, [
    ['unit', 'unit'],
    ['lid', 'lid'],
  ]);
}

/**
 * The feed duct on the rear wall: the riser from the floor to its top, the block of docking
 * ports, and its foot along the floor to where it meets the sump cover. Null without a duct.
 */
export function buildFeedDuct(spec: MachineSpec): Shape | null {
  const duct = spec.feedDuct;
  if (duct === null) return null;
  const plastic = 'polypropylene';
  const rear = spec.tub.y[1];
  const z0 = Math.max(spec.tub.z[0], duct.stubEndZ);
  const z1 = Math.min(spec.tub.z[1], duct.topZ);
  const [x0, x1] = duct.riserX;
  const parts: Part[] = [
    slabPart('riser', [x0, rear - duct.riserProud, z0], [x1, rear, z1], plastic, 0.002),
  ];
  if (duct.portZ.length > 0 && duct.portBlockProud > duct.riserProud) {
    const low = Math.max(z0, Math.min(...duct.portZ) - PORT_BLOCK_MARGIN);
    const high = Math.min(z1, Math.max(...duct.portZ) + PORT_BLOCK_MARGIN);
    parts.push(
      slabPart(
        'port_block',
        [x0, rear - duct.portBlockProud, low],
        [x1, rear - duct.riserProud, high],
        plastic,
        0.002,
      ),
    );
  }
  if (duct.stubY !== null && duct.stubY < rear - duct.riserProud) {
    parts.push(
      slabPart(
        'foot',
        [x0, duct.stubY, spec.tub.z[0]],
        [x1, rear - duct.riserProud, spec.tub.z[0] + FEED_DUCT_FOOT_HEIGHT],
        plastic,
        0.002,
      ),
    );
  }
  return shapeOf(parts, [
    ['riser', 'riser'],
    ['ports', 'port_block'],
    ['foot', 'foot'],
  ]);
}

/** A fixed sprayer (a roof spinner or a spray head) as a disc at its outlet. */
export function buildFixedSprayer(sprayer: FixedSprayerSpec, datumZ: number): Shape {
  const centreZ = datumZ + sprayer.lowerFaceZ + sprayer.height / 2;
  const part = puckPart(
    'rotor',
    [sprayer.axis[0], sprayer.axis[1], centreZ],
    [0, 0, 1],
    sprayer.diameter / 2,
    sprayer.height,
    'polypropylene',
  );
  return { parts: [part], regions: [{ id: 'rotor', part: 'rotor' }] };
}
