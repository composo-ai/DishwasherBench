/**
 * The loads of the phenomena suite, read as data, and what the scenarios do to them: soils in
 * the checklist's terms, and poses that are set exactly where the pose itself is the point.
 *
 * Two sources (this package does not depend on the session or the loader, so both are read as
 * JSON, as `scripts/demo-washes.ts` reads the loader's loads):
 *
 *  - `packages/sim-verify/phenomena/loads/<name>.json`: built for the suite by
 *    `phenomena/builder/build-loads.ts` through the session's loading physics;
 *  - `packages/loader/loads/<name>.json` (given as `loader:<name>`): the loader's settled
 *    standard loads, with the IEC soils the level put on them.
 *
 * Units: SI (poses in metres, tub frame); soil amounts in grams as applied.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSoil, instantiate } from '@spotless/catalogue';
import {
  degToRad,
  quatFromAxisAngle,
  quatFromTo,
  quatMul,
  quatNormalise,
  quatRotate,
  v3Normalise,
  type Pose,
  type Quat,
  type Vec3,
} from '@spotless/core';
import { boundingBox } from '@spotless/geometry';
import { buildMachineGeometry, PRIMARY_MACHINE, type MachineConfig } from '@spotless/machine';
import type { ItemSoilRecord } from '@spotless/sim-core';
import { REPOSITORY_ROOT } from '../node/workspace.ts';
import type { Load, LoadItem, SoilSpec } from './types.ts';

/** Directory of the loads built for the suite. */
export const BUILT_LOADS_DIR = join(
  REPOSITORY_ROOT,
  'packages',
  'sim-verify',
  'phenomena',
  'loads',
);

/** Directory of the loader's standard loads. */
export const LOADER_LOADS_DIR = join(REPOSITORY_ROOT, 'packages', 'loader', 'loads');

/** Thrown when a load a scenario needs is not on disk or could not be built as described. */
export class LoadError extends Error {
  override readonly name = 'LoadError';
}

interface CheckFile {
  readonly spray_arms: readonly {
    readonly arm: string;
    readonly full_rotation: boolean;
    readonly first_contact_angle_deg?: number;
    readonly blocked_by?: string;
  }[];
  readonly dispenser_opens: boolean;
  readonly tablet_path_clear: boolean;
}

interface PoseFile {
  readonly p: readonly [number, number, number];
  readonly q: readonly [number, number, number, number];
}

interface BuiltFile {
  readonly name: string;
  readonly description: string;
  readonly machine_config: MachineConfig;
  readonly items: readonly {
    readonly item_id: string;
    readonly item_type: string;
    readonly pose: PoseFile;
    readonly placed: { readonly op: string; readonly stable: boolean };
  }[];
  readonly check: CheckFile;
  readonly failed: readonly { readonly item_id: string; readonly reason: string }[];
  readonly notes: readonly string[];
}

interface LoaderFile {
  readonly name: string;
  readonly description: string;
  readonly check: CheckFile;
  readonly wash_manifest: {
    readonly machine_config: MachineConfig;
    readonly items: readonly {
      readonly item_id: string;
      readonly item_type: string;
      readonly pose: PoseFile;
      readonly soils: readonly {
        readonly type: string;
        readonly regions: readonly { readonly region: string; readonly coverage: number }[];
        readonly amountG: number;
        readonly ageH: number;
        readonly heatHistory?: ItemSoilRecord['heat_history'];
      }[];
    }[];
  };
}

/**
 * The arms a mechanical check found stopped, as the wash takes them: spray level id to the
 * angle of the arm in the tub frame, radians. The session reports the angle the arm turned
 * through in its own sense of rotation before it touched something.
 */
function stalledArmsOf(check: CheckFile, config: MachineConfig): Record<string, number> {
  const stalled: Record<string, number> = {};
  const blocked = check.spray_arms.filter((arm) => !arm.full_rotation);
  if (blocked.length === 0) return stalled;
  const parts = buildMachineGeometry(PRIMARY_MACHINE, config).parts;
  for (const arm of blocked) {
    const part = parts.find((candidate) => candidate.id === arm.arm);
    if (part?.arm === undefined) throw new LoadError(`the machine has no spray arm '${arm.arm}'`);
    stalled[part.arm.levelId] = part.arm.senseSign * degToRad(arm.first_contact_angle_deg ?? 0);
  }
  return stalled;
}

const poseOf = (file: PoseFile): Pose => ({ p: [...file.p], q: [...file.q] });

const loads = new Map<string, Load>();

/**
 * Reads a load: `<name>` for one built for the suite, `loader:<name>` for a standard load of
 * the loader. Throws {@link LoadError} when the file is missing or when the builder could not
 * place every item of its recipe.
 */
export function readLoad(name: string): Load {
  const known = loads.get(name);
  if (known !== undefined) return known;
  let load: Load;
  if (name.startsWith('loader:')) {
    const file = join(LOADER_LOADS_DIR, `${name.slice('loader:'.length)}.json`);
    let raw: LoaderFile;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8')) as LoaderFile;
    } catch {
      throw new LoadError(`standard load ${file} is missing: generate it with @spotless/loader`);
    }
    const m = raw.wash_manifest;
    load = {
      name,
      description: raw.description,
      source: 'loader',
      items: m.items.map((item) => ({
        itemId: item.item_id,
        typeId: item.item_type,
        pose: poseOf(item.pose),
        soils: item.soils.map((s) => ({
          type: s.type,
          regions: s.regions.map((r) => ({ region: r.region, coverage: r.coverage })),
          amount_g: s.amountG,
          age_h: s.ageH,
          heat_history: s.heatHistory ?? 'none',
        })),
      })),
      config: m.machine_config,
      stalledArms: stalledArmsOf(raw.check, m.machine_config),
      dispenserBlocked: !raw.check.dispenser_opens || !raw.check.tablet_path_clear,
      notes: [],
    };
  } else {
    const file = join(BUILT_LOADS_DIR, `${name}.json`);
    let raw: BuiltFile;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8')) as BuiltFile;
    } catch {
      throw new LoadError(
        `load '${name}' is not built: run phenomena/builder/build-loads.ts ${name}`,
      );
    }
    if (raw.failed.length > 0) {
      throw new LoadError(
        `load '${name}' could not be built as described: ${raw.failed
          .map((f) => `${f.item_id} (${f.reason})`)
          .join(', ')}`,
      );
    }
    load = {
      name,
      description: raw.description,
      source: 'built',
      items: raw.items.map((item) => ({
        itemId: item.item_id,
        typeId: item.item_type,
        pose: poseOf(item.pose),
        soils: [],
      })),
      config: raw.machine_config,
      stalledArms: stalledArmsOf(raw.check, raw.machine_config),
      dispenserBlocked: !raw.check.dispenser_opens || !raw.check.tablet_path_clear,
      notes: raw.notes,
    };
  }
  loads.set(name, load);
  return load;
}

// ---------------------------------------------------------------------------------------------
// Soils
// ---------------------------------------------------------------------------------------------

/**
 * The soil record of a {@link SoilSpec} on an item type. Without an amount the catalogue's
 * typical loading of the soil is spread over the covered area of the named regions. Throws a
 * RangeError for a region the item type lacks.
 */
export function soilRecord(spec: SoilSpec, typeId: string): ItemSoilRecord {
  const instance = instantiate(typeId);
  let covered = 0;
  for (const [region, coverage] of Object.entries(spec.regions)) {
    const area = instance.regionAreas[region];
    if (area === undefined) throw new RangeError(`${typeId} has no region '${region}'`);
    covered += area * coverage;
  }
  const amount =
    spec.amount_g ?? getSoil(spec.type).loading.typicalGPerM2 * covered * (spec.amountFactor ?? 1);
  return {
    type: spec.type,
    regions: Object.entries(spec.regions).map(([region, coverage]) => ({ region, coverage })),
    amount_g: amount,
    age_h: spec.age_h ?? 2,
    heat_history: spec.heat ?? 'warm',
  };
}

// ---------------------------------------------------------------------------------------------
// Exact poses
// ---------------------------------------------------------------------------------------------

/** Lowest point of an item at a pose, tub frame z, metres. */
export function lowestPoint(typeId: string, pose: Pose): number {
  return boundingBox(instantiate(typeId).shape, pose).min[2];
}

/** Centre of the bounding box of an item at a pose, tub frame, metres. */
export function boxCentre(typeId: string, pose: Pose): Vec3 {
  const box = boundingBox(instantiate(typeId).shape, pose);
  return [
    0.5 * (box.min[0] + box.max[0]),
    0.5 * (box.min[1] + box.max[1]),
    0.5 * (box.min[2] + box.max[2]),
  ];
}

/**
 * An item turned by `angle` (radians) about a horizontal axis (`axis`, tub frame) through the
 * centre of its bounding box and then moved straight up or down until its lowest point is at
 * the height it had before: the tilt of something that keeps standing on the same support.
 * The result is flagged `exact`.
 */
export function tilted(item: LoadItem, angle: number, axis: Vec3): LoadItem {
  const centre = boxCentre(item.typeId, item.pose);
  const turn = quatFromAxisAngle(v3Normalise(axis), angle);
  const q: Quat = quatNormalise(quatMul(turn, item.pose.q));
  const arm: Vec3 = [
    item.pose.p[0] - centre[0],
    item.pose.p[1] - centre[1],
    item.pose.p[2] - centre[2],
  ];
  const turned = quatRotate(turn, arm);
  const p: Vec3 = [centre[0] + turned[0], centre[1] + turned[1], centre[2] + turned[2]];
  const before = lowestPoint(item.typeId, item.pose);
  const after = lowestPoint(item.typeId, { p, q });
  return { ...item, pose: { p: [p[0], p[1], p[2] + (before - after)], q }, exact: true };
}

/**
 * An item on edge turned round in its seat: half a turn about the line that runs up its own
 * face (the upward direction, less its part along the face normal, the item's `+z` axis)
 * through the centre of its bounding box, then moved straight up or down until its lowest
 * point is where it was. It leans as it did and stands in the same slot with its other side
 * to the front. The result is flagged `exact`.
 */
export function turnedRound(item: LoadItem): LoadItem {
  const normal = quatRotate(item.pose.q, [0, 0, 1]);
  const up: Vec3 = [-normal[2] * normal[0], -normal[2] * normal[1], 1 - normal[2] * normal[2]];
  if (Math.hypot(up[0], up[1], up[2]) < 0.2) {
    throw new LoadError(`${item.itemId} lies flat: it cannot be turned round in its seat`);
  }
  const centre = boxCentre(item.typeId, item.pose);
  const turn = quatFromAxisAngle(v3Normalise(up), Math.PI);
  const q: Quat = quatNormalise(quatMul(turn, item.pose.q));
  const arm = quatRotate(turn, [
    item.pose.p[0] - centre[0],
    item.pose.p[1] - centre[1],
    item.pose.p[2] - centre[2],
  ]);
  const p: Vec3 = [centre[0] + arm[0], centre[1] + arm[1], centre[2] + arm[2]];
  const before = lowestPoint(item.typeId, item.pose);
  const after = lowestPoint(item.typeId, { p, q });
  return { ...item, pose: { p: [p[0], p[1], p[2] + (before - after)], q }, exact: true };
}

/**
 * A spray arm held still, as the wash takes it: the spray level of the arm part `armPart` of
 * the owner's machine to the angle in the tub frame, radians, at which the arm stands after
 * turning `angleDeg` degrees in its own sense of rotation. What a mechanical check reports
 * for an arm that something stops; for a scenario that holds the arm without a load to do it.
 */
export function armHeldAt(
  armPart: string,
  angleDeg: number,
  config: MachineConfig = PRIMARY_MACHINE.defaultConfig,
): Record<string, number> {
  return stalledArmsOf(
    {
      spray_arms: [{ arm: armPart, full_rotation: false, first_contact_angle_deg: angleDeg }],
      dispenser_opens: true,
      tablet_path_clear: true,
    },
    config,
  );
}

/**
 * A flat item standing on edge with its face (its `+z` axis) along `normal` (tub frame), the
 * centre of its bounding box above (`x`, `y`) and its lowest point at height `z`, metres.
 * The result is flagged `exact`.
 */
export function standing(item: LoadItem, normal: Vec3, x: number, y: number, z: number): LoadItem {
  const q = quatFromTo([0, 0, 1], v3Normalise(normal));
  const centre = boxCentre(item.typeId, { p: [0, 0, 0], q });
  const low = lowestPoint(item.typeId, { p: [0, 0, 0], q });
  return {
    ...item,
    pose: { p: [x - centre[0], y - centre[1], z - low], q },
    exact: true,
  };
}
