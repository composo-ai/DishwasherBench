/**
 * The numbers a settled load is checked by (brief section 3), measured on the load as the wash
 * will see it: the wash manifest, with both baskets pushed in.
 *
 *  - Interpenetration: every item is tested against the machine and against every other item
 *    in a loading world built from the manifest alone (nothing is stepped), and every pair that
 *    overlaps is measured again without the engine (`measurePenetration`, float64). The depth
 *    is that of the convex collision pieces the loading physics itself works with, which stand
 *    in for the true surfaces to within the collision chord error (`COLLISION_CHORD_ERROR`).
 *    Measured on the true shapes (signed distance of surface samples) the same loads show
 *    overlaps a few tenths of a millimetre deeper; that difference is the chord error of the
 *    collision shapes, not something a policy can load away.
 *  - In its basket: the bounding box of every item against the plan of the basket that carries
 *    it, against the roof, and against the lowest wire of the basket's floor.
 *
 * Stability is the session's own verdict and is read from its scene state; the mechanical
 * checks are those of `check_load`.
 */

import { instantiate } from '@spotless/catalogue';
import { contactPairLookup } from '@spotless/catalogue';
import type { Pose } from '@spotless/core';
import { poseInverseTransformPoint, poseRelative, poseTransformPoint } from '@spotless/core';
import type { CollisionPiece } from '@spotless/geometry';
import {
  COLLISION_CHORD_ERROR,
  boundingBox,
  buildCollisionPieces,
  buildRenderMesh,
  signedDistance,
} from '@spotless/geometry';
import type { MachineConfig } from '@spotless/machine';
import { buildMachineGeometry, findMachine } from '@spotless/machine';
import {
  JOLT_SETTINGS,
  LOADING_GRAVITY,
  LOADING_TIME_STEP,
  NO_MASS,
  createPhysicsWorld,
  measurePenetration,
} from '@spotless/physics';
import type { LoadCheck, SceneState } from '@spotless/session';
import { buildMachineScene } from '@spotless/session';

/** Overlap above which two bodies count as interpenetrating, metres (platform.md section 6). */
export const PENETRATION_LIMIT = 0.0005;
/** Distance an item may reach outside its basket's plan or under its floor, metres. */
export const ENVELOPE_TOLERANCE = 0.001;

/** One item of a load as the checks need it. */
export interface VerifyItem {
  readonly item_id: string;
  readonly item_type: string;
  /** Item frame to tub frame, SI. */
  readonly pose: Pose;
}

/** Two bodies that overlap by more than the limit. */
export interface Overlap {
  readonly a: string;
  /** The other item, or a machine part such as `lower_rack`. */
  readonly b: string;
  /** Depth of the overlap, millimetres. */
  readonly depth_mm: number;
}

/** An item that reaches outside the basket that carries it. */
export interface OutOfBasket {
  readonly item_id: string;
  readonly rack: string;
  /** How far beyond the plan of the basket, millimetres (0 when inside). */
  readonly beyond_plan_mm: number;
  /** How far below the lowest wire of the basket's floor, millimetres (0 when above). */
  readonly below_floor_mm: number;
  /** How far above the roof of the tub, millimetres (0 when below). */
  readonly above_roof_mm: number;
}

/** The numbers of {@link verifyLoad}. */
export interface LoadNumbers {
  readonly items: number;
  /** Deepest overlap of any pair, measured on the convex collision pieces, millimetres. */
  readonly deepest_overlap_mm: number;
  /** Pairs whose collision pieces overlap by more than 0.5 mm, deepest first. */
  readonly overlaps: readonly Overlap[];
  /**
   * Deepest overlap of any two items measured on their true shapes, millimetres: the surface
   * points of each (its mesh at a chord error of 0.2 mm) against the signed distance of the
   * other. The loading physics works on convex pieces whose round walls are cut into flat
   * facets up to 0.5 mm inside the true surface, so two glasses leaning on each other can
   * touch on their pieces and overlap by more than that on their true shapes.
   */
  readonly deepest_true_overlap_mm: number;
  /** Pairs of items whose true shapes overlap by more than 0.5 mm, deepest first. */
  readonly true_overlaps: readonly Overlap[];
  /** Items outside their basket, below its floor or through the roof. */
  readonly out_of_basket: readonly OutOfBasket[];
  /** Items carried by no basket (on the tub floor, on the door, outside the machine). */
  readonly not_in_a_basket: readonly string[];
  /** Placed items the session's stability probe marks as not stable, sorted. */
  readonly unstable: readonly string[];
  /** Items by the basket that carries them. */
  readonly by_basket: { readonly [rack: string]: number };
  /** True when the mechanical checks found nothing: baskets in, door shut, arms and tablet free. */
  readonly check_passes: boolean;
  /** What the mechanical checks found, in words (empty when they pass). */
  readonly check_findings: readonly string[];
}

function mm(metres: number): number {
  return Math.round(metres * 1e5) / 100;
}

/** What a `check_load` answer found wrong, in words. */
export function checkFindings(check: LoadCheck): string[] {
  const out: string[] = [];
  for (const rack of check.racks) {
    if (!rack.slides_in) out.push(`${rack.rack} does not slide in (${rack.blocked_by ?? '?'})`);
  }
  for (const arm of check.spray_arms) {
    if (!arm.full_rotation) {
      out.push(
        `${arm.arm} is stopped by ${arm.blocked_by ?? '?'} at ${arm.first_contact_angle_deg ?? 0} degrees`,
      );
    }
  }
  if (!check.door_closes) out.push(`the door does not close (${check.door_blocked_by.join(', ')})`);
  if (!check.dispenser_opens) {
    out.push(`the dispenser lid is blocked by ${check.dispenser_blocked_by.join(', ')}`);
  }
  if (!check.tablet_path_clear) {
    out.push(`the tablet's path is blocked by ${check.tablet_blocked_by.join(', ')}`);
  }
  if (check.fell_out.length > 0) out.push(`fell out: ${check.fell_out.join(', ')}`);
  if (check.on_tub_floor.length > 0) out.push(`on the tub floor: ${check.on_tub_floor.join(', ')}`);
  for (const p of check.protruding) {
    out.push(`${p.item_id} sticks ${p.beyond_mm} mm out of the ${p.rack}`);
  }
  return out;
}

/** Chord error of the meshes whose points are tested by {@link trueShapeOverlaps}, metres. */
export const TRUE_SHAPE_CHORD_ERROR = 0.0002;

/**
 * The overlap of every two items of a load on their true shapes: for each pair whose bounding
 * boxes come within a millimetre, the surface points of each item that lie in the other's box
 * are put through the other's signed distance (the geometry kernel's, exact for the revolved
 * and extruded solids of the catalogue). An independent computation: it uses neither the
 * collision pieces nor the physics engine.
 */
export function trueShapeOverlaps(items: readonly VerifyItem[]): {
  readonly deepest_mm: number;
  readonly overlaps: readonly Overlap[];
} {
  type Box = { min: [number, number, number]; max: [number, number, number] };
  const sorted = [...items].sort((a, b) => (a.item_id < b.item_id ? -1 : 1));
  const bodies = sorted.map((item) => {
    const shape = instantiate(item.item_type).shape;
    const mesh = buildRenderMesh(shape, { chordError: TRUE_SHAPE_CHORD_ERROR });
    const points: [number, number, number][] = [];
    const box: Box = {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const point = poseTransformPoint(item.pose, [
        mesh.positions[i] as number,
        mesh.positions[i + 1] as number,
        mesh.positions[i + 2] as number,
      ]);
      points.push([point[0], point[1], point[2]]);
      for (let k = 0; k < 3; k++) {
        box.min[k] = Math.min(box.min[k] as number, point[k] as number);
        box.max[k] = Math.max(box.max[k] as number, point[k] as number);
      }
    }
    return { item, shape, points, box };
  });
  const near = (a: Box, b: Box): boolean =>
    [0, 1, 2].every(
      (k) =>
        (a.min[k] as number) - 0.001 <= (b.max[k] as number) &&
        (b.min[k] as number) - 0.001 <= (a.max[k] as number),
    );
  const within = (point: readonly number[], box: Box): boolean =>
    [0, 1, 2].every(
      (k) =>
        (point[k] as number) >= (box.min[k] as number) - 0.002 &&
        (point[k] as number) <= (box.max[k] as number) + 0.002,
    );
  let deepest = 0;
  const overlaps: Overlap[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i] as (typeof bodies)[number];
      const b = bodies[j] as (typeof bodies)[number];
      if (!near(a.box, b.box)) continue;
      let distance = Infinity;
      for (const [from, to] of [
        [a, b],
        [b, a],
      ] as const) {
        for (const point of from.points) {
          if (!within(point, to.box)) continue;
          distance = Math.min(
            distance,
            signedDistance(to.shape, poseInverseTransformPoint(to.item.pose, point)),
          );
        }
      }
      if (!(distance < 0)) continue;
      deepest = Math.max(deepest, -distance);
      if (-distance > PENETRATION_LIMIT) {
        overlaps.push({ a: a.item.item_id, b: b.item.item_id, depth_mm: mm(-distance) });
      }
    }
  }
  overlaps.sort((x, y) => y.depth_mm - x.depth_mm);
  return { deepest_mm: mm(deepest), overlaps };
}

/**
 * Measures a settled load: overlaps, items outside their basket, and the session's own
 * verdicts. `state` is the scene the policy ended with (for the stability flags) and `check`
 * the mechanical check of the final load.
 */
export async function verifyLoad(
  load: {
    readonly machine_id: string;
    readonly machine_config: MachineConfig;
    readonly items: readonly VerifyItem[];
  },
  state: SceneState,
  check: LoadCheck | null,
): Promise<LoadNumbers> {
  const spec = findMachine(load.machine_id);
  if (spec === undefined) throw new RangeError(`loader: unknown machine '${load.machine_id}'`);
  const geometry = buildMachineGeometry(spec, load.machine_config);
  const scene = buildMachineScene(spec, geometry);
  const world = await createPhysicsWorld(
    { timeStep: LOADING_TIME_STEP, gravity: LOADING_GRAVITY, pairLookup: contactPairLookup(false) },
    JOLT_SETTINGS,
  );
  const overlaps: Overlap[] = [];
  let deepest = 0;
  const outOfBasket: OutOfBasket[] = [];
  const homeless: string[] = [];
  const byBasket: { [rack: string]: number } = {};
  try {
    const machine = new Map<string, { pieces: readonly CollisionPiece[]; pose: Pose }>();
    for (const body of scene.bodies) {
      // The door stands open in the loading world; shut, it is tested by check_load.
      if (body.part.component === 'door' || body.part.component === 'dispenser') continue;
      world.addBody(
        body.id,
        body.pieces,
        NO_MASS,
        { material: body.part.material },
        body.part.pose,
        'static',
      );
      machine.set(body.id, { pieces: body.pieces, pose: body.part.pose });
    }
    const pieces = new Map<string, readonly CollisionPiece[]>();
    const sorted = [...load.items].sort((a, b) => (a.item_id < b.item_id ? -1 : 1));
    for (const item of sorted) {
      const instance = instantiate(item.item_type);
      const own = buildCollisionPieces(instance.shape, { chordError: COLLISION_CHORD_ERROR });
      pieces.set(item.item_id, own);
      world.addBody(item.item_id, [...own], instance.mass, instance.contact, item.pose, 'static');
    }
    const poses = new Map(sorted.map((item) => [item.item_id, item.pose]));
    const seen = new Set<string>();
    for (const item of sorted) {
      const own = pieces.get(item.item_id) as readonly CollisionPiece[];
      const hit = world.penetration([...own], item.pose, [item.item_id]);
      for (const other of hit.with) {
        const key = [item.item_id, other].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const against = machine.get(other) ?? {
          pieces: pieces.get(other) as readonly CollisionPiece[],
          pose: poses.get(other) as Pose,
        };
        if (against.pieces === undefined) continue;
        const depth = measurePenetration(
          { pieces: own, pose: item.pose },
          { pieces: against.pieces, pose: against.pose },
        ).depth;
        deepest = Math.max(deepest, depth);
        if (depth > PENETRATION_LIMIT) {
          overlaps.push({ a: item.item_id, b: other, depth_mm: mm(depth) });
        }
      }
    }

    // Which basket carries what, and whether it is inside it.
    const baskets = geometry.affordances.baskets.map((envelope) => {
      const wires = geometry.parts.find((part) => part.id === envelope.frame);
      const basket = spec.baskets.find((b) => b.id === envelope.basketId);
      return {
        frame: envelope.frame,
        origin: envelope.originTub,
        size: basket?.outline.size ?? [0, 0],
        // Lowest point of the basket's own wires in its frame.
        floor: wires === undefined ? 0 : boundingBox(wires.shape).min[2],
      };
    });
    const roof = spec.tub.z[1];
    for (const item of sorted) {
      const instance = instantiate(item.item_type);
      // Highest basket whose floor the item's centre is above.
      const centre = boundingBox(instance.shape, item.pose);
      const mid: [number, number, number] = [
        (centre.min[0] + centre.max[0]) / 2,
        (centre.min[1] + centre.max[1]) / 2,
        (centre.min[2] + centre.max[2]) / 2,
      ];
      const carrier = [...baskets]
        .sort((a, b) => b.origin[2] - a.origin[2])
        .find(
          (basket) =>
            mid[2] >= basket.origin[2] - 0.03 &&
            mid[0] >= basket.origin[0] - 0.03 &&
            mid[0] <= basket.origin[0] + (basket.size[0] as number) + 0.03 &&
            mid[1] >= basket.origin[1] - 0.03 &&
            mid[1] <= basket.origin[1] + (basket.size[1] as number) + 0.03,
        );
      if (carrier === undefined) {
        homeless.push(item.item_id);
        continue;
      }
      byBasket[carrier.frame] = (byBasket[carrier.frame] ?? 0) + 1;
      const box = boundingBox(
        instance.shape,
        poseRelative({ p: carrier.origin, q: [0, 0, 0, 1] }, item.pose),
      );
      const beyondPlan = Math.max(
        0,
        -box.min[0],
        box.max[0] - (carrier.size[0] as number),
        -box.min[1],
        box.max[1] - (carrier.size[1] as number),
      );
      const belowFloor = Math.max(0, carrier.floor - box.min[2]);
      const aboveRoof = Math.max(0, centre.max[2] - roof);
      if (
        beyondPlan > ENVELOPE_TOLERANCE ||
        belowFloor > ENVELOPE_TOLERANCE ||
        aboveRoof > ENVELOPE_TOLERANCE
      ) {
        outOfBasket.push({
          item_id: item.item_id,
          rack: carrier.frame,
          beyond_plan_mm: mm(beyondPlan),
          below_floor_mm: mm(belowFloor),
          above_roof_mm: mm(aboveRoof),
        });
      }
    }
  } finally {
    world.dispose();
  }
  overlaps.sort((a, b) => b.depth_mm - a.depth_mm);
  const trueShape = trueShapeOverlaps(load.items);
  const findings = check === null ? ['check_load was not available'] : checkFindings(check);
  return {
    items: load.items.length,
    deepest_overlap_mm: mm(deepest),
    overlaps,
    deepest_true_overlap_mm: trueShape.deepest_mm,
    true_overlaps: trueShape.overlaps,
    out_of_basket: outOfBasket,
    not_in_a_basket: homeless,
    unstable: state.placed.filter((item) => !item.stable).map((item) => item.item_id),
    by_basket: byBasket,
    check_passes: check !== null && findings.length === 0,
    check_findings: findings,
  };
}
