/**
 * @spotless/sim-scene. Module M3 of the wash simulation (docs/design/sim-core.md sections 3
 * and 4): the simulation's view of a loaded machine. Depends on `@spotless/geometry`,
 * `@spotless/machine`, M1 (`sim-gpu`) and M2 (`sim-params`).
 *
 * The first build (docs/design/scope.md):
 *
 *  - `buildWashScene` (`scene.ts`, types in `scene-types.ts`): from the shapes of the machine
 *    and of the loaded items with their poses to the `WashScene`: blocks and soil cells, the
 *    cell graph with drip targets and contacts, basins, and the data of the ray queries;
 *  - `sceneMachineParts`, `sceneChamber` (`machine-boundary.ts`): the machine geometry of
 *    `@spotless/machine` as the scene builder takes it;
 *  - `CpuTracer` (`trace-cpu.ts`): the f64 reference tracer, `scene.rays`;
 *  - `createGpuTracer` (`trace-gpu.ts`, kernel in `trace.wgsl.ts`): batches of rays and short
 *    segments on the GPU;
 *  - `buildShapeAtlas`, `cachedShapeAtlas`, `locateOnPart` (`atlas*.ts`, `locate.ts`): the
 *    surface of one shape as patches of blocks in its item frame, and the map from a surface
 *    point to its block;
 *  - `sceneBlockKeys` (`stable-keys.ts`): a u32 per block that does not change when another
 *    item of the load is added, removed or moved, for the counters of the exposure stages;
 *  - `SCENE_PARAM_DEFS` (`params.ts`): the registered parameters, to be contributed to the
 *    registry of the simulation.
 *
 * Kept from the typed contract skeleton, because the other skeletons and the contract checks
 * of `@spotless/sim-verify` refer to them (they describe the full design of section 3, which
 * the first build does not implement; `Scene`, `SceneBuilder` and `RayQuery` have no
 * implementation):
 *
 *  - `types.ts`: `Scene`, `SceneBuilder`, `WashItem`, `ItemSoilRecord`, `FilmClass`, ...;
 *  - `layouts.ts`: the binary tables of section 3 as data;
 *  - `exposure.ts`: exposure records shared by modules the dependency table keeps apart.
 *
 * The entry point also re-exports the entry points of M1 and M2, so that every module above
 * (which reaches the GPU foundation and the parameter registry only through this one in the
 * dependency table) can import them from here.
 */

export * from '@spotless/sim-gpu';
export * from '@spotless/sim-params';

export * from './types.ts';
export * from './layouts.ts';
export * from './exposure.ts';
export {
  sceneChamber,
  sceneMachineParts,
  type MachineGeometry,
  type MachineGeometryPart,
  type MachinePartRole,
} from './machine-boundary.ts';

export * from './params.ts';
export * from './scene-types.ts';
export { buildWashScene, cachedShapeAtlas } from './scene.ts';
export { sceneBlockKeys, stableIdKey } from './stable-keys.ts';
export {
  ATLAS_BLOCK_FLAG,
  LINK_KIND,
  NO_INDEX,
  PATCH_KIND,
  QUARTER_CODE,
  quarterHalf,
  SURF_KIND,
  type AtlasPatch,
  type AtlasSurf,
  type AtlasTriangles,
  type ShapeAtlas,
} from './atlas-core.ts';
export {
  buildShapeAtlas,
  DEFAULT_BURIED_DEPTH,
  type AtlasOptions,
  type PartGeometry,
  type ShapeAtlasBuilt,
} from './atlas.ts';
export { atlasTriangles, type ClassifiedTriangles } from './atlas-triangles.ts';
export { atlasCellAt, locateOnPart, type AtlasLocation } from './locate.ts';
export {
  buildBvh,
  BVH_BOX_PAD,
  BVH_MAX_DEPTH,
  BVH_NODE_BYTES,
  type Bvh,
  type BvhOptions,
} from './bvh.ts';
export {
  HIT_WORDS,
  MAX_TRACE_ROOTS,
  packTraceTables,
  packTraceTriangles,
  RAY_WORDS,
  TRACE_HIT_LAYOUT,
  TRACE_NUMERICS,
  TRACE_RAY_LAYOUT,
  TRACE_TRIANGLE_LAYOUT,
  type PackedTraceTables,
  type TraceData,
  type TraceRoot,
} from './trace-data.ts';
export { CpuTracer, createTraceHit, rootTransform, type TraceHit } from './trace-cpu.ts';
export {
  createGpuTracer,
  TRACE_PLANNING_RATE,
  type GpuTraceOptions,
  type GpuTracer,
} from './trace-gpu.ts';
export {
  TRACE_PARAMS_BYTES,
  TRACE_PARAMS_HEADER_WORDS,
  TRACE_WGSL,
  TRACE_WORKGROUP,
} from './trace.wgsl.ts';
