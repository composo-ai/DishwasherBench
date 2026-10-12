/**
 * The exposure cache (docs/design/scope.md, "Calibration is a first-class feature";
 * docs/design/sim-core.md sections M12 and 6, rule 14).
 *
 * An exposure set is stored under a key that covers every value its computation reads and
 * nothing else:
 *
 *  - the geometry of the scene: the parts of the machine in its configuration as the scene is
 *    built from them (every shape and pose, the hinge of an arm, the wash chamber), the block
 *    size, and every item with its shape and pose ({@link sceneGeometryKey}). Not the machine
 *    specification as a whole: a wash with another detergent dose, another programme or other
 *    thermal data has the same geometry and takes its exposure from the cache;
 *  - the wetting data of the materials in the scene, and the masses of the items (for the
 *    screening of items the jets would lift);
 *  - the spray state, the `hydro` group of the parameters, the tier, the simulation seed, the
 *    tracer it runs on (CPU, or the GPU with its stack);
 *  - the code: the schema and the version string, and, where the cache names it
 *    (`ExposureCache.source`), the fingerprint of the sources the exposure is computed by.
 *    The cache on disk (`@spotless/sim-core/node`) always names it, so a set computed by other
 *    water code is never replayed, whether or not the version string was raised.
 *
 * Soils, the liquor, the detergent and the `soil` group of the parameters are not in it, so a
 * wash that differs only in those takes its exposure from the cache.
 *
 * A cache stores bytes (`encodeExposureSet`); where they live is the caller's choice. The
 * in-memory cache is here; the one on disk is in `@spotless/sim-core/node`.
 */

import { canonicalHash, type Pose } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import type { MachineConfig, MachineSpec } from '@spotless/machine';
import { EXPOSURE_SET_SCHEMA } from '@spotless/sim-film';
import type { SprayState } from '@spotless/sim-hydraulics';
import type { ParamSet, TierParams } from '@spotless/sim-params';
import { sceneChamber, sceneMachineParts, type SceneMaterial } from '@spotless/sim-scene';
import { washMachineGeometry } from './scene-setup.ts';

/** A store of encoded exposure sets by key. */
export interface ExposureCache {
  /** The bytes stored under `key`, or undefined. */
  get(key: string): Promise<Uint8Array | undefined>;
  /** Stores `bytes` under `key`. */
  put(key: string, bytes: Uint8Array): Promise<void>;
  /**
   * What identifies the code the stored sets were computed by, for a cache that outlives the
   * process: the fingerprint of the exposure sources (`exposureFingerprint` of
   * `@spotless/sim-core/node`). `wash` makes it part of every key it asks this cache for and
   * records it in the provenance of its result. A cache that lives and dies with the process
   * (the one in memory) has none: the code cannot change under it.
   */
  readonly source?: string;
}

/** A cache that lives as long as the object does. */
export function createMemoryExposureCache(): ExposureCache & { readonly size: number } {
  const store = new Map<string, Uint8Array>();
  return {
    get: (key) => Promise.resolve(store.get(key)),
    put: (key, bytes) => {
      store.set(key, bytes);
      return Promise.resolve();
    },
    get size() {
      return store.size;
    },
  };
}

const shapeHashes = new WeakMap<Shape, string>();

/** `sha256:` hash of a shape (cached per `Shape` object, which is treated as immutable). */
export function shapeHash(shape: Shape): string {
  let hash = shapeHashes.get(shape);
  if (hash === undefined) {
    hash = canonicalHash(shape);
    shapeHashes.set(shape, hash);
  }
  return hash;
}

/** One item as the geometry of a scene depends on it. */
export interface SceneKeyItem {
  readonly itemId: string;
  readonly typeId: string;
  readonly shape: Shape;
  /** The pose as used: already rounded (see `canonicalPose`). */
  readonly pose: Pose;
}

const machineKeys = new WeakMap<MachineSpec, Map<string, string>>();

/**
 * `sha256:` hash of the machine as the scene is built from it: every part of its geometry in
 * the configuration (id, role, shape, pose, the hinge of a rotating part, whether it encloses
 * the chamber) and the box of the wash chamber. Kept per specification object and
 * configuration.
 */
export function machineSceneKey(machine: MachineSpec, config: MachineConfig): string {
  let byConfig = machineKeys.get(machine);
  if (byConfig === undefined) {
    byConfig = new Map();
    machineKeys.set(machine, byConfig);
  }
  const configKey = canonicalHash(config);
  let key = byConfig.get(configKey);
  if (key === undefined) {
    const parts = sceneMachineParts(washMachineGeometry(machine, config));
    key = canonicalHash({
      parts: parts.map((part) => ({
        id: part.id,
        role: part.role,
        shape: shapeHash(part.shape),
        p: [...part.pose.p],
        q: [...part.pose.q],
        rotation:
          part.rotation === undefined
            ? null
            : { point: [...part.rotation.point], axis: [...part.rotation.axis] },
        enclosure: part.enclosure === true,
      })),
      chamber: sceneChamber(machine),
    });
    byConfig.set(configKey, key);
  }
  return key;
}

/**
 * `sha256:` hash of the geometry of a scene: the machine in its configuration as the scene is
 * built from it ({@link machineSceneKey}), the block size, and every item with its shape and
 * pose, in the order of the item ids. Nothing else of the machine specification is in it (its
 * programmes, its dosing, its hydraulic and thermal data), nor the soils of the items.
 */
export function sceneGeometryKey(
  machine: MachineSpec,
  config: MachineConfig,
  blockSize: number,
  items: readonly SceneKeyItem[],
): string {
  const sorted = [...items].sort((a, b) =>
    a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0,
  );
  return canonicalHash({
    machine: machineSceneKey(machine, config),
    blockSize,
    items: sorted.map((item) => ({
      itemId: item.itemId,
      typeId: item.typeId,
      shape: shapeHash(item.shape),
      p: [...item.pose.p],
      q: [...item.pose.q],
    })),
  });
}

/** What the key of an exposure set is the hash of. */
export interface ExposureKeyParts {
  /** `sceneGeometryKey` of the scene. */
  readonly scene: string;
  /** The spray state. */
  readonly state: SprayState;
  /** Spray level id of every rotating root of the scene's ray data. */
  readonly armLevels: readonly string[];
  readonly params: ParamSet;
  readonly tier: TierParams;
  readonly simSeed: number;
  /** Identifies the exposure stage (`exposure-v<schema>`, or the name a caller gave its own). */
  readonly stage: string;
  /**
   * The tracer the stage runs on: `cpu`, or `gpu` with the stack string of the device. The
   * two tracers differ on rare grazing rays, and so may two GPU stacks, so their exposure sets
   * are kept apart.
   */
  readonly backend?: string;
  /** Version of the simulator code (`SIM_VERSION`). */
  readonly version?: string;
  /** Fingerprint of the sources of the exposure side, where the cache names one. */
  readonly source?: string;
  /** The materials of the scene with their wetting data (`WashScene.materials`). */
  readonly materials?: readonly SceneMaterial[];
  /** Mass of the items by id, kg, as given to the stage (`ExposureStageInput.itemMass`). */
  readonly itemMass?: ReadonlyMap<string, number>;
}

/** The cache key of the exposure set of one spray state on one scene: a `sha256:` hash. */
export function exposureKey(parts: ExposureKeyParts): string {
  return canonicalHash({
    schema: EXPOSURE_SET_SCHEMA,
    stage: parts.stage,
    backend: parts.backend ?? '',
    version: parts.version ?? '',
    source: parts.source ?? '',
    materials: canonicalHash(parts.materials ?? []),
    itemMass: [...(parts.itemMass ?? [])].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    scene: parts.scene,
    state: parts.state.key,
    armLevels: [...parts.armLevels],
    hydro: parts.params.hydroHash,
    tier: canonicalHash(parts.tier),
    simSeed: parts.simSeed >>> 0,
  });
}
