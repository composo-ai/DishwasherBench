/**
 * @spotless/core: math types and operations, unit converters, the counter-based random number
 * generator (TypeScript and WGSL), SHA-256, canonical JSON, quantisation, branded ids and result
 * types. No dependencies; runs unchanged in Node and in browsers.
 */

export type { Mat3, Pose, Quat, QuatWxyz, Vec3 } from './math/types.ts';
export * from './math/vec3.ts';
export * from './math/quat.ts';
export * from './math/pose.ts';
export * from './math/mat3.ts';
export * from './units.ts';
export * from './rng.ts';
export { RNG_WGSL } from './rng.wgsl.ts';
export * from './sha256.ts';
export * from './canonical-json.ts';
export * from './quantise.ts';
export * from './ids.ts';
export * from './result.ts';
