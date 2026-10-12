/**
 * What the stages of the scene build hand to each other: the instances with their atlases and
 * frames, and the block arrays in f64 before they are stored as f32. Internal to the package.
 *
 * Units: SI. Frame: tub frame unless a name says otherwise.
 */

import type { Aabb } from '@spotless/geometry';
import type { Affine } from './affine.ts';
import type { ShapeAtlasBuilt } from './atlas.ts';
import type { SceneParams } from './params.ts';
import type { SceneBlocks, SceneGraph, SceneInstance, ScenePatch } from './scene-types.ts';
import type { CpuTracer } from './trace-cpu.ts';

/** One instance while the scene is built. */
export interface InstanceBuild {
  readonly instance: SceneInstance;
  readonly atlas: ShapeAtlasBuilt;
  /** Item frame to tub frame (reference pose), and back. */
  readonly toTub: Affine;
  readonly toItem: Affine;
  /** Per block of the atlas: its block in the scene, or 0xffffffff when it was left out. */
  readonly blockOf: Uint32Array;
  /** Per block of the instance (scene block minus `firstBlock`): its block in the atlas. */
  readonly localOf: Uint32Array;
}

/** The scene while it is built. */
export interface SceneBuild {
  readonly params: SceneParams;
  /** Block size of the items, metres. */
  readonly blockSize: number;
  readonly instances: readonly InstanceBuild[];
  readonly patches: readonly ScenePatch[];
  /** Block centres and normals in f64, three per block. */
  readonly centre: Float64Array;
  readonly normal: Float64Array;
  readonly blocks: SceneBlocks;
  readonly graph: SceneGraph;
  readonly rays: CpuTracer;
  /** Box of everything in the scene, tub frame. */
  readonly box: Aabb;
}
