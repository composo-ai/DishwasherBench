/**
 * Node-only entry point of `@spotless/sim-gpu` (import as `@spotless/sim-gpu/node`): the Dawn
 * bindings behind a `GpuEntry` (docs/design/sim-core.md section M1). Kept out of the main entry
 * point so that the simulation packages, which re-export it, stay loadable in a browser.
 */

export * from './device.ts';
export * from './probe-files.ts';
export * from './bench-lock.ts';
