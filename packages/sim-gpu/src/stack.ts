/**
 * The stack string as text (docs/design/sim-core.md section M1 and determinism rule 13): the
 * full stack (simulator version, GPU, operating-system build, WebGPU bindings, runtime, physics
 * engine) is part of every result, cache key, checkpoint and golden hash. No units.
 */

import type { StackString } from './types.ts';

/**
 * The part of the stack that decides what a shader computes: GPU, operating-system build (the
 * shader compiler and driver), WebGPU implementation and runtime. Determinism probes are
 * recorded per GPU stack; the simulator version and the physics engine do not change them.
 */
export type GpuStack = Pick<StackString, 'gpu' | 'os' | 'webgpu' | 'runtime'>;

/**
 * The stack as one line, `sim=...; gpu=...; os=...; webgpu=...; runtime=...; physics=...`, in
 * that fixed order: the text to put into cache keys, results and golden hashes.
 */
export function stackKey(stack: StackString): string {
  return (
    `sim=${stack.sim}; gpu=${stack.gpu}; os=${stack.os}; webgpu=${stack.webgpu}; ` +
    `runtime=${stack.runtime}; physics=${stack.physics}`
  );
}

/** The GPU stack of a stack string. */
export function gpuStackOf(stack: StackString): GpuStack {
  return { gpu: stack.gpu, os: stack.os, webgpu: stack.webgpu, runtime: stack.runtime };
}

/** The GPU stack as one line, `gpu=...; os=...; webgpu=...; runtime=...`. */
export function gpuStackKey(stack: GpuStack): string {
  return `gpu=${stack.gpu}; os=${stack.os}; webgpu=${stack.webgpu}; runtime=${stack.runtime}`;
}

/**
 * A file name for a GPU stack: its four parts in lower case with every run of other characters
 * replaced by `-`, joined by `__`, for example
 * `apple-metal-3-apple-m3-pro__macos-27.0.1-26a434__webgpu-0.6.2__node-20.19.0`.
 */
export function gpuStackSlug(stack: GpuStack): string {
  const slug = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return [stack.gpu, stack.os, stack.webgpu, stack.runtime].map(slug).join('__');
}
