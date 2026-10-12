/**
 * From the session's wash manifest to the simulation's input, and back.
 *
 * Frames and conventions, checked on both sides:
 *
 *  - The manifest gives every loaded item the settled pose of its item frame in the tub frame
 *    as a `Pose` of `@spotless/core`: `p` in metres, `q` as `[x, y, z, w]`, exact as the
 *    loading physics left it (`WashManifestItem.pose`). The simulation takes the same thing
 *    (`WashItemInput.pose`: item frame to tub frame, metres), so the pose is handed over
 *    unchanged, bit for bit. The player-visible `LoadManifest` beside it is something else:
 *    the item's reference point in millimetres with the quaternion as `quat_wxyz`; it is used
 *    here only to check the hand-over (`poseDisagreement`).
 *  - Soils go over field by field (`amountG` grams, `ageH` hours and `heatHistory` of the
 *    level are `amount_g`, `age_h` and `heat_history` of the simulation), regions and
 *    coverages unchanged.
 *  - A spray arm the load holds still is named by the session after the machine part
 *    (`lower_arm`) with the angle it turned through, in its own sense of rotation, before it
 *    touched something; the simulation wants the spray level (`lower`) and the angle of the
 *    arm in the tub frame, radians: the angle turned times the sense of the arm.
 *  - A dispenser lid that cannot open, or a tablet that cannot fall into its tray, is one
 *    condition for the simulation: the detergent is not released.
 */

import { instantiate } from '@spotless/catalogue';
import { degToRad, poseTransformPoint, type Pose, type Quat } from '@spotless/core';
import type { LevelSoil } from '@spotless/levels';
import { buildMachineGeometry, findMachine, findProgramme } from '@spotless/machine';
import type { LoadCheck, WashManifest, WashManifestItem, WashTier } from '@spotless/session';
import { washParamFilesFor, type WashParamChoice } from './defaults.ts';
import { composeParamFiles, ParamSetFileError } from './sim.ts';
import type { SimSoilRecord, WashInput, WashItemInput } from './sim.ts';

/** Thrown for a manifest that cannot be washed: an infrastructure failure, never a score. */
export class WashManifestError extends Error {
  override readonly name = 'WashManifestError';
}

/** How the manifest is turned into the simulation's input. */
export interface WashInputOptions {
  readonly tier: WashTier;
  /**
   * Seed of the sampling of the wash itself; default {@link simSeedOf} of the level's seed.
   * For a study of the simulation's noise: the same load with other seeds.
   */
  readonly simSeed?: number;
}

/**
 * The seed of the wash's own sampling that goes with a level's seed: a fixed mix of it, so
 * that one hidden number per level decides both where the soil lies and how the wash is
 * sampled, without the two streams being the same number.
 */
export function simSeedOf(levelSeed: number): number {
  return Math.imul((levelSeed ^ 0x9e3779b9) >>> 0, 0x85ebca6b) >>> 0;
}

/** A soil of a level as the simulation takes it. */
export function simSoilOf(soil: LevelSoil): SimSoilRecord {
  return {
    type: soil.type,
    regions: soil.regions.map((r) => ({ region: r.region, coverage: r.coverage })),
    amount_g: soil.amountG,
    age_h: soil.ageH,
    heat_history: soil.heatHistory,
  };
}

/** The soil of a level that a soil of the simulation's input came from (no description). */
export function levelSoilOf(soil: SimSoilRecord): LevelSoil {
  return {
    type: soil.type,
    regions: soil.regions.map((r) => ({ region: r.region, coverage: r.coverage })),
    amountG: soil.amount_g,
    ageH: soil.age_h,
    heatHistory: soil.heat_history,
  };
}

/**
 * The arms the load holds still, as the simulation wants them: spray level id to the angle of
 * the arm (radians, tub frame) at which it stands. Throws for an arm the machine does not have.
 */
export function stalledArmsOf(
  manifest: Pick<WashManifest, 'machine_id' | 'machine_config'>,
  check: Pick<LoadCheck, 'spray_arms'>,
): Record<string, number> {
  const blocked = check.spray_arms.filter((arm) => !arm.full_rotation);
  const stalled: Record<string, number> = {};
  if (blocked.length === 0) return stalled;
  const spec = findMachine(manifest.machine_id);
  if (spec === undefined) {
    throw new WashManifestError(`unknown machine '${manifest.machine_id}'`);
  }
  const parts = buildMachineGeometry(spec, manifest.machine_config).parts;
  for (const arm of blocked) {
    const part = parts.find((candidate) => candidate.id === arm.arm);
    if (part?.arm === undefined) {
      throw new WashManifestError(`the machine has no spray arm '${arm.arm}'`);
    }
    stalled[part.arm.levelId] = part.arm.senseSign * degToRad(arm.first_contact_angle_deg ?? 0);
  }
  return stalled;
}

/**
 * The simulation's input for a manifest: machine, configuration, programme, every loaded item
 * with its catalogue type, exact pose and soils, the seeds, and what the session found
 * mechanically. Throws a {@link WashManifestError} for an unknown machine, programme or arm.
 * The parameters and the detergent of the wash are added by {@link withWashParams}.
 */
export function washInputOf(manifest: WashManifest, options: WashInputOptions): WashInput {
  const machine = findMachine(manifest.machine_id);
  if (machine === undefined) {
    throw new WashManifestError(`unknown machine '${manifest.machine_id}'`);
  }
  const programme = findProgramme(machine, manifest.programme_id);
  if (programme === undefined) {
    throw new WashManifestError(
      `machine '${machine.id}' has no programme '${manifest.programme_id}'`,
    );
  }
  const items: WashItemInput[] = manifest.items.map((item) => ({
    itemId: item.item_id,
    typeId: item.item_type,
    // Item frame to tub frame, metres, [x, y, z, w]: the same convention on both sides.
    pose: { p: [item.pose.p[0], item.pose.p[1], item.pose.p[2]], q: [...item.pose.q] as Quat },
    soils: item.soils.map(simSoilOf),
  }));
  const check = manifest.prechecks;
  const stalledArms = check === undefined ? {} : stalledArmsOf(manifest, check);
  const dispenserBlocked =
    check !== undefined && (!check.dispenser_opens || !check.tablet_path_clear);
  return {
    machine,
    config: manifest.machine_config,
    programme,
    items,
    tier: options.tier,
    levelSeed: manifest.seed >>> 0,
    simSeed: (options.simSeed ?? simSeedOf(manifest.seed)) >>> 0,
    ...(Object.keys(stalledArms).length === 0 ? {} : { stalledArms }),
    ...(dispenserBlocked ? { dispenserBlocked: true } : {}),
  };
}

/**
 * The input with the parameters and the detergent of a choice (`defaults.ts`; default
 * `machine-default`: for the owner's machine the current anchored set with the owner's
 * detergent): the named parameter-set files laid over the registry defaults, their records
 * for the provenance of the result, and the dose. Reads the files: throws the simulation's
 * `StaleParamSetError` for one whose stored hashes are stale unless `acceptStale` is set, and
 * its `ParamSetFileError` for one that cannot be read or does not validate (with the place
 * where the game's default is named, when it is the default that failed).
 */
export function withWashParams(
  input: WashInput,
  choice: WashParamChoice = 'machine-default',
  acceptStale = false,
): WashInput {
  const files = washParamFilesFor(input.machine.id, choice);
  if (files === null) return input;
  let composed: ReturnType<typeof composeParamFiles>;
  try {
    composed = composeParamFiles({
      paramSets: files.paramSets,
      ...(files.detergent?.params === undefined ? {} : { detergent: files.detergent.params }),
      ...(acceptStale ? { acceptStale: true } : {}),
    });
  } catch (error) {
    if (choice === 'machine-default' && error instanceof ParamSetFileError) {
      throw new ParamSetFileError(
        `${error.message}\nThis is the default parameter set of the machine '${input.machine.id}', named in packages/wash-runner/src/defaults.ts: point it at the current anchored set, or name the sets of the wash yourself.`,
      );
    }
    throw error;
  }
  return {
    ...input,
    ...(Object.keys(composed.params).length === 0 ? {} : { params: composed.params }),
    ...(composed.records.length === 0 ? {} : { paramSets: composed.records }),
    ...(files.detergent === undefined
      ? {}
      : { detergent: { name: files.detergent.name, dose: files.detergent.dose_g / 1000 } }),
  };
}

/**
 * The loaded items of a manifest as an input describes them: the inverse of the item part of
 * {@link washInputOf}. Poses are returned exactly as given; soils without the level's wording
 * (`description`), which the simulation does not take. `points` are the caller's to supply.
 */
export function manifestItemsOf(
  input: Pick<WashInput, 'items'>,
  points: (itemId: string) => number,
): WashManifestItem[] {
  return input.items.map((item) => ({
    item_id: item.itemId,
    item_type: item.typeId,
    pose: { p: [item.pose.p[0], item.pose.p[1], item.pose.p[2]], q: [...item.pose.q] as Quat },
    soils: item.soils.map(levelSoilOf),
    points: points(item.itemId),
  }));
}

/** One item whose pose in the input does not put it where the load manifest says it is. */
export interface PoseDisagreement {
  readonly item_id: string;
  /** Distance between the two positions of the item's reference point, millimetres. */
  readonly position_mm: number;
  /** Angle between the two orientations, degrees. */
  readonly angle_deg: number;
}

function quatAngleDeg(a: Quat, b: Quat): number {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  const na = Math.hypot(a[0], a[1], a[2], a[3]);
  const nb = Math.hypot(b[0], b[1], b[2], b[3]);
  const c = Math.min(1, dot / (na * nb));
  return (2 * Math.acos(c) * 180) / Math.PI;
}

/**
 * Checks the hand-over of poses against the player-visible load manifest, which states the
 * same load another way: the item's reference point in the tub frame in millimetres and its
 * orientation as `quat_wxyz`. For every item of the input the reference point of its catalogue
 * type is carried through the input's pose and compared; the items further off than the
 * rounding of the load manifest allows (0.1 mm and 1e-4 per quaternion component, so 0.2 mm
 * and 0.05 degrees here) are returned. An input whose quaternions are in another order, or
 * whose positions are in another unit or frame, fails this for every tilted item.
 */
export function poseDisagreement(
  manifest: Pick<WashManifest, 'load'>,
  input: Pick<WashInput, 'items'>,
  tolerance: { readonly position_mm: number; readonly angle_deg: number } = {
    position_mm: 0.2,
    angle_deg: 0.05,
  },
): PoseDisagreement[] {
  const stated = new Map(manifest.load.items.map((item) => [item.item_id, item]));
  const off: PoseDisagreement[] = [];
  for (const item of input.items) {
    const wire = stated.get(item.itemId);
    if (wire === undefined) {
      off.push({ item_id: item.itemId, position_mm: Infinity, angle_deg: Infinity });
      continue;
    }
    const pose: Pose = item.pose;
    const reference = poseTransformPoint(pose, instantiate(item.typeId).referencePoint);
    const position = Math.hypot(
      reference[0] * 1000 - wire.position_mm[0],
      reference[1] * 1000 - wire.position_mm[1],
      reference[2] * 1000 - wire.position_mm[2],
    );
    const [w, x, y, z] = wire.quat_wxyz;
    const angle = quatAngleDeg(pose.q, [x, y, z, w]);
    if (!(position <= tolerance.position_mm) || !(angle <= tolerance.angle_deg)) {
      off.push({ item_id: item.itemId, position_mm: position, angle_deg: angle });
    }
  }
  return off;
}
