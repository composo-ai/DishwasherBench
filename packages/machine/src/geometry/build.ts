/**
 * `buildMachineGeometry`: a machine specification and a configuration as named shapes with
 * their frames, plus the affordances of the loading layer (docs/design/platform.md section 4.4).
 *
 * A pure function of its two arguments. Units and frames: see `types.ts` in this directory.
 */

import type { Pose } from '@spotless/core';
import { poseCompose, QUAT_IDENTITY } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import {
  basketOrigin,
  defaultsAsConfig,
  shelfState,
  sprayLevelDatumZ,
  validateMachineConfig,
} from '../config.ts';
import { errorsOf } from '../problems.ts';
import { weakestProvenanceTag } from '../provenance.ts';
import type { MachineConfig, MachineSpec, SprayArmSpec } from '../types.ts';
import { buildAffordances } from './affordances.ts';
import { armPoseAt, buildArmFeed, buildSprayArm } from './arm.ts';
import { GEOMETRY_ASSUMPTIONS } from './assumptions.ts';
import { buildBasketShapes } from './basket.ts';
import {
  buildCutleryBasket,
  cutleryBasketPoseInRack,
  cutleryFloorOpenFraction,
  cutleryWallOpenFraction,
} from './cutlery.ts';
import {
  buildDispenser,
  buildDoor,
  buildFeedDuct,
  buildFilter,
  buildFixedSprayer,
  buildTub,
} from './tub.ts';
import type { GeometryAssumption, MachineGeometry, MachinePart } from './types.ts';

/** Material of the plastic mouldings of a basket (handles, shelves, wheels, trays). */
const BASKET_PLASTIC = 'polypropylene';

/** What every machine geometry built here leaves out or simplifies. */
export const GEOMETRY_SIMPLIFICATIONS: readonly string[] = [
  'Tub: a box between the inner faces of the specification with the two rear corners rounded; the stepped floor pan, its slope towards the sump and its pressed beads and dish are not drawn (the floor is flat at the datum, with the wheel ledges standing on it); the side walls, floor and roof run on to the door liner plane in place of the rim of the inner door.',
  'Wall features with a recorded position (the guide rails of an upper basket) are plain slabs standing proud of their wall; those without one (grilles, fittings, embossed panels, the feed run under the roof) are not drawn. Roller carriers are not drawn.',
  'Filter: the flat filter and the sump cover are plain sheets carrying their open fraction as porosity; the round opening of the flat filter is not cut out (the crown of the coarse filter stands in it); the coarse-filter crown is a plain tube; the micro filter is not drawn.',
  'Door: the liner is a flat sheet at the liner plane, drawn closed; the dispenser is a plate 2 mm proud of it with the chamber lid on top.',
  'Basket wires: straight in plan between the points the specification gives; the sideways cranks of floor wires, which the dossier does not locate, are not drawn. The relief of a floor is piecewise linear across the basket and the same from front to back; a hump is a trapezoid with 45 degree ramps.',
  'Plate fit: a standing plate must stay inside the plan outline of its own basket; the guide rails, roller carriers and ledges in the strip between a basket and the tub wall are not tested one by one.',
  'Hinged tine rows: the bearing plates, levers and latches are not drawn; a folded row is the upright row turned about its rail by the fold angle.',
  'Hairpin tines: two parallel legs joined at the top, with a ball on the bow.',
  'Holders and cup shelves: a lattice slab (porosity) with, for a holder, a low rim; combs, fins and stemware notches are not drawn. The handle of a basket is a solid bar.',
  'Cutlery basket: slabs for walls, floors and lid grids, closed for collision, with the open fraction of the lattice as porosity, not bar by bar; the floor of a foot is one slab as deep as its ribs; the arch of a tunnel is drawn square below with a ridged roof; the teeth along the wall tops and the combs inside the long walls are not drawn; a lid grid folded out hangs straight down from a rim strip and does not swing.',
  'Spray arms: straight tapered blades on the radial line of their nozzles, a disc for the hub, a tube for the stem, one boss per nozzle; the elbow of a hanging arm into its hub is not drawn.',
  'Fixed sprayers: a disc at the rotor; its vanes, cage and pipe end are not drawn.',
];

/** The configuration with every default of the specification filled in. */
export function resolveMachineConfig(spec: MachineSpec, config: MachineConfig): MachineConfig {
  const defaults = defaultsAsConfig(spec);
  const foldedTineRows = [...config.foldedTineRows].sort((a, b) =>
    a.basketId === b.basketId ? (a.rowId < b.rowId ? -1 : 1) : a.basketId < b.basketId ? -1 : 1,
  );
  return {
    basketHeights: { ...defaults.basketHeights, ...config.basketHeights },
    foldedTineRows,
    shelves: defaults.shelves.map((s) => ({
      ...s,
      state: shelfState(spec, config, s.basketId, s.shelfId),
    })),
    cutleryBasket: config.cutleryBasket,
  };
}

function translation(p: readonly [number, number, number]): Pose {
  return { p, q: QUAT_IDENTITY };
}

function staticPart(
  id: string,
  component: MachinePart['component'],
  shape: Shape,
  material: string,
): MachinePart {
  return {
    id,
    role: 'tub',
    component,
    shape,
    frame: 'tub',
    pose: translation([0, 0, 0]),
    body: 'static',
    motion: { kind: 'static' },
    carriedBy: null,
    material,
  };
}

/**
 * The machine as geometry in a configuration (default: the machine's own default
 * configuration). Throws a RangeError for a configuration that `validateMachineConfig` rejects:
 * player input is to be validated before it gets here.
 */
export function buildMachineGeometry(
  spec: MachineSpec,
  config: MachineConfig = spec.defaultConfig,
): MachineGeometry {
  const problems = errorsOf(validateMachineConfig(spec, config));
  if (problems.length > 0) {
    throw new RangeError(
      `buildMachineGeometry: invalid configuration for ${spec.id}: ${problems.map((p) => `${p.path}: ${p.message}`).join('; ')}`,
    );
  }
  const resolved = resolveMachineConfig(spec, config);
  const parts: MachinePart[] = [];
  const assumptions: GeometryAssumption[] = [...GEOMETRY_ASSUMPTIONS];

  // ---- fixed parts of the chamber
  const steel = spec.tub.material;
  parts.push(staticPart('tub', 'tub', buildTub(spec), steel));
  parts.push(staticPart('filter', 'filter', buildFilter(spec), steel));
  parts.push({
    ...staticPart('door', 'door', buildDoor(spec), steel),
    body: 'kinematic',
    motion: {
      kind: 'revolute',
      point: [0, spec.door.hingeAxis.y, spec.door.hingeAxis.z],
      axis: [1, 0, 0],
      sense: 1,
      range: [0, spec.door.openAngle],
    },
  });
  parts.push(staticPart('dispenser', 'dispenser', buildDispenser(spec), BASKET_PLASTIC));
  const duct = buildFeedDuct(spec);
  if (duct !== null) parts.push(staticPart('feed_duct', 'feed_duct', duct, BASKET_PLASTIC));
  for (const level of spec.sprayLevels) {
    if (level.kind !== 'fixed' || level.mount.kind !== 'tub') continue;
    parts.push(
      staticPart(
        `${level.id}_sprayer`,
        'fixed_sprayer',
        buildFixedSprayer(level, 0),
        BASKET_PLASTIC,
      ),
    );
  }

  // ---- baskets, lowest first, each with what it carries
  const capsulesByBasket: Record<string, number> = {};
  for (const basket of spec.baskets) {
    const origin = basketOrigin(spec, basket.id, resolved);
    const inTub = translation(origin);
    const motion: MachinePart['motion'] = {
      kind: 'prismatic',
      direction: basket.pose.travelDirection,
      travel: basket.pose.travel,
    };
    const shapes = buildBasketShapes(spec, basket, resolved, BASKET_PLASTIC);
    capsulesByBasket[basket.id] = shapes.wires.parts.length;
    const carried = (
      id: string,
      role: MachinePart['role'],
      component: MachinePart['component'],
      shape: Shape,
      material: string,
    ): MachinePart => ({
      id,
      role,
      component,
      shape,
      frame: basket.frame,
      pose: inTub,
      body: 'kinematic',
      motion,
      carriedBy: basket.id,
      material,
    });
    parts.push({
      ...carried(basket.frame, 'wires', 'basket_wires', shapes.wires, basket.material),
      carriedBy: null,
    });
    if (shapes.fittings !== null) {
      parts.push(
        carried(
          `${basket.frame}_fittings`,
          'basket',
          'basket_fittings',
          shapes.fittings,
          BASKET_PLASTIC,
        ),
      );
    }
    if (shapes.tabletTray !== null) {
      parts.push(
        carried(
          `${basket.frame}_tablet_tray`,
          'basket',
          'tablet_tray',
          shapes.tabletTray,
          BASKET_PLASTIC,
        ),
      );
    }
    const cutlery = spec.cutleryBasket;
    const placement = resolved.cutleryBasket;
    if (cutlery !== null && placement !== null && placement.basketId === basket.id) {
      parts.push({
        ...carried(
          'cutlery_basket',
          'basket',
          'cutlery_basket',
          buildCutleryBasket(cutlery),
          cutlery.material,
        ),
        frame: 'cutlery_basket',
        pose: poseCompose(inTub, cutleryBasketPoseInRack(cutlery, placement)),
      });
    }
    for (const level of spec.sprayLevels) {
      if (level.kind !== 'arm' || level.mount.kind !== 'basket') continue;
      if (level.mount.basketId !== basket.id) continue;
      const feed = buildArmFeed(spec, level);
      if (feed === null) continue;
      parts.push(carried(`${level.id}_arm_feed`, 'basket', 'arm_feed', feed.shape, BASKET_PLASTIC));
      if (feed.squeezed > 1e-6) {
        assumptions.push({
          id: `${level.id}_arm_feed_diameter`,
          value: feed.diameter,
          tag: 'estimated',
          note: `The feed tube of the ${level.id} arm is specified ${(level.feedTube?.diameter ?? 0) * 1000} mm in diameter, but less than that lies between the floor wires over it and the arm's nozzle exit plane with its clearance. It is drawn ${(feed.diameter * 1000).toFixed(1)} mm thick so that it enters neither.`,
        });
      }
    }
    for (const level of spec.sprayLevels) {
      if (level.kind !== 'fixed' || level.mount.kind !== 'basket') continue;
      if (level.mount.basketId !== basket.id) continue;
      const datum = sprayLevelDatumZ(spec, level, resolved.basketHeights);
      parts.push({
        ...staticPart(
          `${level.id}_sprayer`,
          'fixed_sprayer',
          buildFixedSprayer(level, datum),
          BASKET_PLASTIC,
        ),
        body: 'kinematic',
        motion,
        carriedBy: basket.id,
      });
    }
  }

  // ---- rotating spray arms, in the order of the specification
  const arms = spec.sprayLevels.filter((l): l is SprayArmSpec => l.kind === 'arm');
  arms.forEach((arm, index) => {
    const senseSign: 1 | -1 = arm.sense === 'cw' ? -1 : 1;
    parts.push({
      id: `${arm.id}_arm`,
      role: 'arm',
      component: 'spray_arm',
      shape: buildSprayArm(spec, arm).shape,
      frame: `arm:${arm.id}`,
      pose: armPoseAt(spec, arm, resolved, 0),
      body: 'kinematic',
      motion: {
        kind: 'revolute',
        point: [0, 0, 0],
        axis: [0, 0, 1],
        sense: senseSign,
        range: null,
      },
      carriedBy: arm.mount.kind === 'basket' ? arm.mount.basketId : null,
      material: 'polypropylene',
      arm: { index, levelId: arm.id, hingePoint: [0, 0, 0], hingeAxis: [0, 0, 1], senseSign },
    });
  });

  const cutlery = spec.cutleryBasket;
  const primitivesByPart: Record<string, number> = {};
  for (const part of parts) primitivesByPart[part.id] = part.shape.parts.length;

  return {
    machineId: spec.id,
    config: resolved,
    parts,
    affordances: buildAffordances(spec, resolved),
    properties: {
      cutleryBasketWallOpenFraction: cutlery === null ? null : cutleryWallOpenFraction(cutlery),
      cutleryBasketFloorOpenFraction: cutlery === null ? null : cutleryFloorOpenFraction(cutlery),
      cutleryBasketOpenFractionTag:
        cutlery === null ? 'estimated' : worse(weakestProvenanceTag(cutlery.provenance)),
      capsulesByBasket,
      primitivesByPart,
    },
    assumptions,
    simplifications: GEOMETRY_SIMPLIFICATIONS,
  };
}

/** The open fractions rest on an assumed bar width, so they are never better than estimated. */
function worse(tag: ReturnType<typeof weakestProvenanceTag>): 'estimated' | 'generic' {
  return tag === 'generic' ? 'generic' : 'estimated';
}

/** The part with the given id. Throws a RangeError if the geometry has none. */
export function getMachinePart(geometry: MachineGeometry, partId: string): MachinePart {
  const part = geometry.parts.find((p) => p.id === partId);
  if (part === undefined) {
    throw new RangeError(`getMachinePart: machine ${geometry.machineId} has no part "${partId}"`);
  }
  return part;
}

/**
 * Pose of a part's frame in the tub frame in a given state: `armAngle` turns a spray arm (the
 * azimuth of its "+" blade, radians, as in `kinematics.ts`) and `basketTravel` (metres, 0 pushed
 * in) slides a basket and everything it carries. Other parts keep their reference pose.
 */
export function machinePartPose(
  geometry: MachineGeometry,
  part: MachinePart,
  state: {
    readonly armAngle?: number;
    readonly basketTravel?: Readonly<Record<string, number>>;
  } = {},
): Pose {
  let pose = part.pose;
  if (part.arm !== undefined && state.armAngle !== undefined) {
    const half = state.armAngle / 2;
    pose = poseCompose(pose, { p: [0, 0, 0], q: [0, 0, Math.sin(half), Math.cos(half)] });
  }
  const carrier =
    part.carriedBy ?? (part.component === 'basket_wires' ? carrierOfWires(geometry, part) : null);
  const travel = carrier === null ? undefined : state.basketTravel?.[carrier];
  if (carrier !== null && travel !== undefined && travel !== 0) {
    const wires = geometry.parts.find(
      (p) => p.component === 'basket_wires' && carrierOfWires(geometry, p) === carrier,
    );
    if (wires !== undefined && wires.motion.kind === 'prismatic') {
      const d = wires.motion.direction;
      const s = Math.min(Math.max(travel, 0), wires.motion.travel);
      pose = { p: [pose.p[0] + d[0] * s, pose.p[1] + d[1] * s, pose.p[2] + d[2] * s], q: pose.q };
    }
  }
  return pose;
}

/** Id of the basket whose wire structure a `basket_wires` part is. */
function carrierOfWires(geometry: MachineGeometry, part: MachinePart): string | null {
  const envelope = geometry.affordances.baskets.find((b) => b.frame === part.frame);
  return envelope === undefined ? null : envelope.basketId;
}
